// Application entry point: initialization, settings and event wiring.

import { GAMES, MODES, THEMES, LANGUAGE_NAMES, getGame, getVariant } from './config.js';
import { loadTranslations, loadVariantData } from './data.js';
import { state } from './state.js';
import {
    initSelect2, flagTemplate, iconTemplate,
    buildSlotContainers,
    populateTrainerDropdown, populateQuoteDropdown, syncTrainerDropdowns,
    renderSpeciesList, populatePokemonMenus, highlightSelectedSprites,
    showPokemonSets, resetPokemonUI, resetSelections,
    updateMenuVisibility, applyStaticTranslations,
    trainerPool, isLateTrainer,
} from './ui.js';

/* ---------- settings (game, variant, language, theme) ---------- */

function populateGameSelect() {
    const select = document.getElementById('game-select');
    select.innerHTML = '';
    for (const game of GAMES) {
        const option = new Option(game.name, game.code);
        if (game.icon) option.setAttribute('data-icon', game.icon);
        select.appendChild(option);
    }
    select.value = state.game.code;
    initSelect2('#game-select', { placeholder: 'Game', template: iconTemplate, search: false });
}

// Hidden entirely when the selected game has a single variant.
function populateVariantSelect() {
    const row = document.getElementById('variant-row');
    const select = document.getElementById('variant-select');
    select.innerHTML = '';
    for (const variant of state.game.variants) {
        select.appendChild(new Option(variant.name, variant.code));
    }
    select.value = state.variant.code;
    row.style.display = state.game.variants.length > 1 ? '' : 'none';
    if (state.game.variants.length > 1) {
        initSelect2('#variant-select', { placeholder: 'Facility', search: false });
    }
}

function populateLanguageSelect() {
    const select = document.getElementById('language-select');
    select.innerHTML = '';
    for (const code of state.variant.languages) {
        select.appendChild(new Option(LANGUAGE_NAMES[code] || code, code));
    }
    // Keep the current language if this variant supports it, else fall back.
    if (!state.variant.languages.includes(state.language)) {
        state.language = state.variant.languages[0];
    }
    select.value = state.language;
    initSelect2('#language-select', { placeholder: 'Language', template: flagTemplate, search: false });
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

function onGameChanged(code) {
    state.game = getGame(code);
    applyVariant(state.game.variants[0]);
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
    populateVariantSelect();
    populateLanguageSelect(); // may force a language fallback
    localStorage.setItem('selectedLanguage', state.language);
    updateLateFilterRow();
    applyStaticTranslations();
    loadAndRender();
}

// Switching language keeps the current view (trainer, picked Pokémon, selected
// sets) and just re-renders it in the new language. Species are remembered by
// their English dex name; trainers by index (the per-language trainer files
// are parallel arrays).
function onLanguageChanged(code) {
    const snapshot = captureSelection();
    state.language = code;
    localStorage.setItem('selectedLanguage', code);
    applyStaticTranslations();
    loadAndRender().then(() => restoreSelection(snapshot));
}

function setTheme(code) {
    state.theme = THEMES.some(theme => theme.code === code) ? code : THEMES[0].code;
    localStorage.setItem('theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    updateThemeSwatches();
}

// Toggling the late filter keeps the current trainer when it passes the
// filter, otherwise resets the view.
function onLateFilterChanged(checked) {
    state.lateOnly = checked;
    localStorage.setItem('lateOnly', checked ? '1' : '');
    updateLateFilterRow();
    populateTrainerDropdown(onTrainerSelected);
    populateQuoteDropdown(onTrainerSelected);
    if (state.trainer && trainerPool().includes(state.trainer)) {
        syncTrainerDropdowns(state.trainer);
    } else {
        resetSelections();
    }
}

/* ---------- language-switch view preservation ---------- */

function speciesToEnglish(species) {
    return state.data.pokedex.find(p => p[state.language] === species)?.en ?? null;
}

function speciesFromEnglish(english) {
    return state.data.pokedex.find(p => p.en === english)?.[state.language] ?? null;
}

function captureSelection() {
    if (!state.trainer || !state.data) return null;
    const snapshot = {
        trainerIndex: state.data.trainers.indexOf(state.trainer),
        slots: {},
    };
    for (let slot = 1; slot <= MODES[state.mode].slots; slot++) {
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
    const trainer = state.data.trainers[snapshot.trainerIndex];
    if (!trainer) return;
    onTrainerSelected(trainer);

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
    populateTrainerDropdown(onTrainerSelected);
    populateQuoteDropdown(onTrainerSelected);
    resetSelections();
}

/* ---------- trainer & pokémon selection ---------- */

function onTrainerSelected(trainer) {
    if (!trainer) return;
    state.trainer = trainer;
    syncTrainerDropdowns(trainer);
    renderSpeciesList(trainer, onSpeciesPicked);
    populatePokemonMenus(trainer, onMenuSelected);
    resetPokemonUI();
    updateMenuVisibility();
}

// A mini-sprite was clicked: fill the first empty visible slot, or overwrite
// the last one when all are taken.
function onSpeciesPicked(species) {
    const slots = MODES[state.mode].slots;
    let slot = slots;
    for (let i = 1; i <= slots; i++) {
        if (!$(`#pokemon-menu-${i}`).val()) { slot = i; break; }
    }
    $(`#pokemon-menu-${slot}`).val(species).trigger('change.select2');
    onMenuSelected(slot, species);
}

function onMenuSelected(slot, species) {
    state.activeSets[slot] = null;
    showPokemonSets(slot, species);
    highlightSelectedSprites();
}

/* ---------- mode (singles/doubles/triples/rotation) ---------- */

function setMode(mode) {
    state.mode = state.variant.modes.includes(mode) ? mode : state.variant.modes[0];
    localStorage.setItem('mode', state.mode);

    document.body.className = document.body.className
        .replace(/\b\w+-mode\b/g, '').trim();
    document.body.classList.add(`${state.mode}-mode`);

    updateModeSwitch();
    updateMenuVisibility();
}

// Mode control: the current mode's glyph shown big (⚀ ⚁ ⚂ ⟳), with a small
// multi-position slider track underneath — one notch per variant mode, the
// knob slides to the active one (alt accent color on the 3rd/4th position).
// Clicking the glyph cycles modes; clicking a notch jumps to it. Hidden when
// the variant has a single mode (and on mobile, where the first mode is forced).
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
    const isAlt = index >= 2;
    knob.style.transform = `translateX(${index * 100}%)`;
    knob.classList.toggle('alt', isAlt);
    const glyph = document.getElementById('mode-glyph');
    glyph.textContent = MODES[state.mode].icon;
    glyph.classList.toggle('alt', isAlt);
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
    setTheme(localStorage.getItem('theme') || THEMES[0].code);

    buildSlotContainers(onMenuSelected);

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const savedMode = localStorage.getItem('mode');
    buildModeSwitch();
    setMode(!isMobile && state.variant.modes.includes(savedMode)
        ? savedMode
        : state.variant.modes[0]);

    populateGameSelect();
    populateVariantSelect();
    populateLanguageSelect();
    populateThemeSwatches();
    updateLateFilterRow();
    applyStaticTranslations();

    // Event wiring.
    // Select2 fires jQuery 'change' events (not native ones), so bind via jQuery.
    $('#game-select').on('change', e => onGameChanged(e.target.value));
    $('#variant-select').on('change', e => onVariantChanged(e.target.value));
    $('#language-select').on('change', e => onLanguageChanged(e.target.value));
    document.getElementById('late-filter').addEventListener('click', () => onLateFilterChanged(!state.lateOnly));
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
