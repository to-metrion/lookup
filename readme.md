# Battle Facility Tool

Lookup tool for Pokémon battle facility trainers and their sets, hosted at [lookup.eisencalc.com](https://lookup.eisencalc.com).

Currently covers:

- **EisenBerry Academy** (Gen 9)
- **Battle Tree** (USUM, Gen 7) — English, French, Japanese
- **Battle Subway** (Gen 5)

## Structure

```
index.html          Single page
styles.css          All styling
scripts/
  app.js            Entry point: init, settings, event wiring
  config.js         Facility & language config (edit this to add content)
  data.js           JSON fetching with caching
  state.js          Shared app state
  ui.js             DOM rendering (dropdowns, set tables, set details)
data/
  <facility>-trainers-<lang>.json   Trainer rosters & quotes
  <facility>-sets-<lang>.json       Pokémon sets
  pokedex-<gen>.json                Species names, types, abilities
  items.json, natures.json, translations.json
assets/images/      Sprites, items, types, flags, trainers
```

## Adding content

1. **New facility**: add an entry to `FACILITIES` in `scripts/config.js`, then add `data/<code>-trainers-<lang>.json` and `data/<code>-sets-<lang>.json`.
2. **New language for a facility**: add the language code to that facility's `languages` array in `scripts/config.js` and provide the matching data files.

Species names in trainer `species`/`roster` fields must exactly match the `en` names in the facility's pokedex file and the `species` field in the sets file. Sprite filenames are the lowercased English species name.

No build step — serve the folder statically (e.g. `python3 -m http.server`) or push to GitHub Pages.
