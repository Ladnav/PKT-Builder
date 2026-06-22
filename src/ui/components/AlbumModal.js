// src/ui/components/AlbumModal.js
import { supabase } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';

import { getRankInfo } from '../../lib/rank.js';

const LEGENDARY_IDS = [150, 384, 483, 487, 491]; // Mewtwo, Rayquaza, Dialga, Giratina, Darkrai

let modalContainer = null;
let currentUserId = null;
let currentUsername = 'Treinador';
let userCards = [];      // { pokemon_id, is_shiny, quantity }
let userBadges = [];     // { badge_id, unlocked_at }
let userEloPoints = 0;   // Pontos de ELO/PDL do jogador

const totalCount = pokemonData.length;
const count10 = Math.round(totalCount * 0.1);
const count50 = Math.round(totalCount * 0.5);

const BADGES_CONFIG = {
  'album_10': { title: '🎒 Colecionador Iniciante', desc: `Colete 10% do Álbum (${count10} Pokémon)`, icon: '🥉' },
  'album_50': { title: '🏆 Colecionador Elite', desc: `Colete 50% do Álbum (${count50} Pokémon)`, icon: '🥈' },
  'album_100': { title: '👑 Mestre de Kanto-Sinnoh', desc: `Colete todos os ${totalCount} Pokémon do Álbum`, icon: '🥇' },
  'type_fire': { title: '🔥 Líder de Fogo', desc: 'Colete todos os Pokémon do tipo Fogo', icon: '📛', type: 'fire' },
  'type_water': { title: '💧 Líder de Água', desc: 'Colete todos os Pokémon do tipo Água', icon: '📛', type: 'water' },
  'type_grass': { title: '🌿 Líder de Planta', desc: 'Colete todos os Pokémon do tipo Planta', icon: '📛', type: 'grass' },
  'type_electric': { title: '⚡ Líder Elétrico', desc: 'Colete todos os Pokémon do tipo Elétrico', icon: '📛', type: 'electric' },
  'type_dragon': { title: '🐉 Domador de Dragões', desc: 'Colete todos os Pokémon do tipo Dragão', icon: '📛', type: 'dragon' },
  'rank_madeira': { title: '🪵 Insígnia de Madeira', desc: 'Alcance o ELO Madeira (100+ pontos)', icon: '🪵' },
  'rank_ferro': { title: '⛓️ Insígnia de Ferro', desc: 'Alcance o ELO Ferro (500+ pontos)', icon: '⛓️' },
  'rank_ouro': { title: '🪙 Insígnia de Ouro', desc: 'Alcance o ELO Ouro (900+ pontos)', icon: '🪙' },
  'rank_platina': { title: '🛡️ Insígnia de Platina', desc: 'Alcance o ELO Platina (1300+ pontos)', icon: '🛡️' },
  'rank_diamante': { title: '💎 Insígnia de Diamante', desc: 'Alcance o ELO Diamante (1700+ pontos)', icon: '💎' },
  'rank_mestre': { title: '👑 Insígnia de Mestre', desc: 'Alcance o ELO Mestre (2100+ pontos)', icon: '👑' }
};

export function initAlbumModal(container, userId, username) {
  currentUserId = userId;
  currentUsername = username || 'Treinador';
  modalContainer = container;
}

export async function openAlbumModal() {
  if (!currentUserId) return;
  
  // Cria elemento do modal se não existir
  let modal = document.getElementById('album-modal-wrapper');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'album-modal-wrapper';
    modal.className = 'battle-modal-overlay';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <style>
      /* Custom responsive grid & holographic zoom card styling */
      .zoom-card-container {
        transform-style: preserve-3d;
        transition: transform 0.1s ease;
      }
      
      /* Shiny foil hologram shimmer overlay */
      .shiny-holo-overlay {
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.45) 0%,
          transparent 45%,
          rgba(0, 0, 0, 0.15) 50%,
          transparent 55%,
          rgba(255, 255, 255, 0.45) 100%
        );
        background-size: 200% 200%;
        mix-blend-mode: color-dodge;
      }
      
      /* Progress Gen box */
      .album-progress-gen-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.8rem;
        margin-top: 1rem;
        width: 100%;
      }

      /* Responsive styles for details modal */
      @media (max-width: 650px) {
        #album-card-zoom-inner {
          flex-direction: column !important;
          align-items: center;
          max-height: 95vh !important;
        }
        .zoom-card-container {
          width: 170px !important;
          height: 255px !important;
        }
      }
    </style>
    <div class="battle-modal-inner album-modal-card" style="max-width: 950px; width: 95%; height: 85vh; position: relative;">
      <button class="modal-close" id="btn-close-album">✕</button>
      <div class="battle-modal-header" style="padding-right: 3.5rem;">
        <h3 class="battle-modal-title">📚 Coleção e Álbum de Cartas</h3>
      </div>
      <div class="album-loading-state" style="text-align: center; padding: 3rem;">
        <span class="loading-spinner">⌛</span> Carregando sua coleção de cartas...
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  document.getElementById('btn-close-album').addEventListener('click', closeAlbumModal);

  try {
    await loadCollectionData();
    await checkAndUnlockBadges();
    renderAlbumContent();
  } catch (err) {
    console.error('Erro ao carregar álbum:', err);
    const loadingDiv = modal.querySelector('.album-loading-state');
    if (loadingDiv) {
      loadingDiv.innerHTML = `<span style="color:var(--danger);">❌ Erro ao conectar. Verifique se o script SQL foi executado no Supabase.</span>`;
    }
  }
}

export function closeAlbumModal() {
  const modal = document.getElementById('album-modal-wrapper');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function loadCollectionData() {
  // 1. Busca cartas
  const { data: cards, error: cardsErr } = await supabase
    .from('user_cards')
    .select('pokemon_id, is_shiny, quantity')
    .eq('user_id', currentUserId);

  if (cardsErr) throw cardsErr;
  userCards = cards || [];

  // 2. Busca insígnias/conquistas
  const { data: badges, error: badgesErr } = await supabase
    .from('user_badges')
    .select('badge_id, unlocked_at')
    .eq('user_id', currentUserId);

  if (badgesErr) throw badgesErr;
  userBadges = badges || [];

  // 3. Busca elo_points do perfil
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('elo_points')
    .eq('id', currentUserId)
    .single();

  if (profErr) {
    console.error('Erro ao buscar elo_points para o álbum:', profErr);
    userEloPoints = 0;
  } else {
    userEloPoints = prof ? (prof.elo_points || 0) : 0;
  }
}

// Verifica se cumpriu requisitos de conquistas e atualiza no Supabase
async function checkAndUnlockBadges() {
  const collectedIds = new Set(userCards.map(c => c.pokemon_id));
  const uniqueCount = collectedIds.size;
  const newBadgesToUnlock = [];
  const badgesToRemove = [];

  const checkTypeComplete = (type) => {
    const pokesOfType = pokemonData.filter(p => p.types.includes(type)).map(p => p.id);
    if (pokesOfType.length === 0) return false;
    return pokesOfType.every(id => collectedIds.has(id));
  };

  // Verificações para desbloquear ou remover
  if (uniqueCount >= count10) {
    if (!userBadges.some(b => b.badge_id === 'album_10')) newBadgesToUnlock.push('album_10');
  } else {
    if (userBadges.some(b => b.badge_id === 'album_10')) badgesToRemove.push('album_10');
  }

  if (uniqueCount >= count50) {
    if (!userBadges.some(b => b.badge_id === 'album_50')) newBadgesToUnlock.push('album_50');
  } else {
    if (userBadges.some(b => b.badge_id === 'album_50')) badgesToRemove.push('album_50');
  }

  if (uniqueCount >= totalCount) {
    if (!userBadges.some(b => b.badge_id === 'album_100')) newBadgesToUnlock.push('album_100');
  } else {
    if (userBadges.some(b => b.badge_id === 'album_100')) badgesToRemove.push('album_100');
  }

  const typesToCheck = ['fire', 'water', 'grass', 'electric', 'dragon'];
  for (const t of typesToCheck) {
    const badgeId = `type_${t}`;
    if (checkTypeComplete(t)) {
      if (!userBadges.some(b => b.badge_id === badgeId)) newBadgesToUnlock.push(badgeId);
    } else {
      if (userBadges.some(b => b.badge_id === badgeId)) badgesToRemove.push(badgeId);
    }
  }

  // Verificações de ELO
  const eloThresholds = [
    { badgeId: 'rank_madeira', minElo: 100 },
    { badgeId: 'rank_ferro', minElo: 500 },
    { badgeId: 'rank_ouro', minElo: 900 },
    { badgeId: 'rank_platina', minElo: 1300 },
    { badgeId: 'rank_diamante', minElo: 1700 },
    { badgeId: 'rank_mestre', minElo: 2100 }
  ];

  for (const threshold of eloThresholds) {
    if (userEloPoints >= threshold.minElo) {
      if (!userBadges.some(b => b.badge_id === threshold.badgeId)) {
        newBadgesToUnlock.push(threshold.badgeId);
      }
    } else {
      if (userBadges.some(b => b.badge_id === threshold.badgeId)) {
        badgesToRemove.push(threshold.badgeId);
      }
    }
  }

  let changed = false;

  if (newBadgesToUnlock.length > 0) {
    console.log('Novas conquistas desbloqueadas!', newBadgesToUnlock);
    const inserts = newBadgesToUnlock.map(badge_id => ({
      user_id: currentUserId,
      badge_id: badge_id
    }));
    const { error } = await supabase.from('user_badges').insert(inserts);
    if (error) {
      console.error('Erro ao salvar conquistas no banco:', error);
    } else {
      changed = true;
    }
  }

  if (badgesToRemove.length > 0) {
    console.log('Removendo conquistas que não cumprem mais os requisitos:', badgesToRemove);
    const { error } = await supabase
      .from('user_badges')
      .delete()
      .eq('user_id', currentUserId)
      .in('badge_id', badgesToRemove);
    if (error) {
      console.error('Erro ao remover conquistas do banco:', error);
    } else {
      changed = true;
    }
  }

  if (changed) {
    // Recarrega conquistas locais
    const { data: updatedBadges } = await supabase
      .from('user_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', currentUserId);
    userBadges = updatedBadges || [];
  }
}

function renderAlbumContent() {
  const modal = document.getElementById('album-modal-wrapper');
  if (!modal) return;

  const card = modal.querySelector('.album-modal-card');
  
  // Agrupa as cartas coletadas para busca rápida
  const collectedMap = {};
  userCards.forEach(c => {
    if (!collectedMap[c.pokemon_id]) {
      collectedMap[c.pokemon_id] = { normal: 0, shiny: 0 };
    }
    if (c.is_shiny) {
      collectedMap[c.pokemon_id].shiny += c.quantity;
    } else {
      collectedMap[c.pokemon_id].normal += c.quantity;
    }
  });

  const uniqueCount = Object.keys(collectedMap).length;
  const progressPercent = ((uniqueCount / pokemonData.length) * 100).toFixed(0);

  // Calcule o progresso por geração
  const gensConfig = {
    1: { name: 'Kanto', range: 'Gen 1' },
    2: { name: 'Johto', range: 'Gen 2' },
    3: { name: 'Hoenn', range: 'Gen 3' },
    4: { name: 'Sinnoh', range: 'Gen 4' }
  };

  const progressByGen = {};
  for (let gen = 1; gen <= 4; gen++) {
    const pokes = pokemonData.filter(p => {
      if (gen === 1) return p.id >= 1 && p.id <= 151;
      if (gen === 2) return p.id >= 152 && p.id <= 251;
      if (gen === 3) return p.id >= 252 && p.id <= 386;
      if (gen === 4) return p.id >= 387 && p.id <= 493;
      return false;
    });
    const total = pokes.length;
    const collected = pokes.filter(p => collectedMap[p.id]).length;
    const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
    progressByGen[gen] = { collected, total, pct };
  }

  // Auto-claim de recompensas por completude
  let claimedSome = false;
  let claimMsgs = [];
  
  Object.entries(gensConfig).forEach(([gen, cfg]) => {
    const stats = progressByGen[gen] || { collected: 0, total: 0, pct: 0 };
    const savedGoldStr = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    let currentGold = savedGoldStr ? parseInt(savedGoldStr, 10) : 100;
    
    // 50% Milestone
    if (stats.pct >= 50) {
      const rewardKey = `pkt_reward_gen_${gen}_50_${currentUserId}`;
      if (localStorage.getItem(rewardKey) !== 'claimed') {
        localStorage.setItem(rewardKey, 'claimed');
        currentGold += 150;
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(currentGold));
        claimMsgs.push(`🎉 Excelente! Você completou 50% da Região de ${cfg.name} e ganhou +150 Gold!`);
        claimedSome = true;
      }
    }
    
    // 100% Milestone
    if (stats.pct >= 100) {
      const rewardKey = `pkt_reward_gen_${gen}_100_${currentUserId}`;
      if (localStorage.getItem(rewardKey) !== 'claimed') {
        localStorage.setItem(rewardKey, 'claimed');
        currentGold += 500;
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(currentGold));
        claimMsgs.push(`👑 Incrível! Você completou 100% da Região de ${cfg.name} e ganhou +500 Gold!`);
        claimedSome = true;
      }
    }
  });

  card.innerHTML = `
    <button class="modal-close" id="btn-close-album">✕</button>
    <div class="battle-modal-header" style="padding-right: 3.5rem; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
      <h3 class="battle-modal-title">📚 Coleção e Álbum de Cartas</h3>
      <div id="album-gold-display" style="color: #fbbf24; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px; background: rgba(251,191,36,0.1); border: 1px solid var(--gold); padding: 4px 12px; border-radius: 20px;">
        🪙 <span id="album-gold-count">0</span> Gold
      </div>
    </div>
    
    <div class="album-layout" style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem; max-height: 80vh; overflow-y: auto;">
      
      <!-- PROGRESS BAR & REGIONAL DASHBOARD -->
      <div class="album-progress-box" style="background: var(--bg-3); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; width: 100%; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; width: 100%;">
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.95rem;">
              <span>Progresso Total do Álbum: ${uniqueCount} / ${pokemonData.length} Pokémon</span>
              <span style="color: var(--gold);">${progressPercent}%</span>
            </div>
            <div style="background: rgba(255,255,255,0.08); height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03);">
              <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #7c3aed 0%, #d946ef 100%); border-radius: 5px; transition: width 0.3s ease;"></div>
            </div>
          </div>
          <div style="display: flex; gap: 1rem; flex-shrink: 0;">
            <div class="album-stat-badge" style="background: rgba(255,255,255,0.04); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: center;">
              <div style="font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; font-weight: bold;">Foil / Shiny</div>
              <div style="font-size: 1.1rem; font-weight: bold; color: var(--gold);">✨ ${userCards.filter(c => c.is_shiny).reduce((sum, c) => sum + c.quantity, 0)}</div>
            </div>
            <div class="album-stat-badge" style="background: rgba(255,255,255,0.04); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); text-align: center;">
              <div style="font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; font-weight: bold;">Conquistas</div>
              <div style="font-size: 1.1rem; font-weight: bold; color: #a855f7;">🏆 ${userBadges.length} / ${Object.keys(BADGES_CONFIG).length}</div>
            </div>
          </div>
        </div>
        
        <!-- REGIONAL PROGRESS GRID -->
        <div class="album-progress-gen-grid">
          ${Object.entries(gensConfig).map(([gen, cfg]) => {
            const stats = progressByGen[gen] || { collected: 0, total: 0, pct: 0 };
            
            let badgeIcon = '🎒';
            if (stats.pct >= 100) {
              badgeIcon = '👑';
            } else if (stats.pct >= 50) {
              badgeIcon = '🏅';
            }
            
            return `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.8rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.3rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700;">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 0.95rem;">${badgeIcon}</span>
                    <span style="color: var(--text-1);">${cfg.name}</span>
                  </span>
                  <span style="color: ${stats.pct >= 100 ? 'var(--gold)' : 'var(--text-3)'}; font-size: 0.75rem;">${stats.collected}/${stats.total} (${stats.pct}%)</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.01);">
                  <div style="width: ${stats.pct}%; height: 100%; background: ${stats.pct >= 100 ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)' : 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)'}; border-radius: 3px; transition: width 0.3s;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- FILTER / TAB CONTROL -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <!-- TABS -->
        <div class="album-tabs" style="display: flex; gap: 4px; background: var(--bg-3); padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
          <button class="album-tab-btn active" id="tab-cards" style="padding: 0.5rem 1rem; background: var(--surface); border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer;">🃏 Minhas Cartas</button>
          <button class="album-tab-btn" id="tab-badges" style="padding: 0.5rem 1rem; background: transparent; border: none; border-radius: 4px; color: var(--text-2); font-weight: bold; cursor: pointer;">🏆 Conquistas (${userBadges.length})</button>
        </div>

        <!-- SEARCH AND FILTERS (Only visible on Cards Tab) -->
        <div id="cards-filter-panel" style="display: flex; gap: 1rem; flex: 1; align-items: center; flex-wrap: wrap;">
          <input type="text" id="album-search" placeholder="Buscar por nome..." style="padding: 0.5rem 1rem; border-radius: var(--radius-sm); background: var(--bg-3); border: 1px solid var(--border); color: white; outline: none; flex: 1; min-width: 150px;">
          
          <select id="album-filter-type" style="padding: 0.5rem 1rem; border-radius: var(--radius-sm); background: var(--bg-3); border: 1px solid var(--border); color: white; cursor: pointer; outline: none;">
            <option value="all">Todos os tipos</option>
            <option value="fire">🔥 Fogo</option>
            <option value="water">💧 Água</option>
            <option value="grass">🌿 Planta</option>
            <option value="electric">⚡ Elétrico</option>
            <option value="dragon">🐉 Dragão</option>
            <option value="normal">⚪ Normal</option>
            <option value="flying">🦅 Voador</option>
            <option value="poison">☠️ Venenoso</option>
            <option value="psychic">🔮 Psíquico</option>
            <option value="fighting">👊 Lutador</option>
            <option value="ground">🌍 Terrestre</option>
            <option value="rock">🪨 Pedra</option>
            <option value="bug">🐛 Inseto</option>
            <option value="ice">❄️ Gelo</option>
            <option value="ghost">👻 Fantasma</option>
            <option value="steel">⚙️ Aço</option>
            <option value="fairy">🧚 Fada</option>
          </select>

          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; user-select: none;">
            <input type="checkbox" id="album-filter-collected"> Coletados
          </label>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; user-select: none;">
            <input type="checkbox" id="album-filter-repeated"> Repetidos (x2+)
          </label>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; user-select: none;">
            <input type="checkbox" id="album-filter-shiny"> Foil/Shiny ✨
          </label>
        </div>
      </div>

      <!-- CARDS CONTENT CONTAINER -->
      <div id="album-tab-content-cards" class="album-content-view">
        <div class="album-cards-grid">
          <!-- CARDS RENDERED DYNAMICALLY -->
        </div>
      </div>

      <!-- BADGES CONTENT CONTAINER -->
      <div id="album-tab-content-badges" class="album-content-view" style="display: none;">
        <div class="album-badges-list">
          <!-- BADGES RENDERED DYNAMICALLY -->
        </div>
      </div>

    </div>
  `;

  // Bind Events
  document.getElementById('btn-close-album').addEventListener('click', closeAlbumModal);
  
  const tabCardsBtn = document.getElementById('tab-cards');
  const tabBadgesBtn = document.getElementById('tab-badges');
  const cardsContent = document.getElementById('album-tab-content-cards');
  const badgesContent = document.getElementById('album-tab-content-badges');
  const filtersPanel = document.getElementById('cards-filter-panel');

  tabCardsBtn.addEventListener('click', () => {
    tabCardsBtn.classList.add('active');
    tabCardsBtn.style.background = 'var(--surface)';
    tabCardsBtn.style.color = 'white';
    tabBadgesBtn.classList.remove('active');
    tabBadgesBtn.style.background = 'transparent';
    tabBadgesBtn.style.color = 'var(--text-2)';
    
    cardsContent.style.display = 'block';
    filtersPanel.style.display = 'flex';
    badgesContent.style.display = 'none';
  });

  tabBadgesBtn.addEventListener('click', () => {
    tabBadgesBtn.classList.add('active');
    tabBadgesBtn.style.background = 'var(--surface)';
    tabBadgesBtn.style.color = 'white';
    tabCardsBtn.classList.remove('active');
    tabCardsBtn.style.background = 'transparent';
    tabCardsBtn.style.color = 'var(--text-2)';
    
    badgesContent.style.display = 'block';
    cardsContent.style.display = 'none';
    filtersPanel.style.display = 'none';
  });

  // Filter Bindings
  const searchInput = document.getElementById('album-search');
  const typeSelect = document.getElementById('album-filter-type');
  const collectedCheck = document.getElementById('album-filter-collected');
  const repeatedCheck = document.getElementById('album-filter-repeated');
  const shinyCheck = document.getElementById('album-filter-shiny');

  const filterAction = () => {
    updateFilteredCards(
      collectedMap,
      searchInput.value,
      typeSelect.value,
      collectedCheck.checked,
      repeatedCheck.checked,
      shinyCheck.checked
    );
  };

  searchInput.addEventListener('input', filterAction);
  typeSelect.addEventListener('change', filterAction);
  collectedCheck.addEventListener('change', filterAction);
  repeatedCheck.addEventListener('change', filterAction);
  shinyCheck.addEventListener('change', filterAction);

  // Render inicial dos dados nas abas
  updateFilteredCards(collectedMap, '', 'all', false, false, false);
  renderBadgesList();
  updateAlbumGold();

  // Se resgatou alguma recompensa nesta abertura, processa avisos
  if (claimedSome) {
    setTimeout(() => {
      claimMsgs.forEach(msg => {
        showAlbumNotice(msg);
      });
    }, 500);
  }
}

function updateFilteredCards(collectedMap, search, typeFilter, onlyCollected, onlyRepeated, onlyShiny) {
  const grid = document.querySelector('.album-cards-grid');
  if (!grid) return;

  const filtered = pokemonData.filter(p => {
    const col = collectedMap[p.id];
    // 1. Filtro busca
    if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    
    // 2. Filtro Tipo
    if (typeFilter !== 'all' && !p.types.includes(typeFilter)) return false;
    
    // 3. Filtro Apenas Coletadas
    if (onlyCollected && !col) return false;

    // 4. Filtro Repetidos (Quantidade > 1)
    if (onlyRepeated) {
      const qty = col ? (col.normal + col.shiny) : 0;
      if (qty <= 1) return false;
    }

    // 5. Filtro Shiny / Foil
    if (onlyShiny) {
      const hasShiny = col && col.shiny > 0;
      if (!hasShiny) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-3); padding: 3rem;">
        🔍 Nenhum Pokémon encontrado com estes filtros.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const col = collectedMap[p.id];
    const isCollected = !!col;
    const hasShiny = col && col.shiny > 0;
    const hasNormal = col && col.normal > 0;
    const totalQty = col ? (col.normal + col.shiny) : 0;
    const isLegendary = LEGENDARY_IDS.includes(p.id);
    const color = isCollected ? (isLegendary ? '#ff3e3e' : (TYPE_COLORS[p.types[0]] || '#6c63ff')) : '#444';
    
    const cardCls = [
      'album-card-slot',
      isCollected ? 'collected' : 'locked',
      hasShiny ? 'shiny-holo' : '',
      (isCollected && isLegendary) ? 'legendary-holo' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${cardCls}" data-id="${p.id}" style="--slot-color: ${color}; position: relative; cursor: ${isCollected ? 'pointer' : 'default'}; aspect-ratio: 2/3; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.5rem; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; transition: all 0.2s; border-top: 4px solid var(--slot-color); box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${isCollected ? '' : '<div style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); z-index:1; pointer-events: none;"></div>'}
        
        <!-- CARD HEADER -->
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 0.6rem; color: var(--text-3); z-index: 2; padding-right: ${isCollected && totalQty > 1 ? '30px' : '0'};">
          <span>#${String(p.id).padStart(3, '0')}</span>
          ${hasShiny ? '<span style="color: var(--gold); font-weight: bold;" title="Colecionado Versao Shiny! ✨"><span class="hide-mobile-label">FOIL </span>✨</span>' : isLegendary && isCollected ? '<span style="color: #ff3e3e; font-weight: 900;" title="Pokemon Lendario/Mitico! 👑"><span class="hide-mobile-label">LENDÁRIO </span>👑</span>' : ''}
        </div>

        <!-- SPRITE -->
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; max-height: 55%; margin: 0.25rem 0; z-index: 2;">
          <img src="${p.sprite}" alt="${p.displayName}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${isCollected ? 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));' : 'filter: brightness(0) opacity(0.3);'}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        </div>

        <!-- INFO -->
        <div style="text-align: center; width: 100%; z-index: 2;">
          <div style="font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${isCollected ? 'var(--text-1)' : 'var(--text-3)'}; margin-bottom: 2px;">
            ${isCollected ? p.displayName : '???'}
          </div>
          <div style="display: flex; gap: 2px; justify-content: center; opacity: ${isCollected ? 1 : 0.2}; scale: 0.8;">
            ${p.types.map(t => TypeBadge(t)).join('')}
          </div>
        </div>

        <!-- QUANTITY BADGE -->
        ${isCollected && totalQty > 1 ? `
          <div class="card-qty-badge" style="position: absolute; top: 6px; right: 6px; background: var(--slot-color); color: white; font-weight: 900; font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3); z-index: 3;">
            x${totalQty}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Bind clicks on collected cards
  grid.querySelectorAll('.album-card-slot.collected').forEach(cardSlot => {
    cardSlot.addEventListener('click', () => {
      const pId = parseInt(cardSlot.getAttribute('data-id'), 10);
      const pokemon = pokemonData.find(p => p.id === pId);
      const col = collectedMap[pId] || { normal: 0, shiny: 0 };
      openCardDetailModal(pokemon, col);
    });
  });
}

function renderBadgesList() {
  const container = document.querySelector('.album-badges-list');
  if (!container) return;

  container.innerHTML = Object.entries(BADGES_CONFIG).map(([badgeId, config]) => {
    const unlockInfo = userBadges.find(b => b.badge_id === badgeId);
    const isUnlocked = !!unlockInfo;
    const dateStr = isUnlocked ? new Date(unlockInfo.unlocked_at).toLocaleDateString('pt-BR') : '';

    return `
      <div class="album-badge-card ${isUnlocked ? 'unlocked' : 'locked'}" style="background: ${isUnlocked ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-3)'}; border: 1px solid ${isUnlocked ? '#7c3aed' : 'var(--border)'}; border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 1rem; opacity: ${isUnlocked ? 1 : 0.55}; transition: all 0.2s;">
        <div style="font-size: 2.2rem; filter: ${isUnlocked ? 'none' : 'grayscale(100%)'}; flex-shrink: 0;">
          ${config.icon}
        </div>
        <div style="flex: 1;">
          <h4 style="font-size: 0.85rem; font-weight: bold; color: ${isUnlocked ? 'var(--text-1)' : 'var(--text-3)'}; margin-bottom: 2px;">
            ${config.title}
          </h4>
          <p style="font-size: 0.7rem; color: var(--text-2); line-height: 1.3;">
            ${config.desc}
          </p>
          ${isUnlocked ? `
            <div style="font-size: 0.6rem; color: #a855f7; font-weight: bold; margin-top: 4px;">
              🔓 Desbloqueada em: ${dateStr}
            </div>
          ` : `
            <div style="font-size: 0.6rem; color: var(--text-3); font-weight: bold; margin-top: 4px;">
              🔒 Bloqueada
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function updateAlbumGold() {
  const goldEl = document.getElementById('album-gold-count');
  if (goldEl && currentUserId) {
    const savedGold = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    goldEl.textContent = savedGold ? parseInt(savedGold, 10) : 100;
  }
}

function showAlbumNotice(message) {
  const modal = document.getElementById('album-modal-wrapper');
  if (!modal) return;
  const inner = modal.querySelector('.album-modal-card');
  if (!inner) return;

  const notice = document.createElement('div');
  notice.className = 'album-toast-notice';
  notice.style.cssText = `
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: 1px solid #34d399;
    color: white;
    font-weight: bold;
    padding: 0.8rem 1.5rem;
    border-radius: 30px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    z-index: 100000;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: 0;
    text-align: center;
    font-size: 0.9rem;
    white-space: nowrap;
    max-width: 90%;
  `;
  notice.textContent = message;
  inner.appendChild(notice);

  setTimeout(() => {
    notice.style.transform = 'translateX(-50%) translateY(0)';
    notice.style.opacity = '1';
  }, 10);

  setTimeout(() => {
    notice.style.transform = 'translateX(-50%) translateY(-20px)';
    notice.style.opacity = '0';
    setTimeout(() => notice.remove(), 400);
  }, 4000);
}

function openCardDetailModal(pokemon, collection) {
  let zoomModal = document.getElementById('album-card-zoom-modal');
  if (!zoomModal) {
    zoomModal = document.createElement('div');
    zoomModal.id = 'album-card-zoom-modal';
    zoomModal.className = 'battle-modal-overlay';
    zoomModal.style.zIndex = '9999999';
    document.body.appendChild(zoomModal);
  }

  renderCardDetailModal(pokemon, collection);
  zoomModal.style.display = 'flex';
}

function closeCardDetailModal() {
  const zoomModal = document.getElementById('album-card-zoom-modal');
  if (zoomModal) {
    zoomModal.style.display = 'none';
  }
}

function renderCardDetailModal(pokemon, collection) {
  const zoomModal = document.getElementById('album-card-zoom-modal');
  if (!zoomModal) return;

  const bst = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);
  const color = TYPE_COLORS[pokemon.types[0]] || '#6c63ff';
  const hasShiny = collection.shiny > 0;
  const normalQty = collection.normal;
  const shinyQty = collection.shiny;
  const isLegendary = LEGENDARY_IDS.includes(pokemon.id);

  const savedGoldStr = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
  const userGold = savedGoldStr ? parseInt(savedGoldStr, 10) : 100;

  zoomModal.innerHTML = `
    <div class="battle-modal-inner" style="max-width: 700px; width: 95%; height: auto; max-height: 90vh; display: flex; flex-direction: row; gap: 1.5rem; padding: 1.5rem; position: relative; border: 1px solid var(--border-bright); background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(10px); border-radius: 16px; overflow-y: auto; box-sizing: border-box;" id="album-card-zoom-inner">
      <button class="modal-close" id="btn-close-zoom" style="top: 10px; right: 10px; font-size: 1.2rem;">✕</button>
      
      <!-- LEFT: 3D CARD -->
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 180px; gap: 1rem;">
        <div class="zoom-card-container" id="zoom-card-display" style="perspective: 1000px; width: 180px; height: 270px; cursor: pointer; transition: transform 0.1s ease; transform-style: preserve-3d; border-radius: var(--radius-md);">
          <div class="booster-card-flip-front ${hasShiny ? 'shiny-holo' : ''} ${isLegendary ? 'legendary-holo' : ''}" style="width: 100%; height: 100%; transform: rotateY(0deg); display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 0.8rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); --slot-color: ${color}; border-top: 5px solid var(--slot-color); position: relative; background: var(--surface); box-sizing: border-box; border-radius: var(--radius-md);">
            <!-- Shiny Holo reflection overlay -->
            ${hasShiny ? '<div class="shiny-holo-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none; z-index: 10; opacity: 0.15; border-radius: inherit;"></div>' : ''}
            
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-3); width: 100%; z-index: 2;">
              <span>#${String(pokemon.id).padStart(3, '0')}</span>
              <span style="font-weight: bold; color: ${hasShiny ? 'var(--gold)' : 'var(--text-3)'};">BST ${bst}</span>
            </div>
            
            <img src="${hasShiny ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokemon.id}.png` : pokemon.sprite}" alt="${pokemon.displayName}" style="width: 110px; height: 110px; object-fit: contain; margin: 0.5rem 0; z-index: 2; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
            
            <div style="font-size: 1rem; font-weight: bold; width: 100%; text-align: center; color: var(--text-1); z-index: 2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pokemon.displayName}</div>
            
            <div style="display: flex; gap: 4px; margin-top: 4px; z-index: 2; scale: 0.85;">
              ${pokemon.types.map(t => TypeBadge(t)).join('')}
            </div>
            
            ${hasShiny ? '<div style="font-size: 0.65rem; color: var(--gold); font-weight: bold; margin-top: 4px; animation: pulse 1s infinite; z-index: 2;">✨ SHINY FOIL ✨</div>' : isLegendary ? '<div style="font-size: 0.65rem; color: #ff3e3e; font-weight: bold; margin-top: 4px; animation: pulse 1s infinite; z-index: 2;">👑 LENDÁRIO 👑</div>' : ''}
          </div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-3); text-align: center;">Mova o mouse sobre a carta para ver o efeito 3D</div>
      </div>
      
      <!-- RIGHT: STATS & ACTIONS -->
      <div style="flex: 1.4; display: flex; flex-direction: column; gap: 0.8rem; min-width: 240px; box-sizing: border-box;">
        <h4 style="font-size: 1.1rem; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem; color: white; margin: 0;">Estatísticas & Ações</h4>
        
        <!-- Stats list -->
        <div style="display: flex; flex-direction: column; gap: 0.35rem; background: rgba(0,0,0,0.25); padding: 0.6rem 0.8rem; border-radius: 8px;">
          ${Object.entries(pokemon.stats).map(([stat, val]) => {
            const statMax = 180;
            const statPct = Math.min(100, Math.round((val / statMax) * 100));
            const statColors = {
              hp: '#10b981',
              attack: '#ef4444',
              defense: '#3b82f6',
              spAtk: '#8b5cf6',
              spDef: '#eab308',
              speed: '#ec4899'
            };
            const labels = { hp: 'HP', attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp. Atk', spDef: 'Sp. Def', speed: 'Velocidade' };
            return `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem;">
                <span style="width: 75px; color: var(--text-2); font-weight: bold;">${labels[stat]}:</span>
                <span style="width: 25px; text-align: right; font-weight: bold; color: white;">${val}</span>
                <div style="flex: 1; height: 5px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${statPct}%; height: 100%; background: ${statColors[stat] || '#aaa'}; border-radius: 3px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- Moves list -->
        <div>
          <h5 style="font-size: 0.8rem; font-weight: bold; color: var(--text-2); margin: 0 0 0.3rem 0;">Golpes Disponíveis:</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
            ${(pokemon.moves || []).slice(0, 4).map(mv => `
              <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); padding: 0.35rem; border-radius: 6px; display: flex; flex-direction: column; gap: 2px;">
                <div style="font-size: 0.7rem; font-weight: bold; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mv.displayName}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.65rem; color: var(--text-3); scale: 0.9; transform-origin: left;">
                  <span>${TypeBadge(mv.type)}</span>
                  <span>Poder: ${mv.power}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Inventory detail -->
        <div style="font-size: 0.75rem; color: var(--text-3); display: flex; gap: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.6rem; justify-content: space-between; margin-top: 0.2rem;">
          <span>Versão Normal: <b>${normalQty}x</b></span>
          <span>Versão Shiny: <b>${shinyQty}x</b></span>
        </div>
        
        <!-- Actions panel -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.6rem; box-sizing: border-box; width: 100%;">
          
          <!-- Reciclar Normal card -->
          ${normalQty > 0 ? `
            <button class="btn-primary" id="btn-recycle-normal" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; padding: 0.55rem; font-size: 0.8rem; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; border-radius: 8px;">
              ♻️ ${normalQty > 1 ? 'Reciclar Duplicada Comum (+15 Gold)' : 'Desencantar Última Comum (+15 Gold)'}
            </button>
          ` : ''}
          
          <!-- Reciclar Shiny card -->
          ${shinyQty > 0 ? `
            <button class="btn-primary" id="btn-recycle-shiny" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; padding: 0.55rem; font-size: 0.8rem; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; border-radius: 8px;">
              ♻️ ${shinyQty > 1 ? 'Reciclar Duplicada Shiny (+75 Gold)' : 'Desencantar Última Shiny (+75 Gold)'}
            </button>
          ` : ''}
          
          <!-- Upgrade normal to shiny -->
          ${normalQty > 0 ? `
            <button class="btn-primary" id="btn-upgrade-shiny" ${userGold < 300 ? 'disabled' : ''} style="background: ${userGold < 300 ? 'var(--border)' : 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'}; border: none; color: ${userGold < 300 ? 'var(--text-3)' : 'white'}; cursor: ${userGold < 300 ? 'not-allowed' : 'pointer'}; padding: 0.55rem; font-size: 0.8rem; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px;">
              ✨ Evoluir para Shiny Foil (Custo: 300 Gold)
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Bind close event
  document.getElementById('btn-close-zoom').addEventListener('click', closeCardDetailModal);

  // Bind action events
  const normalRecycleBtn = document.getElementById('btn-recycle-normal');
  const shinyRecycleBtn = document.getElementById('btn-recycle-shiny');
  const upgradeBtn = document.getElementById('btn-upgrade-shiny');

  if (normalRecycleBtn) {
    normalRecycleBtn.addEventListener('click', () => handleRecycleCard(pokemon, false));
  }
  if (shinyRecycleBtn) {
    shinyRecycleBtn.addEventListener('click', () => handleRecycleCard(pokemon, true));
  }
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => handleUpgradeCard(pokemon));
  }

  // Bind 3D mouse tilt events
  const cardEl = document.getElementById('zoom-card-display');
  if (cardEl) {
    cardEl.addEventListener('mousemove', (e) => {
      const rect = cardEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -15; // Max 15 deg
      const rotateY = ((x - centerX) / centerX) * 15;
      
      const cardFront = cardEl.querySelector('.booster-card-flip-front');
      if (cardFront) {
        cardFront.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      }
      
      const holoOverlay = cardEl.querySelector('.shiny-holo-overlay');
      if (holoOverlay) {
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        holoOverlay.style.backgroundPosition = `${px}% ${py}%`;
        holoOverlay.style.opacity = '0.35';
      }
    });

    cardEl.addEventListener('mouseleave', () => {
      const cardFront = cardEl.querySelector('.booster-card-flip-front');
      if (cardFront) {
        cardFront.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
      }
      
      const holoOverlay = cardEl.querySelector('.shiny-holo-overlay');
      if (holoOverlay) {
        holoOverlay.style.backgroundPosition = `50% 50%`;
        holoOverlay.style.opacity = '0.15';
      }
    });
  }
}

async function handleRecycleCard(pokemon, isShiny) {
  try {
    const goldEarned = isShiny ? 75 : 15;
    
    // 1. Busca carta no banco
    const { data: card, error: fetchErr } = await supabase
      .from('user_cards')
      .select('id, quantity')
      .eq('user_id', currentUserId)
      .eq('pokemon_id', pokemon.id)
      .eq('is_shiny', isShiny)
      .single();
      
    if (fetchErr) throw fetchErr;
    if (!card || card.quantity <= 0) return; // Segurança

    const isLastCopy = (card.quantity <= 1);
    if (isLastCopy) {
      const confirmDelete = confirm(`⚠️ Você está prestes a desencantar sua ÚLTIMA cópia de ${pokemon.displayName} (${isShiny ? 'Shiny' : 'Comum'}). Se fizer isso, perderá a carta e ela sumirá do seu álbum! Deseja continuar?`);
      if (!confirmDelete) return;
    }

    // 2. Decrementa quantidade ou deleta se for a última
    if (!isLastCopy) {
      const { error: updateErr } = await supabase
        .from('user_cards')
        .update({ quantity: card.quantity - 1 })
        .eq('id', card.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: deleteErr } = await supabase
        .from('user_cards')
        .delete()
        .eq('id', card.id);
      if (deleteErr) throw deleteErr;
    }

    // 3. Atualiza Gold no localStorage
    const savedGoldStr = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    let currentGold = savedGoldStr ? parseInt(savedGoldStr, 10) : 100;
    currentGold += goldEarned;
    localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(currentGold));

    // 4. Recarrega dados e atualiza UI
    await loadCollectionData();
    updateAlbumGold();
    
    // Atualiza a visualização do modal de detalhes
    const col = { normal: 0, shiny: 0 };
    userCards.forEach(c => {
      if (c.pokemon_id === pokemon.id) {
        if (c.is_shiny) col.shiny += c.quantity;
        else col.normal += c.quantity;
      }
    });

    if (col.normal === 0 && col.shiny === 0) {
      closeCardDetailModal();
    } else {
      renderCardDetailModal(pokemon, col);
    }
    
    // Atualiza grid do álbum de fundo
    renderAlbumContent();
    
    showAlbumNotice(`♻️ Carta reciclada! Você ganhou +${goldEarned} Gold.`);
  } catch (err) {
    console.error('Erro ao reciclar carta:', err);
    alert('Erro ao reciclar carta. Tente novamente.');
  }
}

async function handleUpgradeCard(pokemon) {
  try {
    const upgradeCost = 300;
    const savedGoldStr = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    let currentGold = savedGoldStr ? parseInt(savedGoldStr, 10) : 100;
    
    if (currentGold < upgradeCost) return; // Segurança

    // 1. Busca carta normal do banco
    const { data: normalCard, error: normalErr } = await supabase
      .from('user_cards')
      .select('id, quantity')
      .eq('user_id', currentUserId)
      .eq('pokemon_id', pokemon.id)
      .eq('is_shiny', false)
      .single();
      
    if (normalErr) throw normalErr;
    if (!normalCard) return;

    // 2. Decrementa normal (ou deleta se for a última)
    if (normalCard.quantity > 1) {
      await supabase
        .from('user_cards')
        .update({ quantity: normalCard.quantity - 1 })
        .eq('id', normalCard.id);
    } else {
      await supabase
        .from('user_cards')
        .delete()
        .eq('id', normalCard.id);
    }

    // 3. Incrementa ou insere versão Shiny
    const { data: shinyCard } = await supabase
      .from('user_cards')
      .select('id, quantity')
      .eq('user_id', currentUserId)
      .eq('pokemon_id', pokemon.id)
      .eq('is_shiny', true)
      .maybeSingle();

    if (shinyCard) {
      await supabase
        .from('user_cards')
        .update({ quantity: shinyCard.quantity + 1 })
        .eq('id', shinyCard.id);
    } else {
      await supabase
        .from('user_cards')
        .insert({
          user_id: currentUserId,
          pokemon_id: pokemon.id,
          is_shiny: true,
          quantity: 1
        });
    }

    // 4. Deduz Gold
    currentGold -= upgradeCost;
    localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(currentGold));

    // 5. Recarrega dados e atualiza UI
    await loadCollectionData();
    updateAlbumGold();
    
    // Atualiza a visualização do modal de detalhes
    const col = { normal: 0, shiny: 0 };
    userCards.forEach(c => {
      if (c.pokemon_id === pokemon.id) {
        if (c.is_shiny) col.shiny += c.quantity;
        else col.normal += c.quantity;
      }
    });
    renderCardDetailModal(pokemon, col);
    
    // Atualiza grid do álbum de fundo
    renderAlbumContent();
    
    showAlbumNotice(`✨ Evolução concluída! Pokémon transformado em Shiny Foil.`);
  } catch (err) {
    console.error('Erro ao evoluir carta:', err);
    alert('Erro ao realizar o upgrade de carta. Tente novamente.');
  }
}
