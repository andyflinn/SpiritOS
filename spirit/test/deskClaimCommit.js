'use strict';

// spirit/test/deskClaimCommit.js
// goal/G19.13: Desk: a claim carries its commit; deskVerify waits for it. Red on today's tree (eee4a204); claude-windows
// wrote it and builds it (one agent).
//   Andy, 2026-10-12: "these push things, when you report a claim on code, it should be accompanied by the commit id,
//   that way desk verify won't check something that hasn't arrived yet... ?"; asked whether it shall be claim {id,
//   commit}, as one verb: "better. that closes the door on half-ass claims."; and "and why are the reds not claimed as
//   complete that way, so the verifier can check them, they should be red. at the time", "yes" to the red phase ending
//   with its own commit, checked red by deskVerify, in this item.
// FOUND: a claim that ran ahead of its push was checked on the old tree (goal/G19.12).
//
// WHAT IS ASSERTED
//   1. THE DESK: one new verb, claim {id, phase, commit}. phase build is the press claim-done, with its refusals, and the
//      item keeps the claimed commit (item.get claimCommit); phase red is taken on a code item with his Go only and the
//      item keeps it (redCommit). A commit is 7 to 40 hex characters, or '' for a plain item's build claim. Every refusal
//      says why. The api lists claim and its verb file (claim.json, read by FS.loadJsonValue since goal/G30.4).
//   2. (went with goal/G33.3) deskVerify's half: it watched the desk for claims, waited for the claimed commit and
//      checked a red claim red. It knows nothing of the desk now (Andy: "deskVerify has no fucking clue about desk, desk
//      goals or desk items"): the desk hands it a run with the item's claimed commit, and a run whose commit the tree
//      lacks measures nothing (deskVerifyCommitBound.js); the desk reads the outcome when Done is pressed
//      (deskVerifyDriven.js).
// rule/11: through testSupport only; a fake node, a real desk; it stops only the processes it started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G19.13: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskClaimCommitTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskClaimCommitTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const MISSING = '0123456789abcdef0123456789abcdef01234567';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G19.13: a claim carries its commit, and deskVerify waits for it');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclaimcommit-'));

function server(script, name, values, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  let kid = null;
  return {
    start: function () { kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); },
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    api: function () { return client.ask('api').then(function (r) { return (r && r.body && r.body[app]) || {}; }, function () { return {}; }); },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// A node that answers `api` with a desk and nothing else, so the desk under test never asks his node anything.
function apiNode() {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {} } : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

// ── 1. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('1. the desk: claim {id, phase, commit}, its acceptances and its refusals with their whys');
  const node = await apiNode();
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const d = server(DESK, 'desk', {}, root);
  const get = async function (id) { return parse(((await d.call('item.get', { id: id }, ANDY)).body || {}).item) || {}; };
  const whyOf = function (r) { return String((r.body && r.body.extra && r.body.extra.why) || ''); };
  // A refusal by the verb itself, saying why: not an unknown verb, not a shape the door refused before the handler.
  const refusedSaying = function (r) { return !took(r) && r.body && r.body.code !== 'no-such-verb' && !!whyOf(r); };
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; goal/G33.7: seeded before the desk
  // starts (session.set went), and the desk takes it in at start.
  test.seedDesk(path.join(scratch, 'desk', 'state'), { goal: { id: 'goal/G100', title: 'Claims' }, items: [
    { id: 'goal/G100.1', title: 'Code with Go', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'Plain with Go', blocks: ['goal/G100'] },
    { id: 'goal/G100.3', title: 'Code without Go', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.4', title: 'Plain without Go', blocks: ['goal/G100'] },
  ] });
  try {
    d.start();
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    const api = await d.api();
    // The verb file is read through the family's FS since goal/G30.4 (it was AGENTS.claim).
    const claimFile = await d.call('FS.loadJsonValue', { path: 'claim.json' });
    const described = claimFile.body && claimFile.body.value && typeof claimFile.body.value.description === 'string';
    if (api.claim && described) test.check('the api lists claim, and its verb file tells the agents of it (claim.json, read by FS.loadJsonValue)');
    else test.fail(OWED + 'the api lists ' + short(Object.keys(api).filter(function (k) { return /claim/.test(k); })) + ', claim.json read as ' + short(claimFile.body));

    await d.call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);

    const cases = [
      ['a commit that is not hex', { id: 'goal/G100.1', phase: 'build', commit: 'nothex!' }],
      ['a commit of 6 characters', { id: 'goal/G100.1', phase: 'build', commit: 'abcdef' }],
      ['a commit of 41 characters', { id: 'goal/G100.1', phase: 'build', commit: MISSING + 'a' }],
      ['no commit on a code item\'s build', { id: 'goal/G100.1', phase: 'build', commit: '' }],
      ['no commit on a red', { id: 'goal/G100.1', phase: 'red', commit: '' }],
      ['a phase that is neither build nor red', { id: 'goal/G100.1', phase: 'verify', commit: 'abcdef1' }],
      ['a red on a plain item', { id: 'goal/G100.2', phase: 'red', commit: 'abcdef1' }],
      ['a red on a code item without his Go', { id: 'goal/G100.3', phase: 'red', commit: 'abcdef1' }],
      ['a build claim on an item without his Go (as the press refuses it)', { id: 'goal/G100.4', phase: 'build', commit: '' }],
      ['an item that does not exist', { id: 'goal/G101.9', phase: 'build', commit: 'abcdef1' }],
    ];
    for (const c of cases) {
      const r = await d.call('claim', c[1], CW);
      if (refusedSaying(r)) test.check('refused, saying why: ' + c[0] + ' (' + whyOf(r) + ')');
      else test.fail(OWED + c[0] + ': claim answered ' + r.status + ' ' + short(r.body));
    }
    const untouched = await get('goal/G100.1');
    if (!untouched.claims && !untouched.claimCommit && !untouched.redCommit) test.check('and nothing refused changed the item');
    else test.fail(OWED + 'after the refusals goal/G100.1 reads ' + short({ claims: untouched.claims, claimCommit: untouched.claimCommit, redCommit: untouched.redCommit }));

    // goal/G40.3: a red claim carries no suites; the item's suite row is added first, one row a write. CW holds no red
    // phase here (the claim is the subject, not the take), so Andy, who may write any item's suites, adds it.
    await d.call('item.suites.add', { id: 'goal/G100.1', path: 'spirit/test/deskClaimCommit.js' }, ANDY);
    const red = await d.call('claim', { id: 'goal/G100.1', phase: 'red', commit: 'abcdef1' }, CW);
    const afterRed = await get('goal/G100.1');
    if (took(red) && afterRed.redCommit === 'abcdef1' && !afterRed.claims) test.check('a red claim on a code item with his Go is taken, the item keeps its commit, and it is no Done claim');
    else test.fail(OWED + 'red claim answered ' + short(red.body) + '; item ' + short({ redCommit: afterRed.redCommit, claims: afterRed.claims }));

    const full = 'abcdef0123456789abcdef0123456789abcdef01';
    const build = await d.call('claim', { id: 'goal/G100.1', phase: 'build', commit: full }, CW);
    const afterBuild = await get('goal/G100.1');
    if (took(build) && afterBuild.claimCommit === full && afterBuild.claims === 1) test.check('a build claim is the claim-done: one claim on the item, and the item keeps the claimed commit');
    else test.fail(OWED + 'build claim answered ' + short(build.body) + '; item ' + short({ claimCommit: afterBuild.claimCommit, claims: afterBuild.claims }));

    const plain = await d.call('claim', { id: 'goal/G100.2', phase: 'build', commit: '' }, CW);
    const afterPlain = await get('goal/G100.2');
    if (took(plain) && afterPlain.claims === 1) test.check('a plain item takes a build claim with no commit');
    else test.fail(OWED + 'plain claim answered ' + short(plain.body) + '; claims ' + short(afterPlain.claims));

    // goal/G33.4: no log of writes and no `changes`; the item itself is the record: it holds the claim, and keeps the
    // build claim's commit and the red's, read back by a fresh item.get.
    const kept = await get('goal/G100.1');
    if (kept.claims === 1 && kept.claimCommit === full && kept.redCommit === 'abcdef1') test.check('the item holds its claim, and keeps the build claim\'s commit and the red\'s');
    else test.fail(OWED + 'the item keeps ' + short({ claims: kept.claims, claimCommit: kept.claimCommit, redCommit: kept.redCommit }));
  } finally { await d.stop(); node.close(); }
}

(async function () {
  await deskHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
