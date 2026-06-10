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

// Loads the sets file for a variant in a given language (used by the
// Showdown export, which always needs the English sets).
export async function loadSets(variant, language) {
    const data = await fetchJSON(`data/${variant.dataPrefix}-sets-${language}.json`);
    return data.sets;
}

// Loads everything needed for one variant + language combination, in parallel.
export async function loadVariantData(variant, language) {
    const [trainers, sets, pokedex, natures, items, moves] = await Promise.all([
        fetchJSON(`data/${variant.dataPrefix}-trainers-${language}.json`),
        fetchJSON(`data/${variant.dataPrefix}-sets-${language}.json`),
        fetchJSON(variant.pokedex),
        fetchJSON('data/natures.json'),
        fetchJSON('data/items.json'),
        fetchJSON('data/moves.json'),
    ]);
    return {
        trainers: trainers.trainers,
        sets: sets.sets,
        pokedex: pokedex.pokedex,
        natures: natures.natures,
        items: items.items,
        moves: moves.moves,
    };
}
