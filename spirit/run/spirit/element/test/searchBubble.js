'use strict';

// spirit/run/spirit/element/test/searchBubble.js
// The tests of spirit/element/search.js in a real browser, its bubble's rows laid out (spec:
// ./searchBubble.md; goal/G41.26). Its other tests run in node: ./search.js. Here
// ./searchBubble-laid.html, on a scratch node with its DEBUG on, draws a pane and a dropdown with a filter.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const same = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.5; };

const ADDRESS = '/DEBUG/spirit/element/test/searchBubble-laid.html';
test.startTest('probabilitySearch.js in a browser: the bubble\'s rows aligned');

(async function () {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.laid()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m || !m.made) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    // Andy, on G41.26: "why do the icons in the probabilitySearch row have different width's? do they not use the icon
    // element? I'd like it, if the controls in the search bubble look better aligned."
    [['a pane', m.pane], ['a dropdown', m.dropdown]].forEach(function (x) {
      test.subHeading(x[0]);
      const r = x[1] || {};
      ok(/\bshell-icon\b/.test(r.filterIconClass) && /\bshell-icon\b/.test(r.searchIconClass), 'its 🗜 and 🔎 are the icon element (spirit/element/icon.js)', 'classes: ' + short([r.filterIconClass, r.searchIconClass]));
      // The icon element is a square of 1em whatever its glyph, so no glyph's own width moves what follows it: here a
      // bare glyph is 20px wide at 16px, where a browser on another machine draws each glyph its own width.
      ok(!!r.filterIcon && !!r.searchIcon && same(r.filterIcon.w, r.filterIconSize) && same(r.searchIcon.w, r.searchIconSize), 'each icon is a square of its font size, whatever its glyph', 'icons: ' + short([r.filterIcon, r.filterIconSize, r.searchIcon, r.searchIconSize]));
      ok(!!r.filterIcon && !!r.searchIcon && same(r.filterIcon.w, r.searchIcon.w) && same(r.filterIcon.left, r.searchIcon.left), 'the two icons are as wide and stand one under the other', 'icons: ' + short([r.filterIcon, r.searchIcon]));
      // And the 🪣 row of selectors on top (goal/G41.26: "the selectorRow must start with a\n🪣icon").
      ok(/\bshell-icon\b/.test(r.bucketIconClass) && !!r.bucketIcon && same(r.bucketIcon.w, r.bucketIconSize) && !!r.filterIcon && same(r.bucketIcon.left, r.filterIcon.left),
        'its 🪣 is the icon element too, a square of its font size, over the 🗜', 'bucket: ' + short([r.bucketIconClass, r.bucketIcon, r.bucketIconSize]));
      ok(!!r.firstSelector && !!r.input && same(r.firstSelector.left, r.input.left), 'the first selector starts where the search input does', 'first selector ' + short(r.firstSelector) + ', input ' + short(r.input));
      ok(!!r.firstFilter && !!r.input && same(r.firstFilter.left, r.input.left), 'each row\'s first control starts at the same place: the first filter over the search input', 'first filter ' + short(r.firstFilter) + ', input ' + short(r.input));
    });
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
