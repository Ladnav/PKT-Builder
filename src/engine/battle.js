// src/engine/battle.js
// Motor de batalha Pokémon — simulação 6v6 com tipos, STAB e log

import { getTotalEffectiveness, getEffectivenessText } from './types.js';

const LEVEL = 50; // Nível padrão de todos os Pokémons

const isLazy = (p) => p.name === 'slaking' || p.name === 'regigigas';


// Calcula o dano de um ataque
function calcDamage(attacker, defender, move, weather) {
  const isSpecial = move.damage_class === 'special';
  let atk = isSpecial ? attacker.stats.spAtk : attacker.stats.attack;
  let def = isSpecial ? defender.stats.spDef : defender.stats.defense;

  // Modificadores de Item Atacante
  const atkItem = attacker.item?.name;
  if (atkItem === 'choice-band' && !isSpecial) atk *= 1.3;
  if (atkItem === 'choice-specs' && isSpecial) atk *= 1.3;

  // Modificadores de Item Defensor
  const defItem = defender.item?.name;
  if (defItem === 'assault-vest' && isSpecial) def *= 1.5;

  // Fórmula oficial Gen 4: floor(floor(floor(2*Lv/5+2)*Power*A/D)/50+2) * mods
  let base = Math.floor(Math.floor(Math.floor(2 * LEVEL / 5 + 2) * move.power * atk / def) / 50 + 2);

  // Weather Base Power Modifiers
  let weatherMod = 1;
  if (weather === 'chuva') {
    if (move.type === 'water') weatherMod = 1.5;
    if (move.type === 'fire') weatherMod = 0.5;
  } else if (weather === 'sol') {
    if (move.type === 'fire') weatherMod = 1.5;
    if (move.type === 'water') weatherMod = 0.5;
  } else if (weather === 'neve' && move.type === 'ice') {
    weatherMod = 1.5;
  } else if (weather === 'areia' && ['rock', 'ground', 'steel'].includes(move.type)) {
    weatherMod = 1.2;
  }
  base = Math.floor(base * weatherMod);

  // STAB
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Efetividade de tipo
  const effectiveness = getTotalEffectiveness(move.type, defender.types);

  // Fator aleatório (0.85 a 1.00)
  const random = (85 + Math.floor(Math.random() * 16)) / 100;

  let total = Math.floor(base * stab * effectiveness * random);

  // Modificadores finais de item
  if (atkItem === 'life-orb') total = Math.floor(total * 1.2);
  if (atkItem === 'expert-belt' && effectiveness > 1) total = Math.floor(total * 1.2);

  return { damage: Math.max(1, total), effectiveness, stab };
}

// Cria estado de batalha a partir de dois times
export function createBattleState(team1, team2, seed = Date.now(), settings = {}) {
  const weathers = ['none', 'chuva', 'sol', 'neve', 'areia'];
  const weather = settings.weather ? weathers[Math.floor(Math.random() * (weathers.length - 1)) + 1] : 'none';

  const applySynergy = (team) => {
    if (!settings.synergy) return team.map(p => ({ ...p }));
    const typeCounts = {};
    team.forEach(p => p.types.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1));
    const boostedTypes = Object.keys(typeCounts).filter(t => typeCounts[t] >= 3);
    
    return team.map(p => {
      const pCopy = { ...p };
      if (p.types.some(t => boostedTypes.includes(t))) {
        pCopy.stats = { ...p.stats };
        Object.keys(pCopy.stats).forEach(k => {
          if (k !== 'hp') pCopy.stats[k] = Math.floor(pCopy.stats[k] * 1.1);
        });
        pCopy.hasSynergy = true;
      }
      return pCopy;
    });
  };

  const t1 = applySynergy(team1);
  const t2 = applySynergy(team2);

  return {
    seed,
    weather,
    team1: t1.map(p => {
      const maxHp = p.stats.hp * 2 + 50;
      return { ...p, maxHp, currentHp: maxHp, fainted: false, kos: 0, damageDealt: 0, mustRest: false };
    }),
    team2: t2.map(p => {
      const maxHp = p.stats.hp * 2 + 50;
      return { ...p, maxHp, currentHp: maxHp, fainted: false, kos: 0, damageDealt: 0, mustRest: false };
    }),
    active1: 0,
    active2: 0,
    turn: 0,
    log: [],
    matchups: [],
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
  const item = pokemon.item?.name;
  if (item === 'choice-band') {
    const physMoves = pokemon.moves.filter(m => m.damage_class === 'physical');
    if (physMoves.length > 0) return physMoves[Math.floor(Math.random() * physMoves.length)];
  }
  if (item === 'choice-specs') {
    const specMoves = pokemon.moves.filter(m => m.damage_class === 'special');
    if (specMoves.length > 0) return specMoves[Math.floor(Math.random() * specMoves.length)];
  }
  return pokemon.moves[Math.floor(Math.random() * pokemon.moves.length)];
}

// Adiciona entrada no log
function log(state, message, type = 'normal') {
  state.log.push({ turn: state.turn, message, type });
}

function processAttack(state, attacker, defender, move) {
  const result = calcDamage(attacker, defender, move, state.weather);
  
  // Focus Sash Logic
  let isFatal = result.damage >= defender.currentHp;
  if (isFatal && defender.currentHp === defender.maxHp && defender.item?.name === 'focus-sash') {
    result.damage = defender.currentHp - 1;
    log(state, `  🧣 O Focus Sash salvou <b>${defender.displayName}</b>!`, 'eff-super');
  }

  const actualDmg = Math.min(defender.currentHp, result.damage);
  defender.currentHp = Math.max(0, defender.currentHp - result.damage);
  attacker.damageDealt += actualDmg;

  const effText = getEffectivenessText(result.effectiveness);
  const stabText = result.stab > 1 ? ' (STAB)' : '';

  log(state, `⚡ <b>${attacker.displayName}</b> usa <span class="move-name">${move.displayName}</span>${stabText}!`, 'attack');
  if (effText.text) log(state, `  ${effText.text}`, effText.class);
  log(state, `  💥 <b>${defender.displayName}</b> perde ${result.damage} HP [${Math.max(0,defender.currentHp)}/${defender.maxHp} HP]`, 'damage');

  // Life Orb recoil
  if (attacker.item?.name === 'life-orb') {
    const recoil = Math.floor(attacker.maxHp * 0.1);
    attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
    log(state, `  🔮 <b>${attacker.displayName}</b> perde ${recoil} HP pelo Life Orb!`, 'damage');
  }

  // Rocky Helmet
  if (defender.item?.name === 'rocky-helmet' && move.damage_class === 'physical') {
    const recoil = Math.floor(attacker.maxHp / 6);
    attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
    log(state, `  🪖 <b>${attacker.displayName}</b> se machucou no Rocky Helmet (${recoil} HP)!`, 'damage');
  }

  // Shell Bell (Lifesteal: heals 12.5% of damage dealt)
  if (attacker.item?.name === 'shell-bell' && actualDmg > 0 && attacker.currentHp > 0) {
    const heal = Math.floor(actualDmg * 0.125) || 1;
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
    log(state, `  🔔 <b>${attacker.displayName}</b> recuperou ${heal} HP com Shell Bell!`, 'heal');
  }

  // Sitrus Berry (Heals 25% max HP when HP drops below 50%, consumed once)
  if (defender.item?.name === 'sitrus-berry' && defender.currentHp > 0 && defender.currentHp < defender.maxHp / 2) {
    const heal = Math.floor(defender.maxHp * 0.25) || 1;
    defender.currentHp = Math.min(defender.maxHp, defender.currentHp + heal);
    log(state, `  🍊 <b>${defender.displayName}</b> consumiu a Sitrus Berry e recuperou ${heal} HP!`, 'heal');
    defender.item = null; // Consumido!
  }

  // Process Faints
  if (attacker.currentHp <= 0 && !attacker.fainted) {
    attacker.fainted = true;
    defender.kos++;
    log(state, `  💀 <b>${attacker.displayName}</b> desmaiou!`, 'faint');
  }
  
  if (defender.currentHp <= 0 && !defender.fainted) {
    defender.fainted = true;
    attacker.kos++;
    log(state, `  💀 <b>${defender.displayName}</b> desmaiou!`, 'faint');
    state.matchups.push({
      winner: { id: attacker.id, name: attacker.displayName, sprite: attacker.sprite, team: attacker.teamIdx },
      loser: { id: defender.id, name: defender.displayName, sprite: defender.sprite, team: defender.teamIdx },
      turn: state.turn
    });
  }
}

// Executa um turno da batalha
function executeTurn(state) {
  state.turn++;
  const p1 = state.team1[state.active1];
  const p2 = state.team2[state.active2];

  p1.teamIdx = 1; p2.teamIdx = 2;

  // Leftovers healing at turn start (or end, we'll do end of turn below)
  // Mas first let's pick moves
  const move1 = chooseMoveRandom(p1);
  const move2 = chooseMoveRandom(p2);

  // Determina ordem (Speed e Quick Claw)
  let first, second, moveFirst, moveSecond;
  const p1Claw = p1.item?.name === 'quick-claw' && Math.random() < 0.20;
  const p2Claw = p2.item?.name === 'quick-claw' && Math.random() < 0.20;
  let p1GoesFirst = p1.stats.speed >= p2.stats.speed;
  if (p1Claw && !p2Claw) {
    p1GoesFirst = true;
    log(state, `💅 A Garra Rápida (Quick Claw) fez <b>${p1.displayName}</b> atacar primeiro!`, 'eff-super');
  } else if (p2Claw && !p1Claw) {
    p1GoesFirst = false;
    log(state, `💅 A Garra Rápida (Quick Claw) fez <b>${p2.displayName}</b> atacar primeiro!`, 'eff-super');
  }

  if (p1GoesFirst) {
    first = p1; second = p2; moveFirst = move1; moveSecond = move2;
  } else {
    first = p2; second = p1; moveFirst = move2; moveSecond = move1;
  }

  // Primeiro ataque
  if (!first.fainted && !second.fainted) {
    if (isLazy(first) && first.mustRest) {
      log(state, `💤 <b>${first.displayName}</b> está descansando/preguiçoso neste turno!`, 'normal');
      first.mustRest = false;
    } else {
      processAttack(state, first, second, moveFirst);
      if (isLazy(first)) {
        first.mustRest = true;
      }
    }
  }

  // Segundo ataque
  if (!second.fainted && !first.fainted) {
    if (isLazy(second) && second.mustRest) {
      log(state, `💤 <b>${second.displayName}</b> está descansando/preguiçoso neste turno!`, 'normal');
      second.mustRest = false;
    } else {
      processAttack(state, second, first, moveSecond);
      if (isLazy(second)) {
        second.mustRest = true;
      }
    }
  }

  // End of turn effects (Leftovers)
  const applyEndTurn = (p) => {
    if (!p.fainted && p.currentHp < p.maxHp && p.item?.name === 'leftovers') {
      const heal = Math.floor(p.maxHp * 0.06) || 1;
      p.currentHp = Math.min(p.maxHp, p.currentHp + heal);
      log(state, `  🍎 <b>${p.displayName}</b> recuperou ${heal} HP com Leftovers!`, 'heal');
    }
  }
  applyEndTurn(first);
  applyEndTurn(second);

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
        team[next].mustRest = false; // Garante que ataca na entrada
        log(state, `🔄 <b>${team[next].displayName}</b> entra em campo!`, 'switch');
      }
    }
    return true;
  }

  const t1Alive = advanceTeam(state, 'team1', 'active1');
  const t2Alive = advanceTeam(state, 'team2', 'active2');

  if (!t1Alive && !t2Alive) {
    state.winner = 1; // Empate favorece P1
    log(state, `🏆 <b>Empate!</b> Vitória concedida ao Time 1.`, 'win');
  } else if (!t1Alive) {
    state.winner = 2;
    log(state, `🏆 <b>Time 2 venceu!</b>`, 'win');
  } else if (!t2Alive) {
    state.winner = 1;
    log(state, `🏆 <b>Time 1 venceu!</b>`, 'win');
  } else if (state.turn > 100) {
    // Timeout
    state.winner = 1;
    log(state, `⏱️ <b>Tempo Esgotado!</b> Vitória concedida ao Time 1.`, 'win');
  }
}

// Simula a batalha completa até um vencedor
export function simulateBattle(state) {
  if (state.weather && state.weather !== 'none') {
    log(state, `🌤️ O clima na arena é: <b>${state.weather.toUpperCase()}</b>!`, 'switch');
  }
  log(state, `▶️ <b>Batalha Iniciada!</b>`, 'normal');
  log(state, `🔄 <b>${state.team1[0].displayName}</b> vs <b>${state.team2[0].displayName}</b>!`, 'switch');

  while (!state.winner && state.turn < 150) {
    executeTurn(state);
  }
  return state;
}
