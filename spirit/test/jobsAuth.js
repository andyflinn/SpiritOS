'use strict';

// spirit/test/jobsAuth.js
// goal/G43.23, restored from 885f1ab5^ on today's harness (Andy's box: bring back "the grant tables"). apiAuth/G1.4: the
// auth family (spirit/auth/api.js, spirit/apiAuth.js), the owner's allow-table on the loopback door.
//   Andy's yes on the verbs: "grant needs no input label. the rest is looks ok, approved with dropping label out of
//   grant.input", "relabel is FINE verb.", "please fix the api, to be consistent with your practices in terms of precise
//   answer shapes." (every answer an object, never a bare value).
// The shapes:
//   A record: { key, label, path }; path is 'app' or 'app.verb', matched exactly.
//   auth.query   { key, path }   -> { allowed: true|false }
//   auth.search  { text }        -> { items, more }   each label { name, key, path }; goal/G41.28 (Andy, box v15: "search
//                                                      the whole bloody ROW, as it is served") searches the name, the key
//                                                      and the words of the path
//   auth.peer    { key }         -> { records }
//   auth.grant   { key, path }   -> the record        (label: his name for the key on its row of seen; none when he knows
//                                                      none, goal/G40.1, no key tail)
//   auth.revoke  { key, path }   -> { revoked: true }
//   auth.relabel { key, label }  -> { key, label }    (a row is born only by grant, never by relabel)
// Refusals, { ok: false, code, error }: bad-request, not-a-path, already-granted, not-granted, unknown-path,
//   no-such-peer; the codes defined in spiritErrors.js.
// The unknown-path rule, Andy: "only if the path is known from a previous configuration, where owner has not pruned
//   yet." grant takes a path the live tree serves, OR one already in the grants table; "this will allow an owner to
//   suspend/repair an appServer and return it with auth configuration intact." The last section turns the desk server
//   off at home and grants on.
// Whether an 'app' grant lets its verbs through is the gate's business (spirit/test/apiGate.js), not this table's.
// A scratch node on a copy of the tracked files (spirit/run/test/headLessChrome.js scratchNode), the desk server on at
// home (its sidecar's face.home); asked as the owner at its own loopback door. Never Andy's node nor an agent's.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const RUN = path.join(__dirname, '..', 'run');
const { scratchNode, sleep, until, freePort } = require(path.join(RUN, 'test', 'headLessChrome.js'));
const relayAuth = require(path.join(RUN, 'spirit', 'relayAuth.js'));

const KEYA = relayAuth.generateIdentity('jobsAuthA').publicKey;
const KEYB = relayAuth.generateIdentity('jobsAuthB').publicKey;
const KEYC = relayAuth.generateIdentity('jobsAuthC').publicKey;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('apiAuth/G1.4: the auth family, the owner\'s allow-table on the loopback door');

let N = null;
let child = null;
let base = '';
function post(call, args) {
  return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.text().then(function (t) { let body = {}; try { body = JSON.parse(t); } catch (e) { body = {}; } return { status: r.status, body: body || {} }; }); },
      function () { return { status: 0, body: {} }; });
}
const ask = function (call, args) { return post(call, args).then(function (r) { return r.body; }); };
const deskServed = function () { return post('api', {}).then(function (r) { return !!(r.body && r.body.desk && r.body.desk.ok !== false); }); };
function down() {
  return new Promise(function (resolve) {
    if (!child) return resolve();
    const c = child;
    child = null;
    c.on('exit', function () { setTimeout(resolve, 300); });
    try { c.kill(); } catch (e) { /* gone */ }
    setTimeout(resolve, 8000);
  });
}

(async function () {
  N = await scratchNode({ servers: ['desk'] });
  child = N.child;
  base = N.base;
  if (!N.up || !N.root || !(await until(deskServed, 60000))) { test.fail('the world: the scratch node did not come up serving desk: nothing judged'); return; }
  // His contacts know KEYA as alice (the owner's contact verbs: a block makes the row, the label names it, accept keeps
  // it); KEYB and KEYC he never met.
  await post('contact.block', { publicKey: KEYA, publicLabel: '' });
  await post('contact.unblock', { publicKey: KEYA });
  await post('contact.label', { publicKey: KEYA, myLabel: 'alice' });
  const kept = await post('contact.accept', { publicKey: KEYA });
  if (!(kept.status === 200 && kept.body.keep === true)) { test.fail('the world: alice could not be planted: ' + kept.status + ' ' + short(kept.body) + ': nothing judged'); return; }

  test.subHeading('grant: a record, labelled from his contacts, or unlabelled');
  const g1 = await post('auth.grant', { key: KEYA, path: 'desk' });
  const r1 = g1.body;
  if (r1.key === KEYA && r1.label === 'alice' && r1.path === 'desk') {
    test.check('grant { key, path } on a served app answers the record, the label his name for the key');
  } else test.fail('grant answered ' + short({ status: g1.status, body: r1 }));
  const r2 = await ask('auth.grant', { key: KEYB, path: 'desk.chat.add' });
  if (r2.key === KEYB && r2.label === '' && r2.path === 'desk.chat.add') {
    test.check('a key his contacts never met has no label, and no key tail stands in for one (goal/G40.1)');
  } else test.fail('the stranger\'s grant answered ' + short(r2));
  const dup = await ask('auth.grant', { key: KEYA, path: 'desk' });
  if (dup.ok === false && dup.code === 'already-granted') test.check('the same row twice is already-granted');
  else test.fail('a duplicate grant answered ' + short(dup));

  test.subHeading('query: { allowed }, the exact row and nothing else');
  const q1 = await ask('auth.query', { key: KEYA, path: 'desk' });
  const q2 = await ask('auth.query', { key: KEYB, path: 'desk' });
  const q3 = await ask('auth.query', { key: KEYC, path: 'desk' });
  if (q1.allowed === true && q2.allowed === false && q3.allowed === false) {
    test.check('query answers { allowed: true } for the planted row, false for a path or key never granted');
  } else test.fail('query answered ' + short([q1, q2, q3]));

  test.subHeading('the malformed are refused by name');
  const badPath = await ask('auth.grant', { key: KEYA, path: 'desk/box!' });
  if (badPath.ok === false && badPath.code === 'not-a-path') test.check('a path that is not app or app.verb form is not-a-path');
  else test.fail('grant of desk/box! answered ' + short(badPath));
  const noKey = await ask('auth.grant', { path: 'desk' });
  const noPath = await ask('auth.query', { key: KEYA });
  if (noKey.ok === false && noKey.code === 'bad-request' && noPath.ok === false && noPath.code === 'bad-request') {
    test.check('a missing field is bad-request, on grant and on query');
  } else test.fail('missing fields answered ' + short([noKey, noPath]));
  const ghost = await ask('auth.grant', { key: KEYA, path: 'ghost' });
  if (ghost.ok === false && ghost.code === 'unknown-path') test.check('a path neither served nor already in the table is unknown-path');
  else test.fail('grant of ghost answered ' + short(ghost));

  test.subHeading('search matches the row as it is served: its name, its key, the words of its path');
  const s1 = await ask('auth.search', { text: 'alice' });
  const s2 = await ask('auth.search', { text: 'chat' });
  const s3 = await ask('auth.search', { text: KEYB.slice(16, 40) });
  const grantsOf = function (s) { return ((s && s.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } }); };
  const hasA = grantsOf(s1).some(function (r) { return r.key === KEYA && r.path === 'desk' && r.name === 'alice'; });
  const hasB = grantsOf(s2).some(function (r) { return r.key === KEYB && r.path === 'desk.chat.add'; });
  if (hasA && typeof s1.more === 'boolean' && hasB) {
    test.check('search finds alice by her name and KEYB\'s row by the path word chat, each label { name, key, path }');
  } else test.fail('search answered ' + short({ s1: s1, s2: s2 }));
  // goal/G41.28 replaced apiAuth/G1.4's "never the key": the key is part of the row as it is served.
  if (grantsOf(s3).some(function (r) { return r.key === KEYB; })) test.check('a cut of the key finds that key\'s row (goal/G41.28: the whole row, as it is served)');
  else test.fail('a cut of KEYB found ' + short(s3));

  test.subHeading('peer: one key\'s rows');
  const p1 = await ask('auth.peer', { key: KEYB });
  if ((p1.records || []).length === 1 && p1.records[0].key === KEYB && p1.records[0].path === 'desk.chat.add') test.check('peer { key } answers that key\'s records and nobody else\'s');
  else test.fail('peer answered ' + short(p1));

  test.subHeading('relabel changes the label of the key\'s grants, and only that');
  const rl = await ask('auth.relabel', { key: KEYB, label: 'bob' });
  const pAfter = await ask('auth.peer', { key: KEYB });
  if (rl.key === KEYB && rl.label === 'bob' && ((pAfter.records || [])[0] || {}).label === 'bob') {
    test.check('relabel { key, label } answers { key, label } and the row now carries it');
  } else test.fail('relabel answered ' + short({ rl: rl, after: pAfter }));
  const rlEmpty = await ask('auth.relabel', { key: KEYB, label: '' });
  const rlNobody = await ask('auth.relabel', { key: KEYC, label: 'carl' });
  if (rlEmpty.ok === false && rlEmpty.code === 'bad-request' && rlNobody.ok === false && rlNobody.code === 'no-such-peer') {
    test.check('an empty label is bad-request; a key holding no grant is no-such-peer (a row is born only by grant)');
  } else test.fail('relabel refusals answered ' + short([rlEmpty, rlNobody]));

  test.subHeading('revoke: { revoked: true } once, not-granted after');
  const v1 = await ask('auth.revoke', { key: KEYB, path: 'desk.chat.add' });
  const v2 = await ask('auth.revoke', { key: KEYB, path: 'desk.chat.add' });
  if (v1.revoked === true && v2.ok === false && v2.code === 'not-granted') test.check('revoke takes the row out; revoking what is not there is not-granted');
  else test.fail('revoke answered ' + short([v1, v2]));

  test.subHeading('a suspended appServer keeps its grants grantable (Andy: suspend/repair, return intact)');
  await down();
  // The desk server off at home for this boot: its sidecar's face.home false (goal/G41.1).
  const run = path.join(N.root, 'spirit', 'run');
  fs.writeFileSync(path.join(run, 'relay-state', 'process', 'desk', 'desk.js.sidecar.json'), JSON.stringify({ face: { home: false } }));
  const port = await freePort();
  child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port;
  const up2 = await until(function () { return post('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
  const tree = (await post('api', {})).body;
  if (!up2 || (tree.desk && tree.desk.ok !== false)) { test.fail('the world: the node did not reboot without the desk server (' + short(Object.keys(tree)) + '): nothing judged'); return; }
  const qKept = await ask('auth.query', { key: KEYA, path: 'desk' });
  const gKnown = await ask('auth.grant', { key: KEYC, path: 'desk' });
  const gGhost = await ask('auth.grant', { key: KEYC, path: 'ghost2' });
  if (qKept.allowed === true && gKnown.key === KEYC && gKnown.path === 'desk' && gGhost.ok === false && gGhost.code === 'unknown-path') {
    test.check('with no server serving desk: the kept grant still answers, desk is grantable because the table knows it, ghost2 is not');
  } else test.fail('the suspended app answered ' + short({ kept: qKept, known: gKnown, ghost: gGhost }));

  test.subHeading('the refusal codes live in spiritErrors.js');
  const errs = fs.readFileSync(path.join(RUN, 'spirit', 'spiritErrors.js'), 'utf8');
  const missing = ['already-granted', 'not-granted', 'unknown-path', 'not-a-path', 'store-unavailable', 'no-such-peer'].filter(function (c) {
    return errs.indexOf("define('" + c + "'") === -1;
  });
  if (!missing.length) test.check('already-granted, not-granted, unknown-path, not-a-path, store-unavailable and no-such-peer are defined');
  else test.fail('spiritErrors.js does not define: ' + missing.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  await down();
  await sleep(300);
  try { if (N && N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});
