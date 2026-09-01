'use strict';

// Exercises spirit.core.fs.loadFile's path jail (fsPath, kernel.js) —
// the boundary that keeps any caller (browser XHR, a process script) from
// reading anything outside ROOT_DIR, regardless of how the escape is
// attempted. fsPath itself isn't exported, so this goes through the real
// public API rather than reaching into kernel.js internals.
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

test.startTest('Path jail (spirit.core.fs.loadFile)');

// ---- legitimate paths must still work ----
if (spirit.core.fs.loadFile('index.html') !== null) {
  test.check('a real relative path (index.html) loads');
} else {
  test.fail('a real relative path (index.html) should have loaded but returned null');
}

if (spirit.core.fs.loadFile('js/kernel.js') !== null) {
  test.check('a real nested relative path (js/kernel.js) loads');
} else {
  test.fail('a real nested relative path (js/kernel.js) should have loaded but returned null');
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
