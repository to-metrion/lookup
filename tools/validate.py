#!/usr/bin/env python3
"""Data integrity validator for the Battle Facility Tool.

Run from the repo root (or anywhere):  python3 tools/validate.py

Checks, for every variant/language combination:
  - every trainer roster entry "Species-N" has a matching set
  - every species (trainer lists + sets) resolves in the variant's pokedex
  - minisprite and large sprite images exist for every used species
  - every set item resolves in items.json and its image exists
  - every set nature resolves in natures.json
  - no empty/duplicate trainers
  - per-language trainer files are PARALLEL ARRAYS (same count, same sprites,
    same rosters once translated to English) — language switching relies on this

Exit code 0 = clean, 1 = problems found.

NOTE: keep VARIANTS below in sync with scripts/config.js when adding content.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
IMAGES = ROOT / 'assets' / 'images'

# (dataPrefix, pokedex file, gen, [languages])  — keep in sync with scripts/config.js
VARIANTS = [
    ('tree', 'pokedex-7.json', 7, ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko', 'chs', 'cht']),
    ('subway', 'pokedex-5.json', 5, ['en', 'fr', 'it', 'de', 'es', 'jp', 'ko']),
    ('eba', 'pokedex-9.json', 9, ['en']),  # hidden from the site, validate anyway
]

ROSTER_RE = re.compile(r'(.+)-(\d+)$')

problems = []


def problem(msg):
    problems.append(msg)
    print(f'  PROBLEM: {msg}')


def load(name):
    with open(DATA / name, encoding='utf-8') as f:
        return json.load(f)


def image_exists(*parts):
    return (IMAGES.joinpath(*parts)).exists()


def item_image_name(english):
    return re.sub(r'[^a-z0-9]', '', english.lower()) + '.png'


def normalize_move(name):
    return re.sub(r'[^a-z0-9]', '', name.lower())


def move_type(moves_index, name, gen):
    """Gen-aware type for an (English) move name; None if unknown."""
    entries = moves_index.get(normalize_move(name.split('/')[0].strip()))
    if not entries:
        return None
    result = None
    for g, type_ in entries:
        if g <= gen:
            result = type_
    return result


def validate_variant_language(prefix, lang, dex, items, natures, gen=None, moves_index=None):
    tag = f'{prefix}/{lang}'
    trainers = load(f'{prefix}-trainers-{lang}.json')['trainers']
    sets = load(f'{prefix}-sets-{lang}.json')['sets']
    dex_by_lang = {p[lang]: p for p in dex if p.get(lang)}
    set_keys = {(s['species'], s['setNumber']) for s in sets}
    items_by_lang = {i[lang]: i for i in items if i.get(lang)}
    nature_names = {n[f'nature-{lang}'] for n in natures}

    seen_names = set()
    for t in trainers:
        name = t.get('name', '').strip()
        if not name:
            problem(f'{tag}: trainer with empty name')
            continue
        if name in seen_names:
            # Not fatal: the app keys trainers by index, and official games do
            # contain distinct trainers with identical localized names.
            print(f'  note: {tag}: duplicate trainer name "{name}" (ok, trainers are index-keyed)')
        seen_names.add(name)

        for sp in t['species'].split(', '):
            if sp not in dex_by_lang:
                problem(f'{tag}: {name}: species "{sp}" not in pokedex')
                continue
            en = dex_by_lang[sp]['en'].lower()
            if not image_exists('minisprites', en + '.png'):
                problem(f'{tag}: {name}: missing minisprite for "{sp}" ({en}.png)')
            if not image_exists('sprites', en + '.png'):
                problem(f'{tag}: {name}: missing sprite for "{sp}" ({en}.png)')

        for entry in t['roster'].split(', '):
            m = ROSTER_RE.match(entry)
            if not m:
                problem(f'{tag}: {name}: unparseable roster entry "{entry}"')
                continue
            if (m.group(1), int(m.group(2))) not in set_keys:
                problem(f'{tag}: {name}: roster entry "{entry}" has no matching set')

    for s in sets:
        sid = f"{s.get('species','?')}-{s.get('setNumber','?')}"
        if s['species'] not in dex_by_lang:
            problem(f'{tag}: set {sid}: species not in pokedex')
        item = s.get('item', '')
        if item and item != 'None':
            rec = items_by_lang.get(item)
            if not rec:
                problem(f'{tag}: set {sid}: item "{item}" not in items.json')
            elif not image_exists('items', item_image_name(rec['en'])):
                problem(f'{tag}: set {sid}: missing item image {item_image_name(rec["en"])}')
        if s.get('nature') not in nature_names:
            problem(f'{tag}: set {sid}: nature "{s.get("nature")}" not in natures.json')
        # EVs may legitimately be empty (early-streak Pokémon have none).
        for field in ('setName', 'move1', 'speed'):
            if field not in s or s[field] in ('', None):
                problem(f'{tag}: set {sid}: missing/empty field "{field}"')
        # Move types are looked up via English names only.
        if lang == 'en' and moves_index is not None:
            for i in (1, 2, 3, 4):
                move = s.get(f'move{i}')
                if move and move != '-' and move_type(moves_index, move, gen) is None:
                    problem(f'{tag}: set {sid}: move "{move}" not in moves.json (gen {gen})')

    return trainers


def roster_signature(trainer, lang, dex):
    """Roster as a sorted list of (English species, set number)."""
    by_lang = {p[lang]: p for p in dex if p.get(lang)}
    out = []
    for entry in trainer['roster'].split(', '):
        m = ROSTER_RE.match(entry)
        if not m:
            continue
        rec = by_lang.get(m.group(1))
        out.append((rec['en'] if rec else m.group(1), m.group(2)))
    return sorted(out)


def validate_parallel(prefix, langs, dex):
    if len(langs) < 2:
        return
    base_lang = langs[0]
    base = load(f'{prefix}-trainers-{base_lang}.json')['trainers']
    for lang in langs[1:]:
        other = load(f'{prefix}-trainers-{lang}.json')['trainers']
        if len(base) != len(other):
            problem(f'{prefix}: trainer count differs: {base_lang}={len(base)} {lang}={len(other)}')
            continue
        for i, (a, b) in enumerate(zip(base, other)):
            if a.get('sprite') != b.get('sprite'):
                problem(f'{prefix}: trainer #{i} sprite differs between {base_lang} and {lang}')
            if roster_signature(a, base_lang, dex) != roster_signature(b, lang, dex):
                problem(f'{prefix}: trainer #{i} ("{a["name"]}") roster differs between {base_lang} and {lang}')


def main():
    items = load('items.json')['items']
    natures = load('natures.json')['natures']
    moves_index = {normalize_move(k): v for k, v in load('moves.json')['moves'].items()}

    for prefix, dex_file, gen, langs in VARIANTS:
        dex = load(dex_file)['pokedex']
        print(f'== {prefix} (gen {gen}; {", ".join(langs)}) ==')
        for lang in langs:
            validate_variant_language(prefix, lang, dex, items, natures, gen, moves_index)
        validate_parallel(prefix, langs, dex)

    print()
    if problems:
        print(f'{len(problems)} problem(s) found.')
        sys.exit(1)
    print('All checks passed.')
    sys.exit(0)


if __name__ == '__main__':
    main()
