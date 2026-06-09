// Application entry point: initialization, settings and event wiring.

import { FACILITIES, LANGUAGE_NAMES, getFacility } from './config.js';
import { loadTranslations, loadFacilityData } from './data.js';
import { state } from './state.js';
import {
    initSelect2, flagTemplate,
    populateTrainerDropdown, populateQuoteDropdown, syncTrainerDropdowns,
    renderSpeciesList, populatePokemonMenus, highlightSelectedSprites,
    showPokemonSets, resetPokemonUI, resetSelections,
    updateMenuVisibility, applyStaticTranslations,
} from './ui.js';

/* ---------- settings (facility & language) ---------- */

function populateFacilitySelect() {
    const select = document.getElementById('facility-select');
    select.innerHTML = '';
    for (const facility of FACILITIES) {
        select.appendChild(new Option(facility.name, facility.code));
    }
    select.value = state.facility.code;
    initSelect2('#facility-select', { placeholder: 'Facility' });
}

function populateLanguageSelect() {
    const select = document.getElementById('language-select');
    select.innerHTML = '';
    for (const code of state.facility.languages) {
        select.appendChild(new Option(LANGUAGE_NAMES[code] || code, code));
    }
    // Keep the current language if this facility supports it, else fall back.
    if (!state.facility.languages.includes(state.language)) {
        state.language = state.facility.languages[0];
    }
    select.value = state.language;
    initSelect2('#language-select', { placeholder: 'Language', template: flagTemplate });
}

function onFacilityChanged(code) {
    state.facility = getFacility(code);
    localStorage.setItem('selectedFacility', state.facility.code);
    populateLanguageSelect(); // may force a language fallback
    localStorage.setItem('selectedLanguage', state.language);
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
    for (const slot of [1, 2]) {
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

    for (const slot of [1, 2]) {
        const { species, setNumber } = snapshot.slots[slot];
        const translated = species && speciesFromEnglish(species);
        if (!translated) continue;
        $(`#pokemon-menu-${slot}`).val(translated).trigger('change.select2');
        onMenuSelected(slot, translated);
        if (setNumber !== null) {
            document.querySelector(
                `#pokemon-sets-${slot} .set-row[data-set-number="${setNumber}"]`)?.click();
        }
    }
}

/* ---------- data loading ---------- */

async function loadAndRender() {
    try {
        state.data = await loadFacilityData(state.facility, state.language);
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
    syncTrainerDropdowns(trainer.name);
    renderSpeciesList(trainer, onSpeciesPicked);
    populatePokemonMenus(trainer, onMenuSelected);
    resetPokemonUI();
    updateMenuVisibility();
}

// A mini-sprite was clicked: fill slot 1, or slot 2 in doubles if slot 1 is taken.
function onSpeciesPicked(species) {
    let slot = 1;
    if (state.mode === 'doubles' && $('#pokemon-menu-1').val()) {
        slot = 2;
    }
    $(`#pokemon-menu-${slot}`).val(species).trigger('change.select2');
    onMenuSelected(slot, species);
}

function onMenuSelected(slot, species) {
    state.activeSets[slot] = null;
    showPokemonSets(slot, species);
    highlightSelectedSprites();
}

/* ---------- mode (singles/doubles) ---------- */

function setMode(mode) {
    state.mode = mode;
    localStorage.setItem('mode', mode);

    document.getElementById('mode-toggle').checked = mode === 'doubles';
    document.getElementById('mode-label').textContent = mode === 'doubles' ? '⚁' : '⚀';
    document.body.classList.remove('singles-mode', 'doubles-mode');
    document.body.classList.add(`${mode}-mode`);

    updateMenuVisibility();
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

    // Restore saved settings (validated against the current config).
    state.facility = getFacility(localStorage.getItem('selectedFacility'));
    const savedLanguage = localStorage.getItem('selectedLanguage');
    state.language = state.facility.languages.includes(savedLanguage)
        ? savedLanguage
        : state.facility.languages[0];

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    setMode(!isMobile && localStorage.getItem('mode') === 'doubles' ? 'doubles' : 'singles');

    populateFacilitySelect();
    populateLanguageSelect();
    applyStaticTranslations();

    // Event wiring.
    // Select2 fires jQuery 'change' events (not native ones), so bind via jQuery.
    $('#facility-select').on('change', e => onFacilityChanged(e.target.value));
    $('#language-select').on('change', e => onLanguageChanged(e.target.value));
    document.getElementById('mode-toggle').addEventListener('change', e => setMode(e.target.checked ? 'doubles' : 'singles'));
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
