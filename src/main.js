// src/main.js — Entry point do PokéChampion

import { initRouter, registerScreen, navigate } from './ui/router.js';
import * as HomeScreen    from './ui/screens/HomeScreen.js';
import * as DraftScreen   from './ui/screens/DraftScreen.js';
import * as BracketScreen from './ui/screens/BracketScreen.js';

// Inicializa a app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  initRouter(appContainer);
  registerScreen('home',    HomeScreen);
  registerScreen('draft',   DraftScreen);
  registerScreen('bracket', BracketScreen);

  navigate('home');
});
