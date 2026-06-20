import { supabase } from '../../lib/supabase.js';

let currentChannel = null;

const EMOTES_LIST = ['👍', '🔥', '😂', '🤯', '😡', '😱', '🎉', '🏆', '🧠', '💪', '👑', '🍀', '🤫', '💀'];

export function initEmotes(container, roomId, currentUserId, currentUsername = 'Treinador') {
  // Desativado temporariamente
  return;
}

export function destroyEmotes() {
  const existing = document.getElementById('emote-bar');
  if (existing) existing.remove();
  
  if (currentChannel) {
    supabase.removeChannel(currentChannel);
    currentChannel = null;
  }
}

async function sendEmote(emoji, roomId, userId, username) {
  if (!currentChannel) return;

  // Envia via realtime broadcast
  await currentChannel.send({
    type: 'broadcast',
    event: 'emote',
    payload: { emoji, userId, username }
  });

  // Mostra pra si mesmo instantaneamente
  showFloatingEmote(emoji, userId, username);
}

function showFloatingEmote(emoji, userId, username = 'Treinador') {
  const floating = document.createElement('div');
  floating.className = 'floating-emote';
  
  const iconSpan = document.createElement('span');
  iconSpan.textContent = emoji;
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'floating-emote-name';
  nameSpan.textContent = username;
  
  floating.appendChild(iconSpan);
  floating.appendChild(nameSpan);

  // Lógica para posicionar: se encontrarmos o avatar do usuário, sai dele. Senão, sai aleatoriamente na tela.
  const userAvatar = document.querySelector(`[data-user-id="${userId}"]`);
  
  if (userAvatar) {
    const rect = userAvatar.getBoundingClientRect();
    floating.style.left = `${rect.left + rect.width / 2}px`;
    floating.style.top = `${rect.top}px`;
  } else {
    // Random na tela perto do centro/baixo
    floating.style.left = `${20 + Math.random() * 60}vw`;
    floating.style.top = `${60 + Math.random() * 20}vh`;
  }

  // Desvia a trajetória um pouco pra não sobrepor exatamente
  const spread = (Math.random() - 0.5) * 50;
  floating.style.setProperty('--spread', `${spread}px`);

  document.body.appendChild(floating);

  setTimeout(() => {
    floating.remove();
  }, 2000);
}
