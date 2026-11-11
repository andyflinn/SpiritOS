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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Plain: enabled, no element in it, its label alone.
function plain(l, label) { return !!l && l.disabled === false && l.kids === 0 && l.text === label; }
// Busy: greyed (disabled), a turning icon of shell.css's left of the label, the label still said.
function busy(l, label) { return !!l && l.disabled === true && !!l.spin && l.spin.width > 0 && l.spin.height > 0 && l.label === label && l.labelLeft !== null && l.spin.right <= l.labelLeft + 1 && l.animation !== 'none' && l.shellSheet === true; }

const ADDRESS = '/DEBUG/spirit/element/test/busyButton-pressed.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
test.run('spirit/element/busyButton.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : 'there is no spirit/element/busyButton.js';
}, 1000);
// The page: pressed, held, answered
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, 1000);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, 6000);
test.run('the world: the page presses its buttons', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.pressed === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.pressed()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
}, 7000);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('it adds busyButton.create(container, options) and busyButton.attach to window.spirit.element', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.made) ? true : 'no window.spirit.element.spirit.element.busyButton with create(container, options) and attach';
}, 1000);
test.run('create answers a button of type button, appended to the container it is given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // made, it is a plain button in its container
  return (m.create.button && m.create.appended) ? true : 'made: ' + short(m.create);
}, 1000);
test.run('its title and class are put on it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.create.title === 'ask the provider' && /\bmy-ask\b/.test(m.create.className)) ? true : 'title ' + short(m.create.title) + ', class ' + short(m.create.className);
}, 1000);
test.run('before a press it is plain: enabled, its label alone', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (plain(m.create.before, 'Ask')) ? true : 'before: ' + short(m.create.before);
}, 1000);
test.run('the press runs the request once', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // pressed: greyed, a turning icon left of its label, the request running
  // Andy, goal/G41.18: "it has an animated icon showing to the left of the buttons label, when the button is waiting".
  return (m.waiting.runs === 1) ? true : 'ran ' + m.waiting.runs;
}, 1000);
test.run('it greys out: disabled while it waits', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.waiting.disabled === true) ? true : 'disabled: ' + short(m.waiting.disabled);
}, 1000);
test.run('an icon shows left of its label, and the label is still said', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!m.waiting.spin && m.waiting.spin.width > 0 && m.waiting.label === 'Ask' && m.waiting.labelLeft !== null && m.waiting.spin.right <= m.waiting.labelLeft + 1) ? true : 'waiting: ' + short(m.waiting);
}, 1000);
test.run('the icon turns, by a keyframes rule of shell.css, the one sheet', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.waiting.animation !== 'none' && m.waiting.shellSheet === true) ? true : 'its animation is ' + short(m.waiting.animation) + (m.waiting.animation !== 'none' ? ', no keyframes of that name in /shell.css' : '');
}, 1000);
test.run('and the element adds no sheet and no style of its own', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.sheets.after === m.sheets.before && m.sheets.stylesAfter === m.sheets.stylesBefore) ? true : 'sheets ' + m.sheets.before + ' then ' + m.sheets.after + ', style elements ' + m.sheets.stylesBefore + ' then ' + m.sheets.stylesAfter;
}, 1000);
test.run('pressed again while it waits, by a click and by a dispatched event: no request is sent twice', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a second press while it waits does nothing
  // Andy, goal/G41.23: "busyButton: while it waits, does a second press do nothing, so no request is sent twice?" "yes."
  return (m.secondPress === 1) ? true : 'ran ' + m.secondPress;
}, 1000);
test.run('the answer come: enabled, no icon, its label', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // answered, it is a plain button again
  return (plain(m.answered, 'Ask')) ? true : 'answered: ' + short(m.answered);
}, 1000);
test.run('and the next press runs it again', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.again === 2) ? true : 'ran ' + m.again;
}, 1000);
test.run('a refusal (the promise rejects) makes it plain again too', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (busy(m.refusedWaiting, 'Grant') && plain(m.refused, 'Grant')) ? true : 'waiting ' + short(m.refusedWaiting) + ', refused ' + short(m.refused);
}, 1000);
test.run('a request that throws as it is called leaves it plain', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (plain(m.thrown, 'Throw')) ? true : 'thrown: ' + short(m.thrown);
}, 1000);
test.run('a request that answers no promise leaves it plain', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (plain(m.atOnce, 'Now')) ? true : 'at once: ' + short(m.atOnce);
}, 1000);
test.run('a refusal and a throw reach no further: nothing unhandled in the page', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.heard.unhandled === 0 && m.heard.errors === 0) ? true : 'unhandled ' + m.heard.unhandled + ', errors ' + m.heard.errors;
}, 1000);
test.run('attach answers the button it was handed', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // attach: a button already in the page
  return (m.attach.same) ? true : 'attach answered another';
}, 1000);
test.run('pressed it waits as a made one does, its own text the label, then is plain again', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (busy(m.attach.waiting, 'Reload') && plain(m.attach.answered, 'Reload')) ? true : 'waiting ' + short(m.attach.waiting) + ', answered ' + short(m.attach.answered);
}, 1000);
