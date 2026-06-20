// src/main.js — Entry point do PokéChampion

import { initRouter, registerScreen, navigate } from './ui/router.js';
import * as AuthScreen     from './ui/screens/AuthScreen.js';
import * as HomeScreen     from './ui/screens/HomeScreen.js';
import * as LobbyScreen    from './ui/screens/LobbyScreen.js';
import * as DraftScreen    from './ui/screens/DraftScreen.js';
import * as BracketScreen  from './ui/screens/BracketScreen.js';
import { supabase }        from './lib/supabase.js';
import { initSounds }      from './lib/sounds.js';

// Inicializa a app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  initSounds();
  initRouter(appContainer);
  registerScreen('auth',    AuthScreen);
  registerScreen('home',    HomeScreen);
  registerScreen('lobby',   LobbyScreen);
  registerScreen('draft',   DraftScreen);
  registerScreen('bracket', BracketScreen);

  // Monitora alterações no estado de login
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      // Login explícito: tenta restaurar rota salva ou vai pra home
      const saved = sessionStorage.getItem('pkt_route');
      if (saved) {
        try {
          const { name, params } = JSON.parse(saved);
          navigate(name, params);
          return;
        } catch (_) {}
      }
      navigate('home');

    } else if (event === 'SIGNED_OUT') {
      // Logout: limpa rota salva e vai pra auth
      sessionStorage.removeItem('pkt_route');
      navigate('auth');

    } else if (event === 'INITIAL_SESSION') {
      // Carga inicial da página (refresh, minimizar/restaurar)
      if (session) {
        const saved = sessionStorage.getItem('pkt_route');
        if (saved) {
          try {
            const { name, params } = JSON.parse(saved);
            navigate(name, params);
            return;
          } catch (_) {}
        }
        navigate('home');
      } else {
        navigate('auth');
      }
    }
    // TOKEN_REFRESHED e outros eventos: ignora (não muda a tela)
  });
});

