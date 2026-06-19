import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIMIT = 151; // Gen 1 apenas para ser mais rapido

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchPokemon(id) {
  const pokemon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const species = await fetchJson(pokemon.species.url);

  const englishName = species.names?.find(n => n.language.name === 'en')?.name || pokemon.name;

  const stats = {};
  for (const s of pokemon.stats) {
    const map = { 'hp': 'hp', 'attack': 'attack', 'defense': 'defense', 'special-attack': 'spAtk', 'special-defense': 'spDef', 'speed': 'speed' };
    if (map[s.stat.name]) stats[map[s.stat.name]] = s.base_stat;
  }

  // Pegar moves simplificados sem fetch adicional para ficar ultra rápido
  // Mas o jogo precisa de power, type, etc.
  // Vamos pegar 4 moves básicos por enquanto, ou melhor, fazer um fetch leve de apenas 4 moves
  
  const learnableMoves = pokemon.moves.filter(m => 
    m.version_group_details.some(vg => vg.move_learn_method.name === 'level-up')
  );

  const movesDetails = [];
  // Pega apenas os 4 últimos golpes aprendidos (geralmente os mais fortes)
  const topMoves = learnableMoves.slice(-6); 

  for (const m of topMoves) {
    try {
      const move = await fetchJson(m.move.url);
      if (move.power && move.power > 0) {
        movesDetails.push({
          name: move.name,
          displayName: move.names?.find(n => n.language.name === 'en')?.name || move.name,
          type: move.type.name,
          power: move.power,
          accuracy: move.accuracy || 100,
          damage_class: move.damage_class?.name || 'physical'
        });
      }
    } catch(e){}
  }

  while (movesDetails.length < 4) {
    movesDetails.push({ name: 'tackle', displayName: 'Tackle', type: 'normal', power: 40, accuracy: 100, damage_class: 'physical' });
  }

  return {
    id,
    name: pokemon.name,
    displayName: englishName,
    generation: 1,
    types: pokemon.types.map(t => t.type.name),
    stats,
    moves: movesDetails.slice(0, 4),
    sprite: pokemon.sprites?.other?.['official-artwork']?.front_default || pokemon.sprites?.front_default,
    spriteBack: pokemon.sprites?.back_default,
    spriteAnimated: pokemon.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default || pokemon.sprites?.front_default
  };
}

async function main() {
  const all = [];
  const concurrency = 10;
  for (let i = 1; i <= LIMIT; i += concurrency) {
    const batch = [];
    for (let j = 0; j < concurrency && (i+j) <= LIMIT; j++) {
      batch.push(fetchPokemon(i+j));
    }
    const results = await Promise.all(batch);
    all.push(...results);
    console.log(`Fetched up to ${i + concurrency - 1}`);
  }
  
  const outPath = path.join(__dirname, '..', 'src', 'data', 'pokemon-sample.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`Saved ${all.length} pokemons to ${outPath}`);
}

main().catch(console.error);
