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
    hallType: null,    // Battle Hall: selected type code / 'argenta50' / 'argenta170'
    hallRank: null,    // Battle Hall: selected rank 1-10 (drives BST filter + IV)
    factoryOpen: false,  // Battle Factory: false = Lv50, true = Open Level (lv100)
    factoryLate: null,   // Battle Factory trainer filter: null / 21 / 49 (battle threshold)
    factoryStreak: 0,    // Gen-3 Factory: current Battle Tower streak → opponent IVs (glitch)
    pyramidRound: null,  // Gen-3 Pyramid wild filter: selected round 1-20 (null = all)
    pyramidFloor: null,  // Gen-3 Pyramid wild filter: selected floor 1-7 (null = all)
    pyramid140: false,   // Gen-3 Pyramid wild: floor 140+ → IVs 15-31 (else 0-31)
    hallLevel: null,     // Battle Hall: the player's Pokémon level (30-100) for the level calc
    hallRank2: null,     // Battle Hall: # of types the player has cleared rank 1 (rank 2+)
    openMode: false,     // Gen-3 Tower: false = Lv 50, true = Open Level
    openLevelValue: 100, // Gen-3 Tower Open Level: opponents match the player's
                         // strongest Pokémon (60-100) — the level used for speed
};
