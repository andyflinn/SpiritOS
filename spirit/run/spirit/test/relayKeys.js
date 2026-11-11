'use strict';

// spirit/run/spirit/test/relayKeys.js
// The tests of spirit/relayKeys.js, and of no other module, in this one file (spec: ./relayKeys.md). Its sections: no
// importOld on a booted node (goal/G43.23, item 7), after its own. This file holds goal/G41.30: a relay's
// report never sets the star (Andy: "NO signature. just the armingButton, with a precise documentation of the risk.";
// "so this button will put the star on relays and puppets. AND take it away."). A relay's report is that relay's own
// word; only the button, at home, sets or takes the star. On a scratch folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const relayKeys = require(path.join(RUN, 'spirit', 'relayKeys.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));
const { spawn, execSync } = require('child_process');
const REPO = path.join(RUN, '..', '..');
const { freePort, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const { DatabaseSync } = require('node:sqlite');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }

const URL_A = 'https://says-i-own-it.example';
const KEY_A = 'MCowBQYDK2VwAyEAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEY=';
const URL_B = 'https://starred.example';
const KEY_B = 'MCowBQYDK2VwAyEAKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEY=';
const W = { home: null, a: null, b: null, root: null, child: null, run: null, nodeDb: null, up: false };

// a report from a relay calling this node its owner
test.run('a relay row is there to report on', 0.2, function () {
  W.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaykeys-'));
  return relayKeys.accept(W.home, URL_A, KEY_A) === true || 'the relay row could not be made';
}, test.limit.quick);
test.run('it notes the seat the relay says this node holds', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  relayKeys.ownerSeat(W.home, URL_A, 'andy');
  W.a = nodeStore.open(W.home).seen.get(KEY_A) || {};
  return !!W.a.seated || 'after the report: ' + short(W.a);
}, test.limit.quick);
// A relay that could set the star by its own report would be trusted on its own word: 0.8.
test.run('and sets no star: a report is the relay\'s own word, and any relay can say it', 0.8, function () {
  if (!W.a) return 'no report made: the world failed';
  return !W.a.mine || 'the report set the star: ' + short(W.a);
}, test.limit.quick);

// a star already on a row
test.run('a report takes no star away either', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  relayKeys.accept(W.home, URL_B, KEY_B);
  nodeStore.open(W.home).seen.set(KEY_B, { mine: true });
  relayKeys.ownerSeat(W.home, URL_B, 'andy');
  W.b = nodeStore.open(W.home).seen.get(KEY_B) || {};
  return !!W.b.mine || 'after the report: ' + short(W.b);
}, test.limit.quick);
test.run('and still notes the seat', 0.2, function () {
  if (!W.b) return 'no report made: the world failed';
  return !!W.b.seated || 'after the report: ' + short(W.b);
}, test.limit.quick);

// ── THE NO RESCUE PART ──
// NO relayKeys importOld ON A BOOTED NODE (goal/G43.23, item 7; spec: ./relayKeys.md, its section). The box: "old-data rescue still
// runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db
// owner column." This section holds relayKeys' part: a real node (spirit/server.js) booted on a scratch copy of the tracked files
// of spirit/run, spirit/state/relays.json and relayKeys.json planted, and node.db takes neither in. Neither Andy's node nor an
// agent's is touched. shellMove is ./shellMove-noRescue.js, the traffic log ./trafficLog.js, the relay store
// ./relayStore.js.

// noRescue: on a scratch node, relayKeys importOld takes no old relay file in (goal/G43.23, item 7)
const RURL = 'https://rescue-' + process.pid + '.example';
const RKEY = 'rescue-relay-key-' + process.pid;
const relaysText = JSON.stringify([{ url: RURL, label: 'rescue relay' }]);
const keysText = JSON.stringify({ [RURL]: { publicKey: RKEY, acceptedAt: '2026-01-01T00:00:00.000Z' } });
test.run('the world: spirit/state/relays.json and relayKeys.json planted in a scratch copy of the tracked files', 0.2, function () {
  W.root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-keys-'));
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  files.forEach(function (f) { const d = path.join(W.root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  W.run = path.join(W.root, 'spirit', 'run');
  put(path.join(W.run, 'spirit', 'state', 'relays.json'), relaysText);
  put(path.join(W.run, 'spirit', 'state', 'relayKeys.json'), keysText);
  return (readText(path.join(W.run, 'spirit', 'state', 'relays.json')) === relaysText && readText(path.join(W.run, 'spirit', 'state', 'relayKeys.json')) === keysText) ||
    'the scratch tree was not planted: nothing judged';
}, test.limit.quick);
test.run('the world: the scratch node came up', 0.2, async function () {
  if (!W.run) return 'no scratch tree: the world failed';
  const port = await freePort();
  W.child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: W.run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  W.up = !!(await until(function () {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
  }, 60000));
  return W.up || 'the scratch node at ' + base + ' did not come up in 60 s: nothing judged';
}, test.limit.slow);
test.run('the world: the scratch node opened its node.db', 0.2, async function () {
  if (!W.up) return 'no scratch node: the world failed';
  // What boot does it has done by now; a few seconds more for anything that follows the first answer.
  await sleep(3000);
  W.nodeDb = path.join(W.run, 'spirit', 'state', 'node.db');
  return fs.existsSync(W.nodeDb) || 'the scratch node wrote no node.db: the relay table cannot be judged';
}, test.limit.slow);

// The box: "relayKeys importOld" (relays.json and relayKeys.json into the one relay table)
test.run('node.db holds no row and no route of the planted relay', 0.2, function () {
  if (!W.nodeDb || !fs.existsSync(W.nodeDb)) return 'no node.db: the world failed';
  let routes = [];
  let rows = [];
  try {
    const db = new DatabaseSync(W.nodeDb, { readOnly: true });
    try {
      routes = db.prepare('SELECT publicKey, url FROM seen_routes WHERE url = ? OR publicKey = ?').all(RURL, RKEY);
      rows = db.prepare('SELECT publicKey FROM seen WHERE publicKey = ?').all(RKEY);
    } finally { db.close(); }
  } catch (e) { routes = [{ error: String(e.message || e) }]; }
  return (routes.length === 0 && rows.length === 0) || 'the boot took the planted relay into node.db: ' + short({ routes: routes, rows: rows });
}, test.limit.quick);
test.run('spirit/state/relays.json and relayKeys.json are left as they were', 0.2, function () {
  if (!W.up) return 'no scratch node: the world failed';
  const run = W.run;
  const filesStay = readText(path.join(run, 'spirit', 'state', 'relays.json')) === relaysText && readText(path.join(run, 'spirit', 'state', 'relayKeys.json')) === keysText;
  return filesStay || 'the boot removed or changed the old files: relays.json ' + (fs.existsSync(path.join(run, 'spirit', 'state', 'relays.json')) ? 'there' : 'gone') + ', relayKeys.json ' + (fs.existsSync(path.join(run, 'spirit', 'state', 'relayKeys.json')) ? 'there' : 'gone');
}, test.limit.quick);

test.after(async function () {
  if (W.home) { try { fs.rmSync(W.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  try { if (W.child) W.child.kill(); } catch (e) { /* gone */ }
  await sleep(500);
  if (W.root) { try { fs.rmSync(W.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
});
