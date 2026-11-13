'use strict';

// spirit/run/spirit/test/seenPeers.js
// The tests of spirit/seenPeers.js, and of no other module (spec: ./seenPeers.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// Who this node has seen, and what they are called: the rules of what is learned and when a row goes, over the seen
// table of nodeStore. A store is opened on a scratch home, the same path the node takes ("the suites open a store in a
// temp home"), and a planted clock stamps each note.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const P = require(path.join(RUN, 'spirit', 'seenPeers.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seenPeers-'));
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
  try { P.createSeenPeers({}); } catch (e) { return /needs a store/.test(e.message) || 'threw ' + e.message; }
  return 'it made a seenPeers with no store';
}, test.limit.quick);
test.run('with a rootDir it opens nodeStore there', 0.2, function () {
  const root = path.join(HOME, 'byRoot');
  const s = P.createSeenPeers({ rootDir: root });
  opened.push(nodeStore.open(root));
  return (s.note(ALICE, {}) === true && s.get(ALICE) !== null && fs.existsSync(path.join(root, 'spirit', 'state'))) || 'nothing kept under the rootDir';
}, test.limit.quick);

// ── note and get ──
const W = { s: null };
test.run('the world: a store on a scratch home, a planted clock', 0.2, function () {
  W.s = P.createSeenPeers({ store: freshStore(), now: tick });
  return !!W.s || 'no seenPeers';
}, test.limit.quick);
test.run('note with no key is refused, false, and writes nothing', 0.2, function () {
  if (!W.s) return 'the world failed';
  return (W.s.note('', { label: 'x' }) === false && W.s.note('   ') === false && W.s.size() === 0) || 'size ' + W.s.size();
}, test.limit.quick);
test.run('a peer noted is got back: its label, and seen as the moment it was noted', 0.2, function () {
  if (!W.s) return 'the world failed';
  W.s.note(ALICE, { label: 'Alice', rank: P.HOST });
  const r = W.s.get(ALICE);
  return (!!r && r.label === 'Alice' && r.seen === clock && r.lastSeen === clock) || 'got ' + short(r);
}, test.limit.quick);
test.run('a miss is null, never an empty shape', 0.2, function () {
  if (!W.s) return 'the world failed';
  return (W.s.get(BOB) === null && W.s.get('') === null) || 'a miss answered ' + short(W.s.get(BOB));
}, test.limit.quick);
test.run('keyed by peer: noted a thousand times, one row', 0.2, function () {
  if (!W.s) return 'the world failed';
  for (let i = 0; i < 50; i += 1) W.s.note(ALICE, { rank: P.ARRIVED });
  return W.s.size() === 1 || 'size ' + W.s.size();
}, test.limit.quick);
test.run('no route is kept: a row carries no route, via or road (goal/G47.1)', 0.2, function () {
  if (!W.s) return 'the world failed';
  W.s.note(ALICE, { rank: P.ARRIVED, route: 'https://relay.example', via: 'x' });
  const r = W.s.get(ALICE) || {};
  const found = Object.keys(r).filter(function (k) { return /route|via|road/i.test(k); });
  return (Object.keys(r).length > 0 && found.length === 0) || 'route fields: ' + short(found);
}, test.limit.quick);

// ── greedy, rank first ──
test.run('greedy: a label learned is not blanked by a later note that has none, and seen still moves', 0.2, function () {
  if (!W.s) return 'the world failed';
  W.s.note(BOB, { label: 'Bob', rank: P.PROVED });
  const before = W.s.get(BOB).seen;
  W.s.note(BOB, { rank: P.ARRIVED });
  const r = W.s.get(BOB);
  return (r.label === 'Bob' && r.seen > before) || 'got ' + short(r);
}, test.limit.quick);
test.run('rank first: a worse-ranked label arriving later does not overwrite a better one (cycle R29)', 0.2, function () {
  if (!W.s) return 'the world failed';
  W.s.note(ALICE, { label: 'Alice (said by a partner)', rank: P.HEARSAY });
  const r = W.s.get(ALICE);
  return r.label === 'Alice' || 'a hearsay label won: ' + short(r.label);
}, test.limit.quick);
test.run('a label of the same or a better rank wins: the host\'s rename lands', 0.2, function () {
  if (!W.s) return 'the world failed';
  W.s.note(ALICE, { label: 'Alice R.', rank: P.HOST });
  W.s.note(BOB, { label: 'Robert', rank: P.HOST });
  return (W.s.get(ALICE).label === 'Alice R.' && W.s.get(BOB).label === 'Robert') || 'got ' + short([W.s.get(ALICE).label, W.s.get(BOB).label]);
}, test.limit.quick);
test.run('a note that names no rank is HEARSAY: it loses to a proved label and wins only an empty row', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { label: 'proved', rank: P.PROVED });
  s.note(ALICE, { label: 'unstated' });
  s.note(BOB, { label: 'unstated' });
  return (s.get(ALICE).label === 'proved' && s.get(BOB).label === 'unstated' && s.get(BOB).labelRank === P.HEARSAY) || 'got ' + short([s.get(ALICE), s.get(BOB)]);
}, test.limit.quick);
test.run('the ranks, lower wins: HOST 1, PROVED 2, ARRIVED 3, HEARSAY 4', 0.2, function () {
  return (P.HOST === 1 && P.PROVED === 2 && P.ARRIVED === 3 && P.HEARSAY === 4) || 'got ' + short([P.HOST, P.PROVED, P.ARRIVED, P.HEARSAY]);
}, test.limit.quick);

// ── seen, presence, relay ──
test.run('a caller holding the moment the word was said passes it as seen, and that is stamped (goal/G2.9)', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { seen: 777 });
  return s.get(ALICE).seen === 777 || 'seen ' + s.get(ALICE).seen;
}, test.limit.quick);
test.run('presence is three-valued: nothing said is null, and a note saying nothing never marks somebody away', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  const none = s.get(ALICE).present;
  s.note(ALICE, { present: true });
  s.note(ALICE, { rank: P.ARRIVED });
  const still = s.get(ALICE).present;
  s.note(ALICE, { present: false });
  return (none === null && still === true && s.get(ALICE).present === false) || 'got ' + short([none, still, s.get(ALICE).present]);
}, test.limit.quick);
test.run('relay: true is kept, and the flag never goes back to false here', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { relay: true });
  s.note(ALICE, { relay: false });
  s.note(ALICE, {});
  return s.get(ALICE).relay === true || 'relay ' + s.get(ALICE).relay;
}, test.limit.quick);

// ── the owner's flags, listed, forget, reset ──
test.run('set writes a row\'s flags, the row made when there is none, and answers the row', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  const r = s.set(BOB, { keep: true, myLabel: 'my Bob' });
  return (!!r && r.keep === true && r.myLabel === 'my Bob' && s.get(BOB).keep === true) || 'got ' + short(r);
}, test.limit.quick);
test.run('listed is the kept and the owned rows only: a peer merely seen is not listed (goal/G40.11)', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, { label: 'seen only' });
  s.set(BOB, { keep: true });
  s.set('MCowmine', { mine: true });
  const keys = s.listed().map(function (r) { return r.publicKey; }).sort();
  return keys.join() === [BOB, 'MCowmine'].sort().join() || 'listed ' + short(keys);
}, test.limit.quick);
test.run('forget removes the row itself', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  s.note(BOB, {});
  s.forget(ALICE);
  return (s.get(ALICE) === null && s.get(BOB) !== null && s.size() === 1) || 'got ' + short([s.get(ALICE), s.size()]);
}, test.limit.quick);
test.run('reset empties the table', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  s.set(BOB, { keep: true });
  s.reset();
  return s.size() === 0 || 'size ' + s.size();
}, test.limit.quick);

// ── the space bound, bytes (0016, 0021) ──
test.run('the default bound is twenty megabytes, Andy\'s anchor: "say 20 MBytes = 10 jpeg images"', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore() });
  return (P.MAX_BYTES === 20 * 1024 * 1024 && s.maxBytes === P.MAX_BYTES) || 'got ' + short([P.MAX_BYTES, s.maxBytes]);
}, test.limit.quick);
test.run('no age limit: a row a year old is not forgotten while there is room (0021)', 0.2, function () {
  let t = 0;
  const s = P.createSeenPeers({ store: freshStore(), now: function () { return t; } });
  t = 1;
  s.note(ALICE, { label: 'old friend' });
  t = 1 + 400 * 24 * 3600 * 1000;
  s.note(BOB, {});
  return (s.get(ALICE) !== null && s.size() === 2) || 'the old row went: ' + short(s.get(ALICE));
}, test.limit.quick);

// One store filled with rows: kept, ignored (the oldest of all) and plain. The bound is then set under what they take.
const F = { store: null, bytes: 0, kept: [], ignored: [], plain: [] };
test.run('the world: a store of 600 rows with long labels, 20 kept, 40 ignored as the oldest, the rest plain', 0.2, function () {
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
  return (s.size() === 600 && F.bytes > 0) || 'size ' + s.size() + ', bytes ' + F.bytes;
}, test.limit.quick);
test.run('over its bound it sheds plain rows first, oldest first, before an ignored one; never a kept one', 0.2, function () {
  if (!F.store) return 'the world failed';
  const s = P.createSeenPeers({ store: F.store, maxBytes: Math.floor(F.bytes / 2) });
  const n = s.size();
  const keptLeft = F.kept.filter(function (k) { return s.get(k) !== null; }).length;
  const ignoredLeft = F.ignored.filter(function (k) { return s.get(k) !== null; }).length;
  const plainLeft = F.plain.filter(function (k) { return s.get(k) !== null; }).length;
  return (n < 600 && keptLeft === 20 && ignoredLeft === 40 && plainLeft < F.plain.length && s.bytes() <= s.maxBytes) || 'left: ' + short({ n: n, kept: keptLeft, ignored: ignoredLeft, plain: plainLeft, bytes: s.bytes(), max: s.maxBytes });
}, test.limit.quick);
test.run('a note sheds too: the bound holds after a write, not only when asked the size', 0.2, function () {
  if (!F.store) return 'the world failed';
  const s = P.createSeenPeers({ store: F.store, maxBytes: Math.floor(F.bytes / 4) });
  s.note('MCowNEWONE', { label: 'n' });
  return F.store.seen.bytes() <= s.maxBytes || 'bytes ' + F.store.seen.bytes() + ' over ' + s.maxBytes;
}, test.limit.quick);
test.run('roomToAdd: full means the cap is spent on kept rows alone; a kept row needs no room, a new one is refused', 0.2, function () {
  if (!F.store) return 'the world failed';
  const s = P.createSeenPeers({ store: F.store, maxBytes: 1 });
  const forNew = s.roomToAdd('MCowSTRANGER');
  const forKept = s.roomToAdd(F.kept[0]);
  const keptLeft = F.kept.filter(function (k) { return s.get(k) !== null; }).length;
  return (forNew === false && forKept === true && keptLeft === 20 && s.size() === 20) || 'got ' + short({ forNew: forNew, forKept: forKept, keptLeft: keptLeft, size: s.size() });
}, test.limit.quick);
test.run('roomToAdd: with room under the bound, yes', 0.2, function () {
  const s = P.createSeenPeers({ store: freshStore(), now: tick });
  s.note(ALICE, {});
  return s.roomToAdd(BOB) === true || 'no room in an almost empty store';
}, test.limit.quick);
