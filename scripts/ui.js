// All DOM rendering: dropdowns, species lists, set tables and set details.
//
// "Sides" model: a mode shows 1 or 2 opposing trainers (multis = 2). Each side
// owns a trainer dropdown, a quote dropdown, a species list and its Pokémon
// slot(s). Slot ownership per mode comes from slotSide() in config.js.

import { state } from './state.js';
import { loadSets } from './data.js';
import { speedDisplay } from './speed.js';
import { MODES, MAX_SLOTS, MAX_SIDES, modeSlots, slotSide, variantMaxSlots } from './config.js';

/* ---------- lookup helpers ---------- */

export function t(key, fallback) {
    return state.translations[key]?.[state.language] || fallback;
}

function dexEntry(species) {
    return state.data.pokedex.find(pokemon => pokemon[state.language] === species);
}

function itemEntry(itemName) {
    return state.data.items.find(item => item[state.language] === itemName);
}

function itemImageUrl(itemName) {
    const english = itemEntry(itemName)?.en ?? itemName;
    return `assets/images/items/${english.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
}

function minispriteUrl(species) {
    const english = dexEntry(species)?.en ?? species;
    return `assets/images/minisprites/${english.toLowerCase()}.png`;
}

export function isLateTrainer(trainer) {
    return String(trainer.late ?? '').trim() === '1';
}

// Trainers visible in the dropdowns, honoring the late-only filter.
export function trainerPool() {
    if (state.lateOnly && state.variant.lateCutoff) {
        return state.data.trainers.filter(isLateTrainer);
    }
    return state.data.trainers;
}

function sides() {
    return MODES[state.mode].sides;
}

/* ---------- move types (gen-aware) ---------- */

// data/moves.json: { "<English move>": [[firstGen, "Type"], [genChanged, "NewType"], ...] }
// Lookup is spelling-tolerant ("AncientPower" matches "Ancient Power") because
// pre-gen-6 data files use the era's official names.
let movesIndex = null;
let movesIndexSource = null;

function normalizeMoveName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function moveType(name, gen) {
    if (!name) return null;
    if (movesIndexSource !== state.data.moves) {
        movesIndexSource = state.data.moves;
        movesIndex = new Map();
        for (const [move, list] of Object.entries(state.data.moves)) {
            movesIndex.set(normalizeMoveName(move), list);
        }
    }
    // Slash-combined slots ("Fly / Outrage") → look up the first move.
    const list = movesIndex.get(normalizeMoveName(name.split('/')[0].trim()));
    if (!list) return null;
    let type = null;
    for (const [g, t] of list) {
        if (g <= gen) type = t;
    }
    return type && type !== 'None' && type !== '???' ? type : null;
}

/* ---------- Select2 helpers ---------- */

function spriteTemplate(option) {
    if (!option.id) return option.text;
    const icon = $(option.element).data('icon');
    if (!icon) return option.text;
    return $('<span></span>')
        .append($('<img>').attr('src', icon).addClass(option._spriteClass || 'pokemon-sprite-select2'))
        .append(document.createTextNode(' ' + option.text));
}

function trainerTemplate(option) {
    option._spriteClass = 'trainer-sprite-select2';
    return spriteTemplate(option);
}

function textTemplate(option) {
    return option.text;
}

// Icon template for the game select. Games may declare several icons
// (one per flagship version), passed via data-icons as a |-separated list.
export function iconTemplate(option) {
    if (!option.id) return option.text;
    const icons = String($(option.element).attr('data-icons') || '');
    if (!icons) return option.text;
    const $span = $('<span></span>');
    for (const icon of icons.split('|')) {
        $span.append($('<img>').attr('src', icon).addClass('game-icon')
            .on('error', function () { $(this).remove(); }));
    }
    return $span.append(document.createTextNode(' ' + option.text));
}

export function initSelect2(selector, { placeholder, template, containerClass, search = true,
                                        matcher } = {}) {
    const $el = $(selector);
    if ($el.hasClass('select2-hidden-accessible')) {
        $el.select2('destroy');
    }
    $el.select2({
        placeholder,
        templateResult: template,
        templateSelection: template,
        width: '100%',
        // search: false hides the search box (short, fixed lists)
        minimumResultsForSearch: search ? 0 : Infinity,
        ...(matcher ? { matcher } : {}),
    });
    if (containerClass) {
        $el.data('select2').$container.addClass(containerClass);
    }
    // Focus the search field as soon as the dropdown opens.
    $el.off('select2:open.autofocus').on('select2:open.autofocus', () => {
        setTimeout(() => {
            document.querySelector('.select2-container--open .select2-search__field')?.focus();
        }, 50);
    });
    return $el;
}

/* ---------- Pokémon slot containers (generated, 1..MAX_SLOTS) ---------- */

// Called once at startup; menus/sets/species-lists for every possible slot
// exist up front and are shown/hidden based on the current mode.
export function buildSlotContainers() {
    const menus = document.getElementById('pokemon-menus');
    menus.innerHTML = '';
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const container = document.createElement('div');
        container.className = 'pokemon-menu-container';
        container.id = `pokemon-menu-container-${slot}`;
        container.style.display = 'none';
        container.innerHTML = `
            <div class="slot-species" id="slot-species-${slot}"></div>
            <select id="pokemon-menu-${slot}"></select>
            <div id="pokemon-sets-${slot}"></div>
        `;
        menus.appendChild(container);
    }
    state.activeSets = {};
}

/* ---------- trainer & quote dropdowns (per side) ---------- */

function sideLabel(base, side) {
    return sides() > 1 ? `${base} ${side}` : base;
}

// Dropdown option values are the trainer's INDEX in state.data.trainers, not
// the name — names can legitimately collide (e.g. two Battle Tree trainers
// share the same Japanese name).

// Hidden nicety: the trainer search also matches the (localized) trainer
// CLASS, so typing "chef" lists every Chef alongside any name matches.
// Mirrors select2's default matcher (case- and diacritic-insensitive).
const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function trainerMatcher(params, data) {
    const term = fold(params.term).trim();
    if (!term) return data;
    if (fold(data.text).includes(term)) return data;
    const value = data.element?.value;
    if (value !== '' && value != null) {
        const trainer = state.data.trainers[Number(value)];
        if (fold(trainer?.class).includes(term)) return data;
    }
    return null;
}

export function populateTrainerDropdown(side, onSelect) {
    const $dropdown = $(`#trainer-dropdown-${side}`).empty();
    $dropdown.append(`<option value="" disabled selected></option>`);

    const trainers = [...trainerPool()].sort((a, b) => a.name.localeCompare(b.name));
    for (const trainer of trainers) {
        const index = state.data.trainers.indexOf(trainer);
        const option = new Option(trainer.name, String(index), false, false);
        $(option).attr('data-icon', trainer.sprite);
        $dropdown.append(option);
    }

    initSelect2(`#trainer-dropdown-${side}`, {
        placeholder: sideLabel(t('trainerDropdownPlaceholder', 'Trainer'), side),
        template: trainerTemplate,
        containerClass: 'select2-container--trainer',
        matcher: trainerMatcher,
    });

    $dropdown.off('select2:select').on('select2:select', event => {
        onSelect(side, state.data.trainers[Number(event.params.data.id)]);
    });
}

export function populateQuoteDropdown(side, onSelect) {
    const $dropdown = $(`#quote-dropdown-${side}`).empty();
    $dropdown.append(`<option value="" disabled selected></option>`);

    const trainers = [...trainerPool()].sort((a, b) => a.quote.localeCompare(b.quote));
    for (const trainer of trainers) {
        const index = state.data.trainers.indexOf(trainer);
        $dropdown.append(new Option(trainer.quote, String(index), false, false));
    }

    initSelect2(`#quote-dropdown-${side}`, {
        placeholder: sideLabel(t('quoteDropdownPlaceholder', 'Quote'), side),
        template: textTemplate,
    });

    $dropdown.off('select2:select').on('select2:select', event => {
        onSelect(side, state.data.trainers[Number(event.params.data.id)]);
    });
}

// Refreshes placeholders (e.g. "Trainer" vs "Trainer 1/2") without losing the
// current selections — select2 re-init keeps the underlying select's value.
export function refreshSidePlaceholders() {
    for (let side = 1; side <= sides(); side++) {
        initSelect2(`#trainer-dropdown-${side}`, {
            placeholder: sideLabel(t('trainerDropdownPlaceholder', 'Trainer'), side),
            template: trainerTemplate,
            containerClass: 'select2-container--trainer',
            matcher: trainerMatcher,
        });
        initSelect2(`#quote-dropdown-${side}`, {
            placeholder: sideLabel(t('quoteDropdownPlaceholder', 'Quote'), side),
            template: textTemplate,
        });
    }
}

// Keep a side's dropdowns showing its trainer without re-firing events.
export function syncTrainerDropdowns(side, trainer) {
    const value = trainer ? String(state.data.trainers.indexOf(trainer)) : '';
    $(`#trainer-dropdown-${side}`).val(value).trigger('change.select2');
    $(`#quote-dropdown-${side}`).val(value).trigger('change.select2');
}

/* ---------- species lists ---------- */

// Every visible slot gets its owning trainer's full roster above its menu;
// clicking a sprite fills exactly that slot. (Users can hide the lists with
// the settings toggle.)
export function renderSpeciesLists(onPick) {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        document.getElementById(`slot-species-${slot}`).innerHTML = '';
    }
    if (!state.variant.showMinisprites || !state.spritesOn) return;

    const total = sides() === 1
        ? Math.min(variantMaxSlots(state.variant), MAX_SLOTS)
        : modeSlots(state.mode);
    for (let slot = 1; slot <= total; slot++) {
        const side = sides() === 1 ? 1 : slotSide(state.mode, slot);
        renderSpeciesListInto(slot, state.trainers[side], onPick);
    }
}

// Pokédex position of a species in the current language (the pokedex files
// are in National Dex order with forms right after their base species), so
// sorting by it groups families together. Memoized per data load.
let dexIndexMap = null;
let dexIndexSource = null;
let dexIndexLang = null;

function dexIndex(species) {
    if (dexIndexSource !== state.data.pokedex || dexIndexLang !== state.language) {
        dexIndexSource = state.data.pokedex;
        dexIndexLang = state.language;
        dexIndexMap = new Map();
        state.data.pokedex.forEach((p, i) => {
            if (p[state.language]) dexIndexMap.set(p[state.language], i);
        });
    }
    return dexIndexMap.get(species) ?? Number.MAX_SAFE_INTEGER;
}

function renderSpeciesListInto(slot, trainer, onPick) {
    if (!trainer) return;
    const container = document.getElementById(`slot-species-${slot}`);
    const ordered = trainer.species.split(', ')
        .sort((a, b) => dexIndex(a) - dexIndex(b));
    for (const species of ordered) {
        if (!dexEntry(species)) continue;
        const img = document.createElement('img');
        img.src = minispriteUrl(species);
        img.alt = species;
        img.dataset.slot = slot;
        img.classList.add('pokemon-sprite');
        img.onerror = () => img.remove();
        img.onclick = () => onPick(slot, species);
        container.appendChild(img);
    }
}

export function highlightSelectedSprites() {
    document.querySelectorAll('.pokemon-sprite').forEach(img => {
        img.classList.toggle('selected',
            $(`#pokemon-menu-${img.dataset.slot}`).val() === img.alt);
    });
}

/* ---------- pokémon menus ---------- */

// (Re)populates every visible slot's menu from its owning trainer's species.
export function populatePokemonMenus(onSelect) {
    const total = sides() === 1
        ? Math.min(variantMaxSlots(state.variant), MAX_SLOTS)
        : modeSlots(state.mode);
    for (let slot = 1; slot <= total; slot++) {
        const side = sides() === 1 ? 1 : slotSide(state.mode, slot);
        populateOneMenu(slot, state.trainers[side], onSelect);
    }
}

function populateOneMenu(slot, trainer, onSelect) {
    const $menu = $(`#pokemon-menu-${slot}`).empty();
    $menu.append(new Option('', '', true, true));
    if (trainer) {
        const species = trainer.species.split(', ')
            .filter(sp => dexEntry(sp))
            .sort((a, b) => a.localeCompare(b));
        for (const sp of species) {
            const option = new Option(sp, sp, false, false);
            $(option).attr('data-icon', minispriteUrl(sp));
            $menu.append(option);
        }
    }
    initSelect2(`#pokemon-menu-${slot}`, {
        placeholder: t('pokemonDropdownPlaceholder', 'Pokémon'),
        template: spriteTemplate,
    });
    $menu.off('select2:select').on('select2:select', event => {
        onSelect(slot, event.params.data.id);
    });
}

/* ---------- sets table ---------- */

export function showPokemonSets(slot, species) {
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.innerHTML = '';

    const trainer = state.trainers[slotSide(state.mode, slot)];
    if (!trainer) return;

    // Roster entries look like "Species-Name-3": split on the final "-<number>".
    const setNumbers = trainer.roster.split(', ')
        .map(entry => entry.split(/-(?=\d+$)/))
        .filter(([rosterSpecies]) => rosterSpecies === species)
        .map(([, setNumber]) => parseInt(setNumber, 10));

    const sets = state.data.sets.filter(set =>
        set.species === species && setNumbers.includes(set.setNumber));

    const table = document.createElement('table');
    table.className = 'sets-table';

    sets.forEach((set, index) => {
        const row = document.createElement('tr');
        row.className = `set-row ${index % 2 === 0 ? 'even-row' : 'odd-row'}`;
        row.dataset.setNumber = set.setNumber;

        row.appendChild(textCell(set.setNumber));
        row.appendChild(itemCell(set.item));
        row.appendChild(textCell(set.nature));
        row.appendChild(textCell(set.move1));
        row.appendChild(textCell(set.move2));
        row.appendChild(textCell(set.move3));
        row.appendChild(textCell(set.move4));
        row.appendChild(textCell(speedDisplay(set)));

        row.onclick = () => {
            if (state.activeSets[slot] === set) {
                // re-clicking the selected set collapses its details
                state.activeSets[slot] = null;
                container.querySelector('.set-details')?.remove();
            } else {
                state.activeSets[slot] = set;
                showSetDetails(slot, set);
            }
            updateHighlightedRows();
        };

        table.appendChild(row);
    });

    container.appendChild(table);
    updateHighlightedRows();
}

function textCell(content) {
    const cell = document.createElement('td');
    cell.textContent = content;
    return cell;
}

function itemCell(itemName) {
    const cell = document.createElement('td');
    if (itemName && itemName !== 'None') {
        const img = document.createElement('img');
        img.src = itemImageUrl(itemName);
        img.alt = itemName;
        img.title = itemName;
        img.onerror = () => img.remove();
        cell.appendChild(img);
    }
    return cell;
}

export function updateHighlightedRows() {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const container = document.getElementById(`pokemon-sets-${slot}`);
        const active = state.activeSets[slot];
        container.querySelectorAll('.set-row').forEach(row => {
            row.classList.toggle('selected',
                Boolean(active) && row.dataset.setNumber == active.setNumber);
        });
    }
}

/* ---------- set details ---------- */

async function showSetDetails(slot, set) {
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.querySelector('.set-details')?.remove();

    const speciesData = dexEntry(set.species);
    if (!speciesData) {
        console.error('Species data not found for:', set.species);
        return;
    }

    const english = speciesData.en.toLowerCase();
    const abilities = (speciesData[`abilities-${state.language}`] || '').split(', ');
    const itemEnglish = itemEntry(set.item)?.en ?? set.item;

    // English move names drive the type lookup; for other languages the
    // English counterpart set provides them (moves match by position).
    let enSet = set;
    if (state.language !== 'en') {
        try {
            const englishSets = await loadSets(state.variant, 'en');
            enSet = englishSets.find(s =>
                s.species === speciesData.en && s.setNumber === set.setNumber) || set;
        } catch { /* fall back to localized names */ }
    }
    const moveLines = [];
    for (let i = 1; i <= 4; i++) {
        const text = set[`move${i}`];
        if (!text || text === '-') continue;
        const type = moveType(enSet[`move${i}`], state.variant.gen);
        const bullet = type
            ? `<img src="assets/images/types/${type.toLowerCase()}.png" alt="${type}" class="move-type-icon" onerror="this.remove()" />`
            : '<span class="move-bullet">-</span>';
        moveLines.push(`<div class="move-line">${bullet}<span>${text}</span></div>`);
    }

    const natureData = state.data.natures.find(nature =>
        nature[`nature-${state.language}`] === set.nature);
    const natureText = natureData ? natureData[`stats-${state.language}`] : '';

    const details = document.createElement('div');
    details.className = 'set-details';

    const typeIcons = [
        typeIconHtml(speciesData.type1),
        speciesData.type2 ? typeIconHtml(speciesData.type2) : '',
        set.tera ? typeIconHtml(set.tera, true) : '',
    ].join('');

    const itemHtml = set.item && set.item !== 'None'
        ? `<img src="${itemImageUrl(set.item)}" alt="${set.item}" class="item-icon" onerror="this.remove()" /> ${set.item}`
        : '';

    details.innerHTML = `
        <div class="left-column">
            <h3 class="set-name">${set.setName}</h3>
            <div class="type-icons">${typeIcons}</div>
            <img src="assets/images/sprites/${english}.png" alt="${set.species}" class="large-sprite" />
            <div class="item">${itemHtml}</div>
        </div>
        <div class="middle-column">
            <div class="nature">
                <b>${set.nature}</b>
                <br/><span class="nature-text">${natureText}</span>
            </div>
            <div class="separator"></div>
            <div class="moves">${moveLines.join('')}</div>
            <div class="separator"></div>
            <div class="speed">
                <img src="assets/images/speed.png" alt="Speed" class="speed-icon" />
                ${speedDisplay(set)}
            </div>
        </div>
        <div class="right-column">
            <div class="separator"></div>
            <div class="abilities">
                <span class="abilities-list">${abilities.join('<br/>')}</span>
            </div>
            <div class="separator"></div>
            <div class="evs">
                ${set.EVs.split(', ').join('<br/>')}
            </div>
            <div class="copy">
                <span role="button" title="Copy set (Showdown format)" class="icon-mask icon-copy copy-icon"></span>
                <span class="copy-feedback" hidden>Copied!</span>
            </div>
        </div>
    `;

    // Mega evolution: if the held item is a mega stone, try the mega sprite first
    // and fall back to the regular sprite if it doesn't exist.
    if (/ite$/.test(itemEnglish) && itemEnglish !== 'Eviolite') {
        const sprite = details.querySelector('.large-sprite');
        sprite.onerror = () => {
            sprite.onerror = null;
            sprite.src = `assets/images/sprites/${english}.png`;
        };
        sprite.src = `assets/images/sprites/${english}-mega.png`;
    }

    // Copy-to-Showdown button.
    const copyIcon = details.querySelector('.copy-icon');
    const feedback = details.querySelector('.copy-feedback');
    copyIcon.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(await showdownExport(set, speciesData));
            feedback.hidden = false;
            setTimeout(() => { feedback.hidden = true; }, 1500);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    });

    container.appendChild(details);
}

function typeIconHtml(type, isTera = false) {
    const path = isTera ? `types/tera/${type.toLowerCase()}` : `types/${type.toLowerCase()}`;
    return `<img src="assets/images/${path}.png" alt="${type}" class="type-icon" onerror="this.remove()" />`;
}

// Showdown (and similar tools) only accept English, so the export always uses
// the English sets file — every localized set has an English counterpart with
// the same (English species name, set number) key.
async function showdownExport(set, speciesData) {
    const englishAbilities = (speciesData['abilities-en'] || '').split(', ');
    let englishSet = set;
    if (state.language !== 'en') {
        const englishSets = await loadSets(state.variant, 'en');
        englishSet = englishSets.find(s =>
            s.species === speciesData.en && s.setNumber === set.setNumber) || set;
    }
    return showdownFormat(englishSet, englishAbilities);
}

function showdownFormat(set, abilities) {
    const lines = [
        set.item && set.item !== 'None' ? `${set.species} @ ${set.item}` : set.species,
        `Ability: ${abilities[0] ?? ''}`,
        `${set.nature} Nature`,
    ];
    if (set.EVs) lines.splice(2, 0, `EVs: ${set.EVs.split(', ').join(' / ')}`);
    if (set.tera) lines.splice(1, 0, `Tera Type: ${set.tera}`);
    for (const move of [set.move1, set.move2, set.move3, set.move4]) {
        if (move) lines.push(`- ${move}`);
    }
    return lines.join('\n');
}

/* ---------- resets & visibility ---------- */

// Clears one side's slot selections and set panels (keeps the trainer).
export function resetSlotsOfSide(side) {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        if (sides() > 1 && slotSide(state.mode, slot) !== side) continue;
        state.activeSets[slot] = null;
        const $menu = $(`#pokemon-menu-${slot}`);
        if ($menu.hasClass('select2-hidden-accessible')) {
            $menu.val('').trigger('change.select2');
        }
        document.getElementById(`pokemon-sets-${slot}`).innerHTML = '';
    }
    highlightSelectedSprites();
}

export function resetPokemonUI() {
    state.activeSets = {};
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const $menu = $(`#pokemon-menu-${slot}`);
        if ($menu.hasClass('select2-hidden-accessible')) {
            $menu.val('').trigger('change.select2');
        }
        document.getElementById(`pokemon-sets-${slot}`).innerHTML = '';
    }
    highlightSelectedSprites();
}

export function resetSelections() {
    state.trainers = { 1: null, 2: null };
    for (let side = 1; side <= MAX_SIDES; side++) {
        syncTrainerDropdowns(side, null);
    }
    resetPokemonUI();
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        document.getElementById(`slot-species-${slot}`).innerHTML = '';
    }
    updateLayout();
}

// Shows/hides the side-2 menus and the slot containers for the current mode.
export function updateLayout() {
    const multi = sides() > 1;
    document.getElementById('trainer-side-2').style.display = multi ? '' : 'none';
    document.getElementById('quote-side-2').style.display = multi ? '' : 'none';

    const total = modeSlots(state.mode);
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const container = document.getElementById(`pokemon-menu-container-${slot}`);
        const side = slotSide(state.mode, slot);
        const visible = slot <= total && Boolean(state.trainers[multi ? side : 1]);
        container.style.display = visible ? 'block' : 'none';
        container.classList.remove('w-1', 'w-2', 'w-3', 'side-2');
        if (visible) {
            container.classList.add(`w-${total}`);
            if (multi && side === 2) container.classList.add('side-2');
        }
    }
}

export function applyStaticTranslations() {
    // The late filter is a visual "<N>+" pill; the translation is its tooltip.
    const lateBtn = document.getElementById('late-filter');
    if (lateBtn) lateBtn.title = t('lateFilter', 'Late trainers only');
}
