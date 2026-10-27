'use strict';

// spirit/run/shell/desk/plugins/vision/test/vision.js
// The tests of shell/desk/plugins/vision/vision.js, and of no other module (spec: ./vision.md; goal/G41.11). The
// browser file runs in node on a small page of its own (the page shell/desk/test/desk.js drives); the desk server is a
// recorder holding a goal and its items, the label rule a stand-in, the Desk's ctx a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'vision.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// ── THE PAGE (shell/desk/test/desk.js) ──────────────────────────────────────────────────────────────────────────────
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
// An event on an element, bubbling to every listener above it, as doc.click does.
function fire(doc, type, target, extra) {
  const ev = Object.assign({ type: type, target: target, preventDefault: function () {}, stopPropagation: function () {} }, extra || {});
  let p = target; while (p) { if (p.dispatch) p.dispatch(type, ev); p = p.parentNode; }
  return ev;
}

const GOAL = 'plugin/vision';
function world(items) {
  const document = makeDom();
  const win = { document: document, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String };
  win.window = win;
  // The label rule (fieldRules.js), a stand-in: '' when it may be sent.
  win.spirit = { fieldRules: { problem: function (v) { return /#/.test(v) ? 'no # in a label' : ''; } } };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const store = {};
  (items || []).forEach(function (x) { store[x.id] = x; });
  const ctx = { goal: GOAL, asked: [], dialogs: [], streams: [], chats: [], refuseAdd: null,
    ask: function (verb, args) {
      ctx.asked.push({ verb: verb, args: args });
      if (verb === 'item.get') return store[args.id] ? Promise.resolve({ item: JSON.stringify(store[args.id]) }) : Promise.reject(new Error('no such item'));
      if (verb === 'item.add') {
        if (ctx.refuseAdd) return Promise.reject(new Error(ctx.refuseAdd));
        const id = GOAL + '.' + (Object.keys(store).length);
        store[id] = { id: id, goal: GOAL, title: args.title };
        store[GOAL].blocked = (store[GOAL].blocked || []).concat([id]);
        return Promise.resolve({ id: id });
      }
      return Promise.resolve({});
    },
    onPublished: function (fn) { ctx.streams.push(fn); },
    callDialog: function (app, params) { ctx.dialogs.push({ app: app, params: params }); return Promise.resolve(); },
    chat: function (el) { ctx.chats.push(el); } };
  const container = document.body.appendChild(document.createElement('div'));
  return { document: document, win: win, ctx: ctx, store: store, container: container, $: function (id) { return document.getElementById(id); },
    gets: function () { return ctx.asked.filter(function (a) { return a.verb === 'item.get'; }).length; } };
}
const ITEMS = [
  { id: GOAL, goal: '', title: 'Vision', blocked: [GOAL + '.1', GOAL + '.2', 'goal/G5.1'] },
  { id: GOAL + '.1', goal: GOAL, title: 'Ships <fast>', blocked: [GOAL + '.2'] },
  { id: GOAL + '.2', goal: GOAL, title: 'Second', blocked: [] },
  { id: 'goal/G5.1', goal: 'goal/G5', title: 'Not of this goal' },
];

test.startTest('vision.js: Desk\'s Vision tab, the vision item by item');

(async function () {
  test.subHeading('it registers window.spirit.deskPlugins.vision');
  const w = world(ITEMS);
  const P = w.win.spirit.deskPlugins && w.win.spirit.deskPlugins.vision;
  ok(!!P && typeof P.open === 'function', 'window.spirit.deskPlugins.vision.open is there', 'deskPlugins: ' + short(w.win.spirit.deskPlugins && Object.keys(w.win.spirit.deskPlugins)));
  if (!P) return;

  test.subHeading('open: what it is, the add, the items, the goal\'s chat last');
  P.open(w.container, w.ctx); await settle();
  ['vision-title', 'vision-add', 'vision-note', 'vision-items', 'vision-chat'].forEach(function (id) { ok(!!w.$(id), 'it draws #' + id, 'no #' + id); });
  const ids = w.container.querySelectorAll('[id]').map(function (n) { return n.id; });
  ok(ids[ids.length - 1] === 'vision-chat' && w.ctx.chats.length === 1 && w.ctx.chats[0] === w.$('vision-chat'), 'the goal\'s chat is last, handed to ctx.chat', short(ids));
  ok(w.$('vision-title').getAttribute('data-field') === 'label', 'the title box carries data-field="label"', short(w.$('vision-title').attrs));

  test.subHeading('its goal\'s items, read from the goal\'s own facts');
  ok(w.ctx.asked[0].verb === 'item.get' && w.ctx.asked[0].args.id === GOAL && w.gets() === 4, 'item.get of the goal, then of each item it names (blocked)', short(w.ctx.asked.map(function (a) { return a.args.id; })));
  const rows = w.$('vision-items').querySelectorAll('tr');
  ok(rows.length === 2, 'only the items of its goal are rows (one named of another goal is left out)', 'rows: ' + rows.length);
  ok(/Ships <fast> \(plugin\/vision\.1\)/.test(rows[0].textContent) && w.$('vision-items').innerHTML.indexOf('Ships &lt;fast&gt;') !== -1, 'a row says its title, escaped, and its id', rows[0].textContent);
  ok(/waits on plugin\/vision\.2/.test(rows[0].textContent) && !/waits on/.test(rows[1].textContent), 'an item blocked by another says what it waits on', short(rows.map(function (r) { return r.textContent; })));
  ok(rows.every(function (r, i) { const b = r.querySelector('button'); return b && b.textContent === 'Open' && b.getAttribute('data-open') === ITEMS[i + 1].id; }), 'each row has its Open, carrying its id', 'an Open is missing');
  const we = world([{ id: GOAL, goal: '', title: 'Vision' }]);
  we.win.spirit.deskPlugins.vision.open(we.container, we.ctx); await settle();
  ok(/Nothing in the vision yet\./.test(we.$('vision-items').textContent), 'a goal with no items says nothing is in the vision yet', we.$('vision-items').textContent);
  const wg = world([]);
  wg.win.spirit.deskPlugins.vision.open(wg.container, wg.ctx); await settle();
  ok(/Nothing in the vision yet\./.test(wg.$('vision-items').textContent), 'a goal that cannot be read lists nothing, quietly', short(wg.$('vision-items').textContent));

  test.subHeading('Add: on only while a title the label rule takes is typed');
  ok(w.$('vision-add').disabled === true, 'with nothing typed Add is off', 'disabled ' + w.$('vision-add').disabled);
  w.$('vision-title').value = 'A topic';
  fire(w.document, 'input', w.$('vision-title'));
  ok(w.$('vision-add').disabled === false, 'typed, Add is on', 'disabled ' + w.$('vision-add').disabled);
  w.$('vision-title').value = 'bad # topic';
  fire(w.document, 'input', w.$('vision-title'));
  ok(w.$('vision-add').disabled === true, 'a title the label rule refuses: Add is off', 'disabled ' + w.$('vision-add').disabled);
  w.document.click(w.$('vision-add')); await settle();
  ok(w.$('vision-note').textContent === 'Not added: no # in a label' && !w.ctx.asked.some(function (a) { return a.verb === 'item.add'; }), 'pressed anyway, it says why and sends nothing', w.$('vision-note').textContent);
  w.$('vision-title').value = '   ';
  w.document.click(w.$('vision-add')); await settle();
  ok(!w.ctx.asked.some(function (a) { return a.verb === 'item.add'; }), 'a blank title sends nothing', 'sent item.add');

  test.subHeading('Add: item.add under its goal; the list read again');
  w.$('vision-title').value = '  Third  ';
  const before = w.gets();
  w.document.click(w.$('vision-add')); await settle();
  const add = w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; });
  ok(add.length === 1 && JSON.stringify(add[0].args) === JSON.stringify({ goal: GOAL, title: 'Third', blocks: '' }), 'item.add {goal, the title trimmed, blocks: \'\'}', short(add.map(function (a) { return a.args; })));
  ok(w.$('vision-title').value === '' && w.$('vision-note').textContent === 'Added plugin/vision.4.' && w.$('vision-add').disabled === true, 'added: the box emptied, Add off, and it says Added <id>.',
    w.$('vision-note').textContent);
  ok(w.gets() > before && w.$('vision-items').querySelectorAll('tr').length === 3, 'the list is read again and holds the new item', 'rows ' + w.$('vision-items').querySelectorAll('tr').length);
  w.ctx.refuseAdd = 'the desk is closed';
  w.$('vision-title').value = 'Fourth';
  w.document.click(w.$('vision-add')); await settle();
  ok(w.$('vision-note').textContent === 'Not added: the desk is closed' && w.$('vision-title').value === 'Fourth', 'refused: it says Not added: <why>, and the title stays', w.$('vision-note').textContent);
  w.ctx.refuseAdd = null;
  fire(w.document, 'keydown', w.$('vision-title'), { key: 'Enter', repeat: true }); await settle();
  ok(w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; }).length === 2, 'a held Enter (repeat) adds nothing', 'adds ' + w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; }).length);
  fire(w.document, 'keydown', w.$('vision-title'), { key: 'Enter' }); await settle();
  ok(w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; }).length === 3 && w.$('vision-title').value === '', 'Enter in the title box adds it', 'adds ' + w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; }).length);
  fire(w.document, 'keydown', w.$('vision-note'), { key: 'Enter' }); await settle();
  ok(w.ctx.asked.filter(function (a) { return a.verb === 'item.add'; }).length === 3, 'Enter anywhere else adds nothing', 'added from another element');

  test.subHeading('Open: the standard deskDetails dialog; the list read again when it closes');
  const g0 = w.gets();
  w.document.click(w.$('vision-items').querySelector('[data-open="plugin/vision.2"]')); await settle();
  ok(w.ctx.dialogs.length === 1 && w.ctx.dialogs[0].app === 'shell/deskDetails' && w.ctx.dialogs[0].params.id === 'plugin/vision.2', 'Open calls shell/deskDetails {id}', short(w.ctx.dialogs));
  ok(w.gets() > g0, 'and the list is read again once it closes', 'gets before ' + g0 + ', after ' + w.gets());
  const wd = world(ITEMS); delete wd.ctx.callDialog;
  wd.win.spirit.deskPlugins.vision.open(wd.container, wd.ctx); await settle();
  let threw = null; try { wd.document.click(wd.$('vision-items').querySelector('[data-open]')); await settle(); } catch (e) { threw = e; }
  ok(!threw, 'a ctx with no dialog: Open does nothing, harmlessly', 'threw ' + short(threw && threw.message));

  test.subHeading('its own stream: subscribed once; a row of its goal reads the items again');
  ok(w.ctx.streams.length === 1, 'open subscribes to the stream', 'streams: ' + w.ctx.streams.length);
  P.open(w.container, w.ctx); await settle();
  ok(w.ctx.streams.length === 1, 'a second open does not subscribe again', 'streams: ' + w.ctx.streams.length);
  const hear = w.ctx.streams[0];
  let g = w.gets();
  hear({ item: { id: 'goal/G5.1', goal: 'goal/G5' } }); hear({ table: 'chat', id: GOAL }); hear(null); hear('x'); hear({ item: 'not json' }); await settle();
  ok(w.gets() === g, 'a row of another goal, a side row, a non-object, broken JSON: nothing read', 'gets ' + g + ' -> ' + w.gets());
  hear({ item: { id: GOAL + '.9', goal: GOAL } }); await settle();
  ok(w.gets() > g, 'an item of its goal reads the items again', 'gets ' + g + ' -> ' + w.gets());
  g = w.gets();
  hear({ item: JSON.stringify({ id: GOAL, goal: '' }) }); await settle();
  ok(w.gets() > g, 'its goal itself, as a JSON string, reads them again too', 'gets ' + g + ' -> ' + w.gets());
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
