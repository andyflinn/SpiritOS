'use strict';

// goal/G5.1: pushOrigin, one process that sends commits already made to GitHub, even when the clone is behind origin.
// Red on today's tree (pushOrigin.js is Andy's three-line stub, 1818d97f); wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-05 (G5.1's box holds every line verbatim): "I run into the problem that you ran into while pushing
//   measurements. happens often to me, that's why i want a unified approach that i can trigger from desk, separately
//   from goalShare, so we want one unified shared approach, that ensures my commits go through."; to how it starts:
//   "Implicitly, by design, or via jobs-selector manually"; "it  must live in:
//   spirit/run/process/js/pushOrigin/pushOrigin.js"; "agreed. so it' just about sharing code among desk components.";
//   "look at spirit\run\process\js\wordpressScanner\wordpressScanner.js"; his go-all on goal/G5.
//
// THE SHAPES (the box's; where it names none, wsl-claude's picks, the builder may argue them in Desk first):
//   1  pushOrigin.js loads as shared code without running anything, and exports pushOrigin({ repo }) -> (a promise
//      of) { ok, reason }. pushOrigin.json beside it lists its arguments as wordpressScanner.json does, one of them
//      named repo. (The export's name and the argument's name are wsl-claude's picks.)
//   2  BEHIND ORIGIN: it fetches, re-stacks the clone's own commits on origin's newest, and pushes; ok true.
//   3  UNSAVED EDITS are put aside and back: a modified tracked file is still modified, with the same text, after.
//   4  A CLASH (both sides changed the same line) stops it: ok false with a reason; the clone is left as it was (same
//      HEAD, no rebase in progress, the unsaved edit still there) and origin is unchanged.
//   5  FROM JOBS: started as a job on a node that lists process/js/pushOrigin, with its arguments as ONE JSON string
//      after the script (index.html 1559; wordpressScanner.js 85 reads them the same way), it pushes.
//   6  publishData loads it in place of its own pull-and-push loop (publishData.js 183-192 today).
// LEFT OPEN, not asserted: "tries again if someone pushed meanwhile" needs a push racing inside the run, which a test
// cannot stage reliably; how many tries.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const includeList = require('../run/js/includeList.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by goal/G5.1: ';
const RUN = path.join(__dirname, '..', 'run');
const SCRIPT = path.join(RUN, 'process', 'js', 'pushOrigin', 'pushOrigin.js');
const MANIFEST = path.join(RUN, 'process', 'js', 'pushOrigin', 'pushOrigin.json');
const PUBLISH = path.join(RUN, 'process', 'js', 'deskClient', 'publishData.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 15000);
  return (function again() {
    return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return sleep(200).then(again);
    });
  }());
}
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pushorigin-'));
const kids = [];
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd || scratch, encoding: 'utf8', timeout: 60000 }); }
function who(dir) { git(['config', 'user.email', 'test@example'], dir); git(['config', 'user.name', 'test'], dir); }
function commitFile(dir, file, text, msg) {
  fs.writeFileSync(path.join(dir, file), text);
  git(['add', file], dir);
  return git(['commit', '-q', '-m', msg], dir);
}
function originLog(bare, n) { return git(['--git-dir', bare, 'log', '--format=%s', '-' + n, 'master']).stdout.trim().split('\n'); }

// A world: a bare origin with one commit holding shared.txt, a clone (ours), and another clone that pushes first.
let worlds = 0;
function world() {
  worlds += 1;
  const base = path.join(scratch, 'w' + worlds);
  fs.mkdirSync(base, { recursive: true });
  const bare = path.join(base, 'origin.git');
  git(['init', '-q', '--bare', '--initial-branch=master', bare]);
  const seed = path.join(base, 'seed');
  git(['clone', '-q', bare, seed]);
  who(seed);
  git(['checkout', '-q', '-b', 'master'], seed);
  commitFile(seed, 'shared.txt', 'line one\nline two\n', 'seed');
  git(['push', '-q', 'origin', 'master'], seed);
  const ours = path.join(base, 'ours');
  const theirs = path.join(base, 'theirs');
  git(['clone', '-q', bare, ours]);
  git(['clone', '-q', bare, theirs]);
  who(ours);
  who(theirs);
  return { bare: bare, ours: ours, theirs: theirs };
}

function loadPushOrigin() {
  try { delete require.cache[require.resolve(SCRIPT)]; } catch (e) { /* not loaded */ }
  try { const m = require(SCRIPT); return typeof m === 'function' ? m : (m && m.pushOrigin) || null; } catch (e) { return null; }
}
function run(fn, repo) {
  return Promise.resolve().then(function () { return fn({ repo: repo }); }).then(function (r) { return r || {}; },
    function (e) { return { ok: false, reason: 'threw: ' + ((e && e.message) || e) }; });
}

test.startTest('goal/G5.1: pushOrigin sends commits already made, even when the clone is behind origin');

(async function () {
  test.subHeading('1. shared code, and its arguments for the Jobs launcher');
  const fn = loadPushOrigin();
  if (fn) test.check('pushOrigin.js loads as shared code and exports pushOrigin');
  else test.fail(OWED + 'require(pushOrigin.js) gives no pushOrigin function (today it is a three-line stub)');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  const args = (manifest && Array.isArray(manifest.args)) ? manifest.args : [];
  if (args.some(function (a) { return a && a.name === 'repo'; })) test.check('pushOrigin.json lists its arguments, repo among them');
  else test.fail(OWED + 'pushOrigin.json ' + (manifest ? 'lists ' + short(args) : 'is missing'));
  if (!fn) { test.fail(OWED + 'sections 2 to 4 need the pushOrigin function; skipped'); }

  if (fn) {
    test.subHeading('2. behind origin: re-stacked and pushed');
    const w = world();
    commitFile(w.theirs, 'theirs.txt', 'theirs\n', 'theirs pushed first');
    git(['push', '-q', 'origin', 'master'], w.theirs);
    commitFile(w.ours, 'ours.txt', 'ours\n', 'ours, made while behind');
    const r = await run(fn, w.ours);
    const log = originLog(w.bare, 2);
    if (r.ok === true && log[0] === 'ours, made while behind' && log[1] === 'theirs pushed first') test.check('a clone one commit behind: its commit lands on origin, on top of the other');
    else test.fail(OWED + 'pushOrigin answered ' + short(r) + '; origin\'s last two read ' + short(log));

    test.subHeading('3. unsaved edits put aside and back');
    const u = world();
    commitFile(u.theirs, 'theirs.txt', 'theirs\n', 'theirs pushed first');
    git(['push', '-q', 'origin', 'master'], u.theirs);
    commitFile(u.ours, 'ours.txt', 'ours\n', 'ours, with an edit unsaved');
    fs.writeFileSync(path.join(u.ours, 'shared.txt'), 'line one\nline two\nunsaved\n');
    const ru = await run(fn, u.ours);
    const kept = fs.readFileSync(path.join(u.ours, 'shared.txt'), 'utf8');
    if (ru.ok === true && originLog(u.bare, 1)[0] === 'ours, with an edit unsaved' && kept === 'line one\nline two\nunsaved\n') test.check('pushed, and the unsaved edit is still in the file, unchanged');
    else test.fail(OWED + 'pushOrigin answered ' + short(ru) + '; shared.txt reads ' + short(kept));

    test.subHeading('4. a clash stops it and leaves everything as it was');
    const c = world();
    commitFile(c.theirs, 'shared.txt', 'line one CHANGED BY THEM\nline two\n', 'theirs changed line one');
    git(['push', '-q', 'origin', 'master'], c.theirs);
    commitFile(c.ours, 'shared.txt', 'line one CHANGED BY US\nline two\n', 'ours changed line one');
    fs.writeFileSync(path.join(c.ours, 'notes.txt'), 'untracked, must survive\n');
    const head = git(['rev-parse', 'HEAD'], c.ours).stdout.trim();
    const before = originLog(c.bare, 1)[0];
    const rc = await run(fn, c.ours);
    const gitDir = path.join(c.ours, '.git');
    const midRebase = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));
    const same = git(['rev-parse', 'HEAD'], c.ours).stdout.trim() === head;
    const ourText = fs.readFileSync(path.join(c.ours, 'shared.txt'), 'utf8');
    if (rc.ok === false && String(rc.reason || '').length > 0) test.check('a clash answers ok false with a reason (' + short(rc.reason) + ')');
    else test.fail(OWED + 'on a clash pushOrigin answered ' + short(rc));
    if (!midRebase && same && ourText === 'line one CHANGED BY US\nline two\n' && fs.existsSync(path.join(c.ours, 'notes.txt'))) test.check('the clone is left as it was: same HEAD, no rebase in progress, its files untouched');
    else test.fail(OWED + 'after the clash: rebase in progress ' + midRebase + ', same HEAD ' + same + ', shared.txt ' + short(ourText));
    if (originLog(c.bare, 1)[0] === before) test.check('origin is unchanged by the clash');
    else test.fail('origin moved during a clash: ' + short(originLog(c.bare, 2)));
  }

  test.subHeading('5. from Jobs: one JSON string of arguments, on a node that lists the process');
  const home = path.join(scratch, 'node', 'spirit', 'run');
  plantRun.plantRunTree(home);
  includeList.add(home, 'process/js/pushOrigin');
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] });
  kids.push(node);
  const ask = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let b = {}; try { b = JSON.parse(r.text); } catch (e) { b = {}; }
      return { status: r.status, body: b };
    }, function () { return { status: 0, body: {} }; });
  };
  await waitFor(function () { return ask({ verb: 'device.info' }).then(function (r) { return r.status === 200; }); }, 20000);
  const j = world();
  commitFile(j.theirs, 'theirs.txt', 'theirs\n', 'theirs pushed first');
  git(['push', '-q', 'origin', 'master'], j.theirs);
  commitFile(j.ours, 'ours.txt', 'ours\n', 'ours, sent from Jobs');
  const made = await ask({ verb: 'jobs.create', command: process.execPath,
    args: [path.join(home, 'process', 'js', 'pushOrigin', 'pushOrigin.js'), JSON.stringify({ repo: j.ours })], type: 'pushOrigin' });
  const landed = made.status >= 200 && made.status < 300 &&
    await waitFor(function () { return originLog(j.bare, 1)[0] === 'ours, sent from Jobs'; }, 60000);
  if (landed) test.check('started from Jobs with {"repo": ...} as one argument, it pushed the clone\'s commit');
  else test.fail(OWED + 'jobs.create answered ' + made.status + ' ' + short(made.body) + '; origin\'s last reads ' + short(originLog(j.bare, 1)));

  test.subHeading('6. publishData uses it');
  const pub = fs.readFileSync(PUBLISH, 'utf8');
  const loads = /require\([^)]*pushOrigin[^)]*\)/.test(pub);
  const ownLoop = /git\(\['pull',\s*'-q',\s*'--rebase'\]/.test(pub);
  if (loads && !ownLoop) test.check('publishData.js loads pushOrigin and has no pull-and-push loop of its own');
  else test.fail(OWED + 'publishData.js ' + (loads ? 'loads pushOrigin' : 'does not load pushOrigin') + (ownLoop ? ' and still runs its own pull --rebase' : ''));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
