'use strict';

// goal/G8.7: tolerated reds - the goal's Done waits on one grant listing the reds outside its scope. Red on today's
// tree; claude-windows wrote it from G8.7's box and does not build it.
//   Andy, 2026-10-06: "for now, tolerated reds have to be granted as a whole, in order to pop the Done button for the
//   goal, so the final full suite lists the reds outside the goals scope in a red-question for the goal, that blocks the
//   Done button for the goal."
//
// WHAT IS TRUE TODAY (read at d98629d0): deskVerify keeps the dataset (goal/G8.1), runs the goal's suites (goal/G8.6)
// and an item's (goal/G8.3). Nothing reads the dataset for a goal, and nothing puts the reds outside it in front of him.
// A goal's Done already waits on every open grant (goal/G8.5, desk.js buttons(), grantsOpen) - so this red adds nothing
// to the desk.
//
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.7 for him to overrule:
//   "granted as a whole" is a G check, not a Q: a grant is his alone (check.set 'granted' is ownerOnly) and already
//   blocks a goal's Done, while a Q is answered by an agent and blocks nothing on a goal.
//   deskVerify: goal.check {} -> {goal, outside, asked}: reads the current goal through its own node (one items.search
//   of the current goal, closed items included), takes the newest outcome of every test in its dataset, and the reds
//   whose suite is on no item's file list of that goal are OUTSIDE. If any, it adds ONE G check on the goal naming each
//   outside suite - unless an open G of its own is already there. It runs nothing and presses nothing.
// NOT ASSERTED: what fills the dataset with a full run (runAll passes no --verify-port to its suites today), and what
// starts goal.check. Both are a red question on the item.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.7: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyToleratedOwnerAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G8.7: tolerated reds - one grant on the goal lists the reds outside it');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifytolerated-'));

const facts = function (o) { return Object.assign({ goal: 'tr/G1', status: '', go: true, files: [] }, o); };
const file = function (p) { return { path: p, by: 'claude-windows', core: false }; };
const ITEMS = [
  facts({ id: 'tr/G1', goal: '' }),
  facts({ id: 'tr/G1.1', status: 'build', files: [file('spirit/test/inGoal.js'), file('spirit/run/js/kernel.js')] }),
  // A closed item is still the goal's: its suites are inside the scope.
  facts({ id: 'tr/G1.2', status: 'closed', files: [file('spirit/test/inClosed.js')] }),
];

// A node that runs a desk (so deskVerify keeps records), answers the current goal's items, and keeps the checks asked.
function fakeNode() {
  return new Promise(function (resolve) {
    const asks = [];
    const checks = [];
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null;
        try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        const ask = j && j.ask;
        if (j && j.verb === 'jobs.api' && ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (ask && ask.desk) {
          const verb = Object.keys(ask.desk)[0];
          const args = ask.desk[verb] || {};
          asks.push({ verb: verb, args: args });
          if (verb === 'items.search') out = { items: ITEMS.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
          else if (verb === 'item.checks') out = { checks: checks.filter(function (c) { return c.id === args.id; }) };
          else if (verb === 'check.add') {
            checks.push({ id: args.id, number: 'G' + (checks.length + 1), kind: args.kind, words: args.words, test: '', state: 'open', by: 'andy', at: '' });
            out = { change: checks.length };
          } else out = { change: 1 };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, asks: asks, checks: checks, close: function () { s.close(); } }); });
  });
}

(async function () {
  const node = await fakeNode();
  const root = path.join(scratch, 'run');
  const state = path.join(root, 'relay-state', 'process', 'deskVerify');
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const kid = spawn(process.execPath, [SERVER, JSON.stringify({ db: path.join(root, 'verify.db') }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const ask = function (verb, args) {
    const q = {}; q[verb] = args || {};
    return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; });
  };
  const record = function (suite, title, outcome) { return ask('record', { suite: suite, title: title, outcome: outcome }); };
  const added = function () { return node.asks.filter(function (a) { return a.verb === 'check.add'; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (up) test.check('the world: deskVerify is up, on a node that runs a desk');
    else { test.fail('the world: deskVerify did not come up'); return; }
    const kept = await record('inGoal.js', 'a goal red', 'red');
    if (kept.status === 200 && kept.body && kept.body.written === true) test.check('the world: it keeps records here (desk mode)');
    else { test.fail('the world: the record was not kept: ' + short(kept.body)); return; }
    await record('inClosed.js', 'a closed item red', 'red');

    test.subHeading('1. only reds inside the goal: nothing is put in front of him');
    const none = await ask('goal.check');
    if (none.status === 200 && none.body && none.body.goal === 'tr/G1' && Array.isArray(none.body.outside) && !none.body.outside.length && none.body.asked === false) test.check('the goal\'s own reds, closed items included, are not outside: no grant asked');
    else test.fail(OWED + 'goal.check answered ' + none.status + ' ' + short(none.body));
    if (!added().length) test.check('the desk was asked for no check');
    else test.fail(OWED + 'check.add was asked ' + short(added()));

    test.subHeading('2. reds outside the goal: ONE grant on the goal, naming each');
    await record('outA.js', 't1', 'red');
    await record('outB.js', 't2', 'red');
    await record('outB.js', 't2', 'green');   // flipped back: its newest outcome is green, so it is not a red
    await record('outC.js', 't3', 'green');
    await record('outC.js', 't3', 'red');     // flipped to red: its newest outcome counts
    await record('outD.js', 't4', 'green');
    const two = await ask('goal.check');
    const want = ['outA.js', 'outC.js'];
    if (two.status === 200 && two.body && JSON.stringify(two.body.outside) === JSON.stringify(want) && two.body.asked === true) test.check('it answers the outside reds by their newest outcome, sorted, and that it asked');
    else test.fail(OWED + 'goal.check answered ' + two.status + ' ' + short(two.body));
    const a = added();
    if (a.length === 1 && a[0].args.id === 'tr/G1' && a[0].args.kind === 'G') test.check('one check.add, a G on the goal row');
    else test.fail(OWED + 'the checks asked: ' + short(a));
    const words = a.length ? String(a[0].args.words) : '';
    if (/outA\.js/.test(words) && /outC\.js/.test(words)) test.check('the grant names every outside suite');
    else test.fail(OWED + 'the grant reads ' + short(words));
    if (words && !/inGoal\.js|inClosed\.js|outB\.js|outD\.js/.test(words)) test.check('and nothing inside the goal, and nothing green');
    else test.fail(OWED + 'the grant reads ' + short(words));

    test.subHeading('3. a grant already open is not asked twice, and nothing is pressed or run');
    const three = await ask('goal.check');
    if (three.status === 200 && three.body && three.body.asked === false && added().length === 1) test.check('with its grant still open, a second goal.check asks for none');
    else test.fail(OWED + 'a second goal.check answered ' + short(three.body) + ' and check.add was asked ' + added().length + ' time(s)');
    const pressed = node.asks.filter(function (x) { return x.verb === 'press' || x.verb === 'check.set'; });
    if (!pressed.length) test.check('it pressed nothing and granted nothing on his behalf');
    else test.fail(OWED + 'deskVerify asked ' + short(pressed));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
