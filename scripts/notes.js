// Optional NOTES (opt-in), stored in localStorage (not cookies). Two kinds:
//   - TRAINER notes: BDSP (all modes) and non-BDSP doubles/multis/triples, tied to the
//     selected trainer/team.
//   - SET notes: non-BDSP singles, tied to the open set (species + set number).
//
// Blob shape: { [facilityCode]: { trainers: {[key]:text}, sets: {[key]:text} } }. Keyed by
// facility (variant.code) first, so the same set/trainer in two facilities never collides.
// Trainer keys are the display name (+ " #N" on collisions); set keys are the ENGLISH
// species + set number ("Gliscor-1"), so a set note follows the set across languages.
//
// SAFETY: note text is only ever read/written as plain text (textarea.value / textContent),
// never innerHTML or eval, so an imported file with HTML or code is inert.

import { GAMES } from './config.js';

const STORAGE_KEY = 'trainerNotes';
const ENABLED_KEY = 'notesEnabled';
const KINDS = ['trainers', 'sets'];

// Generous safety cap so a pathological import can't blow the localStorage quota.
const MAX_BLOB = 1_000_000; // ~1 MB of note text

let notes = null;      // { facilityCode: { trainers: {...}, sets: {...} } }
let enabled = null;    // boolean

/* ---------- facility label <-> code (for the human-readable export) ---------- */

// A readable English label per variant.code (e.g. "Battle Tree — Ultra Sun / Ultra Moon").
// Built once from config; the same map writes export headers and resolves them on import.
let _labelByCode = null;
let _codeByLabel = null;

function buildLabelMaps() {
    _labelByCode = new Map();
    _codeByLabel = new Map();
    for (const game of GAMES) {
        for (const variant of game.variants || []) {
            const sub = variant.name && variant.name !== game.name ? variant.name : '';
            let label = sub ? `${game.name} — ${sub}` : game.name;
            // Guarantee uniqueness (two variants could in theory compose the same label).
            if (_codeByLabel.has(label)) label = `${label} [${variant.code}]`;
            _labelByCode.set(variant.code, label);
            _codeByLabel.set(label, variant.code);
        }
    }
}

export function facilityLabel(code) {
    if (!_labelByCode) buildLabelMaps();
    return _labelByCode.get(code) || code;
}

function codeForLabel(label) {
    if (!_codeByLabel) buildLabelMaps();
    return _codeByLabel.get(label) || null;
}

/* ---------- load / persist (with one-time migration of the old flat schema) ---------- */

// Old blobs were { facilityCode: { trainerKey: text } } (flat, all string values). New blobs
// are { facilityCode: { trainers, sets } }. Detect + wrap the old shape as trainer notes.
function normalizeSchema(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const fac of Object.keys(raw)) {
        const v = raw[fac];
        if (!v || typeof v !== 'object') continue;
        const keys = Object.keys(v);
        const isNew = keys.length > 0 &&
            keys.every(k => KINDS.includes(k) && v[k] && typeof v[k] === 'object');
        out[fac] = isNew
            ? { trainers: { ...(v.trainers || {}) }, sets: { ...(v.sets || {}) } }
            : { trainers: { ...v }, sets: {} };   // old flat map -> trainer notes
    }
    return out;
}

export function loadNotes() {
    let raw = null;
    try { const s = localStorage.getItem(STORAGE_KEY); raw = s ? JSON.parse(s) : null; }
    catch (e) { raw = null; }
    notes = normalizeSchema(raw);
    enabled = localStorage.getItem(ENABLED_KEY) === '1';
    return notes;
}

function ensure() { if (notes === null) loadNotes(); }

function bucket(fac, kind) {
    if (!notes[fac]) notes[fac] = { trainers: {}, sets: {} };
    if (!notes[fac][kind]) notes[fac][kind] = {};
    return notes[fac][kind];
}

function pruneFac(fac) {
    const f = notes[fac];
    if (f && !Object.keys(f.trainers || {}).length && !Object.keys(f.sets || {}).length) delete notes[fac];
}

function save() {
    ensure();
    try {
        const blob = JSON.stringify(notes);
        if (blob.length > MAX_BLOB) { console.error('Notes too large to save; not persisted.'); return false; }
        localStorage.setItem(STORAGE_KEY, blob);
        return true;
    } catch (e) {
        console.error('Could not save notes:', e);
        return false;
    }
}

/* ---------- enabled flag ---------- */

export function notesEnabled() { ensure(); return enabled; }

export function setNotesEnabled(on) {
    ensure();
    enabled = Boolean(on);
    try { localStorage.setItem(ENABLED_KEY, enabled ? '1' : ''); } catch (e) {}
}

/* ---------- get/set (kind = 'trainers' | 'sets') ---------- */

export function getNote(fac, kind, key) {
    ensure();
    if (!fac || !key) return '';
    const b = notes[fac] && notes[fac][kind];
    return (b && b[key]) || '';
}

// Store (or clear, when blank) a note. Returns true on success.
export function setNote(fac, kind, key, text) {
    ensure();
    if (!fac || !key || !KINDS.includes(kind)) return false;
    const value = (text || '').replace(/\s+$/, '');
    if (value) {
        bucket(fac, kind)[key] = value;
    } else if (notes[fac] && notes[fac][kind]) {
        delete notes[fac][kind][key];
        pruneFac(fac);
    }
    return save();
}

// True if any note (either kind) exists (enables/disables the Download button).
export function hasAnyNotes() {
    ensure();
    return Object.values(notes).some(f =>
        Object.keys(f.trainers || {}).length || Object.keys(f.sets || {}).length);
}

/* ---------- serialize (pretty, re-importable) ---------- */

// `# ` = facility header, `## ` = trainer entry, `## [set] ` = set entry, everything else
// is the note body. Those prefixes are reserved separators (the settings tooltip says so).
export function serializeNotes() {
    ensure();
    const out = [];
    const codes = Object.keys(notes).sort((a, b) => facilityLabel(a).localeCompare(facilityLabel(b)));
    for (const code of codes) {
        const f = notes[code];
        const tKeys = Object.keys(f.trainers || {}).sort((a, b) => a.localeCompare(b));
        const sKeys = Object.keys(f.sets || {}).sort((a, b) => a.localeCompare(b));
        if (!tKeys.length && !sKeys.length) continue;
        out.push(`# ${facilityLabel(code)}`, '');
        for (const k of tKeys) out.push(`## ${k}`, f.trainers[k], '');
        for (const k of sKeys) out.push(`## [set] ${k}`, f.sets[k], '');
        out.push('');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------- parse (strict #/## rules) ---------- */

// Parse an exported file back into { facilityCode: { trainers, sets } }. Unknown facility
// headers are skipped. Returns { data, facilities, entries, skipped } for an import summary.
export function parseNotes(text) {
    const data = {};
    let entries = 0, skipped = 0;
    let curCode = null, curKind = null, curKey = null, buf = [];

    const flush = () => {
        if (curCode && curKey) {
            const body = buf.join('\n').trim();
            if (body) {
                if (!data[curCode]) data[curCode] = { trainers: {}, sets: {} };
                data[curCode][curKind][curKey] = body;
                entries++;
            }
        }
        buf = [];
    };

    const lines = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
    const seenFac = new Set();
    for (const line of lines) {
        if (line.startsWith('## ')) {
            flush();
            const rest = line.slice(3).trim();
            if (rest.startsWith('[set] ')) { curKind = 'sets'; curKey = rest.slice(6).trim(); }
            else { curKind = 'trainers'; curKey = rest; }
        } else if (line.startsWith('# ')) {
            flush();
            curKey = null;
            curCode = codeForLabel(line.slice(2).trim());
            if (curCode) seenFac.add(curCode); else skipped++;
        } else if (curCode && curKey) {
            buf.push(line);
        }
    }
    flush();
    return { data, facilities: seenFac.size, entries, skipped };
}

/* ---------- import (merge / replace) ---------- */

// Apply a parsed structure. 'replace' wipes existing notes first; 'merge' overwrites only
// the entries present in the file.
export function importNotes(parsed, mode = 'merge') {
    ensure();
    const incoming = (parsed && parsed.data) || {};
    if (mode === 'replace') notes = {};
    for (const code of Object.keys(incoming)) {
        for (const kind of KINDS) {
            const src = incoming[code][kind] || {};
            for (const key of Object.keys(src)) bucket(code, kind)[key] = src[key];
        }
        pruneFac(code);
    }
    return save();
}
