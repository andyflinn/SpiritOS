'use strict';

// spirit/run/spirit/test/relayKeys-noRescue.js
// NO relayKeys importOld ON A BOOTED NODE (goal/G43.23, item 7; spec: ./relayKeys-noRescue.md). The box: "old-data rescue still
// runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db
// owner column." This file holds relayKeys' part: a real node (spirit/server.js) booted on a scratch copy of the tracked files
// of spirit/run, spirit/state/relays.json and relayKeys.json planted, and node.db takes neither in. Neither Andy's node nor an
// agent's is touched. shellMove is ./shellMove-noRescue.js, the traffic log ./trafficLog-noRescue.js, the relay store
// ./relayStore-noRescue.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
const { DatabaseSync } = require('node:sqlite');

test.startTest('relayKeys-noRescue.js: on a scratch node, relayKeys importOld takes no old relay file in (goal/G43.23, item 7)');

async function bootChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-keys-'));
  let child = null;
  try {
    const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
    files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    const run = path.join(root, 'spirit', 'run');
    const RURL = 'https://rescue-' + process.pid + '.example';
    const RKEY = 'rescue-relay-key-' + process.pid;
    const relaysText = JSON.stringify([{ url: RURL, label: 'rescue relay' }]);
    const keysText = JSON.stringify({ [RURL]: { publicKey: RKEY, acceptedAt: '2026-01-01T00:00:00.000Z' } });
    put(path.join(run, 'spirit', 'state', 'relays.json'), relaysText);
    put(path.join(run, 'spirit', 'state', 'relayKeys.json'), keysText);
    ok(readText(path.join(run, 'spirit', 'state', 'relays.json')) === relaysText && readText(path.join(run, 'spirit', 'state', 'relayKeys.json')) === keysText,
      'the world: spirit/state/relays.json and relayKeys.json planted in a scratch copy of ' + files.length + ' tracked files',
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

bootChecks().then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
