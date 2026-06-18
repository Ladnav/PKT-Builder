// src/ui/screens/HomeScreen.js
import { navigate } from '../router.js';
import { DRAFT_MODES_INFO } from '../../engine/draft.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';

let selectedMode = 'type';
let container = null;
let profile = null;
let leaderboard = [];
let errorMsg = '';
let loading = false;

export async function render(cont) {
  container = cont;
  loading = true;
  errorMsg = '';
  renderScreen();

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }

    // Busca perfil
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profErr) throw profErr;
    profile = prof;

    // Busca leaderboard
    const { data: lead, error: leadErr } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(10);

    if (leadErr) throw leadErr;
    leaderboard = lead || [];

  } catch (err) {
    console.error('Erro ao carregar dados do menu:', err);
    errorMsg = 'Erro ao conectar ao servidor. Verifique sua conexão.';
  } finally {
    loading = false;
    renderScreen();
  }
}

function renderScreen() {
  if (loading && !profile) {
    container.innerHTML = `
      <div class="home-bg">
        <div class="loading-wrap">
          <div class="thinking-spinner"></div>
          <p>Carregando informações do treinador...</p>
        </div>
      </div>
    `;
    return;
  }

  // Calcula taxa de vitória
  const totalGames = (profile?.wins || 0) + (profile?.losses || 0);
  const winRate = totalGames > 0 ? ((profile.wins / totalGames) * 100).toFixed(1) : '0';

  container.innerHTML = `
    <div class="home-bg">
      <div class="home-particles" id="particles"></div>
      
      <!-- TOP BAR -->
      <div class="home-top-bar">
        <div class="home-logo-mini">
          <span class="logo-mini-badge">⚡</span>
          <h1 class="logo-title-mini">Poké<span>Champion</span></h1>
        </div>
        
        <div class="profile-card-mini">
          <div class="profile-avatar">👤</div>
          <div class="profile-info-mini">
            <span class="profile-name-mini">${profile?.username || 'Treinador'}</span>
            <span class="profile-stats-mini">🏆 ${profile?.championships || 0} • ⚔️ ${profile?.wins || 0}V - ${profile?.losses || 0}D (${winRate}%)</span>
          </div>
          <button class="btn-logout" id="btn-logout" title="Sair da Conta">🚪</button>
        </div>
      </div>

      <div class="home-main-grid">
        
        <!-- COLUNA ESQUERDA: Ações de Jogo -->
        <div class="home-col-actions">
          
          <!-- SELEÇÃO DE MODO -->
          <div class="home-section">
            <h2 class="section-title">1. Escolha o modo de draft</h2>
            <div class="mode-cards">
              ${Object.entries(DRAFT_MODES_INFO).map(([key, info]) => `
                <div class="mode-card ${key === selectedMode ? 'active' : ''}" data-mode="${key}">
                  <div class="mode-icon">${info.icon}</div>
                  <h3>${info.name}</h3>
                  <p>${info.description}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- SALAS -->
          <div class="home-section">
            <h2 class="section-title">2. Entrar na Batalha</h2>
            
            ${errorMsg ? `<div class="auth-error" style="margin-bottom:1rem">⚠️ ${errorMsg}</div>` : ''}
            
            <div class="rooms-actions-grid">
              <button class="btn-start" id="btn-create-room">
                <span>➕</span> Criar Sala Online
              </button>
              
              <div class="join-room-box">
                <input type="text" id="room-code-input" placeholder="CÓDIGO DA SALA" maxlength="6" />
                <button class="btn-join" id="btn-join-room">Entrar</button>
              </div>
            </div>
          </div>
          
        </div>

        <!-- COLUNA DIREITA: Leaderboard -->
        <div class="home-col-leaderboard">
          <div class="home-section">
            <h2 class="section-title">🏆 Leaderboard Global</h2>
            <div class="leaderboard-card">
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th style="width: 50px">Pos</th>
                    <th>Treinador</th>
                    <th style="text-align: center">🏆</th>
                    <th style="text-align: center">V/D</th>
                    <th style="text-align: right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaderboard.length === 0 ? `
                    <tr>
                      <td colspan="5" style="text-align: center; padding: 2rem 0; color: var(--text-3)">Nenhum resultado registrado ainda</td>
                    </tr>
                  ` : leaderboard.map((row, index) => {
                    let medal = index + 1;
                    if (index === 0) medal = '🥇';
                    else if (index === 1) medal = '🥈';
                    else if (index === 2) medal = '🥉';
                    
                    const isSelf = row.id === profile?.id;

                    return `
                      <tr class="${isSelf ? 'self-row' : ''}">
                        <td><b>${medal}</b></td>
                        <td class="lead-username">${row.username}</td>
                        <td style="text-align: center; font-weight: 600">${row.championships}</td>
                        <td style="text-align: center; color: var(--text-2); font-size: 0.8rem">${row.wins}/${row.losses}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success)">${row.win_rate}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  renderParticles();
  attachEvents();
}

function renderParticles() {
  const containerParticles = document.getElementById('particles');
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
  // Selecionar modo
  container.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      container.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Criar sala
  const btnCreate = container.querySelector('#btn-create-room');
  if (btnCreate) {
    btnCreate.addEventListener('click', handleCreateRoom);
  }

  // Entrar na sala
  const btnJoin = container.querySelector('#btn-join-room');
  const inputCode = container.querySelector('#room-code-input');
  if (btnJoin && inputCode) {
    btnJoin.addEventListener('click', () => handleJoinRoom(inputCode.value));
    inputCode.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleJoinRoom(inputCode.value);
    });
  }

  // Logout
  const btnLogout = container.querySelector('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }
}

function generateClientRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function handleCreateRoom() {
  if (loading) return;
  loading = true;
  errorMsg = '';
  renderScreen();

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const code = generateClientRoomCode();
    
    // Insere sala
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        mode: selectedMode,
        status: 'waiting',
        max_players: 8
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Adiciona o criador como participante no slot 0
    const { error: partError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: user.id,
        is_bot: false,
        slot: 0,
        team: []
      });

    if (partError) throw partError;

    navigate('lobby', { code: room.code, roomId: room.id });
  } catch (err) {
    console.error(err);
    errorMsg = err.message || 'Erro ao criar sala.';
    loading = false;
    renderScreen();
  }
}

async function handleJoinRoom(code) {
  if (!code || code.trim().length !== 6) {
    errorMsg = 'Insira um código válido de 6 caracteres.';
    renderScreen();
    return;
  }

  if (loading) return;
  loading = true;
  errorMsg = '';
  renderScreen();

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const cleanCode = code.trim().toUpperCase();

    // 1. Busca sala
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .single();

    if (roomError || !room) {
      throw new Error('Sala não encontrada. Verifique o código.');
    }

    if (room.status !== 'waiting') {
      throw new Error('Esta sala já iniciou o jogo.');
    }

    // 2. Busca participantes
    const { data: participants, error: partError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', room.id);

    if (partError) throw partError;

    if (participants.length >= 8) {
      throw new Error('A sala está cheia.');
    }

    // Verifica se já está na sala
    const alreadyIn = participants.find(p => p.user_id === user.id);
    if (alreadyIn) {
      navigate('lobby', { code: room.code, roomId: room.id });
      return;
    }

    // Encontra primeiro slot livre (0-7)
    const takenSlots = participants.map(p => p.slot);
    let nextSlot = 0;
    for (let i = 0; i < 8; i++) {
      if (!takenSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }

    // 3. Adiciona participante
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: user.id,
        is_bot: false,
        slot: nextSlot,
        team: []
      });

    if (joinError) throw joinError;

    navigate('lobby', { code: room.code, roomId: room.id });
  } catch (err) {
    console.error(err);
    errorMsg = err.message || 'Erro ao entrar na sala.';
    loading = false;
    renderScreen();
  }
}

export function destroy() {}
