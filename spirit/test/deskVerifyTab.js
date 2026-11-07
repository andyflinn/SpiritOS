'use strict';

// goal/G8.11: the verifier tab in Desk.
//   Andy, 2026-10-09: "So, i was thinking. shouldn't i have, if the desk verifier is mounted and running, a verifier
//   tab in desk, right after [musings], that allows me to monitor a) status and progress of the running verifier, and
//   if/when necessary, allow intervention?", then "i still don't see a verifier tab on my desk", and "add it".
//
// THE SHAPE ASSERTED (goal/G33.3: deskVerify is a runner that knows no item, and the box: "The Verifier tab shows
// only what runs now, its console, and Stop."):
//   deskVerify: now {} -> {busy, running: {suite, since}, stopAsked}; stop {} -> {stopped}, ending the suite running
//   now, the run kept as stopped, never green.
// NOT ASSERTED: layout, colours and refresh timing - UI that is his to judge on his own node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G8.11: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyTabTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const SLOW = 'zzTabSlow.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G8.11: the verifier tab in Desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifytab-'));

async function serverHalf() {
  // A run is handed to deskVerify with run {suites, commit} (goal/G33.3); it asks the desk nothing.
  test.subHeading('1. deskVerify: now and stop');
  fs.writeFileSync(path.join(__dirname, SLOW), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('tab slow probe');\nsetTimeout(function () { test.check('slow'); test.reportSuccessFailureCount(); process.exit(0); }, 8000);\n");
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          const a = flatCall.desk[verb] || {};
          {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.files') out = { files: (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }) || {}).files ? (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }).files || []).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }) : [], filesMore: false }; // goal/G32.2: the file list is its own answer
            else if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'verify');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify({ db: path.join(root, 'verify.db'), watchMs: 300, suiteMs: 60000, pull: '' }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: deskVerify did not start'); return; }

    const idleNow = await call('now');
    if (took(idleNow) && idleNow.body.busy === false && idleNow.body.running && idleNow.body.running.suite === '') test.check('now, idle: not busy, nothing running');
    else test.fail(OWED + 'now answered ' + idleNow.status + ' ' + short(idleNow.body));

    await call('run', { suites: ['spirit/test/' + SLOW], commit: '' });
    await sleep(2500);
    const busy = await call('now');
    const r = busy.body && busy.body.running;
    if (took(busy) && busy.body.busy === true && r && /zzTabSlow\.js/.test(String(r.suite)) && r.since) test.check('now, while a run runs: busy, its suite and since when');
    else test.fail(OWED + 'now during a run answered ' + busy.status + ' ' + short(busy.body));

    const stop = await call('stop');
    let done = false;
    for (let i = 0; i < 25 && !done; i++) { await sleep(200); done = ((await call('now')).body || {}).busy === false; }
    if (took(stop) && stop.body.stopped === true && done) test.check('stop ends the run at once');
    else test.fail(OWED + 'stop answered ' + stop.status + ' ' + short(stop.body) + (done ? '' : '; the run was still on 5 s later'));
    const rows = ((((await call('search', { over: 'runs', suite: SLOW })).body || {}).items) || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return null; } }).filter(Boolean);
    if (rows.length === 1 && rows[0].outcome === 'stopped' && rows[0].suites[0].outcome === 'stopped') test.check('a stopped run is kept as stopped, never green');
    else test.fail(OWED + 'after stop the run reads ' + short(rows));
    const after = await call('now');
    if (took(after) && after.body.busy === false && after.body.running && after.body.running.suite === '') test.check('and now reads idle again');
    else test.fail(OWED + 'now after stop answered ' + short(after.body));
    if (!asks.length) test.check('and deskVerify asked the desk nothing');
    else test.fail(OWED + 'deskVerify asked the desk ' + short(asks.slice(0, 4)));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
    try { fs.unlinkSync(path.join(__dirname, SLOW)); } catch (e) { /* gone */ }
  }
}

(async function () {
  await serverHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, SLOW)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
