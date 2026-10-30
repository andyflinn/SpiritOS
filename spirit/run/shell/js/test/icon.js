'use strict';

// spirit/run/shell/js/test/icon.js
// The tests of shell/js/icon.js, and of no other module (spec: ./icon.md; goal/G41.23). Asked of a real browser, since a
// square that follows the font size is layout: ./icon-sized.html, on a scratch node with its DEBUG on, puts icons in
// containers of several font sizes.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'icon.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function square(b, side) { return !!b && Math.abs(b.w - side) <= 0.5 && Math.abs(b.h - side) <= 0.5; }

const ADDRESS = '/DEBUG/shell/js/test/icon-sized.html';
test.startTest('icon.js: the glyph, centred in a square that follows the font size');

(async function () {
  ok(fs.existsSync(FILE), 'shell/js/icon.js exists', 'there is no shell/js/icon.js');
  test.subHeading(ADDRESS.slice('/DEBUG'.length) + ': icons in containers of several font sizes');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.sized === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.sized()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    ok(m.made, 'it adds icon.create(container, options) to window.spirit.elements', 'no window.spirit.elements.icon.create of a container and options');
    if (!m.made) return;

    test.subHeading('a shell element: appended, the glyph as it is given');
    ok(m.base.answered && m.base.appended, 'create answers an element, appended to the container it is given', 'made: ' + short(m.base));
    // "the glyph IS the glyph, no key-abstraction."
    ok(m.base.text === 'A' && m.key === '🔑', 'it shows the glyph it is given, as it is', 'shows ' + short(m.base.text) + ' and ' + short(m.key));
    // The class it carries is how the shell's other elements are seen to paint through it (workBench's test).
    ok(m.base.className.trim() !== '', 'it carries a class of its own (' + m.base.className + ')', 'it carries no class');

    test.subHeading('a square, its side the font size times size');
    // "a square box, the size of which follows font-size, it's size option should vary from that base-line, be a
    // multiplier of it."
    ok(square(m.base.size, 20), 'in 20 pixel type, no size given: a square of 20', 'it is ' + short(m.base.size));
    ok(square(m.twice, 40), 'size 2: a square of 40', 'it is ' + short(m.twice));
    ok(square(m.half, 10), 'size 0.5: a square of 10', 'it is ' + short(m.half));
    ok(square(m.small, 10), 'in 10 pixel type: a square of 10, the size it inherits', 'it is ' + short(m.small));
    ok(square(m.tight, 20), 'in a row of 5 pixels beside a long label it never shrinks: still 20', 'it is ' + short(m.tight));

    test.subHeading('the glyph centred, the rest its container\'s');
    // "it centers the glyph"; tolerance a tenth of the side, for the font's own glyph metrics.
    const tol = m.centred.side / 10;
    ok(m.centred.dx <= tol && m.centred.dy <= tol, 'the glyph\'s middle is the square\'s middle (off by ' + m.centred.dx + ' and ' + m.centred.dy + ' in ' + m.centred.side + ')',
      'the glyph is off its square\'s middle by ' + m.centred.dx + ' across and ' + m.centred.dy + ' down, in a side of ' + m.centred.side);
    // "no other option than size, like like text characters, it follows, its container in most attributes."
    ok(m.base.color === 'rgb(200, 0, 0)', 'it follows its container like a text character: its colour', 'its colour is ' + short(m.base.color) + ', its container\'s rgb(200, 0, 0)');
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
