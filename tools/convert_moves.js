#!/usr/bin/env node
// Converts tools/src/move_data.js (per-generation move dicts, calculator
// format: MOVES_RBY .. MOVES_SV built with $.extend) into data/moves.json.
//
// Output format, designed for gen-aware type lookup:
//   { "moves": { "<English move name>": [[firstGen, "Type"], [genChanged, "NewType"], ...] } }
// Lookup: take the last pair whose gen <= the variant's gen. No pair → move
// doesn't exist (yet) in that generation.
//
// Usage: node tools/convert_moves.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'src', 'move_data.js'), 'utf8');

// Minimal jQuery shim for "$.extend(true, {}, base, overrides)".
function deepExtend(target, ...sources) {
    for (const src of sources) {
        for (const [key, value] of Object.entries(src)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                target[key] = deepExtend(target[key] && typeof target[key] === 'object' ? target[key] : {}, value);
            } else {
                target[key] = value;
            }
        }
    }
    return target;
}
const $ = { extend: (_deep, target, ...sources) => deepExtend(target, ...sources) };

// Evaluate the source; it defines MOVES_RBY .. MOVES_SV.
const sandbox = new Function('$', `${source};
    return { 1: MOVES_RBY, 2: MOVES_GSC, 3: MOVES_ADV, 4: MOVES_DPP,
             5: MOVES_BW, 6: MOVES_XY, 7: MOVES_SM, 8: MOVES_SS, 9: MOVES_SV };`);
const byGen = sandbox($);

// Build per-move [gen, type] change lists.
const moves = {};
for (let gen = 1; gen <= 9; gen++) {
    for (const [name, data] of Object.entries(byGen[gen])) {
        if (!data.type || name === '(No Move)') continue;
        if (name.includes('(')) continue; // calculator variants like "Bolt Beak (Doubled)"
        const list = moves[name] ?? (moves[name] = []);
        if (list.length === 0 || list[list.length - 1][1] !== data.type) {
            list.push([gen, data.type]);
        }
    }
}

// The calculator data backports current types to the gen a move was
// introduced, so real historical type changes must be patched manually.
// (Gen-1 changes like Bite/Gust/Karate Chop are irrelevant — no gen-1
// facility is planned — but the gen-6 Fairy retyping affects Gen 5 Subway,
// and Curse matters for Gen 4 Frontier.)
const TYPE_CHANGES = {
    'Charm': [[2, 'Normal'], [6, 'Fairy']],
    'Moonlight': [[2, 'Normal'], [6, 'Fairy']],
    'Sweet Kiss': [[2, 'Normal'], [6, 'Fairy']],
    'Curse': [[2, '???'], [5, 'Ghost']],
};
for (const [name, list] of Object.entries(TYPE_CHANGES)) {
    if (moves[name]) moves[name] = list;
}

// Moves absent from the calculator data (mostly status moves) — [gen, type].
const MANUAL_MOVES = {
    'Assist': [[3, 'Normal']],
    'Bide': [[1, 'Normal']],
    'Echoed Voice': [[5, 'Normal']],
    'Heal Block': [[4, 'Psychic']],
    'Hidden Power': [[2, 'Normal']],   // actual type varies; shown as Normal
    'Trump Card': [[4, 'Normal']],
    'Howl': [[3, 'Normal']],
    'Poison Gas': [[1, 'Poison']],
    'Teleport': [[1, 'Psychic']],
    'Toxic Thread': [[7, 'Poison']],
    'Transform': [[1, 'Normal']],
    'Life Dew': [[8, 'Water']],
    'Burning Bulwark': [[9, 'Fire']],
    'Dragon Cheer': [[9, 'Dragon']],
    'Double Slap': [[1, 'Normal']],
    'Fury Attack': [[1, 'Normal']],
    'Simple Beam': [[5, 'Normal']],
    'Smog': [[1, 'Poison']],
    'Supersonic': [[1, 'Normal']],
    'Water Sport': [[3, 'Water']],
};
for (const [name, list] of Object.entries(MANUAL_MOVES)) {
    if (!moves[name]) moves[name] = list;
}

// Renamed moves: pre-gen-6 data files use the era's official spelling.
// Spelling-only differences ("AncientPower"/"Ancient Power") are handled by
// normalized lookup in the app; true renames need explicit aliases.
const ALIASES = {
    'Faint Attack': 'Feint Attack',
    'Hi Jump Kick': 'High Jump Kick',
    'Smelling Salt': 'Smelling Salts',
};
for (const [oldName, newName] of Object.entries(ALIASES)) {
    if (moves[newName] && !moves[oldName]) moves[oldName] = moves[newName];
}

const outPath = path.join(ROOT, 'data', 'moves.json');
fs.writeFileSync(outPath, JSON.stringify({ moves }, null, 4) + '\n');

const changed = Object.entries(moves).filter(([, l]) => l.length > 1);
console.log(`Wrote ${outPath}`);
console.log(`${Object.keys(moves).length} moves, ${changed.length} with type changes between gens:`);
for (const [name, list] of changed) console.log(`  ${name}: ${list.map(([g, t]) => `gen${g}=${t}`).join(', ')}`);
