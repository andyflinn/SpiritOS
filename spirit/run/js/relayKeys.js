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
// connect to relays, so nothing on a relay ever calls this. The file
// lives under relay-state/ with the node's other private records, which
// is gitignored and unservable.

const fs = require('fs');
const path = require('path');

function keysPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'relayKeys.json');
}

// A URL is the identity of a relay as far as this node is concerned, and
// two spellings of one URL must not become two pins. Trailing slashes go;
// nothing else is touched, because a host is case-sensitive in paths and
// this module is not in the business of rewriting addresses.
function normalizeUrl(url) {
  return String(url == null ? '' : url).trim().replace(/\/+$/, '');
}

function load(rootDir) {
  try {
    var parsed = JSON.parse(fs.readFileSync(keysPath(rootDir), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (e) {
    // Unreadable reads as nothing pinned, which fails SAFE in the only
    // direction that matters: every relay looks new, so every one has to
    // be accepted again rather than silently trusted.
    return {};
  }
}

function save(rootDir, book) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  var file = keysPath(rootDir);
  var tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(book, null, 2));
  fs.renameSync(tmp, file);
}

// What is on record for this URL, or '' for nothing.
function pinned(rootDir, url) {
  var row = load(rootDir)[normalizeUrl(url)];
  return (row && typeof row.publicKey === 'string' && row.publicKey) || '';
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

// A DELIBERATE ACT, and the only thing that writes. It overwrites a
// changed key rather than refusing to, because by the time a caller
// reaches here the change has been decided about by somebody entitled to
// decide — this module's job was to make sure it could not happen
// silently, and that job is done by `check`.
function accept(rootDir, url, publicKey, atMs) {
  var u = normalizeUrl(url);
  var given = String(publicKey == null ? '' : publicKey).trim();
  if (!u || !given) return false;
  var book = load(rootDir);
  var at = new Date(atMs == null ? Date.now() : atMs).toISOString();
  var was = book[u] && book[u].publicKey;
  book[u] = {
    publicKey: given,
    // When this node first accepted anything here, kept across a change
    // so the record still says how long the address has been in use.
    firstSeen: (book[u] && book[u].firstSeen) || at,
    acceptedAt: at,
  };
  // What it replaced, kept once rather than as a history: the useful
  // question after a substitution is "what was here before", and a list
  // of every key a URL ever had is a different and much rarer question.
  if (was && was !== given) book[u].replaced = was;
  save(rootDir, book);
  return true;
}

// Every relay this node has accepted, as a key set. This is what the
// front door needs: a relay posts to a node in its own name for a device
// enrolment, and that key is in no whoBook — a relay is not a contact.
function acceptedKeys(rootDir) {
  var book = load(rootDir);
  var out = Object.create(null);
  Object.keys(book).forEach(function (u) {
    var k = book[u] && book[u].publicKey;
    if (typeof k === 'string' && k) out[k] = u;
  });
  return out;
}

function forget(rootDir, url) {
  var u = normalizeUrl(url);
  var book = load(rootDir);
  if (!book[u]) return false;
  delete book[u];
  save(rootDir, book);
  return true;
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
};
