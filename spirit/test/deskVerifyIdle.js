'use strict';

// goal/G8.4: idle time, and what deskVerify may do in it. Red on today's tree; wsl-claude wrote it from G8.4's box
// and does not build it.
//   Andy, 2026-10-06, gave the item three sections: "1. Define Idle time", "2. what ever deskVerify does during idle
//   time", "3. what extra things an agent-mode deskVerify does during idle time". His measure of idle: "when it's
//   agent or it's desk have been idle for more than an hour".
//   The box's reading, which this suite holds: idle is not the same as finished, so the hour alone is not enough - a
//   node is idle when nothing has been written for an hour AND no item is in a phase held by the agent on that node.
//
// WHAT IS TRUE TODAY (read at 19488845): deskVerify knows its mode, keeps records and runs the short loop. It has no
// idea of time and does no chore.
//
// WHAT THIS RED HOLDS, and only this:
//   idle {} -> {idle, since, holding}: whether this node is idle by the rule above, the UTC time of the newest write
//   it can see, and the items its own agent holds a phase of. Both halves of the rule are asserted: a recent write
//   makes it busy, and a held phase makes it busy however long the silence.
//   chore.once {} -> {did}: nothing at all while the node is not idle, and - the one limit the box states plainly -
//   it never re-runs a suite, the report being derived from the dataset. So a pass of it while busy runs nothing and
//   says it did nothing.
//
// ONE NAME IS MINE: the suite tells deskVerify which agent this node belongs to as a manifest value, `agent`. The
// builder may instead read it from the --node {name} the node already hands every server; the assertions are about
// which phases count as its own, not about how it learned the name.
//
// LEFT TO HIM, AND A RED QUESTION ON THE ITEM RATHER THAN A GUESS HERE: the two limits the box says must be ruled
// before building - which paths a mechanical chore may write (a commit nobody read), and what the test-state report
// is to contain. Section 3's README chore waits on the first of those, so nothing of it is asserted.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.4: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const PROBE = 'zzIdleProbe.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function iso(msAgo) { return new Date(Date.now() - msAgo).toISOString(); }

test.startTest('goal/G8.4: idle time, and what deskVerify does in it');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyidle-'));
const PROBE_PATH = path.join(__dirname, PROBE);

// A node that runs a deskClient (so deskVerify reads itself as an agent's, where its own agent can hold a phase) and
// answers the desk's changes and items.search from what a suite sets here.
const world = {
  newestWrite: iso(3 * 60 * 60 * 1000),   // three hours ago
  items: [],
  ran: [],
};
function fakeNode() {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null;
        try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        const ask = j && j.ask;
        if (j && j.verb === 'jobs.api' && ask === 'api') out = { desk: {}, deskClient: {} };
        else if (ask && ask.desk && ask.desk.changes) out = { records: [{ n: 1, at: world.newestWrite, verb: 'chat.add', by: 'wsl-claude', key: '', body: '{}' }], lines: [], n: 1, line: 0, more: false };
        else if (ask && ask.desk && ask.desk['items.search']) out = { items: world.items.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
        else if (ask && ask.deskVerify && ask.deskVerify.record) { world.ran.push(ask.deskVerify.record); out = { written: true }; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

const item = function (o) { return Object.assign({ id: 'id/G1.1', goal: 'id/G1', status: '', go: true, with: '', files: [] }, o); };

(async function () {
  fs.writeFileSync(PROBE_PATH, [
    "'use strict';",
    "const test = require('./testSupport.js');",
    "test.startTest('idle probe');",
    "test.check('a chore ran me, which it must not');",
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
  // TEST FIX (claude-windows, building): the agent's name comes the way the node hands it to every server, --node {name}.
  const kid = spawn(process.execPath, [SERVER, JSON.stringify({ db: path.join(root, 'verify.db') }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'wsl-claude', publicKey: 'x' })], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const ask = function (verb, args) {
    const q = {}; q[verb] = args || {};
    return client.ask({ deskVerify: q }, { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyIdleOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function () { return {}; });
  };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (up) test.check('the world: deskVerify is up on an agent node');
    else { test.fail('the world: deskVerify did not come up'); return; }

    test.subHeading('1. idle is an hour of silence AND no phase held by this node\'s agent');
    world.items = [item({ id: 'id/G1.1', with: '' })];
    const quiet = await ask('idle');
    if (quiet.status === 200 && quiet.body && quiet.body.idle === true) test.check('three hours of silence with nothing held reads idle');
    else test.fail(OWED + 'idle answered ' + short(quiet.body));
    if (quiet.body && quiet.body.since === world.newestWrite) test.check('it says the newest write it can see');
    else test.fail(OWED + 'since reads ' + short(quiet.body && quiet.body.since));

    world.newestWrite = iso(5 * 60 * 1000);
    const busy = await ask('idle');
    if (busy.body && busy.body.idle === false) test.check('a write five minutes ago reads busy');
    else test.fail(OWED + 'with a recent write, idle answered ' + short(busy.body));

    world.newestWrite = iso(3 * 60 * 60 * 1000);
    world.items = [item({ id: 'id/G1.1', with: 'wsl-claude' })];
    const holding = await ask('idle');
    if (holding.body && holding.body.idle === false) test.check('a phase its own agent holds reads busy however long the silence');
    else test.fail(OWED + 'with a held phase, idle answered ' + short(holding.body));
    if (holding.body && Array.isArray(holding.body.holding) && holding.body.holding.indexOf('id/G1.1') !== -1) test.check('and it names what is held');
    else test.fail(OWED + 'holding reads ' + short(holding.body && holding.body.holding));
    world.items = [item({ id: 'id/G1.1', with: 'claude-windows' })];
    const theirs = await ask('idle');
    if (theirs.body && theirs.body.idle === true) test.check('a phase the OTHER agent holds does not make this node busy');
    else test.fail(OWED + 'with another agent holding, idle answered ' + short(theirs.body));

    test.subHeading('2. a chore does nothing while the node is busy, and never re-runs a suite');
    world.newestWrite = iso(5 * 60 * 1000);
    world.items = [item({ id: 'id/G1.1', files: [{ path: 'spirit/test/' + PROBE, by: 'wsl-claude', core: false }] })];
    const none = await ask('chore.once');
    if (none.status === 200 && none.body && Array.isArray(none.body.did) && !none.body.did.length) test.check('busy, a pass of the chores does nothing and says so');
    else test.fail(OWED + 'chore.once while busy answered ' + short(none.body));
    world.newestWrite = iso(3 * 60 * 60 * 1000);
    const idleRun = await ask('chore.once');
    await sleep(300);
    if (idleRun.status !== 200 || !idleRun.body || !Array.isArray(idleRun.body.did)) test.fail(OWED + 'chore.once while idle answered ' + short(idleRun.body));
    else if (!world.ran.length) test.check('idle, it still runs no suite: the report comes from the dataset, never from a run');
    else test.fail(OWED + 'a chore ran suites: ' + short(world.ran));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(PROBE_PATH); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
