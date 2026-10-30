'use strict';

// spirit/run/shell/js/appHeader/test/appHeader.js
// The tests of shell/js/appHeader/appHeader.js, and of no other module (spec: ./appHeader.md; goal/G41.22): where an
// app's header area sits in a real browser. ./appHeader-pinned.html, on a scratch node with its DEBUG on, puts one in
// the home page's app area over 3000 pixels of content.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

const ADDRESS = '/DEBUG/shell/js/appHeader/test/appHeader-pinned.html';
test.startTest('appHeader.js: an app\'s header area sits right under the title bar, and stays there');

(async function () {
  test.subHeading(ADDRESS.slice('/DEBUG'.length) + ': a row of buttons over 3000 pixels of content');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.pinned === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.pinned()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m) { test.fail('the page measured nothing: ' + String(s).slice(0, 200)); return; }
    // RIGHT UNDER THE TITLE BAR (Andy: "a giant gap between the shells title bar and it's first row of buttons"): the
    // header is the first thing in its app's pane, at the pane's top, which starts under the title bar.
    ok(m.paneTop >= m.titleBar && Math.abs(m.head.top - m.paneTop) <= 1, 'the header sits at the top of its app\'s pane, right under the title bar (' + m.head.top + ', the pane at ' + m.paneTop + ')',
      'the header is at ' + m.head.top + ', its pane starts at ' + m.paneTop + ', the title bar ends at ' + m.titleBar + ': a gap of ' + (m.head.top - m.paneTop));
    ok(m.content >= m.head.bottom - 1, 'nothing under it is overlapped: the content starts at ' + m.content + ', the header ends at ' + m.head.bottom,
      'the header ends at ' + m.head.bottom + ', over the content starting at ' + m.content);
    // IT STICKS: the pane scrolled, the header is where it was.
    ok(m.scrolled > 0 && Math.abs(m.headAfterScroll - m.paneTop) <= 1, 'the pane scrolled by ' + m.scrolled + ', the header stays at its top',
      'after the pane scrolled by ' + m.scrolled + ' the header is at ' + m.headAfterScroll + ', the pane at ' + m.paneTop);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
