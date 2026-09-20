'use strict';

// spirit/test/plantRun.js
// A suite's copy of spirit/run — the tracked tree, and nothing else.
//
//   Andy: "the creation of fake nodes/relays in temp, why would it not
//   respect .gitignore?"
//
// It should, and two other places in this tree already do: setupRelayFakes.js
// and labMaster's copyTrackedSpirit both build node homes from `git ls-files`,
// and .gitignore says so in its own comments (see the relay-state/ and
// session.json entries). The wire suites were the odd ones out, running
// `fs.cpSync(REPO_RUN, runDir, { recursive: true })` — which copies
// everything on disk, because a recursive copy has no idea what a product is.
//
//   blind copy    5619 files   143 MB
//   tracked        105 files   3.8 MB
//
// Three costs, and only the first is obvious.
//
// SPEED. 10.2 s per copy, measured, and plant() runs twice per suite. Under
// the full harness that is what made partnerWire, hintWire and
// governorTwoRelays flaky — each passing alone and failing together, which
// is the signature of contention rather than of a bug.
//
// LITTER. Every one of those copies stayed: 160,116 `spirit-*` directories
// were found in %TEMP% on 2026-09-20. Three consecutive harness runs got
// progressively redder as the disk filled — 0 red, then 2 unhappy, then
// 2 red and 4 unhappy — which reads exactly like a regression and was not one.
//
// AND WHAT WAS IN THEM, which is the half that is not about speed at all. A
// blind copy takes relay-state/ — .gitignore:57 notes it holds an Ed25519
// PRIVATE KEY — together with spirit/run/media/ and spirit/run/brains/, a
// private repo that is not part of this product (AGENT.md). The ignore list
// is already this repo's statement of what is not the product, so honouring
// it is not an optimisation. It is the fixture copying the right thing.
//
// WHY `--cached --others --exclude-standard` AND NOT PLAIN `ls-files`:
// tracked files PLUS files not yet committed, minus everything ignored. A
// source file written a minute ago reaches the fixture and nothing ignored
// ever does. labMaster's copy uses plain `ls-files` and would miss that new
// file — worth knowing before copying either line to a third place.

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
    // something staged by reflex. labMaster paid for this one: every node
    // creation failed with an ENOENT about a path nobody recognised.
    if (!fs.existsSync(source)) return;
    const dest = path.join(runDir, norm.slice(PREFIX.length));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // AND THE SAME AGAIN, AS A CATCH, because existsSync is a CHECK and
    // the copy is a USE, and the suites run six at a time. `--others`
    // lists untracked files, so another suite's transient probe can be in
    // the listing and gone by the time this reads it — `writableRoots.js`
    // writes and deletes `app/__writableRootsProbe__.json`, and it took
    // targetBusy down exactly once (2026-09-21).
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
  // up" — which is the failure this tree has already spent an afternoon
  // on once today.
  if (!copied) {
    throw new Error('plantRunTree copied nothing from ' + REPO_ROOT +
      ' — is this a git checkout, and is git on PATH?');
  }
  return runDir;
}

module.exports = { plantRunTree: plantRunTree };
