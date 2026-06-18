// src/ui/screens/AuthScreen.js
import { supabase } from '../../lib/supabase.js';

let container = null;
let isSignUp = false;
let errorMessage = '';
let loading = false;

export function render(cont) {
  container = cont;
  renderScreen();
}

function renderScreen() {
  container.innerHTML = `
    <div class="auth-bg">
      <div class="home-particles" id="auth-particles"></div>
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="logo-badge">⚡</div>
            <h1 class="logo-title">Poké<span>Champion</span></h1>
            <p class="logo-sub">${isSignUp ? 'Crie sua conta para jogar online' : 'Faça login para gerenciar seu time'}</p>
          </div>

          <form class="auth-form" id="auth-form">
            ${isSignUp ? `
              <div class="form-group">
                <label for="username">Treinador (Username)</label>
                <input type="text" id="username" placeholder="Seu nome no jogo" required minlength="3" maxlength="15" autocomplete="username" />
              </div>
            ` : ''}

            <div class="form-group">
              <label for="email">E-mail</label>
              <input type="email" id="email" placeholder="seu@email.com" required autocomplete="email" />
            </div>

            <div class="form-group">
              <label for="password">Senha</label>
              <input type="password" id="password" placeholder="••••••••" required minlength="6" autocomplete="current-password" />
            </div>

            ${errorMessage ? `<div class="auth-error">⚠️ ${errorMessage}</div>` : ''}

            <button type="submit" class="btn-start btn-auth" ${loading ? 'disabled' : ''}>
              ${loading ? '<span class="spinner"></span> Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
            </button>
          </form>

          <div class="auth-toggle">
            <p>
              ${isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}
              <button class="toggle-link" id="toggle-auth-mode">
                ${isSignUp ? 'Entrar na minha conta' : 'Criar uma conta grátis'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  renderParticles();
  attachEvents();
}

function renderParticles() {
  const pContainer = document.getElementById('auth-particles');
  if (!pContainer) return;
  const symbols = ['⚡','🔥','💧','🌿','❄️','👊','☠️','🔮','🐉','🌑'];
  for (let i = 0; i < 15; i++) {
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
    pContainer.appendChild(el);
  }
}

function attachEvents() {
  const form = container.querySelector('#auth-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loading) return;

      loading = true;
      errorMessage = '';
      renderScreen();

      const email = container.querySelector('#email').value;
      const password = container.querySelector('#password').value;
      const username = isSignUp ? container.querySelector('#username').value : '';

      try {
        if (isSignUp) {
          // Cadastro
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: username
              }
            }
          });

          if (error) throw error;

          // Se a confirmação de e-mail estiver ativa no Supabase, avisa o usuário.
          // Geralmente para projetos novos do Supabase ela está ativa por padrão.
          // Se não estiver, o login é imediato.
          if (data?.user && data.session === null) {
            errorMessage = 'Conta criada! Verifique seu e-mail para confirmar o cadastro e poder fazer login.';
            isSignUp = false; // Alterna para login para o usuário tentar logar
          }
        } else {
          // Login
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (error) throw error;
        }
      } catch (err) {
        errorMessage = err.message || 'Erro ao processar requisição';
      } finally {
        loading = false;
        renderScreen();
      }
    });
  }

  const toggleBtn = container.querySelector('#toggle-auth-mode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isSignUp = !isSignUp;
      errorMessage = '';
      renderScreen();
    });
  }
}

export function destroy() {}
