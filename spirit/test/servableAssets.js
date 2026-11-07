'use strict';

// Exercises the read gate (fileServable, kernel.js) and its interaction
// with the write gate (fileWritable) — the boundary that decides whether
// a ROOT_DIR-relative path may be read at all, by loadFile/statFile, by
// scanFolder (and therefore the Files app and the fs-watcher), or by
// server.js's generic static route.
//
// pathJail.js already covers the orthogonal question — whether a path
// string can escape ROOT_DIR at all. This file covers what's allowed once
// it's confirmed to be inside: specifically that every Node-only module
// under js/ (no browser half, no legitimate browser read path) is
// invisible, while genuine client assets and ordinary app data are not.
//
// Purely predicate/read checks — nothing here writes to disk, so it's
// safe to run against a live checkout.
//
// "js/" below means spirit/run/spirit/.
const path = require('path');
const spirit = require('../run/spirit/kernel.js');
const test = require('./testSupport.js');
const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const fileServable = spirit.core.fs.fileServable;
const fileWritable = spirit.core.fs.fileWritable;

test.startTest('Servable assets (spirit.core.fs.fileServable / fileWritable)');

function expectUnservable(label, filePath) {
  if (fileServable(filePath) === false) {
    test.check(label + ' — fileServable false');
  } else {
    test.fail(label + ' — fileServable should be false but was ' + fileServable(filePath));
  }
  if (spirit.core.fs.loadFile(filePath) === null) {
    test.check(label + ' — loadFile returns null');
  } else {
    test.fail(label + ' — loadFile should have returned null but returned content');
  }
  if (spirit.core.fs.statFile(filePath) === null) {
    test.check(label + ' — statFile returns null');
  } else {
    test.fail(label + ' — statFile should have returned null but returned metadata');
  }
}

function expectServable(label, filePath) {
  if (fileServable(filePath) === true) {
    test.check(label + ' — fileServable true');
  } else {
    test.fail(label + ' — fileServable should be true but was ' + fileServable(filePath));
  }
}

// Stronger than expectServable: for a path that really exists on disk,
// confirms the gate isn't just letting the string through but that a real
// read completes — otherwise a typo in the path would "pass" silently.
function expectLoads(label, filePath) {
  expectServable(label, filePath);
  if (spirit.core.fs.loadFile(filePath) !== null) {
    test.check(label + ' — loadFile returns content');
  } else {
    test.fail(label + ' — loadFile should have returned content but returned null');
  }
}

function expectNotWritable(label, filePath) {
  if (fileWritable(filePath) === false) {
    test.check(label + ' — fileWritable false');
  } else {
    test.fail(label + ' — fileWritable should be false but was ' + fileWritable(filePath));
  }
}

function expectWritable(label, filePath) {
  if (fileWritable(filePath) === true) {
    test.check(label + ' — fileWritable true');
  } else {
    test.fail(label + ' — fileWritable should be true but was ' + fileWritable(filePath));
  }
}

// ---- Node-only modules under js/ must fail closed ----
// Every one of these runs only in the server process: no isBrowser() half,
// nothing a page could legitimately do with the source. kernel.js is the
// one with a narrow exception — server.js's BOOT_ASSETS list serves it as
// the page's own boot script — but that exception lives in the static
// route, deliberately NOT here, so the generic capability below stays shut.
test.subHeading('Node-only js/ modules are unservable');
expectUnservable('spirit/kernel.js', 'spirit/kernel.js');
expectUnservable('spirit/jobs.js', 'spirit/jobs.js');
expectUnservable('spirit/server.js', 'spirit/server.js');
expectUnservable('spirit/relay.js', 'spirit/relay.js');
expectUnservable('spirit/hub.js', 'spirit/hub.js');
expectUnservable('spirit/relayAuth.js', 'spirit/relayAuth.js');

// None of them are writable either — not because they're on a denylist,
// but because js/ was never a writable root. Asserted anyway so a future
// change to the writable roots can't quietly open them up.
expectNotWritable('spirit/kernel.js', 'spirit/kernel.js');
expectNotWritable('spirit/relay.js', 'spirit/relay.js');
expectNotWritable('spirit/hub.js', 'spirit/hub.js');
expectNotWritable('spirit/relayAuth.js', 'spirit/relayAuth.js');

// ---- genuine browser assets stay open ----
test.subHeading('Client assets stay servable');
expectLoads('spirit/client/shell.js (browser boot)', 'spirit/client/shell.js');
// packet.js lives in client/. If it ever stops serving, no app can
// send or read an envelope, and the shell can only say so in the console —
// so the serving is asserted rather than discovered.
expectLoads('spirit/client/packet.js (the app envelope)', 'spirit/client/packet.js');
expectLoads('spirit/limits.js (the size both ends refuse at)', 'spirit/limits.js');
expectLoads('spirit/peerFile.js', 'spirit/peerFile.js');

// ---- app code and app data stay open ----
// An app's entry script and manifest are readable (the shell fetches the
// script; the Apps manager reads the manifest) and, since goal/G14.8
// (2026-10-10), writable like any other file of the shell root: the
// App Builder era's refusal is gone, and an intrinsic app is fenced by the
// commit hook, not the gate. The verdict is asked; nothing is written.
test.subHeading('App code, manifests and app data');
expectLoads('shell/info/info.js (app entry script)', 'shell/info/info.js');
expectNotWritable('shell/info/info.js (an intrinsic app\'s script is core, goal/G30.21)', 'shell/info/info.js');
expectLoads('shell/info/info.json (manifest)', 'shell/info/info.json');
expectWritable('shell/info/info.json (manifest, goal/G14.8)', 'shell/info/info.json');

// An app's own data is ordinary scoped app data, written via api.fs, and
// must stay both readable and writable. The node's relay list is node state
// (refused to every app); captions.json is the specimen of app data.
//
// SERVABLE, NOT LOADED: the gate is what this asserts, and it is a
// question about the path. The file is gitignored (a fresh clone has
// none — see .gitignore), so loading it would pass only on a working copy
// that happened to hold one (WSL, 2026-09-19).
expectServable('shell/info/captions.json (app data)', 'shell/info/captions.json');
expectWritable('shell/info/captions.json (app data)', 'shell/info/captions.json');

// ---- sidecars and relay state are invisible to every generic consumer ----
test.subHeading('Sidecars and relay-state are invisible');
// A sidecar's only sanctioned reader is getAnnotations, never loadFile /
// scanFolder / the static route.
expectUnservable('a media sidecar', 'media/001.jpg.sidecar.json');
expectNotWritable('a media sidecar (only annotateFile writes one)', 'media/001.jpg.sidecar.json');

// relay-state/ holds the mailbox and, on a real relay, identity.json with
// a private key — never reachable through a file read, whatever else it
// may come to contain later.
expectUnservable('spirit/state/relay.db', 'spirit/state/relay.db');
// And any other file there, whatever its name.
expectUnservable('spirit/state/mailbox.json', 'spirit/state/mailbox.json');
expectUnservable('spirit/state/identity.json', 'spirit/state/identity.json');
expectUnservable('spirit/state/allow.json', 'spirit/state/allow.json');
if (fileServable('relay-state') === false) {
  test.check('relay-state (the folder itself) — fileServable false');
} else {
  test.fail('relay-state (the folder itself) — fileServable should be false');
}
expectNotWritable('spirit/state/relay.db', 'spirit/state/relay.db');
expectNotWritable('spirit/state/mailbox.json', 'spirit/state/mailbox.json');

// ---- the listing path, not just the read path ----
// scanFolder is what the Files app and the fs-watcher job actually walk.
// A module can be unservable by loadFile and still leak its existence in a
// directory listing if scanFolder consults a different rule, so check the
// real walk over the real js/ folder rather than trusting the predicate.
test.subHeading('scanFolder listings honour the same gate');
{
  const entries = spirit.core.node.util.scanFolder(path.join(ROOT_DIR, 'spirit'));
  const names = entries.filter(function (e) { return e.isFile(); }).map(function (e) { return e.name; });

  ['kernel.js', 'jobs.js', 'server.js', 'relay.js', 'hub.js', 'relayAuth.js'].forEach(function (name) {
    if (names.indexOf(name) === -1) {
      test.check('scanFolder(js/) omits ' + name);
    } else {
      test.fail('scanFolder(js/) LISTED ' + name + ' — it must be invisible in Files and the fs-watcher');
    }
  });

  if (names.indexOf('shell.js') !== -1) {
    test.check('scanFolder(js/) still lists js/client/shell.js');
  } else {
    test.fail('scanFolder(js/) should still list js/client/shell.js but did not');
  }
}

// A folder can be refused by the predicate and still be listed, if the
// walk only ever asks about files: the files of relay-state/ invisible while
// the empty folder holding them appeared in every listing, in the Files tree
// and in the fs-watcher payload. One verdict, asked by every consumer,
// including about directories.
test.subHeading('A refused folder is not listed either');
{
  const entries = spirit.core.node.util.scanFolder(ROOT_DIR);
  const names = entries.map(function (e) { return e.name; });

  if (names.indexOf('relay-state') === -1) {
    test.check('scanFolder(run/) does not list the relay-state folder');
  } else {
    test.fail('relay-state is still a row in the tree');
  }

  // Refused whole: nothing below it is walked either, so no later change
  // to the file branch can start reporting its contents.
  const inside = entries.filter(function (e) {
    return String(e.parentPath || '').split(path.sep).join('/').indexOf('/relay-state') !== -1;
  });
  if (inside.length === 0) {
    test.check('and nothing underneath it was walked at all');
  } else {
    test.fail('entries from inside relay-state: ' + inside.map(function (e) { return e.name; }).join(', '));
  }

  // The rest of the tree is untouched — this narrows one folder, it does
  // not start hiding things nobody asked to hide.
  const kept = ['spirit', 'element', 'index.html'].filter(function (name) { return names.indexOf(name) === -1; });
  if (kept.length === 0) {
    test.check('and everything else is still listed');
  } else {
    test.fail('the walk lost: ' + kept.join(', '));
  }
}

test.reportSuccessFailureCount();
