// src/ui/screens/AuthScreen.js
import { supabase } from '../../lib/supabase.js';

let container = null;
let isSignUp = false;
let errorMessage = '';
let loading = false;

export function render(cont) {
  container = cont;
  isSignUp = false;
  errorMessage = '';
  loading = false;
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
              ${loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
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
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const pokeId = Math.floor(Math.random() * 151) + 1;
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`;
    
    const img = document.createElement('img');
    img.src = imgUrl;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    `;
    el.appendChild(img);
    
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 5}s;
      animation-duration: ${6 + Math.random() * 6}s;
      width: ${32 + Math.random() * 32}px;
      height: ${32 + Math.random() * 32}px;
      opacity: ${0.08 + Math.random() * 0.12};
      position: absolute;
      pointer-events: none;
    `;
    pContainer.appendChild(el);
  }
}

// Converte o username em e-mail fantasma válido
function toFakeEmail(username) {
  const clean = username
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${clean}@gmail.com`;
}

// Cria senha complexa internamente para satisfazer políticas do Supabase
function toSecurePassword(password) {
  return `${password}Pkt@123`;
}

// Extrai mensagem legível de qualquer formato de erro
function getErrorMessage(err) {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;

  const raw = err.message || err.error_description || err.msg || err.error || '';
  if (raw && raw !== '{}') return raw;

  // Último recurso: serializa
  try {
    const s = JSON.stringify(err);
    if (s && s !== '{}') return `Erro do servidor: ${s}`;
  } catch (_) {}

  return 'Erro de conexão com o servidor. Verifique se o projeto do Supabase está ativo.';
}

function attachEvents() {
  const form = container.querySelector('#auth-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loading) return;

      // Lê os valores ANTES de re-renderizar (para não perder os inputs)
      const username = container.querySelector('#username').value.trim();
      const password = container.querySelector('#password').value;

      if (!username || !password) {
        errorMessage = 'Preencha o nome e a senha.';
        renderScreen();
        return;
      }

      const email = toFakeEmail(username);
      const securePassword = toSecurePassword(password);

      loading = true;
      errorMessage = '';
      renderScreen();

      try {
        console.log('🔐 Tentando auth com:', { email, isSignUp });

        if (isSignUp) {
          // Tentativa de cadastro
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password: securePassword,
            options: {
              data: { full_name: username }
            }
          });

          console.log('📋 SignUp response:', { data: signUpData, error: signUpError });
          if (signUpError) throw signUpError;

          // Login automático após cadastro
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: securePassword
          });

          console.log('🔑 Login response:', { data: loginData, error: loginError });
          if (loginError) throw loginError;

        } else {
          // Login direto
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: securePassword
          });

          console.log('🔑 Login response:', { data: loginData, error: loginError });
          if (loginError) throw loginError;
        }

      } catch (err) {
        console.error('❌ AUTH ERROR completo:', JSON.stringify(err, null, 2));
        console.error('Status:', err?.status, '| Message:', err?.message, '| Name:', err?.name);
        let msg = getErrorMessage(err);

        // Traduções de erros comuns
        if (isSignUp && (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))) {
          // Acontece quando o usuário já existe: signUp "silencia" o erro, mas o login automático falha
          msg = 'Este treinador já está cadastrado com outra senha. Clique em "Entrar" e use a senha original.';
        } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
          msg = 'Usuário ou senha incorretos.';
        } else if (msg.includes('User already registered') || msg.includes('already registered')) {
          msg = 'Este treinador já está cadastrado. Escolha outro nome ou faça login.';
        } else if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
          msg = 'Acesso bloqueado. Desative a opção "Confirm email" no painel do Supabase → Authentication → Email.';
        } else if (msg.includes('invalid format') || msg.includes('Unable to validate')) {
          msg = 'Nome de usuário inválido. Use apenas letras e números sem espaços.';
        } else if (err.status === 500 || msg.includes('500')) {
          msg = 'Erro no servidor. Verifique se o projeto do Supabase está ativo.';
        }

        errorMessage = msg;

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
