// src/ui/screens/CampaignScreen.js
import { navigate } from '../router.js';
import { playBGM, playSFX, attachMuteToggleListener } from '../../lib/sounds.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { PokemonCard, PokemonMiniCard } from '../components/PokemonCard.js';
import { renderBattleModal } from '../components/BattleModal.js';
import { initAlbumModal, openAlbumModal } from '../components/AlbumModal.js';
import { createBattleState, simulateBattle } from '../../engine/battle.js';
import pokemonData from '../../data/pokemon-sample.json';
import itemsData from '../../data/items-sample.json';

// CITIES CONFIGURATION
const CITIES_CONFIG = {
  pallet: {
    name: "Vila de Pallet",
    leader: "Rival Azul",
    type: "normal",
    badge: null,
    badgeName: "Começo da Jornada",
    badgeIcon: "🏡",
    badgeColor: "#94a3b8",
    x: 28, y: 70,
    stages: [
      { name: "Treinador de Rota 1", type: "NPC", team: [{ id: 25 }, { id: 143 }, { id: 59 }, { id: 25 }, { id: 143 }, { id: 59 }] },
      { name: "Rival Azul", type: "Leader", team: [
        { id: 6, item: 'life-orb' },
        { id: 9, item: 'assault-vest' },
        { id: 3, item: 'leftovers' },
        { id: 65, item: 'choice-specs' },
        { id: 59, item: 'choice-band' },
        { id: 143, item: 'leftovers', isShiny: true }
      ]}
    ]
  },
  viridian_visit: {
    name: "Cidade de Viridian (Visita)",
    leader: "Rival Azul",
    type: "normal",
    badge: null,
    badgeName: "Visita a Viridian",
    badgeIcon: "🟢",
    badgeColor: "#22c55e",
    x: 28, y: 55,
    stages: [
      { name: "Treinador da Rota 22", type: "NPC", team: [{ id: 25 }, { id: 143 }, { id: 59 }, { id: 25 }, { id: 143 }, { id: 59 }] },
      { name: "Rival Azul (Rota 22)", type: "Leader", team: [
        { id: 25, item: 'light-ball' },
        { id: 143, item: 'leftovers' },
        { id: 59, item: 'choice-band' },
        { id: 3, item: 'leftovers' },
        { id: 6, item: 'life-orb' },
        { id: 9, item: 'assault-vest' }
      ]}
    ]
  },
  pewter: {
    name: "Cidade de Pewter",
    leader: "Brock",
    type: "rock",
    badge: "gym_boulder",
    badgeName: "Insígnia da Rocha",
    badgeIcon: "🪨",
    badgeColor: "#9ca3af",
    x: 30, y: 25,
    stages: [
      { name: "Treinador Liam", type: "NPC", team: [{ id: 76 }, { id: 68 }, { id: 143 }, { id: 473 }, { id: 389 }, { id: 214 }] },
      { name: "Treinador Jerry", type: "NPC", team: [{ id: 248 }, { id: 76 }, { id: 36 }, { id: 260 }, { id: 143 }, { id: 68 }] },
      { name: "Treinadora Paula", type: "NPC", team: [{ id: 248 }, { id: 68 }, { id: 149 }, { id: 473 }, { id: 389 }, { id: 76 }] },
      { name: "Líder Brock", type: "Leader", team: [
        { id: 76, item: 'rocky-helmet' },
        { id: 248, item: 'leftovers' },
        { id: 260, item: 'sitrus-berry' },
        { id: 143, item: 'leftovers' },
        { id: 214, item: 'expert-belt' },
        { id: 9, item: 'assault-vest' }
      ]}
    ]
  },
  cerulean: {
    name: "Cidade de Cerulean",
    leader: "Misty",
    type: "water",
    badge: "gym_cascade",
    badgeName: "Insígnia da Cascata",
    badgeIcon: "💧",
    badgeColor: "#38bdf8",
    x: 65, y: 15,
    stages: [
      { name: "Treinador Daren", type: "NPC", team: [{ id: 134 }, { id: 9 }, { id: 25 }, { id: 131 }, { id: 160 }, { id: 230 }] },
      { name: "Treinador Luis", type: "NPC", team: [{ id: 395 }, { id: 230 }, { id: 80 }, { id: 350 }, { id: 134 }, { id: 9 }] },
      { name: "Treinadora Becky", type: "NPC", team: [{ id: 160 }, { id: 131 }, { id: 350 }, { id: 80 }, { id: 395 }, { id: 260 }] },
      { name: "Líder Misty", type: "Leader", team: [
        { id: 9, item: 'leftovers' },
        { id: 131, item: 'assault-vest' },
        { id: 134, item: 'sitrus-berry' },
        { id: 230, item: 'life-orb' },
        { id: 260, item: 'rocky-helmet' },
        { id: 350, item: 'shell-bell', isShiny: true }
      ]}
    ]
  },
  vermilion: {
    name: "Cidade de Vermilion",
    leader: "Lt. Surge",
    type: "electric",
    badge: "gym_thunder",
    badgeName: "Insígnia do Trovão",
    badgeIcon: "⚡",
    badgeColor: "#eab308",
    x: 72, y: 60,
    stages: [
      { name: "Treinador Jax", type: "NPC", team: [{ id: 25 }, { id: 82 }, { id: 143 }, { id: 26 }, { id: 125 }, { id: 135 }] },
      { name: "Treinador Ron", type: "NPC", team: [{ id: 125 }, { id: 26 }, { id: 123 }, { id: 82 }, { id: 25 }, { id: 135 }] },
      { name: "Treinadora Amy", type: "NPC", team: [{ id: 135 }, { id: 82 }, { id: 36 }, { id: 26 }, { id: 125 }, { id: 149 }] },
      { name: "Líder Lt. Surge", type: "Leader", team: [
        { id: 26, item: 'choice-specs' },
        { id: 82, item: 'assault-vest' },
        { id: 125, item: 'life-orb' },
        { id: 135, item: 'quick-claw' },
        { id: 468, item: 'leftovers' },
        { id: 149, item: 'rocky-helmet', isShiny: true }
      ]}
    ]
  },
  celadon: {
    name: "Cidade de Celadon",
    leader: "Erika",
    type: "grass",
    badge: "gym_rainbow",
    badgeName: "Insígnia do Arco-Íris",
    badgeIcon: "🌈",
    badgeColor: "#10b981",
    x: 48, y: 45,
    stages: [
      { name: "Treinadora Tina", type: "NPC", team: [{ id: 154 }, { id: 143 }, { id: 134 }, { id: 3 }, { id: 254 }, { id: 389 }] },
      { name: "Treinador Clara", type: "NPC", team: [{ id: 389 }, { id: 254 }, { id: 36 }, { id: 154 }, { id: 3 }, { id: 214 }] },
      { name: "Treinadora Rose", type: "NPC", team: [{ id: 3 }, { id: 254 }, { id: 154 }, { id: 389 }, { id: 131 }, { id: 468 }] },
      { name: "Líder Erika", type: "Leader", team: [
        { id: 3, item: 'leftovers' },
        { id: 154, item: 'sitrus-berry' },
        { id: 254, item: 'life-orb' },
        { id: 389, item: 'rocky-helmet' },
        { id: 468, item: 'assault-vest' },
        { id: 350, item: 'shell-bell', isShiny: true }
      ]}
    ]
  },
  fuchsia: {
    name: "Cidade de Fuchsia",
    leader: "Koga",
    type: "poison",
    badge: "gym_soul",
    badgeName: "Insígnia da Alma",
    badgeIcon: "💜",
    badgeColor: "#a855f7",
    x: 55, y: 80,
    stages: [
      { name: "Treinador Kirk", type: "NPC", team: [{ id: 94 }, { id: 3 }, { id: 197 }, { id: 461 }, { id: 229 }, { id: 359 }] },
      { name: "Treinador Ned", type: "NPC", team: [{ id: 461 }, { id: 94 }, { id: 65 }, { id: 197 }, { id: 3 }, { id: 229 }] },
      { name: "Treinadora Sue", type: "NPC", team: [{ id: 94 }, { id: 229 }, { id: 68 }, { id: 461 }, { id: 197 }, { id: 359 }] },
      { name: "Líder Koga", type: "Leader", team: [
        { id: 94, item: 'life-orb' },
        { id: 461, item: 'expert-belt' },
        { id: 3, item: 'leftovers' },
        { id: 248, item: 'rocky-helmet' },
        { id: 229, item: 'choice-specs' },
        { id: 197, item: 'sitrus-berry', isShiny: true }
      ]}
    ]
  },
  saffron: {
    name: "Cidade de Saffron",
    leader: "Sabrina",
    type: "psychic",
    badge: "gym_marsh",
    badgeName: "Insígnia do Pântano",
    badgeIcon: "🔮",
    badgeColor: "#ec4899",
    x: 65, y: 45,
    stages: [
      { name: "Treinador Igor", type: "NPC", team: [{ id: 80 }, { id: 124 }, { id: 65 }, { id: 196 }, { id: 282 }, { id: 376 }] },
      { name: "Treinador Yuri", type: "NPC", team: [{ id: 196 }, { id: 282 }, { id: 475 }, { id: 65 }, { id: 80 }, { id: 376 }] },
      { name: "Treinadora Miki", type: "NPC", team: [{ id: 376 }, { id: 282 }, { id: 196 }, { id: 475 }, { id: 124 }, { id: 65 }] },
      { name: "Líder Sabrina", type: "Leader", team: [
        { id: 65, item: 'focus-sash' },
        { id: 196, item: 'life-orb' },
        { id: 124, item: 'expert-belt' },
        { id: 282, item: 'choice-specs' },
        { id: 376, item: 'leftovers' },
        { id: 475, item: 'rocky-helmet', isShiny: true }
      ]}
    ]
  },
  cinnabar: {
    name: "Ilha de Cinnabar",
    leader: "Blaine",
    type: "fire",
    badge: "gym_volcano",
    badgeName: "Insígnia do Vulcão",
    badgeIcon: "🔥",
    badgeColor: "#ef4444",
    x: 28, y: 85,
    stages: [
      { name: "Treinador Burt", type: "NPC", team: [{ id: 38 }, { id: 136 }, { id: 59 }, { id: 6 }, { id: 126 }, { id: 157 }] },
      { name: "Treinador Cole", type: "NPC", team: [{ id: 126 }, { id: 157 }, { id: 229 }, { id: 59 }, { id: 257 }, { id: 392 }] },
      { name: "Treinador Ryan", type: "NPC", team: [{ id: 257 }, { id: 392 }, { id: 6 }, { id: 136 }, { id: 38 }, { id: 157 }] },
      { name: "Líder Blaine", type: "Leader", team: [
        { id: 6, item: 'life-orb' },
        { id: 59, item: 'choice-band' },
        { id: 38, item: 'leftovers' },
        { id: 157, item: 'choice-specs' },
        { id: 257, item: 'expert-belt' },
        { id: 392, item: 'sitrus-berry', isShiny: true }
      ]}
    ]
  },
  viridian: {
    name: "Cidade de Viridian",
    leader: "Giovanni",
    type: "ground",
    badge: "gym_earth",
    badgeName: "Insígnia da Terra",
    badgeIcon: "🟢",
    badgeColor: "#22c55e",
    x: 28, y: 55,
    stages: [
      { name: "Recruta Team Rocket", type: "NPC", team: [{ id: 76 }, { id: 68 }, { id: 143 }, { id: 445 }, { id: 260 }, { id: 473 }] },
      { name: "Recruta Rocket Fêmea", type: "NPC", team: [{ id: 260 }, { id: 473 }, { id: 389 }, { id: 76 }, { id: 248 }, { id: 143 }] },
      { name: "Admin Petrel", type: "NPC", team: [{ id: 445 }, { id: 149 }, { id: 248 }, { id: 473 }, { id: 389 }, { id: 76 }] },
      { name: "Líder Giovanni", type: "Leader", team: [
        { id: 445, item: 'life-orb' },
        { id: 248, item: 'leftovers' },
        { id: 260, item: 'rocky-helmet' },
        { id: 473, item: 'choice-band' },
        { id: 389, item: 'sitrus-berry' },
        { id: 76, item: 'assault-vest', isShiny: true }
      ]}
    ]
  },
  elite4: {
    name: "Planalto Indigo",
    leader: "Liga Pokémon",
    type: "league",
    badge: "championship",
    badgeName: "Troféu do Campeão",
    badgeIcon: "🏆",
    badgeColor: "#fbbf24",
    x: 10, y: 45,
    stages: [
      { name: "Lorelei (Elite Quatro)", type: "Elite4", team: [
        { id: 124, item: 'life-orb' },
        { id: 131, item: 'leftovers' },
        { id: 461, item: 'choice-band' },
        { id: 473, item: 'rocky-helmet' },
        { id: 9, item: 'assault-vest' },
        { id: 395, item: 'sitrus-berry' }
      ]},
      { name: "Bruno (Elite Quatro)", type: "Elite4", team: [
        { id: 68, item: 'choice-band' },
        { id: 106, item: 'life-orb' },
        { id: 107, item: 'expert-belt' },
        { id: 214, item: 'leftovers' },
        { id: 257, item: 'life-orb' },
        { id: 448, item: 'assault-vest' }
      ]},
      { name: "Agatha (Elite Quatro)", type: "Elite4", team: [
        { id: 94, item: 'life-orb' },
        { id: 197, item: 'leftovers' },
        { id: 229, item: 'choice-specs' },
        { id: 359, item: 'expert-belt' },
        { id: 94, item: 'focus-sash' },
        { id: 487, item: 'rocky-helmet' }
      ]},
      { name: "Lance (Elite Quatro)", type: "Elite4", team: [
        { id: 149, item: 'rocky-helmet' },
        { id: 230, item: 'life-orb' },
        { id: 373, item: 'choice-band' },
        { id: 445, item: 'expert-belt' },
        { id: 384, item: 'leftovers' },
        { id: 483, item: 'choice-specs' }
      ]},
      { name: "Campeã Cynthia", type: "Champion", team: [
        { id: 491, item: 'life-orb' }, 
        { id: 3, item: 'leftovers' }, 
        { id: 350, item: 'shell-bell' },
        { id: 448, item: 'expert-belt' },
        { id: 468, item: 'leftovers' },
        { id: 445, item: 'life-orb', isShiny: true }
      ]}
    ]
  }
};

const CITY_ORDER = ['pallet', 'viridian_visit', 'pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian', 'elite4'];

const CITY_SHOPS = {
  viridian_visit: [
    { id: 76, name: 'golem', cost: 50, isShiny: false, displayName: 'Golem' },
    { id: 473, name: 'mamoswine', cost: 150, isShiny: false, displayName: 'Mamoswine' },
    { id: 445, name: 'garchomp', cost: 1000, isShiny: true, displayName: 'Garchomp ⭐' }
  ],
  pewter: [
    { id: 76, name: 'golem', cost: 50, isShiny: false, displayName: 'Golem' },
    { id: 214, name: 'heracross', cost: 150, isShiny: false, displayName: 'Heracross' },
    { id: 248, name: 'tyranitar', cost: 1000, isShiny: true, displayName: 'Tyranitar ⭐' }
  ],
  cerulean: [
    { id: 80, name: 'slowbro', cost: 50, isShiny: false, displayName: 'Slowbro' },
    { id: 131, name: 'lapras', cost: 150, isShiny: false, displayName: 'Lapras' },
    { id: 350, name: 'milotic', cost: 1000, isShiny: true, displayName: 'Milotic ⭐' }
  ],
  vermilion: [
    { id: 25, name: 'pikachu', cost: 50, isShiny: false, displayName: 'Pikachu' },
    { id: 82, name: 'magneton', cost: 150, isShiny: false, displayName: 'Magneton' },
    { id: 135, name: 'jolteon', cost: 1000, isShiny: true, displayName: 'Jolteon ⭐' }
  ],
  celadon: [
    { id: 154, name: 'meganium', cost: 50, isShiny: false, displayName: 'Meganium' },
    { id: 254, name: 'sceptile', cost: 150, isShiny: false, displayName: 'Sceptile' },
    { id: 3, name: 'venusaur', cost: 1000, isShiny: true, displayName: 'Venusaur ⭐' }
  ],
  fuchsia: [
    { id: 461, name: 'weavile', cost: 50, isShiny: false, displayName: 'Weavile' },
    { id: 94, name: 'gengar', cost: 150, isShiny: false, displayName: 'Gengar' },
    { id: 248, name: 'tyranitar', cost: 1000, isShiny: true, displayName: 'Tyranitar ⭐' }
  ],
  saffron: [
    { id: 196, name: 'espeon', cost: 50, isShiny: false, displayName: 'Espeon' },
    { id: 282, name: 'gardevoir', cost: 150, isShiny: false, displayName: 'Gardevoir' },
    { id: 376, name: 'metagross', cost: 1000, isShiny: true, displayName: 'Metagross ⭐' }
  ],
  cinnabar: [
    { id: 136, name: 'flareon', cost: 50, isShiny: false, displayName: 'Flareon' },
    { id: 59, name: 'arcanine', cost: 150, isShiny: false, displayName: 'Arcanine' },
    { id: 6, name: 'charizard', cost: 1000, isShiny: true, displayName: 'Charizard ⭐' }
  ],
  viridian: [
    { id: 76, name: 'golem', cost: 50, isShiny: false, displayName: 'Golem' },
    { id: 473, name: 'mamoswine', cost: 150, isShiny: false, displayName: 'Mamoswine' },
    { id: 445, name: 'garchomp', cost: 1000, isShiny: true, displayName: 'Garchomp ⭐' }
  ]
};

const LEADER_AVATARS = {
  "Brock": "https://play.pokemonshowdown.com/sprites/trainers/brock.png",
  "Misty": "https://play.pokemonshowdown.com/sprites/trainers/misty.png",
  "Lt. Surge": "https://play.pokemonshowdown.com/sprites/trainers/lt_surge.png",
  "Lt.Surge": "https://play.pokemonshowdown.com/sprites/trainers/lt_surge.png",
  "Erika": "https://play.pokemonshowdown.com/sprites/trainers/erika.png",
  "Koga": "https://play.pokemonshowdown.com/sprites/trainers/koga.png",
  "Sabrina": "https://play.pokemonshowdown.com/sprites/trainers/sabrina.png",
  "Blaine": "https://play.pokemonshowdown.com/sprites/trainers/blaine.png",
  "Giovanni": "https://play.pokemonshowdown.com/sprites/trainers/giovanni.png",
  "Lorelei": "https://play.pokemonshowdown.com/sprites/trainers/lorelei.png",
  "Bruno": "https://play.pokemonshowdown.com/sprites/trainers/bruno.png",
  "Agatha": "https://play.pokemonshowdown.com/sprites/trainers/agatha.png",
  "Lance": "https://play.pokemonshowdown.com/sprites/trainers/lance.png",
  "Cynthia": "https://play.pokemonshowdown.com/sprites/trainers/cynthia.png"
};

function getTrainerAvatar(name) {
  for (const [key, url] of Object.entries(LEADER_AVATARS)) {
    if (name.includes(key)) {
      return url;
    }
  }
  if (name.includes("Recruta Rocket") || name.includes("Rocket")) {
    if (name.includes("Fêmea")) {
      return "https://play.pokemonshowdown.com/sprites/trainers/rocketgruntf.png";
    }
    return "https://play.pokemonshowdown.com/sprites/trainers/rocketgrunt.png";
  }
  if (name.includes("Petrel")) {
    return "https://play.pokemonshowdown.com/sprites/trainers/petrel.png";
  }
  if (name.includes("Treinadora")) {
    return "https://play.pokemonshowdown.com/sprites/trainers/lass.png";
  }
  return "https://play.pokemonshowdown.com/sprites/trainers/camper.png";
}

// UI SCREEN STATE
let container = null;
let currentUserId = null;
let profile = null;
let gold = 100;
let progress = {
  currentCity: 'pewter',
  currentStage: 0, // 0-2 NPCs, 3 Gym Leader, 4 Completed
  completedCities: [],
  eliteFourIndex: 0 // 0-4 (Lorelei, Bruno, Agatha, Lance, Cynthia)
};
let ownedBadges = new Set();
let selectedCityId = 'pewter';
let activeModal = null; // 'shop' | 'prematch' | null
let selectedMode = 'album'; // 'album' | 'draft'
let selectedRoster = []; // Coleção personal selection
let draftRoster = []; // Draft selection
let draftRound = 1;
let draftOptions = [];
let ownedCards = [];
let loading = false;
let errorMsg = '';

export async function render(cont) {
  container = cont;
  loading = true;
  errorMsg = '';
  renderScreen();
  playBGM('lobby');

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }
    currentUserId = user.id;

    // Load profile
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (profErr) throw profErr;
    profile = prof;

    initAlbumModal(document.body, currentUserId, profile?.username);

    // Load local storage gold & progress
    const savedGold = localStorage.getItem(`pkt_campaign_gold_${currentUserId}`);
    if (savedGold !== null) {
      gold = parseInt(savedGold, 10);
    } else {
      gold = 100;
      localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, '100');
    }

    const savedProgress = localStorage.getItem(`pkt_campaign_progress_${currentUserId}`);
    if (savedProgress) {
      try {
        progress = JSON.parse(savedProgress);
      } catch (_) {}
    } else {
      progress = {
        currentCity: 'pallet',
        currentStage: 0,
        completedCities: [],
        eliteFourIndex: 0
      };
      localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
    }

    // Set selected city to the current campaign city by default
    selectedCityId = progress.currentCity;

    // Load badges from Supabase
    const { data: dbBadges, error: badgeErr } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', currentUserId);

    if (badgeErr) throw badgeErr;
    ownedBadges = new Set((dbBadges || []).map(b => b.badge_id));

    // Load owned album cards
    const { data: cards, error: cardsErr } = await supabase
      .from('user_cards')
      .select('pokemon_id, is_shiny, quantity')
      .eq('user_id', currentUserId);

    if (cardsErr) throw cardsErr;
    ownedCards = cards || [];

  } catch (err) {
    console.error('Erro ao carregar Campanha:', err);
    errorMsg = 'Erro ao conectar ao Supabase. Verifique sua rede.';
  } finally {
    loading = false;
    renderScreen();
  }
}

export function destroy() {
  // Nada para destruir
}

function getPokemonById(id) {
  const p = pokemonData.find(x => x.id === id);
  if (!p) {
    return JSON.parse(JSON.stringify(pokemonData[0]));
  }
  return JSON.parse(JSON.stringify(p));
}

function getViridianActiveId() {
  const hasCompletedVisit = progress.completedCities.includes('viridian_visit');
  const isAtGiovanni = progress.currentCity === 'viridian' || progress.completedCities.includes('viridian');
  if (isAtGiovanni) {
    return 'viridian';
  }
  return 'viridian_visit';
}

function getNodeStatusClass(cityId) {
  if (cityId === 'viridian') {
    const hasCompletedGiovanni = progress.completedCities.includes('viridian');
    const hasCompletedVisit = progress.completedCities.includes('viridian_visit');
    const isAtGiovanni = progress.currentCity === 'viridian';
    const isAtVisit = progress.currentCity === 'viridian_visit';

    if (hasCompletedGiovanni) return 'completed';
    if (isAtGiovanni) return 'active';
    if (isAtVisit) return 'active';
    if (hasCompletedVisit) return 'completed';
    return isCityUnlocked('viridian_visit') ? '' : 'locked';
  }

  if (progress.completedCities.includes(cityId)) return 'completed';
  if (progress.currentCity === cityId) return 'active';
  return isCityUnlocked(cityId) ? '' : 'locked';
}

function isCityUnlocked(cityId) {
  if (cityId === 'pallet') return true;
  const idx = CITY_ORDER.indexOf(cityId);
  if (idx === -1) return false;
  const prevCityId = CITY_ORDER[idx - 1];
  return progress.completedCities.includes(prevCityId);
}

function renderScreen() {
  if (!container) return;

  if (loading) {
    container.innerHTML = `
      <div class="campaign-container" style="justify-content: center; align-items: center;">
        <div class="thinking-spinner"></div>
        <p style="margin-top: 1rem; color: var(--text-3); font-weight: bold;">Carregando sua jornada...</p>
      </div>
    `;
    return;
  }

  const activeCity = CITIES_CONFIG[selectedCityId];
  const isCompleted = progress.completedCities.includes(selectedCityId);
  const isCurrent = progress.currentCity === selectedCityId;
  const unlocked = isCityUnlocked(selectedCityId);

  let activeStageIdx = 0;
  if (selectedCityId === 'elite4') {
    activeStageIdx = progress.eliteFourIndex;
  } else if (isCurrent) {
    activeStageIdx = progress.currentStage;
  } else {
    activeStageIdx = activeCity.stages.length - 1; // Replay del Leader
  }

  // Draw background roadmap SVG connections
  let svgPaths = '';
  const drawSvgLine = (c1Id, c2Id) => {
    const c1 = CITIES_CONFIG[c1Id];
    const c2 = CITIES_CONFIG[c2Id];
    const c1Unlocked = isCityUnlocked(c1Id);
    const c2Unlocked = isCityUnlocked(c2Id);
    const color = (c1Unlocked && c2Unlocked) ? '#fbbf24' : '#374151';
    const filter = (c1Unlocked && c2Unlocked) ? 'filter="drop-shadow(0 0 4px #fbbf24)"' : '';
    return `<line x1="${c1.x}%" y1="${c1.y}%" x2="${c2.x}%" y2="${c2.y}%" class="campaign-svg-line" stroke="${color}" stroke-width="2.5" ${filter} />`;
  };


  svgPaths += drawSvgLine('pallet', 'viridian_visit');
  svgPaths += drawSvgLine('viridian_visit', 'pewter');
  svgPaths += drawSvgLine('pewter', 'cerulean');
  svgPaths += drawSvgLine('cerulean', 'saffron');
  svgPaths += drawSvgLine('saffron', 'celadon');
  svgPaths += drawSvgLine('saffron', 'vermilion');
  svgPaths += drawSvgLine('celadon', 'fuchsia');
  svgPaths += drawSvgLine('fuchsia', 'cinnabar');
  svgPaths += drawSvgLine('cinnabar', 'pallet');
  svgPaths += drawSvgLine('viridian', 'elite4');

  // Render badges list
  const BADGE_CITIES = ['pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian'];
  const badgeSlotsHtml = BADGE_CITIES.map(cId => {
    const c = CITIES_CONFIG[cId];
    const hasBadge = ownedBadges.has(c.badge);
    const badgeColor = c.badgeColor || '#fbbf24';
    return `
      <div class="campaign-badge-slot ${hasBadge ? 'unlocked' : ''}" style="--badge-color: ${badgeColor}" title="${c.badgeName}">
        <span>${c.badgeIcon}</span>
        <div class="campaign-badge-tooltip">${c.badgeName} (${hasBadge ? 'Conquistada' : 'Bloqueada'})</div>
      </div>
    `;
  }).join('');

  // Render Stages detail side panel
  let stagesHtml = '';
  if (selectedCityId === 'elite4') {
    stagesHtml = activeCity.stages.map((stg, i) => {
      let statusClass = 'locked';
      let statusText = 'Trancado';
      if (i < progress.eliteFourIndex) {
        statusClass = 'completed';
        statusText = 'Derrotado';
      } else if (i === progress.eliteFourIndex) {
        statusClass = 'active';
        statusText = 'Desafiar';
      }
      const avatarUrl = getTrainerAvatar(stg.name);
      return `
        <div class="campaign-stage-item ${statusClass}">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img src="${avatarUrl}" style="height: 100%; width: 100%; object-fit: contain; image-rendering: pixelated;" />
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: bold; color: white;">${stg.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-3);">${i === 4 ? 'Desafio de Campeão' : 'Elite dos Quatro'}</span>
            </div>
          </div>
          <span class="stage-badge ${statusClass}">${statusText}</span>
        </div>
      `;
    }).join('');
  } else {
    stagesHtml = activeCity.stages.map((stg, i) => {
      let statusClass = 'locked';
      let statusText = 'Trancado';
      if (isCompleted || (isCurrent && progress.currentStage > i)) {
        statusClass = 'completed';
        statusText = 'Vencido';
      } else if (isCurrent && progress.currentStage === i) {
        statusClass = 'active';
        statusText = 'Batalhar';
      } else if (!isCurrent && i === activeCity.stages.length - 1) {
        statusClass = 'active'; // Replay Leader
        statusText = 'Replay';
      }
      const avatarUrl = getTrainerAvatar(stg.name);
      return `
        <div class="campaign-stage-item ${statusClass}">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <img src="${avatarUrl}" style="height: 100%; width: 100%; object-fit: contain; image-rendering: pixelated;" />
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: bold; color: white;">${stg.name}</span>
              <span style="font-size: 0.75rem; color: var(--text-3);">${stg.type === 'Leader' ? 'Líder de Ginásio' : 'Treinador NPC'}</span>
            </div>
          </div>
          <span class="stage-badge ${statusClass}">${statusText}</span>
        </div>
      `;
    }).join('');
  }

  // Active stage preview
  const currentStageObj = activeCity.stages[activeStageIdx] || activeCity.stages[activeCity.stages.length - 1];
  const isChampionDefeated = selectedCityId === 'elite4' && progress.eliteFourIndex >= 5;
  const hasEnoughCards = ownedCards.length >= 6;

  let btnBattleHtml = '';
  if (isChampionDefeated) {
    btnBattleHtml = `
      <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; color: #34d399; font-weight: bold; margin-bottom: 0.5rem;">
        🏆 Liga Pokémon Concluída! Você é o Campeão de Kanto!
      </div>
    `;
  } else if (!unlocked) {
    btnBattleHtml = `
      <button class="campaign-btn-primary" disabled style="width: 100%; margin-bottom: 0.5rem;">
        🔒 Desafio Trancado
      </button>
    `;
  } else if (!hasEnoughCards) {
    btnBattleHtml = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); padding: 0.8rem; border-radius: 8px; color: #fca5a5; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem; text-align: center; line-height: 1.4;">
        ⚠️ Você possui apenas ${ownedCards.length} cartas no álbum. É necessário ter pelo menos 6 Pokémons para iniciar a campanha. Vá à Loja comprar boosters!
      </div>
      <button class="campaign-btn-primary" disabled style="width: 100%; margin-bottom: 0.5rem;">
        ⚔️ Desafiar ${currentStageObj.name}
      </button>
    `;
  } else if (selectedCityId === 'elite4' || isCurrent || activeStageIdx === activeCity.stages.length - 1) {
    btnBattleHtml = `
      <button class="campaign-btn-primary" id="btn-challenge-stage" style="width: 100%; margin-bottom: 0.5rem;">
        ⚔️ Desafiar ${currentStageObj.name}
      </button>
    `;
  }

  // Shop button display
  const showShopBtn = selectedCityId !== 'elite4' && unlocked;

  container.innerHTML = `
    <div class="campaign-container">
      <div class="campaign-header">
        <button class="btn-primary" id="btn-campaign-back" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); font-size: 0.85rem; padding: 0.4rem 0.8rem;">
          ⬅️ Voltar
        </button>
        
        <h1 class="campaign-header-title">🗺️ CAMPANHA: JORNADA DE KANTO</h1>
        
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="campaign-gold-badge">
            <span class="pkt-coin"></span>
            <span id="campaign-gold-count">${gold} Gold</span>
          </div>
          <button class="btn-primary" id="btn-campaign-album" style="background: rgba(124, 58, 237, 0.15); border: 1px solid #c084fc; color: #c084fc; font-size: 0.85rem; padding: 0.4rem 0.8rem;">
            📕 Álbum
          </button>
          <div class="mute-btn" id="btn-campaign-mute" title="Mutar/Desmutar Som" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem;">
            🔊
          </div>
        </div>
      </div>
      
      ${errorMsg ? `
        <div class="error-banner" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); padding: 0.8rem; border-radius: 8px; color: var(--danger); font-weight: bold; margin-bottom: 1rem; text-align: center;">
          ⚠️ ${errorMsg}
        </div>
      ` : ''}

      <div class="campaign-layout">
        <!-- MAP AREA -->
        <div class="campaign-map-card">
          <div class="campaign-map-title">
            <span>Mapa da Região de Kanto</span>
            <span style="font-size: 0.8rem; color: var(--text-3);">Clique nos ginásios desbloqueados para selecionar</span>
          </div>
          
          <div class="campaign-map-canvas" id="campaign-map-canvas">
            ${svgPaths}
            
            <!-- Pallet -->
            <div class="map-node ${getNodeStatusClass('pallet')}" style="left: 28%; top: 70%;" data-city="pallet">
              <div class="map-node-inner">🏡</div>
              <div class="map-node-label">Vila de Pallet</div>
            </div>

            <!-- Pewter -->
            <div class="map-node ${getNodeStatusClass('pewter')}" style="left: 30%; top: 25%;" data-city="pewter">
              <div class="map-node-inner">🪨</div>
              <div class="map-node-label">Pewter (Brock)</div>
            </div>
            
            <!-- Cerulean -->
            <div class="map-node ${getNodeStatusClass('cerulean')}" style="left: 65%; top: 15%;" data-city="cerulean">
              <div class="map-node-inner">💧</div>
              <div class="map-node-label">Cerulean (Misty)</div>
            </div>
            
            <!-- Vermilion -->
            <div class="map-node ${getNodeStatusClass('vermilion')}" style="left: 72%; top: 60%;" data-city="vermilion">
              <div class="map-node-inner">⚡</div>
              <div class="map-node-label">Vermilion (Lt. Surge)</div>
            </div>
            
            <!-- Celadon -->
            <div class="map-node ${getNodeStatusClass('celadon')}" style="left: 48%; top: 45%;" data-city="celadon">
              <div class="map-node-inner">🌈</div>
              <div class="map-node-label">Celadon (Erika)</div>
            </div>
            
            <!-- Fuchsia -->
            <div class="map-node ${getNodeStatusClass('fuchsia')}" style="left: 55%; top: 80%;" data-city="fuchsia">
              <div class="map-node-inner">💜</div>
              <div class="map-node-label">Fuchsia (Koga)</div>
            </div>
            
            <!-- Saffron -->
            <div class="map-node ${getNodeStatusClass('saffron')}" style="left: 65%; top: 45%;" data-city="saffron">
              <div class="map-node-inner">🔮</div>
              <div class="map-node-label">Saffron (Sabrina)</div>
            </div>
            
            <!-- Cinnabar -->
            <div class="map-node ${getNodeStatusClass('cinnabar')}" style="left: 28%; top: 85%;" data-city="cinnabar">
              <div class="map-node-inner">🔥</div>
              <div class="map-node-label">Cinnabar (Blaine)</div>
            </div>
            
            <!-- Viridian -->
            <div class="map-node ${getNodeStatusClass('viridian')}" style="left: 28%; top: 55%;" data-city="viridian">
              <div class="map-node-inner">🟢</div>
              <div class="map-node-label">${progress.currentCity === 'viridian' || progress.completedCities.includes('viridian') ? 'Viridian (Giovanni)' : 'Viridian (Visita)'}</div>
            </div>
            
            <!-- Elite 4 -->
            <div class="map-node ${getNodeStatusClass('elite4')}" style="left: 10%; top: 45%;" data-city="elite4">
              <div class="map-node-inner">🏆</div>
              <div class="map-node-label">Planalto Indigo</div>
            </div>
          </div>
        </div>
        
        <!-- SIDE PANEL -->
        <div class="campaign-side-panel">
          <!-- Coleção de Insígnias -->
          <div class="campaign-panel-card" style="margin-bottom: 0.5rem;">
            <span style="font-weight: bold; font-size: 0.9rem; color: var(--gold); margin-bottom: 0.5rem;">🎒 Minhas Insígnias de Ginásio</span>
            <div class="campaign-badges-container">
              ${badgeSlotsHtml}
            </div>
          </div>
          
          <!-- Detalhes do Local Selecionado -->
          <div class="campaign-panel-card" style="flex: 1; justify-content: flex-start;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
              <h2 style="margin: 0; font-size: 1.15rem; color: white;">${activeCity.name}</h2>
              <span style="font-size: 0.75rem; background: var(--bg-3); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); text-transform: uppercase; font-weight: bold;">
                Tipo ${activeCity.type.toUpperCase()}
              </span>
            </div>
            
            <p style="margin: 0.25rem 0; font-size: 0.85rem; color: var(--text-2);">
              Líder do Ginásio: <b style="color: var(--gold);">${activeCity.leader}</b>
            </p>
            
            <div class="campaign-stages-list">
              ${stagesHtml}
            </div>
            
            <div style="margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem;">
              ${btnBattleHtml}
              
              ${showShopBtn ? `
                <button class="campaign-btn-shop" id="btn-campaign-shop" style="width: 100%;">
                  🛒 Visitar Loja da Cidade
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- MODALS ATTACH CONTAINER -->
    <div id="campaign-modal-container"></div>
  `;

  attachEvents();
}

function attachEvents() {
  if (!container) return;

  // Back button
  const backBtn = container.querySelector('#btn-campaign-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      playSFX('click');
      navigate('home');
    });
  }

  // Mute button
  const muteBtn = container.querySelector('#btn-campaign-mute');
  if (muteBtn) {
    attachMuteToggleListener('btn-campaign-mute');
  }

  // Open album
  const albumBtn = container.querySelector('#btn-campaign-album');
  if (albumBtn) {
    albumBtn.addEventListener('click', () => {
      playSFX('click');
      openAlbumModal();
    });
  }

  // Map nodes click
  container.querySelectorAll('.map-node').forEach(node => {
    node.addEventListener('click', () => {
      let cityId = node.dataset.city;
      if (cityId === 'viridian') {
        cityId = getViridianActiveId();
      }
      if (!isCityUnlocked(cityId)) {
        playSFX('faint');
        showCampaignNoticeModal('Ginásio Bloqueado', 'Este ginásio está bloqueado! Derrote os líderes anteriores primeiro para liberar o acesso.', '🔒');
        return;
      }
      playSFX('click');
      selectedCityId = cityId;
      renderScreen();
    });
  });

  // Shop button click
  const shopBtn = container.querySelector('#btn-campaign-shop');
  if (shopBtn) {
    shopBtn.addEventListener('click', () => {
      playSFX('click');
      openShopModal();
    });
  }

  // Challenge button click
  const challengeBtn = container.querySelector('#btn-challenge-stage');
  if (challengeBtn) {
    challengeBtn.addEventListener('click', () => {
      playSFX('click');
      openPreMatchModal();
    });
  }
}

// ===================================================
// CUSTOM NOTICE MODAL SYSTEM
// ===================================================
function showCampaignNoticeModal(title, message, icon = '⚠️', onConfirm = null) {
  const modalContainer = container.querySelector('#campaign-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="campaign-modal campaign-notice-modal-open" style="z-index: 20000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; position: fixed; inset: 0;">
      <style>
        .campaign-notice-card {
          background: linear-gradient(180deg, #1f1f3a 0%, #0d0d1a 100%);
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 20px;
          padding: 2rem;
          width: 90%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 0 30px rgba(255,255,255,0.02);
          animation: noticeEntrance 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        @keyframes noticeEntrance {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .campaign-notice-icon {
          font-size: 3rem;
          margin-bottom: 0.75rem;
          display: inline-block;
          animation: noticePulse 2s infinite;
        }
        @keyframes noticePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .campaign-notice-title {
          font-size: 1.3rem;
          font-weight: 800;
          margin: 0 0 0.75rem 0;
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .campaign-notice-msg {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
          line-height: 1.5;
          margin: 0 0 1.5rem 0;
        }
        .campaign-notice-ok-btn {
          width: 100%;
          padding: 0.75rem;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
          color: white;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
        .campaign-notice-ok-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(124, 58, 237, 0.5);
        }
      </style>
      <div class="campaign-notice-card">
        <span class="campaign-notice-icon">${icon}</span>
        <h3 class="campaign-notice-title">${title}</h3>
        <p class="campaign-notice-msg">${message}</p>
        <button class="campaign-notice-ok-btn" id="btn-notice-ok">OK</button>
      </div>
    </div>
  `;

  const okBtn = modalContainer.querySelector('#btn-notice-ok');
  if (okBtn) {
    okBtn.disabled = true;
    okBtn.style.opacity = '0.6';
    okBtn.style.cursor = 'not-allowed';
    setTimeout(() => {
      okBtn.disabled = false;
      okBtn.style.opacity = '1';
      okBtn.style.cursor = 'pointer';
    }, 500);

    okBtn.addEventListener('click', () => {
      if (okBtn.disabled) return;
      playSFX('click');
      modalContainer.innerHTML = '';
      if (onConfirm) onConfirm();
    });
  }
}

// ===================================================
// SHOP MODAL SYSTEM
// ===================================================
function openShopModal() {
  const modalContainer = container.querySelector('#campaign-modal-container');
  if (!modalContainer) return;

  const cityId = selectedCityId;
  const cityConfig = CITIES_CONFIG[cityId];
  const shopItems = CITY_SHOPS[cityId] || [];

  const renderModalContent = () => {
    return `
      <div class="campaign-modal">
        <div class="campaign-modal-inner" style="max-width: 700px;">
          <div class="campaign-modal-header">
            <h2 class="campaign-modal-title">🛒 Loja de ${cityConfig.name}</h2>
            <button class="campaign-modal-close" id="btn-close-shop">✕</button>
          </div>
          
          <div class="campaign-modal-body">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 0.8rem 1.2rem; border-radius: 8px;">
              <span style="color: var(--text-2); font-size: 0.9rem;">Seu Saldo:</span>
              <span style="color: #fbbf24; font-weight: 800; font-size: 1.2rem; display: flex; align-items: center; gap: 6px;">
                <span class="pkt-coin coin-spin" style="width: 16px; height: 16px; border-width: 2px;"></span> ${gold} Ouro
              </span>
            </div>
            
            <div class="shop-grid">
              <!-- Item 1: Booster Pack -->
              <div class="shop-item-card">
                <span style="font-size: 2.2rem;">📦</span>
                <h3 style="font-size: 0.95rem; margin: 0.5rem 0 0.25rem 0; color: white;">Pacote Booster</h3>
                <p style="font-size: 0.75rem; color: var(--text-3); margin: 0 0 1rem 0; height: 32px;">Contém 3 cartas de pokémons aleatórios para o álbum.</p>
                <button class="shop-buy-btn" id="btn-buy-booster" ${gold < 100 ? 'disabled' : ''}>
                  <span class="pkt-coin" style="border-color: rgba(0,0,0,0.5); margin-right: 4px;"></span> 100 Ouro
                </button>
              </div>
              
              <!-- Specialty Cards -->
              ${shopItems.map((item, idx) => {
                const poke = getPokemonById(item.id);
                poke.isShiny = item.isShiny;
                const cardHtml = PokemonCard(poke, { small: true, showStats: false, showCost: false });
                return `
                  <div class="shop-item-card">
                    <span style="font-size: 0.75rem; color: var(--gold); text-transform: uppercase; font-weight: 800;">
                      ${item.isShiny ? 'Shiny ⭐' : (idx === 1 ? 'Raro 💎' : 'Comum')}
                    </span>
                    <div class="shop-card-wrapper">
                      ${cardHtml}
                    </div>
                    <button class="shop-buy-btn btn-buy-card" data-idx="${idx}" ${gold < item.cost ? 'disabled' : ''}>
                      <span class="pkt-coin" style="border-color: rgba(0,0,0,0.5); margin-right: 4px;"></span> ${item.cost} Ouro
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <div class="campaign-modal-footer">
            <button class="campaign-btn-secondary" id="btn-shop-done">
              Fechar Loja
            </button>
          </div>
        </div>
      </div>
    `;
  };

  modalContainer.innerHTML = renderModalContent();

  // Close handlers
  const closeShop = () => {
    modalContainer.innerHTML = '';
    renderScreen();
  };

  modalContainer.querySelector('#btn-close-shop').addEventListener('click', () => {
    playSFX('click');
    closeShop();
  });
  modalContainer.querySelector('#btn-shop-done').addEventListener('click', () => {
    playSFX('click');
    closeShop();
  });

  // Buy Booster
  const buyBoosterBtn = modalContainer.querySelector('#btn-buy-booster');
  if (buyBoosterBtn) {
    buyBoosterBtn.addEventListener('click', async () => {
      if (gold < 100) return;
      playSFX('click');
      buyBoosterBtn.disabled = true;

      try {
        // Subtract Gold
        gold -= 100;
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

        // Update database boosters_count
        const { data: prof, error: getErr } = await supabase
          .from('profiles')
          .select('boosters_count')
          .eq('id', currentUserId)
          .single();

        if (getErr) throw getErr;

        const nextCount = (prof?.boosters_count || 0) + 1;
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ boosters_count: nextCount })
          .eq('id', currentUserId);

        if (updErr) throw updErr;

        playSFX('boosterOpen');
        showCampaignNoticeModal('Booster Comprado', 'Booster comprado com sucesso! O pacote foi adicionado à sua conta online e pode ser aberto no menu principal.', '📦', () => openShopModal());

      } catch (err) {
        console.error(err);
        showCampaignNoticeModal('Erro na Compra', 'Ocorreu um erro ao processar a compra de booster. Tente novamente.', '❌', () => openShopModal());
        gold += 100; // Refund
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));
      }
    });
  }

  // Buy Cards
  modalContainer.querySelectorAll('.btn-buy-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const item = shopItems[idx];
      if (gold < item.cost) return;

      playSFX('click');
      btn.disabled = true;

      try {
        // Subtract Gold
        gold -= item.cost;
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

        // Insert card into database (user_cards)
        const isShinyForDB = !!item.isShiny;

        const { data: existing, error: selErr } = await supabase
          .from('user_cards')
          .select('id, quantity')
          .eq('user_id', currentUserId)
          .eq('pokemon_id', item.id)
          .eq('is_shiny', isShinyForDB)
          .maybeSingle();

        if (selErr) throw selErr;

        if (existing) {
          const { error: updErr } = await supabase
            .from('user_cards')
            .update({ quantity: existing.quantity + 1 })
            .eq('id', existing.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from('user_cards')
            .insert({
              user_id: currentUserId,
              pokemon_id: item.id,
              is_shiny: isShinyForDB,
              quantity: 1
            });
          if (insErr) throw insErr;
        }

        playSFX('click');
        showCampaignNoticeModal('Carta Adquirida', `A carta ${item.displayName} foi comprada com sucesso e adicionada ao seu Álbum!`, '🎉', () => openShopModal());

        // Update local list
        const { data: cards } = await supabase
          .from('user_cards')
          .select('pokemon_id, is_shiny, quantity')
          .eq('user_id', currentUserId);
        ownedCards = cards || [];

      } catch (err) {
        console.error(err);
        showCampaignNoticeModal('Erro na Compra', 'Ocorreu um erro ao processar a compra de carta. Tente novamente.', '❌', () => openShopModal());
        gold += item.cost; // Refund
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));
      }
    });
  });
}

// ===================================================
// PRE-MATCH MODAL SYSTEM
// ===================================================
function openPreMatchModal() {
  const modalContainer = container.querySelector('#campaign-modal-container');
  if (!modalContainer) return;

  const cityId = selectedCityId;
  const cityConfig = CITIES_CONFIG[cityId];

  let activeStageIdx = 0;
  if (selectedCityId === 'elite4') {
    activeStageIdx = progress.eliteFourIndex;
  } else if (progress.currentCity === selectedCityId) {
    activeStageIdx = progress.currentStage;
  } else {
    activeStageIdx = 3;
  }

  const stage = cityConfig.stages[activeStageIdx] || cityConfig.stages[3];

  // Resolve opponent team for display
  const opTeamPreview = stage.team.map(spec => {
    const p = getPokemonById(spec.id);
    p.isShiny = !!spec.isShiny;
    return p;
  });

  selectedMode = 'album'; // Force album mode

  // Local helper to render modal layout
  const renderPreMatchContent = () => {
    // Personal Album Selection View
    const gridCardsHtml = ownedCards.map(c => {
      const p = getPokemonById(c.pokemon_id);
      p.isShiny = c.is_shiny;
      const isSelected = selectedRoster.some(x => x.id === p.id && x.isShiny === p.isShiny);
      return `
        <div class="owned-card-item" data-id="${p.id}" data-shiny="${p.isShiny ? 'true' : 'false'}">
          ${c.quantity > 1 ? `<div class="owned-card-qty-badge">x${c.quantity}</div>` : ''}
          ${PokemonCard(p, { small: true, showStats: false, selectable: true, selected: isSelected })}
        </div>
      `;
    }).join('');

    const modeContentHtml = `
      <div style="margin-top: 1rem;">
        <span style="font-weight: bold; color: var(--gold); font-size: 0.9rem;">Escolha 6 Pokémons do seu Álbum:</span>
        
        <div class="roster-preview-slots">
          ${Array.from({ length: 6 }).map((_, i) => {
            const p = selectedRoster[i];
            if (p) {
              return `
                <div class="roster-preview-slot filled" data-index="${i}">
                  <button class="remove-btn" data-index="${i}">✕</button>
                  <img src="${p.sprite}" alt="${p.displayName}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
              `;
            } else {
              return `<div class="roster-preview-slot">?</div>`;
            }
          }).join('')}
        </div>

        ${ownedCards.length === 0 ? `
          <p style="color: var(--text-3); text-align: center; margin: 2rem 0; font-size: 0.9rem;">
            ⚠️ Você não possui nenhuma carta no seu álbum ainda! Compre boosters na loja para conseguir Pokémons.
          </p>
        ` : `
          <div class="owned-cards-grid">
            ${gridCardsHtml}
          </div>
        `}
      </div>
    `;

    const canBattle = selectedRoster.length === 6;

    // Resolve Level display text
    let levelText = "Nível 50";
    if (stage.name.includes("Cynthia")) {
      levelText = "Nível 75";
    } else if (stage.type === 'Leader' || stage.type === 'Elite4') {
      levelText = "Nível 70";
    }

    return `
      <div class="campaign-modal">
        <div class="campaign-modal-inner" style="max-width: 780px;">
          <div class="campaign-modal-header">
            <h2 class="campaign-modal-title">⚔️ Preparar para Batalha</h2>
            <button class="campaign-modal-close" id="btn-close-prematch">✕</button>
          </div>
          
          <div class="campaign-modal-body">
            <!-- Opponent Preview -->
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.8rem 1.2rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; background: rgba(0,0,0,0.3); border: 2px solid var(--danger); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <img src="${getTrainerAvatar(stage.name)}" style="height: 100%; width: 100%; object-fit: contain; image-rendering: pixelated;" />
                </div>
                <div>
                  <span style="font-size: 0.75rem; color: var(--danger); font-weight: bold; text-transform: uppercase;">Oponente:</span>
                  <h3 style="margin: 0; font-size: 1.1rem; color: white;">${stage.name} <span style="font-size: 0.85rem; color: var(--text-3); font-weight: normal;">(${levelText})</span></h3>
                </div>
              </div>
              
              <div style="display: flex; gap: 6px;">
                ${opTeamPreview.map(p => `
                  <div style="width: 38px; height: 38px; background: rgba(0,0,0,0.3); border-radius: 6px; display: flex; align-items: center; justify-content: center;" title="${p.displayName}">
                    <img src="${p.sprite}" alt="${p.displayName}" style="width: 32px; height: 32px; object-fit: contain;">
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Mode Title -->
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.6rem 1rem; color: #c4b5fd; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
              <span>🎒</span> Coleção Pessoal: Batalhe usando seus Pokémons colecionados no álbum
            </div>

            <!-- Mode Content Area -->
            ${modeContentHtml}
          </div>
          
          <div class="campaign-modal-footer">
            <button class="campaign-btn-secondary" id="btn-prematch-cancel">
              Cancelar
            </button>
            <button class="campaign-btn-primary" id="btn-prematch-battle" ${!canBattle ? 'disabled' : ''}>
              Começar Batalha!
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Helper to hook events inside prematch modal
  const attachPrematchEvents = () => {
    modalContainer.querySelector('#btn-close-prematch').addEventListener('click', () => {
      playSFX('click');
      modalContainer.innerHTML = '';
    });
    modalContainer.querySelector('#btn-prematch-cancel').addEventListener('click', () => {
      playSFX('click');
      modalContainer.innerHTML = '';
    });

    // Album Selection
    modalContainer.querySelectorAll('.owned-card-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id, 10);
        const isShiny = item.dataset.shiny === 'true';

        const idx = selectedRoster.findIndex(x => x.id === id && x.isShiny === isShiny);
        if (idx !== -1) {
          playSFX('click');
          selectedRoster.splice(idx, 1);
        } else {
          if (selectedRoster.length >= 6) {
            playSFX('faint');
            showCampaignNoticeModal('Roster Completo', 'Você já escolheu o limite máximo de 6 Pokémons para sua equipe de batalha!', '⚠️');
            return;
          }
          playSFX('click');
          const p = getPokemonById(id);
          p.isShiny = isShiny;
          selectedRoster.push(p);
        }
        updatePrematchUI();
      });
    });

    // Remove from roster preview
    modalContainer.querySelectorAll('.roster-preview-slot .remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSFX('click');
        const idx = parseInt(btn.dataset.index, 10);
        selectedRoster.splice(idx, 1);
        updatePrematchUI();
      });
    });

    // Battle trigger
    const startBattleBtn = modalContainer.querySelector('#btn-prematch-battle');
    if (startBattleBtn) {
      startBattleBtn.addEventListener('click', () => {
        playSFX('click');
        modalContainer.innerHTML = '';
        startBattle(selectedRoster);
      });
    }
  };

  const updatePrematchUI = () => {
    modalContainer.innerHTML = renderPreMatchContent();
    attachPrematchEvents();
  };

  updatePrematchUI();
}

function generateDraftOptions() {
  const options = [];
  while (options.length < 3) {
    const rPoke = pokemonData[Math.floor(Math.random() * pokemonData.length)];
    if (!options.some(o => o.id === rPoke.id)) {
      const clone = JSON.parse(JSON.stringify(rPoke));
      clone.isShiny = Math.random() < 0.10; // 10% Shiny

      if (itemsData && itemsData.length > 0) {
        const rItem = itemsData[Math.floor(Math.random() * itemsData.length)];
        clone.item = JSON.parse(JSON.stringify(rItem));
      }
      options.push(clone);
    }
  }
  draftOptions = options;
}

// ===================================================
// BATTLE ENGINE INTEGRATION
// ===================================================
function startBattle(playerTeam) {
  const cityId = selectedCityId;
  const cityConfig = CITIES_CONFIG[cityId];

  let activeStageIdx = 0;
  if (cityId === 'elite4') {
    activeStageIdx = progress.eliteFourIndex;
  } else if (progress.currentCity === cityId) {
    activeStageIdx = progress.currentStage;
  } else {
    activeStageIdx = 3;
  }

  const stage = cityConfig.stages[activeStageIdx] || cityConfig.stages[3];

  // Resolve opponent team
  const opponentTeamRaw = stage.team.map(spec => {
    const p = getPokemonById(spec.id);
    p.isShiny = !!spec.isShiny;

    // Assign level based on stage type/leader status
    let lvl = 50;
    if (stage.name.includes("Cynthia")) {
      lvl = 75;
    } else if (stage.type === 'Leader' || stage.type === 'Elite4' || stage.name.includes("Líder") || stage.name.includes("Elite Quatro")) {
      lvl = 70;
    }
    p.level = lvl;

    if (spec.item) {
      const itemObj = itemsData.find(i => i.name === spec.item);
      if (itemObj) {
        p.item = JSON.parse(JSON.stringify(itemObj));
      }
    }
    return p;
  });

  // Randomize moves between top 8 for battle (from Gen 4 moves list pool)
  const prepareTeamForBattle = (team) => {
    return team.map(p => {
      const clone = JSON.parse(JSON.stringify(p));
      if (clone.moves && clone.moves.length > 4) {
        // Sorteia 4 moves
        const shuffled = [...clone.moves].sort(() => 0.5 - Math.random());
        clone.moves = shuffled.slice(0, 4);
      }
      return clone;
    });
  };

  const finalPlayerTeam = prepareTeamForBattle(playerTeam);
  const finalOpponentTeam = prepareTeamForBattle(opponentTeamRaw);

  // Play battle BGM
  playBGM('battle');

  // Create battle state
  const state = createBattleState(finalPlayerTeam, finalOpponentTeam, Date.now(), { weather: true, synergy: true });
  simulateBattle(state);

  // Match object expected by BattleModal
  const match = {
    team1: {
      name: "Jogador",
      pokemon: finalPlayerTeam
    },
    team2: {
      name: stage.name,
      pokemon: finalOpponentTeam
    },
    winner: state.winner === 1 ? { name: "Jogador" } : { name: stage.name },
    totalTurns: state.turn,
    log: state.log,
    matchups: state.matchups
  };

  // Render battle modal
  renderBattleModal(match, async () => {
    // ON CLOSE CALLBACK
    const playerWon = state.winner === 1;
    const rewards = {
      gold: 0,
      badge: null,
      badgeIcon: null,
      badgeName: null,
      booster: false,
      message: ""
    };

    const finishMatch = async () => {
      // Restore BGM & re-render Campaign Screen
      playBGM('lobby');
      
      // Reload state from supabase / local
      loading = true;
      renderScreen();
      try {
        const { data: dbBadges } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', currentUserId);
        ownedBadges = new Set((dbBadges || []).map(b => b.badge_id));
        
        const { data: cards } = await supabase
          .from('user_cards')
          .select('pokemon_id, is_shiny, quantity')
          .eq('user_id', currentUserId);
        ownedCards = cards || [];

        // Reload profiles to refresh boosters_count
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();
        profile = prof;
      } catch (_) {}
      loading = false;
      renderScreen();
    };

    if (playerWon) {
      playBGM('victory');
      if (cityId === 'elite4') {
        const isCynthia = (progress.eliteFourIndex === 4);
        if (isCynthia) {
          // Beat Cynthia!
          gold += 150;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          progress.completedCities.push('elite4');
          progress.eliteFourIndex = 5;
          localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));

          // Save championship to profiles (increment ELO / Championships)
          try {
            const nextChamps = (profile?.championships || 0) + 1;
            const nextElo = (profile?.elo_points || 0) + 50;
            await supabase
              .from('profiles')
              .update({ championships: nextChamps, elo_points: nextElo })
              .eq('id', currentUserId);
          } catch (e) {
            console.error('Erro ao atualizar conquistas da liga no Supabase:', e);
          }

          rewards.gold = 150;
          rewards.message = "Você derrotou a Campeã Cynthia e se tornou o novo Campeão da Liga Pokémon! Parabéns!";
        } else {
          // Beat Elite 4 member
          gold += 30;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          progress.eliteFourIndex++;
          localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));

          rewards.gold = 30;
          rewards.message = `Você derrotou ${stage.name}! Preparando para o próximo desafio da Elite dos Quatro.`;
        }

      } else {
        const isLeader = (activeStageIdx === cityConfig.stages.length - 1);
        if (isLeader) {
          // Beat Gym Leader
          gold += 50;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          // Save badge in Supabase
          try {
            if (cityConfig.badge && !ownedBadges.has(cityConfig.badge)) {
              await supabase
                .from('user_badges')
                .insert({ user_id: currentUserId, badge_id: cityConfig.badge });
              ownedBadges.add(cityConfig.badge);
            }

            // Award 1 booster
            const { data: prof } = await supabase
              .from('profiles')
              .select('boosters_count')
              .eq('id', currentUserId)
              .single();

            const nextCount = (prof?.boosters_count || 0) + 1;
            await supabase
              .from('profiles')
              .update({ boosters_count: nextCount })
              .eq('id', currentUserId);

          } catch (e) {
            console.error('Erro ao salvar insígnia / booster no Supabase:', e);
          }

          // Advance city
          if (progress.currentCity === cityId) {
            progress.completedCities.push(cityId);
            progress.currentStage = 4; // Completed

            // Unlock next city
            const nextIdx = CITY_ORDER.indexOf(cityId) + 1;
            if (nextIdx < CITY_ORDER.length) {
              progress.currentCity = CITY_ORDER[nextIdx];
              progress.currentStage = 0;
            }
            localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
          }

          rewards.gold = 50;
          rewards.booster = true;
          rewards.badge = cityConfig.badge;
          rewards.badgeIcon = cityConfig.badgeIcon;
          rewards.badgeName = cityConfig.badgeName;
          rewards.message = `Você derrotou o Líder ${cityConfig.leader} e conquistou a ${cityConfig.badgeName}!`;

        } else {
          // Beat NPC
          gold += 15;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          if (progress.currentCity === cityId && progress.currentStage === activeStageIdx) {
            progress.currentStage++;
            localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
          }

          rewards.gold = 15;
          rewards.message = `Você derrotou ${stage.name} e avançou no ginásio.`;
        }
      }
    } else {
      // Player lost
      playSFX('faint');
      if (cityId === 'elite4') {
        // Reset Elite 4 progress!
        progress.eliteFourIndex = 0;
        localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
        rewards.message = 'Você foi eliminado da Liga Pokémon e terá que reiniciar o desafio da Elite dos Quatro a partir da Lorelei!';
      } else {
        rewards.message = 'Você foi vencido nesta batalha. Ajuste sua equipe e tente novamente!';
      }
    }

    // Show custom modal
    showCampaignOutcomeModal(playerWon, rewards, finishMatch);
  });
}

function showCampaignOutcomeModal(playerWon, rewards, callback) {
  const modalContainer = container.querySelector('#campaign-modal-container');
  if (!modalContainer) {
    callback();
    return;
  }

  const goldEarned = rewards.gold || 0;
  const badgeEarned = rewards.badge;
  const boosterEarned = !!rewards.booster;
  const msg = rewards.message || '';

  let html = `
    <div class="campaign-modal outcome-modal-open" style="z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;">
      <style>
        .outcome-card {
          background: linear-gradient(180deg, #1e1e38 0%, #0d0d1a 100%);
          border: 2px solid ${playerWon ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
          border-radius: 24px;
          padding: 2.5rem 2rem;
          width: 90%;
          max-width: 480px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6), inset 0 0 30px ${playerWon ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
          animation: outcomeEntrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          position: relative;
          overflow: hidden;
        }
        @keyframes outcomeEntrance {
          0% { transform: scale(0.8) translateY(30px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .outcome-header {
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: 2px;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          background: ${playerWon ? 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #fbbf24 100%)' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px ${playerWon ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'});
        }
        .outcome-subheader {
          font-size: 1rem;
          color: var(--text-2);
          margin-bottom: 1.5rem;
          line-height: 1.4;
        }
        .rewards-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: rgba(0,0,0,0.3);
          border-radius: 16px;
          padding: 1.2rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .reward-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.03);
          animation: rewardEntrance 0.4s ease forwards;
          opacity: 0;
          transform: translateX(-10px);
        }
        @keyframes rewardEntrance {
          100% { opacity: 1; transform: translateX(0); }
        }
        .reward-gold {
          color: #fbbf24;
          font-weight: 800;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .coin-spin {
          animation: coinSpin 1.5s linear infinite;
          font-size: 1.3rem;
          display: inline-block;
        }
        @keyframes coinSpin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .outcome-msg {
          font-size: 0.9rem;
          color: var(--text-3);
          line-height: 1.5;
          margin-bottom: 1.8rem;
        }
        .outcome-badge {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          color: #fbbf24;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: bold;
          font-size: 0.9rem;
          margin-top: 0.25rem;
          box-shadow: 0 0 15px rgba(251, 191, 36, 0.2);
        }
        /* Floating coin particles */
        .floating-coin {
          position: absolute;
          pointer-events: none;
          z-index: 1;
          font-size: 1.2rem;
          animation: floatCoinUp 2s ease-out forwards;
        }
        @keyframes floatCoinUp {
          0% { transform: translateY(100px) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-200px) translateX(var(--x-shift)) rotate(360deg); opacity: 0; }
        }
      </style>
      <div class="outcome-card">
        <!-- Floating Coins Container -->
        <div class="coins-emitter" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;"></div>
        
        <div style="position: relative; z-index: 10;">
          <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">${playerWon ? '🎉' : '💀'}</div>
          <h2 class="outcome-header">${playerWon ? 'Vitória!' : 'Derrota!'}</h2>
          <p class="outcome-subheader">${msg}</p>
          
          ${playerWon ? `
            <div class="rewards-list">
              <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-3); text-align: left; display: block; margin-bottom: 0.25rem;">Recompensas Obtidas:</span>
              
              ${goldEarned > 0 ? `
                <div class="reward-item" style="animation-delay: 0.1s;">
                  <span style="color: var(--text-2);">Ouro Concedido</span>
                  <div class="reward-gold" style="display: flex; align-items: center; gap: 4px; justify-content: flex-end;">
                    <span class="pkt-coin coin-spin" style="width: 16px; height: 16px; border-width: 2px;"></span> +${goldEarned} Gold
                  </div>
                </div>
              ` : ''}
              
              ${badgeEarned ? `
                <div class="reward-item" style="animation-delay: 0.25s; flex-direction: column; align-items: center; gap: 0.5rem; background: rgba(251, 191, 36, 0.05); border-color: rgba(251, 191, 36, 0.15); padding: 0.8rem 1.2rem;">
                  <span style="color: var(--text-3); font-size: 0.75rem;">Nova Insígnia Conquistada!</span>
                  <div class="outcome-badge">
                    <span>${rewards.badgeIcon || '🏆'}</span>
                    <span>${rewards.badgeName}</span>
                  </div>
                </div>
              ` : ''}
              
              ${boosterEarned ? `
                <div class="reward-item" style="animation-delay: 0.4s;">
                  <span style="color: var(--text-2);">Pacote de Booster</span>
                  <div style="color: #c084fc; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                    <span>📦</span> +1 Booster
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <p class="outcome-msg" style="color: #fca5a5; margin-bottom: 1.8rem;">
              Não desanime! Ajuste a sua equipe na Loja, verifique se possui os melhores itens equipados e tente novamente.
            </p>
          `}
          
          <button class="btn-primary" id="btn-outcome-ok" style="width: 100%; font-weight: 800; padding: 0.8rem; border-radius: 8px; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; background: ${playerWon ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.05)'}; border-color: ${playerWon ? '#34d399' : 'rgba(255,255,255,0.15)'}; color: white;">
            ${playerWon ? 'Continuar Jornada' : 'Voltar ao Mapa'}
          </button>
        </div>
      </div>
    </div>
  `;

  modalContainer.innerHTML = html;

  // Add floating coin animation if player won gold
  if (playerWon && goldEarned > 0) {
    const emitter = modalContainer.querySelector('.coins-emitter');
    const spawnCoins = () => {
      for (let i = 0; i < 15; i++) {
        setTimeout(() => {
          if (!emitter || !document.body.contains(emitter)) return;
          const coin = document.createElement('div');
          coin.className = 'floating-coin pkt-coin';
          coin.style.width = '16px';
          coin.style.height = '16px';
          coin.style.borderWidth = '2px';
          coin.style.left = `${15 + Math.random() * 70}%`;
          coin.style.bottom = '0px';
          coin.style.setProperty('--x-shift', `${-40 + Math.random() * 80}px`);
          coin.style.animationDelay = `${Math.random() * 0.5}s`;
          emitter.appendChild(coin);
          // Clean up
          setTimeout(() => coin.remove(), 2000);
        }, i * 80);
      }
    };
    spawnCoins();
  }

  modalContainer.querySelector('#btn-outcome-ok').addEventListener('click', () => {
    playSFX('click');
    modalContainer.innerHTML = '';
    callback();
  });
}
