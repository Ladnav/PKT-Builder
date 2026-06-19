// src/tournament/bracket.js
// Lógica do torneio mata-mata de 8 times

import { createBattleState, simulateBattle } from '../engine/battle.js';

export const ROUNDS_NAMES = {
  quarters: 'Quartas de Final',
  semis: 'Semifinal',
  final: 'Final',
  done: 'Encerrado',
};

// Cria o bracket inicial
// times: array de { slot, name, isPlayer, pokemon }
// maxPlayers: 4 ou 8
export function createBracket(teams, maxPlayers = 8) {
  const players = teams.filter(t => t.isPlayer);
  const bots = teams.filter(t => !t.isPlayer).sort(() => Math.random() - 0.5);
  const shuffled = [...players, ...bots];

  // Garante que a array tenha a quantidade certa de times (caso alguém saia na hora do draft)
  while (shuffled.length < maxPlayers) {
    shuffled.push({
      id: 'dummy-' + Math.random(),
      slot: 99,
      name: 'Treinador Desistente',
      isPlayer: false,
      pokemon: [] // Time vazio perde automaticamente
    });
  }

  if (maxPlayers === 4) {
    return {
      teams: shuffled,
      round: 'semis', // Pula quartas
      matches: {
        semis: [
          createMatch(shuffled[0], shuffled[1], 'SF1'),
          createMatch(shuffled[2], shuffled[3], 'SF2'),
        ],
        final: [
          createMatch(null, null, 'F1'),
        ],
      },
      winner: null,
      battleLogs: {},
    };
  }

  // Padrão 8 players
  return {
    teams: shuffled,
    round: 'quarters',
    matches: {
      quarters: [
        createMatch(shuffled[0], shuffled[1], 'QF1'),
        createMatch(shuffled[2], shuffled[3], 'QF2'),
        createMatch(shuffled[4], shuffled[5], 'QF3'),
        createMatch(shuffled[6], shuffled[7], 'QF4'),
      ],
      semis: [
        createMatch(null, null, 'SF1'),
        createMatch(null, null, 'SF2'),
      ],
      final: [
        createMatch(null, null, 'F1'),
      ],
    },
    winner: null,
    battleLogs: {},
  };
}

function createMatch(team1, team2, id) {
  return {
    id,
    team1: team1 || null,
    team2: team2 || null,
    winner: null,
    loser: null,
    log: null,
    simulated: false,
  };
}

// Simula todos os confrontos de um round
export function simulateRound(bracket, roundName, settings = {}) {
  const matches = bracket.matches[roundName];
  const results = [];

  for (const match of matches) {
    if (!match.team1 || !match.team2 || match.simulated) continue;

    const seed = Date.now() + Math.random() * 1000;
    const t1 = match.team1.pokemon.map(p => ({ ...p, item: match.team1.item }));
    const t2 = match.team2.pokemon.map(p => ({ ...p, item: match.team2.item }));
    const state = createBattleState(t1, t2, seed, settings);
    const result = simulateBattle(state);

    match.winner = result.winner === 1 ? match.team1 : match.team2;
    match.loser  = result.winner === 1 ? match.team2 : match.team1;
    match.log    = result.log;
    match.simulated = true;
    match.totalTurns = result.totalTurns;

    bracket.battleLogs[match.id] = result.log;
    results.push({ match, result });
  }

  return results;
}

// Avança para o próximo round populando com os vencedores
export function advanceRound(bracket) {
  const { round, matches } = bracket;

  if (round === 'quarters') {
    matches.semis[0].team1 = matches.quarters[0].winner;
    matches.semis[0].team2 = matches.quarters[1].winner;
    matches.semis[1].team1 = matches.quarters[2].winner;
    matches.semis[1].team2 = matches.quarters[3].winner;
    bracket.round = 'semis';
  } else if (round === 'semis') {
    matches.final[0].team1 = matches.semis[0].winner;
    matches.final[0].team2 = matches.semis[1].winner;
    bracket.round = 'final';
  } else if (round === 'final') {
    bracket.winner = matches.final[0].winner;
    bracket.round = 'done';
  }

  return bracket;
}

// Verifica se todos os confrontos de um round foram simulados
export function isRoundComplete(bracket, roundName) {
  return bracket.matches[roundName].every(m => m.simulated || (!m.team1 || !m.team2));
}

// Retorna o confronto do jogador em um round específico
export function getPlayerMatch(bracket, roundName) {
  return bracket.matches[roundName]?.find(
    m => m.team1?.isPlayer || m.team2?.isPlayer
  ) || null;
}

// Verifica se o jogador ainda está no torneio
export function isPlayerAlive(bracket) {
  const round = bracket.round;
  if (round === 'done') {
    return bracket.winner?.isPlayer === true;
  }
  const prevRounds = { semis: 'quarters', final: 'semis' };
  const prev = prevRounds[round];
  if (!prev) return true;
  return bracket.matches[prev].some(m => m.winner?.isPlayer === true);
}

// Simula o torneio inteiro e retorna o bracket completo
export function simulateFullTournament(teams) {
  let bracket = createBracket(teams);

  simulateRound(bracket, 'quarters');
  advanceRound(bracket);

  simulateRound(bracket, 'semis');
  advanceRound(bracket);

  simulateRound(bracket, 'final');
  advanceRound(bracket);

  return bracket;
}
