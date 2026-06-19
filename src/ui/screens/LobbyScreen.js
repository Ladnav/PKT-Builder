// src/ui/screens/LobbyScreen.js
import { navigate } from '../router.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';

const BOT_NAMES = ['Treinador Red', 'Treinador Blue', 'Ash Ketchum', 'Gary Oak', 'Campeã Cynthia', 'Campeão Lance', 'Misty', 'Brock', 'Steven Stone', 'Leon', 'Cynthia', 'N', 'Cyrus', 'Giovanni'];

let roomId = null;
let roomCode = null;
let currentUserId = null;
let isHost = false;
let participants = [];
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

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }
    currentUserId = user.id;

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
      profile:profiles(username, avatar_url)
    `)
    .eq('room_id', roomId)
    .order('slot', { ascending: true });

  if (error) throw error;
  participants = data || [];

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
      table: 'room_participants',
      filter: `room_id=eq.${roomId}`
    }, async () => {
      await fetchParticipants();
      renderLobby();
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
    <div class="lobby-bg home-bg">
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
        
        <div class="lobby-status-pill">
          <span>👥</span> ${activeCount}/${targetSlots} Treinadores
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

            return `
              <div class="lobby-slot ${typeClass}">
                <span class="slot-num">${idx + 1}</span>
                <span class="slot-avatar">${isBot ? '🤖' : '👤'}</span>
                <div class="slot-details">
                  <span class="slot-name">${name} ${isSelf ? '<small>(Você)</small>' : ''}</span>
                  <span class="slot-badge">${isBot ? 'BOT' : p.user_id === room?.host_id ? 'HOST' : 'Jogador'}</span>
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
  const symbols = ['⚡','🔥','💧','🌿','❄️','👊','☠️','🔮','🐉','🌑'];
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 5}s;
      animation-duration: ${4 + Math.random() * 4}s;
      font-size: ${1 + Math.random() * 1.5}rem;
      opacity: ${0.05 + Math.random() * 0.1};
    `;
    containerParticles.appendChild(el);
  }
}

function attachEvents() {
  // Sair da sala
  container.querySelector('#btn-leave-lobby')?.addEventListener('click', handleLeaveRoom);

  // Adicionar bot
  container.querySelector('#btn-add-bot')?.addEventListener('click', handleAddBot);

  // Iniciar jogo
  container.querySelector('#btn-start-game')?.addEventListener('click', handleStartGame);

  // Remover participante
  container.querySelectorAll('.btn-kick-participant').forEach(btn => {
    btn.addEventListener('click', () => {
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
  } catch (err) {
    console.error(err);
    errorMsg = 'Erro ao remover participante.';
    renderLobby();
  }
}

async function handleLeaveRoom() {
  errorMsg = '';
  cleanup();

  try {
    // Pega o participante correspondente ao usuário
    const part = participants.find(p => p.user_id === currentUserId);
    if (part) {
      await supabase
        .from('room_participants')
        .delete()
        .eq('id', part.id);
    }

    // Se o host sair e for o único, ou se desejar fechar a sala, opcional.
    // Deletar o participante causará re-render em outros clientes.
    navigate('home');
  } catch (err) {
    console.error(err);
    navigate('home');
  }
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
