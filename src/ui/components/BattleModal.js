// src/ui/components/BattleModal.js

let container = null;
let interval = null;

export function renderBattleModal(match) {
  if (!match || !match.log) return;
  
  const existing = document.getElementById('battle-modal');
  if (existing) existing.remove();

  container = document.createElement('div');
  container.id = 'battle-modal';
  container.className = 'modal-overlay';
  container.style.display = 'flex';
  
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
    <div class="modal-content battle-modal-content">
      <div class="modal-header">
        <h2 style="color: var(--gold); text-align: center; width: 100%; margin: 0;">⚔️ Simulação de Batalha</h2>
        <button class="btn-close" id="btn-close-battle">×</button>
      </div>
      
      <div class="bm-teams-container">
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
      
      <div class="bm-log-container" id="bm-log-container">
        <!-- Logs appear here sequentially -->
      </div>
      
      <div class="bm-controls">
        <button id="bm-btn-skip" class="btn-primary" style="width: 100%; margin-top: 1rem;">Pular Simulação</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  
  container.querySelector('#btn-close-battle').addEventListener('click', closeBattleModal);
  container.querySelector('#bm-btn-skip').addEventListener('click', () => {
    skipSimulation(logs, t1, t2);
  });

  startSimulation(logs, t1, t2);
}

function startSimulation(logs, t1, t2) {
  let logIndex = 0;
  const logContainer = container.querySelector('#bm-log-container');
  
  if (interval) clearInterval(interval);
  
  interval = setInterval(() => {
    if (logIndex >= logs.length) {
      clearInterval(interval);
      interval = null;
      const skipBtn = container.querySelector('#bm-btn-skip');
      if (skipBtn) skipBtn.style.display = 'none';
      return;
    }
    
    const event = logs[logIndex];
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
    
    logIndex++;
    logContainer.scrollTop = logContainer.scrollHeight;
  }, 400); 
}

function skipSimulation(logs, t1, t2) {
  if (interval) clearInterval(interval);
  interval = null;
  
  const logContainer = container.querySelector('#bm-log-container');
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
  const skipBtn = container.querySelector('#bm-btn-skip');
  if (skipBtn) skipBtn.style.display = 'none';
}

function appendLog(event, container) {
  const el = document.createElement('div');
  el.className = `bm-log-entry type-${event.type}`;
  el.innerHTML = event.message;
  container.appendChild(el);
}

function extractBoldName(msg) {
  const match = msg.match(/<b>(.*?)<\/b>/);
  return match ? match[1] : null;
}

function markFainted(name, t1, t2) {
  // Encontra o primeiro Pokémon com esse nome que ainda NÃO desmaiou no estado do clone
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
}
