import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';

let tooltipEl = null;

export function initTooltipSystem() {
  if (tooltipEl) return;

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'global-tooltip';
  document.body.appendChild(tooltipEl);

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('mousemove', handleMouseMove);
}

function handleMouseOver(e) {
  const target = e.target.closest('[data-tooltip-info]');
  if (!target) return;

  try {
    const raw = target.getAttribute('data-tooltip-info');
    // Sanitize string to prevent issues
    const info = JSON.parse(raw.replace(/&quot;/g, '"'));
    if (!info) return;

    renderTooltip(info);
    tooltipEl.classList.add('visible');
  } catch (err) {
    console.error('Failed to parse tooltip info', err);
  }
}

function handleMouseOut(e) {
  if (tooltipEl.classList.contains('visible')) {
    tooltipEl.classList.remove('visible');
  }
}

function handleMouseMove(e) {
  if (!tooltipEl.classList.contains('visible')) return;

  const rect = tooltipEl.getBoundingClientRect();
  const offset = 15;
  
  let left = e.clientX + offset;
  let top = e.clientY + offset;

  // Prevent overflow
  if (left + rect.width > window.innerWidth) {
    left = e.clientX - rect.width - offset;
  }
  if (top + rect.height > window.innerHeight) {
    top = window.innerHeight - rect.height - offset;
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function renderTooltip(pokemon) {
  // Check if it's an item or pokemon
  if (pokemon.description && !pokemon.stats) {
    // It's an item
    tooltipEl.innerHTML = `
      <div class="tooltip-item" style="display: flex; align-items: center;">
        <div style="font-size: 2rem;">${pokemon.icon}</div>
        <div style="margin-left: 0.5rem;">
          <h4 style="margin: 0;">${pokemon.displayName}</h4>
          <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-2);">${pokemon.description}</p>
        </div>
      </div>
    `;
    return;
  }

  // It's a pokemon
  const bst = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);
  
  tooltipEl.innerHTML = `
    <div class="tooltip-header" style="display: flex; align-items: center; gap: 0.5rem;">
      <img src="${pokemon.sprite}" width="40" height="40" style="object-fit: contain;">
      <div>
        <h4 style="margin:0;">${pokemon.displayName} ${pokemon.isShiny ? '✨' : ''}</h4>
        <div style="font-size: 0.75rem; color: var(--text-2);">
          ${pokemon.types.map(t => `${TYPE_ICONS[t]} ${t.toUpperCase()}`).join(' / ')} | BST ${bst}
        </div>
      </div>
    </div>
    <div class="tooltip-stats" style="margin-top: 0.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.2rem; font-size: 0.75rem;">
      <div>HP: <b style="color:var(--text-1)">${pokemon.stats.hp}</b></div>
      <div>ATK: <b style="color:var(--text-1)">${pokemon.stats.attack}</b></div>
      <div>DEF: <b style="color:var(--text-1)">${pokemon.stats.defense}</b></div>
      <div>SPA: <b style="color:var(--text-1)">${pokemon.stats.spAtk}</b></div>
      <div>SPD: <b style="color:var(--text-1)">${pokemon.stats.speed}</b></div>
    </div>
    <div class="tooltip-moves" style="margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
      ${pokemon.moves.map(m => `
        <div style="display:flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.2rem;">
          <span><span style="color:${TYPE_COLORS[m.type]}">${TYPE_ICONS[m.type]}</span> ${m.displayName}</span>
          <span style="color:var(--text-3);">${m.power || '-'}</span>
        </div>
      `).join('')}
    </div>
  `;
}
