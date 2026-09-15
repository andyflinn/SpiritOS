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
// PERMANENT.
//
//   Andy: "the log should be permanent. period."
//
// There was a 24-hour sliding window here, and then a rule that exempted
// undelivered mail from it. Both are gone: nothing in this file ages out,
// whether it was read, refused, ignored or sent.
//
// The window was never a privacy measure — it was "certainly enough to
// test concepts surrounding logfiles", from when this was new. What it
// actually did was make the node's own record of its own traffic the one
// thing in the system that forgot, in a design whose whole argument is
// that durability belongs on the recipient's own hardware (0006).
//
// TWO THINGS FOLLOW, AND THEY ARE NOT OPTIONAL.
//
// 1. THIS FILE GROWS WITHOUT BOUND. That is the decision, not a bug. It
//    is the owner's own disk, in a file they can look at, holding their
//    own traffic — which is exactly what the ring on a public relay was
//    not, on all three counts.
//
// 2. IT CANNOT BE REWRITTEN ON EVERY PACKET ANY MORE. It used to be
//    read-all, push, write-all — correct and crash-safe while a window
//    bounded it, and impossible once nothing ages: a node running for a
//    year would rewrite a year of traffic every time a packet landed.
//    So the store is APPEND-ONLY, one JSON object per line.
//
// A write is one line and O(1). A read is O(n) and always was; reads
// happen when a page opens or asks, writes happen per packet, and that is
// the right way round. When `n` makes reads hurt, the answer is the one
// Andy named — a local-disc database behind this same api block — and
// nothing above this file will notice, because nothing above it knows
// the filename (spirit/test/storeOwnership.js).

// One JSON object per line. The extension says so, which matters for a
// file somebody is meant to be able to open and read.
function logPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'traffic.jsonl');
}

// WHAT A LIVE NODE ALREADY HAS. The same courtesy routingTable.json paid
// mailbox.json: read the old shape once on the way in, so a node that has
// been running does not silently start from nothing. Never written again.
function legacyPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'traffic.json');
}

// Unreadable, missing or malformed all read as no history. A log that can
// crash the thing it is observing is worse than no log — and this is
// called on the path a packet takes, so a throw here would break the
// delivery it was only supposed to witness.
//
// A MALFORMED LINE IS SKIPPED, not fatal, and that is the property an
// append-only file is chosen for: a torn write at the end of the file
// costs the one row that was being written, never the year behind it.
// The whole-file rewrite it replaced had the opposite failure — atomic,
// but all-or-nothing over everything.
function readAll(rootDir) {
  var raw = null;
  try { raw = fs.readFileSync(logPath(rootDir), 'utf8'); }
  catch (e) { raw = null; }

  if (raw === null) {
    // The old shape, once. Nothing writes it again.
    try {
      var doc = JSON.parse(fs.readFileSync(legacyPath(rootDir), 'utf8'));
      return Array.isArray(doc && doc.entries) ? doc.entries : [];
    } catch (e) {
      return [];
    }
  }

  var rows = [];
  raw.split('\n').forEach(function (line) {
    if (!line) return;
    try {
      var row = JSON.parse(line);
      if (row && typeof row === 'object') rows.push(row);
    } catch (e) { /* a torn line costs itself and nothing else */ }
  });
  return rows;
}

// The set of hashes a live page has already been handed. Marks are rows
// too — `mark: 'taken'` — so the file stays append-only and a delivery
// never rewrites the packet it delivered.
function takenSet(rows) {
  var seen = Object.create(null);
  rows.forEach(function (row) {
    if (row && row.mark === 'taken' && row.hash) seen[row.hash] = row.at || true;
  });
  return seen;
}

// Traffic rows, with the marks folded in. What every reader below wants.
function historyOf(rootDir) {
  var rows = readAll(rootDir);
  var taken = takenSet(rows);
  return rows.filter(function (row) { return row && !row.mark; }).map(function (row) {
    if (!taken[row.hash]) return row;
    var out = {};
    Object.keys(row).forEach(function (k) { out[k] = row[k]; });
    out.takenAt = taken[row.hash];
    return out;
  });
}

// ONE LINE, APPENDED. No read, no rewrite, no temp file: the cost of
// writing a packet down does not grow with how many are already there.
function append(rootDir, row) {
  var dir = path.dirname(logPath(rootDir));
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* already there */ }

  // A NEWLINE FIRST, IF THE FILE DOES NOT ALREADY END IN ONE.
  //
  // This is the append-only failure mode, and it is not hypothetical: a
  // torn write is precisely a file that stops mid-line, and surviving
  // one is why this store is append-only at all. Appending straight
  // onto it would glue the next row to the broken one and lose BOTH --
  // turning a one-row loss into a two-row loss, at the moment something
  // is already wrong.
  //
  // One byte is read to find out. Still O(1), and it buys the property
  // the whole design rests on: damage stops at the row it happened to.
  var needsBreak = false;
  try {
    var size = fs.statSync(logPath(rootDir)).size;
    if (size > 0) {
      var fd = fs.openSync(logPath(rootDir), 'r');
      try {
        var tail = Buffer.alloc(1);
        fs.readSync(fd, tail, 0, 1, size - 1);
        needsBreak = tail.toString('utf8') !== '\n';
      } finally { fs.closeSync(fd); }
    }
  } catch (e) { /* no file yet, or unreadable: nothing to break away from */ }

  fs.appendFileSync(logPath(rootDir), (needsBreak ? '\n' : '') + JSON.stringify(row) + '\n');
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
      // A THIRD KIND, and it widens what this file is about (R2,
      // design/cycles/2026-09-15-labels-are-not-identities.md).
      //
      //   Andy: "There is a category of events on the relay that the
      //   owner should have a log of... They should go to the log... of
      //   the owner only."
      //
      // `request` and `reply` are packets: two halves of one exchange,
      // joined by a hash, each carrying a payload. `owner` is not a
      // packet. It is a relay this node OWNS reporting what it did about
      // its own membership — a claim taken, an attempt refused, a peer
      // removed, an invite minted or revoked.
      //
      // WHAT IT COSTS, stated rather than discovered later: `hash` stops
      // being universal, and this file's subject widens from ROUTER
      // TRAFFIC to THINGS THAT HAPPENED TO THIS NODE. That touches
      // decision 0009. Andy took it knowingly; it is written here so a
      // later reader does not mistake it for drift.
      //
      // WHAT IT DOES NOT COST: a payload. An owner event carries facts —
      // who, which label, what came of it — and never anybody's words.
      // The relay refuses to send them (relay.js, ownerEvent) and this
      // refuses to keep them: `payload` is dropped for this kind below,
      // so the rule holds even if the far end one day forgets it.
      kind: entry.kind === 'reply' ? 'reply'
        : entry.kind === 'owner' ? 'owner'
          : 'request',
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
    // WAS IT HANDED UP, or merely received? `outcome: 'delivered'` has
    // always meant "arrived and filed", which is true of a packet the
    // front door HELD for a human decision as well as one it admitted —
    // both are in this file, both with their payload. A reader could not
    // tell them apart, and one of them must never reach an app.
    //
    // The node never reads `app` and never will (that is the shell's
    // job); this is about ADMISSION, which is a per-peer decision the
    // front door already made.
    if (entry.admitted) row.admitted = true;
    if (entry.status != null) row.status = Number(entry.status) || 0;
    if (entry.ms != null) row.ms = Number(entry.ms) || 0;

    // The payload, whole and untouched. `bytes` is measured off the
    // string's length rather than by looking inside it — a length is not
    // an interpretation.
    //
    // NEVER FOR AN OWNER EVENT, and this is a floor rather than a tidy-up.
    // A relay reporting its own membership has no business sending
    // anybody's words, and if it ever did, keeping them here would make
    // the owner's disk the place everybody else's conversations land —
    // the ring's exact sin, in the one file that replaced it. Refused on
    // both sides: relay.js will not send one, and this will not write one.
    if (row.kind !== 'owner' && typeof entry.payload === 'string') {
      row.payload = entry.payload;
      row.bytes = entry.payload.length;
    }

    // THE FACTS AN OWNER EVENT CARRIES. Small, named, and closed: a
    // relay cannot widen this file by inventing a field, because
    // anything not on this list is dropped on the way in.
    //
    // `invite` is the owner's own word for the person — possibly a phone
    // number (R1) — which is exactly why it is owner-only and never
    // leaves this machine.
    if (row.kind === 'owner') {
      ['event', 'label', 'invite', 'key', 'why', 'owner', 'revoked',
        'invitesRevoked', 'expiresAt'].forEach(function (k) {
        if (entry[k] !== undefined && entry[k] !== '') row[k] = entry[k];
      });
    }

    try {
      append(rootDir, row);
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
  // WHAT A CLIENT HAS NOT SEEN YET, oldest first.
  //
  // `since` is an ISO timestamp — a position, not a filter on content.
  // Deliberately NOT filtered by `packet.app`:
  //
  //   Andy: "only an entity that knows the internal package structure
  //   (shell) can fan out based on the internal package structure, so the
  //   read-log-interface the node provides should be fairly contained."
  //
  // The node keys on public keys and hashes; routing by app is the
  // shell's reading and filtering here would be this file doing it.
  //
  // Admitted inbound only. An outbound record is this node's own history
  // and not something to hand back as an arrival, and a held or ignored
  // packet must never reach an app at all.
  function arrivals(opts) {
    var o = opts || {};
    var since = typeof o.since === 'string' ? Date.parse(o.since) : 0;
    var limit = Number(o.limit) > 0 ? Math.min(Number(o.limit), 500) : 200;
    var rows = historyOf(rootDir).filter(function (row) {
      if (!row || row.dir !== 'in' || !row.admitted) return false;
      if (!since) return true;
      var at = Date.parse(row.at);
      return at > 0 && at > since;
    });
    rows.sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    return rows.slice(0, limit);
  }

  // WHAT THIS NODE'S OWN RELAYS DID ABOUT THEIR MEMBERSHIP, oldest first.
  //
  //   Andy: "This then enters the owners log (it should) and it can be
  //   reviewed."
  //
  // A SECOND READ RATHER THAN A FLAG ON THE FIRST, because `arrivals` is
  // the app-delivery surface: it answers "what did a peer send me that I
  // agreed to hear", and every row it returns is a packet a page may be
  // handed. An owner event is neither a packet nor addressed to an app,
  // and putting it behind the same door would mean every caller of
  // `arrivals` grew a branch for a shape it never asked for.
  //
  // `since` is a POSITION, not a filter on content — same rule as
  // arrivals, and for the same reason (R13). No filter by kind of event,
  // for the same reason there is no filter by app: a contained read
  // surface is the point, and fanning out on what a thing IS is the
  // reader's job.
  function ownerEvents(opts) {
    var o = opts || {};
    var since = typeof o.since === 'string' ? Date.parse(o.since) : 0;
    var limit = Number(o.limit) > 0 ? Math.min(Number(o.limit), 500) : 200;
    var rows = historyOf(rootDir).filter(function (row) {
      if (!row || row.kind !== 'owner') return false;
      if (!since) return true;
      var at = Date.parse(row.at);
      return at > 0 && at > since;
    });
    rows.sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    return rows.slice(0, limit);
  }

  // The row for one packet, by the hash it is keyed on. What `re` points
  // at — "regarding that packet" is answerable here without the caller
  // keeping its own copy.
  function byHash(hash) {
    var want = String(hash || '');
    if (!want) return null;
    var rows = historyOf(rootDir).filter(function (row) {
      return row && row.hash === want;
    });
    return rows.length ? rows[rows.length - 1] : null;
  }

  // MARKED WHEN A LIVE PAGE WAS ACTUALLY HANDED IT. Andy's rule from this
  // morning — the node keeps the mark, not the browser — and it is what
  // lets the row start ageing like any other record. Before this, it is
  // undelivered mail and has no clock.
  // A MARK IS A ROW. Appending `{mark:'taken', hash, at}` rather than
  // editing the packet's own row is what keeps the file append-only — and
  // it means a delivery can never corrupt the thing it delivered.
  //
  // Marked once. A second page opening does not re-date anything: the
  // mark means "a live page has had this", not "the last time anybody
  // looked".
  function taken(hashes) {
    var want = Object.create(null);
    (Array.isArray(hashes) ? hashes : [hashes]).forEach(function (h) {
      if (h) want[String(h)] = true;
    });
    if (!Object.keys(want).length) return 0;
    var at = new Date(clock()).toISOString();
    var marked = 0;
    try {
      var rows = readAll(rootDir);
      var already = takenSet(rows);
      var eligible = Object.create(null);
      rows.forEach(function (row) {
        if (!row || row.mark || row.dir !== 'in' || !row.admitted) return;
        if (!want[row.hash] || already[row.hash]) return;
        eligible[row.hash] = true;
      });
      Object.keys(eligible).forEach(function (hash) {
        append(rootDir, { at: at, mark: 'taken', hash: hash });
        marked += 1;
      });
    } catch (e) {
      return 0;
    }
    return marked;
  }

  // The whole history, marks folded in. Nothing is pruned on the way out
  // any more, because nothing is pruned at all.
  function read() {
    return historyOf(rootDir);
  }

  return {
    note: note,
    read: read,
    // The log, read as a table. Keyed by hash, ordered by arrival.
    arrivals: arrivals,
    // The membership half of the same file — see ownerEvents for why it
    // is a second read and not a flag on the first.
    ownerEvents: ownerEvents,
    byHash: byHash,
    taken: taken,
  };
}

module.exports = {
  createTrafficLog: createTrafficLog,
  logPath: logPath,
  legacyPath: legacyPath,
};
