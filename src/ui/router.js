// src/ui/router.js
// Roteador simples entre telas

const screens = {};
let currentScreen = null;
let appContainer = null;

export function initRouter(container) {
  appContainer = container;
}

export function registerScreen(name, screenModule) {
  screens[name] = screenModule;
}

export function navigate(name, params = {}) {
  if (currentScreen?.destroy) currentScreen.destroy();

  appContainer.innerHTML = '';
  appContainer.className = `screen screen-${name}`;

  const screen = screens[name];
  if (!screen) {
    appContainer.innerHTML = `<p>Tela "${name}" não encontrada.</p>`;
    return;
  }

  currentScreen = screen;
  screen.render(appContainer, params);

  // Animação de entrada
  appContainer.style.opacity = '0';
  appContainer.style.transform = 'translateY(10px)';
  requestAnimationFrame(() => {
    appContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    appContainer.style.opacity = '1';
    appContainer.style.transform = 'translateY(0)';
  });
}

export function getCurrentScreen() {
  return currentScreen;
}
