'use strict';

// spirit/run/process/js/deskClient/test/publishData.js
// The tests of process/js/deskClient/publishData.js, and of no other module (spec: ./publishData.md; goal/G41.11). The
// script runs as an agent runs it, its own process, in a scratch clone of the test's own with a bare origin beside it
// and a traffic log (relay-state/node.db) the test writes. A preload of the test's own stands in for the spirit object:
// its deskClient family answers profile.get with the agent's name and logs every ask. The harness step finds no
// measurePlatform in the scratch clone's worktree and so runs nothing. No node, no port, no real remote.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'publishData.js');
const TMP = path.join(RUN, 'test', '_tmp_publishData');
const PRELOAD = path.join(TMP, 'spiritStub.js');
const LOG = path.join(TMP, 'asks.jsonl');
const ORIGIN = path.join(TMP, 'origin.git');
const CLONE = path.join(TMP, 'clone');
const BARE_CLONE = path.join(TMP, 'nolog');
const AGENT = 'test-agent';
// The deskClient's family as the one family path function names it (goal/G41.12).
const SPIRIT = path.join(RUN, 'spirit.js');
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
  "  require: function (p) { log({ require: p }); return Promise.resolve(family); },",
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
  const r = spawnSync(process.execPath, ['-r', PRELOAD, FILE].concat(args), { cwd: cwd, encoding: 'utf8', windowsHide: true, timeout: 150000,
    env: Object.assign({}, process.env, { PD_LOG: LOG, PD_NAME: name === undefined ? AGENT : name }) });
  let asks = [];
  try { asks = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { asks = []; }
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim(), asks: asks.filter(function (a) { return a.verb; }), required: asks.filter(function (a) { return a.require; }) };
}

// The node's traffic log, as the node writes it: the rows publishData counts, and the rows it must not.
function trafficLog(clone, rows) {
  const dir = path.join(clone, 'spirit', 'run', 'relay-state');
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
  fs.writeFileSync(path.join(CLONE, '.gitignore'), 'spirit/run/relay-state/\n');
  git(CLONE, ['add', 'README.md', '.gitignore']);
  git(CLONE, ['commit', '-q', '-m', 'the first']);
  git(CLONE, ['push', '-q', '-u', 'origin', 'master']);
  git(BARE_CLONE, ['pull', '-q', 'origin', 'master']);
  trafficLog(CLONE, ROWS);
}

test.startTest('publishData.js: one measurement run per agent');

(function () {
  setup();
  const COMMIT = git(__dirname, ['rev-parse', '--short', 'HEAD']).out;

  test.subHeading('its usage, and what it needs');
  const u = publish(CLONE, []);
  ok(u.status === 2 && /^usage: node publishData.js <port of the agent's own node>/.test(u.err) && u.asks.length === 0, 'no port: exit 2, its usage, nothing asked', 'exit ' + u.status + ' err ' + short(u.err));
  const nogit = publish(os.tmpdir(), ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')]);
  ok(nogit.status === 1 && nogit.err === 'publishData: not in a git clone' && nogit.asks.length === 0, 'run outside a git clone: exit 1, saying so, nothing asked', 'exit ' + nogit.status + ' err ' + short(nogit.err));
  const noname = publish(CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'x')], '');
  ok(noname.status === 1 && /^publishData: this agent has no name at the desk yet/.test(noname.err), 'an agent with no name at the desk: exit 1, saying so', 'exit ' + noname.status + ' err ' + short(noname.err));
  const nolog = publish(BARE_CLONE, ['45440', '--only', 'packets', '--out', path.join(TMP, 'y'), '--asks', '1']);
  ok(nolog.status === 1 && nolog.err.indexOf('publishData: no traffic log at ' + path.join(BARE_CLONE, 'spirit', 'run', 'relay-state', 'node.db')) === 0, 'a clone with no traffic log: exit 1, naming where it looked', 'exit ' + nolog.status + ' err ' + short(nolog.err));

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
    'testState.json: the newest row of each test in verify.db, read only, no suite run (' + (ts && ts.tests) + ' tests, ' + (ts && ts.red) + ' red)', 'testState ' + short(ts) + ' said ' + short(r.out));
  const tsmd = fs.existsSync(path.join(OUT, 'testState.md')) ? fs.readFileSync(path.join(OUT, 'testState.md'), 'utf8') : '';
  ok(tsmd.indexOf('# Test state: ' + AGENT) === 0 && tsmd.indexOf('| suite | tests | green | red | newest |') !== -1 && tsmd.indexOf('## Red') !== -1, 'testState.md: the suites\' table and the reds', 'testState.md ' + short(tsmd));
  const readme = fs.existsSync(path.join(OUT, 'README.md')) ? fs.readFileSync(path.join(OUT, 'README.md'), 'utf8') : '';
  ok(readme.indexOf('# ' + AGENT + '\n') === 0 && readme.indexOf('## Measurements') !== -1, 'the README is written beside them (agentReadme)', 'README ' + short(readme));
  ok(r.out.indexOf('measurePlatform') === -1 && r.out.indexOf('harness and capacity') === -1, '--only packets runs no harness', 'out ' + short(r.out));
  ok(git(CLONE, ['rev-parse', 'HEAD']).out === headBefore && r.asks.every(function (a) { return a.args.name !== 'chat.add'; }), 'and with --out nothing is committed and nothing posted', 'HEAD ' + git(CLONE, ['rev-parse', 'HEAD']).out);
  const origDb = new DatabaseSync(path.join(CLONE, 'spirit', 'run', 'relay-state', 'node.db'), { readOnly: true });
  const rowsNow = origDb.prepare('SELECT COUNT(*) AS n FROM traffic').get().n;
  origDb.close();
  ok(rowsNow === ROWS.length, 'the node\'s own traffic log is read from a copy, untouched', 'rows now ' + rowsNow);

  test.subHeading('the whole run: harness in a worktree, then its one folder committed, pushed and said');
  // A traffic log that counts nothing this time: zero posts is published too.
  fs.rmSync(path.join(CLONE, 'spirit', 'run', 'relay-state'), { recursive: true, force: true });
  trafficLog(CLONE, [ROWS[6]]);
  fs.mkdirSync(path.join(CLONE, 'spirit', 'run', 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(CLONE, 'spirit', 'run', 'relay-state', 'relays.json'), '[]\n');
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
  ok(files.length > 0 && files.every(function (f) { return f.indexOf('agents/' + AGENT + '/') === 0; }), 'its files all lie in agents/<agent>/ (' + files.length + ')', 'committed ' + short(files));
  ok(['packets.json', 'packets.md', 'platform.md', 'README.md'].every(function (f) { return files.indexOf('agents/' + AGENT + '/' + f) !== -1; }), 'packets, platform and README among them', 'committed ' + short(files));
  ok(git(CLONE, ['diff', '--cached', '--name-only']).out === 'his-staged.txt', 'what he had staged stays staged, and uncommitted', 'staged ' + short(git(CLONE, ['diff', '--cached', '--name-only']).out));
  ok(git(ORIGIN, ['rev-parse', 'refs/heads/master']).out === head, 'pushed: the origin is at its commit', 'origin ' + git(ORIGIN, ['rev-parse', 'refs/heads/master']).out);
  const post = w.asks.filter(function (a) { return a.args.name === 'chat.add'; });
  let pb = null;
  try { pb = JSON.parse(post[0].args.json); } catch (e) { pb = null; }
  ok(post.length === 1 && pb && pb.id === 'goal/G0' && pb.text.indexOf('published ' + AGENT + ' at ' + COMMIT + ': wait 0/0 ms, flight 0/0 ms over 0 posts; agents/' + AGENT + '/') === 0, 'one summary line posted to Desk, under goal/G0', 'posted ' + short(post));
  fs.rmSync(TMP, { recursive: true, force: true });
}());

test.reportSuccessFailureCount();
