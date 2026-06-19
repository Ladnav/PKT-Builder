import { supabase } from '../../lib/supabase.js';

let currentChannel = null;

const EMOTES_LIST = ['👍', '🔥', '😂', '🤯', '😡', '😱'];

export function initEmotes(container, roomId, currentUserId) {
  // Cleanup se já existir
  destroyEmotes();

  // Cria a UI da barra de emotes
  const emoteBar = document.createElement('div');
  emoteBar.id = 'emote-bar';
  emoteBar.className = 'emote-bar';
  
  EMOTES_LIST.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emote-btn';
    btn.textContent = emoji;
    btn.onclick = () => sendEmote(emoji, roomId, currentUserId);
    emoteBar.appendChild(btn);
  });

  container.appendChild(emoteBar);

  // Inscreve no canal de broadcast da sala
  currentChannel = supabase.channel(`room-${roomId}-emotes`);
  
  currentChannel
    .on('broadcast', { event: 'emote' }, (payload) => {
      showFloatingEmote(payload.payload.emoji, payload.payload.userId);
    })
    .subscribe();
}

export function destroyEmotes() {
  const existing = document.getElementById('emote-bar');
  if (existing) existing.remove();
  
  if (currentChannel) {
    supabase.removeChannel(currentChannel);
    currentChannel = null;
  }
}

async function sendEmote(emoji, roomId, userId) {
  if (!currentChannel) return;

  // Envia via realtime broadcast
  await currentChannel.send({
    type: 'broadcast',
    event: 'emote',
    payload: { emoji, userId }
  });

  // Mostra pra si mesmo instantaneamente
  showFloatingEmote(emoji, userId);
}

function showFloatingEmote(emoji, userId) {
  const floating = document.createElement('div');
  floating.className = 'floating-emote';
  floating.textContent = emoji;

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
