// jsdom smoke test for the Battle Facility Tool refactor.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = require('path').resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script[^>]*src="https:[^"]*"[^>]*><\/script>/g, '')   // strip CDN scripts
    .replace(/<script type="module"[^>]*><\/script>/, '');           // strip module entry

const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;

// fetch shim -> read local files
window.fetch = (url) => {
    const file = path.join(ROOT, url.split('?')[0].replace(/^\//, ''));
    return new Promise((resolve) => {
        fs.readFile(file, 'utf8', (err, data) => {
            if (err) return resolve({ ok: false, status: 404, json: () => Promise.reject(err) });
            resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(data)) });
        });
    });
};
window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q }));
window.navigator.clipboard || Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: t => { window.__copied = t; return Promise.resolve(); } },
});

// jQuery + select2
const jq = require('jquery');   // picks up global.window
window.$ = window.jQuery = jq;
global.$ = global.jQuery = jq;
require('select2')();

const errors = [];
window.console.error = (...args) => { errors.push(args.map(String).join(' ')); };

// run the bundle
const bundle = fs.readFileSync('/tmp/bundle.js', 'utf8');
window.eval(bundle);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(name, cond) {
    console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
    if (!cond) failures++;
}

(async () => {
    await sleep(700); // init runs on eval (readyState is 'complete' in jsdom)

    const $ = window.$;
    const doc = window.document;

    /* ---- settings structure ---- */
    check('game select has 3 options', $('#game-select option').length === 3);
    check('tree option carries 2 game icons',
        ($('#game-select option[value="tree"]').attr('data-icons') || '').split('|').length === 2);
    check('game select shows version icons',
        doc.querySelectorAll('#game-select + .select2-container .game-icon').length === 2);
    check('default game = tree', $('#game-select').val() === 'tree');
    check('variant row visible (tree has SM + USUM)', doc.getElementById('variant-row').style.display !== 'none');
    check('variant select has 2 options', $('#variant-select option').length === 2);
    check('variant options carry icons', ($('#variant-select option').eq(0).attr('data-icons') || '').split('|').length === 2);
    check('language options = 9 (tree)', $('#language-select option').length === 9);
    check('settings selects have no search box',
        $('#game-select').data('select2').options.options.minimumResultsForSearch === Infinity
        && $('#language-select').data('select2').options.options.minimumResultsForSearch === Infinity);
    check('trainer dropdown keeps search',
        $('#trainer-dropdown-1').data('select2').options.options.minimumResultsForSearch === 0);
    check('10 theme swatches rendered', doc.querySelectorAll('.theme-swatch').length === 10);
    check('swatches at top of settings', doc.querySelector('.modal-content').children[1].id === 'theme-swatches');
    check('active swatch = dark', doc.querySelector('.theme-swatch.active')?.dataset.theme === 'dark');
    check('default theme = dark', doc.documentElement.dataset.theme === 'dark');
    check('late filter row visible', doc.getElementById('late-filter-row').style.display !== 'none');
    check('3 slot containers generated', doc.querySelectorAll('.pokemon-menu-container').length === 3);
    check('mode switch has 3 cells (singles/doubles/multis)', doc.querySelectorAll('.mode-cell').length === 3);
    check('singles cell active', doc.querySelector('.mode-cell.active')?.dataset.mode === 'singles');
    check('big glyph shows singles die', doc.getElementById('mode-glyph').textContent === '⚀');
    check('late pill shows 40+', doc.getElementById('late-filter').textContent === '40+');
    check('header icons are masked spans', Boolean(doc.querySelector('#settings-btn .icon-settings'))
        && Boolean(doc.querySelector('#reset-btn .icon-reset')));

    /* ---- theme switching ---- */
    doc.querySelector('.theme-swatch[data-theme="light"]').click();
    check('swatch click switches to light', doc.documentElement.dataset.theme === 'light');
    check('light swatch now active', doc.querySelector('.theme-swatch.active')?.dataset.theme === 'light');
    doc.querySelector('.theme-swatch[data-theme="fairy"]').click();
    check('fairy theme applies', doc.documentElement.dataset.theme === 'fairy');
    doc.querySelector('.theme-swatch[data-theme="umbreon"]').click();
    check('umbreon theme applies', doc.documentElement.dataset.theme === 'umbreon');
    doc.querySelector('.theme-swatch[data-theme="dark"]').click();
    check('back to dark', doc.documentElement.dataset.theme === 'dark');

    /* ---- trainer selection (index-keyed) ---- */
    const trainerCount = $('#trainer-dropdown-1 option').length;
    check('trainer dropdown populated (' + trainerCount + ')', trainerCount === 205);
    const enIdx = $('#trainer-dropdown-1 option').eq(1).val();
    const enName = $('#trainer-dropdown-1 option').eq(1).text();
    $('#trainer-dropdown-1').val(enIdx).trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: enIdx } } });
    await sleep(200);
    check('species list rendered for ' + enName, doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0);
    /* minisprites ordered by pokedex position */
    {
        const fs2 = require('fs');
        const dex = JSON.parse(fs2.readFileSync(ROOT + '/data/pokedex-7.json', 'utf8')).pokedex;
        const order = new Map(dex.map((p, i) => [p.en, i]));
        const alts = [...doc.querySelectorAll('#slot-species-1 .pokemon-sprite')].map(i => i.alt);
        const sorted = alts.every((a, i) => i === 0 || order.get(alts[i - 1]) <= order.get(a));
        check('sprites in pokedex order (first: ' + alts[0] + ')', sorted);
    }
    check('slot 1 visible, w-1', doc.getElementById('pokemon-menu-container-1').style.display === 'block'
        && doc.getElementById('pokemon-menu-container-1').classList.contains('w-1'));
    check('slot 2 hidden in singles', doc.getElementById('pokemon-menu-container-2').style.display === 'none');

    /* ---- mode cycling ---- */
    doc.querySelector('.mode-cell[data-mode="doubles"]').click();
    await sleep(50);
    check('doubles cell active, knob alt=false', doc.querySelector('.mode-cell.active')?.dataset.mode === 'doubles'
        && !doc.getElementById('mode-knob').classList.contains('alt'));
    check('slot 2 visible, w-2', doc.getElementById('pokemon-menu-container-2').style.display === 'block'
        && doc.getElementById('pokemon-menu-container-2').classList.contains('w-2'));
    check('doubles: species list above BOTH slots',
        doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0
        && doc.querySelectorAll('#slot-species-2 .pokemon-sprite').length > 0);
    const dblSprite = doc.querySelectorAll('#slot-species-2 .pokemon-sprite')[3];
    dblSprite.click();
    await sleep(100);
    check('doubles: list-2 sprite fills menu 2 only', $('#pokemon-menu-2').val() === dblSprite.alt
        && !$('#pokemon-menu-1').val());
    check('doubles: clicked sprite highlighted in list 2',
        dblSprite.classList.contains('selected'));
    /* minisprites settings toggle (Bulbasaur button) */
    doc.getElementById('sprites-toggle').click();
    await sleep(50);
    check('sprites toggle off: lists emptied', doc.querySelectorAll('.pokemon-sprite').length === 0);
    doc.getElementById('sprites-toggle').click();
    await sleep(50);
    check('sprites toggle on: lists restored', doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0);
    check('glyph shows doubles die', doc.getElementById('mode-glyph').textContent === '⚁');
    doc.querySelector('.mode-cell[data-mode="doubles"]').click(); // active notch -> cycles to multis
    await sleep(100);
    check('clicking active notch cycles (to multis ⚃)', doc.querySelector('.mode-cell.active')?.dataset.mode === 'multis'
        && doc.getElementById('mode-glyph').textContent === '⚃');

    /* ---- multis mode ---- */
    check('multis: side-2 trainer menu visible', doc.getElementById('trainer-side-2').style.display !== 'none');
    check('multis: side-2 quote menu visible', doc.getElementById('quote-side-2').style.display !== 'none');
    check('multis: trainer 1 kept', $('#trainer-dropdown-1').val() === enIdx);
    check('multis: numbered placeholders', $('#trainer-dropdown-1').data('select2').options.options.placeholder === 'Trainer 1'
        && $('#trainer-dropdown-2').data('select2').options.options.placeholder === 'Trainer 2');
    check('multis: per-side species list for trainer 1', doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0);
    const t2Idx = $('#trainer-dropdown-2 option').eq(5).val();
    $('#trainer-dropdown-2').val(t2Idx).trigger('change');
    $('#trainer-dropdown-2').trigger({ type: 'select2:select', params: { data: { id: t2Idx } } });
    await sleep(150);
    check('multis: both slot columns visible', doc.getElementById('pokemon-menu-container-1').style.display === 'block'
        && doc.getElementById('pokemon-menu-container-2').style.display === 'block');
    check('multis: slot 2 marked side-2', doc.getElementById('pokemon-menu-container-2').classList.contains('side-2'));
    check('multis: species list for trainer 2', doc.querySelectorAll('#slot-species-2 .pokemon-sprite').length > 0);
    const m2sp = $('#pokemon-menu-2 option').eq(1).val();
    $('#pokemon-menu-2').val(m2sp).trigger('change');
    $('#pokemon-menu-2').trigger({ type: 'select2:select', params: { data: { id: m2sp } } });
    await sleep(100);
    check('multis: trainer-2 sets render (' + m2sp + ')', doc.querySelectorAll('#pokemon-sets-2 .set-row').length > 0);
    /* language round-trip preserves both trainers */
    $('#language-select').val('jp').trigger('change');
    await sleep(700);
    check('multis jp: both trainers preserved', $('#trainer-dropdown-1').val() === enIdx
        && $('#trainer-dropdown-2').val() === t2Idx);
    check('multis jp: trainer-2 sets preserved', doc.querySelectorAll('#pokemon-sets-2 .set-row').length > 0);
    $('#language-select').val('en').trigger('change');
    await sleep(700);
    /* back to singles keeps trainer 1, clears side 2 */
    doc.querySelector('.mode-cell[data-mode="singles"]').click();
    await sleep(100);
    check('singles after multis: trainer 1 kept', $('#trainer-dropdown-1').val() === enIdx);
    check('singles after multis: side 2 cleared + hidden', doc.getElementById('trainer-side-2').style.display === 'none'
        && !$('#trainer-dropdown-2').val());
    check('singles after multis: slot-1 species list back', doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0);

    /* ---- species + sets + copy ---- */
    const enSpecies = $('#pokemon-menu-1 option').eq(1).val();
    $('#pokemon-menu-1').val(enSpecies).trigger('change');
    $('#pokemon-menu-1').trigger({ type: 'select2:select', params: { data: { id: enSpecies } } });
    await sleep(100);
    const rows = doc.querySelectorAll('#pokemon-sets-1 .set-row');
    check('sets render for ' + enSpecies + ' (' + rows.length + ')', rows.length > 0);
    rows[0].click();
    await sleep(150);
    const chosenSetNumber = rows[0].dataset.setNumber;
    const det = doc.querySelector('#pokemon-sets-1 .set-details');
    check('details rendered', Boolean(det));
    const mIcons = det ? det.querySelectorAll('.move-type-icon') : [];
    check('move type icons rendered (' + mIcons.length + '/4)', mIcons.length === 4);
    check('first move icon is grass (Energy Ball)', mIcons[0] && mIcons[0].getAttribute('src').includes('grass'));
    check('copy icon masked', Boolean(det && det.querySelector('.icon-copy.copy-icon')));
    /* re-click selected row -> collapse */
    rows[0].click();
    await sleep(100);
    check('re-click collapses details', !doc.querySelector('#pokemon-sets-1 .set-details'));
    check('re-click deselects row', !rows[0].classList.contains('selected'));
    rows[0].click(); // re-open for the language-switch tests that follow
    await sleep(150);
    check('click again re-expands', Boolean(doc.querySelector('#pokemon-sets-1 .set-details')));

    /* ---- language switch preserves view; copy stays English ---- */
    $('#language-select').val('jp').trigger('change');
    await sleep(700);
    check('jp: late pill tooltip translated', doc.getElementById('late-filter').title.includes('トレーナー'));
    check('jp: same trainer index selected', $('#trainer-dropdown-1').val() === enIdx);
    check('jp: displayed name translated', $('#trainer-dropdown-1 option:selected').text() !== enName);
    check('jp: species preserved (translated)', Boolean($('#pokemon-menu-1').val()) && $('#pokemon-menu-1').val() !== enSpecies);
    check('jp: pokemon menu placeholder is ポケモン',
        $('#pokemon-menu-2').data('select2').options.options.placeholder === 'ポケモン');
    const jpSel = doc.querySelector('#pokemon-sets-1 .set-row.selected');
    check('jp: same set selected', jpSel && jpSel.dataset.setNumber === chosenSetNumber);
    await sleep(200);
    const jpIcons = doc.querySelectorAll('#pokemon-sets-1 .set-details .move-type-icon');
    check('jp: move type icons via EN counterpart (' + jpIcons.length + '/4)', jpIcons.length === 4);
    window.__copied = null;
    doc.querySelector('#pokemon-sets-1 .copy-icon').click();
    await sleep(150);
    check('jp copy: English output', /^[\x00-\x7F]+$/.test(String(window.__copied || '')));
    $('#language-select').val('en').trigger('change');
    await sleep(700);
    check('en: view restored', $('#trainer-dropdown-1').val() === enIdx && $('#pokemon-menu-1').val() === enSpecies);

    /* ---- late filter ---- */
    const lateBtn = doc.getElementById('late-filter');
    lateBtn.click();
    await sleep(100);
    check('late pill active', lateBtn.classList.contains('active'));
    const lateCount = $('#trainer-dropdown-1 option').length;
    check('late filter reduces trainers (' + (lateCount - 1) + ')', lateCount === 115); // 114 late + placeholder
    lateBtn.click();
    await sleep(100);
    check('filter off restores full list', $('#trainer-dropdown-1 option').length === 205
        && !lateBtn.classList.contains('active'));

    /* ---- computed speed: mega arrow (Nedry's Sableye-3 holds Sablenite) ---- */
    $('#trainer-dropdown-1').val('76').trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: '76' } } });
    await sleep(200);
    $('#pokemon-menu-1').val('Sableye').trigger('change');
    $('#pokemon-menu-1').trigger({ type: 'select2:select', params: { data: { id: 'Sableye' } } });
    await sleep(100);
    const sabRow = [...doc.querySelectorAll('#pokemon-sets-1 .set-row')]
        .find(r => r.dataset.setNumber === '3');
    check('mega: Sableye-3 row renders', Boolean(sabRow));
    if (sabRow) {
        check('mega: row speed cell shows pre → post',
            sabRow.textContent.includes('70 → 40'));
        sabRow.click();
        await sleep(150);
        const spd = doc.querySelector('#pokemon-sets-1 .set-details .speed');
        check('mega: details speed shows pre → post (' + (spd ? spd.textContent.trim() : 'none') + ')',
            Boolean(spd) && spd.textContent.includes('70 → 40'));
        sabRow.click(); // collapse again
        await sleep(100);
    }

    /* ---- new languages: Korean tree data through the UI ---- */
    $('#language-select').val('ko').trigger('change');
    await sleep(700);
    const koIdx = $('#trainer-dropdown-1 option').eq(1).val();
    $('#trainer-dropdown-1').val(koIdx).trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: koIdx } } });
    await sleep(200);
    check('ko: trainer name in Hangul (' + $('#trainer-dropdown-1 option:selected').text() + ')',
        /[\uac00-\ud7af]/.test($('#trainer-dropdown-1 option:selected').text()));
    check('ko: pokemon menu placeholder 포켓몬',
        $('#pokemon-menu-2').data('select2').options.options.placeholder === '포켓몬');
    const koSpecies = $('#pokemon-menu-1 option').eq(1).val();
    $('#pokemon-menu-1').val(koSpecies).trigger('change');
    $('#pokemon-menu-1').trigger({ type: 'select2:select', params: { data: { id: koSpecies } } });
    await sleep(100);
    check('ko: sets render for ' + koSpecies, doc.querySelectorAll('#pokemon-sets-1 .set-row').length > 0);
    $('#language-select').val('chs').trigger('change');
    await sleep(700);
    check('chs: trainer preserved, name in Chinese (' + $('#trainer-dropdown-1 option:selected').text() + ')',
        /[\u4e00-\u9fff]/.test($('#trainer-dropdown-1 option:selected').text()));
    check('chs: species selection preserved', Boolean($('#pokemon-menu-1').val()));

    /* ---- SM delta variant (empty delta == USUM data) ---- */
    $('#variant-select').val('tree-sm').trigger('change');
    await sleep(700);
    check('SM: variant stored', window.localStorage.getItem('selectedVariant') === 'tree-sm');
    check('SM: merged trainers load (204: Kukui removed)', $('#trainer-dropdown-1 option').length === 204);
    check('SM: Kukui absent', !$('#trainer-dropdown-1 option').toArray().some(o => o.text === 'Kukui'));
    const smIdx = $('#trainer-dropdown-1 option').eq(1).val();
    $('#trainer-dropdown-1').val(smIdx).trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: smIdx } } });
    await sleep(200);
    const smSp = $('#pokemon-menu-1 option').eq(1).val();
    $('#pokemon-menu-1').val(smSp).trigger('change');
    $('#pokemon-menu-1').trigger({ type: 'select2:select', params: { data: { id: smSp } } });
    await sleep(100);
    check('SM: sets render through delta merge', doc.querySelectorAll('#pokemon-sets-1 .set-row').length > 0);
    $('#variant-select').val('tree-usum').trigger('change');
    await sleep(700);

    /* ---- game switch (chs not available in subway -> fallback to en) ---- */
    $('#game-select').val('subway').trigger('change');
    await sleep(700);
    check('subway: language options = 7', $('#language-select option').length === 7);
    check('subway: chs falls back to en', $('#language-select').val() === 'en');
    check('subway: trainers loaded (' + ($('#trainer-dropdown-1 option').length - 1) + ')',
        $('#trainer-dropdown-1 option').length === 303);
    check('subway: selection reset', doc.getElementById('pokemon-menu-container-1').style.display === 'none');
    check('subway: late pill shows 28+', doc.getElementById('late-filter').textContent === '28+');

    /* ---- subway in Japanese end-to-end ---- */
    $('#language-select').val('jp').trigger('change');
    await sleep(700);
    const jpSubIdx = $('#trainer-dropdown-1 option').eq(1).val();
    $('#trainer-dropdown-1').val(jpSubIdx).trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: jpSubIdx } } });
    await sleep(200);
    check('subway jp: trainer selectable (' + $('#trainer-dropdown-1 option:selected').text() + ')',
        doc.querySelectorAll('#slot-species-1 .pokemon-sprite').length > 0);
    const jpSubSpecies = $('#pokemon-menu-1 option').eq(1).val();
    $('#pokemon-menu-1').val(jpSubSpecies).trigger('change');
    $('#pokemon-menu-1').trigger({ type: 'select2:select', params: { data: { id: jpSubSpecies } } });
    await sleep(100);
    check('subway jp: sets render for ' + jpSubSpecies,
        doc.querySelectorAll('#pokemon-sets-1 .set-row').length > 0);
    $('#language-select').val('en').trigger('change');
    await sleep(500);

    /* ---- Battle Maison (gen 6): triples + delta variant ---- */
    $('#game-select').val('maison').trigger('change');
    await sleep(700);
    check('maison: 2 variants (ORAS default)', $('#variant-select option').length === 2
        && $('#variant-select').val() === 'maison-oras');
    check('maison: 4 mode cells', doc.querySelectorAll('.mode-cell').length === 4);
    check('maison: ORAS trainers load (194)', $('#trainer-dropdown-1 option').length === 195);
    check('maison: late pill shows 40+', doc.getElementById('late-filter').textContent === '40+');
    check('maison: Inga present (ORAS-corpus name)', $('#trainer-dropdown-1 option').toArray().some(o => o.text === 'Inga'));
    const mIdx = $('#trainer-dropdown-1 option').eq(1).val();
    $('#trainer-dropdown-1').val(mIdx).trigger('change');
    $('#trainer-dropdown-1').trigger({ type: 'select2:select', params: { data: { id: mIdx } } });
    await sleep(200);
    doc.querySelector('.mode-cell[data-mode="triples"]').click();
    await sleep(100);
    check('maison triples: 3 slots visible, w-3',
        [1, 2, 3].every(n => doc.getElementById(`pokemon-menu-container-${n}`).style.display === 'block'
            && doc.getElementById(`pokemon-menu-container-${n}`).classList.contains('w-3')));
    check('maison triples: species lists above all 3 slots',
        [1, 2, 3].every(n => doc.querySelectorAll(`#slot-species-${n} .pokemon-sprite`).length > 0));
    /* minisprite lists must be in National Dex order (pokedex-6 file order) */
    const dex6 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pokedex-6.json'), 'utf8'))
        .pokedex.map(p => p.en);
    const spriteAlts = [...doc.querySelectorAll('#slot-species-1 .pokemon-sprite')]
        .map(img => img.alt);
    check('maison: minisprites in dex order (' + spriteAlts.length + ' sprites)',
        spriteAlts.length > 1 && spriteAlts.every((sp, i) =>
            i === 0 || dex6.indexOf(spriteAlts[i - 1]) <= dex6.indexOf(sp)));
    const mSp = $('#pokemon-menu-3 option').eq(1).val();
    $('#pokemon-menu-3').val(mSp).trigger('change');
    $('#pokemon-menu-3').trigger({ type: 'select2:select', params: { data: { id: mSp } } });
    await sleep(100);
    check('maison triples: sets render in slot 3 (' + mSp + ')',
        doc.querySelectorAll('#pokemon-sets-3 .set-row').length > 0);
    const mRows = doc.querySelectorAll('#pokemon-sets-3 .set-row');
    mRows[0].click();
    await sleep(150);
    check('maison: details render with computed speed',
        Boolean(doc.querySelector('#pokemon-sets-3 .set-details .speed')));
    /* XY delta variant */
    $('#variant-select').val('maison-xy').trigger('change');
    await sleep(700);
    check('maison-xy: trainers merge to 194', $('#trainer-dropdown-1 option').length === 195);
    check('maison-xy: Sati replaces Inga', $('#trainer-dropdown-1 option').toArray().some(o => o.text === 'Sati')
        && !$('#trainer-dropdown-1 option').toArray().some(o => o.text === 'Inga'));
    /* maison jp end-to-end */
    $('#language-select').val('jp').trigger('change');
    await sleep(700);
    check('maison-xy jp: trainers load', $('#trainer-dropdown-1 option').length === 195);
    $('#language-select').val('en').trigger('change');
    await sleep(500);

    /* ---- legacy localStorage migration ---- */
    check('localStorage selectedGame saved', window.localStorage.getItem('selectedGame') === 'maison');

    console.log('\nConsole errors during run:', errors.length ? errors : 'none');
    console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
    process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); console.log(errors); process.exit(2); });
