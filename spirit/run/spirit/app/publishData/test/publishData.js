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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
const HERE = path.join(RUN, 'spirit', 'app', 'publishData');
const FILE = path.join(HERE, 'publishData.js');
const OLD = path.join(RUN, 'spirit', 'app', 'deskClient');
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }


// What the tests below make, each in order, read by the tests after it.
const W = {};

// the node port comes from the node that starts it
// A node that starts a job hands it SPIRIT_CALLBACK_URL, its own address (job.js); Run hands no argument. It is run from
// a folder that is no git clone, so past its arguments it stops at once, before it asks any node anything.
test.run('run with no argument it does not stop at its usage', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/publishData/publishData.js is not there';
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publishdata-'));
  try {
    const env = Object.assign({}, process.env, { SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit' });
    const r = spawnSync(process.execPath, [FILE], { cwd: tmp, env: env, encoding: 'utf8', timeout: 30000 });
    W.said = String(r.stdout || '') + String(r.stderr || '');
    return (r.status !== 2 && !/usage:/.test(W.said)) ? true : 'it stopped at usage (exit ' + r.status + '): ' + short(W.said);
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}, test.limit.quick);
test.run('it goes on past its arguments, to its first step', 0.2, function () {
  if (typeof W.said !== 'string') return 'it was not run: the test before failed';
  return (/not in a git clone/.test(W.said)) ? true : 'it said ' + short(W.said);
}, test.limit.quick);

let line, at, want, readme, client;

// its files and folders
// THE TEST STATE FROM TESTICLE (Andy, the cycle that deletes the desk's verifier: "publish Data uses testicle data."): it
// reads testicle's testicle.db where testicle keeps it, its state spirit/state/testicle/data/, worked out from its own line.
const TESTICLE_DB = path.join(RUN, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
test.run('it reads testicle\'s testicle.db where testicle keeps it, its state spirit/state/testicle/data/', 0.2, function () {
  const lines = code(FILE).split('\n').filter(function (l) { return /const\s+\w+\s*=\s*path\.join\(__dirname[^;]*testicle\.db/.test(l); });
  line = (/=\s*([^;]+);/.exec(lines[0] || '') || [])[1];
  at = '';
  try { at = line ? new Function('path', '__dirname', 'return ' + line)(path, HERE) : ''; } catch (e) { at = 'threw ' + e.message; }
  return (path.resolve(String(at)) === TESTICLE_DB && !/verify\.db/.test(code(FILE))) ? true : 'it reads ' + short(at || 'no testicle.db line') + ', want ' + TESTICLE_DB;
}, test.limit.quick);
test.run('agentReadme.js stands beside it and loads', 0.2, function () {
  readme = null;
  try { readme = require(path.join(HERE, 'agentReadme.js')); } catch (e) { readme = null; }
  return (!!readme && typeof readme.write === 'function') ? true : 'no agentReadme.js beside it in spirit/app/publishData/';
}, test.limit.quick);

// Andy runs it; no agent starts it
test.run('the old spirit/app/deskClient/publishData.js is gone', 0.2, function () {
  return (!fs.existsSync(path.join(OLD, 'publishData.js'))) ? true : 'spirit/app/deskClient/publishData.js is still there';
}, test.limit.quick);
test.run('the old spirit/app/deskClient/agentReadme.js is gone', 0.2, function () {
  return (!fs.existsSync(path.join(OLD, 'agentReadme.js'))) ? true : 'spirit/app/deskClient/agentReadme.js is still there';
}, test.limit.quick);
test.run('deskClient starts no publishData', 0.2, function () {
  client = code(path.join(OLD, 'deskClient.js'));
  return (!!client && !/publishData/.test(client)) ? true : 'deskClient.js still names publishData';
}, test.limit.quick);

// ── THE NOSUMMARY PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// publishData POSTS NOTHING TO THE DESK (goal/G43.22; spec: ./publishData.md, section "noSummary"): spirit/app/publishData/publishData.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". "publishData summary is no longer needed, i only check on github.". The tree read as it is, comments left out.
function codeNoHtml(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }

// noSummary: publishData posts nothing to the desk (goal/G43.22)
// Andy: "publishData summary is no longer needed, i only check on github."
test.run('publishData posts nothing to the desk', 0.2, function () {
  const pub = codeNoHtml(path.join(RUN, 'spirit', 'app', 'publishData', 'publishData.js'));
  return (!!pub && !/chat\.add/.test(pub)) ? true : 'publishData.js still posts a chat.add';
}, test.limit.quick);

// ── THE RUN PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// The tests of spirit/app/publishData/publishData.js run whole, as an agent runs it, and of no other module (spec:
// ./publishData.md, section "run"; the box's red is ./publishData.js; goal/G41.11). The
// script runs as an agent runs it, its own process, in a scratch clone of the test's own with a bare origin beside it
// and a traffic log (spirit/state/node.db) the test writes. A preload of the test's own stands in for the spirit object:
// its deskClient family answers profile.get with the agent's name and logs every ask. The harness step finds no
// measurePlatform in the scratch clone's worktree and so runs nothing. No node, no port, no real remote.
const { DatabaseSync } = require('node:sqlite');
const TMP = path.join(RUN, 'test', '_tmp_publishData');
const PRELOAD = path.join(TMP, 'spiritStub.js');
const LOG = path.join(TMP, 'asks.jsonl');
const ORIGIN = path.join(TMP, 'origin.git');
const CLONE = path.join(TMP, 'clone');
const BARE_CLONE = path.join(TMP, 'nolog');
const AGENT = 'test-agent';
// The spirit object, whose one family path function names the deskClient's family (goal/G41.12).
const SPIRIT = path.join(RUN, 'spirit', 'spirit.js');
function shortRun(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
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
// The run part's world, made by its world test.
const WR = {};
test.after(function () { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

// run: one measurement run per agent
test.run('the world: a scratch clone with a bare origin beside it and a traffic log', 0.2, function () {
  // The deskClient's family as the one family path function names it (goal/G41.12).
  WR.FAMILY = require(SPIRIT).familyPath('deskClient');
  setup();
  WR.COMMIT = git(__dirname, ['rev-parse', '--short', 'HEAD']).out;
  WR.ready = fs.existsSync(PRELOAD) && fs.existsSync(path.join(CLONE, 'README.md')) && !!WR.COMMIT;
  return WR.ready || 'the scratch clone was not made: ' + shortRun(fs.existsSync(TMP) ? fs.readdirSync(TMP) : 'no ' + TMP);
}, test.limit.quick);

let u, nogit, noname, nolog, OUT, headBefore, r, pg, p, pmd, plat, ts, tsmd, readmeMd, origDb, rowsNow, before, w, head, files, post;

// its usage, and what it needs
test.run('no port, given or handed by its node: exit 2, its usage, nothing asked', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  u = publish(CLONE, []);
  return (u.status === 2 && /^usage: node publishData.js \[<port of the agent's own node>\]/.test(u.err) && u.asks.length === 0) ? true : 'exit ' + u.status + ' err ' + shortRun(u.err);
}, test.limit.quick);
test.run('run outside a git clone: exit 1, saying so, nothing asked', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  nogit = publish(os.tmpdir(), ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')]);
  return (nogit.status === 1 && nogit.err === 'publishData: not in a git clone' && nogit.asks.length === 0) ? true : 'exit ' + nogit.status + ' err ' + shortRun(nogit.err);
}, test.limit.quick);
test.run('an agent with no name at the desk: exit 1, saying so', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  noname = publish(CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')], '');
  return (noname.status === 1 && /^publishData: this agent has no name at the desk yet/.test(noname.err)) ? true : 'exit ' + noname.status + ' err ' + shortRun(noname.err);
}, test.limit.quick);
test.run('a clone with no traffic log: exit 1, naming where it looked', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  nolog = publish(BARE_CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'y'), '--asks', '1']);
  return (nolog.status === 1 && nolog.err.indexOf('publishData: no traffic log at ' + path.join(BARE_CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db')) === 0) ? true : 'exit ' + nolog.status + ' err ' + shortRun(nolog.err);
}, test.limit.slow);

// --only packets --out: N read-only desk asks, timed by the node's own traffic log
test.run('it exits 0: written to <out>', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  OUT = path.join(TMP, 'look');
  headBefore = git(CLONE, ['rev-parse', 'HEAD']).out;
  r = publish(CLONE, ['45440', '--only', 'packets', '--out', OUT, '--asks', '3']);
  return (r.status === 0 && r.out.split('\n').pop() === 'publishData: written to ' + OUT) ? true : 'exit ' + r.status + ' out ' + shortRun(r.out) + ' err ' + shortRun(r.err);
}, test.limit.slow);
test.run('its agent is the name in its profile, its commit the tree it runs from', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (r.out.indexOf('publishData: agent ' + AGENT + ', commit ' + WR.COMMIT + ', into ' + OUT) !== -1) ? true : 'out ' + shortRun(r.out);
}, test.limit.quick);
test.run('one profile.get for its name, then 3 more, read-only, and nothing else asked', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  pg = r.asks.filter(function (a) { return a.args.name === 'profile.get'; });
  return (pg.length === 4 && pg.every(function (a) { return a.args.json === '{"agent":""}'; }) && r.asks.length === 4) ? true : 'asks ' + shortRun(r.asks);
}, test.limit.quick);
test.run('every ask through its deskClient\'s family, on the spirit object', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (r.required.every(function (a) { return a.require === WR.FAMILY; })) ? true : 'required ' + shortRun(r.required);
}, test.limit.quick);
test.run('packets.json names the agent, the commit, the asks and when', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  p = null;
  try { p = JSON.parse(fs.readFileSync(path.join(OUT, 'packets.json'), 'utf8')); } catch (e) { p = null; }
  return (p && p.agent === AGENT && p.commit === WR.COMMIT && p.asks === 3 && !isNaN(Date.parse(p.measuredAt))) ? true : 'packets ' + shortRun(p);
}, test.limit.quick);
test.run('posts: the closing rows since it began (replies in, and requests out refused or unanswered)', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (p && p.posts === 4) ? true : 'posts ' + shortRun(p && p.posts);
}, test.limit.quick);
test.run('queue wait: median and worst of the rows that carry waitMs', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (p && p.waitMs.median === 10 && p.waitMs.max === 20) ? true : 'waitMs ' + shortRun(p && p.waitMs);
}, test.limit.quick);
test.run('flight: each row\'s ms less its wait', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (p && p.flight.median === 30 && p.flight.max === 35) ? true : 'flight ' + shortRun(p && p.flight);
}, test.limit.quick);
test.run('retried: the rows that took more than one attempt', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (p && p.retried === 1) ? true : 'retried ' + shortRun(p && p.retried);
}, test.limit.quick);
test.run('refusals counted by code, else by outcome', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (p && JSON.stringify(p.refusals) === JSON.stringify({ 'not-granted': 1, 'no-answer': 1 })) ? true : 'refusals ' + shortRun(p && p.refusals);
}, test.limit.quick);
test.run('packets.md says the same', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  pmd = fs.existsSync(path.join(OUT, 'packets.md')) ? fs.readFileSync(path.join(OUT, 'packets.md'), 'utf8') : '';
  return (pmd.indexOf('# Packets: ' + AGENT) === 0 && pmd.indexOf('| queue wait (ms) | 10 | 20 |') !== -1 && pmd.indexOf('| flight (ms) | 30 | 35 |') !== -1 && pmd.indexOf('4 posts, 1 needed more than one try, refusals: {"not-granted":1,"no-answer":1}.') !== -1) ? true : 'packets.md ' + shortRun(pmd);
}, test.limit.quick);
test.run('platform.md names the agent, the commit and the box', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  plat = fs.existsSync(path.join(OUT, 'platform.md')) ? fs.readFileSync(path.join(OUT, 'platform.md'), 'utf8') : '';
  return (plat.indexOf('# ' + AGENT) === 0 && plat.indexOf('| agent | ' + AGENT + ' |') !== -1 && plat.indexOf('`' + WR.COMMIT + '`') !== -1 && plat.indexOf('| node | ' + process.version + ' |') !== -1) ? true : 'platform.md ' + shortRun(plat);
}, test.limit.quick);
test.run('testState.json: testicle\'s current tests, read only, no suite run', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  ts = null;
  try { ts = JSON.parse(fs.readFileSync(path.join(OUT, 'testState.json'), 'utf8')); } catch (e) { ts = null; }
  return (ts && ts.agent === AGENT && ts.commit === WR.COMMIT && ts.tests === ts.green + ts.red && Array.isArray(ts.suites) && Array.isArray(ts.reds) && ts.reds.length === ts.red && /no suite was run/.test(ts.from) && /testicle/.test(ts.from) && !/verify/i.test(ts.from)) ? true : 'testState ' + shortRun(ts) + ' said ' + shortRun(r.out);
}, test.limit.quick);
test.run('its counts are testicle\'s current rows: every current test, the failed ones its reds, each with its script and suite', 0.2, function () {
  if (!ts) return 'no testState.json: the test before failed';
  if (!fs.existsSync(TESTICLE_DB)) return 'no testicle.db at ' + TESTICLE_DB + ': nothing judged';
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(TESTICLE_DB, { readOnly: true });
  let all = 0, red = 0;
  try { db.exec('PRAGMA busy_timeout = 5000'); all = db.prepare('SELECT COUNT(*) n FROM testicle WHERE current = 1').get().n; red = db.prepare('SELECT COUNT(*) n FROM testicle WHERE current = 1 AND verified = 0').get().n; } finally { db.close(); }
  const named = (ts.reds || []).every(function (x) { return !!x.script && !!x.suite && !!(x.test || x.title); });
  return (ts.tests === all && ts.red === red && named) ? true : 'testState says ' + ts.tests + ' tests, ' + ts.red + ' red; testicle.db holds ' + all + ' current, ' + red + ' failed; reds named ' + named;
}, test.limit.quick);
test.run('testState.md: the suites\' table and the reds', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  tsmd = fs.existsSync(path.join(OUT, 'testState.md')) ? fs.readFileSync(path.join(OUT, 'testState.md'), 'utf8') : '';
  return (tsmd.indexOf('# Test state: ' + AGENT) === 0 && tsmd.indexOf('| suite | tests | green | red | newest |') !== -1 && tsmd.indexOf('## Red') !== -1) ? true : 'testState.md ' + shortRun(tsmd);
}, test.limit.quick);
test.run('the README is written beside them (agentReadme)', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  readmeMd = fs.existsSync(path.join(OUT, 'README.md')) ? fs.readFileSync(path.join(OUT, 'README.md'), 'utf8') : '';
  return (readmeMd.indexOf('# ' + AGENT + '\n') === 0 && readmeMd.indexOf('## Measurements') !== -1) ? true : 'README ' + shortRun(readmeMd);
}, test.limit.quick);
test.run('--only packets runs no harness', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (r.out.indexOf('measurePlatform') === -1 && r.out.indexOf('harness and capacity') === -1) ? true : 'out ' + shortRun(r.out);
}, test.limit.quick);
test.run('and with --out nothing is committed and nothing posted', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (git(CLONE, ['rev-parse', 'HEAD']).out === headBefore && r.asks.every(function (a) { return a.args.name !== 'chat.add'; })) ? true : 'HEAD ' + git(CLONE, ['rev-parse', 'HEAD']).out;
}, test.limit.quick);
test.run('the node\'s own traffic log is read from a copy, untouched', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  origDb = new DatabaseSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db'), { readOnly: true });
  rowsNow = origDb.prepare('SELECT COUNT(*) AS n FROM traffic').get().n;
  origDb.close();
  return (rowsNow === ROWS.length) ? true : 'rows now ' + rowsNow;
}, test.limit.quick);

// THE FOLDER IS THE PLATFORM'S, NOT THE AGENT'S (Andy, box v104: "make sure publisData simply writes to folders identifying
// the platform, NOT the agent, the platforms will be \"windows\", \"wsl\" and \"ubuntu\"."): agents/<platform>/, the platform
// this machine is: Windows, Linux under WSL, or Ubuntu.
const PLATFORM = process.platform === 'win32' ? 'windows' : (function () { try { return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')) ? 'wsl' : 'ubuntu'; } catch (e) { return 'ubuntu'; } }());
// the whole run: harness in a worktree, then its one folder committed, pushed and said
// A traffic log that counts nothing this time: zero posts is published too.
test.run('it exits 0: published agents/<platform>/', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  fs.rmSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true, force: true });
  trafficLog(CLONE, [ROWS[6]]);
  fs.mkdirSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(CLONE, 'his-staged.txt'), 'his work in progress\n');
  git(CLONE, ['add', 'his-staged.txt']);
  before = git(CLONE, ['rev-parse', 'HEAD']).out;
  w = publish(CLONE, ['45440', '--asks', '2']);
  return (w.status === 0 && w.out.split('\n').pop() === 'publishData: published agents/' + PLATFORM + '/') ? true : 'exit ' + w.status + ' out ' + shortRun(w.out) + ' err ' + shortRun(w.err);
}, test.limit.slow);
test.run('the harness step runs measurePlatform in a worktree, and says how it ended', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (/harness and capacity in a worktree of /.test(w.out) && /measurePlatform exited /.test(w.out)) ? true : 'out ' + shortRun(w.out);
}, test.limit.quick);
test.run('and the worktree is removed after', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (git(CLONE, ['worktree', 'list', '--porcelain']).out.split('\n').filter(function (l) { return /^worktree /.test(l); }).length === 1) ? true : 'worktrees ' + shortRun(git(CLONE, ['worktree', 'list']).out);
}, test.limit.quick);
test.run('zero posts is published, and said aloud', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (w.out.indexOf('the desk asks counted 0 posts; published as measured') !== -1) ? true : 'out ' + shortRun(w.out);
}, test.limit.quick);
test.run('one commit on its clone', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  head = git(CLONE, ['rev-parse', 'HEAD']).out;
  return (head !== before && git(CLONE, ['rev-parse', head + '^']).out === before) ? true : 'HEAD ' + head;
}, test.limit.quick);
test.run('under the standing grant\'s message', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (git(CLONE, ['log', '-1', '--format=%s', head]).out.indexOf('agents/' + PLATFORM + '/') !== -1) ? true : 'message ' + shortRun(git(CLONE, ['log', '-1', '--format=%s', head]).out);
}, test.limit.quick);
test.run('its files all lie in agents/<platform>/, none in a folder named after the agent', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  files = git(CLONE, ['diff-tree', '--no-commit-id', '--name-only', '-r', head]).out.split('\n').filter(Boolean);
  return (files.length > 0 && files.every(function (f) { return f.indexOf('agents/' + PLATFORM + '/') === 0; })) ? true : 'committed ' + shortRun(files);
}, test.limit.quick);
test.run('packets, platform and README among them', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (['packets.json', 'packets.md', 'platform.md', 'README.md'].every(function (f) { return files.indexOf('agents/' + PLATFORM + '/' + f) !== -1; })) ? true : 'committed ' + shortRun(files);
}, test.limit.quick);
test.run('what he had staged stays staged, and uncommitted', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (git(CLONE, ['diff', '--cached', '--name-only']).out === 'his-staged.txt') ? true : 'staged ' + shortRun(git(CLONE, ['diff', '--cached', '--name-only']).out);
}, test.limit.quick);
test.run('pushed: the origin is at its commit', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  return (git(ORIGIN, ['rev-parse', 'refs/heads/master']).out === head) ? true : 'origin ' + git(ORIGIN, ['rev-parse', 'refs/heads/master']).out;
}, test.limit.quick);
// ALWAYS AND RELIABLY (Andy, box v104: "make sure it works, commits and pushes always and reliably so."): the origin moved on
// meanwhile, another clone's commit pushed to it; published again, it still commits, on top of that commit, and pushes.
let moved = '', w2 = null;
test.run('the world: another clone pushes a commit of its own to the origin', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  git(BARE_CLONE, ['pull', '-q', 'origin', 'master']);
  fs.writeFileSync(path.join(BARE_CLONE, 'someone-else.txt'), 'pushed meanwhile\n');
  git(BARE_CLONE, ['add', 'someone-else.txt']);
  git(BARE_CLONE, ['commit', '-q', '-m', 'someone else']);
  git(BARE_CLONE, ['push', '-q', 'origin', 'master']);
  moved = git(ORIGIN, ['rev-parse', 'refs/heads/master']).out;
  return (!!moved && moved !== head) || 'the origin did not move: ' + moved;
}, test.limit.slow);
test.run('published again, it exits 0 though the origin moved on', 0.2, function () {
  if (!moved) return 'the origin did not move: the world failed';
  w2 = publish(CLONE, ['45440', '--asks', '1']);
  return (w2.status === 0) ? true : 'exit ' + w2.status + ' out ' + shortRun(w2.out) + ' err ' + shortRun(w2.err);
}, test.limit.slow);
test.run('and the origin holds its new commit on top of the other clone\'s', 0.2, function () {
  if (!w2) return 'not published again: the test before failed';
  const top = git(ORIGIN, ['rev-parse', 'refs/heads/master']).out;
  const ancestor = git(ORIGIN, ['merge-base', '--is-ancestor', moved, top]).status === 0;
  return (top !== moved && ancestor && git(ORIGIN, ['log', '-1', '--format=%s', top]).out.indexOf('agents/' + PLATFORM + '/') !== -1) ? true : 'origin at ' + top + ', the other clone\'s ' + moved + ' its ancestor ' + ancestor;
}, test.limit.quick);

// goal/G43.22, Andy: "publishData summary is no longer needed, i only check on github.": nothing is posted to the desk.
test.run('no summary line posted to Desk', 0.2, function () {
  if (!WR.ready) return 'no scratch clone: the world failed';
  post = w.asks.filter(function (a) { return a.args.name === 'chat.add'; });
  return (w.asks.length > 0 && post.length === 0) ? true : 'posted ' + shortRun(post);
}, test.limit.quick);
