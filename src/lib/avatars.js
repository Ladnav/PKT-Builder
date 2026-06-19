// src/lib/avatars.js

const BOT_AVATARS = {
  'Treinador Red': 'https://play.pokemonshowdown.com/sprites/trainers/red.png',
  'Treinador Blue': 'https://play.pokemonshowdown.com/sprites/trainers/blue.png',
  'Ash Ketchum': 'https://play.pokemonshowdown.com/sprites/trainers/ash.png',
  'Gary Oak': 'https://play.pokemonshowdown.com/sprites/trainers/blue-gen7.png',
  'Campeã Cynthia': 'https://play.pokemonshowdown.com/sprites/trainers/cynthia.png',
  'Cynthia': 'https://play.pokemonshowdown.com/sprites/trainers/cynthia.png',
  'Campeão Lance': 'https://play.pokemonshowdown.com/sprites/trainers/lance.png',
  'Misty': 'https://play.pokemonshowdown.com/sprites/trainers/misty.png',
  'Brock': 'https://play.pokemonshowdown.com/sprites/trainers/brock.png',
  'Steven Stone': 'https://play.pokemonshowdown.com/sprites/trainers/steven.png',
  'Leon': 'https://play.pokemonshowdown.com/sprites/trainers/leon.png',
  'N': 'https://play.pokemonshowdown.com/sprites/trainers/n.png',
  'Cyrus': 'https://play.pokemonshowdown.com/sprites/trainers/cyrus.png',
  'Giovanni': 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png'
};

/**
 * Retorna a URL do avatar do treinador (bot ou humano)
 * @param {object} participant 
 * @returns {string}
 */
export function getTrainerAvatar(participant) {
  if (!participant) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Treinador';

  const name = participant.bot_name || participant.name || '';
  const isBot = !!(
    participant.is_bot || 
    participant.isBot || 
    (!participant.isPlayer && !participant.profile && !participant.user_id && name !== 'Você' && name !== 'Jogador')
  );

  if (isBot) {
    // Procura correspondência nos nomes conhecidos
    for (const [key, val] of Object.entries(BOT_AVATARS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) {
        return val;
      }
    }
    // Fallback para outros bots genéricos (como Substituto ou Treinador Desistente)
    return 'https://play.pokemonshowdown.com/sprites/trainers/scientist.png';
  }

  // Para jogadores reais, tenta pegar do perfil cadastrado
  const avatarUrl = participant.profile?.avatar_url || participant.avatar_url;
  if (avatarUrl) return avatarUrl;

  // Fallback usando o DiceBear com seed do nome
  const username = participant.profile?.username || participant.username || name || 'Jogador';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
}
