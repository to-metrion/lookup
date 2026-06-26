// JSON loading with caching — each file is fetched at most once per page load.

import { DATA_VERSION } from './config.js';

const cache = new Map();

function fetchJSON(url) {
    if (!cache.has(url)) {
        cache.set(url, fetch(`${url}?v=${DATA_VERSION}`).then(response => {
            if (!response.ok) {
                cache.delete(url); // allow retry on next call
                throw new Error(`Failed to load ${url} (${response.status})`);
            }
            return response.json();
        }));
    }
    return cache.get(url);
}

export function loadTranslations() {
    return fetchJSON('data/translations.json');
}

// Delta merge for variants that declare a `base` (e.g. SM on top of USUM):
// removals are filtered out, records with an existing key replace the base
// entry in place, new keys are appended (deterministic order — the parallel-
// language invariant depends on it).
function mergeDelta(baseList, delta, keyOf, removeKeyOf = k => k) {
    const removed = new Set((delta.remove ?? []).map(r => String(removeKeyOf(r))));
    const replacements = new Map((delta.records ?? []).map(r => [String(keyOf(r)), r]));
    const merged = baseList
        .filter(item => !removed.has(String(keyOf(item))))
        .map(item => {
            const r = replacements.get(String(keyOf(item)));
            if (r) replacements.delete(String(keyOf(item)));
            return r ?? item;
        });
    return merged.concat([...replacements.values()]); // additions, delta order
}

async function loadTrainersAndSets(variant, language) {
    if (!variant.base) {
        const [trainers, sets] = await Promise.all([
            fetchJSON(`data/${variant.dataDir}/trainers-${language}.json`),
            fetchJSON(`data/${variant.dataDir}/sets-${language}.json`),
        ]);
        return { trainers: trainers.trainers, sets: sets.sets };
    }
    const [baseTrainers, baseSets, dTrainers, dSets] = await Promise.all([
        fetchJSON(`data/${variant.base}/trainers-${language}.json`),
        fetchJSON(`data/${variant.base}/sets-${language}.json`),
        fetchJSON(`data/${variant.dataDir}/trainers-${language}.json`),
        fetchJSON(`data/${variant.dataDir}/sets-${language}.json`),
    ]);
    const setKey = s => `${s.species}|${s.setNumber}`;
    return {
        trainers: mergeTrainers(baseTrainers.trainers, dTrainers),
        sets: mergeDelta(baseSets.sets,
            { remove: dSets.remove, records: dSets.sets },
            setKey, r => Array.isArray(r) ? `${r[0]}|${r[1]}` : r),
    };
}

// Trainer deltas: removals match by name; replacements match by name+sprite
// (localized names can collide between two different trainers, e.g. Italian
// "Ella" — a delta record only replaces a same-name same-class trainer,
// otherwise it's an addition).
function mergeTrainers(base, delta) {
    const removed = new Set(delta.remove ?? []);
    const key = t => `${t.name}|${t.sprite ?? ''}`;
    const replacements = new Map((delta.trainers ?? []).map(t => [key(t), t]));
    const merged = base
        .filter(t => !removed.has(t.name))
        .map(t => {
            const r = replacements.get(key(t));
            if (r) replacements.delete(key(t));
            return r ?? t;
        });
    return merged.concat([...replacements.values()]);
}

// Loads the sets file for a variant in a given language (used by the
// Showdown export, which always needs the English sets).
export async function loadSets(variant, language) {
    return (await loadTrainersAndSets(variant, language)).sets;
}

// Loads everything needed for one variant + language combination, in parallel.
// The English sets are always included (`enSets`): move-type icons and the
// Showdown export resolve through the English counterpart set, and having
// them up front keeps rendering synchronous.
export async function loadVariantData(variant, language) {
    const [trainersAndSets, enSets, pokedex, natures, items, moves, rounds] = await Promise.all([
        loadTrainersAndSets(variant, language),
        language === 'en' ? null : loadTrainersAndSets(variant, 'en'),
        fetchJSON(variant.pokedex),
        fetchJSON('data/natures.json'),
        fetchJSON('data/items.json'),
        fetchJSON('data/moves.json'),
        // Gen-3 Pyramid wild filter: the 20 round quotes (Hex Maniac hints).
        variant.pyramidWild ? fetchJSON(`data/${variant.dataDir}/rounds-${language}.json`) : null,
    ]);
    return {
        ...trainersAndSets,
        enSets: (enSets ?? trainersAndSets).sets,
        pokedex: pokedex.pokedex,
        natures: natures.natures,
        items: items.items,
        moves: moves.moves,
        rounds: rounds?.rounds ?? null,
    };
}
