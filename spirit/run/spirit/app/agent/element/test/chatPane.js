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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const near = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 2; };

const ADDRESS = '/DEBUG/spirit/app/agent/element/test/chatPane-laid.html';
// What the tests make, for the tests after them.
const X = { node: null, page: null, m: null };
const NO_MEASURE = 'the page measured nothing: the world failed';
const NOT_MADE = 'no chat pane was made';
test.after(function () {
  const page = X.page, node = X.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});

test.run('spirit/app/agent/element/chatPane.js exists', 0.2, function () {
  return fs.existsSync(FILE) ? true : 'there is no spirit/app/agent/element/chatPane.js';
}, test.limit.quick);
// Andy, box: "NO component from \"desk\" will be used."
test.run('it uses no component of the desk: its code names none', 0.2, function () {
  const code = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') : '';
  return fs.existsSync(FILE) && !/desk/i.test(code) ? true : 'chatPane.js names the desk';
}, test.limit.quick);

// ── /spirit/app/agent/element/test/chatPane-laid.html: the chat pane in a centre of 500 by 400 ──
test.run('the world: a scratch node with its DEBUG on, ./chatPane-laid.html measured in Chrome', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  const node = X.node = await H.scratchNode();
  if (!node.up || !node.debug) return 'the scratch node did not come up with its DEBUG on';
  const page = X.page = await H.chromePage(chrome);
  if (page.error) return page.error;
  await page.send('Page.navigate', { url: node.base + ADDRESS });
  await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await page.evaluate('window.laid()').catch(function () { return ''; });
  let m = null;
  try { m = JSON.parse(s); } catch (e) { m = null; }
  X.m = m;
  return m ? true : 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
// A scratch node comes up inside this one: the long limit, as every world that boots one has (it hung at the slow one).
}, test.limit.long);
test.run('it adds chatPane.create(container, { persona }) at window.spirit.element.spirit.app.agent.element.chatPane', 0.2, function () {
  if (!X.m) return NO_MEASURE;
  return X.m.made ? true : 'no window.spirit.element.spirit.app.agent.element.chatPane.create';
}, test.limit.quick);
test.run('create answers the pane, drawn into the container it is given (goal/G41.19)', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.answered && m.appended ? true : 'made: ' + short({ answered: m.answered, appended: m.appended });
}, test.limit.quick);

// ── its title, pinned to the top ──
// "titled: \"💬 Chat with <selected-persona-label>\". The title is pinned to the top of the center pane."
// The title row sets its icon apart from its words by its own gap, as every pane title does, so a space there is not asked.
test.run('its title is 💬 Chat with <the persona\'s label>', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.titleText.replace(/^💬\s*/, '💬 ') === '💬 Chat with Ada <the reviewer>' ? true : 'title: ' + short(m.titleText);
}, test.limit.quick);
test.run('the label escaped', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return (/Ada &lt;the reviewer&gt;/).test(m.titleHtml) ? true : 'title: ' + short(m.titleHtml);
}, test.limit.quick);
test.run('the title is at the top of the centre', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return !!m.title && near(m.title.top, m.centre.top) ? true : 'title ' + short(m.title) + ', centre ' + short(m.centre);
}, test.limit.quick);
// Andy, on G41.26: "the title row in the chat panel (center or workBench) must have the same font size as all other
// pane-titles in the agent UI".
test.run('the page draws a pane title of the agent tables to measure against', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.paneTitleSize ? true : 'no agentDetail.titleRow on the page';
}, test.limit.quick);
test.run('its title has the font size of every other pane title of the agent UI', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return !!m.titleSize && m.titleSize === m.paneTitleSize ? true : 'chat title ' + short(m.titleSize) + ', pane title ' + short(m.paneTitleSize);
}, test.limit.quick);

// ── its input row, pinned to the bottom ──
// "pinned to the bottom or that pane is a input block, which contains, for now a chat input line ... and a send
// button on the right edge of that row."
test.run('the input row is at the bottom of the centre', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return !!m.row && near(m.row.bottom, m.centre.bottom) ? true : 'row ' + short(m.row) + ', centre ' + short(m.centre);
}, test.limit.quick);
test.run('its Send button is at the row\'s right edge, the input line left of it', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return !!m.send && !!m.row && near(m.send.right, m.row.right) && !!m.input && m.input.right <= m.send.left + 1 ? true : 'input ' + short(m.input) + ', send ' + short(m.send) + ', row ' + short(m.row);
}, test.limit.quick);

// ── the log fills the space between, and scrolls ──
// "the space between the Title row and the Chat input row is filled by an upward scrolling chat log."
test.run('the log fills from below the title to above the input row', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return !!m.log && !!m.title && !!m.row && near(m.log.top, m.title.bottom) && near(m.log.bottom, m.row.top) && m.log.h > 0 ? true : 'log ' + short(m.log) + ', title ' + short(m.title) + ', row ' + short(m.row);
}, test.limit.quick);
test.run('and scrolls in itself', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return (/^(auto|scroll)$/).test(m.logOverflow) ? true : 'its overflow-y is ' + short(m.logOverflow);
}, test.limit.quick);

// ── Enter and Shift+Enter ──
// "which sends when Enter is pressed, and adds \"\n\" when SHIFT.Enter is pressed". How the chat works is out of
// scope ("how the chat will work, is oos for this item"): Enter is the send, so its newline is held back.
test.run('the input line takes a newline: a textarea', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.multiLine ? true : 'it is ' + short(m.inputTag);
}, test.limit.quick);
test.run('Enter is held back from the line: it is the send', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.enterHeld === true ? true : 'Enter went into the line';
}, test.limit.quick);
test.run('Shift+Enter is left to the line, which adds the newline', 0.2, function () {
  const m = X.m;
  if (!m || !m.made) return NOT_MADE;
  return m.shiftHeld === false ? true : 'Shift+Enter was held back';
}, test.limit.quick);
