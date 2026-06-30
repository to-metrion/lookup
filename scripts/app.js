// Application entry point: initialization, settings and event wiring.

import { GAMES, MODES, THEMES, LANGUAGE_NAMES, MAX_SIDES, DATA_VERSION,
         getGame, getVariant, defaultVariant, modeSlots,
         gameVersions, facilitiesForVersion, variantForVersionFacility } from './config.js';
import { loadWarnings, getWarnings, addWarning, removeWarning,
         TIERS, TIER_SYMBOL, CATEGORIES, warnClass } from './warnings.js';
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
    populatePyramidWildFilter, syncPyramidWildFilter,
    renderBdspTrainer, isDuoDoubles, resetDuoSelection, positionSwap,
    populateReverseLookup, selectDuo,
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
    // `.version-row` keeps the larger rounded-pill style for the version axis
    // (two-axis games) AND single-axis games whose variant row picks a game version
    // (Tree SM/USUM, Maison XY/ORAS — `versionPills`). Facility rows (SwSh Tower/RS,
    // the gen-3/4 facility row) use the segmented toggle.
    pills.classList.toggle('version-row', versions.length > 0 || Boolean(state.game.versionPills));
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
        // Always show the version row for versioned games — even with a single
        // version (gen-3 = Emerald only for now), so the axis is visible and
        // ready for more versions (Ruby/Sapphire). Mirrors the facility row.
        row.style.display = '';
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
    const p140 = document.getElementById('pyramid-140');
    if (state.variant.factory) {
        row.style.display = '';
        btn.style.display = 'none';
        f21.style.display = ''; f49.style.display = '';
        f21.classList.toggle('active', state.factoryLate === 21);
        f49.classList.toggle('active', state.factoryLate === 49);
        p140.style.display = 'none';
        return;
    }
    btn.style.display = ''; f21.style.display = 'none'; f49.style.display = 'none';
    // Pyramid wild: a 140+ toggle (wild IVs become 15-31) alongside the 50+ filter.
    p140.style.display = state.variant.pyramidWild ? '' : 'none';
    p140.classList.toggle('active', state.pyramid140);
    row.style.display = (state.variant.lateCutoff || state.variant.pyramidWild) ? '' : 'none';
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

// Collapse the whole "toggles" settings section (late filter / minisprites / 2v2) AND its
// preceding divider when the current variant exposes none of them — otherwise the menu
// shows an empty gap between two separators (e.g. BDSP, between language and warnings).
// Call AFTER the three row-update functions, which set each row's visibility.
function updateSettingsToggles() {
    const toggles = document.getElementById('settings-toggles');
    const anyVisible = [...toggles.children]
        .some(row => getComputedStyle(row).display !== 'none');
    toggles.style.display = anyVisible ? '' : 'none';
    const divider = toggles.previousElementSibling;   // the <hr> just above the section
    if (divider && divider.classList.contains('settings-divider'))
        divider.style.display = anyVisible ? '' : 'none';
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
    // gen-4/gen-3 Factory + RS Tower all use this flat 2-position level toggle.
    const show = state.variant.factory || state.variant.factory3 || state.variant.rsTower;
    row.style.display = show ? '' : 'none';
    if (!show) return;
    const opts = row.querySelectorAll('.factory-level-opt');
    opts[0].textContent = t('factory-lv50', 'Level 50');
    // RS labels its 2nd option "Level 100"; Factory uses "Open Level".
    opts[1].textContent = t(state.variant.openLabel ?? 'factory-open', 'Open Level');
    opts[0].classList.toggle('active', !state.factoryOpen);
    opts[1].classList.toggle('active', state.factoryOpen);
}

// Info (ⓘ) icons show their text via a CSS tooltip on hover/focus (desktop) and on
// tap (mobile, where there's no hover) — the tap toggles `.info-open` (see init).
// The message lives in data-tip (not title, which has no mobile tap behavior and
// would double up with the CSS bubble); aria-label mirrors it for screen readers.
function setInfoTip(el, text) {
    el.dataset.tip = text;
    el.setAttribute('aria-label', text);
    el.removeAttribute('title');
}

// Gen-3 Factory: the "Current Tower streak" input (settings) — a glitch links the
// opponents' IVs to the player's current Battle Tower streak. Shown only for the
// gen-3 Factory; the (i) tooltip explains what it controls.
function updateFactoryStreakRow() {
    const row = document.getElementById('factory-streak-row');
    const show = Boolean(state.variant.factory3);
    row.style.display = show ? '' : 'none';
    if (!show) return;
    document.getElementById('factory-streak-label').textContent =
        t('factoryStreakLabel', 'Current Tower streak');
    setInfoTip(document.getElementById('factory-streak-info'),
        t('factoryStreakInfo', 'A glitch ties the opponents’ IVs to your current Battle Tower win streak.'));
    document.getElementById('factory-streak').value = state.factoryStreak ?? 0;
}

// Streak only changes the battle arrays' IVs (and thus the speed) → re-derive +
// re-render the current selection (same pattern as the level toggle).
function onFactoryStreakInput(raw, commit) {
    const n = clampInt(raw, 0, 9999);
    if (n !== null) state.factoryStreak = n;
    if (commit) {
        if (n === null) state.factoryStreak = 0;
        document.getElementById('factory-streak').value = state.factoryStreak;
    }
    localStorage.setItem('factoryStreak', state.factoryStreak);
    restoreSelection(captureSelection());
}

function onFactoryLevelChanged(open) {
    if (open === state.factoryOpen) return;
    state.factoryOpen = open;
    localStorage.setItem('factoryOpen', open ? '1' : '');
    updateFactoryLevelRow();
    // Level drives the generated rosters, IVs/speed AND (RS) which mon pool is shown →
    // re-derive the selection and refresh browse menus + species lists.
    const snapshot = captureSelection();
    populatePokemonMenus(onMenuSelected);
    renderSpeciesLists(onSpeciesPicked);
    restoreSelection(snapshot);
    highlightSelectedSprites();
}

// Gen-3 Tower Lv 50 / Open Level toggle + the Open-Level level input (settings).
// Open Level opponents match the player's strongest Pokémon (60-100).
function updateOpenLevelRow() {
    const row = document.getElementById('open-level-row');
    row.style.display = state.variant.openLevel ? '' : 'none';
    if (!state.variant.openLevel) return;
    const opts = row.querySelectorAll('.open-level-opt');
    opts[0].textContent = t('factory-lv50', 'Level 50');
    opts[1].textContent = t('factory-open', 'Open Level');
    opts[0].classList.toggle('active', !state.openMode);
    opts[1].classList.toggle('active', state.openMode);
    document.getElementById('open-level-label').textContent = t('hallLevelLabel', 'Level');
    document.getElementById('open-level-input-wrap').style.display = state.openMode ? '' : 'none';
    const input = document.getElementById('open-level-value');
    input.value = state.openLevelValue ?? '';
    input.placeholder = t('hallLevelLabel', 'Level');
}

// External helper-tool links for the selected facility (settings, under the level
// rows) — e.g. the Battle Dome Assistant. Hidden when the variant has none.
function updateFacilityLinks() {
    const row = document.getElementById('facility-links');
    const links = state.variant.links || [];
    row.innerHTML = '';
    row.style.display = links.length ? '' : 'none';
    for (const link of links) {
        const a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'facility-link';
        a.textContent = link.text;
        row.appendChild(a);
    }
}

// Lv 50 ↔ Open changes the high-tier filter (which species/sets show), the speed
// level, and (in browse) the species menu — refresh menus + lists, then restore.
function onOpenLevelModeChanged(open) {
    if (open === state.openMode) return;
    state.openMode = open;
    localStorage.setItem('openMode', open ? '1' : '');
    updateOpenLevelRow();
    const snapshot = captureSelection();
    populatePokemonMenus(onMenuSelected);
    renderSpeciesLists(onSpeciesPicked);
    restoreSelection(snapshot);
    highlightSelectedSprites();
}

// Only the speed numbers change with the level value → re-render the open sets.
function onOpenLevelInput(raw, commit) {
    const n = clampInt(raw, 60, 100);
    if (n !== null) state.openLevelValue = n;
    if (commit) {
        if (n === null) state.openLevelValue = 100;
        document.getElementById('open-level-value').value = state.openLevelValue;
    }
    localStorage.setItem('openLevelValue', state.openLevelValue);
    rerenderOpenSets();
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
    state.pyramidRound = null; // fresh Pyramid wild filter per variant
    state.pyramidFloor = null;
    localStorage.setItem('selectedGame', state.game.code);
    localStorage.setItem('selectedVariant', variant.code);

    // Most variants keep the current mode if it's valid; a variant may declare a
    // `defaultMode` to force on entry (Pike → Doubles, since runs stay in one view).
    // On mobile only singles/multis are reachable (Doubles has no control there) UNLESS
    // the variant is a team view (BDSP exposes its Doubles via the slider) — so a mode
    // that isn't reachable on mobile (e.g. leaving BDSP Doubles for another game) must be
    // reset, not kept, or the tool gets stuck in an unselectable mode.
    const onMobile = window.matchMedia('(max-width: 768px)').matches;
    const mobileOk = m => !onMobile || variant.teamView || ['singles', 'multis'].includes(m);
    const forced = variant.defaultMode && variant.modes.includes(variant.defaultMode)
        && mobileOk(variant.defaultMode) ? variant.defaultMode : null;
    // reload=false: applyVariant calls loadAndRender itself at the end.
    if (forced) {
        setMode(forced, false);
    } else if (!variant.modes.includes(state.mode) || !mobileOk(state.mode)) {
        setMode(variant.modes.find(mobileOk) || variant.modes[0], false);
    }
    buildModeSwitch();
    populateVariantPills();
    updateGameSelectIcons();
    populateLanguageFlags(); // may force a language fallback
    localStorage.setItem('selectedLanguage', state.language);
    updateLateFilterRow();
    updateMultisRow();
    updateSpritesRow();
    updateSettingsToggles();
    updateFactoryLevelRow();
    updateFactoryStreakRow();
    updateOpenLevelRow();
    updateFacilityLinks();
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
    updateFactoryStreakRow(); // re-localize the streak label/tooltip
    updateOpenLevelRow();    // re-localize gen-3 Lv50/Open labels
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

// Swap the two columns: in doubles, swap the two slots' picked Pokémon; in multis,
// swap the two trainers (and their picks) wholesale. Reuses capture/restore with
// the two sides exchanged in the snapshot.
function swapSides() {
    if (!state.data) return;
    const snapshot = captureSelection();
    if (!snapshot) return;
    const swap = obj => {
        const a = obj[1], b = obj[2];
        if (b === undefined) delete obj[1]; else obj[1] = b;
        if (a === undefined) delete obj[2]; else obj[2] = a;
    };
    if (MODES[state.mode].sides > 1) {       // multis: exchange the trainers too
        swap(snapshot.trainerIndexes);
        for (let side = 1; side <= MAX_SIDES; side++) {
            state.trainers[side] = null;
            syncTrainerDropdowns(side, null);
        }
    }
    swap(snapshot.slots);                     // both modes: exchange the two columns' picks
    resetPokemonUI();
    restoreSelection(snapshot);
    highlightSelectedSprites();
}

/* ---------- data loading ---------- */

// BDSP singles/doubles are separate datasets — resolve the variant's dataDir for
// the current mode (other variants are returned unchanged).
function effectiveVariant() {
    const v = state.variant;
    const dir = v.modeDataDirs && v.modeDataDirs[state.mode];
    if (!dir) return v;
    const ev = { ...v, dataDir: dir };
    // Master Doubles is STANDALONE (duo records can't go through the name+sprite delta
    // merge — it would collapse duos sharing a first trainer).
    if (v.duoDoubles && state.mode === 'doubles') ev.base = undefined;
    return ev;
}

async function loadAndRender() {
    const variant = effectiveVariant();
    try {
        state.data = await loadVariantData(variant, state.language);
        state.loadedDataDir = variant.dataDir;
    } catch (error) {
        console.error('Error loading facility data:', error);
        return;
    }
    // BDSP Master Doubles (duos): the two trainer/quote menus pick whole duos /
    // individuals with partner filtering — its own population path.
    if (isDuoDoubles()) {
        state.trainers = { 1: null, 2: null };
        resetDuoSelection();
        updateLayout();
        return;
    }
    for (let side = 1; side <= MAX_SIDES; side++) {
        populateTrainerDropdown(side, onTrainerSelected);
        populateQuoteDropdown(side, onTrainerSelected);
    }
    resetSelections();
    // Browse mode: the Pokémon menus list every facility species until a
    // trainer is picked, so sets can be looked up with no trainer selected.
    // BDSP team view has no browse menus (pick a trainer to see their teams) —
    // clear any slot menus left over from the previous game.
    if (!state.variant.teamView) {
        populatePokemonMenus(onMenuSelected);
        // resetSelections() above positioned the doubles swap button before these
        // menus existed; re-anchor it now they do (esp. when arriving from BDSP's
        // team view, whose grid layout doesn't trigger the menus' resize observer).
        positionSwap();
    } else {
        for (let slot = 1; slot <= 3; slot++) $(`#pokemon-menu-${slot}`).empty();
    }
    if (state.variant.pyramidWild) {
        // Battle Pyramid: build the wild round/floor filter (shown once the "Wild
        // Pokémon" entry is selected).
        populatePyramidWildFilter(onPyramidFilterChanged);
    }
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
        : state.variant.factory3
        ? factory3Trainer(trainer, state.data.trainers.indexOf(trainer))
        : (state.variant.pyramidWild && trainer.wild)
        ? pyramidWildTrainer(trainer)
        : state.variant.rsTower
        ? rsTowerTrainer(trainer)
        : trainer;
    state.trainers[side] = derived;
    syncTrainerDropdowns(side, trainer);   // sync with the ORIGINAL (carries the index)
    // BDSP team view: render the trainer's teams (preview rows / side-by-side
    // details) instead of the minisprite/menu/set-table flow.
    if (state.variant.teamView) {
        updateLayout();
        renderBdspTrainer(derived);
        return;
    }
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

/* ---------- gen-3 Battle Factory: battle-array rosters (tier group × level) ---------- */
// The gen-3 Factory's "trainers" are 8 battle-number ARRAYS + Noland ×2 (carrying
// `factoryRule`). Each draws from tier groups (`tier` on each set: low1/low2/mid1/
// mid2/high1-4/legend, in set-data order) that depend on the level (Lv50 / Open).
// Group keys: a plain tier; 'mid1<=Furret-1' = mid1 up to & incl Furret-1; 'HL_ALL'
// = high1-4 + legend (all); 'HL_NOHT' = the same minus the high-tier (Open-only) sets.
const FACTORY3_RULES = {
    b1:  { lv50: ['low2', 'mid1<=Furret-1'], open: ['high1'] },
    b8:  { lv50: ['mid1'],    open: ['high2'] },
    b15: { lv50: ['mid2'],    open: ['high3'] },
    b22: { lv50: ['high1'],   open: ['high4'] },
    b29: { lv50: ['high2'],   open: ['HL_ALL'] },
    b36: { lv50: ['high3'],   open: ['HL_ALL'] },
    b43: { lv50: ['high4'],   open: ['HL_ALL'] },
    b50: { lv50: ['HL_NOHT'], open: ['HL_ALL'] },
    noland21: { lv50: ['mid2'],  open: ['high3'] },
    noland42: { lv50: ['high3'], open: ['HL_ALL'] },
};
const FACTORY3_HL_TIERS = ['high1', 'high2', 'high3', 'high4', 'legend'];

// The battle arrays' IVs are linked to the player's current Battle TOWER streak (a
// known glitch). Default streak 0 → IV 3. (Noland uses his own fixed IV instead.)
function factory3StreakIV(streak) {
    const s = streak || 0;
    if (s <= 6) return 3;
    if (s <= 13) return 6;
    if (s <= 20) return 9;
    if (s <= 27) return 12;
    if (s <= 34) return 15;
    if (s <= 41) return 21;
    return 31;
}

function factory3Pool(groups) {
    const sets = state.data.sets;
    const out = [];
    for (const g of groups) {
        if (g === 'HL_ALL' || g === 'HL_NOHT') {
            for (const s of sets)
                if (FACTORY3_HL_TIERS.includes(s.tier) && (g === 'HL_ALL' || !s.highTier))
                    out.push(s);
        } else if (g.includes('<=')) {
            const [tier, last] = g.split('<=');
            let stop = false;
            for (const s of sets) {
                if (s.tier !== tier || stop) continue;
                out.push(s);
                if (`${s.species}-${s.setNumber}` === last) stop = true;
            }
        } else {
            for (const s of sets) if (s.tier === g) out.push(s);
        }
    }
    return out;
}

function factory3Trainer(trainer, idx) {
    const rule = FACTORY3_RULES[trainer.factoryRule];
    const pool = factory3Pool(state.factoryOpen ? rule.open : rule.lv50);
    const iv = trainer.streakIV ? factory3StreakIV(state.factoryStreak) : trainer.iv;
    const species = [...new Set(pool.map(s => s.species))];
    return { ...trainer, srcIndex: idx, iv,
             roster: pool.map(s => `${s.species}-${s.setNumber}`).join(', '),
             species: species.join(', ') };
}

/* ---------- RS Battle Tower: Lv50 / Lv100 mon pools ---------- */
// The trainer's possible roster is precomputed per level (roster = Lv50, rosterOpen
// = Lv100); the level toggle (factoryOpen) picks which, plus the matching pool's sets.
function rsTowerTrainer(trainer) {
    const open = state.factoryOpen;
    return { ...trainer, srcIndex: state.data.trainers.indexOf(trainer),
             roster: open ? trainer.rosterOpen : trainer.roster,
             species: open ? trainer.speciesOpen : trainer.species };
}

/* ---------- gen-3 Pyramid: wild-Pokémon round/floor filter ---------- */
// The "Wild Pokémon" entry derives its roster from the round/floor filter: all wild
// sets whose round matches (if a round is picked) and whose floors include the picked
// floor. No round/floor → the whole wild pool. srcIndex points back at the stored
// "Wild Pokémon" record (for captureSelection / language switches).
function pyramidWildTrainer(base) {
    const round = state.pyramidRound, floor = state.pyramidFloor;
    const pool = state.data.sets.filter(s => s.wild
        && (round == null || s.round === round)
        && (floor == null || (s.floors || []).includes(floor)));
    const species = [...new Set(pool.map(s => s.species))];
    return { ...base, srcIndex: state.data.trainers.indexOf(base),
             roster: pool.map(s => `${s.species}-${s.setNumber}`).join(', '),
             species: species.join(', ') };
}

// Quote/Round menus both set the round (they mirror each other); Floor sets the floor.
// Re-derive the wild roster + re-render if the Wild entry is currently selected.
function onPyramidFilterChanged(kind, idRaw) {
    const id = idRaw ? Number(idRaw) : null;
    if (kind === 'round') {
        state.pyramidRound = id;
        state.pyramidFloor = null;   // changing round = entering a new round → reset Floor to All
    } else {
        state.pyramidFloor = id;
    }
    syncPyramidWildFilter();
    const wildBase = state.data.trainers.find(tr => tr.wild);
    if (wildBase && state.trainers[1]?.wild) onTrainerSelected(1, wildBase);
}

// Floor 140+ toggle: wild IVs become 15-31 (else 0-31) → only the speed ranges change.
function onPyramid140Changed() {
    state.pyramid140 = !state.pyramid140;
    localStorage.setItem('pyramid140', state.pyramid140 ? '1' : '');
    updateLateFilterRow();
    restoreSelection(captureSelection());
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
    setInfoTip(document.getElementById('hall-rank2-info'),
        t('hallRank2Info', 'Number of types where you have cleared rank 1'));
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

// `reload` is false during applyVariant/init (which load data themselves); a
// user-driven mode switch keeps it true so BDSP can swap its singles/doubles
// dataset (they have different trainers) when the mode changes.
function setMode(mode, reload = true) {
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
    updateSettingsToggles();
    updateLayout();

    // BDSP: switching singles ↔ doubles changes the dataset (different trainers) →
    // reload when the resolved dataDir differs from what's currently loaded.
    if (reload && state.data && state.variant.modeDataDirs) {
        const want = state.variant.modeDataDirs[state.mode];
        if (want && want !== state.loadedDataDir) loadAndRender();
    }
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

/* ---------- reverse lookup (find the trainer from the Pokémon seen) ---------- */

function openReverseLookup() {
    // Show before populating so select2 measures the menus at their real width.
    document.getElementById('reverse-lookup-modal').style.display = 'block';
    populateReverseLookup(loadReverseResult);
}

function closeReverseLookup() {
    document.getElementById('reverse-lookup-modal').style.display = 'none';
}

// Clicking a result row loads that trainer/duo into the main tool.
function loadReverseResult(match) {
    // BDSP (team model): load the trainer/duo and open the matched team's row.
    if (state.variant.teamView) {
        closeReverseLookup();
        if (isDuoDoubles()) selectDuo(match.trainer);
        else onTrainerSelected(1, match.trainer);
        const openRow = () => {
            const row = document.querySelector(`#team-rows .team-row[data-team="${match.teamIndex}"]`);
            if (row && !row.classList.contains('selected')) row.click();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(openRow);
        else openRow();
        return;
    }
    // Roster model: load the trainer into its side. MULTIS picks two opponents (left →
    // slot 1, right → slot 2), so keep the modal OPEN to fill both; otherwise close.
    onTrainerSelected(match.side || 1, match.trainer);
    if (state.mode !== 'multis') closeReverseLookup();
}

/* ---------- warning system (settings sub-modal) ---------- */
// Warnings are stored canonically in English (warnings.js). The "add" picker lists every
// ENCOUNTERABLE Pokémon/item/move/ability across all games (drawn from the sets — see
// build_warning_vocab.py), localized, from warning-vocab.json (loaded lazily on first
// open). Each tier section shows its warnings as chips + a +.

const VOCAB_KEY = { pokemon: 'pokemon', item: 'items', move: 'moves', ability: 'abilities' };
let warningVocab = null;     // raw warning-vocab.json
let vocabIndex = null;       // { category: Map(en -> entry) }

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function ensureWarningVocab() {
    if (warningVocab) return;
    const res = await fetch(`data/warning-vocab.json?v=${DATA_VERSION}`);
    warningVocab = await res.json();
    vocabIndex = {};
    for (const cat of CATEGORIES) {
        const map = new Map();
        for (const entry of warningVocab[VOCAB_KEY[cat]] || []) map.set(entry.en, entry);
        vocabIndex[cat] = map;
    }
}

// Localized display name for a stored (English) warning; English fallback.
function localizedWarningName(category, en) {
    const entry = vocabIndex?.[category]?.get(en);
    return entry ? (entry[state.language] || entry.en) : en;
}

// Combined, grouped, localized <option> list for the add menu (cached per language).
let vocabOptionsHtml = null, vocabOptionsLang = null;
function buildVocabOptions() {
    if (vocabOptionsHtml && vocabOptionsLang === state.language) return vocabOptionsHtml;
    const groups = [
        ['pokemon', t('warnCatPokemon', 'Pokémon')],
        ['item', t('warnCatItem', 'Items')],
        ['move', t('warnCatMove', 'Moves')],
        ['ability', t('warnCatAbility', 'Abilities')],
    ];
    let html = '<option value=""></option>';
    for (const [cat, label] of groups) {
        html += `<optgroup label="${escapeHtml(label)}">`;
        const entries = [...vocabIndex[cat].values()]
            .map(e => ({ en: e.en, name: e[state.language] || e.en }))
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const e of entries)
            html += `<option value="${escapeHtml(cat + '|' + e.en)}">${escapeHtml(e.name)}</option>`;
        html += '</optgroup>';
    }
    vocabOptionsHtml = html;
    vocabOptionsLang = state.language;
    return html;
}

function makeWarnChip(tier, category, en) {
    const chip = document.createElement('span');
    chip.className = `warn-chip ${warnClass(tier)}`;
    chip.append(document.createTextNode(localizedWarningName(category, en)));
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'warn-chip-x';
    x.textContent = '×';
    x.title = t('warnRemove', 'Remove');
    x.addEventListener('click', () => {
        removeWarning(tier, category, en);
        onWarningsChanged();
        renderWarningSections();
    });
    chip.appendChild(x);
    return chip;
}

// Replace the + with a transient, searchable combined menu; a pick adds the warning,
// closing it without a pick restores the +.
function openWarnAddMenu(tier, chipsEl, addBtn) {
    addBtn.style.display = 'none';
    const select = document.createElement('select');
    select.className = 'warn-add-select';
    select.innerHTML = buildVocabOptions();
    chipsEl.insertBefore(select, addBtn);
    const $select = $(select);
    $select.select2({
        width: '230px',
        minimumInputLength: 2,   // only search after 2 chars — keeps the big list fast
        placeholder: t('warnAddSearch', 'Search…'),
        dropdownParent: $('#warnings-modal'),
        // Localize select2's built-in "Please enter N or more characters" hint.
        language: {
            inputTooShort: args =>
                t('warnSearchHint', 'Please enter 2 or more characters')
                    .replace('{n}', args.minimum),
        },
    });
    let picked = false;
    $select.on('select2:select', event => {
        picked = true;
        const sep = event.params.data.id.indexOf('|');
        addWarning(tier, event.params.data.id.slice(0, sep), event.params.data.id.slice(sep + 1));
        onWarningsChanged();
        renderWarningSections();   // rebuilds the section (removing this transient menu)
    });
    $select.on('select2:close', () => {
        if (picked) return;        // a pick already rebuilt the section
        setTimeout(() => {
            $select.select2('destroy');
            select.remove();
            addBtn.style.display = '';
        }, 0);
    });
    // Auto-focus the search field so the user can type immediately (no extra click).
    $select.on('select2:open', () => {
        setTimeout(() => document.querySelector('.select2-dropdown .select2-search__field')?.focus(), 0);
    });
    $select.select2('open');
}

function renderWarningSections() {
    const host = document.getElementById('warnings-sections');
    host.innerHTML = '';
    const w = getWarnings();
    for (const tier of TIERS) {
        const section = document.createElement('div');
        section.className = `warn-section ${warnClass(tier)}`;
        const head = document.createElement('div');
        head.className = 'warn-section-head';
        head.innerHTML = `<span class="warn-sym ${warnClass(tier)}">${TIER_SYMBOL[tier]}</span>`;
        section.appendChild(head);
        const chips = document.createElement('div');
        chips.className = 'warn-chips';
        for (const category of CATEGORIES)
            for (const en of w[tier][category]) chips.appendChild(makeWarnChip(tier, category, en));
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'warn-add';
        add.textContent = '+';
        add.title = t('warnAdd', 'Add warning');
        // stopPropagation: the global "close select2 on outside click" handler (init)
        // would otherwise fire on THIS click and immediately close the menu we open.
        add.addEventListener('click', e => { e.stopPropagation(); openWarnAddMenu(tier, chips, add); });
        chips.appendChild(add);
        section.appendChild(chips);
        host.appendChild(section);
    }
}

async function openWarnings() {
    try {
        await ensureWarningVocab();
    } catch (error) {
        console.error('Could not load warning vocabulary:', error);
        return;
    }
    document.getElementById('warnings-title').textContent = t('warningSettings', 'Warning settings');
    renderWarningSections();
    document.getElementById('warnings-modal').style.display = 'block';
}

function closeWarnings() {
    document.getElementById('warnings-modal').style.display = 'none';
}

// A warning change re-renders the main view (trainer symbols, menu colours, minisprite
// backgrounds, set rows + details) by re-running the render with the current selection.
function onWarningsChanged() {
    if (!state.data) return;
    const snapshot = captureSelection();
    loadAndRender().then(() => restoreSelection(snapshot));
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
    const fstreak = parseInt(localStorage.getItem('factoryStreak'), 10);
    state.factoryStreak = Number.isFinite(fstreak) ? Math.max(0, fstreak) : 0; // gen-3 Factory
    state.pyramid140 = localStorage.getItem('pyramid140') === '1';   // gen-3 Pyramid wild IVs 15-31
    state.openMode = localStorage.getItem('openMode') === '1';       // Gen-3 Tower: Lv50 default
    const olv = parseInt(localStorage.getItem('openLevelValue'), 10);
    state.openLevelValue = Number.isFinite(olv) ? Math.min(100, Math.max(60, olv)) : 100;
    const hl = parseInt(localStorage.getItem('hallLevel'), 10);
    state.hallLevel = Number.isFinite(hl) ? Math.min(100, Math.max(30, hl)) : 100;  // default 100
    const hr2 = parseInt(localStorage.getItem('hallRank2'), 10);
    state.hallRank2 = Number.isFinite(hr2) ? Math.min(17, Math.max(0, hr2)) : 0;    // default 0
    state.spritesOn = localStorage.getItem('minisprites') !== ''; // default on
    setTheme(localStorage.getItem('theme') || THEMES[0].code);
    loadWarnings();   // seed defaults on first run + build the lookup maps

    buildSlotContainers();

    // Mobile has no mode switch: singles by default, multis via settings.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const savedMode = localStorage.getItem('mode');
    // On mobile only singles/multis are normally reachable; BDSP (teamView) also
    // exposes its Doubles via the mode slider, so allow any of its modes there.
    const mobileOk = mode => !isMobile || state.variant.teamView || ['singles', 'multis'].includes(mode);
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
    updateSettingsToggles();
    updateFactoryLevelRow();
    updateFactoryStreakRow();
    updateOpenLevelRow();
    updateFacilityLinks();
    updateHallLevelTool();
    applyStaticTranslations();

    // Event wiring.
    // Info (ⓘ) icons: tap toggles the tooltip on mobile (no hover); a tap anywhere
    // else closes it. Delegated so it covers icons in hidden rows once they show.
    document.addEventListener('click', e => {
        const info = e.target.closest('.hall-info');
        document.querySelectorAll('.hall-info.info-open').forEach(el => {
            if (el !== info) el.classList.remove('info-open');
        });
        if (info) info.classList.toggle('info-open');
    });
    // Select2 fires jQuery 'change' events (not native ones), so bind via jQuery.
    $('#game-select').on('change', e => onGameChanged(e.target.value));
    // (variant pills and language flags bind their own click handlers)
    document.getElementById('late-filter').addEventListener('click', () => onLateFilterChanged(!state.lateOnly));
    document.getElementById('factory-late-21').addEventListener('click', () => onFactoryLateChanged(21));
    document.getElementById('factory-late-49').addEventListener('click', () => onFactoryLateChanged(49));
    document.getElementById('pyramid-140').addEventListener('click', onPyramid140Changed);
    document.getElementById('multis-toggle').addEventListener('click',
        () => setMode(state.mode === 'multis' ? 'singles' : 'multis'));
    document.getElementById('sprites-toggle').addEventListener('click', onSpritesToggled);
    document.querySelectorAll('#factory-level .factory-level-opt').forEach(opt =>
        opt.addEventListener('click', () => onFactoryLevelChanged(opt.dataset.open === '1')));
    document.querySelectorAll('#open-level .open-level-opt').forEach(opt =>
        opt.addEventListener('click', () => onOpenLevelModeChanged(opt.dataset.open === '1')));
    const olvEl = document.getElementById('open-level-value');
    olvEl.addEventListener('input', e => onOpenLevelInput(e.target.value, false));
    olvEl.addEventListener('change', e => onOpenLevelInput(e.target.value, true));
    const fsEl = document.getElementById('factory-streak');
    fsEl.addEventListener('input', e => onFactoryStreakInput(e.target.value, false));
    fsEl.addEventListener('change', e => onFactoryStreakInput(e.target.value, true));
    const lvlEl = document.getElementById('hall-player-level');
    lvlEl.addEventListener('input', e => onHallLevelInput(e.target.value, false));
    lvlEl.addEventListener('change', e => onHallLevelInput(e.target.value, true));
    const r2El = document.getElementById('hall-rank2');
    r2El.addEventListener('input', e => onHallRank2Input(e.target.value, false));
    r2El.addEventListener('change', e => onHallRank2Input(e.target.value, true));
    document.getElementById('swap-slots').addEventListener('click', swapSides);
    document.getElementById('mode-glyph').addEventListener('click', cycleMode);
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('reset-btn').addEventListener('click', () => {
        resetSelections();
        if (isDuoDoubles()) resetDuoSelection();   // clear the BDSP duo selection + menus
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
    document.getElementById('open-warnings').addEventListener('click', openWarnings);
    document.querySelector('#warnings-modal .close').addEventListener('click', closeWarnings);
    document.getElementById('warnings-modal').addEventListener('click', e => {
        if (e.target.id === 'warnings-modal') closeWarnings(); // backdrop
    });
    document.getElementById('reverse-lookup-btn').addEventListener('click', openReverseLookup);
    // Reset: force a rebuild to an empty search (the default open path reuses the
    // previous search + results so you can try another result after loading one).
    document.getElementById('reverse-reset').addEventListener('click', () => populateReverseLookup(null, true));
    document.querySelector('#reverse-lookup-modal .close').addEventListener('click', closeReverseLookup);
    document.getElementById('reverse-lookup-modal').addEventListener('click', e => {
        if (e.target.id === 'reverse-lookup-modal') closeReverseLookup(); // backdrop
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
