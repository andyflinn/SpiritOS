'use strict';

// spirit/run/shell/desk/plugins/fallout/test/fallout.js
// The tests of shell/desk/plugins/fallout/fallout.js, and of no other module (spec: ./fallout.md; goal/G41.11). The
// browser file runs in node on a small page of its own (the page shell/desk/test/desk.js drives); the probability search
// is a stand-in that keeps the configuration it is handed and answers its one slot as the test says, and the Desk's ctx
// is a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'fallout.js');

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

// The probability search: create keeps its host and options; ask records each search in its one slot, and counts how
// many are in the air at once.
function listStub(totals) {
  const L = { made: [], asks: [], inAir: 0, mostInAir: 0, refreshed: 0 };
  L.create = function (host, opts) {
    L.made.push({ host: host, opts: opts });
    return {
      refresh: function () { L.refreshed++; },
      ask: function (verb, args) {
        L.asks.push({ verb: verb, args: args });
        L.inAir++; L.mostInAir = Math.max(L.mostInAir, L.inAir);
        return new Promise(function (r) { setImmediate(function () { L.inAir--; r({ total: totals[args.outcome] }); }); });
      },
    };
  };
  return L;
}
function world(withList, totals) {
  const document = makeDom();
  const win = { document: document, setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math };
  win.window = win;
  const list = listStub(totals || { red: 3, green: 7 });
  win.spirit = { elements: withList ? { probabilitySearch: { create: list.create } } : {} };
  // The one loader (spirit.require): what it was asked, each held until the test lets it answer.
  win.required = [];
  win.spirit.require = function (p) { return new Promise(function (resolve) { win.required.push({ path: String(p), resolve: resolve }); }); };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const ctx = { dialogs: [], streams: [], chats: [],
    calls: [],
    verb: function (name, args) { ctx.calls.push({ name: name, args: args }); return Promise.resolve({}); },
    onPublished: function (fn, server) { ctx.streams.push({ fn: fn, server: server }); },
    callDialog: function (app, params) { ctx.dialogs.push({ app: app, params: params }); },
    chat: function (el) { ctx.chats.push(el); } };
  const container = document.body.appendChild(document.createElement('div'));
  return { document: document, win: win, list: list, ctx: ctx, container: container, $: function (id) { return document.getElementById(id); } };
}
// THE PAGE WITH THE REAL LIST (goal/G41.22): what Andy sees is what the probability search draws, so the real one runs
// on the page, its three libraries before it, and deskVerify is a stand-in answering its search with the rows given, as
// deskVerify sends them (slim: suite, title, outcome, at; key suite + newline + title) and the totals of the outcome
// asked. A product test's suite is what the reporter sends, /<path>/<module> under spirit/run (test/testReport.js,
// SUITE); a test of the repo's spirit/test keeps its bare file name.
function realWorld(rows) {
  const document = makeDom();
  const win = { document: document, setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math,
    RegExp: RegExp, Date: Date, Infinity: Infinity, console: { log: function () {}, error: function () {} } };
  win.window = win;
  win.spirit = { elements: {}, require: function () { return Promise.resolve(true); } };
  vm.createContext(win);
  ['spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/probabilityBucket.js', 'shell/js/probabilitySearch.js', null].forEach(function (rel) {
    const f = rel ? path.join(RUN, rel) : FILE;
    vm.runInContext(fs.readFileSync(f, 'utf8'), win, { filename: f });
  });
  const ctx = { asked: [], dialogs: [], chats: 0,
    verb: function (name, args) {
      ctx.asked.push({ name: name, args: args });
      const of = rows.filter(function (r) { return !args.outcome || r.outcome === args.outcome; });
      const items = args.slim === 'yes' ? of.map(function (r) { return { key: r.suite + '\n' + r.title, label: JSON.stringify(r) }; }) : [];
      return Promise.resolve({ status: 200, body: { ok: true, items: items, more: false, total: of.length } });
    },
    onPublished: function () { return function () {}; },
    callDialog: function (app, params) { ctx.dialogs.push({ app: app, params: params }); },
    chat: function () { ctx.chats++; } };
  const container = document.body.appendChild(document.createElement('div'));
  const $ =function (id) { return document.getElementById(id); };
  // The rows the list shows now, each as its suite (the row's key) and its cells' text.
  const shown = function () {
    return $('fallout-list') ? $('fallout-list').querySelectorAll('tr').filter(function (tr) { return tr.hasAttribute('data-key'); }).map(function (tr) {
      return { suite: String(tr.getAttribute('data-key')).split('\n')[0], cells: tr.querySelectorAll('td').map(function (td) { return td.textContent.trim(); }) };
    }) : [];
  };
  // A filter button the list draws, by the words on it.
  const buttons = function () { return $('fallout-list') ? $('fallout-list').querySelectorAll('button').filter(function (b) { return b.hasAttribute('data-filter'); }) : []; };
  return { document: document, win: win, ctx: ctx, container: container, $: $, shown: shown, buttons: buttons };
}

test.startTest('fallout.js: Desk\'s Fallout tab, the verifier\'s reds');

(async function () {
  test.subHeading('it registers window.spirit.deskPlugins.fallout');
  const w = world(true);
  const P = w.win.spirit.deskPlugins && w.win.spirit.deskPlugins.fallout;
  ok(!!P && typeof P.open === 'function', 'window.spirit.deskPlugins.fallout.open is there', 'deskPlugins: ' + short(w.win.spirit.deskPlugins && Object.keys(w.win.spirit.deskPlugins)));
  if (!P) return;

  test.subHeading('open: its blocks, the Reds tab first, Items empty and hidden');
  P.open(w.container, w.ctx); await settle();
  ['fallout-summary', 'fallout-tabs', 'fallout-pane-reds', 'fallout-list', 'fallout-items'].forEach(function (id) {
    ok(!!w.$(id), 'it draws #' + id, 'no #' + id);
  });
  // goal/G41.22, box v25, Andy: "The chat needs to be removed from fallout". The goal chat it carried since goal/G27.14
  // ("add the goal chat at the bottom.") is gone: the Desk mounts a plugin's chat only where the plugin hands it a box
  // (ctx.chat, shell/desk/desk.js), so Fallout hands none, draws no chat block of its own, and asks for no chat.
  test.subHeading('goal/G41.22: the Fallout view carries no chat');
  ok(w.ctx.chats.length === 0, 'ctx.chat is never called: the Desk mounts no goal chat in Fallout', 'ctx.chat handed ' + w.ctx.chats.length + ' box(es): ' + short(w.ctx.chats.map(function (c) { return c.id; })));
  const every = function (n, out) { (n.children || []).forEach(function (c) { out.push(c); every(c, out); }); return out; };
  const chatty = every(w.container, []).filter(function (n) { return /chat/i.test(String(n.id || '') + ' ' + String(n.className || '')); });
  ok(chatty.length === 0, 'nothing it draws is a chat: no element whose id or class names chat', 'chat elements drawn: ' + short(chatty.map(function (n) { return n.id || n.className; })));
  const said = w.container.querySelectorAll('textarea').concat(w.container.querySelectorAll('input').filter(function (n) { return /say|chat|message/i.test(String(n.id || '') + ' ' + String(n.getAttribute('placeholder') || '')); }));
  ok(said.length === 0, 'no chat input: no textarea, no field to say a line in', 'inputs drawn: ' + short(said.map(function (n) { return n.id || n.tagName; })));
  const tabs = w.$('fallout-tabs').querySelectorAll('[data-fallout-tab]');
  ok(tabs.length === 2 && tabs[0].textContent === 'Reds' && tabs[1].textContent === 'Items' && tabs[0].getAttribute('aria-selected') === 'true' && tabs[1].getAttribute('aria-selected') === 'false',
    'two inner tabs, Reds selected, Items not', short(tabs.map(function (t) { return [t.textContent, t.getAttribute('aria-selected')]; })));
  ok(w.$('fallout-pane-reds').hidden === false && w.$('fallout-items').hidden === true, 'Reds shows; Items is hidden', 'reds hidden ' + w.$('fallout-pane-reds').hidden + ', items hidden ' + w.$('fallout-items').hidden);
  ok(/Nothing yet: the Fallout items come later/.test(w.$('fallout-items').textContent), 'Items says it holds nothing yet', w.$('fallout-items').textContent);

  test.subHeading('the Reds list: deskVerify\'s search through the probability search');
  const made = w.list.made[0];
  ok(w.list.made.length === 1 && made.host === w.$('fallout-list'), 'one list is made, in #fallout-list', 'made: ' + w.list.made.length);
  const o = made.opts;
  // WHAT IT DOES, NOT HOW IT IS WIRED (goal/G41.23; Andy: "i approve" wsl rewriting the two checks of how the list is
  // built, since Fallout adds the icon to each row on the way in): a call the list makes reaches the ctx's own call,
  // its name and arguments as they are, and the list follows the ctx's own stream.
  const callsBefore = w.ctx.calls.length;
  let through = null;
  try { through = o.api && typeof o.api.verb === 'function' ? o.api.verb('deskVerify.search', { over: 'tests', probe: 1 }) : null; } catch (e) { through = null; }
  await Promise.resolve(through).catch(function () {});
  const reached = w.ctx.calls.slice(callsBefore);
  ok(o.server === 'deskVerify' && o.verb === 'search' && reached.length === 1 && reached[0].name === 'deskVerify.search' && JSON.stringify(reached[0].args) === '{"over":"tests","probe":1}' && o.api.onPublished === w.ctx.onPublished,
    'it searches deskVerify, verb search: a call of the list reaches the ctx\'s own call as it is, and it follows the ctx\'s own stream',
    short({ server: o.server, verb: o.verb, reached: reached, stream: o.api && o.api.onPublished === w.ctx.onPublished }));
  ok(w.list.refreshed === 1, 'the list is refreshed once at open', 'refreshed: ' + w.list.refreshed);
  // The columns by what they say; the Result column's field is the one each row carries its ✅ or ❌ in (the real list's
  // checks below).
  ok(JSON.stringify(o.columns.map(function (c) { return c.label; })) === '["Suite","Test","Result","Since"]' && o.columns[0].field === 'suite' && o.columns[1].field === 'title' && o.columns[3].field === 'at' && o.columns[3].sort === 'date' && o.empty === 'No test matches.',
    'one line per test: Suite, Test, Result, Since (by date); empty says No test matches.', short(o.columns));
  ok(JSON.stringify(o.args('', {})) === JSON.stringify({ over: 'tests', current: 'yes', slim: 'yes' }), 'no text: the tests that stand now, slim', short(o.args('', {})));
  ok(JSON.stringify(o.args('deskChat.js', { outcome: 'red' })) === JSON.stringify({ over: 'tests', current: 'yes', slim: 'yes', outcome: 'red', suite: 'deskChat.js' }),
    'a suite\'s file name asks for that suite; the outcome filter goes along', short(o.args('deskChat.js', { outcome: 'red' })));
  ok(o.args('relay answers', null).test === 'relay answers' && !('suite' in o.args('relay answers', null)) && !('suite' in o.args('a/b.js')), 'other text asks for a test by its words; a path is no suite name',
    short(o.args('a/b.js')));
  ok(JSON.stringify(o.matched({ suite: 's.js', title: 't', outcome: 'red' })) === '{"suite":"s.js","title":"t"}' && JSON.stringify(o.matched(null)) === '{"suite":"","title":""}',
    'the words matched are the suite and the title', short(o.matched(null)));
  // The outcome filter by its name: since goal/G41.22 a second filter, product tests only, stands beside it (below).
  const f = o.filters.filter(function (x) { return x && x.name === 'outcome'; })[0] || {};
  ok(o.filters[0] === f && Array.isArray(f.choices) && f.choices.map(function (c) { return c.value; }).join(',') === 'red,green,' && f.choices[0].icon === '❌' && f.choices[1].icon === '✅',
    'the first filter is outcome: red ❌ first, green ✅, then both', short(o.filters));
  ok(f.test({ outcome: 'red' }, 'red') === 1 && f.test({ outcome: 'green' }, 'red') === 0 && f.test({ outcome: 'green' }, '') === 1, 'the filter keeps the rows of its outcome, and all for both',
    'filter answers wrong');
  o.details({ suite: 's.js', title: 'the test #1' });
  ok(w.ctx.dialogs.length === 1 && w.ctx.dialogs[0].app === 'shell/falloutHistory' && JSON.stringify(w.ctx.dialogs[0].params) === '{"suite":"s.js","heading":"the test #1"}',
    'a row\'s details open shell/falloutHistory {suite, heading}', short(w.ctx.dialogs));

  test.subHeading('the summary: how many are red now, of all, through the list\'s one slot');
  ok(w.$('fallout-summary').textContent === '❌ 3 red of 10 tests now (30%).', 'it says ❌ <red> red of <all> tests now (<pct>%).', w.$('fallout-summary').textContent);
  ok(w.list.asks.length === 2 && w.list.asks.every(function (a) { return a.verb === 'search' && a.args.over === 'tests' && a.args.current === 'yes'; }) &&
    w.list.asks[0].args.outcome === 'red' && w.list.asks[1].args.outcome === 'green', 'two deskVerify searches, red then green', short(w.list.asks));
  ok(w.list.mostInAir === 1, 'never more than one search in the air (Andy: "MAX one search in flight")', 'most in the air: ' + w.list.mostInAir);
  const sub = w.ctx.streams.filter(function (s) { return s.server === 'deskVerify'; });
  ok(sub.length === 1, 'it follows deskVerify\'s stream', 'streams: ' + short(w.ctx.streams.map(function (s) { return s.server; })));
  sub[0].fn({ any: 1 }); await settle();
  ok(w.list.asks.length === 4 && w.list.mostInAir === 1, 'each deskVerify publish counts again, one search at a time', 'asks ' + w.list.asks.length + ', most in air ' + w.list.mostInAir);
  const w0 = world(true, { red: 0, green: 0 });
  w0.win.spirit.deskPlugins.fallout.open(w0.container, w0.ctx); await settle();
  ok(w0.$('fallout-summary').textContent === '❌ 0 red of 0 tests now.', 'no tests at all: no percentage', w0.$('fallout-summary').textContent);

  test.subHeading('the inner tabs switch on a click, wired once');
  w.document.click(w.$('fallout-tabs').querySelector('[data-fallout-tab="items"]'));
  ok(w.$('fallout-pane-reds').hidden === true && w.$('fallout-items').hidden === false && w.$('fallout-tabs').querySelector('[data-fallout-tab="items"]').getAttribute('aria-selected') === 'true',
    'Items pressed: Items shows, Reds hides, Items is selected', 'reds hidden ' + w.$('fallout-pane-reds').hidden + ', items hidden ' + w.$('fallout-items').hidden);
  w.document.click(w.$('fallout-tabs').querySelector('[data-fallout-tab="reds"]'));
  ok(w.$('fallout-pane-reds').hidden === false && w.$('fallout-items').hidden === true, 'Reds pressed: back to Reds', 'reds hidden ' + w.$('fallout-pane-reds').hidden);
  w.document.click(w.$('fallout-summary'));
  ok(w.$('fallout-pane-reds').hidden === false, 'a click elsewhere changes nothing', 'switched on a stray click');
  P.open(w.container, w.ctx); await settle();
  // Opened again on the same container: one listener, so one press toggles once (a second listener would toggle too,
  // to the same tab; counted through the redraws of the tab row instead).
  let draws = 0;
  const row = w.$('fallout-tabs');
  const desc = Object.getOwnPropertyDescriptor(row, 'innerHTML');
  Object.defineProperty(row, 'innerHTML', { get: desc.get, set: function (v) { draws++; desc.set.call(row, v); }, configurable: true });
  w.document.click(row.querySelector('[data-fallout-tab="items"]'));
  ok(draws === 1, 'opened again on the same container, a press is heard once', 'tab row drawn ' + draws + ' times for one press');

  test.subHeading('without the probability search on the page, it loads it through spirit.require and mounts when it is there (goal/G41.11)');
  const wl = world(false);
  wl.win.spirit.deskPlugins.fallout.open(wl.container, wl.ctx); await settle();
  const scripts = wl.document.body.children.filter(function (c) { return c.tagName === 'SCRIPT'; });
  const asked = wl.win.required.filter(function (r) { return r.path === 'shell/js/probabilitySearch.js'; });
  ok(asked.length === 1 && scripts.length === 0, 'it asks spirit.require for shell/js/probabilitySearch.js, and puts no script tag on the page',
    'required ' + short(wl.win.required.map(function (r) { return r.path; })) + ', scripts ' + scripts.length);
  ok(wl.list.made.length === 0, 'and no list is made before it loads', 'made: ' + wl.list.made.length);
  wl.win.spirit.elements.probabilitySearch = { create: wl.list.create };
  if (asked[0]) asked[0].resolve({}); await settle();
  ok(wl.list.made.length === 1 && wl.list.made[0].host === wl.$('fallout-list') && wl.$('fallout-summary').textContent === '❌ 3 red of 10 tests now (30%).',
    'once it loads, the list is made and the summary counted', 'made ' + wl.list.made.length + ', summary ' + wl.$('fallout-summary').textContent);

  test.subHeading('a ctx with no chat and no dialog is harmless');
  const wn = world(true);
  let threw = null;
  try { wn.win.spirit.deskPlugins.fallout.open(wn.container, { verb: wn.ctx.verb }); await settle(); wn.list.made[0].opts.details({ suite: 'a', title: 'b' }); } catch (e) { threw = e; }
  ok(!threw && wn.list.made.length === 1, 'no chat, no stream, no dialog: it opens and its details do nothing', 'threw ' + short(threw && threw.message));

  test.subHeading('goal/G41.11: its Reds list stands in a box of a stated size (rule/16)');
  // rule/16: every probabilitySearch is mounted in a box that states its size, class fill, inside a pane that fills its
  // app; never in a stat-tile or a box only as tall as its content. The plugin's box is the one Desk hands it.
  const wfill = world(true);
  wfill.win.spirit.deskPlugins.fallout.open(wfill.container, wfill.ctx); await settle();
  const host = wfill.list.made.length ? wfill.list.made[0].host : null;
  const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
  const gaps = [];
  for (let n = host; n && n !== wfill.container; n = n.parentNode) { if (!isFill(n) || / stat-tile /.test(' ' + String(n.className || '') + ' ')) gaps.push((n.id ? '#' + n.id : n.tagName || '') + (n.className ? '.' + n.className : '')); }
  ok(!!host && !gaps.length, 'the Reds list stands in a fill box, every box up to the plugin\'s own is fill, none a stat-tile', 'not fill: ' + (host ? gaps.join(' < ') : 'no list made'));

  // goal/G41.22, Andy: "fallout needs a filter that show me product tests only, and the "green"/"red" column must use
  // icons". Agreed: product tests are the tests under spirit/run; the repo's spirit/test is hidden by the filter. The
  // icons are the reporter's own: ✅ green, ❌ red. Judged on the real list's rows, what Andy sees.
  const ROWS = [
    { suite: '/shell/desk/plugins/fallout', title: '/shell/desk/plugins/fallout open #1', outcome: 'red', at: '2026-10-30T10:00:00Z' },
    { suite: 'relayGates.js', title: 'relayGates.js gates #1', outcome: 'red', at: '2026-10-30T10:01:00Z' },
    { suite: '/spirit/appServer', title: '/spirit/appServer serves #2', outcome: 'green', at: '2026-10-30T10:02:00Z' },
    { suite: 'agentReadme.js', title: 'agentReadme.js reads #3', outcome: 'green', at: '2026-10-30T10:03:00Z' },
  ];
  const isProduct = function (suite) { return suite.charAt(0) === '/'; };
  test.subHeading('goal/G41.22: the real list on the page, deskVerify a stand-in');
  const wr = realWorld(ROWS);
  wr.win.spirit.deskPlugins.fallout.open(wr.container, wr.ctx); await settle();
  // Both outcomes shown, so every row stands (the outcome filter opens on red).
  const both = wr.buttons().filter(function (b) { return b.getAttribute('data-filter') === 'outcome' && b.getAttribute('data-value') === ''; })[0];
  if (both) { wr.document.click(both); await settle(); }
  const all = wr.shown();
  ok(!!both && all.length === ROWS.length, 'the real list draws the four rows deskVerify answers, both outcomes shown', 'rows shown: ' + short(all));
  // box v25, "The chat needs to be removed from fallout": what it asks over the wire, the real list's included, is no chat's.
  const chatAsks = wr.ctx.asked.filter(function (a) { return /chat/i.test(a.name); });
  ok(wr.ctx.asked.length > 0 && !chatAsks.length && wr.ctx.chats === 0, 'opened with the real list, it asks for no chat and mounts none (box v25)',
    'chat asked: ' + short(chatAsks) + ', ctx.chat called ' + wr.ctx.chats + ' times');

  test.subHeading('goal/G41.22: the Result column shows ✅ for green and ❌ for red, not the words');
  const cellsOf = function (suite) { const r = all.filter(function (x) { return x.suite === suite; })[0]; return r ? r.cells : []; };
  ok(cellsOf('/spirit/appServer').indexOf('✅') !== -1 && cellsOf('agentReadme.js').indexOf('✅') !== -1, 'a green test\'s row has a cell reading ✅', 'green rows: ' + short([cellsOf('/spirit/appServer'), cellsOf('agentReadme.js')]));
  ok(cellsOf('/shell/desk/plugins/fallout').indexOf('❌') !== -1 && cellsOf('relayGates.js').indexOf('❌') !== -1, 'a red test\'s row has a cell reading ❌', 'red rows: ' + short([cellsOf('/shell/desk/plugins/fallout'), cellsOf('relayGates.js')]));
  ok(all.length && all.every(function (r) { return r.cells.every(function (c) { return c !== 'green' && c !== 'red'; }); }), 'no cell says green or red in words', 'rows: ' + short(all));

  test.subHeading('goal/G41.22: a filter shows product tests only, the tests under spirit/run; spirit/test is hidden');
  // The control's shape is the build's: any filter button of the list whose words name product. Its group is its
  // data-filter; off is another choice of that group, or the same button again for a toggle.
  const product = wr.buttons().filter(function (b) { return /product/i.test(b.textContent); })[0];
  ok(!!product, 'the list has a filter button that names product tests', 'filter buttons: ' + short(wr.buttons().map(function (b) { return b.textContent; })));
  if (product) {
    const group = product.getAttribute('data-filter');
    wr.document.click(product); await settle();
    const only = wr.shown();
    ok(only.length === 2 && only.every(function (r) { return isProduct(r.suite); }), 'pressed: only the product tests show, both outcomes still', 'rows shown: ' + short(only.map(function (r) { return r.suite; })));
    const off = wr.buttons().filter(function (b) { return b.getAttribute('data-filter') === group && !/product/i.test(b.textContent); })[0] ||
      wr.buttons().filter(function (b) { return /product/i.test(b.textContent); })[0];
    if (off) { wr.document.click(off); await settle(); }
    const back = wr.shown();
    ok(back.length === ROWS.length, 'off again: the spirit/test rows show too', 'rows shown: ' + short(back.map(function (r) { return r.suite; })));
    const red = wr.buttons().filter(function (b) { return b.getAttribute('data-filter') === 'outcome' && b.getAttribute('data-value') === 'red'; })[0];
    const prod = wr.buttons().filter(function (b) { return /product/i.test(b.textContent); })[0];
    if (red) { wr.document.click(red); await settle(); }
    if (prod) { wr.document.click(prod); await settle(); }
    const redProduct = wr.shown();
    ok(redProduct.length === 1 && redProduct[0].suite === '/shell/desk/plugins/fallout', 'with ❌ and product tests: the one red product test', 'rows shown: ' + short(redProduct.map(function (r) { return r.suite; })));
  }
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
