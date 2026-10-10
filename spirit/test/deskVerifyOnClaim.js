'use strict';

// spirit/test/deskVerifyOnClaim.js
// goal/G16.13: the verifier pulls, checks and reports on every claim. Written first, red on today's tree, by
// claude-windows (the red phase stood open with nobody on it); the build is the other agent's. Andy, 2026-10-11:
// "the verifier should fucking listen to the desk at all times, even when idling. stupid thing. then desk-status-changes
// can trigger pulls and checks."; "my Verifier need to poll for verifications, and pull git when a status change occurs
// in desk."; "The verifier MUST ALWAYS fucking listen to desk and do that work FIRST."; "you'll have to make the verifier
// FUCKING work. or this shit won't get done."; and on the button: "only the verifier should give me a done button,
// that's one way of knowing that the 'Done' offered went through the verifier."
//
// WHAT IS ASSERTED (the box, points 1 to 4)
//   1. THE DESK: a plain item's claim-done no longer brings Done by itself; the verifier's verify.pass on it does.
//   2. THE TRIGGER: a claim-done press on any item makes deskVerify check that item unasked, once; history before it
//      starts still triggers nothing.
//   3. THE PULL, FIRST: before the check deskVerify runs its pull command (manifest value `pull`) when its tree is
//      clean, and does not run it when the tree is dirty; the result line says which ("pulled" or "dirty").
//   4. THE RESULT, ON THE ITEM, EVERY TIME: one chat line under the item by deskVerify, saying passed or rejected and
//      the commit; a rejection names the red suite; a code item's verify pass still asks verify.pass and gets the line.
// rule/11: through testSupport only; a fake node and its own desk; the pull is a probe script, never a real git pull.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G16.13: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyOnClaimTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyOnClaimTestOwnerAAAAAAAAAAA=', label: 'andy' };
const GREEN = 'zzClaimGreen.js';
const RED = 'zzClaimRed.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G16.13: the verifier pulls, checks and reports on every claim');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyonclaim-'));

function server(script, name, args, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const kid = spawn(process.execPath, [script, JSON.stringify(args || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// ── 1. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('1. the desk: a plain item\'s Done comes from the verifier, not from the claim');
  const d = server(DESK, 'desk');
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'oc/G1', title: 'Claims' }, items: [{ id: 'oc/G1.1', title: 'Plain', blocks: ['oc/G1'] }] }) }, CW);
    await d.call('press', { id: 'oc/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'oc/G1.1', what: 'go' }, ANDY);
    await d.call('item.take', { id: 'oc/G1.1' }, CW);
    await d.call('press', { id: 'oc/G1.1', what: 'claim-done' }, CW);
    const claimed = parse((await d.call('item.get', { id: 'oc/G1.1' }, ANDY)).body.item) || {};
    if (Array.isArray(claimed.buttons) && claimed.buttons.indexOf('done') === -1) test.check('after a claim-done the plain item offers no Done yet');
    else test.fail(OWED + 'a plain item offers Done on the claim alone: ' + short(claimed.buttons));
    const pass = await d.call('verify.pass', { id: 'oc/G1.1' }, ANDY);
    const passed = parse((await d.call('item.get', { id: 'oc/G1.1' }, ANDY)).body.item) || {};
    if (pass.status === 200 && Array.isArray(passed.buttons) && passed.buttons.indexOf('done') !== -1) test.check('the verifier\'s verify.pass on it brings Done');
    else test.fail(OWED + 'verify.pass on the claimed plain item answered ' + pass.status + ' ' + short(pass.body) + ', buttons ' + short(passed.buttons));
  } finally { await d.stop(); }
}

// ── 2 to 4. THE VERIFIER ────────────────────────────────────────────────
async function verifyHalf() {
  test.subHeading('2. a claim-done makes the verifier check the item, unasked, once');
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('claim green probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  fs.writeFileSync(path.join(__dirname, RED), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('claim red probe');\ntest.fail('red on purpose');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const files = function (f) { return [{ path: 'spirit/test/' + f, by: 'claude-windows', core: false }]; };
  const ITEMS = { 'oc/G1.0': { code: false, files: files(GREEN) }, 'oc/G1.1': { code: false, files: files(GREEN) }, 'oc/G1.2': { code: false, files: files(RED) }, 'oc/G1.3': { code: true, files: files(GREEN) } };
  const records = [];
  const rec = function (verb, body, by) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: by || 'claude-windows', key: '', body: JSON.stringify(body) }); };
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          const a = j.ask.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            const recs = rest.slice(0, 2);
            out = { records: recs, lines: [], n: recs.length ? recs[recs.length - 1].n : from, line: 0, more: rest.length > 2 };
          } else {
            asks.push({ verb: verb, args: a, at: Date.now() });
            const it = ITEMS[a.id] || { code: false, files: [] };
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'oc/G1', code: it.code, go: true, files: it.files }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  // THE PULL PROBE: a script the verifier runs as its pull command; it writes the time it ran, nothing else.
  const marker = path.join(scratch, 'pulled.txt');
  const probe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(probe, "require('fs').appendFileSync(" + JSON.stringify(marker) + ", Date.now() + '\\n');\n");
  const pulls = function () { try { return fs.readFileSync(marker, 'utf8').split('\n').filter(Boolean).map(Number); } catch (e) { return []; } };
  // Whether the tree the verifier measures is dirty: its tree is this checkout, read the way it reads it.
  const repo = path.join(__dirname, '..', '..');
  const porcelain = spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const dirty = !!String(porcelain.stdout || '').trim();
  rec('press', { id: 'oc/G1.0', what: 'claim-done' });   // history: must trigger nothing
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db'), watchMs: 300, suiteMs: 20000, pull: process.execPath + ' ' + probe }, run);
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && x.args.id === id; }); };
  const lineOn = function (id) { return said('chat.add', id).map(function (x) { return String(x.args.text || ''); }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    await sleep(1500);
    if (!asks.some(function (x) { return x.args.id === 'oc/G1.0'; })) test.check('a claim already on the record when it starts triggers nothing');
    else test.fail(OWED + 'it checked history: ' + short(asks.filter(function (x) { return x.args.id === 'oc/G1.0'; })));

    const before = Date.now();
    rec('press', { id: 'oc/G1.1', what: 'claim-done' });
    const checked = await waitFor(function () { return lineOn('oc/G1.1').length > 0; }, 15000);
    if (checked && said('item.get', 'oc/G1.1').length) test.check('a claim-done on a plain item: within seconds, unasked, it checked the item');
    else test.fail(OWED + 'no check after a claim-done; the desk was asked ' + short(asks.filter(function (x) { return x.args.id === 'oc/G1.1'; })));
    await sleep(1500);
    if (lineOn('oc/G1.1').length === 1) test.check('once, not on every read');
    else test.fail(OWED + 'lines on oc/G1.1: ' + lineOn('oc/G1.1').length);

    test.subHeading('3. the pull, first, only on a clean tree');
    const ranPull = pulls().filter(function (t) { return t >= before; });
    const firstAsk = said('item.get', 'oc/G1.1')[0];
    const line = lineOn('oc/G1.1')[0] || '';
    if (!dirty) {
      if (ranPull.length && firstAsk && ranPull[0] <= firstAsk.at) test.check('the tree is clean: the pull command ran before the check');
      else test.fail(OWED + 'clean tree, pull ran ' + ranPull.length + ' time(s), first ask at ' + (firstAsk && firstAsk.at) + ', pulls ' + short(ranPull));
      if (/pulled/i.test(line)) test.check('and the result line says it pulled');
      else test.fail(OWED + 'the line does not say it pulled: ' + short(line));
    } else {
      if (!ranPull.length) test.check('the tree is dirty: no pull ran');
      else test.fail(OWED + 'the tree is dirty and the pull ran anyway');
      if (/dirty/i.test(line)) test.check('and the result line says the tree was dirty');
      else test.fail(OWED + 'the line does not say dirty: ' + short(line));
    }

    test.subHeading('4. the result, on the item, every time');
    const commit = String(spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout || '').trim();
    if (/passed/i.test(line) && commit && line.indexOf(commit) !== -1) test.check('a green item gets one line: passed, at the commit it checked (' + commit + ')');
    else test.fail(OWED + 'the line on a green item reads ' + short(line));
    if (said('verify.pass', 'oc/G1.1').length === 1) test.check('and verify.pass, which brings the plain item its Done');
    else test.fail(OWED + 'verify.pass on the plain item was asked ' + said('verify.pass', 'oc/G1.1').length + ' times');
    rec('press', { id: 'oc/G1.2', what: 'claim-done' });
    await waitFor(function () { return lineOn('oc/G1.2').length > 0; }, 15000);
    const redLine = lineOn('oc/G1.2')[0] || '';
    if (/rejected/i.test(redLine) && redLine.indexOf(RED) !== -1 && !said('verify.pass', 'oc/G1.2').length) test.check('a red item gets one line: rejected, naming the red suite, and no pass');
    else test.fail(OWED + 'the line on a red item reads ' + short(redLine) + '; passes ' + said('verify.pass', 'oc/G1.2').length);
    rec('phase.done', { id: 'oc/G1.3', phase: 'verify', pass: true });
    await waitFor(function () { return said('verify.pass', 'oc/G1.3').length > 0 && lineOn('oc/G1.3').length > 0; }, 15000);
    if (said('verify.pass', 'oc/G1.3').length === 1 && lineOn('oc/G1.3').length === 1) test.check('a code item\'s verify pass still asks verify.pass, and now gets its line too');
    else test.fail(OWED + 'code item: passes ' + said('verify.pass', 'oc/G1.3').length + ', lines ' + lineOn('oc/G1.3').length);
  } finally {
    await v.stop();
    node.close();
  }
}

(async function () {
  await deskHalf();
  await verifyHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.unlinkSync(path.join(__dirname, RED)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
