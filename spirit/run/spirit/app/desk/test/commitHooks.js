'use strict';

// spirit/run/spirit/app/desk/test/commitHooks.js
// goal/G43.23, restored from 885f1ab5^ (spirit/test/deskRules.js, its section E) on today's harness: Andy's box names
// "deskClient's commit-hook checks". Spec: ./commitHooks.md. RULES 3 AND 4 AT THE COMMIT (goal/G3.9, G4.19, G4.27): the
// three hooks commitCheck.js installs in an agent's own clone, driven end to end by real git commits and pushes. A plain
// test of the folder of commitCheck.js, the module it is most about (spirit/run/test/TEST_SYSTEM.md); commitCheck.js's
// own test (./commitCheck.js) keeps the kept reads of goal/G41.11.
// The agent's deskClient is a fake, put in place by a preload every hook's node loads (NODE_OPTIONS): it answers the kept
// reads from the facts the test sets and logs every ask, chat.add included. The node unreachable is not faked: a scratch
// copy of spirit/ and commitCheck.js whose spirit/state/environment.json names a port nobody listens on. Never Andy's
// node nor an agent's.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SCRIPT = path.join(__dirname, '..', 'commitCheck.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'commitHooks-test-'));
const fwd = function (p) { return p.replace(/\\/g, '/'); };
const PRELOAD = path.join(WORK, 'fakeDeskClient.js');
const SCENARIO = path.join(WORK, 'scenario.json');
const LOG = path.join(WORK, 'asks.jsonl');
// THE FAKE deskClient: the family's desk verb. A kept read answers from the facts the scenario holds, as deskClient's
// keptRead does (item.get with current and self beside the facts; item.files whole; item.checks), or refuses not-kept;
// a live ask (the push's chat.add) is answered { ok: true }. Every ask is logged.
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('fs');",
  "require(" + JSON.stringify(path.join(RUN, 'spirit', 'spirit.js')) + ");",
  "function log(x) { fs.appendFileSync(" + JSON.stringify(LOG) + ", JSON.stringify(x) + '\\n'); }",
  "const fake = { desk: function (a) {",
  "  const S = JSON.parse(fs.readFileSync(" + JSON.stringify(SCENARIO) + ", 'utf8'));",
  "  const name = String(a && a.name); let args = {}; try { args = JSON.parse(a.json || '{}'); } catch (e) { args = {}; }",
  "  log({ name: name, args: args, kept: a && a.kept === true });",
  "  if (a && a.kept === true) {",
  "    const id = String(args.id || ''); const f = S.items[id];",
  "    if (name === 'item.get' && !id) return Promise.resolve({ item: '', current: S.current, self: S.self });",
  "    if (!f) return Promise.resolve({ ok: false, code: 'not-kept', why: name + ' of ' + id + ' is not in the cache' });",
  "    if (name === 'item.get') return Promise.resolve({ item: JSON.stringify(f), version: 1, change: 1, current: S.current, self: S.self, goalDesign: false });",
  "    if (name === 'item.files') return Promise.resolve({ files: (S.files[id] || []).map(function (p) { return { path: p }; }), filesMore: false });",
  "    if (name === 'item.checks') return Promise.resolve({ checks: [] });",
  "    return Promise.resolve({ ok: false, code: 'not-kept', why: name + ' is no kept read' });",
  "  }",
  "  if (name === 'chat.add') return Promise.resolve({ ok: true, change: 1 });",
  "  return Promise.resolve({ ok: false, code: 'no-such-verb' });",
  "} };",
  "const real = globalThis.spirit.require;",
  "globalThis.spirit.require = function (p) { return String(p) === globalThis.spirit.familyPath('deskClient') ? Promise.resolve(fake) : real.apply(this, arguments); };",
].join('\n'));
fs.writeFileSync(LOG, '');

// The desk as the agent's node keeps it: goal/G100 current, goal/G100.1 with his Go, goal/G100.2 without, goal/G200.1
// with his Go but of another goal. Every file this suite commits is on goal/G100.1's list.
const LIST = ['c.txt', 'f.txt', 'g.txt', 'd.txt', 'e.txt'];
const facts = function (id, goal, go, status) { return { id: id, goal: goal, go: go, status: status, phase: 'build', title: id }; };
const scenario = {
  current: 'goal/G100', self: 'claude-windows',
  items: {
    'goal/G100.1': facts('goal/G100.1', 'goal/G100', true, 'running'),
    'goal/G100.2': facts('goal/G100.2', 'goal/G100', false, ''),
    'goal/G200.1': facts('goal/G200.1', 'goal/G200', true, 'running'),
  },
  files: { 'goal/G100.1': LIST, 'goal/G100.2': ['b.txt'], 'goal/G200.1': ['h.txt'] },
};
const setScenario = function () { fs.writeFileSync(SCENARIO, JSON.stringify(scenario)); };
setScenario();
const asks = function () { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return {}; } }); };
const chatLines = function () { return asks().filter(function (a) { return a.name === 'chat.add' && !a.kept; }).map(function (a) { return a.args; }); };
const lineFor = function (sha) { return chatLines().filter(function (c) { return c.id === 'goal/G100.1' && sha && String(c.text).indexOf('commit ' + sha) === 0; })[0] || null; };
async function lineSoon(sha) { for (let i = 0; i < 40; i++) { const l = lineFor(sha); if (l) return l; await sleep(250); } return null; }

const ENV = Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + fwd(PRELOAD) });
const plainEnv = Object.assign({}, process.env);
delete plainEnv.NODE_OPTIONS;
function git(cwd, args, env) {
  const r = spawnSync('git', ['-c', 'user.name=andy', '-c', 'user.email=andy@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + fwd(path.join(cwd, '.git', 'hooks'))].concat(args),
    { cwd: cwd, encoding: 'utf8', timeout: 120000, env: env || ENV, windowsHide: true });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function bareGit(cwd, args) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', timeout: 120000, env: plainEnv, windowsHide: true }); return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() }; }
const commits = function (cwd) { const r = bareGit(cwd, ['rev-list', '--count', 'HEAD']); return r.status === 0 ? Number(r.out) : 0; };
const head = function (cwd) { return bareGit(cwd, ['rev-parse', 'HEAD']).out; };
function commitWith(cwd, file, text, message, env) {
  fs.writeFileSync(path.join(cwd, file), text);
  bareGit(cwd, ['add', file]);
  const r = git(cwd, ['commit', '-m', message], env);
  // A refused commit leaves its file staged (git keeps the index when commit-msg refuses); unstage it, so the next commit
  // carries its own file alone.
  if (r.status !== 0) bareGit(cwd, ['rm', '-q', '--cached', file]);
  return r;
}

test.startTest('commitHooks: rules 3 and 4 at the commit, through the hooks commitCheck.js installs (goal/G3.9, G4.19, G4.27)');

(async function () {
  const repo = path.join(WORK, 'clone');
  fs.mkdirSync(repo);
  bareGit(repo, ['init', '-q', '--initial-branch=master']);
  bareGit(repo, ['config', 'core.autocrlf', 'false']);
  const install = spawnSync(process.execPath, [SCRIPT, 'install', '45441'], { cwd: repo, encoding: 'utf8', env: plainEnv, windowsHide: true });
  const hooks = ['commit-msg', 'post-commit', 'pre-push'].filter(function (h) { const f = path.join(repo, '.git', 'hooks', h); return fs.existsSync(f) && fs.readFileSync(f, 'utf8').indexOf('commitCheck.js') !== -1; });
  ok(install.status === 0 && hooks.length === 3, '`node commitCheck.js install <port>` in the clone exits 0 and writes its commit-msg, post-commit and pre-push hooks',
    'install exited ' + install.status + ' ' + short(String(install.stderr || install.stdout)) + '; hooks: ' + short(hooks));
  if (hooks.length !== 3) return;

  test.subHeading('E1: refused without an item of the current goal with his Go, not done; nothing committed');
  const noItem = commitWith(repo, 'a.txt', 'a', 'names no item at all');
  const notGone = commitWith(repo, 'b.txt', 'b', 'goal/G100.2: an item he never pressed Go on');
  const otherGoal = commitWith(repo, 'h.txt', 'h', 'goal/G200.1: an item of another goal');
  const n0 = commits(repo);
  ok(noItem.status !== 0 && notGone.status !== 0 && n0 === 0, 'a commit naming no item, or an item without his Go, is refused and nothing is committed',
    'no item -> ' + noItem.status + ', item without Go -> ' + notGone.status + ', commits on record: ' + n0);
  ok(otherGoal.status !== 0 && commits(repo) === 0, 'a commit naming an item of another goal than the current one is refused', 'goal/G200.1 -> ' + otherGoal.status + ' ' + short(otherGoal.err));

  test.subHeading('E2: taken on an item with his Go; written under it once the remote holds it, with its files');
  const remote = path.join(WORK, 'remote.git');
  bareGit(WORK, ['init', '-q', '--bare', '--initial-branch=master', remote]);
  bareGit(repo, ['remote', 'add', 'origin', remote]);
  const taken = commitWith(repo, 'c.txt', 'c', 'goal/G100.1: taken, he pressed Go');
  const hash = head(repo);
  const n1 = commits(repo);
  await sleep(1500);
  ok(taken.status === 0 && n1 === 1 && !lineFor(hash), 'a commit naming an item with his Go is taken, and nothing is written yet: it is written at push',
    'commit -> ' + taken.status + ' ' + short(taken.err) + '; commits: ' + n1 + '; written before the push: ' + !!lineFor(hash));
  const pushed = git(repo, ['push', '-q', 'origin', 'HEAD:master']);
  const hit = await lineSoon(hash);
  const bullets = hit ? String(hit.text).split('\n').filter(function (x) { return /^- /.test(x.trim()); }).map(function (x) { return x.trim().slice(2).trim(); }) : [];
  ok(pushed.status === 0 && !!hit && bullets.length === 1 && bullets[0] === 'c.txt', 'pushed, it is written under the item: ' + hash.slice(0, 7) + ' with "- c.txt"',
    'push -> ' + pushed.status + ' ' + short(pushed.err) + '; lines: ' + short(chatLines()));
  const viaClient = asks().filter(function (a) { return a.kept && a.name === 'item.get' && a.args.id === 'goal/G100.1'; }).length;
  ok(viaClient > 0 && !!hit, 'the check and the push asked through this agent\'s own deskClient (' + asks().length + ' asks of its desk verb), so they are counted',
    'deskClient was asked: ' + short(asks().map(function (a) { return a.name; })));

  // RE-STACKED BEFORE THE PUSH: the id written is the one the remote holds.
  const other = path.join(WORK, 'other');
  bareGit(WORK, ['clone', '-q', '-c', 'core.autocrlf=false', remote, other]);
  fs.writeFileSync(path.join(other, 'o.txt'), 'o');
  bareGit(other, ['add', 'o.txt']);
  bareGit(other, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'a commit of somebody else']);
  bareGit(other, ['push', '-q', 'origin', 'HEAD:master']);
  const made = commitWith(repo, 'f.txt', 'f', 'goal/G100.1: made before a pull re-stacks it');
  const madeAs = head(repo);
  git(repo, ['pull', '-q', '--rebase', 'origin', 'master']);
  const restackedAs = head(repo);
  const pushed2 = git(repo, ['push', '-q', 'origin', 'HEAD:master']);
  const remoteHas = bareGit(remote, ['rev-parse', 'master']).out;
  const asPushed = await lineSoon(remoteHas);
  ok(made.status === 0 && pushed2.status === 0 && madeAs !== restackedAs && remoteHas === restackedAs && !!asPushed && !lineFor(madeAs),
    'a commit re-stacked by a pull is written under the id the remote holds (' + remoteHas.slice(0, 7) + '), not the one it was made with (' + madeAs.slice(0, 7) + ')',
    'made ' + madeAs.slice(0, 7) + ', re-stacked ' + restackedAs.slice(0, 7) + ', remote ' + remoteHas.slice(0, 7) + ', push -> ' + pushed2.status + '; written as pushed ' + !!asPushed + ', as made ' + !!lineFor(madeAs));

  // A REFUSED PUSH WRITES NOTHING (goal/G4.27; Andy: "if that's what's needed. do it."). On GitHub the server refuses
  // after the pre-push hook ran; here a pre-receive hook in the bare remote refuses once.
  const hook = path.join(remote, 'hooks', 'pre-receive');
  const once = path.join(WORK, 'refused-once');
  fs.writeFileSync(hook, '#!/bin/sh\nif [ ! -f "' + fwd(once) + '" ]; then touch "' + fwd(once) + '"; echo refused once >&2; exit 1; fi\nexit 0\n');
  fs.chmodSync(hook, 0o755);
  const tried = commitWith(repo, 'g.txt', 'g', 'goal/G100.1: a push the server refuses once');
  const triedAs = head(repo);
  const refused = git(repo, ['push', '-q', 'origin', 'HEAD:master']);
  await sleep(3000);
  ok(tried.status === 0 && refused.status !== 0 && fs.existsSync(once) && !lineFor(triedAs), 'a push the server refuses writes no line for its commit (' + triedAs.slice(0, 7) + ')',
    'refused push -> ' + refused.status + ' (refused by the server ' + fs.existsSync(once) + '); a line names it: ' + !!lineFor(triedAs));
  const pushed3 = git(repo, ['push', '-q', 'origin', 'HEAD:master']);
  const remoteNow = bareGit(remote, ['rev-parse', 'master']).out;
  const landed = await lineSoon(remoteNow);
  ok(pushed3.status === 0 && remoteNow === triedAs && !!landed, 'pushed again, the line names the id the remote holds (' + remoteNow.slice(0, 7) + ')',
    'the second push -> ' + pushed3.status + '; remote ' + remoteNow.slice(0, 7) + ', a line names it: ' + !!landed);
  try { fs.unlinkSync(hook); } catch (e) { /* gone */ }

  test.subHeading('E1: a done item takes no commit');
  const nBeforeDone = commits(repo);
  scenario.items['goal/G100.1'].status = 'done';
  setScenario();
  const isDone = commitWith(repo, 'd.txt', 'd', 'goal/G100.1: done already');
  ok(isDone.status !== 0 && commits(repo) === nBeforeDone, 'a commit naming a done item is refused', 'after his Done a commit naming goal/G100.1 -> ' + isDone.status + ', commits: ' + commits(repo));
  scenario.items['goal/G100.1'].status = 'running';
  setScenario();

  test.subHeading('E3: with the agent\'s node unreachable the commit is refused, not waved through');
  // A scratch copy of the tracked spirit/ and commitCheck.js, its environment.json naming a port nobody listens on; the
  // hooks installed from it, and no preload: the real spirit object, asking a node that is not there.
  const dark = path.join(WORK, 'dark');
  const darkRun = path.join(dark, 'spirit', 'run');
  execSync('git ls-files -- spirit/run/spirit spirit/run/spirit/app/desk/commitCheck.js', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean).forEach(function (f) {
    const from = path.join(REPO, f);
    if (!fs.existsSync(from)) return;
    const to = path.join(dark, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  });
  const nobody = await freePort();
  fs.mkdirSync(path.join(darkRun, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(darkRun, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: nobody }));
  const reinstall = spawnSync(process.execPath, [path.join(darkRun, 'spirit', 'app', 'desk', 'commitCheck.js'), 'install', String(nobody)], { cwd: repo, encoding: 'utf8', env: plainEnv, windowsHide: true });
  const nBefore = commits(repo);
  const t0 = Date.now();
  const unreachable = reinstall.status === 0 ? commitWith(repo, 'e.txt', 'e', 'goal/G100.1: the node is down', plainEnv) : { status: 0, err: 'install from the scratch copy exited ' + reinstall.status + ' ' + short(reinstall.stderr) };
  // Refused for the node, not for the item: goal/G100.1 has his Go and e.txt is on its list.
  ok(reinstall.status === 0 && unreachable.status !== 0 && /could not be asked/.test(String(unreachable.err)) && commits(repo) === nBefore, 'with no node answering, the commit is refused (' + (Date.now() - t0) + ' ms) and nothing is committed',
    'with no node on port ' + nobody + ' the commit -> ' + unreachable.status + ' ' + short(unreachable.err) + ', commits: ' + commits(repo) + ' (were ' + nBefore + ')');
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); }).then(async function () {
  await sleep(500);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (e) { /* busy on win32 */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
