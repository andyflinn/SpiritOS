'use strict';

// spirit/run/spirit/element/test/busyButton.js
// The tests of spirit/element/busyButton.js, and of no other module (spec: ./busyButton.md; goal/G41.23). Asked of a real
// browser, since a turning icon left of a label is layout and animation: ./busyButton-pressed.html, on a scratch node
// with its DEBUG on, presses busyButtons whose requests it holds, answers, refuses and throws.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'busyButton.js');

// Plain: enabled, no element in it, its label alone.
function plain(l, label) { return !!l && l.disabled === false && l.kids === 0 && l.text === label; }
// Busy: greyed (disabled), a turning icon of shell.css's left of the label, the label still said.
function busy(l, label) { return !!l && l.disabled === true && !!l.spin && l.spin.width > 0 && l.spin.height > 0 && l.label === label && l.labelLeft !== null && l.spin.right <= l.labelLeft + 1 && l.animation !== 'none' && l.shellSheet === true; }

const ADDRESS = '/DEBUG/spirit/element/test/busyButton-pressed.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
test.run('spirit/element/busyButton.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
// The page: pressed, held, answered
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('the page presses its buttons', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.pressed === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.pressed()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});
test.run('it adds busyButton with its create and its attach to window.spirit.required', 0.2, function () {
  if (!m) return false;
  return (m.made) ? true : false;
}, test.limit.quick);
test.run('create answers a button of type button, appended to the container it is given', 0.2, function () {
  if (!m) return false;
  // made, it is a plain button in its container
  return (m.create.button && m.create.appended) ? true : false;
}, test.limit.quick);
test.run('its title and class are put on it', 0.2, function () {
  if (!m) return false;
  return (m.create.title === 'ask the provider' && /\bmy-ask\b/.test(m.create.className)) ? true : false;
}, test.limit.quick);
test.run('before a press it is plain: enabled, its label alone', 0.2, function () {
  if (!m) return false;
  return (plain(m.create.before, 'Ask')) ? true : false;
}, test.limit.quick);
test.run('the press runs the request once', 0.2, function () {
  if (!m) return false;
  // pressed: greyed, a turning icon left of its label, the request running
  // Andy, goal/G41.18: "it has an animated icon showing to the left of the buttons label, when the button is waiting".
  return (m.waiting.runs === 1) ? true : false;
}, test.limit.quick);
test.run('it greys out: disabled while it waits', 0.2, function () {
  if (!m) return false;
  return (m.waiting.disabled === true) ? true : false;
}, test.limit.quick);
test.run('an icon shows left of its label, and the label is still said', 0.2, function () {
  if (!m) return false;
  return (!!m.waiting.spin && m.waiting.spin.width > 0 && m.waiting.label === 'Ask' && m.waiting.labelLeft !== null && m.waiting.spin.right <= m.waiting.labelLeft + 1) ? true : false;
}, test.limit.quick);
test.run('the icon turns, by a keyframes rule of shell.css, the one sheet', 0.2, function () {
  if (!m) return false;
  return (m.waiting.animation !== 'none' && m.waiting.shellSheet === true) ? true : false;
}, test.limit.quick);
test.run('the element adds no sheet and no style of its own', 0.2, function () {
  if (!m) return false;
  return (m.sheets.after === m.sheets.before && m.sheets.stylesAfter === m.sheets.stylesBefore) ? true : false;
}, test.limit.quick);
test.run('pressed again while it waits, by a click and by a dispatched event: no request is sent twice', 0.2, function () {
  if (!m) return false;
  // a second press while it waits does nothing
  // Andy, goal/G41.23: "busyButton: while it waits, does a second press do nothing, so no request is sent twice?" "yes."
  return (m.secondPress === 1) ? true : false;
}, test.limit.quick);
test.run('once the answer has come it is enabled, with no icon and its label', 0.2, function () {
  if (!m) return false;
  // answered, it is a plain button again
  return (plain(m.answered, 'Ask')) ? true : false;
}, test.limit.quick);
test.run('the next press after the answer runs the request again', 0.2, function () {
  if (!m) return false;
  return (m.again === 2) ? true : false;
}, test.limit.quick);
test.run('a refusal, the promise rejecting, makes it plain again too', 0.2, function () {
  if (!m) return false;
  return (busy(m.refusedWaiting, 'Grant') && plain(m.refused, 'Grant')) ? true : false;
}, test.limit.quick);
test.run('a request that throws as it is called leaves it plain', 0.2, function () {
  if (!m) return false;
  return (plain(m.thrown, 'Throw')) ? true : false;
}, test.limit.quick);
test.run('a request that answers no promise leaves it plain', 0.2, function () {
  if (!m) return false;
  return (plain(m.atOnce, 'Now')) ? true : false;
}, test.limit.quick);
// goal/G47.1 (Q25; Andy: "sure.", for every arming button busy after its confirming press; wsl: "with no press given it still
// disables itself, so a mounter wiring its own click loses quick presses"): a request with no promise to wait for marks nothing.
test.run('a request that answers no promise marks nothing, not even in the instant of its press', 0.2, function () {
  if (!m) return false;
  return (plain(m.atOnceNow, 'Now')) ? true : false;
}, test.limit.quick);
test.run('a second press at once, on a request that answers no promise, runs it again', 0.2, function () {
  if (!m) return false;
  return (m.nowRuns === 2) ? true : false;
}, test.limit.quick);
test.run('a refusal and a throw reach no further: nothing unhandled in the page', 0.2, function () {
  if (!m) return false;
  return (m.heard.unhandled === 0 && m.heard.errors === 0) ? true : false;
}, test.limit.quick);
test.run('attach answers the button it was handed', 0.2, function () {
  if (!m) return false;
  // attach: a button already in the page
  return (m.attach.same) ? true : false;
}, test.limit.quick);
test.run('an attached button, pressed, waits as a made one does, its own text the label, then is plain again', 0.2, function () {
  if (!m) return false;
  return (busy(m.attach.waiting, 'Reload') && plain(m.attach.answered, 'Reload')) ? true : false;
}, test.limit.quick);
