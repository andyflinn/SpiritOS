'use strict';

// spirit/run/spirit/app/goalShare/test/goalShare.js
// The tests of spirit/app/goalShare/goalShare.js, and of no other module (spec: ./goalShare.md; goal/G43.28, its box).
// Andy: "move goalShare into spirit/app/goalShare/ like pushOrigin", "the goalShare file just will just push both,
// current goal and rules. AT THE SAME FUCKING TIME", "one button that says "Share Current Goal", so from my point of
// view, it has no argument". The script runs as a job runs it, its own process with nothing handed, from a copy of it
// placed in scratch repositories of the test's own: a bare origin, his checkout (a clone with work of its own in it) and
// another clone that pushes in between. A pre-receive hook on the origin refuses pushes when the test says so. Nothing
// reaches a real remote; the job's id is asked of a scratch node, never a live one.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'goalShare.js');
const JSONF = path.join(__dirname, '..', 'goalShare.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-goalshare-test-'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
// The code with its // and /* */ comments blanked, so a word in a comment is no code.
function code(src) { return String(src || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
const ORIGIN = path.join(TMP, 'origin.git');
const WORK = path.join(TMP, 'work');
const OTHER = path.join(TMP, 'other');
const GOAL = 'spirit/run/spirit/app/desk/currentGoal.json';
const RULES = 'spirit/run/spirit/app/desk/rules.md';
const STATE = path.join(WORK, 'spirit', 'run', 'spirit', 'state', 'desk', 'data');
const COPY = path.join(WORK, 'spirit', 'run', 'spirit', 'app', 'goalShare', 'goalShare.js');
const COUNT = path.join(TMP, 'hookCount');
const REFUSE = path.join(TMP, 'hookRefuse');
const tipOf = function (bare) { return git(bare, ['rev-parse', 'refs/heads/master']).out; };
const ident = function (dir) { git(dir, ['config', 'user.name', 'goalShare test']); git(dir, ['config', 'user.email', 'goalshare@test.invalid']); git(dir, ['config', 'commit.gpgsign', 'false']); };
function counted() { try { return Number(fs.readFileSync(COUNT, 'utf8').trim()) || 0; } catch (e) { return 0; } }
function refuseFirst(n) { fs.writeFileSync(REFUSE, String(n) + '\n'); fs.writeFileSync(COUNT, '0\n'); }
// Run as a job runs it: the node's executable, the script's whole path, NOTHING handed; from somewhere else.
function share(extra) {
  const r = spawnSync(process.execPath, [COPY].concat(extra || []), { cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true, timeout: 120000 });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function setState(goal, rules) {
  fs.rmSync(STATE, { recursive: true, force: true });
  fs.mkdirSync(STATE, { recursive: true });
  if (goal !== null) fs.writeFileSync(path.join(STATE, 'currentGoal.json'), goal);
  if (rules !== null) fs.writeFileSync(path.join(STATE, 'rules.md'), rules);
}
function snapshot(dir) {
  const out = {};
  (fs.existsSync(dir) ? fs.readdirSync(dir) : []).forEach(function (f) { const s = fs.statSync(path.join(dir, f)); out[f] = read(path.join(dir, f)) + '|' + s.mtimeMs; });
  return JSON.stringify(out);
}
function setup() {
  git(TMP, ['init', '-q', '--bare', '-b', 'master', ORIGIN]);
  fs.writeFileSync(path.join(ORIGIN, 'hooks', 'pre-receive'), '#!/bin/sh\n' +
    'n=$(cat "' + COUNT + '" 2>/dev/null || echo 0)\nn=$((n+1))\necho $n > "' + COUNT + '"\n' +
    'limit=$(cat "' + REFUSE + '" 2>/dev/null || echo 0)\nif [ "$n" -le "$limit" ]; then echo "refused by the test" >&2; exit 1; fi\nexit 0\n', { mode: 0o755 });
  git(TMP, ['clone', '-q', ORIGIN, WORK]);
  ident(WORK);
  fs.mkdirSync(path.join(WORK, 'spirit', 'run', 'spirit', 'app', 'desk'), { recursive: true });
  fs.writeFileSync(path.join(WORK, 'README.md'), 'his repo\n');
  fs.writeFileSync(path.join(WORK, GOAL), '{"goal":"old"}\n');
  git(WORK, ['add', '-A']);
  git(WORK, ['commit', '-q', '-m', 'the first']);
  git(WORK, ['push', '-q', 'origin', 'master']);
  git(TMP, ['clone', '-q', ORIGIN, OTHER]);
  ident(OTHER);
  // The script where the move puts it, inside his checkout, so it finds the checkout that holds it.
  fs.mkdirSync(path.dirname(COPY), { recursive: true });
  if (fs.existsSync(FILE)) fs.copyFileSync(FILE, COPY);
}

test.startTest('goalShare.js: goalShare is an app of its own, and shares the current goal and the rules in one commit, with no argument (goal/G43.28)');

(async function () {
  test.subHeading('1. goalShare.js and its test in spirit/app/goalShare/, gone from desk\'s folder');
  ok(fs.existsSync(FILE), 'spirit/app/goalShare/goalShare.js is there', 'no spirit/app/goalShare/goalShare.js');
  ok(fs.existsSync(path.join(__dirname, 'goalShare.md')), 'its spec, spirit/app/goalShare/test/goalShare.md, is there', 'no spirit/app/goalShare/test/goalShare.md');
  const desk = path.join(RUN, 'spirit', 'app', 'desk');
  const left = ['goalShare.js', 'test/goalShare.js', 'test/goalShare.md'].filter(function (f) { return fs.existsSync(path.join(desk, f)); });
  ok(!left.length, 'spirit/app/desk/ holds no goalShare.js nor its test', 'still in spirit/app/desk/: ' + short(left));

  test.subHeading('2. goalShare.json: an app with no mount at all, but node run true');
  let own = null;
  try { own = JSON.parse(read(JSONF)); } catch (e) { own = null; }
  ok(!!own, 'goalShare.json is there and is JSON', 'no goalShare.json, or not JSON: ' + short(read(JSONF).slice(0, 120)));
  const id = (own && own.identity) || {};
  ok(!!own && typeof id.icon === 'string' && id.icon.length > 0 && id.label === 'Goal Share' && id.intrinsic === false,
    'its identity: an icon, label Goal Share, not intrinsic', 'identity: ' + short(id));
  const mounts = own && own.mount && typeof own.mount === 'object' ? Object.keys(own.mount).filter(function (k) { return own.mount[k]; }) : [];
  ok(!!own && !mounts.length && !(own.shell && (own.shell.mount === true || own.shell.tile === true)) && !(own.node && own.node.mount === true),
    'no mount, no shell mount, no tile, no node mount (Andy: "it\'s an app with NO mount at all, but a node:run:true")', 'mounts: ' + short({ mount: own && own.mount, shell: own && own.shell, node: own && own.node }));
  ok(!!own && !!own.node && own.node.run === true, 'node run true', 'node: ' + short(own && own.node));

  test.subHeading('3. no arguments any more; one commit in a temporary index, his checkout never written');
  const src = code(read(FILE));
  // An argument read is a --name in its code, or process.argv asked at all.
  const named = ['repo', 'path', 'from', 'remote', 'branch', 'message'].filter(function (a) { return new RegExp('--' + a + '\\b|arg\\(\\s*[\'"]' + a + '[\'"]').test(src); })
    .concat(/process\.argv/.test(src) ? ['process.argv'] : []);
  ok(src.length > 0 && !named.length, 'its code reads no argument: no --repo, --path, --from, --remote, --branch, --message', src.length ? 'it still reads ' + short(named) : 'no code to judge');
  ok(/GIT_INDEX_FILE/.test(src), 'it builds its commit in a temporary index (GIT_INDEX_FILE), from objects only', 'no GIT_INDEX_FILE in its code');

  setup();
  // His checkout as he left it: an edit unsaved, another staged.
  fs.writeFileSync(path.join(WORK, 'README.md'), 'his repo, his unsaved edit\n');
  fs.writeFileSync(path.join(WORK, 'staged.txt'), 'his staged file\n');
  git(WORK, ['add', 'staged.txt']);
  const headBefore = git(WORK, ['rev-parse', 'HEAD']).out;
  const stagedBefore = git(WORK, ['diff', '--cached', '--name-only']).out;
  const tip0 = tipOf(ORIGIN);

  test.subHeading('6. both, the current goal and the rules, at the same time: one commit, pushed once');
  setState('{"goal":"goal/G43","items":[28]}\n', '# Desk rules, active\n\nrule one\n');
  const stateBefore = snapshot(STATE);
  refuseFirst(0);
  const r1 = share();
  const tip1 = tipOf(ORIGIN);
  ok(r1.status === 0 && tip1 !== tip0, 'run with nothing handed, it exits 0 and the origin moves', 'exit ' + r1.status + ' out ' + short(r1.out) + ' err ' + short(r1.err));
  ok(tip1 !== tip0 && git(ORIGIN, ['rev-parse', tip1 + '^']).out === tip0, 'one commit on the tip it fetched', 'parent ' + git(ORIGIN, ['rev-parse', tip1 + '^']).out);
  const changed = git(ORIGIN, ['diff-tree', '--no-commit-id', '--name-only', '-r', tip1]).out.split('\n').filter(Boolean).sort();
  ok(JSON.stringify(changed) === JSON.stringify([GOAL, RULES].sort()), 'the one commit sets both paths, currentGoal.json and rules.md, and nothing else', 'changed: ' + short(changed));
  ok(git(ORIGIN, ['show', tip1 + ':' + GOAL]).out + '\n' === read(path.join(STATE, 'currentGoal.json')) && git(ORIGIN, ['show', tip1 + ':' + RULES]).out + '\n' === read(path.join(STATE, 'rules.md')),
    'each path holds the bytes of desk\'s state file', 'goal ' + short(git(ORIGIN, ['show', tip1 + ':' + GOAL]).out) + ', rules ' + short(git(ORIGIN, ['show', tip1 + ':' + RULES]).out));
  ok(counted() === 1, 'pushed once', 'pushes asked: ' + counted());

  test.subHeading('9. it commits into the checkout that holds it, whatever is handed');
  ok(r1.status === 0 && tip1 !== tip0, 'started from elsewhere with nothing handed, it found his checkout by its own place', 'exit ' + r1.status);
  setState('{"goal":"goal/G43","items":[28,29]}\n', '# Desk rules, active\n\nrule one\n');
  const elsewhere = path.join(TMP, 'elsewhere');
  git(TMP, ['init', '-q', elsewhere]);
  const r9 = share(['--repo', elsewhere, '--path', 'x.json', '--from', path.join(STATE, 'currentGoal.json')]);
  ok(r9.status === 0 && git(ORIGIN, ['show', tipOf(ORIGIN) + ':' + GOAL]).out === '{"goal":"goal/G43","items":[28,29]}', 'handed the old arguments, it ignores them and shares into its own checkout', 'exit ' + r9.status + ', err ' + short(r9.err));
  const deskCode = code(read(path.join(RUN, 'spirit', 'app', 'desk', 'nodeDesk.js')));
  // Box v9, line 9 (Andy: "desk fucking well knows which repo it sits in AND if fucking well knows the path of the
  // goal-share file."): no switch. desk.json carries no goalRepo or goalPath, desk reads neither, and it shares whenever
  // it sits in a git checkout, found by walking up to the folder with .git; from no checkout it shares and pulls nothing.
  let deskJson = null;
  try { deskJson = JSON.parse(read(path.join(RUN, 'spirit', 'app', 'desk', 'desk.json'))); } catch (e) { deskJson = null; }
  const deskArgs = deskJson && Array.isArray(deskJson.args) ? deskJson.args.map(function (x) { return x && x.name; }) : [];
  ok(!!deskJson, 'desk.json is JSON, so the node can read desk\'s manifest', 'desk.json does not parse');
  ok(!!deskJson && deskArgs.indexOf('goalRepo') === -1 && deskArgs.indexOf('goalPath') === -1, 'desk.json carries no goalRepo or goalPath', 'desk.json args: ' + short(deskArgs));
  ok(!/values\.goalRepo|values\.goalPath/.test(deskCode), 'desk reads no goalRepo or goalPath: no switch', 'nodeDesk.js still reads values.goalRepo or values.goalPath');
  ok(/existsSync\(\s*path\.join\(\s*\w+\s*,\s*'\.git'\s*\)\s*\)/.test(deskCode) && /if\s*\(\s*!GOAL_SHARED/.test(deskCode) && /GOAL_SHARED\s*=[^;\n]*\bGOAL_REPO\b/.test(deskCode),
    'desk shares whenever it sits in a git checkout, found by walking up to .git, and not otherwise', 'nodeDesk.js does not decide sharing by the checkout it sits in');

  test.subHeading('3. his checkout is never written, pulled or rebased');
  ok(git(WORK, ['rev-parse', 'HEAD']).out === headBefore, 'his HEAD stays where it was', 'HEAD now ' + git(WORK, ['rev-parse', 'HEAD']).out);
  ok(git(WORK, ['diff', '--cached', '--name-only']).out === stagedBefore, 'his index holds what he staged, and only that', 'staged now ' + short(git(WORK, ['diff', '--cached', '--name-only']).out));
  ok(read(path.join(WORK, 'README.md')) === 'his repo, his unsaved edit\n' && read(path.join(WORK, GOAL)) === '{"goal":"old"}\n', 'his files and his unsaved edit are as he left them', 'README ' + short(read(path.join(WORK, 'README.md'))));

  test.subHeading('3. a refused push is rebuilt on the new tip and tried again');
  git(OTHER, ['pull', '-q', 'origin', 'master']);
  fs.writeFileSync(path.join(OTHER, 'theirs.txt'), 'their work\n');
  git(OTHER, ['add', 'theirs.txt']);
  git(OTHER, ['commit', '-q', '-m', 'theirs']);
  git(OTHER, ['push', '-q', 'origin', 'master']);
  const theirs = tipOf(ORIGIN);
  setState('{"goal":"goal/G43","items":[30]}\n', '# Desk rules, active\n\nrule two\n');
  refuseFirst(2);
  const r3 = share();
  const tip3 = tipOf(ORIGIN);
  ok(r3.status === 0 && counted() === 3 && git(ORIGIN, ['rev-parse', tip3 + '^']).out === theirs && git(ORIGIN, ['show', tip3 + ':theirs.txt']).out === 'their work',
    'refused twice, it lands on the third try, on their push, which it keeps', 'exit ' + r3.status + ', pushes ' + counted() + ', parent ' + git(ORIGIN, ['rev-parse', tip3 + '^']).out + ', err ' + short(r3.err));
  refuseFirst(0);

  test.subHeading('10. a share with nothing to share does nothing');
  setState(null, null);
  const tipNone = tipOf(ORIGIN);
  const r10 = share();
  ok(r10.status === 0 && /nothing to share/.test(r10.out + ' ' + r10.err) && tipOf(ORIGIN) === tipNone && counted() === 0,
    'with neither file in desk\'s state it says "nothing to share", exits 0, and makes no commit', 'exit ' + r10.status + ', out ' + short(r10.out) + ', err ' + short(r10.err) + ', pushes ' + counted());
  setState(null, '# Desk rules, active\n\nrule three\n');
  const r10b = share();
  const tipB = tipOf(ORIGIN);
  const changedB = tipB !== tipNone ? git(ORIGIN, ['diff-tree', '--no-commit-id', '--name-only', '-r', tipB]).out : '';
  ok(r10b.status === 0 && changedB === RULES, 'with only the rules in desk\'s state, the rules alone are shared', 'exit ' + r10b.status + ', changed ' + short(changedB) + ', err ' + short(r10b.err));

  test.subHeading('11. it only reads desk\'s state; it never writes there');
  setState('{"goal":"goal/G43","items":[31]}\n', '# Desk rules, active\n\nrule four\n');
  const before11 = snapshot(STATE);
  share();
  ok(snapshot(STATE) === before11, 'desk\'s state folder is as it was: no file written, changed or added', 'state before ' + short(before11) + ', after ' + short(snapshot(STATE)));
  ok(stateBefore.length > 2, 'the world: desk\'s state held both files when it was read', 'state ' + short(stateBefore));

  test.subHeading('4. desk starts it at its new place, with no arguments');
  const create = /jobs\.create\(\s*\{[\s\S]*?args\s*:\s*\[([^\]]*)\][\s\S]*?\}\s*\)/.exec(deskCode);
  const argsOf = create ? create[1] : '';
  ok(!!create && /goalShare[\/'", ]+goalShare\.js|'goalShare',\s*'goalShare\.js'/.test(argsOf), 'nodeDesk.js hands jobs.create spirit/app/goalShare/goalShare.js', 'jobs.create args: ' + short(argsOf || 'no jobs.create in nodeDesk.js'));
  // The args array's own elements: a call's parentheses taken out first, so path.join(a, b) counts as one.
  let flat = argsOf;
  while (/\([^()]*\)/.test(flat)) flat = flat.replace(/\([^()]*\)/g, '');
  ok(!!create && !/--repo|--path|--from|--message/.test(argsOf) && flat.split(',').filter(function (a) { return a.trim(); }).length === 1,
    'and nothing else: no --repo, --path, --from, --message', 'jobs.create args: ' + short(argsOf));
  ok(!/path\.join\(\s*__dirname\s*,\s*'goalShare\.js'\s*\)/.test(deskCode), 'desk no longer starts the goalShare.js beside it', 'nodeDesk.js still joins __dirname with goalShare.js');

  test.subHeading('8. no file names spirit/app/desk/goalShare.js any more');
  const tracked = spawnSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
    .filter(function (f) { return !/(^|\/)currentGoal\.json$/.test(f) && f.indexOf('spirit/run/brains/') !== 0 && f.indexOf('agents/') !== 0 && !/\.(png|jpe?g|gif|ico|db)$/.test(f) && f !== 'spirit/run/spirit/app/goalShare/test/goalShare.js'; });
  const naming = tracked.filter(function (f) { return /spirit\/app\/desk\/goalShare\.js/.test(read(path.join(REPO, f))); });
  ok(!naming.length, 'no tracked file names spirit/app/desk/goalShare.js', naming.length + ' do: ' + short(naming));
  const jobsDoc = read(path.join(RUN, 'spirit', 'test', 'jobs.js')) + read(path.join(RUN, 'spirit', 'test', 'jobs.md'));
  ok(!/desk\.js:2608/.test(jobsDoc) && /spirit\/app\/goalShare\/goalShare\.js/.test(jobsDoc) && /nodeDesk\.js/.test(jobsDoc),
    'spirit/test/jobs.js and jobs.md name nodeDesk.js and spirit/app/goalShare/goalShare.js, not desk.js:2608', 'jobs.js/.md still say desk.js:2608, or name neither');

  test.subHeading('7. the test of desk\'s move is gone');
  ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'test', 'api-deskMove.js')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'test', 'api-deskMove.md')),
    'spirit/app/test/api-deskMove.js and .md are deleted', 'api-deskMove is still there');

  test.subHeading('5, 2. on a node: its job is spirit.app.goalShare, started without being switched on');
  const node = await H.scratchNode();
  if (!node.up) test.fail('the scratch node did not come up: nothing judged');
  else {
    const ask = function (call, args) {
      return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
        .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
    };
    const made = await ask('jobs.create', { command: process.execPath, args: [path.join(node.root, 'spirit', 'run', 'spirit', 'app', 'goalShare', 'goalShare.js')] });
    const key = made.body && (made.body.id || made.body.key || (made.body.job && (made.body.job.id || made.body.job.key)));
    ok(made.status >= 200 && made.status < 300 && !!key, 'the node takes a goalShare job though nobody switched it on', 'jobs.create answered ' + short(made));
    let mod = '';
    if (key) { const g = await ask('jobs.get', { key: String(key) }); mod = String(((g.body || {}).job || g.body || {}).module || ''); }
    ok(mod === 'spirit.app.goalShare', 'its job\'s module is spirit.app.goalShare, never desk\'s', 'module ' + short(mod || 'not found'));
    if (node.child) node.child.kill();
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail('the suite threw ' + (e && e.stack || e)); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (x) { /* scratch */ } test.reportSuccessFailureCount(); process.exit(0); });
