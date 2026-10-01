'use strict';

// apiAuth/G1.3: where the allow-table lives — two tables in node.db.
//   The box @ version read this sitting: peers(peer_id PRIMARY KEY, label) and
//   grants(peer_id, path) with PRIMARY KEY (peer_id, path), made the way nodeStore.js
//   makes its tables (CREATE TABLE IF NOT EXISTS, nodeStore.js:212, 244-322), in
//   node.db and nowhere else.
//   A peers row lives exactly as long as its grants: Andy, on the last revoke —
//   "it disappears."
//   And "the peer never sees our apiAuth data": the one function a member's packet
//   and jobs.api share (apiDoor.answer, desk/G1 D4) must answer nothing that carries
//   either table's content.
// jobs.auth's verb shapes are jobsAuth.js's business (G1.4); this suite plants rows
// through them and looks at the DISK and the MEMBER SURFACE.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by apiAuth/G1.3: ';

const KEYA = 'MCowBQYDK2VwAyEAauthTablesTestPeerAAAAAAAAAAkeyAaa=';
const KEYB = 'MCowBQYDK2VwAyEAauthTablesTestPeerBBBBBBBBBBkeyBzz=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(200); } return fn(); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('apiAuth/G1.3: the allow-table is two tables in node.db, and no peer ever sees them');

const root = setupRelayFakes('authTables').andy;
const DB = path.join(root, 'relay-state', 'node.db');
fs.writeFileSync(path.join(root, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
// The fake's node.db survives between runs; this suite plants exact rows.
['node.db', 'node.db-wal', 'node.db-shm'].forEach(function (f) {
  try { fs.unlinkSync(path.join(root, 'relay-state', f)); } catch (e) { /* first run */ }
});
fs.writeFileSync(path.join(root, 'relay-state', 'include.json'), JSON.stringify({ modules: ['process/js/desk'] }), 'utf8');
fs.writeFileSync(path.join(root, 'relay-state', 'contacts.json'), JSON.stringify([{ publicKey: KEYA, myLabel: 'alice' }]), 'utf8');

let child = null;
let port = 0;
function post(body) {
  return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
    let j = null;
    try { j = JSON.parse(r.text); } catch (e) { j = null; }
    return { status: r.status, body: j || {} };
  }, function () { return { status: 0, body: {} }; });
}
const ask = function (verb, args) { return post(Object.assign({ verb: verb }, args || {})); };
async function boot() {
  port = await freePort();
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const up = await until(function () { return post({ verb: 'node.info' }).then(function (r) { return r.status > 0; }); }, 15000);
  const served = await until(function () { return post({ verb: 'jobs.api', ask: 'api' }).then(function (r) { return !!(r.body && r.body.desk && r.body.desk.ok !== false); }); }, 60000);
  return up && served;
}
function down() {
  return new Promise(function (resolve) {
    if (!child) return resolve();
    child.on('exit', function () { setTimeout(resolve, 200); });
    child.kill();
    // Under harness load a node can take a while to die; reading node.db
    // before it does finds the WAL half-checkpointed.
    setTimeout(resolve, 8000);
  });
}
// The node is dead when this reads, so the handle is the only one; one
// retry for the moment the exit raced the checkpoint.
async function readDb(fn) {
  const { DatabaseSync } = require('node:sqlite');
  for (let i = 0; ; i++) {
    try {
      const db = new DatabaseSync(DB);
      try { return fn(db); } finally { db.close(); }
    } catch (e) {
      if (i >= 2) throw e;
      await sleep(1000);
    }
  }
}

(async function () {
  if (!(await boot())) { test.fail('the node did not boot with the desk server included — every later check would blame the wrong thing'); throw new Error('no world'); }
  for (const g of [{ key: KEYA, path: 'desk' }, { key: KEYA, path: 'desk.chat.add' }, { key: KEYB, path: 'desk' }]) {
    await ask('jobs.authGrant', g);
  }

  test.subHeading('the member surface answers none of it');
  const tree = await post({ verb: 'jobs.api', ask: 'api' });
  const treeText = JSON.stringify(tree.body);
  if (treeText.indexOf(KEYA) === -1 && treeText.indexOf(KEYB) === -1 && treeText.indexOf('alice') === -1) {
    test.check('the api tree (the same answer a member\'s packet gets, apiDoor.answer) carries no key and no label');
  } else test.fail(OWED + 'the api tree leaks the table: ' + treeText.slice(0, 220));
  const reach = await post({ verb: 'jobs.api', ask: { auth: { query: { key: KEYA, path: 'desk' } } } });
  const reachText = JSON.stringify(reach.body);
  if (reachText.indexOf('"allowed":true') === -1 && reachText.indexOf(KEYA) === -1) {
    test.check('asking the shared surface for an app named auth answers no grant data ("the name auth is reserved")');
  } else test.fail(OWED + 'ask {auth: ...} answered grant data: ' + reachText.slice(0, 220));

  test.subHeading('on disk: two tables in node.db, shaped as decided');
  await down();
  try {
    const seen = await readDb(function (db) {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('peers', 'grants') ORDER BY name").all().map(function (r) { return r.name; });
      const peersCols = names.indexOf('peers') !== -1 ? db.prepare('PRAGMA table_info(peers)').all() : [];
      const grantsCols = names.indexOf('grants') !== -1 ? db.prepare('PRAGMA table_info(grants)').all() : [];
      const peers = names.indexOf('peers') !== -1 ? db.prepare('SELECT peer_id, label FROM peers ORDER BY peer_id').all() : [];
      const grants = names.indexOf('grants') !== -1 ? db.prepare('SELECT peer_id, path FROM grants ORDER BY peer_id, path').all() : [];
      return { names: names, peersCols: peersCols, grantsCols: grantsCols, peers: peers, grants: grants };
    });
    if (seen.names.length === 2) test.check('node.db holds peers and grants');
    else test.fail(OWED + 'node.db holds ' + JSON.stringify(seen.names) + ', not peers and grants');
    const col = function (cols, name) { return cols.filter(function (c) { return c.name === name; })[0] || {}; };
    const peersShape = col(seen.peersCols, 'peer_id').pk === 1 && col(seen.peersCols, 'label').name === 'label';
    const grantsShape = col(seen.grantsCols, 'peer_id').pk >= 1 && col(seen.grantsCols, 'path').pk >= 1;
    if (peersShape && grantsShape) {
      test.check('peers(peer_id PRIMARY KEY, label); grants(peer_id, path) PRIMARY KEY (peer_id, path) — the double key refuses a duplicate row');
    } else test.fail(OWED + 'the columns: peers ' + JSON.stringify(seen.peersCols) + ', grants ' + JSON.stringify(seen.grantsCols));
    const aRow = seen.peers.filter(function (r) { return r.peer_id === KEYA; })[0];
    const bRow = seen.peers.filter(function (r) { return r.peer_id === KEYB; })[0];
    if (seen.peers.length === 2 && aRow && aRow.label === 'alice' && bRow && seen.grants.length === 3) {
      test.check('the planted rows are there: one peers row per key, one grants row per grant');
    } else test.fail(OWED + 'the rows: peers ' + JSON.stringify(seen.peers).slice(0, 180) + ', grants ' + JSON.stringify(seen.grants).slice(0, 180));
  } catch (e) {
    test.fail(OWED + 'node.db could not be read: ' + e.message);
  }

  test.subHeading('the rows survive a restart, and the last revoke takes the peers row with it');
  if (!(await boot())) test.fail('the node did not boot again');
  const kept = (await ask('jobs.authQuery', { key: KEYA, path: 'desk.chat.add' })).body;
  if (kept.allowed === true) test.check('a grant made before the restart still answers after it');
  else test.fail(OWED + 'after a restart the grant answered ' + JSON.stringify(kept).slice(0, 160));
  await ask('jobs.authRevoke', { key: KEYA, path: 'desk' });
  await ask('jobs.authRevoke', { key: KEYA, path: 'desk.chat.add' });
  const gone = (await ask('jobs.authPeer', { key: KEYA })).body;
  const still = (await ask('jobs.authPeer', { key: KEYB })).body;
  await down();
  try {
    const after = await readDb(function (db) {
      return {
        peers: db.prepare('SELECT peer_id FROM peers ORDER BY peer_id').all().map(function (r) { return r.peer_id; }),
        grants: db.prepare('SELECT peer_id FROM grants ORDER BY peer_id').all().map(function (r) { return r.peer_id; }),
      };
    });
    if ((gone.records || []).length === 0 && after.peers.length === 1 && after.peers[0] === KEYB &&
        (still.records || []).length === 1 && after.grants.length === 1 && after.grants[0] === KEYB) {
      test.check('KEYA\'s last revoke took its peers row ("it disappears."); KEYB\'s row and grant stand');
    } else test.fail(OWED + 'after the revokes: ' + JSON.stringify({ gone: gone, peers: after.peers, grants: after.grants }).slice(0, 240));
  } catch (e) {
    test.fail(OWED + 'node.db could not be read after the revokes: ' + e.message);
  }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  await down();
  test.reportSuccessFailureCount();
  process.exit(0);
});
