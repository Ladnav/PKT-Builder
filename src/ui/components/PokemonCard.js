// src/ui/components/PokemonCard.js
import { TypeBadge } from './TypeBadge.js';
import { TYPE_COLORS } from '../../engine/types.js';

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
      <div class="stat-row"><span>SPC</span><div class="stat-bar"><div class="stat-fill spa" style="width:${Math.min(100, pokemon.stats.spAtk / 2.55)}%"></div></div><span>${pokemon.stats.spAtk}</span></div>
      <div class="stat-row"><span>SPD</span><div class="stat-bar"><div class="stat-fill spd" style="width:${Math.min(100, pokemon.stats.speed / 2.55)}%"></div></div><span>${pokemon.stats.speed}</span></div>
    </div>
  ` : '';

  const movesHtml = !small ? `
    <div class="card-moves">
      ${pokemon.moves.map(m => `<span class="move-pill" data-type="${m.type}">${m.displayName}</span>`).join('')}
    </div>
  ` : '';

  return `
    <div class="${cls}" data-id="${pokemon.id}" style="--card-color: ${gradColor}">
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
  const gradColor = TYPE_COLORS[pokemon.types[0]] || '#6c63ff';

  return `
    <div class="pokemon-mini-card ${fainted ? 'fainted' : ''}" style="--card-color: ${gradColor}" title="${pokemon.displayName}">
      <img src="${pokemon.sprite}" alt="${pokemon.displayName}" loading="lazy" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png'">
      <span class="mini-name">${pokemon.displayName}</span>
    </div>
  `;
}
