'use strict';

// spirit/test/plantRun.js
// A suite's copy of spirit/run — the tracked tree, and nothing else.
//
//   Andy: "the creation of fake nodes/relays in temp, why would it not
//   respect .gitignore?"
//
// It does: the copy is built from git's own listing, as setupRelayFakes.js
// and labMaster's copyTrackedSpirit build theirs, so the ignore list —
// this repo's statement of what is not the product — keeps relay-state/
// (an Ed25519 PRIVATE KEY, .gitignore), spirit/run/media/ and
// spirit/run/brains/ (a private repo that is not part of this product,
// AGENT.md) out of every fixture, and the copy is small and fast.
//
// WHY `--cached --others --exclude-standard` AND NOT PLAIN `ls-files`:
// tracked files PLUS files not yet committed, minus everything ignored. A
// source file written a minute ago reaches the fixture and nothing ignored
// ever does.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PREFIX = 'spirit/run/';

// Copies the non-ignored spirit/run tree into `runDir`. Everything a
// suite wants on top of it — relay-state/, a config.json, a build stamp —
// is the caller's business and lands after this returns.
function plantRunTree(runDir) {
  const listed = execSync(
    'git ls-files --cached --others --exclude-standard -- spirit/run',
    { cwd: REPO_ROOT, encoding: 'utf8' }
  ).split('\n').filter(Boolean);

  let copied = 0;
  listed.forEach(function (rel) {
    const norm = rel.split('\\').join('/');
    if (norm.indexOf(PREFIX) !== 0) return;
    const source = path.join(REPO_ROOT, norm);
    // A TRACKED FILE THAT IS NOT ON DISK IS SKIPPED, not fatal. `git
    // ls-files` reads the INDEX, which happily lists a file already
    // deleted from the working tree — a `git rm` not yet committed, or
    // something staged by reflex.
    if (!fs.existsSync(source)) return;
    const dest = path.join(runDir, norm.slice(PREFIX.length));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // AND THE SAME AGAIN, AS A CATCH, because existsSync is a CHECK and
    // the copy is a USE, and the suites run six at a time. `--others`
    // lists untracked files, so another suite's transient probe can be in
    // the listing and gone by the time this reads it — `writableRoots.js`
    // writes and deletes `shell/__writableRootsProbe__.json`.
    //
    // A file that vanished mid-copy was never part of this fixture, so
    // skipping it is the whole repair. Only ENOENT: anything else is a
    // real failure to copy a real file and must not be swallowed.
    try {
      fs.copyFileSync(source, dest);
    } catch (e) {
      if (e && e.code === 'ENOENT') return;
      throw e;
    }
    copied += 1;
  });

  // SAYS SO RATHER THAN LEAVING AN EMPTY DIRECTORY. A fixture with no
  // server in it fails later, somewhere else, as "a relay did not come
  // up".
  if (!copied) {
    throw new Error('plantRunTree copied nothing from ' + REPO_ROOT +
      ' — is this a git checkout, and is git on PATH?');
  }
  return runDir;
}

module.exports = { plantRunTree: plantRunTree };
