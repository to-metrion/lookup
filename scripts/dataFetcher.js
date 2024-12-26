function populateTrainerDropdown(data) {
    const trainerDropdown = $('#trainer-dropdown');

    // Clear previous options
    trainerDropdown.empty();

    const language = localStorage.getItem('selectedLanguage') || 'en';

    // Add default placeholder
    trainerDropdown.append('<option value="" disabled selected>' + translations.trainerDropdownPlaceholder[language] + '</option>');

    if (!data || !data.trainers) {
        console.error('Trainer data is undefined or invalid:', data);
        return;
    }

    // Sort trainer options alphabetically
    data.trainers.sort((a, b) => a.name.localeCompare(b.name));

    // Add trainer options
    data.trainers.forEach(trainer => {
        const trainerName = trainer.name;
        const option = new Option(trainerName, trainerName, false, false);
        $(option).attr('data-icon', trainer.sprite);
        trainerDropdown.append(option);
    });

    // Initialize Select2 with custom template for displaying sprites and auto focus
    initializeSelect2WithAutoFocus('#trainer-dropdown', formatTrainerOption, formatTrainerSelection, translations.trainerDropdownPlaceholder[language], 'select2-container--trainer');

    // Remove previous event listener before adding a new one
    trainerDropdown.off('select2:select');
    // Handle trainer selection
    trainerDropdown.on('select2:select', function (e) {
        const selectedTrainerName = e.params.data.text;
        const selectedTrainer = data.trainers.find(trainer => trainer.name === selectedTrainerName);
        selectTrainer(selectedTrainer);
    });
}

function populateQuoteDropdown(data) {
    const quoteDropdown = $('#quote-dropdown');

    // Clear previous options
    quoteDropdown.empty();

    const language = localStorage.getItem('selectedLanguage') || 'en';

    // Add default placeholder
    const placeholder = translations.quoteDropdownPlaceholder[language] || 'Quote';
    quoteDropdown.append(`<option value="" disabled selected>${placeholder}</option>`);

    if (!data || !data.trainers) {
        console.error('Trainer data is undefined or invalid:', data);
        return;
    }

    // Sort trainer options alphabetically by quote
    data.trainers.sort((a, b) => a.quote.localeCompare(b.quote));

    // Add trainer quotes
    data.trainers.forEach(trainer => {
        const option = new Option(trainer.quote, trainer.name, false, false);
        quoteDropdown.append(option);
    });

    initializeSelect2WithAutoFocus('#quote-dropdown', formatQuoteOption, formatQuoteSelection, placeholder, 'select2-container--default');

    // Remove previous event listener before adding a new one
    quoteDropdown.off('select2:select');
    // Handle quote selection
    quoteDropdown.on('select2:select', function (e) {
        const selectedTrainerName = e.params.data.id;
        const selectedTrainer = data.trainers.find(trainer => trainer.name === selectedTrainerName);
        selectTrainer(selectedTrainer);
        $('#trainer-dropdown').val(selectedTrainerName).trigger('change');
    });
}

function formatTrainerOption(trainer) {
    if (!trainer.id) return trainer.text;
    const spriteUrl = $(trainer.element).data('icon');
    return $(`<span><img src="${spriteUrl}" class="trainer-sprite-select2" /> ${trainer.text}</span>`);
}

function formatTrainerSelection(trainer) {
    if (!trainer.id) return trainer.text;
    const spriteUrl = $(trainer.element).data('icon');
    return $(`<span><img src="${spriteUrl}" class="trainer-sprite-select2" /> ${trainer.text}</span>`);
}

function formatQuoteOption(quote) {
    if (!quote.id) return quote.text;
    return $(`<span>${quote.text}</span>`);
}

function formatQuoteSelection(quote) {
    if (!quote.id) return quote.text;
    return $(`<span>${quote.text}</span>`);
}

function loadFacilityData() {
    const facility = document.getElementById("facility-select").value || 'tree';
    const language = document.getElementById("language-select").value || 'en';

    // Update language options based on the selected facility
    loadLanguageOptions(facility, false);

    const trainerDataUrl = `data/${facility}-trainers-${language}.json`;
    const setDataUrl = `data/${facility}-sets-${language}.json`;
    const pokedexDataUrl = getPokedexFileUrl(facility);
    const naturesDataUrl = `data/natures.json`;
    const itemsDataUrl = `data/items.json`;

    fetch(trainerDataUrl)
        .then(response => response.json())
        .then(data => {
            populateTrainerDropdown(data);
            populateQuoteDropdown(data);
            window.trainers = data.trainers;
        })
        .catch(error => console.error('Error fetching trainer data:', error));

    fetch(setDataUrl)
        .then(response => response.json())
        .then(data => {
            window.pokemonSets = data.sets;
        })
        .catch(error => console.error('Error fetching set data:', error));

    fetch(pokedexDataUrl)
        .then(response => response.json())
        .then(data => {
            window.pokedex = data.pokedex;
        })
        .catch(error => console.error('Error fetching pokedex data:', error));

    fetch(naturesDataUrl)
        .then(response => response.json())
        .then(data => {
            window.natures = data.natures;
        })
        .catch(error => console.error('Error fetching natures data:', error));

    fetch(itemsDataUrl)
        .then(response => response.json())
        .then(data => {
            window.items = data.items;
        })
        .catch(error => console.error('Error fetching items data:', error));

    resetSelections();

    // Save selected facility to localStorage
    localStorage.setItem('selectedFacility', facility);
}

function handleFacilityChange() {
    window.facilityChanged = true;
    loadFacilityData();
    window.facilityChanged = false;
}

document.getElementById("facility-select").addEventListener("change", handleFacilityChange);

function resetPokemonSelections() {
    $('#pokemon-menu-1').val(null).trigger('change');
    $('#pokemon-menu-2').val(null).trigger('change');
    $('#pokemon-sets-1').empty();
    $('#pokemon-sets-2').empty();
}

function selectTrainer(trainer) {
    if (!trainer) {
        console.error('Invalid trainer selected:', trainer);
        return;
    }

    const trainerName = trainer.name;
    if (!trainerName) {
        console.error('Trainer name not found:', trainer);
        return;
    }

    $('#trainer-dropdown').val(trainerName).trigger('change.select2');
    $('#quote-dropdown').val(trainerName).trigger('change.select2');

    populatePokemonDropdowns(trainer);
    resetPokemonSelections();

    const pokemonList = document.getElementById("pokemon-list");
    pokemonList.innerHTML = '';

    const language = document.getElementById('language-select').value || 'en';
    const speciesArray = trainer.species.split(', ');

    speciesArray.forEach(species => {
        // Translate species name from current language to English
        const speciesData = window.pokedex.find(pokemon => pokemon[language] === species);
        if (speciesData) {
            const englishSpeciesName = speciesData.en.toLowerCase();
            const img = document.createElement("img");
            img.src = `assets/images/minisprites/${englishSpeciesName}.png`;
            img.alt = species;
            img.classList.add('pokemon-sprite');
            img.onclick = () => selectPokemon(species);
            pokemonList.appendChild(img);
        }
    });

    // Show Pokémon selection menus based on mode
    const mode = localStorage.getItem('mode') || 'singles';
    if (mode === 'doubles') {
        document.getElementById('pokemon-menu-container-1').style.display = 'block';
        document.getElementById('pokemon-menu-container-2').style.display = 'block';
    } else {
        document.getElementById('pokemon-menu-container-1').style.display = 'block';
        document.getElementById('pokemon-menu-container-2').style.display = 'none';
        document.getElementById('pokemon-menu-container-1').classList.add('single-mode');
    }

    // Highlight selected Pokémon mini sprites
    highlightSelectedSprites();
}

function initializeSelect2WithAutoFocus(elementId, formatResult, formatSelection, placeholder, className) {
    const element = $(elementId).select2({
        placeholder: placeholder,
        templateResult: formatResult,
        templateSelection: formatSelection,
        width: '100%'
    }).data('select2').$container.addClass(className);

    $(elementId).on('select2:open', function() {
        setTimeout(() => {
            const searchField = document.querySelector('.select2-container--open .select2-search__field');
            if (searchField) {
                searchField.focus();
            }
        }, 100);
    });
}

function populatePokemonDropdowns(trainer) {
    const pokemonMenu1 = $('#pokemon-menu-1');
    const pokemonMenu2 = $('#pokemon-menu-2');

    pokemonMenu1.empty();
    pokemonMenu2.empty();

    pokemonMenu1.append(new Option('Pokémon', '', true, true));
    pokemonMenu2.append(new Option('Pokémon', '', true, true));

    const language = document.getElementById("language-select").value || 'en';
    const speciesArray = trainer.species.split(', ').sort((a, b) => a.localeCompare(b));

    speciesArray.forEach(species => {
        const speciesData = window.pokedex.find(pokemon => pokemon[language] === species);
        if (speciesData) {
            const englishSpeciesName = speciesData.en.toLowerCase();
            const option1 = new Option(species, species, false, false);
            $(option1).attr('data-icon', `assets/images/minisprites/${englishSpeciesName}.png`);
            pokemonMenu1.append(option1);

            const option2 = new Option(species, species, false, false);
            $(option2).attr('data-icon', `assets/images/minisprites/${englishSpeciesName}.png`);
            pokemonMenu2.append(option2);
        }
    });

    initializeSelect2WithAutoFocus('#pokemon-menu-1', formatPokemonOption, formatPokemonSelection, "Pokémon", 'select2-container--default');
    initializeSelect2WithAutoFocus('#pokemon-menu-2', formatPokemonOption, formatPokemonSelection, "Pokémon", 'select2-container--default');

    pokemonMenu1.on('select2:select', function (e) {
        const selectedSpecies = e.params.data.text;
        showPokemonSets(pokemonMenu1, selectedSpecies, 'pokemon-sets-1');
        highlightSelectedSprites();
    });

    pokemonMenu2.on('select2:select', function (e) {
        const selectedSpecies = e.params.data.text;
        showPokemonSets(pokemonMenu2, selectedSpecies, 'pokemon-sets-2');
        highlightSelectedSprites();
    });
}

function formatPokemonOption(pokemon) {
    if (!pokemon.id) return pokemon.text;
    const spriteUrl = $(pokemon.element).data('icon');
    return $(`<span><img src="${spriteUrl}" class="pokemon-sprite-select2" /> ${pokemon.text}</span>`);
}

function formatPokemonSelection(pokemon) {
    if (!pokemon.id) return pokemon.text;
    const spriteUrl = $(pokemon.element).data('icon');
    return $(`<span><img src="${spriteUrl}" class="pokemon-sprite-select2" /> ${pokemon.text}</span>`);
}

function selectPokemon(species) {
    const pokemonMenu1 = $('#pokemon-menu-1');
    const pokemonMenu2 = $('#pokemon-menu-2');
    const mode = localStorage.getItem('mode') || 'singles';

    if (mode === 'singles') {
        pokemonMenu1.val(species).trigger('change');
        showPokemonSets(pokemonMenu1, species, 'pokemon-sets-1');
    } else {
        if (pokemonMenu1.val() === '') {
            pokemonMenu1.val(species).trigger('change');
            showPokemonSets(pokemonMenu1, species, 'pokemon-sets-1');
        } else {
            pokemonMenu2.val(species).trigger('change');
            showPokemonSets(pokemonMenu2, species, 'pokemon-sets-2');
        }
    }

    highlightSelectedSprites();
}

function highlightSelectedSprites() {
    const selectedSpecies1 = $('#pokemon-menu-1').val();
    const selectedSpecies2 = $('#pokemon-menu-2').val();

    document.querySelectorAll('.pokemon-sprite').forEach(img => {
        if (img.alt === selectedSpecies1 || img.alt === selectedSpecies2) {
            img.classList.add('selected');
        } else {
            img.classList.remove('selected');
        }
    });
}

let activeSets = {
    'pokemon-sets-1': null,
    'pokemon-sets-2': null
};

function showPokemonSets(menu, species, setsContainerId) {
    const setsContainer = document.getElementById(setsContainerId);
    if (!setsContainer) {
        console.error('Sets container not found:', setsContainerId);
        return;
    }

    setsContainer.innerHTML = '';

    const trainerName = $('#trainer-dropdown').val();
    const trainer = window.trainers.find(trainer => trainer.name === trainerName);
    if (!trainer) {
        console.error('Trainer not found:', trainerName);
        return;
    }

    const setNumbers = trainer.roster
        .split(', ')
        .filter(setName => {
            const [setSpecies, setNumber] = setName.split(/-(?=\d+$)/);
            return setSpecies === species;
        })
        .map(setName => parseInt(setName.split('-').pop()));

    const sets = window.pokemonSets.filter(set => set.species === species && setNumbers.includes(set.setNumber));

    const table = document.createElement('table');
    table.className = 'sets-table';

    const language = document.getElementById("language-select").value || 'en';

    sets.forEach((set, index) => {
        const row = document.createElement('tr');
        row.className = 'set-row';
        if (index % 2 === 0) {
            row.className += ' even-row';
        } else {
            row.className += ' odd-row';
        }

        row.onclick = () => {
            set.setsContainerId = setsContainerId;
            showSetDetails(set, setsContainerId);
            activeSets[setsContainerId] = set;
            updateHighlightedRows();
        };

        const setNumberCell = document.createElement('td');
        setNumberCell.textContent = set.setNumber;
        row.appendChild(setNumberCell);

        const itemCell = document.createElement('td');
        const itemData = window.items.find(item => item[language] === set.item);
        if (itemData) {
            const englishItemName = itemData.en.toLowerCase().replace(' ', '');
            const itemImg = document.createElement('img');
            itemImg.src = `assets/images/items/${englishItemName}.png`;
            itemImg.alt = set.item;
            itemCell.appendChild(itemImg);
        }
        row.appendChild(itemCell);

        const natureCell = document.createElement('td');
        natureCell.textContent = set.nature;
        row.appendChild(natureCell);

        const move1Cell = document.createElement('td');
        move1Cell.textContent = set.move1;
        row.appendChild(move1Cell);

        const move2Cell = document.createElement('td');
        move2Cell.textContent = set.move2;
        row.appendChild(move2Cell);

        const move3Cell = document.createElement('td');
        move3Cell.textContent = set.move3;
        row.appendChild(move3Cell);

        const move4Cell = document.createElement('td');
        move4Cell.textContent = set.move4;
        row.appendChild(move4Cell);

        const speedCell = document.createElement('td');
        speedCell.textContent = set.speed;
        row.appendChild(speedCell);

        table.appendChild(row);
    });

    setsContainer.appendChild(table);

    if (activeSets[setsContainerId]) {
        const activeSet = activeSets[setsContainerId];
        const activeRow = [...table.rows].find(row => row.querySelector('td').textContent == activeSet.setNumber);
        if (activeRow) {
            activeRow.classList.add('selected');
        }
    }
}

function updateHighlightedRows() {
    document.querySelectorAll('.set-row').forEach(row => {
        row.classList.remove('selected');
    });

    Object.values(activeSets).forEach(activeSet => {
        if (activeSet) {
            const setsContainerId = activeSet.setsContainerId;
            const setNumber = activeSet.setNumber;
            const setsContainer = document.getElementById(setsContainerId);
            if (setsContainer) {
                const activeRow = [...setsContainer.querySelectorAll('.set-row')].find(row => row.querySelector('td').textContent == setNumber);
                if (activeRow) {
                    activeRow.classList.add('selected');
                }
            }
        }
    });
}

function fetchPokedexData() {
    const facility = document.getElementById("facility-select").value || 'tree';
    const pokedexDataUrl = getPokedexFileUrl(facility);

    fetch(pokedexDataUrl)
        .then(response => response.json())
        .then(data => {
            window.pokedex = data.pokedex;
        })
        .catch(error => console.error('Error fetching pokedex data:', error));
}

function showSetDetails(set, setsContainerId) {
    const setsContainer = document.getElementById(setsContainerId);
    const detailContainerId = `${setsContainerId}-details`;
    let detailContainer = document.getElementById(detailContainerId);

    if (detailContainer) {
        detailContainer.remove();
    }

    detailContainer = document.createElement('div');
    detailContainer.id = detailContainerId;
    detailContainer.className = 'set-details';

    const language = document.getElementById("language-select").value || 'en';
    const speciesData = window.pokedex.find(pokemon => pokemon[language] === set.species);

    if (!speciesData) {
        console.error('Species data not found for:', set.species);
        return;
    }

    const englishSpeciesName = speciesData ? speciesData.en.toLowerCase() : set.species.toLowerCase();
    const type1Img = `assets/images/types/${speciesData.type1.toLowerCase()}.png`;
    const type2Img = speciesData.type2 ? `assets/images/types/${speciesData.type2.toLowerCase()}.png` : null;
    const abilities = speciesData[`abilities-${language}`].split(', ');

    let sprite = `assets/images/sprites/${englishSpeciesName}.png`;
    if (set.item.toLowerCase().endsWith('ite')) {
        const megaSprite = `assets/images/sprites/${englishSpeciesName}-mega.png`;
        if (spriteExists(megaSprite)) {
            sprite = megaSprite;
        }
    }

    const itemData = window.items.find(item => item[language] === set.item);
    const englishItemName = itemData ? itemData.en.toLowerCase().replace(' ', '') : set.item.toLowerCase().replace(' ', '');

    const natureKey = `nature-${language}`;
    const statsKey = `stats-${language}`;
    const natureData = window.natures.find(nature => nature[natureKey] === set.nature);
    const showdownFormat = getShowdownFormat(set, abilities).replace(/\n/g, '\\n').replace(/'/g, "\\'");
    const natureText = natureData ? natureData[statsKey] : '';

    detailContainer.innerHTML = `
        <div class="left-column">
            <h3 class="set-name">${set.setName}</h3>
            <div class="type-icons">
                <img src="${type1Img}" alt="${speciesData.type1}" class="type-icon" />
                ${type2Img ? `<img src="${type2Img}" alt="${speciesData.type2}" class="type-icon" />` : ''}
            </div>
            <img src="${sprite}" alt="${set.species}" class="large-sprite" />
            <div class="item">
                <img src="assets/images/items/${englishItemName}.png" alt="${set.item}" class="item-icon" />
                ${set.item}
            </div>
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
        </div>
    `;

    setsContainer.appendChild(detailContainer);
}

function initializeSettingsSelect2() {
    $('#facility-select').select2({
        placeholder: "Select Facility",
        width: '100%'
    });

    $('#language-select').select2({
        templateResult: formatLanguageOption,
        templateSelection: formatLanguageSelection,
        placeholder: "Select Language",
        width: '100%'
    });
}

function spriteExists(spriteUrl) {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', spriteUrl, false);
    xhr.send();

    return xhr.status !== 404;
}

function getShowdownFormat(set, abilities) {
    return `
${set.species} @ ${set.item}
Ability: ${abilities[0]}
EVs: ${set.EVs.split(', ').join(' / ')}
${set.nature} Nature
- ${set.move1}
- ${set.move2}
- ${set.move3}
- ${set.move4}
    `.trim();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}