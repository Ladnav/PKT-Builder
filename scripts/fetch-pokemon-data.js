// scripts/fetch-pokemon-data.js
// Roda UMA VEZ para gerar src/data/pokemon-gen1-4.json
// Usage: node scripts/fetch-pokemon-data.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://pokeapi.co/api/v2';
const GEN1_4_LIMIT = 493; // Pokémons #1 a #493

// Tipos de dano válidos (excluir moves de status/buff)
const DAMAGE_CATEGORIES = ['physical', 'special'];

// Delay para respeitar rate limit da API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// Seleciona os top 4 moves de um Pokémon
// Critérios: moves de dano, máx 2 do mesmo tipo, ordenados por poder (STAB primeiro)
function selectBestMoves(movesData, pokemonTypes) {
  // Filtra apenas moves com dano
  const damaging = movesData.filter(m =>
    m.power && m.power > 0 && DAMAGE_CATEGORIES.includes(m.damage_class)
  );

  // Ordena: STAB moves primeiro, depois por poder
  damaging.sort((a, b) => {
    const aStab = pokemonTypes.includes(a.type) ? 1 : 0;
    const bStab = pokemonTypes.includes(b.type) ? 1 : 0;
    if (bStab !== aStab) return bStab - aStab;
    return b.power - a.power;
  });

  // Seleciona com diversidade de tipos (máx 2 do mesmo tipo)
  const selected = [];
  const typeCount = {};

  for (const move of damaging) {
    if (selected.length >= 4) break;
    const count = typeCount[move.type] || 0;
    if (count < 2) {
      selected.push(move);
      typeCount[move.type] = count + 1;
    }
  }

  // Se ainda não tem 4, pega o que tiver (sem restrição de tipo)
  if (selected.length < 4) {
    for (const move of damaging) {
      if (selected.length >= 4) break;
      if (!selected.includes(move)) selected.push(move);
    }
  }

  return selected;
}

async function fetchMovesForPokemon(pokemonData) {
  const pokemonTypes = pokemonData.types.map(t => t.type.name);
  const movesDetails = [];

  // Pega moves aprendidos por level-up ou TM
  const learnableMoves = pokemonData.moves.filter(m =>
    m.version_group_details.some(vg =>
      ['level-up', 'machine'].includes(vg.move_learn_method.name)
    )
  );

  // Busca detalhes dos moves (limitado a 40 para não explodir a API)
  const moveUrls = learnableMoves.slice(0, 60).map(m => m.move.url);

  for (const url of moveUrls) {
    try {
      const move = await fetchJson(url);
      if (move.power && move.power > 0 && move.damage_class) {
        movesDetails.push({
          name: move.name,
          displayName: move.names?.find(n => n.language.name === 'en')?.name || move.name,
          type: move.type.name,
          power: move.power,
          accuracy: move.accuracy || 100,
          damage_class: move.damage_class.name,
        });
      }
      await delay(30); // Respeita rate limit
    } catch (e) {
      // Ignora erros de moves individuais
    }
  }

  return selectBestMoves(movesDetails, pokemonTypes);
}

async function fetchPokemon(id) {
  const pokemon = await fetchJson(`${BASE_URL}/pokemon/${id}`);
  const species = await fetchJson(pokemon.species.url);

  const types = pokemon.types.map(t => t.type.name);
  const stats = {};
  for (const s of pokemon.stats) {
    const statMap = {
      'hp': 'hp',
      'attack': 'attack',
      'defense': 'defense',
      'special-attack': 'spAtk',
      'special-defense': 'spDef',
      'speed': 'speed',
    };
    if (statMap[s.stat.name]) {
      stats[statMap[s.stat.name]] = s.base_stat;
    }
  }

  const moves = await fetchMovesForPokemon(pokemon);

  // Se não tem moves suficientes, usa Tackle como fallback
  while (moves.length < 1) {
    moves.push({ name: 'tackle', displayName: 'Tackle', type: 'normal', power: 40, accuracy: 100, damage_class: 'physical' });
  }

  // Nome em inglês
  const englishName = species.names?.find(n => n.language.name === 'en')?.name || pokemon.name;

  // Sprites
  const sprite = pokemon.sprites?.other?.['official-artwork']?.front_default
    || pokemon.sprites?.front_default
    || null;

  // Geração
  let generation = 1;
  if (id <= 151) generation = 1;
  else if (id <= 251) generation = 2;
  else if (id <= 386) generation = 3;
  else generation = 4;

  return {
    id,
    name: pokemon.name,
    displayName: englishName,
    generation,
    types,
    stats,
    moves,
    sprite,
    spriteBack: pokemon.sprites?.back_default || null,
    spriteAnimated: pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default || sprite,
  };
}

async function main() {
  console.log(`🚀 Fetching ${GEN1_4_LIMIT} Pokémons (Gen 1-4)...\n`);
  const pokemons = [];
  const errors = [];

  for (let id = 1; id <= GEN1_4_LIMIT; id++) {
    try {
      process.stdout.write(`\r  Fetching #${id}/${GEN1_4_LIMIT} — ${Math.round(id/GEN1_4_LIMIT*100)}%`);
      const p = await fetchPokemon(id);
      pokemons.push(p);
      await delay(100); // Delay entre Pokémons
    } catch (e) {
      errors.push({ id, error: e.message });
      console.error(`\n  ❌ Error fetching #${id}: ${e.message}`);
    }
  }

  console.log(`\n\n✅ Fetched ${pokemons.length} Pokémons`);
  if (errors.length) console.log(`⚠️  ${errors.length} errors:`, errors);

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'pokemon-gen1-4.json');
  fs.writeFileSync(outputPath, JSON.stringify(pokemons, null, 2));
  console.log(`💾 Saved to ${outputPath}`);
  console.log(`📦 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
