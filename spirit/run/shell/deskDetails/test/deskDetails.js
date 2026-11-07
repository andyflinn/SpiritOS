'use strict';

// spirit/run/shell/deskDetails/test/deskDetails.js
// The tests of shell/deskDetails/deskDetails.js (spec: ./deskDetails.md). goal/G41.1: its panel icons are glyphs, drawn
// as they are, with no icon table, read from the module's own code. goal/G41.9: every are-you-sure it draws is an
// armingButton, driven on a page of its own. Then goal/G41.11, G41.22 (the workBench, push Goal, and in a real browser
// ./deskDetails-opened.html), G41.28 (the verifier's run through spirit.data), G43.3 and G43.22.

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
// That the strip, the workBench's (goal/G41.22), is handed each panel's glyph as it is, is asserted there: "the left
// strip is today's panels, each its icon, in order", on what the workBench is given, not on the source.

// ── THE PAGE THESE TESTS DRIVE (goal/G41.9) ─────────────────────────────────────────────────────────────────────────
// A small forgiving page: markup parsed into elements, with ids, attributes, closest and simple selectors, and a click
// that reaches every listener above its target.
const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
function makeDom() {
  const doc = {};
  function el(tag) {
    const attrs = {}; const heard = {};
    const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
      // Every box as if its content were ten times its height, scrolled to the top: what the app scrolls is seen.
      scrollTop: 0, scrollHeight: 1000, clientHeight: 100,
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

// A working armingButton, as its spec says (spirit/element/test/armingButton.md), that writes down every button it is handed.
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

// A working workBench, as its spec says (spirit/element/test/workBench.md), that writes down every bench it makes: its strips
// are buttons by data-tool, a click shows that tool in its side's pane, a tool's mount is called once with a box of its own.
function workBenchStub(document, benches) {
  function create(container, o) {
    o = o || {};
    const sides = { left: Array.isArray(o.left) ? o.left : [], right: Array.isArray(o.right) ? o.right : [] };
    const root = container.appendChild(document.createElement('div'));
    root.setAttribute('data-bench', 'yes');
    const strip = {}; const pane = {}; const boxes = { left: {}, right: {} }; const shown = { left: '', right: '' };
    if (sides.left.length) { strip.left = root.appendChild(document.createElement('div')); pane.left = root.appendChild(document.createElement('div')); }
    const center = root.appendChild(document.createElement('div'));
    center.setAttribute('data-bench-center', 'yes');
    if (sides.right.length) { pane.right = root.appendChild(document.createElement('div')); strip.right = root.appendChild(document.createElement('div')); }
    function press(side, name) {
      const t = sides[side].filter(function (x) { return x.name === name; })[0];
      if (!t) return;
      if (!boxes[side][name]) { boxes[side][name] = pane[side].appendChild(document.createElement('div')); if (typeof t.mount === 'function') t.mount(boxes[side][name]); }
      shown[side] = name;
      if (typeof o.changed === 'function') o.changed(side, name);
    }
    ['left', 'right'].forEach(function (side) {
      sides[side].forEach(function (t) {
        const b = strip[side].appendChild(document.createElement('button'));
        b.setAttribute('data-side', side); b.setAttribute('data-tool', t.name); b.textContent = t.icon;
        b.addEventListener('click', function () { press(side, t.name); });
      });
    });
    const bench = { container: container, opts: o, root: root, center: center, press: press,
      shown: function (side) { return shown[side]; }, width: function () { return 240; }, destroy: function () { container.innerHTML = ''; } };
    benches.push(bench);
    return bench;
  }
  return { create: create };
}
// A panel's icon, on today's strip (data-panel) or on the workBench's (data-tool).
function panelIcon(w, key) { return w.document.querySelector('[data-panel="' + key + '"]') || w.document.querySelector('[data-tool="' + key + '"]'); }

// ── EVERY ARE-YOU-SURE IS AN armingButton (goal/G41.9) ───────────────────────────────────────────────────────────────
// The dialog is driven: mounted on a small page of its own, opened on an item, and each two-press button clicked twice.
// armingButton is a working stand-in that writes down every button it is handed; the node's desk is a recorder.
const vm = require('vm');
const VERIFY_CCM = 'process/js/deskVerify/data.js';

function ddWorld(facts, checks, o) {
  const document = makeDom();
  const made = [];
  const asked = [];
  const required = [];
  const closed = [];
  const benches = [];
  const titles = [];
  const api = { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    setScreenTitle: function (t) { titles.push(String(t)); }, closeDialog: function (x) { closed.push(x); }, onPublished: function () {}, armUntilElsewhere: function () {},
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
    // workBench is on the page once spirit.require brings it, never preloaded.
    require: function (p) {
      const q = String(p).replace(/^\/+/, '');
      required.push(q);
      if (q === 'spirit/element/workBench.js') win.spirit.element.workBench = workBenchStub(document, benches);
      // The verifier's cache manager and the shared run status, the real ones, where the page's data set is (below).
      if (o && o.real && (q === VERIFY_CCM || q === 'shell/shared/js/deskRunStatus.js')) vm.runInContext(fs.readFileSync(path.join(RUN, q), 'utf8'), win, { filename: q });
      return Promise.resolve({});
    },
    get element() { return this.elements; }, elements: nestSearch({ armingButton: armingStub(document, made), deskRunStatus: function () { return ''; },
      'search': { create: function () { return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } } }),
    shell: { activateApp: function (d) { win.def = d; } } };
  vm.createContext(win);
  // THE PAGE'S ONE DATA SET, ITS NODE KNOWN (goal/G41.28, Q10), as spirit.start leaves it before any app runs, and the
  // run status the shared element draws, not a stand-in: what the verifier publishes reaches the page through spirit.data.
  if (o && o.real) {
    // A page, as spirit.js says it is in a browser: a page's stream is its own node's, and its home is never a sender's.
    win.spirit.isBrowser = function () { return true; };
    vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
    win.spirit.node = { key: 'KEY+DESK/DETAILS==' };
    win.spirit.data.homeNode(win.spirit.node.key);
    delete win.spirit.elements.deskRunStatus;
    if (o.kept) { vm.runInContext(fs.readFileSync(path.join(RUN, VERIFY_CCM), 'utf8'), win, { filename: VERIFY_CCM }); win.spirit.data.takeJob(o.kept); }
  }
  vm.runInContext(raw, win, { filename: FILE });
  const w = { document: document, made: made, asked: asked, required: required, closed: closed, api: api, win: win, benches: benches, titles: titles };
  w.open = async function () {
    win.def.mount(document.body.appendChild(document.createElement('div')), api);
    await win.def.open({ id: facts.id });
    await settle();
  };
  w.writes = function () { return asked.filter(function (a) { return /^desk\.(press|item\.delete|check\.set)$/.test(a.name); }); };
  return w;
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); }

// One two-press button, clicked twice: made by armingButton (handed no api: it hears a click elsewhere itself, goal/G43.24),
// saying today's armed wording, writing nothing on the first press and what it wrote before on the second.
async function twoPress(w, find, armedSays, want, what) {
  const before = w.writes().length;
  const b = find();
  if (!b) { test.fail(what + ': no such button in the dialog'); return; }
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
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
  ok(w0.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + JSON.stringify(w0.required));
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
  const grants = async function () { const g = ddWorld(ITEM, CHECKS); await g.open(); g.document.click(panelIcon(g, 'files')); await settle(); return g; };
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
    const byElement = g.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
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
  const withQ = async function () { const g = ddWorld(ITEM, QS); await g.open(); g.document.click(panelIcon(g, 'qs')); await settle(); return g; };
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
    delete r.win.spirit.element.search;
    const req = r.win.spirit.require;
    r.win.spirit.require = function (p) { const q = String(p).replace(/^\/+/, ''); if (q === 'spirit/element/search.js') r.win.spirit.element.search = make; return req(p); };
    return r;
  };
  const rulePick = function (r) { return r.searches.filter(function (x) { return x.o.verb === 'rules.search' && x.o.face === 'dropdown'; }).pop() || null; };
  const rulesIcon = function (r) { return panelIcon(r, 'rules'); };
  const rw = ruleWorld(); await rw.open();
  if (rulesIcon(rw)) { rw.document.click(rulesIcon(rw)); await settle(); }
  const pick = rulePick(rw);
  const firstRule = rw.document.querySelector('[data-rule-remove]');
  const order = walk(rw.document.root, []);
  ok(!!pick && inPage(rw, pick.host) && shown(pick.host), 'pressing the rules icon shows the add-rule dropdown, its search brought by spirit.require',
    'no dropdown shown: ' + JSON.stringify({ made: rw.searches.length, required: rw.required.filter(function (x) { return /probabilitySearch/.test(x); }) }));
  ok(!!pick && !!firstRule && order.indexOf(pick.host) !== -1 && order.indexOf(pick.host) < order.indexOf(firstRule), 'it stands on top of the list of rules (12 rules attached), not below it',
    'dropdown at ' + (pick ? order.indexOf(pick.host) : 'none') + ', first rule at ' + order.indexOf(firstRule));
  const scriptTags = walk(rw.document.root, []).filter(function (n) { return n.tagName === 'SCRIPT' || n.tag === 'script'; }).filter(function (n) { return /probabilitySearch/.test(String((n.attrs && n.attrs.src) || n.src || '')); });
  ok(!scriptTags.length, 'no hand-rolled script tag loads the search', scriptTags.length + ' script tag(s) for probabilitySearch');
  // Away to the box and back: the dropdown is there again, every time the panel opens.
  const boxIcon = panelIcon(rw, 'box');
  if (boxIcon) { rw.document.click(boxIcon); await settle(); }
  if (rulesIcon(rw)) { rw.document.click(rulesIcon(rw)); await settle(); }
  const again = rulePick(rw);
  ok(!!again && inPage(rw, again.host) && shown(again.host), 'away from the rules and back, the dropdown is shown again', 'after reopening: ' + JSON.stringify({ made: rw.searches.length, shown: !!again && shown(again.host) }));
  // ── goal/G41.22: THE DETAILS PANEL IS A workBench ─────────────────────────────────────────────────────────────────────
  // Andy, box v15: "the item panel drops appHeader", "the items ID and title, including status is shown in the shells
  // title bar like always", "one row, the button row, at the top, using the whole width, like it is today", "just use
  // workBench", "the left icons strip and panel, are what we have today", "the center panel us the chat", "the right
  // panel, we leave blank"
  const walkAll = function (n, out) { out.push(n); (n.children || []).forEach(function (c) { walkAll(c, out); }); return out; };
  const inside = function (n, box) { for (let p = n; p; p = p.parentNode) { if (p === box) return true; } return false; };
  // goal/G43.3: Andy: "red Q's should indicate who posted them."
  test.subHeading('goal/G43.3: a red Q says who posted it');
  {
    const asker = ddWorld(ITEM, [{ number: 'Q2', kind: 'Q', state: 'open', words: 'Whose question?', placedBy: 'claude-windows', placedKey: 'KEY-CW' }]);
    await asker.open();
    asker.document.click(panelIcon(asker, 'qs')); await settle();
    const qsText = asker.document.getElementById('dd-panel').textContent;
    ok(qsText.indexOf('Whose question?') !== -1 && qsText.indexOf('claude-windows') !== -1, 'the question and its poster both show', 'the panel says: ' + JSON.stringify(qsText.slice(0, 200)));
  }
  // goal/G43.3: Andy: "when i add a rule to an item or goal, it will not immediately display in the rule-list."
  test.subHeading('goal/G43.3: a rule attached shows in the open rules panel as its row comes, with nothing asked');
  for (const open of [ITEM, { id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: [], verified: 'none', blocked: [] }]) {
    const ruled = ddWorld(open, []);
    let heard = null;
    ruled.api.onPublished = function (fn) { heard = fn; return function () {}; };
    await ruled.open();
    ruled.document.click(panelIcon(ruled, 'rules')); await settle();
    const before = ruled.document.getElementById('dd-panel').textContent;
    const asked0 = ruled.asked.length;
    if (heard) heard({ item: Object.assign({}, open, { rules: [{ key: 'rule/77' }] }) });
    await settle();
    const after = ruled.document.getElementById('dd-panel').textContent;
    ok(!!heard && before.indexOf('rule/77') === -1 && after.indexOf('rule/77') !== -1 && !ruled.asked.slice(asked0).some(function (a) { return a.name === 'desk.item.get'; }),
      open.id + ': the new rule shows at once, from the row', open.id + ': heard ' + !!heard + ', the panel now: ' + JSON.stringify(after.slice(0, 200)));
  }

  test.subHeading('goal/G41.22: no appHeader; the id, title and status in the shell\'s title bar');
  ok(!/appHeader/.test(plain), 'deskDetails.js names no appHeader', 'deskDetails.js still names appHeader');
  const wt = ddWorld(Object.assign({}, ITEM, { id: 'goal/G9.7', title: 'A titled item', status: 'running' }), []); await wt.open();
  const lastTitle = wt.titles[wt.titles.length - 1] || '';
  ok(lastTitle.indexOf('goal/G9.7') !== -1 && lastTitle.indexOf('A titled item') !== -1 && lastTitle.indexOf('running') !== -1,
    'the shell\'s title bar says the id, the title and the status', 'the title bar was given ' + JSON.stringify(wt.titles));
  test.subHeading('goal/G41.22: one workBench, the button row above it');
  const wb = ddWorld(ITEM, []); await wb.open();
  ok(wb.required.indexOf('spirit/element/workBench.js') !== -1, 'it requires spirit/element/workBench.js through spirit.require', 'required: ' + JSON.stringify(wb.required));
  const bench = wb.benches[0] || null;
  ok(wb.benches.length === 1 && !!bench && inside(bench.container, wb.document.getElementById('dd-body')), 'it makes one workBench, inside its own body',
    'workBenches made: ' + wb.benches.length);
  const leftNames = bench ? (bench.opts.left || []).map(function (t) { return t.name + ' ' + t.icon; }) : [];
  const panelNames = (panels || []).map(function (p) { return p.key + ' ' + p.icon; });
  ok(!!bench && JSON.stringify(leftNames) === JSON.stringify(panelNames), 'the left strip is today\'s panels, each its icon, in order: ' + panelNames.join(', '),
    'the left strip: ' + JSON.stringify(leftNames) + ', today\'s panels: ' + JSON.stringify(panelNames));
  ok(!!bench && !(bench.opts.right || []).length, 'the right side is left blank: no tool on it', 'the right side has ' + JSON.stringify(bench && bench.opts.right));
  const row = wb.document.getElementById('dd-name-row');
  const benchOrder = walkAll(wb.document.root, []);
  ok(!!row && !!bench && !inside(row, bench.root) && benchOrder.indexOf(row) < benchOrder.indexOf(bench.root), 'the button row stands above the workBench, outside it, the whole width',
    'the button row: ' + (!row ? 'none' : !bench ? 'no workBench to stand above' : inside(row, bench.root) ? 'inside the workBench' : 'after the workBench'));
  if (bench) { const qsIcon = panelIcon(wb, 'qs'); if (qsIcon) { wb.document.click(qsIcon); await settle(); } }
  ok(!!bench && bench.shown('left') === 'qs' && !!wb.document.querySelector('[data-qclear], #dd-panel') && inside(wb.document.querySelector('[data-qclear], #dd-panel'), bench.root),
    'a left icon shows its panel in the workBench\'s left pane', 'after the red Qs icon: ' + JSON.stringify({ shown: bench && bench.shown('left') }));
  // goal/G43.22, Andy: "take out the chat-search do, it's not actually usable.": the centre is the chat and its input, no search.
  test.subHeading('goal/G41.22: the centre is the chat, its input at the bottom; goal/G43.22: no chat search');
  const centre = bench ? bench.center : null;
  const chatLog = wb.document.getElementById('dd-chat');
  const say = wb.document.getElementById('dd-say');
  ok(!!centre && [chatLog, say].every(function (n) { return n && inside(n, centre); }), 'the chat and its input are in the workBench\'s centre',
    'in the centre: ' + JSON.stringify({ chat: !!(chatLog && centre && inside(chatLog, centre)), input: !!(say && centre && inside(say, centre)) }));
  ok(!wb.document.getElementById('dd-chat-find'), 'goal/G43.22: there is no chat search', 'a chat search is still drawn');
  const order2 = walkAll(wb.document.root, []);
  ok(!!chatLog && !!say && order2.indexOf(chatLog) < order2.indexOf(say), 'top to bottom: the chat, the input',
    'positions: ' + JSON.stringify({ chat: order2.indexOf(chatLog), input: order2.indexOf(say) }));
  const sayStyle = String((say && say.attrs && say.attrs.style) || '');
  ok(/resize\s*:\s*vertical/.test(sayStyle), 'the chat input can be sized up and down only (resize: vertical)', 'the input\'s style: ' + JSON.stringify(sayStyle));

  test.subHeading('goal/G41.22: newest line at the bottom, pinned there; the lines shown stay as they are');
  // Andy, box v15: "scrolls upward, not downward. that means, newest lines at the bottom, pinned to the bottom, and older
  // lines above." And G41.11, kept: "in ALL the chats, new lines are no added, THE WHOLE FUCKING THING IS REDRAWN, killing
  // my attempted copies": a line already shown is the same element after a new line comes and after any other repaint.
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
  // What he sees, top to bottom: the lines in their order, turned round where a box shows them reversed (column-reverse).
  const reversed = function () { for (let p = log(); p; p = p.parentNode) { if (/flex-direction\s*:\s*column-reverse/.test(String((p.attrs && p.attrs.style) || '') + ' ' + String((p.style && p.style.flexDirection) || ''))) return true; } return false; };
  const shownNow = function () { const l = (log() ? log().children : []).filter(function (b) { return /the (first|second|third) line/.test(b.textContent); }); return reversed() ? l.slice().reverse() : l; };
  // Pinned to the bottom: a box between the lines and the centre scrolled to its end, or one showing them reversed.
  const pinned = function () { if (reversed()) return true; for (let p = log(); p && p !== cw.document.root; p = p.parentNode) { if (p.scrollTop >= p.scrollHeight - p.clientHeight) return true; } return false; };
  const words = function (l) { return JSON.stringify(l.map(function (b) { return b.textContent.replace(/[\s\S]*(the \w+ line)[\s\S]*/, '$1'); })); };
  const before = shownNow();
  ok(before.length === 2 && /first/.test(before[0].textContent) && /second/.test(before[1].textContent), 'it opens with the two lines, the newest at the bottom', 'top to bottom: ' + words(before));
  ok(pinned(), 'it opens pinned to the bottom, at the newest line', 'no box of the chat is scrolled to its end');
  if (heard) { heard({ change: 50, table: 'chat', id: CHATTY.id, row: L3 }); await settle(); }
  const afterLine = shownNow();
  ok(afterLine.length === 3 && /third/.test(afterLine[2].textContent), 'a new line on the stream is put in at the bottom', 'top to bottom: ' + words(afterLine));
  ok(pinned(), 'after a new line it is pinned to the bottom still', 'no box of the chat is scrolled to its end after the new line');
  ok(afterLine.length === 3 && afterLine[0] === before[0] && afterLine[1] === before[1], 'the two lines already shown are the same elements as before: not drawn again',
    'drawn again: ' + JSON.stringify({ first: afterLine[0] === before[0], second: afterLine[1] === before[1] }));
  if (heard) { heard({ change: 51, table: 'checks', id: CHATTY.id, row: { number: 'G1', kind: 'G', state: 'open', words: 'core grant' } }); await settle(); }
  const afterOther = shownNow();
  ok(afterOther.length === 3 && afterOther[0] === before[0] && afterOther[1] === before[1] && afterOther[2] === afterLine[2],
    'a change that is no chat line (a check) repaints the panel and leaves every chat line as it was', 'drawn again by a check');
  test.subHeading('goal/G41.11: the rules panel scrolls inside its own box, the frame never cuts it off');
  // Andy: "the rules list is NOT placed properly in a size-limited container". The left pane hides its overflow; what
  // bounds the rules is a box of its own that scrolls, so a long list is never cut off unseen.
  const rf = ddWorld(Object.assign({}, ITEM, { id: 'goal/G9.6', rules: Array.from({ length: 30 }, function (x, i) { return { key: 'rule/' + (i + 1), version: 1 }; }) }), []);
  await rf.open();
  const icon = panelIcon(rf, 'rules');
  if (icon) { rf.document.click(icon); await settle(); }
  const firstRuleRow = rf.document.querySelector('[data-rule-remove]');
  let bound = null;
  for (let n = firstRuleRow; n; n = n.parentNode) { const st = String((n.attrs && n.attrs.style) || ''); if (/overflow\s*:\s*(hidden|auto|scroll)/.test(st)) { bound = { id: n.id, style: st }; break; } }
  ok(!!bound && /overflow\s*:\s*(auto|scroll)/.test(bound.style), 'the first box that bounds the rules scrolls (overflow auto), not the frame\'s hidden overflow', 'bounded by: ' + JSON.stringify(bound));

  // ── goal/G41.22: PUSH GOAL ON THE CURRENT GOAL AND ITS ITEMS ──────────────────────────────────────────────────────────
  // Andy: "the current goal and all its items, get a new button in the detail panel: "push Goal", the ver on the desk is:
  // "pushgoal"". The dialog decides nothing (its header): the desk offers pushgoal in an item's buttons on the current
  // goal and on each of its items, as it offers make-current on a goal that is not current; the dialog draws it from
  // there, and its press is the desk's verb pushgoal, desk.pushgoal as ddAsk names every verb.
  test.subHeading('goal/G41.22: push Goal on the current goal and its items, the desk\'s verb pushgoal');
  const pushButton = function (g) { return g.document.querySelectorAll('button').filter(function (b) { return /^push goal/i.test(b.textContent.trim()) || b.hasAttribute('data-armed') && /push goal/i.test(b.id + ' ' + (b.getAttribute('data-arming') || '')); })[0] || null; };
  const pushes = function (g) { return g.asked.filter(function (a) { return a.name === 'desk.pushgoal'; }); };
  // Pressed as he would: once, and once more only if the first press armed it (an are-you-sure is the build's to choose).
  const pushed = async function (g) {
    const b = pushButton(g);
    if (!b) return null;
    g.document.click(b); await settle();
    const again = pushButton(g) || b;
    if (!pushes(g).length && again.hasAttribute('data-armed')) { g.document.click(again); await settle(); }
    return pushes(g);
  };
  const CURRENT_GOAL = Object.assign({}, GOAL, { buttons: GOAL.buttons.concat(['pushgoal']) });
  const CURRENT_ITEM = Object.assign({}, ITEM, { buttons: ITEM.buttons.concat(['pushgoal']) });
  for (const subject of [CURRENT_GOAL, CURRENT_ITEM]) {
    const what = subject.goal === '' ? 'the current goal' : 'an item of the current goal';
    const g = ddWorld(subject, []); await g.open();
    const b = pushButton(g);
    ok(!!b && b.textContent.trim() === 'push Goal' && inside(b, g.document.getElementById('dd-name-row')), what + ': the button row has a "push Goal" button',
      what + ': ' + (b ? 'a button reading "' + b.textContent.trim() + '"' + (inside(b, g.document.getElementById('dd-name-row')) ? '' : ', outside the button row') : 'no push Goal button'));
    const sent = await pushed(g);
    ok(!!sent && sent.length === 1 && !g.asked.some(function (a) { return a.name === 'desk.press' && a.args && a.args.what === 'pushgoal'; }),
      what + ': pressing push Goal sends the desk\'s verb pushgoal (desk.pushgoal), once, and no press',
      what + ': ' + (sent ? 'desk.pushgoal sent ' + sent.length + ' times' : 'no button to press') + '; writes: ' + JSON.stringify(anyWrite(g)));
  }
  // No pushgoal offered: a goal that is not current, and an item of one, draw no push Goal (as it stands today too).
  for (const subject of [GOAL, ITEM]) {
    const what = subject.goal === '' ? 'a goal that is not current' : 'an item of a goal that is not current';
    const g = ddWorld(subject, []); await g.open();
    const b = pushButton(g);
    ok(!b && !pushes(g).length, what + ': no push Goal button, nothing pushed', what + ': ' + (b ? 'a button reading "' + b.textContent.trim() + '"' : '') + ' ' + JSON.stringify(pushes(g)));
  }
  // ── goal/G41.28: THE VERIFIER'S RUN, THROUGH SPIRIT.DATA ────────────────────────────────────────────────────────────
  // Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the spirit
  // object". The run of this item (goal/G33.6) is the verifier's own publish, kept by its family's cache manager; the
  // dialog loads that manager itself and draws the run from spirit.data.deskVerify.data, through the shared run status.
  test.subHeading('goal/G41.28: the verifier\'s run reaches the dialog through spirit.data');
  const RUNNING = { id: 'goal/G9.1', title: 'An item', goal: 'goal/G9', status: 'open', buttons: [], verified: 'none', verifyRunning: true, blocked: [] };
  const runJob = function (o2) { return Object.assign({ id: 'job_verify', type: 'publish', module: 'process/js/deskVerify' }, o2); };
  const RUN1 = { doing: 'run', suite: 'spirit/run/spirit/app/info/test/info.js', index: 2, of: 4, tests: 0, expected: 0, line: '', since: '' };
  const runShown = function (g) { const el = g.document.getElementById('dd-run'); return el ? el.textContent : ''; };
  let v = ddWorld(RUNNING, [], { real: true }); await v.open();
  ok(v.required.indexOf(VERIFY_CCM) !== -1 && !!((v.win.spirit.data || {}).deskVerify || {}).data, 'it loads the verifier\'s cache manager itself, ' + VERIFY_CCM, 'required: ' + JSON.stringify(v.required));
  const runBefore = runShown(v);
  v.win.spirit.data.takeJob(runJob({ app: RUN1 })); await settle();
  ok(/verifying info\.js, suite 2 of 4/.test(runShown(v)) && !!v.document.getElementById('dd-run') && !!v.document.getElementById('dd-run').querySelector('progress'), 'a verifier publish taken into spirit.data redraws the run: its progress, its suite and how far',
    'the run before: "' + runBefore + '", after the publish: "' + runShown(v) + '"');
  v.win.spirit.data.takeJob(runJob({ app: Object.assign({}, RUN1, { index: 3 }) })); await settle();
  ok(/suite 3 of 4/.test(runShown(v)), 'the next publish redraws it again', 'the run: "' + runShown(v) + '"');
  v = ddWorld(RUNNING, [], { real: true, kept: runJob({ app: RUN1 }) }); await v.open();
  ok(/verifying info\.js, suite 2 of 4/.test(runShown(v)), 'a run already kept in spirit.data when it opens is drawn at once', 'the run at open: "' + runShown(v) + '"');
  v = ddWorld(RUNNING, [], { real: true }); await v.open();
  v.win.spirit.data.takeJob(runJob({ fromNode: 'KEY+ANOTHER/NODE==', app: RUN1 })); await settle();
  ok(!/verifying/.test(runShown(v)), 'a publish of another node\'s verifier draws nothing here', 'the run: "' + runShown(v) + '"');
  v = ddWorld(RUNNING, [], { real: true }); await v.open();
  v.win.spirit.data.takeJob(runJob({ app: { suite: 'x.js', index: 1, of: 2 } })); await settle();
  ok(!/verifying/.test(runShown(v)), 'a publish saying no doing draws nothing', 'the run: "' + runShown(v) + '"');

  // ── goal/G41.22: OPENED ON AN ITEM, IN A REAL BROWSER ─────────────────────────────────────────────────────────────────
  // The page above has no layout, so what fills and what scrolls is asked of Chrome (a chat short of its bottom, no left
  // panel at open, or a box a third of its pane, pass the page above):
  // ./deskDetails-opened.html, on a scratch node with its DEBUG on, opens the panel in the home page's app area on an item
  // with 200 chat lines and a long box.
  const OPENED = '/DEBUG/shell/deskDetails/test/deskDetails-opened.html';
  test.subHeading(OPENED.slice('/DEBUG'.length) + ': opened on an item, in the home page\'s app area');
  const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
  const chrome = H.findChrome();
  if (!chrome) test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name');
  else {
    const node = await H.scratchNode();
    let page = null;
    try {
      page = node.up && node.debug ? await H.chromePage(chrome) : null;
      if (!page || page.error) test.fail(page ? page.error : 'the scratch node did not come up with its DEBUG on');
      else {
        await page.send('Page.navigate', { url: node.base + OPENED });
        await H.until(function () { return page.evaluate('typeof window.opened === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
        const s = await page.evaluate('window.opened()').catch(function () { return ''; });
        let m = null;
        try { m = JSON.parse(s); } catch (e) { m = null; }
        if (!m) test.fail('the page measured nothing: ' + String(s).slice(0, 200));
        else {
          ok(!m.scrolls && !!m.say && m.say.bottom <= m.window, 'the page does not scroll, and the chat input is on screen (its bottom ' + (m.say && m.say.bottom) + ' of ' + m.window + ')',
            'the page scrolls, or the input is off screen: ' + JSON.stringify({ scrolls: m.scrolls, input: m.say, window: m.window }));
          ok(!!m.chatEnd && m.chatEnd.top >= m.chatEnd.end - 1, 'the chat is pinned to its bottom: scrolled to its end',
            'the chat is scrolled to ' + JSON.stringify(m.chatEnd));
          ok(!!m.newest && /line 199/.test(m.newest.text) && !!m.chat && m.newest.bottom <= m.chat.bottom + 1, 'the newest line is the last, and shows whole at the bottom',
            'the newest line: ' + JSON.stringify(m.newest) + ', the chat ends at ' + JSON.stringify(m.chat));
          ok(!!m.leftShown && m.panelAtOpen > 0, 'at open a left panel shows (' + m.leftShown + '), as the details did before the workBench',
            'at open no left panel shows: ' + JSON.stringify({ shown: m.leftShown, height: m.panelAtOpen }));
          // goal/G43.3: the box on screen is a CodeMirror with line numbers, its last stored version above it.
          let v = null;
          try { v = JSON.parse(await page.evaluate('window.boxView()')); } catch (e) { v = null; }
          ok(!!v && v.codeMirror === true && v.numbers > 0, 'goal/G43.3: the box is a CodeMirror, showing line numbers', 'the box panel: ' + JSON.stringify(v));
          ok(!!v && /\b37\b/.test(String(v.above)), 'goal/G43.3: above the box stands its last stored version', 'above the box: ' + JSON.stringify(v && v.above));
          // goal/G43.22, Andy: "take out your search of the items text, the codeMirror search works better for editing purposes."
          ok(!!v && v.codeMirror === true && v.find === false, 'goal/G43.22: no find field beside the box; the box is a CodeMirror, with its own search', 'the box panel: ' + JSON.stringify(v));
          let t = null;
          try { t = JSON.parse(await page.evaluate('window.boxTake()')); } catch (e) { t = null; }
          ok(!!t && t.took === 1, 'goal/G43.3: going into that box takes it, as the textarea did', 'going in: ' + JSON.stringify(t));
          ok(!!t && !!t.wrote && t.wrote.text === 'his new text' && t.wrote.version === 37, 'goal/G43.3: leaving it changed writes his text, on the version it read', 'leaving it: ' + JSON.stringify(t));
          // goal/G43.3: Andy: "the rule-picker should default to all filters off."
          let rp = null;
          try { rp = JSON.parse(await page.evaluate('window.rulePick()')); } catch (e) { rp = null; }
          ok(!!rp && rp.buttons > 0 && rp.on.length === 0, 'goal/G43.3: the rule picker opens with all its type filters off', 'the picker: ' + JSON.stringify(rp));
          ok(!!rp && JSON.stringify(rp.afterOn) === '["code"]' && JSON.stringify(rp.afterTypes) === '["code"]', 'goal/G43.3: one type pressed: that filter alone is on, and the search asks for that type', 'after pressing code: ' + JSON.stringify(rp));
          // EVERY LEFT PANEL USES ALL THE HEIGHT (Andy, on G41.22: "the box must use the full vertical space", "all left
          // side panels must fucking use all available vertical space, especially the lists"): given long content, the
          // pane never scrolls itself; the panel's own list (the box's text) scrolls, its bottom at the pane's.
          for (const key of ['box', 'qs', 'files', 'rules', 'suites']) {
            let p = null;
            try { p = JSON.parse(await page.evaluate('window.panel(' + JSON.stringify(key) + ')')); } catch (e) { p = null; }
            ok(!!p && !p.error && !p.paneScrolls && !!p.scroller && p.scroller.bottom >= p.pane.bottom - 24 && p.scroller.bottom <= p.pane.bottom + 1,
              'the ' + key + ' panel, the first time its icon is pressed, uses all the height: its list scrolls in itself, down to the bottom of the pane',
              'the ' + key + ' panel, pressed the first time: ' + JSON.stringify(p));
            // THE GRANT ROW PINNED ON TOP (Andy: "the file panel must have the red gran button row pinned to the top and the
            // file list only using the remaining vertical space"): never in the list that scrolls, and it stays put.
            if (key === 'files') {
              ok(!!p && p.grantInList === false && p.grantBefore === p.grantAfter && !!p.scroller && p.grantBefore < p.scroller.top,
                'the files panel: the grant buttons stay pinned above the file list as it scrolls',
                'the files panel\'s grant row: ' + JSON.stringify(p && { inList: p.grantInList, before: p.grantBefore, after: p.grantAfter, list: p.scroller }));
            }
          }
        }
      }
    } finally {
      if (page && page.kid) page.kid.kill();
      if (node.child) node.child.kill();
      try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  }
  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
