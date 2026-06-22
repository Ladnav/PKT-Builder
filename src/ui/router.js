// src/ui/router.js
// Roteador simples entre telas

const screens = {};
let currentScreen = null;
let currentScreenName = null;
let appContainer = null;

export function initRouter(container) {
  appContainer = container;
}

export function registerScreen(name, screenModule) {
  screens[name] = screenModule;
}

export function navigate(name, params = {}) {
  if (currentScreen?.destroy) currentScreen.destroy();

  // Salva a rota atual no sessionStorage para restaurar após refresh de token
  if (name !== 'auth') {
    try {
      sessionStorage.setItem('pkt_route', JSON.stringify({ name, params }));
    } catch (_) {}
  } else {
    sessionStorage.removeItem('pkt_route');
  }

  appContainer.innerHTML = '';
  appContainer.className = `screen screen-${name}`;

  const screen = screens[name];
  if (!screen) {
    appContainer.innerHTML = `<p>Tela "${name}" não encontrada.</p>`;
    return;
  }

  currentScreen = screen;
  currentScreenName = name;
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

export function getCurrentScreenName() {
  return currentScreenName;
}
