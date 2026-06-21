// src/ui/screens/LobbyScreen.js
import { navigate } from '../router.js';
import { initEmotes, destroyEmotes } from '../components/Emotes.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import { getTrainerAvatar } from '../../lib/avatars.js';
import { playBGM, playSFX, attachMuteToggleListener } from '../../lib/sounds.js';
import { getRankInfo } from '../../lib/rank.js';

const BOT_NAMES = ['Treinador Red', 'Treinador Blue', 'Ash Ketchum', 'Gary Oak', 'Campeã Cynthia', 'Campeão Lance', 'Misty', 'Brock', 'Steven Stone', 'Leon', 'Cynthia', 'N', 'Cyrus', 'Giovanni'];

let roomId = null;
let roomCode = null;
let currentUserId = null;
let isHost = false;
let participants = [];
let globalRanks = {};
let room = null;
let container = null;
let participantsSubscription = null;
let roomSubscription = null;
let errorMsg = '';
let loading = false;

export async function render(cont, params) {
  container = cont;
  roomCode = params.code;
  roomId = params.roomId;
  loading = true;
  errorMsg = '';
  renderLobby();
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
    isHost = room.host_id === currentUserId;

    // Busca participantes
    await fetchParticipants();

    // Configura realtimes
    setupSubscriptions();

    // Se a sala já iniciou, vai direto
    if (room.status === 'drafting') {
      goToDraft();
      return;
    } else if (room.status === 'tournament') {
      goToBracket();
      return;
    }

  } catch (err) {
    console.error('Erro no lobby:', err);
    errorMsg = err.message || 'Erro ao entrar na sala.';
  } finally {
    loading = false;
    renderLobby();
  }
}

async function fetchParticipants() {
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      *,
      profile:profiles(username, avatar_url, elo_points, championships, wins)
    `)
    .eq('room_id', roomId)
    .order('slot', { ascending: true });

  if (error) throw error;
  participants = data || [];

  try {
    const { data: allProfiles, error: rankErr } = await supabase
      .from('profiles')
      .select('id')
      .order('elo_points', { ascending: false })
      .order('championships', { ascending: false })
      .order('wins', { ascending: false });

    if (!rankErr && allProfiles) {
      const ranksMap = {};
      allProfiles.forEach((p, idx) => {
        ranksMap[p.id] = idx + 1;
      });
      globalRanks = ranksMap;
    }
  } catch (e) {
    console.error('Erro ao calcular ranks globais:', e);
  }

  // Se o jogador não estiver mais na lista de participantes (foi kickado), volta pra home
  const stillIn = participants.some(p => p.user_id === currentUserId);
  if (!stillIn && !loading) {
    cleanup();
    navigate('home');
  }
}

function setupSubscriptions() {
  cleanup(); // Previne duplicados

  // Inscrição dos participantes
  participantsSubscription = supabase
    .channel('lobby-participants')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_participants'
    }, async (payload) => {
      const isInsertOrUpdate = payload.eventType === 'INSERT' || payload.eventType === 'UPDATE';
      const isRelevant = isInsertOrUpdate 
        ? (payload.new && payload.new.room_id === roomId) 
        : true; // Recarrega em qualquer exclusão para garantir sincronia 100% confiável

      if (isRelevant) {
        await fetchParticipants();
        renderLobby();
      }
    })
    .subscribe();

  // Inscrição dos dados da sala
  roomSubscription = supabase
    .channel('lobby-room')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      room = payload.new;
      if (room.status === 'drafting') {
        cleanup();
        goToDraft();
      }
    })
    .subscribe();
}

function renderLobby() {
  if (loading && participants.length === 0) {
    container.innerHTML = `
      <div class="lobby-layout">
        <div class="loading-wrap">
          <div class="thinking-spinner"></div>
          <p>Entrando na sala...</p>
        </div>
      </div>
    `;
    return;
  }

  // Preenche array de slots com participantes ou vazios
  const targetSlots = room?.max_players || 8;
  const activeCount = participants.length;
  const slots = Array.from({ length: targetSlots }, (_, i) => {
    return participants.find(p => p.slot === i) || null;
  });

  container.innerHTML = `
    <div class="lobby-layout">
      <div class="home-particles" id="lobby-particles"></div>
      
      <!-- HEADER -->
      <header class="lobby-header">
        <div class="lobby-title-wrap">
          <button class="btn-back-lobby" id="btn-leave-lobby">🚪 Sair</button>
          <div>
            <span class="lobby-room-label">SALA ONLINE</span>
            <h1 class="lobby-room-code">${roomCode}</h1>
          </div>
        </div>
        
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <div class="lobby-status-pill">
            <span>👥</span> ${activeCount}/${targetSlots} Treinadores
          </div>
          <button class="hs-btn-mute" id="btn-mute" title="Som"></button>
        </div>
      </header>

      <!-- BODY -->
      <div class="lobby-main">
        
        <!-- CARD DA SALA -->
        <div class="lobby-config-card">
          <h3>Configuração da Sala</h3>
          <div class="lobby-config-row">
            <span class="config-lbl">Modo de Draft:</span>
            <span class="config-val">${getModeLabel(room?.mode)}</span>
          </div>
          <div class="lobby-config-row">
            <span class="config-lbl">Draft Cego:</span>
            <span class="config-val">${room?.settings?.blind ? '🫣 Ativado (Oculto)' : '👁️ Desativado (Aberto)'}</span>
          </div>
          <div class="lobby-config-row">
            <span class="config-lbl">Limite de Créditos:</span>
            <span class="config-val">${room?.settings?.credits ? '🪙 15 Créditos' : '♾️ Sem Limites'}</span>
          </div>
          <div class="lobby-config-row">
            <span class="config-lbl">Host da Sala:</span>
            <span class="config-val"><b>${participants.find(p => p.user_id === room?.host_id)?.profile?.username || 'Carregando...'}</b></span>
          </div>
          
          ${errorMsg ? `<div class="auth-error" style="margin-top:1rem">⚠️ ${errorMsg}</div>` : ''}

          <!-- AÇÕES DO HOST -->
          <div class="lobby-host-actions">
            ${isHost ? `
              <button class="btn-lobby btn-add-bot" id="btn-add-bot" ${activeCount >= targetSlots ? 'disabled' : ''}>
                🤖 Adicionar BOT
              </button>
              <button class="btn-lobby btn-start-game" id="btn-start-game" ${activeCount === targetSlots ? '' : 'disabled'}>
                ⚔️ Iniciar Draft (${activeCount}/${targetSlots})
              </button>
            ` : `
              <div class="lobby-waiting-msg">
                <span class="waiting-spinner"></span>
                <p>Aguardando o host iniciar o draft...</p>
              </div>
            `}
          </div>
        </div>

        <!-- SLOTS GRID -->
        <div class="lobby-slots-grid">
          ${slots.map((p, idx) => {
            if (!p) {
              return `
                <div class="lobby-slot slot-empty">
                  <span class="slot-num">${idx + 1}</span>
                  <span class="slot-status">Vazio</span>
                  <span class="slot-info">Aguardando jogador...</span>
                </div>
              `;
            }

            const isSelf = p.user_id === currentUserId;
            const isBot = p.is_bot;
            const name = isBot ? p.bot_name : (p.profile?.username || 'Treinador');
            const typeClass = isSelf ? 'slot-self' : isBot ? 'slot-bot' : 'slot-player';

            // ELO e Ranking para usuários reais
            let eloHtml = '';
            if (!isBot && p.profile) {
              const eloPoints = p.profile.elo_points || 0;
              const rankInfo = getRankInfo(eloPoints);
              const globalRank = globalRanks[p.user_id] || '-';
              eloHtml = `
                <div class="slot-elo-info" style="display: flex; flex-direction: column; gap: 2px; margin-top: 5px; font-size: 0.72rem; line-height: 1.25;">
                  <span class="slot-elo-badge" style="color: ${rankInfo.color}; font-weight: 700; display: flex; align-items: center; gap: 3px;" title="Pontos de ELO: ${eloPoints}">
                    ${rankInfo.icon} ${rankInfo.fullName.replace(rankInfo.icon, '').trim()} (${eloPoints} pts)
                  </span>
                  <span class="slot-global-rank" style="color: var(--text-3); opacity: 0.85; font-weight: 500;">
                    🏆 Rank Global: #${globalRank}
                  </span>
                </div>
              `;
            }

            return `
              <div class="lobby-slot ${typeClass}">
                <span class="slot-num">${idx + 1}</span>
                <span class="slot-avatar" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 2px solid ${isBot ? 'var(--accent-1)' : isSelf ? 'var(--gold)' : 'var(--border)'}; margin: 0 auto;">
                  <img src="${getTrainerAvatar(p)}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
                </span>
                <div class="slot-details">
                  <span class="slot-name">${name} ${isSelf ? '<small>(Você)</small>' : ''}</span>
                  <span class="slot-badge">${isBot ? 'BOT' : p.user_id === room?.host_id ? 'HOST' : 'Jogador'}</span>
                  ${eloHtml}
                </div>
                ${isHost && !isSelf ? `
                  <button class="btn-kick-participant" data-id="${p.id}" title="Remover">✕</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

      </div>
    </div>
  `;

  renderParticles();
  attachEvents();
}

function renderParticles() {
  const containerParticles = document.getElementById('lobby-particles');
  if (!containerParticles) return;
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const pokeId = Math.floor(Math.random() * 151) + 1;
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`;
    
    const img = document.createElement('img');
    img.src = imgUrl;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    `;
    el.appendChild(img);
    
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 5}s;
      animation-duration: ${6 + Math.random() * 6}s;
      width: ${32 + Math.random() * 32}px;
      height: ${32 + Math.random() * 32}px;
      opacity: ${0.08 + Math.random() * 0.12};
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
    `;

    el.addEventListener('click', () => {
      const masterVol = parseFloat(localStorage.getItem('masterVolume') ?? '0.5');
      const audio = new Audio(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/cries/${pokeId}.ogg`);
      audio.volume = masterVol;
      audio.play().catch(e => console.log("Erro ao tocar cry:", e));

      el.animate([
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.4) rotate(-15deg)', offset: 0.3 },
        { transform: 'scale(1.4) rotate(15deg)', offset: 0.6 },
        { transform: 'scale(1) rotate(0deg)' }
      ], {
        duration: 500,
        easing: 'ease-in-out'
      });
    });

    containerParticles.appendChild(el);
  }
}

function attachEvents() {
  // Sincroniza o botão de mute
  const btnMute = container.querySelector('#btn-mute');
  if (btnMute && !btnMute.hasAttribute('data-audio-attached')) {
    btnMute.setAttribute('data-audio-attached', 'true');
    attachMuteToggleListener('btn-mute');
  }

  // Sair da sala
  container.querySelector('#btn-leave-lobby')?.addEventListener('click', () => {
    playSFX('click');
    handleLeaveRoom();
  });

  // Adicionar bot
  container.querySelector('#btn-add-bot')?.addEventListener('click', () => {
    playSFX('click');
    handleAddBot();
  });

  // Iniciar jogo
  container.querySelector('#btn-start-game')?.addEventListener('click', () => {
    playSFX('click');
    handleStartGame();
  });

  // Remover participante
  container.querySelectorAll('.btn-kick-participant').forEach(btn => {
    btn.addEventListener('click', () => {
      playSFX('click');
      const pId = btn.dataset.id;
      handleKickParticipant(pId);
    });
  });
}

async function handleAddBot() {
  const targetSlots = room?.max_players || 8;
  if (!isHost || participants.length >= targetSlots) return;
  errorMsg = '';

  // Desabilita o botão visualmente durante o processo
  const btn = container.querySelector('#btn-add-bot');
  if (btn) btn.disabled = true;

  try {
    // Escolhe nome de bot não usado
    const takenNames = participants.filter(p => p.is_bot).map(p => p.bot_name);
    const availableNames = BOT_NAMES.filter(name => !takenNames.includes(name));
    const botName = availableNames[Math.floor(Math.random() * availableNames.length)] || `BOT ${participants.length + 1}`;

    // Encontra primeiro slot livre
    const takenSlots = participants.map(p => p.slot);
    let botSlot = 0;
    for (let i = 0; i < targetSlots; i++) {
      if (!takenSlots.includes(i)) {
        botSlot = i;
        break;
      }
    }

    console.log('🤖 Adicionando BOT:', { botName, botSlot, roomId });

    const { data, error } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        is_bot: true,
        bot_name: botName,
        slot: botSlot,
        team: [],
        seed: Math.floor(Math.random() * 1000000)
      })
      .select();

    console.log('🤖 Resultado data:', JSON.stringify(data));
    console.log('🤖 Resultado error:', JSON.stringify(error));
    if (error) throw error;

    // Recarrega localmente de forma imediata
    await fetchParticipants();
    renderLobby();

  } catch (err) {
    console.error('❌ Erro ao adicionar BOT:', err);
    errorMsg = `Erro ao adicionar BOT: ${err.message || JSON.stringify(err)}`;
    renderLobby();
  }
}


async function handleKickParticipant(pId) {
  if (!isHost) return;
  errorMsg = '';

  try {
    const { error } = await supabase
      .from('room_participants')
      .delete()
      .eq('id', pId);

    if (error) throw error;

    // Recarrega localmente de forma imediata
    await fetchParticipants();
    renderLobby();
  } catch (err) {
    console.error(err);
    errorMsg = 'Erro ao remover participante.';
    renderLobby();
  }
}

async function handleLeaveRoom() {
  destroyEmotes();
  errorMsg = '';
  cleanup();

  try {
    const part = participants.find(p => p.user_id === currentUserId);
    if (part) {
      supabase
        .from('room_participants')
        .delete()
        .eq('id', part.id)
        .catch(e => console.error('Erro ao deletar participante:', e));
    }
  } catch (err) {
    console.error(err);
  }
  navigate('home');
}

async function handleStartGame() {
  const targetSlots = room?.max_players || 8;
  if (!isHost || participants.length !== targetSlots) return;
  errorMsg = '';
  loading = true;
  renderLobby();

  try {
    // 1. Inicializa o estado do draft
    const allIds = pokemonData.map(p => p.id);
    
    // Insere draft_state
    const { error: draftErr } = await supabase
      .from('draft_state')
      .insert({
        room_id: roomId,
        current_round: 1,
        current_slot: 0,
        snake_direction: 1,
        available_pool: allIds,
        selected_type: null,
        current_options: [],
        picks_history: []
      });

    if (draftErr) throw draftErr;

    // 2. Muda status da sala para 'drafting'
    const { error: roomErr } = await supabase
      .from('rooms')
      .update({ status: 'drafting', started_at: new Date().toISOString() })
      .eq('id', roomId);

    if (roomErr) throw roomErr;

    // Vai para o draft de forma imediata localmente
    cleanup();
    goToDraft();

  } catch (err) {
    console.error(err);
    errorMsg = err.message || 'Erro ao iniciar o campeonato.';
    loading = false;
    renderLobby();
  }
}

function goToDraft() {
  navigate('draft', { code: roomCode, roomId, isHost });
}

function goToBracket() {
  navigate('bracket', { code: roomCode, roomId, isHost });
}

function getModeLabel(mode) {
  const labels = { type: '🎯 Por Tipo', random: '🎲 Aleatório', blind: '🫣 Cego' };
  return labels[mode] || mode || '';
}

function cleanup() {
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
