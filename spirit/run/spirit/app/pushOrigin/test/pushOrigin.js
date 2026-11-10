'use strict';

// spirit/run/spirit/app/pushOrigin/test/pushOrigin.js
// PUSHORIGIN RUN WITH NO REPO (goal/G43.21; spec: ./pushOrigin.md). Andy, Q1: "it will push the repo it's in." A scratch
// clone with a bare origin of its own, both in the temp folder, holding a copy of pushOrigin.js where the app keeps it;
// the copy is run with no argument from outside the clone. No real repo and no network are touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }
const FILE = path.join(RUN, 'spirit', 'app', 'pushOrigin', 'pushOrigin.js');

test.startTest('pushOrigin.js: run with no repo, it pushes the repo it is in (goal/G43.21)');

(function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/pushOrigin/pushOrigin.js is not there'); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pushorigin-'));
  try {
    const origin = path.join(tmp, 'origin.git');
    const clone = path.join(tmp, 'clone');
    git(['init', '-q', '--bare', '-b', 'master', origin], tmp);
    git(['clone', '-q', origin, clone], tmp);
    git(['config', 'user.email', 'test@example.invalid'], clone);
    git(['config', 'user.name', 'test'], clone);
    git(['checkout', '-q', '-b', 'master'], clone);
    // Origin has a master of its own first, as a real origin does; the commit to push comes after it.
    fs.writeFileSync(path.join(clone, 'first.txt'), 'on origin already\n');
    git(['add', '-A'], clone);
    git(['commit', '-q', '-m', 'on origin already'], clone);
    git(['push', '-q', 'origin', 'master'], clone);
    const copy = path.join(clone, 'spirit', 'run', 'spirit', 'app', 'pushOrigin', 'pushOrigin.js');
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(FILE, copy);
    fs.writeFileSync(path.join(clone, 'note.txt'), 'made by the test\n');
    git(['add', '-A'], clone);
    const made = git(['commit', '-q', '-m', 'the commit to push'], clone);
    const head = (git(['rev-parse', 'HEAD'], clone).stdout || '').trim();
    ok(made.status === 0 && !!head, 'the world: a clone with one commit its bare origin does not hold', 'no commit could be made: nothing judged. ' + short(made.stderr));
    if (!head) return;

    // Run as Run starts it: the script and nothing more, from a folder that is no repo.
    const r = spawnSync(process.execPath, [copy], { cwd: tmp, encoding: 'utf8', timeout: 60000 });
    const said = String(r.stdout || '') + String(r.stderr || '');
    ok(r.status === 0, 'run with no argument it ends well', 'it exited ' + r.status + ': ' + short(said));
    const there = (git(['rev-parse', 'master'], origin).stdout || '').trim();
    ok(there === head, 'origin now holds the commit of the repo it lives in', 'origin holds ' + short(there || 'nothing') + ', the clone ' + head + '; it said ' + short(said));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}());
test.reportSuccessFailureCount();
