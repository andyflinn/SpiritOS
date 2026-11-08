'use strict';

// spirit/run/spirit/test/shellMove-noRescue.js
// NO shellMove RESCUE ON A BOOTED NODE (goal/G43.23, item 7; spec: ./shellMove-noRescue.md). The box: "old-data rescue still
// runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db
// owner column." This file holds shellMove's part: a real node (spirit/server.js) booted on a scratch copy of the tracked files
// of spirit/run, a file planted in app/ and a folder in app-state/, and the boot moves neither. Neither Andy's node nor an
// agent's is touched. relayKeys importOld is ./relayKeys-noRescue.js, the traffic log ./trafficLog-noRescue.js, the relay
// store ./relayStore-noRescue.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }

test.startTest('shellMove-noRescue.js: on a scratch node, shellMove moves no old folder in (goal/G43.23, item 7)');

async function bootChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-shell-'));
  let child = null;
  try {
    const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
    files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    const run = path.join(root, 'spirit', 'run');
    const LEFT = 'left in app/ ' + process.pid;
    const FACE = 'a face state in app-state/ ' + process.pid;
    put(path.join(run, 'app', 'rescueLeft', 'left.txt'), LEFT);
    put(path.join(run, 'app-state', 'rescueFace', 'state.json'), JSON.stringify({ mark: FACE }));
    ok(readText(path.join(run, 'app', 'rescueLeft', 'left.txt')) === LEFT && readText(path.join(run, 'app-state', 'rescueFace', 'state.json')).indexOf(FACE) !== -1,
      'the world: app/rescueLeft/left.txt and app-state/rescueFace/ planted in a scratch copy of ' + files.length + ' tracked files',
      'the scratch tree was not planted: nothing judged');

    const port = await freePort();
    child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () {
      return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
    }, 60000);
    ok(!!up, 'the world: the scratch node came up at ' + base, 'the scratch node did not come up in 60 s: nothing judged');
    if (!up) return;
    // What boot does it has done by now; a few seconds more for anything that follows the first answer.
    await sleep(3000);

    test.subHeading('The box: "shellMove" (moveLeftovers: app/ into shell/; moveAppState: app-state/ into relay-state/process/)');
    const leftStays = readText(path.join(run, 'app', 'rescueLeft', 'left.txt')) === LEFT;
    const leftMoved = fs.existsSync(path.join(run, 'shell', 'rescueLeft', 'left.txt'));
    ok(leftStays && !leftMoved, 'app/rescueLeft/left.txt is left where it lay; nothing moved it into shell/',
      'the boot moved app/ in: app/rescueLeft/left.txt ' + (leftStays ? 'still there' : 'gone') + ', shell/rescueLeft/left.txt ' + (leftMoved ? 'written' : 'absent'));
    const faceStays = readText(path.join(run, 'app-state', 'rescueFace', 'state.json')).indexOf(FACE) !== -1;
    const faceMoved = fs.existsSync(path.join(run, 'relay-state', 'process', 'rescueFace')) || fs.existsSync(path.join(run, 'spirit', 'state', 'rescueFace'));
    ok(faceStays && !faceMoved, 'app-state/rescueFace/ is left where it lay; nothing moved it into relay-state/process/ or spirit/state/',
      'the boot moved app-state/ in: app-state/rescueFace/state.json ' + (faceStays ? 'still there' : 'gone') + ', relay-state/process/rescueFace ' + (faceMoved ? 'written' : 'absent'));
  } finally {
    try { if (child) child.kill(); } catch (e) { /* gone */ }
    await sleep(500);
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

bootChecks().then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
