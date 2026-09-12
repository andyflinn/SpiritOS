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
expectWritable('app/ (top-level file)', 'app/__writableRootsProbe__.json');
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
  spirit.core.fs.deleteFile('preferences.json');
}

// ---- everything else at root level, and process/, are NOT writable ----
expectForbidden('a random root-level file', '__writableRootsProbe__.txt');
expectForbidden('process/ (scripts are browser-read-only by design)', 'process/js/__writableRootsProbe__/__writableRootsProbe__.json');
expectForbidden('js/ (the kernel itself)', 'js/__writableRootsProbe__.js');

// ---- app entry scripts are protected even inside the writable app/ root ----
expectForbidden(
  'an app entry script (app/<name>/<name>.js)',
  'app/__writableRootsProbeApp__/__writableRootsProbeApp__.js'
);

// A sibling file in that same (never-created) app folder is NOT an entry
// script and must still be writable — confirms the protection is scoped to
// the exact <name>/<name>.js shape, not the whole folder.
expectWritable('a non-entry-script file in a new app folder', 'app/__writableRootsProbeApp__/data.json');

// ---- THE EXCEPTIONS ARE GONE, AND THAT IS THE STRONGER STATEMENT ----
//
// saveAppScript and saveAppManifest were tested here as the mirror
// image of the refusals above: exactly what saveFile refuses, those two
// existed to allow, for one caller (App Builder). Decision 0008 deleted
// app-building from this repo on 2026-09-13, and both doors went with
// it -- kernel side, browser side, and the two /api/fs/ routes.
//
// About 40 checks disappeared with them. That must not be read as a
// smaller world: what those checks proved was that the exception was
// correctly narrow. The rule they were the exception TO is unchanged
// and now absolute, which is why the refusals above and below stay,
// and why the assertion at the end of this file exists -- a suite that
// merely LOSES checks records less; this one has to say what it now
// claims instead.
//
// One property is worth naming because it did not vanish, it changed
// form: saveAppManifest forced owner:"user" no matter what the caller
// claimed. With no browser-reachable path writing a manifest at all,
// owner can no longer be claimed from a browser in the first place.
// Decision 0003 is enforced by absence now, not by a function.

// ---- app manifests are protected too, even inside the writable app/ root ----
expectForbidden(
  'an app manifest (app/<name>/<name>.json)',
  'app/__writableRootsProbeApp__/__writableRootsProbeApp__.json'
);

// A sibling file in that same folder is NOT a manifest and must still be
// writable — confirms the protection is scoped to the exact <name>/<name>.json
// shape, not the whole folder (mirrors the entry-script check above).
expectWritable('a non-manifest file in a new app folder', 'app/__writableRootsProbeApp__/data.json');


// deleteFile only removes the file — clean up the now-empty folder it lived
// in so this test leaves no trace on disk.
try {
  fs.rmdirSync(path.join(ROOT_DIR, 'app', '__writableRootsProbeApp__'));
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
