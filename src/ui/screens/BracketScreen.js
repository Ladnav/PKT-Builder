// src/ui/screens/BracketScreen.js
import { navigate } from '../router.js';
import { simulateBattle } from '../../engine/battle.js';
import { TYPE_COLORS } from '../../engine/types.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';

const ROUNDS_NAMES = {
  quarters: 'Quartas de Final',
  semis: 'Semifinal',
  final: 'Final',
  done: 'Encerrado',
};

let roomId = null;
let roomCode = null;
let currentUserId = null;
let isHost = false;
let container = null;

let bracket = null;
let participants = [];

let bracketSubscription = null;
let simulationInProgress = false;
let simulationTimer = null;
let loading = false;
let errorMsg = '';

export async function render(cont, params) {
  container = cont;
  roomCode = params.code;
  roomId = params.roomId;
  isHost = params.isHost;
  loading = true;
  errorMsg = '';
  simulationInProgress = false;

  renderLayout();

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }
    currentUserId = user.id;

    // Busca participantes
    const { data: parts, error: partErr } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (partErr) throw partErr;
    participants = parts || [];

    // Busca bracket
    await fetchBracket();

    // Configura realtime
    setupSubscription();

    // Inicia simulações se for host
    if (isHost) {
      runSimulations();
    }

  } catch (err) {
    console.error('Erro ao carregar bracket:', err);
    errorMsg = err.message || 'Erro ao carregar campeonato.';
  } finally {
    loading = false;
    updateUI();
  }
}

async function fetchBracket() {
  const { data, error } = await supabase
    .from('brackets')
    .select('*')
    .eq('room_id', roomId)
    .single();

  if (error) throw error;
  bracket = data;
}

function setupSubscription() {
  cleanup();

  bracketSubscription = supabase
    .channel('bracket-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'brackets',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      bracket = { ...bracket, ...payload.new };
      updateUI();
      if (isHost) runSimulations();
    })
    .subscribe();
}

function renderLayout() {
  container.innerHTML = `
    <div class="bracket-layout">
      <header class="bracket-header">
        <button class="btn-back" id="btn-back">← Menu</button>
        <h1 class="bracket-title">🏆 Campeonato PokéChampion</h1>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div class="bracket-status" id="bracket-status">
            Carregando chaveamento...
          </div>
          <button id="btn-show-champion" style="display: none; padding: 0.4rem 1rem; background: rgba(108, 99, 255, 0.1); border: 1px solid var(--primary); color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">👑 Ver Campeão</button>
        </div>
      </header>

      <div class="bracket-body" id="bracket-body">
        <div class="loading-wrap" style="padding: 4rem 0">
          <div class="thinking-spinner"></div>
          <p>Sincronizando campeonato...</p>
        </div>
      </div>
    </div>

    <!-- Modal de batalha -->
    <div class="battle-modal" id="battle-modal" style="display:none">
      <div class="battle-modal-inner">
        <button class="modal-close" id="modal-close">✕</button>
        <div class="battle-modal-content" id="battle-modal-content"></div>
      </div>
    </div>
  `;
}

function updateUI() {
  if (!bracket) return;

  const playerPart = participants.find(p => p.user_id === currentUserId);
  
  // Encontra se jogador está vivo (ou se ganhou)
  let playerAlive = false;
  if (bracket.round === 'done') {
    const winnerMatch = bracket.matches.final[0];
    playerAlive = winnerMatch?.winner?.user_id === currentUserId;
  } else {
    // Está nas quartas, semis ou final. Se perdeu em alguma etapa anterior, playerAlive = false.
    let lost = false;
    // Verifica quartas se já simulou seu jogo
    const myQF = bracket.matches.quarters?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (myQF && myQF.simulated && myQF.winner?.user_id !== currentUserId) lost = true;
    
    // Verifica semis
    const mySF = bracket.matches.semis?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (mySF && mySF.simulated && mySF.winner?.user_id !== currentUserId) lost = true;

    playerAlive = !lost;
  }

  // Status
  const statusEl = container.querySelector('#bracket-status');
  const btnShowChamp = container.querySelector('#btn-show-champion');
  if (statusEl) {
    if (bracket.round === 'done') {
      const winnerName = bracket.matches.final[0]?.winner?.name || 'Vencedor';
      statusEl.textContent = playerAlive ? '🥇 Você é o Grande Campeão! 🎉' : `🏆 Campeão: ${winnerName}`;
      if (btnShowChamp) btnShowChamp.style.display = 'block';
    } else {
      statusEl.textContent = `Rodada: ${ROUNDS_NAMES[bracket.round]}`;
      if (btnShowChamp) btnShowChamp.style.display = 'none';
    }
  }

  // Bracket Body
  const bodyEl = container.querySelector('#bracket-body');
  if (bodyEl) {
    bodyEl.innerHTML = renderBracketRounds();
  }

  // Champion Banner
  if (bracket.round === 'done') {
    const existingBanner = container.querySelector('.champion-banner');
    if (!existingBanner) {
      const bannerWrap = document.createElement('div');
      bannerWrap.innerHTML = renderChampionBanner(playerAlive);
      container.querySelector('.bracket-layout').appendChild(bannerWrap.firstElementChild);
      
      // Animação de entrada
      setTimeout(() => {
        container.querySelector('.champion-banner')?.classList.add('visible');
      }, 100);
    }
  }

  attachEvents();
}

function renderBracketRounds() {
  const { matches } = bracket;
  
  const hasQuarters = !!matches.quarters;

  return `
    <div class="bracket-rounds ${hasQuarters ? '' : 'bracket-rounds-small'}">
      ${hasQuarters ? `
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
      ` : ''}
      
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

function renderChampionBanner(isPlayer) {
  const finalMatch = bracket.matches.final[0];
  const champ = finalMatch?.winner;
  const sprite = champ?.pokemon[0]?.sprite || '';

  return `
    <div class="champion-banner ${isPlayer ? 'player-wins' : ''}">
      <div class="champion-content">
        <div class="champion-fireworks">🎆</div>
        <h2 class="champion-title">${isPlayer ? '🎉 VOCÊ É O CAMPEÃO!' : '🏆 CAMPEÃO!'}</h2>
        <div class="champion-name">${isPlayer ? '🎮 Você' : `🤖 ${champ?.name}`}</div>
        ${sprite ? `<img class="champion-sprite" src="${sprite}" alt="campeão">` : ''}
        <div class="champion-team">
          ${champ?.pokemon?.map(p => `
            <div class="champion-pokemon">
              <img src="${p.sprite}" alt="${p.displayName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
              <span>${p.displayName}</span>
            </div>
          `).join('') || ''}
        </div>
        <div class="champion-buttons" style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
          <button class="btn-view-bracket" id="btn-view-bracket" style="padding: 0.8rem 1.5rem; background: var(--bg-3); border: 1px solid var(--border-bright); color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">👀 Ver Chaveamento</button>
          <button class="btn-play-again" id="btn-play-again" style="padding: 0.8rem 1.5rem; background: var(--primary); border: none; color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">🔄 Voltar ao Menu</button>
        </div>
      </div>
    </div>
  `;
}

function attachEvents() {
  // Back
  container.querySelector('#btn-back')?.addEventListener('click', handleGoHome);

  // Play again
  container.querySelector('#btn-play-again')?.addEventListener('click', handleGoHome);

  // View Bracket (hide banner)
  container.querySelector('#btn-view-bracket')?.addEventListener('click', () => {
    const banner = container.querySelector('.champion-banner');
    if (banner) banner.style.display = 'none';
  });

  // Show Champion (show banner)
  container.querySelector('#btn-show-champion')?.addEventListener('click', () => {
    const banner = container.querySelector('.champion-banner');
    if (banner) banner.style.display = 'flex';
  });

  // Close modal
  container.querySelector('#modal-close')?.addEventListener('click', () => {
    document.getElementById('battle-modal').style.display = 'none';
  });

  // Match click for battle log
  container.querySelectorAll('.match-card.has-result').forEach(card => {
    card.addEventListener('click', () => {
      const matchId = card.dataset.matchid;
      loadAndShowBattleLog(matchId);
    });
  });
}

async function handleGoHome() {
  if (confirm('Deseja sair da sala e voltar ao menu principal?')) {
    try {
      const myPart = participants.find(p => p.user_id === currentUserId);
      if (myPart) {
        await supabase.from('room_participants').delete().eq('id', myPart.id);
      }
    } catch (e) {
      console.error(e);
    }
    cleanup();
    navigate('home');
  }
}

async function loadAndShowBattleLog(matchId) {
  // Encontra a partida correspondente no bracket local
  let match = null;
  const allMatches = [
    ...(bracket.matches.quarters || []),
    ...(bracket.matches.semis || []),
    ...(bracket.matches.final || []),
  ];
  match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  const modal = document.getElementById('battle-modal');
  const content = document.getElementById('battle-modal-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="log-header">
      <h3>⚔️ Batalha: ${match.team1.name} vs ${match.team2.name}</h3>
      <p>Buscando histórico de turnos no servidor...</p>
    </div>
    <div class="battle-log-scroll" style="display:flex; justify-content:center; align-items:center; padding: 3rem">
      <div class="thinking-spinner"></div>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    const { data, error } = await supabase
      .from('battle_logs')
      .select('log, total_turns')
      .eq('bracket_id', bracket.id)
      .eq('participant1_id', match.team1.id)
      .eq('participant2_id', match.team2.id)
      .single();

    if (error) throw error;

    content.innerHTML = `
      <div class="log-header">
        <h3>⚔️ ${match.team1.name} vs ${match.team2.name}</h3>
        <p>Vencedor: <b>${match.winner.name}</b> • ${data.total_turns} turnos</p>
      </div>
      <div class="battle-log-scroll">
        ${data.log.map(entry => `
          <div class="log-entry log-${entry.type}">
            ${entry.message}
          </div>
        `).join('')}
      </div>
    `;

  } catch (err) {
    console.error('Erro ao buscar log:', err);
    content.innerHTML = `
      <div class="log-header">
        <h3>⚔️ Erro</h3>
        <p>Não foi possível carregar os detalhes desta batalha.</p>
      </div>
    `;
  }
}

// LÓGICA DO HOST PARA SIMULAÇÃO DO TORNEIO
function runSimulations() {
  if (bracket.round === 'done') return;
  if (simulationInProgress) return;

  const roundName = bracket.round;
  const matches = bracket.matches[roundName];
  
  // Encontra primeira partida não simulada no round
  const pendingMatch = matches.find(m => !m.simulated && m.team1 && m.team2);

  if (pendingMatch) {
    simulationInProgress = true;
    clearTimeout(simulationTimer);
    simulationTimer = setTimeout(() => simulateMatchAndSave(pendingMatch, roundName), 2000);
  } else {
    // Todas as partidas do round atual foram simuladas. Avança o round!
    const roundComplete = matches.every(m => m.simulated || (!m.team1 || !m.team2));
    if (roundComplete) {
      simulationInProgress = true;
      clearTimeout(simulationTimer);
      simulationTimer = setTimeout(() => advanceRoundAndSave(roundName), 2000);
    }
  }
}

async function simulateMatchAndSave(match, roundName) {
  try {
    const seed = Date.now() + Math.floor(Math.random() * 10000);
    // Simula a batalha com o motor
    const result = simulateBattle(match.team1.pokemon, match.team2.pokemon, seed);

    const winner = result.winner === 1 ? match.team1 : match.team2;
    const loser = result.winner === 1 ? match.team2 : match.team1;

    match.winner = winner;
    match.loser = loser;
    match.simulated = true;
    match.totalTurns = result.totalTurns;

    // 1. Grava log de batalha
    const { error: logErr } = await supabase
      .from('battle_logs')
      .insert({
        room_id: roomId,
        bracket_id: bracket.id,
        participant1_id: match.team1.id,
        participant2_id: match.team2.id,
        winner_id: winner.id,
        log: result.log,
        total_turns: result.totalTurns,
        battle_seed: seed
      });

    if (logErr) throw logErr;

    // 2. Atualiza estatísticas persistentes
    const isChampionship = roundName === 'final';
    await updateUserStats(winner.user_id, loser.user_id, isChampionship);

    // 3. Atualiza o bracket no banco
    const { error: brkErr } = await supabase
      .from('brackets')
      .update({
        matches: bracket.matches,
        updated_at: new Date().toISOString()
      })
      .eq('id', bracket.id);

    if (brkErr) throw brkErr;

  } catch (err) {
    console.error('Erro ao simular confronto:', err);
  } finally {
    simulationInProgress = false;
  }
}

async function advanceRoundAndSave(roundName) {
  try {
    let nextRound = roundName;
    let winnerId = null;

    if (roundName === 'quarters') {
      bracket.matches.semis[0].team1 = bracket.matches.quarters[0].winner;
      bracket.matches.semis[0].team2 = bracket.matches.quarters[1].winner;
      bracket.matches.semis[1].team1 = bracket.matches.quarters[2].winner;
      bracket.matches.semis[1].team2 = bracket.matches.quarters[3].winner;
      nextRound = 'semis';
    } else if (roundName === 'semis') {
      bracket.matches.final[0].team1 = bracket.matches.semis[0].winner;
      bracket.matches.final[0].team2 = bracket.matches.semis[1].winner;
      nextRound = 'final';
    } else if (roundName === 'final') {
      nextRound = 'done';
      winnerId = bracket.matches.final[0].winner.id;
    }

    const { error } = await supabase
      .from('brackets')
      .update({
        matches: bracket.matches,
        round: nextRound,
        winner_id: winnerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', bracket.id);

    if (error) throw error;

    // Se o campeonato acabou, muda status da sala
    if (nextRound === 'done') {
      await supabase
        .from('rooms')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', roomId);
    }

  } catch (err) {
    console.error('Erro ao avançar rodada:', err);
  } finally {
    simulationInProgress = false;
  }
}

async function updateUserStats(winnerUserId, loserUserId, isChampionship = false) {
  try {
    if (winnerUserId) {
      const { data: p } = await supabase.from('profiles').select('wins, championships').eq('id', winnerUserId).single();
      if (p) {
        await supabase.from('profiles')
          .update({
            wins: p.wins + 1,
            championships: isChampionship ? p.championships + 1 : p.championships
          })
          .eq('id', winnerUserId);
      }
    }
    if (loserUserId) {
      const { data: p } = await supabase.from('profiles').select('losses').eq('id', loserUserId).single();
      if (p) {
        await supabase.from('profiles')
          .update({ losses: p.losses + 1 })
          .eq('id', loserUserId);
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar estatísticas do usuário:', err);
  }
}

function cleanup() {
  clearTimeout(simulationTimer);
  if (bracketSubscription) {
    bracketSubscription.unsubscribe();
    bracketSubscription = null;
  }
}

export function destroy() {
  cleanup();
}
