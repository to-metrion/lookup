# Roadmap

Internal planning document — tracks goals and progress for the Battle Facility Tool.

## Architecture principles

- **Games group, variants define.** The settings menu lists *games* (Battle Tree, Battle Subway, SwSh, ...). Each game has one or more *variants* (sub-facilities or game versions). All feature flags and quirks live on the **variant**, never the game — e.g. SwSh Battle Tower and Restricted Sparring are variants of the same game with completely different options.
- **Config-driven UI.** `scripts/config.js` is the single source of truth: a variant declares its modes, slot count, whether it has trainers/minisprites, level options, etc., and the UI adapts. Adding a facility should never require touching UI code unless it introduces a genuinely new quirk.
- **Data invariants** (enforced by `tools/validate.py`):
  - Per-language trainer files are parallel arrays (same trainers, same order) — language switching relies on this.
  - Every roster entry `Species-N` has a matching set (`species`, `setNumber`) in the sets file.
  - Every species resolves in the variant's pokedex and has minisprite/sprite images.
  - Every item and nature resolves in `items.json` / `natures.json`.

## Foundation (build on Tree + Subway first)

- [x] Modular ES-module codebase, single load path, data fixes (June 2026)
- [x] Copy-to-Showdown button (always exports English)
- [x] Language switch preserves current view
- [x] Games → variants config structure with per-variant feature flags
- [x] Theme support: CSS variables, dark (default) / light / midnight / forest, theme picker in settings
- [x] Dynamic Pokémon slots (1–3) driven by mode, ready for triples/rotation
- [x] Mode cycler button driven by `variant.modes` (replaces the singles/doubles switch)
- [x] Variant submenu in settings (hidden when a game has a single variant)
- [x] Post-50 / late-streak trainer filter (uses the `late` field; populated for Tree & Subway)
- [x] Visual settings: theme picker as dual-color swatches (8 themes), late filter as "40+"/"28+"
      button styled like the other settings rows (no text needed)
- [x] Mode control: big accent-colored mode glyph with a small multi-position slider track under it
      (glyph click cycles, notch click jumps)
- [x] Old-gen move names modernized in data ("SolarBeam" → "Solar Beam", "Faint Attack" → "Feint Attack", ...)
- [x] Theme-tinted icons via CSS masks (settings cog, reset arrow, copy) — single PNGs, no recolored copies
- [x] Move type icons in set details, gen-aware (`data/moves.json` via `tools/convert_moves.js`;
      localized sets resolve types through their English counterpart set).
      Caveat: the source calculator data backports modern types to old gens — real historical
      type changes are patched in `TYPE_CHANGES` in the converter (extend it when adding
      gen 3/4 facilities; e.g. Curse is already handled)
- [x] Data validator (`tools/validate.py`) — also checks gen-aware move coverage
- [x] Game icons in the game select (`icons` list per game, one per flagship version)
- [x] Multi Battles mode (⚃): "sides" model — every mode is sides × slots (multis = 2 trainers,
      1 Pokémon each). Two trainer/quote menus side by side (stacked on mobile), per-trainer
      species lists above each Pokémon column (suppressed on mobile), mobile gets a ⚃ settings
      toggle instead of the header mode switch. Enabled for Tree and Subway.
- [x] Per-slot minisprite lists in ALL modes (each slot's list fills exactly that slot —
      replaces the old "sprites only fill the last slot" behavior users complained about),
      with a Bulbasaur settings toggle to hide them (default on)
- [x] Settings menu: no title, theme swatches at the top
- [x] Settings rework (June 2026): language picker is a row of flag buttons under
      the theme swatches (no dropdown, no text; flag PNGs downscaled 2560px → 64px
      tall, ≤4 KB each); game select is big trainer-style small-caps
      (`.select2-container--game`); facility picker is a row of small text pills
      (`variant.short` in config.js — 'USUM'/'SM'/'ORAS'/'XY'; scales to gen-4
      facilities and Restricted Sparring as plain labels, per-facility emblems
      could replace them later if art is sourced). Variants are listed
      chronologically (SM before USUM, XY before ORAS) with `default: true`
      marking the selection a game opens on; the game select's icons follow
      the selected facility (XY → x/y, ORAS → or/as — gen 4's Pt vs HGSS can
      do the same). Settings groups (themes / game+facility / language /
      toggles) are separated by subtle dividers, language below facility.
      Game names use the official localizations (`game-*` keys in
      translations.json, from the corpus: Arbre de Combat, Kampfhaus, Metrò
      Lotta, バトルツリー...); facility pill labels (USUM/SM/ORAS/XY) stay
      universal. Maison/Subway have no official chs/cht names (pre-gen-7
      games) and fall back to English there.
- [x] Localization pipeline (`tools/build_languages.py`): generates trainer/set files and fills
      dex/item/nature columns from the [poke-corpus](https://github.com/abcboy101/poke-corpus)
      game text dumps (clone locally, default path `/tmp/pokecorpus/corpus`)
- [x] Pokédex files carry National Dex `num` + all six base stats, per
      generation (`tools/add_base_stats.js`, via @pkmn/dex; needs `npm i
      @pkmn/dex`). Files MUST be in National Dex order (forms right after
      their base species) — the UI minisprite sort keys off file position;
      validate.py enforces both. Form quirks: Minior/Wishiwashi carry their
      battle-start forme's stats (Meteor / School).
- [x] Speed is COMPUTED at runtime (`scripts/speed.js`) from base stats —
      static speed values stripped from all sets files. L50/IV31 by default
      (variant flags `speedLevel`/`speedIVs` for future facilities), EVs +
      nature from the set, items (Choice Scarf ×1.5, Iron Ball ×0.5, Quick
      Powder ×2 on Ditto), Mega sets display "pre → post" (e.g. "70 → 40").
      Verified against the previously shipped static values across all
      facilities/languages: only intended diffs (Maison statics lacked item
      modifiers; subway Absol-3 static was 136, a typo — correct is 139).
- [ ] Data converter tooling for NEW facility data (build per source once sources are chosen)

## Languages

- [x] Battle Tree: all 9 USUM languages (en, fr, it, de, es, jp, ko, chs, cht)
- [x] Battle Subway: all 7 BW languages (en, fr, it, de, es, jp, ko)
- [x] Korean columns in pokedex-7/pokedex-5/items/natures (from poke-corpus)
- [x] UI strings (`translations.json`) available in all 9 languages
- [x] Battle Tree: SM variant scaffolding — variant submenu live, DELTA file mechanism
      (`base` field in config: SM files only catalog differences vs USUM — removals +
      full replacement/addition records, merged at load; localized deltas generated by
      `tools/build_languages.py`). SM deltas FILLED (15 set overrides; 49 trainer
      roster differences + Kukui removed, sourced from a game-data diff). USUM base data
      corrected against game data (Arlo/Levine extra Probopass, Ryder extra Walrein).
      **Tree (SM + USUM) and Subway are now feature- and data-complete**
- Delta caveat: trainer removals/replacements are keyed by name; if a delta ever needs
  to target one of two same-named trainers (Red/Blue, キロハナ), extend the key first
- Note: Chinese corpus files encode *species names* as private-use glyphs; the existing
  chs/cht dex columns are used instead (quotes/items/moves are plain text — verified clean)
- [x] All trainers carry a localized `class` (Tree all 9 languages, Subway all 7;
      Maison already had it), derived from the sprite via `CLASS_BY_SPRITE` in
      build_languages.py (BW TF191 / USUM TF111, index-based so gendered localized
      names are correct: Forscher/Forscherin, Topdresseur/Topdresseuse; the ⒆⒇
      corpus placeholder expands to "Pokémon"; ♂/♀ markers are dropped — "Clerk ♂"
      → "Clerk" — and English classes use the corpus spelling, no "(M)"/"(F)").
      The trainer search box also matches the class — typing "chef"/"doctor"
      lists that class (works everywhere).

## Facilities to add (in planned order)

1. [ ] **SwSh Battle Tower** — basic format. Quirk: some trainers Dynamax specific Pokémon → per-trainer `maxed` field (e.g. `"Charizard-1, Duraludon-2"`), Dynamax icon on those set rows.
2. [ ] **Restricted Sparring (SwSh)** — `hasTrainers: false` (one implicit trainer, dropdowns hidden), `showMinisprites: false`, singles only.
3. [x] **Battle Maison (XY/ORAS)** — DONE (June 2026). ORAS base + XY delta (incl. two
   per-version slot swaps Sati/Inga, Aparna/Arabella), 1072 sets, 194 trainers per version,
   7 languages, all four modes (first facility with triples). Built by `tools/build_maison.py`
   from the curation spreadsheet (tools/src/maison/) + poke-corpus (names/quotes by trainer-ID
   indexing; Chatelaine intros from their scripted dialogue — review quotes in-app).
   Speed is computed (L50/IV31, gen-6 base stats via @pkmn/dex). `data/pokedex-6.json` carries
   gen-6-era abilities (e.g. Gengar = Levitate). Sprites + x/y/or/as icons delivered.
   XY/ORAS quote divergence fixed: ORAS quotes come from corpus TF35 (TF34 is a STALE
   copy of the XY text!) — most shared trainers were rewritten for ORAS, so the XY delta
   carries ~118 in-place quote replacements (name+sprite key) and removes+re-adds the
   ~29 trainers whose localized name changed between games (same action in every
   language to keep the arrays parallel; namesake collisions are pulled in to fixpoint).
   Chatelaines: Super rematch intros (triplets 318–321), `late: 1`, per-person sprites.
   Per-trainer sprite overrides (tourists/workers/skaters/furisode girls) in
   SPRITE_OVERRIDES in `tools/build_maison.py`.
4. [ ] **Battle Frontier Gen IV (Pt/HGSS)** — multiple variants (Tower, Factory, Castle, Arcade, Hall). Level 50/100 toggle on the variant that supports it: affects displayed speed **and** the set pool → sets need per-level speed or availability flag (decide with data in hand).
5. [ ] **Battle Frontier Gen III (Emerald)** — multiple variants, quirks TBD. "Open Level" (51–100 slider): speed is already computed at runtime (scripts/speed.js, level-parameterized; nature parsed from `stats-en`), still needs:
   - [x] Base stats added to pokedex files (all six stats, future-proof)
   - [ ] IVs per set (Gen III frontier IVs are deterministic and documented; extend speed.js to read a per-set `ivs` field)
   - [ ] A pokedex-3 file with gen-3 base stats (add to tools/add_base_stats.js)
6. [ ] **BDSP Battle Tower** (last) — teams are fixed per trainer (no random roster), same order every time → set presentation needs rethinking when we get there.

## Known data gaps

- EBA removed entirely (data recoverable from git history if ever needed);
  `pokedex-9.json` and the gen-9 assets are kept for future gen-9 facilities

## Maybes / later

- [ ] Per-variant extra tools (e.g. Factory-specific helpers) hooked into the variant config
- [ ] Mobile: mode control currently hidden (forced singles) — revisit for Maison
- [ ] Contribution guide once the project is ready for outside help
