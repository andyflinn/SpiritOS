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
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The runs of an app's script on the scratch node: test/headLessChrome.js's, the one watch the tests share.
const runsOf = H.appRuns;

const NAME = 'zzbig';
const SIZE = limits.ANSWER_MAX + 4000;

// The scratch copy: the tracked files of spirit/run, and the throwaway app, turned on as its owner turns one on.
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appClient-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
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

test.startTest('appClient.js: the node asks its app servers');

(async function () {
  test.subHeading('goal/G41.28: the owner\'s answer on loopback comes back whole');
  // The ruling cw built to: on loopback the owner's call is marked, and appClient and appServer let that one answer
  // past ANSWER_MAX; every other answer stays bounded. A manager bigger than one answer then loads whole.
  const s = scratch();
  const port = await H.freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: s.run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const post = function (call, args) {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
      .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
        function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
  };
  try {
    const up = await H.until(function () { return post(NAME + '.big', {}).then(function (r) { return r.status === 200; }); }, 60000);
    if (!up) { test.fail('the scratch node or its ' + NAME + ' server did not come up: nothing judged'); return; }
    const got = await post(NAME + '.big', {});
    const back = got.body && got.body.text;
    ok(got.status === 200 && typeof back === 'string' && back.length === SIZE, 'the owner\'s ' + NAME + '.big of ' + SIZE + ' bytes, past ANSWER_MAX (' + limits.ANSWER_MAX + '), on loopback, comes back whole',
      'the owner\'s answer of ' + SIZE + ' bytes came back ' + got.status + ': ' + (typeof back === 'string' ? back.length + ' bytes' : short(got.text)));

    // ── TWO KINDS OF ROW: PERMANENT AND ONE-SHOT (goal/G43.19, box v16) ──
    // Andy: "there will simply be two kinds, permanent or one-shot processes.", "the node must execute
    // spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that process
    // lives only as long as the request." Icons is the first one-shot app; its verbs are its own api.js's.
    test.subHeading('the box, 3: a one-shot row, the script spirit/app/<name>/<name>.js started per call; 8: the api tree asks it too');
    let verbs = [];
    try { verbs = Object.keys(require(path.join(s.run, 'spirit', 'app', 'icons', 'api.js')).verbs || {}); } catch (e) { verbs = []; }
    ok(verbs.length >= 1, 'the world: icons\'s api.js names its verbs: ' + verbs.join(', '), 'icons has no api.js with verbs: no one-shot row to judge');
    await H.sleep(1500);
    ok(runsOf(s.root, NAME).length === 1, 'the world: the process list finds the permanent ' + NAME + '.js running, once', 'the process list finds ' + short(runsOf(s.root, NAME)) + ' of ' + NAME + '.js, so it cannot judge a run');
    ok(runsOf(s.root, 'icons').length === 0, 'icons is switched on and nothing runs icons.js: no permanent process', 'icons.js runs while nothing asks it: ' + short(runsOf(s.root, 'icons')));
    const tree = await post('api', {});
    ok(tree.status === 200 && !!(tree.body && tree.body.icons), 'the api tree holds icons, its branch asked of its one-shot row', 'the tree: ' + tree.status + ' ' + short(tree.body && Object.keys(tree.body)));
    ok(!!(tree.body && tree.body[NAME]), 'and the permanent row, ' + NAME + ', beside it, as today', 'the tree lost ' + NAME + ': ' + short(tree.body && Object.keys(tree.body)));
    ok(await H.until(function () { return Promise.resolve(runsOf(s.root, 'icons').length === 0); }, 3000), 'the run that answered the tree has ended', 'icons.js still runs after the tree was answered: ' + short(runsOf(s.root, 'icons')));

    test.subHeading('the box, 9: "one run per app at a time: calls to the same one-shot app wait their turn"');
    const watch = H.watchRuns(s.root, 'icons');
    const many = await Promise.all([0, 1, 2, 3, 4, 5].map(function () { return post('api', {}); }));
    await H.sleep(300);
    const { most, seen } = await watch.stop();
    ok(many.every(function (r) { return r.status === 200 && !!(r.body && r.body.icons); }), 'six trees asked at once: each holds the icons branch', 'answers: ' + short(many.map(function (r) { return r.status + (r.body && r.body.icons ? '+icons' : '-icons'); })));
    ok(seen >= 1, 'the world: a run of icons.js was seen while they were answered', 'no run of icons.js was ever seen, so "one at a time" judged nothing');
    ok(most <= 1, 'never two runs of icons.js at once', most + ' runs of icons.js at once');
    ok(await H.until(function () { return Promise.resolve(runsOf(s.root, 'icons').length === 0); }, 3000), 'and none is left running', 'icons.js runs after all were answered: ' + short(runsOf(s.root, 'icons')));
  } finally {
    try { child.kill(); } catch (e) { /* gone */ }
    await H.sleep(500);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
