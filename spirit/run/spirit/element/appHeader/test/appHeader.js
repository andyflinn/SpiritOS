'use strict';

// spirit/run/spirit/element/appHeader/test/appHeader.js
// The tests of spirit/element/appHeader/appHeader.js, and of no other module (spec: ./appHeader.md; goal/G41.22): where an
// app's header area sits in a real browser. ./appHeader-pinned.html, on a scratch node with its DEBUG on, puts one in
// the home page's app area over 3000 pixels of content.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const ADDRESS = '/DEBUG/spirit/element/appHeader/test/appHeader-pinned.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured.
const W = {};

// appHeader-pinned.html: a row of buttons over 3000 pixels of content.
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, 1000);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, 7000);
test.run('the world: the page measures its header', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.pinned === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.pinned()').catch(function () { return ''; });
  try { W.m = JSON.parse(s); } catch (e) { W.m = null; }
  return !!W.m || 'the page measured nothing: ' + String(s).slice(0, 200);
}, 5000);
// RIGHT UNDER THE TITLE BAR (Andy: "a giant gap between the shells title bar and it's first row of buttons"): the
// header is the first thing in its app's pane, at the pane's top, which starts under the title bar.
test.run('the header sits at the top of its app\'s pane, right under the title bar', 0.2, function () {
  const m = W.m;
  if (!m) return 'nothing measured: the world failed';
  return (m.paneTop >= m.titleBar && Math.abs(m.head.top - m.paneTop) <= 1) ||
    'the header is at ' + m.head.top + ', its pane starts at ' + m.paneTop + ', the title bar ends at ' + m.titleBar + ': a gap of ' + (m.head.top - m.paneTop);
}, 1000);
test.run('nothing under it is overlapped: the content starts below the header', 0.2, function () {
  const m = W.m;
  if (!m) return 'nothing measured: the world failed';
  return m.content >= m.head.bottom - 1 || 'the header ends at ' + m.head.bottom + ', over the content starting at ' + m.content;
}, 1000);
// IT STICKS: the pane scrolled, the header is where it was.
test.run('the pane scrolled, the header stays at its top', 0.2, function () {
  const m = W.m;
  if (!m) return 'nothing measured: the world failed';
  return (m.scrolled > 0 && Math.abs(m.headAfterScroll - m.paneTop) <= 1) ||
    'after the pane scrolled by ' + m.scrolled + ' the header is at ' + m.headAfterScroll + ', the pane at ' + m.paneTop;
}, 1000);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
