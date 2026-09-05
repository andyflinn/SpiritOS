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
const path = require('path');
const spirit = require('../run/js/kernel.js');
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
expectUnservable('js/kernel.js', 'js/kernel.js');
expectUnservable('js/jobs.js', 'js/jobs.js');
expectUnservable('js/server.js', 'js/server.js');
expectUnservable('js/relay.js', 'js/relay.js');
expectUnservable('js/hub.js', 'js/hub.js');
expectUnservable('js/relayAuth.js', 'js/relayAuth.js');

// None of them are writable either — not because they're on a denylist,
// but because js/ was never a writable root. Asserted anyway so a future
// change to the writable roots can't quietly open them up.
expectNotWritable('js/kernel.js', 'js/kernel.js');
expectNotWritable('js/relay.js', 'js/relay.js');
expectNotWritable('js/hub.js', 'js/hub.js');
expectNotWritable('js/relayAuth.js', 'js/relayAuth.js');

// ---- genuine browser assets stay open ----
test.subHeading('Client assets stay servable');
expectLoads('index.html (desktop homepage)', 'index.html');
expectLoads('relay.html (--relay homepage)', 'relay.html');
expectLoads('favicon.svg', 'favicon.svg');
expectLoads('js/client/shell.js (browser boot)', 'js/client/shell.js');
expectLoads('js/client/browser.js', 'js/client/browser.js');

// ---- app code and app data stay open ----
// An app's entry script and manifest are readable (the shell fetches the
// script; App Builder and the Apps manager read the manifest) but never
// writable through the generic route — see writableRoots.js for the
// saveAppScript/saveAppManifest doors that are the only way in.
test.subHeading('App code, manifests and app data');
expectLoads('app/natter/natter.js (app entry script)', 'app/natter/natter.js');
expectNotWritable('app/natter/natter.js (app entry script)', 'app/natter/natter.js');
expectLoads('app/natter/natter.json (manifest)', 'app/natter/natter.json');
expectNotWritable('app/natter/natter.json (manifest)', 'app/natter/natter.json');

// NATter's address book is ordinary scoped app data, written via
// api.fs.saveFile('relays.json', …) and read by hub.js to find the relay
// to dial. It must stay both readable and writable — locking it in a
// "protect everything the relay work added" sweep would break NATter and
// leave /api/hub/* answering 503 with no relay url.
expectLoads('app/natter/relays.json (app data)', 'app/natter/relays.json');
expectWritable('app/natter/relays.json (app data)', 'app/natter/relays.json');

// ---- process scripts: readable, never writable ----
// Processes/Jobs list them, the Code Viewer shows them; writes are already
// impossible since process/ isn't a writable root.
test.subHeading('Process scripts are read-only, not hidden');
expectLoads('process/js/relayLabPing/relayLabPing.js', 'process/js/relayLabPing/relayLabPing.js');
expectNotWritable('process/js/relayLabPing/relayLabPing.js', 'process/js/relayLabPing/relayLabPing.js');
expectLoads('process/js/relayLabPing/relayLabPing.json', 'process/js/relayLabPing/relayLabPing.json');

// ---- sidecars and relay state are invisible to every generic consumer ----
test.subHeading('Sidecars and relay-state are invisible');
// A sidecar's only sanctioned reader is getAnnotations, never loadFile /
// scanFolder / the static route.
expectUnservable('a media sidecar', 'media/001.jpg.sidecar.json');
expectNotWritable('a media sidecar (only annotateFile writes one)', 'media/001.jpg.sidecar.json');

// relay-state/ holds the mailbox and, on a real relay, identity.json with
// a private key — never reachable through a file read, whatever else it
// may come to contain later.
expectUnservable('relay-state/mailbox.json', 'relay-state/mailbox.json');
expectUnservable('relay-state/identity.json', 'relay-state/identity.json');
expectUnservable('relay-state/allow.json', 'relay-state/allow.json');
if (fileServable('relay-state') === false) {
  test.check('relay-state (the folder itself) — fileServable false');
} else {
  test.fail('relay-state (the folder itself) — fileServable should be false');
}
expectNotWritable('relay-state/mailbox.json', 'relay-state/mailbox.json');

// ---- the listing path, not just the read path ----
// scanFolder is what the Files app and the fs-watcher job actually walk.
// A module can be unservable by loadFile and still leak its existence in a
// directory listing if scanFolder consults a different rule, so check the
// real walk over the real js/ folder rather than trusting the predicate.
test.subHeading('scanFolder listings honour the same gate');
{
  const entries = spirit.core.node.util.scanFolder(path.join(ROOT_DIR, 'js'));
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

test.reportSuccessFailureCount();
