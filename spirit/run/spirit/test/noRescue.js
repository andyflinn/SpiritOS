'use strict';

// spirit/run/spirit/test/noRescue.js
// NO OLD-DATA RESCUE RUNS (goal/G43.23, item 7; spec: ./noRescue.md). The box: "old-data rescue still runs (G41.30):
// relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner
// column." Each old file is planted in a scratch tree under /tmp and the code that would take it in is run as it runs:
// a real node (spirit/server.js) booted on a scratch copy of the tracked files of spirit/run, for shellMove and the
// relays.json / relayKeys.json move; this tree's trafficLog.js and relayStore.js opened in-process on scratch roots, for
// traffic.json and the relay's files. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
const { DatabaseSync } = require('node:sqlite');

test.startTest('noRescue.js: on a scratch node and scratch roots, no old-data rescue moves an old file in (goal/G43.23, item 7)');

// ── A REAL NODE BOOTED ON A SCRATCH TREE: shellMove and relayKeys.importOld ──
async function bootChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-node-'));
  let child = null;
  try {
    const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
    files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    const run = path.join(root, 'spirit', 'run');
    const LEFT = 'left in app/ ' + process.pid;
    const FACE = 'a face state in app-state/ ' + process.pid;
    const RURL = 'https://rescue-' + process.pid + '.example';
    const RKEY = 'rescue-relay-key-' + process.pid;
    put(path.join(run, 'app', 'rescueLeft', 'left.txt'), LEFT);
    put(path.join(run, 'app-state', 'rescueFace', 'state.json'), JSON.stringify({ mark: FACE }));
    const relaysText = JSON.stringify([{ url: RURL, label: 'rescue relay' }]);
    const keysText = JSON.stringify({ [RURL]: { publicKey: RKEY, acceptedAt: '2026-01-01T00:00:00.000Z' } });
    put(path.join(run, 'spirit', 'state', 'relays.json'), relaysText);
    put(path.join(run, 'spirit', 'state', 'relayKeys.json'), keysText);
    ok(readText(path.join(run, 'app', 'rescueLeft', 'left.txt')) === LEFT && readText(path.join(run, 'app-state', 'rescueFace', 'state.json')).indexOf(FACE) !== -1
      && readText(path.join(run, 'spirit', 'state', 'relays.json')) === relaysText && readText(path.join(run, 'spirit', 'state', 'relayKeys.json')) === keysText,
      'the world: app/rescueLeft/left.txt, app-state/rescueFace/, spirit/state/relays.json and relayKeys.json planted in a scratch copy of ' + files.length + ' tracked files',
      'the scratch tree was not planted: nothing judged');

    const port = await freePort();
    child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () {
      return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
    }, 60000);
    ok(!!up, 'the world: the scratch node came up at ' + base, 'the scratch node did not come up in 60 s: nothing judged');
    if (!up) return;
    // What boot does it has done by now; a few seconds more for anything that follows the first answer.
    await sleep(3000);
    const nodeDb = path.join(run, 'spirit', 'state', 'node.db');
    ok(fs.existsSync(nodeDb), 'the world: the scratch node opened its node.db', 'the scratch node wrote no node.db: the relay table cannot be judged');

    test.subHeading('The box: "shellMove" (moveLeftovers: app/ into shell/; moveAppState: app-state/ into relay-state/process/)');
    const leftStays = readText(path.join(run, 'app', 'rescueLeft', 'left.txt')) === LEFT;
    const leftMoved = fs.existsSync(path.join(run, 'shell', 'rescueLeft', 'left.txt'));
    ok(leftStays && !leftMoved, 'app/rescueLeft/left.txt is left where it lay; nothing moved it into shell/',
      'the boot moved app/ in: app/rescueLeft/left.txt ' + (leftStays ? 'still there' : 'gone') + ', shell/rescueLeft/left.txt ' + (leftMoved ? 'written' : 'absent'));
    const faceStays = readText(path.join(run, 'app-state', 'rescueFace', 'state.json')).indexOf(FACE) !== -1;
    const faceMoved = fs.existsSync(path.join(run, 'relay-state', 'process', 'rescueFace')) || fs.existsSync(path.join(run, 'spirit', 'state', 'rescueFace'));
    ok(faceStays && !faceMoved, 'app-state/rescueFace/ is left where it lay; nothing moved it into relay-state/process/ or spirit/state/',
      'the boot moved app-state/ in: app-state/rescueFace/state.json ' + (faceStays ? 'still there' : 'gone') + ', relay-state/process/rescueFace ' + (faceMoved ? 'written' : 'absent'));

    test.subHeading('The box: "relayKeys importOld" (relays.json and relayKeys.json into the one relay table)');
    let routes = [];
    let rows = [];
    try {
      const db = new DatabaseSync(nodeDb, { readOnly: true });
      try {
        routes = db.prepare('SELECT publicKey, url FROM seen_routes WHERE url = ? OR publicKey = ?').all(RURL, RKEY);
        rows = db.prepare('SELECT publicKey FROM seen WHERE publicKey = ?').all(RKEY);
      } finally { db.close(); }
    } catch (e) { routes = [{ error: String(e.message || e) }]; }
    ok(routes.length === 0 && rows.length === 0, 'node.db holds no row and no route of the planted relay ' + RURL,
      'the boot took the planted relay into node.db: ' + short({ routes: routes, rows: rows }));
    const filesStay = readText(path.join(run, 'spirit', 'state', 'relays.json')) === relaysText && readText(path.join(run, 'spirit', 'state', 'relayKeys.json')) === keysText;
    ok(filesStay, 'spirit/state/relays.json and relayKeys.json are left as they were',
      'the boot removed or changed the old files: relays.json ' + (fs.existsSync(path.join(run, 'spirit', 'state', 'relays.json')) ? 'there' : 'gone') + ', relayKeys.json ' + (fs.existsSync(path.join(run, 'spirit', 'state', 'relayKeys.json')) ? 'there' : 'gone'));
  } finally {
    try { if (child) child.kill(); } catch (e) { /* gone */ }
    await sleep(500);
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

// ── THE NODE'S TRAFFIC LOG ON A SCRATCH ROOT: the old traffic.json ──
function trafficChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-traffic-'));
  try {
    test.subHeading('The box: "the old traffic.json"');
    const OLD = 'rescue-traffic-hash-' + process.pid;
    const NEW = 'world-traffic-hash-' + process.pid;
    put(path.join(root, 'spirit', 'state', 'traffic.json'), JSON.stringify({ entries: [{ at: '2026-01-01T00:00:00.000Z', dir: 'in', kind: 'message', peer: 'old', relay: '', hash: OLD, outcome: 'delivered' }] }));
    const trafficLog = require(path.join(RUN, 'spirit', 'trafficLog.js'));
    const log = trafficLog.createTrafficLog({ rootDir: root });
    const before = log.read();
    ok(!before.some(function (r) { return r && r.hash === OLD; }), 'the log does not read the planted spirit/state/traffic.json (' + before.length + ' rows)',
      'the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers');
    log.note({ dir: 'in', kind: 'message', peer: 'world', hash: NEW, outcome: 'delivered' });
    const after = log.read();
    ok(after.some(function (r) { return r && r.hash === NEW; }), 'the world: a row noted on this scratch log is read back',
      'a row noted on this scratch log is not read back: the log read nothing, nothing judged (' + short(after) + ')');
    ok(!after.some(function (r) { return r && r.hash === OLD; }), 'with node.db written, the planted traffic.json is still not read',
      'with node.db written, the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers');
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

// ── THE RELAY'S STORE ON SCRATCH ROOTS: routingTable.json, invites.json, the owner column ──
function relayChecks() {
  const relayStore = require(path.join(RUN, 'spirit', 'relayStore.js'));
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-relay-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-owner-'));
  try {
    test.subHeading('The box: "routingTable.json, invites.json"');
    const KEY = 'rescue-member-key-' + process.pid;
    const TOKEN = 'rescue-invite-token-' + process.pid;
    const roll = path.join(a, 'spirit', 'state', 'routingTable.json');
    const inv = path.join(a, 'spirit', 'state', 'invites.json');
    const rollText = JSON.stringify({ peers: { [KEY]: { publicKey: KEY, name: 'old member', claimedAt: '2026-01-01T00:00:00.000Z' } } });
    const invText = JSON.stringify([{ token: TOKEN, label: 'old invite', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: '' }]);
    put(roll, rollText);
    put(inv, invText);
    let store = null;
    let err = '';
    try { store = relayStore.open(a); } catch (e) { err = String(e && e.message || e); }
    ok(!!store, 'the world: the relay store opens on a scratch root holding routingTable.json and invites.json', 'the relay store did not open: ' + err + '; nothing judged');
    if (store) {
      const W = 'world-member-key-' + process.pid;
      store.members.put({ publicKey: W, publicLabel: 'world', claimedAt: '' });
      ok(!!store.members.get(W), 'the world: a member put on this scratch store is read back', 'a member put on this scratch store is not read back: nothing judged');
      ok(!store.members.get(KEY), 'routingTable.json\'s member is not taken into the roll', 'the store took routingTable.json\'s member ' + KEY + ' into the roll');
      ok(!store.invites.get(TOKEN), 'invites.json\'s invite is not taken in', 'the store took invites.json\'s invite ' + TOKEN + ' in');
      ok(readText(roll) === rollText && readText(inv) === invText && !fs.existsSync(roll + '.imported') && !fs.existsSync(inv + '.imported'),
        'routingTable.json and invites.json are left as they were, neither renamed .imported',
        'the store moved the old files: ' + short({ routingTable: fs.existsSync(roll), invites: fs.existsSync(inv), rollImported: fs.existsSync(roll + '.imported'), invImported: fs.existsSync(inv + '.imported') }));
    }

    test.subHeading('The box: "the cycle-3 relay.db owner column"');
    const dbFile = path.join(b, 'spirit', 'state', 'relay.db');
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    const OWNER = 'cycle3-owner-' + process.pid;
    const MEMBER = 'cycle3-member-' + process.pid;
    let db = new DatabaseSync(dbFile);
    db.exec('PRAGMA journal_mode = DELETE');
    db.exec("CREATE TABLE members (publicKey TEXT PRIMARY KEY, publicLabel TEXT NOT NULL DEFAULT '', labelNorm TEXT NOT NULL DEFAULT '', claimedAt TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL DEFAULT '', card TEXT NOT NULL DEFAULT '', faceName TEXT NOT NULL DEFAULT '', faceEmail TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', emailVerified INTEGER NOT NULL DEFAULT 0, faceLogins TEXT NOT NULL DEFAULT '[]')");
    db.prepare('INSERT INTO members (publicKey, publicLabel, owner) VALUES (?, ?, ?)').run(MEMBER, 'cycle-3 member', OWNER);
    const had = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
    db.close();
    ok(had, 'the world: a relay.db made as cycle 3 made it, its members table with an owner column', 'the planted relay.db has no owner column: nothing judged');
    let s2 = null;
    err = '';
    try { s2 = relayStore.open(b); } catch (e) { err = String(e && e.message || e); }
    ok(!!s2 && !!s2.members.get(MEMBER), 'the world: the relay store opens that relay.db and reads its member', 'the relay store did not open that relay.db or read its member: ' + err + '; nothing judged');
    try { if (s2) s2.close(); } catch (e) { /* closed */ }
    let still = false;
    let ownerOf = '';
    try {
      db = new DatabaseSync(dbFile, { readOnly: true });
      still = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
      if (still) { const r = db.prepare('SELECT owner FROM members WHERE publicKey = ?').get(MEMBER); ownerOf = r ? String(r.owner) : ''; }
      db.close();
    } catch (e) { still = false; }
    ok(still && ownerOf === OWNER, 'the owner column is left as it was, its value kept',
      'opening the store dropped the cycle-3 owner column from members');
  } finally {
    try { relayStore.closeAll(); } catch (e) { /* closed */ }
    try { fs.rmSync(a, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(b, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

(async function () {
  await bootChecks();
  trafficChecks();
  relayChecks();
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
