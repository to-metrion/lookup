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
      (alt accent color on 3rd/4th positions; glyph click cycles, notch click jumps)
- [x] Old-gen move names modernized in data ("SolarBeam" → "Solar Beam", "Faint Attack" → "Feint Attack", ...)
- [x] Theme-tinted icons via CSS masks (settings cog, reset arrow, copy) — single PNGs, no recolored copies
- [x] Move type icons in set details, gen-aware (`data/moves.json` via `tools/convert_moves.js`;
      localized sets resolve types through their English counterpart set).
      Caveat: the source calculator data backports modern types to old gens — real historical
      type changes are patched in `TYPE_CHANGES` in the converter (extend it when adding
      gen 3/4 facilities; e.g. Curse is already handled)
- [x] Data validator (`tools/validate.py`) — also checks gen-aware move coverage
- [ ] Game icons in the game select (`icon` field supported; **icon images still needed** in `assets/images/games/`)
- [ ] Data converter tooling in `tools/` (build per source once data sources are chosen — Google Sheets links or scraped pages, transformed + validated to JSON)

## Languages

- [ ] Add all official game languages per variant as data becomes available
- [ ] Korean columns missing from `pokedex-7.json` and `items.json` (Gen 7 supports Korean)
- [ ] Translate new UI strings (`translations.json`) for all 9 languages
- [ ] Battle Tree: SM variant (slight set/trainer differences vs USUM)

## Facilities to add (in planned order)

1. [ ] **SwSh Battle Tower** — basic format. Quirk: some trainers Dynamax specific Pokémon → per-trainer `maxed` field (e.g. `"Charizard-1, Duraludon-2"`), Dynamax icon on those set rows.
2. [ ] **Restricted Sparring (SwSh)** — `hasTrainers: false` (one implicit trainer, dropdowns hidden), `showMinisprites: false`, singles only.
3. [ ] **Battle Maison (XY/ORAS)** — modes: singles / doubles / triples / rotation. Triples & rotation show 3 slots (⚀ ⚁ ⚂ + circling-arrows icon). Foundation already supports this.
4. [ ] **Battle Frontier Gen IV (Pt/HGSS)** — multiple variants (Tower, Factory, Castle, Arcade, Hall). Level 50/100 toggle on the variant that supports it: affects displayed speed **and** the set pool → sets need per-level speed or availability flag (decide with data in hand).
5. [ ] **Battle Frontier Gen III (Emerald)** — multiple variants, quirks TBD. "Open Level" (51–100 slider): speed must be **computed**, which requires:
   - [ ] Base stats added to pokedex files (all six stats, future-proof)
   - [ ] IVs per set (Gen III frontier IVs are deterministic and documented)
   - [ ] Structured nature modifiers (derivable from the `stats-en` text already in `natures.json`)
6. [ ] **BDSP Battle Tower** (last) — teams are fixed per trainer (no random roster), same order every time → set presentation needs rethinking when we get there.

## Known data gaps

- [ ] Sailor (EBA) roster references `Ogerpon-2` — set doesn't exist yet
- [ ] `assets/images/sprites/murkrow.png` missing (minisprite exists)
- [ ] EBA hidden from the site (data kept; re-enable in `config.js` when ready)

## Maybes / later

- [ ] Per-variant extra tools (e.g. Factory-specific helpers) hooked into the variant config
- [ ] Mobile: mode control currently hidden (forced singles) — revisit for Maison
- [ ] Contribution guide once the project is ready for outside help
