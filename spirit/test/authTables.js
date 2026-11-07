'use strict';

// spirit/test/authTables.js
// goal/G43.23, restored from 885f1ab5^ on today's harness (Andy's box: bring back "the grant tables"). apiAuth/G1.3:
// where the allow-table lives, node.db.
//   grants(peer_id, path) with PRIMARY KEY (peer_id, path), made by nodeStore.js (CREATE TABLE IF NOT EXISTS grants), in
//   node.db and nowhere else. There is no peers table (goal/G40.11): the name a grant shows is the ID's row in seen, the
//   one table, and a last revoke takes the access, not the row. And "the peer never sees our apiAuth data": the tree a
//   member's packet and the owner's verb api both read (the flat apiDoor) answers nothing of either table.
// The auth family's verb shapes are spirit/test/jobsAuth.js's; this suite plants rows through them and looks at the DISK
// and the MEMBER SURFACE. A scratch node on a copy of the tracked files (spirit/run/test/headLessChrome.js scratchNode),
// the desk server on at home so a grant has a served path; asked as the owner at its own loopback door. Never Andy's
// node nor an agent's. Its contact (alice) is planted by the owner's contact verbs, since no node reads contacts.json.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const RUN = path.join(__dirname, '..', 'run');
const { scratchNode, sleep, until, freePort } = require(path.join(RUN, 'test', 'headLessChrome.js'));
const relayAuth = require(path.join(RUN, 'spirit', 'relayAuth.js'));

const KEYA = relayAuth.generateIdentity('authTablesA').publicKey;
const KEYB = relayAuth.generateIdentity('authTablesB').publicKey;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('apiAuth/G1.3: the allow-table is the grants table in node.db, and no peer ever sees it');

let N = null;
let child = null;
let base = '';
function post(call, args) {
  return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.text().then(function (t) { let body = {}; try { body = JSON.parse(t); } catch (e) { body = {}; } return { status: r.status, body: body || {} }; }); },
      function () { return { status: 0, body: {} }; });
}
const deskServed = function () { return post('api', {}).then(function (r) { return !!(r.body && r.body.desk && r.body.desk.ok !== false); }); };
// The same scratch tree booted again on a new port, as scratchNode boots it.
async function reboot() {
  const port = await freePort();
  child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: path.join(N.root, 'spirit', 'run'), stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port;
  return until(deskServed, 60000);
}
function down() {
  return new Promise(function (resolve) {
    if (!child) return resolve();
    const c = child;
    child = null;
    c.on('exit', function () { setTimeout(resolve, 300); });
    try { c.kill(); } catch (e) { /* gone */ }
    // Under harness load a node can take a while to die; reading node.db before it does finds the WAL half-checkpointed.
    setTimeout(resolve, 8000);
  });
}
// The node is dead when this reads, so the handle is the only one; one retry for the moment the exit raced the checkpoint.
async function readDb(fn) {
  const { DatabaseSync } = require('node:sqlite');
  const file = path.join(N.root, 'spirit', 'run', 'spirit', 'state', 'node.db');
  for (let i = 0; ; i++) {
    try {
      const db = new DatabaseSync(file);
      try { return fn(db); } finally { db.close(); }
    } catch (e) {
      if (i >= 2) throw e;
      await sleep(1000);
    }
  }
}

(async function () {
  N = await scratchNode({ servers: ['desk'] });
  child = N.child;
  base = N.base;
  if (!N.up || !N.root || !(await until(deskServed, 60000))) { test.fail('the world: the scratch node did not come up serving desk: nothing judged'); return; }

  // ALICE, ON HER ROW OF THE ONE TABLE, KEPT: the owner's own contact verbs (a block makes the row, the label names it,
  // accept keeps it).
  await post('contact.block', { publicKey: KEYA, publicLabel: '' });
  await post('contact.unblock', { publicKey: KEYA });
  await post('contact.label', { publicKey: KEYA, myLabel: 'alice' });
  const kept = await post('contact.accept', { publicKey: KEYA });
  if (!(kept.status === 200 && kept.body.keep === true)) { test.fail('the world: alice could not be planted: ' + kept.status + ' ' + short(kept.body) + ': nothing judged'); return; }
  for (const g of [{ key: KEYA, path: 'desk' }, { key: KEYA, path: 'desk.chat.add' }, { key: KEYB, path: 'desk' }]) {
    const r = await post('auth.grant', g);
    if (r.status !== 200) { test.fail('the world: auth.grant ' + short(g) + ' answered ' + r.status + ' ' + short(r.body) + ': nothing judged'); return; }
  }

  test.subHeading('the member surface answers none of it');
  const tree = await post('api', {});
  const treeText = JSON.stringify(tree.body);
  if (tree.status === 200 && treeText.indexOf(KEYA) === -1 && treeText.indexOf(KEYB) === -1 && treeText.indexOf('alice') === -1) {
    test.check('the api tree (the same answer a member\'s packet gets, apiDoor) carries no key and no label');
  } else test.fail('the api tree leaks the table: ' + tree.status + ' ' + treeText.slice(0, 220));
  // auth is a node family of its own since goal/G30.6: the owner asks it by name on the loopback door; a member reaches
  // it only through the grant gate.
  const reach = await post('auth.query', { key: KEYA, path: 'desk' });
  if (reach.status === 200 && reach.body.allowed === true) {
    test.check('the owner\'s auth.query on the loopback door answers the table (allowed: true for the planted grant)');
  } else test.fail('auth.query answered ' + reach.status + ' ' + short(reach.body));

  // ON DISK (goal/G40.11, box v24: "the peers table move[s] into" the one table; "The grants table stays its own, keyed
  // by ID").
  test.subHeading('on disk: the grants table, and the name on the ID\'s row of the one table');
  await down();
  try {
    const seen = await readDb(function (db) {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('peers', 'grants', 'seen') ORDER BY name").all().map(function (r) { return r.name; });
      const grantsCols = names.indexOf('grants') !== -1 ? db.prepare('PRAGMA table_info(grants)').all() : [];
      const grants = names.indexOf('grants') !== -1 ? db.prepare('SELECT peer_id, path FROM grants ORDER BY peer_id, path').all() : [];
      const a = names.indexOf('seen') !== -1 ? db.prepare('SELECT myLabel, keep FROM seen WHERE publicKey = ?').get(KEYA) : null;
      return { names: names, grantsCols: grantsCols, grants: grants, a: a || null };
    });
    if (seen.names.indexOf('grants') !== -1 && seen.names.indexOf('peers') === -1) test.check('node.db holds grants and no peers table');
    else test.fail('node.db holds ' + short(seen.names) + ', not grants alone');
    const col = function (cols, name) { return cols.filter(function (c) { return c.name === name; })[0] || {}; };
    if (col(seen.grantsCols, 'peer_id').pk >= 1 && col(seen.grantsCols, 'path').pk >= 1) {
      test.check('grants(peer_id, path) PRIMARY KEY (peer_id, path): the double key refuses a duplicate row');
    } else test.fail('the columns: grants ' + short(seen.grantsCols));
    if (seen.grants.length === 3 && seen.a && seen.a.myLabel === 'alice' && seen.a.keep === 1) {
      test.check('one grants row per grant, and the name is alice, on her row of the one table, kept');
    } else test.fail('the rows: grants ' + short(seen.grants) + ', her row ' + short(seen.a));
  } catch (e) {
    test.fail('node.db could not be read: ' + e.message);
  }

  test.subHeading('the rows survive a restart, and the last revoke takes the grants and leaves the row');
  if (!(await reboot())) { test.fail('the node did not boot again serving desk'); return; }
  const after = (await post('auth.query', { key: KEYA, path: 'desk.chat.add' })).body;
  if (after.allowed === true) test.check('a grant made before the restart still answers after it');
  else test.fail('after a restart the grant answered ' + short(after));
  await post('auth.revoke', { key: KEYA, path: 'desk' });
  await post('auth.revoke', { key: KEYA, path: 'desk.chat.add' });
  const gone = (await post('auth.peer', { key: KEYA })).body;
  const still = (await post('auth.peer', { key: KEYB })).body;
  await down();
  try {
    const left = await readDb(function (db) {
      return {
        grants: db.prepare('SELECT peer_id FROM grants ORDER BY peer_id').all().map(function (r) { return r.peer_id; }),
        a: db.prepare('SELECT publicKey FROM seen WHERE publicKey = ?').get(KEYA) || null,
      };
    });
    if (Array.isArray(gone.records) && gone.records.length === 0 && (still.records || []).length === 1 && left.grants.length === 1 && left.grants[0] === KEYB && left.a) {
      test.check('KEYA\'s last revoke took its access, its row in the one table stays; KEYB\'s grant stands');
    } else test.fail('after the revokes: ' + short({ gone: gone, grants: left.grants, a: left.a }));
  } catch (e) {
    test.fail('node.db could not be read after the revokes: ' + e.message);
  }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  await down();
  await sleep(300);
  try { if (N && N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});
