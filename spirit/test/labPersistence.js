'use strict';

// spirit/test/labPersistence.js
// A relay is stopped and started, and still knows who it carries.
//
// ── THIS WAS labMaster/relayPersist.test.js ──────────────────────────
//
// Ten checks, of which five were labMaster's lifecycle (covered now by
// labLifecycle.js) and two proved persistence WITH MAIL — a message
// stored before the stop and read back after it. The ring is gone, so
// that half cannot be asked any more.
//
// What survives is the better subject, and STATE.md said so before this
// was written: the relay holds its roll and nothing else (relay.db since cycle 3). A
// relay's whole memory is who has a row on it, so "does it still know
// after a restart" is a sharper question than it was when the answer
// could also have come from a message queue.
//
// THE CLAIM IS SIGNED. It was `{ name: 'andy' }` with no key and no
// signature, which has been refused since decision 0003 made the first
// claim the owner — one of the things STATE.md meant by "red before R8
// touched anything, on things that have nothing to do with the ring".

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const lab = require('./labMaster/ensureMaster.js');

const RELAY_PORT = 65419;
const RELAY_NAME = 'persist-relay';
const ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;

// Where labMaster puts the copies it makes. Read directly, because the
// point of this suite is what is ON DISK — an answer from the running
// process would prove memory, not persistence.
const FAKES_ROOT = path.join(os.tmpdir(), 'spiritos-relay-fakes');
const relayHome = path.join(FAKES_ROOT, RELAY_NAME, 'spirit', 'run');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    return { status: res.status, json: json, text: text };
  } catch (e) {
    return { status: 0, json: null, text: String((e && e.message) || e) };
  }
}

async function census() {
  try {
    const res = await fetch(ORIGIN + '/api/relay/key');
    if (res.status !== 200) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function waitServing(timeoutMs) {
  const startedAt = Date.now();
  for (;;) {
    /* eslint-disable no-await-in-loop */
    if (await census()) return true;
    if (Date.now() - startedAt > timeoutMs) return false;
    await sleep(200);
  }
}

// relay.db since cycle 3, opened read-only and closed at once so the
// running relay and labMaster's cleanup never meet a handle of ours.
// Answers the shape routingTable.json had — `peers` by key — plus the
// database's table names, which is what "keeps nothing else" means now.
function routingTable() {
  let db = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(path.join(relayHome, 'relay-state', 'relay.db'), { readOnly: true });
    const peers = {};
    db.prepare('SELECT publicKey, publicLabel, owner FROM members').all().forEach(function (r) {
      peers[r.publicKey] = { publicLabel: r.publicLabel, owner: !!r.owner };
    });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      .map(function (t) { return t.name; }).sort();
    return { peers: peers, tables: tables };
  } catch (e) {
    return null;
  } finally {
    if (db) { try { db.close(); } catch (e) { /* closed */ } }
  }
}

test.startTest('A relay forgets nothing across a restart');

async function run() {
  const ready = await lab.ensure();
  if (!ready.ok) { test.fail('no lab: ' + ready.error); return; }

  try { await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/delete', {}); } catch (e) { /* fine */ }

  const made = await lab.api('POST', '/api/nodes',
    { name: RELAY_NAME, type: 'relay', port: RELAY_PORT , kind: 'fixture' });
  if (made.status !== 201) { test.fail('create: ' + made.status + ' ' + made.text); return; }

  const started = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/start', {});
  if (started.status !== 200 || !(await waitServing(10000))) {
    test.fail('the relay never came up on ' + RELAY_PORT);
    return;
  }

  test.subHeading('Somebody takes a row');

  // FIRST CLAIM ON AN EMPTY BOX IS THE OWNER (decision 0003), and it is
  // signed like every other claim — an empty allow.json means "anyone
  // may be first", never "no signature required".
  const andy = auth.generateIdentity('andy');
  const claimed = await post(ORIGIN + '/api/relay/claim', {
    name: 'andy',
    publicKey: andy.publicKey,
    sig: auth.sign(andy.privateKey, auth.claimMessage('andy')),
  });
  if (claimed.status === 201) {
    test.check('a signed claim takes the row, and the first one owns the box');
  } else {
    test.fail('claim: ' + claimed.status + ' ' + claimed.text);
  }

  // KEYED BY PUBLIC KEY, not a list. That is the file saying what a row
  // IS: two peers who both call themselves andy are two entries because
  // they are two keys, and there is nowhere in this shape for a label to
  // be the thing looked up by.
  const onDisk = routingTable();
  const row = onDisk && onDisk.peers && onDisk.peers[andy.publicKey];
  if (row && row.owner === true && row.publicLabel === 'andy') {
    test.check('and it is written down, under his KEY, before anything is asked to restart');
  } else {
    test.fail('relay.db after the claim: ' + JSON.stringify(onDisk));
  }

  // THE WHOLE DATABASE, and this is the half the old suite could not
  // assert because the file used to hold mail too. Since cycle 3 it is
  // three tables — the roll, the invites the owner minted, the partner
  // roll — all the relay's own bookkeeping (decision 0006 — it stores
  // nothing on anyone's behalf), so a fourth table is a relay that has
  // started keeping something, which must not happen quietly.
  const kept = onDisk ? onDisk.tables : [];
  if (kept.join(',') === 'invites,members,partners') {
    test.check('and the roll, invites and partners are all it holds — no table on anyone else’s behalf');
  } else {
    test.fail('relay.db holds: ' + JSON.stringify(kept) +
      ' — a relay stores nothing on anyone else’s behalf (decision 0006)');
  }

  test.subHeading('Stop it, start it, ask again');

  const stopped = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/stop', {});
  if (stopped.status === 200) {
    test.check('the relay stops');
  } else {
    test.fail('stop: ' + stopped.status + ' ' + stopped.text);
  }
  await sleep(400);

  // IT IS REALLY DOWN. Without this the checks below could be answered
  // by the process that never died, and "it persisted" would be
  // indistinguishable from "it never restarted".
  if (!(await census())) {
    test.check('and stops answering, so what comes back next is a new process');
  } else {
    test.fail('the relay was still serving after stop');
  }

  const again = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/start', {});
  if (again.status === 200 && (await waitServing(10000))) {
    test.check('and starts again');
  } else {
    test.fail('restart: ' + again.status + ' ' + again.text);
  }

  // ── READ THE FILE, NOT A ROUTE (2026-09-18) ──────────────────────
  //
  // This asked `GET /api/relay/who` and looked for andy's key in the
  // list. That route is gone — a public, unsigned read of every member
  // was named a cheat in 0010 and eradicated the next day — and the
  // question it was standing in for is one this suite can ask directly.
  //
  // Better evidence besides: a PERSISTENCE suite should read what
  // persisted. `routingTable()` above already does, and a row that is on
  // disk after a restart is the claim being made, where a row that is
  // served by a route is that plus a route.
  const reread = routingTable();
  const survived = reread && reread.peers && reread.peers[andy.publicKey];
  if (survived && survived.owner === true) {
    test.check('andy still holds his row — by KEY, which is what a row is');
  } else {
    test.fail('relay.db after restart: ' +
      JSON.stringify(Object.keys((reread && reread.peers) || {})
        .map(function (k) { return String(k).slice(-8); })));
  }

  // AND THE BOX IS STILL SHUT. A census that lists somebody proves the
  // file was read; a refused claim proves the relay is ACTING on what it
  // read. Different failures, and only one of them is visible in a list.
  //
  // 403 "invite required" AND NOT 409, which is worth being exact about
  // because the old suite expected the 409 and that expectation was
  // written before the box could ever be shut. A 409 would mean "that
  // label is taken" — the relay got as far as comparing labels. What
  // actually happens is that it never gets there: the first claim made
  // andy the owner, that survived the restart in allow.json, and a box
  // with an owner takes no strangers at all without an invite.
  //
  // So this proves MORE than the check it replaces. It is not the peer
  // row that came back, it is the ownership.
  const other = auth.generateIdentity('impostor');
  const retaken = await post(ORIGIN + '/api/relay/claim', {
    name: 'andy',
    publicKey: other.publicKey,
    sig: auth.sign(other.privateKey, auth.claimMessage('andy')),
  });
  if (retaken.status === 403 && /invite/.test(retaken.text)) {
    test.check('and a stranger is refused for want of an invite — the OWNERSHIP came back, not just the row');
  } else {
    test.fail('reclaim after restart: ' + retaken.status + ' ' + retaken.text +
      ' — expected 403 "invite required" from a box that remembers it has an owner');
  }

  await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/delete', {});
}

run()
  .catch(function (err) { test.fail(String((err && err.message) || err)); })
  .then(function () {
    lab.stop();
    test.reportSuccessFailureCount();
  });
