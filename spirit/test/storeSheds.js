'use strict';

// spirit/test/storeSheds.js
// goal/G30.19, box v9: THE NODE STORE SHEDS. Andy, 2026-10-21: "delete all but 16 MB ... and cap in to 16 MB", "learn
// to throw out shit, or else my box is gonna grind to a hold very soon", "make sure the code doesn't allow it to grow
// anymore". Red on today's tree; claude-windows writes it and builds it (one agent).
//   - node.db never grows past 16 MB: past it, the packet log's oldest rows are deleted as new ones are written.
//   - The replay memory keeps one day, not seven.
//   - The backlog a page is handed is the untaken packets of the last day, never the whole log.
// NAMED HERE: nodeStore.MAX_DB_BYTES (16 MB), fileBytes(), store.replay.WINDOW_MS, store.traffic.untaken().
// rule/11: through testSupport only; its own scratch folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.19: ';
const RUN = path.join(__dirname, '..', 'run');
const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.19: the node store sheds, and never grows past 16 MB');

const nodeStore = require('../run/spirit/nodeStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3019-sheds-'));
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
const store = nodeStore.open(home);
function fileBytes() { return typeof store.fileBytes === "function" ? store.fileBytes() : store.seen.fileBytes(); }

test.subHeading('1. 16 MB at most, the oldest packets going first');
const cap = nodeStore.MAX_DB_BYTES;
if (cap === 16 * MB) test.check('nodeStore.MAX_DB_BYTES is 16 MB');
else test.fail(OWED + 'nodeStore.MAX_DB_BYTES is ' + short(cap));
// 24 MB of packets, 8 KB each, as a node at a packet a second writes them.
const body = 'x'.repeat(8 * 1024);
const t0 = Date.now() - 3000 * 1000;
let first = 0;
let last = 0;
let worst = 0;
for (let i = 0; i < 3000; i++) {
  const seq = store.traffic.add({ at: new Date(t0 + i * 1000).toISOString(), dir: 'in', kind: 'request', hash: 'h' + i, payload: body, admitted: true });
  if (i === 0) first = seq;
  last = seq;
  if (i % 100 === 99) worst = Math.max(worst, fileBytes());
}
const size = fileBytes();
const firstKept = store.traffic.byHash('h0').length;
const lastKept = store.traffic.byHash('h2999').length;
if (size <= 16 * MB && worst <= 16 * MB) test.check('24 MB written, the file never past 16 MB (' + (size / MB).toFixed(1) + ' MB now, ' + (worst / MB).toFixed(1) + ' at most)');
else test.fail(OWED + 'the file reached ' + (worst / MB).toFixed(1) + ' MB and is ' + (size / MB).toFixed(1) + ' MB');
if (firstKept === 0 && lastKept === 1) test.check('the oldest packet is gone, the newest kept');
else test.fail(OWED + 'oldest kept ' + firstKept + ', newest kept ' + lastKept + ' (seq ' + first + '..' + last + ')');

test.subHeading('2. the replay memory keeps one day');
if (store.replay && store.replay.WINDOW_MS === DAY) test.check('replay.WINDOW_MS is one day');
else test.fail(OWED + 'replay.WINDOW_MS is ' + short(store.replay && store.replay.WINDOW_MS));

test.subHeading('3. the backlog is the last day\'s untaken packets');
store.traffic.add({ at: new Date(Date.now() - 2 * DAY).toISOString(), dir: 'in', kind: 'request', hash: 'old-untaken', payload: 'a', admitted: true });
store.traffic.add({ at: new Date(Date.now() - 60 * 1000).toISOString(), dir: 'in', kind: 'request', hash: 'new-untaken', payload: 'b', admitted: true });
const back = store.traffic.untaken().map(function (r) { return r.hash; });
if (back.indexOf('new-untaken') !== -1 && back.indexOf('old-untaken') === -1) test.check('an untaken packet from a minute ago is handed over; one from two days ago is not');
else test.fail(OWED + 'the backlog holds ' + short(back.filter(function (h) { return /untaken/.test(h); })));

test.subHeading('4. the log is not permanent any more');
if (!/nothing is pruned at all/.test(fs.readFileSync(path.join(RUN, 'spirit', 'trafficLog.js'), 'utf8')) && /MAX_DB_BYTES/.test(code('spirit/nodeStore.js')))
  test.check('trafficLog no longer says nothing is pruned; nodeStore holds the cap');
else test.fail(OWED + 'trafficLog still says nothing is pruned, or nodeStore has no cap');

try { store.close(); } catch (e) { /* gone */ }
try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* left */ }
test.reportSuccessFailureCount();
