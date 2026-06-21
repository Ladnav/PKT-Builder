// src/ui/screens/CampaignScreen.js
import { navigate } from '../router.js';
import { playBGM, playSFX, attachMuteToggleListener } from '../../lib/sounds.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { PokemonCard, PokemonMiniCard } from '../components/PokemonCard.js';
import { renderBattleModal } from '../components/BattleModal.js';
import { createBattleState, simulateBattle } from '../../engine/battle.js';
import pokemonData from '../../data/pokemon-sample.json';
import itemsData from '../../data/items-sample.json';

// CITIES CONFIGURATION
const CITIES_CONFIG = {
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
      { name: "Treinador Liam", type: "NPC", team: [{ id: 76 }, { id: 68 }, { id: 143 }] },
      { name: "Treinador Jerry", type: "NPC", team: [{ id: 248 }, { id: 76 }, { id: 36 }] },
      { name: "Treinadora Paula", type: "NPC", team: [{ id: 248 }, { id: 68 }, { id: 149 }] },
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
      { name: "Treinador Daren", type: "NPC", team: [{ id: 134 }, { id: 9 }, { id: 25 }] },
      { name: "Treinador Luis", type: "NPC", team: [{ id: 395 }, { id: 230 }, { id: 80 }] },
      { name: "Treinadora Becky", type: "NPC", team: [{ id: 160 }, { id: 131 }, { id: 350 }] },
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
      { name: "Treinador Jax", type: "NPC", team: [{ id: 25 }, { id: 82 }, { id: 143 }] },
      { name: "Treinador Ron", type: "NPC", team: [{ id: 125 }, { id: 26 }, { id: 123 }] },
      { name: "Treinadora Amy", type: "NPC", team: [{ id: 135 }, { id: 82 }, { id: 36 }] },
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
      { name: "Treinadora Tina", type: "NPC", team: [{ id: 154 }, { id: 143 }, { id: 134 }] },
      { name: "Treinador Clara", type: "NPC", team: [{ id: 389 }, { id: 254 }, { id: 36 }] },
      { name: "Treinadora Rose", type: "NPC", team: [{ id: 3 }, { id: 254 }, { id: 154 }] },
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
      { name: "Treinador Kirk", type: "NPC", team: [{ id: 94 }, { id: 3 }, { id: 197 }] },
      { name: "Treinador Ned", type: "NPC", team: [{ id: 461 }, { id: 94 }, { id: 65 }] },
      { name: "Treinadora Sue", type: "NPC", team: [{ id: 94 }, { id: 229 }, { id: 68 }] },
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
      { name: "Treinador Igor", type: "NPC", team: [{ id: 80 }, { id: 124 }, { id: 65 }] },
      { name: "Treinador Yuri", type: "NPC", team: [{ id: 196 }, { id: 282 }, { id: 475 }] },
      { name: "Treinadora Miki", type: "NPC", team: [{ id: 376 }, { id: 282 }, { id: 196 }] },
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
      { name: "Treinador Burt", type: "NPC", team: [{ id: 38 }, { id: 136 }, { id: 59 }] },
      { name: "Treinador Cole", type: "NPC", team: [{ id: 126 }, { id: 157 }, { id: 229 }] },
      { name: "Treinador Ryan", type: "NPC", team: [{ id: 257 }, { id: 392 }, { id: 6 }] },
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
      { name: "Recruta Team Rocket", type: "NPC", team: [{ id: 76 }, { id: 68 }, { id: 143 }] },
      { name: "Recruta Rocket Fêmea", type: "NPC", team: [{ id: 260 }, { id: 473 }, { id: 389 }] },
      { name: "Admin Petrel", type: "NPC", team: [{ id: 445 }, { id: 149 }, { id: 248 }] },
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

const CITY_ORDER = ['pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian', 'elite4'];

const CITY_SHOPS = {
  pewter: [
    { id: 76, name: 'golem', cost: 50, isShiny: false, displayName: 'Golem' },
    { id: 214, name: 'heracross', cost: 150, isShiny: false, displayName: 'Heracross' },
    { id: 248, name: 'tyranitar', cost: 300, isShiny: true, displayName: 'Tyranitar ⭐' }
  ],
  cerulean: [
    { id: 80, name: 'slowbro', cost: 50, isShiny: false, displayName: 'Slowbro' },
    { id: 131, name: 'lapras', cost: 150, isShiny: false, displayName: 'Lapras' },
    { id: 350, name: 'milotic', cost: 300, isShiny: true, displayName: 'Milotic ⭐' }
  ],
  vermilion: [
    { id: 25, name: 'pikachu', cost: 50, isShiny: false, displayName: 'Pikachu' },
    { id: 82, name: 'magneton', cost: 150, isShiny: false, displayName: 'Magneton' },
    { id: 135, name: 'jolteon', cost: 300, isShiny: true, displayName: 'Jolteon ⭐' }
  ],
  celadon: [
    { id: 154, name: 'meganium', cost: 50, isShiny: false, displayName: 'Meganium' },
    { id: 254, name: 'sceptile', cost: 150, isShiny: false, displayName: 'Sceptile' },
    { id: 3, name: 'venusaur', cost: 300, isShiny: true, displayName: 'Venusaur ⭐' }
  ],
  fuchsia: [
    { id: 461, name: 'weavile', cost: 50, isShiny: false, displayName: 'Weavile' },
    { id: 94, name: 'gengar', cost: 150, isShiny: false, displayName: 'Gengar' },
    { id: 248, name: 'tyranitar', cost: 300, isShiny: true, displayName: 'Tyranitar ⭐' }
  ],
  saffron: [
    { id: 196, name: 'espeon', cost: 50, isShiny: false, displayName: 'Espeon' },
    { id: 282, name: 'gardevoir', cost: 150, isShiny: false, displayName: 'Gardevoir' },
    { id: 376, name: 'metagross', cost: 300, isShiny: true, displayName: 'Metagross ⭐' }
  ],
  cinnabar: [
    { id: 136, name: 'flareon', cost: 50, isShiny: false, displayName: 'Flareon' },
    { id: 59, name: 'arcanine', cost: 150, isShiny: false, displayName: 'Arcanine' },
    { id: 6, name: 'charizard', cost: 300, isShiny: true, displayName: 'Charizard ⭐' }
  ],
  viridian: [
    { id: 76, name: 'golem', cost: 50, isShiny: false, displayName: 'Golem' },
    { id: 473, name: 'mamoswine', cost: 150, isShiny: false, displayName: 'Mamoswine' },
    { id: 445, name: 'garchomp', cost: 300, isShiny: true, displayName: 'Garchomp ⭐' }
  ]
};

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
let selectedMode = 'draft'; // 'album' | 'draft'
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
        currentCity: 'pewter',
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

function isCityUnlocked(cityId) {
  if (cityId === 'pewter') return true;
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
    activeStageIdx = 3; // Replay del Leader
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

  svgPaths += drawSvgLine('pewter', 'cerulean');
  svgPaths += drawSvgLine('pewter', 'viridian');
  svgPaths += drawSvgLine('cerulean', 'saffron');
  svgPaths += drawSvgLine('saffron', 'celadon');
  svgPaths += drawSvgLine('saffron', 'vermilion');
  svgPaths += drawSvgLine('celadon', 'fuchsia');
  svgPaths += drawSvgLine('fuchsia', 'cinnabar');
  svgPaths += drawSvgLine('cinnabar', 'viridian');
  svgPaths += drawSvgLine('viridian', 'elite4');

  // Render badges list
  const badgeSlotsHtml = CITY_ORDER.slice(0, 8).map(cId => {
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
      return `
        <div class="campaign-stage-item ${statusClass}">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: bold; color: white;">${stg.name}</span>
            <span style="font-size: 0.75rem; color: var(--text-3);">${i === 4 ? 'Desafio de Campeão' : 'Elite dos Quatro'}</span>
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
      } else if (!isCurrent && i === 3) {
        statusClass = 'active'; // Replay Leader
        statusText = 'Replay';
      }
      return `
        <div class="campaign-stage-item ${statusClass}">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: bold; color: white;">${stg.name}</span>
            <span style="font-size: 0.75rem; color: var(--text-3);">${stg.type === 'Leader' ? 'Líder de Ginásio' : 'Treinador NPC'}</span>
          </div>
          <span class="stage-badge ${statusClass}">${statusText}</span>
        </div>
      `;
    }).join('');
  }

  // Active stage preview
  const currentStageObj = activeCity.stages[activeStageIdx] || activeCity.stages[3];
  const isChampionDefeated = selectedCityId === 'elite4' && progress.eliteFourIndex >= 5;

  let btnBattleHtml = '';
  if (isChampionDefeated) {
    btnBattleHtml = `
      <div style="text-align: center; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; color: #34d399; font-weight: bold; margin-bottom: 0.5rem;">
        🏆 Liga Pokémon Concluída! Você é o Campeão de Kanto!
      </div>
    `;
  } else if (!unlocked) {
    btnBattleHtml = `
      <button class="btn-primary" disabled style="width: 100%; margin-bottom: 0.5rem; filter: grayscale(1);">
        🔒 Desafio Trancado
      </button>
    `;
  } else if (selectedCityId === 'elite4' || isCurrent || activeStageIdx === 3) {
    btnBattleHtml = `
      <button class="btn-primary" id="btn-challenge-stage" style="width: 100%; margin-bottom: 0.5rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #34d399;">
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
        
        <h1 class="campaign-header-title">🗺️ JORNADA DE KANTO (Offline)</h1>
        
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="campaign-gold-badge">
            <span>🪙</span>
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
            
            <!-- Pewter -->
            <div class="map-node ${progress.completedCities.includes('pewter') ? 'completed' : (progress.currentCity === 'pewter' ? 'active' : '')}" style="left: 30%; top: 25%;" data-city="pewter">
              <div class="map-node-inner">🪨</div>
              <div class="map-node-label">Pewter (Brock)</div>
            </div>
            
            <!-- Cerulean -->
            <div class="map-node ${progress.completedCities.includes('cerulean') ? 'completed' : (progress.currentCity === 'cerulean' ? 'active' : (isCityUnlocked('cerulean') ? '' : 'locked'))}" style="left: 65%; top: 15%;" data-city="cerulean">
              <div class="map-node-inner">💧</div>
              <div class="map-node-label">Cerulean (Misty)</div>
            </div>
            
            <!-- Vermilion -->
            <div class="map-node ${progress.completedCities.includes('vermilion') ? 'completed' : (progress.currentCity === 'vermilion' ? 'active' : (isCityUnlocked('vermilion') ? '' : 'locked'))}" style="left: 72%; top: 60%;" data-city="vermilion">
              <div class="map-node-inner">⚡</div>
              <div class="map-node-label">Vermilion (Lt. Surge)</div>
            </div>
            
            <!-- Celadon -->
            <div class="map-node ${progress.completedCities.includes('celadon') ? 'completed' : (progress.currentCity === 'celadon' ? 'active' : (isCityUnlocked('celadon') ? '' : 'locked'))}" style="left: 48%; top: 45%;" data-city="celadon">
              <div class="map-node-inner">🌈</div>
              <div class="map-node-label">Celadon (Erika)</div>
            </div>
            
            <!-- Fuchsia -->
            <div class="map-node ${progress.completedCities.includes('fuchsia') ? 'completed' : (progress.currentCity === 'fuchsia' ? 'active' : (isCityUnlocked('fuchsia') ? '' : 'locked'))}" style="left: 55%; top: 80%;" data-city="fuchsia">
              <div class="map-node-inner">💜</div>
              <div class="map-node-label">Fuchsia (Koga)</div>
            </div>
            
            <!-- Saffron -->
            <div class="map-node ${progress.completedCities.includes('saffron') ? 'completed' : (progress.currentCity === 'saffron' ? 'active' : (isCityUnlocked('saffron') ? '' : 'locked'))}" style="left: 65%; top: 45%;" data-city="saffron">
              <div class="map-node-inner">🔮</div>
              <div class="map-node-label">Saffron (Sabrina)</div>
            </div>
            
            <!-- Cinnabar -->
            <div class="map-node ${progress.completedCities.includes('cinnabar') ? 'completed' : (progress.currentCity === 'cinnabar' ? 'active' : (isCityUnlocked('cinnabar') ? '' : 'locked'))}" style="left: 28%; top: 85%;" data-city="cinnabar">
              <div class="map-node-inner">🔥</div>
              <div class="map-node-label">Cinnabar (Blaine)</div>
            </div>
            
            <!-- Viridian -->
            <div class="map-node ${progress.completedCities.includes('viridian') ? 'completed' : (progress.currentCity === 'viridian' ? 'active' : (isCityUnlocked('viridian') ? '' : 'locked'))}" style="left: 28%; top: 55%;" data-city="viridian">
              <div class="map-node-inner">🟢</div>
              <div class="map-node-label">Viridian (Giovanni)</div>
            </div>
            
            <!-- Elite 4 -->
            <div class="map-node ${progress.completedCities.includes('elite4') ? 'completed' : (progress.currentCity === 'elite4' ? 'active' : (isCityUnlocked('elite4') ? '' : 'locked'))}" style="left: 10%; top: 45%;" data-city="elite4">
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
                <button class="btn-primary" id="btn-campaign-shop" style="width: 100%; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24;">
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
      // Navigate to personal album screen or trigger a modal
      // We can open the existing album modal or navigate to album
      // Let's open the album modal! Wait, let's just trigger / navigate to album if a route is available.
      // But wait! Is there a route for album? The router has 'home', 'auth', 'lobby', 'draft', 'bracket'.
      // The Album is normally rendered as a modal in HomeScreen! Let's check how HomeScreen opens the album.
      // Let's run a grep search for AlbumModal to see how it is triggered.
      // Actually, we can just render the album modal here if we import it, or alert.
      // Let's look up how to trigger AlbumModal.
      alert('Seu álbum pode ser visto na tela principal do jogo online clicando em "Meu Álbum".');
    });
  }

  // Map nodes click
  container.querySelectorAll('.map-node').forEach(node => {
    node.addEventListener('click', () => {
      const cityId = node.dataset.city;
      if (!isCityUnlocked(cityId)) {
        playSFX('faint');
        alert('Este ginásio está bloqueado! Derrote os líderes anteriores primeiro.');
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
              <span style="color: #fbbf24; font-weight: 800; font-size: 1.2rem;">🪙 ${gold} Ouro</span>
            </div>
            
            <div class="shop-grid">
              <!-- Item 1: Booster Pack -->
              <div class="shop-item-card">
                <span style="font-size: 2.2rem;">📦</span>
                <h3 style="font-size: 0.95rem; margin: 0.5rem 0 0.25rem 0; color: white;">Pacote Booster</h3>
                <p style="font-size: 0.75rem; color: var(--text-3); margin: 0 0 1rem 0; height: 32px;">Contém 3 cartas de pokémons aleatórios para o álbum.</p>
                <button class="shop-buy-btn" id="btn-buy-booster" ${gold < 100 ? 'disabled' : ''}>
                  🪙 100 Ouro
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
                      🪙 ${item.cost} Ouro
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <div class="campaign-modal-footer">
            <button class="btn-primary" id="btn-shop-done" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
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
        alert('🎉 Booster comprado com sucesso! O pacote foi adicionado à sua conta online.');

      } catch (err) {
        console.error(err);
        alert('Erro ao processar compra de booster.');
        gold += 100; // Refund
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));
      } finally {
        // Re-render shop modal
        openShopModal();
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
        alert(`🎉 Carta ${item.displayName} comprada com sucesso e adicionada ao seu Álbum!`);

        // Update local list
        const { data: cards } = await supabase
          .from('user_cards')
          .select('pokemon_id, is_shiny, quantity')
          .eq('user_id', currentUserId);
        ownedCards = cards || [];

      } catch (err) {
        console.error(err);
        alert('Erro ao processar compra de carta.');
        gold += item.cost; // Refund
        localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));
      } finally {
        openShopModal();
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

  // Local helper to render modal layout
  const renderPreMatchContent = () => {
    let modeContentHtml = '';

    if (selectedMode === 'album') {
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

      modeContentHtml = `
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
              ⚠️ Você não possui nenhuma carta no seu álbum ainda! Compre boosters na loja ou use o Modo Draft Rápido Local.
            </p>
          ` : `
            <div class="owned-cards-grid">
              ${gridCardsHtml}
            </div>
          `}
        </div>
      `;

    } else {
      // Quick Local Draft View
      if (draftRoster.length < 6) {
        // Drafting in progress
        modeContentHtml = `
          <div style="margin-top: 1rem; text-align: center;">
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--info); margin-bottom: 0.5rem;">
              Draft Local: Rodada ${draftRound} de 6
            </div>
            <p style="color: var(--text-3); font-size: 0.85rem; margin-top: 0; margin-bottom: 1.25rem;">
              Selecione 1 dos 3 pokémons sorteados abaixo para sua equipe:
            </p>
            
            <div class="draft-options-row">
              ${draftOptions.map((opt, i) => `
                <div class="draft-option-card" data-idx="${i}">
                  ${PokemonCard(opt, { showStats: true })}
                </div>
              `).join('')}
            </div>

            <div style="margin-top: 1rem;">
              <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-2);">Seu Time Atual:</span>
              <div class="roster-preview-slots" style="margin-top: 0.5rem;">
                ${Array.from({ length: 6 }).map((_, i) => {
                  const p = draftRoster[i];
                  return p ? `
                    <div class="roster-preview-slot filled">
                      <img src="${p.sprite}" alt="${p.displayName}" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                  ` : `<div class="roster-preview-slot">?</div>`;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      } else {
        // Draft finished
        modeContentHtml = `
          <div style="margin-top: 1rem; text-align: center;">
            <div style="font-weight: 800; font-size: 1.1rem; color: #34d399; margin-bottom: 0.5rem;">
              🎉 Time Draftado com Sucesso!
            </div>
            
            <div class="roster-preview-slots">
              ${draftRoster.map(p => `
                <div class="roster-preview-slot filled">
                  <img src="${p.sprite}" alt="${p.displayName}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
              `).join('')}
            </div>
            
            <button class="btn-primary" id="btn-redraft" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); margin-top: 0.5rem; font-size: 0.85rem;">
              🔄 Refazer Draft
            </button>
          </div>
        `;
      }
    }

    const canBattle = (selectedMode === 'album' && selectedRoster.length === 6) ||
                     (selectedMode === 'draft' && draftRoster.length === 6);

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
              <div>
                <span style="font-size: 0.75rem; color: var(--danger); font-weight: bold; text-transform: uppercase;">Oponente:</span>
                <h3 style="margin: 0; font-size: 1.1rem; color: white;">${stage.name}</h3>
              </div>
              
              <div style="display: flex; gap: 6px;">
                ${opTeamPreview.map(p => `
                  <div style="width: 38px; height: 38px; background: rgba(0,0,0,0.3); border-radius: 6px; display: flex; align-items: center; justify-content: center;" title="${p.displayName}">
                    <img src="${p.sprite}" alt="${p.displayName}" style="width: 32px; height: 32px; object-fit: contain;">
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Mode Selector Cards -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="team-mode-card ${selectedMode === 'draft' ? 'active' : ''}" id="mode-select-draft">
                <div class="team-mode-radio"></div>
                <div>
                  <span style="font-weight: 700; color: white; display: block; font-size: 0.9rem;">Draft Rápido Local</span>
                  <span style="font-size: 0.75rem; color: var(--text-3);">Monte um time sorteando 6 cartas rodada a rodada. Grátis e rápido.</span>
                </div>
              </div>
              
              <div class="team-mode-card ${selectedMode === 'album' ? 'active' : ''}" id="mode-select-album">
                <div class="team-mode-radio"></div>
                <div>
                  <span style="font-weight: 700; color: white; display: block; font-size: 0.9rem;">Coleção Pessoal</span>
                  <span style="font-size: 0.75rem; color: var(--text-3);">Crie sua equipe usando as cartas reais do seu álbum colecionado.</span>
                </div>
              </div>
            </div>

            <!-- Mode Content Area -->
            ${modeContentHtml}
          </div>
          
          <div class="campaign-modal-footer">
            <button class="btn-primary" id="btn-prematch-cancel" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);">
              Cancelar
            </button>
            <button class="btn-primary" id="btn-prematch-battle" ${!canBattle ? 'disabled' : ''} style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-color: #34d399; font-weight: 900;">
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

    // Mode toggles
    modalContainer.querySelector('#mode-select-draft').addEventListener('click', () => {
      if (selectedMode !== 'draft') {
        playSFX('click');
        selectedMode = 'draft';
        draftRoster = [];
        draftRound = 1;
        generateDraftOptions();
        updatePrematchUI();
      }
    });

    modalContainer.querySelector('#mode-select-album').addEventListener('click', () => {
      if (selectedMode !== 'album') {
        playSFX('click');
        selectedMode = 'album';
        selectedRoster = [];
        updatePrematchUI();
      }
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
            alert('Você já escolheu 6 Pokémons!');
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

    // Draft Option Pick
    modalContainer.querySelectorAll('.draft-option-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx, 10);
        const pick = draftOptions[idx];
        playSFX('click');
        draftRoster.push(pick);

        if (draftRound < 6) {
          draftRound++;
          generateDraftOptions();
        }
        updatePrematchUI();
      });
    });

    // Redraft button
    const redraftBtn = modalContainer.querySelector('#btn-redraft');
    if (redraftBtn) {
      redraftBtn.addEventListener('click', () => {
        playSFX('click');
        draftRoster = [];
        draftRound = 1;
        generateDraftOptions();
        updatePrematchUI();
      });
    }

    // Battle trigger
    const startBattleBtn = modalContainer.querySelector('#btn-prematch-battle');
    if (startBattleBtn) {
      startBattleBtn.addEventListener('click', () => {
        playSFX('click');
        modalContainer.innerHTML = '';
        const team = selectedMode === 'album' ? selectedRoster : draftRoster;
        startBattle(team);
      });
    }
  };

  const updatePrematchUI = () => {
    modalContainer.innerHTML = renderPreMatchContent();
    attachPrematchEvents();
  };

  // Initialize draft if selected
  if (selectedMode === 'draft' && draftRoster.length === 0) {
    generateDraftOptions();
  }

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

          alert('🏆 PARABÉNS! Você derrotou a Campeã Cynthia e se tornou o novo Campeão da Liga Pokémon! +150 Gold concedidos!');
        } else {
          // Beat Elite 4 member
          gold += 30;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          progress.eliteFourIndex++;
          localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));

          alert(`🎉 Vitória! Você derrotou ${stage.name}! Preparando para o próximo desafio da Elite dos Quatro. +30 Gold!`);
        }

      } else {
        const isLeader = (activeStageIdx === 3);
        if (isLeader) {
          // Beat Gym Leader
          gold += 50;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          // Save badge in Supabase
          try {
            if (!ownedBadges.has(cityConfig.badge)) {
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

          alert(`🏆 PARABÉNS! Você derrotou o Líder ${cityConfig.leader}! Conquistou a ${cityConfig.badgeName}, +50 Gold e +1 Booster Pack!`);

        } else {
          // Beat NPC
          gold += 15;
          localStorage.setItem(`pkt_campaign_gold_${currentUserId}`, String(gold));

          if (progress.currentCity === cityId && progress.currentStage === activeStageIdx) {
            progress.currentStage++;
            localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
          }

          alert(`🎉 Vitória! Você derrotou ${stage.name} e avançou no ginásio. +15 Gold!`);
        }
      }
    } else {
      // Player lost
      playSFX('faint');
      if (cityId === 'elite4') {
        // Reset Elite 4 progress!
        progress.eliteFourIndex = 0;
        localStorage.setItem(`pkt_campaign_progress_${currentUserId}`, JSON.stringify(progress));
        alert('💀 Derrota! Você foi eliminado da Liga Pokémon e terá que reiniciar o desafio da Elite dos Quatro a partir da Lorelei!');
      } else {
        alert('💀 Derrota! Você foi vencido nesta batalha. Ajuste sua equipe na loja ou use outros pokémons e tente novamente!');
      }
    }

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
  });
}
