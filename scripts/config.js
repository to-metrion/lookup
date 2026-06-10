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
//   pokedex          pokedex file for this variant
//   gen              generation number (move types are gen-aware)
//   languages        available language codes (data files must exist for each)
//   modes            battle modes from MODES below (first = default)
//   hasTrainers      false → single implicit trainer, trainer/quote dropdowns hidden
//   showMinisprites  false → hide the clickable minisprite list
//   lateCutoff       battle number after which "late" trainers appear; presence
//                    enables the late-trainers-only toggle (shown as "<N>+"),
//                    which filters on the `late` field of trainers ('1' = late)
//
// Games may also declare `icons`, a list of images (assets/images/games/...)
// shown in the game select — typically one per flagship version.
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
                dataDir: 'tree',
                pokedex: 'data/pokedex-7.json',
                gen: 7,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 40,
            },
            // { code: 'tree-sm', name: 'Sun / Moon', ... }  (planned)
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
                modes: ['singles', 'doubles'],
                hasTrainers: true,
                showMinisprites: true,
                lateCutoff: 28,
            },
        ],
    },
    // EisenBerry Academy ('eba') is hidden for now; its data files remain in /data.
];

// Battle modes. `slots` = how many Pokémon are shown side by side.
export const MODES = {
    singles:  { icon: '⚀', slots: 1 },
    doubles:  { icon: '⚁', slots: 2 },
    triples:  { icon: '⚂', slots: 3 },
    rotation: { icon: '⟳', slots: 3 },
};

export const MAX_SLOTS = 3;

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
export const DATA_VERSION = '2026-06-10c';

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
