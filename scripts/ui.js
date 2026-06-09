// All DOM rendering: dropdowns, species list, set tables and set details.

import { state } from './state.js';
import { loadSets } from './data.js';

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

export function flagTemplate(option) {
    if (!option.id) return option.text;
    return $('<span></span>')
        .append($('<img>').attr('src', `assets/images/flags/${option.id}.png`).addClass('flag-icon'))
        .append(document.createTextNode(' ' + option.text));
}

export function initSelect2(selector, { placeholder, template, containerClass }) {
    const $el = $(selector);
    if ($el.hasClass('select2-hidden-accessible')) {
        $el.select2('destroy');
    }
    $el.select2({
        placeholder,
        templateResult: template,
        templateSelection: template,
        width: '100%',
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

/* ---------- trainer & quote dropdowns ---------- */

export function populateTrainerDropdown(onSelect) {
    const $dropdown = $('#trainer-dropdown').empty();
    const placeholder = t('trainerDropdownPlaceholder', 'Trainer');
    $dropdown.append(`<option value="" disabled selected></option>`);

    const trainers = [...state.data.trainers].sort((a, b) => a.name.localeCompare(b.name));
    for (const trainer of trainers) {
        const option = new Option(trainer.name, trainer.name, false, false);
        $(option).attr('data-icon', trainer.sprite);
        $dropdown.append(option);
    }

    initSelect2('#trainer-dropdown', {
        placeholder,
        template: trainerTemplate,
        containerClass: 'select2-container--trainer',
    });

    $dropdown.off('select2:select').on('select2:select', event => {
        const trainer = state.data.trainers.find(tr => tr.name === event.params.data.id);
        onSelect(trainer);
    });
}

export function populateQuoteDropdown(onSelect) {
    const $dropdown = $('#quote-dropdown').empty();
    const placeholder = t('quoteDropdownPlaceholder', 'Quote');
    $dropdown.append(`<option value="" disabled selected></option>`);

    const trainers = [...state.data.trainers].sort((a, b) => a.quote.localeCompare(b.quote));
    for (const trainer of trainers) {
        $dropdown.append(new Option(trainer.quote, trainer.name, false, false));
    }

    initSelect2('#quote-dropdown', { placeholder, template: textTemplate });

    $dropdown.off('select2:select').on('select2:select', event => {
        const trainer = state.data.trainers.find(tr => tr.name === event.params.data.id);
        onSelect(trainer);
    });
}

// Keep both dropdowns showing the selected trainer without re-firing events.
export function syncTrainerDropdowns(trainerName) {
    $('#trainer-dropdown').val(trainerName).trigger('change.select2');
    $('#quote-dropdown').val(trainerName).trigger('change.select2');
}

/* ---------- species list & pokémon menus ---------- */

export function renderSpeciesList(trainer, onPick) {
    const list = document.getElementById('pokemon-list');
    list.innerHTML = '';

    for (const species of trainer.species.split(', ')) {
        if (!dexEntry(species)) continue;
        const img = document.createElement('img');
        img.src = minispriteUrl(species);
        img.alt = species;
        img.classList.add('pokemon-sprite');
        img.onerror = () => img.remove();
        img.onclick = () => onPick(species);
        list.appendChild(img);
    }
}

export function populatePokemonMenus(trainer, onSelect) {
    const species = trainer.species.split(', ')
        .filter(sp => dexEntry(sp))
        .sort((a, b) => a.localeCompare(b));

    for (const slot of [1, 2]) {
        const $menu = $(`#pokemon-menu-${slot}`).empty();
        $menu.append(new Option('', '', true, true));
        for (const sp of species) {
            const option = new Option(sp, sp, false, false);
            $(option).attr('data-icon', minispriteUrl(sp));
            $menu.append(option);
        }
        initSelect2(`#pokemon-menu-${slot}`, { placeholder: 'Pokémon', template: spriteTemplate });
        $menu.off('select2:select').on('select2:select', event => {
            onSelect(slot, event.params.data.id);
        });
    }
}

export function highlightSelectedSprites() {
    const selected = [$('#pokemon-menu-1').val(), $('#pokemon-menu-2').val()];
    document.querySelectorAll('.pokemon-sprite').forEach(img => {
        img.classList.toggle('selected', selected.includes(img.alt));
    });
}

/* ---------- sets table ---------- */

export function showPokemonSets(slot, species) {
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.innerHTML = '';

    const trainer = state.trainer;
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
        row.appendChild(textCell(set.speed));

        row.onclick = () => {
            state.activeSets[slot] = set;
            showSetDetails(slot, set);
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
    for (const slot of [1, 2]) {
        const container = document.getElementById(`pokemon-sets-${slot}`);
        const active = state.activeSets[slot];
        container.querySelectorAll('.set-row').forEach(row => {
            row.classList.toggle('selected',
                Boolean(active) && row.dataset.setNumber == active.setNumber);
        });
    }
}

/* ---------- set details ---------- */

function showSetDetails(slot, set) {
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
            <div class="moves">
                - ${set.move1}<br/>
                - ${set.move2}<br/>
                - ${set.move3}<br/>
                - ${set.move4}
            </div>
            <div class="separator"></div>
            <div class="speed">
                <img src="assets/images/speed.png" alt="Speed" class="speed-icon" />
                ${set.speed}
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
                <img src="assets/images/copy.png" alt="Copy set" title="Copy set (Showdown format)" class="copy-icon" />
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
        const englishSets = await loadSets(state.facility, 'en');
        englishSet = englishSets.find(s =>
            s.species === speciesData.en && s.setNumber === set.setNumber) || set;
    }
    return showdownFormat(englishSet, englishAbilities);
}

function showdownFormat(set, abilities) {
    const lines = [
        set.item && set.item !== 'None' ? `${set.species} @ ${set.item}` : set.species,
        `Ability: ${abilities[0] ?? ''}`,
        `EVs: ${set.EVs.split(', ').join(' / ')}`,
        `${set.nature} Nature`,
    ];
    if (set.tera) lines.splice(1, 0, `Tera Type: ${set.tera}`);
    for (const move of [set.move1, set.move2, set.move3, set.move4]) {
        if (move) lines.push(`- ${move}`);
    }
    return lines.join('\n');
}

/* ---------- resets & visibility ---------- */

export function resetPokemonUI() {
    state.activeSets = { 1: null, 2: null };
    for (const slot of [1, 2]) {
        const $menu = $(`#pokemon-menu-${slot}`);
        if ($menu.hasClass('select2-hidden-accessible')) {
            $menu.val('').trigger('change.select2');
        }
        document.getElementById(`pokemon-sets-${slot}`).innerHTML = '';
    }
    highlightSelectedSprites();
}

export function resetSelections() {
    state.trainer = null;
    syncTrainerDropdowns('');
    resetPokemonUI();
    document.getElementById('pokemon-list').innerHTML = '';
    updateMenuVisibility();
}

// Shows/hides the two pokémon menu containers based on mode + trainer selection.
export function updateMenuVisibility() {
    const container1 = document.getElementById('pokemon-menu-container-1');
    const container2 = document.getElementById('pokemon-menu-container-2');
    const hasTrainer = Boolean(state.trainer);
    const doubles = state.mode === 'doubles';

    container1.style.display = hasTrainer ? 'block' : 'none';
    container2.style.display = hasTrainer && doubles ? 'block' : 'none';
    container1.classList.toggle('single', !doubles);
    container1.classList.toggle('double', doubles);
    container2.classList.toggle('double', doubles);
}

export function applyStaticTranslations() {
    const title = document.querySelector('#settings-modal h2');
    if (title) title.textContent = t('settings', 'Settings');
}
