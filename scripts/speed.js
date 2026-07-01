// Displayed speed is COMPUTED from pokédex base stats (sets carry no static speed).
// Reproduces the game exactly:
//     stat = floor((2·base + IV + floor(EV/4)) · level / 100) + 5
//     stat = floor(stat · nature)   (×1.1 / ×0.9 / ×1)
//     stat = floor(stat · item)     (Choice Scarf ×1.5, Iron Ball ×0.5, Quick Powder ×2 Ditto)
// Level/IVs default to 50 / 31; variants override via `speedLevel` / `speedIVs`, and a set's
// own `IVs` (SwSh per-set tiers) takes precedence. Mega: when the set holds its Mega Stone the
// display shows "pre → post" from the Mega forme's base speed (stones carry no item factor).

import { state } from './state.js';

// Pure core; also usable by tools/tests.
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

// "Charizardite X" + species "Charizard" -> the "Charizard-Mega-X" dex entry. Stone names
// are species prefix + "ite" (+" X"/" Y") but often truncated (Sablenite, Glalitite, ...),
// so accept a stem trimmed by up to 3 chars but at least 5 (keeps Eviolite out, Latias/Latios apart).
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

// Battle Hall: the faced Pokémon's level depends on the player's level and how many types
// they've taken to rank 2+. Returns null when inputs aren't set / no rank (Argenta, browse).
//   base = Lp − 3·√Lp ; increment = √Lp / 5
//   L = min(Lp, floor( base + types/2 + (rank−1)·increment ))
export function hallFacedLevel() {
    const Lp = state.hallLevel;
    if (!state.variant?.hall || !Lp) return null;
    // Argenta (battles 50 & 170) fields Pokémon at the player's own level.
    if (state.hallType === 'argenta50' || state.hallType === 'argenta170') return Lp;
    if (!state.hallRank) return null;
    const rank = state.hallRank;
    // Only the final result is floored. `types` is the rank-2+ count as entered (the
    // currently selected type is not subtracted).
    const base = Lp - 3 * Math.sqrt(Lp);
    const increment = Math.sqrt(Lp) / 5;
    const types = state.hallRank2 || 0;
    return Math.min(Lp, Math.floor(base + types / 2 + (rank - 1) * increment));
}

// Wild Pokémon level bounds [lo, hi].
//  Pike (`levelOffset`): single player-relative level (50 − offset at Lv 50, or
//    max(60, chosen − offset) in Open). Returns [lvl, lvl].
//  Pyramid (`levelValue50`/`levelValueOpen`): a 10-wide band.
function wildLevelBounds(set) {
    if (set.levelValue50 != null) {
        const base = state.openMode
            ? Math.max(state.openLevelValue ?? 100, 60) - set.levelValueOpen - 5
            : set.levelValue50 - 5;
        return [base, base + 10];
    }
    const off = set.levelOffset || 0;
    const lvl = state.openMode ? Math.max(60, (state.openLevelValue ?? 100) - off) : 50 - off;
    return [lvl, lvl];
}

// Display string for a wild Pokémon's level: "46" (Pike, single) or "30 – 40" (band).
export function wildLevelText(set) {
    const [lo, hi] = wildLevelBounds(set);
    return lo === hi ? String(lo) : `${lo} – ${hi}`;
}

// Wild IV bounds. Pyramid: 0–31, or 15–31 from floor 140 (`state.pyramid140`).
// Pike: always 0–31.
function wildIvBounds(set) {
    return (set.levelValue50 != null && state.pyramid140) ? [15, 31] : [0, 31];
}

// Wild Pokémon have RANDOM IVs, a random nature, AND (Pyramid) a 10-level band → show
// the full possible speed RANGE: low = lowest level + min IV + −Speed nature; high =
// highest level + 31 IV + +Speed nature (no EVs, no item). Returns { lo, hi } or null.
export function speedRange(set) {
    const dex = state.data.pokedex.find(p => p[state.language] === set.species);
    if (!dex || dex.spe == null) return null;
    const [loLvl, hiLvl] = wildLevelBounds(set);
    const [loIv, hiIv] = wildIvBounds(set);
    return {
        lo: computeSpeed({ base: dex.spe, ev: 0, natureMod: 0.9, itemMod: 1, level: loLvl, iv: loIv }),
        hi: computeSpeed({ base: dex.spe, ev: 0, natureMod: 1.1, itemMod: 1, level: hiLvl, iv: hiIv }),
    };
}

// The level used for the speed calc. Hall: the computed faced level, or null when
// it can't be determined yet (no rank selected) → speed is then not shown at all.
function speedLevel() {
    if (state.variant?.hall) return hallFacedLevel();
    // gen-4 Factory and gen-3 Factory both use a flat Lv50 / Open(=100) toggle.
    if ((state.variant?.factory || state.variant?.factory3) && state.factoryOpen) return 100;
    // RS Battle Tower: a flat Level 50 / Level 100 toggle (reuses factoryOpen).
    if (state.variant?.rsTower) return state.factoryOpen ? 100 : 50;
    // Gen-3 Tower Open Level: opponents match the player's strongest Pokémon
    // (60-100, chosen by the user). Lv 50 mode uses 50.
    if (state.variant?.openLevel) return state.openMode ? (state.openLevelValue ?? 100) : 50;
    return state.variant?.speedLevel ?? 50;
}

// Shared inputs for a set's speed: dex entry, level/EV/IV params, resolved item modifier.
// (Arcade `noItems` opponents hold no item, so no item modifier and no Mega.)
function speedCore(set, ivOverride) {
    const dex = state.data.pokedex.find(p => p[state.language] === set.species);
    if (!dex || dex.spe == null) return null;
    // Gen 2: DVs (0-15) + Stat Exp + the set's own level. The modern stat formula
    // with iv = 2·(Speed DV) and ev = floor(√statexp) (what the EVs field already
    // holds) is algebraically identical to the gen-2 formula, so we reuse
    // computeSpeed. No natures, abilities, or held-item speed modifiers in gen 2.
    if (state.variant?.gen === 2) {
        const dv = set.DVs ? set.DVs.spe : 15;
        return {
            dex,
            params: { ev: speEv(set.EVs), level: set.level ?? 50, iv: 2 * dv },
            enItem: null, itemMod: 1,
        };
    }
    const level = set.wild ? wildLevelBounds(set)[0] : speedLevel();
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

// DP Tower randomizes natures, so return the speed for minus (×0.9) / neutral / plus (×1.1).
export function speedTriple(set, ivOverride = null) {
    const c = speedCore(set, ivOverride);
    if (!c) return null;
    const at = natureMod =>
        computeSpeed({ ...c.params, base: c.dex.spe, natureMod, itemMod: c.itemMod });
    return { minus: at(0.9), neutral: at(1), plus: at(1.1) };
}

// All candidate speed VALUES for a set (numbers), mirroring what speedDisplay /
// speedTriple / speedRange show: random-nature → [−, neutral, +]; wild → [lo, hi];
// Mega → [pre, post]; otherwise a single [value]. null when no speed is determinable
// (e.g. Hall before a faced level is set). Used by the speed warning to test a match.
export function speedValues(set, ivOverride = null) {
    if (state.variant?.randomNature) {
        const t = speedTriple(set, ivOverride);
        return t ? [t.minus, t.neutral, t.plus] : null;
    }
    if (set.wild) {
        const r = speedRange(set);
        return r ? [r.lo, r.hi] : null;
    }
    const c = speedCore(set, ivOverride);
    if (!c) return null;
    const params = { ...c.params, natureMod: natureSpeedMod(set.nature) };
    const pre = computeSpeed({ ...params, base: c.dex.spe, itemMod: c.itemMod });
    const mega = c.enItem && megaEntry(c.dex.en, c.enItem);
    return (mega && mega.spe != null)
        ? [pre, computeSpeed({ ...params, base: mega.spe })]
        : [pre];
}
