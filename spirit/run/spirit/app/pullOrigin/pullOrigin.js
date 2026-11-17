'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/pullOrigin/pullOrigin.js
// goal/G47.1: ONE RUN THAT BRINGS THE CLONE IT LIVES IN TO THE FRONT OF master, AND PUTS ITS OWNER'S CHANGES ON ORIGIN.
//
//   Andy: "we also need pullOrigin, the counterPart of pushOrigin, both for dumb Users like me."; "pullOrigin needs to
//   pull to the front of master, past any mess that sometimes blocks it..."; Q27, whether it restarts the node: "no
//   sophisticated thing, just pull, past anyhing that blocks it, push any changes i made, if necessary "sync repo?" (they
//   won't be code except for things i "own" like word.js". So it never restarts a node, and never stops at a clash.
//
// Started by its Run in the app detail, with no argument: the clone this file lives in. Also
// `node pullOrigin.js '{"repo":"/path/to/clone"}'`. Exits 0 when the clone ends at origin's master with its changes
// pushed, 1 otherwise; what it did is printed, one line.
//
// WHAT IT DOES, in order (the decisions are Andy's, above; change them in Desk first):
//   1 WHAT BLOCKS IT, ENDED: a rebase, merge, cherry-pick, revert or am in progress is aborted.
//   2 A DETACHED HEAD goes back to master, its unsaved edits with it; commits of the detached HEAD that master does not
//     hold are kept on a branch of their own, pullOrigin-<time>, and said.
//   3 THE OWNER'S CHANGES, COMMITTED: every edited, deleted or new file git does not ignore, one commit, "pullOrigin: the
//     changes made in this clone".
//   4 THE FRONT OF master: fetch, then the clone's own commits laid onto origin/master; where both changed the same lines
//     the clone's side wins (rebase -X theirs: in a rebase, "theirs" is the commit being laid on). A clash that wins
//     nothing (one side deleted a file the other changed) ends the rebase: the clone's commits are kept on a branch
//     pullOrigin-<time>, master is set to origin's, and it is said.
//   5 PUSHED through pushOrigin (spirit/app/pushOrigin/pushOrigin.js), the one place that pushes, retrying a race.
//
// pullOrigin({repo}) -> Promise<{ ok, reason?, did: [what it did, plain words] }>

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Git asked in English, as pushOrigin asks it: what it says is read below only for its exit code, but a reason quoted to
// Andy reads the same on every machine.
const GIT_ENV = Object.assign({}, process.env, { LC_ALL: 'C', LANG: 'C', LANGUAGE: 'C' });
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', timeout: 60000, env: GIT_ENV, windowsHide: true }); }
function out(r) { return ((r && (r.stdout || '') + (r.stderr || '')) || '').trim(); }
function ok(r) { return !!r && r.status === 0; }

const BRANCH = 'master';
// What can be in progress in a clone, by the file git keeps for it, and how it is ended.
const IN_PROGRESS = [
  { path: 'rebase-merge', abort: ['rebase', '--abort'], name: 'a rebase' },
  { path: 'rebase-apply', abort: ['am', '--abort'], also: ['rebase', '--abort'], name: 'a rebase or am' },
  { path: 'MERGE_HEAD', abort: ['merge', '--abort'], name: 'a merge' },
  { path: 'CHERRY_PICK_HEAD', abort: ['cherry-pick', '--abort'], name: 'a cherry-pick' },
  { path: 'REVERT_HEAD', abort: ['revert', '--abort'], name: 'a revert' },
];

function gitPath(repo, p) { const r = (git(['rev-parse', '--git-path', p], repo).stdout || '').trim(); return r ? path.resolve(repo, r) : ''; }
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-'); }
function keepOnBranch(repo, rev) {
  const name = 'pullOrigin-' + stamp();
  return ok(git(['branch', name, rev], repo)) ? name : '';
}

function pullOrigin(opts) {
  const repo = opts && opts.repo;
  if (!repo) return Promise.resolve({ ok: false, reason: 'repo is required', did: [] });
  if (!ok(git(['rev-parse', '--git-dir'], repo))) return Promise.resolve({ ok: false, reason: repo + ' is no git clone', did: [] });
  const did = [];

  // 1 What blocks it, ended.
  IN_PROGRESS.forEach(function (s) {
    const f = gitPath(repo, s.path);
    if (!f || !fs.existsSync(f)) return;
    if (!ok(git(s.abort, repo)) && s.also) git(s.also, repo);
    did.push(s.name + ' in progress was ended');
  });

  // 2 A detached HEAD back to master, its edits with it; its own commits kept.
  const head = (git(['rev-parse', '--abbrev-ref', 'HEAD'], repo).stdout || '').trim();
  if (head === 'HEAD') {
    const onMaster = ok(git(['merge-base', '--is-ancestor', 'HEAD', BRANCH], repo));
    if (!onMaster) { const b = keepOnBranch(repo, 'HEAD'); if (b) did.push('the detached commits were kept on the branch ' + b); }
    const label = 'pullOrigin ' + Date.now() + ' ' + process.pid;
    git(['stash', 'push', '-u', '-m', label], repo);
    const stashed = (git(['stash', 'list', '--format=%gs'], repo).stdout || '').split('\n').some(function (l) { return l.trim().slice(-label.length) === label; });
    if (!ok(git(['checkout', '-q', BRANCH], repo))) return Promise.resolve({ ok: false, reason: 'the detached HEAD could not go back to ' + BRANCH, did: did });
    did.push('the detached HEAD went back to ' + BRANCH);
    if (stashed) {
      // Its edits come back; where they no longer fit, the clone's version wins and the stash is dropped once taken.
      const popped = git(['stash', 'pop', '--quiet'], repo);
      if (!ok(popped)) { git(['checkout', '--theirs', '--', '.'], repo); git(['reset', '-q'], repo); git(['stash', 'drop', '--quiet'], repo); }
    }
  } else if (head !== BRANCH) {
    if (!ok(git(['checkout', '-q', BRANCH], repo))) return Promise.resolve({ ok: false, reason: 'the clone is on ' + head + ' and could not go to ' + BRANCH, did: did });
    did.push('the clone went from ' + head + ' to ' + BRANCH);
  }

  // 3 The owner's changes, committed.
  git(['add', '-A'], repo);
  if (!ok(git(['diff', '--cached', '--quiet'], repo))) {
    const c = git(['commit', '-q', '-m', 'pullOrigin: the changes made in this clone'], repo);
    if (!ok(c)) return Promise.resolve({ ok: false, reason: 'the changes could not be committed: ' + out(c), did: did });
    did.push('the changes made in this clone were committed');
  }

  // 4 The front of master.
  const fetched = git(['fetch', '--quiet', 'origin', BRANCH], repo);
  if (!ok(fetched)) return Promise.resolve({ ok: false, reason: 'fetch failed: ' + out(fetched), did: did });
  const before = (git(['rev-parse', 'HEAD'], repo).stdout || '').trim();
  const rebased = git(['rebase', '--quiet', '-X', 'theirs', 'origin/' + BRANCH], repo);
  if (!ok(rebased)) {
    git(['rebase', '--abort'], repo);
    const b = keepOnBranch(repo, before);
    git(['reset', '-q', '--hard', 'origin/' + BRANCH], repo);
    did.push('a clash it could not settle: this clone\'s commits were kept on the branch ' + (b || '(none: the branch could not be made)') + ', and ' + BRANCH + ' is origin\'s');
  }

  // 5 Pushed, through pushOrigin.
  const ahead = (git(['rev-list', '--count', 'origin/' + BRANCH + '..HEAD'], repo).stdout || '').trim();
  if (ahead === '0') { did.push('nothing to push'); return Promise.resolve({ ok: true, did: did }); }
  const { pushOrigin } = spirit.require('spirit/app/pushOrigin/pushOrigin.js');
  return pushOrigin({ repo: repo }).then(function (r) {
    if (!r || !r.ok) return { ok: false, reason: 'the push did not go through: ' + ((r && r.reason) || 'unknown'), did: did };
    did.push(ahead + ' commit' + (ahead === '1' ? '' : 's') + ' pushed');
    return { ok: true, did: did };
  });
}

module.exports = { pullOrigin: pullOrigin };

// RUN BY ITSELF: Run in the app detail starts it with no argument, the clone this file lives in.
if (require.main === module) {
  const args = (function () { try { return JSON.parse(process.argv[2] || '{}'); } catch (e) { return {}; } })();
  if (!args.repo) args.repo = (git(['rev-parse', '--show-toplevel'], __dirname).stdout || '').trim();
  pullOrigin(args).then(function (r) {
    const said = (r.did || []).join('; ');
    if (r && r.ok) { console.log('pullOrigin: ok' + (said ? ': ' + said : '')); process.exit(0); }
    console.error('pullOrigin: ' + r.reason + (said ? ' (' + said + ')' : ''));
    process.exit(1);
  }, function (e) {
    console.error('pullOrigin: ' + ((e && e.message) || e));
    process.exit(1);
  });
}
