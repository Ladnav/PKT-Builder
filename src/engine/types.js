// src/engine/types.js
// Tabela de efetividade de tipos completa — Gen 4 (18 tipos)

export const TYPE_COLORS = {
  normal:   '#A8A878',
  fire:     '#F08030',
  water:    '#6890F0',
  electric: '#F8D030',
  grass:    '#78C850',
  ice:      '#98D8D8',
  fighting: '#C03028',
  poison:   '#A040A0',
  ground:   '#E0C068',
  flying:   '#A890F0',
  psychic:  '#F85888',
  bug:      '#A8B820',
  rock:     '#B8A038',
  ghost:    '#705898',
  dragon:   '#7038F8',
  dark:     '#705848',
  steel:    '#B8B8D0',
  fairy:    '#EE99AC',
};

const iconUrl = (type) => `<img src="https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/${type}.svg" style="width:1.2em; height:1.2em; vertical-align:middle; display:inline-block; border-radius:50%;" alt="${type}" />`;

export const TYPE_ICONS = {
  normal:   iconUrl('normal'),
  fire:     iconUrl('fire'),
  water:    iconUrl('water'),
  electric: iconUrl('electric'),
  grass:    iconUrl('grass'),
  ice:      iconUrl('ice'),
  fighting: iconUrl('fighting'),
  poison:   iconUrl('poison'),
  ground:   iconUrl('ground'),
  flying:   iconUrl('flying'),
  psychic:  iconUrl('psychic'),
  bug:      iconUrl('bug'),
  rock:     iconUrl('rock'),
  ghost:    iconUrl('ghost'),
  dragon:   iconUrl('dragon'),
  dark:     iconUrl('dark'),
  steel:    iconUrl('steel'),
  fairy:    iconUrl('fairy'),
};

export const TYPE_NAMES_PT = {
  normal:   'Normal',
  fire:     'Fogo',
  water:    'Água',
  electric: 'Elétrico',
  grass:    'Planta',
  ice:      'Gelo',
  fighting: 'Lutador',
  poison:   'Veneno',
  ground:   'Terra',
  flying:   'Voador',
  psychic:  'Psíquico',
  bug:      'Inseto',
  rock:     'Pedra',
  ghost:    'Fantasma',
  dragon:   'Dragão',
  dark:     'Sombrio',
  steel:    'Aço',
  fairy:    'Fada',
};

export const ALL_TYPES = Object.keys(TYPE_COLORS);

// Tabela de efetividade: chart[attackType][defenseType] = multiplicador
// 0 = imune, 0.5 = não muito eficaz, 1 = normal, 2 = super eficaz
const chart = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// Retorna o multiplicador de efetividade de attackType contra defenseType
export function getEffectiveness(attackType, defenseType) {
  return chart[attackType]?.[defenseType] ?? 1;
}

// Calcula efetividade total contra um Pokémon com múltiplos tipos
export function getTotalEffectiveness(attackType, defenderTypes) {
  return defenderTypes.reduce((mult, defType) => mult * getEffectiveness(attackType, defType), 1);
}

// Retorna texto descritivo de efetividade
export function getEffectivenessText(multiplier) {
  if (multiplier === 0) return { text: 'Não tem efeito!', class: 'immune' };
  if (multiplier <= 0.5) return { text: 'Não é muito eficaz...', class: 'not-effective' };
  if (multiplier >= 4) return { text: 'É EXTREMAMENTE eficaz!!!', class: 'super-effective-4x' };
  if (multiplier >= 2) return { text: 'É super eficaz!', class: 'super-effective' };
  return { text: '', class: 'normal' };
}
