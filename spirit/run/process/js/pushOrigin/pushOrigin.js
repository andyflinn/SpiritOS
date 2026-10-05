'use strict';

// spirit/run/process/js/pushOrigin/pushOrigin.js
// goal/G5.1: ONE PLACE THAT SENDS COMMITS ALREADY MADE TO GITHUB, EVEN WHEN THE CLONE IS BEHIND ORIGIN.
//
//   Andy, 2026-10-05, under goal/G5.1: "I run into the problem that you ran into while pushing measurements. happens
//   often to me, that's why i want a unified approach that i can trigger from desk, separately from goalShare, so we
//   want one unified shared approach, that ensures my commits go through."; "agreed. so it' just about sharing code
//   among desk components."; "it must live in: spirit/run/process/js/pushOrigin/pushOrigin.js"; to how it starts:
//   "Implicitly, by design, or via jobs-selector manually"; and the pattern reference "look at
//   spirit\run\process\js\wordpressScanner\wordpressScanner.js".
//
// Loaded as shared code by publishData and (eventually) goalShare: `const { pushOrigin } = require('.../pushOrigin.js')`.
// Also runnable from the process-launcher: `node pushOrigin.js '{"repo":"/path/to/clone"}'`, which pushes that clone.
//
// WHAT IT DOES, in order, for a repo path:
//   1 stash unsaved tracked edits (-u keeps untracked files too), so a rebase has a clean tree.
//   2 fetch origin, then rebase the clone's own commits onto origin/<branch>'s newest.
//   3 if the rebase hits a clash (both sides changed the same line): `git rebase --abort`, pop the stash,
//     return { ok:false, reason:<text> }. The clone is left exactly as it was (same HEAD, unsaved edits
//     back in place, untracked files kept), and origin is unchanged.
//   4 if the rebase landed cleanly, `git push`, then pop the stash, and return { ok:true }.
// RE-TRIES ON A RACE are left out of this first cut (Andy's "tries again if someone pushed meanwhile" is noted
// in G5.1's box as unproven by a test); the caller may call pushOrigin twice if its first answer was a push race.

const { spawnSync } = require('child_process');

function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', timeout: 60000 }); }
function out(r) { return ((r && (r.stdout || '') + (r.stderr || '')) || '').trim(); }

function currentBranch(repo) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], repo);
  return (r.stdout || '').trim() || 'master';
}

function pushOrigin(opts) {
  const repo = opts && opts.repo;
  if (!repo) return Promise.resolve({ ok: false, reason: 'repo is required' });
  const branch = currentBranch(repo);
  // STASH, so an unsaved edit does not derail the rebase. The second word is a label we can match on later
  // (git stash list) when more than one stash sits in the tree.
  const stashLabel = 'pushOrigin ' + Date.now();
  const stash = git(['stash', 'push', '-u', '-m', stashLabel], repo);
  const stashed = stash.status === 0 && /Saved working directory/i.test(stash.stdout + stash.stderr);
  const popStash = function () {
    if (!stashed) return;
    git(['stash', 'pop', '--quiet'], repo);
  };
  // FETCH + REBASE. On conflict, abort cleanly.
  const fetched = git(['fetch', '--quiet', 'origin', branch], repo);
  if (fetched.status !== 0) { popStash(); return Promise.resolve({ ok: false, reason: 'fetch failed: ' + out(fetched) }); }
  const rebased = git(['rebase', '--quiet', 'origin/' + branch], repo);
  if (rebased.status !== 0) {
    git(['rebase', '--abort'], repo);
    popStash();
    return Promise.resolve({ ok: false, reason: 'rebase onto origin/' + branch + ' had a clash: ' + out(rebased) });
  }
  // PUSH. If this fails (e.g. another push raced in while we were rebasing), say so and let the caller retry.
  const pushed = git(['push', '--quiet', 'origin', branch + ':' + branch], repo);
  popStash();
  if (pushed.status !== 0) return Promise.resolve({ ok: false, reason: 'push failed: ' + out(pushed) });
  return Promise.resolve({ ok: true });
}

module.exports = { pushOrigin: pushOrigin };

// RUN FROM JOBS. The manifest (pushOrigin.json) names the arguments; the launcher hands them in as one JSON
// string after the script path (index.html 1559), the same way wordpressScanner.js reads them.
if (require.main === module) {
  const args = (function () { try { return JSON.parse(process.argv[2] || '{}'); } catch (e) { return {}; } })();
  pushOrigin(args).then(function (r) {
    if (r && r.ok) { console.log('pushOrigin: ok'); process.exit(0); }
    console.error('pushOrigin: ' + ((r && r.reason) || 'failed'));
    process.exit(1);
  }, function (e) {
    console.error('pushOrigin: ' + ((e && e.message) || e));
    process.exit(1);
  });
}
