'use strict';

// spirit/run/shell/desk/test/desk.js
// The tests of shell/desk/desk.js (spec: ./desk.md; goal/G41.1): every icon it draws is a glyph written as it is, with
// no icon table and no lookup of a name into one. Read from the module's own code. And goal/G41.9: every are-you-sure
// it draws is an armingButton, driven on a page of its own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'desk.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('desk.js: its icons are glyphs; its are-you-sure buttons are armingButtons');

const code = fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '');
test.subHeading('no icon table, no lookup into one');
ok(!/iconIndex|\bICON\b/.test(code), 'desk.js names no icon table', 'desk.js still names iconIndex or ICON');
ok(!/deskIcon\(/.test(code), 'it looks no icon up by name (deskIcon is gone)', 'desk.js still calls deskIcon');
test.subHeading('the glyphs it draws, written as they are');
['📁', '❌', '💻', '⚔️'].forEach(function (g) { ok(code.indexOf(g) !== -1, 'it draws ' + g + ' as written', g + ' is not in desk.js'); });
const rule = /var DESK_RULE_ICON = (\{[^}]*\});/.exec(code);
let icons = null;
try { icons = rule ? (new Function('return ' + rule[1]))() : null; } catch (e) { icons = null; }
ok(icons && icons.proposed === '✏️' && icons.active === '🔒' && icons.deleted === '💀', 'a rule\'s status is drawn as its glyph: proposed ✏️, active 🔒, deleted 💀',
  'DESK_RULE_ICON: ' + JSON.stringify(icons));

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
// The page is driven: mounted on a small page of its own, the List's rows drawn by its own element, and each two-press
// button clicked twice. armingButton is a working stand-in that writes down every button it is handed; the node's desk
// is a recorder.
const vm = require('vm');
const raw = fs.readFileSync(FILE, 'utf8');

function deskWorld(goal, items) {
  const document = makeDom();
  const made = [];
  const asked = [];
  const required = [];
  const label = function (r) { return { key: r.id, label: JSON.stringify(r) }; };
  const api = { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    setScreenTitle: function () {}, closeDialog: function () {}, callDialog: function () {}, onPublished: function () {}, onFiles: function () {},
    ui: { elements: {} }, armUntilElsewhere: function () {},
    verb: function (name, args) {
      asked.push({ name: name, args: args });
      if (name === 'desk.items.search') return Promise.resolve({ status: 200, body: { items: [goal].concat(items).map(label) } });
      return Promise.resolve({ status: 200, body: { ok: true, chat: [], items: [], rules: [] } });
    } };
  const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error,
    console: { log: function () {}, error: function () {}, warn: function () {} }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
    location: { hash: '' }, addEventListener: function () {} };
  win.window = win;
  let listOpts = null;
  win.spirit = { escapeHtml: api.escapeHtml,
    require: function (p) { required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    elements: { armingButton: armingStub(document, made),
      probabilitySearch: { create: function (host, o) { listOpts = o; return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } } },
    shell: { activateApp: function (d) { win.def = d; } } };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), win, { filename: 'rowElement.js' });
  vm.runInContext(raw, win, { filename: FILE });
  const w = { document: document, made: made, asked: asked, required: required, api: api, win: win };
  w.mount = async function () {
    win.def.mount(document.body.appendChild(document.createElement('div')), api);
    await settle();
    // The List's rows, drawn by the page's own element into the List's box, where its click listener hears them.
    if (listOpts) {
      const host = document.getElementById('desk-list');
      [goal].concat(items).forEach(function (r) {
        const el = listOpts.element(Object.assign({ key: r.id }, r), r.id);
        const tr = host.appendChild(document.createElement('tr'));
        tr.setAttribute('data-key', r.id);
        const hosts = {};
        el.fields.forEach(function (f) { hosts[f] = tr.appendChild(document.createElement('td')); });
        el.mount(hosts);
      });
    }
    await settle();
  };
  w.presses = function () { return asked.filter(function (a) { return a.name === 'desk.press'; }); };
  return w;
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); }

// One two-press button, clicked twice: made by armingButton (handed the app's api, so the shell's click-elsewhere reaches
// it), saying today's armed wording, asking nothing on the first press and the press on the second.
async function twoPress(w, find, armedSays, wantPress, what) {
  const before = w.presses().length;
  const b = find();
  if (!b) { test.fail(what + ': no such button on the page'); return; }
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && m.opts.api && typeof m.opts.api.armUntilElsewhere === 'function'; });
  w.document.click(b); await settle();
  const b1 = find();
  const armedText = b1 ? b1.textContent : '';
  const firstAsked = w.presses().length - before;
  w.document.click(b1 || b); await settle();
  const sent = w.presses().slice(before);
  const good = byElement && armedSays(armedText) && firstAsked === 0 && sent.length === 1 && sent[0].args.id === wantPress.id && sent[0].args.what === wantPress.what;
  ok(good, what + ': an armingButton saying "' + armedText + '" on the first press, desk.press ' + wantPress.what + ' on the second',
    what + ': ' + JSON.stringify({ madeByArmingButton: byElement, armed: armedText, askedOnFirst: firstAsked, sent: sent.map(function (s) { return s.args; }) }));
}

(async function () {
  test.subHeading('goal/G41.9: it loads armingButton and keeps no arming of its own');
  const plain = raw.replace(/\/\/[^\n]*/g, '');
  const w0 = deskWorld({ id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: [], design: false, blocked: [] }, []);
  await w0.mount();
  ok(w0.required.indexOf('shell/js/armingButton.js') !== -1, 'it requires shell/js/armingButton.js through spirit.require', 'required: ' + JSON.stringify(w0.required));
  const left = ['data-armed', 'armUntilElsewhere', 'deskArmed', 'deskArmOrFire', 'deskDisarm', "classList.add('armed')"].filter(function (s) { return plain.indexOf(s) !== -1; });
  ok(!left.length, 'nothing hand-rolled is left: no data-armed, no armUntilElsewhere, no armed flag of its own', 'still in desk.js: ' + left.join(', '));

  test.subHeading('goal/G41.9: each are-you-sure, pressed twice');
  const goal = { id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: ['go-all'], design: true, blocked: ['goal/G9.1'], verified: 'none' };
  const item = { id: 'goal/G9.1', title: 'An item', goal: 'goal/G9', status: 'open', buttons: ['done'], verified: 'red', verifyFailures: ['a suite red'], claims: 1 };
  const w = deskWorld(goal, [item]);
  await w.mount();
  await twoPress(w, function () { return w.document.getElementById('desk-end-design'); }, function (t) { return t === 'End design mode: sure?'; }, { id: 'goal/G9', what: 'end-design' }, 'End design mode');
  await twoPress(w, function () { return w.document.getElementById('desk-go-all'); }, function (t) { return t === 'Go all: sure?'; }, { id: 'goal/G9', what: 'go-all' }, 'Go all');
  await twoPress(w, function () { return w.document.querySelector('[data-press="done"]'); }, function (t) { return /^Done anyway\? /.test(t); }, { id: 'goal/G9.1', what: 'done' }, 'Done not verified green, in its row');
  const ws = deskWorld(Object.assign({}, goal, { design: false }), []);
  await ws.mount();
  await twoPress(ws, function () { return ws.document.getElementById('desk-start-design'); }, function (t) { return t === 'Start design mode: sure?'; }, { id: 'goal/G9', what: 'start-design' }, 'Start design mode');

  test.subHeading('goal/G41.9: a goal\'s Close in the List presses at once');
  // A goal's Close shows in the List only once nothing under it is open (deskNextPress), so it never asks.
  const wc = deskWorld({ id: 'goal/G8', title: 'Done goal', goal: '', status: 'open', buttons: ['close'], design: false, blocked: [] }, []);
  await wc.mount();
  const close = wc.document.querySelector('[data-press="close"]');
  if (close) { wc.document.click(close); await settle(); }
  const sentClose = wc.presses();
  ok(!!close && sentClose.length === 1 && sentClose[0].args.what === 'close' && sentClose[0].args.id === 'goal/G8', 'one press closes a goal with nothing open', 'close button ' + !!close + ', sent ' + JSON.stringify(sentClose.map(function (s) { return s.args; })));
  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
