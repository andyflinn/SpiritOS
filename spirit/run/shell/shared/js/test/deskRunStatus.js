'use strict';

// spirit/run/shell/shared/js/test/deskRunStatus.js
// The tests of shell/shared/js/deskRunStatus.js, and of no other module (spec: ./deskRunStatus.md; goal/G41.11). The
// browser file runs in node on a window of its own; it is a pure function of an item's facts and deskVerify's run.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskRunStatus.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const win = { Math: Math, Number: Number, String: String, Array: Array, Object: Object };
win.window = win;
vm.createContext(win);
vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
const S = win.spirit && win.spirit.elements && win.spirit.elements.deskRunStatus;
const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
const pct = function (h) { const m = /value="(\d+)"/.exec(h); return m ? Number(m[1]) : null; };

test.startTest('deskRunStatus.js: the verifier\'s run in an item\'s status');

test.subHeading('it adds deskRunStatus to window.spirit.elements');
ok(typeof S === 'function', 'window.spirit.elements.deskRunStatus is a function', 'elements: ' + short(win.spirit && Object.keys(win.spirit.elements || {})));

test.subHeading('a run of this item: a progress bar and the suite it is in');
const running = { verifyRunning: true };
const h1 = S(running, { doing: 'run', suite: 'suites/<a>.js', index: 2, of: 4, tests: 5, expected: 10 }, esc);
ok(/^<progress max="100" value="\d+" style="width:6em"><\/progress> /.test(h1), 'it draws a progress of max 100, 6em wide', h1);
ok(pct(h1) === 38, 'the bar is (index-1 + tests/expected) of of: (1 + 0.5) / 4 = 38%', 'value ' + pct(h1));
ok(/verifying &lt;a>\.js, suite 2 of 4<\/span>$/.test(h1), 'it says the suite\'s file name alone, escaped by the esc handed, and suite i of n', h1);
const h2 = S(running, { doing: 'run', suite: 'x.js', index: 1, of: 2, tests: 50, expected: 10 }, esc);
ok(pct(h2) === 50, 'tests past expected count as the whole suite, never more', 'value ' + pct(h2));
const h3 = S(running, { doing: 'run', index: 9, of: 2, tests: 0, expected: 0 }, esc);
ok(pct(h3) === 100 && /verifying, suite 9 of 2/.test(h3), 'the bar is held at 100; no suite, no suite name', h3);
const h4 = S(running, { doing: 'run', suite: 'a/b.js' });
ok(pct(h4) === 0 && /verifying b\.js<\/span>$/.test(h4), 'no of: 0%, and no "suite i of n"; without esc the text is drawn as it is', h4);
const h5 = S(running, { doing: 'run', suite: 'x.js', index: 0, of: 3, tests: 0, expected: 5 }, esc);
ok(pct(h5) === 0, 'an index before the first suite is held at 0', 'value ' + pct(h5));

test.subHeading('no run of this item: its ended outcome, or nothing');
ok(S(null, { doing: 'run' }, esc) === '' && S(undefined) === '', 'no facts: nothing', short(S(null)));
const green = { verified: 'green' };
ok(S(green, null, esc) === '<span style="color:#1a7f37">verified green</span>', 'verified green, in green', S(green, null, esc));
ok(S(Object.assign({ verifyRunning: true }, green), { doing: 'idle' }, esc).indexOf('verified green') !== -1, 'a run object that is not a run: the outcome shows', 'drew another');
ok(S(Object.assign({ verifyRunning: false }, green), { doing: 'run', of: 2, index: 1 }, esc).indexOf('verified green') !== -1, 'a run while the desk says this item does not run: the outcome shows', 'drew the run');
ok(S({ verified: 'red', verifyRed: 3 }) === '<span style="color:#c00">red: 3 suites</span>', 'red: N suites, in red, from verifyRed', S({ verified: 'red', verifyRed: 3 }));
ok(S({ verified: 'red', verifyRed: 1 }) === '<span style="color:#c00">red: 1 suite</span>', 'one suite is said in the singular', S({ verified: 'red', verifyRed: 1 }));
const old = S({ verified: 'red', verifyFailures: ['a.js one failed', 'a.js two failed', 'b.js boom'] });
ok(old === '<span style="color:#c00">red: 2 suites</span>', 'a row from before the count: the distinct suites its failure lines name', old);
ok(S({ verified: 'red' }) === '<span style="color:#c00">red: 0 suites</span>', 'red with no count and no failures says 0 suites', S({ verified: 'red' }));
ok(S({ verified: 'none' }) === '' && S({}) === '', 'neither green nor red: nothing', short(S({ verified: 'none' })));

test.reportSuccessFailureCount();
