// src/ui/components/PokemonCard.js
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS, TYPE_ICONS } from '../../engine/types.js';

// Card completo do Pokémon para o draft
export function PokemonCard(pokemon, options = {}) {
  const { selectable = false, selected = false, small = false, showStats = true } = options;
  const bst = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);
  const gradColor = TYPE_COLORS[pokemon.types[0]] || '#6c63ff';
  const cls = [
    'pokemon-card',
    selectable ? 'selectable' : '',
    selected ? 'selected' : '',
    small ? 'pokemon-card-sm' : '',
    pokemon.isShiny ? 'shiny' : ''
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
      ${pokemon.moves.map(m => `
        <div class="move-pill" data-type="${m.type}">
          <div class="move-info">
            <span class="move-icon">${TYPE_ICONS[m.type] || '✨'}</span>
            <span class="move-name">${m.displayName}</span>
          </div>
          <span class="move-power" title="Power / Power Base">${m.power || '-'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="${cls}" data-id="${pokemon.id}" style="--card-color: ${gradColor}" data-tooltip-info='${JSON.stringify(pokemon).replace(/'/g, "&apos;")}'>
      <div class="card-glow"></div>
      <div class="card-header">
        <span class="card-number">#${String(pokemon.id).padStart(3,'0')}</span>
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
          <div class="roster-item-icon">${pokemon.icon || '🎒'}</div>
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
      ${pokemon.moves.map(m => `
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
          <div class="roster-card-types">
            ${pokemon.types.map(t => TypeBadge(t)).join('')}
          </div>
        </div>
      </div>
      ${statsHtml}
      ${movesHtml}
    </div>
  `;
}
