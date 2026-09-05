'use strict';

// Exercises spirit.core.fs.loadFile's path jail (fsPath, kernel.js) —
// the boundary that keeps any caller (browser XHR, a process script) from
// reading anything outside ROOT_DIR, regardless of how the escape is
// attempted. Mostly goes through the real public API (loadFile) rather
// than reaching into kernel.js internals; fsPath itself is only called
// directly where the point is to separate the jail's verdict on a path
// from the read gate's (see the js/kernel.js case below).
//
// The jail is only one of two gates loadFile passes through — what may be
// read once a path is confirmed inside ROOT_DIR is fileServable's job, and
// lives in servableAssets.js.
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const ROOT_DIR = spirit.core.node.const.ROOT_DIR;

test.startTest('Path jail (spirit.core.fs.loadFile)');

// ---- legitimate paths must still work ----
if (spirit.core.fs.loadFile('index.html') !== null) {
  test.check('a real relative path (index.html) loads');
} else {
  test.fail('a real relative path (index.html) should have loaded but returned null');
}

if (spirit.core.fs.loadFile('js/client/shell.js') !== null) {
  test.check('a real nested relative path (js/client/shell.js) loads');
} else {
  test.fail('a real nested relative path (js/client/shell.js) should have loaded but returned null');
}

// js/kernel.js used to stand in for "a real nested path" here, back when
// the jail was the only gate loadFile had. It's on UNSERVABLE_FILES now,
// so loadFile refuses it — but for a reason that has nothing to do with
// this test's subject. Keep the case, split into the two questions it
// actually asks: the jail accepts the path string, and the read gate
// refuses it anyway. Do NOT "fix" a failure here by making kernel.js
// loadable again — server.js's BOOT_ASSETS list is what still gets it to
// the browser as the page's boot script.
if (spirit.core.node.util.fsPath(ROOT_DIR, 'js/kernel.js') !== null) {
  test.check('js/kernel.js is a legal path string — the jail itself does not reject it');
} else {
  test.fail('js/kernel.js should be a legal path string but fsPath returned null');
}

if (spirit.core.fs.fileServable('js/kernel.js') === false && spirit.core.fs.loadFile('js/kernel.js') === null) {
  test.check('js/kernel.js is refused by the read gate (fileServable), not the jail');
} else {
  test.fail('js/kernel.js should have been refused by fileServable but loadFile returned content');
}

if (spirit.core.fs.loadFile('./index.html') !== null) {
  test.check('a leading-./ relative path (./index.html) loads');
} else {
  test.fail('a leading-./ relative path (./index.html) should have loaded but returned null');
}

// ---- escape attempts must all be blocked ----
// Each of these was verified live against the real fsPath implementation
// before being encoded here — see the ROOT_DIR fix and its verification.
const escapeAttempts = [
  '../index.html',
  '../../index.html',
  '../../../../../../../Windows/win.ini',
  '..\\..\\Windows\\win.ini',
  '/etc/passwd',
  '/../../../Windows/win.ini',
  'C:\\Windows\\win.ini',
  'C:/Windows/win.ini',
];

escapeAttempts.forEach(function (attempt) {
  if (spirit.core.fs.loadFile(attempt) === null) {
    test.check('blocked escape attempt: ' + JSON.stringify(attempt));
  } else {
    test.fail('DID NOT BLOCK escape attempt: ' + JSON.stringify(attempt));
  }
});

test.reportSuccessFailureCount();
