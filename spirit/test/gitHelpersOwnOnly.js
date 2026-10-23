'use strict';

// goal/G19.6: the git helpers touch only what they put there themselves. Red on today's tree.
//   Andy, 2026-10-12, to the findings of goal/G19.6: "agreed to the whole thing as stated in your last message." The
//   box of goal/G19.6 holds the findings and the decision:
//   - publishData commits its one file and nothing else staged.
//   - pushOrigin puts back exactly its own stash, or says it could not; it refuses a detached HEAD; its header says
//     what it does (retries).
//   - deskClient pulls beside the call that hands an agent its lines, never inside it, and never aborts a rebase it
//     did not start (spirit/test/deskClientPull.js, a suite of its own: it needs a deskClient running in a clone).
//   - The two lows go with it: goalShare's shared file without writtenAt, so an unchanged goal is not committed again;
//     commitCheck keys a pending commit by more than its subject.
//
// THE SHAPES (the builder's picks; the box names none):
//   1  publishData: other work staged in the agent's clone before a publish is still staged after it, and neither the
//      publish commit nor origin holds it. Run against a pretend node that answers every desk ask (profile.get names
//      the agent gemma) and a traffic log with no rows, so the publish counts 0 posts and still commits (Q16).
//   2  pushOrigin: on a detached HEAD it refuses with a reason and pushes nothing (today it pushes HEAD:HEAD, which
//      makes a branch named HEAD on origin). Its stash is found by its label: a stash somebody else made while it ran
//      (a pre-push hook here) stays where it is, and the unsaved edit comes back. A stash it cannot put back answers ok
//      false with a reason that says so, and the stash is kept, not lost.
//   3  desk.js: the goal file it shares holds no writtenAt, so the same goal is the same bytes.
//   4  commitCheck: a pending commit is known by its subject AND its patch (git patch-id), so a second commit with the
//      same subject is not written under the first one's item, and a commit re-stacked by a pull --rebase (new hash,
//      same patch) still is.

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G19.6: ';
const RUN = path.join(__dirname, '..', 'run');
const PUBLISH = path.join(RUN, 'process', 'js', 'deskClient', 'publishData.js');
const PUSH_ORIGIN = path.join(RUN, 'process', 'js', 'pushOrigin', 'pushOrigin.js');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const CW = { key: 'MCowBQYDK2VwAyEAgitHelpersTestPeerCWAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
// goal/G29.21: the owner writes the world, since an agent's session creates no goal.
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAgitHelpersTestOwnerAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function git(cwd, args, input) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', env: ENV, timeout: 60000, input: input }); return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() }; }
// A script run beside this suite's pretend node, never blocking it: spawnSync would hold the node's answers until the
// script gave up on them.
function runScript(script, args, cwd, input) {
  return new Promise(function (resolve) {
    const k = spawn(process.execPath, [script].concat(args), { cwd: cwd, env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    k.stdout.on('data', function (c) { out += c; });
    k.stderr.on('data', function (c) { err += c; });
    k.on('close', function (code) { resolve({ status: code, stdout: out, stderr: err }); });
    k.stdin.end(input || '');
  });
}
function lines(text) { return String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
// LINE ENDINGS STAY AS WRITTEN (as spirit/test/pushOrigin.js clones): core.autocrlf off, so a clash stays a clash.
const CLONE = ['clone', '-q', '-c', 'core.autocrlf=false'];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-githelpers-'));
let worlds = 0;
// A bare origin with one commit holding shared.txt, and two clones of it: ours and theirs.
function world() {
  worlds += 1;
  const base = path.join(scratch, 'w' + worlds);
  fs.mkdirSync(base, { recursive: true });
  const bare = path.join(base, 'origin.git');
  git(base, ['init', '-q', '--bare', '--initial-branch=master', bare]);
  const seed = path.join(base, 'seed');
  git(base, CLONE.concat([bare, seed]));
  git(seed, ['checkout', '-q', '-b', 'master']);
  fs.writeFileSync(path.join(seed, 'shared.txt'), 'line one\nline two\n');
  git(seed, ['add', 'shared.txt']);
  git(seed, ['commit', '-q', '-m', 'seed']);
  git(seed, ['push', '-q', 'origin', 'master']);
  const ours = path.join(base, 'ours');
  const theirs = path.join(base, 'theirs');
  git(base, CLONE.concat([bare, ours]));
  git(base, CLONE.concat([bare, theirs]));
  return { base: base, bare: bare, ours: ours, theirs: theirs };
}
function commitFile(dir, file, text, msg) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
  git(dir, ['add', file]);
  return git(dir, ['commit', '-q', '-m', msg]);
}
function loadPushOrigin() {
  try { delete require.cache[require.resolve(PUSH_ORIGIN)]; } catch (e) { /* not loaded */ }
  try { return require(PUSH_ORIGIN).pushOrigin; } catch (e) { return null; }
}
function runPush(repo) {
  const fn = loadPushOrigin();
  if (!fn) return Promise.resolve({ ok: false, reason: 'no pushOrigin' });
  return Promise.resolve().then(function () { return fn({ repo: repo }); }).then(function (r) { return r || {}; },
    function (e) { return { ok: false, reason: 'threw: ' + ((e && e.message) || e) }; });
}

// A PRETEND NODE: every POST answered {ok: true, name: 'gemma'}, which reads as the desk's answer to any desk ask
// through deskClient (deskClient.desk by name, goal/G30.6), and as a node that took a jobs.create. Each body is kept.
const heard = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    heard.push(b);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, name: 'gemma', id: 'job-' + heard.length }));
  });
});
function deskAsked(verb) {
  return heard.filter(function (b) { return b.verb === 'deskClient.desk' && b.name === verb; })
    .map(function (b) { let a = {}; try { a = JSON.parse(b.json); } catch (e) { a = {}; } return a; });
}

test.startTest('goal/G19.6: the git helpers touch only what they put there themselves');

(async function () {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const port = node.address().port;

  // ── 1. publishData ──
  test.subHeading('1. publishData commits its one folder; other staged work stays staged and goes nowhere');
  {
    const w = world();
    const clone = w.ours;
    fs.writeFileSync(path.join(clone, '.gitignore'), 'spirit/run/relay-state/\n');
    commitFile(clone, 'tracked.txt', 'tracked before\n', 'a tracked file');
    git(clone, ['push', '-q', 'origin', 'master']);
    // The traffic log publishData reads: the table, no rows.
    const dbDir = path.join(clone, 'spirit', 'run', 'relay-state');
    fs.mkdirSync(dbDir, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    const tdb = new DatabaseSync(path.join(dbDir, 'node.db'));
    tdb.exec('CREATE TABLE traffic (at TEXT, dir TEXT, kind TEXT, outcome TEXT, code TEXT, ms INTEGER, extra TEXT)');
    tdb.close();
    // The agent's own work, staged and not committed: a change to a tracked file and a new file.
    fs.writeFileSync(path.join(clone, 'tracked.txt'), 'tracked, my staged change\n');
    fs.writeFileSync(path.join(clone, 'mine.txt'), 'my new staged file\n');
    git(clone, ['add', 'tracked.txt', 'mine.txt']);
    const run = await runScript(PUBLISH, [String(port), '--asks', '1'], clone);
    const said = short(String(run.stderr).trim().slice(-260) || String(run.stdout).trim().slice(-260));
    const tipSubject = git(w.bare, ['log', '-1', '--format=%s', 'master']).out;
    const tipFiles = lines(git(w.bare, ['show', '--name-only', '--format=', 'master']).out);
    const published = run.status === 0 && /^publish: gemma/.test(tipSubject);
    if (published) test.check('publishData exited 0 and origin\'s newest commit is the publish (' + tipSubject.slice(0, 40) + ')');
    else test.fail('the world: publishData exited ' + run.status + ', origin\'s newest reads ' + short(tipSubject) + '; it said ' + said);
    if (published && tipFiles.length && tipFiles.every(function (f) { return /^agents\/gemma\//.test(f); })) test.check('the publish commit holds agents/gemma/ alone (' + tipFiles.length + ' files)');
    else test.fail(OWED + 'the publish commit holds ' + short(tipFiles));
    const onOrigin = git(w.bare, ['show', 'master:tracked.txt']).out;
    const mineOnOrigin = git(w.bare, ['cat-file', '-e', 'master:mine.txt']).status === 0;
    if (onOrigin === 'tracked before' && !mineOnOrigin) test.check('origin holds neither staged change: tracked.txt as committed, no mine.txt');
    else test.fail(OWED + 'origin holds tracked.txt ' + short(onOrigin) + ' and mine.txt ' + mineOnOrigin);
    const staged = lines(git(clone, ['diff', '--cached', '--name-only']).out);
    const text = fs.readFileSync(path.join(clone, 'tracked.txt'), 'utf8');
    if (staged.indexOf('tracked.txt') !== -1 && staged.indexOf('mine.txt') !== -1 && text === 'tracked, my staged change\n') test.check('both are still staged in the clone, uncommitted, the text unchanged');
    else test.fail(OWED + 'staged after the publish: ' + short(staged) + '; tracked.txt reads ' + short(text));
  }

  // ── 2. pushOrigin ──
  test.subHeading('2. pushOrigin refuses a detached HEAD');
  {
    const w = world();
    git(w.ours, ['checkout', '-q', '--detach']);
    commitFile(w.ours, 'ours.txt', 'ours\n', 'ours, on a detached HEAD');
    const before = git(w.bare, ['rev-parse', 'master']).out;
    const r = await runPush(w.ours);
    const heads = lines(git(w.bare, ['for-each-ref', '--format=%(refname)', 'refs/heads']).out);
    if (r.ok === false && /detached/i.test(String(r.reason || ''))) test.check('it answers ok false, the reason naming the detached HEAD (' + short(r.reason) + ')');
    else test.fail(OWED + 'on a detached HEAD pushOrigin answered ' + short(r));
    if (git(w.bare, ['rev-parse', 'master']).out === before && heads.length === 1 && heads[0] === 'refs/heads/master') test.check('origin is unchanged: master where it was, no branch named HEAD');
    else test.fail(OWED + 'origin\'s branches after: ' + short(heads));
  }

  test.subHeading('2b. pushOrigin puts back its own stash, not the newest one');
  {
    const w = world();
    commitFile(w.ours, 'ours.txt', 'ours\n', 'ours, with an edit unsaved');
    fs.writeFileSync(path.join(w.ours, 'shared.txt'), 'line one\nline two\nunsaved\n');
    // Somebody else stashes while pushOrigin runs: the pre-push hook, after pushOrigin's own stash.
    const hook = path.join(w.ours, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(hook, '#!/bin/sh\necho "the hook\'s file" > hook.txt\ngit stash push -q -u -m "the hook\'s own stash"\nexit 0\n');
    fs.chmodSync(hook, 0o755);
    const r = await runPush(w.ours);
    const kept = fs.readFileSync(path.join(w.ours, 'shared.txt'), 'utf8');
    const stashes = lines(git(w.ours, ['stash', 'list']).out);
    if (r.ok === true && git(w.bare, ['log', '-1', '--format=%s', 'master']).out === 'ours, with an edit unsaved') test.check('pushed, ok true');
    else test.fail('the world: pushOrigin answered ' + short(r));
    if (kept === 'line one\nline two\nunsaved\n' && !fs.existsSync(path.join(w.ours, 'hook.txt'))) test.check('its own stash came back (the unsaved edit), and the hook\'s did not');
    else test.fail(OWED + 'after the run shared.txt reads ' + short(kept) + ', hook.txt is ' + (fs.existsSync(path.join(w.ours, 'hook.txt')) ? 'back' : 'not back'));
    if (stashes.length === 1 && /the hook's own stash/.test(stashes[0])) test.check('the hook\'s stash is still in the list, alone');
    else test.fail(OWED + 'the stash list reads ' + short(stashes));
  }

  test.subHeading('2c. a stash it cannot put back is said, and kept');
  {
    const w = world();
    commitFile(w.ours, 'ours.txt', 'ours\n', 'ours, its stash blocked');
    fs.writeFileSync(path.join(w.ours, 'shared.txt'), 'line one\nline two\nunsaved\n');
    // The hook leaves another edit of the same file, so the stash cannot be put back over it.
    const hook = path.join(w.ours, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(hook, '#!/bin/sh\necho "the hook wrote here" > shared.txt\nexit 0\n');
    fs.chmodSync(hook, 0o755);
    const r = await runPush(w.ours);
    const stashes = lines(git(w.ours, ['stash', 'list']).out);
    if (r.ok === false && /stash/i.test(String(r.reason || ''))) test.check('it answers ok false, the reason naming the stash (' + short(r.reason) + ')');
    else test.fail(OWED + 'with its stash blocked pushOrigin answered ' + short(r));
    if (stashes.length === 1 && /pushOrigin/.test(stashes[0])) test.check('its stash is kept in the list, so the edit is not lost');
    else test.fail(OWED + 'the stash list reads ' + short(stashes));
  }

  // ── 3. desk.js, the shared goal file ──
  test.subHeading('3. the goal file the desk shares holds no writtenAt');
  {
    const d = path.join(scratch, 'desk');
    const state = path.join(d, 'state');
    fs.mkdirSync(state, { recursive: true });
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(d, 'desk', 'win32', 'process') : path.join(d, 'door.sock');
    const client = appClient.createAppClient({ rootDir: d });
    client.register('desk', pipe);
    // The world (goal/G33.7: session.set went), seeded before the desk starts; his press on the current goal writes the
    // goal file.
    test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Same' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }] });
    const kid = spawn(process.execPath, [DESK, JSON.stringify({ goalRepo: scratch, goalPath: 'currentGoal.json' }), '--pipe', pipe, '--state', state], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + port + '/api/spirit' }),
    });
    try {
      for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
      // His close of the current goal's item is one of the presses that write it (desk.js writeGoalFile).
      await client.ask({ desk: { press: { id: 'goal/G100.1', what: 'close' } } }, ANDY).catch(function () { return null; });
      const file = path.join(state, 'currentGoal.json');
      for (let i = 0; i < 30 && !fs.existsSync(file); i++) await sleep(100);
      let doc = null;
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { doc = null; }
      if (doc && doc.goal === 'goal/G100') test.check('his press on the current goal wrote the goal file (goal goal/G100)');
      else test.fail('the world: no goal file at ' + file);
      if (doc && !('writtenAt' in doc)) test.check('it holds no writtenAt: ' + short(Object.keys(doc)));
      else test.fail(OWED + 'the goal file holds ' + short(doc && Object.keys(doc)));
    } finally { try { kid.kill(); } catch (e) { /* gone */ } }
  }

  // ── 4. commitCheck ──
  test.subHeading('4. commitCheck knows a pending commit by its subject and its patch');
  {
    const w = world();
    const repo = w.ours;
    const run = function (args, input) { return runScript(CHECK, args, repo, input); };
    const gitDir = path.join(repo, '.git');
    const pendingNow = function () { try { return lines(fs.readFileSync(path.join(gitDir, 'commitCheck.pending'), 'utf8')); } catch (e) { return []; } };
    // A: checked and recorded under x/G1.1. B: the same subject, made with no check (somebody else's, or before the
    // hooks), so nothing is pending for it.
    commitFile(repo, 'a.txt', 'a\n', 'x/G1.1: the same words');
    const a = git(repo, ['rev-parse', 'HEAD']).out;
    fs.writeFileSync(path.join(gitDir, 'commitCheck.item'), 'x/G1.1');
    const rec = await run(['record', String(port)]);
    commitFile(repo, 'b.txt', 'b\n', 'x/G1.1: the same words');
    const b = git(repo, ['rev-parse', 'HEAD']).out;
    git(repo, ['push', '-q', 'origin', 'HEAD:master']);
    if (rec.status === 0 && pendingNow().length === 1) test.check('A is recorded as pending under x/G1.1');
    else test.fail('the world: record exited ' + rec.status + ' ' + short(rec.stderr) + '; pending ' + short(pendingNow()));
    const confirm = function (hashes) {
      const job = path.join(gitDir, 'commitCheck.confirm.test' + Date.now() + '.json');
      fs.writeFileSync(job, JSON.stringify({ remote: 'origin', refs: [{ ref: 'refs/heads/master', sha: git(repo, ['rev-parse', 'HEAD']).out, commits: hashes }] }));
      return run(['confirm', String(port), job]);
    };
    const writtenFor = function (hash) { return deskAsked('chat.add').filter(function (x) { return String(x.text || '').indexOf('commit ' + hash) === 0; }); };
    // The push hook first: it hands B alone (A is already on the remote's side of the range) to the helper.
    const hooked = await run(['push', String(port), 'origin'], 'refs/heads/master ' + b + ' refs/heads/master ' + a + '\n');
    if (hooked.status === 0 && /carries no pending commit/.test(hooked.stdout)) test.check('pre-push: a push carrying only B carries no pending commit');
    else test.fail(OWED + 'pre-push with only B said ' + short(String(hooked.stdout) + String(hooked.stderr)));
    await sleep(1500);
    const c1 = await confirm([b]);
    if (c1.status === 0 && !writtenFor(b).length && pendingNow().length === 1) test.check('confirm: B is written under no item, and A stays pending');
    else test.fail(OWED + 'confirm of B exited ' + c1.status + '; lines naming B: ' + writtenFor(b).length + ', pending left ' + short(pendingNow()));
    const c2 = await confirm([a]);
    const forA = writtenFor(a);
    if (c2.status === 0 && forA.length === 1 && forA[0].id === 'x/G1.1' && pendingNow().length === 0) test.check('confirm: A is written under x/G1.1 and taken off the pending list');
    else test.fail(OWED + 'confirm of A exited ' + c2.status + ' ' + short(c2.stderr) + '; lines naming A: ' + short(forA) + ', pending left ' + short(pendingNow()));
    // A re-stack by pull --rebase: a new hash, the same patch.
    commitFile(repo, 'c.txt', 'c\n', 'x/G1.1: re-stacked later');
    fs.writeFileSync(path.join(gitDir, 'commitCheck.item'), 'x/G1.1');
    await run(['record', String(port)]);
    const made = git(repo, ['rev-parse', 'HEAD']).out;
    git(w.theirs, ['pull', '-q', 'origin', 'master']);
    commitFile(w.theirs, 'o.txt', 'o\n', 'somebody else pushed');
    git(w.theirs, ['push', '-q', 'origin', 'HEAD:master']);
    git(repo, ['pull', '-q', '--rebase', 'origin', 'master']);
    const restacked = git(repo, ['rev-parse', 'HEAD']).out;
    git(repo, ['push', '-q', 'origin', 'HEAD:master']);
    const c3 = await confirm([restacked]);
    const forC = writtenFor(restacked);
    if (made !== restacked && c3.status === 0 && forC.length === 1 && forC[0].id === 'x/G1.1' && pendingNow().length === 0) test.check('a commit re-stacked by a pull (' + made.slice(0, 7) + ' -> ' + restacked.slice(0, 7) + ') is still found and written');
    else test.fail(OWED + 'made ' + made.slice(0, 7) + ', re-stacked ' + restacked.slice(0, 7) + '; confirm exited ' + c3.status + ' ' + short(c3.stderr) + '; lines naming it ' + short(forC) + ', pending left ' + short(pendingNow()));
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
