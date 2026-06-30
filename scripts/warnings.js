// Dangerous-encounter WARNING SYSTEM (global, all games).
//
// Users flag Pokémon / items / moves / abilities at one of three severity tiers.
// Flagged things are highlighted everywhere in the tool: a symbol next to trainers
// fielding a warned Pokémon, a coloured Pokémon name + minisprite background, a
// symbol + coloured item/move in the set rows, and coloured item/move/ability in
// the set detail panel. Colours are theme-tuned CSS variables (--warn-1/2/3).
//
// Storage is CANONICAL ENGLISH (one localStorage blob). Matching is done in English
// too — every render path already resolves localized names to English (via the
// pokedex / items.json / English counterpart sets), so warnings work in all 9
// languages with no per-language storage. The localized "add a warning" picker uses
// data/warning-vocab.json (see tools/build_warning_vocab.py); this module never
// needs it — it only stores/queries English names.

const STORAGE_KEY = 'warnings';

// Tier 1 is the MOST severe. Symbols are the emoji the UI shows; `cls` is the CSS
// class carrying the theme-tuned colour (see styles.css --warn-N).
export const TIERS = ['1', '2', '3'];
export const TIER_SYMBOL = { '1': '‼️', '2': '❗️', '3': '⚠️' };
export const CATEGORIES = ['pokemon', 'item', 'move', 'ability'];

// Seeded on first run (no saved warnings yet). Names are canonical English and
// were verified to resolve against items.json / moves.json / the pokedex.
const DEFAULTS = {
    '1': {
        pokemon: [],
        item: ['Quick Claw', 'Bright Powder', 'Lax Incense', 'Focus Band'],
        move: ['Minimize'],
        ability: [],
    },
    '2': {
        pokemon: ['Zoroark'],
        item: [],
        move: ['Fissure', 'Horn Drill', 'Guillotine', 'Sheer Cold', 'Double Team'],
        ability: [],
    },
    '3': {
        pokemon: [],
        item: ["King's Rock", 'Razor Fang'],
        move: ['Swagger', 'Confuse Ray'],
        ability: [],
    },
};

// The live, normalized structure: { '1': {pokemon:Set, item:Set, move:Set, ability:Set}, ... }
let warnings = null;
// Fast lookup per category: Map(englishName -> mostSevereTier).
const maps = { pokemon: new Map(), item: new Map(), move: new Map(), ability: new Map() };

function emptyTier() {
    return { pokemon: [], item: [], move: [], ability: [] };
}

function normalize(raw) {
    const out = {};
    for (const tier of TIERS) {
        out[tier] = emptyTier();
        const src = (raw && raw[tier]) || {};
        for (const cat of CATEGORIES) {
            const list = Array.isArray(src[cat]) ? src[cat] : [];
            // de-dupe, drop blanks, keep insertion order
            out[tier][cat] = [...new Set(list.filter(Boolean))];
        }
    }
    return out;
}

// Lower tier number = more severe. Returns the more severe of two tiers (0 = none).
export function worse(a, b) {
    if (!a) return b || 0;
    if (!b) return a || 0;
    return Number(a) < Number(b) ? a : b;
}

function rebuildMaps() {
    for (const cat of CATEGORIES) maps[cat].clear();
    for (const tier of TIERS) {
        for (const cat of CATEGORIES) {
            for (const name of warnings[tier][cat]) {
                const prev = maps[cat].get(name);
                maps[cat].set(name, prev ? worse(prev, tier) : tier);
            }
        }
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(warnings));
    } catch (e) {
        console.error('Could not save warnings:', e);
    }
}

// Read from localStorage (seeding the defaults on first run) and build the maps.
// Idempotent; called once at app init.
export function loadWarnings() {
    let raw = null;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        raw = stored ? JSON.parse(stored) : null;
    } catch (e) {
        raw = null;
    }
    if (raw) {
        warnings = normalize(raw);
    } else {
        warnings = normalize(DEFAULTS);
        save();  // persist the seed so the user can edit/clear it
    }
    rebuildMaps();
    return warnings;
}

function ensure() {
    if (!warnings) loadWarnings();
}

// A deep copy of the current structure (arrays), for the settings UI to read.
export function getWarnings() {
    ensure();
    const out = {};
    for (const tier of TIERS) {
        out[tier] = {};
        for (const cat of CATEGORIES) out[tier][cat] = [...warnings[tier][cat]];
    }
    return out;
}

// Add a warning (no-op if already present in this tier/category). Removing it from any
// OTHER tier first keeps a name in a single tier (the most recent choice wins).
export function addWarning(tier, category, en) {
    ensure();
    if (!TIERS.includes(tier) || !CATEGORIES.includes(category) || !en) return;
    for (const t of TIERS) {
        const i = warnings[t][category].indexOf(en);
        if (i !== -1) warnings[t][category].splice(i, 1);
    }
    warnings[tier][category].push(en);
    save();
    rebuildMaps();
}

export function removeWarning(tier, category, en) {
    ensure();
    const list = warnings[tier]?.[category];
    if (!list) return;
    const i = list.indexOf(en);
    if (i !== -1) {
        list.splice(i, 1);
        save();
        rebuildMaps();
    }
}

// Restore the built-in defaults (used by a "reset to defaults" affordance).
export function resetWarnings() {
    warnings = normalize(DEFAULTS);
    save();
    rebuildMaps();
    return warnings;
}

/* ---------- queries (English canonical names) ---------- */

export function tierForPokemon(en) { ensure(); return maps.pokemon.get(en) || 0; }
export function tierForItem(en)    { ensure(); return maps.item.get(en) || 0; }
export function tierForMove(en)    { ensure(); return maps.move.get(en) || 0; }
export function tierForAbility(en) { ensure(); return maps.ability.get(en) || 0; }

// True when ANY warning of a given category exists (lets callers skip work cheaply).
export function hasWarnings(category) { ensure(); return maps[category].size > 0; }

/* ---------- presentation helpers ---------- */

export function warnClass(tier) { return tier ? `warn-${tier}` : ''; }
export function warnSymbol(tier) { return tier ? TIER_SYMBOL[tier] : ''; }
