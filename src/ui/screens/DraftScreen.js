// src/ui/screens/DraftScreen.js
import { navigate } from '../router.js';
import { initEmotes, destroyEmotes } from '../components/Emotes.js';
import { PokemonCard, PokemonMiniCard, PokemonRosterCard, getItemIconHtml } from '../components/PokemonCard.js';
import { TypeBadge } from '../components/TypeBadge.js';
import { TYPE_NAMES_PT, TYPE_ICONS, TYPE_COLORS, ALL_TYPES, getTotalEffectiveness } from '../../engine/types.js';
import { DRAFT_MODES, botChooseType, botChoosePokemon, getDraftProgress, selectOptionsFromPool } from '../../engine/draft.js';
import { createBracket } from '../../tournament/bracket.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import itemsData from '../../data/items-sample.json';
import { getTrainerAvatar } from '../../lib/avatars.js';
import { playBGM, playSFX, attachMuteToggleListener } from '../../lib/sounds.js';

let roomId = null;
let roomCode = null;
let currentUserId = null;
let isHost = false;
let container = null;

let draftState = null;
let participants = [];
let room = null;

let draftStateSubscription = null;
let participantsSubscription = null;
let roomSubscription = null;

let loading = false;
let errorMsg = '';
let botTurnInProgress = false;
let pendingBotPart = null;
let botTimerWorker = null;
let turnTimerInterval = null;
let turnTimeLeft = 0;
let lastActiveSlot = null;
let lastActiveRound = null;
let lastHistoryLength = 0;
let lastProcessedSlot = null;
let lastProcessedRound = null;
let lastProcessedBotSlot = null;
let lastProcessedBotRound = null;
let lastProcessedBotPhase = null;

function getAvailablePool() {
  return draftState?.available_pool || pokemonData.map(p => p.id);
}

export async function render(cont, params) {
  container = cont;
  roomCode = params.code;
  roomId = params.roomId;
  isHost = params.isHost;
  loading = true;
  errorMsg = '';
  lastActiveSlot = null;
  lastActiveRound = null;
  lastHistoryLength = 0;
  lastProcessedSlot = null;
  lastProcessedRound = null;
  
  if (!botTimerWorker) {
    botTimerWorker = new Worker(new URL('../../lib/timerWorker.js', import.meta.url));
    botTimerWorker.onmessage = () => {
      if (pendingBotPart) {
        executeBotTurn(pendingBotPart);
        pendingBotPart = null;
      }
    };
  }

  botTurnInProgress = false;

  renderLayout();
  playBGM('draft');

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }
    currentUserId = user.id;
    const myUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Treinador';
    initEmotes(document.body, roomId, currentUserId, myUsername);

    // Busca dados da sala
    const { data: rData, error: rErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (rErr) throw rErr;
    room = rData;
    isHost = (room.host_id === currentUserId);

    // Busca participantes
    await fetchParticipants();

    // Busca estado do draft
    await fetchDraftState();

    // Configura realtime
    setupSubscriptions();

    // Inicia lógica de turnos
    processTurn();

  } catch (err) {
    console.error('Erro ao iniciar draft:', err);
    errorMsg = err.message || 'Erro ao carregar dados do draft.';
  } finally {
    loading = false;
    updateUI();
  }
}

async function fetchParticipants() {
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      *,
      profile:profiles(username, avatar_url)
    `)
    .eq('room_id', roomId)
    .order('slot', { ascending: true });

  if (error) throw error;
  participants = data || [];
}

async function fetchDraftState() {
  const { data, error } = await supabase
    .from('draft_state')
    .select('*')
    .eq('room_id', roomId)
    .single();

  if (error) throw error;
  draftState = data;
}

function setupSubscriptions() {
  cleanup();

  // Inscrição do draft_state
  draftStateSubscription = supabase
    .channel('draft-state-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'draft_state',
      filter: `room_id=eq.${roomId}`
    }, async (payload) => {
      // Mescla com o estado atual para evitar perda de colunas grandes (TOAST) omitidas pelo WAL
      draftState = { ...draftState, ...payload.new };
      await fetchParticipants(); // Pega times atualizados
      updateUI();
      processTurn();
    })
    .subscribe();

  // Inscrição dos participantes
  participantsSubscription = supabase
    .channel('draft-participants-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_participants',
      filter: `room_id=eq.${roomId}`
    }, async () => {
      await fetchParticipants();
      updateUI();
    })
    .subscribe();

  // Inscrição de sala (para redirecionar ao campeonato)
  roomSubscription = supabase
    .channel('draft-room-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      room = payload.new;
      if (room.status === 'tournament') {
        cleanup();
        goToTournament();
      }
    })
    .subscribe();
}

function renderLayout() {
  container.innerHTML = `
    <div class="draft-layout">
      <!-- HEADER -->
      <header class="draft-header">
        <div class="draft-title">
          <span class="draft-badge">⚡ DRAFT ONLINE</span>
          <span class="draft-mode-label" id="mode-label">Carregando...</span>
        </div>
        <div class="draft-progress-wrap">
          <div class="draft-progress-bar" id="progress-bar" style="width:0%"></div>
          <span class="draft-progress-text" id="progress-text">Rodada 1/6 • 0%</span>
        </div>
        <div class="draft-turn-info" id="turn-info">
          Buscando turno...
        </div>
        <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center;">
          <button class="hs-btn-mute" id="btn-mute" title="Som"></button>
          <button id="btn-leave-draft" style="background: #e74c3c; border: none; color: white; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; font-family: inherit; transition: opacity 0.2s;">🚪 Sair</button>
        </div>
      </header>

      <!-- BODY -->
      <div class="draft-body">
        <!-- COLUNA ESQUERDA: times adversários -->
        <aside class="draft-teams-sidebar" id="sidebar-left">
          <h3 class="sidebar-title">📋 Times</h3>
          <div class="teams-list" id="teams-list">
            <!-- Renderizado dinamicamente -->
          </div>
        </aside>

        <!-- CENTRO: opções de pick -->
        <main class="draft-main" id="draft-main">
          <div class="loading-wrap" style="padding: 4rem 0">
            <div class="thinking-spinner"></div>
            <p>Sincronizando estado do draft...</p>
          </div>
        </main>

        <!-- COLUNA DIREITA: seu time -->
        <aside class="draft-my-team" id="sidebar-right">
          <h3 class="sidebar-title">🎒 Seu Time</h3>
          <div class="my-team-slots" id="my-team-slots">
            <div class="empty-team">Carregando time...</div>
          </div>
          <div class="my-team-stats" id="my-team-stats">
            <span>0/6 Pokémons</span>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function updateUI() {
  if (!draftState || participants.length === 0 || !room) return;

  const playerPart = participants.find(p => p.user_id === currentUserId);
  const currentSlot = draftState.current_slot;
  const currentPart = participants.find(p => p.slot === currentSlot);
  
  if (!playerPart || !currentPart) return;

  const isPlayer = currentPart.user_id === currentUserId;
  const progress = getDraftProgress({
    numTeams: room?.max_players || 8,
    history: draftState.picks_history
  });

  // 1. Atualiza modo
  const modeLabel = container.querySelector('#mode-label');
  if (modeLabel) modeLabel.textContent = getModeLabel(room.mode);

  // 2. Atualiza progresso
  const bar = container.querySelector('#progress-bar');
  const txt = container.querySelector('#progress-text');
  const totalRounds = room?.settings?.items ? 7 : 6;
  const progressPct = Math.min(100, Math.floor(((draftState.current_round - 1) * 8 + draftState.current_slot) / (totalRounds * 8) * 100));
  
  if (bar) bar.style.width = `${progressPct}%`;
  if (txt) {
    if (draftState.current_round === 7) {
      txt.textContent = `Rodada Extra de Itens (7/7) • ${progressPct}%`;
    } else {
      txt.textContent = `Rodada ${Math.min(draftState.current_round, totalRounds)}/${totalRounds} • ${progressPct}%`;
    }
  }

  // 3. Info de turno
  const turnInfo = container.querySelector('#turn-info');
  if (turnInfo) {
    turnInfo.className = `draft-turn-info ${isPlayer ? 'your-turn' : 'bot-turn'}`;
    const name = currentPart.is_bot ? currentPart.bot_name : (currentPart.profile?.username || 'Treinador');
    if (isPlayer) {
      turnInfo.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 1px solid var(--gold); flex-shrink: 0;">
              <img src="${getTrainerAvatar(currentPart)}" alt="Você" style="width: 100%; height: 100%; object-fit: cover;">
            </span>
            <span>🎯 SUA VEZ!</span>
            <span id="timer-display" style="font-weight:bold; color:var(--gold); margin-left:8px;"></span>
          </div>
          <div class="turn-timer-bar-container" style="width: 100%; max-width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: 6px;">
            <div id="timer-progress-bar" style="width: 100%; height: 100%; background: var(--gold); transition: width 1s linear, background-color 0.3s ease;"></div>
          </div>
        </div>
      `;
    } else {
      turnInfo.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 1px solid var(--accent-1); flex-shrink: 0;">
              <img src="${getTrainerAvatar(currentPart)}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
            </span>
            <span>⌛ Vez de ${name}</span>
            <span id="timer-display" style="font-weight:bold; color:var(--gold); margin-left:8px;"></span>
          </div>
          <div class="turn-timer-bar-container" style="width: 100%; max-width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: 6px;">
            <div id="timer-progress-bar" style="width: 100%; height: 100%; background: var(--accent-1); transition: width 1s linear, background-color 0.3s ease;"></div>
          </div>
        </div>
      `;
    }
  }

  // 4. Sidebar esquerda: todos os times
  const teamsList = container.querySelector('#teams-list');
  if (teamsList) {
    const showTeams = room.mode !== DRAFT_MODES.BLIND;
    teamsList.innerHTML = participants.map(p => {
      const active = p.slot === currentSlot;
      const isMe = p.user_id === currentUserId;
      const name = p.is_bot ? p.bot_name : (p.profile?.username || 'Treinador');
      const teamList = p.team || [];
      return `
        <div class="team-item ${active ? 'active' : ''} ${isMe ? 'player-team' : ''}">
          <div class="team-header" style="display: flex; align-items: center; gap: 8px;">
            <span class="team-icon" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 1px solid ${p.is_bot ? 'var(--accent-1)' : isMe ? 'var(--gold)' : 'var(--border)'}; flex-shrink: 0;">
              <img src="${getTrainerAvatar(p)}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
            </span>
            <span class="team-name" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
            <span class="team-count" style="flex-shrink: 0;">${teamList.length}/6</span>
          </div>
          ${showTeams || isMe ? `
            <div class="team-pokemon-row">
              ${teamList.map(poke => {
                const weakAgainst = ALL_TYPES.filter(t => getTotalEffectiveness(t, poke.types) >= 2)
                  .map(t => TYPE_NAMES_PT[t]).join(', ');
                const titleText = weakAgainst ? `${poke.displayName}\nFraco contra: ${weakAgainst}` : poke.displayName;
                return `<img class="team-mini-sprite" src="${poke.sprite}" alt="${poke.displayName}" title="${titleText}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${poke.id}.png'">`;
              }).join('')}
              ${Array(6 - teamList.length).fill('<div class="team-mini-empty"></div>').join('')}
            </div>
          ` : `<div class="team-hidden">🫣 Times ocultos</div>`}
        </div>
      `;
    }).join('');
  }

  // 5. Sidebar direita: seu time
  const myTeamSlots = container.querySelector('#my-team-slots');
  if (myTeamSlots) {
    const myPokemon = playerPart.team || [];
    if (myPokemon.length === 0) {
      myTeamSlots.innerHTML = `<div class="empty-team">Nenhum Pokémon ainda</div>`;
    } else {
      myTeamSlots.innerHTML = myPokemon.map(p => PokemonRosterCard(p)).join('');
    }
  }

  const myTeamStats = container.querySelector('#my-team-stats span');
  if (myTeamStats) {
    myTeamStats.textContent = `${playerPart.team?.length || 0}/6 Pokémons`;
  }

  // Eventos do cabeçalho
  const btnMute = container.querySelector('#btn-mute');
  if (btnMute && !btnMute.hasAttribute('data-audio-attached')) {
    btnMute.setAttribute('data-audio-attached', 'true');
    attachMuteToggleListener('btn-mute');
  }

  const btnLeave = container.querySelector('#btn-leave-draft');
  if (btnLeave && !btnLeave.hasAttribute('data-attached')) {
    btnLeave.setAttribute('data-attached', 'true');
    btnLeave.addEventListener('click', () => {
      playSFX('click');
      handleLeaveRoom();
    });
  }

  // 6. Painel central
  const mainPanel = container.querySelector('#draft-main');
  if (mainPanel) {
    mainPanel.innerHTML = renderDraftMain(isPlayer);
    attachDraftEvents();
  }
}

function renderDraftMain(isPlayer) {
  const currentSlot = draftState.current_slot;
  const currentPart = participants.find(p => p.slot === currentSlot);

  const isBlindMode = room.mode === DRAFT_MODES.BLIND;
  let lastPickInfo = '';
  if (!isBlindMode && draftState.picks_history && draftState.picks_history.length > 0) {
    const pickHistoryOnly = draftState.picks_history.filter(h => h.pokemon);
    if (pickHistoryOnly.length > 0) {
      const lastPick = pickHistoryOnly[pickHistoryOnly.length - 1];
      const spriteHtml = lastPick.pokemon.sprite 
        ? `<img src="${lastPick.pokemon.sprite}" style="width: 40px; height: 40px; object-fit: contain;">`
        : `<span style="font-size: 1.5rem;">${lastPick.pokemon.icon || '🎒'}</span>`;
      lastPickInfo = `
        <div style="background: var(--surface-hover); padding: 0.5rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; justify-content: center; border: 1px solid var(--border-bright); animation: fade-up 0.3s ease;">
          <span style="font-size: 0.9rem; color: var(--text-2);">Último pick:</span>
          ${spriteHtml}
          <span><b>${lastPick.teamName}</b> escolheu <b>${lastPick.pokemon.displayName}</b></span>
        </div>
      `;
    }
  }

  const totalRounds = room?.settings?.items ? 7 : 6;
  if (draftState.current_round > totalRounds) {
    return `
      <div class="draft-done-msg">
        <div class="done-icon">✅</div>
        <h2>Draft Concluído!</h2>
        <p>Todos os times foram montados. Criando campeonato...</p>
      </div>
    `;
  }

  if (!isPlayer) {
    const name = currentPart.is_bot ? currentPart.bot_name : (currentPart.profile?.username || 'Treinador');
    
    let typeInfo = '';
    let optionsInfo = '';

    if (!isBlindMode && draftState.selected_type) {
      typeInfo = `<div style="margin: 1.5rem 0; font-size: 1.1rem; color: var(--text-2);">Tipo selecionado por ${name}: <span class="type-badge" style="background: var(--bg-3); padding: 0.3rem 0.8rem; border: 1px solid var(--border-bright); color: white;">${TYPE_ICONS[draftState.selected_type]} ${TYPE_NAMES_PT[draftState.selected_type]}</span></div>`;
    }

    if (!isBlindMode && draftState.current_options && draftState.current_options.length > 0) {
      optionsInfo = `
        <div class="other-user-options">
          ${draftState.current_options.map(p => {
            const gradColor = TYPE_COLORS[p.types[0]] || '#6c63ff';
            return `
              <div class="pokemon-mini-card" style="--card-color: ${gradColor}; flex-direction: column; width: 100%; max-width: 120px; height: 155px; justify-content: center; text-align: center; padding: 0.8rem; gap: 0.5rem; border-left: none; border-top: 4px solid ${gradColor};" data-tooltip-info='${JSON.stringify(p).replace(/'/g, "&apos;")}'>
                <img src="${p.sprite}" alt="${p.displayName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'" style="width: 75px; height: 75px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); margin: 0 auto;">
                <span class="mini-name" style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; display: block; color: var(--text-1);">${p.displayName}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div style="width: 100%;">
        ${lastPickInfo}
        <div class="bot-thinking" style="flex-direction: column; text-align: center; background: transparent; box-shadow: none;">
          <div class="thinking-spinner"></div>
          <p style="margin-top: 1rem; font-size: 1.2rem;"><b>${name}</b> está decidindo seu pick...</p>
          ${isBlindMode ? `<p style="color: var(--text-3); font-size: 0.85rem; margin-top: 0.5rem;">🫣 Modo Draft Cego — escolhas ocultas até o torneio</p>` : ''}
          ${typeInfo}
          ${optionsInfo}
        </div>
      </div>
    `;
  }

  // É a vez do jogador
  const isItemRound = draftState.current_round === 7;
  return `
    ${lastPickInfo}
    ${(!isItemRound && room.mode !== DRAFT_MODES.RANDOM && !draftState.selected_type) ? renderTypeSelect() : renderPokemonOptions()}
  `;
}

function renderTypeSelect() {
  return `
    <div class="type-select-wrap">
      <h2 class="pick-title">🎯 Escolha um tipo</h2>
      <p class="pick-sub">Você verá 8 Pokémons desse tipo para escolher</p>
      <div class="type-grid" id="type-grid">
        ${ALL_TYPES.map(type => {
          const available = pokemonData.filter(
            p => p.types.includes(type) && !getAvailablePool().includes(p.id) === false
          ).length;
          return `
            <button class="type-btn ${available === 0 ? 'disabled' : ''}" data-type="${type}" ${available === 0 ? 'disabled' : ''} style="border-color: ${TYPE_COLORS[type]}; color: ${TYPE_COLORS[type]};">
              <span class="type-btn-icon">${TYPE_ICONS[type]}</span>
              <span class="type-btn-name">${TYPE_NAMES_PT[type]}</span>
              <span class="type-btn-count" style="color: var(--text-2);">${available} disp.</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderPokemonOptions() {
  const options = draftState.current_options || [];
  const isItemRound = draftState.current_round === 7;
  const currentSlot = draftState.current_slot;
  const currentPart = participants.find(p => p.slot === currentSlot);
  const isPlayer = currentPart && currentPart.user_id === currentUserId;

  if (isItemRound) {
    const playerPart = participants.find(p => p.user_id === currentUserId);
    const team = playerPart?.team || [];

    return `
      <div class="pokemon-options-wrap" style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div class="options-header" style="text-align: center;">
          <h2 class="pick-title">🎒 Escolha um Item e Equipe em um Pokémon</h2>
          <p class="pick-sub">Selecione 1 item e 1 Pokémon do seu time, depois clique em Confirmar.</p>
        </div>
        
        <!-- ROW 1: ITEMS -->
        <div>
          <h3 style="font-size: 1.1rem; color: var(--gold); margin-bottom: 0.8rem; text-align: center;">1. Selecione o Item</h3>
          <div class="items-select-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${options.length === 0 ? `
               <div class="bot-thinking" style="grid-column: 1/-1"><p>Gerando itens...</p></div>
             ` : options.map(item => `
               <div class="item-select-card" data-item-id="${item.id}" style="text-align: center; padding: 1.2rem; cursor: pointer; border: 2px solid var(--border); border-radius: 12px; background: var(--bg-3); transition: all 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
                 <div style="font-size: 2.8rem; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: rgba(255,255,255,0.05); border-radius: 12px; margin: 0 auto;">${getItemIconHtml(item, 48)}</div>
                 <h4 style="margin: 0; font-size: 1.05rem; color: white;">${item.displayName}</h4>
                 <p style="margin: 0; font-size: 0.75rem; color: var(--text-2); line-height: 1.3;">${item.description}</p>
               </div>
             `).join('')}
          </div>
        </div>

        <!-- ROW 2: POKEMONS -->
        <div>
          <h3 style="font-size: 1.1rem; color: var(--gold); margin-bottom: 0.8rem; text-align: center;">2. Escolha o Pokémon</h3>
          <div class="pokes-select-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.8rem;">
            ${team.map((poke, idx) => {
              const bst = Object.values(poke.stats).reduce((a, b) => a + b, 0);
              return `
                <div class="poke-select-card" data-idx="${idx}" style="text-align: center; padding: 0.8rem; cursor: pointer; border: 2px solid var(--border); border-radius: 10px; background: var(--bg-3); transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; position: relative;">
                  <img src="${poke.sprite}" alt="${poke.displayName}" style="width: 55px; height: 55px; object-fit: contain;">
                  <span style="font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; color: white;">${poke.displayName}</span>
                  <span style="font-size: 0.65rem; color: var(--text-3);">BST ${bst}</span>
                  ${poke.item ? `
                    <div style="font-size: 0.65rem; color: var(--gold); background: rgba(251,191,36,0.1); border: 1px solid var(--gold); border-radius: 4px; padding: 1px 4px; margin-top: 2px; display: inline-flex; align-items: center; gap: 4px;">
                      ${getItemIconHtml(poke.item)} ${poke.item.displayName}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- ROW 3: CONFIRM BUTTON -->
        <div style="display: flex; justify-content: center; margin-top: 0.5rem;">
          <button id="btn-confirm-equip" disabled style="padding: 0.8rem 2.5rem; background: var(--border); border: none; color: var(--text-3); font-weight: bold; border-radius: 8px; cursor: not-allowed; font-size: 1.05rem; transition: all 0.2s; min-width: 250px;">
            Confirmar Equipamento
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="pokemon-options-wrap" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
      <div class="options-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%; max-width: 880px; margin-bottom: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; text-align: left;">
        <div style="text-align: left;">
          <h2 class="pick-title" style="text-align: left; margin: 0; font-size: 1.15rem; font-weight: 800;">
            ${draftState.selected_type ? `${TYPE_ICONS[draftState.selected_type]} Pokémons do tipo ${TYPE_NAMES_PT[draftState.selected_type]}` : '🎲 Pokémons Aleatórios'}
          </h2>
          <p class="pick-sub" style="text-align: left; margin: 0.1rem 0 0 0; font-size: 0.8rem; color: var(--text-2);">Escolha 1 Pokémon para o seu time (Slot ${(participants.find(p => p.user_id === currentUserId)?.team?.length || 0) + 1}/6)</p>
        </div>
        
        ${isPlayer && !hasRerolled() ? `
          <div style="margin: 0; display: flex; align-items: center; flex-shrink: 0;">
            <button id="btn-reroll" style="padding: 0.5rem 1rem; background: rgba(251, 191, 36, 0.1); border: 1px solid var(--gold); color: var(--gold); border-radius: var(--radius-md); cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s; font-size: 0.8rem; margin: 0;">
              🎲 Reroll Aleatório (1x)
            </button>
          </div>
        ` : ''}
      </div>
      <div class="options-grid" id="options-grid">
        ${options.length === 0 ? `
          <div class="bot-thinking" style="grid-column: 1/-1">
            <p>Gerando opções de Pokémons...</p>
          </div>
        ` : options.map(p => PokemonCard(p, { selectable: true })).join('')}
      </div>
    </div>
  `;
}

function hasRerolled() {
  if (!draftState || !draftState.picks_history) return false;
  return draftState.picks_history.some(h => h.type === 'reroll' && h.user_id === currentUserId);
}

async function handleReroll() {
  if (loading || hasRerolled()) return;
  loading = true;
  
  // Show spinner immediately to give feedback
  const grid = container.querySelector('#options-grid');
  if (grid) {
    grid.innerHTML = '<div class="bot-thinking" style="grid-column: 1/-1"><p>Rodando roleta...</p></div>';
  }
  
  try {
    let available_pool = draftState.available_pool || pokemonData.map(p => p.id);
    
    // Mantém o filtro de tipo se estiver no modo correspondente e houver tipo selecionado
    if (room.mode === 'type' && draftState.selected_type) {
      const selType = draftState.selected_type;
      available_pool = available_pool.filter(id => {
        const p = pokemonData.find(x => x.id === id);
        return p && p.types.includes(selType);
      });
    }
    
    const available_pokemons = available_pool.map(id => pokemonData.find(p => p.id === id)).filter(p => p);
    const newOptions = selectOptionsFromPool(available_pokemons);
    
    const newHistory = [...(draftState.picks_history || []), { type: 'reroll', user_id: currentUserId, round: draftState.current_round }];
    
    const { error } = await supabase
      .from('draft_state')
      .update({
        current_options: newOptions,
        picks_history: newHistory
      })
      .eq('room_id', roomId);
      
    if (error) throw error;
  } catch (err) {
    console.error('Erro no Reroll:', err);
    loading = false;
    updateUI(); // Redesenha para sumir com o spinner e reativar o botão se der erro
  } finally {
    loading = false;
  }
}

function attachDraftEvents() {
  if (draftState.current_round === 7) {
    let selectedItemId = null;
    let selectedPokeIdx = null;

    const btnConfirm = container.querySelector('#btn-confirm-equip');

    const updateConfirmButton = () => {
      if (selectedItemId !== null && selectedPokeIdx !== null) {
        btnConfirm.disabled = false;
        btnConfirm.style.background = 'var(--gold)';
        btnConfirm.style.color = '#000';
        btnConfirm.style.cursor = 'pointer';
        btnConfirm.style.boxShadow = '0 0 15px rgba(251, 191, 36, 0.4)';
      } else {
        btnConfirm.disabled = true;
        btnConfirm.style.background = 'var(--border)';
        btnConfirm.style.color = 'var(--text-3)';
        btnConfirm.style.cursor = 'not-allowed';
        btnConfirm.style.boxShadow = 'none';
      }
    };

    container.querySelectorAll('.item-select-card').forEach(card => {
      card.addEventListener('click', () => {
        playSFX('select');
        selectedItemId = card.dataset.itemId;
        container.querySelectorAll('.item-select-card').forEach(c => {
          c.style.borderColor = 'var(--border)';
          c.style.boxShadow = 'none';
        });
        card.style.borderColor = 'var(--gold)';
        card.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.2)';
        updateConfirmButton();
      });
    });

    container.querySelectorAll('.poke-select-card').forEach(card => {
      card.addEventListener('click', () => {
        playSFX('select');
        selectedPokeIdx = parseInt(card.dataset.idx);
        container.querySelectorAll('.poke-select-card').forEach(c => {
          c.style.borderColor = 'var(--border)';
          c.style.boxShadow = 'none';
        });
        card.style.borderColor = 'var(--gold)';
        card.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.2)';
        updateConfirmButton();
      });
    });

    btnConfirm?.addEventListener('click', () => {
      if (selectedItemId === null || selectedPokeIdx === null) return;
      playSFX('click');
      const item = draftState.current_options.find(it => it.id === selectedItemId);
      const playerPart = participants.find(p => p.user_id === currentUserId);
      if (item && playerPart) {
        selectItemForPokemon(item, selectedPokeIdx, playerPart);
      }
    });

    return;
  }

  const btnReroll = container.querySelector('#btn-reroll');
  if (btnReroll) {
    btnReroll.addEventListener('click', () => {
      playSFX('select');
      handleReroll();
    });
  }

  // Seleção de tipo
  container.querySelectorAll('.type-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      playSFX('select');
      const type = btn.dataset.type;
      selectType(type);
    });
  });

  // Seleção de Pokémon / Item
  container.querySelectorAll('.pokemon-card.selectable').forEach(card => {
    card.addEventListener('click', () => {
      playSFX('click');
      const rawId = card.dataset.id;
      const id = isNaN(parseInt(rawId)) ? rawId : parseInt(rawId); // items use string id
      const option = draftState.current_options.find(p => p.id === id);
      if (option) {
        selectPokemon(option);
      }
    });
  });
}

async function selectItemForPokemon(item, pokemonIdx, participant) {
  const currentSlot = draftState.current_slot;
  const currentRound = draftState.current_round;

  const isBot = participant.is_bot ?? false;
  if (loading && !isBot) return;
  if (lastProcessedSlot === currentSlot && lastProcessedRound === currentRound && !isBot) {
    console.log('Turno já processado por este cliente:', { currentSlot, currentRound });
    return;
  }
  if (!isBot) {
    loading = true;
    lastProcessedSlot = currentSlot;
    lastProcessedRound = currentRound;
  }

  // Remove o modal se existir
  const modal = document.getElementById('equip-item-modal');
  if (modal) modal.remove();

  try {
    const updatedTeam = [...(participant.team || [])];
    if (updatedTeam[pokemonIdx]) {
      updatedTeam[pokemonIdx] = {
        ...updatedTeam[pokemonIdx],
        item: item
      };
    }

    // 1. Atualiza time do participante
    const { error: partErr } = await supabase
      .from('room_participants')
      .update({ team: updatedTeam })
      .eq('id', participant.id);

    if (partErr) throw partErr;

    // 2. Calcula próximo turno no snake draft
    let nextSlot = draftState.current_slot;
    let nextRound = draftState.current_round;
    let nextDirection = draftState.snake_direction;

    const maxPlayers = room?.max_players || 8;
    if (nextDirection === 1) {
      if (nextSlot < maxPlayers - 1) {
        nextSlot++;
      } else {
        nextRound++;
        nextDirection = -1;
      }
    } else {
      if (nextSlot > 0) {
        nextSlot--;
      } else {
        nextRound++;
        nextDirection = 1;
      }
    }

    const totalRounds = room?.settings?.items ? 7 : 6;
    const isDone = nextRound > totalRounds;

    const nextHistory = [
      ...(draftState.picks_history || []),
      {
        round: draftState.current_round,
        slot: draftState.current_slot,
        teamName: participant.is_bot ? participant.bot_name : (participant.profile?.username || 'Treinador'),
        pokemon: item, // Salva o item no histórico
        isPlayer: participant.user_id === currentUserId
      }
    ];

    // 3. Atualiza estado global do draft com bloqueio otimista
    const { error: draftErr } = await supabase
      .from('draft_state')
      .update({
        current_round: nextRound,
        current_slot: nextSlot,
        snake_direction: nextDirection,
        selected_type: null,
        current_options: [],
        picks_history: nextHistory,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_slot', currentSlot)
      .eq('current_round', currentRound);

    if (draftErr) throw draftErr;

    // 4. Se concluiu tudo e for host, cria o chaveamento
    if (isDone && isHost) {
      await createBracketAndTransitionRoom();
    }

  } catch (err) {
    console.error('Erro ao equipar item:', err);
    lastProcessedSlot = null;
    lastProcessedRound = null;
  } finally {
    loading = false;
  }
}

async function selectType(type) {
  if (loading || (draftState && draftState.selected_type)) return;
  loading = true;
  
  // Filtra disponíveis
  const available = pokemonData.filter(
    p => p.types.includes(type) && !getAvailablePool().includes(p.id) === false
  );
  const currentOptions = selectOptionsFromPool(available);

  try {
    const { error } = await supabase
      .from('draft_state')
      .update({
        selected_type: type,
        current_options: currentOptions,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_slot', draftState.current_slot)
      .eq('current_round', draftState.current_round);

    if (error) throw error;
  } catch (err) {
    console.error('Erro ao escolher tipo:', err);
  } finally {
    loading = false;
  }
}

async function selectPokemon(pokemon) {
  const currentSlot = draftState.current_slot;
  const currentRound = draftState.current_round;

  if (currentRound === 7) {
    const currentPart = participants.find(p => p.slot === currentSlot);
    const team = currentPart.team || [];
    let targetIdx = 0;
    if (currentPart.is_bot) {
      let highestBst = -1;
      team.forEach((poke, idx) => {
        const bst = Object.values(poke.stats).reduce((a, b) => a + b, 0);
        if (bst > highestBst) {
          highestBst = bst;
          targetIdx = idx;
        }
      });
    } else {
      targetIdx = team.length > 0 ? Math.floor(Math.random() * team.length) : 0;
    }
    await selectItemForPokemon(pokemon, targetIdx, currentPart);
    return;
  }

  const currentPart = participants.find(p => p.slot === currentSlot);
  const isBot = currentPart?.is_bot ?? false;

  if (loading && !isBot) return;
  if (lastProcessedSlot === currentSlot && lastProcessedRound === currentRound && !isBot) {
    console.log('Turno já processado por este cliente:', { currentSlot, currentRound });
    return;
  }
  if (!isBot) {
    loading = true;
    lastProcessedSlot = currentSlot;
    lastProcessedRound = currentRound;
  }

  try {
    const updatedTeam = [...(currentPart.team || []), pokemon];

    // 1. Atualiza time do participante
    const { error: partErr } = await supabase
      .from('room_participants')
      .update({ team: updatedTeam })
      .eq('id', currentPart.id);

    if (partErr) throw partErr;

    // 2. Calcula próximo turno no snake draft
    let nextSlot = draftState.current_slot;
    let nextRound = draftState.current_round;
    let nextDirection = draftState.snake_direction;

    const maxPlayers = room?.max_players || 8;
    if (nextDirection === 1) {
      if (nextSlot < maxPlayers - 1) {
        nextSlot++;
      } else {
        nextRound++;
        nextDirection = -1;
      }
    } else {
      if (nextSlot > 0) {
        nextSlot--;
      } else {
        nextRound++;
        nextDirection = 1;
      }
    }

    const totalRounds = room?.settings?.items ? 7 : 6;
    const isDone = nextRound > totalRounds;

    const nextHistory = [
      ...(draftState.picks_history || []),
      {
        round: draftState.current_round,
        slot: draftState.current_slot,
        teamName: currentPart.is_bot ? currentPart.bot_name : (currentPart.profile?.username || 'Treinador'),
        pokemon,
        isPlayer: currentPart.user_id === currentUserId
      }
    ];

    const nextAvailablePool = getAvailablePool().filter(id => id !== pokemon.id);

    // 3. Atualiza estado global do draft com bloqueio otimista
    const { error: draftErr } = await supabase
      .from('draft_state')
      .update({
        current_round: nextRound,
        current_slot: nextSlot,
        snake_direction: nextDirection,
        available_pool: nextAvailablePool,
        selected_type: null,
        current_options: [],
        picks_history: nextHistory,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('current_slot', currentSlot)
      .eq('current_round', currentRound);

    if (draftErr) throw draftErr;

    // 4. Se concluiu tudo e for host, cria o chaveamento
    if (isDone && isHost) {
      await createBracketAndTransitionRoom();
    }

  } catch (err) {
    console.error('Erro ao escolher Pokémon:', err);
    lastProcessedSlot = null;
    lastProcessedRound = null;
  } finally {
    loading = false;
  }
}

async function createBracketAndTransitionRoom() {
  try {
    // Busca participantes completos para o bracket
    const { data: parts, error: partErr } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (partErr) throw partErr;

    // Mapeia para formato do motor do torneio
    const mappedTeams = parts.map(p => ({
      id: p.id,
      slot: p.slot,
      name: p.is_bot ? p.bot_name : (p.bot_name || 'Treinador'), // fallback
      isPlayer: p.user_id !== null,
      user_id: p.user_id,
      pokemon: p.team.filter(x => x.stats), // Pokémon have stats
      item: p.team.find(x => !x.stats) || null // Item doesn't have stats
    }));

    // Busca usernames e avatar_urls dos perfis para preencher o name e o avatar_url
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', parts.map(p => p.user_id).filter(Boolean));

    const profMap = {};
    profs?.forEach(p => { 
      profMap[p.id] = { username: p.username, avatar_url: p.avatar_url }; 
    });

    mappedTeams.forEach(t => {
      if (!t.isPlayer) return;
      const userPart = parts.find(p => p.slot === t.slot);
      if (userPart?.user_id) {
        const prof = profMap[userPart.user_id];
        t.name = prof?.username || 'Treinador';
        t.avatar_url = prof?.avatar_url || null;
      }
    });

    const initialBracket = createBracket(mappedTeams, room.max_players || 8);

    // Salva o chaveamento
    const { error: brkErr } = await supabase
      .from('brackets')
      .insert({
        room_id: roomId,
        matches: initialBracket.matches,
        round: initialBracket.round
      });

    if (brkErr) throw brkErr;

    // Atualiza status da sala
    const { error: roomErr } = await supabase
      .from('rooms')
      .update({ status: 'tournament' })
      .eq('id', roomId);

    if (roomErr) throw roomErr;

  } catch (err) {
    console.error('Erro ao criar bracket do torneio:', err);
  }
}

function processTurn() {
  if (!room || !participants.length) return;
  const totalRounds = room?.settings?.items ? 7 : 6;
  if (!draftState || draftState.current_round > totalRounds) return;

  const currentSlot = draftState.current_slot;
  const currentRound = draftState.current_round;
  const currentHistoryLength = draftState.picks_history?.length || 0;

  const isNewTurn = lastActiveSlot !== currentSlot || lastActiveRound !== currentRound || lastHistoryLength !== currentHistoryLength;
  
  if (isNewTurn) {
    botTurnInProgress = false;
  }
  
  // Flag para detectar primeiro carregamento antes de atualizar os valores
  const isFirstLoad = lastActiveSlot === null;
  
  lastActiveSlot = currentSlot;
  lastActiveRound = currentRound;
  lastHistoryLength = currentHistoryLength;
  
  let currentPart = participants.find(p => p.slot === currentSlot);
  
  if (!currentPart) {
    if (isHost) {
      console.log('Jogador abandonou o slot', currentSlot, '- substituindo por Bot');
      supabase.from('room_participants').insert({
        room_id: roomId,
        is_bot: true,
        bot_name: 'Substituto ' + (currentSlot + 1),
        slot: currentSlot,
        team: [],
        seed: Math.floor(Math.random() * 1000000)
      }).then(() => {
        // O Realtime detectará o novo participante e a tela será atualizada
      });
    }
    return;
  }

  const isPlayer = currentPart.user_id === currentUserId;

  if (isNewTurn && isPlayer) {
    const hasShinyOption = draftState.current_options && draftState.current_options.some(p => p && p.isShiny);
    if (hasShinyOption) {
      playSFX('shiny');
    } else {
      playSFX('turnAlert');
    }
  }

  // Inicia ou reseta o timer apenas se for um turno novo ou o timer não estiver rodando
  if (isNewTurn || !turnTimerInterval) {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
    
    const timerSetting = room?.settings?.turnTimer ?? 45;
    if (timerSetting > 0) {
      const isFirstPickOfDraft = currentRound === 1 && currentSlot === 0;
      if (isFirstLoad && !isFirstPickOfDraft) {
        const startMs = draftState.updated_at ? Date.parse(draftState.updated_at) : Date.now();
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        const calculatedLeft = timerSetting - elapsedSeconds;
        // Garante pelo menos 5 segundos no carregamento inicial para tolerar desvios de relógio
        turnTimeLeft = Math.max(5, Math.min(timerSetting, calculatedLeft));
      } else {
        // Turnos em tempo real ou o primeiríssimo pick do draft iniciam com o tempo cheio
        turnTimeLeft = timerSetting;
      }
      
      const display = document.getElementById('timer-display');
      if (display) display.textContent = `(${turnTimeLeft}s)`;
      
      const updateProgressBar = () => {
        const pBar = document.getElementById('timer-progress-bar');
        if (pBar) {
          const pct = Math.max(0, (turnTimeLeft / timerSetting) * 100);
          pBar.style.width = `${pct}%`;
          if (pct < 25) {
            pBar.style.backgroundColor = '#e74c3c';
          }
        }
      };
      
      updateProgressBar();
      
      turnTimerInterval = setInterval(() => {
        turnTimeLeft--;
        const display = document.getElementById('timer-display');
        if (display) display.textContent = `(${turnTimeLeft}s)`;
        updateProgressBar();
        
        if (turnTimeLeft <= 0) {
          clearInterval(turnTimerInterval);
          turnTimerInterval = null;
          
          // Apenas o jogador do turno executa a ação de timeout
          if (isPlayer) {
            const isItemRound = draftState.current_round === 7;
            if (room.mode !== DRAFT_MODES.RANDOM && !draftState.selected_type && !isItemRound) {
              import('../../engine/types.js').then(m => {
                const t = m.ALL_TYPES[Math.floor(Math.random() * m.ALL_TYPES.length)];
                selectType(t);
              });
            } else if (isItemRound) {
              let pool = draftState.current_options || [];
              if (pool.length === 0) pool = itemsData;
              const it = pool[Math.floor(Math.random() * pool.length)];
              selectPokemon(it);
            } else {
              let pool = draftState.current_options || [];
              if (!pool || pool.length === 0) pool = selectOptionsFromPool(getAvailablePool().map(id => pokemonData.find(x => x.id === id)).filter(p => p));
              const p = botChoosePokemon(pool, { pokemon: currentPart.team || [] });
              selectPokemon(p);
            }
          }
        }
      }, 1000);
    }
  }

  // Se for a rodada de itens e opções estiverem vazias, o HOST é responsável por gerar
  if (draftState.current_round === 7 && (!draftState.current_options || draftState.current_options.length === 0) && isHost) {
    generateItemOptionsAndSave();
    return;
  }

  // Se for o modo Random e opções estiverem vazias, o HOST é responsável por gerar
  if (room.mode === DRAFT_MODES.RANDOM && (!draftState.current_options || draftState.current_options.length === 0) && isHost) {
    generateRandomOptionsAndSave();
    return;
  }

  // Turno do BOT (somente o host roda a IA e grava)
  if (currentPart.is_bot && isHost) {
    const isItemRound = draftState.current_round === 7;
    const botPhase = (!draftState.selected_type && room.mode !== DRAFT_MODES.RANDOM && !isItemRound) ? 'type' : 'pokemon';
    if (lastProcessedBotSlot === currentSlot && lastProcessedBotRound === currentRound && lastProcessedBotPhase === botPhase) {
      console.log('Turno do BOT já processado pelo Host:', { currentSlot, currentRound, botPhase });
      return;
    }

    if (botTurnInProgress) return;
    botTurnInProgress = true;

    lastProcessedBotSlot = currentSlot;
    lastProcessedBotRound = currentRound;
    lastProcessedBotPhase = botPhase;

    pendingBotPart = currentPart;
    if (botTimerWorker) {
      botTimerWorker.postMessage({ command: 'start', delay: 300 + Math.random() * 500 });
    }
  }
}

async function generateRandomOptionsAndSave() {
  const available = pokemonData.filter(p => !getAvailablePool().includes(p.id) === false);
  const currentOptions = selectOptionsFromPool(available);

  try {
    const { error } = await supabase
      .from('draft_state')
      .update({
        current_options: currentOptions,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);
    if (error) throw error;
  } catch (err) {
    console.error('Erro ao gerar opções aleatórias:', err);
  }
}

async function generateItemOptionsAndSave() {
  const shuffled = [...itemsData].sort(() => Math.random() - 0.5);
  const itemOptions = shuffled.slice(0, 3);

  try {
    const { error } = await supabase
      .from('draft_state')
      .update({
        current_options: itemOptions,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);
    if (error) throw error;
  } catch (err) {
    console.error('Erro ao gerar opções de itens:', err);
  }
}

async function handleLeaveRoom() {
  destroyEmotes();
  if (!confirm('Tem certeza que deseja sair desta sala? Seu time e posição serão removidos.')) return;
  
  try {
    const myPart = participants.find(p => p.user_id === currentUserId);
    if (myPart) {
      await supabase.from('room_participants').delete().eq('id', myPart.id);
    }
  } catch (e) {
    console.error('Erro ao sair:', e);
  } finally {
    cleanup();
    import('../router.js').then(m => m.navigate('home'));
  }
}

async function executeBotTurn(botParticipant) {
  try {
    const isItemRound = draftState.current_round === 7;
    if (isItemRound) {
      let pool = draftState.current_options || [];
      if (pool.length === 0) pool = itemsData;
      const item = pool[Math.floor(Math.random() * pool.length)];

      const botTeam = botParticipant.team || [];
      let bestPokeIdx = 0;
      let highestBst = -1;

      botTeam.forEach((poke, idx) => {
        const bst = Object.values(poke.stats).reduce((a, b) => a + b, 0);
        if (bst > highestBst) {
          highestBst = bst;
          bestPokeIdx = idx;
        }
      });

      await selectItemForPokemon(item, bestPokeIdx, botParticipant);
      botTurnInProgress = false;
      return;
    }

    let options = [];

    // Modo 1 ou 3: escolhe tipo → escolhe pokemon
    if (room.mode !== DRAFT_MODES.RANDOM) {
      if (!draftState.selected_type) {
        // Escolhe tipo
        const usedIdsSet = new Set();
        participants.forEach(p => {
          p.team?.forEach(poke => usedIdsSet.add(poke.id));
        });
        const type = botChooseType({ pokemon: botParticipant.team || [] }, pokemonData, usedIdsSet);
        
        // Salva tipo e gera opções
        const available = pokemonData.filter(p => !getAvailablePool().includes(p.id) === false);
        const typeAvailable = available.filter(p => p.types.includes(type));
        const typeOptions = selectOptionsFromPool(typeAvailable);

        const { error } = await supabase
          .from('draft_state')
          .update({
            selected_type: type,
            current_options: typeOptions || [],
            updated_at: new Date().toISOString()
          })
          .eq('room_id', roomId);

        if (error) throw error;
        botTurnInProgress = false;
        return;
      } else {
        options = draftState.current_options || [];
      }
    } else {
      // Modo aleatório
      options = draftState.current_options || [];
    }

    // Escolhe Pokémon
    const picked = botChoosePokemon(options, { pokemon: botParticipant.team || [] });
    if (!picked) {
      // Fallback se nada estiver disponível
      const any = pokemonData.find(p => getAvailablePool().includes(p.id));
      if (any) await selectPokemon(any);
    } else {
      await selectPokemon(picked);
    }
  } catch (err) {
    console.error('Erro na rodada do bot:', err);
  } finally {
    botTurnInProgress = false;
  }
}

function goToTournament() {
  navigate('bracket', { code: roomCode, roomId, isHost });
}

function getModeLabel(mode) {
  const labels = { type: '🎯 Por Tipo', random: '🎲 Aleatório', blind: '🫣 Cego' };
  return labels[mode] || mode || '';
}

function cleanup() {
  if (botTimerWorker) {
    botTimerWorker.postMessage({ command: 'stop' });
  }
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  if (draftStateSubscription) {
    draftStateSubscription.unsubscribe();
    draftStateSubscription = null;
  }
  if (participantsSubscription) {
    participantsSubscription.unsubscribe();
    participantsSubscription = null;
  }
  if (roomSubscription) {
    roomSubscription.unsubscribe();
    roomSubscription = null;
  }
  lastProcessedSlot = null;
  lastProcessedRound = null;
  lastProcessedBotSlot = null;
  lastProcessedBotRound = null;
  lastProcessedBotPhase = null;
}

export function destroy() {
  cleanup();
}
