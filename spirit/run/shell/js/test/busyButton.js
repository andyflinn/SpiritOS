'use strict';

// spirit/run/shell/js/test/busyButton.js
// The tests of shell/js/busyButton.js, and of no other module (spec: ./busyButton.md; goal/G41.23). Asked of a real
// browser, since a turning icon left of a label is layout and animation: ./busyButton-pressed.html, on a scratch node
// with its DEBUG on, presses busyButtons whose requests it holds, answers, refuses and throws.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'busyButton.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Plain: enabled, no element in it, its label alone.
function plain(l, label) { return !!l && l.disabled === false && l.kids === 0 && l.text === label; }
// Busy: greyed (disabled), a turning icon of shell.css's left of the label, the label still said.
function busy(l, label) { return !!l && l.disabled === true && !!l.spin && l.spin.width > 0 && l.spin.height > 0 && l.label === label && l.labelLeft !== null && l.spin.right <= l.labelLeft + 1 && l.animation !== 'none' && l.shellSheet === true; }

const ADDRESS = '/DEBUG/shell/js/test/busyButton-pressed.html';
test.startTest('busyButton.js: the button that waits for its request');

(async function () {
  ok(fs.existsSync(FILE), 'shell/js/busyButton.js exists', 'there is no shell/js/busyButton.js');
  test.subHeading(ADDRESS.slice('/DEBUG'.length) + ': pressed, held, answered');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.pressed === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.pressed()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    ok(m.made, 'it adds busyButton.create(container, options) and busyButton.attach to window.spirit.elements', 'no window.spirit.elements.busyButton with create(container, options) and attach');
    if (!m.made) return;

    test.subHeading('made, it is a plain button in its container');
    ok(m.create.button && m.create.appended, 'create answers a button of type button, appended to the container it is given', 'made: ' + short(m.create));
    ok(m.create.title === 'ask the provider' && /\bmy-ask\b/.test(m.create.className), 'its title and class are put on it', 'title ' + short(m.create.title) + ', class ' + short(m.create.className));
    ok(plain(m.create.before, 'Ask'), 'before a press it is plain: enabled, its label alone', 'before: ' + short(m.create.before));

    test.subHeading('pressed: greyed, a turning icon left of its label, the request running');
    // Andy, goal/G41.18: "it has an animated icon showing to the left of the buttons label, when the button is waiting".
    ok(m.waiting.runs === 1, 'the press runs the request once', 'ran ' + m.waiting.runs);
    ok(m.waiting.disabled === true, 'it greys out: disabled while it waits', 'disabled: ' + short(m.waiting.disabled));
    ok(!!m.waiting.spin && m.waiting.spin.width > 0 && m.waiting.label === 'Ask' && m.waiting.labelLeft !== null && m.waiting.spin.right <= m.waiting.labelLeft + 1,
      'an icon shows left of its label, and the label is still said', 'waiting: ' + short(m.waiting));
    ok(m.waiting.animation !== 'none' && m.waiting.shellSheet === true, 'the icon turns, by a keyframes rule of shell.css, the one sheet (' + m.waiting.animation + ')',
      'its animation is ' + short(m.waiting.animation) + (m.waiting.animation !== 'none' ? ', no keyframes of that name in /shell.css' : ''));
    ok(m.sheets.after === m.sheets.before && m.sheets.stylesAfter === m.sheets.stylesBefore, 'and the element adds no sheet and no style of its own',
      'sheets ' + m.sheets.before + ' then ' + m.sheets.after + ', style elements ' + m.sheets.stylesBefore + ' then ' + m.sheets.stylesAfter);

    test.subHeading('a second press while it waits does nothing');
    // Andy, goal/G41.23: "busyButton: while it waits, does a second press do nothing, so no request is sent twice?" "yes."
    ok(m.secondPress === 1, 'pressed again while it waits, by a click and by a dispatched event: no request is sent twice', 'ran ' + m.secondPress);

    test.subHeading('answered, it is a plain button again');
    ok(plain(m.answered, 'Ask'), 'the answer come: enabled, no icon, its label', 'answered: ' + short(m.answered));
    ok(m.again === 2, 'and the next press runs it again', 'ran ' + m.again);
    ok(busy(m.refusedWaiting, 'Grant') && plain(m.refused, 'Grant'), 'a refusal (the promise rejects) makes it plain again too', 'waiting ' + short(m.refusedWaiting) + ', refused ' + short(m.refused));
    ok(plain(m.thrown, 'Throw'), 'a request that throws as it is called leaves it plain', 'thrown: ' + short(m.thrown));
    ok(plain(m.atOnce, 'Now'), 'a request that answers no promise leaves it plain', 'at once: ' + short(m.atOnce));
    ok(m.heard.unhandled === 0 && m.heard.errors === 0, 'a refusal and a throw reach no further: nothing unhandled in the page', 'unhandled ' + m.heard.unhandled + ', errors ' + m.heard.errors);

    test.subHeading('attach: a button already in the page');
    ok(m.attach.same, 'attach answers the button it was handed', 'attach answered another');
    ok(busy(m.attach.waiting, 'Reload') && plain(m.attach.answered, 'Reload'), 'pressed it waits as a made one does, its own text the label, then is plain again',
      'waiting ' + short(m.attach.waiting) + ', answered ' + short(m.attach.answered));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
