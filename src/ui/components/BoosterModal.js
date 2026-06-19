// src/ui/components/BoosterModal.js
import { supabase } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';

let modalContainer = null;
let currentUserId = null;
let currentUsername = 'Treinador';
let onUpdateCountCallback = null;

// Lista de IDs de Pokémon considerados Raros (BST >= 500 ou lendários)
const RARE_POKEMON_IDS = pokemonData.filter(p => {
  const bst = Object.values(p.stats).reduce((a, b) => a + b, 0);
  return bst >= 500 || [150, 248, 384, 483, 487, 491].includes(p.id);
}).map(p => p.id);

// IDs de Comuns / Incomuns (o restante)
const COMMON_POKEMON_IDS = pokemonData.filter(p => !RARE_POKEMON_IDS.includes(p.id)).map(p => p.id);

export function initBoosterModal(container, userId, username, onUpdateCount) {
  modalContainer = container;
  currentUserId = userId;
  currentUsername = username || 'Treinador';
  onUpdateCountCallback = onUpdateCount;
}

export async function openBoosterModal() {
  if (!currentUserId) return;

  let modal = document.getElementById('booster-modal-wrapper');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'booster-modal-wrapper';
    modal.className = 'battle-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="battle-modal-card booster-modal-card" style="max-width: 600px; width: 95%;">
      <div class="battle-modal-header">
        <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
        <button class="battle-modal-close" id="btn-close-booster">✕</button>
      </div>
      <div class="booster-loading-state" style="text-align: center; padding: 3rem;">
        <span class="loading-spinner">⌛</span> Verificando seus pacotes de booster...
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  document.getElementById('btn-close-booster').addEventListener('click', closeBoosterModal);

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('boosters_count')
      .eq('id', currentUserId)
      .single();

    if (error) throw error;
    const boostersCount = profile?.boosters_count || 0;
    renderBoosterScreen(boostersCount);
  } catch (err) {
    console.error('Erro ao buscar quantidade de boosters:', err);
    modal.querySelector('.booster-loading-state').innerHTML = `
      <span style="color:var(--danger);">❌ Erro ao conectar. Certifique-se de que rodou o SQL do schema.</span>
    `;
  }
}

export function closeBoosterModal() {
  const modal = document.getElementById('booster-modal-wrapper');
  if (modal) {
    modal.style.display = 'none';
  }
}

function renderBoosterScreen(count) {
  const modal = document.getElementById('booster-modal-wrapper');
  if (!modal) return;

  const card = modal.querySelector('.booster-modal-card');

  if (count <= 0) {
    card.innerHTML = `
      <div class="battle-modal-header">
        <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
        <button class="battle-modal-close" id="btn-close-booster">✕</button>
      </div>
      <div style="text-align: center; padding: 3rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div style="font-size: 3.5rem;">📦🚫</div>
        <h4 style="font-weight: bold; font-size: 1.1rem; color: var(--text-2);">Nenhum Booster Disponível</h4>
        <p style="font-size: 0.85rem; color: var(--text-3); max-width: 320px;">
          Você não tem pacotes de booster acumulados. Ganhe a Grande Final de torneios para receber pacotes!
        </p>
        <button class="btn-primary" id="btn-ok-no-booster" style="margin-top: 1rem; padding: 0.6rem 2rem;">Confirmar</button>
      </div>
    `;
    document.getElementById('btn-close-booster').addEventListener('click', closeBoosterModal);
    document.getElementById('btn-ok-no-booster').addEventListener('click', closeBoosterModal);
    return;
  }

  card.innerHTML = `
    <div class="battle-modal-header">
      <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
      <button class="battle-modal-close" id="btn-close-booster">✕</button>
    </div>
    
    <div class="booster-content" style="display: flex; flex-direction: column; align-items: center; gap: 2rem; padding: 2rem 1rem; text-align: center;">
      <div style="font-weight: bold; color: var(--gold);">Pacotes Disponíveis: ${count}</div>

      <!-- BOOSTER ENVELOPE CONTAINER -->
      <div class="booster-pack-container" id="booster-pack-graphic">
        <div class="booster-pack">
          <div class="booster-pack-design">
            <div class="booster-pack-header">POKÉCHAMPION</div>
            <div class="booster-pack-logo">🎒</div>
            <div class="booster-pack-footer">CONTEÚDO: 3 CARTAS</div>
            <div class="booster-pack-stripe"></div>
            <div class="booster-pack-shine"></div>
          </div>
        </div>
      </div>

      <button class="btn-primary" id="btn-open-pack" style="padding: 0.8rem 2.5rem; font-size: 1rem; font-weight: bold; background: linear-gradient(135deg, #d946ef 0%, #7c3aed 100%); border: none;">
        🔓 ABRIR PACOTE
      </button>
    </div>
  `;

  document.getElementById('btn-close-booster').addEventListener('click', closeBoosterModal);
  
  const openBtn = document.getElementById('btn-open-pack');
  openBtn.addEventListener('click', () => openSinglePack(count));
}

async function openSinglePack(currentCount) {
  const openBtn = document.getElementById('btn-open-pack');
  if (openBtn) openBtn.disabled = true;

  const packGraphic = document.getElementById('booster-pack-graphic');
  if (packGraphic) {
    packGraphic.classList.add('booster-shaking');
  }

  try {
    // 1. Reduz boosters no banco
    const nextCount = currentCount - 1;
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ boosters_count: nextCount })
      .eq('id', currentUserId);

    if (updateErr) throw updateErr;

    // Atualiza o contador na tela principal através do callback
    if (onUpdateCountCallback) {
      onUpdateCountCallback(nextCount);
    }

    // 2. Sorteia 3 Pokémons: 1 Rara garantida + 2 Comuns
    const chosenList = [];
    
    // Sorteia Rara
    const rareId = RARE_POKEMON_IDS[Math.floor(Math.random() * RARE_POKEMON_IDS.length)];
    chosenList.push(createCardDraw(rareId));

    // Sorteia 2 Comuns
    for (let i = 0; i < 2; i++) {
      const commonId = COMMON_POKEMON_IDS[Math.floor(Math.random() * COMMON_POKEMON_IDS.length)];
      chosenList.push(createCardDraw(commonId));
    }

    // 3. Grava no banco de dados e aguarda
    for (const card of chosenList) {
      const { data: existing } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', currentUserId)
        .eq('pokemon_id', card.pokemon.id)
        .eq('is_shiny', card.isShiny)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_cards')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_cards')
          .insert({
            user_id: currentUserId,
            pokemon_id: card.pokemon.id,
            is_shiny: card.isShiny,
            quantity: 1
          });
      }
    }

    // Animação de rasgar e transição de revelação
    setTimeout(() => {
      if (packGraphic) {
        packGraphic.classList.remove('booster-shaking');
        packGraphic.classList.add('booster-ripping');
      }

      setTimeout(() => {
        renderRevealedCards(chosenList, nextCount);
      }, 600);
    }, 1200);

  } catch (err) {
    console.error('Erro ao abrir booster:', err);
    if (openBtn) openBtn.disabled = false;
    if (packGraphic) packGraphic.classList.remove('booster-shaking');
    alert('Erro ao processar a abertura. Tente novamente.');
  }
}

function createCardDraw(pokemonId) {
  const pokemon = pokemonData.find(p => p.id === pokemonId);
  // 2% de chance de virar Shiny (Foil)
  const isShiny = Math.random() < 0.02;
  
  // Customiza dados de exibição do sprite se for shiny
  let sprite = pokemon.sprite;
  if (isShiny) {
    sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokemon.id}.png`;
  }

  return {
    pokemon: {
      ...pokemon,
      sprite: sprite
    },
    isShiny
  };
}

function renderRevealedCards(cardsList, nextCount) {
  const modal = document.getElementById('booster-modal-wrapper');
  if (!modal) return;

  const card = modal.querySelector('.booster-modal-card');

  card.innerHTML = `
    <div class="battle-modal-header">
      <h3 class="battle-modal-title">🃏 Cartas Reveladas!</h3>
    </div>
    
    <div class="booster-reveal-view" style="display: flex; flex-direction: column; align-items: center; gap: 2rem; padding: 1.5rem 0.5rem; text-align: center;">
      <div style="font-size: 0.85rem; color: var(--text-2);">Clique nas cartas para revelá-las!</div>

      <!-- CARDS LIST -->
      <div class="booster-cards-reveal-grid" style="display: flex; gap: 1.5rem; justify-content: center; width: 100%; flex-wrap: wrap;">
        ${cardsList.map((cardDraw, idx) => {
          const p = cardDraw.pokemon;
          const isShiny = cardDraw.isShiny;
          const bst = Object.values(p.stats).reduce((a, b) => a + b, 0);
          const color = TYPE_COLORS[p.types[0]] || '#6c63ff';

          return `
            <div class="booster-card-flip-container" data-idx="${idx}">
              <div class="booster-card-flip-inner">
                <!-- CARD BACK -->
                <div class="booster-card-flip-back">
                  <div class="card-back-pattern">
                    <div class="card-back-center-ball">🎒</div>
                  </div>
                </div>
                <!-- CARD FRONT -->
                <div class="booster-card-flip-front ${isShiny ? 'shiny-holo' : ''}" style="--slot-color: ${color}; border-top: 4px solid var(--slot-color);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--text-3); width: 100%;">
                    <span>#${String(p.id).padStart(3, '0')}</span>
                    <span style="font-weight: bold; color: ${isShiny ? 'var(--gold)' : 'var(--text-3)'};">BST ${bst}</span>
                  </div>
                  <img src="${p.sprite}" alt="${p.displayName}" style="width: 75px; height: 75px; object-fit: contain; margin: 0.2rem 0;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
                  <div style="font-size: 0.8rem; font-weight: bold; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-1);">${p.displayName}</div>
                  <div style="display: flex; gap: 2px; margin-top: 2px; scale: 0.75;">
                    ${p.types.map(t => TypeBadge(t)).join('')}
                  </div>
                  ${isShiny ? '<div style="font-size: 0.55rem; color: var(--gold); font-weight: bold; margin-top: 4px; animation: pulse 1s infinite;">✨ FOIL SHINY ✨</div>' : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="booster-reveal-actions" style="display: flex; gap: 1rem; width: 100%; justify-content: center; margin-top: 1rem;">
        <button class="btn-primary" id="btn-next-action" style="padding: 0.6rem 2rem; display: none;"></button>
      </div>
    </div>
  `;

  const containers = card.querySelectorAll('.booster-card-flip-container');
  let flippedCount = 0;

  containers.forEach(container => {
    container.addEventListener('click', () => {
      if (container.classList.contains('flipped')) return;
      container.classList.add('flipped');
      flippedCount++;

      if (flippedCount === cardsList.length) {
        showRevealEndActions(nextCount);
      }
    });
  });
}

function showRevealEndActions(nextCount) {
  const nextBtn = document.getElementById('btn-next-action');
  if (!nextBtn) return;

  if (nextCount > 0) {
    nextBtn.textContent = `📦 ABRIR OUTRO (${nextCount})`;
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => {
      renderBoosterScreen(nextCount);
    };
  } else {
    nextBtn.textContent = '📚 CONCLUIR';
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => {
      closeBoosterModal();
    };
  }
}
