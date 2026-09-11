'use strict';

// spirit/run/js/trafficLog.js
// What this node sent and what it received. Personal nodes only.
//
// Andy: "on the lowest level we need a server log containing a history of
// incoming and outgoing packets. the payload-agnostic log of WAN traffic,
// akin to the payload-agnostic relaying of the public relay."
//
// ── PAYLOAD-AGNOSTIC MEANS SOMETHING PRECISE ─────────────────────────
//
// It means the system does not need to UNDERSTAND a packet in order to
// log it — exactly as the relay carries a packet without knowing what is
// inside. It does NOT mean the payload is withheld. The payload is kept
// whole, byte for byte, and never interpreted.
//
// Nothing here parses `payload`. Not to validate it, not to measure it,
// not to pull a field out of it. That is the single discipline this
// module has, and it is what the suite checks hardest.
//
// One consequence, stated so nobody adds it back in good faith: THERE IS
// NO `app` FIELD. A packet's envelope names the app that sent it, and
// reading that name is a job with an owner already — the shell routes on
// `packet.app` in deliverPackets. Three layers, each understanding
// strictly less than the one above it:
//
//   relay        routes by public key   never reads the text
//   this file    records                never reads the text
//   the shell    routes by packet.app   reads it, because that is its job
//
// A log with an `app` field would be the middle layer doing the top
// layer's reading, and the reason it must not is the reason the relay
// must not.
//
// ── WHY IT EXISTS AT ALL ─────────────────────────────────────────────
//
// Decision 0006: a relay delivers or refuses and stores nothing on
// anyone's behalf. The moment that is true the relay stops being a record
// that anything happened, and this file is the only evidence left. A
// refusal nobody wrote down is indistinguishable from nothing having been
// tried.
//
// ── PRIVACY, ON PURPOSE ──────────────────────────────────────────────
//
// peerStats.js chose day grain deliberately: "you cannot rebuild a
// conversation from it." This file is the opposite, and by a wider margin
// than a metadata log would have been — it holds the messages themselves,
// in and out, across every app that uses the router.
//
// That is the point rather than a side effect. It is also why the rules
// it shares with whoBook and the peerfiles are absolute: local, never
// uploaded, and NEVER ON A RELAY. A node keeping its own traffic is a
// machine keeping its own record. A relay keeping this same file would be
// holding everybody's messages — not metadata, the content — which is a
// far worse thing than the ring 0006 deletes, not a softer one. The same
// code is right on a node and the worst thing in the system on a relay,
// and the only thing between the two is the gate in note() below.

const fs = require('fs');
const path = require('path');

// ONE DAY, EXACTLY (Andy: "the logfiles should never contain anything
// older that exactly one day"). A sliding window, not an entry cap and
// not a byte cap: a count would have been a guess about traffic, and a
// clock is a promise that can be stated exactly and checked exactly.
//
// It follows the idiom peerStats already uses — a 14-day window rather
// than a number of rows. Same idea at a finer grain: that file buckets by
// day because it is measuring a rate, this one keeps whole packets
// because it is keeping a record.
const WINDOW_MS = 24 * 60 * 60 * 1000;

function logPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'traffic.json');
}

function tempPath(rootDir) {
  return logPath(rootDir) + '.tmp';
}

// Unreadable, missing or malformed all read as no history. A log that can
// crash the thing it is observing is worse than no log — and this is
// called on the path a packet takes, so a throw here would break the
// delivery it was only supposed to witness.
function readAll(rootDir) {
  var raw;
  try { raw = fs.readFileSync(logPath(rootDir), 'utf8'); }
  catch (e) { return []; }
  try {
    var doc = JSON.parse(raw);
    return Array.isArray(doc && doc.entries) ? doc.entries : [];
  } catch (e) {
    return [];
  }
}

function withinWindow(entries, nowMs) {
  var floor = nowMs - WINDOW_MS;
  return entries.filter(function (row) {
    if (!row || typeof row.at !== 'string') return false;
    var at = Date.parse(row.at);
    // An unparseable timestamp cannot be shown to be inside the window,
    // so it is not. The window is a promise; an entry that cannot be
    // aged is exactly the kind of thing that would quietly outlive it.
    if (!(at > 0)) return false;
    return at >= floor;
  });
}

// TEMP FILE THEN RENAME. A rename within one directory is atomic, so a
// crash leaves either the whole old history or the whole new one — never
// a half-written file. This is the one real advantage an append-only log
// would have had, bought here for three lines.
function writeAll(rootDir, entries) {
  var dir = path.dirname(logPath(rootDir));
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* already there */ }
  var tmp = tempPath(rootDir);
  fs.writeFileSync(tmp, JSON.stringify({ entries: entries }));
  fs.renameSync(tmp, logPath(rootDir));
}

// opts: { rootDir, relayMode, now }
//
// `now` is injectable, the way peerStats takes one. A retention rule
// stated in hours that could only be tested by waiting hours is a rule
// that would not be tested.
function createTrafficLog(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  var relayMode = !!opts.relayMode;
  var clock = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };

  // THE GATE. Read the comment at the top of this file before removing
  // it: this module is correct on a personal node and is the worst thing
  // in the system on a relay.
  function note(entry) {
    if (relayMode || !rootDir || !entry) return null;

    var at = new Date(clock()).toISOString();
    var row = {
      at: at,
      dir: entry.dir === 'in' ? 'in' : 'out',
      kind: entry.kind === 'reply' ? 'reply' : 'request',
      peer: String(entry.peer || ''),
      // WHICH RELAY CARRIED IT, on both directions (Andy) — the one it
      // went out to, or the one it came in from. A node on several
      // relays cannot otherwise tell which road a packet travelled, and
      // that is routing information this node holds and nobody else
      // keeps.
      relay: String(entry.relay || ''),
      hash: String(entry.hash || ''),
      outcome: String(entry.outcome || ''),
    };
    if (entry.status != null) row.status = Number(entry.status) || 0;
    if (entry.ms != null) row.ms = Number(entry.ms) || 0;

    // The payload, whole and untouched. `bytes` is measured off the
    // string's length rather than by looking inside it — a length is not
    // an interpretation.
    if (typeof entry.payload === 'string') {
      row.payload = entry.payload;
      row.bytes = entry.payload.length;
    }

    try {
      var kept = withinWindow(readAll(rootDir), clock());
      kept.push(row);
      writeAll(rootDir, kept);
    } catch (e) {
      // Same reason readAll swallows: this is a witness, not a
      // participant. A disk that refuses the log must not refuse the
      // packet.
      return null;
    }
    return row;
  }

  // Pruned on read as well as on write, and persisted if the read changed
  // anything — otherwise a node that went quiet would keep yesterday's
  // traffic on disk indefinitely, and "never older than one day" would be
  // true only of nodes that stayed busy.
  function read() {
    var all = readAll(rootDir);
    var kept = withinWindow(all, clock());
    if (kept.length !== all.length) {
      try { writeAll(rootDir, kept); } catch (e) { /* reading must not fail */ }
    }
    return kept;
  }

  return { note: note, read: read };
}

module.exports = {
  createTrafficLog: createTrafficLog,
  WINDOW_MS: WINDOW_MS,
  logPath: logPath,
};
