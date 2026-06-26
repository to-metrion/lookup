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

export function initSelect2(selector, { placeholder, template, containerClass, search = true,
                                        matcher, allowClear = false } = {}) {
    const $el = $(selector);
    if ($el.hasClass('select2-hidden-accessible')) {
        $el.select2('destroy');
    }
    $el.select2({
        placeholder,
        allowClear,   // shows an "×" to clear back to the placeholder
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
    const slotIV = ivForSlot(slot);
    const container = document.getElementById(`pokemon-sets-${slot}`);
    container.querySelector('.set-details')?.remove();

    const speciesData = dexEntry(set.species);
    if (!speciesData) {
        console.error('Species data not found for:', set.species);
        return;
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
    details.className = (state.variant?.gen === 2) ? 'set-details gen2' : 'set-details';

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
    const ivsHtml = (wild || gen2) ? '' : ivsLine(set, slotIV);

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

    container.appendChild(details);

    fitDetailsFont(details);
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => fitDetailsFont(details)).observe(details);
    }
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
    document.getElementById('trainer-side-2').style.display = multi ? '' : 'none';
    document.getElementById('quote-side-2').style.display = (multi && quotes) ? '' : 'none';
    // Battle Hall has no quotes — the faced-level calculator takes that space.
    document.getElementById('hall-level-tool').style.display = hall ? '' : 'none';

    const total = modeSlots(state.mode);
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
    positionSwap();
}

export function applyStaticTranslations() {
    // The late filter is a visual "<N>+" pill; the translation is its tooltip.
    const lateBtn = document.getElementById('late-filter');
    if (lateBtn) lateBtn.title = t('lateFilter', 'Late trainers only');
}
