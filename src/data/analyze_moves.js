import fs from 'fs';
import path from 'path';

const data = JSON.parse(fs.readFileSync('e:/PKT Builder/src/data/pokemon-sample.json', 'utf8'));

const movesByType = {};
const allMoves = {};

for (const p of data) {
  for (const m of p.moves) {
    allMoves[m.name] = m;
    if (!movesByType[m.type]) {
      movesByType[m.type] = new Set();
    }
    movesByType[m.type].add(m.name);
  }
}

console.log("Total unique moves:", Object.keys(allMoves).length);
console.log("Types with moves:");
for (const type in movesByType) {
  console.log(`- ${type}: ${movesByType[type].size} moves`);
}

// Write the unique moves list to a temporary file for analysis
fs.writeFileSync('e:/PKT Builder/src/data/unique-moves.json', JSON.stringify(Object.values(allMoves), null, 2));
