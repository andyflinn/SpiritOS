'use strict';

// spirit/run/spirit/test/seenPeers.js
// The tests of spirit/seenPeers.js, and of no other module (spec: ./seenPeers.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// Who this node has seen, and what they are called: the rules of what is learned and when a row goes, over the seen
// table of nodeStore. A store is opened on a scratch home, the same path the node takes ("the suites open a store in a
// temp home"), and a planted clock stamps each note.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/seenPeers/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db at <root>/spirit/state/node.db) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () {
  const top = tempFolder.path('spirit/test/seenPeers');
  closeStoresUnder(top);
  try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
const P = S.requireScript('spirit/seenPeers.js');
const nodeStore = S.requireScript('spirit/nodeStore.js');

const HOME = ownTemp('spirit-seenPeers-');
const opened = [];
process.on('exit', function () {
  opened.forEach(function (s) { try { s.close(); } catch (e) { /* closed */ } });
  try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* gone */ }
});
let homes = 0;
function freshStore() {
  homes += 1;
  const s = nodeStore.open(path.join(HOME, 'h' + homes));
  opened.push(s);
  return s;
}
let clock = 1000;
function tick() { clock += 1000; return clock; }
const ALICE = 'MCowBQYDK2VwAyEAalicealicealicealicealicealicealicealiceali=';
const BOB = 'MCowBQYDK2VwAyEAbobbobbobbobbobbobbobbobbobbobbobbobbobbobb=';

// ── the store it needs ──
test.run('with no store and no rootDir it refuses, a thrown error: a caller with no store gets no memory', 0.2, function () {
  try { P.createSeenPeers({}); } catch (e) { return /needs a store/.test(e.message) || false; }
  return false;
}, test.limit.quick);
test.run('with a rootDir it opens nodeStore there', 0.2, function () {
  const root = path.join(HOME, 'byRoot');
  const s = P.createSeenPeers({ rootDir: root });
  opened.push(nodeStore.open(root));
  return (s.note(ALICE, {}) === true && s.get(ALICE) !== null && fs.existsSync(path.join(root, 'spirit', 'state'))) || false;
}, test.limit.quick);

// ── note and get ──
const W = { s: null };
test.run('a store opens on a scratch home with a planted clock', 0.2, function () {
  W.s = P.createSeenPeers({ store: freshStore(), now: tick });
  return !!W.s || false;
}, test.limit.quick);
test.run('note with no key is refused, false, and writes nothing', 0.2, function () {
  if (!W.s) return false;
  return (W.s.note('', { label: 'x' }) === false && W.s.note('   ') === false && W.s.size() === 0) || false;
}, test.limit.quick);
test.run('a peer noted is got back: its label, and seen as the moment it was noted', 0.2, function () {
  if (!W.s) return false;
  W.s.note(ALICE, { label: 'Alice', rank: P.HOST });
  const r = W.s.get(ALICE);
  return (!!r && r.label === 'Alice' && r.seen === clock && r.lastSeen === clock) || false;
}, test.limit.quick);
test.run('a miss is null, never an empty shape', 0.2, function () {
  if (!W.s) return false;
  return (W.s.get(BOB) === null && W.s.get('') === null) || false;
}, test.limit.quick);
test.run('rows are keyed by peer, so a peer noted a thousand times has one row', 0.2, function () {
  if (!W.s) return false;
  for (let i = 0; i < 50; i += 1) W.s.note(ALICE, { rank: P.ARRIVED });
  return W.s.size() === 1 || false;
}, test.limit.quick);
test.run('no route is kept, so a row carries no route, via or road', 0.2, function () {
  if (!W.s) return false;
  W.s.note(ALICE, { rank: P.ARRIVED, route: 'https://relay.example', via: 'x' });
  const r = W.s.get(ALICE) || {};
  const found = Object.keys(r).filter(function (k) { return /route|via|road/i.test(k); });
  return (Object.keys(r).length > 0 && found.length === 0) || false;
}, test.limit.quick);

// ── greedy, rank first ──
test.run('a label learned is not blanked by a later note that has none, and seen still moves', 0.2, function () {
  if (!W.s) return false;
  W.s.note(BOB, { label: 'Bob', rank: P.PROVED });
  const before = W.s.get(BOB).seen;
  W.s.note(BOB, { rank: P.ARRIVED });
  const r = W.s.get(BOB);
  return (r.label === 'Bob' && r.seen > before) || false;
}, test.limit.quick);
test.run('a worse-ranked label arriving later does not overwrite a better one', 0.2, function () {
  if (!W.s) return false;
  W.s.note(ALICE, { label: 'Alice (said by a partner)', rank: P.HEARSAY });
  const r = W.s.get(ALICE);
  return r.label === 'Alice' || false;
}, test.limit.quick);
test.run('a label of the same or a better rank wins: the host\'s rename lands', 0.2, function () {
  if (!W.s) return false;
  W.s.note(ALICE, { label: 'Alice R.', rank: P.HOST });
  W.s.note(BOB, { label: 'Robert', rank: P.HOST });
  return (W.s.get(ALICE).label === 'Alice R.' && W.s.get(BOB).label === 'Robert') || false;
}, test.limit.quick);
test.run('a note that names no rank is HEARSAY: it loses to a proved label and wins only an empty row', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { label: 'proved', rank: P.PROVED });
  s.note(ALICE, { label: 'unstated' });
  s.note(BOB, { label: 'unstated' });
  return (s.get(ALICE).label === 'proved' && s.get(BOB).label === 'unstated' && s.get(BOB).labelRank === P.HEARSAY) || false;
}, test.limit.quick);
test.run('the ranks are HOST 1, PROVED 2, ARRIVED 3 and HEARSAY 4, and the lower wins', 0.2, function () {
  return (P.HOST === 1 && P.PROVED === 2 && P.ARRIVED === 3 && P.HEARSAY === 4) || false;
}, test.limit.quick);

// ── seen, presence, relay ──
test.run('a caller holding the moment the word was said passes it as seen, and that is stamped', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { seen: 777 });
  return s.get(ALICE).seen === 777 || false;
}, test.limit.quick);
test.run('presence is three-valued: nothing said is null, and a note saying nothing never marks somebody away', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  const none = s.get(ALICE).present;
  s.note(ALICE, { present: true });
  s.note(ALICE, { rank: P.ARRIVED });
  const still = s.get(ALICE).present;
  s.note(ALICE, { present: false });
  return (none === null && still === true && s.get(ALICE).present === false) || false;
}, test.limit.quick);
test.run('relay: true is kept, and the flag never goes back to false here', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { relay: true });
  s.note(ALICE, { relay: false });
  s.note(ALICE, {});
  return s.get(ALICE).relay === true || false;
}, test.limit.quick);

// ── the owner's flags, listed, forget, reset ──
test.run('set writes a row\'s flags, the row made when there is none, and answers the row', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  const r = s.set(BOB, { keep: true, myLabel: 'my Bob' });
  return (!!r && r.keep === true && r.myLabel === 'my Bob' && s.get(BOB).keep === true) || false;
}, test.limit.quick);
test.run('listed is the kept and the owned rows only, so a peer merely seen is not listed', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { label: 'seen only' });
  s.set(BOB, { keep: true });
  s.set('MCowmine', { mine: true });
  const keys = s.listed().map(function (r) { return r.publicKey; }).sort();
  return keys.join() === [BOB, 'MCowmine'].sort().join() || false;
}, test.limit.quick);
test.run('forget removes the row itself', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  s.note(BOB, {});
  s.forget(ALICE);
  return (s.get(ALICE) === null && s.get(BOB) !== null && s.size() === 1) || false;
}, test.limit.quick);
test.run('reset empties the table', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  s.set(BOB, { keep: true });
  s.reset();
  return s.size() === 0 || false;
}, test.limit.quick);

// ── the space bound, bytes (0016, 0021) ──
test.run('the default bound is twenty megabytes, Andy\'s anchor: "say 20 MBytes = 10 jpeg images"', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore() });
  return (P.MAX_BYTES === 20 * 1024 * 1024 && s.maxBytes === P.MAX_BYTES) || false;
}, test.limit.quick);
test.run('there is no age limit, so a row a year old is not forgotten while there is room', 0.2, function () {
  let t = 0;
  const s = P.createSeenPeers({ store: freshStore(), now: function () { return t; } });
  t = 1;
  s.note(ALICE, { label: 'old friend' });
  t = 1 + 400 * 24 * 3600 * 1000;
  s.note(BOB, {});
  return (s.get(ALICE) !== null && s.size() === 2) || false;
}, test.limit.quick);

// One store filled with rows: kept, ignored (the oldest of all) and plain. The bound is then set under what they take.
const F = { store: null, bytes: 0, kept: [], ignored: [], plain: [] };
test.run('a store holds 600 rows with long labels, 20 kept, 40 ignored as the oldest, and the rest plain', 0.2, function () {
  F.store = freshStore();
  let t = 0;
  const s = P.createSeenPeers({ store: F.store, now: function () { t += 1; return t; } });
  const pad = 'x'.repeat(200);
  for (let i = 0; i < 600; i += 1) {
    const key = 'MCowFILL' + String(i).padStart(4, '0');
    s.note(key, { label: 'peer ' + i + ' ' + pad, rank: P.HOST });
    if (i < 40) { s.set(key, { ignored: true }); F.ignored.push(key); } else if (i >= 580) { s.set(key, { keep: true }); F.kept.push(key); } else F.plain.push(key);
  }
  F.bytes = s.bytes();
  return (s.size() === 600 && F.bytes > 0) || false;
}, test.limit.quick);
test.run('over its bound it sheds plain rows first, oldest first, before an ignored one; never a kept one', 0.2, function () {
  if (!F.store) return false;
  const s = P.createSeenPeers({ store: F.store, maxBytes: Math.floor(F.bytes / 2) });
  const n = s.size();
  const keptLeft = F.kept.filter(function (k) { return s.get(k) !== null; }).length;
  const ignoredLeft = F.ignored.filter(function (k) { return s.get(k) !== null; }).length;
  const plainLeft = F.plain.filter(function (k) { return s.get(k) !== null; }).length;
  return (n < 600 && keptLeft === 20 && ignoredLeft === 40 && plainLeft < F.plain.length && s.bytes() <= s.maxBytes) || false;
}, test.limit.quick);
test.run('a note sheds too: the bound holds after a write, not only when asked the size', 0.2, function () {
  if (!F.store) return false;
  const s = P.createSeenPeers({ store: F.store, maxBytes: Math.floor(F.bytes / 4) });
  s.note('MCowNEWONE', { label: 'n' });
  return F.store.seen.bytes() <= s.maxBytes || false;
}, test.limit.quick);
test.run('roomToAdd counts the store full when kept rows alone spend the cap; then a kept row needs no room, a new one is refused', 0.2, function () {
  if (!F.store) return false;
  const s = P.createSeenPeers({ store: F.store, maxBytes: 1 });
  const forNew = s.roomToAdd('MCowSTRANGER');
  const forKept = s.roomToAdd(F.kept[0]);
  const keptLeft = F.kept.filter(function (k) { return s.get(k) !== null; }).length;
  return (forNew === false && forKept === true && keptLeft === 20 && s.size() === 20) || false;
}, test.limit.quick);
test.run('roomToAdd answers yes when there is room under the bound', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  return s.roomToAdd(BOB) === true || false;
}, test.limit.quick);
