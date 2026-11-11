'use strict';

// spirit/run/spirit/element/search/bundle/test/rowElement.js
// The tests of spirit/element/search/bundle/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. What it
// requires is put there then: the shared row element real. The field input real and the arming button and branch editor
// as recording stand-ins are offered too, though since goal/G41.26 and G41.32 it asks for none of them. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const JS = path.join(RUN, 'spirit', 'element');
const FILE = path.join(JS, 'search', 'bundle', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, className: '', innerHTML: '', value: '', attrs: {},
    appendChild: function (c) { n.kids.push(c); return c; },
    setAttribute: function (k, v) { n.attrs[k] = String(v); }, getAttribute: function (k) { return k in n.attrs ? n.attrs[k] : null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
    heard: heard,
    querySelector: function (sel) {
      const all = []; (function walk(x) { x.kids.forEach(function (k) { all.push(k); walk(k); }); }(n));
      const m = /^\[data-action="([^"]+)"\]$/.exec(sel);
      if (m) return all.filter(function (k) { return k.attrs['data-action'] === m[1]; })[0] || null;
      if (sel === 'input') return all.filter(function (k) { return k.tag === 'input'; })[0] || null;
      return null;
    },
  };
  return n;
}
// A cell as the list hands one to mount: its html set by the paint, its controls made from it as a page parses it.
function cell() {
  const c = node('td');
  let html = '';
  Object.defineProperty(c, 'innerHTML', { get: function () { return html; }, set: function (v) {
    html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(html);
    if (b) { const k = node('button'); k.attrs['data-action'] = b[1]; k.textContent = b[2]; c.kids.push(k); }
  } });
  return c;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
// An element that counts on what it did not load throws inside a promise: the reporter fails the test it ran in.
let asked, required, armed, opened, managers, DATA, V, E, A, el, cells, ed, hosts;
let answer = function () { return Promise.resolve({ id: 7 }); };
const NO_E = 'the row never ran: the world failed';
const NO_A = 'no auth data on the page: the auth family\'s cache manager never put it there';
const NO_ROW = 'no row element registered';
const NO_ED = 'no row was mounted';
const hasA = function () { return !!(A && A.bundles && typeof A.bundles.row === 'function'); };
const hasRow = function () { return hasA() && !!(E.search && E.search.bundle && E.search.bundle.rowElement && typeof E.search.bundle.rowElement.create === 'function'); };
const cellsOf = function (r) { const out = {}; (r.cells() || []).forEach(function (c) { out[c.name] = c.html; }); return out; };
// What the cell shows as text: its markup, and the text of what it holds that is no input.
const labelText = function () { return String(hosts.label.innerHTML || '') + hosts.label.kids.filter(function (k) { return !/input|textarea/i.test(k.tag || ''); }).map(function (k) { return String(k.textContent || ''); }).join(''); };

test.run('the world: the row runs on a bare window, the page\'s data set and the auth family\'s data real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/bundle/rowElement.js is not there';
  asked = [];
  required = [];
  armed = [];
  opened = [];
  const auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  const load = function (p) { vm.runInThisContext(fs.readFileSync(path.join(RUN, p), 'utf8'), { filename: p }); };
  const STANDS = {
    'spirit/element/rowElement.js': function () { load('spirit/element/rowElement.js'); },
    'spirit/element/fieldInput.js': function () { load('spirit/element/fieldInput.js'); },
    'spirit/element/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    'spirit/element/search/bundle/detailElement.js': function (E) { (E.search = E.search || {}).bundle = Object.assign((E.search || {}).bundle || {}, {}); E.search.bundle.detailElement = { open: function (o) { opened.push(o); return {}; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    fieldRules: require(path.join(RUN, 'spirit', 'fieldRules.js')), ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  global.spirit = global.window.spirit;
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  // The page's one data set (spirit/data.js), which spirit.js brings with the client: the stream's rows land there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set; the
  // bundles are the auth family's (goal/G41.28).
  managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  // The direct writes below are the auth family's own view of the home node, as its manager files them.
  V = DATA.viewAt(null, 'auth');
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  A = ((global.window.spirit.data || {}).auth || {}).data;
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
// goal/G41.26: the label is shown only, so no field input is used, and none is asked of it.
test.run('it requires the shared row element through spirit.require, and no arming button: Delete is the branchEditor\'s (goal/G41.32)', 0.2, function () {
  if (!required) return NO_E;
  return required.indexOf('spirit/element/rowElement.js') !== -1 && required.indexOf('spirit/element/armingButton.js') === -1 ? true : 'required: ' + short(required);
}, test.limit.quick);
test.run('it loads the auth family\'s cache manager, which puts ((spirit.data || {}).auth || {}).data on the page', 0.2, function () {
  if (!managers) return NO_E;
  return managers.indexOf('auth') !== -1 && hasA() ? true : 'managers: ' + short(managers);
}, test.limit.quick);
test.run('it registers spirit.element.spirit.element.search.bundle.rowElement.create', 0.2, function () {
  if (!hasA()) return NO_A;
  return hasRow() ? true : 'elements: ' + short(Object.keys(E));
}, test.limit.quick);

// a bundle row: its label and owner
test.run('it is a row element of kind bundle, keyed by the bundle\'s id', 0.2, function () {
  if (!hasRow()) return NO_ROW;
  el = E.search.bundle.rowElement.create({ id: 7, label: 'Read <files>' });
  return el.kind === 'bundle' && el.key === '7' && el.row.label === 'Read <files>' ? true : 'el: ' + short({ kind: el.kind, key: el.key, row: el.row });
}, test.limit.quick);
// goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
// goal/G41.32: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete' Button."
test.run('its fields are label and owner, in that order', 0.2, function () {
  if (!el) return NO_ROW;
  cells = cellsOf(el);
  return JSON.stringify(Object.keys(cells)) === '["label","owner"]' ? true : 'fields: ' + short(Object.keys(cells));
}, test.limit.quick);
test.run('the owner is shown as the bundle names it, never an input: it never changes after the add', 0.2, function () {
  if (!hasRow()) return NO_ROW;
  const owCells = cellsOf(E.search.bundle.rowElement.create({ id: 9, label: 'Agent tools', owner: 'agent' }));
  return /\bagent\b/.test(owCells.owner || '') && !/<input/.test(owCells.owner || '') ? true : 'owner: ' + short(owCells.owner);
}, test.limit.quick);
test.run('and drawn escaped', 0.2, function () {
  if (!hasRow()) return NO_ROW;
  const oddCells = cellsOf(E.search.bundle.rowElement.create({ id: 10, label: 'x', owner: 'a<b' }));
  return /a&lt;b/.test(oddCells.owner || '') && !/a<b/.test(oddCells.owner || '') ? true : 'owner: ' + short(oddCells.owner);
}, test.limit.quick);
test.run('the label is drawn escaped', 0.2, function () {
  if (!cells) return NO_ROW;
  return (/Read &lt;files>/).test(cells.label || '') && !/<files>/.test(cells.label || '') ? true : 'label: ' + short(cells.label);
}, test.limit.quick);

// the label is shown only (goal/G41.26)
// Andy, box: "bundleSelector:pane mode the Label should now just be an output, field: A bundles label is determined
// when it's added, and cannot be modified. This will protect family owned bundles from having their label mutilated."
// Mounted, with the old editable option or without it, the label cell shows the label and holds no input.
test.run('mounted, its label cell holds no input, editable or not', 0.2, async function () {
  if (!hasRow()) return NO_ROW;
  ed = E.search.bundle.rowElement.create({ id: 7, label: 'Read <files>' }, { editable: true });
  hosts = { label: cell(), owner: cell() };
  ed.mount(hosts);
  await settle();
  return !hosts.label.querySelector('input') && !hosts.label.kids.some(function (k) { return /input|textarea/i.test(k.tag || ''); }) ? true : 'label cell: ' + short(hosts.label.kids.map(function (k) { return k.tag; }));
}, test.limit.quick);
test.run('it shows the label, escaped', 0.2, function () {
  if (!ed) return NO_ED;
  return (/Read &lt;files>|Read <files>/).test(labelText()) && !/<files>/.test(String(hosts.label.innerHTML || '')) ? true : 'label cell: ' + short(labelText());
}, test.limit.quick);
test.run('and asks the node no set, ever', 0.2, function () {
  if (!ed) return NO_ED;
  return asked.every(function (a) { return a.op !== 'set'; }) ? true : 'asked: ' + short(asked);
}, test.limit.quick);
// rule/19: a ui only draws what the server's stream says; goal/G41.14, Andy: "EVERY FUCKING element MUST FUCKING
// LISTING to anything that changes their data set". The row repaints from the auth family's bundles.
test.run('the bundle\'s row in the bundles changed, the row repaints its label', 0.2, async function () {
  if (!ed) return NO_ED;
  V.set('bundles/7', { id: 7, label: 'Mover' });
  await settle();
  return ed.row.label === 'Mover' && /Mover/.test(labelText()) ? true : 'row: ' + short(ed.row) + ', label cell ' + short(labelText());
}, test.limit.quick);
test.run('another bundle\'s row changes nothing here', 0.2, async function () {
  if (!ed) return NO_ED;
  V.set('bundles/8', { id: 8, label: 'Someone else' });
  await settle();
  return ed.row.label === 'Mover' ? true : 'row: ' + short(ed.row);
}, test.limit.quick);

// the type's own element takes the node's bundle rows from the stream (goal/G41.14)
// The row element is the data type's code (G30.18: "rowElements carry the listeners and painters a subject needs
// for real-time updates"); it is loaded with every list of its kind, and since goal/G41.28 the rows are taken by the
// auth family's cache manager it loads. Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
// carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
// of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
test.run('a bundle row published lands in the auth family\'s bundles by its id, through the family\'s cache manager the row element loads (goal/G41.28)', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'bundle', row: { id: 7, label: 'Reader' } } });
  return JSON.stringify(A.bundles.row({ id: 7, label: 'Reader' }.id)) === JSON.stringify({ id: 7, label: 'Reader' }) ? true : 'data: ' + short(A.bundles.rows());
}, test.limit.quick);
test.run('a row published again replaces the one kept', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'bundle', row: { id: 7, label: 'Lister' } } });
  const again = A.bundles.row({ id: 7, label: 'Reader' }.id);
  return again && again.label === 'Lister' ? true : 'data: ' + short(again);
}, test.limit.quick);
test.run('a row published gone is taken out', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'bundle', row: { id: { id: 7, label: 'Reader' }.id }, gone: true } });
  return A.bundles.row({ id: 7, label: 'Reader' }.id) === null ? true : 'data: ' + short(A.bundles.rows());
}, test.limit.quick);
test.run('the other table\'s rows, another job\'s, and a row with no id write nothing in the bundles', 0.2, function () {
  if (!hasA()) return NO_A;
  const before = JSON.stringify(A.bundles.rows());
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'branch', row: { id: 99, label: 'x', bundle: 1, family: 'f', verb: '' } } });
  DATA.takeJob({ id: 'spirit.contact', data: { row: { id: 98 } } });
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'bundle', row: { label: 'no id' } } });
  return JSON.stringify(A.bundles.rows()) === before ? true : 'data: ' + short(A.bundles.rows());
}, test.limit.quick);
