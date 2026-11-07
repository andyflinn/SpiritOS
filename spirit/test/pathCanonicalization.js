'use strict';

// Exercises the read and write gates (fileServable / fileWritable,
// kernel.js) against NON-CANONICAL spellings of paths they already deny.
//
// servableAssets.js and writableRoots.js both assert the gates on exactly
// one spelling of each denied path — the canonical one. This file asks
// the other spellings. The gates (spirit/run/spirit/fileSystem.js, reached
// through kernel.js) resolve the caller's string with fsPath and run every
// pattern against that canonical form (canonicalPath / gatePath), so any
// spelling of a denied file gets the same verdict:
// './spirit/state/identity.json' is denied like 'spirit/state/identity.json',
// and that file holds an Ed25519 PRIVATE KEY.
//
// Purely predicate/read checks — nothing here writes to disk (the write
// cases only ask fileWritable's verdict, they never call saveFile), so
// it's safe to run against a live checkout.
const path = require('path');
const spirit = require('../run/spirit/kernel.js');
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

// ---- a node's spirit/state/ stays invisible however it is spelled ----
// The highest-value case: identity.json holds the private key the whole
// signed-claim scheme rests on. The gate refuses spirit/state/ at any
// depth (goal/G43.8, goal/G43.9).
test.subHeading('relay-state/ is unreadable in every spelling');
expectEverySpellingUnservable('spirit/state/identity.json', 'spirit/state/identity.json');
expectEverySpellingUnservable('spirit/state/relay.db', 'spirit/state/relay.db');
// Every file in that folder, whatever its name, stays unreadable.
expectEverySpellingUnservable('spirit/state/mailbox.json', 'spirit/state/mailbox.json');
expectEverySpellingUnservable('spirit/state/allow.json', 'spirit/state/allow.json');
// NESTED, TOO. A spirit/state/ inside another folder (here an old
// app-state/<name>/ tree, which nothing moves any more since goal/G43.23)
// can hold an identity.json, and a gate that refused only the top-level
// folder would serve that private key to anyone who could ask the node
// for a file.
expectEverySpellingUnservable('app-state/<name>/spirit/state/identity.json', 'app-state/someApp/spirit/state/identity.json');
expectEverySpellingUnservable('a relay-state folder anywhere', 'shell/someApp/spirit/state/anything.json');

// ---- Node-only modules stay invisible however they are spelled ----
test.subHeading('Node-only js/ modules are unreadable in every spelling');
['spirit/kernel.js', 'spirit/jobs.js', 'spirit/server.js', 'spirit/relay.js', 'spirit/hub.js', 'spirit/relayAuth.js']
  .forEach(function (modulePath) {
    expectEverySpellingUnservable(modulePath, modulePath);
  });

// ---- sidecars stay invisible however they are spelled ----
// getAnnotations is the only sanctioned reader; loadFile and the static
// route must never see one, whatever the caller calls it.
test.subHeading('Sidecars are unreadable in every spelling');
expectEverySpellingUnservable('a media sidecar', 'media/001.jpg.sidecar.json');

// ---- an app's own entry script and manifest are shell files like any other ----
// goal/G14.8: the gate does not refuse an app's entry script or manifest
// as such. Andy: "the whole story of protecting app sources came from a
// time when we had the stupid AI app-builder, which is gone now"; an
// intrinsic app is fenced by being core (coreFiles.js), not by its shape.
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
// Only core files are protected (goal/G30.21): an intrinsic app's script is core, any other app's is not.
test.subHeading('An intrinsic app\'s script is core and unwritable, another app\'s writable, in every spelling (goal/G30.21)');
expectEverySpellingUnwritable('shell/info/info.js (intrinsic, core)', 'shell/info/info.js');
expectEverySpellingWritable('shell/textEditor/textEditor.js (not intrinsic)', 'shell/textEditor/textEditor.js');

test.subHeading('App manifests are writable in every spelling (goal/G14.8)');
expectEverySpellingWritable('shell/info/info.json', 'shell/info/info.json');

test.subHeading('Sidecars stay unwritable in every spelling');
expectEverySpellingUnwritable('a media sidecar', 'media/001.jpg.sidecar.json');

test.subHeading('Non-writable roots stay unwritable in every spelling');
expectEverySpellingUnwritable('spirit/kernel.js', 'spirit/kernel.js');
expectEverySpellingUnwritable('spirit/relayAuth.js', 'spirit/relayAuth.js');

// ---- the fix must not over-correct ----
// Canonicalizing must not turn into "deny anything that isn't already
// canonical". A non-canonical spelling of a LEGITIMATE path has to keep
// working — pathJail.js also asserts './index.html' loads, and an
// app's own data has to stay both readable and writable or the app breaks.
// These cases fail if the gates
// are fixed by blanket-rejecting dot segments instead of resolving them.
test.subHeading('Legitimate paths still work in non-canonical spellings');
[
  ['spirit/./client/shell.js', 'spirit/client/shell.js'],
  // A TRACKED app file, because this check loads it: an untracked one
  // would pass only on a working copy that happened to hold it.
  ['shell/./info/info.json', 'shell/info/info.json'],
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

// An app's data must stay writable in a non-canonical spelling too, for
// the same reason: the info app's captions.json is asked by path, which
// needs no file.
if (fileWritable('shell/./info/captions.json') === true) {
  test.check('"shell/./info/captions.json" is still writable (app data, not an entry script)');
} else {
  test.fail('"shell/./info/captions.json" should still be writable — the write gate is now over-blocking');
}

test.reportSuccessFailureCount();
