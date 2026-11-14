'use strict';

// spirit/run/spirit/test/appClient.js
// The tests of spirit/appClient.js, the node's client of its app servers, and of no other module (spec: ./appClient.md).
// It runs a scratch node and asks it as the owner, on loopback, as a page on that machine does (POST /api/spirit). The
// family asked is a throwaway app server planted in the scratch copy, whose one verb answers a text past ANSWER_MAX.
// (No branch carries an FS set since goal/G43.20, so no server's folder is read through one.)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The runs of an app's script on the scratch node: spirit/test/headLessChrome.js's, the one watch the tests share.
const runsOf = H.appRuns;

const NAME = 'zzbig';
const SIZE = limits.ANSWER_MAX + 4000;

// The scratch copy: the tracked files of spirit/run, and the throwaway app, turned on as its owner turns one on.
function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  const dir = path.join(run, 'spirit', 'app', NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, NAME + '.json'), JSON.stringify({ identity: { icon: '🧪', label: NAME, intrinsic: false }, mount: { [NAME + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }));
  fs.writeFileSync(path.join(dir, NAME + '.js'), "'use strict';\nif (typeof window === 'undefined') {\n  require('../../spirit.js');\n  const n = " + SIZE + ";\n  require('../../appServer.js').serve({ big: { request: {}, reply: {}, handler: function () { return { text: Array.from({ length: n }, function (x, i) { return String.fromCharCode(97 + (i % 26)); }).join('') }; } } }, {});\n}\n");
  fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { big: {} } };\n');
  const state = path.join(run, 'spirit', 'state', NAME);
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'node.json'), JSON.stringify({ active: true }));
  // Icons, the first one-shot app (goal/G43.19), switched on too.
  fs.mkdirSync(path.join(run, 'spirit', 'state', 'icons'), { recursive: true });
  fs.writeFileSync(path.join(run, 'spirit', 'state', 'icons', 'node.json'), JSON.stringify({ active: true }));
  return { root: root, run: run };
}

// What the tests share: the scratch copy, its node and the answers later tests judge.
const W = {};
const post = function (call, args) {
  return fetch(W.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
    .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
      function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
};
function noNode() { return W.up ? null : 'no scratch node: the world failed'; }

// goal/G41.28: the owner's answer on loopback comes back whole.
// The ruling cw built to: on loopback the owner's call is marked, and appClient and appServer let that one answer
// past ANSWER_MAX; every other answer stays bounded. A manager bigger than one answer then loads whole.
test.run('the world: the scratch node and its zzbig server come up', 0.2, async function () {
  W.s = scratch();
  const port = await H.freePort();
  W.child = LABH.startNodeOn(W.s.run, port);
  W.base = 'http://127.0.0.1:' + port;
  W.up = await H.until(function () { return post(NAME + '.big', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return W.up || 'the scratch node or its ' + NAME + ' server did not come up: nothing judged';
}, test.limit.slow);
test.after(async function () {
  try { if (W.child) W.child.kill(); } catch (e) { /* gone */ }
  await H.sleep(500);
  try { if (W.s) LABH.freeTree(W.s); } catch (e) { /* scratch */ }
});
test.run('the owner\'s big answer, larger than one answer may be, comes back whole on loopback', 0.2, async function () {
  if (noNode()) return noNode();
  const got = await post(NAME + '.big', {});
  const back = got.body && got.body.text;
  return (got.status === 200 && typeof back === 'string' && back.length === SIZE) ||
    'the owner\'s answer of ' + SIZE + ' bytes came back ' + got.status + ': ' + (typeof back === 'string' ? back.length + ' bytes' : short(got.text));
}, test.limit.quick);

// ── TWO KINDS OF ROW: PERMANENT AND ONE-SHOT (goal/G43.19, box v16) ──
// Andy: "there will simply be two kinds, permanent or one-shot processes.", "the node must execute
// spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that process
// lives only as long as the request." Icons is the first one-shot app; its verbs are its own api.js's.
// The box, 3: a one-shot row, the script spirit/app/<name>/<name>.js started per call; 8: the api tree asks it too.
test.run('the world: icons\'s api.js names its verbs', 0.2, function () {
  if (noNode()) return noNode();
  let verbs = [];
  try { verbs = Object.keys(require(path.join(W.s.run, 'spirit', 'app', 'icons', 'api.js')).verbs || {}); } catch (e) { verbs = []; }
  return verbs.length >= 1 || 'icons has no api.js with verbs: no one-shot row to judge';
}, test.limit.quick);
test.run('the world: the process list finds the permanent zzbig.js running, once', 0.2, async function () {
  if (noNode()) return noNode();
  await H.sleep(1500);
  return runsOf(W.s.root, NAME).length === 1 || 'the process list finds ' + short(runsOf(W.s.root, NAME)) + ' of ' + NAME + '.js, so it cannot judge a run';
}, test.limit.slow);
test.run('icons is switched on and nothing runs icons.js: no permanent process', 0.2, function () {
  if (noNode()) return noNode();
  return runsOf(W.s.root, 'icons').length === 0 || 'icons.js runs while nothing asks it: ' + short(runsOf(W.s.root, 'icons'));
}, test.limit.quick);
test.run('the api tree holds icons, its branch asked of its one-shot row', 0.2, async function () {
  if (noNode()) return noNode();
  const tree = W.tree = await post('api', {});
  return (tree.status === 200 && !!(tree.body && tree.body.icons)) || 'the tree: ' + tree.status + ' ' + short(tree.body && Object.keys(tree.body));
}, test.limit.quick);
test.run('and the permanent row, zzbig, beside it, as today', 0.2, function () {
  if (!W.tree) return 'no tree: the test before it failed';
  const tree = W.tree;
  return !!(tree.body && tree.body[NAME]) || 'the tree lost ' + NAME + ': ' + short(tree.body && Object.keys(tree.body));
}, test.limit.quick);
test.run('the run that answered the tree has ended', 0.2, async function () {
  if (noNode()) return noNode();
  return (await H.until(function () { return Promise.resolve(runsOf(W.s.root, 'icons').length === 0); }, 3000)) || 'icons.js still runs after the tree was answered: ' + short(runsOf(W.s.root, 'icons'));
}, test.limit.slow);

// The box, 9: "one run per app at a time: calls to the same one-shot app wait their turn".
test.run('six trees asked at once: each holds the icons branch', 0.2, async function () {
  if (noNode()) return noNode();
  const watch = H.watchRuns(W.s.root, 'icons', { base: W.base });
  const many = await Promise.all([0, 1, 2, 3, 4, 5].map(function () { return post('api', {}); }));
  await H.sleep(300);
  W.watched = await watch.stop();
  return many.every(function (r) { return r.status === 200 && !!(r.body && r.body.icons); }) || 'answers: ' + short(many.map(function (r) { return r.status + (r.body && r.body.icons ? '+icons' : '-icons'); }));
}, test.limit.slow);
test.run('the world: runs of icons.js were seen while they were answered', 0.2, function () {
  if (!W.watched) return 'no runs watched: the test before it failed';
  const { seen, pids } = W.watched;
  return (seen >= 1 || pids >= 2) || 'no run of icons.js was ever seen, so "one at a time" judged nothing (' + seen + ' samples, ' + pids + ' pids its job named)';
}, test.limit.quick);
test.run('never two runs of icons.js at once', 0.2, function () {
  if (!W.watched) return 'no runs watched: the test before it failed';
  return W.watched.most <= 1 || W.watched.most + ' runs of icons.js at once';
}, test.limit.quick);
test.run('and none is left running', 0.2, async function () {
  if (noNode()) return noNode();
  return (await H.until(function () { return Promise.resolve(runsOf(W.s.root, 'icons').length === 0); }, 3000)) || 'icons.js runs after all were answered: ' + short(runsOf(W.s.root, 'icons'));
}, test.limit.slow);

// ── THE NODE RUNS NO APP CODE; appServer CHECKS, IN THE APP'S PROCESS (goal/G43.32) ──
// Andy: "isolation, we don't want the NODE to run the validation, because we want the node kept safe from "foreign"
// code.", "so, really the appClient.js has no business running or parsing code. that must be done by the plugin. i
// don't care if it's spirit/appServer.js, since it'll crash with the server process and leave the node intact.", and
// "for one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js", then the
// appServer module "requires" that script and passes it a ready-made spirit-object with it's spirit.check already done".
// The box: "The node starts every app server, one-shot and long-running alike, as appServer.js with the app's path".
// The node runs no app code: every app server is appServer.js with the app's path, and checks in its own process.
test.run('appClient.js loads no app\'s api.js, nor any of its code', 0.2, function () {
  const own = fs.readFileSync(path.join(RUN, 'spirit', 'appClient.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (!/\brequire\s*\([^)]*\bapi\b/.test(own) && !/\bspirit\.require\s*\([^)]*api/.test(own)) || 'appClient.js still loads an app\'s code: ' + short(own.match(/\b(spirit\.)?require\s*\([^)]*api[^)]*\)/g));
}, test.limit.quick);
const cmdOf = function (pid) { try { return fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' '); } catch (e) { return ''; } };
// The process command lines are read on Linux only; elsewhere these tests are not registered, as they were not judged.
if (process.platform === 'linux') {
  test.run('the permanent zzbig runs as spirit/appServer.js with its path', 0.2, function () {
    if (noNode()) return noNode();
    const perm = runsOf(W.s.root, NAME).map(cmdOf).filter(Boolean);
    return (perm.length === 1 && /spirit[\\/]appServer\.js\s/.test(perm[0]) && perm[0].indexOf(path.join('spirit', 'app', NAME, NAME + '.js')) > perm[0].indexOf('appServer.js')) ||
      'the permanent ' + NAME + ' runs as ' + short(perm);
  }, test.limit.quick);
  test.run('a call that breaks icons\'s api.js (op 42, not an id) is refused 400', 0.2, async function () {
    if (noNode()) return noNode();
    // A run started for the call is a pid of the icons job's that was not its pid before the call; its command line is
    // read while it runs.
    const pidNow = function () { return post('job.get', { key: 'spirit.app.icons' }).then(function (r) { return String((r.body && r.body.job && r.body.job.data && r.body.job.data.pid) || ''); }); };
    const before = await pidNow();
    const fresh = [];
    const seenCmd = [];
    let looking = true;
    const sampler = (async function () {
      while (looking) {
        const p = await pidNow();
        if (p && p !== before && fresh.indexOf(p) === -1) fresh.push(p);
        runsOf(W.s.root, 'icons').map(cmdOf).filter(Boolean).forEach(function (c) { if (seenCmd.indexOf(c) === -1) seenCmd.push(c); });
        await H.sleep(5);
      }
    }());
    const bad = await post('icons.icon', { op: 42 });
    await H.sleep(300);
    looking = false;
    await sampler;
    W.oneShot = { before: before, fresh: fresh, seenCmd: seenCmd };
    return bad.status === 400 || 'icons.icon {op: 42} answered ' + bad.status + ' ' + short(bad.text);
  }, test.limit.quick);
  test.run('and it was refused by icons\'s own run, not by the node: a run of icons started for it', 0.2, function () {
    if (!W.oneShot) return 'no bad call made: the test before it failed';
    return W.oneShot.fresh.length >= 1 || 'no run of icons started for the bad call (the job\'s pid stayed ' + (W.oneShot.before || 'none') + '): the node refused it itself, running the app\'s api.js';
  }, test.limit.quick);
  test.run('that run is spirit/appServer.js with icons\'s path', 0.2, function () {
    if (!W.oneShot) return 'no bad call made: the test before it failed';
    const seenCmd = W.oneShot.seenCmd;
    return (seenCmd.length >= 1 && seenCmd.every(function (c) { return /spirit[\\/]appServer\.js\s/.test(c); })) || 'the one-shot ran as ' + short(seenCmd.length ? seenCmd : 'nothing seen');
  }, test.limit.quick);
}
