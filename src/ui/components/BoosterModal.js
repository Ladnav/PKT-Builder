// src/ui/components/BoosterModal.js
import { supabase } from '../../lib/supabase.js';
import pokemonData from '../../data/pokemon-sample.json';
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';
import { playSFX } from '../../lib/sounds.js';

export function PokeballIcon(size = 50) {
  const borderSize = Math.max(2, Math.round(size * 0.06));
  const centerSize = Math.round(size * 0.32);
  const innerSize = Math.round(centerSize * 0.4);
  
  return `
    <div class="pokeball-css" style="position: relative; width: ${size}px; height: ${size}px; background: white; border: ${borderSize}px solid #000; border-radius: 50%; overflow: hidden; box-shadow: inset -${Math.round(size*0.1)}px -${Math.round(size*0.1)}px 0px rgba(0,0,0,0.15); display: inline-block; vertical-align: middle;">
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 50%; background: #ff3e3e; border-bottom: ${borderSize}px solid #000;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${centerSize}px; height: ${centerSize}px; background: white; border: ${borderSize}px solid #000; border-radius: 50%; z-index: 2; display: flex; align-items: center; justify-content: center;">
        <div style="width: ${innerSize}px; height: ${innerSize}px; background: white; border: 1px solid #777; border-radius: 50%;"></div>
      </div>
    </div>
  `;
}

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
    <div class="battle-modal-inner booster-modal-card" style="max-width: 600px; width: 95%; max-height: 85vh; height: auto; position: relative; display: flex; flex-direction: column;">
      <button class="modal-close" id="btn-close-booster">✕</button>
      <div class="battle-modal-header" style="padding-right: 3.5rem; flex-shrink: 0;">
        <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
      </div>
      <div class="booster-loading-state" style="text-align: center; padding: 3rem; flex: 1; overflow-y: auto;">
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
      <button class="modal-close" id="btn-close-booster">✕</button>
      <div class="battle-modal-header" style="padding-right: 3.5rem; flex-shrink: 0;">
        <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
      </div>
      <div style="text-align: center; padding: 3rem 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; flex: 1; overflow-y: auto;">
        <div style="font-size: 3.5rem;">📦🚫</div>
        <h4 style="font-weight: bold; font-size: 1.1rem; color: var(--text-2);">Nenhum Booster Disponível</h4>
        <p style="font-size: 0.85rem; color: var(--text-3); max-width: 320px;">
          Você não tem pacotes de booster acumulados. Ganhe a Grande Final de torneios para receber pacotes!
        </p>
        <button class="btn-primary" id="btn-ok-no-booster" style="margin-top: 1rem; padding: 0.6rem 2rem; flex-shrink: 0;">Confirmar</button>
      </div>
    `;
    document.getElementById('btn-close-booster').addEventListener('click', closeBoosterModal);
    document.getElementById('btn-ok-no-booster').addEventListener('click', closeBoosterModal);
    return;
  }

  card.innerHTML = `
    <button class="modal-close" id="btn-close-booster">✕</button>
    <div class="battle-modal-header" style="padding-right: 3.5rem; flex-shrink: 0;">
      <h3 class="battle-modal-title">📦 Abertura de Booster Packs</h3>
    </div>
    
    <div class="booster-content" style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; padding: 1.5rem 1rem; text-align: center; overflow-y: auto; flex: 1; width: 100%; box-sizing: border-box;">
      <div style="font-weight: bold; color: var(--gold); flex-shrink: 0;">Pacotes Disponíveis: ${count}</div>

      <!-- BOOSTER ENVELOPE CONTAINER -->
      <div class="booster-pack-container" id="booster-pack-graphic" style="flex-shrink: 0;">
        <div class="booster-pack">
          <!-- METADE SUPERIOR -->
          <div class="booster-pack-half booster-pack-top">
            <div class="booster-crimp booster-crimp-top"></div>
            <div class="booster-pack-content-top">
              <div class="booster-pack-header">POKÉCHAMPION</div>
            </div>
          </div>
          <!-- METADE INFERIOR -->
          <div class="booster-pack-half booster-pack-bottom">
            <div class="booster-pack-content-bottom">
              <div class="booster-pack-logo">${PokeballIcon(60)}</div>
              <div class="booster-pack-footer">CONTEÚDO: 3 CARTAS</div>
              <div class="booster-pack-stripe"></div>
            </div>
            <div class="booster-crimp booster-crimp-bottom"></div>
          </div>
          <!-- SHINE EFFECT OVERLAY -->
          <div class="booster-pack-shine"></div>
        </div>
      </div>

      <button class="btn-primary" id="btn-open-pack" style="padding: 0.8rem 2.5rem; font-size: 1rem; font-weight: bold; background: linear-gradient(135deg, #d946ef 0%, #7c3aed 100%); border: none; flex-shrink: 0; margin-bottom: 0.5rem;">
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
      const isShinyForDB = card.isShiny || card.isFoil;
      const { data: existing } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', currentUserId)
        .eq('pokemon_id', card.pokemon.id)
        .eq('is_shiny', isShinyForDB)
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
            is_shiny: isShinyForDB,
            quantity: 1
          });
      }
    }

    // Sorteia Gold extra no booster (15 a 25 gold)
    const boosterGold = 15 + Math.floor(Math.random() * 11); // 15 a 25
    const savedGoldStr = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    let userGold = savedGoldStr ? parseInt(savedGoldStr, 10) : 100;
    userGold += boosterGold;
    localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(userGold));

    // Animação de rasgar e transição de revelação
    setTimeout(() => {
      if (packGraphic) {
        packGraphic.classList.remove('booster-shaking');
        packGraphic.classList.add('booster-ripping');
      }

      playSFX('boosterOpen');

      setTimeout(() => {
        renderRevealedCards(chosenList, nextCount, boosterGold);
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
  
  // Raridades:
  // Normal: 90% (isShiny = false, isFoil = false, rarity = 'normal')
  // Foil: 6% (isShiny = false, isFoil = true, rarity = 'foil')
  // Shiny: 3% (isShiny = true, isFoil = false, rarity = 'shiny')
  // Shiny Foiled: 1% (isShiny = true, isFoil = true, rarity = 'shiny-foiled')
  
  const rand = Math.random();
  let isShiny = false;
  let isFoil = false;
  let rarity = 'normal';
  
  if (rand < 0.01) {
    isShiny = true;
    isFoil = true;
    rarity = 'shiny-foiled';
  } else if (rand < 0.04) {
    isShiny = true;
    isFoil = false;
    rarity = 'shiny';
  } else if (rand < 0.10) {
    isShiny = false;
    isFoil = true;
    rarity = 'foil';
  }
  
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
    isShiny,
    isFoil,
    rarity
  };
}

function renderRevealedCards(cardsList, nextCount, goldGained = 0) {
  const modal = document.getElementById('booster-modal-wrapper');
  if (!modal) return;

  const card = modal.querySelector('.booster-modal-card');

  card.innerHTML = `
    <div class="battle-modal-header" style="flex-shrink: 0;">
      <h3 class="battle-modal-title">🃏 Cartas Reveladas!</h3>
    </div>
    
    <div class="booster-reveal-view" style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; padding: 1rem 0.5rem; text-align: center; overflow-y: auto; flex: 1; width: 100%; box-sizing: border-box;">
      <div style="font-size: 0.85rem; color: var(--text-2); flex-shrink: 0;">
        Clique nas cartas para revelá-las!
        ${goldGained > 0 ? `<div style="margin-top: 0.4rem; color: #fbbf24; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 4px;">🪙 Você ganhou +${goldGained} Gold!</div>` : ''}
      </div>

      <!-- CARDS LIST -->
      <div class="booster-cards-reveal-grid" style="display: flex; gap: 1.5rem; justify-content: center; width: 100%; flex-wrap: wrap;">
        ${cardsList.map((cardDraw, idx) => {
          const p = cardDraw.pokemon;
          const isShiny = cardDraw.isShiny;
          const isFoil = cardDraw.isFoil;
          const bst = Object.values(p.stats).reduce((a, b) => a + b, 0);
          const color = TYPE_COLORS[p.types[0]] || '#6c63ff';
          
          let badgeHtml = '';
          if (cardDraw.rarity === 'foil') {
            badgeHtml = '<div style="font-size: 0.55rem; color: #3b82f6; font-weight: bold; margin-top: 4px; animation: pulse 1s infinite;">✨ FOIL ✨</div>';
          } else if (cardDraw.rarity === 'shiny') {
            badgeHtml = '<div style="font-size: 0.55rem; color: #a855f7; font-weight: bold; margin-top: 4px; animation: pulse 1s infinite;">✨ SHINY ✨</div>';
          } else if (cardDraw.rarity === 'shiny-foiled') {
            badgeHtml = '<div style="font-size: 0.55rem; color: var(--gold); font-weight: bold; margin-top: 4px; animation: pulse 1s infinite;">✨ FOIL SHINY ✨</div>';
          }

          const hasHolo = isShiny || isFoil;

          return `
            <div class="booster-card-flip-container rarity-${cardDraw.rarity}" data-idx="${idx}">
              <div class="booster-card-flip-inner">
                <!-- CARD BACK -->
                <div class="booster-card-flip-back">
                  <div class="card-back-pattern">
                    <div class="card-back-center-ball" style="display: flex; align-items: center; justify-content: center;">${PokeballIcon(45)}</div>
                  </div>
                </div>
                <!-- CARD FRONT -->
                <div class="booster-card-flip-front ${hasHolo ? 'shiny-holo' : ''}" style="--slot-color: ${color}; border-top: 4px solid var(--slot-color);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--text-3); width: 100%;">
                    <span>#${String(p.id).padStart(3, '0')}</span>
                    <span style="font-weight: bold; color: ${hasHolo ? 'var(--gold)' : 'var(--text-3)'};">BST ${bst}</span>
                  </div>
                  <img src="${p.sprite}" alt="${p.displayName}" style="width: 75px; height: 75px; object-fit: contain; margin: 0.2rem 0;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
                  <div style="font-size: 0.8rem; font-weight: bold; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-1);">${p.displayName}</div>
                  <div style="display: flex; gap: 2px; margin-top: 2px; scale: 0.75;">
                    ${p.types.map(t => TypeBadge(t)).join('')}
                  </div>
                  ${badgeHtml}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="booster-reveal-actions" style="display: flex; gap: 1rem; width: 100%; justify-content: center; margin-top: 0.5rem; flex-shrink: 0; padding-bottom: 0.5rem;">
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

      const idx = parseInt(container.getAttribute('data-idx'));
      const cardDraw = cardsList[idx];
      if (cardDraw && (cardDraw.isShiny || cardDraw.isFoil)) {
        playSFX('shiny');
      } else {
        playSFX('cardFlip');
      }

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
