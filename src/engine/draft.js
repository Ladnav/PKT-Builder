// src/engine/draft.js
// Sistema de draft — 3 modos, snake draft, pool de Pokémons

import { ALL_TYPES } from './types.js';

export const DRAFT_MODES = {
  TYPE:   'type',    // Modo 1: escolhe tipo → 8 Pokémons desse tipo
  RANDOM: 'random',  // Modo 2: 8 Pokémons aleatórios, vê os outros
  BLIND:  'blind',   // Modo 3: escolhe tipo → 8 Pokémons, NÃO vê os outros
};

export const DRAFT_MODES_INFO = {
  type: {
    name: 'Draft por Tipo',
    description: 'Escolha um tipo e veja 8 Pokémons desse tipo. Você pode ver o time dos outros!',
    icon: '🎯',
  },
  random: {
    name: 'Draft Aleatório',
    description: '8 Pokémons aleatórios aparecem para você escolher. Times visíveis para todos.',
    icon: '🎲',
  },
  blind: {
    name: 'Draft Cego',
    description: 'Escolha um tipo, mas não veja o time dos adversários. Pura estratégia!',
    icon: '🫣',
  },
};

export const ROUNDS = 6;       // Cada time escolhe 6 Pokémons
export const OPTIONS_COUNT = 8; // 8 opções por pick

// Inicializa estado do draft
export function initDraftState(pokemonPool, mode, numTeams = 8) {
  // Remove duplicatas e embaralha
  const pool = [...pokemonPool].sort(() => Math.random() - 0.5);

  // Snake draft order: rodada 1 → 0..7, rodada 2 → 7..0, etc.
  const slots = Array.from({ length: numTeams }, (_, i) => i);

  return {
    mode,
    pool,                        // Pool disponível (todos os Pokémons não picados)
    usedIds: new Set(),          // IDs já picados
    teams: Array.from({ length: numTeams }, (_, i) => ({
      slot: i,
      isPlayer: i === 0,
      name: i === 0 ? 'Você' : `BOT ${i}`,
      pokemon: [],
    })),
    round: 0,                    // Rodada atual (0-5)
    currentSlot: 0,              // Qual slot está escolhendo agora
    direction: 1,                // 1 = crescente, -1 = decrescente (snake)
    currentOptions: [],          // 8 opções da vez atual
    selectedType: null,          // Tipo selecionado (modos type/blind)
    phase: 'type-select',        // 'type-select' | 'pokemon-select' | 'done'
    history: [],                 // Histórico de picks
    numTeams,
  };
}

// Calcula a ordem snake para uma rodada
export function getSnakeOrder(round, numTeams) {
  const slots = Array.from({ length: numTeams }, (_, i) => i);
  return round % 2 === 0 ? slots : [...slots].reverse();
}

// Retorna posição do slot na ordem snake da rodada atual
export function getPositionInRound(state) {
  const order = getSnakeOrder(state.round, state.numTeams);
  return order.indexOf(state.currentSlot);
}

// Avança para o próximo slot/rodada
export function advanceDraft(state) {
  const order = getSnakeOrder(state.round, state.numTeams);
  const currentPos = order.indexOf(state.currentSlot);

  if (currentPos < order.length - 1) {
    // Ainda tem slots na rodada
    state.currentSlot = order[currentPos + 1];
  } else {
    // Próxima rodada
    state.round++;
    if (state.round >= ROUNDS) {
      state.phase = 'done';
      return state;
    }
    const newOrder = getSnakeOrder(state.round, state.numTeams);
    state.currentSlot = newOrder[0];
  }

  state.phase = 'type-select';
  state.selectedType = null;
  state.currentOptions = [];
  return state;
}

// Gera opções para o tipo escolhido (Modo 1 e 3)
export function generateTypeOptions(state, type) {
  const available = state.pool.filter(
    p => p.types.includes(type) && !state.usedIds.has(p.id)
  );
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, OPTIONS_COUNT);
}

// Gera opções aleatórias (Modo 2)
export function generateRandomOptions(state) {
  const available = state.pool.filter(p => !state.usedIds.has(p.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, OPTIONS_COUNT);
}

// Executa um pick
export function executePick(state, pokemon) {
  const team = state.teams[state.currentSlot];
  team.pokemon.push(pokemon);
  state.usedIds.add(pokemon.id);

  state.history.push({
    round: state.round,
    slot: state.currentSlot,
    teamName: team.name,
    pokemon: pokemon,
    isPlayer: team.isPlayer,
  });

  return advanceDraft(state);
}

// IA do BOT: escolhe o tipo baseado no time atual
export function botChooseType(team, allPokemon, usedIds) {
  const typeCounts = {};

  // Conta tipos já no time
  for (const p of team.pokemon) {
    for (const t of p.types) {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
  }

  // Prefere tipos que ainda tem cobertura disponível e que o time não tem muito
  const typeScores = ALL_TYPES.map(type => {
    const count = typeCounts[type] || 0;
    const available = allPokemon.filter(
      p => p.types.includes(type) && !usedIds.has(p.id)
    ).length;
    // Prefere tipos com menos no time e mais disponíveis no pool
    return { type, score: available * (1 / (count + 1)) + Math.random() * 2 };
  });

  typeScores.sort((a, b) => b.score - a.score);
  return typeScores[0].type;
}

// IA do BOT: escolhe o melhor Pokémon das opções
export function botChoosePokemon(options, team) {
  if (!options || options.length === 0) return null;

  // Cria score baseado em: BST total, cobertura de tipos, variedade
  const teamTypes = new Set(team.pokemon.flatMap(p => p.types));

  const scored = options.map(p => {
    const bst = Object.values(p.stats).reduce((a, b) => a + b, 0);
    const newTypes = p.types.filter(t => !teamTypes.has(t)).length;
    const score = bst + newTypes * 50 + Math.random() * 30;
    return { pokemon: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].pokemon;
}

// Verifica se é o turno do jogador humano
export function isPlayerTurn(state) {
  return state.teams[state.currentSlot]?.isPlayer === true;
}

// Retorna % de progresso do draft
export function getDraftProgress(state) {
  const total = state.numTeams * ROUNDS;
  const done = state.history.length;
  return Math.round((done / total) * 100);
}
