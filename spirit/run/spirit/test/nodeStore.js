'use strict';

// spirit/run/spirit/test/nodeStore.js
// The tests of spirit/nodeStore.js, and of no other module, in this one file (spec: ./nodeStore.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72). On scratch node homes under the OS
// temp dir: a real node.db, every row written and read back through the store's own functions.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));
const { DatabaseSync } = require('node:sqlite');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodestore-'));
let homes = 0;
function home() { homes += 1; return path.join(TMP, 'h' + homes); }
const DAY = 24 * 60 * 60 * 1000;
const W = {};

// ── the module ──
test.run('the store is available where node:sqlite loads', 0.2, function () {
  return nodeStore.available() === true || false;
}, test.limit.quick);
test.run('the file is spirit/state/node.db under the home, and the cap is 16 MB', 0.4, function () {
  return (nodeStore.dbPath('/x') === path.join('/x', 'spirit', 'state', 'node.db') &&
    nodeStore.MAX_DB_BYTES === 16 * 1024 * 1024) || false;
}, test.limit.quick);
test.run('opening a new home makes its state folder and its node.db', 0.2, function () {
  W.h = home();
  W.s = nodeStore.open(W.h);
  return (W.s.path === nodeStore.dbPath(W.h) && fs.existsSync(W.s.path)) || false;
}, test.limit.quick);
test.run('a second open of the same home, spelled another way, is the same store', 0.4, function () {
  return nodeStore.open(path.join(W.h, '.', 'spirit', '..')) === W.s || false;
}, test.limit.quick);
test.run('the file is on a rollback journal with incremental vacuum, and no journal is left after a write', 0.4, function () {
  W.s.seen.set('JOURNAL', { keep: true });
  const dir = path.dirname(W.s.path);
  const others = fs.readdirSync(dir).filter(function (f) { return f !== 'node.db'; });
  const peek = new DatabaseSync(W.s.path, { readOnly: true });
  const av = peek.prepare('PRAGMA auto_vacuum').get().auto_vacuum;
  peek.close();
  return (others.length === 0 && av === 2) || false;
}, test.limit.quick);
// secure_delete: the table holds whose business this node has been doing, so a row forgotten must leave the disc: 0.8.
test.run('a forgotten row\'s text leaves the file, not only the index', 0.8, function () {
  const h = home();
  const s = nodeStore.open(h);
  s.seen.set('SECRETKEY', { myLabel: 'ZQXJVW-a-name-that-must-go' });
  const before = fs.readFileSync(s.path).includes('ZQXJVW-a-name-that-must-go');
  s.seen.forget('SECRETKEY');
  s.close();
  const after = fs.readFileSync(nodeStore.dbPath(h)).includes('ZQXJVW-a-name-that-must-go');
  return (before === true && after === false) || false;
}, test.limit.quick);
test.run('after close the home opens as a new store with every row still there, and closing twice does no harm', 0.8, function () {
  W.s.seen.put('PERSIST', { label: 'Persisted', seen: 5 });
  W.s.close();
  W.s.close();
  const again = nodeStore.open(W.h);
  const ok = again !== W.s && (again.seen.get('PERSIST') || {}).label === 'Persisted' && !!(again.seen.get('JOURNAL') || {}).keep;
  W.s = again;
  return ok || false;
}, test.limit.quick);

// ── seen: put ──
test.run('a put makes the row and answers it as it reads', 0.4, function () {
  const r = W.s.seen.put('A', { label: 'Alice?', labelRank: 3, seen: 1000 }) || {};
  return (r.publicKey === 'A' && r.label === 'Alice?' && r.labelRank === 3 && r.labelAt === 1000 &&
    r.firstSeen === 1000 && r.lastSeen === 1000 && r.present === null && r.relay === false && r.keep === false &&
    r.myLabel === '' && r.card === '' && r.url === '') || false;
}, test.limit.quick);
test.run('a surer label replaces the one held, with its rank and time', 0.4, function () {
  const r = W.s.seen.put('A', { label: 'Alice', labelRank: 1, seen: 2000 }) || {};
  return (r.label === 'Alice' && r.labelRank === 1 && r.labelAt === 2000) || false;
}, test.limit.quick);
test.run('a less sure label does not replace it, though lastSeen moves', 0.4, function () {
  const r = W.s.seen.put('A', { label: 'Mallory', labelRank: 2, seen: 3000 }) || {};
  return (r.label === 'Alice' && r.labelRank === 1 && r.labelAt === 2000 && r.lastSeen === 3000) || false;
}, test.limit.quick);
test.run('an equally sure label that came later replaces it', 0.4, function () {
  const r = W.s.seen.put('A', { label: 'Alice B', labelRank: 1, seen: 3500 }) || {};
  return (r.label === 'Alice B' && r.labelAt === 3500) || false;
}, test.limit.quick);
test.run('a put with no label keeps the label held', 0.4, function () {
  const r = W.s.seen.put('A', { seen: 3600 }) || {};
  return (r.label === 'Alice B' && r.labelRank === 1) || false;
}, test.limit.quick);
test.run('firstSeen is written once and lastSeen every time', 0.4, function () {
  const r = W.s.seen.put('A', { seen: 4000 }) || {};
  return (r.firstSeen === 1000 && r.lastSeen === 4000) || false;
}, test.limit.quick);
test.run('presence said true, then false, is stored as said', 0.4, function () {
  const t = (W.s.seen.put('A', { present: true, seen: 4100 }) || {}).present;
  const f = (W.s.seen.put('A', { present: false, seen: 4200 }) || {}).present;
  return (t === true && f === false) || false;
}, test.limit.quick);
test.run('a caller saying nothing of presence leaves it as it was', 0.8, function () {
  W.s.seen.put('A', { present: true, seen: 4300 });
  const r = W.s.seen.put('A', { seen: 4400 }) || {};
  return r.present === true || false;
}, test.limit.quick);
test.run('a put marks a row a relay, and a later put that does not say so leaves it a relay', 0.4, function () {
  const a = (W.s.seen.put('R', { relay: true, seen: 10 }) || {}).relay;
  const b = (W.s.seen.put('R', { relay: false, seen: 11 }) || {}).relay;
  return (a === true && b === true) || false;
}, test.limit.quick);
test.run('get answers null for an unknown key and for none', 0.4, function () {
  return (W.s.seen.get('NOBODY') === null && W.s.seen.get(null) === null) || false;
}, test.limit.quick);

// ── seen: set ──
test.run('set makes a row nobody has seen, dates 0 and presence unknown, with the fields given', 0.4, function () {
  const r = W.s.seen.set('C', { keep: true, myLabel: 'Carol', card: 'card-text', face: 'carol' }) || {};
  return (r.keep === true && r.myLabel === 'Carol' && r.card === 'card-text' && r.face === 'carol' &&
    r.firstSeen === 0 && r.lastSeen === 0 && r.present === null && r.label === '') || false;
}, test.limit.quick);
test.run('set leaves the fields it is not given alone', 0.4, function () {
  const r = W.s.seen.set('C', { blocked: true }) || {};
  return (r.keep === true && r.blocked === true && r.myLabel === 'Carol' && r.card === 'card-text') || false;
}, test.limit.quick);
test.run('set writes a flag only from a boolean and a text only from a string', 0.4, function () {
  const r = W.s.seen.set('C', { keep: 'no', blocked: 0, myLabel: 7, card: null }) || {};
  return (r.keep === true && r.blocked === true && r.myLabel === 'Carol' && r.card === 'card-text') || false;
}, test.limit.quick);
test.run('set takes a flag away when given false', 0.4, function () {
  return (W.s.seen.set('C', { blocked: false }) || {}).blocked === false || false;
}, test.limit.quick);
test.run('set writes firstSeen only on a row that has none', 0.4, function () {
  const a = (W.s.seen.set('C', { firstSeen: 777 }) || {}).firstSeen;
  const b = (W.s.seen.set('C', { firstSeen: 888 }) || {}).firstSeen;
  const c = (W.s.seen.set('A', { firstSeen: 5 }) || {}).firstSeen;
  return (a === 777 && b === 777 && c === 1000) || false;
}, test.limit.quick);
test.run('set refuses an empty or blank key and makes no row', 0.4, function () {
  const n = W.s.seen.size();
  return (W.s.seen.set('', { keep: true }) === null && W.s.seen.set('   ', { keep: true }) === null &&
    W.s.seen.size() === n) || false;
}, test.limit.quick);

// ── seen: reads ──
test.run('flagged answers every row with that flag, newest first, and nothing for an unknown flag', 0.4, function () {
  W.s.seen.put('M1', { seen: 100 }); W.s.seen.set('M1', { mine: true });
  W.s.seen.put('M2', { seen: 200 }); W.s.seen.set('M2', { mine: true });
  const keys = W.s.seen.flagged('mine').map(function (r) { return r.publicKey; });
  return (keys.join(',') === 'M2,M1' && W.s.seen.flagged('nope').length === 0) || false;
}, test.limit.quick);
test.run('listed is the kept and the owned, each once, and nobody else', 0.4, function () {
  W.s.seen.set('M1', { keep: true });
  const keys = W.s.seen.listed().map(function (r) { return r.publicKey; }).sort();
  return keys.join(',') === 'C,JOURNAL,M1,M2' || false;
}, test.limit.quick);
test.run('byUrl finds the relay row holding that address, and nobody for an unknown or empty one', 0.4, function () {
  W.s.seen.set('R', { url: 'wss://relay.example' });
  return ((W.s.seen.byUrl('wss://relay.example') || {}).publicKey === 'R' && W.s.seen.byUrl('wss://other.example') === null &&
    W.s.seen.byUrl('') === null) || false;
}, test.limit.quick);
test.run('forget deletes the row and says whether there was one', 0.4, function () {
  const n = W.s.seen.size();
  const a = W.s.seen.forget('M2');
  const b = W.s.seen.forget('M2');
  return (a === true && b === false && W.s.seen.size() === n - 1 && W.s.seen.get('M2') === null) || false;
}, test.limit.quick);

// ── seen: the change stream ──
test.run('a listener hears a changed row as it now reads', 0.4, function () {
  W.heard = [];
  W.stop = W.s.seen.onChange(function (r) { W.heard.push(r); });
  W.s.seen.set('C', { myLabel: 'Carol C' });
  return (W.heard.length === 1 && W.heard[0].publicKey === 'C' && W.heard[0].myLabel === 'Carol C' && W.heard[0].keep === true) || false;
}, test.limit.quick);
test.run('a write that changes nothing is not heard', 0.4, function () {
  W.s.seen.set('C', { myLabel: 'Carol C' });
  return W.heard.length === 1 || false;
}, test.limit.quick);
test.run('a forgotten row is heard as gone', 0.4, function () {
  W.s.seen.forget('M1');
  const last = W.heard[W.heard.length - 1] || {};
  return (W.heard.length === 2 && last.publicKey === 'M1' && last.gone === true) || false;
}, test.limit.quick);
test.run('a listener that throws stops neither the write nor the next listener', 0.4, function () {
  const stopBad = W.s.seen.onChange(function () { throw new Error('x'); });
  let second = 0;
  const stopGood = W.s.seen.onChange(function () { second += 1; });
  W.s.seen.put('L', { label: 'L', seen: 9 });
  stopBad(); stopGood();
  return ((W.s.seen.get('L') || {}).label === 'L' && second === 1) || false;
}, test.limit.quick);
test.run('the function onChange answers stops it, and a non-function is refused', 0.4, function () {
  W.stop();
  const n = W.heard.length;
  W.s.seen.set('C', { myLabel: 'Carol D' });
  const noop = W.s.seen.onChange('not a function');
  return (W.heard.length === n && typeof noop === 'function') || false;
}, test.limit.quick);

// ── seen: shedding ──
test.run('a store of unflagged, ignored, kept and owned rows is set up for shedding', 0.2, function () {
  W.sh = nodeStore.open(home());
  const pad = new Array(400).join('x');
  for (let i = 0; i < 20; i += 1) { W.sh.seen.put('IGN' + i, { label: 'i' + pad, seen: 1 + i }); W.sh.seen.set('IGN' + i, { ignored: true }); }
  for (let i = 0; i < 200; i += 1) W.sh.seen.put('U' + i, { label: 'u' + pad, seen: 1000 + i });
  for (let i = 0; i < 5; i += 1) { W.sh.seen.put('K' + i, { label: 'k' + pad, seen: 1 + i }); W.sh.seen.set('K' + i, { keep: true }); }
  for (let i = 0; i < 5; i += 1) { W.sh.seen.put('O' + i, { label: 'o' + pad, seen: 1 + i }); W.sh.seen.set('O' + i, { mine: true }); }
  W.full = W.sh.seen.bytes();
  return (W.sh.seen.size() === 230 && W.sh.seen.sheddable() === 220 && W.full > 0 && W.sh.seen.fileBytes() >= W.full) || false;
}, test.limit.quick);
test.run('a cap of 0 or one already met sheds nothing', 0.4, function () {
  return (W.sh.seen.sweepToBytes(0) === 0 && W.sh.seen.sweepToBytes(-5) === 0 && W.sh.seen.sweepToBytes(W.full) === 0 &&
    W.sh.seen.size() === 230) || false;
}, test.limit.quick);
test.run('a sweep to half sheds the oldest unflagged rows first and leaves every ignored one while unflagged are left', 0.4, function () {
  const gone = W.sh.seen.sweepToBytes(Math.floor(W.full / 2));
  let left = 0;
  let oldestLeft = Infinity;
  let newestGone = -1;
  for (let i = 0; i < 200; i += 1) {
    if (W.sh.seen.get('U' + i)) { left += 1; oldestLeft = Math.min(oldestLeft, i); } else newestGone = Math.max(newestGone, i);
  }
  let ign = 0;
  for (let i = 0; i < 20; i += 1) if (W.sh.seen.get('IGN' + i)) ign += 1;
  return (gone > 0 && left > 0 && ign === 20 && newestGone < oldestLeft && W.sh.seen.bytes() <= Math.floor(W.full / 2)) || false;
}, test.limit.quick);
// A chosen contact or an owned row shed would be the owner's choice undone: 0.8.
test.run('a sweep to nothing sheds every unflagged and ignored row and never a kept or owned one', 0.8, function () {
  W.sh.seen.sweepToBytes(1);
  let kept = 0;
  for (let i = 0; i < 5; i += 1) { if (W.sh.seen.get('K' + i)) kept += 1; if (W.sh.seen.get('O' + i)) kept += 1; }
  return (W.sh.seen.sheddable() === 0 && kept === 10 && W.sh.seen.size() === 10) || false;
}, test.limit.quick);
test.run('clear empties the table and answers how many went', 0.4, function () {
  return (W.sh.seen.clear() === 10 && W.sh.seen.size() === 0 && W.sh.seen.clear() === 0) || false;
}, test.limit.quick);

// ── traffic, the node log ──
test.run('a log row reads back exactly as written, types and unnamed fields kept', 0.8, function () {
  W.t = nodeStore.open(home());
  const a = W.t.traffic.add({ at: '2020-01-01T00:00:00.000Z', dir: 'out', kind: 'peer', hash: 'h1', status: 200, owner: true,
    ms: 0, why: 'w', custom: { deep: [1, 2] }, other: 'x' });
  const b = W.t.traffic.add({ at: '2020-01-01T00:00:01.000Z', status: 'not a number', owner: false, bytes: 12 });
  const all = W.t.traffic.all();
  const r0 = all[0] || {};
  const r1 = all[1] || {};
  return (b > a && all.length === 2 && r0.status === 200 && r0.owner === true && r0.ms === 0 && r0.why === 'w' &&
    JSON.stringify(r0.custom) === '{"deep":[1,2]}' && r0.other === 'x' && r0.payload === undefined &&
    r1.status === 'not a number' && r1.owner === false && r1.bytes === 12) || false;
}, test.limit.quick);
test.run('a null log row is an empty row', 0.4, function () {
  const n = W.t.traffic.count();
  W.t.traffic.add(null);
  const last = W.t.traffic.all()[n] || null;
  return (W.t.traffic.count() === n + 1 && last && Object.keys(last).length === 0) || false;
}, test.limit.quick);
test.run('byHash answers the rows of that hash, and none for an empty hash', 0.4, function () {
  W.t.traffic.add({ at: '2020-01-01T00:00:02.000Z', hash: 'h1', dir: 'in' });
  W.t.traffic.add({ at: '2020-01-01T00:00:03.000Z', hash: '' });
  return (W.t.traffic.byHash('h1').length === 2 && W.t.traffic.byHash('').length === 0 && W.t.traffic.byHash(null).length === 0) || false;
}, test.limit.quick);
test.run('owner answers the owner rows after a time, oldest first, at most the limit', 0.4, function () {
  W.t.traffic.add({ at: '2020-02-01T00:00:03.000Z', kind: 'owner', label: 'c' });
  W.t.traffic.add({ at: '2020-02-01T00:00:01.000Z', kind: 'owner', label: 'a' });
  W.t.traffic.add({ at: '2020-02-01T00:00:02.000Z', kind: 'owner', label: 'b' });
  const all = W.t.traffic.owner('', 10).map(function (r) { return r.label; }).join('');
  const after = W.t.traffic.owner('2020-02-01T00:00:01.000Z', 1).map(function (r) { return r.label; }).join('');
  return (all === 'abc' && after === 'b') || false;
}, test.limit.quick);
test.run('arrivals answers only delivered rows that came in, after a time, at most the limit', 0.4, function () {
  W.t.traffic.add({ at: '2020-03-01T00:00:01.000Z', dir: 'in', outcome: 'delivered', hash: 'd1' });
  W.t.traffic.add({ at: '2020-03-01T00:00:02.000Z', dir: 'out', outcome: 'delivered', hash: 'd2' });
  W.t.traffic.add({ at: '2020-03-01T00:00:03.000Z', dir: 'in', outcome: 'refused', hash: 'd3' });
  W.t.traffic.add({ at: '2020-03-01T00:00:04.000Z', dir: 'in', outcome: 'delivered', hash: 'd4' });
  const all = W.t.traffic.arrivals('', 10).map(function (r) { return r.hash; }).join(',');
  const one = W.t.traffic.arrivals('2020-03-01T00:00:01.000Z', 1).map(function (r) { return r.hash; }).join(',');
  return (all === 'd1,d4' && one === 'd4') || false;
}, test.limit.quick);
test.run('untaken answers the last day\'s delivered arrivals with no taken mark, oldest first', 0.4, function () {
  const now = Date.now();
  const iso = function (ms) { return new Date(ms).toISOString(); };
  W.t.traffic.add({ at: iso(now - 2 * DAY), dir: 'in', outcome: 'delivered', hash: 'old' });
  W.t.traffic.add({ at: iso(now - 2000), dir: 'in', outcome: 'delivered', hash: 'u2' });
  W.t.traffic.add({ at: iso(now - 3000), dir: 'in', outcome: 'delivered', hash: 'u1' });
  W.t.traffic.add({ at: iso(now - 1000), dir: 'in', outcome: 'delivered', hash: 'tk' });
  W.t.traffic.add({ at: iso(now - 500), hash: 'tk', mark: 'taken' });
  return W.t.traffic.untaken().map(function (r) { return r.hash; }).join(',') === 'u1,u2' || false;
}, test.limit.quick);
test.run('lastAt answers the newest stamp, and an empty log none', 0.4, function () {
  const e = nodeStore.open(home());
  const empty = e.traffic.lastAt();
  e.traffic.add({ at: '2021-01-01T00:00:00.000Z' });
  e.traffic.add({ at: '2020-01-01T00:00:00.000Z' });
  const ok = empty === '' && e.traffic.lastAt() === '2021-01-01T00:00:00.000Z' && e.traffic.count() === 2 && e.traffic.bytes() > 0;
  e.close();
  return ok || false;
}, test.limit.quick);
// The cap is what keeps his box from grinding to a halt (Andy: "make sure the code doesn't allow it to grow anymore"): 0.8.
test.run('the file never grows past its cap: the oldest log rows go, never the one just written', 0.8, function () {
  const s = nodeStore.open(home());
  const big = new Array(200 * 1024).join('p');
  let over = false;
  let first = 0;
  let last = 0;
  for (let i = 0; i < 110; i += 1) {
    last = s.traffic.add({ at: '2020-01-01T00:00:00.000Z', hash: 'big' + i, payload: big });
    if (!first) first = last;
    if (s.fileBytes() > nodeStore.MAX_DB_BYTES) over = true;
  }
  const hashes = s.traffic.all().map(function (r) { return r.hash; });
  const count = s.traffic.count();
  const newest = s.traffic.byHash('big109').length;
  s.close();
  return (!over && hashes.indexOf('big0') === -1 && hashes.indexOf('big109') !== -1 && count < 110 &&
    newest === 1 && first === 1) || false;
}, test.limit.slow);

// ── replay ──
test.run('ms takes a number as is, an ISO time as its milliseconds, and anything else as 0', 0.4, function () {
  const r = W.s.replay;
  return (r.ms(1234) === 1234 && r.ms('2020-01-01T00:00:00.000Z') === Date.UTC(2020, 0, 1) && r.ms('garbage') === 0 &&
    r.ms(null) === 0) || false;
}, test.limit.quick);
test.run('the replay window is one day and the clock skew one hour', 0.4, function () {
  return (W.s.replay.WINDOW_MS === DAY && W.s.replay.SKEW_MS === 60 * 60 * 1000) || false;
}, test.limit.quick);
// A replayed sealed message read as new is the hole this index closes: 0.8.
test.run('a hash is new until remembered, then again, also when its time comes as an ISO string', 0.8, function () {
  const now = Date.UTC(2030, 0, 10);
  const a = W.s.replay.seen('rp1', new Date(now - 1000).toISOString(), now);
  W.s.replay.remember('rp1', new Date(now - 1000).toISOString());
  const b = W.s.replay.seen('rp1', now - 1000, now);
  return (a === 'new' && b === 'again') || false;
}, test.limit.quick);
test.run('a time past the window is old, past the skew ahead, and no hash old', 0.4, function () {
  const now = Date.UTC(2030, 0, 10);
  const r = W.s.replay;
  return (r.seen('rp2', now - DAY - 1, now) === 'old' && r.seen('rp2', now + r.SKEW_MS + 1, now) === 'ahead' &&
    r.seen('rp2', now + r.SKEW_MS, now) === 'new' && r.seen('', now, now) === 'old') || false;
}, test.limit.quick);
test.run('remembering a hash twice keeps it once, and a sweep drops only what is past the window', 0.4, function () {
  const now = Date.UTC(2030, 0, 10);
  W.s.replay.remember('rp1', now - 5);
  W.s.replay.remember('rpOld', now - DAY - 10);
  const n = W.s.replay.count();
  const gone = W.s.replay.sweep(now);
  return (n === 2 && gone === 1 && W.s.replay.count() === 1 && W.s.replay.seen('rp1', now - 1000, now) === 'again') || false;
}, test.limit.quick);
test.run('a rebuild takes the rows with a hash, skips the rest, and is safe to run twice', 0.4, function () {
  const now = Date.UTC(2030, 0, 10);
  const rows = [{ hash: 'rb1', at: now }, { hash: '', at: now }, null, { at: now }, { hash: 'rb2', at: new Date(now).toISOString() }];
  const a = W.s.replay.rebuild(rows);
  const b = W.s.replay.rebuild(rows);
  const c = W.s.replay.rebuild('not rows');
  return (a === 2 && b === 2 && c === 0 && W.s.replay.count() === 3 && W.s.replay.seen('rb2', now, now) === 'again') || false;
}, test.limit.quick);

// ── record ──
test.run('one report a minute per relay is kept, the last in the minute winning, its figures pulled out', 0.4, function () {
  W.r = nodeStore.open(home());
  const m = 60 * 1000;
  W.r.record.put('wss://r1', { peers: 1, present: 1 }, 10 * m + 5);
  W.r.record.put('wss://r1', { peers: 4, present: 3, routes: 2, memory: { rss: 3 * 1048576 }, seats: { allowance: 9, free: 5, outstanding: 1 } }, 10 * m + 50000);
  const rows = W.r.record.since('wss://r1', 0);
  const r = rows[0] || {};
  return (rows.length === 1 && r.at === 10 * m && r.kind === 'report' && r.members === 4 && r.connected === 3 &&
    r.routes === 2 && r.rssMB === 3 && r.allowance === 9) || false;
}, test.limit.quick);
// A person's name or key kept in the tier that is never deleted cannot be taken back (cycle 11's R5): 0.8.
test.run('a report keeps numbers, booleans, mode and version, counts arrays, and drops every other string by name', 0.8, function () {
  W.r.record.put('wss://r2', { peers: 2, mode: 'open', version: '1.2', owner: 'Andy Flinn', publicKey: 'MCow-a-key', ok: true,
    invites: ['a', 'b', 'c'], nested: { n: 1, who: 'Bob' } }, 0);
  const rest = JSON.parse((W.r.record.since('wss://r2', 0)[0] || {}).rest || '{}');
  const text = JSON.stringify(rest);
  return (rest.mode === 'open' && rest.version === '1.2' && rest.ok === true && rest.invites === 3 &&
    JSON.stringify(rest.nested) === '{"n":1}' && rest.withheld.indexOf('owner') !== -1 && rest.withheld.indexOf('publicKey') !== -1 &&
    text.indexOf('Andy Flinn') === -1 && text.indexOf('MCow-a-key') === -1 && text.indexOf('Bob') === -1 && rest.peers === undefined) || false;
}, test.limit.quick);
test.run('an edge is kept at its instant, and an unknown kind is a close', 0.4, function () {
  W.r.record.edge('wss://r1', 'open', 10 * 60000 + 1, 'up');
  W.r.record.edge('wss://r1', 'whatever', 10 * 60000 + 2);
  const rows = W.r.record.since('wss://r1', 0);
  return (rows.length === 3 && rows[1].kind === 'open' && rows[1].at === 600001 && JSON.parse(rows[1].rest).why === 'up' &&
    rows[2].kind === 'close' && rows[2].rest === '{}') || false;
}, test.limit.quick);
test.run('a series answers figures for a report and a moment with its kind for an edge, oldest first', 0.4, function () {
  const s = W.r.record.series('wss://r1', 0);
  const a = s[0] || {};
  return (s.length === 3 && a.members === 4 && a.free === 5 && a.outstanding === 1 && a.rest === undefined && a.kind === undefined &&
    JSON.stringify(s[1]) === '{"at":600001,"was":"open"}' && s[2].was === 'close') || false;
}, test.limit.quick);
test.run('a window answers the same newest first between two times, at most the limit', 0.4, function () {
  const all = W.r.record.window('wss://r1', 0, 0).map(function (x) { return x.at; }).join(',');
  const cut = W.r.record.window('wss://r1', 0, 600001, 1).map(function (x) { return x.at; }).join(',');
  return (all === '600002,600001,600000' && cut === '600001') || false;
}, test.limit.quick);
test.run('a started after a stopped is a restart, a started after anything else a death, the first started no gap', 0.4, function () {
  const R = 'node-self';
  W.r.record.edge(R, 'started', 100);
  W.r.record.put(R, { peers: 1 }, 120000);
  W.r.record.edge(R, 'stopped', 200000);
  W.r.record.edge(R, 'started', 300000);
  W.r.record.put(R, { peers: 1 }, 360000);
  W.r.record.edge(R, 'started', 500000);
  const g = W.r.record.gaps(R);
  return (g.length === 2 && g[0].kind === 'restart' && g[0].from === 200000 && g[0].to === 300000 &&
    g[1].kind === 'death' && g[1].from === 360000 && g[1].to === 500000) || false;
}, test.limit.quick);
test.run('relays answers each relay once, lastAt the newest report and never an edge', 0.4, function () {
  return (W.r.record.relays().join(',') === 'node-self,wss://r1,wss://r2' && W.r.record.lastAt('wss://r1') === 600000 &&
    W.r.record.lastAt('nobody') === 0 && W.r.record.count() === 10) || false;
}, test.limit.quick);
test.run('coarsening keeps one report a day past the fine window, the day\'s last, every edge, and the fine window whole', 0.8, function () {
  const c = nodeStore.open(home());
  const d0 = 10 * DAY;
  c.record.put('r', { peers: 1 }, d0 + 60000);
  c.record.put('r', { peers: 2 }, d0 + 120000);
  c.record.put('r', { peers: 3 }, d0 + 180000);
  c.record.edge('r', 'open', d0 + 1);
  c.record.put('r', { peers: 7 }, d0 + DAY + 60000);
  const now = d0 + c.record.FINE_MS + 3 * DAY;
  c.record.put('r', { peers: 8 }, now - 60000);
  c.record.put('r', { peers: 9 }, now - 120000);
  const gone = c.record.coarsen(now);
  const rows = c.record.since('r', 0);
  c.close();
  const reports = rows.filter(function (x) { return x.kind === 'report'; }).map(function (x) { return x.members; }).join(',');
  return (c.record.FINE_MS === 90 * DAY && gone === 2 && reports === '3,7,9,8' && rows.filter(function (x) { return x.kind === 'open'; }).length === 1) || false;
}, test.limit.quick);

// ── queue and backoff ──
test.run('a queued row with no seq is given the next after the highest, and all answers them in seq order', 0.4, function () {
  W.q = nodeStore.open(home());
  const a = W.q.queue.put({ hash: 'q1', body: 'b1', relayUrl: 'wss://r', toKey: 'K', kind: 'text', bytes: 2, atWall: 5, untilWall: 9 });
  const b = W.q.queue.put({ hash: 'q2', body: 'b2', seq: 10 });
  const c = W.q.queue.put({ hash: 'q3', body: 'b3' });
  const all = W.q.queue.all();
  return (a === 1 && b === 10 && c === 11 && all.map(function (r) { return r.hash; }).join(',') === 'q1,q2,q3' &&
    all[0].relayUrl === 'wss://r' && all[0].toKey === 'K' && all[0].bytes === 2 && all[0].atWall === 5 && all[0].untilWall === 9) || false;
}, test.limit.quick);
test.run('a second put of the same hash changes only its attempts and untilWall', 0.8, function () {
  W.q.queue.put({ hash: 'q1', body: 'CHANGED', relayUrl: 'wss://other', attempts: 3, untilWall: 99 });
  const r = W.q.queue.all()[0] || {};
  return (W.q.queue.all().length === 3 && r.body === 'b1' && r.relayUrl === 'wss://r' && r.seq === 1 && r.attempts === 3 && r.untilWall === 99) || false;
}, test.limit.quick);
test.run('attempts writes the count, and del says whether the row was there', 0.4, function () {
  W.q.queue.attempts('q2', 7);
  const r = W.q.queue.all().filter(function (x) { return x.hash === 'q2'; })[0] || {};
  return (r.attempts === 7 && W.q.queue.del('q2') === true && W.q.queue.del('q2') === false && W.q.queue.all().length === 2) || false;
}, test.limit.quick);
test.run('a backoff is one row per relay and recipient, a second put replacing it, del taking it', 0.4, function () {
  W.q.backoff.put('wss://r', 'K', 100, 10);
  W.q.backoff.put('wss://r', 'K', 200, 20);
  W.q.backoff.put('wss://r', 'L', 300, 30);
  const all = W.q.backoff.all();
  const k = all.filter(function (x) { return x.toKey === 'K'; })[0] || {};
  W.q.backoff.del('wss://r', 'L');
  return (all.length === 2 && k.untilWall === 200 && k.lastWait === 20 && W.q.backoff.all().length === 1) || false;
}, test.limit.quick);
test.run('reading the backoffs at a time first drops the ones that ran out by then', 0.4, function () {
  W.q.backoff.put('wss://r', 'M', 500, 1);
  const at200 = W.q.backoff.all(200).map(function (x) { return x.toKey; }).join(',');
  return (at200 === 'M' && W.q.backoff.all().length === 1) || false;
}, test.limit.quick);

// ── auth ──
test.run('a grant under a name writes the name as the row\'s myLabel, and has, paths and knownPath see it', 0.4, function () {
  W.a = nodeStore.open(home());
  W.a.auth.grant('P1', 'fs/read', 'Pat');
  W.a.auth.grant('P1', 'desk/post');
  return (W.a.auth.has('P1', 'fs/read') && !W.a.auth.has('P1', 'fs/write') && W.a.auth.paths('P1').join(',') === 'desk/post,fs/read' &&
    W.a.auth.knownPath('desk/post') && !W.a.auth.knownPath('nope') && (W.a.seen.get('P1') || {}).myLabel === 'Pat') || false;
}, test.limit.quick);
test.run('a grant under a name never overwrites the name the owner gave', 0.8, function () {
  W.a.seen.set('P2', { myLabel: 'Owner name' });
  W.a.auth.grant('P2', 'fs/read', 'Other name');
  return (W.a.seen.get('P2') || {}).myLabel === 'Owner name' || false;
}, test.limit.quick);
test.run('a second grant of the same pair throws and leaves one', 0.4, function () {
  let threw = false;
  try { W.a.auth.grant('P1', 'fs/read', 'Again'); } catch (e) { threw = true; }
  return (threw && W.a.auth.paths('P1').length === 2 && (W.a.seen.get('P1') || {}).myLabel === 'Pat') || false;
}, test.limit.quick);
test.run('label is null with no grant, else myLabel, else the label the ID gave, else nothing', 0.4, function () {
  W.a.seen.put('P3', { label: 'Self named', seen: 1 });
  W.a.auth.grant('P3', 'x');
  W.a.auth.grant('P4', 'x');
  return (W.a.auth.label('NOGRANT') === null && W.a.auth.label('P1') === 'Pat' && W.a.auth.label('P3') === 'Self named' &&
    W.a.auth.label('P4') === '') || false;
}, test.limit.quick);
test.run('peer and all answer the grants with their names', 0.4, function () {
  const p = W.a.auth.peer('P1');
  const all = Array.from(W.a.auth.all());
  return (p.length === 2 && p[0].key === 'P1' && p[0].label === 'Pat' && p[0].path === 'desk/post' && all.length === 5 &&
    all.every(function (r) { return typeof r.key === 'string' && typeof r.label === 'string' && typeof r.path === 'string'; })) || false;
}, test.limit.quick);
test.run('revoke says whether the grant went, and relabel refuses a key with no grant', 0.4, function () {
  const a = W.a.auth.revoke('P4', 'x');
  const b = W.a.auth.revoke('P4', 'x');
  const c = W.a.auth.relabel('P4', 'New');
  const d = W.a.auth.relabel('P1', 'Patricia');
  return (a === true && b === false && c === false && W.a.seen.get('P4') === null && d === true &&
    W.a.auth.label('P1') === 'Patricia') || false;
}, test.limit.quick);

// ── bundles and branches ──
test.run('a bundle is added with a number id, owner node when not given, and read back in label order', 0.4, function () {
  W.b1 = W.a.bundles.add('zeta');
  W.b2 = W.a.bundles.add('alpha', 'myServer');
  const all = W.a.bundles.all();
  return (typeof W.b1 === 'number' && W.b2 > W.b1 && JSON.stringify(W.a.bundles.get(W.b1)) === JSON.stringify({ id: W.b1, label: 'zeta', owner: 'node' }) &&
    all.map(function (b) { return b.label; }).join(',') === 'alpha,zeta' && all[0].owner === 'myServer' && W.a.bundles.get(999) === null) || false;
}, test.limit.quick);
test.run('a bundle is renamed by set, which says whether it was there', 0.4, function () {
  return (W.a.bundles.set(W.b1, 'eta') === true && W.a.bundles.get(W.b1).label === 'eta' && W.a.bundles.set(999, 'x') === false) || false;
}, test.limit.quick);
test.run('branches are added, read, changed and deleted by id', 0.4, function () {
  W.r1 = W.a.branches.add(W.b1, 'fs', '');
  W.r2 = W.a.branches.add(W.b1, 'desk', 'post');
  W.r3 = W.a.branches.add(W.b2, 'fs', 'read');
  const g = W.a.branches.get(W.r2) || {};
  const set = W.a.branches.set(W.r2, 'desk', 'take');
  const del = W.a.branches.del(W.r3);
  return (g.bundle === W.b1 && g.family === 'desk' && g.verb === 'post' && set === true && W.a.branches.get(W.r2).verb === 'take' &&
    del === true && W.a.branches.get(W.r3) === null && W.a.branches.del(W.r3) === false && W.a.branches.all().length === 2) || false;
}, test.limit.quick);
test.run('same finds another branch of the bundle naming the same family and verb, the branch itself left out', 0.4, function () {
  return (W.a.branches.same(W.b1, 'fs', '', 0) === true && W.a.branches.same(W.b1, 'fs', '', W.r1) === false &&
    W.a.branches.same(W.b2, 'fs', '', 0) === false) || false;
}, test.limit.quick);
test.run('deleting a bundle takes every branch that names it', 0.8, function () {
  W.a.branches.add(W.b2, 'fs', 'list');
  const gone = W.a.bundles.del(W.b1);
  const left = W.a.branches.all();
  return (gone === true && W.a.bundles.get(W.b1) === null && left.length === 1 && left[0].bundle === W.b2 && W.a.bundles.del(W.b1) === false) || false;
}, test.limit.quick);

// ── transaction ──
test.run('a transaction answers what its function answers and keeps its writes', 0.4, function () {
  const out = W.a.transaction(function () { W.a.seen.set('TX1', { keep: true }); return 42; });
  return (out === 42 && !!(W.a.seen.get('TX1') || {}).keep) || false;
}, test.limit.quick);
test.run('a transaction whose function throws keeps none of its writes', 0.8, function () {
  let threw = false;
  try {
    W.a.transaction(function () { W.a.seen.set('TX2', { keep: true }); W.a.auth.grant('TX2', 'p'); throw new Error('x'); });
  } catch (e) { threw = true; }
  return (threw && W.a.seen.get('TX2') === null && !W.a.auth.has('TX2', 'p')) || false;
}, test.limit.quick);

test.after(function () {
  [W.s, W.sh, W.t, W.r, W.q, W.a].forEach(function (s) { if (s) s.close(); });
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
