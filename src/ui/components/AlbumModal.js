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

  card.innerHTML = `
    <button class="modal-close" id="btn-close-album">✕</button>
    <div class="battle-modal-header" style="padding-right: 3.5rem;">
      <h3 class="battle-modal-title">📚 Coleção e Álbum de Cartas</h3>
    </div>
    
    <div class="album-layout" style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem; max-height: 80vh; overflow-y: auto;">
      
      <!-- PROGRESS BAR -->
      <div class="album-progress-box" style="background: var(--bg-3); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
            <span>Progresso da Coleção: ${uniqueCount} / ${pokemonData.length} Pokémon</span>
            <span style="color: var(--gold);">${progressPercent}%</span>
          </div>
          <div style="background: rgba(255,255,255,0.08); height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03);">
            <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #7c3aed 0%, #d946ef 100%); border-radius: 5px; transition: width 0.3s ease;"></div>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
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
            <option value="fairy">✨ Fada</option>
          </select>

          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; user-select: none;">
            <input type="checkbox" id="album-filter-collected"> Apenas Coletadas
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

  const filterAction = () => {
    updateFilteredCards(collectedMap, searchInput.value, typeSelect.value, collectedCheck.checked);
  };

  searchInput.addEventListener('input', filterAction);
  typeSelect.addEventListener('change', filterAction);
  collectedCheck.addEventListener('change', filterAction);

  // Render inicial dos dados nas abas
  updateFilteredCards(collectedMap, '', 'all', false);
  renderBadgesList();
}

function updateFilteredCards(collectedMap, search, typeFilter, onlyCollected) {
  const grid = document.querySelector('.album-cards-grid');
  if (!grid) return;

  const filtered = pokemonData.filter(p => {
    // 1. Filtro busca
    if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    
    // 2. Filtro Tipo
    if (typeFilter !== 'all' && !p.types.includes(typeFilter)) return false;
    
    // 3. Filtro Apenas Coletadas
    if (onlyCollected && !collectedMap[p.id]) return false;

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
      <div class="${cardCls}" style="--slot-color: ${color}; position: relative; aspect-ratio: 2/3; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.5rem; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; transition: all 0.2s; border-top: 4px solid var(--slot-color); box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${isCollected ? '' : '<div style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); z-index:1; pointer-events: none;"></div>'}
        
        <!-- CARD HEADER -->
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 0.6rem; color: var(--text-3); z-index: 2;">
          <span>#${String(p.id).padStart(3, '0')}</span>
          ${hasShiny ? '<span style="color: var(--gold); font-weight: bold;" title="Colecionado Versao Shiny! ✨">FOIL ✨</span>' : isLegendary && isCollected ? '<span style="color: #ff3e3e; font-weight: 900;" title="Pokemon Lendario/Mitico! 👑">LENDÁRIO 👑</span>' : ''}
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
          <div class="card-qty-badge" style="position: absolute; bottom: 6px; right: 6px; background: var(--slot-color); color: white; font-weight: 900; font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3); z-index: 3;">
            x${totalQty}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
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
