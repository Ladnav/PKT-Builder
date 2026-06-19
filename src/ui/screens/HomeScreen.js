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
    errorMsg = 'Erro ao conectar ao servidor. Verifique sua conexao.';
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
          <p>Carregando informacoes do treinador...</p>
        </div>
      </div>
    `;
    return;
  }

  const totalGames = (profile?.wins || 0) + (profile?.losses || 0);
  const winRate = totalGames > 0 ? ((profile.wins / totalGames) * 100).toFixed(1) : '0';

  container.innerHTML = `
    <style>
      .hs-bg {
        min-height: 100vh;
        background: radial-gradient(ellipse at 20% 0%, rgba(99,60,180,0.18) 0%, transparent 55%),
                    radial-gradient(ellipse at 80% 100%, rgba(30,140,255,0.14) 0%, transparent 55%),
                    var(--bg-1, #0d0d1a);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        position: relative;
        overflow-x: hidden;
      }
      .hs-particles {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }
      .hs-header {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 2rem;
        background: rgba(13,13,26,0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        box-shadow: 0 4px 32px rgba(0,0,0,0.4);
      }
      .hs-logo {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .hs-logo-badge {
        font-size: 1.5rem;
        filter: drop-shadow(0 0 8px #ffe03a);
        animation: hs-pulse-logo 3s ease-in-out infinite;
      }
      @keyframes hs-pulse-logo {
        0%,100% { filter: drop-shadow(0 0 6px #ffe03a); }
        50%      { filter: drop-shadow(0 0 18px #ffe03a); }
      }
      .hs-logo-text {
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(90deg, #fff 40%, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
      }
      .hs-logo-text span {
        background: linear-gradient(90deg, #a78bfa, #60a5fa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .hs-profile-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 40px;
        padding: 0.35rem 0.35rem 0.35rem 0.9rem;
        backdrop-filter: blur(10px);
      }
      .hs-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #2563eb);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
        box-shadow: 0 0 0 2px rgba(167,139,250,0.35);
      }
      .hs-profile-info {
        display: flex;
        flex-direction: column;
        gap: 0.05rem;
        min-width: 0;
      }
      .hs-profile-name {
        font-size: 0.82rem;
        font-weight: 700;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }
      .hs-profile-stats {
        font-size: 0.67rem;
        color: rgba(255,255,255,0.45);
        white-space: nowrap;
        letter-spacing: 0.2px;
      }
      .hs-stat-sep { margin: 0 0.3rem; opacity: 0.35; }
      .hs-champ { color: #fbbf24; font-weight: 600; }
      .hs-wins  { color: #34d399; font-weight: 600; }
      .hs-losses { color: #f87171; font-weight: 600; }
      .hs-wr    { color: #60a5fa; font-weight: 600; }
      .hs-btn-logout {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(239,68,68,0.12);
        color: #f87171;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        transition: background 0.2s, transform 0.2s;
        flex-shrink: 0;
      }
      .hs-btn-logout:hover {
        background: rgba(239,68,68,0.28);
        transform: scale(1.1);
      }
      .hs-main {
        position: relative;
        z-index: 1;
        flex: 1;
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 2.5rem 1.5rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
      }
      .hs-hero { text-align: center; padding-top: 0.25rem; }
      .hs-hero-tagline {
        font-size: clamp(1.6rem, 4vw, 2.5rem);
        font-weight: 900;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #fff 20%, #a78bfa 55%, #60a5fa 90%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0 0 0.5rem;
        line-height: 1.15;
      }
      .hs-hero-sub {
        font-size: 0.88rem;
        color: rgba(255,255,255,0.35);
        margin: 0;
        letter-spacing: 0.4px;
      }
      .hs-section-label {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: rgba(167,139,250,0.7);
        margin: 0 0 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .hs-section-label::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, rgba(167,139,250,0.25), transparent);
      }
      .hs-modes-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.85rem;
      }
      @media (max-width: 600px) {
        .hs-modes-row { grid-template-columns: 1fr; }
        .hs-header { padding: 0.6rem 1rem; }
        .hs-profile-stats { display: none; }
      }
      .mode-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 1.1rem 1rem;
        cursor: pointer;
        transition: border-color 0.25s, background 0.25s, transform 0.2s, box-shadow 0.25s;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        user-select: none;
      }
      .mode-card:hover {
        background: rgba(167,139,250,0.07);
        border-color: rgba(167,139,250,0.3);
        transform: translateY(-2px);
      }
      .mode-card.active {
        background: rgba(124,58,237,0.14);
        border-color: rgba(167,139,250,0.65);
        box-shadow: 0 0 0 1px rgba(167,139,250,0.3), 0 0 24px rgba(124,58,237,0.2);
        transform: translateY(-2px);
      }
      .hs-mode-icon { font-size: 1.7rem; line-height: 1; }
      .hs-mode-name {
        font-size: 0.88rem;
        font-weight: 700;
        color: #e2e8f0;
        margin: 0;
      }
      .mode-card.active .hs-mode-name { color: #c4b5fd; }
      .hs-mode-desc {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.38);
        margin: 0;
        line-height: 1.45;
      }
      .hs-battle-row {
        display: flex;
        align-items: stretch;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .hs-btn-create {
        flex: 1;
        min-width: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 0.9rem 1.5rem;
        border-radius: 14px;
        border: none;
        background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
        color: #fff;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.3px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 20px rgba(124,58,237,0.35);
      }
      .hs-btn-create::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
        opacity: 0;
        transition: opacity 0.2s;
      }
      .hs-btn-create:hover::before { opacity: 1; }
      .hs-btn-create:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(124,58,237,0.5);
      }
      .hs-btn-create:active { transform: translateY(0); }
      .hs-btn-create-icon { font-size: 1.1rem; }
      .hs-join-box {
        flex: 1;
        min-width: 210px;
        display: flex;
        align-items: stretch;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 14px;
        overflow: hidden;
        transition: border-color 0.25s;
      }
      .hs-join-box:focus-within {
        border-color: rgba(96,165,250,0.5);
        box-shadow: 0 0 0 1px rgba(96,165,250,0.15);
      }
      .hs-join-box input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        padding: 0.85rem 1rem;
        color: #e2e8f0;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
      }
      .hs-join-box input::placeholder {
        letter-spacing: 1.5px;
        color: rgba(255,255,255,0.2);
        font-weight: 400;
      }
      .hs-btn-join {
        padding: 0 1.25rem;
        background: rgba(96,165,250,0.15);
        border: none;
        border-left: 1px solid rgba(255,255,255,0.08);
        color: #60a5fa;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        white-space: nowrap;
      }
      .hs-btn-join:hover {
        background: rgba(96,165,250,0.28);
        color: #93c5fd;
      }
      .hs-error {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        border-radius: 10px;
        padding: 0.7rem 1rem;
        font-size: 0.82rem;
        color: #fca5a5;
        margin-bottom: 0.85rem;
      }
      .hs-lb-card {
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 18px;
        overflow: hidden;
      }
      .hs-lb-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }
      .hs-lb-table thead tr { background: rgba(255,255,255,0.04); }
      .hs-lb-table th {
        padding: 0.7rem 1rem;
        text-align: left;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.3);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .hs-lb-table th.tc { text-align: center; }
      .hs-lb-table th.tr { text-align: right; }
      .hs-lb-table td {
        padding: 0.72rem 1rem;
        color: rgba(255,255,255,0.72);
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background 0.15s;
      }
      .hs-lb-table tbody tr:last-child td { border-bottom: none; }
      .hs-lb-table tbody tr:hover td { background: rgba(255,255,255,0.03); }
      .hs-lb-table .self-row td { background: rgba(124,58,237,0.1); color: #e2e8f0; }
      .hs-lb-table .self-row:hover td { background: rgba(124,58,237,0.15); }
      .hs-lb-pos { width: 52px; font-weight: 700; font-size: 1rem; }
      .hs-lb-name { font-weight: 600; color: #e2e8f0; }
      .self-row .hs-lb-name { color: #c4b5fd; }
      .hs-lb-champ { text-align: center; font-weight: 700; color: #fbbf24; }
      .hs-lb-vd { text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.4); }
      .hs-lb-wr { text-align: right; font-weight: 700; color: #34d399; }
      .hs-lb-empty {
        text-align: center !important;
        padding: 2.5rem 0 !important;
        color: rgba(255,255,255,0.2) !important;
        font-size: 0.82rem;
      }
    </style>

    <div class="hs-bg home-bg">
      <div class="hs-particles home-particles" id="particles"></div>

      <header class="hs-header">
        <div class="hs-logo">
          <span class="hs-logo-badge">&#x26A1;</span>
          <h1 class="hs-logo-text">Poke<span>Champion</span></h1>
        </div>

        <div class="hs-profile-card">
          <div class="hs-avatar">&#128100;</div>
          <div class="hs-profile-info">
            <span class="hs-profile-name">${profile?.username || 'Treinador'}</span>
            <span class="hs-profile-stats">
              <span class="hs-champ">&#127942; ${profile?.championships || 0}</span>
              <span class="hs-stat-sep">&#183;</span>
              <span class="hs-wins">${profile?.wins || 0}V</span>
              <span class="hs-stat-sep">/</span>
              <span class="hs-losses">${profile?.losses || 0}D</span>
              <span class="hs-stat-sep">&#183;</span>
              <span class="hs-wr">${winRate}%</span>
            </span>
          </div>
          <button class="hs-btn-logout" id="btn-logout" title="Sair da conta">&#x1F6AA;</button>
        </div>
      </header>

      <main class="hs-main">

        <div class="hs-hero">
          <h2 class="hs-hero-tagline">Construa seu time.<br>Domine o torneio.</h2>
          <p class="hs-hero-sub">Escolha seu modo, monte sua sala e lute pelo titulo de campeao.</p>
        </div>

        <section>
          <p class="hs-section-label">Modo de Draft</p>
          <div class="hs-modes-row">
            ${Object.entries(DRAFT_MODES_INFO).map(([key, info]) => `
              <div class="mode-card ${key === selectedMode ? 'active' : ''}" data-mode="${key}">
                <div class="hs-mode-icon">${info.icon}</div>
                <h3 class="hs-mode-name">${info.name}</h3>
                <p class="hs-mode-desc">${info.description}</p>
              </div>
            `).join('')}
          </div>
        </section>

        <section>
          <p class="hs-section-label">Entrar na Batalha</p>

          ${errorMsg ? `
            <div class="hs-error">
              <span>&#x26A0;&#xFE0F;</span>
              <span>${errorMsg}</span>
            </div>
          ` : ''}

          <div class="hs-battle-row">
            <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1;">
              <select id="room-size-select" style="width: 100%; padding: 0.85rem 1.2rem; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; font-weight: 600; font-family: inherit; font-size: 0.9rem; outline: none; cursor: pointer; transition: background 0.2s;">
                <option value="8" style="background: #1e1b4b; color: white;">8 Jogadores (Tamanho Padrao)</option>
                <option value="4" style="background: #1e1b4b; color: white;">4 Jogadores (Mais Rapido)</option>
              </select>
              <button class="hs-btn-create" id="btn-create-room">
                <span class="hs-btn-create-icon">&#x2795;</span>
                Criar Sala Online
              </button>
            </div>

            <div class="hs-join-box">
              <input
                type="text"
                id="room-code-input"
                placeholder="CODIGO DA SALA"
                maxlength="6"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="hs-btn-join" id="btn-join-room">Entrar &#x2192;</button>
            </div>
          </div>
        </section>

        <section>
          <p class="hs-section-label">&#x1F3C6; Leaderboard</p>
          <div class="hs-lb-card">
            <table class="hs-lb-table">
              <thead>
                <tr>
                  <th class="hs-lb-pos">Pos</th>
                  <th>Treinador</th>
                  <th class="tc">Campeonatos</th>
                  <th class="tc">V/D</th>
                  <th class="tr">Win%</th>
                </tr>
              </thead>
              <tbody>
                ${leaderboard.length === 0 ? `
                  <tr><td colspan="5" class="hs-lb-empty">Nenhum resultado ainda &#x2014; seja o primeiro campeao! &#x1F3C6;</td></tr>
                ` : leaderboard.map((row, index) => {
                  let medal = String(index + 1);
                  if (index === 0) medal = '&#x1F947;';
                  else if (index === 1) medal = '&#x1F948;';
                  else if (index === 2) medal = '&#x1F949;';
                  const isSelf = row.id === profile?.id;
                  return `
                    <tr class="${isSelf ? 'self-row' : ''}">
                      <td class="hs-lb-pos">${medal}</td>
                      <td class="hs-lb-name">${row.username}${isSelf ? ' <span style="font-size:0.65rem;color:rgba(167,139,250,0.7);font-weight:400;">(voce)</span>' : ''}</td>
                      <td class="hs-lb-champ">${row.championships}</td>
                      <td class="hs-lb-vd">${row.wins}/${row.losses}</td>
                      <td class="hs-lb-wr">${row.win_rate}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  `;

  renderParticles();
  attachEvents();
}

function renderParticles() {
  const containerParticles = document.getElementById('particles');
  if (!containerParticles) return;
  const symbols = ['\u26A1','\uD83D\uDD25','\uD83D\uDCA7','\uD83C\uDF3F','\u2744\uFE0F','\uD83D\uDC4A','\u2620\uFE0F','\uD83D\uDD2E','\uD83D\uDC09','\uD83C\uDF11'];
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
  container.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      container.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  const btnCreate = container.querySelector('#btn-create-room');
  if (btnCreate) {
    btnCreate.addEventListener('click', handleCreateRoom);
  }

  const btnJoin = container.querySelector('#btn-join-room');
  const inputCode = container.querySelector('#room-code-input');
  if (btnJoin && inputCode) {
    btnJoin.addEventListener('click', () => handleJoinRoom(inputCode.value));
    inputCode.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleJoinRoom(inputCode.value);
    });
  }

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
  
  // Captura o tamanho da sala antes de re-renderizar (o re-render faria perder o state do DOM)
  const sizeSelect = container.querySelector('#room-size-select');
  const maxPlayers = sizeSelect ? parseInt(sizeSelect.value, 10) : 8;

  renderScreen();

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Usuario nao autenticado.');

    const code = generateClientRoomCode();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        mode: selectedMode,
        status: 'waiting',
        max_players: maxPlayers
      })
      .select()
      .single();

    if (roomError) throw roomError;

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
    errorMsg = 'Insira um codigo valido de 6 caracteres.';
    renderScreen();
    return;
  }

  if (loading) return;
  loading = true;
  errorMsg = '';
  renderScreen();

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Usuario nao autenticado.');

    const cleanCode = code.trim().toUpperCase();

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .single();

    if (roomError || !room) {
      throw new Error('Sala nao encontrada. Verifique o codigo.');
    }

    const { data: participants, error: partError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', room.id);

    if (partError) throw partError;

    const alreadyIn = participants.find(p => p.user_id === user.id);
    if (alreadyIn) {
      if (room.status === 'drafting') {
        navigate('draft', { code: room.code, roomId: room.id });
      } else if (room.status === 'tournament' || room.status === 'finished') {
        navigate('bracket', { code: room.code, roomId: room.id });
      } else {
        navigate('lobby', { code: room.code, roomId: room.id });
      }
      return;
    }

    if (room.status !== 'waiting') {
      throw new Error('Esta sala ja iniciou o jogo.');
    }

    if (participants.length >= (room.max_players || 8)) {
      throw new Error('A sala esta cheia.');
    }

    const takenSlots = participants.map(p => p.slot);
    let nextSlot = 0;
    for (let i = 0; i < (room.max_players || 8); i++) {
      if (!takenSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }

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
