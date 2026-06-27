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
//                    Variants/versions are LISTED newest-first (USUM before SM,
//                    ORAS before XY, like the other menus); the default is
//                    independent of order (set it explicitly with `default`).
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
        // BDSP Battle Tower (gen-8 engine, Sinnoh roster). Newest game → listed
        // first; `tree` keeps `default: true` so the tool still opens on Battle Tree.
        //
        // BDSP is presented differently from every other facility (`teamView`):
        // its singles teams are ORDERED (the lead is fixed) and a trainer can field
        // SEVERAL possible teams, so instead of the minisprite/Pokémon-menu/set-table
        // flow we show a trainer's teams as compact preview ROWS; picking one shows
        // its 3 sets side-by-side (like Maison triples). Sets carry per-stat IVs
        // (`ivSpread`; `IVs` is the Speed IV for the speed calc) and a fixed `ability`.
        //
        // Sub-facilities Normal / Master are VARIANT pills (default Master). Singles
        // and Doubles are SEPARATE datasets (different trainers), so each variant maps
        // each mode to its own dataDir (`modeDataDirs`); the mode toggle reloads the
        // matching trainers. Master Doubles is the MULTIS (duo) case — `duoDoubles` —
        // added with its own UI in a later step; Master is singles-only for now.
        code: 'bdsp',
        name: 'Battle Tower',   // the facility's real name (game-bdsp localizes it); the
                                // bd/sp logos differentiate it from the SwSh Battle Tower
        icons: ['assets/images/games/bd.png', 'assets/images/games/sp.png'],
        variants: [
            {
                code: 'bdsp-master',
                name: 'Master',
                short: 'Master',
                nameKey: 'variant-bdsp-master',   // "Master Class" (corpus), localized
                default: true,            // the tool opens BDSP on Master
                dataDir: 'bdsp-master-singles',
                modeDataDirs: { singles: 'bdsp-master-singles',
                                doubles: 'bdsp-master-doubles' },
                base: 'bdsp-tower',
                pokedex: 'data/pokedex-bdsp.json',
                gen: 8,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles'],
                hasTrainers: true,
                showMinisprites: false,
                teamView: true,
                // Master Doubles = MULTIS (duos): two trainer menus, each duo record
                // carries both trainers + teams; the trainer menu picks whole DUOS,
                // the quote menu picks individuals (with partner filtering). See the
                // duo-view section in ui.js.
                duoDoubles: true,
            },
            {
                code: 'bdsp-normal',
                name: 'Normal',
                short: 'Normal',
                nameKey: 'variant-bdsp-normal',   // no official name; "Normal" self-translated
                dataDir: 'bdsp-normal-singles',
                modeDataDirs: { singles: 'bdsp-normal-singles',
                                doubles: 'bdsp-normal-doubles' },
                base: 'bdsp-tower',
                pokedex: 'data/pokedex-bdsp.json',
                gen: 8,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht'],
                modes: ['singles', 'doubles'],
                hasTrainers: true,
                showMinisprites: false,
                teamView: true,
            },
        ],
    },
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
        // The variant row picks a game VERSION (SM / USUM), so it uses the larger
        // rounded version-pill style (like gen-3/4), not the facility toggle.
        versionPills: true,
        icons: ['assets/images/games/us.png', 'assets/images/games/um.png'],
        // Newest game listed first (USUM before SM) to match the other menus; the
        // default (`default: true`) is independent of order.
        variants: [
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
        ],
    },
    {
        code: 'maison',
        name: 'Battle Maison',
        versionPills: true,   // variant row = game version (XY / ORAS) → big pills
        icons: ['assets/images/games/or.png', 'assets/images/games/as.png'],
        // Newest game listed first (ORAS before XY) to match the other menus; the
        // default (`default: true`) is independent of order.
        variants: [
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
    {
        // Gen-3 (Emerald) Battle Frontier. Same two-axis menu shape as gen-4: a
        // VERSION (Emerald for now; Ruby/Sapphire later) and a FACILITY. Only the
        // Battle Tower is built so far; Palace/Factory/Pyramid/Dome/Arena/Pike
        // come one at a time. Listed LAST (oldest gen). Differentiated from gen-4
        // "Battle Frontier" by its Emerald logo (the game select keys on `code`).
        //
        // Tower quirks: IVs are PER-TRAINER (trainerIVs, tiers 3..21/31 by index);
        // OPEN LEVEL (`openLevel`) opponents match the player's strongest Pokémon
        // (60-100, not a flat 100), so the settings level toggle is "Lv 50 / Open"
        // with a level input; and the strongest legendary sets (`highTier` on the
        // set) only appear in Open Level — filtered from rosters at Lv 50.
        code: 'frontier3',
        name: 'Battle Frontier',
        icons: ['assets/images/games/e.png'],
        versions: [
            { code: 'emerald', short: 'Emerald', default: true,
              icons: ['assets/images/games/e.png'] },
            // Ruby/Sapphire: only the Battle Tower (its own dataset; no brain, singles
            // only, Lv 50 / Lv 100, random natures → 3-way speed). See frontier3-rs-tower.
            { code: 'rs', short: 'RS',
              icons: ['assets/images/games/r.png', 'assets/images/games/sa.png'] },
        ],
        variants: frontier3Variants(),
    },
    {
        // Gen-2 Crystal Battle Tower (oldest gen → listed last). Unlike every
        // other facility the opponents DON'T depend on a trainer: their teams are
        // drawn randomly from a per-LEVEL pool, so we model each LEVEL (10,20,…,100)
        // as a "trainer" ("Level 10" … "Level 100"), each fielding its 21-set pool
        // (cf. the gen-3 Factory's battle-number arrays). Singles only; no quotes.
        //
        // Gen-2 mechanics (`gen: 2`): DVs (0-15) instead of IVs, Stat Exp instead of
        // EVs, and NO natures / abilities / held-item speed modifiers. The renderer
        // and speed.js branch on the generation; sets carry `DVs`, `level`, and EVs
        // already converted from Stat Exp (EV = min(252, floor√statexp)) so the
        // standard speed/Showdown pipeline reproduces the game exactly.
        code: 'crystal',
        name: 'Battle Tower',
        icons: ['assets/images/games/c.png'],
        variants: [
            {
                code: 'crystal-tower',
                name: 'Battle Tower',
                default: true,
                dataDir: 'crystal-tower',
                pokedex: 'data/pokedex-2.json',
                gen: 2,
                languages: ['en', 'fr', 'de', 'it', 'es', 'jp'],   // gen 2: no ko/Chinese
                modes: ['singles'],
                hasTrainers: true,
                hasQuotes: false,        // gen-2 Tower trainers have no quotes
                showMinisprites: true,
                orderedTrainers: true,   // keep "Level 10".."Level 100" in numeric order
                icons: ['assets/images/games/c.png'],
            },
        ],
    },
];

// Gen-3 Battle Frontier variants (version × facility). Add facilities to
// FACILITIES as they're built (validate.py + smoke too). All gen-3 facilities
// share: 6 langs (no ko/Chinese), per-trainer IVs, Open Level, the 50+ late
// filter, and English-only quotes (gen-3 quotes are Easy Chat).
function frontier3Variants() {
    const VERSIONS = [
        { code: 'emerald', short: 'Emerald' },
    ];
    const FACILITIES = [
        { key: 'tower', label: 'Tower', nameKey: 'facility-tower', dataDir: 'frontier3-tower',
          modes: ['singles', 'doubles', 'multis'], default: true },
        // Dome: same 300 trainers + pools as the Tower (delta — only the brain,
        // Tucker, differs). But every NON-Tucker Pokémon has 3 IVs (the Dome bug),
        // applied at render via `forcedIV` (Tucker keeps his 20/31 via trainer.iv).
        // Singles + Doubles (3 entered, 2 brought — we show the full roster).
        { key: 'dome', label: 'Dome', nameKey: 'facility-dome', dataDir: 'frontier3-dome',
          base: 'frontier3-tower', modes: ['singles', 'doubles'], forcedIV: 3,
          links: [{ text: 'Battle Dome Assistant by Mow',
                    url: 'https://pokemow.com/Gen3/DomeAssistantWeb/' }] },
        // Palace: identical to the Tower (same 300 trainers + pools, normal IVs) — a
        // plain delta swapping the brain to Spenser. All three modes.
        { key: 'palace', label: 'Palace', nameKey: 'facility-palace', dataDir: 'frontier3-palace',
          base: 'frontier3-tower', modes: ['singles', 'doubles', 'multis'] },
        // Arena: SINGLES only (the mode selector auto-hides for a single mode), delta
        // swapping the brain to Greta. Arena forces ENTERED-order send-out, so the
        // brain's team is shown in roster order (`fixedTeamOrder`), not dex-sorted.
        { key: 'arena', label: 'Arena', nameKey: 'facility-arena', dataDir: 'frontier3-arena',
          base: 'frontier3-tower', modes: ['singles'], fixedTeamOrder: true },
        // Factory: STANDALONE (no base) — the 882 tier-tagged sets, but the
        // "trainers" are the 8 battle-number arrays + Noland ×2. Each entry's roster
        // is derived at runtime from the tier tags × the level mode (`factory3`).
        // Lv50 / Open (Open = level 100, no input — unlike the Tower's Open). IVs for
        // the battle arrays come from the player's current Tower STREAK (a glitch) —
        // the settings panel asks for it; Noland uses 15 (battle 21) / 31 (battle 42).
        // Singles + Doubles (no multis). No 50+ late filter (the arrays ARE the
        // battle ranges). Minisprites on for now (a lot of species — under review).
        { key: 'factory', label: 'Factory', nameKey: 'facility-factory', dataDir: 'frontier3-factory',
          modes: ['singles', 'doubles'], factory3: true,
          links: [{ text: 'Battle Factory Buddy by Dave Glorbus',
                    url: 'https://battlefactorybuddy.com' }] },
        // Pike: delta on the Tower (brain Anabel → Lucy) plus a "Wild Pokémon" entry
        // (some rooms field wild Pokémon — wild sets carry random IVs → an IV-range
        // speed, and a player-relative level). Singles + Doubles, but DEFAULTS to
        // Doubles (`defaultMode`) since most runs stay in one view. The Pike streak
        // counts selection rooms too (~2× battles), so the late cutoff is 99+.
        { key: 'pike', label: 'Pike', nameKey: 'facility-pike', dataDir: 'frontier3-pike',
          base: 'frontier3-tower', modes: ['singles', 'doubles'], defaultMode: 'doubles',
          lateCutoff: 99 },
        // Pyramid: delta on the Tower (brain Anabel → Brandon). Singles + Doubles
        // (defaults to Doubles like Pike), normal IVs, plain 50+ late (default cutoff).
        // `pyramidWild`: the "Wild Pokémon" entry opens a round/floor filter (the quote
        // menu becomes a round-quote filter) and a 140+ IV toggle in settings.
        { key: 'pyramid', label: 'Pyramid', nameKey: 'facility-pyramid', dataDir: 'frontier3-pyramid',
          base: 'frontier3-tower', modes: ['singles', 'doubles'], defaultMode: 'doubles',
          pyramidWild: true },
    ];
    const out = [];
    for (const v of VERSIONS) {
        for (const f of FACILITIES) {
            const variant = {
                code: `f3-${v.code}-${f.key}`,
                name: `${v.short} — ${f.label}`,
                version: v.code,
                facility: f.key,
                facilityShort: f.label,
                facilityNameKey: f.nameKey,
                dataDir: f.dataDir,
                pokedex: 'data/pokedex-3.json',
                gen: 3,
                languages: ['en', 'fr', 'it', 'de', 'es', 'jp'],   // gen-3: no ko/Chinese
                modes: f.modes,
                hasTrainers: true,
                showMinisprites: true,
                trainerIVs: true,    // IV comes from the selected trainer (tier by index)
                openLevel: true,     // Lv 50 / Open (level input) toggle
                lateCutoff: 50,      // "50+" filter (Battle Girl Kay..Gretel + the brain)
                enOnlyQuotes: true,  // gen-3 quotes are English-only (Easy Chat)
                icons: ['assets/images/games/e.png'],
            };
            if (f.base) variant.base = f.base;
            if (f.forcedIV != null) {
                // Dome 3-IV bug: non-brain trainers use this IV (browse too); the
                // brain (Tucker) keeps his own iv via the trainer record.
                variant.forcedIV = f.forcedIV;
                variant.speedIVs = f.forcedIV;
            }
            if (f.links) variant.links = f.links;   // external helper-tool links
            if (f.fixedTeamOrder) variant.fixedTeamOrder = true;  // Arena: brain in team order
            if (f.defaultMode) variant.defaultMode = f.defaultMode;  // Pike: default to Doubles
            if (f.lateCutoff != null) variant.lateCutoff = f.lateCutoff;  // Pike: 99+ (room-count)
            if (f.pyramidWild) variant.pyramidWild = true;  // Pyramid: wild round/floor filter
            if (f.factory3) {
                // Factory: flat Lv50/Open toggle (Open = 100, no input — drop the
                // Tower's openLevel input), streak-driven IVs, no 50+ late filter.
                variant.factory3 = true;
                variant.openLevel = false;
                variant.hasQuotes = false;   // the arrays aren't trainers; Noland has none here
                delete variant.lateCutoff;
            }
            if (f.default) variant.default = true;
            out.push(variant);
        }
    }
    // Ruby/Sapphire Battle Tower — a 2nd version, Tower only. STANDALONE dataset with
    // TWO mon pools (Lv 50 / Lv 100) selected by a flat level toggle (`rsTower` →
    // roster/rosterOpen + a per-set `pool`). No brain, SINGLES only, random natures
    // (`randomNature` → 3-way speed), per-trainer IVs, 50+ late = the IV-31 trainers.
    out.push({
        code: 'f3-rs-tower',
        name: 'RS — Tower',
        version: 'rs',
        facility: 'tower',
        facilityShort: 'Tower',
        facilityNameKey: 'facility-tower',
        dataDir: 'frontier3-rs-tower',
        pokedex: 'data/pokedex-3.json',
        gen: 3,
        languages: ['en', 'fr', 'it', 'de', 'es', 'jp'],
        modes: ['singles'],
        hasTrainers: true,
        showMinisprites: true,
        trainerIVs: true,
        randomNature: true,         // RS randomizes natures (3-way speed display)
        rsTower: true,              // two-pool Lv50/Lv100 roster + per-set pool filter
        openLabel: 'level-100',     // the level toggle's 2nd option reads "Level 100"
        lateCutoff: 50,             // "50+" = the IV-31 trainers (Oliver..Gillian)
        enOnlyQuotes: true,         // gen-3 quotes are Easy Chat (English only)
        icons: ['assets/images/games/r.png', 'assets/images/games/sa.png'],
    });
    return out;
}

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
        { key: 'castle', label: 'Castle', nameKey: 'facility-castle', dataDir: 'frontier4-castle', base: 'frontier4-tower',
          links: [{ text: 'Battle Castle Assistant by potatobagel',
                    url: 'https://echen52.github.io/battle-castle-assistant/' }] },
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
            if (f.links) variant.links = f.links;   // external helper-tool links
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

// 4 so BDSP doubles can show a 4-Pokémon team as a 2×2 grid of detail panels;
// no battle MODE exceeds 3 slots, so the 4th container stays hidden elsewhere.
export const MAX_SLOTS = 4;
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
export const DATA_VERSION = '2026-06-26l';

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
