function openSettings() {
    document.getElementById("settings-modal").style.display = "block";
}

function closeSettings() {
    document.getElementById("settings-modal").style.display = "none";
}

function loadFacilityOptions() {
    const facilitySelect = document.getElementById("facility-select");

    // Clear previous options
    facilitySelect.innerHTML = '';

    // Add available facilities
    const facilities = getAvailableFacilities();
    facilities.forEach(facility => {
        let option = document.createElement("option");
        option.value = facility.code;
        option.text = facility.name;
        facilitySelect.appendChild(option);
    });

    // Set default value and load languages for the first facility
    const savedFacility = localStorage.getItem('selectedFacility');
    facilitySelect.value = savedFacility || facilities[0].code;
    loadLanguageOptions(facilitySelect.value);
    loadFacilityData(); // Load data based on the default facility

    // Add event listener for facility change
    facilitySelect.addEventListener('change', function() {
        loadLanguageOptions(this.value); // Load language options for the new facility
        loadFacilityData(); // Load data based on the selected facility
    });
}

function loadLanguageOptions(facility, loadData = true) {
    const languageSelect = document.getElementById("language-select");

    // Clear previous options
    languageSelect.innerHTML = '';

    // Add available languages for the selected facility
    const languages = getAvailableLanguages(facility);
    languages.forEach(language => {
        let option = document.createElement("option");
        option.value = language.code;
        option.text = language.name;
        option.setAttribute('data-icon', `assets/images/flags/${language.code}.png`); // Set the flag image path
        languageSelect.appendChild(option);
    });

    // Set default value
    const savedLanguage = localStorage.getItem('selectedLanguage');
    languageSelect.value = savedLanguage || languages[0].code;

    // Trigger UI update by reinitializing the Select2 component
    $(languageSelect).select2({
        templateResult: formatLanguageOption,
        templateSelection: formatLanguageSelection,
        width: '100%'
    });

    // Ensure no duplicate event listeners
    languageSelect.removeEventListener('change', handleLanguageChange);
    languageSelect.addEventListener('change', handleLanguageChange);

    // Load data based on the selected language if loadData is true
    if (loadData) {
        loadLanguageData();
    }
}

function handleLanguageChange() {
    loadLanguageData();
}

function loadLanguageData() {
    const language = document.getElementById("language-select").value;

    applyTranslations(language);
    
    // Load facility data only if it was not triggered by facility change
    if (window.facilityChanged !== true) {
        loadFacilityData(); // Ensure data is loaded based on the selected language
    }
    resetSelections(); // Reset selections when the language changes

    // Save selected language to localStorage
    localStorage.setItem('selectedLanguage', language);
}

function getAvailableFacilities() {
    return [
        { code: "tree", name: "Battle Tree (USUM)" },
        { code: "subway", name: "Battle Subway" }
    ];
}

function getAvailableLanguages(facility) {
    const languageOptions = {
        "tree": [
            { code: "en", name: "English" },
            { code: "jp", name: "日本語" }
        ],
        "subway": [
            { code: "en", name: "English" }
        ]
    };
    return languageOptions[facility] || [];
}

function getPokedexFileUrl(facility) {
    const pokedexFiles = {
        "tree": "data/pokedex-7.json",
        "subway": "data/pokedex-5.json"
    };

    return pokedexFiles[facility] || "data/pokedex.json"; // Default to a generic pokedex.json if no match
}

function formatLanguageOption(language) {
    if (!language.id) {
        return language.text;
    }
    const flagUrl = `assets/images/flags/${language.id.toLowerCase()}.png`;
    const $language = $(
        `<span><img src="${flagUrl}" class="flag-icon" /> ${language.text}</span>`
    );
    return $language;
}

function formatLanguageSelection(language) {
    if (!language.id) {
        return language.text;
    }
    const flagUrl = `assets/images/flags/${language.id.toLowerCase()}.png`;
    const $language = $(
        `<span><img src="${flagUrl}" class="flag-icon" /> ${language.text}</span>`
    );
    return $language;
}

document.addEventListener("DOMContentLoaded", function() {
    loadTranslations().then(() => {
        loadFacilityOptions();
        initializeSettingsSelect2();
    }).catch(error => console.error('Error loading translations:', error));
});
