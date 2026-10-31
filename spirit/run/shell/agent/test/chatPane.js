'use strict';

// spirit/run/shell/agent/test/chatPane.js
// The tests of shell/agent/chatPane.js, and of no other module (spec: ./chatPane.md; goal/G41.26). Asked of a real
// browser, since a title pinned to the top, an input row pinned to the bottom and a log filling between are layout:
// ./chatPane-laid.html, on a scratch node with its DEBUG on, puts the chat pane in a centre of a stated size.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'chatPane.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const near = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 2; };

const ADDRESS = '/DEBUG/shell/agent/test/chatPane-laid.html';
test.startTest('chatPane.js: the chat with a persona, in the centre');

(async function () {
  ok(fs.existsSync(FILE), 'shell/agent/chatPane.js exists', 'there is no shell/agent/chatPane.js');
  // Andy, box: "NO component from \"desk\" will be used."
  const code = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') : '';
  ok(fs.existsSync(FILE) && !/desk/i.test(code), 'it uses no component of the desk: its code names none', 'chatPane.js names the desk');
  test.subHeading(ADDRESS.slice('/DEBUG'.length) + ': the chat pane in a centre of 500 by 400');
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
    if (!m) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    ok(m.made, 'it adds chatPane.create(container, { persona }) to window.spirit.elements', 'no window.spirit.elements.chatPane.create');
    if (!m.made) return;
    ok(m.answered && m.appended, 'create answers the pane, drawn into the container it is given (goal/G41.19)', 'made: ' + short({ answered: m.answered, appended: m.appended }));

    test.subHeading('its title, pinned to the top');
    // "titled: \"💬 Chat with <selected-persona-label>\". The title is pinned to the top of the center pane."
    ok(m.titleText === '💬 Chat with Ada <the reviewer>', 'its title is 💬 Chat with <the persona\'s label>', 'title: ' + short(m.titleText));
    ok(/Ada &lt;the reviewer&gt;/.test(m.titleHtml), 'the label escaped', 'title: ' + short(m.titleHtml));
    ok(!!m.title && near(m.title.top, m.centre.top), 'the title is at the top of the centre', 'title ' + short(m.title) + ', centre ' + short(m.centre));

    test.subHeading('its input row, pinned to the bottom');
    // "pinned to the bottom or that pane is a input block, which contains, for now a chat input line ... and a send
    // button on the right edge of that row."
    ok(!!m.row && near(m.row.bottom, m.centre.bottom), 'the input row is at the bottom of the centre', 'row ' + short(m.row) + ', centre ' + short(m.centre));
    ok(!!m.send && !!m.row && near(m.send.right, m.row.right) && !!m.input && m.input.right <= m.send.left + 1, 'its Send button is at the row\'s right edge, the input line left of it', 'input ' + short(m.input) + ', send ' + short(m.send) + ', row ' + short(m.row));

    test.subHeading('the log fills the space between, and scrolls');
    // "the space between the Title row and the Chat input row is filled by an upward scrolling chat log."
    ok(!!m.log && !!m.title && !!m.row && near(m.log.top, m.title.bottom) && near(m.log.bottom, m.row.top) && m.log.h > 0, 'the log fills from below the title to above the input row', 'log ' + short(m.log) + ', title ' + short(m.title) + ', row ' + short(m.row));
    ok(/^(auto|scroll)$/.test(m.logOverflow), 'and scrolls in itself', 'its overflow-y is ' + short(m.logOverflow));

    test.subHeading('Enter and Shift+Enter');
    // "which sends when Enter is pressed, and adds \"\n\" when SHIFT.Enter is pressed". How the chat works is out of
    // scope ("how the chat will work, is oos for this item"): Enter is the send, so its newline is held back.
    ok(m.multiLine, 'the input line takes a newline: a textarea', 'it is ' + short(m.inputTag));
    ok(m.enterHeld === true, 'Enter is held back from the line: it is the send', 'Enter went into the line');
    ok(m.shiftHeld === false, 'Shift+Enter is left to the line, which adds the newline', 'Shift+Enter was held back');
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
