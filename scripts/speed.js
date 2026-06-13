// Displayed speed is COMPUTED from pokédex base stats — sets files carry no
// static speed values. The formula reproduces the game exactly (and the
// static values the site used to ship):
//
//     stat = floor((2·base + IV + floor(EV/4)) · level / 100) + 5
//     stat = floor(stat · nature)        (×1.1 / ×0.9 / ×1)
//     stat = floor(stat · item)          (Choice Scarf ×1.5, Iron Ball ×0.5,
//                                         Quick Powder ×2 — Ditto only)
//
// All current facilities use level 50 / 31 IVs; variants can override via
// `speedLevel` / `speedIVs` feature flags (future: gen-4 L50/L100 toggle,
// Emerald open-level slider — needs per-set IVs, see roadmap).
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

export function speedDisplay(set) {
    const dex = state.data.pokedex.find(p => p[state.language] === set.species);
    if (!dex || dex.spe == null) return '';
    const params = {
        ev: speEv(set.EVs),
        natureMod: natureSpeedMod(set.nature),
        level: state.variant?.speedLevel ?? 50,
        iv: state.variant?.speedIVs ?? 31,
    };
    const enItem = set.item
        ? (state.data.items.find(i => i[state.language] === set.item)?.en ?? set.item)
        : null;
    const pre = computeSpeed({ ...params, base: dex.spe,
                               itemMod: itemSpeedMod(enItem, dex.en) });
    const mega = enItem && megaEntry(dex.en, enItem);
    return mega && mega.spe != null
        ? `${pre} → ${computeSpeed({ ...params, base: mega.spe })}`
        : String(pre);
}
