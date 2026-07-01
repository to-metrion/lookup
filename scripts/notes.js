// Per-trainer NOTES (optional, opt-in). A free-text note per trainer, shown at the bottom
// of the page when that trainer is selected, stored in localStorage (not cookies).
//
// Blob shape: { [facilityCode]: { [trainerKey]: "note text" } }. Keyed by facility
// (variant.code) then trainer. The trainer key is the DISPLAY NAME, plus a " #N" suffix on
// same-name collisions. Since the key is the readable name, export/import are pure string
// work with no data files.
//
// LIMITATION: the key is the name in the CURRENT language, so a note is filed under that
// spelling; switching language shows the other spelling's note (not lost, just language-bound).
//
// SAFETY: note text is only ever read/written as plain text (textarea.value / textContent),
// never innerHTML or eval, so an imported file with HTML or code is inert.

import { GAMES } from './config.js';

const STORAGE_KEY = 'trainerNotes';
const ENABLED_KEY = 'notesEnabled';

// Generous safety cap so a pathological import can't blow the localStorage quota.
const MAX_BLOB = 1_000_000; // ~1 MB of note text

let notes = null;      // { facilityCode: { trainerKey: text } }
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

/* ---------- load / persist ---------- */

export function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        notes = raw ? JSON.parse(raw) : {};
    } catch (e) {
        notes = {};
    }
    if (!notes || typeof notes !== 'object') notes = {};
    enabled = localStorage.getItem(ENABLED_KEY) === '1';
    return notes;
}

function ensure() {
    if (notes === null) loadNotes();
}

function save() {
    ensure();
    try {
        const blob = JSON.stringify(notes);
        if (blob.length > MAX_BLOB) {
            console.error('Notes too large to save; not persisted.');
            return false;
        }
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

/* ---------- per-trainer get/set ---------- */

export function getNote(facilityCode, trainerKey) {
    ensure();
    if (!facilityCode || !trainerKey) return '';
    return (notes[facilityCode] && notes[facilityCode][trainerKey]) || '';
}

// Store (or clear, when text is blank) a note. Returns true on success.
export function setNote(facilityCode, trainerKey, text) {
    ensure();
    if (!facilityCode || !trainerKey) return false;
    const value = (text || '').replace(/\s+$/, ''); // drop trailing whitespace
    if (value) {
        if (!notes[facilityCode]) notes[facilityCode] = {};
        notes[facilityCode][trainerKey] = value;
    } else if (notes[facilityCode]) {
        delete notes[facilityCode][trainerKey];
        if (!Object.keys(notes[facilityCode]).length) delete notes[facilityCode];
    }
    return save();
}

// True if any note exists at all (used to enable/disable the Download button).
export function hasAnyNotes() {
    ensure();
    return Object.values(notes).some(f => Object.keys(f).length > 0);
}

/* ---------- serialize (pretty, re-importable) ---------- */

// Produce a human-readable text file. `# ` lines are facility headers, `## ` lines are
// trainer headers, everything else is the note body. `# `/`## ` are reserved separators,
// so a note line starting with them breaks re-import (the settings tooltip says so).
export function serializeNotes() {
    ensure();
    const out = [];
    const codes = Object.keys(notes).sort((a, b) => facilityLabel(a).localeCompare(facilityLabel(b)));
    for (const code of codes) {
        const trainers = notes[code];
        const keys = Object.keys(trainers).sort((a, b) => a.localeCompare(b));
        if (!keys.length) continue;
        out.push(`# ${facilityLabel(code)}`, '');
        for (const key of keys) {
            out.push(`## ${key}`, trainers[key], '');
        }
        out.push('');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------- parse (strict #/## rules) ---------- */

// Parse a previously-exported file back into a { facilityCode: { trainerKey: text } }
// structure. Unknown facility headers (labels that don't match any variant) are
// skipped. Returns { data, facilities, trainers, skipped } for an import summary.
export function parseNotes(text) {
    const data = {};
    let trainers = 0, skipped = 0;
    let curCode = null;       // resolved facility code, or null (skip block)
    let curKey = null;
    let buf = [];

    const flush = () => {
        if (curCode && curKey) {
            const body = buf.join('\n').trim();
            if (body) {
                if (!data[curCode]) data[curCode] = {};
                data[curCode][curKey] = body;
                trainers++;
            }
        }
        buf = [];
    };

    const lines = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
    const seenFac = new Set();
    for (const line of lines) {
        if (line.startsWith('## ')) {
            flush();
            curKey = line.slice(3).trim();
        } else if (line.startsWith('# ')) {
            flush();
            curKey = null;
            const label = line.slice(2).trim();
            curCode = codeForLabel(label);
            if (curCode) seenFac.add(curCode);
            else skipped++;
        } else {
            if (curCode && curKey) buf.push(line);
        }
    }
    flush();
    return { data, facilities: seenFac.size, trainers, skipped };
}

/* ---------- import (merge / replace) ---------- */

// Apply a parsed structure. mode 'replace' wipes existing notes first; 'merge' keeps
// existing notes and overwrites only the trainers present in the file.
export function importNotes(parsed, mode = 'merge') {
    ensure();
    const incoming = (parsed && parsed.data) || {};
    if (mode === 'replace') notes = {};
    for (const code of Object.keys(incoming)) {
        if (!notes[code]) notes[code] = {};
        for (const key of Object.keys(incoming[code])) {
            notes[code][key] = incoming[code][key];
        }
        if (!Object.keys(notes[code]).length) delete notes[code];
    }
    return save();
}
