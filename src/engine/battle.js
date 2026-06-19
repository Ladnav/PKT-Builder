// src/engine/battle.js
// Motor de batalha Pokémon — simulação 6v6 com tipos, STAB e log

import { getTotalEffectiveness, getEffectivenessText } from './types.js';

const LEVEL = 50; // Nível padrão de todos os Pokémons

// Calcula o dano de um ataque
function calcDamage(attacker, defender, move) {
  const isSpecial = move.damage_class === 'special';
  const atk = isSpecial ? attacker.stats.spAtk : attacker.stats.attack;
  const def = isSpecial ? defender.stats.spDef : defender.stats.defense;

  // Fórmula oficial Gen 4: floor(floor(floor(2*Lv/5+2)*Power*A/D)/50+2) * mods
  let base = Math.floor(Math.floor(Math.floor(2 * LEVEL / 5 + 2) * move.power * atk / def) / 50 + 2);

  // STAB
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Efetividade de tipo
  const effectiveness = getTotalEffectiveness(move.type, defender.types);

  // Fator aleatório (0.85 a 1.00)
  const random = (85 + Math.floor(Math.random() * 16)) / 100;

  const total = Math.floor(base * stab * effectiveness * random);
  return { damage: Math.max(1, total), effectiveness, stab };
}

// Cria estado de batalha a partir de dois times
export function createBattleState(team1, team2, seed = Date.now()) {
  return {
    seed,
    team1: team1.map(p => ({ ...p, currentHp: p.stats.hp, fainted: false })),
    team2: team2.map(p => ({ ...p, currentHp: p.stats.hp, fainted: false })),
    active1: 0,
    active2: 0,
    turn: 0,
    log: [],
    winner: null,
  };
}

// Escolhe o melhor move para um Pokémon (IA simples)
function chooseMoveBot(attacker, defender) {
  let bestMove = attacker.moves[0];
  let bestScore = -1;

  for (const move of attacker.moves) {
    const effectiveness = getTotalEffectiveness(move.type, defender.types);
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const score = move.power * effectiveness * stab;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

// Escolhe move aleatório (para batalhas normais no campeonato)
function chooseMoveRandom(pokemon) {
  return pokemon.moves[Math.floor(Math.random() * pokemon.moves.length)];
}

// Adiciona entrada no log
function log(state, message, type = 'normal') {
  state.log.push({ turn: state.turn, message, type });
}

// Executa um turno da batalha
function executeTurn(state) {
  state.turn++;
  const p1 = state.team1[state.active1];
  const p2 = state.team2[state.active2];

  // Escolhe moves aleatórios para ambos
  const move1 = chooseMoveRandom(p1);
  const move2 = chooseMoveRandom(p2);

  // Determina ordem (Speed)
  let first, second, moveFirst, moveSecond;
  if (p1.stats.speed >= p2.stats.speed) {
    first = p1; second = p2; moveFirst = move1; moveSecond = move2;
    first.teamIdx = 1; second.teamIdx = 2;
  } else {
    first = p2; second = p1; moveFirst = move2; moveSecond = move1;
    first.teamIdx = 2; second.teamIdx = 1;
  }

  // Primeiro ataque
  if (!first.fainted && !second.fainted) {
    const result1 = calcDamage(first, second, moveFirst);
    second.currentHp = Math.max(0, second.currentHp - result1.damage);

    const effText = getEffectivenessText(result1.effectiveness);
    const stabText = result1.stab > 1 ? ' (STAB)' : '';

    log(state, `⚡ <b>${first.displayName}</b> usa <span class="move-name">${moveFirst.displayName}</span>${stabText}!`, 'attack');
    if (effText.text) log(state, `  ${effText.text}`, effText.class);
    log(state, `  💥 <b>${second.displayName}</b> perde ${result1.damage} HP [${Math.max(0,second.currentHp)}/${second.stats.hp} HP]`, 'damage');

    if (second.currentHp <= 0) {
      second.fainted = true;
      log(state, `  💀 <b>${second.displayName}</b> desmaiou!`, 'faint');
    }
  }

  // Segundo ataque (se ainda em pé)
  if (!second.fainted && !first.fainted) {
    const result2 = calcDamage(second, first, moveSecond);
    first.currentHp = Math.max(0, first.currentHp - result2.damage);

    const effText = getEffectivenessText(result2.effectiveness);
    const stabText = result2.stab > 1 ? ' (STAB)' : '';

    log(state, `⚡ <b>${second.displayName}</b> usa <span class="move-name">${moveSecond.displayName}</span>${stabText}!`, 'attack');
    if (effText.text) log(state, `  ${effText.text}`, effText.class);
    log(state, `  💥 <b>${first.displayName}</b> perde ${result2.damage} HP [${Math.max(0,first.currentHp)}/${first.stats.hp} HP]`, 'damage');

    if (first.currentHp <= 0) {
      first.fainted = true;
      log(state, `  💀 <b>${first.displayName}</b> desmaiou!`, 'faint');
    }
  }

  // Avança para próximo Pokémon se desmaiou
  function advanceTeam(state, teamKey, activeKey) {
    const team = state[teamKey];
    let active = state[activeKey];
    if (team[active].fainted) {
      const next = team.findIndex((p, i) => i > active && !p.fainted);
      if (next === -1) {
        // Todos desmaiaram — verifica se realmente nenhum sobrou
        const anyAlive = team.findIndex(p => !p.fainted);
        if (anyAlive === -1) return false; // Time eliminado
        state[activeKey] = anyAlive;
      } else {
        state[activeKey] = next;
        log(state, `🔄 <b>${team[next].displayName}</b> entra em campo!`, 'switch');
      }
    }
    return true;
  }

  const team1alive = advanceTeam(state, 'team1', 'active1');
  const team2alive = advanceTeam(state, 'team2', 'active2');

  if (!team1alive) state.winner = 2;
  else if (!team2alive) state.winner = 1;
}

// Simula uma batalha completa entre dois times
// Retorna: { winner: 1|2, log: [...], totalTurns: N }
export function simulateBattle(team1, team2, seed) {
  const state = createBattleState(team1, team2, seed);
  const MAX_TURNS = 200; // Evita loop infinito

  log(state, `⚔️ <b>BATALHA COMEÇOU!</b>`, 'header');
  log(state, `🔴 Time 1: ${team1.length > 0 ? team1.map(p => p.displayName).join(', ') : '(W.O.)'}`, 'info');
  log(state, `🔵 Time 2: ${team2.length > 0 ? team2.map(p => p.displayName).join(', ') : '(W.O.)'}`, 'info');
  log(state, `─────────────────────────────`, 'separator');

  if (team1.length === 0 && team2.length === 0) {
    state.winner = 1;
    log(state, `Ambos os times desistiram... Time 1 ganha por sorteio.`, 'info');
  } else if (team1.length === 0) {
    state.winner = 2;
    log(state, `Time 1 não compareceu! Time 2 vence por W.O.!`, 'victory');
  } else if (team2.length === 0) {
    state.winner = 1;
    log(state, `Time 2 não compareceu! Time 1 vence por W.O.!`, 'victory');
  } else {
    log(state, `🔴 <b>${team1[0].displayName}</b> vs 🔵 <b>${team2[0].displayName}</b>`, 'matchup');
  }

  while (!state.winner && state.turn < MAX_TURNS) {
    executeTurn(state);

    // Anuncia nova dupla quando muda
    if (!state.winner) {
      const p1 = state.team1[state.active1];
      const p2 = state.team2[state.active2];
      const lastLog = state.log[state.log.length - 1];
      if (lastLog?.type === 'switch') {
        log(state, `🔴 <b>${state.team1[state.active1].displayName}</b> vs 🔵 <b>${state.team2[state.active2].displayName}</b>`, 'matchup');
      }
    }
  }

  if (!state.winner) state.winner = 1; // Empate → Time 1 vence (tiebreak)

  log(state, `─────────────────────────────`, 'separator');
  const winnerTeam = state.winner === 1 ? team1 : team2;
  log(state, `🏆 <b>${winnerTeam[0].displayName} e seu time vencem!</b>`, 'victory');

  return {
    winner: state.winner,
    log: state.log,
    totalTurns: state.turn,
    team1Final: state.team1,
    team2Final: state.team2,
    seed: state.seed,
  };
}
