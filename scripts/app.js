// Application entry point: initialization, settings and event wiring.

import { GAMES, MODES, THEMES, LANGUAGE_NAMES, MAX_SIDES,
         getGame, getVariant, defaultVariant, modeSlots } from './config.js';
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
    for (const variant of state.game.variants) {
        const pill = document.createElement('button');
        pill.className = 'variant-pill';
        pill.dataset.variant = variant.code;
        pill.textContent = variant.short ?? variant.name;
        pill.title = variant.name;
        pill.classList.toggle('active', variant.code === state.variant.code);
        pill.addEventListener('click', () => {
            if (variant.code !== state.variant.code) onVariantChanged(variant.code);
        });
        pills.appendChild(pill);
    }
    row.style.display = state.game.variants.length > 1 ? '' : 'none';
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

// Visual theme picker: a row of dual-color squares (no text).
function populateThemeSwatches() {
    const row = document.getElementById('theme-swatches');
    row.innerHTML = '';
    for (const theme of THEMES) {
        const swatch = document.createElement('button');
        swatch.className = 'theme-swatch';
        swatch.dataset.theme = theme.code;
        swatch.title = theme.name;
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

// Visual late-trainers toggle: a "<N>+" pill using the variant's cutoff.
function updateLateFilterRow() {
    const row = document.getElementById('late-filter-row');
    const btn = document.getElementById('late-filter');
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

function onGameChanged(code) {
    state.game = getGame(code);
    applyVariant(defaultVariant(state.game));
}

function onVariantChanged(code) {
    applyVariant(getVariant(state.game, code));
}

// Central entry for switching variant: validates language and mode against the
// variant's capabilities, refreshes all dependent settings UI, reloads data.
function applyVariant(variant) {
    state.variant = variant;
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
    updateGameSelectIcons(); // localized game names
    applyStaticTranslations();
    loadAndRender().then(() => restoreSelection(snapshot));
}

function setTheme(code) {
    state.theme = THEMES.some(theme => theme.code === code) ? code : THEMES[0].code;
    localStorage.setItem('theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    updateThemeSwatches();
}

// Toggling the late filter keeps selected trainers that pass the filter and
// clears the sides that don't.
function onLateFilterChanged(checked) {
    state.lateOnly = checked;
    localStorage.setItem('lateOnly', checked ? '1' : '');
    updateLateFilterRow();
    for (let side = 1; side <= MAX_SIDES; side++) {
        populateTrainerDropdown(side, onTrainerSelected);
        populateQuoteDropdown(side, onTrainerSelected);
        const trainer = state.trainers[side];
        if (trainer && trainerPool().includes(trainer)) {
            syncTrainerDropdowns(side, trainer);
        } else if (trainer) {
            state.trainers[side] = null;
            resetSlotsOfSide(side);
        }
    }
    renderSpeciesLists(onSpeciesPicked);
    updateLayout();
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
            snapshot.trainerIndexes[side] = state.data.trainers.indexOf(state.trainers[side]);
            any = true;
        }
    }
    if (!any) return null;
    for (let slot = 1; slot <= modeSlots(state.mode); slot++) {
        const species = $(`#pokemon-menu-${slot}`).val();
        snapshot.slots[slot] = {
            species: species ? speciesToEnglish(species) : null,
            setNumber: state.activeSets[slot]?.setNumber ?? null,
        };
    }
    return snapshot;
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
            document.querySelector(
                `#pokemon-sets-${slot} .set-row[data-set-number="${setNumber}"]`)?.click();
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
}

/* ---------- trainer & pokémon selection ---------- */

function onTrainerSelected(side, trainer) {
    if (!trainer) return;
    state.trainers[side] = trainer;
    syncTrainerDropdowns(side, trainer);
    renderSpeciesLists(onSpeciesPicked);
    populatePokemonMenus(onMenuSelected);
    resetSlotsOfSide(side);
    updateLayout();
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
    applyStaticTranslations();

    // Event wiring.
    // Select2 fires jQuery 'change' events (not native ones), so bind via jQuery.
    $('#game-select').on('change', e => onGameChanged(e.target.value));
    // (variant pills and language flags bind their own click handlers)
    document.getElementById('late-filter').addEventListener('click', () => onLateFilterChanged(!state.lateOnly));
    document.getElementById('multis-toggle').addEventListener('click',
        () => setMode(state.mode === 'multis' ? 'singles' : 'multis'));
    document.getElementById('sprites-toggle').addEventListener('click', onSpritesToggled);
    document.getElementById('mode-glyph').addEventListener('click', cycleMode);
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('reset-btn').addEventListener('click', resetSelections);
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
