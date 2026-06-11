// Game / variant / mode / theme configuration — the single place to edit when
// adding content.
//
// Structure: GAMES are menu groupings; each game has one or more VARIANTS
// (sub-facilities or game versions). All feature flags live on the variant:
//
//   code             unique id (used in localStorage)
//   name             display name
//   dataDir          data files live in data/<dataDir>/trainers-<lang>.json
//                    and data/<dataDir>/sets-<lang>.json
//   base             optional: dataDir of another variant whose files serve as
//                    the base; this variant's files are then DELTAS merged on
//                    top ({ "remove": [...], "trainers"/"sets": [full records
//                    that replace same-key entries or add new ones] })
//   pokedex          pokedex file for this variant
//   gen              generation number (move types are gen-aware)
//   languages        available language codes (data files must exist for each)
//   modes            battle modes from MODES below (first = default)
//   hasTrainers      false → single implicit trainer, trainer/quote dropdowns hidden
//   showMinisprites  false → hide the clickable minisprite list
//   lateCutoff       battle number after which "late" trainers appear; presence
//                    enables the late-trainers-only toggle (shown as "<N>+"),
//                    which filters on the `late` field of trainers ('1' = late)
//   speedLevel       optional: level used for the computed speed display
//                    (default 50) — displayed speed is computed at runtime by
//                    scripts/speed.js from the pokédex base stats; sets files
//                    carry no static speed values
//   speedIVs         optional: IVs for the computed speed (default 31)
//
// Games AND variants may declare `icons`, a list of images
// (assets/images/games/...) shown in their select — one per flagship version.
// Future per-variant flags (see roadmap.md): dynamax, levels, openLevel,
// fixedTeams, ...

export const GAMES = [
    {
        code: 'tree',
        name: 'Battle Tree',
        icons: ['assets/images/games/us.png', 'assets/images/games/um.png'],
        variants: [
            {
                code: 'tree-usum',
                name: 'Ultra Sun / Ultra Moon',
                icons: ['assets/images/games/us.png', 'assets/images/games/um.png'],
                dataDir: 'tree',
                pokedex: 'data/pokedex-7.json',
                gen: 7,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 40,
            },
            {
                code: 'tree-sm',
                name: 'Sun / Moon',
                icons: ['assets/images/games/s.png', 'assets/images/games/m.png'],
                dataDir: 'tree-sm',
                base: 'tree',   // delta files on top of the USUM data
                pokedex: 'data/pokedex-7.json',
                gen: 7,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 40,
            },
        ],
    },
    {
        code: 'maison',
        name: 'Battle Maison',
        icons: ['assets/images/games/or.png', 'assets/images/games/as.png'],
        variants: [
            {
                code: 'maison-oras',
                name: 'Omega Ruby / Alpha Sapphire',
                icons: ['assets/images/games/or.png', 'assets/images/games/as.png'],
                dataDir: 'maison',
                pokedex: 'data/pokedex-6.json',
                gen: 6,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko'],
                modes: ['singles', 'doubles', 'triples', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 40,
            },
            {
                code: 'maison-xy',
                name: 'X / Y',
                icons: ['assets/images/games/x.png', 'assets/images/games/y.png'],
                dataDir: 'maison-xy',
                base: 'maison',   // delta files on top of the ORAS data
                pokedex: 'data/pokedex-6.json',
                gen: 6,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko'],
                modes: ['singles', 'doubles', 'triples', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 40,
            },
        ],
    },
    {
        code: 'subway',
        name: 'Battle Subway',
        icons: ['assets/images/games/b.png', 'assets/images/games/w.png'],
        variants: [
            {
                code: 'subway',
                name: 'Black / White',
                dataDir: 'subway',
                pokedex: 'data/pokedex-5.json',
                gen: 5,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko'],
                modes: ['singles', 'doubles', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 28,
            },
        ],
    },
];

// Battle modes. `sides` = how many opposing trainers are shown at once
// (multis = two independent trainers); `slots` = Pokémon shown per side.
// Total slot containers = sides * slots; slots are numbered left to right,
// so in multis slot 1 belongs to trainer 1 and slot 2 to trainer 2.
export const MODES = {
    singles: { icon: '⚀', sides: 1, slots: 1 },
    doubles: { icon: '⚁', sides: 1, slots: 2 },
    triples: { icon: '⚂', sides: 1, slots: 3 },  // also covers rotation battles
    multis:  { icon: '⚃', sides: 2, slots: 1 },
};

export const MAX_SLOTS = 3;
export const MAX_SIDES = 2;

// Total visible slots for a mode.
export function modeSlots(mode) {
    return MODES[mode].sides * MODES[mode].slots;
}

// Which side (trainer) a slot belongs to in a given mode.
export function slotSide(mode, slot) {
    return MODES[mode].sides === 1 ? 1 : Math.ceil(slot / MODES[mode].slots);
}

// Themes override the CSS variables defined in styles.css via
// <html data-theme="...">. 'dark' is the default (:root).
export const THEMES = [
    { code: 'dark', name: 'Dark' },
    { code: 'light', name: 'Light' },
    { code: 'midnight', name: 'Midnight' },
    { code: 'forest', name: 'Forest' },
    { code: 'ocean', name: 'Ocean' },
    { code: 'lavender', name: 'Lavender' },
    { code: 'fairy', name: 'Fairy' },
    { code: 'sunset', name: 'Sunset' },
    { code: 'umbreon', name: 'Umbreon' },
    { code: 'slate', name: 'Slate' },
];

// Appended to every data fetch (?v=...) so browsers pick up new data after a
// deploy instead of serving stale cached JSON. Bump when data files change.
export const DATA_VERSION = '2026-06-12c';

export const LANGUAGE_NAMES = {
    en: 'English',
    fr: 'Français',
    jp: '日本語',
    it: 'Italiano',
    de: 'Deutsch',
    es: 'Español',
    ko: '한국어',
    chs: '简体中文',
    cht: '繁體中文',
};

export function getGame(code) {
    return GAMES.find(game => game.code === code) || GAMES[0];
}

export function getVariant(game, code) {
    return game.variants.find(variant => variant.code === code) || game.variants[0];
}

// Highest slot count among a variant's modes (how many menus to populate).
export function variantMaxSlots(variant) {
    return Math.max(...variant.modes.map(mode => MODES[mode].slots));
}
