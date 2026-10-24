'use strict';

// spirit/test/iconsAddKnown.js
// goal/G40.5: Add on an icon already in the set opens that icon's edit view. Written first, red on today's tree, by
// claude-windows. The box, Andy's words among it: "if add icon cannot add because the icon already exists, the open the
// edit dialog for the existing icon." Today Add refuses with "open its row to change its keywords" and leaves the list
// up; the edit view it should open is iconsPanel, the one a press on the icon's row opens.
//
// WHAT IS ASSERTED, on the Icons app as the shell mounts it (shell/icons/icons.js), with the set read and written
// through the spirit object:
//   1. Add with a glyph already in the set opens the edit view for it: the list hidden, the icon's view shown, holding
//      that glyph and its keywords as the set has them.
//   2. The same under another spelling (a variation selector), which the app already calls the same icon.
//   3. Nothing is written: the set is not saved by an Add that adds nothing.
//   4. A glyph not in the set is still added, and the list stays up.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G40.5: ';
const APP = path.join(__dirname, '..', 'run', 'shell', 'icons', 'icons.js');
const KNOWN = '\u{1F9E9}';            // the puzzle piece
const KNOWN_VS = KNOWN + '️';    // the same picture with a variation selector
const NEW = '\u{1F9ED}';              // a compass, not in the set
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// An element as icons.js uses one: found by selector, listened to, shown or hidden, written into.
function fakeElement() {
  const found = {};
  const on = {};
  return {
    hidden: false, innerHTML: '', value: '', textContent: '',
    querySelector: function (sel) { return found[sel] || (found[sel] = fakeElement()); },
    addEventListener: function (type, fn) { (on[type] = on[type] || []).push(fn); },
    fire: function (type, event) { (on[type] || []).forEach(function (fn) { fn(event || {}); }); },
  };
}

function mount(set) {
  const saved = [];
  let behavior = null;
  const s = {
    fs: {
      loadFile: function () { return Promise.resolve(JSON.stringify(set)); },
      saveFile: function (p, text) { saved.push({ path: p, text: text }); set = JSON.parse(text); return Promise.resolve({ ok: true }); },
    },
  };
  const spirit = { ready: Promise.resolve(s), shell: { activateApp: function (b) { behavior = b; } } };
  const window = { spirit: { elements: {
    iconList: { create: function () { return { reload: function () {} }; } },
    fieldInput: { attach: function () {}, fits: function () { return true; } },
  } } };
  new Function('spirit', 'window', 'document', fs.readFileSync(APP, 'utf8'))(spirit, window, {});
  const container = fakeElement();
  behavior.mount(container, {});
  // The view's hidden attribute, as the browser reads it out of the markup mount wrote.
  container.querySelector('[data-icons="icon"]').hidden = /data-icons="icon" hidden/.test(container.innerHTML);
  return {
    saved: saved,
    list: container.querySelector('[data-icons="list"]'),
    icon: container.querySelector('[data-icons="icon"]'),
    said: container.querySelector('[data-icons="added"]'),
    add: function (glyph, words) {
      container.querySelector('[data-icons="new-glyph"]').value = glyph;
      container.querySelector('[data-icons="new-keywords"]').value = words || '';
      container.querySelector('[data-icons="add"]').fire('click');
      return sleep(20);
    },
  };
}

test.startTest('goal/G40.5: Add on an icon already in the set opens its edit view');

(async function () {
  // ── 1 and 3. THE KNOWN GLYPH ────────────────────────────────────────
  test.subHeading('1. Add with a glyph already in the set opens that icon\'s edit view, and writes nothing');
  const set = {};
  set[KNOWN] = ['puzzle', 'piece'];
  const a = mount(set);
  await a.add(KNOWN, 'other');
  const opened = a.list.hidden === true && a.icon.hidden === false && a.icon.innerHTML.indexOf(KNOWN) !== -1 && a.icon.innerHTML.indexOf('puzzle, piece') !== -1;
  if (opened) test.check('the list gives way to the icon\'s own view, holding the glyph and its keywords "puzzle, piece"');
  else test.fail(OWED + 'Add on a known glyph: list hidden ' + a.list.hidden + ', icon view hidden ' + a.icon.hidden + ', it says "' + a.said.textContent + '"');
  if (a.saved.length === 0) test.check('and the set is not written');
  else test.fail('an Add that adds nothing wrote the set ' + a.saved.length + ' times');

  // ── 2. ANOTHER SPELLING ─────────────────────────────────────────────
  test.subHeading('2. the same under another spelling');
  const b = mount(set);
  await b.add(KNOWN_VS, '');
  if (b.icon.hidden === false && b.icon.innerHTML.indexOf('puzzle, piece') !== -1) test.check('a glyph with a variation selector opens the same icon\'s view');
  else test.fail(OWED + 'Add on the known glyph with a variation selector: icon view hidden ' + b.icon.hidden + ', it says "' + b.said.textContent + '"');

  // ── 4. A NEW GLYPH ──────────────────────────────────────────────────
  test.subHeading('3. a glyph not in the set is still added');
  const c = mount(set);
  await c.add(NEW, 'compass');
  const written = c.saved.length === 1 ? JSON.parse(c.saved[0].text) : {};
  if (c.saved.length === 1 && Array.isArray(written[NEW]) && written[NEW][0] === 'compass' && c.list.hidden !== true && c.icon.hidden !== false) {
    test.check('a new glyph is written with its keywords, and the list stays up');
  } else {
    test.fail('a new glyph: saved ' + c.saved.length + ', list hidden ' + c.list.hidden + ', icon view hidden ' + c.icon.hidden);
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
