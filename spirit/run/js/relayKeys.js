'use strict';

// spirit/run/js/relayKeys.js
// Which relay is which, remembered across restarts. Personal nodes only.
//
// Andy: "anybody can build a crooked relay that pretends to be true…. the
// best guard against that is to only use a relay that is somehow
// certified by 'self'."
//
// ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────
//
// It is trust-on-first-use for a relay's own identity, made durable.
// `answerRelay.js` already pinned `mailboxPublicKey` and explained why
// that is sound:
//
//   "a relay's key is made on its first --relay boot and does not change
//    while it is the same relay"
//
// Exactly right, and it makes the key a near-perfect thing to pin. But
// that cache lived in RAM for the life of one process: it was forgotten
// on every restart and believed whatever answered next time, so a relay
// swapped underneath a node was silent. This is the same pin, written
// down.
//
// IT PROVES CONTINUITY, NOT INTEGRITY. It answers "is this the relay I
// accepted?" and never "was that relay ever honest?" — a box that was
// crooked from its first boot pins perfectly. Saying so is the difference
// between a guard and a comfort, and it is why `accept` is a deliberate
// act rather than something this module does on a caller's behalf.
//
// ── WHY A CHANGE IS NOT AN ERROR ─────────────────────────────────────
//
// A changed key is reported, never resolved here. It has two innocent
// causes — a relay rebuilt from scratch, a URL repointed at a new box —
// and one guilty one, and nothing at this layer can tell them apart. So
// `check` returns what it saw and the decision belongs to whoever is in a
// position to ask a human.
//
// NODE-ONLY BY USE rather than by a `relayMode` gate: a relay does not
// connect to relays, so nothing on a relay ever calls this.
//
// ── ONE TABLE, KEYED BY THE RELAY KEY (goal/G19.15) ──────────────────
//
//   Andy, 2026-10-12: "the authoritative info about relays on the node
//   MUST be by ID (key)", and "there will be only ONE relay table in
//   node.db."
//
// Every relay record this node keeps — the pin, the seat, and whether the
// relay is on the node's list (ownerBadge's loadRelays, addRelay,
// removeRelay) — is one row of node.db's `relays` table, and this file is
// its only reader and writer (nodeStore.js owns where it lives). It
// replaced two files keyed by URL, relayKeys.json and relays.json; the
// first time either is found, its keyed rows are copied in and both files
// are deleted (importOld below).

const fs = require('fs');
const path = require('path');
const nodeStore = require('./nodeStore.js');

// Where the old files were, read once by importOld and never written.
function keysPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'relayKeys.json');
}
function oldListPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'relays.json');
}

// A URL is the ADDRESS a relay answers at, held on its keyed record, and
// one relay per address: two spellings of one URL must not become two
// records. Trailing slashes go; nothing else is touched, because a host is
// case-sensitive in paths and this module is not in the business of
// rewriting addresses.
function normalizeUrl(url) {
  return String(url == null ? '' : url).trim().replace(/\/+$/, '');
}

function isoAt(atMs) {
  return new Date(atMs == null ? Date.now() : atMs).toISOString();
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

// ── THE FIRST BOOT'S MOVE (goal/G19.15) ──────────────────────────────
//
//   Andy: "The first boot copies every row of relays.json and
//   relayKeys.json into the one relays table and deletes both files."
//
// Every pinned url becomes a row under its key, with its label and place
// from relays.json when it was listed. A listed url with no pin is not
// copied: nothing can key it (his decision). A pin with no seat is given
// one, with no label, because the old seatedUrls counted a pin as a seat
// and a node's memberships must survive the move.
//
// THE ROWS FIRST, IN ONE TRANSACTION, AND THE FILES ONLY AFTER: a crash
// leaves the files in place and the next opening copies again, skipping
// every key and url already in the table, so nothing is counted twice.
function importOld(rootDir, rel) {
  var listFile = oldListPath(rootDir);
  var keyFile = keysPath(rootDir);
  var haveList = fs.existsSync(listFile);
  var haveKeys = fs.existsSync(keyFile);
  if (!haveList && !haveKeys) return false;

  var list = haveList ? readJson(listFile) : null;
  if (!Array.isArray(list)) list = [];
  var book = haveKeys ? readJson(keyFile) : null;
  if (!book || typeof book !== 'object' || Array.isArray(book)) book = {};

  var listedAt = Object.create(null);
  list.forEach(function (row) {
    var u = normalizeUrl(row && row.url);
    if (!u || listedAt[u]) return;
    listedAt[u] = { label: String((row && row.label) || '') || u, at: Object.keys(listedAt).length };
  });

  var rows = [];
  var takenKey = Object.create(null);
  var takenUrl = Object.create(null);
  function consider(u, rec) {
    var key = rec && typeof rec.publicKey === 'string' ? rec.publicKey.trim() : '';
    if (!u || !key || takenKey[key] || takenUrl[u]) return;
    takenKey[key] = true;
    takenUrl[u] = true;
    var seat = rec.seat && typeof rec.seat === 'object' ? rec.seat : null;
    rows.push({
      key: key, url: u,
      label: listedAt[u] ? listedAt[u].label : '',
      listed: !!listedAt[u],
      at: listedAt[u] ? listedAt[u].at : 0,
      firstSeen: String(rec.firstSeen || ''),
      acceptedAt: String(rec.acceptedAt || ''),
      replaced: String(rec.replaced || ''),
      seatLabel: seat ? String(seat.label || '') : '',
      seatClaimedAt: seat ? String(seat.claimedAt || rec.firstSeen || rec.acceptedAt || isoAt()) :
        String(rec.firstSeen || rec.acceptedAt || isoAt()),
    });
  }
  // Listed urls first, so a key pinned at two addresses keeps the listed one.
  Object.keys(listedAt).forEach(function (u) {
    Object.keys(book).forEach(function (bu) { if (normalizeUrl(bu) === u) consider(u, book[bu]); });
  });
  Object.keys(book).forEach(function (bu) { consider(normalizeUrl(bu), book[bu]); });
  rows.sort(function (a, b) { return (b.listed - a.listed) || (a.at - b.at); });

  nodeStore.open(rootDir).transaction(function () {
    var next = rel.nextPos();
    rows.forEach(function (r) {
      var have = rel.byKey(r.key) || rel.byUrl(r.url);
      if (have) {
        // Already here (a crash between the copy and the delete, or a seed):
        // the table's row stands. Only its place on the list can be owed.
        if (r.listed && !have.listed && have.key === r.key) {
          have.listed = true;
          have.pos = next++;
          if (!have.label) have.label = r.label;
          rel.put(have);
        }
        return;
      }
      r.pos = r.listed ? next++ : 0;
      rel.put(r);
    });
    // A listed url already in the table by an earlier copy needs no pin here.
    Object.keys(listedAt).forEach(function (u) {
      var have = rel.byUrl(u);
      if (have && !have.listed) {
        have.listed = true;
        have.pos = next++;
        if (!have.label) have.label = listedAt[u].label;
        rel.put(have);
      }
    });
  });

  try { fs.unlinkSync(keyFile); } catch (e) { /* already gone */ }
  try { fs.unlinkSync(listFile); } catch (e) { /* already gone */ }
  return true;
}

// The table, with any old file moved in first. Asked on every call rather
// than once per process, so a file found later (an older tool, a restored
// backup) is moved too and is never read as the truth beside the table.
function table(rootDir) {
  var rel = nodeStore.open(rootDir).relays;
  importOld(rootDir, rel);
  return rel;
}

function byUrl(rootDir, url) {
  var u = normalizeUrl(url);
  if (!u) return null;
  return table(rootDir).byUrl(u);
}

// The old url-keyed book, built from the table, for a reader that still
// wants that shape: { url: { publicKey, firstSeen, acceptedAt, seat? } }.
function load(rootDir) {
  var out = {};
  table(rootDir).all().forEach(function (r) {
    var row = { publicKey: r.key, firstSeen: r.firstSeen, acceptedAt: r.acceptedAt };
    if (r.replaced) row.replaced = r.replaced;
    if (r.seatClaimedAt) row.seat = { label: r.seatLabel, claimedAt: r.seatClaimedAt };
    out[r.url] = row;
  });
  return out;
}

// What is on record for this URL, or '' for nothing.
function pinned(rootDir, url) {
  var row = byUrl(rootDir, url);
  return (row && row.key) || '';
}

// ── AND THE SEAT, WHICH IS THIS NODE'S OWN HISTORY ──────────────────
//
//   Andy: "doesn't the node persist the necessary connection information
//   when the bind occurs? A slot is claimed on the relay — at that point
//   the node must know relay ID, url, etc. Why would it not have its
//   memberships registered in a way that allows rapid re-connect? Like
//   the relay, the node must record the enrolment details."
//
// It did not, and the cost was the last roll read in the tree.
//
// A node knew everything at claim time — the url, the relay's key, the
// label it asked for, and a 201 saying it worked — and wrote none of it
// down. So on every boot it re-derived its own history by fetching each
// relay's ENTIRE MEMBERSHIP and looking for itself in the list
// (ownerBadge.probe). Asking somebody else to remember what you did.
//
// This file is already "what this node knows about a relay it deals
// with", so the seat goes on the same row as the pin rather than into a
// second store: one relay, one record, one owner. A url with no record
// has no key to file a seat under, so there is nothing to write: a claim
// lists its relay, key and all (addRelay), before it seats.
function seat(rootDir, url, label, atMs) {
  var rel = table(rootDir);
  var row = rel.byUrl(normalizeUrl(url));
  if (!row) return false;
  // What this node asked to be called here. A relay may normalise it,
  // and the node may rename later through the `rename` verb — this is
  // the record of the claim, not a live mirror of the label.
  row.seatLabel = String(label == null ? '' : label);
  // FIRST claim kept across a re-claim, like firstSeen above: the
  // useful fact is how long this seat has been held.
  row.seatClaimedAt = row.seatClaimedAt || isoAt(atMs);
  rel.put(row);
  return true;
}

// Where this node holds a seat — the question `probe` used to answer by
// reading a roll.
//
// A PIN NO LONGER COUNTS AS A SEAT (goal/G19.15): the seeds are pinned at
// install, before any claim. The old files' pins became seats when they
// were copied in (importOld), so a node that predates the seat record
// keeps its memberships.
function seatedUrls(rootDir) {
  return table(rootDir).all()
    .filter(function (r) { return !!r.seatClaimedAt; })
    .map(function (r) { return r.url; });
}

// What this relay calls this node, as recorded at claim. Empty for a
// backfilled seat — the label was never written down, and inventing one
// would be worse than saying nothing.
function seatLabel(rootDir, url) {
  var row = byUrl(rootDir, url);
  return (row && row.seatClaimedAt && String(row.seatLabel || '')) || '';
}

// Evicted, or a seat given up. Leaves the PIN alone: who that relay is
// does not change because this node is no longer on it, and forgetting
// the key would silently re-enable trust-on-first-use next time.
function unseat(rootDir, url) {
  var rel = table(rootDir);
  var row = rel.byUrl(normalizeUrl(url));
  if (!row || !row.seatClaimedAt) return false;
  row.seatLabel = '';
  row.seatClaimedAt = '';
  rel.put(row);
  return true;
}

// THE WHOLE QUESTION, in one word.
//
//   'new'      nothing on record — first contact, the caller may accept
//   'match'    the relay is the one this node accepted
//   'changed'  a different key answers at the same address
//   'nokey'    the relay did not say — refuse, never record an absence
//
// No side effects. A read that quietly wrote its answer down would turn
// every substitution into an accepted one.
function check(rootDir, url, publicKey) {
  var given = String(publicKey == null ? '' : publicKey).trim();
  if (!given) return 'nokey';
  var have = pinned(rootDir, url);
  if (!have) return 'new';
  return have === given ? 'match' : 'changed';
}

// A DELIBERATE ACT, and the only thing that changes a pin. It overwrites a
// changed key rather than refusing to, because by the time a caller
// reaches here the change has been decided about by somebody entitled to
// decide — this module's job was to make sure it could not happen
// silently, and that job is done by `check`.
//
// The row is the relay's key. A changed key at the same address moves
// the address's record onto the new key; if the new key already had a
// record at another address, the two become one row here, since one key
// is one relay.
function accept(rootDir, url, publicKey, atMs) {
  var u = normalizeUrl(url);
  var given = String(publicKey == null ? '' : publicKey).trim();
  if (!u || !given) return false;
  var rel = table(rootDir);
  var at = isoAt(atMs);
  var here = rel.byUrl(u);
  var mine = rel.byKey(given);
  var base = here || mine || {};
  var other = here && mine && here.key !== mine.key ? mine : null;
  var row = {
    key: given,
    url: u,
    label: base.label || (other && other.label) || '',
    listed: !!(base.listed || (other && other.listed)),
    pos: base.listed ? base.pos : (other && other.listed ? other.pos : 0),
    // When this node first accepted anything here, kept across a change
    // so the record still says how long the address has been in use.
    firstSeen: base.firstSeen || at,
    acceptedAt: at,
    // What it replaced, kept once rather than as a history: the useful
    // question after a substitution is "what was here before", and a list
    // of every key a URL ever had is a different and much rarer question.
    replaced: here && here.key !== given ? here.key : (base.replaced || ''),
    seatLabel: base.seatClaimedAt ? base.seatLabel : ((other && other.seatLabel) || ''),
    seatClaimedAt: base.seatClaimedAt || (other && other.seatClaimedAt) || '',
  };
  nodeStore.open(rootDir).transaction(function () {
    if (here && here.key !== given) rel.del(here.key);
    if (mine && mine.url !== u) rel.del(mine.key);
    rel.put(row);
  });
  return true;
}

// Every relay this node has accepted, as a key set. This is what the
// front door needs: a relay posts to a node in its own name for a device
// enrolment, and that key is in no contactBook — a relay is not a contact.
function acceptedKeys(rootDir) {
  var out = Object.create(null);
  table(rootDir).all().forEach(function (r) { out[r.key] = r.url; });
  return out;
}

function forget(rootDir, url) {
  var rel = table(rootDir);
  var row = rel.byUrl(normalizeUrl(url));
  if (!row) return false;
  return rel.del(row.key);
}

// ── THE NODE'S RELAY LIST, ON THE SAME ROWS (goal/G19.15) ────────────
//
// ownerBadge keeps the rules (which relay is kept, which may go); these
// are its reads and writes. Listed rows in list order, as { label, url }.
function listed(rootDir) {
  return table(rootDir).all()
    .filter(function (r) { return r.listed; })
    .map(function (r) { return { label: r.label || r.url, url: r.url }; });
}

// Put a relay on the list, appended. A url already on record keeps its
// key and its label; a url never met needs the key learned at first
// contact, or nothing can key it and nothing is written.
function list(rootDir, url, label, publicKey) {
  var u = normalizeUrl(url);
  if (!u) return false;
  var rel = table(rootDir);
  if (!rel.byUrl(u)) {
    if (!accept(rootDir, u, publicKey)) return false;
  }
  var row = rel.byUrl(u);
  if (row.listed) return true;
  row.listed = true;
  row.pos = rel.nextPos();
  if (!row.label) row.label = String(label || '') || u;
  rel.put(row);
  return true;
}

// Off the list. The record stays, and with it the pin and the seat.
function unlist(rootDir, url) {
  var rel = table(rootDir);
  var row = rel.byUrl(normalizeUrl(url));
  if (!row || !row.listed) return false;
  row.listed = false;
  row.pos = 0;
  rel.put(row);
  return true;
}

// ── THE SEEDS, ASSERTED AT BOOT (goal/G19.15) ────────────────────────
//
//   Andy, 2026-10-12: "on boot, the node asserts the contents of
//   "noderoutes.net" ... in the database, by creating those rows, if they
//   don't exist", "we will pre-seed WITH keys", and "we only list
//   noderoutes.net, spirit.andyflinn.com is OURS."
//
// A seed already on record by its key is left exactly as it is, listed or
// not. A seed whose url is on record under a different key is left too:
// that key is this node's own pin, and a change of key is check's to
// report, not boot's to overwrite. `seeds` is ownerBadge.SEED_RELAYS.
function assertSeeds(rootDir, seeds, atMs) {
  var rel = table(rootDir);
  var at = isoAt(atMs);
  (seeds || []).forEach(function (s) {
    var key = String((s && s.key) || '').trim();
    var u = normalizeUrl(s && s.url);
    if (!key || !u || rel.byKey(key) || rel.byUrl(u)) return;
    rel.put({
      key: key, url: u, label: String(s.label || '') || u, listed: true, pos: rel.nextPos(),
      firstSeen: at, acceptedAt: at, replaced: '', seatLabel: '', seatClaimedAt: '',
    });
  });
}

module.exports = {
  keysPath: keysPath,
  normalizeUrl: normalizeUrl,
  load: load,
  pinned: pinned,
  check: check,
  accept: accept,
  acceptedKeys: acceptedKeys,
  forget: forget,
  seat: seat,
  seatedUrls: seatedUrls,
  seatLabel: seatLabel,
  unseat: unseat,
  listed: listed,
  list: list,
  unlist: unlist,
  assertSeeds: assertSeeds,
  importOld: function (rootDir) { return importOld(rootDir, nodeStore.open(rootDir).relays); },
};
