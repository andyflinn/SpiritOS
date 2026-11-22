'use strict';

// spirit/run/spirit/app/agent/element/test/chatPane.js
// The tests of spirit/app/agent/element/chatPane.js, and of no other module (spec: ./chatPane.md; goal/G41.26). Asked of a real
// browser, since a title pinned to the top, an input row pinned to the bottom and a log filling between are layout:
// ./chatPane-laid.html, on a scratch node with its DEBUG on, puts the chat pane in a centre of a stated size.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'chatPane.js');

const near = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 2; };

const ADDRESS = '/DEBUG/spirit/app/agent/element/test/chatPane-laid.html';
// What the tests make, for the tests after them.
const X = { node: null, page: null, m: null };
test.after(function () {
  const page = X.page, node = X.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});

test.run('spirit/app/agent/element/chatPane.js exists', 0.2, function () {
  return fs.existsSync(FILE) ? true : false;
}, test.limit.quick);
// Andy, box: "NO component from \"desk\" will be used."
test.run('chatPane.js uses no component of the desk: its code names none', 0.2, function () {
  const code = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') : '';
  return fs.existsSync(FILE) && !/desk/i.test(code) ? true : false;
}, test.limit.quick);

// ── /spirit/app/agent/element/test/chatPane-laid.html: the chat pane in a centre of 500 by 400 ──
test.run('a scratch node comes up with its DEBUG on, and chatPane-laid.html is measured in Chrome', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return false;
  const node = X.node = await H.scratchNode();
  if (!node.up || !node.debug) return false;
  const page = X.page = await H.chromePage(chrome);
  if (page.error) return false;
  await page.send('Page.navigate', { url: node.base + ADDRESS });
  await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await page.evaluate('window.laid()').catch(function () { return ''; });
  let m = null;
  try { m = JSON.parse(s); } catch (e) { m = null; }
  X.m = m;
  return m ? true : false;
// A scratch node comes up inside this one: the long limit, as every world that boots one has (it hung at the slow one).
}, test.limit.long);
test.run('chatPane.js adds chatPane.create, taking a container and a persona, at window.spirit.required.spirit.app.agent.element.chatPane', 0.2, function () {
  if (!X.m) return false;
  return X.m.made ? true : false;
}, test.limit.quick);
test.run('create answers the pane, drawn into the container it is given', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.answered && m.appended ? true : false;
}, test.limit.quick);

// ── its title, pinned to the top ──
// "titled: \"💬 Chat with <selected-persona-label>\". The title is pinned to the top of the center pane."
// The title row sets its icon apart from its words by its own gap, as every pane title does, so a space there is not asked.
test.run('the pane\'s title is 💬 Chat with, followed by the persona\'s label', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.titleText.replace(/^💬\s*/, '💬 ') === '💬 Chat with Ada <the reviewer>' ? true : false;
}, test.limit.quick);
test.run('the persona\'s label is escaped in the title', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return (/Ada &lt;the reviewer&gt;/).test(m.titleHtml) ? true : false;
}, test.limit.quick);
test.run('the title is at the top of the centre', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return !!m.title && near(m.title.top, m.centre.top) ? true : false;
}, test.limit.quick);
// Andy, on G41.26: "the title row in the chat panel (center or workBench) must have the same font size as all other
// pane-titles in the agent UI".
test.run('the page draws a pane title of the agent tables to measure against', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.paneTitleSize ? true : false;
}, test.limit.quick);
test.run('the pane\'s title has the font size of every other pane title of the agent UI', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return !!m.titleSize && m.titleSize === m.paneTitleSize ? true : false;
}, test.limit.quick);

// ── its input row, pinned to the bottom ──
// "pinned to the bottom or that pane is a input block, which contains, for now a chat input line ... and a send
// button on the right edge of that row."
test.run('the input row is at the bottom of the centre', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return !!m.row && near(m.row.bottom, m.centre.bottom) ? true : false;
}, test.limit.quick);
test.run('the Send button is at the row\'s right edge, with the input line left of it', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return !!m.send && !!m.row && near(m.send.right, m.row.right) && !!m.input && m.input.right <= m.send.left + 1 ? true : false;
}, test.limit.quick);

// ── the log fills the space between, and scrolls ──
// "the space between the Title row and the Chat input row is filled by an upward scrolling chat log."
test.run('the log fills from below the title to above the input row', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return !!m.log && !!m.title && !!m.row && near(m.log.top, m.title.bottom) && near(m.log.bottom, m.row.top) && m.log.h > 0 ? true : false;
}, test.limit.quick);
test.run('the log scrolls in itself', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return (/^(auto|scroll)$/).test(m.logOverflow) ? true : false;
}, test.limit.quick);

// ── Enter and Shift+Enter ──
// "which sends when Enter is pressed, and adds \"\n\" when SHIFT.Enter is pressed". How the chat works is out of
// scope ("how the chat will work, is oos for this item"): Enter is the send, so its newline is held back.
test.run('the input line is a textarea, so it takes a newline', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.multiLine ? true : false;
}, test.limit.quick);
test.run('Enter is held back from the line, because it is the send', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.enterHeld === true ? true : false;
}, test.limit.quick);
test.run('Shift+Enter is left to the line, which adds the newline', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return false;
  return m.shiftHeld === false ? true : false;
}, test.limit.quick);
