let translations = {};

function loadTranslations() {
    return fetch('data/translations.json')
        .then(response => response.json())
        .then(data => {
            translations = data;
        })
        .catch(error => console.error('Error loading translations:', error));
}

document.addEventListener("DOMContentLoaded", function() {
    loadTranslations().then(() => {
        loadFacilityOptions();
        initializeSettingsSelect2();


        // Load saved settings from localStorage
        loadSavedSettings();

        // Load default data
        loadFacilityData();
        fetchPokedexData();
    }).catch(error => console.error('Error loading translations in settings.js:', error));

    // Fetch natures data and store it globally
    fetch('data/natures.json')
        .then(response => response.json())
        .then(data => {
            window.natures = data.natures;
        })
        .catch(error => console.error('Error fetching natures data:', error));

    // Initialize mode
    initializeMode();

    // Hide Pokémon selection menus initially
    document.getElementById('pokemon-menu-container-1').style.display = 'none';
    document.getElementById('pokemon-menu-container-2').style.display = 'none';

    // Close dropdowns when clicking elsewhere on the page
    $(document).click(function(event) {
        const target = $(event.target);
        if (!target.closest('.select2-container').length && target.attr('id') !== 'mode-toggle') {
            $('.select2').each(function() {
                const select2Instance = $(this).data('select2');
                if (select2Instance) {
                    $(this).select2('close');
                }
            });
        }
    });

    if (isMobileDevice()) {
        document.querySelector('.mode-toggle-container').style.display = 'none';
        const modeToggle = document.getElementById('mode-toggle');
        if (modeToggle.checked) {
            modeToggle.checked = false;
            toggleMode();
        }
    }
});

function openSettings() {
    document.getElementById("settings-modal").style.display = "block";
}

function closeSettings() {
    document.getElementById("settings-modal").style.display = "none";
}

function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

function toggleMode() {
    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const mode = modeToggle.checked ? 'doubles' : 'singles';

    localStorage.setItem('mode', mode);

    const container1 = document.getElementById('pokemon-menu-container-1');
    const container2 = document.getElementById('pokemon-menu-container-2');

    document.body.classList.remove('singles-mode', 'doubles-mode');
    document.body.classList.add(`${mode}-mode`);

    if (mode === 'doubles') {
        modeLabel.textContent = '⚁';
        container1.classList.remove('single');
        container1.classList.add('double');
        container2.classList.add('double');
        container2.style.display = 'block';

        container1.style.width = '50%';
        container2.style.width = '50%';

        const trainerSelected = $('#trainer-dropdown').val();
        if (!trainerSelected) {
            container2.style.display = 'none';
        }
    } else {
        modeLabel.textContent = '⚀';
        container1.classList.remove('double');
        container2.classList.remove('double');
        container1.classList.add('single');
        container2.style.display = 'none';

        container1.style.width = '100%';
    }
}

function resetSelections() {
    $('#trainer-dropdown').val(null).trigger('change');
    $('#quote-dropdown').val(null).trigger('change');
    $('#pokemon-menu-1').val(null).trigger('change');
    $('#pokemon-menu-2').val(null).trigger('change');
    $('#pokemon-sets-1').empty();
    $('#pokemon-sets-2').empty();
    $('#pokemon-list').empty();

    // Hide Pokémon selection menus
    document.getElementById('pokemon-menu-container-1').style.display = 'none';
    document.getElementById('pokemon-menu-container-2').style.display = 'none';
}

// Ensure resetSelections is called when changing language
document.getElementById("language-select").addEventListener('change', function() {
    loadLanguageData();
    resetSelections();
});

function initializeMode() {
    const modeToggle = document.getElementById('mode-toggle');
    const mode = localStorage.getItem('mode');

    if (mode === 'doubles') {
        modeToggle.checked = true;
        toggleMode();
    } else {
        modeToggle.checked = false;
        toggleMode();
    }
}

function applyTranslations(language) {
    return new Promise((resolve, reject) => {
        try {
            const trainerDropdownPlaceholder = translations.trainerDropdownPlaceholder?.[language] || 'Trainer';
            const quoteDropdownPlaceholder = translations.quoteDropdownPlaceholder?.[language] || 'Quote';
            const settingsTitle = translations.settings?.[language] || 'Settings';

            document.getElementById('trainer-dropdown').setAttribute('placeholder', trainerDropdownPlaceholder);
            $('#trainer-dropdown').select2({
                placeholder: trainerDropdownPlaceholder
            });

            document.getElementById('quote-dropdown').setAttribute('placeholder', quoteDropdownPlaceholder);
            $('#quote-dropdown').select2({
                placeholder: quoteDropdownPlaceholder
            });

            const settingsTitleElement = document.querySelector('#settings-modal h2');
            if (settingsTitleElement) {
                settingsTitleElement.textContent = settingsTitle;
            }

            resolve(); // Resolve the promise once translations are applied
        } catch (error) {
            reject(error); // Reject the promise if there's an error
        }
    });
}
