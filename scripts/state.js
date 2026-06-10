// Shared application state — the single source of truth.

export const state = {
    game: null,        // game object from config.js
    variant: null,     // variant object from config.js (carries all feature flags)
    language: 'en',
    mode: 'singles',   // key into MODES (config.js)
    theme: 'dark',
    lateOnly: false,   // "late trainers only" filter
    spritesOn: true,   // minisprite lists toggle (settings)
    translations: {},
    data: null,        // { trainers, sets, pokedex, natures, items }
    trainers: { 1: null, 2: null },  // selected trainer per side (multis uses 2)
    activeSets: {},    // selected set per slot number
};
