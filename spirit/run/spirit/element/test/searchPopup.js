'use strict';

// spirit/run/spirit/element/test/searchPopup.js
// THE DROPDOWN'S LIST FLOATS (goal/G43.18; spec: ./searchPopup.md). Andy: "is it possible to have a "popup" element, which
// floats it's contents above all windows, but only one in the whole browser window can be active? only bound by the window
// size but not neccessarily filling it? all dropdown panels should be part of that", then "and the actual dropdown control
// stays where it is? just the popped list would "float"? then do that for the lists in the search-dropdown please." Real
// clicks and keys in a real Chrome on a scratch node's face page: two search dropdowns, each in a small box that cuts off
// what overflows it, as a row of a panel does, and a third low in the window. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('searchPopup.js: a search dropdown\'s list floats above everything, one at a time (goal/G43.18)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    // Each box cuts off what overflows it (overflow hidden), and stands under a sibling drawn later on the same spot's level.
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search.js"); }).then(function () { ' +
      'var rows = []; for (var i = 0; i < 40; i++) rows.push({ key: "r" + i, name: "row " + i }); window.__z = {}; ' +
      '[["a", 40, 100], ["b", 500, 100], ["low", 40, window.innerHeight - 70]].forEach(function (x) { var b = document.createElement("div"); b.id = "zz-" + x[0]; ' +
      'b.style.cssText = "position:absolute;left:" + x[1] + "px;top:" + x[2] + "px;width:320px;height:48px;overflow:hidden;border:1px solid"; document.body.appendChild(b); ' +
      'spirit.element.search.create(b, { face: "dropdown", rows: function () { return rows; }, columns: [{ field: "name", label: "Name" }], name: function (r) { return r.name; }, pick: function () {} }); ' +
      'window.__z[x[0]] = { box: b, list: b.querySelector("[id$=list]"), field: b.querySelector("[id$=field]") }; }); ' +
      'var cover = document.createElement("div"); cover.id = "zz-cover"; cover.style.cssText = "position:absolute;left:0;top:160px;width:900px;height:200px;background:#333;z-index:20"; document.body.appendChild(cover); ' +
      'return Object.keys(window.__z).every(function (k) { return !!window.__z[k].list && !!window.__z[k].field; }) ? "made" : "no list or field"; }, function (e) { return String(e); })');
    ok(made === 'made', 'the world: three search dropdowns of 40 rows, each in a 48 px box that cuts off its overflow, and a block drawn over the space below the first two', 'nothing made: ' + short(made));
    if (made !== 'made') return;
    await sleep(800);

    // What one dropdown shows: where its field is, whether its list is open, where it lies, and whether it is what is seen there.
    const look = function (k) {
      return chrome.evaluate('(function () { var z = window.__z[' + JSON.stringify(k) + ']; var f = z.field.getBoundingClientRect(); var l = z.list.getBoundingClientRect(); var b = z.box.getBoundingClientRect(); ' +
        'var open = l.height > 0 && getComputedStyle(z.list).visibility !== "hidden"; var x = Math.round(l.left + Math.min(l.width / 2, 60)), y = Math.round(Math.min(l.bottom - 4, Math.max(l.top + 4, b.bottom + 40))); ' +
        'var hit = open ? document.elementFromPoint(x, y) : null; ' +
        'return JSON.stringify({ field: [Math.round(f.left), Math.round(f.top)], fieldInBox: f.top >= b.top - 1 && f.bottom <= b.bottom + 1, open: open, list: [Math.round(l.left), Math.round(l.top), Math.round(l.right), Math.round(l.bottom)], ' +
        'below: l.bottom > b.bottom + 20, seen: !!hit && z.list.contains(hit), inWindow: l.top >= 0 && l.left >= 0 && l.bottom <= window.innerHeight && l.right <= window.innerWidth, fills: l.height >= window.innerHeight - 2 && l.width >= window.innerWidth - 2 }); }())').then(JSON.parse);
    };
    const press = function (k) { return chrome.evaluate('window.__z[' + JSON.stringify(k) + '].field.click(); true').then(function () { return sleep(600); }); };
    const key = async function (k, code) {
      await chrome.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code });
      await chrome.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
      await sleep(400);
    };

    test.subHeading('Andy: "the actual dropdown control stays where it is", "just the popped list would float"');
    const a0 = await look('a');
    await press('a');
    const a1 = await look('a');
    ok(a1.open, 'the world: pressed, the first dropdown\'s list opens', 'the list did not open: ' + short(a1));
    ok(a1.fieldInBox && a1.field[0] === a0.field[0] && a1.field[1] === a0.field[1], 'its field stays where it was, in its box', 'the field moved: ' + short(a0.field) + ' to ' + short(a1.field));
    ok(a1.open && a1.below && a1.seen, '"floats it\'s contents above all windows": the list reaches past its box, over the block drawn on top, and is what is seen there', 'the list: ' + short(a1));
    ok(a1.open && a1.inWindow && !a1.fills, '"only bound by the window size but not neccessarily filling it"', 'the list: ' + short(a1));

    test.subHeading('Andy: "only one in the whole browser window can be active"');
    await press('b');
    const b1 = await look('b');
    const a2 = await look('a');
    ok(b1.open && b1.seen, 'the second dropdown pressed: its list opens, seen', 'the second list: ' + short(b1));
    ok(b1.open && !a2.open, 'and the first one\'s list is closed', 'the first list is still open: ' + short(a2));
    await key('Escape', 27);
    ok(!(await look('b')).open, 'Escape closes it', 'after Escape: ' + short(await look('b')));
    await press('a');
    await chrome.evaluate('(function () { var e = document.elementFromPoint(window.innerWidth - 5, 5) || document.body; e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); e.click(); }()); true');
    await sleep(500);
    ok(!(await look('a')).open, 'a press outside closes it', 'after a press outside: ' + short(await look('a')));

    test.subHeading('low in the window, its list still inside the window');
    await press('low');
    const l1 = await look('low');
    ok(l1.open && l1.inWindow && l1.seen, 'a dropdown low in the window opens its list inside the window, seen', 'the low list: ' + short(l1));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
