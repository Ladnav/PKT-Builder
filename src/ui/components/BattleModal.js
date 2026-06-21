// src/ui/components/BattleModal.js
import { playSFX } from '../../lib/sounds.js';

let container = null;
let interval = null;
let closeCallback = null;

export function renderBattleModalLoading(match) {
  closeBattleModal();

  container = document.createElement('div');
  container.id = 'battle-modal';
  container.className = 'battle-modal'; // Overlay style in index.css

  container.innerHTML = `
    <div class="battle-modal-inner" style="max-width: 850px; width: 95%; height: 85vh; display: flex; flex-direction: column; position: relative;">
      <button class="modal-close" id="btn-close-battle">✕</button>
      
      <div class="battle-modal-header" style="background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 1rem 3rem 1rem 1rem;">
        <h2 class="battle-modal-title" style="color: var(--gold); margin: 0; font-size: 1.2rem;">⚔️ Carregando Batalha</h2>
      </div>
      
      <div class="bm-teams-container" style="margin: 1rem;">
        <div class="bm-team bm-team1">
          <h3 class="bm-team-name">${match.team1.name}</h3>
        </div>
        <div class="bm-vs">VS</div>
        <div class="bm-team bm-team2">
          <h3 class="bm-team-name">${match.team2.name}</h3>
        </div>
      </div>
      
      <div class="battle-modal-content" style="display: flex; justify-content: center; align-items: center; flex: 1;">
        <div class="thinking-spinner"></div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  container.querySelector('#btn-close-battle').addEventListener('click', closeBattleModal);
}

export function renderBattleModalError(match) {
  closeBattleModal();

  container = document.createElement('div');
  container.id = 'battle-modal';
  container.className = 'battle-modal';

  container.innerHTML = `
    <div class="battle-modal-inner" style="max-width: 850px; width: 95%; height: 85vh; display: flex; flex-direction: column; position: relative;">
      <button class="modal-close" id="btn-close-battle">✕</button>
      
      <div class="battle-modal-header" style="background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 1rem 3rem 1rem 1rem;">
        <h2 class="battle-modal-title" style="color: var(--danger); margin: 0; font-size: 1.2rem;">⚠️ Falha ao Carregar</h2>
      </div>
      
      <div class="bm-teams-container" style="margin: 1rem;">
        <div class="bm-team bm-team1">
          <h3 class="bm-team-name">${match.team1.name}</h3>
        </div>
        <div class="bm-vs">VS</div>
        <div class="bm-team bm-team2">
          <h3 class="bm-team-name">${match.team2.name}</h3>
        </div>
      </div>
      
      <div class="battle-modal-content" style="display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 1rem; flex: 1; text-align: center; color: var(--text-2);">
        <span style="font-size: 3rem;">⚠️</span>
        <p>Não foi possível carregar os detalhes desta batalha do banco de dados.</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  container.querySelector('#btn-close-battle').addEventListener('click', closeBattleModal);
}

export function renderBattleModal(match, onClose = null) {
  if (!match || !match.log) return;
  
  closeBattleModal();
  closeCallback = onClose;

  container = document.createElement('div');
  container.id = 'battle-modal';
  container.className = 'battle-modal'; // Overlay class from index.css
  
  // Clone logs so we can process them
  const logs = [...match.log];
  
  // Create copies of the teams to track faint status
  const t1 = match.team1.pokemon.map((p, i) => ({ ...p, uniqueId: `t1_${p.id}_${i}`, fainted: false, active: false }));
  const t2 = match.team2.pokemon.map((p, i) => ({ ...p, uniqueId: `t2_${p.id}_${i}`, fainted: false, active: false }));
  
  t1[0].active = true;
  t2[0].active = true;

  const renderPokemon = (p, reverse = false) => `
    <div class="bm-pokemon ${p.fainted ? 'fainted' : ''} ${p.active ? 'active' : ''}" id="bm-poke-${p.uniqueId}">
      <img src="${p.sprite}" alt="${p.displayName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'" style="${reverse ? 'transform: scaleX(-1);' : ''}">
      <div class="bm-poke-name">${p.displayName}</div>
    </div>
  `;

  container.innerHTML = `
    <div class="battle-modal-inner" style="max-width: 850px; width: 95%; height: 85vh; display: flex; flex-direction: column; position: relative;">
      <button class="modal-close" id="btn-close-battle">✕</button>
      
      <div class="battle-modal-header" style="background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 1rem 3rem 1rem 1rem;">
        <h2 class="battle-modal-title" style="color: var(--gold); margin: 0; font-size: 1.2rem;">⚔️ ${match.team1.name} vs ${match.team2.name}</h2>
      </div>

      <div class="battle-modal-tabs">
        <button class="battle-tab active" id="bm-tab-sim">🎥 Simulação</button>
        <button class="battle-tab" id="bm-tab-matchups">📊 Resumos 1v1</button>
        <button class="battle-tab" id="bm-tab-log">📜 Log Completo</button>
      </div>
      
      <!-- Simulação Panel -->
      <div class="battle-modal-content" id="bm-content-sim" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; padding: 1rem;">
        <div class="bm-teams-container" style="margin-top: 0;">
          <!-- Time 1 -->
          <div class="bm-team bm-team1">
            <h3 class="bm-team-name">${match.team1.name}</h3>
            <div class="bm-roster" id="bm-roster-1">
              ${t1.map(p => renderPokemon(p)).join('')}
            </div>
          </div>
          
          <div class="bm-vs">VS</div>
          
          <!-- Time 2 -->
          <div class="bm-team bm-team2">
            <h3 class="bm-team-name">${match.team2.name}</h3>
            <div class="bm-roster" id="bm-roster-2">
              ${t2.map(p => renderPokemon(p, true)).join('')}
            </div>
          </div>
        </div>
        
        <div class="bm-log-container" id="bm-log-container" style="flex: 1; overflow-y: auto;">
          <!-- Logs appear here sequentially -->
        </div>
        
        <div class="bm-controls" style="margin-top: 1rem;">
          <button id="bm-btn-skip" class="btn-primary" style="width: 100%;">Pular Simulação</button>
        </div>
      </div>

      <!-- Resumos 1v1 Panel -->
      <div class="battle-modal-content" id="bm-content-matchups" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 1rem;">
        <div style="margin-bottom: 1rem; text-align: center; color: var(--text-2); font-size: 0.95rem;">
          Vencedor: <b style="color: var(--gold);">${match.winner.name}</b> em ${match.totalTurns || 0} turnos
        </div>
        <div class="matchup-list">
          ${renderMatchupRows(match.matchups)}
        </div>
      </div>

      <!-- Log Completo Panel -->
      <div class="battle-modal-content" id="bm-content-log" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 1rem;">
        <div class="bm-log-container" id="bm-log-container-full" style="flex: 1; overflow-y: auto;">
          ${logs.map(event => `<div class="bm-log-entry type-${event.type}">${event.message}</div>`).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  
  // Close events
  container.querySelector('#btn-close-battle').addEventListener('click', closeBattleModal);

  // Skip simulation event
  const skipBtn = container.querySelector('#bm-btn-skip');
  skipBtn.addEventListener('click', () => {
    skipSimulation(logs, t1, t2);
  });

  // Tab Elements
  const tabSim = container.querySelector('#bm-tab-sim');
  const tabMatchups = container.querySelector('#bm-tab-matchups');
  const tabLog = container.querySelector('#bm-tab-log');

  // Content Panels
  const contentSim = container.querySelector('#bm-content-sim');
  const contentMatchups = container.querySelector('#bm-content-matchups');
  const contentLog = container.querySelector('#bm-content-log');

  tabSim.addEventListener('click', () => {
    tabSim.classList.add('active');
    tabMatchups.classList.remove('active');
    tabLog.classList.remove('active');

    contentSim.style.display = 'flex';
    contentMatchups.style.display = 'none';
    contentLog.style.display = 'none';
  });

  tabMatchups.addEventListener('click', () => {
    skipSimulation(logs, t1, t2);

    tabSim.classList.remove('active');
    tabMatchups.classList.add('active');
    tabLog.classList.remove('active');

    contentSim.style.display = 'none';
    contentMatchups.style.display = 'flex';
    contentLog.style.display = 'none';
  });

  tabLog.addEventListener('click', () => {
    skipSimulation(logs, t1, t2);

    tabSim.classList.remove('active');
    tabMatchups.classList.remove('active');
    tabLog.classList.add('active');

    contentSim.style.display = 'none';
    contentMatchups.style.display = 'none';
    contentLog.style.display = 'flex';
  });

  startSimulation(logs, t1, t2);
}

function renderMatchupRows(matchups) {
  return matchups?.map(m => `
    <div class="matchup-row" style="margin-bottom: 0.5rem;">
      <div class="matchup-side ${m.winner.team === 1 ? 'winner left' : 'loser left'}">
        <span class="matchup-name">${m.winner.team === 1 ? m.winner.name : m.loser.name}</span>
        <img class="matchup-sprite" src="${m.winner.team === 1 ? m.winner.sprite : m.loser.sprite}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${m.winner.team === 1 ? m.winner.id : m.loser.id}.png'">
      </div>
      <span class="matchup-vs">VS</span>
      <div class="matchup-side ${m.winner.team === 2 ? 'winner right' : 'loser right'}">
        <img class="matchup-sprite" src="${m.winner.team === 2 ? m.winner.sprite : m.loser.sprite}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${m.winner.team === 2 ? m.winner.id : m.loser.id}.png'">
        <span class="matchup-name">${m.winner.team === 2 ? m.winner.name : m.loser.name}</span>
      </div>
    </div>
  `).join('') || '<p style="text-align: center; color: var(--text-3);">Resumos indisponíveis.</p>';
}

function startSimulation(logs, t1, t2) {
  let logIndex = 0;
  const logContainer = container.querySelector('#bm-log-container');
  
  if (interval) clearInterval(interval);
  
  interval = setInterval(() => {
    const isVisibleSim = container.querySelector('#bm-content-sim').style.display !== 'none';
    
    if (logIndex >= logs.length) {
      clearInterval(interval);
      interval = null;
      const skipBtn = container.querySelector('#bm-btn-skip');
      if (skipBtn) skipBtn.style.display = 'none';
      return;
    }
    
    const event = logs[logIndex];
    if (logContainer) {
      appendLog(event, logContainer);
      if (isVisibleSim) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
    
    if (event.type === 'faint') {
      const pokeName = extractBoldName(event.message);
      if (pokeName) markFainted(pokeName, t1, t2);
      playSFX('faint');
    } else if (event.type === 'switch') {
      const pokeName = extractBoldName(event.message);
      if (pokeName && event.message.includes('entra em campo')) {
        markActive(pokeName, t1, t2);
      }
      playSFX('click');
    } else if (event.type === 'use') {
      playSFX('hit');
    }
    
    logIndex++;
  }, 45); 
}

function skipSimulation(logs, t1, t2) {
  if (interval) clearInterval(interval);
  interval = null;
  
  const logContainer = container.querySelector('#bm-log-container');
  if (logContainer) {
    logContainer.innerHTML = ''; 
    logs.forEach(event => {
      appendLog(event, logContainer);
      if (event.type === 'faint') {
        const pokeName = extractBoldName(event.message);
        if (pokeName) markFainted(pokeName, t1, t2);
      } else if (event.type === 'switch') {
        const pokeName = extractBoldName(event.message);
        if (pokeName && event.message.includes('entra em campo')) {
          markActive(pokeName, t1, t2);
        }
      }
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  
  const skipBtn = container.querySelector('#bm-btn-skip');
  if (skipBtn) skipBtn.style.display = 'none';
}

function appendLog(event, containerEl) {
  const el = document.createElement('div');
  el.className = `bm-log-entry type-${event.type}`;
  el.innerHTML = event.message;
  containerEl.appendChild(el);
}

function extractBoldName(msg) {
  const match = msg.match(/<b>(.*?)<\/b>/);
  return match ? match[1] : null;
}

function markFainted(name, t1, t2) {
  let p = t1.find(x => x.displayName === name && !x.fainted);
  if (!p) p = t2.find(x => x.displayName === name && !x.fainted);
  
  if (p) {
    p.fainted = true;
    p.active = false;
    updatePokemonUI(p);
  }
}

function markActive(name, t1, t2) {
  let isT1 = false;
  let p = t1.find(x => x.displayName === name && !x.fainted);
  if (p) isT1 = true;
  else p = t2.find(x => x.displayName === name && !x.fainted);
  
  if (p) {
    if (isT1) t1.forEach(x => { x.active = false; updatePokemonUI(x); });
    else t2.forEach(x => { x.active = false; updatePokemonUI(x); });
    
    p.active = true;
    updatePokemonUI(p);
  }
}

function updatePokemonUI(p) {
  if (!container) return;
  const el = container.querySelector(`#bm-poke-${p.uniqueId}`);
  if (el) {
    if (p.fainted) el.classList.add('fainted');
    else el.classList.remove('fainted');
    
    if (p.active && !p.fainted) el.classList.add('active');
    else el.classList.remove('active');
  }
}

export function closeBattleModal() {
  if (interval) clearInterval(interval);
  interval = null;
  if (container) {
    container.remove();
    container = null;
  }
  if (closeCallback) {
    const cb = closeCallback;
    closeCallback = null;
    cb();
  }
}
