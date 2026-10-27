'use strict';

// spirit/run/shell/desk/plugins/stackFrameChecks/test/stackFrameChecks.js
// The tests of shell/desk/plugins/stackFrameChecks/stackFrameChecks.js, and of no other module (spec:
// ./stackFrameChecks.md; goal/G41.11). The browser file runs in node on a small page of its own (the page
// shell/desk/test/desk.js drives). The shared door fields are a stand-in (they have their own test,
// shell/shared/js/test/deskDoorFields.js) that keeps four inputs and records each call; the desk server and the Desk's
// ctx are recorders.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'stackFrameChecks.js');

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

// The door fields, a stand-in: four inputs, the door read from them, why answered from a table the test sets.
function fieldsStub(document) {
  const F = { FIELDS: ['gate', 'endpoint', 'paths', 'suites'], calls: [], wrong: {} };
  const val = function (pre, f) { const el = document.getElementById(pre + f); return el ? String(el.value || '') : ''; };
  const list = function (v) { return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean); };
  F.html = function (pre) { F.calls.push(['html', pre]); return F.FIELDS.map(function (f) { return '<input type="text" id="' + pre + f + '" data-field="' + f + '">'; }).join(''); };
  F.check = function (pre, b) { F.calls.push(['check', pre, b]); return true; };
  F.why = function (pre, f) { return F.wrong[f] || ''; };
  F.door = function (pre) { return { gate: val(pre, 'gate').trim(), endpoint: val(pre, 'endpoint').trim(), paths: list(val(pre, 'paths')), suites: list(val(pre, 'suites')) }; };
  F.fill = function (pre, d) { F.calls.push(['fill', pre, d]); F.FIELDS.forEach(function (f) { const el = document.getElementById(pre + f); if (el) el.value = ''; }); };
  return F;
}
const GOAL = 'plugin/stackFrameChecks';
const DOOR = function (id, more) { return Object.assign({ id: id, gate: 'spirit/run/a.js::g', endpoint: 'spirit/run/b.js', paths: [], suites: ['s.js'], item: GOAL + '.1' }, more || {}); };
function world(o) {
  o = o || {};
  const document = makeDom();
  const win = { document: document, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String };
  win.window = win;
  const F = fieldsStub(document);
  win.spirit = { elements: o.noFields ? {} : { deskDoorFields: F } };
  // The one loader (spirit.require): what it was asked, each held until the test lets it answer.
  win.required = [];
  win.spirit.require = function (p) { return new Promise(function (resolve) { win.required.push({ path: String(p), resolve: resolve }); }); };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const store = o.items || {};
  const ctx = { goal: GOAL, asked: [], dialogs: [], streams: [], chats: [], doors: o.doors || [], more: false, refuseMake: null,
    ask: function (verb, args) {
      ctx.asked.push({ verb: verb, args: args });
      if (verb === 'item.get') return store[args.id] ? Promise.resolve({ item: JSON.stringify(store[args.id]) }) : Promise.reject(new Error('no such item'));
      if (verb === 'stackFrameChecks.doors.search') {
        const t = String(args.text || '');
        return Promise.resolve({ items: ctx.doors.filter(function (d) { return !t || d.gate.indexOf(t) !== -1; }).map(function (d) { return { key: d.id, label: JSON.stringify(d) }; }), more: ctx.more });
      }
      if (verb === 'stackFrameChecks.make') return ctx.refuseMake ? Promise.reject(new Error(ctx.refuseMake)) : Promise.resolve({ id: GOAL + '.7', door: 'door-7' });
      return Promise.resolve({ ok: true });
    },
    onPublished: function (fn) { ctx.streams.push(fn); },
    callDialog: function (app, params) { ctx.dialogs.push({ app: app, params: params }); return Promise.resolve(); },
    chat: function (el) { ctx.chats.push(el); } };
  if (o.noDialog) delete ctx.callDialog;
  const container = document.body.appendChild(document.createElement('div'));
  return { document: document, win: win, F: F, ctx: ctx, container: container, $: function (id) { return document.getElementById(id); },
    open: function () { win.spirit.deskPlugins.stackFrameChecks.open(container, ctx); },
    n: function (verb) { return ctx.asked.filter(function (a) { return a.verb === verb; }).length; },
    of: function (verb) { return ctx.asked.filter(function (a) { return a.verb === verb; }); } };
}
const ITEMS = {};
ITEMS[GOAL] = { id: GOAL, goal: '', title: 'Stacks', blocked: [GOAL + '.1', 'goal/G3.1'] };
ITEMS[GOAL + '.1'] = { id: GOAL + '.1', goal: GOAL, title: 'Nobody but <g> reaches b', status: 'open' };
ITEMS['goal/G3.1'] = { id: 'goal/G3.1', goal: 'goal/G3', title: 'elsewhere', status: 'open' };

test.startTest('stackFrameChecks.js: Desk\'s Stacks tab, the doors and their items');

(async function () {
  test.subHeading('it registers window.spirit.deskPlugins.stackFrameChecks');
  const w = world({ items: ITEMS, doors: [
    DOOR('d1'),
    DOOR('d2', { gate: 'spirit/run/c.js::h', endpoint: 'node:http', paths: ['/api/', '/x/'], suites: [], last: { running: true, startedAt: '2026-10-27T10:00:00.123Z' } }),
    DOOR('d3', { last: { ran: true, green: true, of: 4, endedAt: '2026-10-27T11:00:00.000Z' } }),
    DOOR('d4', { last: { ran: true, green: false, around: 2, of: 5, endedAt: '2026-10-27T12:00:00.000Z' } }),
    DOOR('d5', { last: { ran: false, stopped: true, endedAt: '2026-10-27T13:00:00.000Z' } }),
    DOOR('d6', { last: { ran: false, endedAt: '2026-10-27T14:00:00.000Z' } }),
    DOOR('d7', { gate: '<x>', last: { ran: false } }),
  ] });
  const P = w.win.spirit.deskPlugins && w.win.spirit.deskPlugins.stackFrameChecks;
  ok(!!P && typeof P.open === 'function', 'window.spirit.deskPlugins.stackFrameChecks.open is there', 'deskPlugins: ' + short(w.win.spirit.deskPlugins && Object.keys(w.win.spirit.deskPlugins)));
  if (!P) return;

  test.subHeading('open: the add form, the doors, its items, then its goal\'s chat');
  w.open(); await settle();
  const ids = w.container.querySelectorAll('[id]').map(function (n) { return n.id; });
  const order = ['sfc-form', 'sfc-note', 'sfc-door-text', 'sfc-doors', 'sfc-items', 'sfc-chat'].map(function (id) { return ids.indexOf(id); });
  ok(order.every(function (i, k) { return i !== -1 && (k === 0 || i > order[k - 1]); }) && ids[ids.length - 1] === 'sfc-chat', 'top to bottom: form, note, door search, doors, items, chat', short(ids));
  ok(w.ctx.chats.length === 1 && w.ctx.chats[0] === w.$('sfc-chat'), 'ctx.chat is handed #sfc-chat', 'chats: ' + w.ctx.chats.length);
  ok(w.F.calls.some(function (c) { return c[0] === 'html' && c[1] === 'sfc-'; }) && !!w.$('sfc-gate') && !!w.$('sfc-make') && w.$('sfc-make').textContent === 'Add the door',
    'the form is the shared door fields under sfc-, and Add the door', short(w.F.calls));
  ok(w.F.calls.some(function (c) { return c[0] === 'check' && c[1] === 'sfc-' && c[2] === 'sfc-make'; }), 'the fields are checked at open, against the button', short(w.F.calls));

  test.subHeading('its items: the goal\'s facts name them, each read by its id');
  ok(w.of('item.get')[0].args.id === GOAL && w.n('item.get') === 3, 'item.get of the goal, then of each item it names', short(w.of('item.get').map(function (a) { return a.args.id; })));
  const irows = w.$('sfc-items').querySelectorAll('tr');
  ok(irows.length === 1 && /Nobody but <g> reaches b \(plugin\/stackFrameChecks\.1\)open/.test(irows[0].textContent) && w.$('sfc-items').innerHTML.indexOf('&lt;g&gt;') !== -1,
    'only its goal\'s items, each its title (escaped), id and status', short(irows.map(function (r) { return r.textContent; })));
  const we = world({ items: {} });
  we.open(); await settle();
  ok(/No items yet\./.test(we.$('sfc-items').textContent),'a goal that cannot be read lists no items', we.$('sfc-items').textContent);
  const wn = world({ items: (function () { const s = {}; s[GOAL] = { id: GOAL, goal: '' }; return s; }()) });
  wn.open(); await settle();
  ok(/No items yet\./.test(wn.$('sfc-items').textContent) && /No doors yet\./.test(wn.$('sfc-doors').textContent), 'a goal with none says No items yet., and no doors No doors yet.',
    wn.$('sfc-items').textContent + ' / ' + wn.$('sfc-doors').textContent);

  test.subHeading('the doors: a bounded search, one row per door, its last verdict, and Open');
  ok(w.of('stackFrameChecks.doors.search').length === 1 && w.of('stackFrameChecks.doors.search')[0].args.text === '', 'stackFrameChecks.doors.search {text: \'\'} at open', short(w.of('stackFrameChecks.doors.search')));
  const drows = w.$('sfc-doors').querySelectorAll('tr');
  ok(drows.length === 7 && drows.every(function (r, i) { return r.getAttribute('data-door') === 'd' + (i + 1); }), 'a row per door, carrying data-door', 'rows: ' + drows.length);
  const cells = function (i) { return drows[i].querySelectorAll('td').map(function (c) { return c.textContent; }); };
  ok(JSON.stringify(cells(0).slice(0, 5)) === JSON.stringify(['spirit/run/a.js::g', 'spirit/run/b.js', 's.js', 'never run', GOAL + '.1']), 'gate, endpoint, suites, last verdict, item', short(cells(0)));
  ok(cells(1)[1] === 'node:http on /api/, /x/' && cells(1)[2] === 'no suites measured yet', 'paths are said with the endpoint; no suites says so', short(cells(1)));
  ok(cells(1)[3] === 'running since 2026-10-27 10:00:00Z', 'a run going on: running since <time>, the T a space, the milliseconds gone', cells(1)[3]);
  ok(cells(2)[3] === 'green: 4 call(s) through the gate, 2026-10-27 11:00:00Z', 'green: N call(s) through the gate, <time>', cells(2)[3]);
  ok(cells(3)[3] === 'red: 2 path(s) around the gate, of 5, 2026-10-27 12:00:00Z' && !!drows[3].querySelector('.job-start-error'), 'red: N path(s) around the gate, of M, <time>, as an error', cells(3)[3]);
  ok(cells(4)[3] === 'stopped 2026-10-27 13:00:00Z' && cells(5)[3] === 'no verdict, 2026-10-27 14:00:00Z' && cells(6)[3] === 'never run', 'stopped <time>; no verdict, <time>; never run',
    short([cells(4)[3], cells(5)[3], cells(6)[3]]));
  ok(cells(6)[0] === '<x>' && w.$('sfc-doors').innerHTML.indexOf('&lt;x&gt;') !== -1, 'a door\'s text is escaped', 'drew <x> as markup');
  ok(drows.every(function (r) { const b = r.querySelector('button'); return b && b.textContent === 'Open' && b.getAttribute('data-open') === r.getAttribute('data-door'); }), 'each row has one button, Open, carrying its door', 'an Open is missing');
  ok(!/More doors/.test(w.$('sfc-doors').textContent), 'no more flag, no more line', 'said more');
  w.ctx.more = true;
  w.$('sfc-door-text').value = 'spirit/run/c';
  fire(w.document, 'input', w.$('sfc-door-text')); await settle();
  ok(w.of('stackFrameChecks.doors.search').length === 2 && w.of('stackFrameChecks.doors.search')[1].args.text === 'spirit/run/c' && w.$('sfc-doors').querySelectorAll('tr').length === 1,
    'typing in the search asks again with the text, and draws what it answers', short(w.of('stackFrameChecks.doors.search').map(function (a) { return a.args; })));
  ok(/More doors than one answer holds: search to find the others\./.test(w.$('sfc-doors').textContent), 'the more flag says there are others', w.$('sfc-doors').textContent);
  w.ctx.more = false;
  w.$('sfc-door-text').value = 'nothing like it';
  fire(w.document, 'input', w.$('sfc-door-text')); await settle();
  ok(/No door matches\./.test(w.$('sfc-doors').textContent), 'a search with text that finds none says No door matches.', w.$('sfc-doors').textContent);
  w.$('sfc-door-text').value = '';
  fire(w.document, 'input', w.$('sfc-door-text')); await settle();

  test.subHeading('Open: the shell\'s door dialog; the doors and items read again when it closes');
  const s0 = w.n('stackFrameChecks.doors.search'); const g0 = w.n('item.get');
  w.document.click(w.$('sfc-doors').querySelector('[data-open="d3"]')); await settle();
  ok(w.ctx.dialogs.length === 1 && w.ctx.dialogs[0].app === 'shell/stackFrameCheckDetail' && w.ctx.dialogs[0].params.id === 'd3', 'Open calls shell/stackFrameCheckDetail {id}', short(w.ctx.dialogs));
  ok(w.n('stackFrameChecks.doors.search') > s0 && w.n('item.get') > g0, 'closed, the doors and the items are read again', 'searches ' + s0 + '->' + w.n('stackFrameChecks.doors.search') + ', gets ' + g0 + '->' + w.n('item.get'));
  const wd = world({ items: ITEMS, doors: [DOOR('d1')], noDialog: true });
  wd.open(); await settle();
  wd.document.click(wd.$('sfc-doors').querySelector('[data-open="d1"]')); await settle();
  ok(wd.$('sfc-note').textContent === 'This Desk page hands its plugins no dialog to open door d1 in.', 'no dialog in the ctx: it says so', wd.$('sfc-note').textContent);

  test.subHeading('Add the door: refused on the page what the server would refuse');
  const typeDoor = function (wx, d) { ['gate', 'endpoint', 'paths', 'suites'].forEach(function (f) { wx.$('sfc-' + f).value = d[f] || ''; }); };
  typeDoor(w, { gate: 'spirit/run/a.js::g' });
  w.document.click(w.$('sfc-make')); await settle();
  ok(w.$('sfc-note').textContent === 'Not sent: a gate and an endpoint are both needed.' && w.n('stackFrameChecks.make') === 0, 'no endpoint: Not sent, a gate and an endpoint are both needed', w.$('sfc-note').textContent);
  typeDoor(w, { gate: 'g', endpoint: 'e' }); w.F.wrong = { endpoint: 'an endpoint is wrong here' };
  w.document.click(w.$('sfc-make')); await settle();
  ok(w.$('sfc-note').textContent === 'Not sent: an endpoint is wrong here' && w.n('stackFrameChecks.make') === 0, 'a field the door fields call wrong: Not sent: <why>', w.$('sfc-note').textContent);
  w.F.wrong = {};
  const c0 = w.F.calls.length;
  fire(w.document, 'input', w.$('sfc-gate'));
  ok(w.F.calls.slice(c0).some(function (c) { return c[0] === 'check' && c[2] === 'sfc-make'; }), 'typing in a door field checks the fields', short(w.F.calls.slice(c0)));

  test.subHeading('Add the door: make, then each path and each suite, one write each');
  typeDoor(w, { gate: 'spirit/run/a.js::g', endpoint: 'node:http', paths: '/a/, /b/', suites: 'x.js' });
  w.document.click(w.$('sfc-make')); await settle();
  const writes = w.ctx.asked.filter(function (a) { return /^stackFrameChecks\.(make|paths\.add|suites\.add)$/.test(a.verb); });
  ok(writes.length === 4 && writes[0].verb === 'stackFrameChecks.make' && JSON.stringify(writes[0].args) === JSON.stringify({ gate: 'spirit/run/a.js::g', endpoint: 'node:http' }),
    'stackFrameChecks.make {gate, endpoint} first', short(writes.map(function (a) { return [a.verb, a.args]; })));
  ok(writes.slice(1).map(function (a) { return a.verb + ' ' + a.args.id + ' ' + a.args.path; }).join(' | ') === 'stackFrameChecks.paths.add door-7 /a/ | stackFrameChecks.paths.add door-7 /b/ | stackFrameChecks.suites.add door-7 x.js',
    'then paths.add and suites.add on the door made, each its own write, in order', short(writes.slice(1).map(function (a) { return [a.verb, a.args]; })));
  ok(w.$('sfc-note').textContent === 'Made plugin/stackFrameChecks.7: nobody but spirit/run/a.js::g reaches node:http. The door is in the list.', 'it says Made <item>: nobody but <gate> reaches <endpoint>',
    w.$('sfc-note').textContent);
  ok(w.F.calls.some(function (c) { return c[0] === 'fill' && c[1] === 'sfc-' && c[2] === null; }) && w.$('sfc-gate').value === '', 'the form is emptied (fill with no door) and checked', short(w.F.calls.slice(-3)));
  typeDoor(w, { gate: 'g', endpoint: 'e' });
  w.document.click(w.$('sfc-make')); await settle();
  ok(/The door is in the list, with no suites yet\.$/.test(w.$('sfc-note').textContent), 'a door made with no suites says so', w.$('sfc-note').textContent);
  w.ctx.refuseMake = 'that door is there';
  typeDoor(w, { gate: 'g', endpoint: 'e' });
  w.document.click(w.$('sfc-make')); await settle();
  ok(w.$('sfc-note').textContent === 'Not made: that door is there' && w.$('sfc-gate').value === 'g', 'refused: Not made: <why>, the form kept', w.$('sfc-note').textContent);

  test.subHeading('its own stream: subscribed once; a door change reads the doors, a row of its goal both');
  ok(w.ctx.streams.length === 1, 'open subscribes once', 'streams: ' + w.ctx.streams.length);
  w.open(); await settle();
  ok(w.ctx.streams.length === 1, 'a second open does not subscribe again', 'streams: ' + w.ctx.streams.length);
  const hear = w.ctx.streams[0];
  let s = w.n('stackFrameChecks.doors.search'); let g = w.n('item.get');
  hear({ plugin: 'stackFrameChecks', data: { what: 'door', id: 'd1' } }); await settle();
  ok(w.n('stackFrameChecks.doors.search') === s + 1 && w.n('item.get') === g, 'the plugin\'s own publish reads the doors again, not the items', 'searches +' + (w.n('stackFrameChecks.doors.search') - s) + ', gets +' + (w.n('item.get') - g));
  s = w.n('stackFrameChecks.doors.search'); g = w.n('item.get');
  hear({ item: JSON.stringify({ id: GOAL + '.3', goal: GOAL }) }); await settle();
  ok(w.n('stackFrameChecks.doors.search') === s + 1 && w.n('item.get') > g, 'an item of its goal reads the items and the doors again', 'searches +' + (w.n('stackFrameChecks.doors.search') - s) + ', gets +' + (w.n('item.get') - g));
  s = w.n('stackFrameChecks.doors.search'); g = w.n('item.get');
  hear({ item: { id: 'goal/G3.1', goal: 'goal/G3' } }); hear({ table: 'chat', id: GOAL }); hear(null); hear({ item: '{broken' }); await settle();
  ok(w.n('stackFrameChecks.doors.search') === s && w.n('item.get') === g, 'another goal\'s row, a side row, a non-object, broken JSON: nothing read', 'read again');

  test.subHeading('without the door fields on the page, it loads them through spirit.require and draws the form when they come (goal/G41.11)');
  const wl = world({ items: ITEMS, noFields: true });
  wl.open(); await settle();
  const scripts = wl.document.body.children.filter(function (c) { return c.tagName === 'SCRIPT'; });
  const asked = wl.win.required.filter(function (r) { return r.path === 'shell/shared/js/deskDoorFields.js'; });
  ok(/Loading the door's fields\./.test(wl.$('sfc-form').textContent) && asked.length === 1 && scripts.length === 0,
    'it says it is loading them, asks spirit.require for shell/shared/js/deskDoorFields.js, and puts no script tag on the page', 'required ' + short(wl.win.required.map(function (x) { return x.path; })) + ', scripts ' + scripts.length);
  wl.document.click(wl.$('sfc-form')); fire(wl.document, 'input', wl.$('sfc-form')); await settle();
  ok(wl.n('stackFrameChecks.make') === 0, 'before they load, nothing can be made, harmlessly', 'made');
  wl.win.spirit.elements.deskDoorFields = wl.F;
  if (asked[0]) asked[0].resolve({}); await settle();
  ok(!!wl.$('sfc-gate') && !!wl.$('sfc-make') && wl.F.calls.some(function (c) { return c[0] === 'check' && c[2] === 'sfc-make'; }), 'once loaded, the form is drawn and checked', short(wl.F.calls));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
