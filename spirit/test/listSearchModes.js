'use strict';

// spirit/test/listSearchModes.js
// goal/G29.9: THE SHARED LIST'S TWO MODES, AND WHAT EVERY LIST GETS FROM IT. Red on today's tree; claude-windows writes
// it and builds it. The item's box (v8), WHAT IS NEW, in short:
//   - Two modes, pane and dropdown: rows 1 (filters) and 2 (search) always stand; row 3, the list, is a pane below them
//     or a dropdown that opens under the search row when the box is focused or typed into, and closes on a pick or a
//     click outside; in dropdown mode the chosen row's name stands in the box while closed.
//   - Two tiers: rows the page already holds (a function answering them), ranked in the page and never asking the
//     server; and the optional server hook, its rows joining the same cache.
//   - A press: in dropdown mode a pick; in pane mode the optional details(row) hook; with no hook, a pick.
//   - Keys: up and down move the current row, home and end to the top or bottom, enter presses it, escape closes an
//     open dropdown; in the search box home and end stay the text cursor's.
//   - The current row drawn by the list, the same everywhere: a slightly brighter background across the row.
//   - The matched parts marked: paint is handed a mark(text) that wraps each matched word.
//   - contactSelector drops its own dropdown and its bold name and passes the mode.
// Andy, on the goal: "we'll just have to place common feature into this element where it makes sense, so we get a
// uniform look-and-feel for the UI."
// rule/11: through testSupport only. No node: a fake page and, where asked, a fake api.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.9: ';
const RUN = path.join(__dirname, '..', 'run');
const FILE = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const short = function (x) { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > 300 ? s.slice(0, 300) + '…' : s; };

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    getAttribute: function () { return null; }, setAttribute: function () {}, appendChild: function () {}, focus: function () {},
    contains: function (t) { return !!(t && t.inside); },
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function page() {
  const byId = {};
  const docListeners = {};
  const doc = {
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: function () { return fakeElement(''); }, body: fakeElement('body'),
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    fire: function (t, e) { (docListeners[t] || []).forEach(function (fn) { fn(e); }); },
  };
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(FILE, 'utf8'))(doc, win);
  return { byId: byId, doc: doc, win: win };
}
function parts(p, box) {
  const ids = (box.innerHTML.match(/id="([^"]+)"/g) || []).map(function (s) { return s.slice(4, -1); });
  const find = function (re) { const id = ids.filter(function (i) { return re.test(i); })[0]; return id ? p.doc.getElementById(id) : null; };
  return { text: find(/text$/), list: find(/list$/), filters: find(/filters$/) };
}
const rowKeys = function (el) { return ((el && el.innerHTML) || '').match(/data-key="[^"]+"/g) || []; };
const ROWS = [
  { key: 'a', name: 'alpha gate' },
  { key: 'b', name: 'beta door' },
  { key: 'c', name: 'gamma gate' },
];
const fire = function (box, type, el, extra) { box.fire(type, Object.assign({ target: { id: el ? el.id : '', getAttribute: function () { return null; } } }, extra || {})); };
const press = function (box, key) { box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-key' ? key : null; }, closest: function () { return null; } } }); };

test.startTest('goal/G29.9: the shared list\'s two modes, and what every list gets from it');

(async function main() {
  const p = page();
  const make = p.win.spiritElements && p.win.spiritElements.shellCreateListSearch;
  if (typeof make !== 'function') { test.fail(OWED + 'no shellCreateListSearch'); test.reportSuccessFailureCount(); process.exit(0); }

  test.subHeading('1. two tiers: rows the page holds, ranked in the page, the server never asked');
  const marks = [];
  const box = fakeElement('pane1');
  const details = [];
  const picks = [];
  const list = make(box, {
    rows: function () { return ROWS; },
    paint: function (row, mark) { marks.push(typeof mark); return '<td>' + (typeof mark === 'function' ? mark(row.name) : row.name) + '</td>'; },
    details: function (row) { details.push(row.key); },
    pick: function (row) { picks.push(row.key); },
  });
  const el = parts(p, box);
  await sleep(20);
  if (rowKeys(el.list).length === 3) test.check('a list with rows() and no server shows the page\'s rows at once');
  else test.fail(OWED + 'rows() gave ' + short(el.list && el.list.innerHTML));
  el.text.value = 'gate';
  fire(box, 'input', el.text);
  const ranked = el.list.innerHTML;
  if (ranked.indexOf('data-key="a"') !== -1 && ranked.indexOf('data-key="b"') > ranked.indexOf('data-key="c"')) test.check('typing ranks the page\'s rows at once: both gates above the door');
  else test.fail(OWED + 'typing gate draws ' + short(ranked));

  test.subHeading('2. the matched parts marked');
  if (marks.indexOf('function') !== -1 && /<mark[^>]*>gate<\/mark>/.test(ranked)) test.check('paint is handed mark(text), which wraps each matched word: <mark>gate</mark>');
  else test.fail(OWED + 'paint got ' + short(marks.slice(-3)) + ', drew ' + short(ranked));

  test.subHeading('3. a press: details in pane mode, a pick in dropdown mode');
  press(box, 'c');
  if (details.join() === 'c' && !picks.length) test.check('in pane mode a press calls details(row)');
  else test.fail(OWED + 'pane press: details ' + short(details) + ', picks ' + short(picks));

  test.subHeading('4. keys and the current row');
  el.text.value = '';
  fire(box, 'input', el.text);
  // AMENDED BY goal/G29.11 (Andy, 2026-10-18: every change of the words snaps the list to its top row): the words just
  // changed, so c is pressed again after them. The press on c makes c the current row; two ups from it reach the top.
  press(box, 'c');
  const pressedCur = ((el.list.innerHTML.match(/<tr[^>]*current[^>]*>/) || [''])[0].match(/data-key="([^"]+)"/) || [])[1];
  fire(box, 'keydown', el.text, { key: 'ArrowUp' });
  fire(box, 'keydown', el.text, { key: 'ArrowUp' });
  const cur = (el.list.innerHTML.match(/<tr[^>]*current[^>]*>/g) || []);
  const curKey = cur.length ? (cur[0].match(/data-key="([^"]+)"/) || [])[1] : '';
  if (pressedCur === 'c' && cur.length === 1 && curKey === 'a' && /background/.test(cur[0])) test.check('a press makes its row current; up twice moves to the first row, drawn with its own background, and only it');
  else test.fail(OWED + 'pressed row current ' + short(pressedCur) + ', after two ups the current rows are ' + short(cur));
  fire(box, 'keydown', { id: 'elsewhere' }, { key: 'End' });
  const endKey = ((el.list.innerHTML.match(/<tr[^>]*current[^>]*>/) || [''])[0].match(/data-key="([^"]+)"/) || [])[1];
  fire(box, 'keydown', el.text, { key: 'Home' });
  const homeInBox = ((el.list.innerHTML.match(/<tr[^>]*current[^>]*>/) || [''])[0].match(/data-key="([^"]+)"/) || [])[1];
  // AMENDED BY goal/G29.8 (Andy, 2026-10-18: "Give home and end to the list, same as up and down arrow keys."): home and
  // end in the search box move the list, typed into or not.
  if (endKey === 'c' && homeInBox === 'a') test.check('end goes to the bottom; home in the search box goes to the top');
  else test.fail('OWED by goal/G29.8: end made ' + short(endKey) + ' current, home in the box ' + short(homeInBox));
  fire(box, 'input', el.text);
  fire(box, 'keydown', el.text, { key: 'End' });
  const endAfterTyping = ((el.list.innerHTML.match(/<tr[^>]*current[^>]*>/) || [''])[0].match(/data-key="([^"]+)"/) || [])[1];
  if (endAfterTyping === 'c') test.check('after typing too, end in the search box goes to the bottom');
  else test.fail('OWED by goal/G29.8: after typing, end in the box made ' + short(endAfterTyping) + ' current');
  // Back to c, where the checks below start.
  fire(box, 'keydown', el.text, { key: 'ArrowDown' });
  fire(box, 'keydown', el.text, { key: 'ArrowDown' });
  fire(box, 'keydown', el.text, { key: 'ArrowUp' });
  fire(box, 'keydown', el.text, { key: 'Enter' });
  if (details[details.length - 1] === 'b') test.check('up, then enter presses the current row');
  else test.fail(OWED + 'enter pressed ' + short(details));

  // Andy, 2026-10-18: "in the contacts app the up-down keys etc... don't work." A press leaves the focus on the page, so
  // the list itself takes the keys: it is focusable, and a press gives it the focus.
  let focused = 0;
  el.list.focus = function () { focused += 1; };
  press(box, 'a');
  if (/<div id="[^"]+list"[^>]*tabindex="0"/.test(box.innerHTML) && focused === 1) test.check('the list is focusable, and a press on a row gives it the focus, so the keys reach it');
  else test.fail(OWED + 'list tabindex ' + /tabindex="0"/.test(box.innerHTML) + ', focused on a press ' + focused);

  // THE DROPDOWN IS A POP-UP PANE (Andy, 2026-10-18: "the dropdown is just a pop-up pane.", and "why does the dropdown
  // not just show a \"pane\" exactly like the pane would look?"): closed, a field with the chosen name or a placeholder;
  // a click on it pops the whole pane up, rows 1 to 3 as a pane has them; a pick, escape or a click outside shuts it.
  test.subHeading('5. the dropdown: a field, and the whole pane popping up under it');
  const box2 = fakeElement('drop');
  const picked = [];
  const drop = make(box2, { mode: 'dropdown', rows: function () { return ROWS; }, paint: function (row) { return '<td>' + row.name + '</td>'; }, pick: function (row) { picked.push(row.key); }, placeholder: 'choose…' });
  const el2 = parts(p, box2);
  await sleep(20);
  const ids2 = (box2.innerHTML.match(/id="([^"]+)"/g) || []).map(function (s) { return s.slice(4, -1); });
  const field = p.doc.getElementById(ids2.filter(function (i) { return /field$/.test(i); })[0] || 'none');
  const popup = p.doc.getElementById(ids2.filter(function (i) { return /popup$/.test(i); })[0] || 'none');
  const fieldText = function () { return String(field.textContent || field.innerHTML || ''); };
  const html2 = box2.innerHTML;
  const inside = html2.indexOf('id="' + popup.id + '"');
  const sameRows = inside !== -1 && html2.indexOf(el2.filters.id) > inside && html2.indexOf(el2.text.id) > html2.indexOf(el2.filters.id) && html2.indexOf(el2.list.id) > html2.indexOf(el2.text.id);
  // The popup covers what lies under it: a solid background, never the tile's see-through one alone (seen in grants).
  const popTag = (html2.match(/<div id="[^"]+popup"[^>]*>/) || [''])[0];
  if (/background:[^;"]*#1a1a2e/.test(popTag)) test.check('the popup is solid: what lies under it does not show through');
  else test.fail(OWED + 'the popup is see-through: ' + short(popTag));
  if (/choose…/.test(fieldText()) && popup.hidden === true && sameRows) test.check('closed: a field with the placeholder; the popup, shut, holds the filters, the search row and the list, as a pane');
  else test.fail(OWED + 'dropdown: field "' + fieldText() + '", popup hidden ' + popup.hidden + ', the pane\'s rows inside ' + sameRows);
  box2.fire('click', { target: { id: field.id, getAttribute: function () { return null; } } });
  const openOnClick = popup.hidden === false && el2.list.hidden !== true;
  press(box2, 'b');
  if (openOnClick && picked.join() === 'b' && popup.hidden === true && /beta door/.test(fieldText()) && drop && drop.value === 'b') test.check('a click on the field pops the pane up; a pick shuts it, the field shows the chosen name, value is its key');
  else test.fail(OWED + 'open on click ' + openOnClick + ', picked ' + short(picked) + ', popup hidden ' + popup.hidden + ', field "' + fieldText() + '", value ' + short(drop && drop.value));
  box2.fire('click', { target: { id: field.id, getAttribute: function () { return null; } } });
  fire(box2, 'keydown', el2.text, { key: 'Escape' });
  const escShut = popup.hidden === true;
  box2.fire('click', { target: { id: field.id, getAttribute: function () { return null; } } });
  p.doc.fire('click', { target: { inside: false } });
  if (escShut && popup.hidden === true) test.check('escape and a click outside shut the popup');
  else test.fail(OWED + 'shut on escape ' + escShut + ', shut on outside click ' + popup.hidden);

  test.subHeading('6. press is gone, contactSelector passes the mode');
  const src = fs.readFileSync(FILE, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  if (!/o\.press\b/.test(src)) test.check('the list takes details and pick; the old press is gone');
  else test.fail(OWED + 'listSearch.js still calls o.press');
  const sel = fs.readFileSync(path.join(RUN, 'shell', 'js', 'contactSelector.js'), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  if (/mode:/.test(sel) && !/contact-selector-field/.test(sel) && !/font-weight:bold/.test(sel)) test.check('contactSelector passes the mode; its own dropdown button and bold name are gone');
  else test.fail(OWED + 'contactSelector still holds its own dropdown or bold name');
  const fallout = fs.readFileSync(path.join(RUN, 'shell', 'desk', 'plugins', 'fallout', 'fallout.js'), 'utf8');
  if (/details:\s*/.test(fallout) && !/press:\s*/.test(fallout)) test.check('Fallout opens a test\'s history through details');
  else test.fail(OWED + 'Fallout still configures press');

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
