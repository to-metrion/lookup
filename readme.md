# Battle Facility Tool

Lookup tool for Pokémon battle facility trainers and their sets, hosted at [lookup.eisencalc.com](https://lookup.eisencalc.com).

> **Work in progress** — the app is functional but still under construction, and more content is on the way. Outside contributions aren't being accepted at the moment.

Currently covers:

- **Battle Tree** (SM & USUM, Gen 7) — all 9 game languages
- **Battle Subway** (Gen 5) — all 7 game languages

## Structure

```
index.html          Single page
styles.css          All styling
scripts/
  app.js            Entry point: init, settings, event wiring
  config.js         Games, variants (feature flags), modes, themes, languages
  data.js           JSON fetching with caching
  state.js          Shared app state
  ui.js             DOM rendering (dropdowns, set tables, set details)
tools/
  validate.py          Data integrity checks — run after every data change
  convert_moves.js     Rebuilds data/moves.json from tools/src/move_data.js
  build_languages.py   Generates localized data files from poke-corpus
data/
  <facility>/trainers-<lang>.json   Trainer rosters & quotes
  <facility>/sets-<lang>.json       Pokémon sets
  pokedex-<gen>.json                Species names, types, abilities
  items.json, natures.json, moves.json, translations.json
assets/images/      Sprites, items, types, flags, trainers
```

Planned features and progress are tracked in [roadmap.md](roadmap.md).

No build step — serve the folder statically (e.g. `python3 -m http.server`) or push to GitHub Pages.

## Credits

- Localized names, trainer dialogue, and other game text sourced from
  [Poké Corpus](https://github.com/abcboy101/poke-corpus) by
  [abcboy101](https://github.com/abcboy101) — a searchable corpus of official
  Pokémon game text in all languages.
- Pokémon and all related names are © Nintendo / Creatures Inc. / GAME FREAK inc.
  This is an unofficial fan-made tool.
