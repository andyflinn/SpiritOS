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
  // STASH ONCE, so an unsaved edit does not derail the rebase. The second word is a label we can match on later
  // (git stash list) when more than one stash sits in the tree.
  const stashLabel = 'pushOrigin ' + Date.now();
  const stash = git(['stash', 'push', '-u', '-m', stashLabel], repo);
  const stashed = stash.status === 0 && /Saved working directory/i.test(stash.stdout + stash.stderr);
  const popStash = function () {
    if (!stashed) return;
    git(['stash', 'pop', '--quiet'], repo);
  };
  let lastReason = '';
  for (let attempt = 0; attempt < MAX_PUSH_TRIES; attempt++) {
    const fetched = git(['fetch', '--quiet', 'origin', branch], repo);
    if (fetched.status !== 0) { popStash(); return Promise.resolve({ ok: false, reason: 'fetch failed: ' + out(fetched) }); }
    const rebased = git(['rebase', '--quiet', 'origin/' + branch], repo);
    if (rebased.status !== 0) {
      // A CLASH, not a race: abort and exit with the reason. Retrying would make the same clash again.
      git(['rebase', '--abort'], repo);
      popStash();
      return Promise.resolve({ ok: false, reason: 'rebase onto origin/' + branch + ' had a clash: ' + out(rebased) });
    }
    const pushed = git(['push', '--quiet', 'origin', branch + ':' + branch], repo);
    if (pushed.status === 0) { popStash(); return Promise.resolve({ ok: true }); }
    // Push rejected (likely a race): remember why and loop to fetch again.
    lastReason = out(pushed);
  }
  popStash();
  return Promise.resolve({ ok: false, reason: 'push failed after ' + MAX_PUSH_TRIES + ' tries (likely a persistent race): ' + lastReason });
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
