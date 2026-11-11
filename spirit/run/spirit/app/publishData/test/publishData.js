'use strict';

// spirit/run/spirit/app/publishData/test/publishData.js
// PUBLISHDATA AS AN APP OF ITS OWN (goal/G43.21; spec: ./publishData.md). Andy: "spirit/app/publishData/publishData will be
// fixed to point at the correct files/folders", and "the Andy user on each box will run those scripts when he feels like
// it, that will take the running of those scripts out of the agents hands." The tree read as it is, and the script run
// once against a port nobody listens on, from a scratch folder that is no git clone: it measures nothing and commits nothing.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the noSummary and run parts, once files of
// their own, are sections at its end, run after the checks above and counted with them.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
const HERE = path.join(RUN, 'spirit', 'app', 'publishData');
const FILE = path.join(HERE, 'publishData.js');
const OLD = path.join(RUN, 'spirit', 'app', 'deskClient');
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

test.startTest('publishData.js: an app of its own, run by Andy with Run (goal/G43.21)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/publishData/publishData.js is not there'); return; }

  test.subHeading('the node port comes from the node that starts it');
  // A node that starts a job hands it SPIRIT_CALLBACK_URL, its own address (job.js); Run hands no argument. It is run from
  // a folder that is no git clone, so past its arguments it stops at once, before it asks any node anything.
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publishdata-'));
  try {
    const env = Object.assign({}, process.env, { SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit' });
    const r = spawnSync(process.execPath, [FILE], { cwd: tmp, env: env, encoding: 'utf8', timeout: 30000 });
    const said = String(r.stdout || '') + String(r.stderr || '');
    ok(r.status !== 2 && !/usage:/.test(said), 'run with no argument it does not stop at its usage', 'it stopped at usage (exit ' + r.status + '): ' + short(said));
    ok(/not in a git clone/.test(said), 'it goes on past its arguments, to its first step', 'it said ' + short(said));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

  test.subHeading('its files and folders');
  // Where it looks for deskVerify's verify.db: its own line, worked out from where the script stands.
  const line = (/const\s+VERIFY_DB\s*=\s*([^;]+);/.exec(code(FILE)) || [])[1];
  let at = '';
  try { at = line ? new Function('path', '__dirname', 'return ' + line)(path, HERE) : ''; } catch (e) { at = 'threw ' + e.message; }
  const want = path.join(RUN, 'spirit', 'state', 'deskVerify', 'data', 'verify.db');
  ok(path.resolve(String(at)) === want, 'it reads deskVerify\'s verify.db where deskVerify keeps it, its state spirit/state/deskVerify/data/', 'it reads ' + short(at) + ', want ' + want);
  let readme = null;
  try { readme = require(path.join(HERE, 'agentReadme.js')); } catch (e) { readme = null; }
  ok(!!readme && typeof readme.write === 'function', 'agentReadme.js stands beside it and loads', 'no agentReadme.js beside it in spirit/app/publishData/');

  test.subHeading('Andy runs it; no agent starts it');
  ok(!fs.existsSync(path.join(OLD, 'publishData.js')), 'the old spirit/app/deskClient/publishData.js is gone', 'spirit/app/deskClient/publishData.js is still there');
  ok(!fs.existsSync(path.join(OLD, 'agentReadme.js')), 'the old spirit/app/deskClient/agentReadme.js is gone', 'spirit/app/deskClient/agentReadme.js is still there');
  const client = code(path.join(OLD, 'deskClient.js'));
  ok(!!client && !/publishData/.test(client), 'deskClient starts no publishData', 'deskClient.js still names publishData');
}()).then(function () { return null; }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); return 0; })
  .then(async function (failExit) {
    // The folded parts, in order, after the checks above; one count and one report for the whole file.
    for (const part of [noSummaryPart, runPart]) {
      try { await part(); } catch (e) { test.fail('the ' + part.name.replace(/Part$/, '') + ' part threw ' + (e && e.stack || e)); }
    }
    test.reportSuccessFailureCount();
    process.exit(failExit === null ? (0) : failExit);
  });

// ── THE NOSUMMARY PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
async function noSummaryPart() {
  // publishData POSTS NOTHING TO THE DESK (goal/G43.22; spec: ./publishData.md, section "noSummary"): spirit/app/publishData/publishData.js.
  // Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
  // can stay for now.". "publishData summary is no longer needed, i only check on github.". The tree read as it is, comments left out.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
  const DESK = path.join(RUN, 'spirit', 'app', 'desk');

  test.subHeading('noSummary: publishData posts nothing to the desk (goal/G43.22)');

  test.subHeading('Andy: "publishData summary is no longer needed, i only check on github."');
  const pub = code(path.join(RUN, 'spirit', 'app', 'publishData', 'publishData.js'));
  ok(!!pub && !/chat\.add/.test(pub), 'publishData posts nothing to the desk', 'publishData.js still posts a chat.add');
}

// ── THE RUN PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
async function runPart() {
  // The tests of spirit/app/publishData/publishData.js run whole, as an agent runs it, and of no other module (spec:
  // ./publishData.md, section "run"; the box's red is ./publishData.js; goal/G41.11). The
  // script runs as an agent runs it, its own process, in a scratch clone of the test's own with a bare origin beside it
  // and a traffic log (spirit/state/node.db) the test writes. A preload of the test's own stands in for the spirit object:
  // its deskClient family answers profile.get with the agent's name and logs every ask. The harness step finds no
  // measurePlatform in the scratch clone's worktree and so runs nothing. No node, no port, no real remote.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const { DatabaseSync } = require('node:sqlite');
  const RUN = path.resolve(__dirname, '../../../..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const FILE = path.join(__dirname, '..', 'publishData.js');
  const TMP = path.join(RUN, 'test', '_tmp_publishData');
  const PRELOAD = path.join(TMP, 'spiritStub.js');
  const LOG = path.join(TMP, 'asks.jsonl');
  const ORIGIN = path.join(TMP, 'origin.git');
  const CLONE = path.join(TMP, 'clone');
  const BARE_CLONE = path.join(TMP, 'nolog');
  const AGENT = 'test-agent';
  // The deskClient's family as the one family path function names it (goal/G41.12).
  const SPIRIT = path.join(RUN, 'spirit', 'spirit.js');
  const FAMILY = require(SPIRIT).familyPath('deskClient');

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  function git(cwd, args) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true }); return { status: r.status, out: String(r.stdout || '').trim() }; }

  const STUB = [
    "'use strict';",
    "const fs = require('fs');",
    "const Module = require('module');",
    "const log = function (x) { fs.appendFileSync(process.env.PD_LOG, JSON.stringify(x) + '\\n'); };",
    "const family = { desk: function (a) {",
    "  log({ verb: 'desk', args: a });",
    "  if (a.name === 'profile.get') return Promise.resolve({ ok: true, name: process.env.PD_NAME, nick: '' });",
    "  return Promise.resolve({ ok: true });",
    "} };",
    "const familyPath = require(" + JSON.stringify(SPIRIT) + ").familyPath;",
    "globalThis.spirit = {",
    "  familyPath: familyPath,",
    // goal/G43.32, decided 3: on the node a script comes back at once, by its run-root path; a branch's api.js binds it.
    "  require: function (p) { if (!/\\/api\\.js$/.test(p)) return require(require('path').join(" + JSON.stringify(RUN) + ", p)); log({ require: p }); return Promise.resolve(family); },",
    "  outcome: function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function () { return { status: 0, body: null }; }); },",
    "};",
    "const realLoad = Module._load;",
    "Module._load = function (request, parent) {",
    "  if (/(^|[\\\\/])spirit\\.js$/.test(request) && parent && /publishData\\.js$/.test(parent.filename)) return globalThis.spirit;",
    "  return realLoad.apply(this, arguments);",
    "};",
  ].join('\n');

  function publish(cwd, args, name) {
    try { fs.unlinkSync(LOG); } catch (e) { /* none */ }
    // THE TEST'S OWN WORLD (goal/G43.21): run under a node, as the verifier runs it, this suite has the node's address and job in
    // its env, which publishData would take for its own; the script is handed neither, only what each case gives it.
    const ownWorld = function () { const e = Object.assign({}, process.env, { PD_LOG: LOG, PD_NAME: name === undefined ? AGENT : name }); delete e.SPIRIT_CALLBACK_URL; delete e.SPIRIT_JOB_ID; return e; };
    const r = spawnSync(process.execPath, ['-r', PRELOAD, FILE].concat(args), { cwd: cwd, encoding: 'utf8', windowsHide: true, timeout: 150000,
      env: ownWorld() });
    let asks = [];
    try { asks = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { asks = []; }
    return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim(), asks: asks.filter(function (a) { return a.verb; }), required: asks.filter(function (a) { return a.require; }) };
  }

  // The node's traffic log, as the node writes it: the rows publishData counts, and the rows it must not.
  function trafficLog(clone, rows) {
    const dir = path.join(clone, 'spirit', 'run', 'spirit', 'state');
    fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, 'node.db'));
    db.exec('CREATE TABLE traffic (at TEXT, dir TEXT, kind TEXT, outcome TEXT, code TEXT, ms INTEGER, extra TEXT)');
    const add = db.prepare('INSERT INTO traffic (at, dir, kind, outcome, code, ms, extra) VALUES (?, ?, ?, ?, ?, ?, ?)');
    rows.forEach(function (r) { add.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6] === null ? null : JSON.stringify(r[6])); });
    db.close();
  }
  const NEW = '2999-01-01T00:00:00.000Z';
  const ROWS = [
    [NEW, 'in', 'reply', 'receipted', '', 30, { waitMs: 10, attempts: 1 }],
    [NEW, 'in', 'reply', 'receipted', '', 50, { waitMs: 20, attempts: 2 }],
    [NEW, 'in', 'reply', 'refused', 'not-granted', 40, { waitMs: 5 }],
    [NEW, 'out', 'request', 'no-answer', '', 0, null],
    // Not counted: a request that was answered, an incoming request, a row from before the run.
    [NEW, 'out', 'request', 'receipted', '', 9, { waitMs: 1 }],
    [NEW, 'in', 'request', 'receipted', '', 9, { waitMs: 1 }],
    ['2000-01-01T00:00:00.000Z', 'in', 'reply', 'receipted', '', 99, { waitMs: 99 }],
  ];

  function setup() {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    fs.writeFileSync(PRELOAD, STUB);
    git(TMP, ['init', '-q', '--bare', '-b', 'master', ORIGIN]);
    [CLONE, BARE_CLONE].forEach(function (c) {
      git(TMP, ['clone', '-q', ORIGIN, c]);
      git(c, ['config', 'user.name', 'publishData test']); git(c, ['config', 'user.email', 'publishdata@test.invalid']); git(c, ['config', 'commit.gpgsign', 'false']);
    });
    fs.writeFileSync(path.join(CLONE, 'README.md'), 'scratch\n');
    fs.writeFileSync(path.join(CLONE, '.gitignore'), 'spirit/run/spirit/state/\n');
    git(CLONE, ['add', 'README.md', '.gitignore']);
    git(CLONE, ['commit', '-q', '-m', 'the first']);
    git(CLONE, ['push', '-q', '-u', 'origin', 'master']);
    git(BARE_CLONE, ['pull', '-q', 'origin', 'master']);
    trafficLog(CLONE, ROWS);
  }

  test.subHeading('run: one measurement run per agent');

  (function () {
    setup();
    const COMMIT = git(__dirname, ['rev-parse', '--short', 'HEAD']).out;

    test.subHeading('its usage, and what it needs');
    const u = publish(CLONE, []);
    ok(u.status === 2 && /^usage: node publishData.js \[<port of the agent's own node>\]/.test(u.err) && u.asks.length === 0, 'no port, given or handed by its node: exit 2, its usage, nothing asked', 'exit ' + u.status + ' err ' + short(u.err));
    const nogit = publish(os.tmpdir(), ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')]);
    ok(nogit.status === 1 && nogit.err === 'publishData: not in a git clone' && nogit.asks.length === 0, 'run outside a git clone: exit 1, saying so, nothing asked', 'exit ' + nogit.status + ' err ' + short(nogit.err));
    const noname = publish(CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')], '');
    ok(noname.status === 1 && /^publishData: this agent has no name at the desk yet/.test(noname.err), 'an agent with no name at the desk: exit 1, saying so', 'exit ' + noname.status + ' err ' + short(noname.err));
    const nolog = publish(BARE_CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'y'), '--asks', '1']);
    ok(nolog.status === 1 && nolog.err.indexOf('publishData: no traffic log at ' + path.join(BARE_CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db')) === 0, 'a clone with no traffic log: exit 1, naming where it looked', 'exit ' + nolog.status + ' err ' + short(nolog.err));

    test.subHeading('--only packets --out: N read-only desk asks, timed by the node\'s own traffic log');
    const OUT = path.join(TMP, 'look');
    const headBefore = git(CLONE, ['rev-parse', 'HEAD']).out;
    const r = publish(CLONE, ['45440', '--only', 'packets', '--out', OUT, '--asks', '3']);
    ok(r.status === 0 && r.out.split('\n').pop() === 'publishData: written to ' + OUT, 'it exits 0: written to <out>', 'exit ' + r.status + ' out ' + short(r.out) + ' err ' + short(r.err));
    ok(r.out.indexOf('publishData: agent ' + AGENT + ', commit ' + COMMIT + ', into ' + OUT) !== -1, 'its agent is the name in its profile, its commit the tree it runs from', 'out ' + short(r.out));
    const pg = r.asks.filter(function (a) { return a.args.name === 'profile.get'; });
    ok(pg.length === 4 && pg.every(function (a) { return a.args.json === '{"agent":""}'; }) && r.asks.length === 4, 'one profile.get for its name, then 3 more, read-only, and nothing else asked', 'asks ' + short(r.asks));
    ok(r.required.every(function (a) { return a.require === FAMILY; }), 'every ask through its deskClient\'s family, on the spirit object', 'required ' + short(r.required));
    let p = null;
    try { p = JSON.parse(fs.readFileSync(path.join(OUT, 'packets.json'), 'utf8')); } catch (e) { p = null; }
    ok(p && p.agent === AGENT && p.commit === COMMIT && p.asks === 3 && !isNaN(Date.parse(p.measuredAt)), 'packets.json names the agent, the commit, the asks and when', 'packets ' + short(p));
    ok(p && p.posts === 4, 'posts: the closing rows since it began (replies in, and requests out refused or unanswered)', 'posts ' + short(p && p.posts));
    ok(p && p.waitMs.median === 10 && p.waitMs.max === 20, 'queue wait: median and worst of the rows that carry waitMs', 'waitMs ' + short(p && p.waitMs));
    ok(p && p.flight.median === 30 && p.flight.max === 35, 'flight: each row\'s ms less its wait', 'flight ' + short(p && p.flight));
    ok(p && p.retried === 1, 'retried: the rows that took more than one attempt', 'retried ' + short(p && p.retried));
    ok(p && JSON.stringify(p.refusals) === JSON.stringify({ 'not-granted': 1, 'no-answer': 1 }), 'refusals counted by code, else by outcome', 'refusals ' + short(p && p.refusals));
    const pmd = fs.existsSync(path.join(OUT, 'packets.md')) ? fs.readFileSync(path.join(OUT, 'packets.md'), 'utf8') : '';
    ok(pmd.indexOf('# Packets: ' + AGENT) === 0 && pmd.indexOf('| queue wait (ms) | 10 | 20 |') !== -1 && pmd.indexOf('| flight (ms) | 30 | 35 |') !== -1 && pmd.indexOf('4 posts, 1 needed more than one try, refusals: {"not-granted":1,"no-answer":1}.') !== -1, 'packets.md says the same', 'packets.md ' + short(pmd));
    const plat = fs.existsSync(path.join(OUT, 'platform.md')) ? fs.readFileSync(path.join(OUT, 'platform.md'), 'utf8') : '';
    ok(plat.indexOf('# ' + AGENT) === 0 && plat.indexOf('| agent | ' + AGENT + ' |') !== -1 && plat.indexOf('`' + COMMIT + '`') !== -1 && plat.indexOf('| node | ' + process.version + ' |') !== -1, 'platform.md names the agent, the commit and the box', 'platform.md ' + short(plat));
    let ts = null;
    try { ts = JSON.parse(fs.readFileSync(path.join(OUT, 'testState.json'), 'utf8')); } catch (e) { ts = null; }
    ok(ts && ts.agent === AGENT && ts.commit === COMMIT && ts.tests === ts.green + ts.red && Array.isArray(ts.suites) && Array.isArray(ts.reds) && ts.reds.length === ts.red && /no suite was run/.test(ts.from),
      'testState.json: the newest row of each test in verify.db, read only, no suite run', 'testState ' + short(ts) + ' said ' + short(r.out));
    const tsmd = fs.existsSync(path.join(OUT, 'testState.md')) ? fs.readFileSync(path.join(OUT, 'testState.md'), 'utf8') : '';
    ok(tsmd.indexOf('# Test state: ' + AGENT) === 0 && tsmd.indexOf('| suite | tests | green | red | newest |') !== -1 && tsmd.indexOf('## Red') !== -1, 'testState.md: the suites\' table and the reds', 'testState.md ' + short(tsmd));
    const readme = fs.existsSync(path.join(OUT, 'README.md')) ? fs.readFileSync(path.join(OUT, 'README.md'), 'utf8') : '';
    ok(readme.indexOf('# ' + AGENT + '\n') === 0 && readme.indexOf('## Measurements') !== -1, 'the README is written beside them (agentReadme)', 'README ' + short(readme));
    ok(r.out.indexOf('measurePlatform') === -1 && r.out.indexOf('harness and capacity') === -1, '--only packets runs no harness', 'out ' + short(r.out));
    ok(git(CLONE, ['rev-parse', 'HEAD']).out === headBefore && r.asks.every(function (a) { return a.args.name !== 'chat.add'; }), 'and with --out nothing is committed and nothing posted', 'HEAD ' + git(CLONE, ['rev-parse', 'HEAD']).out);
    const origDb = new DatabaseSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db'), { readOnly: true });
    const rowsNow = origDb.prepare('SELECT COUNT(*) AS n FROM traffic').get().n;
    origDb.close();
    ok(rowsNow === ROWS.length, 'the node\'s own traffic log is read from a copy, untouched', 'rows now ' + rowsNow);

    test.subHeading('the whole run: harness in a worktree, then its one folder committed, pushed and said');
    // A traffic log that counts nothing this time: zero posts is published too.
    fs.rmSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true, force: true });
    trafficLog(CLONE, [ROWS[6]]);
    fs.mkdirSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(CLONE, 'his-staged.txt'), 'his work in progress\n');
    git(CLONE, ['add', 'his-staged.txt']);
    const before = git(CLONE, ['rev-parse', 'HEAD']).out;
    const w = publish(CLONE, ['45440', '--asks', '2']);
    ok(w.status === 0 && w.out.split('\n').pop() === 'publishData: published agents/' + AGENT + '/', 'it exits 0: published agents/<agent>/', 'exit ' + w.status + ' out ' + short(w.out) + ' err ' + short(w.err));
    ok(/harness and capacity in a worktree of /.test(w.out) && /measurePlatform exited /.test(w.out), 'the harness step runs measurePlatform in a worktree, and says how it ended', 'out ' + short(w.out));
    ok(git(CLONE, ['worktree', 'list', '--porcelain']).out.split('\n').filter(function (l) { return /^worktree /.test(l); }).length === 1, 'and the worktree is removed after', 'worktrees ' + short(git(CLONE, ['worktree', 'list']).out));
    ok(w.out.indexOf('the desk asks counted 0 posts; published as measured') !== -1, 'zero posts is published, and said aloud', 'out ' + short(w.out));
    const head = git(CLONE, ['rev-parse', 'HEAD']).out;
    ok(head !== before && git(CLONE, ['rev-parse', head + '^']).out === before, 'one commit on its clone', 'HEAD ' + head);
    ok(git(CLONE, ['log', '-1', '--format=%s', head]).out === 'publish: ' + AGENT + ' at ' + COMMIT + ' (agents/' + AGENT + '/, the standing grant of goal/G4.33)', 'under the standing grant\'s message', 'message ' + short(git(CLONE, ['log', '-1', '--format=%s', head]).out));
    const files = git(CLONE, ['diff-tree', '--no-commit-id', '--name-only', '-r', head]).out.split('\n').filter(Boolean);
    ok(files.length > 0 && files.every(function (f) { return f.indexOf('agents/' + AGENT + '/') === 0; }), 'its files all lie in agents/<agent>/', 'committed ' + short(files));
    ok(['packets.json', 'packets.md', 'platform.md', 'README.md'].every(function (f) { return files.indexOf('agents/' + AGENT + '/' + f) !== -1; }), 'packets, platform and README among them', 'committed ' + short(files));
    ok(git(CLONE, ['diff', '--cached', '--name-only']).out === 'his-staged.txt', 'what he had staged stays staged, and uncommitted', 'staged ' + short(git(CLONE, ['diff', '--cached', '--name-only']).out));
    ok(git(ORIGIN, ['rev-parse', 'refs/heads/master']).out === head, 'pushed: the origin is at its commit', 'origin ' + git(ORIGIN, ['rev-parse', 'refs/heads/master']).out);
    // goal/G43.22, Andy: "publishData summary is no longer needed, i only check on github.": nothing is posted to the desk.
    const post = w.asks.filter(function (a) { return a.args.name === 'chat.add'; });
    ok(w.asks.length > 0 && post.length === 0, 'no summary line posted to Desk', 'posted ' + short(post));
    fs.rmSync(TMP, { recursive: true, force: true });
  }());
}
