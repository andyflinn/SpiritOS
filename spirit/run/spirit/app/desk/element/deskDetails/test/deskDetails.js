'use strict';

// spirit/run/spirit/app/desk/element/deskDetails/test/deskDetails.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: noFind, noSharedLeftovers.
// The tests of spirit/app/desk/element/deskDetails/deskDetails.js (spec: ./deskDetails.md). goal/G41.1: its panel icons are glyphs, drawn
// as they are, with no icon table, read from the module's own code. goal/G41.9: every are-you-sure it draws is an
// armingButton, driven on a page of its own. Then goal/G41.11, G41.22 (the workBench, and in a real browser
// ./deskDetails-opened.html), G43.3 and G43.22, and the verifier's removal (no Verify, no run, no suites, a plain Done).
// Every test is one test.run (goal/G47.2), run in the order written, each after the one before it: what a test makes for
// the tests after it (a page of its own, a scratch node, a Chrome page) it keeps in S.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'deskDetails.js');
const KEY = /^[A-Z_]+$/;

// What the tests make and the tests after them read: the module's code (raw, and with its comments out), its panels, the pages.
const S = {};

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

// A working armingButton, as its spec says (spirit/element/armingButton/test/script.md), that writes down every button it is handed.
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

// A working workBench, as its spec says (spirit/element/workBench/test/script.md), that writes down every bench it makes: its strips
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
      return Promise.resolve({ status: 200, body: { ok: true } });
    } };
  const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error,
    console: { log: function () {}, error: function () {}, warn: function () {} } };
  win.window = win;
  // EACH PART IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): armingButton, the search and workBench (brought when asked, never preloaded) as stand-ins, any other part an
  // empty object.
  const STANDS = {
    'spirit/element/armingButton/script.js': armingStub(document, made),
    'spirit/element/search/script.js': { create: function () { return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } },
    // fieldInput, tested in its own folder: a stand-in that holds a field to nothing.
    'spirit/element/fieldInput/script.js': { attach: function (el) { return el; } },
  };
  win.spirit = { escapeHtml: api.escapeHtml,
    stands: STANDS,
    requireScript: function (p) {
      const q = String(p).replace(/^\/+/, '');
      required.push(q);
      if (q === 'spirit/element/workBench/script.js' && !STANDS[q]) STANDS[q] = workBenchStub(document, benches);
      return Promise.resolve(Object.prototype.hasOwnProperty.call(STANDS, q) ? STANDS[q] : {});
    },
    required: { spirit: { app: {}, element: {} } },
  };
  // THE ROWS THE PAGE HOLDS (goal/G48.8: a goal's Close counts its open items "from the page's own rows"), when a case
  // hands some: the desk family's kept data, as spirit/app/desk/data.js gives it a page.
  if (o && o.kept) win.spirit.required.spirit.data = { desk: { data: { part: function () { return null; }, items: function () { return o.kept; }, forget: function () {} } } };
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit); what it does not know it hands to the requireScript above.
  SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit);
  vm.createContext(win);
  // Run as the page's loader runs it, in a module box; the dialog is what it sets as module.exports (goal/G49.9).
  const dialog = SPIRIT.requireScript('spirit/test/headLessChrome.js').runAsPage(FILE, win, S.raw);
  const w = { document: document, made: made, asked: asked, required: required, closed: closed, api: api, win: win, benches: benches, titles: titles };
  w.open = async function () {
    // THE ELEMENT (goal/G43.27, requirement 23): made in a layer over the Desk page, handed the page's way to the node.
    dialog.create(document.body.appendChild(document.createElement('div')), { id: facts.id, via: api });
    await settle();
  };
  w.writes = function () { return asked.filter(function (a) { return /^desk\.(press|item\.delete|check\.set)$/.test(a.name); }); };
  return w;
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); }

// One two-press button, clicked twice: made by armingButton (handed no api: it hears a click elsewhere itself, goal/G43.24),
// saying today's armed wording, writing nothing on the first press and what it wrote before on the second.
async function twoPress(w, find, armedSays, want) {
  const before = w.writes().length;
  const b = find();
  if (!b) return { good: false };
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
  w.document.click(b); await settle();
  const b1 = find();
  const armedText = b1 ? b1.textContent : '';
  const firstWrote = w.writes().length - before;
  w.document.click(b1 || b); await settle();
  const sent = w.writes().slice(before);
  const good = byElement && armedSays === armedText && firstWrote === 0 && sent.length === 1 && sent[0].name === want.name && JSON.stringify(sent[0].args) === JSON.stringify(want.args);
  return { good: good };
}
const byId = function (w, id) { return function () { return w.document.getElementById(id); }; };

// The verdict of a two-press: true or false.
function pressed(tp) { return tp.good ? true : false; }

// goal/G43.30: one two-press of a Close that is armed in any words but Close's own.
async function twoPressArmed(g, find, want) {
  const before = g.writes().length;
  const b = find();
  if (!b) return { good: false };
  const byElement = g.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
  g.document.click(b); await settle();
  const b1 = find();
  const armedText = b1 ? b1.textContent : '';
  const firstWrote = g.writes().length - before;
  g.document.click(b1 || b); await settle();
  const sent = g.writes().slice(before);
  const good = byElement && !!armedText && armedText !== 'Close' && firstWrote === 0 && sent.length === 1 && sent[0].name === want.name && JSON.stringify(sent[0].args) === JSON.stringify(want.args);
  return { good: good };
}
// goal/G41.11: any write of the dialog's, its red Q's clear (chat.add "Q1: clear") among them.
const anyWrite = function (g) { return g.asked.filter(function (a) { return /^desk\.(press|item\.delete|check\.set|chat\.add|item\.rename)$/.test(a.name); }); };
async function twoPressAny(g, find, want) {
  const before = anyWrite(g).length;
  const b = find();
  if (!b) return { good: false };
  const byElement = g.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
  g.document.click(b); await settle();
  const firstWrote = anyWrite(g).length - before;
  const b1 = find();
  const armed = !!(b1 && b1.hasAttribute('data-armed'));
  g.document.click(b1 || b); await settle();
  const sent = anyWrite(g).slice(before);
  const good = byElement && armed && firstWrote === 0 && sent.length === 1 && sent[0].name === want.name && JSON.stringify(sent[0].args) === JSON.stringify(want.args);
  return { good: good };
}

const GOAL = { id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: ['done', 'go-all', 'delete', 'close'] };
const ITEM = { id: 'goal/G9.1', title: 'An item', goal: 'goal/G9', status: 'open', buttons: ['close'] };
const press = function (what) { return { name: 'desk.press', args: { id: 'goal/G9', what: what } }; };
// A dialog opened on a subject; a press of a button in it.
async function opened(subject, checks, o) { const g = ddWorld(subject, checks || [], o); await g.open(); return g; }
async function goalPress(id, armedSays, want) { const w = await opened(GOAL); return pressed(await twoPress(w, byId(w, id), armedSays, want)); }

// ── THE PANELS NAME THEIR ICONS AS GLYPHS ───────────────────────────────────────────────────────────────────────────
// goal/G47.4, box v36: "The rules list on each goal and item goes": no rules panel among them.
test.run('the details list two panels: the box and the red Qs', 0.2, function () {
  S.raw = fs.readFileSync(FILE, 'utf8');
  S.code = S.raw.replace(/\/\/[^\n]*/g, '');
  S.plain = S.code;
  const at = /var DD_PANELS = (\[[\s\S]*?\n\]);/.exec(S.code);
  try { S.panels = at ? (new Function('return ' + at[1]))() : null; } catch (e) { S.panels = null; }
  const keys = Array.isArray(S.panels) ? S.panels.map(function (p) { return p.key; }) : null;
  return (!!keys && JSON.stringify(keys) === JSON.stringify(['box', 'qs'])) || false;
}, test.limit.quick);
test.run('every panel names its icon as the glyph itself', 0.2, function () {
  const keyed = (S.panels || []).filter(function (p) { return !p.icon || KEY.test(p.icon); });
  return (!!S.panels && !keyed.length) || false;
}, test.limit.quick);
// The strip draws them as they are, from no table.
test.run('deskDetails.js names no icon table', 0.2, function () {
  return !/iconIndex|\bICON\b/.test(S.code) || false;
}, test.limit.quick);
// That the strip, the workBench's (goal/G41.22), is handed each panel's glyph as it is, is asserted there: "the left
// strip is today's panels, each its icon, in order", on what the workBench is given, not on the source.

// ── goal/G41.9: IT LOADS armingButton AND KEEPS NO ARMING OF ITS OWN ────────────────────────────────────────────────
test.run('it requires spirit/element/armingButton/script.js through spirit.requireScript', 0.2, async function () {
  const w0 = await opened(GOAL);
  return w0.required.indexOf('spirit/element/armingButton/script.js') !== -1 || false;
}, test.limit.quick);
test.run('nothing hand-rolled is left: no data-armed, no armUntilElsewhere, no armed flag of its own', 0.2, function () {
  const left = ['data-armed', 'armUntilElsewhere', 'ddArmed', 'ddDisarm', 'armedClose', 'armedAll', "classList.add('armed')"].filter(function (s) { return S.plain.indexOf(s) !== -1; });
  return !left.length || false;
}, test.limit.quick);

// The box: "agents still claim done, only the user gets to actually press done. No verifier involvement with desk
// anywhere.": Done is a plain press, no mark, no arming; no Verify, no run, no suites.
test.run('Done is a plain press, with no warning mark and no arming, that sends desk.press done on the first press', 0.2, async function () {
  const w = await opened(GOAL);
  const b = w.document.getElementById('dd-done');
  if (!b) return false;
  const label = b.textContent;
  const armed = b.hasAttribute('data-arming');
  const before = w.writes().length;
  w.document.click(b); await settle();
  const sent = w.writes().slice(before);
  return (label === 'Done' && !armed && sent.length === 1 && JSON.stringify(sent[0]) === JSON.stringify(press('done'))) || false;
}, test.limit.quick);
test.run('no Verify button, no run and nothing of a verifier loaded, even where the facts offer verify', 0.2, async function () {
  const w = await opened(Object.assign({}, GOAL, { buttons: GOAL.buttons.concat(['verify']) }));
  const loaded = w.required.filter(function (r) { return /verif|RunStatus/i.test(r); });
  return (!w.document.getElementById('dd-verify') && !w.document.getElementById('dd-run') && !loaded.length) || false;
}, test.limit.quick);
test.run('it asks for no suites', 0.2, async function () {
  const w = await opened(ITEM);
  const asked = w.asked.filter(function (a) { return /suites/.test(a.name); }).map(function (a) { return a.name; });
  return (!asked.length && !panelIcon(w, 'suites')) || false;
}, test.limit.quick);
// goal/G41.9: each are-you-sure of a goal, pressed twice.
test.run('Go all is an arming button that says "Go all: sure?" on the first press and sends desk.press go-all on the second', 0.2, function () {
  return goalPress('dd-go-all', 'Go all: sure?', press('go-all'));
}, test.limit.quick);
test.run('Delete is an arming button that says "Delete: sure?" on the first press and sends desk.item.delete on the second', 0.2, function () {
  return goalPress('dd-delete', 'Delete: sure?', { name: 'desk.item.delete', args: { id: 'goal/G9' } });
}, test.limit.quick);
test.run('Abandon is an arming button that says "Sure? Abandon the goal" on the first press and sends desk.press abandon on the second', 0.2, function () {
  return goalPress('dd-abandon', 'Sure? Abandon the goal', press('abandon'));
}, test.limit.quick);
test.run('Close on a goal with an item open asks "are you sure? 1 open" on the first press and closes on the second', 0.2, async function () {
  // The page holds the goal's rows: one item open, one done.
  const w = await opened(GOAL, [], { kept: { 'goal/G9.1': { id: 'goal/G9.1', goal: 'goal/G9', status: 'open' }, 'goal/G9.2': { id: 'goal/G9.2', goal: 'goal/G9', status: 'done' } } });
  return pressed(await twoPress(w, byId(w, 'dd-close'), 'are you sure? 1 open', press('close')));
}, test.limit.quick);

// goal/G41.9: an item's early Close.
test.run('Close on an open item is an arming button that says "Close: sure?" on the first press and sends desk.press close on the second', 0.2, async function () {
  const w = await opened(ITEM);
  return pressed(await twoPress(w, byId(w, 'dd-close'), 'Close: sure?', { name: 'desk.press', args: { id: 'goal/G9.1', what: 'close' } }));
}, test.limit.quick);
// goal/G43.30, the box: "every Delete and every Close press in Desk (its rows, the item detail, the rule dialog) is an
// armingButton". It ends the one press of a done item's Close (desk/G3.8) and of a goal's with nothing open (goal/G6.6).
test.run('Close on a done item is an arming button, armed on the first press with nothing sent, that sends desk.press close on the second', 0.2, async function () {
  const w = await opened(Object.assign({}, ITEM, { status: 'done' }));
  return pressed(await twoPressArmed(w, byId(w, 'dd-close'), { name: 'desk.press', args: { id: 'goal/G9.1', what: 'close' } }));
}, test.limit.quick);
test.run('Close on a goal with nothing open only arms on the first press, and closes on the second', 0.2, async function () {
  const w = await opened({ id: 'goal/G8', title: 'A goal', goal: '', status: 'open', buttons: ['close'] });
  return pressed(await twoPressArmed(w, byId(w, 'dd-close'), { name: 'desk.press', args: { id: 'goal/G8', what: 'close' } }));
}, test.limit.quick);

// ── goal/G41.11: THE LAST ONE-PRESS BUTTONS, AND THE RENAME ───────────────────────────────────────────────────────────
// Andy, in the box: "the remove button for red Q's must ask: are-you-sure?", "the start-design and end-design buttons
// in an item must ask: are-you-sure", and "the rename input field on goal/item detail panel MUST contain the current
// title when it's first displayed." Each pressed through the dialog as he would.
const QS = [{ number: 'Q1', kind: 'Q', state: 'open', words: 'Shall it?' }];
test.run('a red Q\'s remove is an arming button, armed on the first press, that sends desk.chat.add on the second', 0.2, async function () {
  const w = await opened(ITEM, QS); w.document.click(panelIcon(w, 'qs')); await settle();
  return pressed(await twoPressAny(w, function () { return w.document.querySelector('[data-qclear="Q1"]'); }, { name: 'desk.chat.add', args: { id: 'goal/G9.1', text: 'Q1: clear' } }));
}, test.limit.quick);
// goal/G41.11: the details panel's Start and End design ask are-you-sure.
test.run('End design is an arming button, armed on the first press, that sends desk.press on the second', 0.2, async function () {
  const w = await opened({ id: 'goal/G9.2', title: 'In design', goal: 'goal/G9', status: 'open', buttons: ['end-design'] });
  return pressed(await twoPressAny(w, byId(w, 'dd-end-design'), { name: 'desk.press', args: { id: 'goal/G9.2', what: 'end-design' } }));
}, test.limit.quick);
test.run('Start design is an arming button, armed on the first press, that sends desk.press on the second', 0.2, async function () {
  const w = await opened({ id: 'goal/G9.3', title: 'Out of design', goal: 'goal/G9', status: 'open', buttons: ['start-design'] });
  return pressed(await twoPressAny(w, byId(w, 'dd-start-design'), { name: 'desk.press', args: { id: 'goal/G9.3', what: 'start-design' } }));
}, test.limit.quick);

// goal/G41.11: the rename field opens holding the current title. What it holds is what he edits: Save sends the title as
// it stands, so an untouched field renames nothing new.
async function renameOpens(subject) {
  const g = await opened(subject);
  S.renaming = g;
  const rename = g.document.getElementById('dd-rename');
  if (rename) { g.document.click(rename); await settle(); }
  const field = g.document.getElementById('dd-name');
  return (!!field && field.value === subject.title) || false;
}
async function renameSends(subject) {
  const g = S.renaming;
  if (!g) return false;
  const field = g.document.getElementById('dd-name');
  const save = g.document.getElementById('dd-name-save');
  if (field && save) { field.value = subject.title + ' renamed'; g.document.click(save); await settle(); }
  const renamed = g.asked.filter(function (a) { return a.name === 'desk.item.rename'; }).pop();
  return (!!renamed && renamed.args.title === subject.title + ' renamed') || false;
}
test.run('on an item, Rename opens its field holding the item\'s title, An item', 0.2, function () { return renameOpens(ITEM); }, test.limit.quick);
test.run('on an item, Save sends the edited title', 0.2, function () { return renameSends(ITEM); }, test.limit.quick);
test.run('on a goal, Rename opens its field holding the goal\'s title, A goal', 0.2, function () { return renameOpens(GOAL); }, test.limit.quick);
test.run('on a goal, Save sends the edited title', 0.2, function () { return renameSends(GOAL); }, test.limit.quick);

// goal/G41.11: the add-rule dropdown stands on top of the rules, and is always there.
// Andy, on G41.11: "1. the add-rule dropdown is at the bottom of a (sometimes LONG) list, and it must be on top",
// "2. Sometimes the dropdown does NOT appear at ALL!"
const RULED = Object.assign({}, ITEM, { id: 'goal/G9.5', rules: Array.from({ length: 12 }, function (x, i) { return { key: 'rule/' + (i + 1), version: 1 }; }) });
const walk = function (n, out) { out.push(n); (n.children || []).forEach(function (c) { walk(c, out); }); return out; };
const shown = function (n) { for (let p = n; p; p = p.parentNode) { if (p.hidden || (p.style && p.style.display === 'none')) return false; } return true; };
const inPage = function (w, n) { return walk(w.document.root, []).indexOf(n) !== -1; };
// A search that writes down where it was made; on the page, as spirit.requireScript brings it, never preloaded.
const ruleWorld = function () {
  const r = ddWorld(RULED, []);
  r.searches = [];
  const make = { create: function (host, o) { r.searches.push({ host: host, o: o || {} }); return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } };
  // The search requireScript answers (goal/G49.9): this one, in place of ddWorld's.
  r.win.spirit.stands['spirit/element/search/script.js'] = make;
  return r;
};
// RULES GO OUT OF DESK (goal/G47.4, box v36: "The rules list on each goal and item goes"; Andy: "go!"): the details panel
// has no rules icon, so no rule list can be opened, even for an item that still names rules.
test.run('the details panel has no rules icon', 0.2, async function () {
  const rw = ruleWorld(); await rw.open();
  S.rw = rw;
  return !panelIcon(rw, 'rules') || false;
}, test.limit.quick);

// ── goal/G41.22: THE DETAILS PANEL IS A workBench ─────────────────────────────────────────────────────────────────────
// Andy, box v15: "the item panel drops appHeader", "the items ID and title, including status is shown in the shells
// title bar like always", "one row, the button row, at the top, using the whole width, like it is today", "just use
// workBench", "the left icons strip and panel, are what we have today", "the center panel us the chat", "the right
// panel, we leave blank"
const walkAll = function (n, out) { out.push(n); (n.children || []).forEach(function (c) { walkAll(c, out); }); return out; };
const inside = function (n, box) { for (let p = n; p; p = p.parentNode) { if (p === box) return true; } return false; };
// goal/G43.3: Andy: "red Q's should indicate who posted them."
test.run('the question and its poster both show', 0.2, async function () {
  const asker = await opened(ITEM, [{ number: 'Q2', kind: 'Q', state: 'open', words: 'Whose question?', placedBy: 'claude-windows', placedKey: 'KEY-CW' }]);
  asker.document.click(panelIcon(asker, 'qs')); await settle();
  const qsText = asker.document.getElementById('dd-panel').textContent;
  return (qsText.indexOf('Whose question?') !== -1 && qsText.indexOf('claude-windows') !== -1) || false;
}, test.limit.quick);

// goal/G41.22: no appHeader; the id, title and status in the shell's title bar.
test.run('deskDetails.js names no appHeader', 0.2, function () {
  return !/appHeader/.test(S.plain) || false;
}, test.limit.quick);
test.run('the shell\'s title bar says the id, the title and the status', 0.2, async function () {
  const wt = await opened(Object.assign({}, ITEM, { id: 'goal/G9.7', title: 'A titled item', status: 'running' }));
  const lastTitle = wt.titles[wt.titles.length - 1] || '';
  return (lastTitle.indexOf('goal/G9.7') !== -1 && lastTitle.indexOf('A titled item') !== -1 && lastTitle.indexOf('running') !== -1) || false;
}, test.limit.quick);
// goal/G41.22: one workBench, the button row above it.
test.run('it requires spirit/element/workBench/script.js through spirit.requireScript', 0.2, async function () {
  const wb = S.wb = await opened(ITEM);
  S.bench = wb.benches[0] || null;
  return wb.required.indexOf('spirit/element/workBench/script.js') !== -1 || false;
}, test.limit.quick);
test.run('it makes one workBench, inside its own body', 0.2, function () {
  const wb = S.wb, bench = S.bench;
  if (!wb) return false;
  return (wb.benches.length === 1 && !!bench && inside(bench.container, wb.document.getElementById('dd-body'))) || false;
}, test.limit.quick);
test.run('the left strip is today\'s panels, each its icon, in order', 0.2, function () {
  const bench = S.bench;
  const leftNames = bench ? (bench.opts.left || []).map(function (t) { return t.name + ' ' + t.icon; }) : [];
  const panelNames = (S.panels || []).map(function (p) { return p.key + ' ' + p.icon; });
  return (!!bench && JSON.stringify(leftNames) === JSON.stringify(panelNames)) || false;
}, test.limit.quick);
test.run('the right side is left blank: no tool on it', 0.2, function () {
  const bench = S.bench;
  return (!!bench && !(bench.opts.right || []).length) || false;
}, test.limit.quick);
test.run('the button row stands above the workBench, outside it, the whole width', 0.2, function () {
  const wb = S.wb, bench = S.bench;
  if (!wb) return false;
  const row = wb.document.getElementById('dd-name-row');
  const benchOrder = walkAll(wb.document.root, []);
  return (!!row && !!bench && !inside(row, bench.root) && benchOrder.indexOf(row) < benchOrder.indexOf(bench.root)) || false;
}, test.limit.quick);
test.run('a left icon shows its panel in the workBench\'s left pane', 0.2, async function () {
  const wb = S.wb, bench = S.bench;
  if (!wb) return false;
  if (bench) { const qsIcon = panelIcon(wb, 'qs'); if (qsIcon) { wb.document.click(qsIcon); await settle(); } }
  return (!!bench && bench.shown('left') === 'qs' && !!wb.document.querySelector('[data-qclear], #dd-panel') && inside(wb.document.querySelector('[data-qclear], #dd-panel'), bench.root)) || false;
}, test.limit.quick);
// goal/G41.22: the centre is the chat, its input at the bottom; goal/G43.22, Andy: "take out the chat-search do, it's
// not actually usable.": the centre is the chat and its input, no search.
test.run('the chat and its input are in the workBench\'s centre', 0.2, function () {
  const wb = S.wb;
  if (!wb) return false;
  const centre = S.bench ? S.bench.center : null;
  const chatLog = wb.document.getElementById('dd-chat');
  const say = wb.document.getElementById('dd-say');
  return (!!centre && [chatLog, say].every(function (n) { return n && inside(n, centre); })) || false;
}, test.limit.quick);
test.run('the workBench holds no chat search', 0.2, function () {
  if (!S.wb) return false;
  return !S.wb.document.getElementById('dd-chat-find') || false;
}, test.limit.quick);
test.run('the chat stands above its input', 0.2, function () {
  const wb = S.wb;
  if (!wb) return false;
  const chatLog = wb.document.getElementById('dd-chat');
  const say = wb.document.getElementById('dd-say');
  const order2 = walkAll(wb.document.root, []);
  return (!!chatLog && !!say && order2.indexOf(chatLog) < order2.indexOf(say)) || false;
}, test.limit.quick);
test.run('the chat input can be resized up and down only', 0.2, function () {
  if (!S.wb) return false;
  const say = S.wb.document.getElementById('dd-say');
  const sayStyle = String((say && say.attrs && say.attrs.style) || '');
  return /resize\s*:\s*vertical/.test(sayStyle) || false;
}, test.limit.quick);

// goal/G41.22: newest line at the bottom, pinned there; the lines shown stay as they are.
// Andy, box v15: "scrolls upward, not downward. that means, newest lines at the bottom, pinned to the bottom, and older
// lines above." And G41.11, kept: "in ALL the chats, new lines are no added, THE WHOLE FUCKING THING IS REDRAWN, killing
// my attempted copies": a line already shown is the same element after a new line comes and after any other repaint.
const CHATTY = Object.assign({}, ITEM, { id: 'goal/G9.6' });
const L1 = { by: 'andy', at: '2026-10-27T10:00:00.000Z', text: 'the first line' };
const L2 = { by: 'claude-windows', at: '2026-10-27T10:01:00.000Z', text: 'the second line' };
const L3 = { by: 'wsl-claude', at: '2026-10-27T10:02:00.000Z', text: 'the third line' };
const log = function () { return S.cw.document.getElementById('dd-chat'); };
// What he sees, top to bottom: the lines in their order, turned round where a box shows them reversed (column-reverse).
const reversed = function () { for (let p = log(); p; p = p.parentNode) { if (/flex-direction\s*:\s*column-reverse/.test(String((p.attrs && p.attrs.style) || '') + ' ' + String((p.style && p.style.flexDirection) || ''))) return true; } return false; };
const shownNow = function () { const l = (log() ? log().children : []).filter(function (b) { return /the (first|second|third) line/.test(b.textContent); }); return reversed() ? l.slice().reverse() : l; };
// Pinned to the bottom: a box between the lines and the centre scrolled to its end, or one showing them reversed.
const pinned = function () { if (reversed()) return true; for (let p = log(); p && p !== S.cw.document.root; p = p.parentNode) { if (p.scrollTop >= p.scrollHeight - p.clientHeight) return true; } return false; };
const words = function (l) { return JSON.stringify(l.map(function (b) { return b.textContent.replace(/[\s\S]*(the \w+ line)[\s\S]*/, '$1'); })); };
test.run('it opens with the two lines, the newest at the bottom', 0.2, async function () {
  const cw = ddWorld(CHATTY, []);
  S.heard = null;
  cw.api.onPublished = function (fn, from) { if (from === 'desk' || !S.heard) S.heard = fn; return function () {}; };
  const verbBefore = cw.api.verb;
  cw.api.verb = function (name, args) { if (name === 'desk.item.chat') return Promise.resolve({ status: 200, body: { chat: [L1, L2] } }); return verbBefore(name, args); };
  await cw.open();
  S.cw = cw;
  const before = S.before = shownNow();
  return (before.length === 2 && /first/.test(before[0].textContent) && /second/.test(before[1].textContent)) || false;
}, test.limit.quick);
test.run('it opens pinned to the bottom, at the newest line', 0.2, function () {
  if (!S.cw) return false;
  return pinned() || false;
}, test.limit.quick);
test.run('a new line on the stream is put in at the bottom', 0.2, async function () {
  if (!S.cw) return false;
  if (S.heard) { S.heard({ change: 50, table: 'chat', id: CHATTY.id, row: L3 }); await settle(); }
  const afterLine = S.afterLine = shownNow();
  return (afterLine.length === 3 && /third/.test(afterLine[2].textContent)) || false;
}, test.limit.quick);
test.run('after a new line it is pinned to the bottom still', 0.2, function () {
  if (!S.cw) return false;
  return pinned() || false;
}, test.limit.quick);
test.run('the two lines already shown are the same elements as before: not drawn again', 0.2, function () {
  const before = S.before, afterLine = S.afterLine;
  if (!before || !afterLine) return false;
  return (afterLine.length === 3 && afterLine[0] === before[0] && afterLine[1] === before[1]) || false;
}, test.limit.quick);
test.run('a change that is no chat line (a check) repaints the panel and leaves every chat line as it was', 0.2, async function () {
  const before = S.before, afterLine = S.afterLine;
  if (!before || !afterLine) return false;
  if (S.heard) { S.heard({ change: 51, table: 'checks', id: CHATTY.id, row: { number: 'Q1', kind: 'Q', state: 'open', words: 'Shall it?' } }); await settle(); }
  const afterOther = shownNow();
  return (afterOther.length === 3 && afterOther[0] === before[0] && afterOther[1] === before[1] && afterOther[2] === afterLine[2]) || false;
}, test.limit.quick);
// ── goal/G41.22: OPENED ON AN ITEM, IN A REAL BROWSER ─────────────────────────────────────────────────────────────────
// The page above has no layout, so what fills and what scrolls is asked of Chrome (a chat short of its bottom, no left
// panel at open, or a box a third of its pane, pass the page above):
// ./deskDetails-opened.html, on a scratch node with its DEBUG on, opens the panel in the home page's app area on an item
// with 200 chat lines and a long box.
const OPENED = '/DEBUG/spirit/app/desk/element/deskDetails/test/deskDetails-opened.html';
const H = SPIRIT.requireScript('spirit/test/headLessChrome.js');
// A scratch node and its Chrome page, stopped once their tests are done, and at the end whatever happened.
function stop(node, page) {
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
}
function stopOpened() { stop(S.nodeFacts, S.page); S.nodeFacts = S.page = null; }
function stopPressing() { stop(S.scratch, S.page2); S.scratch = S.page2 = null; }
test.after(function () { stopOpened(); stopPressing(); });
test.run('Chrome opens a scratch node with its DEBUG on, and its page measures the panel opened on an item', 0.2, async function () {
  S.chrome = H.findChrome();
  if (!S.chrome) return false;
  const node = S.nodeFacts = await H.scratchNode();
  const page = S.page = node.up && node.debug ? await H.chromePage(S.chrome) : null;
  if (!page || page.error) return false;
  await page.send('Page.navigate', { url: node.base + OPENED });
  await H.until(function () { return page.evaluate('typeof window.opened === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await page.evaluate('window.opened()').catch(function () { return ''; });
  try { S.m = JSON.parse(s); } catch (e) { S.m = null; }
  return !!S.m || false;
}, test.limit.slow);
test.run('the page does not scroll, and the chat input is on screen', 0.2, function () {
  const m = S.m;
  if (!m) return false;
  return (!m.scrolls && !!m.say && m.say.bottom <= m.window) || false;
}, test.limit.quick);
test.run('the chat is pinned to its bottom: scrolled to its end', 0.2, function () {
  const m = S.m;
  if (!m) return false;
  return (!!m.chatEnd && m.chatEnd.top >= m.chatEnd.end - 1) || false;
}, test.limit.quick);
test.run('the newest line is the last, and shows whole at the bottom', 0.2, function () {
  const m = S.m;
  if (!m) return false;
  return (!!m.newest && /line 199/.test(m.newest.text) && !!m.chat && m.newest.bottom <= m.chat.bottom + 1) || false;
}, test.limit.quick);
test.run('at open a left panel shows, as the details did before the workBench', 0.2, function () {
  const m = S.m;
  if (!m) return false;
  return (!!m.leftShown && m.panelAtOpen > 0) || false;
}, test.limit.quick);
// goal/G43.3: the box on screen is a CodeMirror with line numbers, its last stored version above it.
async function pageAnswer(expr) { try { return JSON.parse(await S.page.evaluate(expr)); } catch (e) { return null; } }
test.run('the box is a CodeMirror editor showing line numbers', 0.2, async function () {
  if (!S.m) return false;
  const v = S.box = await pageAnswer('window.boxView()');
  return (!!v && v.codeMirror === true && v.numbers > 0) || false;
}, test.limit.slow);
test.run('above the box stands its last stored version', 0.2, function () {
  if (!S.m) return false;
  const v = S.box;
  return (!!v && /\b37\b/.test(String(v.above))) || false;
}, test.limit.quick);
// goal/G43.22, Andy: "take out your search of the items text, the codeMirror search works better for editing purposes."
test.run('there is no find field beside the box, which is a CodeMirror editor with its own search', 0.2, function () {
  if (!S.m) return false;
  const v = S.box;
  return (!!v && v.codeMirror === true && v.find === false) || false;
}, test.limit.quick);
test.run('leaving the box changed writes his text, on the version it read', 0.2, async function () {
  if (!S.m) return false;
  const t = await pageAnswer('window.boxTake()');
  return (!!t && !!t.wrote && t.wrote.text === 'his new text' && t.wrote.version === 37) || false;
}, test.limit.quick);
// THE PLUNGER (goal/G49; Andy: "put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input] [Add-button],
// which will add an item with <Title> blocking the goal/item it was created from.", "Go!"). The page is opened on goal/G9.1.
test.run('the detail holds one rowForm with ➕, "Add blocking item", a title input and an Add button', 0.4, async function () {
  if (!S.m) return false;
  const p = S.plunger = await pageAnswer('window.plunger()');
  return (!!p && p.forms === 1 && p.icon === true && p.input === true && p.button === 'Add') || false;
}, test.limit.quick);
test.run('its Add, with a title typed, adds an item of that title blocking the item the detail is of', 0.4, function () {
  const a = (S.plunger || {}).add;
  return (!!a && a.title === 'zz the plunger\'s item' && a.blocks === 'goal/G9.1' && a.goal === 'goal/G9') || false;
}, test.limit.quick);
// EVERY LEFT PANEL USES ALL THE HEIGHT (Andy, on G41.22: "the box must use the full vertical space", "all left
// side panels must fucking use all available vertical space, especially the lists"): given long content, the
// pane never scrolls itself; the panel's own list (the box's text) scrolls, its bottom at the pane's.
async function fullHeight(key) {
  if (!S.m) return false;
  const p = S.panel = await pageAnswer('window.panel(' + JSON.stringify(key) + ')');
  const full = !!p && !p.error && !p.paneScrolls && !!p.scroller && p.scroller.bottom >= p.pane.bottom - 24 && p.scroller.bottom <= p.pane.bottom + 1;
  return full || false;
}
test.run('the box panel fills the pane\'s height when first opened, and its list scrolls inside it down to the bottom', 0.2, function () { return fullHeight('box'); }, test.limit.slow);
// The last check on the opened page closes it.
test.run('the qs panel fills the pane\'s height when first opened, and its list scrolls inside it down to the bottom', 0.2, async function () { const full = await fullHeight('qs'); stopOpened(); return full; }, test.limit.slow);

// ── goal/G43.30: ON THE REAL PAGE, A DELETE OR A CLOSE PRESSED ONCE DOES NOTHING ─────────────────────────────────
// The box: "A test presses each one once on the real page and finds that nothing happened". A scratch node with desk on, a goal and two items: one pressed done, whose detail
// offers Close; one in design mode, whose detail offers Delete (goal/G9.7). Each detail opened from Desk's List.
const call = function (verb, args) {
  return S.page2.evaluate("fetch('/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
    .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
};
const state = async function (id) { const r = await call('desk.item.get', { id: id }); let i = r.item; if (typeof i === 'string') { try { i = JSON.parse(i); } catch (e) { i = null; } } return i || {}; };
const openRow = function (title) { return S.page2.evaluate("(function () { var all = Array.prototype.slice.call(document.querySelectorAll('#zzDesk *')).filter(function (x) { return x.tagName === 'TD' && x.textContent.indexOf(" + JSON.stringify(title) + ") !== -1 && !x.closest('.app-container'); }); if (!all.length) return false; all[all.length - 1].click(); return true; })()"); };
const btn = function (id) { return "Array.prototype.filter.call(document.querySelectorAll('#zzDesk .app-container #" + id + "'), function (b) { return b.getClientRects().length; })[0]"; };
const shut = function () { return S.page2.evaluate("(function () { var c = Array.prototype.filter.call(document.querySelectorAll('#zzDesk .app-container-close'), function (x) { return x.getClientRects().length; }).pop(); if (c) c.click(); return !!c; })()"); };
// The detail of a row opened from the List, its button there or not.
async function detailOffers(title, id, what) {
  if (!S.readyPromise) return false;
  await H.until(function () { return openRow(title); }, H.WAIT);
  S.there = await H.until(function () { return S.page2.evaluate('!!' + btn(id)); }, H.WAIT);
  return S.there || false;
}
// That button pressed once, if it is there: whether it then stands armed.
async function pressOnce(id) {
  if (!S.there) return false;
  await S.page2.evaluate('(function () { var b = ' + btn(id) + '; if (b) b.click(); return !!b; })()');
  await new Promise(function (r) { setTimeout(r, 1500); });
  return S.page2.evaluate('(function () { var b = ' + btn(id) + '; return !!b && b.hasAttribute("data-armed"); })()');
}
test.run('there is an item done, and an item in design mode offering Delete', 0.2, async function () {
  stopOpened();
  S.readyPromise = false;
  if (!S.chrome) return false;
  const scratch = S.scratch = await H.scratchNode();
  const page = S.page2 = scratch.up ? await H.chromePage(S.chrome) : null;
  if (!page || page.error) return false;
  await page.send('Page.navigate', { url: scratch.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.requireScript)').then(Boolean); }, H.WAIT);
  await call('app.active', { key: 'desk', active: true });
  await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
  const g = await call('desk.goal.add', { title: 'Pressing goal' });
  await call('desk.press', { id: g.id, what: 'make-current' });
  const done = S.done = await call('desk.item.add', { goal: g.id, title: 'A done item to close' });
  await call('desk.press', { id: done.id, what: 'done' });
  const design = S.design = await call('desk.item.add', { goal: g.id, title: 'A design item to delete' });
  await call('desk.press', { id: design.id, what: 'start-design' });
  const before = S.beforePress = { done: await state(done.id), design: await state(design.id) };
  await page.evaluate("(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.requireScript('spirit/app/desk/element.js')).then(function () { window.spirit.required.spirit.app.desk.element.create(d, {}); return true; }); })()");
  S.readyPromise = true;
  return (before.done.status === 'done' && (before.design.buttons || []).indexOf('delete') !== -1) || false;
}, test.limit.long);
test.run('the detail of "A done item to close" offers Close', 0.2, function () {
  return detailOffers('A done item to close', 'dd-close', 'Close');
}, test.limit.quick);
test.run('with its Close pressed once, the item is still done and nothing is closed', 0.2, async function () {
  if (!S.readyPromise) return false;
  S.closeArmed = await pressOnce('dd-close');
  const afterClose = await state(S.done.id);
  return afterClose.status === 'done' || false;
}, test.limit.slow);
test.run('its Close then stands armed, waiting for the second press', 0.2, function () {
  return S.closeArmed === true || false;
}, test.limit.quick);
test.run('the detail of "A design item to delete" offers Delete', 0.2, async function () {
  if (!S.readyPromise) return false;
  await shut();
  return detailOffers('A design item to delete', 'dd-delete', 'Delete');
}, test.limit.quick);
// Delete closes rather than erases (goal/G9.7): nothing deleted is the same item, its status and its Delete as before.
test.run('with its Delete pressed once, the item is still there, its status as before and still offering Delete, and nothing is deleted', 0.2, async function () {
  if (!S.readyPromise) return false;
  S.deleteArmed = await pressOnce('dd-delete');
  const design = S.design, before = S.beforePress;
  const afterDelete = await state(design.id);
  return (afterDelete.id === design.id && afterDelete.status === before.design.status && afterDelete.status !== 'closed' && (afterDelete.buttons || []).indexOf('delete') !== -1) || false;
}, test.limit.slow);
test.run('its Delete then stands armed, waiting for the second press', 0.2, function () {
  stopPressing();
  return S.deleteArmed === true || false;
}, test.limit.quick);

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }

// ── THE noFind PART ──────────────────────────────────────────────────────────────────────────────────────────────
// THE ITEM DETAIL HAS NO FIND FIELD AND NO CHAT SEARCH (goal/G43.22; spec: ./deskDetails.md, its noFind section): spirit/app/desk/element/deskDetails/deskDetails.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". "take out your search of the items text", "take out the chat-search do, it's not actually usable.". The tree read as it is, comments left out.
// noFind: the item detail has no find field over its box and no chat search (goal/G43.22).
function codeOf(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');
test.run('the item detail has no find field over its box', 0.2, function () {
  const details = S.details = codeOf(path.join(DESK, 'element', 'deskDetails', 'deskDetails.js'));
  return (!!details && !/data-box-find/.test(details)) || false;
}, test.limit.quick);
test.run('the item detail has no chat search', 0.2, function () {
  const details = S.details;
  return (!!details && !/dd-chat-find|ddMountChatFind/.test(details)) || false;
}, test.limit.quick);

// The plugin leftovers once in shell/shared (goal/G43.23, item 10): shell/ is gone, and a require of a file that is not there
// is spirit/test/script-sibling-general.js's, so their checks are dropped (goal/G47.1).
