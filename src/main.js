// src/main.js — Entry point do PokéChampion

import { initRouter, registerScreen, navigate, getCurrentScreenName } from './ui/router.js';
import * as AuthScreen     from './ui/screens/AuthScreen.js';
import * as HomeScreen     from './ui/screens/HomeScreen.js';
import * as LobbyScreen    from './ui/screens/LobbyScreen.js';
import * as DraftScreen    from './ui/screens/DraftScreen.js';
import * as BracketScreen  from './ui/screens/BracketScreen.js';
import * as CampaignScreen from './ui/screens/CampaignScreen.js';
import { supabase }        from './lib/supabase.js';
import { initSounds }      from './lib/sounds.js';
import { initTooltipSystem } from './ui/components/TooltipSystem.js';

// Inicializa a app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  initSounds();
  initTooltipSystem();
  initRouter(appContainer);
  registerScreen('auth',    AuthScreen);
  registerScreen('home',    HomeScreen);
  registerScreen('lobby',   LobbyScreen);
  registerScreen('draft',   DraftScreen);
  registerScreen('bracket', BracketScreen);
  registerScreen('campaign', CampaignScreen);

  // Monitora alterações no estado de login
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      const current = getCurrentScreenName();
      if (current && current !== 'auth') {
        // Se já está logado em outra tela, ignora para não fechar modais/reiniciar a tela
        return;
      }
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
      const current = getCurrentScreenName();
      if (current && current !== 'auth') {
        return;
      }
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

