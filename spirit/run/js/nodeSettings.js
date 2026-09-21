'use strict';

// spirit/run/js/nodeSettings.js
// WHAT THE OWNER HAS DECIDED ABOUT THEIR OWN NODE.
//
//   Andy: "the node owner must be able to cap the shadow-roll by disc
//   space" — and, on where the number lives, "your suggestion fits now":
//   relay-state/node.json.
//
// ── READ ONCE, AT STARTUP, AND NEVER WRITTEN BY THE NODE ─────────────
//
//   Andy: "a ceiling like available-ram, taken from the
//   startup-configuration, MUST be a constant to the governor... the
//   owner's only useful input is ram and disc configuration."
//
// So this file is the owner's, and the node only reads it. That is what
// keeps R31 on the right side of 0015: a lever is something the programme
// moves, and an owner's bound is something the programme obeys. The
// moment code wrote this file it would become a lever, and 0015 — every
// lever ships `settable: false` — would apply.
//
// READABLE ON PURPOSE. 0018's test is "did the owner acquire it, and would
// they care?" The cache it bounds is the machine's and exempt; the NUMBER
// is the owner's and is not. So it is JSON a person can open and edit,
// in megabytes, which is the unit Andy asked for.
//
//   { "cacheMaxMB": 20, "searchMemoryRows": 1000 }
//
// Absent, the defaults apply and nothing is written: a node that has
// never been configured should not grow a file saying so.

const fs = require('fs');
const path = require('path');

// The shipped default, and Andy's number: "20 MBytes = 10 jpeg images
// from a modern cell phone". About 36,000 reachable people (577 bytes
// each, measured) — README/CAPACITY.md.
const DEFAULT_CACHE_MAX_MB = 20;

// THE FLOOR, stated rather than discovered. An empty node.db is ~20 KB and
// a cap near that would evict on every write, so a number that small is
// almost certainly a typo for a larger one. One megabyte is ~1,800
// reachable people — small, and still a cache.
const MIN_CACHE_MAX_MB = 1;

// ── HOW MANY REMEMBERED STRANGERS ONE SEARCH READS (R39) ────────────
//
//   Andy: "we'll run those searches down a newest-first key and cap at
//   1000 rows compared. (or a tunable value with default)"
//
// Newest first, so the cap costs the oldest strangers and nobody else:
// the owner's own people are read apart and always compared (0021).
// A count of rows, not bytes, because it bounds WORK — how many labels
// one search scores — and a row is the unit of that work.
//
// THE OWNER'S TO SET, AND IT COULD BE SHOWN TO THEM. Andy: "the capped read
// is controlled by a lever the human user can use ... I'm saying we state
// that that is possible." An Info control with a floor and a ceiling is
// possible and not built (R39); until then the owner edits this file.
const DEFAULT_SEARCH_MEMORY_ROWS = 1000;

function filePath(rootDir) {
  return path.join(rootDir, 'relay-state', 'node.json');
}

// One read per home per process. Keyed like nodeStore's handles, so a
// suite holding two homes cannot see one's settings in the other.
const read_ = new Map();

function load(rootDir) {
  const key = path.resolve(rootDir);
  if (read_.has(key)) return read_.get(key);

  const settings = {
    cacheMaxMB: DEFAULT_CACHE_MAX_MB,
    searchMemoryRows: DEFAULT_SEARCH_MEMORY_ROWS,
    problems: [],
  };
  let raw = null;
  try { raw = fs.readFileSync(filePath(rootDir), 'utf8'); }
  catch (e) { /* no file is the ordinary case: defaults */ }

  let parsed_ = null;
  if (raw !== null) {
    let parsed = null;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      settings.problems.push('node.json is not valid JSON; using the defaults');
    }
    parsed_ = parsed;
    if (parsed && parsed.cacheMaxMB !== undefined) {
      const n = Number(parsed.cacheMaxMB);
      if (!isFinite(n) || n <= 0) {
        settings.problems.push('cacheMaxMB must be a positive number of megabytes; using ' +
          DEFAULT_CACHE_MAX_MB);
      } else if (n < MIN_CACHE_MAX_MB) {
        // RAISED, AND SAID. Not refused: the owner asked for small and gets
        // the smallest that still works, told why.
        settings.cacheMaxMB = MIN_CACHE_MAX_MB;
        settings.problems.push('cacheMaxMB ' + n + ' is below the floor of ' +
          MIN_CACHE_MAX_MB + ' MB; using ' + MIN_CACHE_MAX_MB);
      } else {
        settings.cacheMaxMB = n;
      }
    }
  }

  if (parsed_ && parsed_.searchMemoryRows !== undefined) {
    const r = Number(parsed_.searchMemoryRows);
    // Zero is a real answer — "never search memory for strangers" — and
    // the chosen are still read. Anything else not a whole count is a typo.
    if (!isFinite(r) || r < 0 || Math.floor(r) !== r) {
      settings.problems.push('searchMemoryRows must be a whole number of rows; using ' +
        DEFAULT_SEARCH_MEMORY_ROWS);
    } else {
      settings.searchMemoryRows = r;
    }
  }

  read_.set(key, settings);
  return settings;
}

function searchMemoryRows(rootDir) {
  return load(rootDir).searchMemoryRows;
}

function cacheMaxBytes(rootDir) {
  return Math.round(load(rootDir).cacheMaxMB * 1024 * 1024);
}

module.exports = {
  load: load,
  cacheMaxBytes: cacheMaxBytes,
  searchMemoryRows: searchMemoryRows,
  filePath: filePath,
  DEFAULT_CACHE_MAX_MB: DEFAULT_CACHE_MAX_MB,
  MIN_CACHE_MAX_MB: MIN_CACHE_MAX_MB,
  DEFAULT_SEARCH_MEMORY_ROWS: DEFAULT_SEARCH_MEMORY_ROWS,
};
