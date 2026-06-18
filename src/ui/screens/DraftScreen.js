// src/ui/screens/DraftScreen.js
import { navigate } from '../router.js';
import { PokemonCard, PokemonMiniCard } from '../components/PokemonCard.js';
import { TypeBadge } from '../components/TypeBadge.js';
import { TYPE_NAMES_PT, TYPE_ICONS, ALL_TYPES } from '../../engine/types.js';
import {
  initDraftState, generateTypeOptions, generateRandomOptions,
  executePick, isPlayerTurn, botChooseType, botChoosePokemon,
  getDraftProgress, DRAFT_MODES, ROUNDS
} from '../../engine/draft.js';
import pokemonData from '../../data/pokemon-sample.json';

let state = null;
let container = null;
let botTimer = null;

export function render(cont, { mode }) {
  container = cont;
  state = initDraftState(pokemonData, mode);

  // Inicia o draft no primeiro turno
  renderDraftScreen();
  processTurn();
}

function renderDraftScreen() {
  const isPlayer = isPlayerTurn(state);
  const progress = getDraftProgress(state);
  const currentTeam = state.teams[state.currentSlot];
  const playerTeam = state.teams[0];

  container.innerHTML = `
    <div class="draft-layout">

      <!-- HEADER -->
      <header class="draft-header">
        <div class="draft-title">
          <span class="draft-badge">⚡ DRAFT</span>
          <span class="draft-mode-label">${getModeLabel(state.mode)}</span>
        </div>
        <div class="draft-progress-wrap">
          <div class="draft-progress-bar" style="width:${progress}%"></div>
          <span class="draft-progress-text">Rodada ${state.round + 1}/${ROUNDS} • ${progress}%</span>
        </div>
        <div class="draft-turn-info ${isPlayer ? 'your-turn' : 'bot-turn'}">
          ${isPlayer ? '🎯 SUA VEZ!' : `🤖 Vez do ${currentTeam.name}`}
        </div>
      </header>

      <!-- BODY -->
      <div class="draft-body">

        <!-- COLUNA ESQUERDA: times adversários -->
        <aside class="draft-teams-sidebar" id="sidebar-left">
          <h3 class="sidebar-title">📋 Times</h3>
          <div class="teams-list" id="teams-list">
            ${renderTeamsSidebar()}
          </div>
        </aside>

        <!-- CENTRO: opções de pick -->
        <main class="draft-main" id="draft-main">
          ${renderDraftMain()}
        </main>

        <!-- COLUNA DIREITA: seu time -->
        <aside class="draft-my-team" id="sidebar-right">
          <h3 class="sidebar-title">🎒 Seu Time</h3>
          <div class="my-team-slots" id="my-team-slots">
            ${renderMyTeam(playerTeam)}
          </div>
          <div class="my-team-stats">
            <span>${playerTeam.pokemon.length}/6 Pokémons</span>
          </div>
        </aside>

      </div>
    </div>
  `;

  attachDraftEvents();
}

function renderDraftMain() {
  if (state.phase === 'done') {
    return `<div class="draft-done-msg">
      <div class="done-icon">✅</div>
      <h2>Draft Concluído!</h2>
      <p>Todos os times foram montados. Iniciando campeonato...</p>
    </div>`;
  }

  const isPlayer = isPlayerTurn(state);

  if (!isPlayer) {
    return `<div class="bot-thinking">
      <div class="thinking-spinner"></div>
      <p>${state.teams[state.currentSlot].name} está escolhendo...</p>
    </div>`;
  }

  // Turno do jogador
  if (state.mode !== DRAFT_MODES.RANDOM && state.phase === 'type-select') {
    return renderTypeSelect();
  }

  if (state.currentOptions.length > 0 || state.mode === DRAFT_MODES.RANDOM) {
    return renderPokemonOptions();
  }

  return renderTypeSelect();
}

function renderTypeSelect() {
  return `
    <div class="type-select-wrap">
      <h2 class="pick-title">🎯 Escolha um tipo</h2>
      <p class="pick-sub">Você verá 8 Pokémons desse tipo para escolher</p>
      <div class="type-grid" id="type-grid">
        ${ALL_TYPES.map(type => {
          const available = pokemonData.filter(
            p => p.types.includes(type) && !state.usedIds.has(p.id)
          ).length;
          return `
            <button class="type-btn ${available === 0 ? 'disabled' : ''}" data-type="${type}" ${available === 0 ? 'disabled' : ''}>
              <span class="type-btn-icon">${TYPE_ICONS[type]}</span>
              <span class="type-btn-name">${TYPE_NAMES_PT[type]}</span>
              <span class="type-btn-count">${available} disp.</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderPokemonOptions() {
  const options = state.currentOptions;
  return `
    <div class="pokemon-options-wrap">
      <div class="options-header">
        <h2 class="pick-title">
          ${state.selectedType ? `${TYPE_ICONS[state.selectedType]} Pokémons do tipo ${TYPE_NAMES_PT[state.selectedType]}` : '🎲 Pokémons Aleatórios'}
        </h2>
        <p class="pick-sub">Escolha 1 Pokémon para o seu time (Slot ${state.teams[0].pokemon.length + 1}/6)</p>
      </div>
      <div class="options-grid" id="options-grid">
        ${options.map(p => PokemonCard(p, { selectable: true })).join('')}
      </div>
    </div>
  `;
}

function renderTeamsSidebar() {
  const showTeams = state.mode !== DRAFT_MODES.BLIND;
  return state.teams.map((team, i) => {
    const isActive = state.currentSlot === i;
    return `
      <div class="team-item ${isActive ? 'active' : ''} ${team.isPlayer ? 'player-team' : ''}">
        <div class="team-header">
          <span class="team-icon">${team.isPlayer ? '🎮' : '🤖'}</span>
          <span class="team-name">${team.name}</span>
          <span class="team-count">${team.pokemon.length}/6</span>
        </div>
        ${showTeams || team.isPlayer ? `
          <div class="team-pokemon-row">
            ${team.pokemon.map(p => `
              <img class="team-mini-sprite" src="${p.sprite}" alt="${p.displayName}" title="${p.displayName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
            `).join('')}
            ${Array(6 - team.pokemon.length).fill('<div class="team-mini-empty"></div>').join('')}
          </div>
        ` : `<div class="team-hidden">🫣 Times ocultos</div>`}
      </div>
    `;
  }).join('');
}

function renderMyTeam(team) {
  if (team.pokemon.length === 0) {
    return `<div class="empty-team">Nenhum Pokémon ainda</div>`;
  }
  return team.pokemon.map(p => PokemonMiniCard(p)).join('');
}

function attachDraftEvents() {
  // Seleção de tipo
  container.querySelectorAll('.type-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      selectType(type);
    });
  });

  // Seleção de Pokémon
  container.querySelectorAll('.pokemon-card.selectable').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const pokemon = state.currentOptions.find(p => p.id === id);
      if (pokemon) selectPokemon(pokemon);
    });
  });
}

function selectType(type) {
  state.selectedType = type;
  state.currentOptions = generateTypeOptions(state, type);
  state.phase = 'pokemon-select';
  updateDraftMain();
}

function selectPokemon(pokemon) {
  state = executePick(state, pokemon);

  if (state.phase === 'done') {
    updateUI();
    setTimeout(() => goToTournament(), 1200);
    return;
  }

  updateUI();
  processTurn();
}

function processTurn() {
  if (state.phase === 'done') {
    setTimeout(() => goToTournament(), 1000);
    return;
  }

  if (isPlayerTurn(state)) {
    // Turno do jogador: mostra seleção de tipo ou opções aleatórias
    if (state.mode === DRAFT_MODES.RANDOM) {
      state.currentOptions = generateRandomOptions(state);
      state.phase = 'pokemon-select';
    } else {
      state.phase = 'type-select';
    }
    updateDraftMain();
    return;
  }

  // Turno do BOT
  updateDraftMain(); // Mostra "bot pensando"
  clearTimeout(botTimer);
  botTimer = setTimeout(() => executeBotTurn(), 800 + Math.random() * 600);
}

function executeBotTurn() {
  if (state.phase === 'done' || isPlayerTurn(state)) return;

  const team = state.teams[state.currentSlot];
  let options;

  if (state.mode === DRAFT_MODES.RANDOM) {
    options = generateRandomOptions(state);
  } else {
    const type = botChooseType(team, pokemonData, state.usedIds);
    options = generateTypeOptions(state, type);
    if (options.length === 0) options = generateRandomOptions(state);
  }

  const picked = botChoosePokemon(options, team);
  if (!picked) {
    // Pool vazio para esse tipo — pega qualquer disponível
    const any = pokemonData.find(p => !state.usedIds.has(p.id));
    if (any) {
      state = executePick(state, any);
    }
  } else {
    state = executePick(state, picked);
  }

  if (state.phase === 'done') {
    updateUI();
    setTimeout(() => goToTournament(), 1500);
    return;
  }

  updateUI();
  processTurn();
}

function updateUI() {
  const sidebar = container.querySelector('#teams-list');
  if (sidebar) sidebar.innerHTML = renderTeamsSidebar();

  const myTeam = container.querySelector('#my-team-slots');
  if (myTeam) myTeam.innerHTML = renderMyTeam(state.teams[0]);

  const stats = container.querySelector('.my-team-stats span');
  if (stats) stats.textContent = `${state.teams[0].pokemon.length}/6 Pokémons`;

  const header = container.querySelector('.draft-turn-info');
  const isPlayer = isPlayerTurn(state);
  if (header) {
    header.className = `draft-turn-info ${isPlayer ? 'your-turn' : 'bot-turn'}`;
    header.textContent = isPlayer ? '🎯 SUA VEZ!' : `🤖 Vez do ${state.teams[state.currentSlot]?.name}`;
  }

  const progress = getDraftProgress(state);
  const bar = container.querySelector('.draft-progress-bar');
  if (bar) bar.style.width = `${progress}%`;
  const txt = container.querySelector('.draft-progress-text');
  if (txt) txt.textContent = `Rodada ${Math.min(state.round + 1, ROUNDS)}/${ROUNDS} • ${progress}%`;

  updateDraftMain();
}

function updateDraftMain() {
  const main = container.querySelector('#draft-main');
  if (main) {
    main.innerHTML = renderDraftMain();
    attachDraftEvents();
  }
}

function goToTournament() {
  navigate('bracket', { teams: state.teams });
}

function getModeLabel(mode) {
  const labels = { type: '🎯 Por Tipo', random: '🎲 Aleatório', blind: '🫣 Cego' };
  return labels[mode] || mode;
}

export function destroy() {
  clearTimeout(botTimer);
}
