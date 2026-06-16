// Displayed speed is COMPUTED from pokédex base stats — sets files carry no
// static speed values. The formula reproduces the game exactly (and the
// static values the site used to ship):
//
//     stat = floor((2·base + IV + floor(EV/4)) · level / 100) + 5
//     stat = floor(stat · nature)        (×1.1 / ×0.9 / ×1)
//     stat = floor(stat · item)          (Choice Scarf ×1.5, Iron Ball ×0.5,
//                                         Quick Powder ×2 — Ditto only)
//
// Level/IVs default to 50 / 31; variants can override the level via the
// `speedLevel` flag and the IV default via `speedIVs`. Individual sets may
// also carry their own `IVs` integer (SwSh Battle Tower / Restricted Sparring
// give different IV tiers per set, e.g. 16/19/23/27/31), which takes
// precedence over the variant default — see speedDisplay below.
//
// Mega Evolution: when a set's species holds its matching Mega Stone, the
// display shows "pre → post" (e.g. "139 → 216") using the Mega forme's base
// speed from the same pokédex file. Stones never carry a speed modifier, so
// the item factor is 1 on both sides.

import { state } from './state.js';

// Pure core — also usable by tools/tests.
export function computeSpeed({ base, ev = 0, natureMod = 1, itemMod = 1,
                               level = 50, iv = 31 }) {
    let stat = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5;
    stat = Math.floor(stat * natureMod);
    return Math.floor(stat * itemMod);
}

function speEv(evs) {
    const m = /(\d+)\s*Spe\b/.exec(evs ?? '');
    return m ? Number(m[1]) : 0;
}

// `stats-en` is "(+Spe -Atk)" etc.; neutral natures are self-canceling
// ("(+Spe -Spe)"), so require the sign to appear without its opposite.
function natureSpeedMod(natureLocalized) {
    const row = state.data.natures.find(
        n => n[`nature-${state.language}`] === natureLocalized);
    const s = row?.['stats-en'] ?? '';
    const plus = s.includes('+Spe'), minus = s.includes('-Spe');
    return plus && !minus ? 1.1 : minus && !plus ? 0.9 : 1;
}

function itemSpeedMod(enItem, enSpecies) {
    if (enItem === 'Choice Scarf') return 1.5;
    if (enItem === 'Iron Ball') return 0.5;
    if (enItem === 'Quick Powder' && enSpecies === 'Ditto') return 2;
    return 1;
}

// "Charizardite X" + species "Charizard" → the "Charizard-Mega-X" dex entry.
// Stone names are species prefixes + "ite" (+" X"/" Y"), but often truncated
// (Sablenite, Glalitite, Heracronite, Blastoisinite...), so accept if the
// species starts with the stem minus up to 3 chars — but at least 5, which
// keeps Eviolite out and Latiasite/Latiosite apart.
export function megaEntry(enSpecies, enItem) {
    const m = /^(.+?)ite( [XY])?$/.exec(enItem ?? '');
    if (!m) return null;
    const stem = m[1];
    let matched = false;
    for (let k = stem.length; k >= Math.max(5, stem.length - 3); k--) {
        if (enSpecies.startsWith(stem.slice(0, k))) { matched = true; break; }
    }
    if (!matched) return null;
    const target = `${enSpecies}-Mega${m[2] ? '-' + m[2].trim() : ''}`;
    return state.data.pokedex.find(p => p.en === target) ?? null;
}

// `ivOverride` is the IV of the trainer fielding this set (gen-4 Frontier,
// where IVs are per-trainer; the caller derives it from the set's slot/side so
// multis can show two different IVs at once). null = none (browse mode).
// Battle Hall: the level of the Pokémon the player faces depends on the player's
// own level and how many types they've taken to rank 2+. Returns null when the
// inputs aren't set or no rank is selected (Argenta / browse). Pokémon floors.
//   base = Lp − 3·√Lp ; increment = √Lp / 5
//   L = min(Lp, ⌊ base + types/2 + (rank−1)·increment ⌋)
// where `types` excludes the currently selected type if it's already rank 2+.
export function hallFacedLevel() {
    const Lp = state.hallLevel;
    if (!state.variant?.hall || !Lp || !state.hallRank) return null;
    const rank = state.hallRank;
    // Everything is computed with real arithmetic and ONLY the final result is
    // floored (the game rounds down once, at the end). `types` is the player's
    // rank-2+ count as entered — the currently selected type is NOT subtracted.
    const base = Lp - 3 * Math.sqrt(Lp);
    const increment = Math.sqrt(Lp) / 5;
    const types = state.hallRank2 || 0;
    return Math.min(Lp, Math.floor(base + types / 2 + (rank - 1) * increment));
}

// The level used for the speed calc. Hall: the computed faced level, or null when
// it can't be determined yet (no rank selected) → speed is then not shown at all.
function speedLevel() {
    if (state.variant?.hall) return hallFacedLevel();
    if (state.variant?.factory && state.factoryOpen) return 100;   // Open Level
    return state.variant?.speedLevel ?? 50;
}

// Shared inputs for a set's speed: the dex entry, the level/EV/IV params, and the
// resolved item modifier. (Arcade `noItems` opponents hold no item — no item
// modifier and no Mega Evolution, even though the shared set lists an item.)
function speedCore(set, ivOverride) {
    const dex = state.data.pokedex.find(p => p[state.language] === set.species);
    if (!dex || dex.spe == null) return null;
    const level = speedLevel();
    if (level == null) return null;   // Hall with no determined faced level → no speed
    const noItems = Boolean(state.variant?.noItems);
    const enItem = (!noItems && set.item)
        ? (state.data.items.find(i => i[state.language] === set.item)?.en ?? set.item)
        : null;
    const params = {
        ev: speEv(set.EVs),
        level,
        // IV precedence: per-set IVs (SwSh) > the fielding trainer's IV
        // (gen-4 Frontier) > the variant default > 31.
        iv: set.IVs ?? ivOverride ?? state.variant?.speedIVs ?? 31,
    };
    return { dex, params, enItem, itemMod: itemSpeedMod(enItem, dex.en) };
}

export function speedDisplay(set, ivOverride = null) {
    const c = speedCore(set, ivOverride);
    if (!c) return '';
    const params = { ...c.params, natureMod: natureSpeedMod(set.nature) };
    const pre = computeSpeed({ ...params, base: c.dex.spe, itemMod: c.itemMod });
    const mega = c.enItem && megaEntry(c.dex.en, c.enItem);
    return mega && mega.spe != null
        ? `${pre} → ${computeSpeed({ ...params, base: mega.spe })}`
        : String(pre);
}

// DP Tower randomizes natures, so we can't assume one — return the speed for a
// minus-speed (×0.9), neutral, and plus-speed (×1.1) nature. (No Mega in gen-4.)
export function speedTriple(set, ivOverride = null) {
    const c = speedCore(set, ivOverride);
    if (!c) return null;
    const at = natureMod =>
        computeSpeed({ ...c.params, base: c.dex.spe, natureMod, itemMod: c.itemMod });
    return { minus: at(0.9), neutral: at(1), plus: at(1.1) };
}
