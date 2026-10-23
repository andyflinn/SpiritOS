'use strict';

// spirit/test/deskVerifyCommitBound.js
// goal/G18.10: deskVerify: commit-bound runs. Red first on 9a9a30db; claude-windows wrote
// it and builds it (one agent). Found live on 2026-10-12: deskVerify passed goal/G18.7 "at 24533a26 (dirty, not
// pulled)" while the item's commit was 227b0ad4, so it checked other code than the item's. Rewritten under goal/G33.3:
// deskVerify knows no item and no chat line any more (Andy: "deskVerify has no fucking clue about desk, desk goals or
// desk items"), so the commit travels with the run the desk hands it, and the Verifier tab has no re-verify button.
//
// WHAT IS ASSERTED
//   1. (went with goal/G33.3) THE DESK's verify.again, gone with Andy's yes, "box this and continue".
//   2. THE RUN IS BOUND TO ITS COMMIT: a run handed a commit the tree lacks measures nothing, its suite 'not run' naming
//      the commit; a run at a commit the tree holds, and one handed none, run as before.
// rule/11: through testSupport only; a fake node and its own desk; the pull is a probe, never a real git pull.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G18.10: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyCommitBoundTestOwnerAAAAAAAAAAAAA=', label: 'andy' };
const GREEN = 'zzCommitBoundGreen.js';
const MISSING = '0123456789abcdef0123456789abcdef01234567';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G18.10: a deskVerify run is bound to the commit it was handed');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifycommitbound-'));

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

// ── 2. A RUN IS BOUND TO THE COMMIT IT WAS HANDED ────────────────────────
// Since goal/G33.3 the desk hands deskVerify the item's claimed commit with the run, and deskVerify knows no item and no
// chat line: a run whose commit the tree lacks measures nothing, each suite's outcome 'not run' naming the commit.
async function verifyHalf() {
  test.subHeading('2. no green without the commit the run was handed in the tree');
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('commit-bound green probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const repo = path.join(__dirname, '..', '..');
  const head = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout || '').trim();
  // A node that answers its tree, the families' interfaces, and the records the probe posts.
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (flatCall === 'api') out = { deskVerify: {} };
        else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const probe = path.join(scratch, 'pullProbe.js');
  const pulled = path.join(scratch, 'pulled.txt');
  // A pull that changes nothing, and leaves a mark each time it is called.
  fs.writeFileSync(probe, "require('fs').appendFileSync(" + JSON.stringify(pulled) + ", 'pulled\\n');\n");
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db'), suiteMs: 20000, pull: JSON.stringify(process.execPath) + ' ' + JSON.stringify(probe) }, run);
  const rel = 'spirit/test/' + GREEN;
  // One run, handed and waited for; its outcome for the probe, read back through search.
  // The newest run by its row's key, never by time: the server's clock and this one's differ by milliseconds.
  let seenKey = 0;
  const runAt = async function (commit) {
    const taken = (await v.call('run', { suites: [rel], commit: commit }, ANDY)).body || {};
    let row = null;
    for (let i = 0; i < 100 && taken.taken === true; i++) {
      await sleep(200);
      const n = (await v.call('now', {}, ANDY)).body || {};
      if (n.busy !== false) continue;
      const items = ((((await v.call('search', { over: 'runs', suite: rel }, ANDY)).body || {}).items) || []).filter(function (x) { return Number(x.key) > seenKey; })
        .sort(function (x, y) { return Number(y.key) - Number(x.key); });
      if (!items.length) continue;
      seenKey = Number(items[0].key);
      try { row = JSON.parse(items[0].label); } catch (e) { row = null; }
      if (row) break;
    }
    return { taken: taken, row: row, one: row && Array.isArray(row.suites) ? row.suites[0] || {} : {} };
  };
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    const lacking = await runAt(MISSING);
    if (lacking.one.outcome === 'not run' && (lacking.one.failures || []).join(' ').indexOf(MISSING.slice(0, 8)) !== -1) test.check('a run handed a commit the tree lacks: nothing measured, the suite not run, naming the missing commit');
    else test.fail(OWED + 'the run at a missing commit answered ' + short(lacking.taken) + ', its row ' + short(lacking.row));
    const at = await runAt(head);
    if (at.one.outcome === 'green' && at.row && at.row.outcome === 'green') test.check('a run at a commit the tree holds runs green as before');
    else test.fail(OWED + 'the run at HEAD: ' + short(at.row));
    const none = await runAt('');
    if (none.one.outcome === 'green') test.check('a run handed no commit runs on what the tree holds');
    else test.fail(OWED + 'the run with no commit: ' + short(none.row));
    // 3. A CHANGED FILE ELSEWHERE NEVER STOPS THE PULL (goal/G33.4; Andy: "it's a very bad reason for the verifier to
    // reject a fucking run, these files are nowhere in the way of the current item's work"). The probe suite this
    // writes into spirit/test is untracked, so every run above was on a dirty tree; each one must still have pulled.
    test.subHeading('3. a dirty tree is pulled all the same');
    const pulls = fs.existsSync(pulled) ? fs.readFileSync(pulled, 'utf8').split('\n').filter(Boolean).length : 0;
    if (pulls >= 3) test.check('each of the three runs pulled first, though the tree held an uncommitted file');
    else test.fail('OWED by goal/G33.4: the runs on a dirty tree pulled ' + pulls + ' time(s) of 3; the rows say ' + short([lacking.row && lacking.row.line, at.row && at.row.line, none.row && none.row.line]));
  } finally {
    await v.stop();
    node.close();
    try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  }
}

(async function () {
  await verifyHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
