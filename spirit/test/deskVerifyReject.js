'use strict';

// goal/G8.3: deskVerify on his clone rejects a claim of done its run does not bear out, and does nothing else of his.
// Red on today's tree; claude-windows wrote it from G8.3's box and does not build it.
//   Andy, 2026-10-09: "deskVerify only reject a done claim. this should prompt an agent to pick the item up, raise
//   red-questions if neccessary.", "deskVerify will NOT press done or closed on my behalf", "my deskVerify clone IS me,
//   it's restricted by it's programming, not by the auth module", and "deskVerify will test all new incoming changes".
//
// WHAT IS TRUE TODAY (read at 19488845): a verify pass marks a code item verified and offers Done (desk.js phase.done,
// buttons); nothing can take that back, and deskVerify runs suites but tells the desk nothing.
//
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.3 for him to overrule:
//   THE DESK: verify.reject {id, why}, his alone (deskVerify writes as him), only on a verified code item: the item
//   goes back to build with the builder it had, no Done is offered, and one line by desk under it carries the why -
//   the way a failed verify reads today, so the agent who built it picks it up.
//   deskVerify: claim.check {id} -> {rejected, reds}: runs the item's suites (its G8.8 file list) as loop.once does; any
//   red assertion, and it calls verify.reject naming the reds; all green, and it calls nothing. It never presses.
// NOT ASSERTED: what starts claim.check (the desk's nudge on a verify pass, goal/G8.5's path), and whether a goal
// closure re-runs what is stored (G8.3's one point still to argue).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.3: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyRejectTestCWAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskVerifyRejectTestWSLAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyRejectTestOwnerAAAAAAAAAAAA=', label: 'andy' };
const PROBE = 'zzRejectProbe.js';
const PROBE_PATH = path.join(__dirname, PROBE);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }

test.startTest('goal/G8.3: deskVerify rejects a claim of done its run does not bear out, and presses nothing');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyreject-'));

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
    root: root,
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

async function deskHalf() {
  test.subHeading('1. the desk: verify.reject sends a verified item back to its builder');
  const d = server(DESK, 'desk');
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'rj/G1', title: 'Reject' }, items: [{ id: 'rj/G1.1', title: 'Built', blocks: ['rj/G1'], code: true }] }) }, CW);
    await d.call('press', { id: 'rj/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'rj/G1.1', what: 'go' }, ANDY);
    await d.call('phase.take', { id: 'rj/G1.1', phase: 'red' }, CW); await d.call('phase.done', { id: 'rj/G1.1', phase: 'red' }, CW);
    await d.call('phase.take', { id: 'rj/G1.1', phase: 'build' }, WSL); await d.call('phase.done', { id: 'rj/G1.1', phase: 'build' }, WSL);
    await d.call('phase.take', { id: 'rj/G1.1', phase: 'verify' }, CW); await d.call('phase.done', { id: 'rj/G1.1', phase: 'verify', pass: true }, CW);
    const facts = async function () { return parse((await d.call('item.get', { id: 'rj/G1.1' }, ANDY)).body.item) || {}; };
    const f0 = await facts();
    if ((f0.buttons || []).indexOf('done') !== -1 && f0.builder === 'wsl-claude') test.check('the world: rj/G1.1 verified, offering Done, built by wsl-claude');
    else { test.fail('the world: ' + short({ buttons: f0.buttons, builder: f0.builder, phase: f0.phase })); return; }

    const agent = await d.call('verify.reject', { id: 'rj/G1.1', why: 'not his' }, CW);
    if (refusedByVerb(agent)) test.check('an agent\'s verify.reject is refused: deskVerify writes as him');
    else test.fail(OWED + 'an agent\'s verify.reject answered ' + agent.status + ' ' + short(agent.body));
    const rej = await d.call('verify.reject', { id: 'rj/G1.1', why: 'red: zzRejectProbe.js "it is still red"' }, ANDY);
    const f1 = await facts();
    if (took(rej) && f1.phase === 'build' && (f1.buttons || []).indexOf('done') === -1 && f1.builder === 'wsl-claude') test.check('his verify.reject puts rj/G1.1 back in build, with its builder, and Done is gone');
    else test.fail(OWED + 'verify.reject answered ' + rej.status + ' ' + short(rej.body) + '; facts ' + short({ phase: f1.phase, buttons: f1.buttons, builder: f1.builder }));
    const chat = ((await d.call('item.chat', { id: 'rj/G1.1' }, ANDY)).body || {}).chat || [];
    if (chat.some(function (l) { return l.by === 'desk' && /it is still red/.test(l.text); })) test.check('one line by desk carries the why');
    else test.fail(OWED + 'no desk line with the why: ' + short(chat.slice(-2)));
    const again = await d.call('verify.reject', { id: 'rj/G1.1', why: 'twice' }, ANDY);
    if (refusedByVerb(again)) test.check('an item not verified cannot be rejected');
    else test.fail(OWED + 'verify.reject on an unverified item answered ' + again.status + ' ' + short(again.body));
  } finally { await d.stop(); }
}

async function verifyHalf() {
  test.subHeading('2. deskVerify: claim.check runs the item\'s suites and rejects on a red, pressing nothing');
  fs.writeFileSync(PROBE_PATH, [
    "'use strict';",
    "const test = require('./testSupport.js');",
    "test.startTest('reject probe');",
    "if (process.env.PROBE_GREEN === '1') test.check('it is still red'); else test.fail('it is still red', 'detail 7');",
    'test.reportSuccessFailureCount();',
    'process.exit(0);',
  ].join('\n'));
  const asks = [];
  const records = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.ask === 'api') out = { desk: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          asks.push({ verb: verb, args: j.ask.desk[verb] });
          if (verb === 'item.get') out = { item: JSON.stringify({ id: 'rj/G1.1', goal: 'rj/G1', go: true, status: 'running', files: [{ path: 'spirit/test/' + PROBE, by: 'claude-windows', core: false }] }), version: 1, change: 1 };
          else out = { change: 1 };
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) { records.push(j.ask.deskVerify.record); out = { written: true }; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db') }, run);
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    const r1 = await v.call('claim.check', { id: 'rj/G1.1' }, ANDY);
    const rejects = asks.filter(function (a) { return a.verb === 'verify.reject'; });
    if (took(r1) && r1.body.rejected === true && rejects.length === 1 && rejects[0].args.id === 'rj/G1.1' && /it is still red/.test(rejects[0].args.why)) {
      test.check('a red suite: it answers rejected and asks the desk verify.reject, naming the red');
    } else test.fail(OWED + 'claim.check answered ' + r1.status + ' ' + short(r1.body) + '; the desk was asked ' + short(asks));
    // The probe turns green the way a fix lands: its file changes. deskVerify started before this line, so a variable
    // set here would never reach the suites it runs.
    fs.writeFileSync(PROBE_PATH, fs.readFileSync(PROBE_PATH, 'utf8').replace("process.env.PROBE_GREEN === '1'", 'true'));
    const before = asks.filter(function (a) { return a.verb === 'verify.reject'; }).length;
    const r2 = await v.call('claim.check', { id: 'rj/G1.1' }, ANDY);
    const after = asks.filter(function (a) { return a.verb === 'verify.reject'; }).length;
    if (took(r2) && r2.body.rejected === false && after === before) test.check('all green: it answers not rejected and asks nothing of the desk');
    else test.fail(OWED + 'with the probe green, claim.check answered ' + short(r2.body) + ' and asked verify.reject ' + (after - before) + ' time(s)');
    const pressed = asks.filter(function (a) { return a.verb === 'press'; });
    if (!pressed.length) test.check('it pressed nothing on his behalf: no done, no close');
    else test.fail(OWED + 'deskVerify pressed ' + short(pressed));
  } finally {
    await v.stop();
    node.close();
  }
}

(async function () {
  await deskHalf();
  await verifyHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(PROBE_PATH); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
