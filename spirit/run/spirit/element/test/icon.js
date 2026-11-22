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

function square(b, side) { return !!b && Math.abs(b.w - side) <= 0.5 && Math.abs(b.h - side) <= 0.5; }

const ADDRESS = '/DEBUG/spirit/element/test/icon-sized.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let tol;
test.run('spirit/element/icon.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
// The page: icons in containers of several font sizes
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('the page sizes its icons', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.sized === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.sized()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});
test.run('it adds icon, with a create taking a container and options, to window.spirit.required', 0.2, function () {
  if (!m) return false;
  return (m.made) ? true : false;
}, test.limit.quick);
test.run('create answers an element, appended to the container it is given', 0.2, function () {
  if (!m) return false;
  // a shell element: appended, the glyph as it is given
  return (m.base.answered && m.base.appended) ? true : false;
}, test.limit.quick);
test.run('it shows the glyph it is given, as it is', 0.2, function () {
  if (!m) return false;
  // "the glyph IS the glyph, no key-abstraction."
  return (m.base.text === 'A' && m.key === '🔑') ? true : false;
}, test.limit.quick);
test.run('it carries a class of its own', 0.2, function () {
  if (!m) return false;
  // The class it carries is how the shell's other elements are seen to paint through it (workBench's test).
  return (m.base.className.trim() !== '') ? true : false;
}, test.limit.quick);
test.run('in 20 pixel type with no size given, it is a square of 20', 0.2, function () {
  if (!m) return false;
  // a square, its side the font size times size
  // "a square box, the size of which follows font-size, it's size option should vary from that base-line, be a
  // multiplier of it."
  return (square(m.base.size, 20)) ? true : false;
}, test.limit.quick);
test.run('with size 2 it is a square of 40', 0.2, function () {
  if (!m) return false;
  return (square(m.twice, 40)) ? true : false;
}, test.limit.quick);
test.run('with size 0.5 it is a square of 10', 0.2, function () {
  if (!m) return false;
  return (square(m.half, 10)) ? true : false;
}, test.limit.quick);
test.run('in 10 pixel type it is a square of 10, the size it inherits', 0.2, function () {
  if (!m) return false;
  return (square(m.small, 10)) ? true : false;
}, test.limit.quick);
test.run('in a row of 5 pixels beside a long label it never shrinks, and stays 20', 0.2, function () {
  if (!m) return false;
  return (square(m.tight, 20)) ? true : false;
}, test.limit.quick);
test.run('the glyph\'s middle is the square\'s middle, within a tenth of its side', 0.2, function () {
  if (!m) return false;
  // the glyph centred, the rest its container's
  // "it centers the glyph"; tolerance a tenth of the side, for the font's own glyph metrics.
  tol = m.centred.side / 10;
  return (m.centred.dx <= tol && m.centred.dy <= tol) ? true : false;
}, test.limit.quick);
test.run("a glyph wider than its square is drawn smaller, inside the square, and still says the glyph", 0.2, function () {
  if (!m || !m.fit) return false;
  // Q22, Andy: "how about proportionally scale-to-fit?"
  return (square({ w: m.fit.side, h: m.fit.side }, 20) && m.fit.ink <= m.fit.side + 0.5 && m.fit.ink > m.fit.side / 2 && m.fit.inside && m.fit.text === 'WWWW') ? true : false;
}, test.limit.quick);
test.run("a glyph that fits its square is drawn as it is", 0.2, function () {
  if (!m || !m.fit) return false;
  return m.fit.narrowWhole ? true : false;
}, test.limit.quick);
test.run("the square keeps what it holds inside", 0.2, function () {
  if (!m || !m.fit) return false;
  return m.fit.overflow === 'hidden hidden' ? true : false;
}, test.limit.quick);
test.run("its glyphs are measured unseen: nothing of the measuring is put in the page", 0.2, function () {
  if (!m || m.strays === undefined) return false;
  // Andy: "can the drawing not happen in a hidden (maybe global) screen for measurement?"
  return m.strays === 0 ? true : false;
}, test.limit.quick);
test.run("800 icons of 800 glyphs it had not seen are drawn in under 300 ms, so a list of them never stalls its page", 0.2, function () {
  if (!m || m.manyMs === undefined) return false;
  // The icon list draws some 800; measured in a hidden box in the page, every new glyph laid the page out again, and its page hung.
  return m.manyMs < 300 ? true : false;
}, test.limit.quick);
test.run('it follows its container\'s colour like a text character', 0.2, function () {
  if (!m) return false;
  // "no other option than size, like like text characters, it follows, its container in most attributes."
  return (m.base.color === 'rgb(200, 0, 0)') ? true : false;
}, test.limit.quick);
