'use strict';

// spirit/run/spirit/test/jobs-stateLayout.js
// The tests of spirit/jobs.js by name: WHAT spirit/state/<name>/ HOLDS (goal/G43.20, its box; spec: ./jobs-stateLayout.md).
// jobs.js makes each app's folder and starts its server. Andy: "WSL, YOU BETTER MAKE FUCKING SURE YOU GUARD FUCKING
// spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not fucking cheat with
// the fucking tests!!!!!!!!!!!!!!!!!!!!", "put those in spirit/state/<name>/ since they belong to the node.", "cache, which is
// written by spirit/appServer.js was ALWAYS supposed to go into spirit/state/<name>/cache/", "app data, which is written by
// the app, was ALWAYS supposed to go into spirit/state/<name>/data/". A real node on a scratch copy of the tracked files,
// with no run:/process folder in it, the tree's app servers switched on. Never a live node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// What an app's folder of the node's state may hold (the box, "spirit/state/<name>/ holds node.json, cache/, data/, and on
// Linux door.sock"; Andy: "so far, so good.").
const MAY = ['node.json', 'cache', 'data'].concat(process.platform === 'win32' ? [] : ['door.sock']);
// The tree's app servers, each switched on: node mount true in their json.
const SERVERS = ['desk', 'deskClient', 'deskVerify', 'backup', 'agent'];

test.startTest('jobs-stateLayout.js: spirit/state/<name>/ holds node.json, cache/, data/ and door.sock, and nothing else; no relay-state, no process (goal/G43.20)');

(async function () {
  // A scratch copy of the tracked files, its run:/process taken out before the node starts.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-state-layout-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  fs.rmSync(path.join(run, 'process'), { recursive: true, force: true });
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
  const port = await H.freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const ask = function (call, args) {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  try {
    const up = await H.until(function () { return ask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
    ok(!!up, 'the world: the node starts on a tree with no run:/process folder', 'the node did not come up with no run:/process');
    if (!up) return;

    test.subHeading('the node starts its apps with no process/ folder');
    for (const name of SERVERS) await ask('app.active', { key: name, active: true });
    const answering = [];
    for (const name of SERVERS) {
      const a = await H.until(function () { return ask('api', { family: name }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
      if (a) answering.push(name);
    }
    ok(answering.length === SERVERS.length, 'every app server switched on starts and answers: ' + SERVERS.join(', '), 'answering: ' + short(answering) + ' of ' + short(SERVERS));
    await H.sleep(3000);

    test.subHeading('spirit/state/<name>/ holds node.json, cache/, data/ and on Linux door.sock, nothing else');
    const state = path.join(run, 'spirit', 'state');
    const folders = fs.readdirSync(state).filter(function (n) { return fs.statSync(path.join(state, n)).isDirectory(); });
    ok(SERVERS.every(function (n) { return folders.indexOf(n) !== -1; }), 'the world: each app switched on has its folder in spirit/state/', 'folders: ' + short(folders));
    folders.forEach(function (n) {
      const extra = fs.readdirSync(path.join(state, n)).filter(function (e) { return MAY.indexOf(e) === -1; });
      ok(!extra.length, 'spirit/state/' + n + '/ holds only ' + MAY.join(', '), 'spirit/state/' + n + '/ also holds ' + short(extra));
    });
    if (process.platform !== 'win32') {
      const sockets = SERVERS.filter(function (n) { return fs.existsSync(path.join(state, n, 'door.sock')); });
      ok(sockets.length === SERVERS.length, 'each app server\'s door.sock is spirit/state/<name>/door.sock', 'sockets there: ' + short(sockets));
    }

    test.subHeading('an app\'s data in spirit/state/<name>/data/: the folder the node hands it as --state');
    const handed = [];
    const list = await ask('jobs.search', { q: '' });
    for (const it of ((list.body && list.body.items) || [])) {
      const g = await ask('jobs.get', { key: it.key });
      const job = (g.body && g.body.job) || {};
      const args = (job.data && job.data.args) || job.args || [];
      const i = args.indexOf('--state');
      if (i !== -1) handed.push(path.relative(run, String(args[i + 1])).split(path.sep).join('/'));
    }
    const wrong = handed.filter(function (p) { return !/^spirit\/state\/[^/]+\/data$/.test(p); });
    ok(handed.length >= SERVERS.length && !wrong.length, 'every server is handed spirit/state/<name>/data as its --state', 'handed: ' + short(handed));

    test.subHeading('no relay-state, no process: nothing of the node lives anywhere else');
    ok(!fs.existsSync(path.join(run, 'relay-state')), 'no spirit/run/relay-state/ is made', 'the node made spirit/run/relay-state/: ' + short(fs.existsSync(path.join(run, 'relay-state')) ? fs.readdirSync(path.join(run, 'relay-state')) : []));
    ok(!fs.existsSync(path.join(run, 'process')), 'no spirit/run/process/ is made', 'the node made spirit/run/process/');
  } catch (e) {
    test.fail('the suite threw ' + (e && e.stack || e));
  } finally {
    try { child.kill(); } catch (e) { /* gone */ }
    await H.sleep(500);
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }
}());
