'use strict';

// spirit/run/spirit/app/desk/element/deskRunStatus/test/deskRunStatus.js
// The tests of spirit/app/desk/element/deskRunStatus/deskRunStatus.js, and of no other module (spec: ./deskRunStatus.md;
// goal/G41.11, goal/G43.30). goal/G43.30 moved it out of shell/shared/js/ into Desk's own elements (the box: "deskRunStatus.js
// moves to spirit/app/desk/element/deskRunStatus/ ... Desk and its detail load it from there"). The browser file runs in node
// on a window of its own: a pure function of an item's facts and deskVerify's run. Then on a real page of a scratch node,
// required from its place, it stands on spirit.elements, where Desk and its detail look for it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'deskRunStatus.js');
const PLACE = 'spirit/app/desk/element/deskRunStatus/deskRunStatus.js';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const win = { Math: Math, Number: Number, String: String, Array: Array, Object: Object };
win.window = win;
vm.createContext(win);
let loaded = '';
try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { loaded = String(e && e.message || e); }
const S = win.spirit && win.spirit.elements && win.spirit.elements.deskRunStatus;
const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
const pct = function (h) { const m = /value="(\d+)"/.exec(h); return m ? Number(m[1]) : null; };

test.startTest('deskRunStatus.js: the verifier\'s run in an item\'s status');

(async function () {
test.subHeading(PLACE + ': it adds deskRunStatus to window.spirit.elements');
ok(!loaded, 'it is at ' + PLACE, PLACE + ' did not load: ' + short(loaded));
ok(typeof S === 'function', 'window.spirit.elements.deskRunStatus is a function', 'elements: ' + short(win.spirit && Object.keys(win.spirit.elements || {})));
if (typeof S !== 'function') return;

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

// ON A REAL PAGE, FROM ITS PLACE: what Desk and its detail do with it, spirit.require of its path, then
// spirit.elements.deskRunStatus (goal/G43.5: "those elements do NOT belong in spirit.element").
test.subHeading(PLACE + ': required on a real page, it stands on spirit.elements');
const chrome = H.findChrome();
if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
const node = await H.scratchNode();
let page = null;
try {
  page = node.up ? await H.chromePage(chrome) : null;
  if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
  await page.send('Page.navigate', { url: node.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  const got = JSON.parse(await page.evaluate('window.spirit.ready.then(function () { return spirit.require(' + JSON.stringify(PLACE) + '); }).then(function () { var e = spirit.elements && spirit.elements.deskRunStatus; return JSON.stringify({ fn: typeof e, html: typeof e === "function" ? e({ verified: "green" }, null) : null, onElement: !!(spirit.element && spirit.element.deskRunStatus) }); }, function (e) { return JSON.stringify({ error: String(e && e.message || e) }); })'));
  ok(got.fn === 'function' && /verified green/.test(String(got.html)), 'spirit.require of its path puts it on spirit.elements.deskRunStatus, drawing an item\'s outcome', 'on the page: ' + short(got));
  ok(got.onElement === false, 'and not on spirit.element', 'on spirit.element, or not judged: ' + short(got));
} finally {
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
}
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
