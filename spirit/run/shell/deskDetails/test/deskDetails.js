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
    verb: function (name, args) {
      asked.push({ name: name, args: args });
      if (name === 'desk.item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(facts), version: 1, change: 1 } });
      if (name === 'desk.item.checks') return Promise.resolve({ status: 200, body: { checks: checks || [] } });
      if (name === 'desk.item.box') return Promise.resolve({ status: 200, body: { box: 'the box', version: 1 } });
      if (name === 'desk.item.chat') return Promise.resolve({ status: 200, body: { chat: [] } });
      if (name === 'desk.item.files') return Promise.resolve({ status: 200, body: { files: [] } });
      return Promise.resolve({ status: 200, body: { ok: true } });
    } };
  const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error,
    console: { log: function () {}, error: function () {}, warn: function () {} } };
  win.window = win;
  win.spirit = { escapeHtml: api.escapeHtml,
    require: function (p) { required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    elements: { armingButton: armingStub(document, made), deskRunStatus: function () { return ''; },
      probabilitySearch: { create: function () { return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } } },
    shell: { activateApp: function (d) { win.def = d; } } };
  vm.createContext(win);
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
  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
