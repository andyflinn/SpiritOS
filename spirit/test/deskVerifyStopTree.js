'use strict';

// spirit/test/deskVerifyStopTree.js
// goal/G19.4: deskVerify: kill a suite's servers; normalise listed paths. Red on today's tree (eeb6cabb); claude-windows
// wrote it and builds it (one agent). The item's box: Stop and the time limit kill the suite process only, so the
// servers it started live on and the next suite collides on lab ports; a listed path like spirit/test/../../x.js
// passes. Andy, 2026-10-12: "yes, a stopped suite must clean up after itself like any cleanly ended suite. we will not
// support resume.", and "yes to the box as outlined."
//
// WHAT IS ASSERTED
//   1. Stop by hand ends the suite AND the server it started.
//   2. The time limit ends the suite AND the server it started.
//   3. A listed path that leaves spirit/test is not run, and the line on the item says so.
//   4. The desk refuses item.files.add of a path with a .. segment, saying why.
// rule/11: through testSupport only; a fake node and its own desk; it kills only the processes this suite started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G19.4: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyStopTreeTestCWAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyStopTreeTestOwnerAAAAAAAAAA=', label: 'andy' };
const HANG = 'zzStopTreeHang.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

test.startTest('goal/G19.4: a stopped or timed-out suite takes its servers with it; listed paths stay in spirit/test');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifystoptree-'));
const started = [];   // every server pid a probe suite wrote, ended at the close whatever happens

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

// ── 1 to 3. THE VERIFIER ────────────────────────────────────────────────
async function verifyHalf() {
  // THE HANGING PROBE: it starts a server of its own (a node that only waits), writes that server's pid where this
  // suite reads it, and then hangs itself, as a suite stuck in a test does.
  const pidFile = path.join(scratch, 'server.pid');
  const serverScript = 'setInterval(function () {}, 1000);';
  fs.writeFileSync(path.join(__dirname, HANG), "'use strict';\n" +
    "const { spawn } = require('child_process');\n" +
    "const s = spawn(process.execPath, ['-e', " + JSON.stringify(serverScript) + "], { stdio: 'ignore' });\n" +
    "require('fs').writeFileSync(" + JSON.stringify(pidFile) + ", String(s.pid));\n" +
    "setInterval(function () {}, 1000);\n");
  const outside = path.join(__dirname, '..', '..', 'zzStopTreeOutside.js');
  const outsideMarker = path.join(scratch, 'outside-ran.txt');
  fs.writeFileSync(outside, "require('fs').writeFileSync(" + JSON.stringify(outsideMarker) + ", 'ran');\n");
  const files = function (rel) { return [{ path: rel, by: 'claude-windows', core: false }]; };
  const ITEMS = {
    'st/G1.1': files('spirit/test/' + HANG),
    'st/G1.2': files('spirit/test/' + HANG),
    'st/G1.3': files('spirit/test/../../zzStopTreeOutside.js'),
  };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        const flatCall = test.foldAsk(j);
        let out = {};
        if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          const a = flatCall.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'st/G1', code: false, go: true, files: ITEMS[a.id] || [] }), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: [], chatMore: false };
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const probe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(probe, '// a pull that changes nothing\n');
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db'), watchMs: 300, suiteMs: 6000, pull: process.execPath + ' ' + probe }, run);
  const lineOn = function (id) { return asks.filter(function (x) { return x.verb === 'chat.add' && x.args.id === id; }).map(function (x) { return String(x.args.text || ''); }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  const serverPid = function () { try { return Number(fs.readFileSync(pidFile, 'utf8')) || 0; } catch (e) { return 0; } };
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    await sleep(1500);

    test.subHeading('1. Stop by hand ends the suite and its server');
    try { fs.unlinkSync(pidFile); } catch (e) { /* none yet */ }
    rec('press', { id: 'st/G1.1', what: 'claim-done' });
    await waitFor(function () { return serverPid() > 0; }, 15000);
    const p1 = serverPid();
    if (p1) started.push(p1);
    if (p1 && alive(p1)) test.check('the world: the hanging suite started its server (pid ' + p1 + ')');
    else test.fail('the world: no server pid from the hanging suite');
    await sleep(500);
    await v.call('stop', {});
    await waitFor(function () { return lineOn('st/G1.1').length > 0; }, 15000);
    await sleep(1500);
    if (p1 && !alive(p1)) test.check('after Stop the suite\'s server is gone too');
    else test.fail(OWED + 'after Stop the server ' + p1 + ' is still running');

    test.subHeading('2. the time limit ends the suite and its server');
    try { fs.unlinkSync(pidFile); } catch (e) { /* gone */ }
    rec('press', { id: 'st/G1.2', what: 'claim-done' });
    await waitFor(function () { return serverPid() > 0; }, 15000);
    const p2 = serverPid();
    if (p2) started.push(p2);
    await waitFor(function () { return lineOn('st/G1.2').length > 0; }, 20000);
    await sleep(1500);
    if (p2 && !alive(p2) && /time limit/i.test(lineOn('st/G1.2')[0] || '')) test.check('after the time limit the suite\'s server is gone too');
    else test.fail(OWED + 'after the time limit the server ' + p2 + (p2 && alive(p2) ? ' is still running' : ' is gone') + '; line ' + short(lineOn('st/G1.2')[0]));

    test.subHeading('3. a listed path outside spirit/test is not run');
    rec('press', { id: 'st/G1.3', what: 'claim-done' });
    await waitFor(function () { return lineOn('st/G1.3').length > 0; }, 15000);
    const line3 = lineOn('st/G1.3')[0] || '';
    if (!fs.existsSync(outsideMarker)) test.check('the file outside spirit/test was not run');
    else test.fail(OWED + 'deskVerify ran spirit/test/../../zzStopTreeOutside.js');
    if (/outside spirit\/test|leaves spirit\/test|not under spirit\/test/i.test(line3)) test.check('and the line on the item says the path leaves spirit/test');
    else test.fail(OWED + 'the line on that item reads ' + short(line3));
  } finally {
    await v.stop();
    node.close();
    try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
    try { fs.unlinkSync(outside); } catch (e) { /* gone */ }
  }
}

// ── 4. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('4. the desk refuses a listed path with a .. segment');
  const d = server(DESK, 'desk');
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'st/G2', title: 'Paths' }, items: [{ id: 'st/G2.1', title: 'Listed', blocks: ['st/G2'] }] }) }, ANDY);
    await d.call('press', { id: 'st/G2', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'st/G2.1', what: 'go' }, ANDY);
    await d.call('item.take', { id: 'st/G2.1' }, CW);
    const bad = (await d.call('item.files.add', { id: 'st/G2.1', paths: ['spirit/test/../../x.js'] }, CW)).body || {};
    const good = (await d.call('item.files.add', { id: 'st/G2.1', paths: ['spirit/test/zzFine.js'] }, CW)).body || {};
    if (bad.ok === false && bad.extra && /\.\./.test(String(bad.extra.why))) test.check('a path with .. is refused, saying why (' + bad.extra.why + ')');
    else test.fail(OWED + 'item.files.add of spirit/test/../../x.js answered ' + short(bad));
    if (good.change) test.check('a plain path is still taken');
    else test.fail('the world: a plain path answered ' + short(good));
  } finally { await d.stop(); }
}

(async function () {
  await verifyHalf();
  await deskHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  // Only the servers this suite's own probes started, by the pids they wrote.
  started.forEach(function (pid) { if (alive(pid)) { try { process.kill(pid); } catch (e) { /* gone */ } } });
  try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
