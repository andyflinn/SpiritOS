'use strict';

// goal/G4.21: the desk shares currentGoal.json through git itself. Red on today's tree; wsl-claude wrote it,
// claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.19 and goal/G4.21: "should my deskServer, when i cause a status change on an item,
//   automatically commit & sync currentGoal.json ?"; "a re-open would be subject to the same rule?"; "i generally only
//   read the repo. i think we should make this automatic? agree?"; "can the automatic handle the complications?"; "do
//   it"; on the shape, "yes, that's the shape."; then his Go on goal/G4.21.
//   DECIDED in its box (v2): an automation is a script beside its owner, started by the owner through its own node's
//   jobs.create; every status change of his rewrites the file, go, go-all, done, reopen and close included; the commit
//   is built on top of the remote's master with that one file alone and pushed; his checkout is never written, pulled
//   or rebased; a refused push is fetched, rebuilt and tried again, a few times.
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  spirit/run/process/js/desk/goalShare.js, run as
//        node goalShare.js --repo <dir> --path <path in the repo> --from <file> [--remote origin] [--branch master]
//      It fetches <remote>/<branch>, builds one commit on top of it that sets <path> to the bytes of <from> and changes
//      nothing else, and pushes it to <branch>. It never touches the checkout's files, index, HEAD or branches (a
//      temporary index, GIT_INDEX_FILE, is the usual way). A refused push is fetched, rebuilt and tried again, at most
//      5 times; it exits 0 once pushed and prints the pushed hash, 1 when it gives up.
//   2  desk.js takes two manifest values in place of goalFile: goalRepo (the repo to share into; default the checkout
//      holding desk.js) and goalPath (the file's path in that repo; default spirit/run/process/js/desk/currentGoal.json).
//      goalFile goes: the desk never writes into the checkout again. A server spawned with {} (every suite) shares
//      nothing, as today it writes nothing.
//   3  On go, go-all, done, reopen, close and session.set the desk writes the goal document to <its --state
//      folder>/currentGoal.json and asks its node (SPIRIT_CALLBACK_URL) jobs.create {command: node, args: [<path of
//      goalShare.js>, '--repo', goalRepo, '--path', goalPath, '--from', <that state file>]}.
//
// LEFT OPEN, not asserted: how giving up is said in Desk (the box says it is; whether goalShare or desk.js writes the
// line, and through what, is not shaped); whether two shares started close together are kept from overlapping; that a
// job the desk starts can push with his credentials (TO CHECK LIVE in the box: it can only be seen on his node).
// FOUND WHILE WRITING: a pre-receive hook cannot move a ref (git quarantines it), so "someone pushed in between" is
// tested as two halves: another clone pushes before the share (it must fetch, not build on his stale origin/master),
// and the remote refuses the first push once (it must try again).

const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.21: ';
const SHARE = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'goalShare.js');
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAgoalShareTestPeerCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAgoalShareTestOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const GOAL_PATH = 'spirit/run/process/js/desk/currentGoal.json';
const ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function git(cwd, args) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', env: ENV }); return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() }; }
function share(repo, from, extra) {
  return spawnSync(process.execPath, [SHARE, '--repo', repo, '--path', GOAL_PATH, '--from', from].concat(extra || []), { cwd: repo, encoding: 'utf8', env: ENV, timeout: 60000 });
}
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

// A bare remote with one commit, his clone of it with a change of his own staged and another unstaged, and an
// agent's clone that pushes past him, so his origin/master is behind the remote.
function world(root) {
  const remote = path.join(root, 'remote.git');
  const his = path.join(root, 'his');
  const agent = path.join(root, 'agent');
  git(root, ['init', '-q', '--bare', '-b', 'master', remote]);
  git(root, ['clone', '-q', remote, agent]);
  fs.mkdirSync(path.join(agent, path.dirname(GOAL_PATH)), { recursive: true });
  fs.writeFileSync(path.join(agent, GOAL_PATH), '{"old":true}\n');
  fs.writeFileSync(path.join(agent, 'a.txt'), 'a\n');
  git(agent, ['add', '-A']);
  git(agent, ['commit', '-q', '-m', 'first']);
  git(agent, ['push', '-q', 'origin', 'HEAD:master']);
  git(root, ['clone', '-q', remote, his]);
  fs.writeFileSync(path.join(his, 'a.txt'), 'his unstaged edit\n');
  fs.writeFileSync(path.join(his, 'b.txt'), 'his staged file\n');
  git(his, ['add', 'b.txt']);
  fs.writeFileSync(path.join(agent, 'c.txt'), 'c\n');
  git(agent, ['add', 'c.txt']);
  git(agent, ['commit', '-q', '-m', 'an agent pushes past him']);
  git(agent, ['push', '-q', 'origin', 'HEAD:master']);
  return { remote: remote, his: his, agent: agent };
}
function snapshot(repo) {
  return {
    head: git(repo, ['rev-parse', 'HEAD']).out,
    branch: git(repo, ['symbolic-ref', 'HEAD']).out,
    status: git(repo, ['status', '--porcelain']).out,
    a: fs.readFileSync(path.join(repo, 'a.txt'), 'utf8'),
    goal: fs.readFileSync(path.join(repo, GOAL_PATH), 'utf8'),
  };
}

test.startTest('goal/G4.21: the desk shares currentGoal.json through git itself');

(async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-goalshare-'));
  try {
    // ── 1. goalShare.js ──
    test.subHeading('1. goalShare builds one commit on the remote\'s master and leaves his checkout alone');
    if (!fs.existsSync(SHARE)) test.fail(OWED + 'no spirit/run/process/js/desk/goalShare.js');
    const w = world(root);
    const before = snapshot(w.his);
    const remoteBefore = git(w.remote, ['rev-parse', 'master']).out;
    const doc = path.join(root, 'doc.json');
    fs.writeFileSync(doc, '{"goal":"goal/G1","shared":1}\n');
    const r1 = fs.existsSync(SHARE) ? share(w.his, doc) : { status: -1, stdout: '', stderr: 'absent' };
    const tip = git(w.remote, ['rev-parse', 'master']).out;
    const parent = git(w.remote, ['rev-parse', 'master^']).out;
    const changed = git(w.remote, ['diff', '--name-only', 'master^', 'master']).out.split('\n').filter(Boolean);
    const content = git(w.remote, ['show', 'master:' + GOAL_PATH]).out + '\n';
    if (r1.status === 0 && tip !== remoteBefore && parent === remoteBefore) test.check('pushed one commit on top of the remote\'s master (' + tip.slice(0, 7) + ' on ' + remoteBefore.slice(0, 7) + '), not on his stale origin/master');
    else test.fail(OWED + 'goalShare exited ' + r1.status + ' ' + short(String(r1.stderr || r1.stdout)) + '; remote ' + remoteBefore.slice(0, 7) + ' -> ' + tip.slice(0, 7) + ', parent ' + parent.slice(0, 7));
    if (changed.length === 1 && changed[0] === GOAL_PATH && content === '{"goal":"goal/G1","shared":1}\n') test.check('the commit changes ' + GOAL_PATH + ' alone, to the bytes of --from');
    else test.fail(OWED + 'the commit changed ' + short(changed) + ', the file reads ' + short(content));
    if (r1.status === 0 && String(r1.stdout).indexOf(tip) !== -1) test.check('it prints the pushed hash');
    else test.fail(OWED + 'goalShare printed ' + short(String(r1.stdout)) + ', not the pushed ' + tip.slice(0, 7));
    const after = snapshot(w.his);
    if (JSON.stringify(after) === JSON.stringify(before)) test.check('his HEAD, branch, index and files are as they were, his staged and unstaged changes included');
    else test.fail('his checkout moved: before ' + short(before) + ' after ' + short(after));

    test.subHeading('2. a refused push is tried again; one that never goes through is given up');
    const hook = path.join(w.remote, 'hooks', 'pre-receive');
    const once = path.join(root, 'refused-once');
    fs.writeFileSync(hook, '#!/bin/sh\nif [ ! -f "' + once + '" ]; then touch "' + once + '"; echo refused once >&2; exit 1; fi\nexit 0\n');
    fs.chmodSync(hook, 0o755);
    fs.writeFileSync(doc, '{"goal":"goal/G1","shared":2}\n');
    const r2 = fs.existsSync(SHARE) ? share(w.his, doc) : { status: -1, stdout: '', stderr: 'absent' };
    const second = git(w.remote, ['show', 'master:' + GOAL_PATH]).out;
    if (r2.status === 0 && fs.existsSync(once) && second === '{"goal":"goal/G1","shared":2}') test.check('refused once, it fetched, rebuilt and pushed again');
    else test.fail(OWED + 'after one refusal goalShare exited ' + r2.status + ' ' + short(String(r2.stderr)) + '; the remote holds ' + short(second));
    fs.writeFileSync(hook, '#!/bin/sh\necho always refused >&2\nexit 1\n');
    const stuck = git(w.remote, ['rev-parse', 'master']).out;
    fs.writeFileSync(doc, '{"goal":"goal/G1","shared":3}\n');
    const r3 = fs.existsSync(SHARE) ? share(w.his, doc) : { status: -1, stdout: '', stderr: 'absent' };
    if (r3.status === 1 && git(w.remote, ['rev-parse', 'master']).out === stuck) test.check('refused every time, it gives up with exit 1 and the remote is unchanged');
    else test.fail(OWED + 'refused every time, goalShare exited ' + r3.status + ' ' + short(String(r3.stderr)));
    fs.unlinkSync(hook);
    const afterAll = snapshot(w.his);
    if (JSON.stringify(afterAll) === JSON.stringify(before)) test.check('and through all of it his checkout never moved');
    else test.fail('his checkout moved: before ' + short(before) + ' after ' + short(afterAll));

    // ── 2. desk.js ──
    await theDesk(root, w.his);
  } catch (e) {
    test.fail('the suite threw: ' + (e && e.stack || e));
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});

// The desk with a pretend node at SPIRIT_CALLBACK_URL that records every jobs.create and runs none.
async function theDesk(root, repo) {
  test.subHeading('3. the desk asks its node to run goalShare on each of his status changes, and writes no checkout');
  const created = [];
  const node = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      if (b.verb === 'jobs.create') created.push(b);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id: 'job-' + created.length }));
    });
  });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const callback = 'http://localhost:' + node.address().port + '/api/spirit';
  const run = async function (values, label) {
    const scratch = fs.mkdtempSync(path.join(root, label + '-'));
    const state = path.join(scratch, 'state');
    fs.mkdirSync(state, { recursive: true });
    const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
    const client = appClient.createAppClient({ rootDir: scratch });
    client.register('desk', pipe);
    const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
    const kid = spawn(process.execPath, [SERVER, JSON.stringify(values), '--pipe', pipe, '--state', state], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: callback }),
    });
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    return { call: call, state: state, stop: function () { try { kid.kill(); } catch (e) { /* gone */ } } };
  };
  const settleJobs = async function (n) { for (let i = 0; i < 40 && created.length < n; i++) await sleep(100); };
  const shareOf = function (job) {
    const a = (job && job.args) || [];
    const at = function (flag) { const i = a.indexOf(flag); return i === -1 ? '' : String(a[i + 1]); };
    return { script: String(a[0] || ''), repo: at('--repo'), path: at('--path'), from: at('--from') };
  };

  const checkoutFile = path.join(repo, GOAL_PATH);
  const checkoutBefore = fs.readFileSync(checkoutFile, 'utf8');
  const d = await run({ goalRepo: repo, goalPath: GOAL_PATH }, 'shared');
  try {
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [{ id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }) }, CW);
    await settleJobs(1);
    const onSession = created.length;
    await d.call('press', { id: 'g/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'g/G1.1', what: 'go' }, ANDY);
    await settleJobs(onSession + 1);
    const onGo = created.length;
    const job = shareOf(created[created.length - 1]);
    let held = null; try { held = JSON.parse(fs.readFileSync(job.from, 'utf8')); } catch (e) { held = null; }
    const g11 = held && (held.items || []).filter(function (x) { return x.id === 'g/G1.1'; })[0];
    if (onSession >= 1 && onGo === onSession + 1) test.check('session.set asked one jobs.create, his go one more');
    else test.fail(OWED + 'jobs.create asked ' + onSession + ' after session.set and ' + onGo + ' after his go');
    if (path.basename(job.script) === 'goalShare.js' && path.resolve(job.repo) === path.resolve(repo) && job.path === GOAL_PATH && job.from && path.resolve(path.dirname(job.from)) === path.resolve(d.state)) {
      test.check('the job is goalShare.js --repo <goalRepo> --path <goalPath> --from <the desk\'s state folder>/…');
    } else test.fail(OWED + 'the job asked was ' + short(created[created.length - 1]));
    if (held && held.goal === 'g/G1' && g11 && g11.go === true) test.check('the --from file holds the goal as his go left it (g/G1.1 go true)');
    else test.fail(OWED + 'the --from file held ' + short(held));
    await d.call('press', { id: 'g/G1.2', what: 'close' }, ANDY);
    await settleJobs(onGo + 1);
    const onClose = created.length;
    await d.call('press', { id: 'g/G1.2', what: 'reopen' }, ANDY);
    await settleJobs(onClose + 1);
    const onReopen = created.length;
    if (onClose === onGo + 1 && onReopen === onClose + 1) test.check('close and reopen each asked one jobs.create too');
    else test.fail(OWED + 'close and reopen asked ' + (onClose - onGo) + ' and ' + (onReopen - onClose) + ' jobs.create');
    await d.call('chat.add', { id: 'g/G1.1', text: 'a line is no status change' }, CW);
    await sleep(500);
    if (created.length === onReopen) test.check('a chat line asks none');
    else test.fail(OWED + 'a chat line asked ' + (created.length - onReopen) + ' jobs.create');
    if (fs.readFileSync(checkoutFile, 'utf8') === checkoutBefore) test.check('the checkout\'s ' + GOAL_PATH + ' was never written');
    else test.fail('the desk wrote into the checkout\'s ' + GOAL_PATH);
  } finally { d.stop(); }

  const bare = await run({}, 'bare');
  try {
    const n0 = created.length;
    await bare.call('session.set', { json: JSON.stringify({ goal: { id: 'h/G1', title: 'Quiet' }, items: [{ id: 'h/G1.1', title: 'A', blocks: ['h/G1'] }] }) }, CW);
    await bare.call('press', { id: 'h/G1', what: 'end-design' }, ANDY);
    await bare.call('press', { id: 'h/G1.1', what: 'go' }, ANDY);
    await sleep(800);
    if (created.length === n0) test.check('a desk spawned with {} asks no jobs.create: every suite\'s desk shares nothing');
    else test.fail(OWED + 'a desk spawned with {} asked ' + (created.length - n0) + ' jobs.create');
  } finally { bare.stop(); node.close(); }
}
