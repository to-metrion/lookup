// Facility and language configuration — the single place to edit when adding content.
//
// To add a facility: add an entry here and drop the matching JSON files in /data:
//   data/<code>-trainers-<lang>.json  and  data/<code>-sets-<lang>.json
// To add a language to a facility: add its code to `languages` (flag image in
// assets/images/flags/<code>.png, display name in LANGUAGE_NAMES below).

export const FACILITIES = [
    // EisenBerry Academy ('eba') is hidden for now; its data files remain in /data.
    // To re-enable, restore:
    // { code: 'eba', name: 'EisenBerry Academy', pokedex: 'data/pokedex-9.json', languages: ['en'] },
    {
        code: 'tree',
        name: 'Battle Tree (USUM)',
        pokedex: 'data/pokedex-7.json',
        languages: ['en', 'fr', 'jp'],
    },
    {
        code: 'subway',
        name: 'Battle Subway',
        pokedex: 'data/pokedex-5.json',
        languages: ['en'],
    },
];

export const LANGUAGE_NAMES = {
    en: 'English',
    fr: 'Français',
    jp: '日本語',
    it: 'Italiano',
    de: 'Deutsch',
    es: 'Español',
    ko: '한국어',
    chs: '简体中文',
    cht: '繁體中文',
};

export function getFacility(code) {
    return FACILITIES.find(facility => facility.code === code) || FACILITIES[0];
}
