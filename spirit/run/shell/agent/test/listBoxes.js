'use strict';

// spirit/run/shell/agent/test/listBoxes.js
// The tests of shell/agent/agent.js as one app, and of no other module (spec: ./listBoxes.md; goal/G41.18): every list
// pane it draws stands in a box of a stated size, each box above it up to the app too (rule/16). The app runs on a small
// page, with the real workBench, the real table elements and the real grants panel in it; the search element is a
// recorder that keeps the box each list was made in, and the selectors and the agent server are stand-ins.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'agent.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); };

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// The small forgiving page Desk's suite drives (shell/desk/test/desk.js), copied as it is: markup parsed into elements,
// with ids, attributes, parents, closest and simple selectors, and a click that reaches every listener above its
// target. Desk keeps its own while it lives (Andy: "do all but desk").
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

// The real files the app and its elements load, run on the page when they are required; anything else is answered and
// not run.
const REAL = [
  'shell/js/spiritData.js', 'shell/js/workBench.js', 'process/js/agent/table/tableElement.js',
  'process/js/agent/table/provider/elementTable.js', 'process/js/agent/table/provider/elementRow.js',
  'process/js/agent/table/model/elementTable.js', 'process/js/agent/table/model/elementRow.js', 'process/js/agent/table/model/updatePanel.js',
  'process/js/agent/table/persona/elementTable.js', 'process/js/agent/table/persona/elementRow.js',
  'process/js/agent/table/job/elementTable.js', 'process/js/agent/table/job/elementRow.js',
  'shell/js/grantsPanel.js', 'shell/js/grantSelector/listElement.js',
];

function world() {
  const document = makeDom();
  const panes = [];
  const loaded = {};
  const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error, Proxy: Proxy,
    console: { log: function () {}, error: function () {}, warn: function () {} }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
    location: { hash: '', hostname: '127.0.0.1' }, addEventListener: function () {} };
  win.window = win;
  // The agent server: every verb answers an empty table.
  const family = new Proxy({}, { get: function (o, verb) { if (verb === 'then') return undefined; return function () { return Promise.resolve({ items: [], more: false }); }; } });
  const selector = function () { return document.createElement('span'); };
  win.spirit = {
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    familyPath: familyPath, isBrowser: function () { return true; },
    fs: { loadFile: function () { return Promise.reject(new Error('none')); }, saveFile: function () { return Promise.resolve(); } },
    tree: function () { return Promise.resolve({}); },
    shell: { activateApp: function (d) { win.def = d; } },
    elements: {
      // The recorder: the box each list is made in, and whether it is a dropdown.
      probabilitySearch: { create: function (host, o) { panes.push({ host: host, o: o || {} }); return { refresh: function () {}, redraw: function () {}, destroy: function () {}, value: '' }; } },
      createContactSelector: selector, createBundleSelector: selector, createApiFamilySelector: selector,
    },
    require: function (p) {
      const rel = String(p).replace(/^\/+/, '');
      if (rel === familyPath('agent')) return Promise.resolve(family);
      if (REAL.indexOf(rel) !== -1 && !loaded[rel]) { loaded[rel] = true; vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), win, { filename: rel }); }
      return Promise.resolve({});
    },
  };
  win.spirit.ready = Promise.resolve(win.spirit);
  vm.createContext(win);
  win.spirit.require('shell/js/spiritData.js');
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  return { document: document, win: win, panes: panes };
}

const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
// Every box from a list's own up to the app's that is not a fill box.
function gaps(host, app) {
  const out = [];
  for (let n = host; n && n !== app; n = n.parentNode) if (!isFill(n)) out.push((n.tagName || '?').toLowerCase() + (n.id ? '#' + n.id : '') + (n.className ? '.' + n.className : ''));
  return out;
}
const under = function (n, app) { for (let p = n; p; p = p.parentNode) if (p === app) return true; return false; };

test.startTest('agent.js, as one app: every list in a box of a stated size (rule/16)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/agent/agent.js is not there'); return; }
  // Andy, on G41.18: "the lists violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right,
  // agents must as well."; "ALL lists, otherwise my took bars at the top of a container keep scrolling away...."; "when a
  // probabilitySearch is in pane-mode it must display 1) filters 2) search input row 3) a pane that uses the rest of the
  // vertical space, all box elements really have to follow to follow that rule", "the agent app must also constrain all
  // it's probability-panes". rule/16: every probabilitySearch in a box of class fill, inside a pane that fills its app.
  // A list drawn as a dropdown stands inline, as every picker in the tree does, and is not asked here.
  const w = world();
  const app = w.document.body.appendChild(w.document.createElement('div'));
  app.className = 'fill';
  w.win.def.mount(app, { setScreenTitle: function () {}, onJobs: function () {}, onPublished: function () {}, ui: {}, escapeHtml: w.win.spirit.escapeHtml,
    verb: function () { return Promise.resolve({ status: 200, body: { items: [], more: false } }); } });
  await settle();
  const strip = function (name) { return w.document.querySelectorAll('[data-tool]').filter(function (b) { return b.getAttribute('data-tool') === name; })[0]; };

  test.subHeading('each tool\'s list pane');
  const want = [['provider', 'provider'], ['model', 'model'], ['persona', 'persona'], ['job', 'job'], ['grant', 'search']];
  for (const t of want) {
    const b = strip(t[0]);
    if (!b) { test.fail('no strip button for the ' + t[0] + ' tool'); continue; }
    w.document.click(b);
    await settle();
    const made = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && p.o.verb === t[1] && under(p.host, app); });
    if (!made.length) { test.fail('the ' + t[0] + ' tool drew no list pane'); continue; }
    const g = gaps(made[made.length - 1].host, app);
    ok(!g.length, 'the ' + t[0] + ' tool\'s list stands in a fill box, and every box up to the app is fill too', t[0] + ': not fill: ' + g.join(' < '));
  }

  test.subHeading('every list pane the app drew');
  const all = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && under(p.host, app); });
  const bad = all.map(function (p) { return { verb: p.o.verb, gaps: gaps(p.host, app) }; }).filter(function (x) { return x.gaps.length; });
  ok(all.length >= 5 && !bad.length, 'all ' + all.length + ' list panes drawn, none in a box only as tall as its content', 'not fill: ' + short(bad));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
