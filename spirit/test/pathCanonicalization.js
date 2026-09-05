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
expectEverySpellingUnservable('relay-state/mailbox.json', 'relay-state/mailbox.json');
expectEverySpellingUnservable('relay-state/allow.json', 'relay-state/allow.json');

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

// ---- an app's own entry script and manifest stay protected ----
// kernel.js says these are "protected everywhere, from every tool". That
// has to hold for every spelling, or the guarantee is only about strings.
test.subHeading('App entry scripts stay unwritable in every spelling');
expectEverySpellingUnwritable('app/natter/natter.js', 'app/natter/natter.js');
expectEverySpellingUnwritable('app/appBuilder/appBuilder.js', 'app/appBuilder/appBuilder.js');

test.subHeading('App manifests stay unwritable in every spelling');
expectEverySpellingUnwritable('app/natter/natter.json', 'app/natter/natter.json');

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
  ['app/./natter/relays.json', 'app/natter/relays.json'],
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
if (fileWritable('app/./natter/relays.json') === true) {
  test.check('"app/./natter/relays.json" is still writable (app data, not an entry script)');
} else {
  test.fail('"app/./natter/relays.json" should still be writable — the write gate is now over-blocking');
}

test.reportSuccessFailureCount();
