'use strict';

// spirit/run/spirit/app/desk/element/desk/test/desk.js
// The tests of spirit/app/desk/element/desk/desk.js (spec: ./desk.md). goal/G41.1: every icon it draws is a glyph written as it is, with
// no icon table and no lookup of a name into one, read from the module's own code. goal/G41.9: every are-you-sure it
// draws is an armingButton, driven on a page of its own. goal/G41.11: the design buttons' colour is a class, and every
// list stands in a fill box. goal/G43.22: no Team and no Apps. goal/G43.3: the List's two filters, in a real browser
// (./desk-opened.html).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
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

// ── EVERY ARE-YOU-SURE IS AN armingButton (goal/G41.9) ───────────────────────────────────────────────────────────────
// The page is driven: mounted on a small page of its own, the List's rows drawn by its own element, and each two-press
// button clicked twice. armingButton is a working stand-in that writes down every button it is handed; the node's desk
// is a recorder.
const vm = require('vm');
const raw = fs.readFileSync(FILE, 'utf8');

// The node that served the page, its public key in base64 with a + and a / in it, as a node's key is.
const PAGE_NODE_KEY = 'Pg+e/NoDe0123456789abcdefghijklmnopqrstuvw=';
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
  const REAL = ['spirit/data.js', 'spirit/app/desk/data.js', 'spirit/app/backup/data.js'];
  const ran = {};
  let listOpts = null;
  win.spirit = { escapeHtml: api.escapeHtml,
    // The page's caches are the desk and backup families' data.js, over the one spirit.data (goal/G41.28): both run as
    // they are, so the List is a search of what the cache holds; anything else is answered and not run.
    require: function (p) {
      const rel = String(p).replace(/^\/+/, '');
      required.push(rel);
      if (REAL.indexOf(rel) !== -1 && !ran[rel]) { ran[rel] = true; vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), win, { filename: rel }); }
      return Promise.resolve({});
    },
    // goal/G43.32: the parts stand where the page reads them, at spirit.element.<their path>.
    element: { spirit: { app: {}, element: nestSearch({ armingButton: armingStub(document, made),
      'search': { create: function (host, o) { listOpts = o; return { refresh: function () {}, destroy: function () {}, redraw: function () {}, value: '' }; } } }) } },
    // THE PAGE GETS WHAT IT NEEDS ITSELF (goal/G43.27, requirement 23): no api is handed to it. A family's verb is asked
    // through spirit.ready (every desk.<verb> reaches the recorder), its answer through outcome, and the desk's publishes
    // through its family's cache manager, the real spirit/app/desk/data.js.
    ready: Promise.resolve(new Proxy({}, { get: function (t, fam) {
      return new Proxy({}, { get: function (t2, rest) { return function (args) { return api.verb(String(fam) + '.' + String(rest), args); }; } });
    } })),
    outcome: function (p) { return p; },
    cacheManager: function (name) { return win.spirit.require('spirit/app/' + name + '/data.js'); } };
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit): spirit.required, and the helper answered, so each element
  // places itself by installSpiritElement as it runs.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  // The page's one data set, which spirit.js brings with the client before any app runs.
  win.spirit.require('spirit/data.js');
  // THE PAGE KNOWS ITS NODE (goal/G41.28; Andy, Q10: "Shall spirit.js ask node.card once as a page loads and keep the key as
  // spirit.node.key, so a page files its own node's rows under it?" "yes."): as spirit.start does once node.card answers,
  // the key kept on spirit.node and handed to the data set, so the cache files the page's rows under its node.
  win.spirit.node = { key: PAGE_NODE_KEY };
  win.spirit.data.homeNode(PAGE_NODE_KEY);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'rowElement.js'), 'utf8'), win, { filename: 'rowElement.js' });
  vm.runInContext(raw, win, { filename: FILE });
  const w = { document: document, made: made, asked: asked, required: required, api: api, win: win };
  w.mount = async function () {
    win.spirit.element.spirit.app.desk.element.desk.desk.create(document.body.appendChild(document.createElement('div')), {});
    await settle();
    // THE GOAL PUSHED, AS THE STREAM PUSHES IT (goal/G41.28): the current goal is the cache's, the one its last
    // goal.whole named; the page reads it from there, never from a search answer.
    const K = ((win.spirit.data || {}).desk || {}).data;
    if (K && typeof K.published === 'function') { [goal].concat(items).forEach(function (r) { K.published({ verb: 'goal.whole', item: r, change: 1 }); }); await settle(); }
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

// One two-press button, clicked twice: made by armingButton (handed no api: it hears a click elsewhere itself, goal/G43.24),
// saying today's armed wording, asking nothing on the first press and the press on the second.
async function twoPress(w, find, armedSays, wantPress, what) {
  const before = w.presses().length;
  const b = find();
  if (!b) { test.fail(what + ': no such button on the page'); return; }
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
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
  ok(w0.required.indexOf('spirit/element/armingButton.js') !== -1, 'it requires spirit/element/armingButton.js through spirit.require', 'required: ' + JSON.stringify(w0.required));
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

  // goal/G43.30, the box: "every Delete and every Close press in Desk (its rows, the item detail, the rule dialog) is an
  // armingButton" (Andy: "while your mucking with desk, can you make sure that all delete and close buttons are
  // armingButton's? box."). It ends goal/G41.9's one press for a goal with nothing open, and a done row's.
  test.subHeading('goal/G43.30: every Close in the List is an armingButton, a goal\'s with nothing open and a done item\'s');
  const armedNotClose = function (t) { return !!t && t !== 'Close'; };
  const wc = deskWorld({ id: 'goal/G8', title: 'Done goal', goal: '', status: 'open', buttons: ['close'], design: false, blocked: [] }, []);
  await wc.mount();
  await twoPress(wc, function () { return wc.document.querySelector('[data-press="close"]'); }, armedNotClose, { id: 'goal/G8', what: 'close' }, 'a goal\'s Close, nothing under it open');
  const wi = deskWorld({ id: 'goal/G8', title: 'A goal', goal: '', status: 'open', buttons: [], design: false, blocked: [] },
    [{ id: 'goal/G8.1', title: 'A done item', goal: 'goal/G8', status: 'done', buttons: ['close'], verified: 'green', claims: 1 }]);
  await wi.mount();
  await twoPress(wi, function () { return wi.document.querySelector('[data-key="goal/G8.1"] [data-press="close"]') || wi.document.querySelector('[data-press="close"]'); }, armedNotClose, { id: 'goal/G8.1', what: 'close' }, 'a done item\'s Close, in its row');

  // ── goal/G41.11: ARMED IS RED, ALSO ON THE DESIGN BUTTONS ─────────────────────────────────────────────────────────────
  // An inline colour on Start or End design mode would beat the shell's armed red (shell.css, #app-content
  // button[data-armed]). Their colour is a class that shell.css paints only while the button is not armed.
  test.subHeading('goal/G41.11: Start and End design mode turn the shell\'s red when armed');
  const css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const wd = deskWorld(Object.assign({}, goal, { design: true }), []);
  await wd.mount();
  [['desk-end-design', 'End design mode'], ['desk-start-design', 'Start design mode']].forEach(function (pair) {
    const b = wd.document.getElementById(pair[0]);
    const style = b ? String(b.getAttribute('style') || '') : '';
    ok(!!b && !/background/i.test(style), pair[1] + ': no inline background, which would beat the armed red', pair[1] + ': ' + (b ? 'style="' + style + '"' : 'not drawn'));
    const classes = b ? String(b.className || '').split(/\s+/).filter(Boolean) : [];
    // A rule of shell.css naming one of its classes, only while not armed, that paints its background.
    const painted = classes.filter(function (c) {
      const re = new RegExp('[^{}]*\\.' + c.replace(/[-]/g, '\\-') + '[^{}]*:not\\(\\[data-armed\\]\\)[^{}]*\\{[^}]*background', 'i');
      return re.test(css);
    });
    ok(painted.length > 0, pair[1] + ': its colour comes from a class shell.css paints only while unarmed (.' + painted[0] + ':not([data-armed]))',
      pair[1] + ': classes ' + JSON.stringify(classes) + ', none painted by shell.css under :not([data-armed])');
  });
  test.subHeading('goal/G43.22: no Team and no Apps; Andy: "G0 goes, from ui and server, kept in database."');
  {
    const wt = deskWorld(goal, []);
    await wt.mount();
    const d = wt.document;
    ok(!d.getElementById('desk-team') && !d.querySelector('[data-tab="apps"]') && !d.querySelector('[data-tab="team"]'),
      'the page draws no Team chat, no Team tab and no Apps tab', 'still drawn: ' + JSON.stringify({ team: !!d.getElementById('desk-team'), apps: !!d.querySelector('[data-tab="apps"]'), teamTab: !!d.querySelector('[data-tab="team"]') }));
  }
  // ── goal/G43.3: THE LIST'S FILTERS, IN A REAL BROWSER ───────────────────────────────────────────
  // Andy: "on the list search item.search, these two filters: [Current Goal Only] and [Goals only] MUST be mutually
  // exclusive, both can be off, but only one of them can be active at once. so [Current Goal only] is the only filter On by
  // default, and it MUST show the current goal when the page opens."
  test.subHeading('goal/G43.3: /spirit/app/desk/element/desk/test/desk-opened.html: the page opened, with nothing on the stream');
  {
    const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
    const chrome = H.findChrome();
    if (!chrome) test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name');
    else {
      const node = await H.scratchNode();
      let page = null;
      try {
        page = node.up && node.debug ? await H.chromePage(chrome) : null;
        if (!page || page.error) test.fail(page ? page.error : 'the scratch node did not come up with its DEBUG on');
        else {
          await page.send('Page.navigate', { url: node.base + '/DEBUG/spirit/app/desk/element/desk/test/desk-opened.html' });
          await H.until(function () { return page.evaluate('typeof window.opened === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
          const read = async function (js) { try { return JSON.parse(await page.evaluate(js)); } catch (e) { return { error: String(e) }; } };
          const o = await read('window.opened()');
          ok(o.found === true, 'the world: the List draws its filter buttons', 'the page: ' + JSON.stringify(o));
          ok(o.current === true && o.goals === false && o.closed === false, '[Current Goal Only] is the only filter on by default', 'at open: ' + JSON.stringify(o));
          ok(!!o.args && o.args.currentGoalOnly === true && o.args.goalsOnly === false && o.args.includeClosed === false, 'the first search asks for the current goal alone', 'at open it asked ' + JSON.stringify(o.args));
          ok(o.currentGoal === true && o.openItem === true, 'and the page shows the current goal and its item when it opens', 'at open: ' + JSON.stringify(o));
          const g = await read('window.press("goalsOnly")');
          ok(g.goals === true && g.current === false, '[Goals Only] pressed: [Current Goal Only] goes off', 'after [Goals Only]: ' + JSON.stringify(g));
          ok(!!g.args && g.args.goalsOnly === true && g.args.currentGoalOnly === false, 'and the search asks for goals, every goal', 'it asked ' + JSON.stringify(g.args));
          ok(g.currentGoal === true && g.olderGoal === true && g.olderItem === false && g.openItem === false, 'and the List shows the goals, no item', 'after [Goals Only]: ' + JSON.stringify(g));
          const c = await read('window.press("current")');
          ok(c.current === true && c.goals === false, '[Current Goal Only] pressed: [Goals Only] goes off', 'after [Current Goal Only]: ' + JSON.stringify(c));
          ok(c.openItem === true && c.olderGoal === false && c.olderItem === false, 'and the List shows the current goal alone', 'after [Current Goal Only]: ' + JSON.stringify(c));
          const off = await read('window.press("current")');
          ok(off.current === false && off.goals === false, 'pressed again: both are off', 'pressed again: ' + JSON.stringify(off));
          ok(!!off.args && off.args.currentGoalOnly === false && off.args.goalsOnly === false && off.openItem === true && off.olderItem === true, 'and the List shows every goal\'s items', 'both off: ' + JSON.stringify(off));
        }
      } finally {
        if (page && page.kid) page.kid.kill();
        if (node.child) node.child.kill();
        try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
        try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
      }
    }
  }

  // ── ANOTHER ITEM OPENS AFTER ONE WAS CLOSED, IN A REAL BROWSER ────────────────────────────────────────────
  // Andy: "after i closed "Fix api branches" the other items won't open for me", "all i see, when opening another item is the
  // titlebar of that item". A scratch node with desk switched on, a goal and two items; the Desk element on its face page:
  // the first item opened and closed with its ✕, then the second opened, which must draw its own details in the one layer.
  test.subHeading('another item opens with its details after one was opened and closed');
  {
    const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
    const chrome = H.findChrome();
    if (!chrome) test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name');
    else {
      const node = await H.scratchNode();
      let page = null;
      try {
        page = node.up ? await H.chromePage(chrome) : null;
        if (!page || page.error) test.fail(page ? page.error : 'the scratch node did not come up');
        else {
          await page.send('Page.navigate', { url: node.base + '/face.html' });
          await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
          const call = function (verb, args) {
            return page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
              .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
          };
          await call('app.active', { key: 'desk', active: true });
          await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
          const g = await call('desk.goal.add', { title: 'Opening goal' });
          await call('desk.press', { id: g.id, what: 'make-current' });
          const one = await call('desk.item.add', { goal: g.id, title: 'First opened item', blocks: '' });
          const two = await call('desk.item.add', { goal: g.id, title: 'Second opened item', blocks: '' });
          ok(!!g.id && !!one.id && !!two.id, 'the world: a goal and two items on the scratch desk', 'added ' + JSON.stringify([g, one, two]));
          await page.evaluate("(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {}); return true; }); })()");
          const open = function (title) { return page.evaluate("(function () { var all = Array.prototype.slice.call(document.querySelectorAll('#zzDesk *')).filter(function (x) { return x.textContent.indexOf(" + JSON.stringify(title) + ") !== -1 && !x.closest('.app-container'); }); if (!all.length) return false; all[all.length - 1].click(); return true; })()"); };
          const shown = function () { return page.evaluate("(function () { var all = Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container')); var b = all.filter(function (x) { return x.style.display !== 'none'; }).pop(); var body = b && b.querySelector('#dd-body'); return JSON.stringify({ layers: all.length, drawn: !!body && body.children.length > 0, text: b ? b.textContent : '' }); })()").then(JSON.parse); };
          await H.until(function () { return page.evaluate("document.getElementById('zzDesk').textContent.indexOf('Second opened item') !== -1"); }, H.WAIT);
          ok(await open('First opened item'), 'the world: the first item\'s row is in the List', 'no row for the first item');
          await H.until(function () { return shown().then(function (s) { return s.drawn; }); }, H.WAIT);
          const first = await shown();
          ok(first.drawn && first.text.indexOf(one.id) !== -1, 'the first item opens with its details', 'the first: ' + JSON.stringify(first).slice(0, 200));
          await page.evaluate("(function () { var b = Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container')).filter(function (x) { return x.style.display !== 'none'; }).pop(); b.querySelector('.app-container-close').click(); return true; })()");
          ok(await open('Second opened item'), 'the world: the second item\'s row is in the List', 'no row for the second item');
          await H.until(function () { return shown().then(function (s) { return s.drawn && s.text.indexOf(two.id) !== -1; }); }, H.WAIT);
          const second = await shown();
          ok(second.drawn && second.text.indexOf(two.id) !== -1, 'after it was closed, the second item opens with its own details, not its title bar alone', 'the second: ' + JSON.stringify(second).slice(0, 200));
          ok(second.layers === 1, 'every item opens in the one details layer', second.layers + ' layers');
        }
      } finally {
        if (page && page.kid) page.kid.kill();
        if (node.child) node.child.kill();
        try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
        try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
      }
    }
  }

  // ── goal/G43.30: ON THE REAL PAGE, A CLOSE PRESSED ONCE CLOSES NOTHING ─────────────────────────────────────────
  // The box: "A test presses each one once on the real page and finds that nothing happened", and the run status: "Desk
  // and its detail load it from there", spirit/app/desk/element/deskRunStatus/. A scratch node with desk switched on, a
  // goal and an item pressed done; the Desk element on its face page; every Close the List draws pressed once.
  test.subHeading('goal/G43.30: on a real page, every Close in the List pressed once closes nothing; the run status from Desk\'s own elements');
  {
    const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
    const chrome = H.findChrome();
    if (!chrome) test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name');
    else {
      const node = await H.scratchNode();
      let page = null;
      try {
        page = node.up ? await H.chromePage(chrome) : null;
        if (!page || page.error) test.fail(page ? page.error : 'the scratch node did not come up');
        else {
          await page.send('Page.navigate', { url: node.base + '/face.html' });
          await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
          const call = function (verb, args) {
            return page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
              .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
          };
          await call('app.active', { key: 'desk', active: true });
          await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
          const g = await call('desk.goal.add', { title: 'Closing goal' });
          await call('desk.press', { id: g.id, what: 'make-current' });
          const it = await call('desk.item.add', { goal: g.id, title: 'An item to close', blocks: '' });
          await call('desk.press', { id: it.id, what: 'done' });
          const state = async function () { const r = await call('desk.item.get', { id: it.id }); let i = r.item; if (typeof i === 'string') { try { i = JSON.parse(i); } catch (e) { i = null; } } return i || {}; };
          const before = await state();
          ok(!!g.id && !!it.id && before.status === 'done', 'the world: a goal and its item, done, on the scratch desk', 'the world: ' + JSON.stringify({ goal: g.id, item: it.id, status: before.status }));
          await page.evaluate("(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {}); return true; }); })()");
          const CLOSES = "Array.prototype.filter.call(document.querySelectorAll('#zzDesk [data-press=\"close\"]'), function (b) { return b.getClientRects().length && !b.closest('.app-container'); })";
          ok(await H.until(function () { return page.evaluate(CLOSES + '.length > 0'); }, H.WAIT), 'the world: the List draws the done item\'s Close', 'no Close in the List: ' + String(await page.evaluate("String(document.getElementById('zzDesk').innerText).slice(0, 300)")));
          const n = await page.evaluate(CLOSES + '.length');
          for (let i = 0; i < n; i++) await page.evaluate('(function () { var b = ' + CLOSES + '[' + i + ']; if (b) b.click(); return !!b; })()');
          await new Promise(function (r) { setTimeout(r, 1500); });
          const after = await state();
          ok(after.status === 'done', 'each Close in the List pressed once: the item is still done, nothing closed', 'after one press each the item is ' + after.status);
          const armed = JSON.parse(await page.evaluate('JSON.stringify(' + CLOSES + '.map(function (b) { return b.hasAttribute("data-armed"); }))'));
          ok(armed.length === n && armed.every(Boolean), 'and each of the ' + n + ' stands armed, waiting for the second press', 'after one press each, the List\'s Closes armed: ' + JSON.stringify(armed) + ' of ' + n);
          const from = JSON.parse(await page.evaluate('JSON.stringify(performance.getEntriesByType("resource").map(function (e) { return e.name; }).filter(function (x) { return /deskRunStatus/.test(x); }))'));
          ok(from.some(function (x) { return x.indexOf('/spirit/app/desk/element/deskRunStatus/deskRunStatus.js') !== -1; }) && !from.some(function (x) { return /\/shell\/shared\//.test(x); }),
            'Desk loads its run status from spirit/app/desk/element/deskRunStatus/, never from shell/shared/', 'the page loaded ' + JSON.stringify(from));
        }
      } finally {
        if (page && page.kid) page.kid.kill();
        if (node.child) node.child.kill();
        try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
        try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
      }
    }
  }

  test.subHeading('goal/G41.11: every list of Desk stands in a box of a stated size (rule/16)');
  // Andy, on G41.11: "the rules list is NOT placed properly in a size-limited container.... is this the same everywhere
  // in desk?" rule/16: every probabilitySearch is mounted in a box that states its size, class fill, inside a pane that
  // fills its app; never in a stat-tile or a box only as tall as its content. A list
  // drawn as a dropdown stands inline, as every dropdown in the tree does, and is not asked here.
  const wf = deskWorld(goal, [item]);
  const panes = [];
  const realCreate = wf.win.spirit.element.spirit.element.search.create;
  wf.win.spirit.element.spirit.element.search.create = function (host, o) { if (!o || o.face !== 'dropdown') panes.push({ host: host, o: o || {} }); return realCreate(host, o); };
  await wf.mount();
  const mountBox = wf.document.body.children[wf.document.body.children.length - 1];
  const rulesTab = wf.document.querySelector('[data-tab="rules"]');
  if (rulesTab) { wf.document.click(rulesTab); await settle(); }
  const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
  const notFill = function (host) { const out = []; for (let n = host; n && n !== mountBox; n = n.parentNode) { if (!isFill(n)) out.push((n.id ? '#' + n.id : n.tagName || n.tag) + (n.className ? '.' + n.className : '')); } return out; };
  [['the List', 'items.search'], ['the Rules list', 'rules.search']].forEach(function (want) {
    const made = panes.filter(function (x) { return x.o.verb === want[1]; })[0];
    if (!made) { test.fail(want[0] + ': no list made'); return; }
    const gaps = notFill(made.host);
    ok(isFill(made.host) && !gaps.length, want[0] + ' stands in a fill box, and every box up to the app is fill too', want[0] + ': not fill: ' + gaps.join(' < '));
  });
  test.reportSuccessFailureCount();
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
