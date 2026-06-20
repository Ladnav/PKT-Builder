// src/lib/rank.js
// Auxiliar para determinar Rank e Tier de ELO do jogador

export function getRankInfo(points) {
  const pts = Math.max(0, points || 0);
  
  if (pts < 100) {
    return { 
      name: 'Pato', 
      tier: '', 
      icon: '🦆', 
      fullName: 'Pato 🦆', 
      color: '#94a3b8' 
    };
  }
  
  const ranks = [
    { name: 'Madeira', icon: '🪵', color: '#a16207' },
    { name: 'Ferro', icon: '⛓️', color: '#64748b' },
    { name: 'Ouro', icon: '🪙', color: '#eab308' },
    { name: 'Platina', icon: '🛡️', color: '#38bdf8' },
    { name: 'Diamante', icon: '💎', color: '#6366f1' }
  ];

  if (pts >= 2100) {
    return { 
      name: 'Mestre', 
      tier: '', 
      icon: '👑', 
      fullName: 'Mestre 👑', 
      color: '#f43f5e' 
    };
  }

  // Cada rank intermediário tem 4 tiers de 100 pontos cada.
  // Madeira (100 - 499), Ferro (500 - 899), Ouro (900 - 1299), Platina (1300 - 1699), Diamante (1700 - 2099)
  const rankIdx = Math.floor((pts - 100) / 400);
  const rank = ranks[rankIdx] || ranks[0];
  const rankOffset = (pts - 100) % 400;
  
  // Tier 4 (mais baixo) para offset 0-99
  // Tier 3 para offset 100-199
  // Tier 2 para offset 200-299
  // Tier 1 (mais alto) para offset 300-399
  const tier = 4 - Math.floor(rankOffset / 100);

  return {
    name: rank.name,
    tier: tier,
    icon: rank.icon,
    fullName: `${rank.name} ${tier} ${rank.icon}`,
    color: rank.color
  };
}
