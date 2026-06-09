// Shared application state — the single source of truth.

export const state = {
    facility: null,                    // facility object from config.js
    language: 'en',
    mode: 'singles',                   // 'singles' | 'doubles'
    translations: {},
    data: null,                        // { trainers, sets, pokedex, natures, items }
    trainer: null,                     // currently selected trainer object
    activeSets: { 1: null, 2: null },  // selected set per slot
};
