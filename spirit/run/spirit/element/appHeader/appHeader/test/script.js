'use strict';

// spirit/run/spirit/element/appHeader/appHeader/test/script.js
// The tests of spirit/element/appHeader/appHeader/script.js, and of no other module (spec: ./script.md; goal/G41.22): where an
// app's header area sits in a real browser. ./appHeader-pinned.html, on a scratch node with its DEBUG on, puts one in
// the home page's app area over 3000 pixels of content.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');

const ADDRESS = '/DEBUG/spirit/element/appHeader/appHeader/test/appHeader-pinned.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured.
const W = {};

// appHeader-pinned.html: a row of buttons over 3000 pixels of content.
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('the page measures its header', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.pinned === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.pinned()').catch(function () { return ''; });
  try { W.m = JSON.parse(s); } catch (e) { W.m = null; }
  return !!W.m || false;
}, test.limit.slow);
// RIGHT UNDER THE TITLE BAR (Andy: "a giant gap between the shells title bar and it's first row of buttons"): the
// header is the first thing in its app's pane, at the pane's top, which starts under the title bar.
test.run('the header sits at the top of its app\'s pane, right under the title bar', 0.2, function () {
  const m = W.m;
  if (!m) return false;
  return (m.paneTop >= m.titleBar && Math.abs(m.head.top - m.paneTop) <= 1) || false;
}, test.limit.quick);
test.run('the header overlaps nothing under it: the content starts below the header', 0.2, function () {
  const m = W.m;
  if (!m) return false;
  return m.content >= m.head.bottom - 1 || false;
}, test.limit.quick);
// IT STICKS: the pane scrolled, the header is where it was.
test.run('when the pane is scrolled, the header stays at its top', 0.2, function () {
  const m = W.m;
  if (!m) return false;
  return (m.scrolled > 0 && Math.abs(m.headAfterScroll - m.paneTop) <= 1) || false;
}, test.limit.quick);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(W.node); } catch (e) { /* left */ }
});
