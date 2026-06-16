// Game / variant / mode / theme configuration — the single place to edit when
// adding content.
//
// Structure: GAMES are menu groupings; each game has one or more VARIANTS
// (sub-facilities or game versions). All feature flags live on the variant:
//
//   code             unique id (used in localStorage)
//   name             display name
//   short            (variants) short label for the facility pill row in
//                    settings (e.g. 'USUM', 'SM'); falls back to `name`
//   nameKey          (variants) optional translations.json key for the pill
//                    label, used instead of `short` when the facility name is
//                    localized (SwSh Battle Tower / Restricted Sparring); the
//                    universal short codes (USUM/SM/...) carry no nameKey
//   default          (variants) true → selected when the game is picked.
//                    Variants are LISTED chronologically (SM before USUM,
//                    XY before ORAS); the default is independent of order.
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
//   hasQuotes        false → hide the quote dropdown(s) (facility has no quote
//                    data); defaults to true
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
        // SwSh groups two facilities: Battle Tower (standard) and Restricted
        // Sparring (one opponent, the Master Dojo Student). Sets carry gen-8
        // quirks read by the renderer: per-set `IVs`, `dmax` (the dmax.png
        // badge), `sprite`/`setLabel`. Listed first for chronology, but `tree`
        // keeps `default: true` so the tool still opens on Battle Tree.
        code: 'swsh',
        name: 'Sword / Shield',
        icons: ['assets/images/games/sw.png', 'assets/images/games/sh.png'],
        variants: [
            {
                code: 'swsh-tower',
                name: 'Battle Tower',
                short: 'Tower',
                nameKey: 'variant-tower',  // localized pill label (translations.json)
                default: true,
                icons: ['assets/images/games/sw.png', 'assets/images/games/sh.png'],
                dataDir: 'swsh-tower',
                pokedex: 'data/pokedex-8.json',
                gen: 8,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles'],
                hasTrainers: true,
                showMinisprites: true,
            },
            {
                code: 'swsh-rs',
                name: 'Restricted Sparring',
                short: 'RS',
                nameKey: 'variant-rs',
                icons: ['assets/images/games/ia.png'],  // Isle-of-Armor logo for RS
                dataDir: 'swsh-rs',
                pokedex: 'data/pokedex-8.json',
                gen: 8,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles'],
                // One opponent (Master Dojo Student) fielding the whole RS pool;
                // no quotes. Minisprites left ON for now to gauge whether 150
                // species in the list is visually too much.
                hasTrainers: true,
                hasQuotes: false,
                showMinisprites: true,
            },
        ],
    },
    {
        code: 'tree',
        name: 'Battle Tree',
        default: true,   // tool opens on Battle Tree even though SwSh lists first
        icons: ['assets/images/games/us.png', 'assets/images/games/um.png'],
        variants: [
            {
                code: 'tree-sm',
                name: 'Sun / Moon',
                short: 'SM',
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
            {
                code: 'tree-usum',
                name: 'Ultra Sun / Ultra Moon',
                short: 'USUM',
                default: true,
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
        ],
    },
    {
        code: 'maison',
        name: 'Battle Maison',
        icons: ['assets/images/games/or.png', 'assets/images/games/as.png'],
        variants: [
            {
                code: 'maison-xy',
                name: 'X / Y',
                short: 'XY',
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
            {
                code: 'maison-oras',
                name: 'Omega Ruby / Alpha Sapphire',
                short: 'ORAS',
                default: true,
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
    {
        // Gen-4 Battle Frontier. Unlike the other games this has TWO sub-axes:
        // a VERSION (HGSS / Platinum / DP) shown in the variant-pill row, and a
        // FACILITY (Battle Tower / Arcade / Castle / Hall / Factory) shown in a
        // second pill row below it (see app.js populateFacilityPills). A variant
        // is the (version × facility) combination — it carries `version` and
        // `facility` keys. HGSS and Platinum share IDENTICAL sets & trainers, so
        // their variants point at the same data; only the frontier brain differs
        // between facilities (Arcade/Castle are deltas on the Tower data).
        //
        // IVs are PER-TRAINER in gen 4 (`trainerIVs: true`): speed.js reads the
        // selected trainer's `iv`; browse mode falls back to speedIVs.
        //
        // Currently built: HGSS + Platinum × {Tower, Arcade, Castle}, English.
        // DEFERRED: DP (needs a delta), Hall + Factory (special mechanics), the
        // 8 other languages, and Factory's 50/Open level toggle.
        // NB: Gen-3 will ALSO be named "Battle Frontier" — that's fine, the game
        // select keys on `code` (unique), not the display name; the two are told
        // apart by their game logos.
        code: 'frontier4',
        name: 'Battle Frontier',
        icons: ['assets/images/games/hg.png', 'assets/images/games/ss.png'],
        versions: [
            { code: 'hgss', short: 'HGSS', default: true,
              icons: ['assets/images/games/hg.png', 'assets/images/games/ss.png'] },
            { code: 'pt', short: 'Platinum',
              icons: ['assets/images/games/pt.png'] },
            // Diamond/Pearl: Tower only, own dataset, random natures (see
            // frontier4Variants). Diamond + Pearl logos (self-remove if absent).
            { code: 'dp', short: 'DP',
              icons: ['assets/images/games/d.png', 'assets/images/games/p.png'] },
        ],
        variants: frontier4Variants(),
    },
];

// Builds the 6 gen-4 variants (2 versions × 3 facilities) — HGSS and Platinum
// share data files (sets+regular trainers identical), so both versions of a
// facility point at the same dataDir/base. Factory adds a 50/Open level axis
// when it's built (not yet).
function frontier4Variants() {
    const VERSIONS = [
        { code: 'hgss', short: 'HGSS' },
        { code: 'pt', short: 'Platinum' },
        // Diamond/Pearl: ONLY the Battle Tower (its own dataset — names/sets/rosters
        // mostly differ from HGSS). Natures are randomized in DP, so they're not
        // listed (`randomNature` → 3-way speed display). See frontier4-dp.
        { code: 'dp', short: 'DP' },
    ];
    // facility key -> { label (pill), nameKey (translations.json), dataDir, base }
    // `noItems`: Arcade opponents hold NO items (same sets as Tower otherwise) —
    // items are hidden AND excluded from the speed calc there. (Castle DOES use
    // items, so it has no flag.)
    const FACILITIES = [
        { key: 'tower',  label: 'Tower',  nameKey: 'facility-tower',  dataDir: 'frontier4-tower' },
        { key: 'arcade', label: 'Arcade', nameKey: 'facility-arcade', dataDir: 'frontier4-arcade', base: 'frontier4-tower', noItems: true },
        { key: 'castle', label: 'Castle', nameKey: 'facility-castle', dataDir: 'frontier4-castle', base: 'frontier4-tower' },
        // Hall: no trainers — the player faces a random Pokémon from a pool keyed
        // by TYPE + RANK (see `hall` flag → type/rank selector UI in app.js).
        // Singles only; its own sets file; no 43+ late filter.
        { key: 'hall',   label: 'Hall',   nameKey: 'facility-hall',   dataDir: 'frontier4-hall', hall: true },
        // Factory: same sets + regular trainers as Tower, but each trainer's
        // roster is GENERATED at runtime from their group + the Lv50/Open level
        // (see app.js). Brain → Thorton. Open Level battles are level 100.
        { key: 'factory', label: 'Factory', nameKey: 'facility-factory', dataDir: 'frontier4-factory', base: 'frontier4-tower', factory: true },
    ];
    const out = [];
    for (const v of VERSIONS) {
        // Diamond/Pearl only has the Battle Tower.
        const facilities = v.code === 'dp'
            ? FACILITIES.filter(f => f.key === 'tower') : FACILITIES;
        for (const f of facilities) {
            const variant = {
                code: `f4-${v.code}-${f.key}`,
                name: `${v.short} — ${f.label}`,
                version: v.code,
                facility: f.key,
                facilityShort: f.label,
                facilityNameKey: f.nameKey,
                dataDir: f.dataDir,
                pokedex: 'data/pokedex-4.json',
                gen: 4,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko'],
                // Hall: singles + doubles (doubles has no in-game role here, but
                // lets people browse two sets side by side); no multis.
                modes: f.hall ? ['singles', 'doubles'] : ['singles', 'doubles', 'multis'],
                hasTrainers: true,
                showMinisprites: true,
                trainerIVs: true,   // IV comes from the selected trainer (or Hall rank)
                noItems: f.noItems || false,  // Arcade/Castle: opponents hold no items
                icons: v.code === 'hgss'
                    ? ['assets/images/games/hg.png', 'assets/images/games/ss.png']
                    : v.code === 'pt' ? ['assets/images/games/pt.png']
                    : ['assets/images/games/d.png', 'assets/images/games/p.png'],
            };
            if (f.hall) variant.hall = true;        // type/rank selector instead of trainers
            else variant.lateCutoff = 43;           // "43+" toggle (Tower/Arcade/Castle/Factory)
            if (f.factory) variant.factory = true;  // runtime roster generation + Lv50/Open
            if (f.base) variant.base = f.base;
            // DP Tower is its OWN standalone dataset and randomizes natures.
            if (v.code === 'dp' && f.key === 'tower') {
                variant.dataDir = 'frontier4-dp';
                variant.base = undefined;
                variant.randomNature = true;
            }
            if (v.code === 'hgss' && f.key === 'tower') variant.default = true;
            out.push(variant);
        }
    }
    return out;
}

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
// <html data-theme="...">. The first entry (Luxray) is the default.
// Each theme sprite lives at assets/images/themes/<code>.png.
export const THEMES = [
    // Dark (7)
    { code: 'p-luxray',    name: 'Luxray',      dark: true  },
    { code: 'p-bisharp',   name: 'Bisharp',     dark: true  },
    { code: 'p-chandelure',name: 'Chandelure',   dark: true  },
    { code: 'p-umbreon',   name: 'Umbreon',     dark: true  },
    { code: 'p-honchkrow', name: 'Honchkrow',   dark: true  },
    { code: 'p-gourgeist', name: 'Gourgeist',   dark: true  },
    { code: 'p-zygarde',   name: 'Zygarde',     dark: true  },
    // Light (5)
    { code: 'p-magnemite', name: 'Magnemite',   dark: false },
    { code: 'p-whimsicott',name: 'Whimsicott',  dark: false },
    { code: 'p-jellicentf',name: 'Jellicent ♀', dark: false },
    { code: 'p-glaceon',   name: 'Glaceon',     dark: false },
    { code: 'p-gardevoir', name: 'Gardevoir',   dark: false },
];

// Appended to every data fetch (?v=...) so browsers pick up new data after a
// deploy instead of serving stale cached JSON. Bump when data files change.
export const DATA_VERSION = '2026-06-15g';

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

// The game the tool opens on (marked `default: true`) — independent of the
// menu's display order, which is chronological (SwSh listed first).
export function defaultGame() {
    return GAMES.find(game => game.default) || GAMES[0];
}

export function getGame(code) {
    return GAMES.find(game => game.code === code) || defaultGame();
}

export function defaultVariant(game) {
    return game.variants.find(variant => variant.default) || game.variants[0];
}

export function getVariant(game, code) {
    return game.variants.find(variant => variant.code === code) || defaultVariant(game);
}

// --- gen-4 two-axis menu (version × facility) ---------------------------
// Games with a `versions` array show version pills (HGSS/Platinum/…) in the
// variant-pill row and facility pills (Tower/Arcade/…) in a second row. A
// variant is the (version, facility) combination.

export function gameVersions(game) {
    return game.versions || [];
}

export function defaultVersion(game) {
    const vs = gameVersions(game);
    return (vs.find(v => v.default) || vs[0])?.code;
}

// Distinct facilities available for a version, in declaration order:
// [{ key, label }].
export function facilitiesForVersion(game, versionCode) {
    const seen = new Set();
    const out = [];
    for (const variant of game.variants) {
        if (variant.version === versionCode && !seen.has(variant.facility)) {
            seen.add(variant.facility);
            out.push({ key: variant.facility, label: variant.facilityShort,
                       nameKey: variant.facilityNameKey });
        }
    }
    return out;
}

export function variantForVersionFacility(game, versionCode, facilityKey) {
    return game.variants.find(
        v => v.version === versionCode && v.facility === facilityKey);
}

// Highest slot count among a variant's modes (how many menus to populate).
export function variantMaxSlots(variant) {
    return Math.max(...variant.modes.map(mode => MODES[mode].slots));
}
