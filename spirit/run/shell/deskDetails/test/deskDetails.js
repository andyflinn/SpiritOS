'use strict';

// spirit/run/shell/deskDetails/test/deskDetails.js
// The tests of shell/deskDetails/deskDetails.js (spec: ./deskDetails.md; goal/G41.1): its panel icons are glyphs, drawn
// as they are, with no icon table. Read from the module's own code: DD_PANELS and the strip that draws them. And
// goal/G41.9: every are-you-sure it draws is an armingButton, driven on a page of its own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskDetails.js');
const KEY = /^[A-Z_]+$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('deskDetails.js: its panel icons are glyphs; its are-you-sure buttons are armingButtons');

const raw = fs.readFileSync(FILE, 'utf8');
const code = raw.replace(/\/\/[^\n]*/g, '');
test.subHeading('the panels name their icons as glyphs');
const at = /var DD_PANELS = (\[[\s\S]*?\n\]);/.exec(code);
let panels = null;
try { panels = at ? (new Function('return ' + at[1]))() : null; } catch (e) { panels = null; }
ok(Array.isArray(panels) && panels.length >= 6, 'DD_PANELS lists its six panels', 'DD_PANELS not read: ' + (at ? 'not evaluable' : 'not found'));
const keyed = (panels || []).filter(function (p) { return !p.icon || KEY.test(p.icon); }).map(function (p) { return p.key + ':' + p.icon; });
ok(panels && !keyed.length, 'every panel names its icon as the glyph itself', 'panels naming a key: ' + keyed.join(', '));
test.subHeading('the strip draws them as they are, from no table');
ok(!/iconIndex|\bICON\b/.test(code), 'deskDetails.js names no icon table', 'deskDetails.js still names iconIndex or ICON');
ok(/\+ p\.icon \+/.test(code), 'the strip draws a panel\'s icon as it is (p.icon)', 'the strip does not draw p.icon as it is');

// ── THE PAGE THESE TESTS DRIVE (goal/G41.9) ─────────────────────────────────────────────────────────────────────────
// A small forgiving page: markup parsed into elements, with ids, attributes, closest and simple selectors, and a click
// that reaches every listener above its target.
const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
function makeDom() {
  const doc = {};
  function el(tag) {
    const attrs = {}; const heard = {};
    const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
      get id() { return attrs.id || ''; }, set id(v) { attrs.id = String(v); },
      get className() { return attrs.class || ''; }, set className(v) { attrs.class = String(v); },
      get firstChild() { return e.children[0] || null; },
      get isConnected() { let p = e; while (p.parentNode) p = p.parentNode; return p === doc.root; },
      get textContent() { return e.children.length ? e.children.map(function (c) { return c.textContent; }).join('') : e._text; },
      set textContent(v) { e.children = []; e._text = String(v == null ? '' : v); },
      get innerHTML() { return e._html || ''; },
      set innerHTML(v) { e._html = String(v); e.children = []; e._text = ''; parseInto(e, String(v)); },
      getAttribute: function (k) { if (k === 'id') return attrs.id || null; return k in attrs ? attrs[k] : null; },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      removeAttribute: function (k) { delete attrs[k]; },
      hasAttribute: function (k) { return k in attrs; },
      classList: { add: function (c) { const l = (attrs.class || '').split(/\s+/).filter(Boolean); if (l.indexOf(c) === -1) l.push(c); attrs.class = l.join(' '); },
        remove: function (c) { attrs.class = (attrs.class || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
        contains: function (c) { return (attrs.class || '').split(/\s+/).indexOf(c) !== -1; },
        toggle: function (c, on) { if (on === undefined ? !e.classList.contains(c) : on) e.classList.add(c); else e.classList.remove(c); } },
      appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
      insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = e.children.indexOf(ref); if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
      removeChild: function (c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; return c; },
      replaceChild: function (n, o) { const i = e.children.indexOf(o); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = e; if (i !== -1) e.children[i] = n; o.parentNode = null; return o; },
      remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
      addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
      removeEventListener: function (t, fn) { heard[t] = (heard[t] || []).filter(function (f) { return f !== fn; }); },
      dispatch: function (t, ev) { (heard[t] || []).slice().forEach(function (fn) { fn(ev); }); },
      closest: function (sel) { let p = e; while (p && p.tagName) { if (matches(p, sel)) return p; p = p.parentNode; } return null; },
      matches: function (sel) { return matches(e, sel); },
      querySelectorAll: function (sel) { const out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); }(e)); return out; },
      querySelector: function (sel) { return e.querySelectorAll(sel)[0] || null; },
      focus: function () {}, blur: function () {}, scrollIntoView: function () {}, getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
      attrs: attrs,
    };
    return e;
  }
  function one(n, sel) {
    sel = sel.trim();
    const m = /^([a-z]*)((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(sel);
    if (!m) return false;
    if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
    const parts = m[2].match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/g) || [];
    return parts.every(function (p) {
      if (p[0] === '#') return n.getAttribute('id') === p.slice(1);
      if (p[0] === '.') return n.classList.contains(p.slice(1));
      const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
      return a[2] === undefined ? n.hasAttribute(a[1]) : n.getAttribute(a[1]) === a[2];
    });
  }
  function matches(n, sel) { return String(sel).split(',').some(function (s) { return one(n, s); }); }
  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&'); }
  function parseInto(root, html) {
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g; let m;
    let raw = null;
    while ((m = re.exec(html))) {
      const top = stack[stack.length - 1];
      if (raw) { if (m[1] === '/' && m[2] && m[2].toLowerCase() === raw) { stack.pop(); raw = null; } continue; }
      if (m[5] !== undefined) { if (m[5].trim() || top.children.length === 0) { const t = el('#text'); t._text = unesc(m[5]); t.tagName = '#TEXT'; top.children.push(t); t.parentNode = top; } continue; }
      if (!m[2]) continue;
      const tag = m[2].toLowerCase();
      if (m[1] === '/') { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
      const n = el(tag);
      const ar = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3]))) n.attrs[a[1]] = unesc(a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5] !== undefined ? a[5] : '');
      if ('hidden' in n.attrs) n.hidden = true;
      if ('disabled' in n.attrs) n.disabled = true;
      if (n.attrs.type) n.type = n.attrs.type;
      if (n.attrs.title) n.title = n.attrs.title;
      if (n.attrs.value) n.value = n.attrs.value;
      n.parentNode = top; top.children.push(n);
      if (!VOID[tag] && !m[4]) { stack.push(n); if (tag === 'style' || tag === 'script') raw = tag; }
    }
  }
  doc.root = el('html');
  doc.body = doc.root.appendChild(el('body'));
  doc.head = doc.root.appendChild(el('head'));
  doc.documentElement = doc.root;
  doc.readyState = 'complete';
  doc.createElement = function (t) { return el(t); };
  doc.createTextNode = function (t) { const n = el('#text'); n._text = String(t); return n; };
  doc.getElementById = function (id) { return doc.root.querySelector('#' + id); };
  doc.querySelector = function (s) { return doc.root.querySelector(s); };
  doc.querySelectorAll = function (s) { return doc.root.querySelectorAll(s); };
  doc.addEventListener = function () {};
  doc.removeEventListener = function () {};
  // A click on an element, bubbling to every listener above it.
  doc.click = function (t) {
    const ev = { type: 'click', target: t, preventDefault: function () {}, stopPropagation: function () {} };
    let p = t; while (p) { if (p.dispatch) p.dispatch('click', ev); p = p.parentNode; }
  };
  return doc;
}

// A working armingButton, as its spec says (shell/js/test/armingButton.md), that writes down every button it is handed.
function armingStub(document, made) {
  var loaded = null;
  function attach(b, o) {
    o = o || {};
    made.push({ button: b, opts: o });
    var label = o.label != null ? String(o.label) : b.textContent;
    if (o.label != null) b.textContent = label;
    var on = false;
    var armedLabel = o.armedLabel || label + '? Press again';
    function disarm() { if (!on) return; on = false; b.removeAttribute('data-armed'); b.textContent = label; if (loaded === b) loaded = null; }
    b.disarm = disarm; b.armed = function () { return on; };
    b.addEventListener('click', function () {
      if (!on) {
        if (loaded && loaded !== b) loaded.disarm();
        on = true; loaded = b; b.setAttribute('data-armed', 'yes'); b.textContent = armedLabel;
        if (o.api && typeof o.api.armUntilElsewhere === 'function') o.api.armUntilElsewhere(disarm);
        return;
      }
      disarm();
      if (typeof o.run === 'function') o.run();
    });
    return b;
  }
  function create(o) { var b = document.createElement('button'); b.type = 'button'; if (o && o.title) b.title = o.title; if (o && o.className) b.className = o.className; return attach(b, o); }
  return { attach: attach, create: create };
}

// ── EVERY ARE-YOU-SURE IS AN armingButton (goal/G41.9) ───────────────────────────────────────────────────────────────
// The dialog is driven: mounted on a small page of its own, opened on an item, and each two-press button clicked twice.
// armingButton is a working stand-in that writes down every button it is handed; the node's desk is a recorder.
const vm = require('vm');

function ddWorld(facts, checks) {
  const document = makeDom();
  const made = [];
  const asked = [];
  const required = [];
  const closed = [];
  const api = { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    setScreenTitle: function () {}, closeDialog: function (x) { closed.push(x); }, onPublished: function () {}, armUntilElsewhere: function () {},
    // Every desk answer is "ok" (goal/G41.12, box v26: the API is all PUT); what the dialog draws is in spirit.data.
    verb: function (name, args) {
      asked.push({ name: name, args: args });
      return Promise.resolve({ status: 200, body: 'ok' });
    } };
  const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error,
    console: { log: function () {}, error: function () {}, warn: function () {} } };
  win.window = win;
  win.spirit = { escapeHtml: api.escapeHtml,
    require: function (p) { required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    elements: { armingButton: armingStub(document, made), deskRunStatus: function () { return ''; },
      probabilitySearch: { create: function () { return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } },
      // The desk's own copy (box v39; cw: shell/shared/js/deskSearch.js, spirit.elements.deskSearch).
      deskSearch: { create: function () { return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '', values: function () { return {}; } }; } } },
    shell: { activateApp: function (d) { win.def = d; } } };
  vm.createContext(win);
  // The page's cache: spirit.data and the desk's translator, filled as the stream fills it.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), win, { filename: 'spiritData.js' });
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'deskData.js'), 'utf8'), win, { filename: 'deskData.js' });
  const fill = win.spirit.deskData ? win.spirit.deskData.published : function () {};
  const goalId = facts.goal === '' ? facts.id : (facts.goal || 'goal/G9');
  if (goalId !== facts.id) fill({ verb: 'goal.whole', item: { id: goalId, goal: '', title: 'The goal', version: 1 } });
  fill({ verb: 'goal.whole', item: Object.assign({ version: 1 }, facts) });
  fill({ table: 'box', id: facts.id, row: { text: 'the box', version: 1 } });
  (checks || []).forEach(function (c) { fill({ table: 'checks', id: facts.id, row: c }); });
  // Every active rule comes on the stream, kept in deskRules (goal/G41.2).
  (facts.rules || []).forEach(function (r) { fill({ rule: r.key, row: { key: r.key, label: 'Rule ' + r.key, text: 'the text of ' + r.key, type: 'desk', status: 'active', version: r.version || 1 } }); });
  vm.runInContext(raw, win, { filename: FILE });
  const w = { document: document, made: made, asked: asked, required: required, closed: closed, api: api, win: win };
  w.open = async function () {
    win.def.mount(document.body.appendChild(document.createElement('div')), api);
    await win.def.open({ id: facts.id });
    await settle();
  };
  w.writes = function () { return asked.filter(function (a) { return /^desk\.(press|item\.delete|check\.set)$/.test(a.name); }); };
  return w;
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); }

// One two-press button, clicked twice: made by armingButton (handed the app's api, so the shell's click-elsewhere reaches
// it), saying today's armed wording, writing nothing on the first press and what it wrote before on the second.
async function twoPress(w, find, armedSays, want, what) {
  const before = w.writes().length;
  const b = find();
  if (!b) { test.fail(what + ': no such button in the dialog'); return; }
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && m.opts.api && typeof m.opts.api.armUntilElsewhere === 'function'; });
  w.document.click(b); await settle();
  const b1 = find();
  const armedText = b1 ? b1.textContent : '';
  const firstWrote = w.writes().length - before;
  w.document.click(b1 || b); await settle();
  const sent = w.writes().slice(before);
  const good = byElement && armedSays === armedText && firstWrote === 0 && sent.length === 1 && sent[0].name === want.name && JSON.stringify(sent[0].args) === JSON.stringify(want.args);
  ok(good, what + ': an armingButton saying "' + armedText + '" on the first press, ' + want.name + ' on the second',
    what + ': ' + JSON.stringify({ madeByArmingButton: byElement, armed: armedText, wroteOnFirst: firstWrote, sent: sent }));
}
const byId = function (w, id) { return function () { return w.document.getElementById(id); }; };

(async function () {
  test.subHeading('goal/G41.9: it loads armingButton and keeps no arming of its own');
  const plain = raw.replace(/\/\/[^\n]*/g, '');
  const GOAL = { id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: ['done', 'go-all', 'waive', 'delete', 'close'], verified: 'red', claims: 1, blocked: ['goal/G9.1'] };
  const w0 = ddWorld(GOAL, []);
  await w0.open();
  ok(w0.required.indexOf('shell/js/armingButton.js') !== -1, 'it requires shell/js/armingButton.js through spirit.require', 'required: ' + JSON.stringify(w0.required));
  const left = ['data-armed', 'armUntilElsewhere', 'ddArmed', 'ddDisarm', 'armedClose', 'armedAll', "classList.add('armed')"].filter(function (s) { return plain.indexOf(s) !== -1; });
  ok(!left.length, 'nothing hand-rolled is left: no data-armed, no armUntilElsewhere, no armed flag of its own', 'still in deskDetails.js: ' + left.join(', '));

  test.subHeading('goal/G41.9: each are-you-sure of a goal, pressed twice');
  const press = function (what) { return { name: 'desk.press', args: { id: 'goal/G9', what: what } }; };
  let w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-done'), 'Done anyway: sure?', press('done'), 'Done not verified green');
  w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-go-all'), 'Go all: sure?', press('go-all'), 'Go all');
  w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-waive'), 'Waive: sure?', press('waive'), 'Waive');
  w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-delete'), 'Delete: sure?', { name: 'desk.item.delete', args: { id: 'goal/G9' } }, 'Delete');
  w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-abandon'), 'Sure? Abandon the goal', press('abandon'), 'Abandon');
  w = ddWorld(GOAL, []); await w.open();
  await twoPress(w, byId(w, 'dd-close'), 'are you sure? 1 open', press('close'), 'Close on a goal with an item open');

  test.subHeading('goal/G41.9: an item\'s early Close, and the grants');
  const ITEM = { id: 'goal/G9.1', title: 'An item', goal: 'goal/G9', status: 'open', buttons: ['close'], verified: 'none', blocked: [] };
  w = ddWorld(ITEM, []); await w.open();
  await twoPress(w, byId(w, 'dd-close'), 'Close: sure?', { name: 'desk.press', args: { id: 'goal/G9.1', what: 'close' } }, 'Close on an open item');
  const CHECKS = [{ number: 'G1', kind: 'G', state: 'open', words: 'core grant' }, { number: 'G2', kind: 'G', state: 'open', words: 'another' }];
  const grants = async function () { const g = ddWorld(ITEM, CHECKS); await g.open(); g.document.click(g.document.querySelector('[data-panel="files"]')); await settle(); return g; };
  w = await grants();
  await twoPress(w, function () { return w.document.querySelector('[data-grant="G1"]'); }, 'Grant G1: sure?', { name: 'desk.check.set', args: { id: 'goal/G9.1', check: 'G1', state: 'granted' } }, 'Grant G1');
  w = await grants();
  await twoPress(w, function () { return w.document.querySelector('[data-grant="all"]'); }, 'Grant all 2: sure?', { name: 'desk.check.set', args: { id: 'goal/G9.1', check: 'all', state: 'granted' } }, 'Grant all');

  // ── goal/G41.11: THE LAST ONE-PRESS BUTTONS, AND THE RENAME ───────────────────────────────────────────────────────────
  // Andy, in the box: "the remove button for red Q's must ask: are-you-sure?", "the start-design and end-design buttons
  // in an item must ask: are-you-sure", and "the rename input field on goal/item detail panel MUST contain the current
  // title when it's first displayed." Each pressed through the dialog as he would.
  test.subHeading('goal/G41.11: a red Q\'s remove asks are-you-sure');
  // Any write of the dialog's, its red Q's clear (chat.add "Q1: clear") among them.
  const anyWrite = function (g) { return g.asked.filter(function (a) { return /^desk\.(press|item\.delete|check\.set|chat\.add|item\.rename)$/.test(a.name); }); };
  async function twoPressAny(g, find, want, what) {
    const before = anyWrite(g).length;
    const b = find();
    if (!b) { test.fail(what + ': no such button in the dialog'); return; }
    const byElement = g.made.some(function (m) { return m.button === b && m.opts && m.opts.api && typeof m.opts.api.armUntilElsewhere === 'function'; });
    g.document.click(b); await settle();
    const firstWrote = anyWrite(g).length - before;
    const b1 = find();
    const armed = !!(b1 && b1.hasAttribute('data-armed'));
    g.document.click(b1 || b); await settle();
    const sent = anyWrite(g).slice(before);
    const good = byElement && armed && firstWrote === 0 && sent.length === 1 && sent[0].name === want.name && JSON.stringify(sent[0].args) === JSON.stringify(want.args);
    ok(good, what + ': an armingButton, armed on the first press with nothing sent, ' + want.name + ' on the second',
      what + ': ' + JSON.stringify({ madeByArmingButton: byElement, armedAfterFirst: armed, wroteOnFirst: firstWrote, sent: sent }));
  }
  const QS = [{ number: 'Q1', kind: 'Q', state: 'open', words: 'Shall it?' }];
  const withQ = async function () { const g = ddWorld(ITEM, QS); await g.open(); g.document.click(g.document.querySelector('[data-panel="qs"]')); await settle(); return g; };
  w = await withQ();
  await twoPressAny(w, function () { return w.document.querySelector('[data-qclear="Q1"]'); }, { name: 'desk.chat.add', args: { id: 'goal/G9.1', text: 'Q1: clear' } }, 'A red Q\'s remove');

  test.subHeading('goal/G41.11: the details panel\'s Start and End design ask are-you-sure');
  const DESIGN = { id: 'goal/G9.2', title: 'In design', goal: 'goal/G9', status: 'open', buttons: ['end-design'], verified: 'none', blocked: [] };
  w = ddWorld(DESIGN, []); await w.open();
  await twoPressAny(w, byId(w, 'dd-end-design'), { name: 'desk.press', args: { id: 'goal/G9.2', what: 'end-design' } }, 'End design');
  const OUT = { id: 'goal/G9.3', title: 'Out of design', goal: 'goal/G9', status: 'open', buttons: ['start-design'], verified: 'none', blocked: [] };
  w = ddWorld(OUT, []); await w.open();
  await twoPressAny(w, byId(w, 'dd-start-design'), { name: 'desk.press', args: { id: 'goal/G9.3', what: 'start-design' } }, 'Start design');

  test.subHeading('goal/G41.11: the rename field opens holding the current title');
  for (const subject of [ITEM, GOAL]) {
    const g = ddWorld(subject, []); await g.open();
    const rename = g.document.getElementById('dd-rename');
    if (rename) { g.document.click(rename); await settle(); }
    const field = g.document.getElementById('dd-name');
    ok(!!field && field.value === subject.title, (subject.goal === '' ? 'a goal' : 'an item') + ': Rename opens its field holding "' + subject.title + '"',
      (subject.goal === '' ? 'a goal' : 'an item') + ': ' + (field ? 'the field holds "' + field.value + '"' : 'no rename field after Rename'));
    // What it holds is what he edits: Save sends the title as it stands, so an untouched field renames nothing new.
    const save = g.document.getElementById('dd-name-save');
    if (field && save) { field.value = subject.title + ' renamed'; g.document.click(save); await settle(); }
    const renamed = g.asked.filter(function (a) { return a.name === 'desk.item.rename'; }).pop();
    ok(!!renamed && renamed.args.title === subject.title + ' renamed', (subject.goal === '' ? 'a goal' : 'an item') + ': Save sends the edited title',
      (subject.goal === '' ? 'a goal' : 'an item') + ': renamed ' + JSON.stringify(renamed && renamed.args));
  }
  test.subHeading('goal/G41.11: the add-rule dropdown stands on top of the rules, and is always there');
  // Andy, on G41.11: "1. the add-rule dropdown is at the bottom of a (sometimes LONG) list, and it must be on top",
  // "2. Sometimes the dropdown does NOT appear at ALL!"
  const RULED = Object.assign({}, ITEM, { id: 'goal/G9.5', rules: Array.from({ length: 12 }, function (x, i) { return { key: 'rule/' + (i + 1), version: 1 }; }) });
  const walk = function (n, out) { out.push(n); (n.children || []).forEach(function (c) { walk(c, out); }); return out; };
  const shown = function (n) { for (let p = n; p; p = p.parentNode) { if (p.hidden || (p.style && p.style.display === 'none')) return false; } return true; };
  const inPage = function (w, n) { return walk(w.document.root, []).indexOf(n) !== -1; };
  // A search that writes down where it was made; on the page, as spirit.require brings it, never preloaded.
  const ruleWorld = function () {
    const r = ddWorld(RULED, []);
    r.searches = [];
    const make = { create: function (host, o) { r.searches.push({ host: host, o: o || {} }); return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } };
    delete r.win.spirit.elements.probabilitySearch;
    delete r.win.spirit.elements.deskSearch;
    const req = r.win.spirit.require;
    // The shell's search, or the desk's own copy (box v39; cw: shell/shared/js/deskSearch.js, spirit.elements.deskSearch).
    r.win.spirit.require = function (p) {
      const q = String(p).replace(/^\/+/, '');
      if (q === 'shell/js/probabilitySearch.js') r.win.spirit.elements.probabilitySearch = make;
      if (q === 'shell/shared/js/deskSearch.js') r.win.spirit.elements.deskSearch = make;
      return req(p);
    };
    return r;
  };
  // The rule pick: a dropdown, asking rules.search or, on the desk's own copy, no verb at all (box v39).
  const rulePick = function (r) { return r.searches.filter(function (x) { return x.o.face === 'dropdown' && (x.o.verb === 'rules.search' || !x.o.verb); }).pop() || null; };
  const rulesIcon = function (r) { return r.document.querySelector('[data-panel="rules"]'); };
  const rw = ruleWorld(); await rw.open();
  if (rulesIcon(rw)) { rw.document.click(rulesIcon(rw)); await settle(); }
  const pick = rulePick(rw);
  const firstRule = rw.document.querySelector('[data-rule-remove]');
  const order = walk(rw.document.root, []);
  ok(!!pick && inPage(rw, pick.host) && shown(pick.host), 'pressing the rules icon shows the add-rule dropdown, its search brought by spirit.require',
    'no dropdown shown: ' + JSON.stringify({ made: rw.searches.length, required: rw.required.filter(function (x) { return /probabilitySearch|deskSearch/.test(x); }) }));
  ok(!!pick && !!firstRule && order.indexOf(pick.host) !== -1 && order.indexOf(pick.host) < order.indexOf(firstRule), 'it stands on top of the list of rules (12 rules attached), not below it',
    'dropdown at ' + (pick ? order.indexOf(pick.host) : 'none') + ', first rule at ' + order.indexOf(firstRule));
  const scriptTags = walk(rw.document.root, []).filter(function (n) { return n.tagName === 'SCRIPT' || n.tag === 'script'; }).filter(function (n) { return /probabilitySearch|deskSearch/.test(String((n.attrs && n.attrs.src) || n.src || '')); });
  ok(!scriptTags.length, 'no hand-rolled script tag loads the search', scriptTags.length + ' script tag(s) for probabilitySearch');
  // Away to the box and back: the dropdown is there again, every time the panel opens.
  const boxIcon = rw.document.querySelector('[data-panel="box"]');
  if (boxIcon) { rw.document.click(boxIcon); await settle(); }
  if (rulesIcon(rw)) { rw.document.click(rulesIcon(rw)); await settle(); }
  const again = rulePick(rw);
  ok(!!again && inPage(rw, again.host) && shown(again.host), 'away from the rules and back, the dropdown is shown again', 'after reopening: ' + JSON.stringify({ made: rw.searches.length, shown: !!again && shown(again.host) }));
  test.subHeading('goal/G41.11: a new chat line is put in on top; the lines shown stay as they are');
  // Andy, on G41.11: "in ALL the chats, new lines are no added, THE WHOLE FUCKING THING IS REDRAWN, killing my attempted
  // copies". A line already shown is the same element after a new line comes and after any other repaint.
  const CHATTY = Object.assign({}, ITEM, { id: 'goal/G9.6' });
  const L1 = { by: 'andy', at: '2026-10-27T10:00:00.000Z', text: 'the first line' };
  const L2 = { by: 'claude-windows', at: '2026-10-27T10:01:00.000Z', text: 'the second line' };
  const L3 = { by: 'wsl-claude', at: '2026-10-27T10:02:00.000Z', text: 'the third line' };
  const cw = ddWorld(CHATTY, []);
  let heard = null;
  cw.api.onPublished = function (fn, from) { if (from === 'desk' || !heard) heard = fn; return function () {}; };
  const verbBefore = cw.api.verb;
  cw.api.verb = function (name, args) { if (name === 'desk.item.chat') return Promise.resolve({ status: 200, body: { chat: [L1, L2] } }); return verbBefore(name, args); };
  await cw.open();
  const log = function () { return cw.document.getElementById('dd-chat'); };
  const shownNow = function () { return (log() ? log().children : []).filter(function (b) { return /the (first|second|third) line/.test(b.textContent); }); };
  const before = shownNow();
  ok(before.length === 2 && /second/.test(before[0].textContent), 'it opens with the two lines, newest first', 'shown: ' + JSON.stringify(before.map(function (b) { return b.textContent; })));
  if (heard) { heard({ change: 50, table: 'chat', id: CHATTY.id, row: L3 }); await settle(); }
  const afterLine = shownNow();
  ok(afterLine.length === 3 && /third/.test(afterLine[0].textContent), 'a new line on the stream is put in on top', 'shown: ' + JSON.stringify(afterLine.map(function (b) { return b.textContent; })));
  ok(afterLine.length === 3 && afterLine[1] === before[0] && afterLine[2] === before[1], 'the two lines already shown are the same elements as before: not drawn again',
    'drawn again: ' + JSON.stringify({ second: afterLine[1] === before[0], first: afterLine[2] === before[1] }));
  if (heard) { heard({ change: 51, table: 'checks', id: CHATTY.id, row: { number: 'G1', kind: 'G', state: 'open', words: 'core grant' } }); await settle(); }
  const afterOther = shownNow();
  ok(afterOther.length === 3 && afterOther[0] === afterLine[0] && afterOther[1] === before[0] && afterOther[2] === before[1],
    'a change that is no chat line (a check) repaints the panel and leaves every chat line as it was', 'drawn again by a check');
  test.subHeading('goal/G41.11: the rules panel scrolls inside its own box, the frame never cuts it off');
  // Andy: "the rules list is NOT placed properly in a size-limited container". The upper half is fixed at 30vh with its
  // overflow hidden; what bounds the rules is a box of its own that scrolls, so a long list is never cut off unseen.
  const rf = ddWorld(Object.assign({}, ITEM, { id: 'goal/G9.6', rules: Array.from({ length: 30 }, function (x, i) { return { key: 'rule/' + (i + 1), version: 1 }; }) }), []);
  await rf.open();
  const icon = rf.document.querySelector('[data-panel="rules"]');
  if (icon) { rf.document.click(icon); await settle(); }
  const firstRuleRow = rf.document.querySelector('[data-rule-remove]');
  let bound = null;
  for (let n = firstRuleRow; n; n = n.parentNode) { const st = String((n.attrs && n.attrs.style) || ''); if (/overflow\s*:\s*(hidden|auto|scroll)/.test(st)) { bound = { id: n.id, style: st }; break; } }
  ok(!!bound && /overflow\s*:\s*(auto|scroll)/.test(bound.style), 'the first box that bounds the rules scrolls (overflow auto), not the frame\'s hidden overflow', 'bounded by: ' + JSON.stringify(bound));

  // ── goal/G41.12, box v26-v35: THE PAGE READS NOTHING FROM THE DESK ─────────────────────────────────────────────────
  // Andy: "The client PUTs and the server STREAMs: the client always has all available information about the server's
  // state in its (persisted) cache, and reads nothing from the server"; every request, "the owner's or a peer's", is
  // answered "ok"; "the UI for desk is tested fully". The page's cache is spirit.data with the desk's translator.
  test.subHeading('goal/G41.12: the detail reads nothing from the desk, it draws from spirit.data');
  const READS = ['item.get', 'item.box', 'item.chat', 'item.checks', 'item.files', 'items.search', 'chat.search', 'rules.search', 'rule.get', 'profile.get', 'item.suites.search', 'item.checks.search', 'item.rules.search', 'log.search', 'changes'];
  const readsIn = function (text) { return READS.filter(function (v) { return new RegExp('[\'"`](desk\\.)?' + v.replace(/\./g, '\\.') + '[\'"`]').test(text); }); };
  ok(readsIn(code).length === 0, 'deskDetails.js asks the desk no read verb', 'deskDetails.js names: ' + readsIn(code).join(', '));
  const put = ddWorld(Object.assign({}, ITEM, { id: 'goal/G9.8', title: 'An item from the stream' }), []);
  // The desk answers "ok" to everything; what the page knows is what the stream put in spirit.data.
  put.api.verb = function (name, args) { put.asked.push({ name: name, args: args }); return Promise.resolve({ status: 200, body: 'ok' }); };
  // The stream as the shell hands it to the app (api.onPublished), and as the translator takes it into spirit.data.
  const putHearers = [];
  // The title is painted to the shell's title bar (api.setScreenTitle, goal/G9.6), not into the body.
  const putTitles = [];
  put.api.setScreenTitle = function (t) { putTitles.push(String(t)); };
  const putTitleSays = function (re) { return putTitles.some(function (t) { return re.test(t); }) || re.test(put.document.body.textContent); };
  put.api.onPublished = function (fn) { putHearers.push(fn); return function () {}; };
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), put.win, { filename: 'spiritData.js' });
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'deskData.js'), 'utf8'), put.win, { filename: 'deskData.js' });
  const PD = put.win.spirit.data;
  const fed = !!(PD && put.win.spirit.deskData);
  if (fed) {
    put.win.spirit.deskData.published({ verb: 'goal.whole', item: { id: 'goal/G9', goal: '', title: 'The goal', version: 1 } });
    put.win.spirit.deskData.published({ verb: 'goal.whole', item: Object.assign({}, ITEM, { id: 'goal/G9.8', title: 'An item from the stream', version: 3 }) });
    put.win.spirit.deskData.published({ table: 'box', id: 'goal/G9.8', row: { text: 'a box the stream brought', version: 3 } });
    put.win.spirit.deskData.published({ table: 'chat', id: 'goal/G9.8', row: { by: 'andy', at: '2026-10-28T10:00:00.000Z', text: 'a line the stream brought' } });
  }
  ok(fed, 'the stand-in page holds spirit.data with the desk\'s translator', 'spirit.data ' + typeof PD + ', deskData ' + typeof put.win.spirit.deskData);
  await put.open();
  const putShown = put.document.body.textContent;
  ok(putTitleSays(/An item from the stream/) && /a box the stream brought/.test(putShown) && /a line the stream brought/.test(putShown), 'opened on the item, it shows its title, box and chat from spirit.data, though every desk answer is "ok"',
    'shown: ' + JSON.stringify({ title: putTitleSays(/An item from the stream/), box: /a box the stream brought/.test(putShown), chat: /a line the stream brought/.test(putShown) }));
  // Andy, box v37: "it will function flawlessly with all desk-state painted in real-time".
  test.subHeading('goal/G41.12: the open detail is painted in real time from the stream');
  const streamed = async function (row) { put.win.spirit.deskData.published(row); putHearers.slice().forEach(function (fn) { fn(row); }); await settle(); };
  if (fed) {
    await streamed({ table: 'box', id: 'goal/G9.8', row: { text: 'a box written while it is open', version: 4 } });
    await streamed({ table: 'chat', id: 'goal/G9.8', row: { by: 'claude-windows', at: '2026-10-28T10:05:00.000Z', text: 'a line written while it is open' } });
    await streamed({ verb: 'item.row', item: Object.assign({}, ITEM, { id: 'goal/G9.8', title: 'An item renamed on the stream', version: 5 }) });
  }
  const live = put.document.body.textContent;
  ok(/a box written while it is open/.test(live), 'a box row on the stream repaints the open detail\'s box', 'box shown: ' + /a box written while it is open/.test(live));
  ok(/a line written while it is open/.test(live) && /a line the stream brought/.test(live), 'a chat line on the stream joins the open chat', 'chat shown: ' + JSON.stringify({ newLine: /a line written while it is open/.test(live), old: /a line the stream brought/.test(live) }));
  ok(putTitleSays(/An item renamed on the stream/), 'its facts row on the stream repaints its title', 'titles painted: ' + JSON.stringify(putTitles.slice(-3)));
  const readsAsked = put.asked.filter(function (a) { return READS.indexOf(String(a.name).replace(/^desk\./, '')) !== -1; });
  ok(readsAsked.length === 0, 'and asks the desk nothing to draw it', 'asked: ' + JSON.stringify(readsAsked.map(function (a) { return a.name; })));

  // Andy, box v30: "The user get's a \"push\" button the the detail of every goal or item, to force a server push of
  // that item."
  test.subHeading('goal/G41.12: the push button in the detail of an item and of a goal');
  const pushOf = async function (w, id, what) {
    const find = function () { return w.document.querySelector('[data-press="push"]') || w.document.querySelectorAll('button').filter(function (b) { return /^\W*push\b/i.test(String(b.textContent || '').trim()); })[0] || null; };
    const before = w.writes().length;
    const b = find();
    if (!b) { test.fail(what + ': no push button in the detail'); return; }
    w.document.click(b); await settle();
    let sent = w.writes().slice(before);
    // An are-you-sure takes a second press; either way one press is sent.
    if (!sent.length && find()) { w.document.click(find()); await settle(); sent = w.writes().slice(before); }
    ok(sent.length === 1 && sent[0].name === 'desk.press' && sent[0].args && sent[0].args.id === id && sent[0].args.what === 'push', what + ': its push button sends desk.press {id, what: "push"}, once',
      what + ': sent ' + JSON.stringify(sent));
  };
  const pi = ddWorld(Object.assign({}, ITEM, { id: 'goal/G9.9' }), []);
  await pi.open();
  await pushOf(pi, 'goal/G9.9', 'an item');
  const pg = ddWorld({ id: 'goal/G9', title: 'The goal', goal: '', status: 'open', buttons: [], design: false, blocked: [], version: 1 }, []);
  await pg.open();
  await pushOf(pg, 'goal/G9', 'a goal');
  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
