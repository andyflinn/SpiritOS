'use strict';

// spirit/run/spirit/app/desk/element/deskRunStatus/test/deskRunStatus.js
// The tests of spirit/app/desk/element/deskRunStatus/deskRunStatus.js, and of no other module (spec: ./deskRunStatus.md;
// goal/G41.11, goal/G43.30). goal/G43.30 moved it out of shell/shared/js/ into Desk's own elements (the box: "deskRunStatus.js
// moves to spirit/app/desk/element/deskRunStatus/ ... Desk and its detail load it from there"). The browser file runs in node
// on a window of its own: a pure function of an item's facts and deskVerify's run. Then on a real page of a scratch node,
// required from its place, it stands at spirit.required.spirit.app.desk.element.deskRunStatus.deskRunStatus, where Desk and
// its detail look for it: a helper, no element (goal/G43.32; Andy: "helpers with no create are no fucking elements. they
// live in require.").

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'deskRunStatus.js');
const PLACE = 'spirit/app/desk/element/deskRunStatus/deskRunStatus.js';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const win = { Math: Math, Number: Number, String: String, Array: Array, Object: Object };
// A page's spirit, holding spirit.required as spirit.js makes it before any script runs (goal/G43.32).
win.spirit = { required: {} };
win.window = win;
vm.createContext(win);
let loaded = '';
try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { loaded = String(e && e.message || e); }
const AT = function (o) { return ['spirit', 'app', 'desk', 'element', 'deskRunStatus', 'deskRunStatus'].reduce(function (x, k) { return x && x[k]; }, o); };
const S = AT(win.spirit.required);
const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
const pct = function (h) { const m = /value="(\d+)"/.exec(h); return m ? Number(m[1]) : null; };

// What the page part makes, for the tests after it; the page and node are stopped by test.after.
const W = {};
const noS = function () { return typeof S !== 'function' ? PLACE + ' gave no function: the tests above failed' : ''; };

// spirit/app/desk/element/deskRunStatus/deskRunStatus.js: it stands at spirit.required.spirit.app.desk.element.deskRunStatus.deskRunStatus
test.run('its element file loads', 0.2, function () { return !loaded || PLACE + ' did not load: ' + short(loaded); }, 1000);
test.run('window.spirit.required.spirit.app.desk.element.deskRunStatus.deskRunStatus is a function', 0.2, function () { return typeof S === 'function' || 'required: ' + short(win.spirit.required); }, 1000);

// a run of this item: a progress bar and the suite it is in
const running = { verifyRunning: true };
test.run('it draws a progress of max 100, 6em wide', 0.2, function () {
  if (noS()) return noS();
  W.h1 = S(running, { doing: 'run', suite: 'suites/<a>.js', index: 2, of: 4, tests: 5, expected: 10 }, esc);
  return /^<progress max="100" value="\d+" style="width:6em"><\/progress> /.test(W.h1) || W.h1;
}, 1000);
test.run('the bar is (index-1 + tests/expected) of of: (1 + 0.5) / 4 = 38%', 0.2, function () { if (noS()) return noS(); return pct(W.h1) === 38 || 'value ' + pct(W.h1); }, 1000);
test.run('it says the suite\'s file name alone, escaped by the esc handed, and suite i of n', 0.2, function () { if (noS()) return noS(); return /verifying &lt;a>\.js, suite 2 of 4<\/span>$/.test(W.h1) || W.h1; }, 1000);
test.run('tests past expected count as the whole suite, never more', 0.2, function () {
  if (noS()) return noS();
  const h2 = S(running, { doing: 'run', suite: 'x.js', index: 1, of: 2, tests: 50, expected: 10 }, esc);
  return pct(h2) === 50 || 'value ' + pct(h2);
}, 1000);
test.run('the bar is held at 100; no suite, no suite name', 0.2, function () {
  if (noS()) return noS();
  const h3 = S(running, { doing: 'run', index: 9, of: 2, tests: 0, expected: 0 }, esc);
  return (pct(h3) === 100 && /verifying, suite 9 of 2/.test(h3)) || h3;
}, 1000);
test.run('no of: 0%, and no "suite i of n"; without esc the text is drawn as it is', 0.2, function () {
  if (noS()) return noS();
  const h4 = S(running, { doing: 'run', suite: 'a/b.js' });
  return (pct(h4) === 0 && /verifying b\.js<\/span>$/.test(h4)) || h4;
}, 1000);
test.run('an index before the first suite is held at 0', 0.2, function () {
  if (noS()) return noS();
  const h5 = S(running, { doing: 'run', suite: 'x.js', index: 0, of: 3, tests: 0, expected: 5 }, esc);
  return pct(h5) === 0 || 'value ' + pct(h5);
}, 1000);

// no run of this item: its ended outcome, or nothing
const green = { verified: 'green' };
test.run('no facts: nothing', 0.2, function () { if (noS()) return noS(); return (S(null, { doing: 'run' }, esc) === '' && S(undefined) === '') || short(S(null)); }, 1000);
test.run('verified green, in green', 0.2, function () { if (noS()) return noS(); return S(green, null, esc) === '<span style="color:#1a7f37">verified green</span>' || S(green, null, esc); }, 1000);
test.run('a run object that is not a run: the outcome shows', 0.2, function () { if (noS()) return noS(); return S(Object.assign({ verifyRunning: true }, green), { doing: 'idle' }, esc).indexOf('verified green') !== -1 || 'drew another'; }, 1000);
test.run('a run while the desk says this item does not run: the outcome shows', 0.2, function () { if (noS()) return noS(); return S(Object.assign({ verifyRunning: false }, green), { doing: 'run', of: 2, index: 1 }, esc).indexOf('verified green') !== -1 || 'drew the run'; }, 1000);
test.run('red: N suites, in red, from verifyRed', 0.2, function () { if (noS()) return noS(); return S({ verified: 'red', verifyRed: 3 }) === '<span style="color:#c00">red: 3 suites</span>' || S({ verified: 'red', verifyRed: 3 }); }, 1000);
test.run('one suite is said in the singular', 0.2, function () { if (noS()) return noS(); return S({ verified: 'red', verifyRed: 1 }) === '<span style="color:#c00">red: 1 suite</span>' || S({ verified: 'red', verifyRed: 1 }); }, 1000);
test.run('a row from before the count: the distinct suites its failure lines name', 0.2, function () {
  if (noS()) return noS();
  const old = S({ verified: 'red', verifyFailures: ['a.js one failed', 'a.js two failed', 'b.js boom'] });
  return old === '<span style="color:#c00">red: 2 suites</span>' || old;
}, 1000);
test.run('red with no count and no failures says 0 suites', 0.2, function () { if (noS()) return noS(); return S({ verified: 'red' }) === '<span style="color:#c00">red: 0 suites</span>' || S({ verified: 'red' }); }, 1000);
test.run('neither green nor red: nothing', 0.2, function () { if (noS()) return noS(); return (S({ verified: 'none' }) === '' && S({}) === '') || short(S({ verified: 'none' })); }, 1000);

// ON A REAL PAGE, FROM ITS PLACE: what Desk and its detail do with it, spirit.require of its path, then
// spirit.required.spirit.app.desk.element.deskRunStatus.deskRunStatus (goal/G43.5: "those elements do NOT belong in
// spirit.element"; goal/G43.32: a helper lives in require).
test.run('the world: a scratch node and a Chrome page on its face, it required there', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  W.node = await H.scratchNode();
  W.page = W.node.up ? await H.chromePage(chrome) : null;
  if (!W.page || W.page.error) return W.page ? W.page.error : 'the scratch node did not come up';
  const page = W.page;
  await page.send('Page.navigate', { url: W.node.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  W.got = JSON.parse(await page.evaluate('window.spirit.ready.then(function () { return spirit.require(' + JSON.stringify(PLACE) + '); }).then(function () { var at = function (o) { return ["spirit", "app", "desk", "element", "deskRunStatus", "deskRunStatus"].reduce(function (x, k) { return x && x[k]; }, o); }; var e = at(spirit.required); return JSON.stringify({ fn: typeof e, html: typeof e === "function" ? e({ verified: "green" }, null) : null, onElement: !!at(spirit.element) }); }, function (e) { return JSON.stringify({ error: String(e && e.message || e) }); })'));
  return true;
}, 9000);
test.run('spirit.require of its path puts it at spirit.required.spirit.app.desk.element.deskRunStatus.deskRunStatus, drawing an item\'s outcome', 0.2, function () {
  const got = W.got;
  if (!got) return 'no page: the world failed';
  return (got.fn === 'function' && /verified green/.test(String(got.html))) || 'on the page: ' + short(got);
}, 1000);
test.run('and not on spirit.element', 0.2, function () {
  const got = W.got;
  if (!got) return 'no page: the world failed';
  return got.onElement === false || 'on spirit.element, or not judged: ' + short(got);
}, 1000);
test.after(function () {
  const page = W.page, node = W.node || {};
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
