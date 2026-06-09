// JSON loading with caching — each file is fetched at most once per page load.

const cache = new Map();

function fetchJSON(url) {
    if (!cache.has(url)) {
        cache.set(url, fetch(url).then(response => {
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

// Loads everything needed for one facility + language combination, in parallel.
export async function loadFacilityData(facility, language) {
    const [trainers, sets, pokedex, natures, items] = await Promise.all([
        fetchJSON(`data/${facility.code}-trainers-${language}.json`),
        fetchJSON(`data/${facility.code}-sets-${language}.json`),
        fetchJSON(facility.pokedex),
        fetchJSON('data/natures.json'),
        fetchJSON('data/items.json'),
    ]);
    return {
        trainers: trainers.trainers,
        sets: sets.sets,
        pokedex: pokedex.pokedex,
        natures: natures.natures,
        items: items.items,
    };
}
