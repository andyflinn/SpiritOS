'use strict';

// spirit/run/spirit/element/test/icon.js
// The tests of spirit/element/icon.js, and of no other module (spec: ./icon.md; goal/G41.23). Asked of a real browser, since a
// square that follows the font size is layout: ./icon-sized.html, on a scratch node with its DEBUG on, puts icons in
// containers of several font sizes.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'icon.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function square(b, side) { return !!b && Math.abs(b.w - side) <= 0.5 && Math.abs(b.h - side) <= 0.5; }

const ADDRESS = '/DEBUG/spirit/element/test/icon-sized.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let tol;
test.run('spirit/element/icon.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : 'there is no spirit/element/icon.js';
}, test.limit.quick);
// The page: icons in containers of several font sizes
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, test.limit.quick);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, test.limit.slow);
test.run('the world: the page sizes its icons', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.sized === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.sized()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('it adds icon.create(container, options) to window.spirit.element', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (m.made) ? true : 'no window.spirit.element.spirit.element.icon.create of a container and options';
}, test.limit.quick);
test.run('create answers an element, appended to the container it is given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a shell element: appended, the glyph as it is given
  return (m.base.answered && m.base.appended) ? true : 'made: ' + short(m.base);
}, test.limit.quick);
test.run('it shows the glyph it is given, as it is', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // "the glyph IS the glyph, no key-abstraction."
  return (m.base.text === 'A' && m.key === '🔑') ? true : 'shows ' + short(m.base.text) + ' and ' + short(m.key);
}, test.limit.quick);
test.run('it carries a class of its own', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // The class it carries is how the shell's other elements are seen to paint through it (workBench's test).
  return (m.base.className.trim() !== '') ? true : 'it carries no class';
}, test.limit.quick);
test.run('in 20 pixel type, no size given: a square of 20', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a square, its side the font size times size
  // "a square box, the size of which follows font-size, it's size option should vary from that base-line, be a
  // multiplier of it."
  return (square(m.base.size, 20)) ? true : 'it is ' + short(m.base.size);
}, test.limit.quick);
test.run('size 2: a square of 40', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (square(m.twice, 40)) ? true : 'it is ' + short(m.twice);
}, test.limit.quick);
test.run('size 0.5: a square of 10', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (square(m.half, 10)) ? true : 'it is ' + short(m.half);
}, test.limit.quick);
test.run('in 10 pixel type: a square of 10, the size it inherits', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (square(m.small, 10)) ? true : 'it is ' + short(m.small);
}, test.limit.quick);
test.run('in a row of 5 pixels beside a long label it never shrinks: still 20', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (square(m.tight, 20)) ? true : 'it is ' + short(m.tight);
}, test.limit.quick);
test.run('the glyph\'s middle is the square\'s middle, within a tenth of its side', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // the glyph centred, the rest its container's
  // "it centers the glyph"; tolerance a tenth of the side, for the font's own glyph metrics.
  tol = m.centred.side / 10;
  return (m.centred.dx <= tol && m.centred.dy <= tol) ? true : 'the glyph is off its square\'s middle by ' + m.centred.dx + ' across and ' + m.centred.dy + ' down, in a side of ' + m.centred.side;
}, test.limit.quick);
test.run('it follows its container like a text character: its colour', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // "no other option than size, like like text characters, it follows, its container in most attributes."
  return (m.base.color === 'rgb(200, 0, 0)') ? true : 'its colour is ' + short(m.base.color) + ', its container\'s rgb(200, 0, 0)';
}, test.limit.quick);
