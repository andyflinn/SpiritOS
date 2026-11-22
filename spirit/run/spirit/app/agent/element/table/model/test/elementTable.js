'use strict';

// spirit/run/spirit/app/agent/element/table/model/test/elementTable.js
// The tests of spirit/app/agent/element/table/model/elementTable.js, and of no other module (spec: ./elementTable.md). Its
// own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
// The model table in the page (goal/G41.4): its rows in the tables' shared element (../tableElement.js, tested in its own
// folder), a row picked opening in its editor (./elementRow.js), and the Ask form at the top (goal/G41.26, goal/G41.27):
// ❓ [providerSelector:dropdown] [Ask], which updates the model table. The browser file runs in node on a window of its
// own, its container a small tree of nodes (it moves its form in under the shared table's title row); the shared element,
// the row editor, the rowForm, the busyButton and the agent family are stand-ins that keep what they were handed, placed
// as their own files place them. The same world as the other tables' elementTable tests, with the Ask form's parts.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const branchPath = require(path.join(RUN, 'spirit', 'spirit.js')).branchPath;
const FILE = path.join(__dirname, '..', 'elementTable.js');
const SHARED = 'spirit/app/agent/element/table/tableElement.js';
const ROW = 'spirit/app/agent/element/table/model/elementRow.js';
const AGENT = branchPath('agent');
const PARTS = ['spirit/element/search.js', 'spirit/element/rowForm.js'];

function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.required); };

// ── a small tree of nodes: markup, ids and classes, children in order, insertBefore, querySelector('#id' or '#id .class') ──
function node(tag, attrs) {
  const n = { tagName: tag, id: (attrs && attrs.id) || '', className: (attrs && attrs.className) || '', children: [], parentNode: null, textContent: '',
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = n; n.children.push(c); return c; },
    removeChild: function (c) { const i = n.children.indexOf(c); if (i !== -1) n.children.splice(i, 1); c.parentNode = null; return c; },
    insertBefore: function (c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c);
      const i = ref ? n.children.indexOf(ref) : -1;
      c.parentNode = n;
      if (i === -1) n.children.push(c); else n.children.splice(i, 0, c);
      return c;
    },
    get nextSibling() { if (!n.parentNode) return null; const s = n.parentNode.children; return s[s.indexOf(n) + 1] || null; },
    set innerHTML(v) {
      n.children.forEach(function (c) { c.parentNode = null; }); n.children = [];
      const stack = [n]; const re = /<(\/?)([a-z]+)([^>]*)>/gi; let m;
      while ((m = re.exec(String(v)))) {
        if (m[1]) { stack.pop(); continue; }
        const id = /\bid="([^"]*)"/.exec(m[3]); const cls = /\bclass="([^"]*)"/.exec(m[3]);
        const c = node(m[2].toLowerCase(), { id: id ? id[1] : '', className: cls ? cls[1] : '' });
        stack[stack.length - 1].appendChild(c); stack.push(c);
      }
    },
    querySelector: function (sel) {
      const steps = String(sel).trim().split(/\s+/);
      let here = [n];
      steps.forEach(function (s) {
        const found = [];
        here.forEach(function (h) { walk(h, function (d) { if (d !== h && matches(d, s) && found.indexOf(d) === -1) found.push(d); }); });
        here = found;
      });
      return here[0] || null;
    } };
  return n;
}
function walk(n, fn) { fn(n); n.children.forEach(function (c) { walk(c, fn); }); }
function matches(n, s) { return s.charAt(0) === '#' ? n.id === s.slice(1) : s.charAt(0) === '.' ? n.className.split(/\s+/).indexOf(s.slice(1)) !== -1 : n.tagName === s; }

// ── the world ──
// W.tables: each shared table made { container, o, refreshed, destroyed }; W.rows: each row editor made; W.forms: each
// rowForm { container, o, span, button }; W.busy: each busyButton { button, o }; W.drops: each provider dropdown
// { host, o, face, value, destroyed }; W.asks: each ask of the agent family; W.answer: what it answers.
const W = { required: [], tables: [], rows: [], forms: [], busy: [], drops: [], asks: [], answer: null, held: null };
function world() {
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, branchPath: branchPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  const helper = require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'));
  // As their own files place themselves: by the one helper, at spirit.required.<their path>.
  helper(global.window.spirit, SHARED, {
    // The shared table draws its title row first in its container (../tableElement.js), then its list.
    create: function (container, o) {
      container.innerHTML = '<div class="agent-title"></div><div class="agent-list"></div>';
      const t = { container: container, o: o, refreshed: 0, destroyed: false, refresh: function () { t.refreshed += 1; }, destroy: function () { t.destroyed = true; } };
      W.tables.push(t); return t;
    },
    search: function (host, o, face) { const d = { host: host, o: o, face: face, value: '', destroyed: false, destroy: function () { d.destroyed = true; } }; W.drops.push(d); return d; },
    whyOf: function (e) { return 'the reason: ' + String(e && e.message); },
  });
  helper(global.window.spirit, ROW, { create: function (box, id, added, detail) { const r = { box: box, id: id, added: added, detail: detail }; W.rows.push(r); return r; } });
  helper(global.window.spirit, 'spirit/element/rowForm.js', { create: function (container, o) {
    const f = { container: container, o: o, span: node('span'), button: node('button') };
    W.forms.push(f); return f;
  } });
  helper(global.window.spirit, 'spirit/element/busyButton.js', { attach: function (button, o) { W.busy.push({ button: button, o: o }); return button; } });
  // The agent server's family: provider(args), each ask kept, answering W.answer.
  W.family = { provider: function (a) { W.asks.push(a); const r = W.answer; return r instanceof Error ? Promise.reject(r) : Promise.resolve(r || {}); } };
  global.window.spirit.require = function (p) {
    W.required.push(String(p));
    if (W.held) return W.held.promise;
    return Promise.resolve(p === AGENT ? W.family : true);
  };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
}
const detail = { look: function (t) { return { icon: '🧠', name: t }; } };
const E = {};
// Ask pressed as the real rowForm presses it: its press, called on a click (spirit/element/rowForm.js).
const ask = function () { const f = W.forms[W.forms.length - 1]; return f && f.o && typeof f.o.press === 'function' ? f.o.press() : false; };

test.run('the file runs on a window of its own, with stand-ins for its parts placed as the page places them', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  world();
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before it runs, the page has no model table element', 0.2, function () {
  if (!W.up) return false;
  return at('spirit.app.agent.element.table.model.elementTable') === undefined || false;
}, test.limit.quick);
test.run('it places spirit.required.spirit.app.agent.element.table.model.elementTable, with create', 0.2, async function () {
  if (!W.up) return false;
  load(FILE);
  await settle();
  E.table = at('spirit.app.agent.element.table.model.elementTable');
  return (!!E.table && typeof E.table.create === 'function') || false;
}, test.limit.quick);

// ── create(container, detail) ──
test.run('create, handed a container and the detail pane, makes the tables\' shared element in its list', 0.2, async function () {
  if (!E.table) return false;
  E.box = node('div', { id: 'box' });
  E.made = E.table.create(E.box, detail);
  await settle();
  E.t = W.tables[W.tables.length - 1];
  return (!!E.t && E.t.container !== E.box && !!E.box.querySelector('#' + E.t.container.id) && /list$/.test(E.t.container.id)) || false;
}, test.limit.quick);
// "WHAT IT USES, IT LOADS ITSELF (rule/26): the shared element, its row, the search and the rowForm."
test.run('it loads what it uses itself: the shared element, its row editor, the search and the rowForm', 0.2, function () {
  if (!W.up) return false;
  const missing = [SHARED, ROW].concat(PARTS).filter(function (p) { return W.required.indexOf(p) === -1; });
  return missing.length === 0 || false;
}, test.limit.quick);
test.run('the shared element is told its table, model, and the page\'s detail pane', 0.2, function () {
  if (!E.t) return false;
  return (E.t.o.table === 'model' && E.t.o.detail === detail) || false;
}, test.limit.quick);
// Andy, on G41.18: "get RID of [Add a Model] button in the left panes model mode. NOT required."
test.run('it has no Add, since a model comes from its provider\'s list', 0.2, function () {
  if (!E.t) return false;
  return E.t.o.add === false || false;
}, test.limit.quick);
// goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon the server sends with the row.
test.run('its list shows the provider\'s icon the server sends with the row, then the model\'s name, sorted as text', 0.2, function () {
  if (!E.t) return false;
  const c = E.t.o.columns || [];
  return (c.length === 2 && c[0].field === 'icon' && c[0].from === 'providerIcon' && c[1].field === 'label' && c[1].label === 'Model' && c[1].sort === 'text') || false;
}, test.limit.quick);
test.run('picking a row opens the model row editor in the detail pane, made for that row\'s box, id and added flag', 0.2, function () {
  if (!E.t) return false;
  if (typeof E.t.o.row !== 'function') return false;
  const b = { id: 'detail-box' };
  const got = E.t.o.row(b, 'M7', false);
  const r = W.rows[W.rows.length - 1];
  return (!!r && got === r && r.box === b && r.id === 'M7' && r.added === false && r.detail === detail) || false;
}, test.limit.quick);

// ── the Ask form (goal/G41.26, goal/G41.27; Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]") ──
test.run('the Ask form is a rowForm with the icon ❓ and the button Ask', 0.2, function () {
  if (!E.t) return false;
  const f = W.forms[W.forms.length - 1];
  E.f = f;
  return (!!f && f.o.icon === '❓' && f.o.button === 'Ask' && /form$/.test(f.container.id)) || false;
}, test.limit.quick);
test.run('its span holds the providerSelector in dropdown mode, the provider table\'s search, saying "Pick a provider"', 0.2, function () {
  if (!E.f) return false;
  const d = W.drops[W.drops.length - 1];
  E.d = d;
  return (!!d && d.host === E.f.span && d.o.table === 'provider' && d.face.face === 'dropdown' && d.face.placeholder === 'Pick a provider') || false;
}, test.limit.quick);
// Andy, on G41.26: "the title row \"🧠Models\" must come before the \"from [🛖 Unsloth Studio ▾] [Ask] row."
test.run('the title row comes first, then the form and its note, moved in under the shared table\'s title', 0.2, function () {
  if (!E.f) return false;
  const kids = E.t.container.children.map(function (c) { return c.id ? c.id.replace(/^mt\d+-/, '') : c.className; });
  return JSON.stringify(kids) === JSON.stringify(['agent-title', 'form', 'said', 'agent-list']) || false;
}, test.limit.quick);
// ASK WAITS BUSY (goal/G41.23; goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes"):
// Ask is the rowForm's press, whose button is a busy button already; a second busy button on it would fight the first.
test.run('Ask is the rowForm\'s press, and no busy button of its own is attached', 0.2, function () {
  if (!E.f) return false;
  return (typeof E.f.o.press === 'function' && W.busy.length === 0) || false;
}, test.limit.quick);
test.run('with no provider picked, Ask asks nothing', 0.2, function () {
  if (!E.d) return false;
  E.d.value = '';
  const r = ask();
  return (r === null && W.asks.length === 0) || false;
}, test.limit.quick);
// Andy, box: "the [Ask] button will no longer spit out a list, and simply update the agent.model table".
test.run('with one picked, Ask asks the provider table for an ask of that provider, which updates the model table', 0.2, async function () {
  if (!E.d) return false;
  E.d.value = 'P1';
  W.answer = { items: [{ id: 'x' }] };
  await ask();
  await settle();
  const note = E.box.querySelector('#' + E.t.container.id.replace(/list$/, 'said'));
  return (W.asks.length === 1 && JSON.stringify(W.asks[0]) === JSON.stringify({ op: 'ask', id: 'P1' }) && !!note && note.textContent === '') || false;
}, test.limit.quick);
// "A refusal is said on one line, the provider's reason."
test.run('a refusal is said on one line, the provider\'s reason, as the shared element words it', 0.2, async function () {
  if (!E.d) return false;
  W.answer = new Error('the provider is down');
  await ask();
  await settle();
  const note = E.box.querySelector('#' + E.t.container.id.replace(/list$/, 'said'));
  return (!!note && note.textContent === 'the reason: the provider is down') || false;
}, test.limit.quick);
test.run('the next Ask clears the refusal', 0.2, async function () {
  const note = E.t && E.box.querySelector('#' + E.t.container.id.replace(/list$/, 'said'));
  if (!note) return false;
  W.answer = {};
  const p = ask();
  const cleared = note.textContent === '';
  await p; await settle();
  return cleared || false;
}, test.limit.quick);

// ── refresh and destroy ──
test.run('its refresh refreshes the shared table', 0.2, function () {
  if (!E.made || !E.t) return false;
  E.made.refresh();
  return E.t.refreshed === 1 || false;
}, test.limit.quick);
test.run('its destroy destroys the provider dropdown and the shared table', 0.2, function () {
  if (!E.made || !E.t || !E.d) return false;
  // Its note found before: since -browser's rule a destroy empties the box (cw), so after it the note is no longer in it.
  E.note = E.box.querySelector('#' + E.t.container.id.replace(/list$/, 'said'));
  E.made.destroy();
  return (E.t.destroyed === true && E.d.destroyed === true) || false;
}, test.limit.quick);
test.run('a refusal after its destroy says nothing', 0.2, async function () {
  const note = E.note;
  if (!note) return false;
  note.textContent = '';
  W.answer = new Error('late');
  await ask(); await settle();
  return note.textContent === '' || false;
}, test.limit.quick);
test.run('each table it makes has ids of its own, so a second one names no part the first does', 0.2, async function () {
  if (!E.table || !E.t) return false;
  const b2 = node('div', { id: 'box2' });
  E.table.create(b2, detail);
  await settle();
  const t2 = W.tables[W.tables.length - 1];
  return (t2 !== E.t && !!t2.container.id && t2.container.id !== E.t.container.id) || false;
}, test.limit.quick);
test.run('before its parts have loaded, refresh throws nothing; destroyed then, it makes no table', 0.2, async function () {
  if (!E.table) return false;
  let open = null;
  W.held = { promise: new Promise(function (r) { open = r; }) };
  const n = W.tables.length;
  const early = E.table.create(node('div', { id: 'box3' }), detail);
  try { early.refresh(); } catch (e) { W.held = null; return false; }
  early.destroy();
  open(true); W.held = null;
  await settle();
  return W.tables.length === n || false;
}, test.limit.quick);
