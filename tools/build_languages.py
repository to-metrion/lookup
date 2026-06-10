#!/usr/bin/env python3
"""Generates localized data files from the poke-corpus game text dumps.

Source: https://github.com/abcboy101/poke-corpus (clone locally, see CORPUS).
The corpus stores one text file per game+language, line-aligned across
languages, with a `qid` file marking "Text File : N" sections.

This script:
  1. adds Korean (and fills other missing) columns to the shared data files
     (pokedex-7.json, pokedex-5.json, items.json, natures.json)
  2. generates <dir>/sets-<lang>.json for new languages (mechanical
     translation of species/items/natures/moves via the aligned name tables)
  3. generates <dir>/trainers-<lang>.json (trainer names from the name
     list sections; quotes matched by exact string in the dialogue sections,
     then read from the same lines in the target language)

Usage:  python3 tools/build_languages.py [--corpus /path/to/poke-corpus/corpus]

Verification: run tools/validate.py afterwards. This script also self-checks
against the pre-existing hand-made columns (fr/jp) and reports mismatches.
"""

import argparse, functools, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

parser = argparse.ArgumentParser()
parser.add_argument('--corpus', default='/tmp/pokecorpus/corpus')
ARGS = parser.parse_args()
CORPUS = Path(ARGS.corpus)

# app language code -> corpus language code
LANG = {'en': 'en', 'fr': 'fr', 'it': 'it', 'de': 'de', 'es': 'es',
        'jp': 'ja', 'ko': 'ko', 'chs': 'zh-Hans', 'cht': 'zh-Hant'}

USUM, BW, SV = 'UltraSunUltraMoon', 'BlackWhite', 'ScarletViolet'

# text-file section ids per game (discovered via anchors; stable per dump)
SECTIONS = {
    USUM: {'species': '60', 'items': '40', 'natures': '92', 'abilities': '101',
           'classes': '111', 'moves': '118', 'forms': '119',
           'trainer_names': '104', 'quotes': '103'},
    BW:   {'species': '70', 'items': '54', 'natures': '24', 'abilities': '182',
           'moves': '203', 'trainer_names': '11', 'quotes': '184'},
    SV:   {'species': 'monsname', 'items': 'itemname', 'natures': 'seikaku',
           'abilities': 'tokusei', 'moves': 'wazaname', 'forms': 'zkn_form'},
}

# generic words to strip when deriving a form suffix from a full form name
FORM_GENERIC = {
    'en': ['Forme', 'Form', 'Style', 'Mode', 'Size', 'Cloak', 'Plumage', 'Trim',
           'Pattern', 'Face', 'Rotom', 'Kyurem', 'Necrozma'],
    'fr': ['Forme', 'Style', 'Mode', 'Taille', 'Motif', 'Cape'],
    'it': ['Forma', 'Stile', 'Modulo', 'Taglia', 'Motivo'],
    'de': ['Form', 'Stil', 'Modus', 'Größe', 'Muster'],
    'es': ['Forma', 'Estilo', 'Modo', 'Tamaño', 'Motivo'],
    'jp': ['フォルム', 'のすがた', 'すがた', 'スタイル', 'モード', 'サイズ', 'のもよう', 'もよう'],
    'ko': ['폼', '의 모습', '모습', '스타일', '모드', '사이즈', '무늬'],
    'chs': ['形态', '的样子', '样子', '风格', '模式', '尺寸', '造型', '花纹'],
    'cht': ['形態', '的樣子', '樣子', '風格', '模式', '尺寸', '造型', '花紋'],
}

report = {'warn': [], 'info': []}
def warn(msg): report['warn'].append(msg)
def info(msg): report['info'].append(msg)


# ---------------- corpus access ----------------

@functools.lru_cache(maxsize=None)
def lines(game, lang, file='common'):
    return (CORPUS / game / f'{lang}_{file}.txt').read_text(encoding='utf-8-sig').split('\n')

@functools.lru_cache(maxsize=None)
def sections(game, file='common'):
    qid = lines(game, 'qid', file)
    out, cur = {}, None
    for i, l in enumerate(qid):
        m = re.match(r'Text File : (\S+)', l)
        if m:
            if cur: out[cur[0]] = (cur[1], i - 2)
            cur = (m.group(1), i + 2)
    if cur: out[cur[0]] = (cur[1], len(qid) - 1)
    return out

def column(game, section, lang, file='common'):
    a, b = sections(game, file)[SECTIONS[game][section]]
    return lines(game, LANG[lang], file)[a:b + 1]

def clean(s):
    s = s.replace('\\n', ' ').replace('\\r', ' ').replace('\\c', '')
    s = re.sub(r'\[VAR [^\]]*\]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def qnorm(s):
    """Normalization for matching our data text against corpus text."""
    return re.sub(r'\s+', ' ', clean(s).replace('’', "'").replace('‘', "'")
                  .replace('“', '"').replace('”', '"')).strip().lower()

def nrm(s):
    return re.sub(r'[^0-9a-zà-ɏα-ω]', '', s.lower())


# ---------------- aligned name maps ----------------

def name_map(game, section, target_langs):
    """en (normalized) -> {lang: name}, index-aligned.
    BW's kanji file ('ja') has [NULL] for some sections — falls back to kana."""
    en = column(game, section, 'en')
    cols = {lang: column(game, section, lang) for lang in target_langs}
    fallback_jp = None
    if 'jp' in target_langs and (CORPUS / game / 'ja-Hrkt_common.txt').exists():
        a, b = sections(game)[SECTIONS[game][section]]
        fallback_jp = lines(game, 'ja-Hrkt')[a:b + 1]
    out = {}
    for i, name in enumerate(en):
        key = nrm(name)
        if not name or not key or key in out:
            continue
        entry = {}
        for lang in target_langs:
            v = cols[lang][i]
            if lang == 'jp' and (not v or v == '[NULL]') and fallback_jp:
                v = fallback_jp[i]
            entry[lang] = '' if v == '[NULL]' else v
        out[key] = entry
    return out

# Old-gen official spellings that differ beyond punctuation/spacing
MOVE_ALIASES = {'feintattack': 'faintattack', 'highjumpkick': 'hijumpkick',
                'smellingsalts': 'smellingsalt', 'visegrip': 'vicegrip'}

def lookup(maps, name, lang, aliases=None):
    """Try several maps in order; returns localized name or None."""
    key = nrm(name)
    for m in maps:
        if key in m and m[key].get(lang):
            return m[key][lang]
        alias = (aliases or {}).get(key)
        if alias and alias in m and m[alias].get(lang):
            return m[alias][lang]
    return None


# ---------------- form suffix derivation ----------------

def residual(text, base_name, lang):
    """Form display name minus species name minus generic words -> suffix."""
    t = text
    if base_name:
        t = t.replace(base_name, '')
    for g in sorted(FORM_GENERIC.get(lang, []), key=len, reverse=True):
        t = t.replace(g, '')
    return re.sub(r'\s+', ' ', t).strip(' -%')

def build_form_suffix_map(games, target_langs):
    """en suffix (normalized) -> {lang: localized suffix} using form-name sections."""
    out = {}
    for game in games:
        if 'forms' not in SECTIONS[game]:
            continue
        en = column(game, 'forms', 'en')
        species_en = set(column(game, 'species', 'en'))
        cols = {lang: column(game, 'forms', lang) for lang in target_langs}
        species_cols = {lang: dict(zip(column(game, 'species', 'en'),
                                       column(game, 'species', lang))) for lang in target_langs}
        for i, text in enumerate(en):
            if not text:
                continue
            base = next((sp for sp in species_en if sp and sp in text), '')
            suf_en = residual(text, base, 'en')
            if not suf_en or nrm(suf_en) in out:
                continue
            entry = {}
            for lang in target_langs:
                loc = cols[lang][i]
                if not loc or any(0xE000 <= ord(c) <= 0xF8FF for c in loc):
                    continue  # private-use glyphs (Chinese species names)
                loc_base = species_cols[lang].get(base, '') if base else ''
                suf = residual(loc, loc_base, lang)
                if suf:
                    entry[lang] = suf
            if entry:
                out[nrm(suf_en)] = entry
    # manual fixups for short/odd suffixes
    out.setdefault('f', {}).update({l: s for l, s in
        (out.get('female') or {}).items() if s})
    out.setdefault('m', {}).update({l: s for l, s in
        (out.get('male') or {}).items() if s})
    # regional form suffixes absent from the gen-7 corpus (official region names)
    out.setdefault('galar', {}).setdefault('ko', '가라르')
    out.setdefault('hisui', {}).setdefault('ko', '히스이')
    out.setdefault('paldea', {}).setdefault('ko', '팔데아')
    # forms whose corpus form-name doesn't reduce to our suffix convention
    # (Korean official form names; other languages already exist in the dex files)
    out.setdefault('combat', {}).setdefault('ko', '콤바트')      # Paldean Tauros breeds
    out.setdefault('blaze', {}).setdefault('ko', '블레이즈')
    out.setdefault('aqua', {}).setdefault('ko', '아쿠아')
    out.setdefault('primal', {}).setdefault('ko', '원시')        # Primal Reversion
    out.setdefault('galarzen', {}).setdefault('ko', '가라르-달마')  # Galarian Zen Mode
    out.setdefault('blue', {}).setdefault('ko', '파란줄무늬')     # Blue-Striped Basculin
    return out


# ---------------- data file updates ----------------

BASE_HYPHEN = {'Ho-Oh', 'Porygon-Z', 'Kommo-o', 'Hakamo-o', 'Jangmo-o',
               'Wo-Chien', 'Chien-Pao', 'Chi-Yu', 'Ting-Lu'}

def split_form(en_name):
    if en_name in BASE_HYPHEN or '-' not in en_name:
        return en_name, None
    for base in BASE_HYPHEN:
        if en_name.startswith(base + '-'):
            return base, en_name[len(base) + 1:]
    base, suffix = en_name.split('-', 1)
    return base, suffix

def localize_species(en_name, lang, species_maps, suffix_map, existing=None):
    """Build localized species name: localized base + '-' + localized suffix."""
    base, suffix = split_form(en_name)
    loc_base = lookup(species_maps, base, lang)
    if not loc_base:
        return None
    if not suffix:
        return loc_base
    # suffix may itself be multi-part (Mega-X, Pom-Pom)
    loc_suf = (suffix_map.get(nrm(suffix)) or {}).get(lang)
    if not loc_suf:
        # try last component (e.g. "Mega-X" handled whole; "Alola" direct)
        return None
    return f'{loc_base}-{loc_suf}'


def update_shared_files(species_maps7, species_maps5, item_maps, nature_maps,
                        ability_maps, suffix_map, new_langs7, new_langs5):
    # pokedex-7 + pokedex-5
    for dex_file, maps, langs in (('pokedex-7.json', species_maps7, new_langs7),
                                  ('pokedex-5.json', species_maps5, new_langs5)):
        dex = json.loads((DATA / dex_file).read_text(encoding='utf-8'))
        unresolved = []
        for p in dex['pokedex']:
            for lang in langs:
                if not p.get(lang):
                    loc = localize_species(p['en'], lang, maps, suffix_map)
                    if loc:
                        p[lang] = loc
                    else:
                        unresolved.append((p['en'], lang))
                ab_key = f'abilities-{lang}'
                if not p.get(ab_key):
                    parts = [lookup(ability_maps, a, lang)
                             for a in p.get('abilities-en', '').split(', ') if a]
                    if parts and all(parts):
                        p[ab_key] = ', '.join(parts)
        (DATA / dex_file).write_text(json.dumps(dex, indent=4, ensure_ascii=False) + '\n',
                                     encoding='utf-8')
        if unresolved:
            warn(f'{dex_file}: {len(unresolved)} unresolved species names, e.g. '
                 + ', '.join(f'{n}/{l}' for n, l in unresolved[:8]))
        info(f'{dex_file}: updated columns {langs}')

    # items.json
    items = json.loads((DATA / 'items.json').read_text(encoding='utf-8'))
    filled = missing = 0
    for it in items['items']:
        if not it.get('ko'):
            loc = lookup(item_maps, it['en'], 'ko')
            if loc:
                it['ko'] = loc; filled += 1
            else:
                missing += 1
    (DATA / 'items.json').write_text(json.dumps(items, indent=4, ensure_ascii=False) + '\n',
                                     encoding='utf-8')
    info(f'items.json: ko filled for {filled}, not found for {missing}')

    # natures.json
    natures = json.loads((DATA / 'natures.json').read_text(encoding='utf-8'))
    for n in natures['natures']:
        if not n.get('nature-ko'):
            loc = lookup(nature_maps, n['nature-en'], 'ko')
            if loc:
                n['nature-ko'] = loc
                n['stats-ko'] = n['stats-en']  # same (+Atk -Def) notation everywhere
    (DATA / 'natures.json').write_text(json.dumps(natures, indent=4, ensure_ascii=False) + '\n',
                                       encoding='utf-8')
    info('natures.json: ko added')


# ---------------- sets + trainers generation ----------------

def load_data(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))

def gen_sets(prefix, dex_file, lang, species_maps, item_maps, move_maps,
             nature_maps, suffix_map):
    en_sets = load_data(f'{prefix}/sets-en.json')['sets']
    dex = load_data(dex_file)['pokedex']
    dex_by_en = {p['en']: p for p in dex}
    # The app resolves items/natures via items.json / natures.json columns, so
    # generated sets MUST use those spellings; corpus is only a fallback.
    items_local = {nrm(r['en']): r for r in load_data('items.json')['items']}
    natures_local = {nrm(r['nature-en']): r for r in load_data('natures.json')['natures']}
    item_maps = [{k: {lang: v.get(lang)} for k, v in items_local.items()}] + item_maps
    nature_maps = [{k: {lang: v.get(f'nature-{lang}')} for k, v in natures_local.items()}] + nature_maps
    out, problems = [], []
    for s in en_sets:
        loc_species = dex_by_en.get(s['species'], {}).get(lang) \
            or localize_species(s['species'], lang, species_maps, suffix_map)
        item = s['item']
        loc_item = item if item in ('', 'None') else lookup(item_maps, item, 'ko' if False else lang)
        loc_nature = lookup(nature_maps, s['nature'], lang)
        moves = {}
        for i in (1, 2, 3, 4):
            mv = s[f'move{i}']
            if not mv or mv == '-':
                moves[i] = mv
                continue
            parts = [lookup(move_maps, p.strip(), lang, MOVE_ALIASES)
                     for p in mv.split('/')]
            moves[i] = ' / '.join(p for p in parts if p) if all(parts) else None
        if not all([loc_species, loc_item is not None, loc_nature,
                    all(moves[i] is not None for i in (1, 2, 3, 4))]):
            problems.append(s['setName'])
            continue
        out.append({
            'setName': f"{loc_species}-{s['setNumber']}",
            'species': loc_species,
            'setNumber': s['setNumber'],
            'nature': loc_nature,
            'item': loc_item,
            'move1': moves[1], 'move2': moves[2],
            'move3': moves[3], 'move4': moves[4],
            'EVs': s['EVs'], 'speed': s['speed'],
            **({'tera': s['tera']} if 'tera' in s else {}),
        })
    if problems:
        warn(f'{prefix}/sets-{lang}: {len(problems)} sets dropped (untranslatable): '
             + ', '.join(problems[:6]))
    path = DATA / prefix / f'sets-{lang}.json'
    path.write_text(json.dumps({'sets': out}, indent=4, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    info(f'{prefix}-sets-{lang}.json: {len(out)} sets')


def match_quotes(game, trainers):
    """For each en trainer, find its dialogue line offset in the quotes section.
    Matches the intro quote; disambiguates with win/loss quotes when present."""
    en = [qnorm(l) for l in column(game, 'quotes', 'en')]
    index = {}
    for i, l in enumerate(en):
        index.setdefault(l, []).append(i)
    offsets = {}
    for t in trainers:
        cands = index.get(qnorm(t['quote']), [])
        if len(cands) > 1 and t.get('winQuote'):
            cands = [c for c in cands if c + 1 < len(en) and en[c + 1] == qnorm(t['winQuote'])]
        if not cands and t.get('winQuote'):
            # intro text differs slightly -> anchor on the win quote instead
            cands = [c - 1 for c in index.get(qnorm(t['winQuote']), []) if c > 0]
        if not cands:
            # last resort: fuzzy match (handles tiny wording drift in our data)
            import difflib
            close = difflib.get_close_matches(qnorm(t['quote']), list(index), n=1, cutoff=0.9)
            if close:
                cands = index[close[0]]
                info(f"{game}: fuzzy quote match for {t['name']!r}")
        offsets[t['name']] = cands[0] if cands else None
        if not cands:
            warn(f"{game}: no quote match for trainer {t['name']!r}")
    return offsets


def gen_trainers(prefix, game, dex_file, lang, species_maps, suffix_map,
                 class_section=True):
    en_tr = load_data(f'{prefix}/trainers-en.json')['trainers']
    dex = load_data(dex_file)['pokedex']
    dex_by_en = {p['en']: p for p in dex}
    names_en = column(game, 'trainer_names', 'en')
    names_loc = column(game, 'trainer_names', lang)
    quotes_loc = column(game, 'quotes', lang)
    offsets = match_quotes(game, en_tr)
    class_map = name_map(game, 'classes', [lang]) if class_section and 'classes' in SECTIONS[game] else {}

    def loc_species_name(en_name):
        return dex_by_en.get(en_name, {}).get(lang) \
            or localize_species(en_name, lang, species_maps, suffix_map)

    out, problems = [], []
    for t in en_tr:
        # name: unique string match in the trainer-name section
        idxs = [i for i, n in enumerate(names_en) if n == t['name']]
        loc_name = names_loc[idxs[0]] if idxs else None
        if len(idxs) > 1:
            # same en name twice (e.g. Red/Blue): all rows hold the same
            # localized name unless they differ; warn if ambiguous
            alts = {names_loc[i] for i in idxs}
            if len(alts) > 1:
                warn(f'{prefix}-{lang}: ambiguous trainer name {t["name"]!r}: {alts}')
        off = offsets.get(t['name'])
        quote = clean(quotes_loc[off]) if off is not None else None
        species_loc = [loc_species_name(sp) for sp in t['species'].split(', ')]
        roster_loc = []
        for entry in t['roster'].split(', '):
            m = re.match(r'(.+)-(\d+)$', entry)
            loc = loc_species_name(m.group(1)) if m else None
            roster_loc.append(f'{loc}-{m.group(2)}' if loc else None)
        if not loc_name or not quote or not all(species_loc) or not all(roster_loc):
            problems.append(t['name'])
            continue
        rec = {'name': loc_name}
        if 'class' in t:
            rec['class'] = (class_map.get(nrm(t['class'])) or {}).get(lang, t['class'])
        rec.update({
            'roster': ', '.join(roster_loc),
            'species': ', '.join(species_loc),
            'late': t.get('late', ''),
            'quote': quote,
        })
        if 'winQuote' in t and off is not None:
            rec['winQuote'] = clean(quotes_loc[off + 1])
            rec['lossQuote'] = clean(quotes_loc[off + 2])
        rec['sprite'] = t['sprite']
        out.append(rec)
    if problems:
        warn(f'{prefix}/trainers-{lang}: {len(problems)} trainers dropped: {problems[:8]}')
    path = DATA / f'{prefix}/trainers-{lang}.json'
    path.write_text(json.dumps({'trainers': out}, indent=4, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    info(f'{prefix}-trainers-{lang}.json: {len(out)} trainers')


# ---------------- self-check against existing hand-made files ----------------

def self_check(game, prefix, lang):
    """Compare generated names/quotes against a pre-existing file."""
    try:
        existing = load_data(f'{prefix}/trainers-{lang}.json')['trainers']
    except FileNotFoundError:
        return
    en_tr = load_data(f'{prefix}/trainers-en.json')['trainers']
    names_en = column(game, 'trainer_names', 'en')
    names_loc = column(game, 'trainer_names', lang)
    same = diff = 0
    for t_en, t_ex in zip(en_tr, existing):
        idxs = [i for i, n in enumerate(names_en) if n == t_en['name']]
        if idxs and names_loc[idxs[0]] == t_ex['name']:
            same += 1
        else:
            diff += 1
            if diff <= 5:
                info(f'self-check {prefix}/{lang}: {t_en["name"]} -> corpus '
                     f'{names_loc[idxs[0]] if idxs else "?"} vs existing {t_ex["name"]}')
    info(f'self-check {prefix}/{lang} trainer names: {same} same, {diff} differ')


# ---------------- main ----------------

def main():
    langs_all = ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht']
    langs_bw = ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko']

    # aligned name tables (USUM primary, SV fallback for newer entries)
    sp_usum = name_map(USUM, 'species', langs_all)
    sp_sv = name_map(SV, 'species', langs_all)
    sp_bw = name_map(BW, 'species', langs_bw)
    it_usum = name_map(USUM, 'items', langs_all)
    it_sv = name_map(SV, 'items', langs_all)
    it_bw = name_map(BW, 'items', langs_bw)
    mv_usum = name_map(USUM, 'moves', langs_all)
    mv_sv = name_map(SV, 'moves', langs_all)
    mv_bw = name_map(BW, 'moves', langs_bw)
    nt_usum = name_map(USUM, 'natures', langs_all)
    nt_bw = name_map(BW, 'natures', langs_bw)
    ab_usum = name_map(USUM, 'abilities', langs_all)
    ab_sv = name_map(SV, 'abilities', langs_all)
    ab_bw = name_map(BW, 'abilities', langs_bw)
    suffix_map = build_form_suffix_map([USUM, SV], langs_all)
    info(f'form suffixes derived: {len(suffix_map)}')

    # 1. shared files (ko everywhere; chs/cht species already exist in dex7)
    update_shared_files(
        species_maps7=[sp_usum, sp_sv], species_maps5=[sp_bw, sp_usum, sp_sv],
        item_maps=[it_usum, it_sv, it_bw], nature_maps=[nt_usum],
        ability_maps=[ab_usum, ab_sv, ab_bw], suffix_map=suffix_map,
        new_langs7=['ko'], new_langs5=['ko'])

    # 2. sets
    for lang in ['it', 'de', 'es', 'ko', 'chs', 'cht']:
        gen_sets('tree', 'pokedex-7.json', lang, [sp_usum, sp_sv],
                 [it_usum, it_sv], [mv_usum, mv_sv], [nt_usum], suffix_map)
    for lang in ['jp', 'fr', 'it', 'de', 'es', 'ko']:
        gen_sets('subway', 'pokedex-5.json', lang, [sp_bw, sp_usum],
                 [it_bw, it_usum], [mv_bw, mv_usum], [nt_bw, nt_usum], suffix_map)

    # 3. trainers
    self_check(USUM, 'tree', 'fr')
    self_check(USUM, 'tree', 'jp')
    for lang in ['it', 'de', 'es', 'ko', 'chs', 'cht']:
        gen_trainers('tree', USUM, 'pokedex-7.json', lang, [sp_usum, sp_sv], suffix_map)
    for lang in ['jp', 'fr', 'it', 'de', 'es', 'ko']:
        gen_trainers('subway', BW, 'pokedex-5.json', lang, [sp_bw, sp_usum],
                     suffix_map, class_section=False)

    print('\n--- INFO ---')
    for m in report['info']: print(' ', m)
    print(f'--- WARNINGS ({len(report["warn"])}) ---')
    for m in report['warn']: print(' ', m)

if __name__ == '__main__':
    main()
