// src/lib/sounds.js
// Gerenciador central de trilhas sonoras (BGM) e efeitos (SFX) do jogo

const SOUNDS = {
  // BGMs (Músicas de Fundo)
  lobby: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm/title.mp3',
  draft: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm/menu.mp3',
  battle: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm/battle_kanto_gym.mp3',
  victory: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm/bw/victory_champion.mp3',

  // SFX (Efeitos Sonoros)
  click: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/ui/select.wav',
  hover: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/pb_move.wav',
  select: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/buy.wav',
  turnAlert: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/shing.wav', // Alerta quando for a vez do jogador
  boosterOpen: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/egg_hatch.wav',
  cardFlip: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/egg_crack.wav',
  shiny: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/sparkle.wav',
  hit: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/hit.wav',
  faint: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/faint.wav',
  error: 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/ui/error.wav',
};

let isMuted = localStorage.getItem('game_muted') === 'true';
let currentBgmAudio = null;
let currentBgmType = null;
let bgmVolume = 0.25; // Volume de BGM mais baixo para agradar os ouvidos
let sfxVolume = 0.5;

export function initSounds() {
  // Registra ouvinte global para iniciar música após o primeiro clique do usuário
  // (Prevenindo restrições de autoplay dos navegadores)
  const handleFirstInteraction = () => {
    if (currentBgmAudio && currentBgmAudio.paused && !isMuted) {
      currentBgmAudio.play().catch(() => {});
    }
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('keydown', handleFirstInteraction);
  };
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('keydown', handleFirstInteraction);
}

export function playBGM(type) {
  if (currentBgmType === type) {
    // Se já estiver tocando, garante que o volume esteja certo
    if (currentBgmAudio) {
      currentBgmAudio.volume = isMuted ? 0 : bgmVolume;
    }
    return;
  }

  // Fade-out da BGM anterior
  if (currentBgmAudio) {
    const prevAudio = currentBgmAudio;
    let vol = prevAudio.volume;
    const fadeOut = setInterval(() => {
      vol = Math.max(0, vol - 0.05);
      prevAudio.volume = vol;
      if (vol <= 0) {
        clearInterval(fadeOut);
        prevAudio.pause();
      }
    }, 30);
  }

  currentBgmType = type;
  const url = SOUNDS[type];
  if (!url) return;

  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = isMuted ? 0 : bgmVolume;
  currentBgmAudio = audio;

  audio.play().catch(err => {
    console.warn("Autoplay bloqueado pelo navegador. Iniciando BGM no primeiro clique do usuário.");
  });
}

export function stopBGM() {
  if (currentBgmAudio) {
    currentBgmAudio.pause();
    currentBgmAudio = null;
    currentBgmType = null;
  }
}

export function playSFX(type) {
  if (isMuted) return;
  const url = SOUNDS[type];
  if (!url) return;

  try {
    const audio = new Audio(url);
    audio.volume = sfxVolume;
    audio.play().catch(err => {
      // Falha silenciosa se for bloqueado
    });
  } catch (err) {
    console.error("Erro ao tocar SFX:", err);
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('game_muted', String(isMuted));

  if (currentBgmAudio) {
    currentBgmAudio.volume = isMuted ? 0 : bgmVolume;
    if (!isMuted && currentBgmAudio.paused) {
      currentBgmAudio.play().catch(() => {});
    }
  }

  // Dispara evento global para sincronizar ícones de mute nas telas
  window.dispatchEvent(new CustomEvent('mute_changed', { detail: { isMuted } }));
  return isMuted;
}

export function getMuteState() {
  return isMuted;
}

export function attachMuteToggleListener(btnId, callback) {
  const updateIcon = (btn, muted) => {
    if (btn) {
      btn.innerHTML = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Ativar som' : 'Mutar som';
    }
  };

  const btn = document.getElementById(btnId);
  if (btn) {
    updateIcon(btn, isMuted);
    btn.onclick = (e) => {
      e.stopPropagation();
      const newMuted = toggleMute();
      updateIcon(btn, newMuted);
      playSFX('click');
      if (callback) callback(newMuted);
    };
  }

  // Ouvinte de sincronização
  const syncListener = (e) => {
    const targetBtn = document.getElementById(btnId);
    if (targetBtn) {
      updateIcon(targetBtn, e.detail.isMuted);
    }
  };

  window.addEventListener('mute_changed', syncListener);
  return () => window.removeEventListener('mute_changed', syncListener);
}
