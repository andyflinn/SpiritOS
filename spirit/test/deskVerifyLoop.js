'use strict';

// goal/G8.6: deskVerify's short loop - the current goal's suites, between Go and Done. Red on today's tree;
// claude-windows wrote it from G8.6's box and does not build it.
//   Andy, 2026-10-06: "the short loop is: all the suites of the current goal, between 'Go' pressed and 'Done' pressed",
//   and "which suites belong to a goal: all the suites associated with items in the goal", known "the way a coding
//   agent knows which suite it writes the code against".
//   Andy, 2026-10-09 (goal/G8.3): "deskVerify will test all new incoming changes, when red is written as well".
//
// WHAT IS TRUE TODAY (read at 7e4947f8): deskVerify keeps records and reads its mode, and runs nothing.
//
// THE SHAPE ASSERTED, names the red writer's:
//   An item's suites are the test files on its file list (goal/G8.8: facts.files, spirit/test/<name>.js), and the loop's
//   items are the current goal's items with his Go and no Done. deskVerify reads them from the desk through its own
//   node, the port appServer hands it (SPIRIT_PORT), with one items.search of the current goal.
//   suites {} -> {suites}: those files, each once, sorted.
//   loop.once {} -> {ran}: runs each of them, `node <suite> --verify-port <its node's port>`, from its own checkout,
//   one at a time, and answers which it ran. So every assertion of a run arrives back as a record (goal/G8.1).
// NOT ASSERTED: what starts a pass. The desk's nudge reaching deskVerify is goal/G8.5's; this red holds what a pass does.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.6: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
// A suite of one assertion, written into spirit/test for the length of this run, so the loop has something real to run.
const PROBE = 'zzLoopProbe.js';
const PROBE_PATH = path.join(__dirname, PROBE);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G8.6: deskVerify\'s short loop - the current goal\'s suites, between Go and Done');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyloop-'));

const facts = function (o) { return Object.assign({ goal: 'lp/G1', status: '', go: false, files: [] }, o); };
const file = function (p) { return { path: p, by: 'claude-windows', core: false }; };
const ITEMS = [
  facts({ id: 'lp/G1', goal: '' }),
  facts({ id: 'lp/G1.1', go: true, status: 'build', files: [file('spirit/test/' + PROBE), file('spirit/run/js/kernel.js'), file('spirit/test/deskSword.js')] }),
  facts({ id: 'lp/G1.2', go: true, status: 'red', files: [file('spirit/test/' + PROBE)] }),
  facts({ id: 'lp/G1.3', go: false, files: [file('spirit/test/notYetGone.js')] }),
  facts({ id: 'lp/G1.4', go: true, status: 'done', files: [file('spirit/test/alreadyDone.js')] }),
];

// A node that runs a desk and answers its items.search with the items above, and keeps every record posted to it.
function fakeNode() {
  return new Promise(function (resolve) {
    const asked = [];
    const records = [];
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null;
        try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.verb === 'jobs.api' && j.ask === 'api') out = { desk: {} };
        else if (j && j.verb === 'jobs.api' && j.ask && j.ask.desk && j.ask.desk['items.search']) {
          asked.push(j.ask.desk['items.search']);
          out = { items: ITEMS.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
        } else if (j && j.verb === 'jobs.api' && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) {
          records.push(j.ask.deskVerify.record);
          out = { written: true };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, asked: asked, records: records, close: function () { s.close(); } }); });
  });
}

(async function () {
  fs.writeFileSync(PROBE_PATH, [
    "'use strict';",
    "const test = require('./testSupport.js');",
    "test.startTest('loop probe');",
    "test.check('the loop ran me');",
    'test.reportSuccessFailureCount();',
    'process.exit(0);',
  ].join('\n'));
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
    return client.ask({ deskVerify: q }, { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyLoopOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function () { return {}; });
  };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (up) test.check('the world: deskVerify is up, on a node that runs a desk');
    else { test.fail('the world: deskVerify did not come up'); return; }

    test.subHeading('1. the loop\'s suites: test files of the current goal\'s items between Go and Done');
    const s = await ask('suites');
    const want = ['spirit/test/deskSword.js', 'spirit/test/' + PROBE].sort();
    if (s.status === 200 && s.body && JSON.stringify(s.body.suites) === JSON.stringify(want)) test.check('suites answers the test files of Go\'d, undone items, each once, nothing else');
    else test.fail(OWED + 'suites answered ' + short(s.body));
    const q = node.asked[node.asked.length - 1] || {};
    if (q.currentGoalOnly === true) test.check('it read them with one items.search of the current goal, through its own node');
    else test.fail(OWED + 'the desk was asked ' + short(node.asked));

    test.subHeading('2. one pass runs each, telling it where to post');
    // Only the probe is a file this suite can afford to run; the list is narrowed to it for the pass.
    ITEMS[1].files = [file('spirit/test/' + PROBE)];
    const once = await ask('loop.once');
    if (once.status === 200 && once.body && JSON.stringify(once.body.ran) === JSON.stringify(['spirit/test/' + PROBE])) test.check('loop.once ran the probe and says so');
    else test.fail(OWED + 'loop.once answered ' + short(once.body));
    await sleep(500);
    const r = node.records.filter(function (x) { return x.suite === PROBE; });
    if (r.length && r[0].title === 'the loop ran me' && r[0].outcome === 'green') test.check('the probe\'s assertion came back as a record to its node: it was run with --verify-port');
    else test.fail(OWED + 'records at the node: ' + short(node.records));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(PROBE_PATH); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
