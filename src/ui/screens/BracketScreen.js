// src/ui/screens/BracketScreen.js
import { navigate } from '../router.js';
import { simulateFullTournament, ROUNDS_NAMES } from '../../tournament/bracket.js';
import { PokemonMiniCard } from '../components/PokemonCard.js';
import { TYPE_COLORS } from '../../engine/types.js';

let bracket = null;

export function render(container, { teams }) {
  bracket = simulateFullTournament(teams);
  renderBracket(container);
}

function renderBracket(container) {
  const playerAlive = bracket.winner?.isPlayer === true;

  container.innerHTML = `
    <div class="bracket-layout">
      <header class="bracket-header">
        <button class="btn-back" id="btn-back">← Menu</button>
        <h1 class="bracket-title">🏆 Campeonato PokéChampion</h1>
        <div class="bracket-status">
          ${bracket.round === 'done' ? (playerAlive ? '🥇 Você é o Campeão!' : `🏆 Campeão: ${bracket.winner?.name}`) : `Rodada: ${ROUNDS_NAMES[bracket.round]}`}
        </div>
      </header>

      <div class="bracket-body">
        ${renderBracketBody()}
      </div>

      ${bracket.round === 'done' ? renderChampionBanner() : ''}
    </div>

    <!-- Modal de batalha -->
    <div class="battle-modal" id="battle-modal" style="display:none">
      <div class="battle-modal-inner">
        <button class="modal-close" id="modal-close">✕</button>
        <div class="battle-modal-content" id="battle-modal-content"></div>
      </div>
    </div>
  `;

  // Voltar
  container.querySelector('#btn-back').addEventListener('click', () => navigate('home'));

  // Fechar modal
  container.querySelector('#modal-close').addEventListener('click', () => {
    document.getElementById('battle-modal').style.display = 'none';
  });

  // Clique nos confrontos
  container.querySelectorAll('.match-card[data-matchid]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.matchid;
      const log = bracket.battleLogs[id];
      if (log) showBattleLog(id, log);
    });
  });

  // Animação do banner do campeão
  if (bracket.round === 'done') {
    setTimeout(() => {
      container.querySelector('.champion-banner')?.classList.add('visible');
    }, 100);
  }
}

function renderBracketBody() {
  const { matches } = bracket;
  return `
    <div class="bracket-rounds">
      <div class="bracket-round">
        <h3 class="round-title">Quartas de Final</h3>
        <div class="matches-col">
          ${matches.quarters.map(m => renderMatch(m)).join('')}
        </div>
      </div>
      <div class="bracket-connector-col">
        <div class="connectors">
          <div class="connector-v"></div>
          <div class="connector-v"></div>
        </div>
      </div>
      <div class="bracket-round">
        <h3 class="round-title">Semifinal</h3>
        <div class="matches-col">
          ${matches.semis.map(m => renderMatch(m)).join('')}
        </div>
      </div>
      <div class="bracket-connector-col">
        <div class="connectors">
          <div class="connector-v single"></div>
        </div>
      </div>
      <div class="bracket-round bracket-round-final">
        <h3 class="round-title">🏆 Final</h3>
        <div class="matches-col">
          ${matches.final.map(m => renderMatch(m, true)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMatch(match, isFinal = false) {
  const hasResult = match.simulated;
  const team1Win = match.winner?.name === match.team1?.name;
  const team2Win = match.winner?.name === match.team2?.name;

  const renderTeam = (team, isWinner) => {
    if (!team) return `<div class="match-team tbd"><span>TBD</span></div>`;
    const sprite = team.pokemon[0]?.sprite || '';
    const color = TYPE_COLORS[team.pokemon[0]?.types[0]] || '#6c63ff';
    return `
      <div class="match-team ${isWinner ? 'winner' : hasResult ? 'loser' : ''} ${team.isPlayer ? 'player' : ''}" style="--team-color: ${color}">
        ${sprite ? `<img class="match-sprite" src="${sprite}" alt="${team.name}" onerror="this.style.display='none'">` : ''}
        <div class="match-team-info">
          <span class="match-team-name">${team.isPlayer ? '🎮 ' : '🤖 '}${team.name}</span>
          <div class="match-team-types">
            ${team.pokemon.slice(0,3).map(p => `<img class="match-mini-sprite" src="${p.sprite}" alt="${p.displayName}" title="${p.displayName}" onerror="this.style.display='none'">`).join('')}
          </div>
        </div>
        ${isWinner ? '<span class="winner-crown">👑</span>' : ''}
      </div>
    `;
  };

  return `
    <div class="match-card ${hasResult ? 'has-result' : 'pending'} ${isFinal ? 'final-match' : ''}" data-matchid="${match.id}">
      ${renderTeam(match.team1, team1Win)}
      <div class="match-vs">VS</div>
      ${renderTeam(match.team2, team2Win)}
      ${hasResult ? '<div class="match-click-hint">👁 Ver batalha</div>' : '<div class="match-pending-hint">⏳ Aguardando</div>'}
    </div>
  `;
}

function renderChampionBanner() {
  const champ = bracket.winner;
  const isPlayer = champ?.isPlayer;
  const sprite = champ?.pokemon[0]?.sprite || '';

  return `
    <div class="champion-banner ${isPlayer ? 'player-wins' : ''}">
      <div class="champion-content">
        <div class="champion-fireworks">🎆</div>
        <h2 class="champion-title">${isPlayer ? '🎉 VOCÊ É O CAMPEÃO!' : '🏆 CAMPEÃO!'}</h2>
        <div class="champion-name">${isPlayer ? '🎮 Você' : `🤖 ${champ?.name}`}</div>
        ${sprite ? `<img class="champion-sprite" src="${sprite}" alt="campeão">` : ''}
        <div class="champion-team">
          ${champ?.pokemon.map(p => `
            <div class="champion-pokemon">
              <img src="${p.sprite}" alt="${p.displayName}">
              <span>${p.displayName}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn-play-again" id="btn-play-again">🔄 Jogar Novamente</button>
      </div>
    </div>
  `;
}

function showBattleLog(matchId, log) {
  const modal = document.getElementById('battle-modal');
  const content = document.getElementById('battle-modal-content');

  const match = findMatch(matchId);
  content.innerHTML = `
    <div class="log-header">
      <h3>⚔️ ${match?.team1?.name} vs ${match?.team2?.name}</h3>
      <p>Vencedor: <b>${match?.winner?.name}</b> • ${match?.totalTurns} turnos</p>
    </div>
    <div class="battle-log-scroll">
      ${log.map(entry => `
        <div class="log-entry log-${entry.type}">
          ${entry.message}
        </div>
      `).join('')}
    </div>
  `;

  modal.style.display = 'flex';

  // Botão play again
  document.getElementById('btn-play-again')?.addEventListener('click', () => navigate('home'));
}

function findMatch(id) {
  const all = [
    ...bracket.matches.quarters,
    ...bracket.matches.semis,
    ...bracket.matches.final,
  ];
  return all.find(m => m.id === id);
}

export function destroy() {}
