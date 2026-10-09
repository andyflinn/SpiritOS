'use strict';

// goal/G8.10: deskVerify watches the desk and starts its claim check, with a time limit. Red on today's tree;
// claude-windows wrote it from G8.10's box and does not build it.
//   Andy, 2026-10-09: "best is, if the done button doesn't show up until deskVerify allows it.", "the builders claim is
//   registered, but only deskVerify brings the button.", on what starts claim.check: "deskVerify watching changes.", on
//   the gate with its two guards: "i go with agents recommendation", and "an agent should be able to trigger a re-verify".
//
// WHAT IS TRUE TODAY (read at bcecf958 and after): on his node a code item offers Done only after verify.pass;
// claim.check asks verify.pass on all green and verify.reject on a red - but nothing calls claim.check, so no code item
// there offers Done. runSuite kills a suite after ten minutes and then reads its printed lines, so a suite killed with
// no FAILURE line printed counts as green.
//
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.10 for him to overrule:
//   THE WATCHER: deskVerify reads the desk's `changes` by itself, every `watchMs` (a manifest value; the suite sets it
//   short). What is already on the record when it starts triggers nothing; after that, an agent's verify pass
//   (phase.done, phase verify, pass true) and an agent's re-verify (verify.again) each run claim.check on that item,
//   once. A failed verify triggers nothing: it is already back in build.
//   THE TIME LIMIT: a suite still running after `suiteMs` (a manifest value) is stopped and counts as red, its why naming
//   the time limit - never as green.
//   THE RE-VERIFY: the desk gains verify.again {id}, any agent, only on a verified code item; it changes nothing but the
//   record, which is what the watcher reads.
//   NOTHING TO RUN IS NOT A PASS: an item with no test file on its list, or a listed file that is gone, is rejected.
// NOT ASSERTED: the verifier tab (his question in the box, its own item or not), and the default values.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.10: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyWatchTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskVerifyWatchTestWSLAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyWatchTestOwnerAAAAAAAAAAAAA=', label: 'andy' };
const GREEN = 'zzWatchGreen.js';
const HANG = 'zzWatchHang.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }

test.startTest('goal/G8.10: deskVerify watches the desk and starts its claim check, with a time limit');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifywatch-'));

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

async function deskHalf() {
  test.subHeading('1. the desk: verify.again, an agent\'s re-verify, on a verified code item only');
  const d = server(DESK, 'desk');
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'wa/G1', title: 'Again' }, items: [{ id: 'wa/G1.1', title: 'Built', blocks: ['wa/G1'], code: true }] }) }, CW);
    await d.call('press', { id: 'wa/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'wa/G1.1', what: 'go' }, ANDY);
    await d.call('phase.take', { id: 'wa/G1.1', phase: 'red' }, CW); await d.call('phase.done', { id: 'wa/G1.1', phase: 'red' }, CW);
    const early = await d.call('verify.again', { id: 'wa/G1.1' }, WSL);
    if (refusedByVerb(early)) test.check('before any verify, verify.again is refused');
    else test.fail(OWED + 'verify.again on an unverified item answered ' + early.status + ' ' + short(early.body));
    await d.call('phase.take', { id: 'wa/G1.1', phase: 'build' }, WSL); await d.call('phase.done', { id: 'wa/G1.1', phase: 'build' }, WSL);
    await d.call('phase.take', { id: 'wa/G1.1', phase: 'verify' }, CW); await d.call('phase.done', { id: 'wa/G1.1', phase: 'verify', pass: true }, CW);
    const before = parse((await d.call('item.get', { id: 'wa/G1.1' }, ANDY)).body.item) || {};
    const again = await d.call('verify.again', { id: 'wa/G1.1' }, WSL);
    const after = parse((await d.call('item.get', { id: 'wa/G1.1' }, ANDY)).body.item) || {};
    if (took(again)) test.check('an agent\'s verify.again on a verified code item is taken');
    else test.fail(OWED + 'verify.again answered ' + again.status + ' ' + short(again.body));
    if (after.phase === before.phase && after.builder === before.builder && JSON.stringify(after.buttons) === JSON.stringify(before.buttons)) test.check('and it changes nothing of the item: it is a word on the record for deskVerify');
    else test.fail(OWED + 'verify.again changed the item: ' + short({ before: [before.phase, before.buttons], after: [after.phase, after.buttons] }));
    const ch = (await d.call('changes', { n: 0, line: 0 }, ANDY)).body || {};
    if ((ch.records || []).some(function (r) { return r.verb === 'verify.again' && (parse(r.body) || {}).id === 'wa/G1.1'; })) test.check('the record carries it, verb verify.again with the item id');
    else test.fail(OWED + 'no verify.again record in changes: ' + short((ch.records || []).slice(-2)));
  } finally { await d.stop(); }
}

async function verifyHalf() {
  test.subHeading('2. deskVerify watches: a new verify pass or re-verify runs the check by itself, once');
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('watch probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  fs.writeFileSync(path.join(__dirname, HANG), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('hang probe');\nsetInterval(function () {}, 1000);\n");
  const files = function (f) { return [{ path: 'spirit/test/' + f, by: 'claude-windows', core: false }]; };
  const ITEMS = { 'wt/G1.0': files(GREEN), 'wt/G1.1': files(GREEN), 'wt/G1.2': files(GREEN), 'wt/G1.3': files(HANG), 'wt/G1.4': files(GREEN), 'wt/G1.5': [], 'wt/G1.6': files('zzWatchGone.js') };
  const records = [];
  const rec = function (verb, body, by) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: by || 'wsl-claude', key: '', body: JSON.stringify(body) }); };
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
            const recs = records.filter(function (r) { return r.n > from; });
            out = { records: recs, lines: [], n: records.length, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'wt/G1', code: true, go: true, files: ITEMS[a.id] || [] }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  // Already on the record when deskVerify starts: it must not re-check history.
  rec('phase.done', { id: 'wt/G1.0', phase: 'verify', pass: true });
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db'), watchMs: 300, suiteMs: 2000 }, run);
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && x.args.id === id; }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    await sleep(1500);
    if (!said('verify.pass', 'wt/G1.0').length && !said('verify.reject', 'wt/G1.0').length) test.check('a verify pass already on the record when it starts triggers nothing');
    else test.fail(OWED + 'it re-checked history: ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.0'; })));

    rec('phase.done', { id: 'wt/G1.1', phase: 'verify', pass: true });
    rec('phase.done', { id: 'wt/G1.2', phase: 'verify', pass: false });
    const passed = await waitFor(function () { return said('verify.pass', 'wt/G1.1').length > 0; }, 8000);
    if (passed) test.check('a new verify pass: within seconds, unasked, it ran the item\'s suites and asked verify.pass');
    else test.fail(OWED + 'no verify.pass for wt/G1.1; the desk was asked ' + short(asks));
    if (!said('item.get', 'wt/G1.2').length && !said('verify.pass', 'wt/G1.2').length && !said('verify.reject', 'wt/G1.2').length) test.check('a failed verify triggers nothing');
    else test.fail(OWED + 'a failed verify was checked: ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.2'; })));
    await sleep(1500);
    if (said('verify.pass', 'wt/G1.1').length === 1) test.check('and it checks that pass once, not on every read');
    else test.fail(OWED + 'verify.pass for wt/G1.1 was asked ' + said('verify.pass', 'wt/G1.1').length + ' times');

    rec('verify.again', { id: 'wt/G1.4' }, 'wsl-claude');
    if (await waitFor(function () { return said('verify.pass', 'wt/G1.4').length > 0; }, 8000)) test.check('an agent\'s verify.again runs the check too');
    else test.fail(OWED + 'no check after verify.again; asked ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.4'; })));

    test.subHeading('3. the time limit: a suite that hangs is stopped and counts as red');
    rec('phase.done', { id: 'wt/G1.3', phase: 'verify', pass: true });
    const rejected = await waitFor(function () { return said('verify.reject', 'wt/G1.3').length > 0 || said('verify.pass', 'wt/G1.3').length > 0; }, 10000);
    const rj = said('verify.reject', 'wt/G1.3');
    if (rejected && rj.length === 1 && !said('verify.pass', 'wt/G1.3').length) test.check('the hung suite is stopped after its limit and the claim is rejected, never passed');
    else test.fail(OWED + 'for the hung suite: ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.3'; })));
    if (rj.length && /time/i.test(String(rj[0].args.why)) && new RegExp(HANG.replace('.', '\\.')).test(String(rj[0].args.why))) test.check('its why names the suite and the time limit');
    else test.fail(OWED + 'the why reads ' + short(rj.length ? rj[0].args.why : '(none)'));
    // GROWN BEFORE HANDOVER (claude-windows): claim.check with nothing to run asked verify.pass - an item with no test
    // file on its list, or a listed file that is gone, passed the machine without a single assertion.
    test.subHeading('4. nothing to run is not a pass');
    rec('phase.done', { id: 'wt/G1.5', phase: 'verify', pass: true });
    rec('phase.done', { id: 'wt/G1.6', phase: 'verify', pass: true });
    await waitFor(function () { return ['wt/G1.5', 'wt/G1.6'].every(function (id) { return said('verify.reject', id).length || said('verify.pass', id).length; }); }, 8000);
    if (!said('verify.pass', 'wt/G1.5').length && said('verify.reject', 'wt/G1.5').length === 1) test.check('an item with no test file on its list is rejected, not passed');
    else test.fail(OWED + 'no test file: ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.5'; })));
    if (!said('verify.pass', 'wt/G1.6').length && said('verify.reject', 'wt/G1.6').length === 1 && /zzWatchGone\.js/.test(String(said('verify.reject', 'wt/G1.6')[0].args.why))) test.check('a listed test file that is missing is rejected, naming it');
    else test.fail(OWED + 'missing test file: ' + short(asks.filter(function (x) { return x.args.id === 'wt/G1.6'; })));
    const pressed = asks.filter(function (x) { return x.verb === 'press' || x.verb === 'check.set'; });
    if (!pressed.length) test.check('it pressed nothing on his behalf');
    else test.fail(OWED + 'deskVerify asked ' + short(pressed));
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
  try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
