'use strict';

// Exercises the read and write gates (fileServable / fileWritable,
// kernel.js) against NON-CANONICAL spellings of paths they already deny.
//
// servableAssets.js and writableRoots.js both assert the gates on exactly
// one spelling of each denied path — the canonical one. That is the gap
// this file fills. Both gates pattern-match the raw caller-supplied string
// (UNSERVABLE_FILES.indexOf, the 'relay-state/' prefix check,
// APP_ENTRY_SCRIPT_PATTERN, MANIFEST_PATTERN, the SIDECAR_SUFFIX endsWith)
// while fsPath resolves that string separately — so any spelling that
// resolves to the same file but doesn't match the literal pattern gets
// through. 'relay-state/identity.json' is denied; './relay-state/identity.json'
// is not, and on a real relay that file holds an Ed25519 PRIVATE KEY.
//
// EXPECTED TO FAIL until the gates canonicalize first. The fix is one
// shape change in kernel.js: resolve with fsPath, derive the ROOT_DIR-
// relative forward-slashed path from the RESULT, and run every pattern
// against that canonical form instead of against the input. When that
// lands, every case here passes and no other test changes.
//
// Purely predicate/read checks — nothing here writes to disk (the write
// cases only ask fileWritable's verdict, they never call saveFile), so
// it's safe to run against a live checkout.
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const fileServable = spirit.core.fs.fileServable;
const fileWritable = spirit.core.fs.fileWritable;

test.startTest('Path canonicalization (fileServable / fileWritable)');

// Every spelling below resolves, through path.normalize, to exactly the
// path it was derived from — verified by the resolution check in each
// helper, so a mutation that DOESN'T alias the same file can never quietly
// count as a passing "block".
function spellings(filePath) {
  const segments = filePath.split('/');
  const variants = [
    './' + filePath,                                       // leading dot-slash
    'x/../' + filePath,                                    // traverse in and back out
    filePath + '/.',                                       // trailing dot segment
    segments.join('//'),                                   // doubled separators
  ];
  if (segments.length > 1) {
    variants.push(segments[0] + '/./' + segments.slice(1).join('/')); // interior dot segment
  }
  return variants;
}

// Confirms the variant really is an alias for the original before its
// verdict is allowed to mean anything.
function resolvesSameAs(variant, canonical) {
  const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
  const a = spirit.core.node.util.fsPath(ROOT_DIR, variant);
  const b = spirit.core.node.util.fsPath(ROOT_DIR, canonical);
  return !!a && !!b && path.resolve(a) === path.resolve(b);
}

function expectEverySpellingUnservable(label, canonical) {
  spellings(canonical).forEach(function (variant) {
    if (!resolvesSameAs(variant, canonical)) {
      test.fail(label + ' — test bug: ' + JSON.stringify(variant) + ' does not alias ' + JSON.stringify(canonical));
      return;
    }
    if (fileServable(variant) === false && spirit.core.fs.loadFile(variant) === null) {
      test.check(label + ' — blocked as ' + JSON.stringify(variant));
    } else {
      test.fail(label + ' — READABLE as ' + JSON.stringify(variant) +
        ' (fileServable ' + fileServable(variant) + ')');
    }
  });
}

function expectEverySpellingUnwritable(label, canonical) {
  spellings(canonical).forEach(function (variant) {
    if (!resolvesSameAs(variant, canonical)) {
      test.fail(label + ' — test bug: ' + JSON.stringify(variant) + ' does not alias ' + JSON.stringify(canonical));
      return;
    }
    if (fileWritable(variant) === false) {
      test.check(label + ' — not writable as ' + JSON.stringify(variant));
    } else {
      test.fail(label + ' — WRITABLE as ' + JSON.stringify(variant));
    }
  });
}

// ---- relay-state stays invisible however it is spelled ----
// The highest-value case: on a relay, identity.json holds the private key
// the whole signed-claim scheme rests on.
test.subHeading('relay-state/ is unreadable in every spelling');
expectEverySpellingUnservable('relay-state/identity.json', 'relay-state/identity.json');
expectEverySpellingUnservable('relay-state/routingTable.json', 'relay-state/routingTable.json');
// BOTH NAMES. A relay that has been through the rename holds the new file
// and still has the old one beside it — nothing deletes it, so a rollback
// finds the state it expects. Two files on disk are two files that must
// stay unreadable.
expectEverySpellingUnservable('relay-state/mailbox.json', 'relay-state/mailbox.json');
expectEverySpellingUnservable('relay-state/allow.json', 'relay-state/allow.json');
// NESTED, TOO. An app server's identity lives at
// app-state/<name>/relay-state/identity.json (faceServer.js:614), and the
// first version of the gate refused only the top-level folder, so this
// private key was served to anyone who could ask the node for a file.
expectEverySpellingUnservable('app-state/<name>/relay-state/identity.json', 'app-state/someApp/relay-state/identity.json');
expectEverySpellingUnservable('a relay-state folder anywhere', 'shell/someApp/relay-state/anything.json');

// ---- Node-only modules stay invisible however they are spelled ----
test.subHeading('Node-only js/ modules are unreadable in every spelling');
['js/kernel.js', 'js/jobs.js', 'js/server.js', 'js/relay.js', 'js/hub.js', 'js/relayAuth.js']
  .forEach(function (modulePath) {
    expectEverySpellingUnservable(modulePath, modulePath);
  });

// ---- sidecars stay invisible however they are spelled ----
// getAnnotations is the only sanctioned reader; loadFile and the static
// route must never see one, whatever the caller calls it.
test.subHeading('Sidecars are unreadable in every spelling');
expectEverySpellingUnservable('a media sidecar', 'media/001.jpg.sidecar.json');

// ---- an app's own entry script and manifest are shell files like any other ----
// Until goal/G14.8 (2026-10-10) kernel.js refused both shapes for every
// caller, the App Builder era's guard, and this suite asserted it in every
// spelling. Andy: "the whole story of protecting app sources came from a
// time when we had the stupid AI app-builder, which is gone now"; an
// intrinsic app is fenced by the commit hook (coreFiles.js), not the gate.
// The verdict is asked, never a write made: these are real files of the
// checkout. The same two specimens, intrinsic and not, so that no
// manifest flag has crept back into the gate.
function expectEverySpellingWritable(label, canonical) {
  spellings(canonical).forEach(function (variant) {
    if (!resolvesSameAs(variant, canonical)) {
      test.fail(label + ' — test bug: ' + JSON.stringify(variant) + ' does not alias ' + JSON.stringify(canonical));
      return;
    }
    if (fileWritable(variant) === true) {
      test.check(label + ' — writable as ' + JSON.stringify(variant));
    } else {
      test.fail(label + ' — REFUSED as ' + JSON.stringify(variant) + ' (goal/G14.8 opened the gate)');
    }
  });
}
test.subHeading('App entry scripts are writable in every spelling (goal/G14.8)');
expectEverySpellingWritable('shell/natter/natter.js (intrinsic)', 'shell/natter/natter.js');
expectEverySpellingWritable('shell/textEditor/textEditor.js (not intrinsic)', 'shell/textEditor/textEditor.js');

test.subHeading('App manifests are writable in every spelling (goal/G14.8)');
expectEverySpellingWritable('shell/natter/natter.json', 'shell/natter/natter.json');

test.subHeading('Sidecars stay unwritable in every spelling');
expectEverySpellingUnwritable('a media sidecar', 'media/001.jpg.sidecar.json');

test.subHeading('Non-writable roots stay unwritable in every spelling');
expectEverySpellingUnwritable('js/kernel.js', 'js/kernel.js');
expectEverySpellingUnwritable('js/relayAuth.js', 'js/relayAuth.js');

// ---- the fix must not over-correct ----
// Canonicalizing must not turn into "deny anything that isn't already
// canonical". A non-canonical spelling of a LEGITIMATE path has to keep
// working — pathJail.js already asserts './index.html' loads, and
// app/natter/relays.json has to stay both readable and writable or
// /api/hub/* loses the relay url it dials. These cases fail if the gates
// are fixed by blanket-rejecting dot segments instead of resolving them.
test.subHeading('Legitimate paths still work in non-canonical spellings');
[
  ['./index.html', 'index.html'],
  ['x/../index.html', 'index.html'],
  ['js/./client/shell.js', 'js/client/shell.js'],
  // A TRACKED app file, because this check loads it. It was relays.json,
  // which .gitignore keeps out of every clone on purpose — so it passed
  // only on a working copy that happened to hold one, and went red on the
  // first fresh checkout (WSL, 2026-09-19). relays.json's writability is
  // asserted below, by path, which needs no file.
  ['shell/./natter/natter.json', 'shell/natter/natter.json'],
].forEach(function (pair) {
  const variant = pair[0];
  const canonical = pair[1];
  if (!resolvesSameAs(variant, canonical)) {
    test.fail('test bug: ' + JSON.stringify(variant) + ' does not alias ' + JSON.stringify(canonical));
    return;
  }
  if (fileServable(variant) === true && spirit.core.fs.loadFile(variant) !== null) {
    test.check(JSON.stringify(variant) + ' still loads');
  } else {
    test.fail(JSON.stringify(variant) + ' should still load but was refused — the gate is now over-blocking');
  }
});

// app/ data must stay writable in a non-canonical spelling too, for the
// same reason: relays.json is ordinary app data hub.js depends on.
if (fileWritable('shell/./natter/relays.json') === true) {
  test.check('"shell/./natter/relays.json" is still writable (app data, not an entry script)');
} else {
  test.fail('"shell/./natter/relays.json" should still be writable — the write gate is now over-blocking');
}

test.reportSuccessFailureCount();
