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
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/publishData/test/publishData/' + name + tempAsked); }
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/publishData/test/publishData'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
const HERE = path.join(RUN, 'spirit', 'app', 'publishData');
const FILE = path.join(HERE, 'publishData.js');
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }


// What the tests below make, each in order, read by the tests after it.
const W = {};

// the node port comes from the node that starts it
// A node that starts a job hands it SPIRIT_CALLBACK_URL, its own address (job.js); Run hands no argument. It is run from
// a folder that is no git clone, so past its arguments it stops at once, before it asks any node anything.
test.run('run with no argument, publishData does not stop at its usage', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  const port = await freePort();
  const tmp = ownTemp('spirit-publishdata');
  try {
    const env = Object.assign({}, process.env, { SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit' });
    const r = spawnSync(process.execPath, [FILE], { cwd: tmp, env: env, encoding: 'utf8', timeout: 30000 });
    W.said = String(r.stdout || '') + String(r.stderr || '');
    return (r.status !== 2 && !/usage:/.test(W.said)) ? true : false;
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}, test.limit.quick);
test.run('run with no argument, publishData goes on past its arguments to its first step', 0.2, function () {
  if (typeof W.said !== 'string') return false;
  return (/not in a git clone/.test(W.said)) ? true : false;
}, test.limit.quick);

let line, at, want, readme;

// its files and folders
// THE TEST STATE FROM TESTICLE (Andy, the cycle that deletes the desk's verifier: "publish Data uses testicle data."): it
// reads testicle's testicle.db where testicle keeps it, its state spirit/state/testicle/data/, worked out from its own line.
const TESTICLE_DB = path.join(RUN, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
test.run('publishData reads testicle\'s testicle.db where testicle keeps it, in its state folder spirit/state/testicle/data/', 0.2, function () {
  const lines = code(FILE).split('\n').filter(function (l) { return /const\s+\w+\s*=\s*path\.join\(__dirname[^;]*testicle\.db/.test(l); });
  line = (/=\s*([^;]+);/.exec(lines[0] || '') || [])[1];
  at = '';
  try { at = line ? new Function('path', '__dirname', 'return ' + line)(path, HERE) : ''; } catch (e) { at = ''; }
  return (path.resolve(String(at)) === TESTICLE_DB && !/verify\.db/.test(code(FILE))) ? true : false;
}, test.limit.quick);
test.run('agentReadme.js stands beside publishData.js and loads', 0.2, function () {
  readme = null;
  try { readme = require(path.join(HERE, 'agentReadme.js')); } catch (e) { readme = null; }
  return (!!readme && typeof readme.write === 'function') ? true : false;
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
  return (!!pub && !/chat\.add/.test(pub)) ? true : false;
}, test.limit.quick);

// ── THE RUN PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// The tests of spirit/app/publishData/publishData.js run whole, as an agent runs it, and of no other module (spec:
// ./publishData.md, section "run"; the box's red is ./publishData.js; goal/G41.11). The
// script runs as Andy's Run starts it, its own process, in a scratch clone of the test's own with a bare origin beside it
// and a traffic log (spirit/state/node.db) the test writes. A preload of the test's own stands in for the spirit object:
// its testicle family answers busy and logs every ask. No harness step runs (it went
// with the old harness). No node, no port, no real remote.
const { DatabaseSync } = require('node:sqlite');
// Its scratch folder is outside the tree (Andy: "an empty folder keeps showing up in my run:// folder"): under run/test
// the cleanup took the scratch folder and left run/test behind, empty.
const TMP = ownTemp('run');
const PRELOAD = path.join(TMP, 'spiritStub.js');
const LOG = path.join(TMP, 'asks.jsonl');
const ORIGIN = path.join(TMP, 'origin.git');
const CLONE = path.join(TMP, 'clone');
const BARE_CLONE = path.join(TMP, 'nolog');
// THE PLATFORM, NOT AN AGENT (goal/G47.1; Andy: "publishData needs to work without \"agent\" and with testicle instead of
// deskVerify."): the reports are named by the machine's platform, as their folder is.
const PLATFORM = process.platform === 'win32' ? 'windows' : (function () { try { return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')) ? 'wsl' : 'ubuntu'; } catch (e) { return 'ubuntu'; } }());
// The spirit object, whose one family path function names the testicle family (goal/G41.12).
const SPIRIT = path.join(RUN, 'spirit', 'spirit.js');
function git(cwd, args) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true }); return { status: r.status, out: String(r.stdout || '').trim() }; }

const STUB = [
  "'use strict';",
  "const fs = require('fs');",
  "const Module = require('module');",
  "const log = function (x) { fs.appendFileSync(process.env.PD_LOG, JSON.stringify(x) + '\\n'); };",
  "const family = { busy: function (a) {",
  "  log({ verb: 'busy', args: a });",
  "  return Promise.resolve({ busy: false });",
  "} };",
  "const branchPath = require(" + JSON.stringify(SPIRIT) + ").branchPath;",
  "globalThis.spirit = {",
  "  branchPath: branchPath,",
  // goal/G43.32, decided 3: on the node a script comes back at once, by its run-root path; a branch's api.js binds it.
  "  require: function (p) { if (!/\\/api\\.js$/.test(p)) return require(require('path').join(" + JSON.stringify(RUN) + ", p)); log({ require: p }); return Promise.resolve(family); },",
  "  outcome: function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function () { return { status: 0, body: null }; }); },",
  // Its job, as spirit.js's spirit.processJob: each progress it publishes is logged, in order.
  "  job: { progress: function (done, total, text) { log({ progress: { done: done, total: total, text: String(text) } }); return Promise.resolve(true); } },",
  "};",
  "const realLoad = Module._load;",
  "Module._load = function (request, parent) {",
  "  if (/(^|[\\\\/])spirit\\.js$/.test(request) && parent && /publishData\\.js$/.test(parent.filename)) return globalThis.spirit;",
  "  return realLoad.apply(this, arguments);",
  "};",
].join('\n');

function publish(cwd, args) {
  try { fs.unlinkSync(LOG); } catch (e) { /* none */ }
  // THE TEST'S OWN WORLD (goal/G43.21): run under a node, as the verifier runs it, this suite has the node's address and job in
  // its env, which publishData would take for its own; the script is handed neither, only what each case gives it.
  const ownWorld = function () { const e = Object.assign({}, process.env, { PD_LOG: LOG }); delete e.SPIRIT_CALLBACK_URL; delete e.SPIRIT_JOB_ID; return e; };
  const r = spawnSync(process.execPath, ['-r', PRELOAD, FILE].concat(args), { cwd: cwd, encoding: 'utf8', windowsHide: true, timeout: 280000,
    env: ownWorld() });
  let asks = [];
  try { asks = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { asks = []; }
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim(), asks: asks.filter(function (a) { return a.verb; }), required: asks.filter(function (a) { return a.require; }), progress: asks.filter(function (a) { return a.progress; }).map(function (a) { return a.progress; }) };
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

// run: one measurement run per platform
test.run('a scratch clone is made with a bare origin beside it and a traffic log', 0.2, function () {
  // The testicle family as the one family path function names it (goal/G41.12).
  WR.FAMILY = require(SPIRIT).branchPath('testicle');
  setup();
  WR.COMMIT = git(__dirname, ['rev-parse', '--short', 'HEAD']).out;
  WR.ready = fs.existsSync(PRELOAD) && fs.existsSync(path.join(CLONE, 'README.md')) && !!WR.COMMIT;
  return WR.ready || false;
}, test.limit.quick);

let u, nogit, nolog, OUT, headBefore, r, pg, p, pmd, plat, ts, tsmd, readmeMd, origDb, rowsNow, before, w, head, files, post;

// its usage, and what it needs
test.run('with no port given or handed by its node, publishData exits 2 with its usage and asks nothing', 0.2, function () {
  if (!WR.ready) return false;
  u = publish(CLONE, []);
  return (u.status === 2 && /^usage: node publishData.js \[<port of its node>\]/.test(u.err) && u.asks.length === 0) ? true : false;
}, test.limit.quick);
test.run('run outside a git clone, publishData exits 1 saying so and asks nothing', 0.2, function () {
  if (!WR.ready) return false;
  nogit = publish(ownTemp('nogit'), ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')]);
  return (nogit.status === 1 && nogit.err === 'publishData: not in a git clone' && nogit.asks.length === 0) ? true : false;
}, test.limit.quick);
test.run('in a clone with no traffic log, publishData exits 1 naming where it looked', 0.2, function () {
  if (!WR.ready) return false;
  nolog = publish(BARE_CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'y'), '--asks', '1']);
  return (nolog.status === 1 && nolog.err.indexOf('publishData: no traffic log at ' + path.join(BARE_CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db')) === 0) ? true : false;
}, test.limit.slow);

// --only packets --out: N read-only testicle asks, timed by the node's own traffic log
test.run('run with --only packets and --out, publishData exits 0 saying it wrote to the out folder', 0.2, function () {
  if (!WR.ready) return false;
  OUT = path.join(TMP, 'look');
  headBefore = git(CLONE, ['rev-parse', 'HEAD']).out;
  r = publish(CLONE, ['45440', '--only', 'packets', '--out', OUT, '--asks', '3']);
  return (r.status === 0 && r.out.split('\n').pop() === 'publishData: written to ' + OUT) ? true : false;
}, test.limit.long);
test.run('publishData names its platform, and its commit by the tree it runs from', 0.2, function () {
  if (!WR.ready) return false;
  return (r.out.indexOf('publishData: platform ' + PLATFORM + ', commit ' + WR.COMMIT + ', into ' + OUT) !== -1) ? true : false;
}, test.limit.quick);
// Andy: "with testicle instead of deskVerify": its read-only asks are testicle's busy, which every node's testicle answers.
test.run('publishData asks testicle busy 3 times, read-only, and asks nothing else', 0.2, function () {
  if (!WR.ready) return false;
  pg = r.asks.filter(function (a) { return a.verb === 'busy'; });
  return (pg.length === 3 && pg.every(function (a) { return JSON.stringify(a.args) === '{}'; }) && r.asks.length === 3) ? true : false;
}, test.limit.quick);
test.run('every ask goes through the testicle branch, on the spirit object', 0.2, function () {
  if (!WR.ready) return false;
  return (r.required.every(function (a) { return a.require === WR.FAMILY; })) ? true : false;
}, test.limit.quick);
test.run('packets.json names the platform, no agent, the commit, the asks and when', 0.2, function () {
  if (!WR.ready) return false;
  p = null;
  try { p = JSON.parse(fs.readFileSync(path.join(OUT, 'packets.json'), 'utf8')); } catch (e) { p = null; }
  return (p && p.platform === PLATFORM && !('agent' in p) && p.commit === WR.COMMIT && p.asks === 3 && !isNaN(Date.parse(p.measuredAt))) ? true : false;
}, test.limit.quick);
test.run('packets.json counts as posts the closing rows since it began: replies in, and requests out refused or unanswered', 0.2, function () {
  if (!WR.ready) return false;
  return (p && p.posts === 4) ? true : false;
}, test.limit.quick);
test.run('packets.json gives the queue wait as the median and worst of the rows that carry waitMs', 0.2, function () {
  if (!WR.ready) return false;
  return (p && p.waitMs.median === 10 && p.waitMs.max === 20) ? true : false;
}, test.limit.quick);
test.run('packets.json gives each row\'s flight as its ms less its wait', 0.2, function () {
  if (!WR.ready) return false;
  return (p && p.flight.median === 30 && p.flight.max === 35) ? true : false;
}, test.limit.quick);
test.run('packets.json counts as retried the rows that took more than one attempt', 0.2, function () {
  if (!WR.ready) return false;
  return (p && p.retried === 1) ? true : false;
}, test.limit.quick);
test.run('packets.json counts refusals by code, else by outcome', 0.2, function () {
  if (!WR.ready) return false;
  return (p && JSON.stringify(p.refusals) === JSON.stringify({ 'not-granted': 1, 'no-answer': 1 })) ? true : false;
}, test.limit.quick);
test.run('packets.md says the same as packets.json', 0.2, function () {
  if (!WR.ready) return false;
  pmd = fs.existsSync(path.join(OUT, 'packets.md')) ? fs.readFileSync(path.join(OUT, 'packets.md'), 'utf8') : '';
  return (pmd.indexOf('# Packets: ' + PLATFORM) === 0 && pmd.indexOf('| queue wait (ms) | 10 | 20 |') !== -1 && pmd.indexOf('| flight (ms) | 30 | 35 |') !== -1 && pmd.indexOf('4 posts, 1 needed more than one try, refusals: {"not-granted":1,"no-answer":1}.') !== -1) ? true : false;
}, test.limit.quick);
test.run('platform.md names the platform, no agent, the commit and the box', 0.2, function () {
  if (!WR.ready) return false;
  plat = fs.existsSync(path.join(OUT, 'platform.md')) ? fs.readFileSync(path.join(OUT, 'platform.md'), 'utf8') : '';
  return (plat.indexOf('# ' + PLATFORM) === 0 && plat.indexOf('| agent |') === -1 && plat.indexOf('`' + WR.COMMIT + '`') !== -1 && plat.indexOf('| node | ' + process.version + ' |') !== -1) ? true : false;
}, test.limit.quick);
test.run('testState.json holds testicle\'s current tests, read only, with no suite run', 0.2, function () {
  if (!WR.ready) return false;
  ts = null;
  try { ts = JSON.parse(fs.readFileSync(path.join(OUT, 'testState.json'), 'utf8')); } catch (e) { ts = null; }
  return (ts && ts.platform === PLATFORM && !('agent' in ts) && ts.commit === WR.COMMIT && ts.tests === ts.green + ts.red && Array.isArray(ts.suites) && Array.isArray(ts.reds) && ts.reds.length === ts.red && /no suite was run/.test(ts.from) && /testicle/.test(ts.from) && !/verify/i.test(ts.from)) ? true : false;
}, test.limit.quick);
test.run('testState.json\'s test and red counts match testicle\'s current rows, and every red names its script, suite and test', 0.2, function () {
  if (!ts) return false;
  if (!fs.existsSync(TESTICLE_DB)) return false;
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(TESTICLE_DB, { readOnly: true });
  let all = 0, red = 0;
  try { db.exec('PRAGMA busy_timeout = 5000'); all = db.prepare('SELECT COUNT(*) n FROM testicle WHERE current = 1').get().n; red = db.prepare('SELECT COUNT(*) n FROM testicle WHERE current = 1 AND verified = 0').get().n; } finally { db.close(); }
  const named = (ts.reds || []).every(function (x) { return !!x.script && !!x.suite && !!(x.test || x.title); });
  return (ts.tests === all && ts.red === red && named) ? true : false;
}, test.limit.quick);
test.run('testState.md holds the suites\' table and the reds', 0.2, function () {
  if (!WR.ready) return false;
  tsmd = fs.existsSync(path.join(OUT, 'testState.md')) ? fs.readFileSync(path.join(OUT, 'testState.md'), 'utf8') : '';
  return (tsmd.indexOf('# Test state: ' + PLATFORM) === 0 && tsmd.indexOf('| suite | tests | green | red | newest |') !== -1 && tsmd.indexOf('## Red') !== -1) ? true : false;
}, test.limit.quick);
// ── BOX v170, publishData: the platform's README (goal/G47.1; Andy: "platform/<name>/README.md", "the title: \"# Info and
// Measurements on <platform-name>\"", "about the box: \"## The Machine the Measurements come from\"", "Then come the
// measurements under the title \"## Summary\""; the box: "in this order"). Judged on the README the run above wrote.
let RL = [];
// The README's lines, blank ones left out, and the bullets that follow a heading, up to the next heading.
const bulletsUnder = function (heading) {
  const i = RL.indexOf(heading);
  if (i === -1) return null;
  const out = [];
  for (let k = i + 1; k < RL.length && !/^#/.test(RL[k]); k++) if (/^- /.test(RL[k])) out.push(RL[k]);
  return out;
};
const numberIn = function (x) { return Number(String(x).replace(/,/g, '')); };
test.run('the README is written beside them, titled "# Info and Measurements on <platform-name>"', 0.2, function () {
  if (!WR.ready) return false;
  readmeMd = fs.existsSync(path.join(OUT, 'README.md')) ? fs.readFileSync(path.join(OUT, 'README.md'), 'utf8') : '';
  RL = readmeMd.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  return RL[0] === '# Info and Measurements on ' + PLATFORM || false;
}, test.limit.quick);
// The box: "one short paragraph: \"Measurements were taken on **<Weekday>, <Month> <day-number-in-month>, <four-digit-year>**
// for repository commit **<commit-id>**\""; since goal/G49.5 with the time too (Andy: "README.md does not show the fucking
// time at all (UTC!!!)"; Q2, "write the red for publishData"): the day and the time of the run in UTC, to the minute, as
// "**Sunday, November 22, 2026, 19:38 UTC**". The run is the one just made, so its minute is now's, or the one before.
test.run('the README\'s second line says, in bold, the day and the UTC time the measurements were taken, and for which commit', 0.2, function () {
  if (!RL.length) return false;
  const stamp = function (d) {
    const day = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    return day + ', ' + d.toISOString().slice(11, 16) + ' UTC';
  };
  const now = Date.now();
  const want = [0, 1, 2].map(function (m) { return 'Measurements were taken on **' + stamp(new Date(now - m * 60000)) + '** for repository commit **' + WR.COMMIT + '**'; });
  return want.indexOf(RL[1]) !== -1 || false;
}, test.limit.quick);
test.run('the README\'s line after that is the heading "## The Machine the Measurements come from"', 0.2, function () {
  if (!RL.length) return false;
  return RL[2] === '## The Machine the Measurements come from' || false;
}, test.limit.quick);
// The six bullets, each "- **<label>**: <value>", the values node.js's system info on this machine.
let MACH = null;
test.run('under the machine heading come six bullets: OS, OS version, Node.js version, total RAM, CPU and architecture, in order', 0.2, function () {
  if (!RL.length) return false;
  const b = bulletsUnder('## The Machine the Measurements come from') || [];
  const labels = ['OS/Platform', 'OS Version', 'Node.js Version', 'Total RAM', 'CPU', 'Architecture'];
  MACH = {};
  b.forEach(function (l) { const m = /^- \*\*([^*]+)\*\*: (.+)$/.exec(l); if (m) MACH[m[1]] = m[2]; });
  const got = b.map(function (l) { return (/^- \*\*([^*]+)\*\*:/.exec(l) || [])[1] || l; });
  return JSON.stringify(got) === JSON.stringify(labels) || false;
}, test.limit.quick);
test.run('OS/Platform is node.js\'s name of this system', 0.2, function () {
  if (!MACH) return false;
  const v = String(MACH['OS/Platform'] || '');
  return (v.indexOf(os.type()) !== -1 || v.indexOf(os.platform()) !== -1) || false;
}, test.limit.quick);
test.run('OS Version is node.js\'s release of this system', 0.2, function () {
  if (!MACH) return false;
  const v = String(MACH['OS Version'] || '');
  return (v.indexOf(os.release()) !== -1 || (typeof os.version === 'function' && v.indexOf(os.version()) !== -1)) || false;
}, test.limit.quick);
test.run('Node.js Version is this node.js\'s', 0.2, function () {
  if (!MACH) return false;
  return String(MACH['Node.js Version'] || '').indexOf(process.version) !== -1 || false;
}, test.limit.quick);
test.run('Total RAM is this machine\'s, in MB or GB', 0.2, function () {
  if (!MACH) return false;
  const m = /([\d.,]+)\s*(MB|GB)/.exec(String(MACH['Total RAM'] || ''));
  const bytes = m ? numberIn(m[1]) * (m[2] === 'GB' ? 1073741824 : 1048576) : 0;
  return (bytes > 0 && Math.abs(bytes - os.totalmem()) / os.totalmem() < 0.05) || false;
}, test.limit.quick);
test.run('CPU is its model and its number of cores', 0.2, function () {
  if (!MACH) return false;
  const v = String(MACH.CPU || '');
  const cpus = os.cpus();
  const model = String((cpus[0] && cpus[0].model) || '').trim().replace(/\s+/g, ' ');
  return (!!model && v.replace(/\s+/g, ' ').indexOf(model) !== -1 && new RegExp('\\b' + cpus.length + '\\b').test(v.replace(model, ''))) || false;
}, test.limit.quick);
test.run('Architecture is node.js\'s (x64, arm64)', 0.2, function () {
  if (!MACH) return false;
  return String(MACH.Architecture || '').trim() === os.arch() || false;
}, test.limit.quick);
// "## Summary", its four lines in the box's order, and nothing else: "no raw numbers".
let SUM = null;
// goal/G48.5, Andy: "in that document's \"Summary\" section, we can list add the following 3 bullets": seven bullets since, or
// five when nothing is red, the two leader lines left out (cw, as built: "With nothing red, the two leader lines are left out").
const issuesIn = function (b) { const m = /^- The product tree, right now, has (\d[\d,]*) outstanding issues in the test database\.$/.exec(b || ''); return m ? Number(m[1].replace(/,/g, '')) : null; };
test.run('the README\'s "## Summary" comes after the machine, with seven bullets, five when nothing is red', 0.2, function () {
  if (!RL.length) return false;
  SUM = bulletsUnder('## Summary');
  const n = SUM ? issuesIn(SUM[4]) : null;
  return (!!SUM && RL.indexOf('## Summary') > RL.indexOf('## The Machine the Measurements come from') && n !== null && SUM.length === (n > 0 ? 7 : 5)) || false;
}, test.limit.quick);
// "computed by the relay's own rule": no more than the relay allows in 512 MB with nothing of it at rest, in seats.
test.run('the first summary bullet gives how many users a relay holds live streams for in 512 MB, within the relay\'s own rule', 0.2, function () {
  if (!SUM) return false;
  const m = /^- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for ([\d,]+) simultaneously\.$/.exec(SUM[0] || '');
  const relay = require(path.join(RUN, 'spirit', 'relay.js'));
  const most = Math.floor(relay.allowanceFor(512, 0) / relay.SEAT_STREAMS);
  return (!!m && numberIn(m[1]) > 0 && numberIn(m[1]) <= most) || false;
}, test.limit.quick);
test.run('the second Summary bullet is "A SpiritOS node at rest uses <MB> MB of RAM."', 0.2, function () {
  if (!SUM) return false;
  const m = /^- A SpiritOS node at rest uses ([\d.,]+) MB of RAM\.$/.exec(SUM[1] || '');
  return (!!m && numberIn(m[1]) > 0 && numberIn(m[1]) < os.totalmem() / 1048576) || false;
}, test.limit.quick);
test.run('the third Summary bullet is "A call to a node on its own machine answers in <ms> ms, the slowest in <ms> ms."', 0.2, function () {
  if (!SUM) return false;
  const m = /^- A call to a node on its own machine answers in ([\d.]+) ms, the slowest in ([\d.]+) ms\.$/.exec(SUM[2] || '');
  return (!!m && Number(m[1]) > 0 && Number(m[1]) <= Number(m[2])) || false;
}, test.limit.quick);
test.run('the fourth summary bullet gives a card request\'s time through a relay, its slowest, and the sealing and signing within it', 0.2, function () {
  if (!SUM) return false;
  const m = /^- A card request through a relay takes ([\d.]+) ms, the slowest ([\d.]+) ms; sealing and signing take ([\d.]+) ms of it\.$/.exec(SUM[3] || '');
  return (!!m && Number(m[1]) > 0 && Number(m[1]) <= Number(m[2]) && Number(m[3]) > 0 && Number(m[3]) <= Number(m[1])) || false;
}, test.limit.quick);
// THE OUTSTANDING ISSUES (goal/G48.5; Andy: "The product tree, right now, has <number> outstanding issues in the test
// database.", "The leading module responsible for that count is <full-module-name>.", "The leading test suite contributing to the
// error count is <full-suite-name>."): the module and the suite named by their full paths, each a file the tree holds.
const tracked = function (rel) { return /^spirit\/[\w./-]+\.js$/.test(rel) && fs.existsSync(path.join(RUN, rel)); };
test.run('the fifth Summary bullet is "The product tree, right now, has <number> outstanding issues in the test database."', 0.4, function () {
  if (!SUM) return false;
  return /^- The product tree, right now, has \d[\d,]* outstanding issues in the test database\.$/.test(SUM[4] || '') || false;
}, test.limit.quick);
// Andy: "fix my bullets to also reflect the errors contributed by the leading script and suite": each leader with its own count.
test.run('the sixth Summary bullet names the leading module, a script of the tree, with its count of the issues', 0.4, function () {
  if (!SUM) return false;
  if (issuesIn(SUM[4]) === 0) return SUM.length === 5 || false;
  const m = /^- The leading module responsible for that count is (\S+), with (\d[\d,]*) of them\.$/.exec(SUM[5] || '');
  const n = m ? Number(m[2].replace(/,/g, '')) : 0;
  return (!!m && tracked(m[1]) && n > 0 && n <= issuesIn(SUM[4])) || false;
}, test.limit.quick);
test.run('the seventh Summary bullet names the leading test suite, a suite of the tree, with its count of the issues', 0.4, function () {
  if (!SUM) return false;
  if (issuesIn(SUM[4]) === 0) return SUM.length === 5 || false;
  const m = /^- The leading test suite contributing to the error count is (\S+), with (\d[\d,]*) of them\.$/.exec(SUM[6] || '');
  const n = m ? Number(m[2].replace(/,/g, '')) : 0;
  return (!!m && tracked(m[1]) && /(^|\/)test\//.test(m[1]) && n > 0 && n <= issuesIn(SUM[4])) || false;
}, test.limit.quick);
// "no raw numbers: no iteration of a measurement is published, only these lines": no file it wrote holds a list of 100
// numbers or more.
test.run('no file publishData wrote holds the raw iterations of a measurement', 0.2, function () {
  if (!WR.ready) return false;
  const long = function (v) { return Array.isArray(v) ? (v.length >= 100 && v.every(function (x) { return typeof x === 'number'; })) || v.some(long) : (!!v && typeof v === 'object' && Object.keys(v).some(function (k) { return long(v[k]); })); };
  const json = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(function (f) { return /\.json$/.test(f); }) : [];
  const holding = json.filter(function (f) { try { return long(JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))); } catch (e) { return false; } });
  return (json.length > 0 && !holding.length) || false;
}, test.limit.quick);
// "## Details", its bullets links to documents beside the README: first testState.md, the general tests, below those the own
// suites.
let LINKS = null;
test.run('the README\'s "## Details" comes after Summary, its bullets links to documents beside the README, the first testState.md', 0.2, function () {
  if (!RL.length) return false;
  const b = bulletsUnder('## Details');
  LINKS = (b || []).map(function (l) { return (/^- .*\]\(([^)]+)\)/.exec(l) || [])[1] || ''; });
  const missing = LINKS.filter(function (f) { return !f || !fs.existsSync(path.join(OUT, f)); });
  return (!!b && RL.indexOf('## Details') > RL.indexOf('## Summary') && LINKS.length >= 3 && LINKS[0] === 'testState.md' && !missing.length) || false;
}, test.limit.quick);
// A document's lines that name a suite and carry counts.
const GENERAL_SUITE = /-(child|sibling)-(general|node|browser)\.js\b/;
const linkedDoc = function (f) { try { return fs.readFileSync(path.join(OUT, f), 'utf8').split('\n'); } catch (e) { return []; } };
const firstDocWith = function (pick) { for (let i = 1; i < (LINKS || []).length; i++) if (linkedDoc(LINKS[i]).some(pick)) return i; return -1; };
const generalLine = function (l) { return GENERAL_SUITE.test(l) && (l.match(/\b\d+\b/g) || []).length >= 3; };
const ownLine = function (l) { return /\/test\/[\w.-]+\.js\b/.test(l) && !GENERAL_SUITE.test(l) && (l.match(/\b\d+\b/g) || []).length >= 2; };
test.run('a linked document lists the general suites, each with the production files it judges and its green and red counts', 0.2, function () {
  if (!LINKS) return false;
  const i = firstDocWith(generalLine);
  return i > 0 || false;
}, test.limit.quick);
test.run('a second linked document, after that one, lists each production script\'s own suite with its green and red counts', 0.2, function () {
  if (!LINKS) return false;
  const g = firstDocWith(generalLine);
  const o = firstDocWith(ownLine);
  return (g > 0 && o > g) || false;
}, test.limit.quick);
// "testState.md starts with the ten scripts with the most severe reds, the most severe first, each one line: the script,
// its most severe red (severity, test and suite) and its count of reds." Judged against the reds its testState.json holds.
test.run('testState.md starts with the ten scripts with the most severe reds, the most severe first', 0.2, function () {
  if (!ts || !tsmd) return false;
  const by = {};
  (ts.reds || []).forEach(function (x) { const b = by[x.script] || (by[x.script] = { script: x.script, max: -1, count: 0, reds: [] }); b.count += 1; b.reds.push(x); if (Number(x.severity) > b.max) b.max = Number(x.severity); });
  const all = Object.keys(by).map(function (k) { return by[k]; });
  if (!all.length) return false;
  const want = Math.min(10, all.length);
  const top = tsmd.split('\n').slice(1).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, want);
  const listed = top.map(function (l) { return all.filter(function (b) { return l.indexOf(b.script) !== -1; }).sort(function (a, b) { return b.script.length - a.script.length; })[0] || null; });
  if (listed.some(function (b) { return !b; })) return false;
  const ordered = listed.every(function (b, i) { return i === 0 || listed[i - 1].max >= b.max; });
  const unlisted = all.filter(function (b) { return listed.indexOf(b) === -1; });
  const highest = listed.every(function (b) { return unlisted.every(function (u) { return u.max <= b.max; }); });
  const distinct = new Set(listed.map(function (b) { return b.script; })).size === listed.length;
  return (ordered && highest && distinct) || false;
}, test.limit.quick);
test.run('each of those top lines of testState.md names the script, its most severe red (severity, test and suite) and its count of reds', 0.2, function () {
  if (!ts || !tsmd) return false;
  const by = {};
  (ts.reds || []).forEach(function (x) { const b = by[x.script] || (by[x.script] = { script: x.script, max: -1, count: 0, reds: [] }); b.count += 1; b.reds.push(x); if (Number(x.severity) > b.max) b.max = Number(x.severity); });
  const all = Object.keys(by).map(function (k) { return by[k]; });
  if (!all.length) return false;
  const top = tsmd.split('\n').slice(1).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, Math.min(10, all.length));
  const bad = top.filter(function (l) {
    const b = all.filter(function (x) { return l.indexOf(x.script) !== -1; }).sort(function (a, c) { return c.script.length - a.script.length; })[0];
    if (!b) return true;
    const rest = l.replace(b.script, '');
    const worst = b.reds.filter(function (x) { return Number(x.severity) === b.max && rest.indexOf(x.suite) !== -1 && rest.indexOf(x.title) !== -1; });
    return !worst.length || rest.indexOf(String(b.max)) === -1 || !new RegExp('\\b' + b.count + '\\b').test(rest.replace(worst[0].suite, '').replace(worst[0].title, ''));
  });
  return !bad.length || false;
}, test.limit.quick);
test.run('run with --only packets, publishData runs no harness', 0.2, function () {
  if (!WR.ready) return false;
  return (r.out.indexOf('measurePlatform') === -1 && r.out.indexOf('harness and capacity') === -1) ? true : false;
}, test.limit.quick);
test.run('run with --out, publishData commits nothing and posts nothing', 0.2, function () {
  if (!WR.ready) return false;
  return (git(CLONE, ['rev-parse', 'HEAD']).out === headBefore && r.asks.every(function (a) { return a.args.name !== 'chat.add'; })) ? true : false;
}, test.limit.quick);
test.run('the node\'s own traffic log is read from a copy, untouched', 0.2, function () {
  if (!WR.ready) return false;
  origDb = new DatabaseSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state', 'node.db'), { readOnly: true });
  rowsNow = origDb.prepare('SELECT COUNT(*) AS n FROM traffic').get().n;
  origDb.close();
  return (rowsNow === ROWS.length) ? true : false;
}, test.limit.quick);

// THE FOLDER IS THE PLATFORM'S, NOT THE AGENT'S (Andy, box v104: "make sure publisData simply writes to folders identifying
// the platform, NOT the agent, the platforms will be \"windows\", \"wsl\" and \"ubuntu\"."): platform/<platform>/, the platform
// this machine is: Windows, Linux under WSL, or Ubuntu; box v105: "the folders: repo://platform/windows/, repo://platform/wsl/, repo://platform/ubuntu/".
const OTHER = ['windows', 'wsl', 'ubuntu'].filter(function (x) { return x !== PLATFORM; })[0];
// the whole run: harness in a worktree, then its one folder committed, pushed and said
// A traffic log that counts nothing this time: zero posts is published too.
test.run('the whole run exits 0 saying it published platform/<platform>/', 0.2, function () {
  if (!WR.ready) return false;
  fs.rmSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true, force: true });
  trafficLog(CLONE, [ROWS[6]]);
  fs.mkdirSync(path.join(CLONE, 'spirit', 'run', 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(CLONE, 'his-staged.txt'), 'his work in progress\n');
  git(CLONE, ['add', 'his-staged.txt']);
  // A tool of his in the platform folder (box v105: the folder is repo://platform/<platform>/, where his tools live),
  // committed, then edited and not staged.
  fs.mkdirSync(path.join(CLONE, 'platform', PLATFORM), { recursive: true });
  fs.writeFileSync(path.join(CLONE, 'platform', PLATFORM, 'his-tool.txt'), 'his tool\n');
  git(CLONE, ['add', 'platform/' + PLATFORM + '/his-tool.txt']);
  git(CLONE, ['commit', '-q', '--only', '-m', 'his tool', '--', 'platform/' + PLATFORM + '/his-tool.txt']);
  fs.appendFileSync(path.join(CLONE, 'platform', PLATFORM, 'his-tool.txt'), 'his edit\n');
  // ANOTHER PLATFORM'S FOLDER, published from its own machine before (box v170: platform/README.md holds "one bullet per
  // platform folder (windows, wsl, ubuntu)").
  fs.mkdirSync(path.join(CLONE, 'platform', OTHER), { recursive: true });
  fs.writeFileSync(path.join(CLONE, 'platform', OTHER, 'README.md'), '# Info and Measurements on ' + OTHER + '\n');
  git(CLONE, ['add', 'platform/' + OTHER + '/README.md']);
  git(CLONE, ['commit', '-q', '--only', '-m', 'the other platform', '--', 'platform/' + OTHER + '/README.md']);
  before = git(CLONE, ['rev-parse', 'HEAD']).out;
  w = publish(CLONE, ['45440', '--asks', '2']);
  return (w.status === 0 && w.out.split('\n').pop() === 'publishData: published platform/' + PLATFORM + '/') ? true : false;
}, test.limit.long);
// NO HARNESS STEP: it went with the old harness (Andy's commit "KILL!", e9c6cb8c, removed spirit/test/measurePlatform.js).
test.run('the whole run has no harness step, so nothing runs measurePlatform', 0.2, function () {
  if (!WR.ready) return false;
  return (w.out.indexOf('measurePlatform') === -1 && w.out.indexOf('harness and capacity') === -1) ? true : false;
}, test.limit.quick);
test.run('the whole run leaves no worktree behind', 0.2, function () {
  if (!WR.ready) return false;
  return (git(CLONE, ['worktree', 'list', '--porcelain']).out.split('\n').filter(function (l) { return /^worktree /.test(l); }).length === 1) ? true : false;
}, test.limit.quick);
test.run('a count of zero posts is published, and said aloud', 0.2, function () {
  if (!WR.ready) return false;
  return (w.out.indexOf('the testicle asks counted 0 posts; published as measured') !== -1) ? true : false;
}, test.limit.quick);
test.run('the whole run makes one commit on its clone', 0.2, function () {
  if (!WR.ready) return false;
  head = git(CLONE, ['rev-parse', 'HEAD']).out;
  return (head !== before && git(CLONE, ['rev-parse', head + '^']).out === before) ? true : false;
}, test.limit.quick);
test.run('the commit carries the standing grant\'s message', 0.2, function () {
  if (!WR.ready) return false;
  // Named by the platform, no agent (Andy: "publishData needs to work without \"agent\"").
  return (git(CLONE, ['log', '-1', '--format=%s', head]).out.indexOf('publish: ' + PLATFORM + ' at ' + WR.COMMIT + ' (platform/' + PLATFORM + '/') === 0) ? true : false;
}, test.limit.quick);
// Box v170: "on the platform it runs on, it adds that platform's folder and files, and its line in platform/README.md".
test.run('the commit\'s files all lie in platform/<platform>/, but for platform/README.md, and none in a folder named after the agent', 0.2, function () {
  if (!WR.ready) return false;
  files = git(CLONE, ['diff-tree', '--no-commit-id', '--name-only', '-r', head]).out.split('\n').filter(Boolean);
  return (files.length > 0 && files.every(function (f) { return f.indexOf('platform/' + PLATFORM + '/') === 0 || f === 'platform/README.md'; })) ? true : false;
}, test.limit.quick);
test.run('the commit\'s files include packets, platform and README', 0.2, function () {
  if (!WR.ready) return false;
  return (['packets.json', 'packets.md', 'platform.md', 'README.md'].every(function (f) { return files.indexOf('platform/' + PLATFORM + '/' + f) !== -1; })) ? true : false;
}, test.limit.quick);
// BOX v170: "platform/README.md holds the title \"Measurements exists for the following platforms\" and one bullet per
// platform folder (windows, wsl, ubuntu), each a link to that folder's README.md, and nothing else."
let PR = null;
test.run('platform/README.md is committed with the platform\'s files', 0.2, function () {
  if (!WR.ready) return false;
  PR = fs.existsSync(path.join(CLONE, 'platform', 'README.md')) ? fs.readFileSync(path.join(CLONE, 'platform', 'README.md'), 'utf8').split('\n').map(function (l) { return l.trim(); }).filter(Boolean) : null;
  return (files.indexOf('platform/README.md') !== -1 && !!PR) || false;
}, test.limit.quick);
test.run('platform/README.md is titled "Measurements exists for the following platforms"', 0.2, function () {
  if (!PR) return false;
  return /^(#+\s*)?Measurements exists for the following platforms$/.test(PR[0] || '') || false;
}, test.limit.quick);
test.run('platform/README.md then links each platform folder\'s README.md, this machine\'s and the other\'s, one bullet each, nothing else', 0.2, function () {
  if (!PR) return false;
  const rest = PR.slice(1);
  const named = rest.map(function (l) { const m = /^- \[(windows|wsl|ubuntu)\]\((windows|wsl|ubuntu)\/README\.md\)$/.exec(l); return m && m[1] === m[2] ? m[1] : null; });
  const want = [PLATFORM, OTHER].sort();
  return (named.every(Boolean) && JSON.stringify(named.slice().sort()) === JSON.stringify(want)) || false;
}, test.limit.quick);
test.run('only the files publishData wrote are committed: his tool in the platform folder is not, and his edit is still there', 0.2, function () {
  if (!WR.ready) return false;
  const edited = fs.readFileSync(path.join(CLONE, 'platform', PLATFORM, 'his-tool.txt'), 'utf8');
  return (files.indexOf('platform/' + PLATFORM + '/his-tool.txt') === -1 && /his edit/.test(edited)) ? true : false;
}, test.limit.quick);
test.run('what he had staged stays staged, and uncommitted', 0.2, function () {
  if (!WR.ready) return false;
  return (git(CLONE, ['diff', '--cached', '--name-only']).out === 'his-staged.txt') ? true : false;
}, test.limit.quick);
test.run('the commit is pushed, so the origin is at it', 0.2, function () {
  if (!WR.ready) return false;
  return (git(ORIGIN, ['rev-parse', 'refs/heads/master']).out === head) ? true : false;
}, test.limit.quick);
// ALWAYS AND RELIABLY (Andy, box v104: "make sure it works, commits and pushes always and reliably so."): the origin moved on
// meanwhile, another clone's commit pushed to it; published again, it still commits, on top of that commit, and pushes.
let moved = '', w2 = null;
test.run('another clone pushes a commit of its own to the origin', 0.2, function () {
  if (!WR.ready) return false;
  git(BARE_CLONE, ['pull', '-q', 'origin', 'master']);
  fs.writeFileSync(path.join(BARE_CLONE, 'someone-else.txt'), 'pushed meanwhile\n');
  git(BARE_CLONE, ['add', 'someone-else.txt']);
  git(BARE_CLONE, ['commit', '-q', '-m', 'someone else']);
  git(BARE_CLONE, ['push', '-q', 'origin', 'master']);
  moved = git(ORIGIN, ['rev-parse', 'refs/heads/master']).out;
  return (!!moved && moved !== head) || false;
}, test.limit.slow);
test.run('published again, publishData exits 0 though the origin moved on', 0.2, function () {
  if (!moved) return false;
  w2 = publish(CLONE, ['45440', '--asks', '1']);
  return (w2.status === 0) ? true : false;
}, test.limit.long);
test.run('the origin then holds the new commit on top of the other clone\'s', 0.2, function () {
  if (!w2) return false;
  const top = git(ORIGIN, ['rev-parse', 'refs/heads/master']).out;
  const ancestor = git(ORIGIN, ['merge-base', '--is-ancestor', moved, top]).status === 0;
  return (top !== moved && ancestor && git(ORIGIN, ['log', '-1', '--format=%s', top]).out.indexOf('platform/' + PLATFORM + '/') !== -1) ? true : false;
}, test.limit.quick);
// NOT EVEN WHEN ANOTHER MACHINE PUBLISHED ITS PLATFORM'S LINE MEANWHILE (goal/G47.1, Andy, Q36: "sure", to "fix publishData
// to write the platform list after rebasing"): andy-wsl's first publish clashed in platform/README.md, its line added to a
// base that lacked it, andy-ubuntu's line added on origin meanwhile. Here: the origin lists only the other platform, the
// clone takes that as its base; then another machine pushes a third platform's folder and its line.
const THIRD = ['windows', 'wsl', 'ubuntu'].filter(function (x) { return x !== PLATFORM && x !== OTHER; })[0];
const listOnOrigin = function () {
  const s = git(ORIGIN, ['show', 'refs/heads/master:platform/README.md']).out;
  return s.split('\n').map(function (l) { const m = /^- \[(\w+)\]\((\w+)\/README\.md\)$/.exec(l.trim()); return m && m[1] === m[2] ? m[1] : null; }).filter(Boolean).sort();
};
const foldersOnOrigin = function () {
  return git(ORIGIN, ['ls-tree', '--name-only', 'refs/heads/master', 'platform/']).out.split('\n').map(function (l) { return l.replace(/^platform\//, ''); })
    .filter(function (p) { return ['windows', 'wsl', 'ubuntu'].indexOf(p) !== -1 && git(ORIGIN, ['cat-file', '-e', 'refs/heads/master:platform/' + p + '/README.md']).status === 0; }).sort();
};
let w3 = null;
test.run('published while another machine pushed its platform\'s line to platform/README.md, publishData exits 0', 0.2, function () {
  if (!w2) return false;
  git(BARE_CLONE, ['pull', '-q', 'origin', 'master']);
  fs.writeFileSync(path.join(BARE_CLONE, 'platform', 'README.md'), '# Measurements exists for the following platforms\n\n- [' + OTHER + '](' + OTHER + '/README.md)\n');
  git(BARE_CLONE, ['commit', '-q', '-m', 'a list without this platform', '--', 'platform/README.md']);
  git(BARE_CLONE, ['push', '-q', 'origin', 'master']);
  git(CLONE, ['pull', '-q', '--rebase', '--autostash', 'origin', 'master']);
  fs.mkdirSync(path.join(BARE_CLONE, 'platform', THIRD), { recursive: true });
  fs.writeFileSync(path.join(BARE_CLONE, 'platform', THIRD, 'README.md'), '# Info and Measurements on ' + THIRD + '\n');
  fs.writeFileSync(path.join(BARE_CLONE, 'platform', 'README.md'), '# Measurements exists for the following platforms\n\n- [' + OTHER + '](' + OTHER + '/README.md)\n- [' + THIRD + '](' + THIRD + '/README.md)\n');
  git(BARE_CLONE, ['add', 'platform/' + THIRD + '/README.md', 'platform/README.md']);
  git(BARE_CLONE, ['commit', '-q', '-m', 'publish: ' + THIRD]);
  git(BARE_CLONE, ['push', '-q', 'origin', 'master']);
  w3 = publish(CLONE, ['45440', '--asks', '1']);
  return (w3.status === 0) ? true : false;
}, test.limit.long);
test.run('the origin\'s platform/README.md then lists every platform folder the origin holds', 0.2, function () {
  if (!w3) return false;
  const want = foldersOnOrigin();
  return (want.length === 3 && JSON.stringify(listOnOrigin()) === JSON.stringify(want)) ? true : false;
}, test.limit.quick);

// goal/G43.22, Andy: "publishData summary is no longer needed, i only check on github.": nothing is posted to the desk.
// ITS STEPS ARE ITS JOB'S PROGRESS (goal/G47.1; Andy: "if \"one-shot-script-apps\" (node:run:true) actually publish what
// they're doing, like publishData should"; the task row, spirit/element/monitor/task.js, shows the text its job last
// published): each step published as spirit.processJob.progress(done, total, text), in order, four steps in all.
test.run('the whole run publishes its four steps as its job\'s progress, in order, each with words', 0.2, function () {
  if (!WR.ready || !w) return false;
  const pr = w.progress || [];
  return (pr.length === 4 && pr.every(function (x, i) { return x.done === i + 1 && x.total === 4 && x.text.trim().length > 0; })) ? true : false;
}, test.limit.quick);
test.run('a look publishes the steps it takes, and not the commit', 0.2, function () {
  if (!WR.ready || !r) return false;
  const pr = r.progress || [];
  return (pr.length === 3 && pr.every(function (x, i) { return x.done === i + 1 && x.total === 4; })) ? true : false;
}, test.limit.quick);
test.run('no summary line is posted to Desk', 0.2, function () {
  if (!WR.ready) return false;
  post = w.asks.filter(function (a) { return a.verb !== 'busy'; });
  return (w.asks.length > 0 && post.length === 0) ? true : false;
}, test.limit.quick);
