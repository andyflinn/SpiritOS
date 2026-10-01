'use strict';

// apiAuth/G1.4: jobs.auth (its verbs jobs.authQuery ... jobs.authRelabel — Andy, 2026-10-01: "Yes to the rename.", two-part names, verbTable.js:64), the owner's allow-table on the loopback door.
//   Andy's yes on the verbs: "grant needs no input label. the rest is looks ok, approved with dropping label
//   out of grant.input", "relabel is FINE verb.", "please fix the api, to be consistent with your practices
//   in terms of precise answer shapes." (every answer an object, never a bare value).
// The shapes, from the item's box @ version 20:
//   A record: { key, label, path }; path is 'app' or 'app.verb', matched exactly.
//   jobs.authQuery   { key, path }   -> { allowed: true|false }
//   jobs.authSearch  { text }        -> { records, more }   (text matches a label or a word of a path, never the key)
//   jobs.authPeer    { key }         -> { records }         (at most apps + verbs)
//   jobs.authGrant   { key, path }   -> the record          (label from his contacts, contacts.byPublicKey(...).myLabel;
//                                                             kernel.keyTail when they know no name — G1.11)
//   jobs.authRevoke  { key, path }   -> { revoked: true }
//   jobs.authRelabel { key, label }  -> { key, label }      (a row is born only by grant, never by relabel)
// Refusals, { ok: false, code, error }: bad-request, not-a-path, already-granted, not-granted,
//   unknown-path, store-unavailable (lives in G1.2's red), no-such-peer; the new codes defined in
//   spiritErrors.js by this item.
// The settled unknown-path rule, Andy: "only if the path is known from a previous configuration, where
//   owner has not pruned yet." — grant takes a path the live tree serves, OR one already in the grants
//   table; "this will allow an owner to suspend/repair an appServer and return it with auth configuration
//   intact." The last section here suspends the one served app and grants on.
// Whether an 'app' grant lets its verbs through is the GATE's business (G1.2, apiGate.js), not this
// table's; this suite only asserts exact rows it planted.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by apiAuth/G1.4: ';
const keyTail = require('../run/js/kernel.js').keyTail;

const KEYA = 'MCowBQYDK2VwAyEAjobsAuthTestPeerAAAAAAAAAAAAkeyAaa=';
const KEYB = 'MCowBQYDK2VwAyEAjobsAuthTestPeerBBBBBBBBBBBBkeyBzz=';
const KEYC = 'MCowBQYDK2VwAyEAjobsAuthTestPeerCCCCCCCCCCCCkeyCcc=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(200); } return fn(); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('apiAuth/G1.4: jobs.auth, the owner\'s allow-table on the loopback door');

const root = setupRelayFakes('jobsAuth').andy;
fs.writeFileSync(path.join(root, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
// The fake's node.db survives between runs; a second run must not find
// its own rows (claude-windows, building this: "already-granted").
['node.db', 'node.db-wal', 'node.db-shm'].forEach(function (f) {
  try { fs.unlinkSync(path.join(root, 'relay-state', f)); } catch (e) { /* first run */ }
});
// One served app, so a grant has a live path to take: the desk server.
fs.writeFileSync(path.join(root, 'relay-state', 'include.json'), JSON.stringify({ modules: ['process/js/desk'] }), 'utf8');
// His contacts know KEYA as alice; KEYB and KEYC they have never met.
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
const ask = function (verb, args) { const b = Object.assign({ verb: verb }, args || {}); return post(b); };
async function boot() {
  port = await freePort();
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const up = await until(function () { return post({ verb: 'node.info' }).then(function (r) { return r.status > 0; }); }, 15000);
  // The node boots waiting for its servers (Andy's rule), but give desk a moment regardless.
  const served = await until(function () { return post({ verb: 'jobs.api', ask: 'api' }).then(function (r) { return !!(r.body && r.body.desk && r.body.desk.ok !== false); }); }, 60000);
  return up && served;
}
function down() {
  return new Promise(function (resolve) {
    if (!child) return resolve();
    child.on('exit', function () { resolve(); });
    child.kill();
    setTimeout(resolve, 3000);
  });
}

(async function () {
  if (!(await boot())) { test.fail('the node did not boot with the desk server included — every later check would blame the wrong thing'); throw new Error('no world'); }

  test.subHeading('grant: a record, labelled from his contacts, or by kernel.keyTail');
  const g1 = (await ask('jobs.authGrant', { key: KEYA, path: 'desk' }));
  const r1 = g1.body;
  if (r1.key === KEYA && r1.label === 'alice' && r1.path === 'desk') {
    test.check('grant { key, path } on a served app answers the record, label copied from contacts');
  } else test.fail(OWED + 'grant answered ' + JSON.stringify({ status: g1.status, body: r1 }).slice(0, 220));
  const r2 = (await ask('jobs.authGrant', { key: KEYB, path: 'desk.chat.add' })).body;
  if (r2.key === KEYB && r2.label === keyTail(KEYB) && r2.path === 'desk.chat.add') {
    test.check('a key his contacts never met is labelled by kernel.keyTail (G1.11: one cut, everywhere)');
  } else test.fail(OWED + 'the stranger\'s grant answered ' + JSON.stringify(r2).slice(0, 220));
  const dup = (await ask('jobs.authGrant', { key: KEYA, path: 'desk' })).body;
  if (dup.ok === false && dup.code === 'already-granted') test.check('the same row twice is already-granted');
  else test.fail(OWED + 'a duplicate grant answered ' + JSON.stringify(dup).slice(0, 160));

  test.subHeading('query: { allowed }, the exact row and nothing else');
  const q1 = (await ask('jobs.authQuery', { key: KEYA, path: 'desk' })).body;
  const q2 = (await ask('jobs.authQuery', { key: KEYB, path: 'desk' })).body;
  const q3 = (await ask('jobs.authQuery', { key: KEYC, path: 'desk' })).body;
  if (q1.allowed === true && q2.allowed === false && q3.allowed === false) {
    test.check('query answers { allowed: true } for the planted row, false for a path or key never granted');
  } else test.fail(OWED + 'query answered ' + JSON.stringify([q1, q2, q3]).slice(0, 200));

  test.subHeading('the malformed are refused by name');
  const badPath = (await ask('jobs.authGrant', { key: KEYA, path: 'desk/box!' })).body;
  if (badPath.ok === false && badPath.code === 'not-a-path') test.check('a path that is not app or app.verb form is not-a-path');
  else test.fail(OWED + 'grant of desk/box! answered ' + JSON.stringify(badPath).slice(0, 160));
  const noKey = (await ask('jobs.authGrant', { path: 'desk' })).body;
  const noPath = (await ask('jobs.authQuery', { key: KEYA })).body;
  if (noKey.ok === false && noKey.code === 'bad-request' && noPath.ok === false && noPath.code === 'bad-request') {
    test.check('a missing field is bad-request, on grant and on query');
  } else test.fail(OWED + 'missing fields answered ' + JSON.stringify([noKey, noPath]).slice(0, 200));
  const ghost = (await ask('jobs.authGrant', { key: KEYA, path: 'ghost' })).body;
  if (ghost.ok === false && ghost.code === 'unknown-path') test.check('a path neither served nor already in the table is unknown-path');
  else test.fail(OWED + 'grant of ghost answered ' + JSON.stringify(ghost).slice(0, 160));

  test.subHeading('search matches a label or a word of a path, never the key');
  const s1 = (await ask('jobs.authSearch', { text: 'alice' })).body;
  const s2 = (await ask('jobs.authSearch', { text: 'chat' })).body;
  const s3 = (await ask('jobs.authSearch', { text: KEYB.slice(20, 32) })).body;
  const hasA = (s1.records || []).some(function (r) { return r.key === KEYA && r.path === 'desk'; });
  const hasB = (s2.records || []).some(function (r) { return r.key === KEYB && r.path === 'desk.chat.add'; });
  if (hasA && typeof s1.more === 'boolean' && hasB && Array.isArray(s3.records) && s3.records.length === 0) {
    test.check('search finds alice by label and KEYB\'s row by the path word chat; a cut of the key itself finds nothing');
  } else test.fail(OWED + 'search answered ' + JSON.stringify({ s1: s1, s2: s2, s3: s3 }).slice(0, 300));

  test.subHeading('peer: one key\'s rows');
  const p1 = (await ask('jobs.authPeer', { key: KEYB })).body;
  const onlyB = (p1.records || []).length === 1 && p1.records[0].key === KEYB && p1.records[0].path === 'desk.chat.add';
  if (onlyB) test.check('peer { key } answers that key\'s records and nobody else\'s');
  else test.fail(OWED + 'peer answered ' + JSON.stringify(p1).slice(0, 200));

  test.subHeading('relabel changes the label in the table, and only that');
  const rl = (await ask('jobs.authRelabel', { key: KEYB, label: 'bob' })).body;
  const pAfter = (await ask('jobs.authPeer', { key: KEYB })).body;
  if (rl.key === KEYB && rl.label === 'bob' && ((pAfter.records || [])[0] || {}).label === 'bob') {
    test.check('relabel { key, label } answers { key, label } and the row now carries it');
  } else test.fail(OWED + 'relabel answered ' + JSON.stringify({ rl: rl, after: pAfter }).slice(0, 220));
  const rlEmpty = (await ask('jobs.authRelabel', { key: KEYB, label: '' })).body;
  const rlNobody = (await ask('jobs.authRelabel', { key: KEYC, label: 'carl' })).body;
  if (rlEmpty.ok === false && rlEmpty.code === 'bad-request' && rlNobody.ok === false && rlNobody.code === 'no-such-peer') {
    test.check('an empty label is bad-request; a key with no peers row is no-such-peer (a row is born only by grant)');
  } else test.fail(OWED + 'relabel refusals answered ' + JSON.stringify([rlEmpty, rlNobody]).slice(0, 200));

  test.subHeading('revoke: { revoked: true } once, not-granted after');
  const v1 = (await ask('jobs.authRevoke', { key: KEYB, path: 'desk.chat.add' })).body;
  const v2 = (await ask('jobs.authRevoke', { key: KEYB, path: 'desk.chat.add' })).body;
  if (v1.revoked === true && v2.ok === false && v2.code === 'not-granted') {
    test.check('revoke takes the row out; revoking what is not there is not-granted');
  } else test.fail(OWED + 'revoke answered ' + JSON.stringify([v1, v2]).slice(0, 160));

  test.subHeading('a suspended appServer keeps its grants grantable (Andy: suspend/repair, return intact)');
  await down();
  fs.writeFileSync(path.join(root, 'relay-state', 'include.json'), JSON.stringify({ modules: [] }), 'utf8');
  port = await freePort();
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const up2 = await until(function () { return post({ verb: 'node.info' }).then(function (r) { return r.status > 0; }); }, 15000);
  if (!up2) test.fail('the node did not reboot without the desk server');
  const qKept = (await ask('jobs.authQuery', { key: KEYA, path: 'desk' })).body;
  const gKnown = (await ask('jobs.authGrant', { key: KEYC, path: 'desk' })).body;
  const gGhost = (await ask('jobs.authGrant', { key: KEYC, path: 'ghost2' })).body;
  if (qKept.allowed === true && gKnown.key === KEYC && gKnown.path === 'desk' && gGhost.ok === false && gGhost.code === 'unknown-path') {
    test.check('with no server serving desk: the kept grant still answers, desk is grantable because the table knows it, ghost2 is not');
  } else test.fail(OWED + 'the suspended app answered ' + JSON.stringify({ kept: qKept, known: gKnown, ghost: gGhost }).slice(0, 260));

  test.subHeading('the new refusal codes live in spiritErrors.js');
  const errs = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'spiritErrors.js'), 'utf8');
  const missing = ['already-granted', 'not-granted', 'unknown-path', 'not-a-path', 'store-unavailable'].filter(function (c) {
    return errs.indexOf("define('" + c + "'") === -1;
  });
  if (!missing.length) test.check('already-granted, not-granted, unknown-path, not-a-path and store-unavailable are defined');
  else test.fail(OWED + 'spiritErrors.js does not define: ' + missing.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  await down();
  test.reportSuccessFailureCount();
  process.exit(0);
});
