// All DOM rendering: dropdowns, species lists, set tables and set details.
//
// "Sides" model: a mode shows 1 or 2 opposing trainers (multis = 2). Each side
// owns a trainer dropdown, a quote dropdown, a species list and its Pokémon
// slot(s). Slot ownership per mode comes from slotSide() in config.js.

import { state } from './state.js';
import { speedDisplay, speedTriple, speedRange, wildLevelText, megaEntry, hallFacedLevel } from './speed.js';
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

// A species can carry a form-specific minisprite via a set's optional `minisprite`
// field (gen-2 Crystal Tower: Unown's letter is fixed by its DVs → "unown-z").
// Memoized species → override filename per data load.
let minispriteOverrideSource = null;
let minispriteOverrideMap = null;

function speciesMinispriteUrl(species) {
    if (minispriteOverrideSource !== state.data.sets) {
        minispriteOverrideSource = state.data.sets;
        minispriteOverrideMap = new Map();
        for (const set of state.data.sets) {
            if (set.minisprite && !minispriteOverrideMap.has(set.species)) {
                minispriteOverrideMap.set(set.species, set.minisprite);
            }
        }
    }
    const override = minispriteOverrideMap.get(species);
    return override ? `assets/images/minisprites/${override}.png` : minispriteUrl(species);
}

export function isLateTrainer(trainer) {
    return String(trainer.late ?? '').trim() === '1';
}

// Battle Factory has its OWN two-threshold filter (by trainer index), not the
// generic `late` flag: 21+ = trainers 141-300 + both Thorton (idx ≥ 140);
// 49+ = trainers 221-300 + Thorton(49) only (idx ≥ 220, minus Thorton (21)).
export function factoryLatePass(idx, trainer, cutoff) {
    if (cutoff === 21) return idx >= 140;
    if (cutoff === 49) return idx >= 220 && !(trainer.factoryBrain && trainer.battle === 21);
    return true;
}

// Trainers visible in the dropdowns, honoring the active filter.
export function trainerPool() {
    if (state.variant.factory) {
        return state.factoryLate
            ? state.data.trainers.filter((t, i) => factoryLatePass(i, t, state.factoryLate))
            : state.data.trainers;
    }
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

// Trainers usually have one sprite; the Restricted Sparring opponent carries a
// second (data-icon2) so both Master Dojo Student figures show by the name. A
// Dynamax badge (data-dmax) is appended after the name when the trainer fields
// a Pokémon that can Dynamax.
// gen-4: HGSS and Platinum share one dataset but differ in a few trainer NAMES
// and some trainer-class SPRITES. Both are resolved per the selected version
// here (no data duplication): Platinum gets the trainer's `namePt` when present,
// and a "<sprite>-pt.png" sprite that falls back to the shared HGSS file if no
// Platinum-specific art exists.
function isPlatinum() {
    return state.variant?.version === 'pt';
}

// DP reuses Platinum's trainer-class art, so it takes the "-pt" sprites too (with
// the shared HGSS file as fallback). Names/quotes are NOT shared — DP has its own.
function usesPlatinumSprites() {
    return state.variant?.version === 'pt' || state.variant?.version === 'dp';
}

export function trainerName(trainer) {
    return (isPlatinum() && trainer.namePt) ? trainer.namePt : trainer.name;
}

export function trainerQuote(trainer) {
    return (isPlatinum() && trainer.quotePt) ? trainer.quotePt : trainer.quote;
}

// Returns [src, fallbackSrc|null]: for Platinum, the -pt sprite with the shared
// sprite as fallback; otherwise just the shared sprite.
function trainerSpriteSrc(sprite) {
    if (usesPlatinumSprites() && sprite) {
        return [sprite.replace(/\.png$/, '-pt.png'), sprite];
    }
    return [sprite, null];
}

function trainerTemplate(option) {
    if (!option.id) return option.text;
    const el = $(option.element);
    const icon = el.data('icon');
    if (!icon) return option.text;
    const $span = $('<span></span>');
    const fb = el.data('icon-fb');
    const $img = $('<img>').attr('src', icon).addClass('trainer-sprite-select2');
    if (fb) $img.one('error', function () { this.src = fb; });  // -pt missing → shared
    else $img.one('error', function () { $(this).remove(); });  // missing art → no icon
    $span.append($img);
    const icon2 = el.data('icon2');
    if (icon2) {
        $span.append($('<img>').attr('src', icon2).addClass('trainer-sprite-select2'));
    }
    $span.append(document.createTextNode(' ' + option.text));
    if (el.data('dmax')) {
        $span.append($('<img>').attr('src', 'assets/images/dmax.png')
            .attr('title', 'Has a Dynamax Pokémon')
            .addClass('trainer-dmax-badge')
            .on('error', function () { $(this).remove(); }));
    }
    return $span;
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

export function initSelect2(selector, { placeholder, template, templateResult, templateSelection,
                                        containerClass, search = true,
                                        matcher, allowClear = false } = {}) {
    const $el = $(selector);
    if ($el.hasClass('select2-hidden-accessible')) {
        $el.select2('destroy');
    }
    $el.select2({
        placeholder,
        allowClear,   // shows an "×" to clear back to the placeholder
        // The duo trainer menu shows both names in the list but only its side's member
        // when selected, so result/selection templates can differ (default: same).
        templateResult: templateResult || template,
        templateSelection: templateSelection || template,
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
    // Swap button: shown only with two columns (doubles / multis). It lives on
    // <body> and is positioned via getBoundingClientRect (positionSwap) so it can
    // anchor to whichever pair of menus is relevant without layout coupling.
    if (!document.getElementById('swap-slots')) {
        const swap = document.createElement('button');
        swap.id = 'swap-slots';
        swap.type = 'button';
        swap.style.display = 'none';
        swap.setAttribute('aria-label', 'Swap sides');
        swap.innerHTML = '⇄';
        document.body.appendChild(swap);
        window.addEventListener('resize', positionSwap);
    }
    if (typeof ResizeObserver !== 'undefined' && !menus._swapObserver) {
        menus._swapObserver = new ResizeObserver(() => positionSwap());
        menus._swapObserver.observe(menus);
    }
    state.activeSets = {};
}

// Show/position the swap button (visible only with two columns). DOUBLES: centered
// between the two species menus (a `swap-gap` class shrinks them to open room).
// MULTIS: centered between the two TRAINER menus in the header — their height is
// fixed, unlike the per-side rosters whose variable height made the species-menu
// anchor jump around. Rect-based so async-loading minisprites can't misplace it.
export function positionSwap() {
    const btn = document.getElementById('swap-slots');
    if (!btn) return;
    const menus = document.getElementById('pokemon-menus');
    const trainerCont = document.querySelector('.trainer-select-container');
    // BDSP team view has its own team rendering — no column swap. Its doubles mode
    // is 2-slot, which would otherwise show the swap button (at a stale position
    // left over from a previous Multis game), so hide it and drop the gap classes.
    if (state.variant?.teamView) {
        btn.style.display = 'none';
        menus?.classList.remove('swap-gap');
        trainerCont?.classList.remove('swap-gap');
        return;
    }
    const twoColumns = modeSlots(state.mode) === 2;
    const multi = MODES[state.mode].sides > 1;
    if (!twoColumns) {
        btn.style.display = 'none';
        menus.classList.remove('swap-gap');
        trainerCont?.classList.remove('swap-gap');
        return;
    }
    menus.classList.toggle('swap-gap', !multi);          // doubles: gap the species menus
    trainerCont?.classList.toggle('swap-gap', multi);    // multis: gap the trainer menus
    const a = document.querySelector(multi
        ? '#trainer-side-1 .select2-container' : '#pokemon-menu-container-1 .select2-container');
    const b = document.querySelector(multi
        ? '#trainer-side-2 .select2-container' : '#pokemon-menu-container-2 .select2-container');
    if (!a || !b) { btn.style.display = 'none'; return; }
    // Position from layout rects when available (jsdom has none → just stay visible
    // so the smoke tests can assert visibility).
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (ra.width && rb.width) {
        // Hide in compact mode (the mode toggle is display:none ≤768px) or when the
        // two menus aren't side by side anymore (columns/trainer menus stacked) — the
        // button would otherwise float out of place. Reappears when widened.
        const modeHidden = document.getElementById('mode-control')?.offsetParent === null;
        const sideBySide = rb.left > ra.left + 4 && Math.abs(rb.top - ra.top) < ra.height;
        if (modeHidden || !sideBySide) { btn.style.display = 'none'; return; }
        btn.style.left = `${(ra.right + rb.left) / 2 + window.scrollX}px`;
        btn.style.top = `${ra.top + ra.height / 2 + window.scrollY}px`;
    }
    btn.style.display = '';
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

// Quote search ignores punctuation (and case/diacritics) so e.g. "oh you have"
// finds "Oh! You have...". Punctuation is dropped (apostrophes too) and runs of
// whitespace collapse, on BOTH the term and the option text.
const foldQuote = s => fold(s).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

function quoteMatcher(params, data) {
    const term = foldQuote(params.term);
    if (!term) return data;
    return foldQuote(data.text).includes(term) ? data : null;
}

// Set keys ("species|setNumber") whose Pokémon can Dynamax — used to badge
// trainers that field one. Memoized per data load.
let dmaxKeysSource = null;
let dmaxKeys = null;

function dmaxSetKeys() {
    if (dmaxKeysSource !== state.data.sets) {
        dmaxKeysSource = state.data.sets;
        dmaxKeys = new Set(state.data.sets
            .filter(set => set.dmax)
            .map(set => `${set.species}|${set.setNumber}`));
    }
    return dmaxKeys;
}

function trainerHasDmax(trainer) {
    if (!dmaxSetKeys().size) return false;
    return trainer.roster.split(', ').some(entry => {
        const [species, number] = entry.split(/-(?=\d+$)/);
        return dmaxSetKeys().has(`${species}|${Number(number)}`);
    });
}

export function populateTrainerDropdown(side, onSelect) {
    const $dropdown = $(`#trainer-dropdown-${side}`).empty();
    $dropdown.append(`<option value="" disabled selected></option>`);

    // gen-3 Factory (battle arrays 1-7 … 50+, then Noland) and gen-2 Crystal Tower
    // ("Level 10".."Level 100") keep their DATA order — an alphabetical sort would
    // scramble the numeric ranges ("Level 10, Level 100, Level 20, …").
    const trainers = (state.variant.factory3 || state.variant.orderedTrainers)
        ? [...trainerPool()]
        : [...trainerPool()].sort((a, b) => trainerName(a).localeCompare(trainerName(b)));
    for (const trainer of trainers) {
        const index = state.data.trainers.indexOf(trainer);
        const option = new Option(trainerName(trainer), String(index), false, false);
        const [icon, fb] = trainerSpriteSrc(trainer.sprite);
        $(option).attr('data-icon', icon);
        if (fb) $(option).attr('data-icon-fb', fb);
        if (trainer.sprite2) $(option).attr('data-icon2', trainer.sprite2);
        if (trainerHasDmax(trainer)) $(option).attr('data-dmax', '1');
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

    const trainers = [...trainerPool()].sort(
        (a, b) => trainerQuote(a).localeCompare(trainerQuote(b)));
    for (const trainer of trainers) {
        const index = state.data.trainers.indexOf(trainer);
        $dropdown.append(new Option(trainerQuote(trainer), String(index), false, false));
    }

    initSelect2(`#quote-dropdown-${side}`, {
        placeholder: sideLabel(t('quoteDropdownPlaceholder', 'Quote'), side),
        template: textTemplate,
        matcher: quoteMatcher,
    });

    $dropdown.off('select2:select').on('select2:select', event => {
        onSelect(side, state.data.trainers[Number(event.params.data.id)]);
    });
}

// Battle Pyramid wild filter: the quote menu becomes a round-quote filter, with a
// small Round + Floor filter to its right. `onChange(kind, id)` — kind 'round' (set
// from EITHER the quote or the round menu — they mirror each other) or 'floor'; id is
// the value string ('' = all). Each menu's first option is an "All …" entry.
export function populatePyramidWildFilter(onChange) {
    const rounds = state.data.rounds || [];
    const allRounds = t('pyramidAllRounds', 'All rounds');
    const allFloors = t('pyramidAllFloors', 'All floors');
    const $q = $('#pwf-quote').empty().append(new Option(allRounds, ''));
    rounds.forEach(r => $q.append(new Option(r.quote, String(r.round))));
    const $r = $('#pwf-round').empty().append(new Option(allRounds, ''));
    rounds.forEach(r => $r.append(new Option(`${t('pyramidRound', 'Round')} ${r.round}`, String(r.round))));
    const $f = $('#pwf-floor').empty().append(new Option(allFloors, ''));
    for (let i = 1; i <= 7; i++) $f.append(new Option(`${t('pyramidFloor', 'Floor')} ${i}`, String(i)));

    // Use the default (quote/Pokémon-menu) select2 style — not the big trainer style.
    // The "All …" entry is the first option (no allowClear ×, which covered the arrow).
    initSelect2('#pwf-quote', {});
    initSelect2('#pwf-round', { search: false });
    initSelect2('#pwf-floor', { search: false });
    $q.off('select2:select').on('select2:select', e => onChange('round', e.params.data.id));
    $r.off('select2:select').on('select2:select', e => onChange('round', e.params.data.id));
    $f.off('select2:select').on('select2:select', e => onChange('floor', e.params.data.id));
    syncPyramidWildFilter();
}

// Reflect state.pyramidRound/Floor into the three menus (no handler firing).
export function syncPyramidWildFilter() {
    const rv = state.pyramidRound ? String(state.pyramidRound) : '';
    const fv = state.pyramidFloor ? String(state.pyramidFloor) : '';
    $('#pwf-quote').val(rv).trigger('change.select2');
    $('#pwf-round').val(rv).trigger('change.select2');
    $('#pwf-floor').val(fv).trigger('change.select2');
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
            matcher: quoteMatcher,
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

// Battle Arena forces trainers to send their team in ENTERED order, so the brain's
// (Greta's) lineup is predictable — show her species in roster order instead of the
// usual dex sort. Applies only to brain trainers in a `fixedTeamOrder` variant.
function keepTeamOrder(trainer) {
    return Boolean(state.variant?.fixedTeamOrder && trainer?.brain);
}

function renderSpeciesListInto(slot, trainer, onPick) {
    // Argenta (battle 50) draws from the WHOLE Hall pool — too many to show as a
    // minisprite grid, so the synthetic selection sets `noMinisprites`.
    if (!trainer || trainer.noMinisprites) return;
    const container = document.getElementById(`slot-species-${slot}`);
    // trainerVisibleSpecies drops high-tier-only species at Lv 50 (gen-3), so
    // their minisprites don't show as unclickable (no sets) entries.
    const visible = trainerVisibleSpecies(trainer);
    const ordered = keepTeamOrder(trainer)   // Arena brain: keep send-out order
        ? visible : visible.sort((a, b) => dexIndex(a) - dexIndex(b));
    for (const species of ordered) {
        if (!dexEntry(species)) continue;
        const img = document.createElement('img');
        img.src = speciesMinispriteUrl(species);
        img.alt = species;
        img.dataset.slot = slot;
        img.classList.add('pokemon-sprite');
        img.onerror = () => img.remove();
        img.onclick = () => onPick(slot, species);
        // Minisprites load async and grow the list height (pushing the species menu
        // down) — reposition the swap button once each settles (doubles anchor).
        img.addEventListener('load', () => requestAnimationFrame(positionSwap));
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

// Every species that appears in the facility's sets (for trainer-less browsing).
// Memoized per data load.
let facilitySpeciesSource = null;
let facilitySpeciesList = null;

function facilitySpecies() {
    if (facilitySpeciesSource !== state.data.sets) {
        facilitySpeciesSource = state.data.sets;
        // Browse lists the facility POOL only — exclude brain-only / wild-only sets
        // (e.g. a Pike wild species with no regular set would otherwise be a dead entry).
        facilitySpeciesList = [...new Set(
            state.data.sets.filter(s => !s.brain && !s.wild).map(set => set.species))];
    }
    return facilitySpeciesList;
}

// Gen-3 Tower: "high-tier" sets (Dragonite/Tyranitar/the strongest legendary
// sets, `highTier` on the set) only appear in Open Level — at Lv 50 they're
// filtered out of rosters, browse menus and the sets panel. Always true for
// other variants.
function setAllowedAtLevel(set) {
    // RS Tower: each set belongs to the Lv50 or Lv100 mon pool; show only the active one.
    if (state.variant?.rsTower) return set.pool === (state.factoryOpen ? '100' : '50');
    return !(state.variant?.openLevel && !state.openMode && set.highTier);
}

// A trainer's selectable species, dropping any that have only high-tier sets on
// their roster when Lv 50 is active (gen-3 Tower).
function trainerVisibleSpecies(trainer) {
    const all = trainer.species.split(', ');
    if (!state.variant?.openLevel || state.openMode) return all;
    const ok = new Set();
    for (const tok of (trainer.roster || '').split(', ')) {
        const [sp, n] = tok.split(/-(?=\d+$)/);
        const set = state.data.sets.find(s => s.species === sp && s.setNumber === +n);
        if (set && setAllowedAtLevel(set)) ok.add(sp);
    }
    return all.filter(sp => ok.has(sp));
}

// Species offered in BROWSE mode (no trainer). With a late filter active (43+,
// Factory 21+/49+), restrict to species fielded by a trainer that passes the
// filter — so species only on excluded (non-late) rosters disappear too.
function browseSpecies() {
    // RS Tower: browse the active level's mon pool (Lv50 / Lv100). With the 50+ filter
    // on, restrict to the IV-31 trainers' rosters for that level.
    if (state.variant?.rsTower) {
        if (state.lateOnly) {
            const key = state.factoryOpen ? 'rosterOpen' : 'roster';
            const out = new Set();
            for (const t of trainerPool())
                for (const tok of (t[key] || '').split(', '))
                    if (tok) out.add(tok.split(/-(?=\d+$)/)[0]);
            return [...out];
        }
        const pool = state.factoryOpen ? '100' : '50';
        return [...new Set(state.data.sets.filter(s => s.pool === pool).map(s => s.species))];
    }
    const lateActive = (state.lateOnly && state.variant.lateCutoff)
        || (state.variant.factory && state.factoryLate);
    let list;
    if (!lateActive) {
        list = facilitySpecies();
    } else {
        const out = new Set();
        for (const t of trainerPool()) {
            for (const tok of (t.roster || '').split(', ')) {
                if (tok) out.add(tok.split(/-(?=\d+$)/)[0]);
            }
        }
        list = [...out];
    }
    // Gen-3 Lv 50: drop species whose only sets are high-tier (Dragonite/Tyranitar).
    if (state.variant?.openLevel && !state.openMode) {
        const allowed = new Set(state.data.sets.filter(setAllowedAtLevel).map(s => s.species));
        list = list.filter(sp => allowed.has(sp));
    }
    return list;
}

// (Re)populates every visible slot's menu — from its owning trainer's roster, or
// from ALL facility species when no trainer is selected (browse mode).
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
    const base = (trainer ? trainerVisibleSpecies(trainer) : browseSpecies())
        .filter(sp => dexEntry(sp));
    const species = keepTeamOrder(trainer)   // Arena brain: keep send-out order
        ? base : base.sort((a, b) => a.localeCompare(b));
    for (const sp of species) {
        const option = new Option(sp, sp, false, false);
        $(option).attr('data-icon', speciesMinispriteUrl(sp));
        $menu.append(option);
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

// gen-4 Frontier: the IV used for a slot's sets comes from the trainer fielding
// it — the trainer on the slot's side (so multis can show two IVs at once).
// null for non-trainer-IV variants or browse mode (no trainer on that side).
function ivForSlot(slot) {
    if (!state.variant.trainerIVs) return null;
    const trainer = state.trainers[slotSide(state.mode, slot)];
    if (!trainer) return null;
    // Battle Dome 3-IV bug: every non-brain trainer's Pokémon use `forcedIV` (3),
    // regardless of their tier IV; the brain (Tucker) keeps his own iv (20/31).
    if (state.variant.forcedIV != null && !trainer.brain) return state.variant.forcedIV;
    return trainer.iv ?? null;
}

export function showPokemonSets(slot, species) {
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.innerHTML = '';

    // With a trainer, show only the sets on their roster; without one (browse
    // mode), show every set the species has in this facility.
    const trainer = state.trainers[slotSide(state.mode, slot)];
    let sets;
    if (trainer) {
        // Roster entries look like "Species-Name-3": split on the final "-<number>".
        const setNumbers = trainer.roster.split(', ')
            .map(entry => entry.split(/-(?=\d+$)/))
            .filter(([rosterSpecies]) => rosterSpecies === species)
            .map(([, setNumber]) => parseInt(setNumber, 10));
        sets = state.data.sets.filter(set =>
            set.species === species && setNumbers.includes(set.setNumber));
    } else {
        // Browse (no trainer): show every set the species has — except brain-only
        // (Anabel's custom teams) and wild-only (Pike) sets, which appear only when
        // their owner (the brain / the "Wild Pokémon" entry) is selected.
        sets = state.data.sets.filter(set => set.species === species && !set.brain && !set.wild);
    }
    sets = sets.filter(setAllowedAtLevel);   // gen-3 Lv 50: hide Open-only sets

    const list = document.createElement('div');
    list.className = 'sets-table';

    sets.forEach((set, index) => {
        const row = document.createElement('div');
        row.className = `set-row ${index % 2 === 0 ? 'even-row' : 'odd-row'}`;
        row.dataset.setNumber = set.setNumber;

        row.appendChild(setNumCell(set));
        row.appendChild(itemCell(set.item));
        // DP randomizes natures → don't list one (frees space for the 3-way speed).
        // Pike wild Pokémon also have no fixed nature (random) → blank nature cell.
        // Gen 2 has no natures at all → drop the column entirely.
        if (!state.variant?.randomNature && state.variant?.gen !== 2)
            row.appendChild(textCell(set.wild ? '' : set.nature, 'set-nature'));
        row.appendChild(movesCell(set));
        row.appendChild(speedCell(set, ivForSlot(slot)));

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

        list.appendChild(row);
    });

    container.appendChild(list);
    updateHighlightedRows();

    // QoL: if exactly one set is in the pool (always in Hall / Restricted
    // Sparring, and whenever a trainer fields a single set of the species),
    // open its details automatically — saves a click.
    if (sets.length === 1) {
        state.activeSets[slot] = sets[0];
        showSetDetails(slot, sets[0]);
        updateHighlightedRows();
    }

    fitMoveGrids(container);
    if (typeof ResizeObserver !== 'undefined' && !container._movesObserver) {
        container._movesObserver = new ResizeObserver(() => fitMoveGrids(container));
        container._movesObserver.observe(container);
    }
}

// Move grids default to one 1×4 line; if ANY name in the slot would be
// ellipsis-truncated, every row in the slot stacks to 2×2 (uniformly, so the
// table doesn't mix flat and stacked rows). Measured against the real
// rendered names, so localized lengths are handled exactly.
function fitMoveGrids(container) {
    const grids = [...container.querySelectorAll('.set-moves')];
    if (!grids.length) return;
    grids.forEach(grid => grid.classList.remove('stacked'));
    const tight = grids.some(grid =>
        [...grid.querySelectorAll('.set-move > span:last-child')]
            .some(span => span.scrollWidth > span.clientWidth));
    if (tight) grids.forEach(grid => grid.classList.add('stacked'));
}

// Localized sets resolve move types through their English counterpart set
// (same English species + set number; moves match by position).
function enCounterpart(set) {
    if (state.language === 'en') return set;
    const english = dexEntry(set.species)?.en;
    return state.data.enSets.find(s =>
        s.species === english && s.setNumber === set.setNumber) ?? set;
}

function textCell(content, cls) {
    const cell = document.createElement('div');
    cell.className = `set-cell ${cls}`;
    cell.textContent = content;
    return cell;
}

// Set-number cell, with the Dynamax badge stacked under the number when the
// set can Dynamax (SwSh sets #5–8 + Leon's Charizard carry `dmax: true`).
function setNumCell(set) {
    const cell = document.createElement('div');
    cell.className = 'set-cell set-num';
    // setLabel overrides the displayed number (Leon's 31-IV copies are keyed
    // 5-12 internally but shown as 1-4); the real setNumber stays the match key.
    cell.appendChild(document.createTextNode(set.setLabel ?? set.setNumber));
    if (set.dmax) {
        const icon = document.createElement('img');
        icon.src = 'assets/images/dmax.png';
        icon.alt = 'Dynamax';
        icon.title = 'Can Dynamax';
        icon.className = 'dmax-mini';
        icon.onerror = () => icon.remove();
        cell.appendChild(icon);
    }
    return cell;
}

function itemCell(itemName) {
    const cell = document.createElement('div');
    cell.className = 'set-cell set-item';
    // Arcade/Castle opponents hold no items — show an empty item column.
    if (state.variant?.noItems) return cell;
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

// Pike wild Pokémon swap one move in Open Level (`movesOpen`); all other sets use
// their four stored move slots. Returns a [m1,m2,m3,m4] array.
function effMoves(set) {
    return (state.openMode && set.movesOpen)
        ? set.movesOpen
        : [set.move1, set.move2, set.move3, set.move4];
}

// The four moves as a compact 2×2 grid (two 13px lines stack to roughly the
// item icon's height, so the row stays flat) with gen-aware type icons.
function movesCell(set) {
    const grid = document.createElement('div');
    grid.className = 'set-moves';
    const moves = effMoves(set);
    const enMoves = effMoves(enCounterpart(set));
    for (let i = 0; i < 4; i++) {
        const cell = document.createElement('span');
        cell.className = 'set-move';
        const text = moves[i];
        if (text && text !== '-') {
            const type = moveType(enMoves[i], state.variant.gen);
            if (type) {
                const icon = document.createElement('img');
                icon.src = `assets/images/types/${type.toLowerCase()}.png`;
                icon.alt = type;
                icon.className = 'set-move-icon';
                icon.onerror = () => icon.remove();
                cell.appendChild(icon);
            }
            const name = document.createElement('span');
            name.textContent = text;
            cell.appendChild(name);
        }
        grid.appendChild(cell);
    }
    return grid;
}

// Shrink-to-fit: only mega sets ("139 → 216") pay for the arrow's width.
function speedCell(set, iv = null) {
    const cell = document.createElement('div');
    cell.className = 'set-cell set-speed';
    const icon = () => {
        const img = document.createElement('img');
        img.src = 'assets/images/speed.png';
        img.alt = 'Speed';
        img.onerror = () => img.remove();
        return img;
    };
    // DP (random natures): three colour-coded speeds — −nature (red) / neutral /
    // +nature (green) — since the game doesn't fix the nature.
    if (state.variant?.randomNature) {
        const t = speedTriple(set, iv);
        if (t) {
            const span = (v, cls) => {
                const s = document.createElement('span');
                s.className = `spd-${cls}`;
                s.textContent = v;
                return s;
            };
            cell.appendChild(icon());
            cell.appendChild(span(t.minus, 'minus'));
            cell.appendChild(document.createTextNode(' / '));
            cell.appendChild(span(t.neutral, 'neutral'));
            cell.appendChild(document.createTextNode(' / '));
            cell.appendChild(span(t.plus, 'plus'));
        }
        return cell;
    }
    // Pike wild Pokémon: random IVs → show the 0-IV→31-IV speed range "lo – hi".
    if (set.wild) {
        const r = speedRange(set);
        if (r) {
            cell.appendChild(icon());
            cell.appendChild(document.createTextNode(`${r.lo} – ${r.hi}`));
        }
        return cell;
    }
    // Hall without a determined faced level → no speed (empty cell, no icon).
    const text = speedDisplay(set, iv);
    if (text) {
        cell.appendChild(icon());
        cell.appendChild(document.createTextNode(text));
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

// "IVs: N" detail line. Per-set IVs (SwSh) take precedence; for gen-4 Frontier
// (variant.trainerIVs) it shows the fielding trainer's IV (`slotIV`). Hidden in
// browse mode (no trainer) when the set has no per-set IV.
function ivsLine(set, slotIV) {
    const iv = set.IVs ?? slotIV;
    return iv != null
        ? `<div class="separator"></div><div class="ivs">IVs: ${iv}</div>`
        : '';
}

function showSetDetails(slot, set) {
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.querySelector('.set-details')?.remove();
    const details = buildSetDetail(set, ivForSlot(slot));
    if (!details) return;
    container.appendChild(details);
    fitDetailsFont(details);
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => fitDetailsFont(details)).observe(details);
    }
}

// Build a set's three-column detail card as a DETACHED element (returned, not inserted),
// so the caller can place it where needed. Used by showSetDetails (the main #pokemon-sets
// slots); the refactor that split it out keeps that path unchanged.
function buildSetDetail(set, slotIV = null) {
    const speciesData = dexEntry(set.species);
    if (!speciesData) {
        console.error('Species data not found for:', set.species);
        return null;
    }

    const english = speciesData.en.toLowerCase();
    // Pyramid wild sets are locked to a specific ability (or a known pair) — show that
    // instead of the species' full ability list.
    const abilities = (set.ability || speciesData[`abilities-${state.language}`] || '')
        .split(', ').filter(Boolean);
    // Arcade/Castle: opponents hold no items → no item, no Mega Evolution.
    const noItems = Boolean(state.variant?.noItems);
    const itemEnglish = itemEntry(set.item)?.en ?? set.item;
    const megaDex = noItems ? null : megaEntry(speciesData.en, itemEnglish);
    const megaAbilities = megaDex
        ? (megaDex[`abilities-${state.language}`] || '').split(', ')
        : null;

    // English move names drive the type lookup (counterpart set, preloaded).
    // effMoves applies the Pike wild Pokémon's Open-Level move swap.
    const moves = effMoves(set);
    const enMoves = effMoves(enCounterpart(set));
    const moveLines = [];
    for (let i = 0; i < 4; i++) {
        const text = moves[i];
        if (!text || text === '-') continue;
        const type = moveType(enMoves[i], state.variant.gen);
        const bullet = type
            ? `<img src="assets/images/types/${type.toLowerCase()}.png" alt="${type}" class="move-type-icon" onerror="this.remove()" />`
            : '<span class="move-bullet">-</span>';
        moveLines.push(`<div class="move-line">${bullet}<span>${text}</span></div>`);
    }

    const natureData = state.data.natures.find(nature =>
        nature[`nature-${state.language}`] === set.nature);
    const natureText = natureData ? natureData[`stats-${state.language}`] : '';

    const details = document.createElement('div');
    details.className = (state.variant?.gen === 2) ? 'set-details gen2'
        : state.variant?.teamView ? 'set-details bdsp' : 'set-details';

    const typeIcons = [
        typeIconHtml(speciesData.type1),
        speciesData.type2 ? typeIconHtml(speciesData.type2) : '',
        set.tera ? typeIconHtml(set.tera, true) : '',
    ].join('');

    const itemHtml = (!noItems && set.item && set.item !== 'None')
        ? `<img src="${itemImageUrl(set.item)}" alt="${set.item}" class="item-icon" onerror="this.remove()" /> ${set.item}`
        : '';

    // DP randomizes natures: drop the nature block (+ its separator) and show a
    // 3-way speed (−/neutral/+ nature) under the moves instead of one value.
    const randomNature = Boolean(state.variant?.randomNature);
    const wild = Boolean(set.wild);   // Pike wild Pokémon: random IVs, no nature/EVs
    const gen2 = state.variant?.gen === 2;   // DVs/Stat-Exp, no nature/ability
    const speedIcon = '<img src="assets/images/speed.png" alt="Speed" class="speed-icon" />';
    const triple = randomNature ? speedTriple(set, slotIV) : null;
    const range = wild ? speedRange(set) : null;
    const speedValue = (randomNature || wild) ? null : speedDisplay(set, slotIV);
    // No speed to show (Hall before a level is determined) → omit the block + its
    // leading separator entirely. Wild → a 0-IV/31-IV range (two lines).
    const speedInner = (randomNature && triple)
        ? `<div class="speed-triple">
                <div class="speed spd-plus"><span class="speed-sign">+</span>${speedIcon}${triple.plus}</div>
                <div class="speed spd-neutral">${speedIcon}${triple.neutral}</div>
                <div class="speed spd-minus"><span class="speed-sign">−</span>${speedIcon}${triple.minus}</div>
           </div>`
        : (wild && range)
        ? `<div class="speed-range">
                <div class="speed"><span class="iv-tag">0 IV−</span>${speedIcon}${range.lo}</div>
                <div class="speed"><span class="iv-tag">31 IV+</span>${speedIcon}${range.hi}</div>
           </div>`
        : speedValue ? `<div class="speed">${speedIcon}${speedValue}</div>` : '';
    const speedBlock = speedInner ? `<div class="separator"></div>${speedInner}` : '';
    const natureBlock = (randomNature || wild || gen2) ? '' : `
            <div class="nature">
                <b>${set.nature}</b>
                <br/><span class="nature-text">${natureText}</span>
            </div>
            <div class="separator"></div>`;

    // Battle Hall: the faced Pokémon's level (from the player's inputs); Pike wild
    // Pokémon: their player-relative level; gen-2 Crystal Tower: the set's pool level
    // (10-100) — shown above the abilities/DVs separator.
    const facedLevel = state.variant?.hall ? hallFacedLevel() : null;
    const levelHtml = facedLevel != null
        ? `<div class="hall-faced-level"><b>${t('hallFacedLevel', 'Lv.')} ${facedLevel}</b></div>`
        : wild
        ? `<div class="hall-faced-level"><b>${t('hallFacedLevel', 'Lv.')} ${wildLevelText(set)}</b></div>`
        : (gen2 && set.level != null)
        ? `<div class="hall-faced-level"><b>${t('hallFacedLevel', 'Lv.')} ${set.level}</b></div>`
        : '';

    // Gen 2 has no abilities; the right column shows DVs (0-15) + EVs (the converted
    // Stat Exp) instead. DVs are HP/Atk/Def/Spe/Spc (one Special DV covers SpA & SpD).
    const abilitiesHtml = gen2 ? '' : `
            <div class="separator"></div>
            <div class="abilities">
                <span class="abilities-list">${abilities.join('<br/>')}</span>
                ${megaAbilities ? `<span class="mega-ability-arrow">↓</span><span class="abilities-list">${megaAbilities.join('<br/>')}</span>` : ''}
            </div>`;
    const evsHtml = (!wild && set.EVs)
        ? `<div class="separator"></div><div class="evs">${set.EVs.split(', ').join('<br/>')}</div>` : '';
    // DVs sit in the MIDDLE column (between moves and speed) — the gen-2 right column
    // already carries the long EVs list + level, and stacking DVs there overlapped the
    // copy button. The middle column has more room (no nature/abilities in gen 2).
    const dvsHtml = (gen2 && set.DVs)
        ? `<div class="separator"></div><div class="dvs" title="HP / Atk / Def / Spe / Spc">DVs ${set.DVs.hp}/${set.DVs.atk}/${set.DVs.def}/${set.DVs.spe}/${set.DVs.spc}</div>` : '';
    // BDSP sets carry a per-stat IV SPREAD (some stats 0, the rest 31) rather than a
    // single uniform IV — stack the non-31 stats like the EVs block, in a smaller
    // font so the right column stays short (unlabelled, like EVs — self-explanatory).
    const ivsHtml = (wild || gen2) ? ''
        : set.ivSpread
        ? `<div class="separator"></div><div class="ivs ivs-spread">${set.ivSpread.split(', ').join('<br/>')}</div>`
        : ivsLine(set, slotIV);

    details.innerHTML = `
        <div class="left-column">
            <h3 class="set-name">${set.setName}${set.dmax ? ' <img src="assets/images/dmax.png" alt="Dynamax" title="Can Dynamax" class="dmax-icon" onerror="this.remove()" />' : ''}</h3>
            <div class="type-icons">${typeIcons}</div>
            <img src="assets/images/sprites/${set.sprite ?? english}.png" alt="${set.species}" class="large-sprite" />
            <div class="item">${itemHtml}</div>
        </div>
        <div class="middle-column">
            ${natureBlock}
            <div class="moves">${moveLines.join('')}</div>
            ${dvsHtml}
            ${speedBlock}
        </div>
        <div class="right-column">
            ${levelHtml}
            ${abilitiesHtml}
            ${evsHtml}
            ${ivsHtml}
        </div>
        <div class="copy">
            <span role="button" title="Copy set (Showdown format)" class="icon-mask icon-copy copy-icon"></span>
            <span class="copy-feedback" hidden>Copied!</span>
        </div>
    `;

    // Per-set sprite override (e.g. Leon's Gigantamax Charizard uses
    // "charizard-gmax"): fall back to the species' normal sprite if the
    // override image is missing.
    if (set.sprite) {
        const sprite = details.querySelector('.large-sprite');
        sprite.onerror = () => {
            sprite.onerror = null;
            sprite.src = `assets/images/sprites/${english}.png`;
        };
    }

    // Mega evolution: if the held item is a mega stone, try the mega sprite first
    // and fall back to the regular sprite if it doesn't exist.
    if (!set.sprite && /ite$/.test(itemEnglish) && itemEnglish !== 'Eviolite') {
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
            await navigator.clipboard.writeText(await showdownExport(set, speciesData, slotIV));
            feedback.hidden = false;
            setTimeout(() => { feedback.hidden = true; }, 1500);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    });

    return details;
}

// Hybrid squeeze handling: at full size the flex gaps between the columns
// absorb narrowing; only once the nowrap content would actually overflow the
// panel does the font shrink, by the measured ratio (content-aware — long
// localized names shrink earlier than short ones, never preemptively).
// Everything inside the panel is em-based, so it scales as one piece.
const DETAILS_MIN_FONT = 9;

function fitDetailsFont(details) {
    details.style.fontSize = ''; // re-measure from the full-size layout
    for (let i = 0; i < 3; i++) { // ratio is ~linear; iterate to converge
        const overflow = details.scrollWidth - details.clientWidth;
        if (overflow <= 0) break;
        const font = parseFloat(getComputedStyle(details).fontSize);
        const fixed = 20; // panel padding: px, doesn't scale with the font
        const target = Math.max(DETAILS_MIN_FONT,
            font * (details.clientWidth - fixed) / (details.scrollWidth - fixed));
        if (target >= font) break;
        details.style.fontSize = `${target.toFixed(2)}px`;
    }
}

function typeIconHtml(type, isTera = false) {
    const path = isTera ? `types/tera/${type.toLowerCase()}` : `types/${type.toLowerCase()}`;
    return `<img src="assets/images/${path}.png" alt="${type}" class="type-icon" onerror="this.remove()" />`;
}

// Showdown (and similar tools) only accept English, so the export always uses
// the English sets file — every localized set has an English counterpart with
// the same (English species name, set number) key.
function showdownExport(set, speciesData, slotIV = null) {
    const enSet = enCounterpart(set);
    // Wild sets carry a locked ability (or pair) → export that, not the full list.
    const englishAbilities = (enSet.ability || speciesData['abilities-en'] || '').split(', ');
    return showdownFormat(enSet, englishAbilities, slotIV);
}

const IV_STATS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function showdownFormat(set, abilities, ivOverride = null) {
    // Arcade (variant.noItems) opponents hold no item — omit it from the export too.
    const item = state.variant?.noItems ? null : set.item;
    const abils = (abilities || []).map(a => a.trim()).filter(Boolean);
    const wild = Boolean(set.wild);   // Pike wild: random IVs, no nature/EVs, own level
    const gen2 = state.variant?.gen === 2;   // DVs→IVs, Stat-Exp→EVs, no nature/ability
    const lines = [item && item !== 'None' ? `${set.species} @ ${item}` : set.species];
    // Include an explicit level when it's not the implicit 50: Battle Hall (the faced
    // level varies), gen-3 Tower Open Level (player's chosen level), and Pike wild
    // Pokémon (a player-relative level, even at Lv 50 — e.g. 46/45).
    // Wild: a single player-relative level (Pike) is exported; a Pyramid level BAND
    // can't be one Showdown level, so it's omitted (the range is in the UI).
    let facedLevel = null;
    if (wild) {
        const lt = wildLevelText(set);
        if (!lt.includes('–')) facedLevel = lt;
    } else {
        facedLevel = state.variant?.hall ? hallFacedLevel()
            : (state.variant?.openLevel && state.openMode) ? state.openLevelValue
            // Factory Open + RS Lv 100 are level 100 (Lv 50 is the implicit default).
            : ((state.variant?.factory || state.variant?.factory3 || state.variant?.rsTower) && state.factoryOpen) ? 100
            // Gen-2 Crystal Tower: each set's pool level (omit when it's the implicit 50).
            : (gen2 && set.level !== 50) ? set.level
            : null;
    }
    if (facedLevel != null) lines.push(`Level: ${facedLevel}`);
    if (set.tera) lines.push(`Tera Type: ${set.tera}`);
    // Only state the ability when it's unambiguous (a single possibility). When a
    // set could have 2-3 abilities the game doesn't fix which, so we omit the line
    // rather than guess at the first one.
    if (abils.length === 1) lines.push(`Ability: ${abils[0]}`);
    if (set.EVs) lines.push(`EVs: ${set.EVs.split(', ').join(' / ')}`);
    if (gen2) {
        // Gen 2: convert DVs (0-15) to Showdown IVs (Showdown floors IV/2 back to the
        // DV, so IV = 2·DV reproduces it). The Special DV covers both SpA and SpD.
        const dv = set.DVs || { hp: 15, atk: 15, def: 15, spe: 15, spc: 15 };
        const byStat = { HP: 2 * dv.hp, Atk: 2 * dv.atk, Def: 2 * dv.def,
                         SpA: 2 * dv.spc, SpD: 2 * dv.spc, Spe: 2 * dv.spe };
        lines.push(`IVs: ${IV_STATS.map(s => `${byStat[s]} ${s}`).join(' / ')}`);
    } else if (set.ivSpread) {
        // BDSP: a per-stat IV spread (non-31 stats listed; Showdown defaults the rest
        // to 31). Stored as "0 Atk, 10 SpD, 10 Spe" → "0 Atk / 10 SpD / 10 Spe".
        lines.push(`IVs: ${set.ivSpread.split(', ').join(' / ')}`);
    } else {
        // IVs are uniform across stats here; export them only when not the default 31
        // (same precedence as the speed calc: per-set > trainer/rank > variant > 31).
        // Wild Pokémon have random IVs → none to state.
        const iv = set.IVs ?? ivOverride ?? state.variant?.speedIVs ?? 31;
        if (!wild && iv !== 31) lines.push(`IVs: ${IV_STATS.map(s => `${iv} ${s}`).join(' / ')}`);
    }
    // DP randomizes natures, wild Pokémon are random, gen 2 has no natures → none to state.
    if (!state.variant?.randomNature && !wild && !gen2) lines.push(`${set.nature} Nature`);
    for (const move of effMoves(set)) {
        if (move) lines.push(`- ${move}`);
    }
    return lines.join('\n');
}

/* ---------- BDSP team view (ordered teams; no minisprite pool) ---------- */
// BDSP singles is presented per-TEAM, not per-Pokémon: a trainer can field several
// ordered teams. With >1 team we list compact preview ROWS (minisprites in lead
// order + item + nature, separated); clicking one renders its 3 sets side-by-side
// (reusing the triples layout — the same slot containers, menus/minisprites hidden).
// With a single team (e.g. Palmer) we skip the rows and show the details directly.

function setForRef(ref) {
    const [sp, n] = ref.split(/-(?=\d+$)/);
    return state.data.sets.find(s => s.species === sp && s.setNumber === +n);
}

function trainerTeams(trainer) {
    return (trainer.teams && trainer.teams.length) ? trainer.teams : [trainer.roster];
}

// Show `count` slot containers as detail-only panels (w-N columns, like triples);
// the unused menu + minisprite list inside each are hidden via the body class.
function showBdspPanels(count) {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        const c = document.getElementById(`pokemon-menu-container-${slot}`);
        const on = slot <= count;
        c.style.display = on ? 'block' : 'none';
        c.style.order = '';   // reset; the detail renderers re-tag by team-data order (mobile stack)
        c.classList.remove('w-1', 'w-2', 'w-3', 'side-2');
        if (on) c.classList.add(`w-${count}`);
    }
}

function clearBdspPanels() {
    state.activeSets = {};
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        document.getElementById(`pokemon-sets-${slot}`).innerHTML = '';
    }
}

// Render one ordered team's detail panels. Singles (3) → a row of 3. Doubles (4) →
// a 2×2 grid where the opponent's LEAD (member 1) sits TOP-RIGHT (slot 2) and member
// 2 TOP-LEFT (slot 1) — the panels are laid out exactly as the player sees the
// opponent's side on the field (they send out top-right first) — then the bottom row
// is members 3 → 4 left→right (slots 3, 4). The grid flow is slot 1,2,3,4 = TL,TR,BL,BR.
export function renderBdspTeamDetail(teamString) {
    const refs = teamString.split(', ').filter(Boolean);
    clearBdspPanels();
    showBdspPanels(refs.length);
    const slotOf = refs.length === 4 ? [2, 1, 3, 4] : [1, 2, 3];
    refs.forEach((ref, i) => {
        const set = setForRef(ref);
        if (set) showSetDetails(slotOf[i], set);
        // Tag each panel with its team-data index so the phone single-column stack
        // reads in team order; the 2×2 grid neutralizes this (CSS) and keeps its
        // spatial placement.
        document.getElementById(`pokemon-menu-container-${slotOf[i]}`).style.order = i;
    });
}

// One compact preview row per team: each member = minisprite (lead order) + item +
// nature, with a vertical separator between members. Clicking calls onPick(index).
function renderBdspTeamRows(teams, onPick, order) {
    const host = document.getElementById('team-rows');
    host.innerHTML = '';
    const table = document.createElement('div');
    table.className = 'team-rows-table';
    teams.forEach((teamString, ti) => {
        const row = document.createElement('div');
        row.className = `team-row ${ti % 2 === 0 ? 'even-row' : 'odd-row'}`;
        row.dataset.team = ti;
        // `order` maps display position → team index. Default: normal doubles swaps
        // the first two (lead shows 2nd / top-right — the on-field order); singles
        // keep order. Duos pass an explicit order ([2,0,3,1]).
        const refs = teamString.split(', ').filter(Boolean);
        const ord = order || (refs.length === 4 ? [1, 0, 2, 3] : refs.map((_, i) => i));
        const display = ord.map(i => refs[i]).filter(Boolean);
        display.forEach((ref, i) => {
            if (i) {
                const sep = document.createElement('div');
                sep.className = 'team-sep';
                row.appendChild(sep);
            }
            const set = setForRef(ref);
            const species = set ? set.species : ref.split(/-(?=\d+$)/)[0];
            const member = document.createElement('div');
            member.className = 'team-member';
            const mini = document.createElement('img');
            mini.className = 'team-mini';
            mini.src = speciesMinispriteUrl(species);
            mini.alt = species;
            mini.onerror = () => mini.remove();
            member.appendChild(mini);
            if (set && set.item && set.item !== 'None') {
                const item = document.createElement('img');
                item.className = 'team-item';
                item.src = itemImageUrl(set.item);
                item.alt = set.item;
                item.title = set.item;
                item.onerror = () => item.remove();
                member.appendChild(item);
            }
            // Fill the row with the full moveset (same 2×2 grid + type icons as the
            // compact set preview). Nature is omitted here to keep the rows breathing
            // when squeezed / on mobile (it's still shown in the expanded detail);
            // the moves compress gracefully down to just their 4 type icons.
            if (set) member.appendChild(movesCell(set));
            row.appendChild(member);
        });
        row.onclick = () => onPick(ti);
        table.appendChild(row);
    });
    host.appendChild(table);
    // Stack the move grids to 2×2 uniformly if any name would truncate (as set rows do).
    fitMoveGrids(host);
    if (typeof ResizeObserver !== 'undefined' && !host._movesObserver) {
        host._movesObserver = new ResizeObserver(() => fitMoveGrids(host));
        host._movesObserver.observe(host);
    }
}

function highlightTeamRow(ti) {
    document.querySelectorAll('#team-rows .team-row').forEach(r =>
        r.classList.toggle('selected', Number(r.dataset.team) === ti));
}

// Click a preview row: open its detail + highlight it. Re-clicking the row that's
// already selected toggles it back OFF (clears the panels) — mirrors the set-row
// behaviour in the other games, where clicking the open row collapses it.
function pickTeamRow(ti, renderDetail) {
    const row = document.querySelector(`#team-rows .team-row[data-team="${ti}"]`);
    if (row && row.classList.contains('selected')) {
        highlightTeamRow(-1);   // no row has index -1 → deselect every row
        clearBdspPanels();
        showBdspPanels(0);
    } else {
        renderDetail();
        highlightTeamRow(ti);
    }
}

// Entry point: render a BDSP trainer's team view. Multi-team → preview rows (details
// appear once a row is clicked); single team → details immediately.
export function renderBdspTrainer(trainer) {
    const host = document.getElementById('team-rows');
    const teams = trainerTeams(trainer);
    if (teams.length > 1) {
        renderBdspTeamRows(teams, ti => pickTeamRow(ti, () => renderBdspTeamDetail(teams[ti])));
        host.style.display = '';
        clearBdspPanels();
        showBdspPanels(0);
    } else {
        host.innerHTML = '';
        host.style.display = 'none';
        renderBdspTeamDetail(teams[0]);
    }
}

export function clearBdspView() {
    document.getElementById('team-rows').innerHTML = '';
    clearBdspPanels();
    showBdspPanels(0);
}

/* ---------- BDSP Master Doubles: duo view (multis of duos) ---------- */
// Two trainer menus + two quote menus. The TRAINER menu searches/picks whole DUOS
// (fills both sides; canonical order = data name1 → RIGHT/side 2, name2 → LEFT/side 1).
// The QUOTE menu picks INDIVIDUALS (one side); with exactly one side set, the other
// menus filter to that trainer's partners. Completing a duo re-snaps to canonical
// order. Each duo's data record carries both trainers + its teams (data order
// t1p1,t1p2,t2p1,t2p2). Display order for a team is t2p1, t1p1, t2p2, t1p2 — each
// Pokémon under its trainer's column (t2 left, t1 right).

export function isDuoDoubles() {
    return Boolean(state.variant?.duoDoubles) && state.mode === 'doubles';
}

function pairKey(a, b) { return [a, b].sort().join('|'); }

let duoIndexSource = null, duoIdx = null;
function duoIndex() {
    if (duoIndexSource !== state.data.trainers) {
        duoIndexSource = state.data.trainers;
        const individuals = new Map();   // name -> {name, cls, sprite, quote}
        const partners = new Map();      // name -> [partner names]
        const byPair = new Map();        // "a|b" (sorted) -> rec
        const recIndex = new Map();      // rec -> index
        state.data.trainers.forEach((rec, i) => {
            recIndex.set(rec, i);
            const t1 = { name: rec.name, cls: rec.class, sprite: rec.sprite, quote: rec.quote };
            const t2 = { name: rec.name2, cls: rec.class2, sprite: rec.sprite2, quote: rec.quote2 };
            for (const t of [t1, t2]) if (!individuals.has(t.name)) individuals.set(t.name, t);
            if (!partners.has(t1.name)) partners.set(t1.name, []);
            if (!partners.has(t2.name)) partners.set(t2.name, []);
            partners.get(t1.name).push(t2.name);
            partners.get(t2.name).push(t1.name);
            byPair.set(pairKey(rec.name, rec.name2), rec);
        });
        duoIdx = { individuals, partners, byPair, recIndex };
    }
    return duoIdx;
}

function duoResolve() {
    const { l, r } = state.bdspDuo;
    return (l && r) ? (duoIndex().byPair.get(pairKey(l, r)) ?? null) : null;
}

// Render the duo's teams (preview rows when >1, else the one team's 2×2 grid).
function renderDuo(rec) {
    const host = document.getElementById('team-rows');
    const teams = rec?.teams || [];
    if (teams.length > 1) {
        renderBdspTeamRows(teams, ti => pickTeamRow(ti, () => renderDuoDetail(teams[ti])),
                           [2, 0, 3, 1]);   // t2p1, t1p1, t2p2, t1p2
        host.style.display = '';
        clearBdspPanels();
        showBdspPanels(0);
    } else if (teams.length === 1) {
        host.innerHTML = ''; host.style.display = 'none';
        renderDuoDetail(teams[0]);
    } else {
        clearBdspView();
    }
}

// 2×2 grid placed under each trainer's column: t2p1 TL(slot1), t1p1 TR(slot2),
// t2p2 BL(slot3), t1p2 BR(slot4). Team data order is [t1p1, t1p2, t2p1, t2p2].
function renderDuoDetail(teamString) {
    const refs = teamString.split(', ').filter(Boolean);
    clearBdspPanels();
    showBdspPanels(4);
    const slotOf = [2, 4, 1, 3];   // team index → slot (container)
    const rowOrder = [2, 0, 3, 1]; // preview-row order: t2p1, t1p1, t2p2, t1p2 (two leads first)
    refs.forEach((ref, i) => {
        const set = setForRef(ref);
        if (set) showSetDetails(slotOf[i], set);
        // phone stack follows the preview-row order so the two LEADS show first
        document.getElementById(`pokemon-menu-container-${slotOf[i]}`).style.order = rowOrder.indexOf(i);
    });
}

// --- selection actions ---
function selectDuoRecord(rec) {
    state.bdspDuo.l = rec.name2;   // canonical: name2 left, name1 right
    state.bdspDuo.r = rec.name;   // record field for the first trainer is `name`
    renderDuo(rec);
    populateDuoMenus();
}

// Exposed for Reverse Lookup: load a duo record into the main tool (Master Doubles).
export function selectDuo(rec) {
    if (rec) selectDuoRecord(rec);
}

function setDuoIndividual(side, name) {
    state.bdspDuo[side === 1 ? 'l' : 'r'] = name;
    const rec = duoResolve();
    if (rec) {
        selectDuoRecord(rec);      // both sides set & a valid duo → render (re-snaps order)
    } else {
        clearBdspView();           // only one side set → wait for the partner
        populateDuoMenus();
    }
}

export function resetDuoSelection() {
    state.bdspDuo = { l: null, r: null };
    clearBdspView();
    populateDuoMenus();
}

// --- menu population ---
const fold2 = s => fold(s);   // alias for clarity

export function populateDuoMenus() {
    for (let side = 1; side <= 2; side++) {
        populateDuoTrainer(side);
        populateDuoQuote(side);
    }
}

function duoTrainerResult(option) {
    if (!option.id) return option.text;
    const el = $(option.element);
    const $span = $('<span></span>');
    const add = src => src && $span.append($('<img>').attr('src', src)
        .addClass('trainer-sprite-select2').on('error', function () { $(this).remove(); }));
    if (el.data('kind') === 'duo') {
        // Dropdown list shows the duo in ORIGINAL data order (t1 & t2); the inversion
        // (t2 left / t1 right) only happens in the per-side selection display.
        add(el.data('icon2')); add(el.data('icon'));   // t1 sprite, then t2 sprite
        $span.append(document.createTextNode(` ${el.data('n1')} & ${el.data('n2')}`));
    } else {
        add(el.data('icon'));
        $span.append(document.createTextNode(' ' + el.data('name')));
    }
    return $span;
}

// Selection display shows only this SIDE's member of a duo (side 1 = name2/left).
function duoTrainerSelection(side) {
    return option => {
        if (!option.id) return option.text;
        const el = $(option.element);
        const $span = $('<span></span>');
        const add = src => src && $span.append($('<img>').attr('src', src)
            .addClass('trainer-sprite-select2').on('error', function () { $(this).remove(); }));
        if (el.data('kind') === 'duo') {
            const name = side === 1 ? el.data('n2') : el.data('n1');
            const sprite = side === 1 ? el.data('icon') : el.data('icon2');
            add(sprite);
            $span.append(document.createTextNode(' ' + name));
        } else {
            add(el.data('icon'));
            $span.append(document.createTextNode(' ' + el.data('name')));
        }
        return $span;
    };
}

function duoTrainerMatcher(params, data) {
    const term = fold2(params.term).trim();
    if (!term) return data;
    const el = data.element ? $(data.element) : null;
    // The search also matches the trainer CLASS (parity with the other games'
    // trainerMatcher) — classes come from the duo index (rec.class / rec.class2).
    const cls = name => duoIndex().individuals.get(name)?.cls;
    if (el && el.data('kind') === 'duo') {
        const n1 = el.data('n1'), n2 = el.data('n2');
        return (fold2(n1).includes(term) || fold2(n2).includes(term)
            || fold2(cls(n1)).includes(term) || fold2(cls(n2)).includes(term)) ? data : null;
    }
    if (el && el.data('kind') === 'ind') {
        const name = el.data('name');
        return (fold2(name).includes(term) || fold2(cls(name)).includes(term)) ? data : null;
    }
    return fold2(data.text).includes(term) ? data : null;
}

function populateDuoTrainer(side) {
    const { individuals, partners, recIndex } = duoIndex();
    const cur = side === 1 ? state.bdspDuo.l : state.bdspDuo.r;
    const other = side === 1 ? state.bdspDuo.r : state.bdspDuo.l;
    const oneOnly = Boolean(state.bdspDuo.l) + Boolean(state.bdspDuo.r) === 1;
    const $dd = $(`#trainer-dropdown-${side}`).empty();
    $dd.append('<option value="" disabled selected></option>');

    const addInd = name => {
        const ind = individuals.get(name); if (!ind) return;
        const o = new Option(name, `ind:${name}`, false, false);
        $(o).attr('data-kind', 'ind').attr('data-name', name);
        if (ind.sprite) $(o).attr('data-icon', ind.sprite);
        $dd.append(o);
    };
    const addDuo = rec => {
        const o = new Option(`${rec.name2} ${rec.name}`, `duo:${recIndex.get(rec)}`, false, false);
        $(o).attr('data-kind', 'duo').attr('data-n1', rec.name).attr('data-n2', rec.name2);
        if (rec.sprite) $(o).attr('data-icon2', rec.sprite);     // name1 (right) sprite
        if (rec.sprite2) $(o).attr('data-icon', rec.sprite2);    // name2 (left) sprite
        $dd.append(o);
    };

    let value = '';
    if (oneOnly && !cur) {
        // partner mode: this side empty, other side set → list the other's partners
        const seen = new Set();
        for (const p of (partners.get(other) || [])) if (!seen.has(p)) { seen.add(p); addInd(p); }
    } else {
        for (const rec of state.data.trainers) addDuo(rec);
        const rec = cur && other ? duoIndex().byPair.get(pairKey(cur, other)) : null;
        if (rec) value = `duo:${recIndex.get(rec)}`;           // resolved → show duo member
        else if (cur) { addInd(cur); value = `ind:${cur}`; }   // intermediate (set via quote)
    }

    initSelect2(`#trainer-dropdown-${side}`, {
        placeholder: t('trainerDropdownPlaceholder', 'Trainer'),
        templateResult: duoTrainerResult,
        templateSelection: duoTrainerSelection(side),
        containerClass: 'select2-container--trainer',
        matcher: duoTrainerMatcher,
    });
    $dd.val(value).trigger('change.select2');
    $dd.off('select2:select').on('select2:select', e => {
        const id = e.params.data.id;
        if (id.startsWith('duo:')) selectDuoRecord(state.data.trainers[Number(id.slice(4))]);
        else if (id.startsWith('ind:')) setDuoIndividual(side, id.slice(4));
    });
}

function populateDuoQuote(side) {
    const { individuals, partners } = duoIndex();
    const cur = side === 1 ? state.bdspDuo.l : state.bdspDuo.r;
    const other = side === 1 ? state.bdspDuo.r : state.bdspDuo.l;
    const oneOnly = Boolean(state.bdspDuo.l) + Boolean(state.bdspDuo.r) === 1;
    const $dd = $(`#quote-dropdown-${side}`).empty();
    $dd.append('<option value="" disabled selected></option>');

    const add = name => {
        const ind = individuals.get(name);
        if (!ind || !ind.quote) return;   // only individuals with a quote are searchable here
        $dd.append(new Option(ind.quote, `ind:${name}`, false, false));
    };
    if (oneOnly && !cur) {
        const seen = new Set();
        for (const p of (partners.get(other) || [])) if (!seen.has(p)) { seen.add(p); add(p); }
    } else {
        for (const name of individuals.keys()) add(name);
    }
    const value = cur && individuals.get(cur)?.quote ? `ind:${cur}` : '';

    initSelect2(`#quote-dropdown-${side}`, {
        placeholder: t('quoteDropdownPlaceholder', 'Quote'),
        template: textTemplate,
        matcher: quoteMatcher,
    });
    $dd.val(value).trigger('change.select2');
    $dd.off('select2:select').on('select2:select', e => setDuoIndividual(side, e.params.data.id.slice(4)));
}

/* ---------- Reverse Lookup: identify the trainer from the Pokémon seen ---------- */
// A modal (#reverse-lookup-modal) with TWO models, dispatched by populateReverseLookup on
// state.variant.teamView:
//  • TEAM model (BDSP — fixed ordered teams): one species menu per slot with Lead/Backup
//    roles (singles 1 Lead + 2 Backup; doubles, a 4-mon team OR a Master duo, 2 Lead +
//    2 Backup). A team matches if every Lead pick is one of its leads and every Backup
//    pick any of its non-lead members (UNORDERED within each group). One row per TEAM.
//  • ROSTER/SET model (every other facility — per-Pokémon sets + rosters): plain species
//    menus (3 singles / 4 doubles; multis splits into two independent sides), each
//    revealing a set submenu to optionally pin an exact set. A trainer matches if its
//    roster holds every chosen species (or exact Species-N). One row per TRAINER, with a
//    truncated roster-sprite preview. Searches the late-filtered pool (reverseTrainers).
// Either way, clicking a result row LOADS that trainer/duo in the main tool (app.js
// loadReverseResult); the search + results persist across reopen (reverseBuilt token).

let reverseOnLoad = null;

// Role of each menu, by current mode.
function reverseRoles() {
    return state.mode === 'doubles'
        ? ['lead', 'lead', 'backup', 'backup']
        : ['lead', 'backup', 'backup'];
}

const refSpecies = ref => {
    const s = setForRef(ref);
    return s ? s.species : (ref || '').split(/-(?=\d+$)/)[0];
};

// A team's lead vs backup species, by mode. Singles: lead = member 0. Normal doubles
// (one 4-mon team): leads = members 0,1. Master duo (team order [t1p1,t1p2,t2p1,t2p2]):
// leads = each trainer's FIRST mon (members 0,2), backups = members 1,3.
function teamRoleSpecies(refs) {
    if (state.mode !== 'doubles') {
        return { leads: [refSpecies(refs[0])], backups: refs.slice(1).map(refSpecies) };
    }
    if (isDuoDoubles()) {
        return { leads: [refs[0], refs[2]].map(refSpecies), backups: [refs[1], refs[3]].map(refSpecies) };
    }
    return { leads: [refs[0], refs[1]].map(refSpecies), backups: [refs[2], refs[3]].map(refSpecies) };
}

// Display order for a result row's team preview (mirrors the main tool's team rows).
function reverseDisplayOrder(n) {
    if (state.mode !== 'doubles') return [0, 1, 2].slice(0, n);
    return isDuoDoubles() ? [2, 0, 3, 1] : [1, 0, 2, 3];
}

// Every species fielded by any trainer/duo in the loaded dataset (the menu options).
function reverseSpeciesPool() {
    const out = new Set();
    for (const tr of trainerPool())   // respects the late filter (smaller pool)
        for (const team of trainerTeams(tr))
            for (const ref of team.split(', ').filter(Boolean))
                out.add(refSpecies(ref));
    return [...out].filter(sp => dexEntry(sp)).sort((a, b) => a.localeCompare(b));
}

// Tracks what the current menus/results were built for. Opening the modal REUSES them
// (so a search + its results survive loading a result and reopening to try another);
// they're rebuilt only when the dataset / mode / language changed, or on an explicit
// reset (force).
let reverseBuilt = null;

// Build (or reuse) the species menus. Opening the modal calls this with the loader;
// the reset button calls it with force=true to clear back to an empty search.
export function populateReverseLookup(onLoad, force = false) {
    if (onLoad) reverseOnLoad = onLoad;
    const fresh = reverseBuilt && reverseBuilt.data === state.data
        && reverseBuilt.mode === state.mode && reverseBuilt.lang === state.language
        && reverseBuilt.late === state.lateOnly   // late filter shrinks the searched pool
        && reverseBuilt.open === state.factoryOpen // RS Tower Lv50/Lv100 swaps the pool
        && document.getElementById('reverse-menu-0');
    if (fresh && !force) return;   // reuse the existing search + results
    reverseBuilt = { data: state.data, mode: state.mode, lang: state.language,
                     late: state.lateOnly, open: state.factoryOpen };
    document.getElementById('reverse-lookup-title').textContent = t('reverseLookup', 'Reverse Lookup');
    document.getElementById('reverse-menus').innerHTML = '';
    document.getElementById('reverse-results').innerHTML = '';
    // BDSP uses fixed ordered teams (Lead/Backup); other facilities have per-Pokémon
    // sets + rosters, so they get the species+set "roster" model instead.
    if (state.variant.teamView) buildReverseTeamMenus();
    else buildReverseRosterMenus();
}

// --- team model (BDSP): one species menu per slot, Lead/Backup roles ---
function buildReverseTeamMenus() {
    const roles = reverseRoles();
    const pool = reverseSpeciesPool();
    const host = document.getElementById('reverse-menus');
    roles.forEach((role, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'reverse-menu';
        // The placeholder (shown until a pick is made) labels the slot — no separate
        // label above. There's no per-menu clear "×" (it crowded the name); the modal's
        // reset button (fixed bottom-right) clears all menus instead.
        const labelText = role === 'lead' ? t('reverseLead', 'Lead') : t('reverseBackup', 'Backup');
        const sel = document.createElement('select');
        sel.id = `reverse-menu-${i}`;
        sel.dataset.role = role;
        wrap.appendChild(sel);
        host.appendChild(wrap);
        const $sel = $(sel);
        $sel.append(new Option('', '', true, true));
        for (const sp of pool) {
            const o = new Option(sp, sp, false, false);
            $(o).attr('data-icon', speciesMinispriteUrl(sp));
            $sel.append(o);
        }
        initSelect2(`#reverse-menu-${i}`, {
            placeholder: labelText,
            template: spriteTemplate,
        });
        $sel.val('').trigger('change.select2');
        $sel.off('select2:select select2:clear')
            .on('select2:select select2:clear', runReverseFilter);
    });
    document.getElementById('reverse-results').innerHTML = '';
    runReverseFilter();
}

// Read the menu picks, compute matching teams, render the result rows.
function runReverseFilter() {
    const host = document.getElementById('reverse-results');
    host.innerHTML = '';
    const roles = reverseRoles();
    const leadSel = [], backupSel = [];
    roles.forEach((role, i) => {
        const v = document.getElementById(`reverse-menu-${i}`)?.value;
        if (!v) return;
        (role === 'lead' ? leadSel : backupSel).push(v);
    });
    if (!leadSel.length && !backupSel.length) return;   // nothing picked → no list yet

    const matches = [];
    for (const tr of trainerPool()) {
        trainerTeams(tr).forEach((team, ti) => {
            const refs = team.split(', ').filter(Boolean);
            const { leads, backups } = teamRoleSpecies(refs);
            const leadSet = new Set(leads), backupSet = new Set(backups);
            if (leadSel.every(s => leadSet.has(s)) && backupSel.every(s => backupSet.has(s)))
                matches.push({ trainer: tr, team, teamIndex: ti });
        });
    }
    if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'reverse-empty';
        empty.textContent = t('reverseNoResults', 'No matching trainers.');
        host.appendChild(empty);
        return;
    }
    renderReverseResults(matches, host);
}

// Trainer (or duo) identity cell — sprite(s) + name — leading each result row.
function reverseTrainerCell(tr) {
    const cell = document.createElement('div');
    cell.className = 'reverse-trainer';
    const addImg = (src, fb) => {
        if (!src) return;
        const im = document.createElement('img');
        im.className = 'reverse-trainer-sprite';
        im.src = src;
        im.onerror = fb ? () => { im.onerror = null; im.src = fb; } : () => im.remove();
        cell.appendChild(im);
    };
    const nm = document.createElement('span');
    nm.className = 'reverse-trainer-name';
    if (isDuoDoubles()) {
        const [icon] = trainerSpriteSrc(tr.sprite);
        addImg(icon);
        addImg(tr.sprite2);
        nm.textContent = `${tr.name} & ${tr.name2}`;
    } else {
        const [icon, fb] = trainerSpriteSrc(tr.sprite);
        addImg(icon, fb);
        nm.textContent = trainerName(tr);
    }
    cell.appendChild(nm);
    return cell;
}

// Append a team's members (minisprite + item + moves, separated) to a row, in
// display order. Shared shape with the main team preview rows.
function appendTeamMembers(row, teamString, order) {
    const refs = teamString.split(', ').filter(Boolean);
    const ord = order || (refs.length === 4 ? [1, 0, 2, 3] : refs.map((_, i) => i));
    ord.map(i => refs[i]).filter(Boolean).forEach((ref, i) => {
        if (i) {
            const sep = document.createElement('div');
            sep.className = 'team-sep';
            row.appendChild(sep);
        }
        const set = setForRef(ref);
        const species = set ? set.species : refSpecies(ref);
        const member = document.createElement('div');
        member.className = 'team-member';
        const mini = document.createElement('img');
        mini.className = 'team-mini';
        mini.src = speciesMinispriteUrl(species);
        mini.alt = species;
        mini.onerror = () => mini.remove();
        member.appendChild(mini);
        if (set && set.item && set.item !== 'None') {
            const item = document.createElement('img');
            item.className = 'team-item';
            item.src = itemImageUrl(set.item);
            item.alt = set.item;
            item.title = set.item;
            item.onerror = () => item.remove();
            member.appendChild(item);
        }
        // No movesets in the result rows (the minisprites/items identify the team).
        row.appendChild(member);
    });
}

// Result rows. Clicking ANYWHERE on a row loads that trainer/duo in the main tool (same
// as the arrow) — there's no inline detail expansion; the search + results stay loaded
// so reopening the modal lets the user try another result instantly.
function renderReverseResults(matches, host) {
    const table = document.createElement('div');
    table.className = 'reverse-rows';
    matches.forEach((m, ri) => {
        const refs = m.team.split(', ').filter(Boolean);
        const order = reverseDisplayOrder(refs.length);

        const row = document.createElement('div');
        row.className = `reverse-row team-row ${ri % 2 === 0 ? 'even-row' : 'odd-row'}`;
        row.appendChild(reverseTrainerCell(m.trainer));
        // A thick separator divides the trainer from their team (heavier than the
        // per-Pokémon separators).
        const mainSep = document.createElement('div');
        mainSep.className = 'reverse-sep-main';
        row.appendChild(mainSep);
        appendTeamMembers(row, m.team, order);

        // Visual load affordance (the whole row is clickable; the arrow has no separate
        // handler — a click on it bubbles to the row).
        const arrow = document.createElement('span');
        arrow.className = 'reverse-arrow';
        arrow.textContent = '➜';
        arrow.title = t('reverseLoad', 'Open in lookup');
        row.appendChild(arrow);

        row.onclick = () => { if (reverseOnLoad) reverseOnLoad(m); };
        table.appendChild(row);
    });
    host.appendChild(table);
}

/* --- roster/set model (SwSh Tower etc.): a species menu + a set submenu per slot --- */
// No leads/backups: each menu is a plain species picker over every species fielded by
// the dataset's trainers; choosing a species reveals a set submenu (item/nature/moves
// preview) to optionally pin an exact set. A trainer matches if its roster contains
// every chosen species (and the exact set when one is picked). Results = one row per
// trainer, previewing its roster as sprites (truncated with "…"); a click loads it.

// The trainers the reverse lookup searches: the current pool (respects the late filter)
// MINUS the Pike/Pyramid "Wild Pokémon" pseudo-trainer (it isn't a trainer to identify).
function reverseTrainers() {
    return trainerPool().filter(tr => !tr.wild);
}
// A trainer's species / roster for matching. RS Tower has two mon pools (Lv50 vs Lv100),
// so use whichever the level toggle has active.
function reverseSpeciesOf(tr) {
    return (state.variant?.rsTower && state.factoryOpen ? tr.speciesOpen : tr.species) || '';
}
function reverseRosterOf(tr) {
    return (state.variant?.rsTower && state.factoryOpen ? tr.rosterOpen : tr.roster) || '';
}

function reverseRosterSpeciesPool() {
    const out = new Set();
    for (const tr of reverseTrainers())
        for (const sp of reverseSpeciesOf(tr).split(', ')) if (sp) out.add(sp);
    return [...out].filter(sp => dexEntry(sp)).sort((a, b) => a.localeCompare(b));
}

// The set refs (`Species-N`) actually fielded by the current trainer pool — so the set
// submenu (and matching) drop sets that only exist on filtered-out (e.g. non-late) trainers.
function reversePoolRefs() {
    const refs = new Set();
    for (const tr of reverseTrainers())
        for (const tok of reverseRosterOf(tr).split(', ')) if (tok) refs.add(tok);
    return refs;
}

function reverseSetsForSpecies(sp) {
    const refs = reversePoolRefs();
    return state.data.sets
        .filter(s => s.species === sp && !s.wild && !s.brain
            && refs.has(`${s.species}-${s.setNumber}`))
        .sort((a, b) => a.setNumber - b.setNumber);
}

function buildReverseRosterMenus() {
    const pool = reverseRosterSpeciesPool();
    const host = document.getElementById('reverse-menus');
    // MULTIS: two opponent trainers → split the UI into two independent SIDES (2 species
    // menus each), each with its own results list; picking a side's result loads that
    // trainer into the matching multi slot. SINGLES/DOUBLES: one list (3 / 4 menus, one
    // trainer). The global #reverse-results is used for the single-list modes only.
    if (state.mode === 'multis') {
        const wrap = document.createElement('div');
        wrap.className = 'reverse-multis';
        const sides = {};
        const makeCol = side => {
            const col = document.createElement('div');
            col.className = 'reverse-side';
            const menus = document.createElement('div');
            menus.className = 'reverse-menus-side';
            const results = document.createElement('div');
            results.className = 'reverse-results-side';
            results.id = `reverse-results-${side}`;
            col.appendChild(menus);
            col.appendChild(results);
            sides[side] = { menus, results };
            return col;
        };
        wrap.appendChild(makeCol(1));
        const sep = document.createElement('div');
        sep.className = 'reverse-side-sep';   // divider signifying the two sides
        wrap.appendChild(sep);
        wrap.appendChild(makeCol(2));
        // Attach to the document BEFORE initializing select2 — select2 can't render or
        // bind on a detached <select> (that left the menus unstyled + inert).
        host.appendChild(wrap);
        for (const side of [1, 2]) {
            const indices = side === 1 ? [0, 1] : [2, 3];
            const onFilter = () => reverseRosterFilter(indices, sides[side].results, side);
            for (const i of indices) buildReverseSpeciesSlot(i, pool, onFilter, sides[side].menus);
            reverseRosterFilter(indices, sides[side].results, side);
        }
        return;
    }
    const count = state.mode === 'doubles' ? 4 : 3;
    const indices = [...Array(count).keys()];
    const results = document.getElementById('reverse-results');
    const onFilter = () => reverseRosterFilter(indices, results, 1);
    for (const i of indices) buildReverseSpeciesSlot(i, pool, onFilter, host);
    reverseRosterFilter(indices, results, 1);
}

// Build slot i's species picker + (hidden) set submenu into `parent`; choosing a
// species reveals the set submenu and re-runs `onFilter`.
function buildReverseSpeciesSlot(i, pool, onFilter, parent) {
    const wrap = document.createElement('div');
    wrap.className = 'reverse-menu reverse-menu-roster';
    const spSel = document.createElement('select');
    spSel.id = `reverse-menu-${i}`;
    const setSel = document.createElement('select');
    setSel.id = `reverse-set-${i}`;
    setSel.className = 'reverse-set';
    setSel.style.display = 'none';
    wrap.appendChild(spSel);
    wrap.appendChild(setSel);
    parent.appendChild(wrap);

    const $sp = $(spSel);
    $sp.append(new Option('', '', true, true));
    for (const sp of pool) {
        const o = new Option(sp, sp, false, false);
        $(o).attr('data-icon', speciesMinispriteUrl(sp));
        $sp.append(o);
    }
    initSelect2(`#reverse-menu-${i}`, {
        placeholder: t('pokemonDropdownPlaceholder', 'Pokémon'),
        template: spriteTemplate,
    });
    $sp.val('').trigger('change.select2');
    $sp.off('select2:select').on('select2:select', e => {
        buildReverseSetMenu(i, e.params.data.id, onFilter);
        onFilter();
    });
}

// Build (or rebuild) slot i's set submenu for the chosen species.
function buildReverseSetMenu(i, species, onFilter) {
    const setSel = document.getElementById(`reverse-set-${i}`);
    const $set = $(setSel).empty();
    $set.append(new Option(t('reverseAllSets', 'All sets'), '', true, true));
    for (const set of reverseSetsForSpecies(species)) {
        const o = new Option(set.setName, String(set.setNumber), false, false);
        $(o).attr('data-species', species);
        $set.append(o);
    }
    initSelect2(`#reverse-set-${i}`, {
        placeholder: t('reverseAllSets', 'All sets'),
        templateResult: reverseSetTemplate,
        templateSelection: reverseSetTemplate,   // keep the full preview when chosen too
        containerClass: 'reverse-set-box',
        search: false,
    });
    $set.val('').trigger('change.select2');
    setSel.style.display = '';
    $set.off('select2:select').on('select2:select', onFilter);
}

function reverseSetFor(option) {
    const sp = $(option.element).data('species');
    return state.data.sets.find(s => s.species === sp && s.setNumber === Number(option.id));
}

// Rich set preview (set # + item + the 4 moves stacked in ONE column). Used for BOTH the
// dropdown list AND the selection box, so a chosen set keeps showing its moves. Nature is
// omitted, and the moves use a single column, to leave the most room for the move names.
function reverseSetPreview(set) {
    const $span = $('<span class="reverse-set-opt"></span>');
    $span.append($('<span class="reverse-set-num"></span>').text(set.setNumber));
    // Arcade (noItems): opponents hold no items, so don't show one in the preview either.
    if (set.item && set.item !== 'None' && !state.variant?.noItems)
        $span.append($('<img class="team-item">').attr('src', itemImageUrl(set.item))
            .attr('title', set.item).on('error', function () { $(this).remove(); }));
    const moves = movesCell(set);
    moves.classList.add('reverse-set-moves');   // 1 column of 4 (CSS) — full move names
    $span.append(moves);
    return $span;
}

function reverseSetTemplate(option) {
    if (!option.id) return option.text;   // the "All sets" entry
    const set = reverseSetFor(option);
    return set ? reverseSetPreview(set) : option.text;
}

// Filter the dataset's trainers by the species/sets chosen in menus `indices`, render
// the matching trainers into `host`; clicking a row loads that trainer into `side`.
function reverseRosterFilter(indices, host, side) {
    host.innerHTML = '';
    const constraints = [];
    for (const i of indices) {
        const sp = document.getElementById(`reverse-menu-${i}`)?.value;
        if (!sp) continue;
        const setVal = document.getElementById(`reverse-set-${i}`)?.value;
        constraints.push({ species: sp, setNumber: setVal ? Number(setVal) : null });
    }
    if (!constraints.length) return;

    const matches = [];
    for (const tr of reverseTrainers()) {   // current pool, minus wild pseudo-trainers
        const speciesSet = new Set(reverseSpeciesOf(tr).split(', '));
        const refSet = new Set(reverseRosterOf(tr).split(', '));
        const ok = constraints.every(c => c.setNumber == null
            ? speciesSet.has(c.species)
            : refSet.has(`${c.species}-${c.setNumber}`));
        if (ok) matches.push(tr);
    }
    matches.sort((a, b) => trainerName(a).localeCompare(trainerName(b)));
    if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'reverse-empty';
        empty.textContent = t('reverseNoResults', 'No matching trainers.');
        host.appendChild(empty);
        return;
    }
    renderReverseRosterResults(matches, host, side);
}

function renderReverseRosterResults(matches, host, side) {
    const table = document.createElement('div');
    table.className = 'reverse-rows';
    matches.forEach((tr, ri) => {
        const row = document.createElement('div');
        row.className = `reverse-row team-row ${ri % 2 === 0 ? 'even-row' : 'odd-row'}`;
        row.appendChild(reverseTrainerCell(tr));
        const sep = document.createElement('div');
        sep.className = 'reverse-sep-main';
        row.appendChild(sep);
        row.appendChild(buildRosterPreview(tr));
        const arrow = document.createElement('span');
        arrow.className = 'reverse-arrow';
        arrow.textContent = '➜';
        arrow.title = t('reverseLoad', 'Open in lookup');
        row.appendChild(arrow);
        row.onclick = () => { if (reverseOnLoad) reverseOnLoad({ trainer: tr, side }); };
        table.appendChild(row);
    });
    host.appendChild(table);
    fitRosterPreviews(host);
    if (typeof ResizeObserver !== 'undefined' && !host._rosterObserver) {
        host._rosterObserver = new ResizeObserver(() => fitRosterPreviews(host));
        host._rosterObserver.observe(host);
    }
}

// Roster preview: minisprites (deduped, roster order) + a trailing "…" shown only when
// some are clipped. fitRosterPreviews then hides the overflowing sprites.
function buildRosterPreview(trainer) {
    const box = document.createElement('div');
    box.className = 'reverse-roster';
    const species = [...new Set(reverseSpeciesOf(trainer).split(', ').filter(Boolean))];
    for (const sp of species) {
        const im = document.createElement('img');
        im.className = 'reverse-mini';
        im.src = speciesMinispriteUrl(sp);
        im.alt = sp;
        im.title = sp;
        im.onerror = () => im.remove();
        box.appendChild(im);
    }
    const more = document.createElement('span');
    more.className = 'reverse-more';
    more.textContent = '…';
    more.style.display = 'none';
    box.appendChild(more);
    return box;
}

function fitRosterPreviews(host) {
    host.querySelectorAll('.reverse-roster').forEach(box => {
        const more = box.querySelector('.reverse-more');
        const minis = [...box.querySelectorAll('.reverse-mini')];
        minis.forEach(im => { im.style.display = ''; });
        if (more) more.style.display = 'none';
        if (!box.clientWidth) return;
        const limit = box.getBoundingClientRect().right - 22;   // reserve room for "…"
        let clipped = false;
        for (const im of minis) {
            if (clipped) { im.style.display = 'none'; continue; }
            if (im.getBoundingClientRect().right > limit) { im.style.display = 'none'; clipped = true; }
        }
        if (clipped && more) more.style.display = '';
    });
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
    // BDSP team view: no Pokémon menus / minisprite pool — the detail panels are
    // driven by renderBdspTrainer. Hide the slot menus (body class) and, when no
    // trainer is selected, clear the team rows + panels.
    const teamView = Boolean(state.variant.teamView);
    document.body.classList.toggle('bdsp-team-view', teamView);
    // Clear the BDSP team rows when leaving team view (switching to another game) or
    // when nothing is selected. Duos track selection in state.bdspDuo (a resolved duo),
    // single-trainer modes in state.trainers[1].
    const nothingSelected = isDuoDoubles() ? !duoResolve() : !state.trainers[1];
    if (!teamView) {
        document.getElementById('team-rows').innerHTML = '';
    } else if (nothingSelected) {
        document.getElementById('team-rows').innerHTML = '';
        showBdspPanels(0);
    }
    // Battle Hall replaces the trainer menu with type+rank selectors.
    const hall = Boolean(state.variant.hall);
    // Battle Pyramid: when the "Wild Pokémon" entry is selected, the quote menu becomes
    // a round/floor filter.
    const pyrWild = Boolean(state.variant.pyramidWild && state.trainers[1]?.wild);
    document.getElementById('pyramid-wild-filter').style.display = pyrWild ? '' : 'none';
    // Battle Factory (gen-4 + gen-3) + RS Tower: the flat level toggle (settings menu).
    document.getElementById('factory-level-row').style.display =
        (state.variant.factory || state.variant.factory3 || state.variant.rsTower) ? '' : 'none';
    // Gen-3 Factory: the "Current Tower streak" input (drives opponent IVs).
    document.getElementById('factory-streak-row').style.display =
        state.variant.factory3 ? '' : 'none';
    // Gen-3 Tower: the Lv 50 / Open Level toggle (settings menu).
    document.getElementById('open-level-row').style.display =
        state.variant.openLevel ? '' : 'none';
    document.getElementById('hall-select-container').style.display = hall ? '' : 'none';
    // Hide the whole normal trainer container in Hall mode — otherwise its empty
    // flex-grow box keeps claiming half the toolbar row and the Hall menus shrink.
    document.getElementById('trainer-side-1').parentElement.style.display = hall ? 'none' : '';
    document.getElementById('trainer-side-1').style.display = hall ? 'none' : '';
    // Facilities without quote data (e.g. SwSh) hide the quote dropdown(s).
    // `enOnlyQuotes` (gen-3 Tower) has English-only quotes (Easy Chat can't be
    // localized from the corpus), so the quote menu is hidden outside English.
    const quotes = state.variant.hasQuotes !== false && !hall && !pyrWild
        && !(state.variant.enOnlyQuotes && state.language !== 'en');
    document.getElementById('quote-side-1').style.display = quotes ? '' : 'none';
    // BDSP Master Doubles (duos) shows TWO trainer + quote menus like multis.
    const duoDoubles = isDuoDoubles();
    document.getElementById('trainer-side-2').style.display = (multi || duoDoubles) ? '' : 'none';
    document.getElementById('quote-side-2').style.display = ((multi || duoDoubles) && quotes) ? '' : 'none';
    // Battle Hall has no quotes — the faced-level calculator takes that space.
    document.getElementById('hall-level-tool').style.display = hall ? '' : 'none';

    // BDSP manages its own detail panels (showBdspPanels); skip the slot loop.
    const total = modeSlots(state.mode);
    if (!teamView) {
        for (let slot = 1; slot <= MAX_SLOTS; slot++) {
            const container = document.getElementById(`pokemon-menu-container-${slot}`);
            const side = slotSide(state.mode, slot);
            // Slots for the current mode are always shown — the menu lists all
            // facility species until a trainer narrows it to their roster.
            const visible = slot <= total;
            container.style.display = visible ? 'block' : 'none';
            container.classList.remove('w-1', 'w-2', 'w-3', 'side-2');
            if (visible) {
                container.classList.add(`w-${total}`);
                if (multi && side === 2) container.classList.add('side-2');
            }
        }
    }
    // Reverse Lookup button: only for variants that support it (BDSP's static rosters).
    document.getElementById('reverse-lookup-btn').style.display =
        state.variant.reverseLookup ? '' : 'none';
    positionSwap();
}

export function applyStaticTranslations() {
    // The late filter is a visual "<N>+" pill; the translation is its tooltip.
    const lateBtn = document.getElementById('late-filter');
    if (lateBtn) lateBtn.title = t('lateFilter', 'Late trainers only');
}
