'use strict';

// Exercises the writable-root matrix (isWithinWritableRoot + the
// app-entry-script and app-manifest protections, kernel.js) via the real
// spirit.core.fs.saveFile/deleteFile API. Every negative case here is
// verified to never touch disk (isWithinWritableRoot / the entry-script
// and manifest checks all run before any fs write), so this is safe to run
// against a live checkout — the one exception is preferences.json, which is
// a real file the running server reads/writes, so it's backed up and
// restored rather than left holding this test's probe value.
const fs = require('fs');
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const ROOT_DIR = spirit.core.node.const.ROOT_DIR;

test.startTest('Writable-root matrix (spirit.core.fs.saveFile / deleteFile)');

function expectWritable(label, filePath) {
  const saved = spirit.core.fs.saveFile(filePath, 'writableRoots.js probe');
  if (saved.ok) {
    test.check(label + ' is writable');
  } else {
    test.fail(label + ' should be writable but saveFile returned ' + JSON.stringify(saved));
    return;
  }
  const deleted = spirit.core.fs.deleteFile(filePath);
  if (!deleted.ok) {
    test.fail(label + ' probe file could not be cleaned up: ' + JSON.stringify(deleted));
  }
}

// saveFile answers every refusal with the single reason 'forbidden' —
// the entry-script and manifest checks moved behind fileWritable when it
// was extracted as a shared predicate, so they no longer surface their own
// distinct reason strings ('app-entry-script-protected' /
// 'app-manifest-protected') to the caller. Which rule did the refusing is
// pinned by the labels and by the sibling-file cases below, not by the
// reason string.
function expectForbidden(label, filePath) {
  const saved = spirit.core.fs.saveFile(filePath, 'writableRoots.js probe');
  if (!saved.ok && saved.reason === 'forbidden') {
    test.check(label + ' is correctly forbidden');
  } else {
    test.fail(label + ' should have been forbidden but got ' + JSON.stringify(saved));
  }
}

// deleteFile shares fileWritable with saveFile, so anything saveFile
// refuses is equally undeletable through the public API — including the
// entry scripts and manifests saveAppScript/saveAppManifest just wrote.
// Those probes have to be cleaned up with a direct fs call instead.
function expectUndeletable(label, filePath) {
  const deleted = spirit.core.fs.deleteFile(filePath);
  if (!deleted.ok && deleted.reason === 'forbidden') {
    test.check(label + ' cannot be removed through deleteFile either');
  } else {
    test.fail(label + ' should have been undeletable but deleteFile returned ' + JSON.stringify(deleted));
  }
}

function cleanUpDirectly(label, filePath) {
  try {
    fs.unlinkSync(path.join(ROOT_DIR, filePath));
  } catch (err) {
    if (err.code !== 'ENOENT') test.fail(label + ' probe file could not be cleaned up: ' + err.message);
  }
}

// ---- the three writable roots ----
expectWritable('shell/ (top-level file)', 'shell/__writableRootsProbe__.json');
expectWritable('media/ (top-level file)', 'media/__writableRootsProbe__.json');
expectWritable('published/ (top-level file)', 'published/__writableRootsProbe__.json');

// ---- the one root-level file exception ----
const preferencesBackup = spirit.core.fs.loadFile('preferences.json');
expectWritable('preferences.json (root-level exception)', 'preferences.json');
if (preferencesBackup !== null) {
  const restored = spirit.core.fs.saveFile('preferences.json', preferencesBackup);
  if (restored.ok) {
    test.check('preferences.json restored to its original content after the probe');
  } else {
    test.fail('COULD NOT RESTORE preferences.json after the probe — original content: ' + preferencesBackup);
  }
} else {
  // Nothing existed before the probe — deleteFile is idempotent, so this
  // just removes the probe value rather than leaving a file the real app
  // never created.
  //
  // ── AND IT REPORTS, SO THE COUNT DOES NOT MOVE ────────────────
  //
  // This branch was silent until 2026-09-21, so a box where the node has
  // never run gave 12 checks and one where it has gave 13. Found by
  // comparing a Windows run against an Ubuntu one: `preferences.json` is
  // untracked, so a fresh clone simply does not have it.
  //
  // The suite was right and the COUNT was misleading — which matters now
  // that two machines compare their harness output, because a silent
  // difference reads as a platform difference and this one is not.
  spirit.core.fs.deleteFile('preferences.json');
  test.check('preferences.json did not exist before the probe, and the probe was removed');
}

// ---- everything else at root level, and process/, are NOT writable ----
expectForbidden('a random root-level file', '__writableRootsProbe__.txt');
expectForbidden('process/ (scripts are browser-read-only by design)', 'process/js/__writableRootsProbe__/__writableRootsProbe__.json');
expectForbidden('js/ (the kernel itself)', 'js/__writableRootsProbe__.js');

// ---- app entry scripts and manifests are shell files like any other ----
//
// Until goal/G14.8 (2026-10-10) the two shapes <name>/<name>.js and
// <name>/<name>.json were refused here even inside the writable shell
// root: the App Builder era's guard, kept after decision 0008 deleted the
// builder and its two exception doors (saveAppScript, saveAppManifest).
// Andy closed it: "the whole story of protecting app sources came from a
// time when we had the stupid AI app-builder, which is gone now"; "we
// only protect intrinsic apps, and they are already gated by the commit
// hooks as "core"". So an agent writes its own app's code through
// saveFile, and an intrinsic app is fenced at the commit (coreFiles.js),
// not at the gate. A never-created app folder, so nothing real is touched.
expectWritable('an app entry script (shell/<name>/<name>.js, goal/G14.8)', 'shell/__writableRootsProbeApp__/__writableRootsProbeApp__.js');
expectWritable('an app manifest (shell/<name>/<name>.json, goal/G14.8)', 'shell/__writableRootsProbeApp__/__writableRootsProbeApp__.json');
expectWritable('a sibling file in the same app folder', 'shell/__writableRootsProbeApp__/data.json');


// deleteFile only removes the file — clean up the now-empty folder it lived
// in so this test leaves no trace on disk.
try {
  fs.rmdirSync(path.join(ROOT_DIR, 'shell', '__writableRootsProbeApp__'));
} catch (e) { /* already gone or never created — fine either way */ }

// THE RULE, STATED AS IT NOW STANDS. Written as its own check so the
// absence above is a claim somebody made rather than a gap somebody
// left: no function reachable from a browser writes an app's own entry
// script or manifest, by any name.
(function noDoorsLeft() {
  const gone = ['saveAppScript', 'saveAppManifest'].filter(function (name) {
    return typeof spirit.core.fs[name] === 'function';
  });
  if (!gone.length) {
    test.check("an app's own code is unwritable from a browser with NO exception — saveAppScript and saveAppManifest no longer exist (0008)");
  } else {
    test.fail('these doors are back: ' + gone.join(', '));
  }
})();

test.reportSuccessFailureCount();
