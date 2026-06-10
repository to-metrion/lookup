// Shared application state — the single source of truth.

export const state = {
    game: null,        // game object from config.js
    variant: null,     // variant object from config.js (carries all feature flags)
    language: 'en',
    mode: 'singles',   // key into MODES (config.js)
    theme: 'dark',
    lateOnly: false,   // "late trainers only" filter
    translations: {},
    data: null,        // { trainers, sets, pokedex, natures, items }
    trainer: null,     // currently selected trainer object
    activeSets: {},    // selected set per slot number
};
