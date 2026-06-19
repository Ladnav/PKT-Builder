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
            <div class="form-group">
              <label for="username">Treinador (Username)</label>
              <input type="text" id="username" placeholder="Seu nome no jogo" required minlength="3" maxlength="15" autocomplete="username" />
            </div>

            <div class="form-group">
              <label for="password">Senha</label>
              <input type="password" id="password" placeholder="Sua senha (ex: 123)" required minlength="3" autocomplete="current-password" />
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

function cleanUsernameForEmail(username) {
  // Remove acentos, espaços e caracteres especiais para criar um e-mail válido interno
  return username
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

            const username = container.querySelector('#username').value.trim();
      const password = container.querySelector('#password').value;
      
      // Gera o e-mail fantasma correspondente
      const dummyEmail = `${cleanUsernameForEmail(username)}@pkt.com`;
      // Gera uma senha complexa interna para satisfazer a política do Supabase (Letra Maiúscula, Minúscula, Número, Símbolo)
      const securePassword = `${password}Pkt@123`;

      try {
        if (isSignUp) {
          // Cadastro
          const { data, error } = await supabase.auth.signUp({
            email: dummyEmail,
            password: securePassword,
            options: {
              data: {
                full_name: username
              }
            }
          });

          if (error) throw error;

          // Como usamos e-mail fictício, fazemos login automático após cadastro
          const { error: loginErr } = await supabase.auth.signInWithPassword({
            email: dummyEmail,
            password: securePassword
          });
          
          if (loginErr) throw loginErr;
        } else {
          // Login
          const { error } = await supabase.auth.signInWithPassword({
            email: dummyEmail,
            password: securePassword
          });
          if (error) throw error;
        }
      } catch (err) {
        errorMessage = err.message || 'Erro ao processar requisição';
        // Traduz erros comuns do Supabase para ajudar o usuário
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Usuário ou senha incorretos.';
        } else if (errorMessage.includes('User already registered')) {
          errorMessage = 'Este treinador já está cadastrado. Escolha outro nome.';
        }
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
