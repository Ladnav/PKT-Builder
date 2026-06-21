import fs from 'fs';
import path from 'path';

// Read existing sample pokemon data
const dataPath = 'e:/PKT Builder/src/data/pokemon-sample.json';
const pokemons = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Extract and group unique moves by type
const movesByType = {};
const allUniqueMoves = {};

for (const p of pokemons) {
  for (const m of p.moves) {
    allUniqueMoves[m.name] = m;
    if (!movesByType[m.type]) {
      movesByType[m.type] = [];
    }
    // Only add if not already in the array
    if (!movesByType[m.type].some(existing => existing.name === m.name)) {
      movesByType[m.type].push(m);
    }
  }
}

// Expand moves to 8 for each pokemon
for (const p of pokemons) {
  const existingMoveNames = new Set(p.moves.map(m => m.name));
  const candidates = [];

  // 1. Add candidates from matching types
  for (const type of p.types) {
    const typeMoves = movesByType[type] || [];
    for (const m of typeMoves) {
      if (!existingMoveNames.has(m.name)) {
        candidates.push(m);
      }
    }
  }

  // Sort candidates by power descending to prioritize stronger moves
  candidates.sort((a, b) => (b.power || 0) - (a.power || 0));

  // 2. Add candidates matching types first
  for (const m of candidates) {
    if (p.moves.length >= 8) break;
    p.moves.push(m);
    existingMoveNames.add(m.name);
  }

  // 3. Fallback to normal moves if we still need more to reach 8
  if (p.moves.length < 8) {
    const normalMoves = movesByType['normal'] || [];
    const normalCandidates = normalMoves.filter(m => !existingMoveNames.has(m.name));
    normalCandidates.sort((a, b) => (b.power || 0) - (a.power || 0));
    
    for (const m of normalCandidates) {
      if (p.moves.length >= 8) break;
      p.moves.push(m);
      existingMoveNames.add(m.name);
    }
  }

  // 4. Ultimate fallback: any move if we're still short of 8
  if (p.moves.length < 8) {
    const allMovesArray = Object.values(allUniqueMoves);
    const anyCandidates = allMovesArray.filter(m => !existingMoveNames.has(m.name));
    anyCandidates.sort((a, b) => (b.power || 0) - (a.power || 0));
    
    for (const m of anyCandidates) {
      if (p.moves.length >= 8) break;
      p.moves.push(m);
      existingMoveNames.add(m.name);
    }
  }
  
  // Verify
  if (p.moves.length !== 8) {
    console.warn(`Warning: Pokemon ${p.displayName} (id: ${p.id}) has ${p.moves.length} moves.`);
  }
}

// Write the updated file back
fs.writeFileSync(dataPath, JSON.stringify(pokemons, null, 2));
console.log(`Successfully expanded all ${pokemons.length} Pokémon entries to have 8 moves.`);
