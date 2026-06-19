import { supabase } from '../../lib/supabase.js';

let container = null;
let activeTab = 'leaderboard'; // 'leaderboard' | 'hall'
let leaderboardData = [];
let hallData = [];
let loading = false;

export function initGloryModal(parent) {
  container = document.createElement('div');
  container.className = 'glory-modal-overlay';
  container.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
    display: none; justify-content: center; align-items: center; z-index: 1000;
  `;
  
  parent.appendChild(container);
  
  // Fechar ao clicar fora
  container.addEventListener('click', (e) => {
    if (e.target === container) closeGloryModal();
  });
}

export async function openGloryModal() {
  if (!container) return;
  container.style.display = 'flex';
  loading = true;
  render();

  try {
    // Busca Leaderboard (Profiles ordenado por wins)
    const { data: leads } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, wins, tournaments_played')
      .order('wins', { ascending: false })
      .limit(20);
      
    leaderboardData = leads || [];

    // Busca Hall of Fame
    const { data: halls } = await supabase
      .from('hall_of_fame')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(20);
      
    hallData = halls || [];
  } catch (err) {
    console.error('Erro ao buscar dados de glória', err);
  } finally {
    loading = false;
    render();
  }
}

export function closeGloryModal() {
  if (container) container.style.display = 'none';
}

function render() {
  if (!container) return;

  const content = `
    <div class="glory-modal-content" style="background: var(--bg-2); width: 90%; max-width: 800px; max-height: 85vh; border-radius: 12px; border: 1px solid var(--border-bright); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.5); animation: scale-up 0.3s ease;">
      <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
        <h2 style="margin: 0; font-size: 1.5rem; display: flex; gap: 1rem;">
          <button class="tab-btn" data-tab="leaderboard" style="background:none; border:none; color: ${activeTab === 'leaderboard' ? 'var(--gold)' : 'var(--text-3)'}; font-size: 1.2rem; cursor: pointer; font-weight: bold; transition: 0.2s;">🏆 Leaderboard</button>
          <button class="tab-btn" data-tab="hall" style="background:none; border:none; color: ${activeTab === 'hall' ? 'var(--gold)' : 'var(--text-3)'}; font-size: 1.2rem; cursor: pointer; font-weight: bold; transition: 0.2s;">🏛️ Hall da Fama</button>
        </h2>
        <button class="close-btn" style="background:none; border:none; color: var(--text-2); font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>

      <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
        ${loading ? `
          <div style="display:flex; justify-content:center; padding: 3rem;">
            <div class="thinking-spinner"></div>
          </div>
        ` : (activeTab === 'leaderboard' ? renderLeaderboard() : renderHall())}
      </div>
    </div>
  `;

  container.innerHTML = content;

  container.querySelector('.close-btn').onclick = closeGloryModal;
  
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      render();
    };
  });
}

function renderLeaderboard() {
  if (leaderboardData.length === 0) return '<p style="text-align:center; color: var(--text-3);">Nenhum dado encontrado.</p>';

  return `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      ${leaderboardData.map((p, idx) => `
        <div style="display: flex; align-items: center; background: var(--bg-3); padding: 1rem; border-radius: 8px; border-left: 4px solid ${idx === 0 ? 'var(--gold)' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'var(--border)'};">
          <h3 style="margin: 0 1rem 0 0; width: 30px; text-align: center; color: var(--text-2); font-size: 1.5rem;">#${idx+1}</h3>
          <img src="${p.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed='+p.username}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border); margin-right: 1rem;">
          <div style="flex: 1;">
            <h4 style="margin: 0; font-size: 1.1rem;">${p.username}</h4>
            <div style="font-size: 0.8rem; color: var(--text-3);">${p.tournaments_played || 0} torneios jogados</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--gold);">${p.wins || 0}</div>
            <div style="font-size: 0.7rem; color: var(--text-3); text-transform: uppercase;">Vitórias</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHall() {
  if (hallData.length === 0) return '<p style="text-align:center; color: var(--text-3);">O Hall da Fama está vazio. Seja o primeiro campeão!</p>';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      ${hallData.map(h => {
        const d = new Date(h.created_at).toLocaleDateString('pt-BR');
        return `
        <div style="background: var(--bg-3); border-radius: 12px; border: 1px solid var(--gold); overflow: hidden; position: relative;">
          <div style="position: absolute; top:0; left:0; right:0; height: 100px; background: linear-gradient(to bottom, rgba(255,215,0,0.1), transparent); pointer-events: none;"></div>
          
          <div style="padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,215,0,0.2); display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <img src="${h.profiles?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed='+(h.profiles?.username||'a')}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--gold);">
              <div>
                <h3 style="margin: 0; color: var(--gold); text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${h.profiles?.username || 'Treinador'}</h3>
                <span style="font-size: 0.8rem; color: var(--text-2);">Torneio: ${h.room_name}</span>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-3);">${d}</div>
          </div>
          
          <div style="padding: 1.5rem; display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; position: relative; z-index: 1;">
            ${h.team_json.map(poke => {
              if (!poke.stats) {
                // Item
                return `
                  <div style="text-align: center; width: 60px;">
                    <div style="font-size: 2.5rem;">${poke.icon}</div>
                    <div style="font-size: 0.65rem; color: var(--text-2); margin-top: 0.3rem;">${poke.displayName}</div>
                  </div>
                `;
              }
              return `
                <div style="text-align: center; width: 60px;" data-tooltip-info='${JSON.stringify(poke).replace(/'/g, "&apos;")}'>
                  <img src="${poke.sprite}" style="width: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                  <div style="font-size: 0.65rem; color: var(--text-2); margin-top: 0.3rem;">${poke.displayName} ${poke.isShiny?'✨':''}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}
