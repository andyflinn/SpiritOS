'use strict';

// spirit/test/faceProofProcess.js
// faceProof MOVES INTO process/ — slim/G1.4, written FIRST, red on today's code.
//
//   Andy, 2026-09-29: "faceProof moves", and no special review: "it only
//   serves an in-memory-counter. so no- i have no security worries there."
//
// THE CONTRACT (wsl-claude's tests, claude-windows' build):
//   T1 faceProof runs from process/js/faceProof, started as the node starts
//      it (appClient.startAll), and serves its page and app.state as before
//   T2 its state is in relay-state/process/faceProof; no app-state/ is made
//   T3 only its declared files are served: its page (and the shared ask.js);
//      not its manifest, not another file in its folder, not a script there
//      (under process/ a .js is a server's own code), and nothing of any
//      other process
// The fixture is a copy of this checkout's tree, so it holds faceProof
// wherever the checkout keeps it: today shell/faceProof, which T1 refuses.

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const plantRun = require('./plantRun.js');
const { pipeRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by slim/G1.4: ';
const RUN = path.join(__dirname, '..', 'run');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function get(pipe, p) { return pipeRequest(pipe, 'GET', p, '', { timeoutMs: 2000 }).catch(function (e) { return { status: 0, text: String(e && e.message) }; }); }

test.startTest('slim/G1.4: faceProof moves into process/');

(async function () {
  // A WHOLE TREE, COPIED (plantRun), never a link to this checkout's js/:
  // a server resolves its root from its own file, so through a link it
  // would read and write the checkout, and the fixture would test nothing.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-faceproof-process-'));
  const root = path.join(scratch, 'spirit', 'run');
  plantRun.plantRunTree(root);
  fs.rmSync(path.join(root, 'relay-state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const own = path.join(root, 'process', 'js', 'faceProof');
  // Where it lives now, before anything is planted beside it.
  const moved = fs.existsSync(path.join(own, 'faceProof.json')) && !fs.existsSync(path.join(root, 'shell', 'faceProof'));
  // What must never be served, planted beside it; desk.js is another
  // process's real script, already in the tree.
  fs.mkdirSync(own, { recursive: true });
  fs.writeFileSync(path.join(own, 'notes.txt'), 'NOT-FOR-STRANGERS');
  fs.writeFileSync(path.join(own, 'faceProof.js'), '/* SERVER-SCRIPT */');

  // A test node includes what it starts, for this run (slim/G1.3 T6).
  require('../run/js/includeList.js').add(root, 'process/js/faceProof');
  // Started as the node starts it: whatever startAll hands startServerJob.
  const started = [];
  const client = appClient.createAppClient({ rootDir: root, log: function () {},
    startServerJob: function (cmd, args, opts) { started.push({ cmd: cmd, args: args, opts: opts }); return null; } });
  const apps = client.startAll();
  const row = started.filter(function (s) { return s.args.indexOf('faceProof') !== -1; })[0];
  let child = null;
  let pipe = '';
  let page = null;
  let state = null;
  if (row) {
    pipe = row.args[row.args.indexOf('--pipe') + 1];
    child = childProcess.spawn(row.cmd, row.args, { cwd: row.opts.cwd, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 40; i++) {
      page = await get(pipe, '/');
      if (page && page.status === 200) break;
      await sleep(250);
    }
    const s = await pipeRequest(pipe, 'POST', '/api/spirit', JSON.stringify({ verb: 'app.state' }), { type: 'application/json', timeoutMs: 3000 }).catch(function () { return null; });
    try { state = JSON.parse(s.text); } catch (e) { state = null; }
  }

  test.subHeading('T1: faceProof runs from process/js/faceProof and serves its page as before');
  if (moved && row && page && page.status === 200 && /Hello from an app server/.test(page.text) && state && state.appName === 'faceProof') {
    test.check('startAll started it from process/js/faceProof; GET / is its page and app.state names faceProof');
  } else test.fail(OWED + 'in process/js and not shell/ ' + moved + ', started ' + JSON.stringify(apps) + ', page ' + (page && page.status) + ', app.state ' + JSON.stringify(state).slice(0, 80));

  test.subHeading('T2: its state is in relay-state/process/faceProof; no app-state/ is made');
  const stateDir = path.join(root, 'relay-state', 'process', 'faceProof');
  const pipeInside = !!pipe && (process.platform === 'win32' || path.resolve(pipe).indexOf(stateDir) === 0);
  const identity = fs.existsSync(path.join(stateDir, 'relay-state', 'identity.json'));
  if (row && identity && pipeInside && !fs.existsSync(path.join(root, 'app-state'))) {
    test.check('relay-state/process/faceProof holds its identity and its door, and there is no app-state/');
  } else test.fail(OWED + 'its identity under relay-state/process/faceProof ' + identity + ', pipe ' + JSON.stringify(pipe) + ', app-state/ made ' + fs.existsSync(path.join(root, 'app-state')));

  test.subHeading('T3: only its declared files are served; nothing else under process/ is');
  const got = {};
  if (row) for (const p of ['/faceProof.html', '/ask.js', '/faceProof.json', '/notes.txt', '/faceProof.js', '/desk.js', '/process/js/desk/desk.js', '/../desk/desk.js']) got[p] = (await get(pipe, p)).status;
  const leaked = ['/faceProof.json', '/notes.txt', '/faceProof.js', '/desk.js', '/process/js/desk/desk.js', '/../desk/desk.js'].filter(function (p) { return got[p] === 200; });
  if (row && got['/faceProof.html'] === 200 && got['/ask.js'] === 200 && !leaked.length) {
    test.check('its page and ask.js are served; its manifest, a note, a script beside it and another process\'s script are not');
  } else test.fail(OWED + JSON.stringify(got) + (leaked.length ? ', served: ' + leaked.join(' ') : ''));

  if (child) child.kill();
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
