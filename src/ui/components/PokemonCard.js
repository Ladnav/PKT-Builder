// src/ui/components/PokemonCard.js
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';
import pokemonData from '../../data/pokemon-sample.json';

export function getPokemonCost(pokemon) {
  if (!pokemon) return 0;
  const basePoke = pokemonData.find(p => p.id === pokemon.id) || pokemon;
  if (!basePoke || !basePoke.stats) return 0;
  const bst = Object.values(basePoke.stats).reduce((sum, val) => sum + val, 0);
  let cost = 0;
  if (bst >= 670) cost = 5;
  else if (bst >= 580) cost = 4;
  else if (bst >= 520) cost = 3;
  else if (bst >= 470) cost = 2;
  else if (bst >= 400) cost = 1;
  else cost = 0;

  if (pokemon.isShiny) {
    cost += 1;
  }
  return cost;
}

export function getItemIconHtml(item, size = 16) {
  if (!item) return '';
  const name = item.name || '';
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
  return `<img src="${spriteUrl}" alt="${item.displayName}" class="item-sprite-icon" style="width: ${size}px; height: ${size}px; object-fit: contain; vertical-align: middle; image-rendering: pixelated;" onerror="this.outerHTML='${item.icon || '🎒'}'">`;
}

// Card completo do Pokémon para o draft
export function PokemonCard(pokemon, options = {}) {
  const { selectable = false, selected = false, small = false, showStats = true, showCost = false } = options;
  const bst = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);
  const gradColor = TYPE_COLORS[pokemon.types[0]] || '#6c63ff';
  const cls = [
    'pokemon-card',
    selectable ? 'selectable' : '',
    selected ? 'selected' : '',
    small ? 'pokemon-card-sm' : '',
    pokemon.isShiny ? 'shiny shiny-holo' : ''
  ].filter(Boolean).join(' ');

  const statsHtml = showStats ? `
    <div class="card-stats">
      <div class="stat-row"><span>HP</span><div class="stat-bar"><div class="stat-fill hp" style="width:${Math.min(100, pokemon.stats.hp / 2.55)}%"></div></div><span>${pokemon.stats.hp}</span></div>
      <div class="stat-row"><span>ATK</span><div class="stat-bar"><div class="stat-fill atk" style="width:${Math.min(100, pokemon.stats.attack / 2.55)}%"></div></div><span>${pokemon.stats.attack}</span></div>
      <div class="stat-row"><span>DEF</span><div class="stat-bar"><div class="stat-fill def" style="width:${Math.min(100, pokemon.stats.defense / 2.55)}%"></div></div><span>${pokemon.stats.defense}</span></div>
      <div class="stat-row"><span>SPA</span><div class="stat-bar"><div class="stat-fill spa" style="width:${Math.min(100, pokemon.stats.spAtk / 2.55)}%"></div></div><span>${pokemon.stats.spAtk}</span></div>
      <div class="stat-row"><span>SPD</span><div class="stat-bar"><div class="stat-fill spd" style="width:${Math.min(100, pokemon.stats.spDef / 2.55)}%"></div></div><span>${pokemon.stats.spDef}</span></div>
      <div class="stat-row"><span>SPE</span><div class="stat-bar"><div class="stat-fill spe" style="width:${Math.min(100, pokemon.stats.speed / 2.55)}%"></div></div><span>${pokemon.stats.speed}</span></div>
    </div>
  ` : '';

  const movesHtml = !small ? `
    <div class="card-moves">
      ${pokemon.moves.slice(0, 4).map(m => `
        <div class="move-pill" data-type="${m.type}">
          <div class="move-info">
            <span class="move-icon">${TYPE_ICONS[m.type] || '✨'}</span>
            <span class="move-name">${m.displayName}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="move-class ${m.damage_class}">
              ${m.damage_class === 'physical' ? 'Fís' : 'Esp'}
            </span>
            <span class="move-power" title="Power / Power Base">${m.power || '-'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="${cls}" data-id="${pokemon.id}" style="--card-color: ${gradColor}" data-tooltip-info='${JSON.stringify(pokemon).replace(/'/g, "&apos;")}'>
      <div class="card-glow"></div>
      <div class="card-header">
        <span class="card-number">#${String(pokemon.id).padStart(3,'0')}</span>
        ${showCost ? `
          <span class="card-cost-badge" style="background: rgba(56,189,248,0.15); border: 1px solid var(--info); border-radius: 4px; padding: 1.5px 5px; font-size: 0.7rem; color: var(--info); font-weight: 800; display: inline-flex; align-items: center; gap: 2px;" title="Custo de Créditos">
            🪙 ${getPokemonCost(pokemon)}
          </span>
        ` : ''}
        ${pokemon.item ? `
          <span class="card-item-badge" title="${pokemon.item.displayName}: ${pokemon.item.description}" style="background: rgba(251, 191, 36, 0.2); border: 1px solid var(--gold); border-radius: 4px; padding: 1px 4px; font-size: 0.7rem; color: var(--gold); font-weight: bold; display: flex; align-items: center; gap: 2px;">
            ${getItemIconHtml(pokemon.item)} ${pokemon.item.displayName}
          </span>
        ` : ''}
        <span class="card-bst">BST ${bst}</span>
      </div>
      <div class="card-sprite-wrap">
        <img class="card-sprite" src="${pokemon.sprite}" alt="${pokemon.displayName}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
      </div>
      <div class="card-info">
        <h3 class="card-name">${pokemon.displayName}</h3>
        <div class="card-types">${pokemon.types.map(t => TypeBadge(t)).join('')}</div>
      </div>
      ${statsHtml}
      ${movesHtml}
      ${selected ? '<div class="card-selected-badge">✓ Selecionado</div>' : ''}
    </div>
  `;
}

// Card pequeno para mostrar no time
export function PokemonMiniCard(pokemon, options = {}) {
  const { fainted = false } = options;
  const gradColor = (pokemon.types && pokemon.types[0] && TYPE_COLORS[pokemon.types[0]]) || '#6c63ff';

  return `
    <div class="pokemon-mini-card ${fainted ? 'fainted' : ''}" style="--card-color: ${gradColor}" data-tooltip-info='${JSON.stringify(pokemon).replace(/'/g, "&apos;")}'>
      <img src="${pokemon.sprite || ''}" alt="${pokemon.displayName || ''}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
      <span class="mini-name">${pokemon.displayName || ''}</span>
    </div>
  `;
}

// Card detalhado para mostrar no painel lateral do time (Roster)
export function PokemonRosterCard(pokemon, options = {}) {
  // Se for item (não possui stats)
  if (!pokemon.stats) {
    return `
      <div class="pokemon-roster-card item-roster-card" style="--card-color: #fbbf24" data-tooltip-info='${JSON.stringify(pokemon).replace(/'/g, "&apos;")}'>
        <div class="roster-card-header">
          <div class="roster-item-icon" style="display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; background: rgba(255,255,255,0.05); border-radius: 8px;">${getItemIconHtml(pokemon, 32)}</div>
          <div class="roster-card-info">
            <div class="roster-card-title-row">
              <span class="roster-card-name">${pokemon.displayName || pokemon.name || ''}</span>
              <span class="roster-card-bst" style="color: var(--gold);">ITEM</span>
            </div>
            <span style="font-size: 0.65rem; color: var(--text-3); text-transform: uppercase; font-weight: 700;">Item Global</span>
          </div>
        </div>
        <div class="roster-item-desc">
          ${pokemon.description || ''}
        </div>
      </div>
    `;
  }

  const gradColor = TYPE_COLORS[pokemon.types[0]] || '#6c63ff';
  const bst = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);

  const statsHtml = `
    <div class="roster-card-stats">
      <div class="roster-stat-item"><span class="roster-stat-label">HP</span><span class="roster-stat-value">${pokemon.stats.hp}</span></div>
      <div class="roster-stat-item"><span class="roster-stat-label">ATK</span><span class="roster-stat-value">${pokemon.stats.attack}</span></div>
      <div class="roster-stat-item"><span class="roster-stat-label">DEF</span><span class="roster-stat-value">${pokemon.stats.defense}</span></div>
      <div class="roster-stat-item"><span class="roster-stat-label">SPA</span><span class="roster-stat-value">${pokemon.stats.spAtk}</span></div>
      <div class="roster-stat-item"><span class="roster-stat-label">SPD</span><span class="roster-stat-value">${pokemon.stats.spDef}</span></div>
      <div class="roster-stat-item"><span class="roster-stat-label">SPE</span><span class="roster-stat-value">${pokemon.stats.speed}</span></div>
    </div>
  `;

  const movesHtml = `
    <div class="roster-card-moves">
      ${pokemon.moves.slice(0, 4).map(m => `
        <div class="roster-move-pill" title="${m.displayName} (${m.damage_class === 'physical' ? 'Físico' : 'Especial'}, Power: ${m.power || '-'})">
          <span class="roster-move-icon">${TYPE_ICONS[m.type] || '✨'}</span>
          <span class="roster-move-name">${m.displayName}</span>
          <span class="roster-move-class ${m.damage_class}">
            ${m.damage_class === 'physical' ? 'Fís' : 'Esp'}
          </span>
        </div>
      `).join('')}
    </div>
  `;

  return `
    <div class="pokemon-roster-card" style="--card-color: ${gradColor}" data-tooltip-info='${JSON.stringify(pokemon).replace(/'/g, "&apos;")}'>
      <div class="roster-card-header">
        <img class="roster-card-sprite" src="${pokemon.sprite}" alt="${pokemon.displayName}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
        <div class="roster-card-info">
          <div class="roster-card-title-row">
            <span class="roster-card-name">${pokemon.displayName}</span>
            <span class="roster-card-bst">BST ${bst}</span>
          </div>
          <div class="roster-card-types" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>${pokemon.types.map(t => TypeBadge(t)).join('')}</div>
            ${pokemon.item ? `
              <span class="roster-item-badge" title="${pokemon.item.displayName}: ${pokemon.item.description}" style="background: rgba(251, 191, 36, 0.15); border: 1px solid var(--gold); border-radius: 4px; padding: 1px 6px; font-size: 0.75rem; color: var(--gold); display: flex; align-items: center; gap: 4px; margin-left: auto;">
                ${getItemIconHtml(pokemon.item)} ${pokemon.item.displayName}
              </span>
            ` : ''}
          </div>
        </div>
      </div>
      ${statsHtml}
      ${movesHtml}
    </div>
  `;
}
