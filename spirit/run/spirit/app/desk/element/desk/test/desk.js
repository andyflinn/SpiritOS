'use strict';

// spirit/run/spirit/app/desk/element/desk/test/desk.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: noPlugins.
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


// What each step makes, for the tests after it, in order; every scratch node and Chrome page is stopped by test.after.
const W = {};
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const short = function (x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); };
// A scratch node and its page, stopped; called as a section ends and again by test.after.
function stop(x) {
  if (!x || x.stopped) return;
  x.stopped = true;
  const page = x.page, node = x.node || {};
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
}
// A scratch node with a Chrome page on it (debug: its DEBUG on): x.node, x.page, or a string saying what is missing.
async function bootPage(x, debug) {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  x.node = await H.scratchNode();
  x.page = x.node.up && (!debug || x.node.debug) ? await H.chromePage(chrome) : null;
  if (!x.page || x.page.error) { const why = x.page ? x.page.error : debug ? 'the scratch node did not come up with its DEBUG on' : 'the scratch node did not come up'; x.page = x.page && x.page.error ? x.page : null; return why; }
  return '';
}
// A verb of the node, asked from the page as the page asks it.
function caller(page) {
  return function (verb, args) {
    return page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
  };
}
const MOUNT_DESK = "(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {}); return true; }); })()";

// no icon table, no lookup into one
const readCode = function () { if (W.code === undefined) W.code = fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, ''); return W.code; };
test.run('desk.js names no icon table', 0.2, function () { return !/iconIndex|\bICON\b/.test(readCode()) || 'desk.js still names iconIndex or ICON'; }, test.limit.quick);
test.run('it looks no icon up by name (deskIcon is gone)', 0.2, function () { return !/deskIcon\(/.test(readCode()) || 'desk.js still calls deskIcon'; }, test.limit.quick);
// the glyphs it draws, written as they are
test.run('it draws 📁 as written', 0.2, function () { return readCode().indexOf('📁') !== -1 || '📁 is not in desk.js'; }, test.limit.quick);
test.run('it draws ❌ as written', 0.2, function () { return readCode().indexOf('❌') !== -1 || '❌ is not in desk.js'; }, test.limit.quick);
test.run('it draws 💻 as written', 0.2, function () { return readCode().indexOf('💻') !== -1 || '💻 is not in desk.js'; }, test.limit.quick);
test.run('it draws ⚔️ as written', 0.2, function () { return readCode().indexOf('⚔️') !== -1 || '⚔️ is not in desk.js'; }, test.limit.quick);
test.run('a rule\'s status is drawn as its glyph: proposed ✏️, active 🔒, deleted 💀', 0.2, function () {
  const rule = /var DESK_RULE_ICON = (\{[^}]*\});/.exec(readCode());
  let icons = null;
  try { icons = rule ? (new Function('return ' + rule[1]))() : null; } catch (e) { icons = null; }
  return (!!icons && icons.proposed === '✏️' && icons.active === '🔒' && icons.deleted === '💀') || 'DESK_RULE_ICON: ' + JSON.stringify(icons);
}, test.limit.quick);

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
  if (!b) return { good: false, why: what + ': no such button on the page' };
  const byElement = w.made.some(function (m) { return m.button === b && m.opts && !('api' in m.opts); });
  w.document.click(b); await settle();
  const b1 = find();
  const armedText = b1 ? b1.textContent : '';
  const firstAsked = w.presses().length - before;
  w.document.click(b1 || b); await settle();
  const sent = w.presses().slice(before);
  const good = byElement && armedSays(armedText) && firstAsked === 0 && sent.length === 1 && sent[0].args.id === wantPress.id && sent[0].args.what === wantPress.what;
  return { good: good,
    why: what + ': ' + JSON.stringify({ madeByArmingButton: byElement, armed: armedText, askedOnFirst: firstAsked, sent: sent.map(function (s) { return s.args; }) }) };
}

// goal/G41.9: it loads armingButton and keeps no arming of its own
test.run('it requires spirit/element/armingButton.js through spirit.require', 0.2, async function () {
  const w0 = deskWorld({ id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: [], design: false, blocked: [] }, []);
  await w0.mount();
  return w0.required.indexOf('spirit/element/armingButton.js') !== -1 || 'required: ' + JSON.stringify(w0.required);
}, test.limit.quick);
test.run('nothing hand-rolled is left: no data-armed, no armUntilElsewhere, no armed flag of its own', 0.2, function () {
  const plain = raw.replace(/\/\/[^\n]*/g, '');
  const left = ['data-armed', 'armUntilElsewhere', 'deskArmed', 'deskArmOrFire', 'deskDisarm', "classList.add('armed')"].filter(function (s) { return plain.indexOf(s) !== -1; });
  return !left.length || 'still in desk.js: ' + left.join(', ');
}, test.limit.quick);

// goal/G41.9: each are-you-sure, pressed twice
const goal = { id: 'goal/G9', title: 'A goal', goal: '', status: 'open', buttons: ['go-all'], design: true, blocked: ['goal/G9.1'], verified: 'none' };
const item = { id: 'goal/G9.1', title: 'An item', goal: 'goal/G9', status: 'open', buttons: ['done'], verified: 'red', verifyFailures: ['a suite red'], claims: 1 };
test.run('End design mode is an arming button: the first press says "End design mode: sure?", the second sends end-design', 0.2, async function () {
  const w = W.w = deskWorld(goal, [item]);
  await w.mount();
  const p = await twoPress(w, function () { return w.document.getElementById('desk-end-design'); }, function (t) { return t === 'End design mode: sure?'; }, { id: 'goal/G9', what: 'end-design' }, 'End design mode');
  return p.good || p.why;
}, test.limit.quick);
test.run('Go all is an arming button: the first press says "Go all: sure?", the second sends go-all', 0.2, async function () {
  const w = W.w;
  const p = await twoPress(w, function () { return w.document.getElementById('desk-go-all'); }, function (t) { return t === 'Go all: sure?'; }, { id: 'goal/G9', what: 'go-all' }, 'Go all');
  return p.good || p.why;
}, test.limit.quick);
test.run('Done, in the row of an item not verified green, is an arming button: the first press asks "Done anyway?", the second sends done', 0.2, async function () {
  const w = W.w;
  const p = await twoPress(w, function () { return w.document.querySelector('[data-press="done"]'); }, function (t) { return DONE_ANYWAY.test(t); }, { id: 'goal/G9.1', what: 'done' }, 'Done not verified green, in its row');
  return p.good || p.why;
}, test.limit.quick);
test.run('Start design mode is an arming button: the first press says "Start design mode: sure?", the second sends start-design', 0.2, async function () {
  const ws = deskWorld(Object.assign({}, goal, { design: false }), []);
  await ws.mount();
  const p = await twoPress(ws, function () { return ws.document.getElementById('desk-start-design'); }, function (t) { return t === 'Start design mode: sure?'; }, { id: 'goal/G9', what: 'start-design' }, 'Start design mode');
  return p.good || p.why;
}, test.limit.quick);

// goal/G43.30, the box: "every Delete and every Close press in Desk (its rows, the item detail, the rule dialog) is an
// armingButton" (Andy: "while your mucking with desk, can you make sure that all delete and close buttons are
// armingButton's? box."). It ends goal/G41.9's one press for a goal with nothing open, and a done row's.
// goal/G43.30: every Close in the List is an armingButton, a goal's with nothing open and a done item's
// Today's armed wording of Done on an item not verified green.
const DONE_ANYWAY = /^Done anyway\? /;
const armedNotClose = function (t) { return !!t && t !== 'Close'; };
test.run('a goal\'s Close, with nothing under it open, is an arming button: the first press arms it, the second sends close', 0.2, async function () {
  const wc = deskWorld({ id: 'goal/G8', title: 'Done goal', goal: '', status: 'open', buttons: ['close'], design: false, blocked: [] }, []);
  await wc.mount();
  const p = await twoPress(wc, function () { return wc.document.querySelector('[data-press="close"]'); }, armedNotClose, { id: 'goal/G8', what: 'close' }, 'a goal\'s Close, nothing under it open');
  return p.good || p.why;
}, test.limit.quick);
test.run('a done item\'s Close, in its row, is an arming button: the first press arms it, the second sends close', 0.2, async function () {
  const wi = deskWorld({ id: 'goal/G8', title: 'A goal', goal: '', status: 'open', buttons: [], design: false, blocked: [] },
    [{ id: 'goal/G8.1', title: 'A done item', goal: 'goal/G8', status: 'done', buttons: ['close'], verified: 'green', claims: 1 }]);
  await wi.mount();
  const p = await twoPress(wi, function () { return wi.document.querySelector('[data-key="goal/G8.1"] [data-press="close"]') || wi.document.querySelector('[data-press="close"]'); }, armedNotClose, { id: 'goal/G8.1', what: 'close' }, 'a done item\'s Close, in its row');
  return p.good || p.why;
}, test.limit.quick);

// ── goal/G41.11: ARMED IS RED, ALSO ON THE DESIGN BUTTONS ─────────────────────────────────────────────────────────────
// An inline colour on Start or End design mode would beat the shell's armed red (shell.css, #app-content
// button[data-armed]). Their colour is a class that shell.css paints only while the button is not armed.
// A design button: no inline background; and its class, the one the title names, painted by shell.css only while unarmed.
const noInline = function (id, name) {
  const b = W.wd.document.getElementById(id);
  const style = b ? String(b.getAttribute('style') || '') : '';
  return (!!b && !/background/i.test(style)) || name + ': ' + (b ? 'style="' + style + '"' : 'not drawn');
};
const paintedClass = function (id, name, want) {
  const b = W.wd.document.getElementById(id);
  const classes = b ? String(b.className || '').split(/\s+/).filter(Boolean) : [];
  // A rule of shell.css naming one of its classes, only while not armed, that paints its background.
  const painted = classes.filter(function (c) {
    const re = new RegExp('[^{}]*\\.' + c.replace(/[-]/g, '\\-') + '[^{}]*:not\\(\\[data-armed\\]\\)[^{}]*\\{[^}]*background', 'i');
    return re.test(W.css);
  });
  return painted.indexOf(want) !== -1 || name + ': classes ' + JSON.stringify(classes) + ', painted by shell.css under :not([data-armed]): ' + JSON.stringify(painted);
};
test.run('End design mode: no inline background, which would beat the armed red', 0.2, async function () {
  W.css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  W.wd = deskWorld(Object.assign({}, goal, { design: true }), []);
  await W.wd.mount();
  return noInline('desk-end-design', 'End design mode');
}, test.limit.quick);
test.run('End design mode: its colour comes from a class shell.css paints only while unarmed (.desk-design-end:not([data-armed]))', 0.2, function () {
  if (!W.wd) return 'no page: the test above failed';
  return paintedClass('desk-end-design', 'End design mode', 'desk-design-end');
}, test.limit.quick);
test.run('Start design mode: no inline background, which would beat the armed red', 0.2, function () {
  if (!W.wd) return 'no page: the test above failed';
  return noInline('desk-start-design', 'Start design mode');
}, test.limit.quick);
test.run('Start design mode: its colour comes from a class shell.css paints only while unarmed (.desk-design-start:not([data-armed]))', 0.2, function () {
  if (!W.wd) return 'no page: the test above failed';
  return paintedClass('desk-start-design', 'Start design mode', 'desk-design-start');
}, test.limit.quick);
// goal/G43.22: no Team and no Apps; Andy: "G0 goes, from ui and server, kept in database."
test.run('the page draws no Team chat, no Team tab and no Apps tab', 0.2, async function () {
  const wt = deskWorld(goal, []);
  await wt.mount();
  const d = wt.document;
  return (!d.getElementById('desk-team') && !d.querySelector('[data-tab="apps"]') && !d.querySelector('[data-tab="team"]')) ||
    'still drawn: ' + JSON.stringify({ team: !!d.getElementById('desk-team'), apps: !!d.querySelector('[data-tab="apps"]'), teamTab: !!d.querySelector('[data-tab="team"]') });
}, test.limit.quick);

// ── goal/G43.3: THE LIST'S FILTERS, IN A REAL BROWSER ───────────────────────────────────────────
// Andy: "on the list search item.search, these two filters: [Current Goal Only] and [Goals only] MUST be mutually
// exclusive, both can be off, but only one of them can be active at once. so [Current Goal only] is the only filter On by
// default, and it MUST show the current goal when the page opens."
// goal/G43.3: /spirit/app/desk/element/desk/test/desk-opened.html: the page opened, with nothing on the stream
const F1 = W.f1 = {};
const read1 = async function (js) { try { return JSON.parse(await F1.page.evaluate(js)); } catch (e) { return { error: String(e) }; } };
const noF1 = function () { return !F1.o ? 'no page: the world failed' : ''; };
test.run('the world: the List draws its filter buttons', 0.2, async function () {
  const why = await bootPage(F1, true);
  if (why) return why;
  const page = F1.page;
  await page.send('Page.navigate', { url: F1.node.base + '/DEBUG/spirit/app/desk/element/desk/test/desk-opened.html' });
  await H.until(function () { return page.evaluate('typeof window.opened === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const o = await read1('window.opened()');
  if (o.found === true) F1.o = o;
  return o.found === true || 'the page: ' + JSON.stringify(o);
}, test.limit.slow);
test.run('[Current Goal Only] is the only filter on by default', 0.2, function () { if (noF1()) return noF1(); const o = F1.o; return (o.current === true && o.goals === false && o.closed === false) || 'at open: ' + JSON.stringify(o); }, test.limit.quick);
test.run('the first search asks for the current goal alone', 0.2, function () { if (noF1()) return noF1(); const o = F1.o; return (!!o.args && o.args.currentGoalOnly === true && o.args.goalsOnly === false && o.args.includeClosed === false) || 'at open it asked ' + JSON.stringify(o.args); }, test.limit.quick);
test.run('and the page shows the current goal and its item when it opens', 0.2, function () { if (noF1()) return noF1(); const o = F1.o; return (o.currentGoal === true && o.openItem === true) || 'at open: ' + JSON.stringify(o); }, test.limit.quick);
test.run('[Goals Only] pressed: [Current Goal Only] goes off', 0.2, async function () {
  if (noF1()) return noF1();
  const g = F1.g = await read1('window.press("goalsOnly")');
  return (g.goals === true && g.current === false) || 'after [Goals Only]: ' + JSON.stringify(g);
}, test.limit.slow);
test.run('and the search asks for goals, every goal', 0.2, function () { const g = F1.g; if (!g) return 'no press: the tests above failed'; return (!!g.args && g.args.goalsOnly === true && g.args.currentGoalOnly === false) || 'it asked ' + JSON.stringify(g.args); }, test.limit.quick);
test.run('and the List shows the goals, no item', 0.2, function () { const g = F1.g; if (!g) return 'no press: the tests above failed'; return (g.currentGoal === true && g.olderGoal === true && g.olderItem === false && g.openItem === false) || 'after [Goals Only]: ' + JSON.stringify(g); }, test.limit.quick);
test.run('[Current Goal Only] pressed: [Goals Only] goes off', 0.2, async function () {
  if (noF1()) return noF1();
  const c = F1.c = await read1('window.press("current")');
  return (c.current === true && c.goals === false) || 'after [Current Goal Only]: ' + JSON.stringify(c);
}, test.limit.slow);
test.run('and the List shows the current goal alone', 0.2, function () { const c = F1.c; if (!c) return 'no press: the tests above failed'; return (c.openItem === true && c.olderGoal === false && c.olderItem === false) || 'after [Current Goal Only]: ' + JSON.stringify(c); }, test.limit.quick);
test.run('pressed again: both are off', 0.2, async function () {
  if (noF1()) return noF1();
  const off = F1.off = await read1('window.press("current")');
  return (off.current === false && off.goals === false) || 'pressed again: ' + JSON.stringify(off);
}, test.limit.slow);
test.run('and the List shows every goal\'s items', 0.2, function () {
  stop(F1);
  const off = F1.off;
  if (!off) return 'no press: the tests above failed';
  return (!!off.args && off.args.currentGoalOnly === false && off.args.goalsOnly === false && off.openItem === true && off.olderItem === true) || 'both off: ' + JSON.stringify(off);
}, test.limit.quick);

// ── ANOTHER ITEM OPENS AFTER ONE WAS CLOSED, IN A REAL BROWSER ────────────────────────────────────────────
// Andy: "after i closed "Fix api branches" the other items won't open for me", "all i see, when opening another item is the
// titlebar of that item". A scratch node with desk switched on, a goal and two items; the Desk element on its face page:
// the first item opened and closed with its ✕, then the second opened, which must draw its own details in the one layer.
// another item opens with its details after one was opened and closed
const F2 = W.f2 = {};
const noF2 = function () { return !F2.ready ? 'no desk on a page: the world failed' : ''; };
const open2 = function (title) { return F2.page.evaluate("(function () { var all = Array.prototype.slice.call(document.querySelectorAll('#zzDesk *')).filter(function (x) { return x.textContent.indexOf(" + JSON.stringify(title) + ") !== -1 && !x.closest('.app-container'); }); if (!all.length) return false; all[all.length - 1].click(); return true; })()"); };
const shown2 = function () { return F2.page.evaluate("(function () { var all = Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container')); var b = all.filter(function (x) { return x.style.display !== 'none'; }).pop(); var body = b && b.querySelector('#dd-body'); return JSON.stringify({ layers: all.length, drawn: !!body && body.children.length > 0, text: b ? b.textContent : '' }); })()").then(JSON.parse); };
test.run('the world: a goal and two items on the scratch desk', 0.2, async function () {
  const why = await bootPage(F2, false);
  if (why) return why;
  const page = F2.page;
  await page.send('Page.navigate', { url: F2.node.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
  const call = caller(page);
  await call('app.active', { key: 'desk', active: true });
  await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
  const g = await call('desk.goal.add', { title: 'Opening goal' });
  await call('desk.press', { id: g.id, what: 'make-current' });
  F2.one = await call('desk.item.add', { goal: g.id, title: 'First opened item', blocks: '' });
  F2.two = await call('desk.item.add', { goal: g.id, title: 'Second opened item', blocks: '' });
  F2.ready = !!g.id && !!F2.one.id && !!F2.two.id;
  return F2.ready || 'added ' + JSON.stringify([g, F2.one, F2.two]);
}, test.limit.long);
test.run('the world: the first item\'s row is in the List', 0.2, async function () {
  if (noF2()) return noF2();
  const page = F2.page;
  await page.evaluate(MOUNT_DESK);
  await H.until(function () { return page.evaluate("document.getElementById('zzDesk').textContent.indexOf('Second opened item') !== -1"); }, H.WAIT);
  return (await open2('First opened item')) || 'no row for the first item';
}, test.limit.quick);
test.run('the first item opens with its details', 0.2, async function () {
  if (noF2()) return noF2();
  await H.until(function () { return shown2().then(function (s) { return s.drawn; }); }, H.WAIT);
  const first = await shown2();
  return (first.drawn && first.text.indexOf(F2.one.id) !== -1) || 'the first: ' + JSON.stringify(first).slice(0, 200);
}, test.limit.quick);
test.run('the world: the second item\'s row is in the List', 0.2, async function () {
  if (noF2()) return noF2();
  await F2.page.evaluate("(function () { var b = Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container')).filter(function (x) { return x.style.display !== 'none'; }).pop(); b.querySelector('.app-container-close').click(); return true; })()");
  return (await open2('Second opened item')) || 'no row for the second item';
}, test.limit.slow);
test.run('after it was closed, the second item opens with its own details, not its title bar alone', 0.2, async function () {
  if (noF2()) return noF2();
  await H.until(function () { return shown2().then(function (s) { return s.drawn && s.text.indexOf(F2.two.id) !== -1; }); }, H.WAIT);
  const second = F2.second = await shown2();
  return (second.drawn && second.text.indexOf(F2.two.id) !== -1) || 'the second: ' + JSON.stringify(second).slice(0, 200);
}, test.limit.quick);
test.run('every item opens in the one details layer', 0.2, function () {
  stop(F2);
  const second = F2.second;
  if (!second) return 'no second item opened: the tests above failed';
  return second.layers === 1 || second.layers + ' layers';
}, test.limit.quick);

// ── goal/G43.30: ON THE REAL PAGE, A CLOSE PRESSED ONCE CLOSES NOTHING ─────────────────────────────────────────
// The box: "A test presses each one once on the real page and finds that nothing happened", and the run status: "Desk
// and its detail load it from there", spirit/app/desk/element/deskRunStatus/. A scratch node with desk switched on, a
// goal and an item pressed done; the Desk element on its face page; every Close the List draws pressed once.
// goal/G43.30: on a real page, every Close in the List pressed once closes nothing; the run status from Desk's own elements
const F3 = W.f3 = {};
const noF3 = function () { return !F3.ready ? 'no desk on a page: the world failed' : ''; };
const CLOSES = "Array.prototype.filter.call(document.querySelectorAll('#zzDesk [data-press=\"close\"]'), function (b) { return b.getClientRects().length && !b.closest('.app-container'); })";
const state3 = async function () { const r = await F3.call('desk.item.get', { id: F3.it.id }); let i = r.item; if (typeof i === 'string') { try { i = JSON.parse(i); } catch (e) { i = null; } } return i || {}; };
test.run('the world: a goal and its item, done, on the scratch desk', 0.2, async function () {
  const why = await bootPage(F3, false);
  if (why) return why;
  const page = F3.page;
  await page.send('Page.navigate', { url: F3.node.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
  const call = F3.call = caller(page);
  await call('app.active', { key: 'desk', active: true });
  await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
  const g = await call('desk.goal.add', { title: 'Closing goal' });
  await call('desk.press', { id: g.id, what: 'make-current' });
  const it = F3.it = await call('desk.item.add', { goal: g.id, title: 'An item to close', blocks: '' });
  await call('desk.press', { id: it.id, what: 'done' });
  const before = await state3();
  F3.ready = !!g.id && !!it.id && before.status === 'done';
  return F3.ready || 'the world: ' + JSON.stringify({ goal: g.id, item: it.id, status: before.status });
}, test.limit.long);
test.run('the world: the List draws the done item\'s Close', 0.2, async function () {
  if (noF3()) return noF3();
  const page = F3.page;
  await page.evaluate(MOUNT_DESK);
  const drawn = await H.until(function () { return page.evaluate(CLOSES + '.length > 0'); }, H.WAIT);
  if (drawn) F3.drawn = true;
  return drawn || 'no Close in the List: ' + String(await page.evaluate("String(document.getElementById('zzDesk').innerText).slice(0, 300)"));
}, test.limit.quick);
test.run('each Close in the List pressed once: the item is still done, nothing closed', 0.2, async function () {
  if (!F3.drawn) return 'no Close drawn: the world failed';
  const page = F3.page;
  const n = F3.n = await page.evaluate(CLOSES + '.length');
  for (let i = 0; i < n; i++) await page.evaluate('(function () { var b = ' + CLOSES + '[' + i + ']; if (b) b.click(); return !!b; })()');
  await new Promise(function (r) { setTimeout(r, 1500); });
  const after = await state3();
  return after.status === 'done' || 'after one press each the item is ' + after.status;
}, test.limit.slow);
test.run('and each Close in the List stands armed, waiting for the second press', 0.2, async function () {
  if (!F3.drawn) return 'no Close drawn: the world failed';
  const armed = JSON.parse(await F3.page.evaluate('JSON.stringify(' + CLOSES + '.map(function (b) { return b.hasAttribute("data-armed"); }))'));
  return (armed.length === F3.n && armed.every(Boolean)) || 'after one press each, the List\'s Closes armed: ' + JSON.stringify(armed) + ' of ' + F3.n;
}, test.limit.quick);
test.run('Desk loads its run status from spirit/app/desk/element/deskRunStatus/, never from shell/shared/', 0.2, async function () {
  if (noF3()) { stop(F3); return noF3(); }
  const from = JSON.parse(await F3.page.evaluate('JSON.stringify(performance.getEntriesByType("resource").map(function (e) { return e.name; }).filter(function (x) { return /deskRunStatus/.test(x); }))'));
  stop(F3);
  const shared = /\/shell\/shared\//;
  return (from.some(function (x) { return x.indexOf('/spirit/app/desk/element/deskRunStatus/deskRunStatus.js') !== -1; }) && !from.some(function (x) { return shared.test(x); })) ||
    'the page loaded ' + JSON.stringify(from);
}, test.limit.quick);

// goal/G41.11: every list of Desk stands in a box of a stated size (rule/16)
// Andy, on G41.11: "the rules list is NOT placed properly in a size-limited container.... is this the same everywhere
// in desk?" rule/16: every probabilitySearch is mounted in a box that states its size, class fill, inside a pane that
// fills its app; never in a stat-tile or a box only as tall as its content. A list
// drawn as a dropdown stands inline, as every dropdown in the tree does, and is not asked here.
const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
const notFill = function (host) { const out = []; for (let n = host; n && n !== W.mountBox; n = n.parentNode) { if (!isFill(n)) out.push((n.id ? '#' + n.id : n.tagName || n.tag) + (n.className ? '.' + n.className : '')); } return out; };
const fillOf = function (name, verb) {
  const made = W.panes.filter(function (x) { return x.o.verb === verb; })[0];
  if (!made) return name + ': no list made';
  const gaps = notFill(made.host);
  return (isFill(made.host) && !gaps.length) || name + ': not fill: ' + gaps.join(' < ');
};
test.run('the List stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
  const wf = deskWorld(goal, [item]);
  const panes = W.panes = [];
  const realCreate = wf.win.spirit.element.spirit.element.search.create;
  wf.win.spirit.element.spirit.element.search.create = function (host, o) { if (!o || o.face !== 'dropdown') panes.push({ host: host, o: o || {} }); return realCreate(host, o); };
  await wf.mount();
  W.mountBox = wf.document.body.children[wf.document.body.children.length - 1];
  const rulesTab = wf.document.querySelector('[data-tab="rules"]');
  if (rulesTab) { wf.document.click(rulesTab); await settle(); }
  return fillOf('the List', 'items.search');
}, test.limit.quick);
test.run('the Rules list stands in a fill box, and every box up to the app is fill too', 0.2, function () {
  if (!W.panes) return 'no page: the test above failed';
  return fillOf('the Rules list', 'rules.search');
}, test.limit.quick);

// ── THE noPlugins PART ───────────────────────────────────────────────────────────────────────────────────────────
// THE DESK PAGE WITHOUT APPS, PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./desk.md, its noPlugins section): spirit/app/desk/element/desk/desk.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, comments left out.
// noPlugins: the desk page draws no Apps tab, no plugin and no team chat (goal/G43.22); Andy: "removal of plugin support.",
// and "G0 goes, from ui and server"
function codeOf(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
test.run('the desk page draws no Apps tab, no plugin tab and no team chat', 0.2, function () {
  const page = codeOf(path.join(RUN, 'spirit', 'app', 'desk', 'element', 'desk', 'desk.js'));
  return (!!page && !/goal\/G0['"]/.test(page) && !/data-tab="apps"/.test(page) && !/plugin/i.test(page)) || 'spirit/app/desk/element/desk/desk.js still names Apps, a plugin or goal/G0';
}, test.limit.quick);

test.after(function () { stop(F1); stop(F2); stop(F3); });

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
