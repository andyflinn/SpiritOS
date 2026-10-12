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
//   0 on a detached HEAD there is no branch to push, and a rebase already in progress is the owner's: either way it
//     refuses, { ok:false, reason }, and touches nothing.
//   1 stash unsaved edits under its own label (-u keeps untracked files too), so a rebase has a clean tree.
//   2 fetch origin, then rebase the clone's own commits onto origin/<branch>'s newest.
//   3 if the rebase hits a clash (both sides changed the same line): `git rebase --abort`, put its stash back,
//     return { ok:false, reason:<text> }. The clone is left exactly as it was (same HEAD, unsaved edits
//     back in place, untracked files kept), and origin is unchanged.
//   4 if the rebase landed cleanly, `git push`; a push refused after a clean rebase is read as a race and steps 2 to 4
//     run again, up to MAX_PUSH_TRIES times in all (below). Then its stash goes back, and it returns { ok:true }.
//   5 ITS OWN STASH, NOT THE NEWEST (goal/G19.6; Andy, 2026-10-12: "agreed to the whole thing as stated", the box:
//     "pushOrigin puts back exactly its own stash, or says it could not"): the stash is found again by its label in
//     `git stash list` and popped by its own stash@{n}, so a stash somebody else made meanwhile stays where it is. A
//     stash that cannot be found or put back answers { ok:false, reason } saying so, the push's outcome included; git
//     keeps a stash it could not pop, so the edits are never lost.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', timeout: 60000 }); }
function out(r) { return ((r && (r.stdout || '') + (r.stderr || '')) || '').trim(); }

function currentBranch(repo) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], repo);
  return (r.stdout || '').trim() || 'master';
}
function rebaseInProgress(repo) {
  return ['rebase-merge', 'rebase-apply'].some(function (d) {
    const p = (git(['rev-parse', '--git-path', d], repo).stdout || '').trim();
    return !!p && fs.existsSync(path.resolve(repo, p));
  });
}

// PUSH-RACE RETRIES, inside pushOrigin itself (goal/G5.1, Andy: "tries again if someone pushed meanwhile"). A clash
// is NOT a race, so it does not retry: a clash exits at once with its reason, as the box says. A push rejected after
// a clean rebase is read as a race (another commit landed between our fetch and our push); we fetch, rebase and push
// again, up to this many times. Three is enough in practice (two agents racing settle in two tries; three covers a
// third join).
const MAX_PUSH_TRIES = 3;

function pushOrigin(opts) {
  const repo = opts && opts.repo;
  if (!repo) return Promise.resolve({ ok: false, reason: 'repo is required' });
  const branch = currentBranch(repo);
  // A DETACHED HEAD IS REFUSED (goal/G19.6, the box: "it refuses a detached HEAD"): rev-parse names no branch but
  // 'HEAD', and pushing HEAD:HEAD would make a branch called HEAD on origin, or fail three times as a "race".
  if (branch === 'HEAD') return Promise.resolve({ ok: false, reason: 'the clone is on a detached HEAD: there is no branch to push; check one out first' });
  // NOR A REBASE ALREADY IN PROGRESS (goal/G19.6: each helper touches only what it put there itself): its own rebase
  // would fail on it, and the abort below would then undo the owner's rebase, not one this started.
  if (rebaseInProgress(repo)) return Promise.resolve({ ok: false, reason: 'a rebase is in progress in the clone; finish or abort it first' });
  // STASH ONCE, so an unsaved edit does not derail the rebase, under a label of its own, found again by it below.
  const stashLabel = 'pushOrigin ' + Date.now() + ' ' + process.pid;
  const stash = git(['stash', 'push', '-u', '-m', stashLabel], repo);
  const stashed = stash.status === 0 && /Saved working directory/i.test(stash.stdout + stash.stderr);
  // '' once its own stash is back (or there was none); else what went wrong, for the answer.
  const popStash = function () {
    if (!stashed) return '';
    const list = git(['stash', 'list', '--format=%gd%x09%gs'], repo);
    const mine = (list.stdout || '').split('\n').map(function (l) { return l.trim().split('\t'); }).filter(function (f) {
      return f.length === 2 && f[1].slice(-(': ' + stashLabel).length) === ': ' + stashLabel;
    })[0];
    if (!mine) return 'its stash "' + stashLabel + '" was not found in git stash list, so the unsaved edits were not put back';
    // --index puts staged changes back staged. Where the rebase moved a file the index can no longer take them, and git
    // says to try without --index: the edits then come back unstaged, which loses no text.
    let popped = git(['stash', 'pop', '--quiet', '--index', mine[0]], repo);
    if (popped.status !== 0 && /without --index/i.test(out(popped))) popped = git(['stash', 'pop', '--quiet', mine[0]], repo);
    if (popped.status !== 0) return 'its stash ' + mine[0] + ' ("' + stashLabel + '") could not be put back and is kept: ' + out(popped);
    return '';
  };
  // The answer, with the stash put back first; a stash not put back turns it into ok false, saying both.
  const answer = function (r) {
    const problem = popStash();
    if (!problem) return Promise.resolve(r);
    return Promise.resolve({ ok: false, reason: (r.ok ? 'pushed to origin/' + branch + ', but ' : r.reason + '; and ') + problem });
  };
  let lastReason = '';
  for (let attempt = 0; attempt < MAX_PUSH_TRIES; attempt++) {
    const fetched = git(['fetch', '--quiet', 'origin', branch], repo);
    if (fetched.status !== 0) return answer({ ok: false, reason: 'fetch failed: ' + out(fetched) });
    const rebased = git(['rebase', '--quiet', 'origin/' + branch], repo);
    if (rebased.status !== 0) {
      // A CLASH, not a race: abort and exit with the reason. Retrying would make the same clash again.
      git(['rebase', '--abort'], repo);
      return answer({ ok: false, reason: 'rebase onto origin/' + branch + ' had a clash: ' + out(rebased) });
    }
    const pushed = git(['push', '--quiet', 'origin', branch + ':' + branch], repo);
    if (pushed.status === 0) return answer({ ok: true });
    // Push rejected (likely a race): remember why and loop to fetch again.
    lastReason = out(pushed);
  }
  return answer({ ok: false, reason: 'push failed after ' + MAX_PUSH_TRIES + ' tries (likely a persistent race): ' + lastReason });
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
