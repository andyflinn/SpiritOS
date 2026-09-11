'use strict';

// spirit/run/js/buildStamp.js
// Which commit is this process actually running?
//
// Three times in one sitting a change was on disk and not in the process,
// and each time it failed in a way that looked like a bug in the change:
// spirit-3 serving a 404 for a route it had the code for, a relay
// answering `refused` to a node that had moved on, and labMaster copying
// files with logic it had already been given a fix for. Every one of
// those is a single line to diagnose if the box will say what it is made
// of, and a round of guessing if it will not.
//
// **COMPUTED ONCE, AT LOAD.** This is the whole design and not an
// optimisation. The question is "what code is running", so the answer
// must be taken when the code is loaded and never refreshed — a process
// that re-read git on every request would report a new commit the
// instant somebody pulled, without restarting, which is precisely the
// lie this exists to kill. A stale-looking stamp IS the finding.
//
// Git first, because a deployed relay is a checkout — bash/update does
// `git reset --hard origin/master` — and a checkout knows the truth
// without anything having to remember to write it down. A file second,
// for the copies labMaster makes, which are trees rather than
// repositories.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const STAMP_FILE = 'build.json';

function fromGit(repoRoot) {
  function git(args) {
    return execFileSync('git', ['-C', repoRoot].concat(args), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
    }).trim();
  }
  let commit;
  try { commit = git(['rev-parse', '--short', 'HEAD']); }
  catch (e) { return null; }
  if (!commit) return null;

  // DIRTY IS THE HALF THAT MATTERS ON A DEVELOPER'S MACHINE. A work node
  // is almost always running code that is in no commit at all, and a bare
  // sha there would be a confident lie. spirit-3 is reset --hard on every
  // update, so it reads clean and any drift is real news.
  let dirty = false;
  try { git(['diff', '--quiet', 'HEAD']); }
  catch (e) { dirty = true; }

  let at = '';
  try { at = git(['log', '-1', '--format=%cI']); }
  catch (e) { at = ''; }

  return { commit: commit, dirty: dirty, at: at, source: 'git' };
}

function fromFile(rootDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(rootDir, STAMP_FILE), 'utf8'));
    if (!parsed || typeof parsed.commit !== 'string' || !parsed.commit) return null;
    return {
      commit: parsed.commit,
      dirty: !!parsed.dirty,
      at: String(parsed.at || ''),
      // How many files the copy was known to be missing when it was
      // made. A node that can say "I may be incomplete" saves the hour
      // spent looking for a bug in the file that never arrived.
      untracked: Number(parsed.untracked) || 0,
      source: 'file',
    };
  } catch (e) { return null; }
}

function resolve(rootDir) {
  // The repository, if this tree is in one. rootDir is spirit/run.
  const repoRoot = path.join(rootDir, '..', '..');
  return fromGit(repoRoot) ||
    fromFile(rootDir) ||
    // Said plainly rather than guessed at. "unknown" is a useful answer;
    // a made-up version is not.
    { commit: 'unknown', dirty: false, at: '', source: 'none' };
}

// Written by whatever makes a copy of the tree that is not a checkout —
// labMaster, and any future packaging step. Best effort: a fake node
// that cannot say what it is made of is a nuisance, not a failure.
function write(rootDir, stamp) {
  try {
    fs.writeFileSync(
      path.join(rootDir, STAMP_FILE),
      JSON.stringify({
        commit: String((stamp && stamp.commit) || 'unknown'),
        dirty: !!(stamp && stamp.dirty),
        at: String((stamp && stamp.at) || ''),
        untracked: Number(stamp && stamp.untracked) || 0,
      }, null, 2)
    );
    return true;
  } catch (e) { return false; }
}

// WHAT A COPY WOULD LEAVE BEHIND.
//
// labMaster and setupRelayFakes both build a fake node with `git ls-files`
// and then copy each listed path out of the WORKING TREE. That gives an
// asymmetry which is easy to be bitten by and impossible to see:
//
//   - a tracked file you have edited but not committed IS listed, and is
//     copied with your edits in it. Changes travel.
//   - a file you have just created is not in the index, so it is not
//     listed, so it is not copied. New files do not travel.
//
// So a fake node built from a workspace with a new module in it runs
// WITHOUT that module, and fails somewhere else entirely. That is the
// reason for the standing rule "git add the new run module before the
// harness" — a rule that only works while somebody remembers it.
//
// This is that rule, made checkable. `git add` is enough; a commit is
// not required, because the index is what ls-files reads.
function missingFromCopy(repoRoot) {
  try {
    return execFileSync('git', [
      '-C', repoRoot, 'ls-files', '--others', '--exclude-standard',
      '--', 'spirit', ':!spirit/test',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 })
      .split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  } catch (e) {
    // No git, or not a repository. Nothing can be said, so nothing is.
    return [];
  }
}

module.exports = {
  resolve: resolve,
  missingFromCopy: missingFromCopy,
  write: write,
  fromGit: fromGit,
  fromFile: fromFile,
  STAMP_FILE: STAMP_FILE,
};
