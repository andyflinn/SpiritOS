'use strict';

// spirit/run/process/js/desk/test/goalShare.js
// The tests of process/js/desk/goalShare.js, and of no other module (spec: ./goalShare.md; goal/G41.11). The script
// runs as desk.js's job runs it, its own process, against scratch repositories of the test's own: a bare origin, his
// checkout (a clone with work of its own in it) and another clone that pushes in between. A pre-receive hook on the
// origin refuses pushes when the test says so. Nothing reaches a real remote.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'goalShare.js');
const TMP = path.join(RUN, 'test', '_tmp_goalShare');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', windowsHide: true });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function share(args) {
  const r = spawnSync(process.execPath, [FILE].concat(args), { cwd: TMP, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
const ORIGIN = path.join(TMP, 'origin.git');
const MIRROR = path.join(TMP, 'mirror.git');
const WORK = path.join(TMP, 'work');
const OTHER = path.join(TMP, 'other');
const REL = 'spirit/run/process/js/desk/currentGoal.json';
const COUNT = path.join(TMP, 'hookCount');
const REFUSE = path.join(TMP, 'hookRefuse');
const indexes = function () { return fs.readdirSync(os.tmpdir()).filter(function (f) { return /^spirit-goalshare-\d+\.index$/.test(f); }); };
const tipOf = function (bare, branch) { return git(bare, ['rev-parse', 'refs/heads/' + (branch || 'master')]).out; };
const ident = function (dir) { git(dir, ['config', 'user.name', 'goalShare test']); git(dir, ['config', 'user.email', 'goalshare@test.invalid']); git(dir, ['config', 'commit.gpgsign', 'false']); };

function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  git(TMP, ['init', '-q', '--bare', '-b', 'master', ORIGIN]);
  git(TMP, ['init', '-q', '--bare', '-b', 'share', MIRROR]);
  // The hook: it counts every push it is asked, and refuses while the count is at most the number in hookRefuse.
  const sh = function (p) { return p.split(path.sep).join('/'); };
  fs.writeFileSync(path.join(ORIGIN, 'hooks', 'pre-receive'), '#!/bin/sh\n' +
    'n=$(cat "' + sh(COUNT) + '" 2>/dev/null || echo 0)\nn=$((n+1))\necho $n > "' + sh(COUNT) + '"\n' +
    'limit=$(cat "' + sh(REFUSE) + '" 2>/dev/null || echo 0)\nif [ "$n" -le "$limit" ]; then echo "refused by the test" >&2; exit 1; fi\nexit 0\n',
    // Executable: git on Linux skips a hook that is not (Windows runs it anyway).
    { mode: 0o755 });
  git(TMP, ['clone', '-q', ORIGIN, WORK]);
  ident(WORK);
  fs.writeFileSync(path.join(WORK, 'README.md'), 'his repo\n');
  fs.mkdirSync(path.join(WORK, 'spirit', 'run', 'process', 'js', 'desk'), { recursive: true });
  fs.writeFileSync(path.join(WORK, REL), '{"goal":"old"}\n');
  git(WORK, ['add', '-A']);
  git(WORK, ['commit', '-q', '-m', 'the first']);
  git(WORK, ['push', '-q', 'origin', 'master']);
  git(WORK, ['remote', 'add', 'mirror', MIRROR]);
  git(WORK, ['push', '-q', 'mirror', 'master:share']);
  git(TMP, ['clone', '-q', ORIGIN, OTHER]);
  ident(OTHER);
}
function counted() { try { return Number(fs.readFileSync(COUNT, 'utf8').trim()) || 0; } catch (e) { return 0; } }
function refuseFirst(n) { fs.writeFileSync(REFUSE, String(n) + '\n'); fs.writeFileSync(COUNT, '0\n'); }

test.startTest('goalShare.js: the desk shares currentGoal.json through git itself');

(function () {
  setup();
  const before = indexes();
  const from = path.join(TMP, 'currentGoal.json');
  fs.writeFileSync(from, '{"goal":"goal/G4.21","items":[1,2]}\n');

  // His checkout as he left it: an edit unsaved, another staged, his HEAD and branch.
  fs.writeFileSync(path.join(WORK, 'README.md'), 'his repo, his unsaved edit\n');
  fs.writeFileSync(path.join(WORK, 'staged.txt'), 'his staged file\n');
  git(WORK, ['add', 'staged.txt']);
  const headBefore = git(WORK, ['rev-parse', 'HEAD']).out;
  const stagedBefore = git(WORK, ['diff', '--cached', '--name-only']).out;
  const statusBefore = git(WORK, ['status', '--porcelain']).out;
  const tip0 = tipOf(ORIGIN);

  test.subHeading('one commit on the remote\'s tip, the path set to the bytes of the file, nothing else');
  refuseFirst(0);
  const r1 = share(['--repo', WORK, '--path', REL, '--from', from]);
  ok(r1.status === 0 && /^[0-9a-f]{40}$/.test(r1.out), 'it exits 0 and prints the pushed hash', 'exit ' + r1.status + ' out ' + short(r1.out) + ' err ' + short(r1.err));
  const tip1 = tipOf(ORIGIN);
  ok(tip1 === r1.out, 'the origin\'s master is that commit', 'origin at ' + tip1);
  ok(git(ORIGIN, ['rev-parse', tip1 + '^']).out === tip0, 'its one parent is the tip it fetched', 'parent ' + git(ORIGIN, ['rev-parse', tip1 + '^']).out);
  ok(git(ORIGIN, ['show', tip1 + ':' + REL]).out + '\n' === fs.readFileSync(from, 'utf8'), 'the path holds the file\'s bytes', 'holds ' + short(git(ORIGIN, ['show', tip1 + ':' + REL]).out));
  ok(git(ORIGIN, ['diff-tree', '--no-commit-id', '--name-only', '-r', tip1]).out === REL, 'and the commit changes that one path', 'changed ' + short(git(ORIGIN, ['diff-tree', '--no-commit-id', '--name-only', '-r', tip1]).out));
  ok(git(ORIGIN, ['log', '-1', '--format=%s', tip1]).out === 'currentGoal.json, shared by the desk (goal/G4.21)', 'under its default message', 'message ' + short(git(ORIGIN, ['log', '-1', '--format=%s', tip1]).out));

  test.subHeading('his checkout is never written, pulled or rebased');
  ok(git(WORK, ['rev-parse', 'HEAD']).out === headBefore && git(WORK, ['rev-parse', 'refs/heads/master']).out === headBefore, 'his HEAD and his branch stay where they were', 'HEAD now ' + git(WORK, ['rev-parse', 'HEAD']).out);
  ok(git(WORK, ['diff', '--cached', '--name-only']).out === stagedBefore, 'his index holds what he staged, and only that', 'staged now ' + short(git(WORK, ['diff', '--cached', '--name-only']).out));
  ok(git(WORK, ['status', '--porcelain']).out === statusBefore && fs.readFileSync(path.join(WORK, 'README.md'), 'utf8') === 'his repo, his unsaved edit\n', 'his files and his unsaved edit are as he left them', 'status now ' + short(git(WORK, ['status', '--porcelain']).out));
  ok(fs.readFileSync(path.join(WORK, REL), 'utf8') === '{"goal":"old"}\n', 'his copy of the shared file is not touched: he gets it on his next pull', 'his copy ' + short(fs.readFileSync(path.join(WORK, REL), 'utf8')));
  ok(git(WORK, ['stash', 'list']).out === '', 'nothing was stashed', 'stash ' + short(git(WORK, ['stash', 'list']).out));

  test.subHeading('the same bytes again: nothing to push');
  const r2 = share(['--repo', WORK, '--path', REL, '--from', from]);
  ok(r2.status === 0 && r2.out === tip1 && tipOf(ORIGIN) === tip1, 'it exits 0 with the tip\'s hash, and makes no commit', 'exit ' + r2.status + ' out ' + short(r2.out) + ', origin ' + tipOf(ORIGIN));

  test.subHeading('somebody pushed in between: built on the newest tip');
  git(OTHER, ['pull', '-q', 'origin', 'master']);
  fs.writeFileSync(path.join(OTHER, 'theirs.txt'), 'their work\n');
  git(OTHER, ['add', 'theirs.txt']);
  git(OTHER, ['commit', '-q', '-m', 'theirs']);
  git(OTHER, ['push', '-q', 'origin', 'master']);
  const theirs = tipOf(ORIGIN);
  fs.writeFileSync(from, '{"goal":"goal/G4.22"}\n');
  const r3 = share(['--repo', WORK, '--path', REL, '--from', from, '--message', 'rules.md, shared by the desk (goal/G5.8)']);
  ok(r3.status === 0 && tipOf(ORIGIN) === r3.out && git(ORIGIN, ['rev-parse', r3.out + '^']).out === theirs, 'its commit sits on their push, which it keeps', 'exit ' + r3.status + ', parent ' + git(ORIGIN, ['rev-parse', r3.out + '^']).out + ', theirs ' + theirs);
  ok(git(ORIGIN, ['show', r3.out + ':theirs.txt']).out === 'their work', 'their file is in its tree', 'theirs.txt: ' + short(git(ORIGIN, ['show', r3.out + ':theirs.txt'])));
  ok(git(ORIGIN, ['log', '-1', '--format=%s', r3.out]).out === 'rules.md, shared by the desk (goal/G5.8)', '--message names the commit (the rules file shares this way)', 'message ' + short(git(ORIGIN, ['log', '-1', '--format=%s', r3.out]).out));

  test.subHeading('a refused push is fetched, rebuilt and tried again, at most 5 times');
  fs.writeFileSync(from, '{"goal":"goal/G4.23"}\n');
  refuseFirst(2);
  const r4 = share(['--repo', WORK, '--path', REL, '--from', from]);
  ok(r4.status === 0 && tipOf(ORIGIN) === r4.out && counted() === 3, 'refused twice, it lands on the third try', 'exit ' + r4.status + ', pushes asked ' + counted() + ', err ' + short(r4.err));
  fs.writeFileSync(from, '{"goal":"goal/G4.24"}\n');
  const tip4 = tipOf(ORIGIN);
  refuseFirst(100);
  const r5 = share(['--repo', WORK, '--path', REL, '--from', from]);
  ok(r5.status === 1 && /^goalShare: gave up after 5 tries: /.test(r5.err) && /refused by the test/.test(r5.err), 'refused every time, it gives up after 5 tries, exit 1, saying the last refusal', 'exit ' + r5.status + ', err ' + short(r5.err));
  ok(counted() === 5 && tipOf(ORIGIN) === tip4, 'it asked 5 pushes, and the origin is unchanged', 'pushes ' + counted() + ', origin ' + tipOf(ORIGIN));
  refuseFirst(0);

  test.subHeading('--remote, --branch, and a path written with backslashes');
  const r6 = share(['--repo', WORK, '--path', REL.split('/').join('\\'), '--from', from, '--remote', 'mirror', '--branch', 'share']);
  ok(r6.status === 0 && tipOf(MIRROR, 'share') === r6.out, 'it pushes to the remote and branch named', 'exit ' + r6.status + ', mirror ' + tipOf(MIRROR, 'share') + ', err ' + short(r6.err));
  ok(git(MIRROR, ['show', r6.out + ':' + REL]).out === '{"goal":"goal/G4.24"}', 'the backslashed path is the repo\'s forward-slash path', 'tree ' + short(git(MIRROR, ['ls-tree', '-r', '--name-only', r6.out]).out));
  const r7 = share(['--repo', WORK, '--path', REL, '--from', from, '--remote', 'nowhere']);
  ok(r7.status === 1 && /gave up after 5 tries: fetch/.test(r7.err), 'a remote that cannot be fetched gives up, saying fetch', 'exit ' + r7.status + ', err ' + short(r7.err));

  test.subHeading('what it needs, and what it leaves behind');
  const u1 = share(['--path', REL, '--from', from]);
  const u2 = share(['--repo', WORK, '--from', from]);
  const u3 = share(['--repo', WORK, '--path', REL]);
  ok([u1, u2, u3].every(function (u) { return u.status === 1 && /^usage: node goalShare.js --repo <dir> --path <path in the repo> --from <file>/.test(u.err); }), 'without --repo, --path or --from it exits 1 with its usage', short([u1, u2, u3]));
  const u4 = share(['--repo', WORK, '--path', REL, '--from', path.join(TMP, 'no-such.json')]);
  ok(u4.status === 1 && u4.err === 'goalShare: no file ' + path.join(TMP, 'no-such.json'), 'a --from that is not there exits 1, naming it', 'exit ' + u4.status + ', err ' + short(u4.err));
  const left = indexes().filter(function (f) { return before.indexOf(f) === -1; });
  ok(left.length === 0, 'every way out removes its temporary index (pushed, same, gave up)', 'left in tmp: ' + short(left));
  ok(git(WORK, ['rev-parse', 'HEAD']).out === headBefore && git(WORK, ['diff', '--cached', '--name-only']).out === stagedBefore, 'and after all of it his checkout is still as he left it', 'HEAD ' + git(WORK, ['rev-parse', 'HEAD']).out);
  fs.rmSync(TMP, { recursive: true, force: true });
}());

test.reportSuccessFailureCount();
