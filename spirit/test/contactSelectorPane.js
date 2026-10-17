'use strict';

// spirit/test/contactSelectorPane.js
// goal/G4.14: the peer pane, and the dropdown that is the same pane, in one shell element, shell/js/contactSelector.js.
// RED on today's tree: contactSelector.js is the browser's own select, text only, with no search box, no status
// column, no pane face and no current row.
//
//   Andy, 2026-10-03, his go-all on goal/G4; the rulings stand verbatim in the box of goal/G4.14: "if a peerPane would
//   allow mark() per item, like a red star or so, i and chatter probably can live with that..."; "the presence is
//   always a column and the status icon is configurable with a little list. [{status,iconKey}, status IconKey], where
//   the first pair is the default and can have no icon."; "dropDown and pane element for the same object type may
//   share the same element file.js"; "The dropDowns should present like the panes."; "the dropdown may even use a
//   pane"; "the pane usually has a \"current\" which is the equivalent of selected in the drop-box"; "the current name
//   contactSelector is perfect".
//
// THE CONTRACT (the box of goal/G4.14; the shapes it left open named here, marked NAMED).
//   One factory, window.spiritElements.createContactSelector(options), two faces: options.face 'pane' (NAMED), or the
//   dropdown, the default, so its users (grants.js, natterDetails.js) change nothing.
//   1. THE LIST: a search box (an input) over rows fed by a bounded search: options.search(text) -> Promise of
//      {items: [{key, label}], more} (NAMED), contact.search {q} when none is given. With nothing typed it asks with
//      '' and draws the rows in the order answered; typing asks again with the text. A cut answer (more) says so.
//   2. THE ROW: each row carries data-key (NAMED) and shows the row's name. AMENDED by goal/G29.6 (Andy, 2026-10-17:
//      "now i want the contactSelector to be just a wrapper around our new list-selector", "no fucking protecting old
//      design."): the contact label element in every row is gone; a row's name is the row's (its label json, or a label
//      that is not json taken as the name).
//   3. THE STATUS COLUMN: options.statuses [{status, iconKey}, ...], the first the default and maybe without an icon.
//      root.mark(key, status) draws that status's icon from the kernel's set in that row; a status the list lacks
//      draws the default. The element counts nothing.
//   4. THE PANE: a click on a row makes it current: root.value is its key, root.row its row, one bubbling change fires
//      on the root. (The row drawn marked 'current' was dropped by goal/G29.6: the shared list draws no current row.)
//   5. THE DROPDOWN: the same pane under a button: no row is shown until the button is clicked; a click on a row then
//      sets root.value, fires one change, and closes the pane.
//   6. (goal/G4.10) THE OPEN DROPDOWN hides its own button; closed or picked, the button shows.
//   8. THE COLUMNS, goal/G29.6's box: ★, presence, the name, then the configurable status column, last ("what allows
//      an extra (status) column to be added"). This replaces goal/G4.10's status-first order.
//   7. (goal/G4.10) PRESENCE, always a column: every row a dot, white until root.present(key, true) makes it green
//      (NAMED); false is white too, never red, which is a status in chatter. Dot and status mark stand side by side,
//      and presence survives a redraw.
// NOT ASSERTED, the builder's: markup beyond the names above, classes, scrolling, the fold button (chatter's, G4.9 and
// G4.10). shellElements.js, which reads today's native select, moves with the change.
// THE PAGE (goal/G29.6): the selector is a wrapper around shellCreateListSearch (shell/shared/js/listSearch.js), so the
// fake page loads the three probability modules and listSearch.js before contactSelector.js, as index.html does. The
// list writes its markup as html into the pane, ids listsearch-<n>-filters|text|clear|search|count|list, and finds its
// parts by document.getElementById; rows are <tr data-key> strings in the list part, read here by their cells.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'owed by goal/G4.14: ';
const OWED10 = 'owed by goal/G4.10: ';
const OWED29 = 'owed by goal/G29.6: ';
const FILE = path.join(RUN, 'shell', 'js', 'contactSelector.js');
const LIST = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');
const ICON = kernel.core.const.ICON;

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

test.startTest('goal/G4.14: the peer pane and its dropdown, one element, shell/js/contactSelector.js');

// A small DOM: built by createElement and appendChild, events that bubble along parentNode, closest() for an
// attribute or a class. What the shared list writes as html is read back as html (goal/G29.6).
function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), id: '', value: '', textContent: '', className: '', style: {}, dataset: {},
    children: [], listeners: {}, parentNode: null, hidden: false, attrs: {},
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c) { return e.appendChild(c); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; },
    getAttribute: function (k) { if (k.indexOf('data-') === 0) { const d = e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })]; return d === undefined ? null : d; } return e.attrs[k] === undefined ? null : e.attrs[k]; },
    removeAttribute: function (k) { delete e.attrs[k]; if (k === 'hidden') e.hidden = false; },
    closest: function (sel) {
      for (let n = e; n; n = n.parentNode) {
        const a = /^\[([\w-]+)\]$/.exec(sel);
        if (a && n.getAttribute && n.getAttribute(a[1]) !== null) return n;
        if (sel.charAt(0) === '.' && String(n.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1) return n;
        if (/^[a-z]+$/i.test(sel) && n.tagName === sel.toUpperCase()) return n;
      }
      return null;
    },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    focus: function () {}, select: function () {}, blur: function () {},
    classList: null,
  };
  e.classList = {
    add: function (c) { const s = String(e.className || '').split(/\s+/).filter(Boolean); if (s.indexOf(c) === -1) s.push(c); e.className = s.join(' '); },
    remove: function (c) { e.className = String(e.className || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
    toggle: function (c, on) { if (on === undefined) on = !e.classList.contains(c); if (on) e.classList.add(c); else e.classList.remove(c); return on; },
    contains: function (c) { return String(e.className || '').split(/\s+/).indexOf(c) !== -1; },
  };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
function bubble(target, ev) {
  if (!ev.target) { try { Object.defineProperty(ev, 'target', { value: target, configurable: true }); } catch (x) { ev.target = target; } }
  let stopped = false;
  const realStop = ev.stopPropagation;
  try { ev.stopPropagation = function () { stopped = true; if (realStop) realStop.call(ev); }; } catch (x) { /* frozen */ }
  for (let n = target; n && !stopped; n = n.parentNode) {
    (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(n, ev); });
    if (ev.bubbles === false && n === target) break;
  }
}
function fire(n, type, extra) {
  const ev = Object.assign({ type: type, bubbles: true, preventDefault: function () {} }, extra || {});
  bubble(n, ev);
}
function all(root) { return [root].concat(root.children.reduce(function (acc, c) { return acc.concat(all(c)); }, [])); }
function visible(n, root) {
  for (let x = n; x; x = x.parentNode) { if (x.hidden || (x.style && x.style.display === 'none')) return false; if (x === root) return true; }
  return true;
}

// THE LIST'S PARTS (goal/G29.6): the pane hosts shellCreateListSearch, whose markup names its parts by id; the page's
// getElementById hands the same fake part for an id every time.
let DOC = null;
function paneOf(root) { return root.children.filter(function (c) { return /\bcontact-selector-pane\b/.test(c.className); })[0] || null; }
function partOf(root, name) {
  const p = paneOf(root);
  const m = p && /id="(listsearch-\d+-)text"/.exec(p.innerHTML);
  return m && DOC ? DOC.getElementById(m[1] + name) : null;
}
// A row as drawn: <tr data-key="KEY">, its cells in order. None while the pane is hidden.
function rowsOf(root) {
  const p = paneOf(root);
  const list = partOf(root, 'list');
  if (!p || !visible(p, root) || !list) return [];
  const out = [];
  const re = /<tr[^>]*\bdata-key="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(list.innerHTML))) {
    const cells = [];
    const cre = /<td[^>]*>[\s\S]*?<\/td>/g;
    let c;
    while ((c = cre.exec(m[2]))) cells.push(c[0]);
    out.push({ key: m[1], html: m[2], cells: cells });
  }
  return out;
}
function keysOf(root) { return rowsOf(root).map(function (r) { return r.key; }).join(','); }
function rowFor(root, key) { return rowsOf(root).filter(function (r) { return r.key === key; })[0] || null; }
function shown(r) { return r ? r.html : ''; }
function statusCell(r) { return r && r.cells.length ? r.cells[r.cells.length - 1] : ''; }
function inputOf(root) { const p = paneOf(root); return p && visible(p, root) ? partOf(root, 'text') : null; }
function buttonOf(root) { return all(root).filter(function (n) { return n.tagName === 'BUTTON'; })[0] || null; }
// The list hears its events on the pane, where a browser bubbles them from the box typed in or the row pressed.
function typeInto(root, text) { const box = inputOf(root); if (!box) return false; box.value = text; fire(paneOf(root), 'input', { target: box }); return true; }
function press(root, key) {
  fire(paneOf(root), 'click', { target: { getAttribute: function (k) { return k === 'data-key' ? key : null; }, closest: function () { return null; } } });
}

function load() {
  const byId = {};
  const doc = { createElement: node, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; },
    getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; },
    addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return true; } };
  DOC = doc;
  const win = {};
  const asked = [];
  const sp = { core: {
    ask: function (verb, body) { asked.push({ verb: verb, body: body || {} }); return Promise.resolve({ status: 200, body: { items: [{ key: 'kc', label: 'from contact.search' }], more: false } }); },
    util: { escapeHtml: kernel.core.util.escapeHtml }, const: { ICON: ICON } } };
  // As index.html loads them (goal/G29.6): the probability modules, the shared list, then the selector.
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(LIST, 'utf8'))(doc, win);
  new Function('spirit', 'document', 'window', 'Event', 'CustomEvent', fs.readFileSync(FILE, 'utf8'))(sp, doc, win, Event, CustomEvent);
  return { make: win.spiritElements && win.spiritElements.createContactSelector, asked: asked };
}

const ROWS = [{ key: 'k1', label: 'one' }, { key: 'k2', label: 'two' }, { key: 'k3', label: 'three' }];

async function main() {
  let m = null;
  try { m = load(); } catch (e) { test.fail(OWED + 'contactSelector.js did not load: ' + e.message); return; }
  if (typeof m.make !== 'function') { test.fail(OWED + 'no createContactSelector'); return; }

  test.subHeading('1. a search box over rows fed by a bounded search');
  const searched = [];
  const search = function (text) { searched.push(text); return Promise.resolve({ items: text ? ROWS.slice(1, 2) : ROWS, more: !text }); };
  const STATUSES = [{ status: 'none' }, { status: 'unanswered', iconKey: 'RED_CIRCLE' }];
  let pane = null;
  try { pane = m.make({ face: 'pane', search: search, statuses: STATUSES }); } catch (e) { test.fail(OWED + 'a pane threw: ' + e.message); return; }
  await settle();
  if (searched[0] === '' && keysOf(pane) === 'k1,k2,k3') test.check('with nothing typed it asks with \'\' and draws the rows in the order answered, each with data-key');
  else test.fail(OWED + 'asked ' + JSON.stringify(searched) + ', rows drawn ' + JSON.stringify(keysOf(pane)));
  // goal/G29.6: the cut is said on the shared list's count line ("partial: the server holds more").
  const count = partOf(pane, 'count');
  if (count && /\bmore\b/i.test(count.textContent) && /partial/i.test(count.textContent)) test.check('a cut answer (more) says so, on the list\'s count line');
  else test.fail(OWED + 'a cut answer is not said: ' + JSON.stringify(count && count.textContent).slice(0, 160));
  if (inputOf(pane)) {
    typeInto(pane, 'tw');
    await settle();
    // goal/G29.6: every row any search brought stays held and is ranked against the words, best on top; so the rows
    // the earlier search brought are not dropped, the match comes first.
    if (searched[searched.length - 1] === 'tw' && rowsOf(pane).length && rowsOf(pane)[0].key === 'k2') test.check('typing asks again with the text and redraws, the best match on top');
    else test.fail(OWED + 'typing asked ' + JSON.stringify(searched) + ', rows ' + JSON.stringify(keysOf(pane)));
    typeInto(pane, '');
    await settle();
  } else test.fail(OWED + 'the pane has no search box');
  const plainAsk = m.make({ face: 'pane' });
  await settle();
  if (m.asked.some(function (a) { return a.verb === 'contact.search' && a.body.q === ''; }) && rowFor(plainAsk, 'kc')) test.check('with no search given it asks contact.search {q}');
  else test.fail(OWED + 'with no search given it asked ' + JSON.stringify(m.asked) + ', rows ' + rowsOf(plainAsk).length);

  // goal/G29.6 dropped the contact label element in each row (createContactLabel); the name is the row's own. What is
  // asserted instead: the name cell shows the row's name, here a label that is not json taken as the name.
  test.subHeading('2. each row shows its name');
  const nameCell = function (r) { return r && r.cells.length >= 3 ? r.cells[2] : ''; };
  const names = { k1: 'one', k2: 'two', k3: 'three' };
  if (['k1', 'k2', 'k3'].every(function (k) { return new RegExp('>' + names[k] + '<').test(nameCell(rowFor(pane, k))); }) && />from contact\.search</.test(nameCell(rowFor(plainAsk, 'kc')))) {
    test.check('the name cell shows the row\'s name, a label that is not json taken as the name');
  } else test.fail(OWED29 + 'name cells ' + JSON.stringify(['k1', 'k2', 'k3'].map(function (k) { return nameCell(rowFor(pane, k)); })).slice(0, 200));

  test.subHeading('3. the status column, set by mark(key, status)');
  if (typeof pane.mark === 'function') {
    pane.mark('k2', 'unanswered');
    pane.mark('k3', 'nonsense');
    await settle();
    const two = rowFor(pane, 'k2'); const one = rowFor(pane, 'k1'); const three = rowFor(pane, 'k3');
    if (two && statusCell(two).indexOf(ICON.RED_CIRCLE) !== -1 && one && shown(one).indexOf(ICON.RED_CIRCLE) === -1) test.check('mark(k2, unanswered) draws ' + ICON.RED_CIRCLE + ' in that row\'s status cell alone');
    else test.fail(OWED + 'after mark: k2 ' + JSON.stringify(shown(two)).slice(0, 100) + ', k1 ' + JSON.stringify(shown(one)).slice(0, 100));
    if (three && shown(three).indexOf(ICON.RED_CIRCLE) === -1) test.check('a status the list lacks draws the default (here none)');
    else test.fail(OWED + 'an unknown status drew ' + JSON.stringify(shown(three)).slice(0, 100));
    pane.mark('k2', 'none');
    await settle();
    if (rowFor(pane, 'k2') && shown(rowFor(pane, 'k2')).indexOf(ICON.RED_CIRCLE) === -1) test.check('and mark(k2, none) takes the icon away');
    else test.fail(OWED + 'mark(k2, none) left ' + JSON.stringify(shown(rowFor(pane, 'k2'))).slice(0, 100));
    const starred = m.make({ face: 'pane', search: search, statuses: [{ status: 'plain', iconKey: 'STAR' }, { status: 'hot', iconKey: 'FIRE' }] });
    await settle();
    // goal/G29.6: ★ is also the owned column's mark, so the default icon is looked for in the status cell itself.
    if (rowFor(starred, 'k1') && statusCell(rowFor(starred, 'k1')).indexOf(ICON.STAR) !== -1) test.check('a default with an icon draws it on every unmarked row');
    else test.fail(OWED + 'a default with an icon: ' + JSON.stringify(shown(rowFor(starred, 'k1'))).slice(0, 100));
  } else test.fail(OWED + 'the root has no mark(key, status)');

  test.subHeading('4. the pane has a current row');
  let changes = 0;
  pane.addEventListener('change', function () { changes += 1; });
  const parent = node('div');
  let bubbled = 0;
  parent.addEventListener('change', function () { bubbled += 1; });
  parent.appendChild(pane);
  if (rowFor(pane, 'k2')) {
    press(pane, 'k2');
    await settle();
    if (pane.value === 'k2' && pane.row && pane.row.name === 'two' && changes === 1 && bubbled === 1) test.check('a click on a row: root.value is its key, root.row its row, one change, bubbling');
    else test.fail(OWED + 'after a click: value ' + JSON.stringify(pane.value) + ', row ' + JSON.stringify(pane.row) + ', changes ' + changes + ', bubbled ' + bubbled);
    // goal/G29.6: "that row alone is drawn current" is dropped; the shared list draws no current row by design.
  } else test.fail(OWED + 'no row k2 to click');

  test.subHeading('5. the dropdown is the same pane under a button');
  const drop = m.make({ search: search, statuses: STATUSES });
  await settle();
  const button = buttonOf(drop);
  if (button && rowsOf(drop).length === 0) test.check('the default face is a button, no row shown until it is clicked');
  else test.fail(OWED + 'the dropdown: button ' + !!button + ', rows shown before a click ' + rowsOf(drop).length);
  if (button) {
    fire(button, 'click');
    await settle();
    const opened = keysOf(drop);
    if (opened === 'k1,k2,k3' && inputOf(drop)) test.check('a click opens the pane: the search box and its rows');
    else test.fail(OWED + 'after the button: rows ' + JSON.stringify(opened) + ', search box ' + !!inputOf(drop));
    let dchanges = 0;
    drop.addEventListener('change', function () { dchanges += 1; });
    if (rowFor(drop, 'k3')) { press(drop, 'k3'); await settle(); }
    if (drop.value === 'k3' && dchanges === 1 && rowsOf(drop).length === 0) test.check('a pick sets root.value, fires one change, and closes the pane');
    else test.fail(OWED + 'after a pick: value ' + JSON.stringify(drop.value) + ', changes ' + dchanges + ', rows still shown ' + rowsOf(drop).length);
  }

  // ── goal/G4.10, reopened: Andy, 2026-10-03, trying chatter live: "the choose a peer from the dropdown shouldn't be
  // seen when the dropdown turn into a pane"; "the presence is always a column" (G4.14); "same green and white dots i
  // see in contacts"; "my line said, \"like in contacts\" where i only see green and white...".
  test.subHeading('6. (goal/G4.10) the open dropdown hides its own button');
  const drop2 = m.make({ search: search, statuses: STATUSES, placeholder: 'choose a peer' });
  await settle();
  const b2 = buttonOf(drop2);
  if (b2) {
    const shownClosed = visible(b2, drop2);
    fire(b2, 'click');
    await settle();
    const hiddenOpen = !visible(b2, drop2) && rowsOf(drop2).length === 3;
    if (rowFor(drop2, 'k1')) { press(drop2, 'k1'); await settle(); }
    if (shownClosed && hiddenOpen && visible(b2, drop2) && rowsOf(drop2).length === 0) test.check('closed: the button shows; open: the pane alone, the button hidden; picked: the button again');
    else test.fail(OWED10 + 'the button: shown closed ' + shownClosed + ', hidden while open ' + hiddenOpen + ', shown after a pick ' + visible(b2, drop2));
  } else test.fail(OWED10 + 'no dropdown button');

  test.subHeading('7. (goal/G4.10) presence, always a column: green when present, white otherwise');
  const pres = m.make({ face: 'pane', search: search, statuses: STATUSES });
  await settle();
  const dot = function (k) { return shown(rowFor(pres, k)); };
  const G = ICON.GREEN_CIRCLE; const W = ICON.WHITE_CIRCLE;
  if (['k1', 'k2', 'k3'].every(function (k) { return dot(k).indexOf(W) !== -1 && dot(k).indexOf(G) === -1; })) test.check('every row has its presence dot, white until told');
  else test.fail(OWED10 + 'rows before any presence: ' + JSON.stringify(['k1', 'k2', 'k3'].map(dot)).slice(0, 200));
  if (typeof pres.present === 'function') {
    pres.present('k2', true);
    pres.present('k3', false);
    await settle();
    if (dot('k2').indexOf(G) !== -1 && dot('k2').indexOf(W) === -1 && dot('k3').indexOf(W) !== -1 && dot('k3').indexOf(G) === -1 && dot('k3').indexOf(ICON.RED_CIRCLE) === -1) test.check('root.present(key, true) green; false white, never red (red is a status here)');
    else test.fail(OWED10 + 'after present: k2 ' + JSON.stringify(dot('k2')).slice(0, 100) + ', k3 ' + JSON.stringify(dot('k3')).slice(0, 100));
    pres.mark('k2', 'unanswered');
    await settle();
    if (dot('k2').indexOf(G) !== -1 && dot('k2').indexOf(ICON.RED_CIRCLE) !== -1) test.check('the presence dot and the status mark stand side by side');
    else test.fail(OWED10 + 'k2 with presence and unanswered: ' + JSON.stringify(dot('k2')).slice(0, 120));
    // goal/G29.6 replaced goal/G4.10's "Make the configurable icons the first column, and the presence dots the second
    // column": the columns are ★, presence, the name, then the status column last ("what allows an extra (status)
    // column to be added").
    const r2 = rowFor(pres, 'k2');
    const cellOf = function (glyph) { return r2 ? r2.cells.findIndex(function (c) { return c.indexOf(glyph) !== -1; }) : -1; };
    const pi = cellOf(G); const ni = cellOf('>two<'); const si = cellOf(ICON.RED_CIRCLE);
    if (r2 && r2.cells.length === 4 && pi === 1 && ni === 2 && si === 3) test.check('the columns are ★, presence, name, then the status icon last');
    else test.fail(OWED29 + 'in the row: ' + (r2 ? r2.cells.length : 0) + ' cells, presence cell ' + pi + ', name cell ' + ni + ', status cell ' + si);
    typeInto(pres, '');
    await settle();
    if (dot('k2').indexOf(G) !== -1) test.check('presence survives the rows being drawn again');
    else test.fail(OWED10 + 'after a redraw k2 shows ' + JSON.stringify(dot('k2')).slice(0, 100));
  } else test.fail(OWED10 + 'the root has no present(key, state)');
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
