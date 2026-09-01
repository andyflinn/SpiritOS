'use strict';

// Exercises the writable-root matrix (isWithinWritableRoot + the
// app-entry-script protection, kernel.js) via the real
// spirit.core.fs.saveFile/deleteFile API. Every negative case here is
// verified to never touch disk (isWithinWritableRoot / the entry-script
// check both run before any fs write), so this is safe to run against a
// live checkout — the one exception is preferences.json, which is a real
// file the running server reads/writes, so it's backed up and restored
// rather than left holding this test's probe value.
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

function expectForbidden(label, filePath, expectedReason) {
  const saved = spirit.core.fs.saveFile(filePath, 'writableRoots.js probe');
  if (!saved.ok && saved.reason === expectedReason) {
    test.check(label + ' is correctly forbidden (' + expectedReason + ')');
  } else {
    test.fail(label + ' should have been forbidden with reason "' + expectedReason + '" but got ' + JSON.stringify(saved));
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
expectForbidden('a random root-level file', '__writableRootsProbe__.txt', 'forbidden');
expectForbidden('process/ (scripts are browser-read-only by design)', 'process/js/__writableRootsProbe__/__writableRootsProbe__.json', 'forbidden');
expectForbidden('js/ (the kernel itself)', 'js/__writableRootsProbe__.js', 'forbidden');

// ---- app entry scripts are protected even inside the writable app/ root ----
expectForbidden(
  'an app entry script (app/<name>/<name>.js)',
  'app/__writableRootsProbeApp__/__writableRootsProbeApp__.js',
  'app-entry-script-protected'
);

// A sibling file in that same (never-created) app folder is NOT an entry
// script and must still be writable — confirms the protection is scoped to
// the exact <name>/<name>.js shape, not the whole folder.
expectWritable('a non-entry-script file in a new app folder', 'app/__writableRootsProbeApp__/data.json');

// deleteFile only removes the file — clean up the now-empty folder it lived
// in so this test leaves no trace on disk.
try {
  fs.rmdirSync(path.join(ROOT_DIR, 'app', '__writableRootsProbeApp__'));
} catch (e) { /* already gone or never created — fine either way */ }

test.reportSuccessFailureCount();
