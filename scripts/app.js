// Application entry point: initialization, settings and event wiring.

import { GAMES, MODES, THEMES, LANGUAGE_NAMES, MAX_SIDES,
         getGame, getVariant, defaultVariant, modeSlots,
         gameVersions, facilitiesForVersion, variantForVersionFacility } from './config.js';
import { loadTranslations, loadVariantData } from './data.js';
import { state } from './state.js';
import {
    initSelect2, iconTemplate,
    buildSlotContainers,
    populateTrainerDropdown, populateQuoteDropdown, syncTrainerDropdowns,
    refreshSidePlaceholders, renderSpeciesLists, populatePokemonMenus,
    highlightSelectedSprites, showPokemonSets,
    resetSlotsOfSide, resetPokemonUI, resetSelections,
    updateLayout, applyStaticTranslations, t,
    trainerPool, isLateTrainer,
} from './ui.js';

/* ---------- settings (game, variant, language, theme) ---------- */

function populateGameSelect() {
    const select = document.getElementById('game-select');
    select.innerHTML = '';
    for (const game of GAMES) {
        select.appendChild(new Option(game.name, game.code));
    }
    select.value = state.game.code;
    updateGameSelectIcons(false);
    initSelect2('#game-select', {
        placeholder: 'Game',
        template: iconTemplate,
        search: false,
        containerClass: 'select2-container--game', // big, trainer-style
    });
}

// The selected game's icons follow the selected FACILITY (XY shows x/y,
// ORAS shows or/as, ...); other games show their own default icons. Names
// use the official localizations (game-* keys in translations.json; games
// without an official name in the current language fall back to English).
// Only the option attributes/text are touched — rebuilding the select2 from
// inside its own change event would crash it.
function updateGameSelectIcons(rerender = true) {
    for (const option of document.getElementById('game-select').options) {
        const game = getGame(option.value);
        const icons = (game === state.game && state.variant?.icons) || game.icons;
        if (icons?.length) option.setAttribute('data-icons', icons.join('|'));
        option.textContent = t(`game-${game.code}`, game.name);
        // select2 caches per-option data in an internal store keyed by
        // data-select2-id — drop the id so the new text is picked up
        option.removeAttribute('data-select2-id');
    }
    if (rerender) $('#game-select').trigger('change.select2');
}

// Facility picker: a segmented row of small text pills (clearly subordinate
// to the big game select above it). Labels come from `variant.short` in
// config.js, falling back to the full name. Hidden for single-variant games.
function populateVariantPills() {
    const row = document.getElementById('variant-row');
    const pills = document.getElementById('variant-pills');
    pills.innerHTML = '';

    // Games with a version axis (gen-4 Frontier) put VERSION pills here (HGSS /
    // Platinum / …); the facility pills go in the second row below.
    const versions = gameVersions(state.game);
    if (versions.length) {
        for (const version of versions) {
            const pill = document.createElement('button');
            pill.className = 'variant-pill';
            pill.dataset.version = version.code;
            pill.textContent = version.short;
            pill.title = version.short;
            pill.classList.toggle('active', version.code === state.variant.version);
            pill.addEventListener('click', () => {
                if (version.code !== state.variant.version) onVersionChanged(version.code);
            });
            pills.appendChild(pill);
        }
        row.style.display = versions.length > 1 ? '' : 'none';
        populateFacilityPills();
        return;
    }

    // Single-axis games: the variant pills ARE the facilities.
    for (const variant of state.game.variants) {
        const pill = document.createElement('button');
        pill.className = 'variant-pill';
        pill.dataset.variant = variant.code;
        // Universal short codes (USUM/SM/…) stay as-is; facilities with a
        // localized name (SwSh Tower / Restricted Sparring) use their nameKey.
        pill.textContent = variant.nameKey
            ? t(variant.nameKey, variant.short ?? variant.name)
            : (variant.short ?? variant.name);
        pill.title = variant.nameKey ? pill.textContent : variant.name;
        pill.classList.toggle('active', variant.code === state.variant.code);
        pill.addEventListener('click', () => {
            if (variant.code !== state.variant.code) onVariantChanged(variant.code);
        });
        pills.appendChild(pill);
    }
    row.style.display = state.game.variants.length > 1 ? '' : 'none';
    populateFacilityPills(); // hides the facility row for single-axis games
}

// Second pill row (gen-4 Frontier): the facilities available for the selected
// version. Hidden entirely for games without a version axis.
function populateFacilityPills() {
    const row = document.getElementById('facility-row');
    const pills = document.getElementById('facility-pills');
    pills.innerHTML = '';
    if (!gameVersions(state.game).length) {
        row.style.display = 'none';
        return;
    }
    const facilities = facilitiesForVersion(state.game, state.variant.version);
    for (const facility of facilities) {
        const pill = document.createElement('button');
        pill.className = 'facility-pill';
        pill.dataset.facility = facility.key;
        pill.textContent = t(facility.nameKey, facility.label);
        pill.title = pill.textContent;
        pill.classList.toggle('active', facility.key === state.variant.facility);
        pill.addEventListener('click', () => {
            if (facility.key !== state.variant.facility) onFacilityChanged(facility.key);
        });
        pills.appendChild(pill);
    }
    // Always show the facility row for versioned games (Battle Frontier) — even
    // when a version has a single facility (DP = Tower only), for consistency.
    row.style.display = '';
}

// Language picker: a row of flag buttons under the theme swatches — the
// flags speak for themselves, no dropdown or text needed.
function populateLanguageFlags() {
    const row = document.getElementById('language-flags');
    row.innerHTML = '';
    // Keep the current language if this variant supports it, else fall back.
    if (!state.variant.languages.includes(state.language)) {
        state.language = state.variant.languages[0];
    }
    for (const code of state.variant.languages) {
        const btn = document.createElement('button');
        btn.className = 'lang-flag';
        btn.dataset.lang = code;
        btn.title = LANGUAGE_NAMES[code] || code;
        btn.classList.toggle('active', code === state.language);
        const img = document.createElement('img');
        img.src = `assets/images/flags/${code}.png`;
        img.alt = LANGUAGE_NAMES[code] || code;
        btn.appendChild(img);
        btn.addEventListener('click', () => {
            if (code !== state.language) onLanguageChanged(code);
        });
        row.appendChild(btn);
    }
}

// Visual theme picker: sprite buttons with dark/light background.
function populateThemeSwatches() {
    const row = document.getElementById('theme-swatches');
    row.innerHTML = '';
    for (const theme of THEMES) {
        const swatch = document.createElement('button');
        swatch.className = `theme-swatch ${theme.dark ? 'theme-dark' : 'theme-light'}`;
        swatch.dataset.theme = theme.code;
        swatch.title = theme.name;
        const img = document.createElement('img');
        img.dataset.src = `assets/images/themes/${theme.code}.png`;
        img.alt = theme.name;
        img.width = 36;
        img.height = 36;
        swatch.appendChild(img);
        swatch.addEventListener('click', () => setTheme(theme.code));
        row.appendChild(swatch);
    }
    updateThemeSwatches();
}

function updateThemeSwatches() {
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.theme === state.theme);
    });
}

// Visual late-trainers toggle: a "<N>+" pill using the variant's cutoff. Battle
// Factory instead shows TWO thresholds (21+ / 49+), mutually exclusive.
function updateLateFilterRow() {
    const row = document.getElementById('late-filter-row');
    const btn = document.getElementById('late-filter');
    const f21 = document.getElementById('factory-late-21');
    const f49 = document.getElementById('factory-late-49');
    if (state.variant.factory) {
        row.style.display = '';
        btn.style.display = 'none';
        f21.style.display = ''; f49.style.display = '';
        f21.classList.toggle('active', state.factoryLate === 21);
        f49.classList.toggle('active', state.factoryLate === 49);
        return;
    }
    btn.style.display = ''; f21.style.display = 'none'; f49.style.display = 'none';
    row.style.display = state.variant.lateCutoff ? '' : 'none';
    btn.textContent = `${state.variant.lateCutoff ?? ''}+`;
    btn.classList.toggle('active', state.lateOnly);
}

// Mobile-only multis toggle (the header mode switch is hidden on mobile).
function updateMultisRow() {
    const row = document.getElementById('multis-row');
    row.style.display = state.variant.modes.includes('multis') ? '' : 'none';
    document.getElementById('multis-toggle')
        .classList.toggle('active', state.mode === 'multis');
}

// Minisprite lists on/off (some users prefer fewer sprites on screen).
function updateSpritesRow() {
    const row = document.getElementById('sprites-row');
    row.style.display = state.variant.showMinisprites ? '' : 'none';
    document.getElementById('sprites-toggle').classList.toggle('active', state.spritesOn);
}

function onSpritesToggled() {
    state.spritesOn = !state.spritesOn;
    localStorage.setItem('minisprites', state.spritesOn ? '1' : '');
    updateSpritesRow();
    renderSpeciesLists(onSpeciesPicked);
    highlightSelectedSprites();
}

// Battle Factory Lv50 / Open Level toggle (settings menu). Only shown for
// Factory; the level changes generated rosters, IVs, AND the speed level.
function updateFactoryLevelRow() {
    const row = document.getElementById('factory-level-row');
    row.style.display = state.variant.factory ? '' : 'none';
    if (!state.variant.factory) return;
    const opts = row.querySelectorAll('.factory-level-opt');
    opts[0].textContent = t('factory-lv50', 'Level 50');
    opts[1].textContent = t('factory-open', 'Open Level');
    opts[0].classList.toggle('active', !state.factoryOpen);
    opts[1].classList.toggle('active', state.factoryOpen);
}

function onFactoryLevelChanged(open) {
    if (open === state.factoryOpen) return;
    state.factoryOpen = open;
    localStorage.setItem('factoryOpen', open ? '1' : '');
    updateFactoryLevelRow();
    // Level drives the generated rosters, IVs and speed → re-derive + re-render
    // the current selection (same pattern as a language switch).
    restoreSelection(captureSelection());
}

function onGameChanged(code) {
    state.game = getGame(code);
    applyVariant(defaultVariant(state.game));
}

function onVariantChanged(code) {
    applyVariant(getVariant(state.game, code));
}

// gen-4 Frontier: switching the version keeps the current facility if it exists
// in the new version, otherwise falls back to that version's first facility.
function onVersionChanged(versionCode) {
    const facility = state.variant.facility;
    const variant = variantForVersionFacility(state.game, versionCode, facility)
        || variantForVersionFacility(state.game, versionCode,
               facilitiesForVersion(state.game, versionCode)[0].key);
    applyVariant(variant);
}

// gen-4 Frontier: switching the facility keeps the current version.
function onFacilityChanged(facilityKey) {
    const variant = variantForVersionFacility(state.game, state.variant.version, facilityKey);
    if (variant) applyVariant(variant);
}

// Central entry for switching variant: validates language and mode against the
// variant's capabilities, refreshes all dependent settings UI, reloads data.
function applyVariant(variant) {
    state.variant = variant;
    state.hallType = null;   // fresh Hall selection per variant (kept across language switches)
    state.hallRank = null;
    state.factoryLate = null; // fresh Factory trainer filter per variant
    localStorage.setItem('selectedGame', state.game.code);
    localStorage.setItem('selectedVariant', variant.code);

    if (!variant.modes.includes(state.mode)) {
        setMode(variant.modes[0]);
    }
    buildModeSwitch();
    populateVariantPills();
    updateGameSelectIcons();
    populateLanguageFlags(); // may force a language fallback
    localStorage.setItem('selectedLanguage', state.language);
    updateLateFilterRow();
    updateMultisRow();
    updateSpritesRow();
    updateFactoryLevelRow();
    updateHallLevelTool();
    applyStaticTranslations();
    loadAndRender();
}

// Switching language keeps the current view (trainers, picked Pokémon,
// selected sets) and just re-renders it in the new language. Species are
// remembered by their English dex name; trainers by index (the per-language
// trainer files are parallel arrays).
function onLanguageChanged(code) {
    const snapshot = captureSelection();
    state.language = code;
    localStorage.setItem('selectedLanguage', code);
    populateLanguageFlags();
    populateVariantPills();  // re-localize facility pill labels (nameKey)
    updateGameSelectIcons(); // localized game names
    updateFactoryLevelRow(); // re-localize Lv50/Open labels
    updateHallLevelTool();   // re-localize Hall level-tool labels/tooltip
    applyStaticTranslations();
    loadAndRender().then(() => restoreSelection(snapshot));
}

function setTheme(code) {
    state.theme = THEMES.some(theme => theme.code === code) ? code : THEMES[0].code;
    localStorage.setItem('theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    updateThemeSwatches();
}

// Re-populate the trainer dropdowns for the active filter, keeping selected
// trainers that still pass and clearing the sides that don't.
function refreshTrainerFilterSelection() {
    for (let side = 1; side <= MAX_SIDES; side++) {
        populateTrainerDropdown(side, onTrainerSelected);
        populateQuoteDropdown(side, onTrainerSelected);
        const trainer = state.trainers[side];
        // Factory: the selected object is derived — resolve to its real record.
        const orig = trainer && (trainer.srcIndex != null
            ? state.data.trainers[trainer.srcIndex] : trainer);
        if (orig && trainerPool().includes(orig)) {
            syncTrainerDropdowns(side, orig);
        } else if (trainer) {
            state.trainers[side] = null;
            resetSlotsOfSide(side);
        }
    }
    // Browse menus list only late species when a late filter is on → refresh them.
    populatePokemonMenus(onMenuSelected);
    renderSpeciesLists(onSpeciesPicked);
    updateLayout();
}

// Toggling the late filter keeps selected trainers that pass and clears the rest.
function onLateFilterChanged(checked) {
    state.lateOnly = checked;
    localStorage.setItem('lateOnly', checked ? '1' : '');
    updateLateFilterRow();
    refreshTrainerFilterSelection();
}

// Battle Factory's two-threshold filter (21+ / 49+), mutually exclusive.
function onFactoryLateChanged(cutoff) {
    state.factoryLate = state.factoryLate === cutoff ? null : cutoff;
    updateLateFilterRow();
    refreshTrainerFilterSelection();
}

/* ---------- language-switch view preservation ---------- */

function speciesToEnglish(species) {
    return state.data.pokedex.find(p => p[state.language] === species)?.en ?? null;
}

function speciesFromEnglish(english) {
    return state.data.pokedex.find(p => p.en === english)?.[state.language] ?? null;
}

function captureSelection() {
    if (!state.data) return null;
    const snapshot = { trainerIndexes: {}, slots: {} };
    let any = false;
    for (let side = 1; side <= MAX_SIDES; side++) {
        if (state.trainers[side]) {
            // Factory derives a trainer object (not in state.data.trainers); it
            // carries srcIndex back to the real record.
            const tr = state.trainers[side];
            snapshot.trainerIndexes[side] = tr.srcIndex ?? state.data.trainers.indexOf(tr);
            any = true;
        }
    }
    // Capture picked Pokémon too — including browse mode (no trainer selected).
    for (let slot = 1; slot <= modeSlots(state.mode); slot++) {
        const species = $(`#pokemon-menu-${slot}`).val();
        if (species) {
            snapshot.slots[slot] = {
                species: speciesToEnglish(species),
                setNumber: state.activeSets[slot]?.setNumber ?? null,
            };
            any = true;
        }
    }
    return any ? snapshot : null;
}

function restoreSelection(snapshot) {
    if (!snapshot) return;
    for (const side of Object.keys(snapshot.trainerIndexes)) {
        const trainer = state.data.trainers[snapshot.trainerIndexes[side]];
        if (trainer) onTrainerSelected(Number(side), trainer);
    }
    for (const slot of Object.keys(snapshot.slots)) {
        const { species, setNumber } = snapshot.slots[slot];
        const translated = species && speciesFromEnglish(species);
        if (!translated) continue;
        $(`#pokemon-menu-${slot}`).val(translated).trigger('change.select2');
        onMenuSelected(Number(slot), translated);
        if (setNumber !== null) {
            // Open the saved set — but a single-set pool auto-opens already, so
            // only click when it isn't the open/selected row (else we'd toggle it shut).
            const row = document.querySelector(
                `#pokemon-sets-${slot} .set-row[data-set-number="${setNumber}"]`);
            if (row && !row.classList.contains('selected')) row.click();
        }
    }
}

/* ---------- data loading ---------- */

async function loadAndRender() {
    try {
        state.data = await loadVariantData(state.variant, state.language);
    } catch (error) {
        console.error('Error loading facility data:', error);
        return;
    }
    for (let side = 1; side <= MAX_SIDES; side++) {
        populateTrainerDropdown(side, onTrainerSelected);
        populateQuoteDropdown(side, onTrainerSelected);
    }
    resetSelections();
    // Browse mode: the Pokémon menus list every facility species until a
    // trainer is picked, so sets can be looked up with no trainer selected.
    populatePokemonMenus(onMenuSelected);
    if (state.variant.hall) {
        // Battle Hall: type/rank selectors instead of trainers; reapply the
        // current selection (kept across language switches).
        populateHallMenus();
        applyHallSelection();
    } else if (state.data.trainers.length === 1) {
        // Facilities with a single opponent (Restricted Sparring) auto-select it.
        onTrainerSelected(1, state.data.trainers[0]);
    }
}

/* ---------- trainer & pokémon selection ---------- */

function onTrainerSelected(side, trainer) {
    if (!trainer) return;
    // Battle Factory: the trainer's roster + IV aren't stored — they're generated
    // from the trainer's group (their index) and the Lv50/Open level.
    const derived = state.variant.factory
        ? factoryTrainer(trainer, state.data.trainers.indexOf(trainer))
        : trainer;
    state.trainers[side] = derived;
    syncTrainerDropdowns(side, trainer);   // sync with the ORIGINAL (carries the index)
    renderSpeciesLists(onSpeciesPicked);
    populatePokemonMenus(onMenuSelected);
    resetSlotsOfSide(side);
    updateLayout();
}

/* ---------- Battle Factory: generated rosters (group + level) ---------- */
// Trainers field a pool keyed by their GROUP (position in the trainer list) and
// the selected level (Lv50 / Open). The set pool is divided into 4 tiers
// (`tier` on each set: low/mid/high/legend). A trainer's group → which tier(s) +
// set number(s) + the IV. We derive a trainer-like object (roster/species/iv) so
// the normal pipeline (minisprites, menu, sets, per-side IV) works unchanged.

// trainer index (0-based) -> group 1..8
function factoryGroup(idx) {
    if (idx < 100) return 1;
    if (idx < 120) return 2;
    if (idx < 140) return 3;
    if (idx < 160) return 4;
    if (idx < 180) return 5;
    if (idx < 200) return 6;
    if (idx < 220) return 7;
    return 8;   // 220-299
}

// group -> { tiers, sets (null = any set number), iv }, per level.
const FACTORY_RULES = {
    lv50: {
        1: { tiers: ['low'],             sets: null, iv: 0 },
        2: { tiers: ['mid'],             sets: [1],  iv: 4 },
        3: { tiers: ['mid'],             sets: [2],  iv: 8 },
        4: { tiers: ['high'],            sets: [1],  iv: 12 },
        5: { tiers: ['high'],            sets: [2],  iv: 16 },
        6: { tiers: ['high'],            sets: [3],  iv: 20 },
        7: { tiers: ['high'],            sets: [4],  iv: 24 },
        8: { tiers: ['high', 'legend'],  sets: null, iv: 31 },
    },
    open: {
        1: { tiers: ['high'],            sets: [1],  iv: 0 },
        2: { tiers: ['high'],            sets: [2],  iv: 4 },
        3: { tiers: ['high'],            sets: [3],  iv: 8 },
        4: { tiers: ['high'],            sets: [4],  iv: 12 },
        5: { tiers: ['high', 'legend'],  sets: null, iv: 16 },
        6: { tiers: ['high', 'legend'],  sets: null, iv: 20 },
        7: { tiers: ['high', 'legend'],  sets: null, iv: 24 },
        8: { tiers: ['high', 'legend'],  sets: null, iv: 31 },
    },
};

function factoryRule(trainer, idx) {
    if (trainer.factoryBrain) {
        // Thorton. IV by battle (21 → 12, 49 → 31). Normal pool: battle 21 =
        // High/set1, battle 49 = High+Legendary/set4. BUG: Platinum AND (English
        // OR Japanese) — both battles use a LEVEL-keyed pool (Lv50: High/set1,
        // Open: High+Legendary/set4) regardless of battle.
        const iv = trainer.battle === 21 ? 12 : 31;
        const bugged = state.variant.version === 'pt'
            && (state.language === 'en' || state.language === 'jp');
        if (bugged) {
            return state.factoryOpen
                ? { tiers: ['high', 'legend'], sets: [4], iv }
                : { tiers: ['high'], sets: [1], iv };
        }
        return trainer.battle === 21
            ? { tiers: ['high'], sets: [1], iv }
            : { tiers: ['high', 'legend'], sets: [4], iv };
    }
    return FACTORY_RULES[state.factoryOpen ? 'open' : 'lv50'][factoryGroup(idx)];
}

function factoryTrainer(trainer, idx) {
    const { tiers, sets, iv } = factoryRule(trainer, idx);
    const pool = state.data.sets.filter(s =>
        tiers.includes(s.tier) && (sets === null || sets.includes(s.setNumber)));
    const species = [...new Set(pool.map(s => s.species))];
    // srcIndex lets captureSelection / late-filter find the real trainer record
    // (the derived object isn't in state.data.trainers).
    return { ...trainer, srcIndex: idx, iv,
             roster: pool.map(s => `${s.species}-${s.setNumber}`).join(', '),
             species: species.join(', ') };
}

// A mini-sprite was clicked: each list sits above one menu and fills exactly
// that slot.
function onSpeciesPicked(slot, species) {
    $(`#pokemon-menu-${slot}`).val(species).trigger('change.select2');
    onMenuSelected(slot, species);
}

function onMenuSelected(slot, species) {
    state.activeSets[slot] = null;
    showPokemonSets(slot, species);
    highlightSelectedSprites();
}

/* ---------- Battle Hall: type + rank selectors (no trainers) ---------- */
// The player faces a random Pokémon from a pool keyed by TYPE (primary OR
// secondary) and RANK (1-10 → which BST groups + the IV). We synthesize a
// trainer-like object (roster + iv) so the rest of the pipeline (minisprites,
// Pokémon menu, sets, IV) works unchanged. BST comes from pokedex-4's stats.

const HALL_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost',
    'dragon', 'dark', 'steel'];   // gen-4: no Fairy
// rank -> allowed BST groups. group: 1 (<340), 2 (340-439), 3 (440-499), 4 (>=500).
const HALL_RANK_GROUPS = { 1: [1], 2: [1], 3: [1, 2], 4: [1, 2], 5: [1, 2],
    6: [2, 3], 7: [2, 3], 8: [2, 3], 9: [3, 4], 10: [3, 4] };
const hallRankIV = rank => 6 + 2 * rank;      // R1=8 … R10=26
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const isArgenta = code => code === 'argenta50' || code === 'argenta170';

function bstGroup(p) {
    const bst = p.hp + p.atk + p.def + p.spa + p.spd + p.spe;
    return bst < 340 ? 1 : bst < 440 ? 2 : bst < 500 ? 3 : 4;
}

// Synthetic "trainer" (roster + iv) for the current Hall selection; null = browse.
function computeHallPool(typeCode, rank) {
    if (!typeCode) return null;
    const withSet = new Set(state.data.sets.map(s => s.species));   // localized names that have a Hall set
    let entries = state.data.pokedex.filter(p => withSet.has(p[state.language]));
    let iv = null, noMinisprites = false, name;
    if (typeCode === 'argenta50') {            // battle 50: whole pool (drawn vs the player's Pokémon)
        iv = 31; noMinisprites = true; name = 'Argenta (50)';
    } else if (typeCode === 'argenta170') {    // battle 170: any Group-4 species
        iv = 31; name = 'Argenta'; entries = entries.filter(p => bstGroup(p) === 4);
    } else {
        entries = entries.filter(p => p.type1 === typeCode || p.type2 === typeCode);
        if (rank) {
            const groups = HALL_RANK_GROUPS[rank];
            entries = entries.filter(p => groups.includes(bstGroup(p)));
            iv = hallRankIV(rank);
        }
        name = cap(typeCode) + (rank ? ` R${rank}` : '');
    }
    const species = entries.map(p => p[state.language]);
    return { name, class: '', roster: species.map(s => `${s}-1`).join(', '),
             species: species.join(', '), iv, noMinisprites };
}

function populateHallMenus() {
    const $type = $('#hall-type').empty();
    $type.append(new Option('', '', true, true));
    for (const tp of HALL_TYPES) {
        const o = new Option(t(`type-${tp}`, cap(tp)), tp, false, false);
        $(o).attr('data-icons', `assets/images/types/${tp}.png`);
        $type.append(o);
    }
    const argenta = t('hall-argenta', 'Argenta');
    const aSprite = 'assets/images/gen4trainers/argenta.png';
    const a50 = new Option(`${argenta} (50)`, 'argenta50', false, false);
    const a170 = new Option(argenta, 'argenta170', false, false);
    $(a50).attr('data-icons', aSprite);
    $(a170).attr('data-icons', aSprite);
    $type.append(a50);
    $type.append(a170);
    if (state.hallType) $type.val(state.hallType);
    initSelect2('#hall-type', { placeholder: t('hallType', 'Type'), template: iconTemplate,
                                containerClass: 'select2-container--trainer select2-container--hall-type' });
    $type.off('select2:select').on('select2:select', e => onHallTypeChanged(e.params.data.id));
    buildHallRankMenu();
}

function buildHallRankMenu() {
    const $rank = $('#hall-rank').empty();
    $rank.append(new Option('', '', true, true));
    for (let n = 1; n <= 10; n++) {
        $rank.append(new Option(`${t('hallRank', 'Rank')} ${n}`, String(n), false, false));
    }
    if (state.hallRank) $rank.val(String(state.hallRank));
    $rank.prop('disabled', isArgenta(state.hallType));   // Argenta ignores rank
    initSelect2('#hall-rank', { placeholder: t('hallRank', 'Rank'), search: false,
                                containerClass: 'select2-container--trainer' });
    $rank.off('select2:select').on('select2:select', e => onHallRankChanged(e.params.data.id));
}

function onHallTypeChanged(typeCode) {
    state.hallType = typeCode || null;
    if (isArgenta(typeCode)) state.hallRank = null;
    buildHallRankMenu();          // refresh value + enabled/disabled
    applyHallSelection();
}

function onHallRankChanged(rank) {
    state.hallRank = rank ? Number(rank) : null;
    applyHallSelection();
}

// Apply the current (type, rank) selection: build the synthetic pool and render
// it through the normal slot pipeline.
function applyHallSelection() {
    state.trainers = { 1: computeHallPool(state.hallType, state.hallRank), 2: null };
    renderSpeciesLists(onSpeciesPicked);
    populatePokemonMenus(onMenuSelected);
    resetSlotsOfSide(1);
    updateLayout();
}

/* ---------- Battle Hall: faced-level calculator (replaces the quote menu) ---------- */
// Two inputs (player level + # types at rank 2+) feed speed.js hallFacedLevel();
// changing them re-renders the open sets so the level + speeds update live.
function updateHallLevelTool() {
    if (!state.variant.hall) return;
    document.getElementById('hall-level-label').textContent = t('hallLevelLabel', 'Level');
    document.getElementById('hall-rank2-label').textContent = t('hallRank2Label', '# rank 2+');
    document.getElementById('hall-rank2-info').title =
        t('hallRank2Info', 'Number of types where you have cleared rank 1');
    const lvl = document.getElementById('hall-player-level');
    const r2 = document.getElementById('hall-rank2');
    lvl.value = state.hallLevel ?? '';
    r2.value = state.hallRank2 ?? '';
    lvl.placeholder = t('hallLevelLabel', 'Level');
}

function rerenderOpenSets() {
    for (let slot = 1; slot <= modeSlots(state.mode); slot++) {
        const sp = $(`#pokemon-menu-${slot}`).val();
        if (sp) onMenuSelected(slot, sp);   // rebuilds rows (single-set auto-opens)
    }
}

const clampInt = (raw, lo, hi) => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

// Live update while typing (clamp for the calc, but don't fight the field), then
// write the clamped value back on commit (blur/enter); empty → the default.
function onHallLevelInput(raw, commit) {
    const n = clampInt(raw, 30, 100);
    if (n !== null) state.hallLevel = n;
    if (commit) {
        if (n === null) state.hallLevel = 100;
        document.getElementById('hall-player-level').value = state.hallLevel;
    }
    localStorage.setItem('hallLevel', state.hallLevel);
    rerenderOpenSets();
}

function onHallRank2Input(raw, commit) {
    const n = clampInt(raw, 0, 17);
    if (n !== null) state.hallRank2 = n;
    if (commit) {
        if (n === null) state.hallRank2 = 0;
        document.getElementById('hall-rank2').value = state.hallRank2;
    }
    localStorage.setItem('hallRank2', state.hallRank2);
    rerenderOpenSets();
}

/* ---------- mode (singles/doubles/multis/triples/rotation) ---------- */

function setMode(mode) {
    const previous = state.mode;
    state.mode = state.variant.modes.includes(mode) ? mode : state.variant.modes[0];
    localStorage.setItem('mode', state.mode);

    document.body.className = document.body.className
        .replace(/\b\w+-mode\b/g, '').trim();
    document.body.classList.add(`${state.mode}-mode`);

    // Crossing between 1-trainer and 2-trainer modes changes slot ownership
    // and where the species lists live: rebuild those (trainers are kept).
    if (MODES[previous]?.sides !== MODES[state.mode].sides && state.data) {
        if (MODES[state.mode].sides === 1 && state.trainers[2]) {
            state.trainers[2] = null; // side 2 disappears outside multis
            syncTrainerDropdowns(2, null);
        }
        refreshSidePlaceholders();
        renderSpeciesLists(onSpeciesPicked);
        populatePokemonMenus(onMenuSelected);
        resetPokemonUI();
    }

    updateModeSwitch();
    updateMultisRow();
    updateLayout();
}

// Multi-position slider switch under the big mode glyph (see styles.css).
function buildModeSwitch() {
    const control = document.getElementById('mode-control');
    const sw = document.getElementById('mode-switch');
    sw.innerHTML = '';
    control.style.display = state.variant.modes.length > 1 ? '' : 'none';

    const knob = document.createElement('div');
    knob.id = 'mode-knob';
    sw.appendChild(knob);

    for (const mode of state.variant.modes) {
        const cell = document.createElement('button');
        cell.className = 'mode-cell';
        cell.dataset.mode = mode;
        cell.title = mode;
        // Clicking the knob's position advances to the next mode (toggle
        // feel); clicking any other notch jumps straight to that mode.
        cell.addEventListener('click', () => {
            if (mode === state.mode) {
                cycleMode();
            } else {
                setMode(mode);
            }
        });
        sw.appendChild(cell);
    }
    updateModeSwitch();
}

function cycleMode() {
    const modes = state.variant.modes;
    setMode(modes[(modes.indexOf(state.mode) + 1) % modes.length]);
}

function updateModeSwitch() {
    const knob = document.getElementById('mode-knob');
    if (!knob) return;
    const index = state.variant.modes.indexOf(state.mode);
    knob.style.transform = `translateX(${index * 100}%)`;
    document.getElementById('mode-glyph').textContent = MODES[state.mode].icon;
    document.querySelectorAll('.mode-cell').forEach(cell => {
        cell.classList.toggle('active', cell.dataset.mode === state.mode);
    });
}

/* ---------- modal ---------- */

function openSettings() {
    // Lazy-load theme sprite images on first open to avoid competing with
    // critical data fetches at page load.
    document.querySelectorAll('#theme-swatches img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
    });
    document.getElementById('settings-modal').style.display = 'block';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

/* ---------- init ---------- */

async function init() {
    try {
        state.translations = await loadTranslations();
    } catch (error) {
        console.error('Error loading translations:', error);
    }

    // Restore saved settings, validated against the current config.
    // ('selectedFacility' is the pre-variant legacy key.)
    const savedGame = localStorage.getItem('selectedGame')
        || localStorage.getItem('selectedFacility');
    state.game = getGame(savedGame);
    state.variant = getVariant(state.game, localStorage.getItem('selectedVariant'));

    const savedLanguage = localStorage.getItem('selectedLanguage');
    state.language = state.variant.languages.includes(savedLanguage)
        ? savedLanguage
        : state.variant.languages[0];

    state.lateOnly = localStorage.getItem('lateOnly') === '1';
    state.factoryOpen = localStorage.getItem('factoryOpen') === '1'; // Factory: Lv50 default
    const hl = parseInt(localStorage.getItem('hallLevel'), 10);
    state.hallLevel = Number.isFinite(hl) ? Math.min(100, Math.max(30, hl)) : 100;  // default 100
    const hr2 = parseInt(localStorage.getItem('hallRank2'), 10);
    state.hallRank2 = Number.isFinite(hr2) ? Math.min(17, Math.max(0, hr2)) : 0;    // default 0
    state.spritesOn = localStorage.getItem('minisprites') !== ''; // default on
    setTheme(localStorage.getItem('theme') || THEMES[0].code);

    buildSlotContainers();

    // Mobile has no mode switch: singles by default, multis via settings.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const savedMode = localStorage.getItem('mode');
    const mobileOk = mode => !isMobile || ['singles', 'multis'].includes(mode);
    buildModeSwitch();
    setMode(state.variant.modes.includes(savedMode) && mobileOk(savedMode)
        ? savedMode
        : state.variant.modes[0]);

    populateGameSelect();
    populateVariantPills();
    populateLanguageFlags();
    populateThemeSwatches();
    updateLateFilterRow();
    updateMultisRow();
    updateSpritesRow();
    updateFactoryLevelRow();
    updateHallLevelTool();
    applyStaticTranslations();

    // Event wiring.
    // Select2 fires jQuery 'change' events (not native ones), so bind via jQuery.
    $('#game-select').on('change', e => onGameChanged(e.target.value));
    // (variant pills and language flags bind their own click handlers)
    document.getElementById('late-filter').addEventListener('click', () => onLateFilterChanged(!state.lateOnly));
    document.getElementById('factory-late-21').addEventListener('click', () => onFactoryLateChanged(21));
    document.getElementById('factory-late-49').addEventListener('click', () => onFactoryLateChanged(49));
    document.getElementById('multis-toggle').addEventListener('click',
        () => setMode(state.mode === 'multis' ? 'singles' : 'multis'));
    document.getElementById('sprites-toggle').addEventListener('click', onSpritesToggled);
    document.querySelectorAll('#factory-level .factory-level-opt').forEach(opt =>
        opt.addEventListener('click', () => onFactoryLevelChanged(opt.dataset.open === '1')));
    const lvlEl = document.getElementById('hall-player-level');
    lvlEl.addEventListener('input', e => onHallLevelInput(e.target.value, false));
    lvlEl.addEventListener('change', e => onHallLevelInput(e.target.value, true));
    const r2El = document.getElementById('hall-rank2');
    r2El.addEventListener('input', e => onHallRank2Input(e.target.value, false));
    r2El.addEventListener('change', e => onHallRank2Input(e.target.value, true));
    document.getElementById('mode-glyph').addEventListener('click', cycleMode);
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('reset-btn').addEventListener('click', () => {
        resetSelections();
        populatePokemonMenus(onMenuSelected);  // back to browsing all species
        if (state.variant.hall) {              // also clear the Hall type/rank selection
            state.hallType = null;
            state.hallRank = null;
            populateHallMenus();
            applyHallSelection();
        }
    });
    document.querySelector('#settings-modal .close').addEventListener('click', closeSettings);
    document.getElementById('settings-modal').addEventListener('click', e => {
        if (e.target.id === 'settings-modal') closeSettings(); // click on backdrop
    });

    // Close any open select2 dropdown when clicking elsewhere on the page.
    $(document).on('click', event => {
        if (!$(event.target).closest('.select2-container').length) {
            $('select.select2-hidden-accessible').select2('close');
        }
    });

    await loadAndRender();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
