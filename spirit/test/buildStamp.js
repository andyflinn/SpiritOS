'use strict';

// spirit/test/buildStamp.js
// A box that can say what it is made of.
//
// Three incidents in one sitting were a change on disk and not in the
// process — spirit-3 serving a 404 for a route whose code it had, a relay
// answering `refused` to a node that had moved on, labMaster copying
// files with logic it had already been handed a fix for. Each looked like
// a bug in the change. Each is one line to diagnose if the box will
// answer this question, and a round of guessing if it will not.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const buildStamp = require('../run/js/buildStamp');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-stamp-'));
}

test.startTest('Build stamp — which commit is running');

function run() {
  test.subHeading('A checkout knows without being told');

  const here = buildStamp.resolve(path.join(__dirname, '..', 'run'));
  if (here.source === 'git' && /^[0-9a-f]{7,40}$/.test(here.commit)) {
    test.check('this tree reports its own commit from git: ' + here.commit);
  } else {
    test.fail('resolve: ' + JSON.stringify(here));
  }

  // DIRTY IS THE HALF THAT MATTERS ON A DEVELOPER'S MACHINE, where the
  // running code is routinely in no commit at all. A bare sha there is a
  // confident lie. spirit-3 is `reset --hard` on every update, so it
  // reads clean and any drift there is real news.
  if (typeof here.dirty === 'boolean') {
    test.check('and says whether the tree has drifted from it — dirty=' + here.dirty);
  } else {
    test.fail('no dirty flag: ' + JSON.stringify(here));
  }

  test.subHeading('A copy is a tree, not a repository');

  // labMaster's fakes, and anything else that copies rather than clones.
  const copied = tmpDir();
  buildStamp.write(copied, { commit: 'deadbee', dirty: false, at: '2026-01-01T00:00:00Z' });
  const fromFile = buildStamp.resolve(copied);
  if (fromFile.source === 'file' && fromFile.commit === 'deadbee') {
    test.check('a stamped copy answers from its stamp');
  } else {
    test.fail('file stamp: ' + JSON.stringify(fromFile));
  }

  // Said plainly rather than guessed at. A made-up version is worse than
  // no version, because it is believed.
  const bare = tmpDir();
  const nothing = buildStamp.resolve(bare);
  if (nothing.commit === 'unknown' && nothing.source === 'none') {
    test.check('and a tree that is neither says "unknown" rather than inventing one');
  } else {
    test.fail('bare: ' + JSON.stringify(nothing));
  }

  // A stamp file that is damaged must not be believed either — half a
  // JSON file is not half an answer.
  const broken = tmpDir();
  fs.writeFileSync(path.join(broken, buildStamp.STAMP_FILE), '{ not json');
  if (buildStamp.resolve(broken).commit === 'unknown') {
    test.check('and an unreadable stamp is unknown, not a crash');
  } else {
    test.fail('broken stamp was believed');
  }

  test.subHeading('Git wins over a stale file');

  // A checkout that ALSO has a stamp file — which is what a fake node
  // becomes if somebody points a real repo at it. The repository is the
  // one that cannot be out of date, so it answers.
  const repoRun = path.join(__dirname, '..', 'run');
  const stampPath = path.join(repoRun, buildStamp.STAMP_FILE);
  const had = fs.existsSync(stampPath);
  const before = had ? fs.readFileSync(stampPath, 'utf8') : null;
  try {
    buildStamp.write(repoRun, { commit: 'staleee', dirty: false, at: '' });
    const won = buildStamp.resolve(repoRun);
    if (won.source === 'git' && won.commit !== 'staleee') {
      test.check('a checkout ignores a stamp file left lying in it');
    } else {
      test.fail('stale file won: ' + JSON.stringify(won));
    }
  } finally {
    // Put the tree back exactly as it was found, whatever happened.
    if (had) fs.writeFileSync(stampPath, before);
    else { try { fs.unlinkSync(stampPath); } catch (e) { /* never made */ } }
  }

  test.subHeading('What a copy would leave behind');

  // The asymmetry that makes the standing rule necessary, and the reason
  // it is now checkable rather than remembered: a fake node is built from
  // `git ls-files` and then each listed path is copied out of the WORKING
  // TREE. Edits to a tracked file travel. A file you have just made does
  // not, because it is not in the index — so the node runs without it and
  // fails somewhere else entirely.
  const repoRoot = path.join(__dirname, '..', '..');
  const clean = buildStamp.missingFromCopy(repoRoot);
  if (Array.isArray(clean)) {
    test.check('a workspace with nothing new to add reports ' + clean.length + ' missing');
  } else {
    test.fail('missingFromCopy: ' + JSON.stringify(clean));
  }

  // Made and removed in a finally, because leaving a stray file under
  // spirit/run would break the very thing this check protects.
  const probe = path.join(repoRoot, 'spirit', 'run', 'zz-copy-probe.js');
  try {
    fs.writeFileSync(probe, '// a file the index has never heard of\n');
    const found = buildStamp.missingFromCopy(repoRoot);
    const named = found.some(function (f) { return f.indexOf('zz-copy-probe.js') !== -1; });
    if (named && found.length === clean.length + 1) {
      test.check('and a brand-new file is named, before it can quietly not be copied');
    } else {
      test.fail('probe not detected: ' + JSON.stringify(found));
    }
  } finally {
    try { fs.unlinkSync(probe); } catch (e) { /* never made */ }
  }

  if (buildStamp.missingFromCopy(repoRoot).length === clean.length) {
    test.check('and the workspace is exactly as it was found');
  } else {
    test.fail('this suite left something behind');
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
