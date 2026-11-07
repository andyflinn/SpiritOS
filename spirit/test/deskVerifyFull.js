'use strict';

// goal/G8.12, folded in: the desk marks the goal that has emptied.
//   Andy, 2026-10-09: "why, the run-all should be triggered by: \"no items left in the goal\", by the desk itself.",
//   "will this be fixed now or not?", and "i did not say: \"add an item\", add it to this one."
//
// THE SHAPE ASSERTED, the desk's half (spirit/run/process/js/desk/desk.js):
//   when the last open item of a goal becomes done or closed, the desk writes ONE record, verb goal.emptied
//   {id: <goal>}, and publishes it. Nothing starts a run from it since goal/G33.3: the goal's Done is offered once its
//   items are, its press reading the verifier (deskVerifyDriven.js), and the goal's status claims no goal run. On an
//   item, an agent's verify pass sets the status word to say it waits for deskVerify.
// NOT ASSERTED: deskVerify itself; VERIFY below is named and not started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G8.12 (full run): ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G8.12: the full run when the goal empties');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyfull-'));

const published = [];
function apiNode(apps) {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        // What a server publishes for the node's pages (goal/G33.4: the desk's record is its rows, as published).
        if (j && j.verb === 'jobs.update') { if (j.app) published.push(j.app); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? apps : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

function server(script, name, args, root) {
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const env = Object.assign({}, process.env, args.env || {});
  const kid = spawn(process.execPath, [script, JSON.stringify(args.values || {}), '--pipe', pipe, '--state', state], { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

async function deskHalf() {
  test.subHeading('1. the desk: one goal.emptied when the last item goes, and the goal Done waits for deskVerify');
  const node = await apiNode({ desk: {}, deskVerify: {} });
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world. goal/G33.7: session.set went; both
  // goals are seeded before the desk starts, and his make-current brings each up in its turn (goal/G100 first).
  test.seedDesk(path.join(root, 'state'), [
    { goal: { id: 'goal/G100', title: 'Empties' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Two', blocks: ['goal/G100'] }] },
    { goal: { id: 'goal/G101', title: 'Status' }, items: [{ id: 'goal/G101.1', title: 'Code', blocks: ['goal/G101'], code: true }] },
  ]);
  const d = server(DESK, 'desk', { env: { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/' } }, root);
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await sleep(500);
    await d.call('press', { id: 'goal/G100', what: 'make-current' }, ANDY);
    await d.call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    // goal/G33.4: `changes` is gone; the desk's goal.emptied write is read off the row it published.
    const emptied = async function () {
      await sleep(300);
      return published.filter(function (o) { return o.verb === 'goal.emptied'; });
    };
    await d.call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'goal/G100.1', what: 'claim-done' }, CW);
    await d.call('press', { id: 'goal/G100.1', what: 'done' }, ANDY);
    if (!(await emptied()).length) test.check('one item still open: no goal.emptied yet');
    else test.fail(OWED + 'goal.emptied written with an item open');
    await d.call('press', { id: 'goal/G100.2', what: 'close' }, ANDY);
    const e = await emptied();
    if (e.length === 1 && e[0].item && e[0].item.id === 'goal/G100') test.check('the last item closed: one goal.emptied row published, naming the goal');
    else test.fail(OWED + 'goal.emptied records: ' + short(e));
    const g = parse((await d.call('item.get', { id: 'goal/G100' }, ANDY)).body.item) || {};
    // goal/G33.3: the goal's Done is offered once its items are, and the press itself reads the verifier
    // (deskVerifyDriven.js); nothing starts from goal.emptied, so its status word stays as it was.
    if ((g.buttons || []).indexOf('done') !== -1 && !/goal run/i.test(String(g.status))) test.check('the emptied goal offers Done, its press to read the verifier, and claims no goal run');
    else test.fail(OWED + 'the emptied goal reads buttons ' + short(g.buttons) + ', status ' + short(g.status));
    // The same for an item: an agent's verify pass sets the status word; the desk reads the verifier itself.
    await d.call('press', { id: 'goal/G101', what: 'make-current' }, ANDY);
    await d.call('press', { id: 'goal/G101', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'goal/G101.1', what: 'go' }, ANDY);
    const WSLX = { key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestWSLAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
    const round = async function () { // one build and verify round
      await d.call('phase.take', { id: 'goal/G101.1', phase: 'build' }, WSLX); await d.call('phase.done', { id: 'goal/G101.1', phase: 'build' }, WSLX);
      await d.call('phase.take', { id: 'goal/G101.1', phase: 'verify' }, CW); await d.call('phase.done', { id: 'goal/G101.1', phase: 'verify', pass: true }, CW);
    };
    await d.call('phase.take', { id: 'goal/G101.1', phase: 'red' }, CW); await d.call('item.suites.add', { id: 'goal/G101.1', path: 'spirit/test/deskVerifyFull.js' }, CW); await d.call('claim', { id: 'goal/G101.1', phase: 'red', commit: 'abcdef1' }, CW); await d.call('phase.done', { id: 'goal/G101.1', phase: 'red' }, CW);
    await round();
    const st = async function () { return String((parse((await d.call('item.get', { id: 'goal/G101.1' }, ANDY)).body.item) || {}).status); };
    const s1 = await st();
    if (/deskVerify/i.test(s1)) test.check('an agent\'s verify pass: the status says it waits for deskVerify');
    else test.fail(OWED + 'after the agent\'s verify pass the item status reads ' + short(s1));
  } finally { await d.stop(); node.close(); }
}

(async function () {
  await deskHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
