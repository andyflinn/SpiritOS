'use strict';

// spirit/test/labHome.js
// A FIXTURE NODE THE labMaster STARTS NEVER WRITES INTO THE REAL HOME —
// found verifying desk/G1.7, written FIRST, red on today's code.
//
//   testHome.js holds the suites' own nodes. The lab suites ask the
//   labMaster instead, and it spawns their nodes with its own environment:
//   runAll starts it without testSupport, and on Andy's box it is his
//   long-running one, so its fixture nodes (alfa, bravo, charlie, asbowner)
//   backed up into the real ~/.SpiritOS on both machines.
//
// THE CONTRACT (claude-windows' fix, wsl-claude's test): labMaster.startNode
// gives a node whose home is under the fixture root a HOME and USERPROFILE
// inside its own folder, wiped with it; Andy's own and lab nodes keep the
// real home. So a fixture node's backup lands under the fixture root, and
// nothing of it under the real home (read from os.userInfo, not HOME).
// A labMaster already running picks the fix up only once restarted.

const os = require('os');
const REAL = os.userInfo().homedir;
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const test = require('./testSupport.js');
const lab = require('./labMaster/ensureMaster.js');
const { MASTER, FIXTURE_ROOT } = require('./labMaster/labPaths');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by the labMaster (desk/G1.7 finding): ';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// A lab port the labMaster accepts (65400-65429 but 65420) and no lane of
// runAll uses (they take 65410-65419 and 65425-65428): the first free of
// 65400-65409.
function isFree(port) {
  return new Promise(function (resolve) {
    const s = net.createServer();
    s.once('error', function () { resolve(false); });
    s.listen(port, '127.0.0.1', function () { s.close(function () { resolve(true); }); });
  });
}
// Free both ways: no socket on it, and no row of the labMaster's table
// holding it. A stopped row keeps its port (claude-windows, on Andy's box:
// jazz, sonny, claude and rock hold 65400-65405 while stopped).
async function freePort() {
  const listed = await master('GET', '/api/nodes');
  const held = ((listed.body && listed.body.nodes) || []).map(function (n) { return Number(n.port); });
  for (let p = 65400; p <= 65409; p++) if (held.indexOf(p) === -1 && await isFree(p)) return p;
  return 0;
}
// THROUGH THE ONE DOOR (oneDoor.js): relayRequest, never fetch.
async function master(method, pathname, body) {
  const r = await relayRequest(MASTER, method, pathname, body || null);
  let b = null;
  try { b = JSON.parse(r.text); } catch (e) { b = null; }
  return { status: r.status, body: b };
}
// Every folder under `dir` whose node.json names `tag`'s node, as paths.
function copiesUnder(dir, tag) {
  const found = [];
  (function walk(d, depth) {
    if (depth > 8) return;
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) {
      if (!e.isDirectory()) return;
      const p = path.join(d, e.name);
      if (e.name === tag && path.basename(d) === 'backups') found.push(p);
      else walk(p, depth + 1);
    });
  })(dir, 0);
  return found;
}

test.startTest('A fixture node the labMaster starts never writes into the real home');

(async function () {
  const up = await lab.ensure();
  if (!up.ok) { test.fail('no labMaster: ' + up.error); return; }
  const id = 'homeprobe-' + crypto.randomBytes(3).toString('hex');
  const port = await freePort();
  const made = await master('POST', '/api/nodes', { name: id, type: 'avatar', port: port, kind: 'fixture' });
  const home = path.join(FIXTURE_ROOT, id, 'spirit', 'run');
  // It backs up only if it includes the backup (slim/G1.3 T6), listed
  // before it starts.
  if (made.status === 200 || made.status === 201) require('../run/js/includeList.js').add(home, 'process/js/backup');
  const started = made.status === 200 || made.status === 201 ? await master('POST', '/api/nodes/' + id + '/start') : made;
  if (started.status !== 200) test.fail('the labMaster would not start the probe: ' + JSON.stringify(started.body));
  let tag = '';
  for (let i = 0; i < 80 && !tag; i++) {
    await sleep(250);
    try { tag = crypto.createHash('sha256').update(JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'identity.json'), 'utf8')).publicKey).digest('hex').slice(0, 12); } catch (e) { tag = ''; }
  }
  const realCopy = path.join(REAL, '.SpiritOS', 'backups', tag || 'none');
  let inFixture = [];
  for (let i = 0; i < 60 && tag && !fs.existsSync(realCopy) && !inFixture.length; i++) { await sleep(250); inFixture = copiesUnder(path.join(FIXTURE_ROOT, id), tag); }
  const leaked = !!tag && fs.existsSync(realCopy);
  // Never leave it there, red or green, and never leave the probe node.
  if (leaked) { try { fs.rmSync(realCopy, { recursive: true, force: true }); } catch (e) { /* reported below */ } }
  await master('POST', '/api/nodes/' + id + '/stop');
  await master('POST', '/api/nodes/' + id + '/delete');

  test.subHeading('A fixture node backs up inside its own folder under the fixture root, never into the real home');
  if (started.status === 200 && tag && !leaked && inFixture.length) test.check('its copy is at ' + path.relative(FIXTURE_ROOT, inFixture[0]) + ', and nothing of it in the real home');
  else test.fail(OWED + 'started ' + started.status + ', key read ' + !!tag + ', copy in the real home ' + leaked + (leaked ? ' (removed)' : '') + ', under the fixture root ' + JSON.stringify(inFixture) + ', in this suite\'s home ' + fs.existsSync(path.join(os.homedir(), '.SpiritOS', 'backups', tag || 'none')));
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  lab.stop();
  test.reportSuccessFailureCount();
  process.exit(0);
});
