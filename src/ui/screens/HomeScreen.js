// src/ui/screens/HomeScreen.js
import { navigate } from '../router.js';
import { DRAFT_MODES_INFO } from '../../engine/draft.js';

let selectedMode = 'type';

export function render(container) {
  container.innerHTML = `
    <div class="home-bg">
      <div class="home-particles" id="particles"></div>
      <div class="home-content">
        <div class="home-logo">
          <div class="logo-badge">⚡</div>
          <h1 class="logo-title">Poké<span>Champion</span></h1>
          <p class="logo-sub">Monte seu time. Domine o campeonato.</p>
        </div>

        <div class="home-section">
          <h2 class="section-title">Escolha o modo de draft</h2>
          <div class="mode-cards">
            ${Object.entries(DRAFT_MODES_INFO).map(([key, info]) => `
              <div class="mode-card ${key === selectedMode ? 'active' : ''}" data-mode="${key}">
                <div class="mode-icon">${info.icon}</div>
                <h3>${info.name}</h3>
                <p>${info.description}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="home-section">
          <h2 class="section-title">Configuração do torneio</h2>
          <div class="config-grid">
            <div class="config-item">
              <span class="config-label">👥 Participantes</span>
              <span class="config-value">8 times (você + 7 BOTs)</span>
            </div>
            <div class="config-item">
              <span class="config-label">🎴 Pokémons por time</span>
              <span class="config-value">6 Pokémons</span>
            </div>
            <div class="config-item">
              <span class="config-label">🏆 Formato</span>
              <span class="config-value">Mata-mata (Quartas → Final)</span>
            </div>
            <div class="config-item">
              <span class="config-label">🌍 Gerações</span>
              <span class="config-value">Gen I – IV (493 Pokémons)</span>
            </div>
          </div>
        </div>

        <button class="btn-start" id="btn-start">
          <span>⚔️</span> Iniciar Campeonato
        </button>
      </div>
    </div>
  `;

  // Partículas de fundo
  renderParticles();

  // Selecionar modo
  container.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      container.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Botão iniciar
  container.querySelector('#btn-start').addEventListener('click', () => {
    navigate('draft', { mode: selectedMode });
  });
}

function renderParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const symbols = ['⚡','🔥','💧','🌿','❄️','👊','☠️','🔮','🐉','🌑'];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 5}s;
      animation-duration: ${4 + Math.random() * 4}s;
      font-size: ${1 + Math.random() * 1.5}rem;
      opacity: ${0.05 + Math.random() * 0.1};
    `;
    container.appendChild(el);
  }
}

export function destroy() {}
