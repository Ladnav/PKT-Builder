// src/main.js — Entry point do PokéChampion

import { initRouter, registerScreen, navigate } from './ui/router.js';
import * as AuthScreen     from './ui/screens/AuthScreen.js';
import * as HomeScreen     from './ui/screens/HomeScreen.js';
import * as LobbyScreen    from './ui/screens/LobbyScreen.js';
import * as DraftScreen    from './ui/screens/DraftScreen.js';
import * as BracketScreen  from './ui/screens/BracketScreen.js';
import { supabase }        from './lib/supabase.js';

// Inicializa a app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  initRouter(appContainer);
  registerScreen('auth',    AuthScreen);
  registerScreen('home',    HomeScreen);
  registerScreen('lobby',   LobbyScreen);
  registerScreen('draft',   DraftScreen);
  registerScreen('bracket', BracketScreen);

  // Monitora alterações no estado de login
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      navigate('home');
    } else {
      navigate('auth');
    }
  });
});

