// src/ui/screens/DraftScreen.js
import { navigate } from '../router.js';
import { initEmotes, destroyEmotes } from '../components/Emotes.js';
import { PokemonCard, PokemonMiniCard } from '../components/PokemonCard.js';
import { TypeBadge } from '../components/TypeBadge.js';
import { TYPE_NAMES_PT, TYPE_ICONS, TYPE_COLORS, ALL_TYPES, getTotalEffectiveness } from '../../engine/types.js';
import { DRAFT_MODES, botChooseType, botChoosePokemon, botChooseItem, getDraftProgress, selectOptionsFromPool } from '../../engine/draft.js';
import { createBracket } from '../../tournament/bracket.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import itemsData from '../../data/items-sample.json';

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
        <button id="btn-leave-draft" style="margin-left: auto; background: #e74c3c; border: none; color: white; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; font-family: inherit; transition: opacity 0.2s;">🚪 Sair</button>
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
      turnInfo.textContent = '🎯 SUA VEZ!';
      turnInfo.innerHTML = `🎯 SUA VEZ! <span id="timer-display" style="font-weight:bold; color:var(--gold); margin-left:8px;"></span>`;
    } else {
      turnInfo.textContent = `⌛ Vez do ${name}`;
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
          <div class="team-header">
            <span class="team-icon">${p.is_bot ? '🤖' : '👤'}</span>
            <span class="team-name">${name}</span>
            <span class="team-count">${teamList.length}/6</span>
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
      myTeamSlots.innerHTML = myPokemon.map(p => PokemonMiniCard(p)).join('');
    }
  }

  const myTeamStats = container.querySelector('#my-team-stats span');
  if (myTeamStats) {
    myTeamStats.textContent = `${playerPart.team?.length || 0}/6 Pokémons`;
  }

  // Eventos do cabeçalho
  const btnLeave = container.querySelector('#btn-leave-draft');
  if (btnLeave && !btnLeave.hasAttribute('data-attached')) {
    btnLeave.setAttribute('data-attached', 'true');
    btnLeave.addEventListener('click', handleLeaveRoom);
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
    const lastPick = draftState.picks_history[draftState.picks_history.length - 1];
    lastPickInfo = `
      <div style="background: var(--surface-hover); padding: 0.5rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; justify-content: center; border: 1px solid var(--border-bright); animation: fade-up 0.3s ease;">
        <span style="font-size: 0.9rem; color: var(--text-2);">Último pick:</span>
        <img src="${lastPick.pokemon.sprite}" style="width: 40px; height: 40px; object-fit: contain;">
        <span><b>${lastPick.teamName}</b> escolheu <b>${lastPick.pokemon.displayName}</b></span>
      </div>
    `;
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
        <div style="margin-top: 1rem; opacity: 0.8; pointer-events: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; max-width: 600px; margin-left: auto; margin-right: auto;">
          ${draftState.current_options.map(p => PokemonMiniCard(p)).join('')}
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
    return `
      <div class="pokemon-options-wrap">
        <div class="options-header">
          <h2 class="pick-title">🎒 Escolha um Item Global para o Time</h2>
          <p class="pick-sub">Este item será equipado na sua equipe durante as batalhas.</p>
        </div>
        <div class="options-grid" id="options-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
          ${options.length === 0 ? `
            <div class="bot-thinking" style="grid-column: 1/-1"><p>Gerando itens...</p></div>
          ` : options.map(item => `
            <div class="pokemon-card selectable" data-id="${item.id}" style="text-align: center; padding: 1.5rem; cursor: pointer; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-3); transition: all 0.2s;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">${item.icon}</div>
              <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${item.displayName}</h3>
              <p style="font-size: 0.8rem; color: var(--text-2); line-height: 1.4;">${item.description}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="pokemon-options-wrap">
      <div class="options-header">
        <h2 class="pick-title">
          ${draftState.selected_type ? `${TYPE_ICONS[draftState.selected_type]} Pokémons do tipo ${TYPE_NAMES_PT[draftState.selected_type]}` : '🎲 Pokémons Aleatórios'}
        </h2>
        <p class="pick-sub">Escolha 1 Pokémon para o seu time (Slot ${(participants.find(p => p.user_id === currentUserId)?.team?.length || 0) + 1}/6)</p>
      </div>
      <div class="options-grid" id="options-grid">
        ${options.length === 0 ? `
          <div class="bot-thinking" style="grid-column: 1/-1">
            <p>Gerando opções de Pokémons...</p>
          </div>
        ` : options.map(p => PokemonCard(p, { selectable: true })).join('')}
      </div>
      ${isPlayer && !hasRerolled() ? `
        <div style="text-align: center; margin-top: 2rem;">
          <button id="btn-reroll" style="padding: 0.8rem 1.5rem; background: var(--bg-3); border: 1px solid var(--gold); color: var(--gold); border-radius: var(--radius-md); cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
            🎲 Reroll Aleatório (1x)
          </button>
        </div>
      ` : ''}
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
  container.querySelector('#options-grid').innerHTML = '<div class="bot-thinking" style="grid-column: 1/-1"><p>Rodando roleta...</p></div>';
  
  try {
    let available_pool = draftState.available_pool || pokemonData.map(p => p.id);
    
    if (room.mode === 'type') {
      const chosenTypeObj = draftState.picks_history.find(h => h.round === 0 && h.user_id === currentUserId);
      if (chosenTypeObj) {
        available_pool = available_pool.filter(id => {
          const p = pokemonData.find(x => x.id === id);
          return p && p.types.includes(chosenTypeObj.pokemon_id);
        });
      }
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
  } finally {
    loading = false;
  }
}

function attachDraftEvents() {
  const btnReroll = container.querySelector('#btn-reroll');
  if (btnReroll) {
    btnReroll.addEventListener('click', handleReroll);
  }

  // Seleção de tipo
  container.querySelectorAll('.type-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      selectType(type);
    });
  });

  // Seleção de Pokémon / Item
  container.querySelectorAll('.pokemon-card.selectable').forEach(card => {
    card.addEventListener('click', () => {
      const rawId = card.dataset.id;
      const id = isNaN(parseInt(rawId)) ? rawId : parseInt(rawId); // items use string id
      const option = draftState.current_options.find(p => p.id === id);
      if (option) selectPokemon(option); // We reuse selectPokemon for items
    });
  });
}

async function selectType(type) {
  if (loading) return;
  
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
      .eq('room_id', roomId);

    if (error) throw error;
  } catch (err) {
    console.error('Erro ao escolher tipo:', err);
  }
}

async function selectPokemon(pokemon) {
  if (loading) return;
  loading = true;

  try {
    const currentSlot = draftState.current_slot;
    const currentPart = participants.find(p => p.slot === currentSlot);
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

    // 3. Atualiza estado global do draft
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
      .eq('room_id', roomId);

    if (draftErr) throw draftErr;

    // 4. Se concluiu tudo e for host, cria o chaveamento
    if (isDone && isHost) {
      await createBracketAndTransitionRoom();
    }

  } catch (err) {
    console.error('Erro ao escolher Pokémon:', err);
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

    // Busca usernames dos perfis para preencher o name
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', parts.map(p => p.user_id).filter(Boolean));

    const profMap = {};
    profs?.forEach(p => { profMap[p.id] = p.username; });

    mappedTeams.forEach(t => {
      if (!t.isPlayer) return;
      const userPart = parts.find(p => p.slot === t.slot);
      if (userPart?.user_id) {
        t.name = profMap[userPart.user_id] || 'Treinador';
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

  // Se for o modo Random e opções estiverem vazias, o HOST é responsável por gerar
  if (room.mode === DRAFT_MODES.RANDOM && (!draftState.current_options || draftState.current_options.length === 0) && isHost) {
    generateRandomOptionsAndSave();
    return;
  }

  // Turno do BOT (somente o host roda a IA e grava)
  if (currentPart.is_bot && isHost) {
    if (botTurnInProgress) return;
    botTurnInProgress = true;

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
}

export function destroy() {
  cleanup();
}
