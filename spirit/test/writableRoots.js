'use strict';

// Exercises the write gate (fileWritable, spirit/run/spirit/fileSystem.js)
// via the real spirit.core.fs.saveFile/deleteFile API. A path is writable
// when it is in a folder and not a core file (coreFiles.js), the node's
// own state or relay-state; no root-level file is writable (goal/G43.17).
// Every refusal is decided before any fs write, so this is safe to run
// against a live checkout.
const fs = require('fs');
const path = require('path');
const spirit = require('../run/spirit/kernel.js');
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

// saveFile answers every refusal with the single reason 'forbidden'
// (fileSystem.js: fileWritable is the one predicate). Which rule did the
// refusing is pinned by the labels, not by the reason string.
function expectForbidden(label, filePath) {
  const saved = spirit.core.fs.saveFile(filePath, 'writableRoots.js probe');
  if (!saved.ok && saved.reason === 'forbidden') {
    test.check(label + ' is correctly forbidden');
  } else {
    test.fail(label + ' should have been forbidden but got ' + JSON.stringify(saved));
  }
}

// deleteFile shares fileWritable with saveFile, so anything saveFile
// refuses is equally undeletable through the public API; such a probe has
// to be cleaned up with a direct fs call instead.
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

// ---- files in the shell, media and published folders ----
expectWritable('shell/ (top-level file)', 'shell/__writableRootsProbe__.json');
expectWritable('media/ (top-level file)', 'media/__writableRootsProbe__.json');
expectWritable('published/ (top-level file)', 'published/__writableRootsProbe__.json');

// ---- a root-level file and core are NOT writable; process/ is, since goal/G30.21 (only core is protected) ----
expectForbidden('a random root-level file', '__writableRootsProbe__.txt');
expectWritable('process/ (writable since goal/G30.21: only core files are protected)', 'process/js/__writableRootsProbe__.json');
expectForbidden('spirit/ (the kernel itself)', 'spirit/__writableRootsProbe__.js');

// ---- app entry scripts and manifests are shell files like any other ----
//
// goal/G14.8, Andy: "we only protect intrinsic apps, and they are already
// gated by the commit hooks as "core"". So an app's <name>/<name>.js and
// <name>/<name>.json are written through saveFile like any file, and an
// intrinsic app is fenced at the commit (coreFiles.js), not at the gate.
// A never-created app folder, so nothing real is touched.
expectWritable('an app entry script (shell/<name>/<name>.js, goal/G14.8)', 'shell/__writableRootsProbeApp__/__writableRootsProbeApp__.js');
expectWritable('an app manifest (shell/<name>/<name>.json, goal/G14.8)', 'shell/__writableRootsProbeApp__/__writableRootsProbeApp__.json');
expectWritable('a sibling file in the same app folder', 'shell/__writableRootsProbeApp__/data.json');


// deleteFile only removes the file — clean up the now-empty folder it lived
// in so this test leaves no trace on disk.
try {
  fs.rmdirSync(path.join(ROOT_DIR, 'shell', '__writableRootsProbeApp__'));
} catch (e) { /* already gone or never created — fine either way */ }

// No special door for an app's own entry script or manifest: decision
// 0008 deleted saveAppScript and saveAppManifest, and this checks they
// stay gone.
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
