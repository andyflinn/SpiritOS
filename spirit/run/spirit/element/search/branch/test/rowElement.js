'use strict';

// spirit/run/spirit/element/search/branch/test/rowElement.js
// The tests of spirit/element/search/branch/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element is put there real; the arming button is a stand-in that records what it was handed. The node's auth
// family is the spirit object's, each call recorded. The page's data set is real, and so is the auth family's
// data.js (goal/G41.28), loaded as a page's spirit.cacheManager('auth') loads it, the page's node known as
// spirit.start makes it known (spirit.node.key, then data.homeNode).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'branch', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A cell as the list hands one to mount: its html set by the paint, a button in it found as a page would find it.
function cell() {
  const c = { kids: [], html: '' };
  Object.defineProperty(c, 'innerHTML', { get: function () { return c.html; }, set: function (v) {
    c.html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(c.html);
    if (b) c.kids.push({ tag: 'button', action: b[1], textContent: b[2], getAttribute: function (k) { return k === 'data-action' ? b[1] : null; } });
  } });
  c.querySelector = function (sel) { const m = /^\[data-action="([^"]+)"\]$/.exec(sel); return m ? c.kids.filter(function (k) { return k.action === m[1]; })[0] || null : null; };
  return c;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let asked, required, armed, managers, DATA, V, E, A, el, cells, allCells, del, live, lh;
const NO_E = 'the row never ran: the world failed';
const NO_A = 'no auth data on the page: the auth family\'s cache manager never put it there';
const NO_ROW = 'no row element registered';
const hasA = function () { return !!(A && A.branches && typeof A.branches.row === 'function'); };
const hasRow = function () { return hasA() && !!(E.search && E.search.branch && E.search.branch.rowElement && typeof E.search.branch.rowElement.create === 'function'); };

test.run('the world: the row runs on a bare window, the page\'s data set and the auth family\'s data real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/branch/rowElement.js is not there';
  asked = [];
  required = [];
  armed = [];
  const auth = { branch: function (a) { asked.push(a); return Promise.resolve({ id: a.id }); } };
  const STANDS = {
    'spirit/element/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'spirit/element/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // The page's one data set (spirit/data.js): the stream's branch rows land there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
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
}, 1000);

// it loads what it uses itself (rule/26)
test.run('it requires the shared row element and the arming button through spirit.require', 0.2, function () {
  if (!required) return NO_E;
  return ['spirit/element/rowElement.js', 'spirit/element/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : 'required: ' + short(required);
}, 1000);
test.run('it loads the auth family\'s cache manager, which puts ((spirit.data || {}).auth || {}).data on the page', 0.2, function () {
  if (!managers) return NO_E;
  return managers.indexOf('auth') !== -1 && hasA() ? true : 'managers: ' + short(managers);
}, 1000);
test.run('it registers spirit.element.spirit.element.search.branch.rowElement.create', 0.2, function () {
  if (!hasA()) return NO_A;
  return hasRow() ? true : 'elements: ' + short(Object.keys(E));
}, 1000);

// a branch row: Family, Verb, Delete
// Andy, box: "branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'".
test.run('it is a row element of kind branch, keyed by the branch\'s id, its bundle with it', 0.2, function () {
  if (!hasRow()) return NO_ROW;
  el = E.search.branch.rowElement.create({ id: 3, bundle: 7, family: 'de<sk>', verb: 'chat<add>' });
  return el.kind === 'branch' && el.key === '3' && el.row.bundle === 7 && el.row.family === 'de<sk>' ? true : 'el: ' + short({ kind: el.kind, key: el.key, row: el.row });
}, 1000);
test.run('its fields are family, verb and delete, in that order', 0.2, function () {
  if (!el) return NO_ROW;
  cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  return JSON.stringify(Object.keys(cells)) === '["family","verb","delete"]' ? true : 'fields: ' + short(Object.keys(cells));
}, 1000);
test.run('family and verb are drawn escaped', 0.2, function () {
  if (!cells) return NO_ROW;
  return cells.family === 'de&lt;sk>' && /chat&lt;add>/.test(cells.verb || '') && !/<add>/.test(cells.verb || '') ? true : 'cells: ' + short(cells);
}, 1000);
// Andy, box: "A branch row with an empty verb shows as \"(ALL)\", as the filter does."
test.run('an empty verb shows as (ALL)', 0.2, function () {
  if (!hasRow()) return NO_ROW;
  const all = E.search.branch.rowElement.create({ id: 4, bundle: 7, family: 'files', verb: '' });
  allCells = {}; all.cells().forEach(function (c) { allCells[c.name] = c.html; });
  return allCells.verb === '(ALL)' ? true : 'verb: ' + short(allCells.verb);
}, 1000);
test.run('delete is a button naming its action', 0.2, function () {
  if (!cells) return NO_ROW;
  return /data-action="delete"/.test(cells.delete || '') ? true : 'delete: ' + short(cells.delete);
}, 1000);

// Delete asks are-you-sure
test.run('mounted, its Delete is an armingButton, and nothing is asked yet', 0.2, function () {
  if (!el) return NO_ROW;
  const hosts = { family: cell(), verb: cell(), delete: cell() };
  el.mount(hosts);
  del = armed.filter(function (a) { return a.button && a.button.action === 'delete'; })[0];
  return !!del && typeof del.o.run === 'function' && asked.length === 0 ? true : 'armed: ' + short(armed.length) + ', asked ' + short(asked);
}, 1000);
test.run('its second press asks auth.branch { op: delete, id }', 0.2, async function () {
  if (!el) return NO_ROW;
  if (del) { await del.o.run(); await settle(); }
  return asked.length === 1 && asked[0].op === 'delete' && asked[0].id === 3 ? true : 'asked: ' + short(asked);
}, 1000);

// it repaints from the auth family's branches (goal/G41.14, G41.28)
// Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set".
test.run('its row in the branches changed, the row repaints: the verb now (ALL)', 0.2, async function () {
  if (!hasRow()) return NO_ROW;
  live = E.search.branch.rowElement.create({ id: 5, bundle: 7, family: 'files', verb: 'read' });
  lh = { family: cell(), verb: cell(), delete: cell() };
  live.mount(lh);
  V.set('branches/5', { id: 5, bundle: 7, family: 'files', verb: '' });
  await settle();
  return live.row.verb === '' && lh.verb.innerHTML === '(ALL)' ? true : 'row: ' + short(live.row) + ', verb cell ' + short(lh.verb.innerHTML);
}, 1000);
test.run('another branch\'s row changes nothing here', 0.2, async function () {
  if (!live) return NO_ROW;
  V.set('branches/6', { id: 6, bundle: 7, family: 'desk', verb: 'x' });
  await settle();
  return live.row.family === 'files' ? true : 'row: ' + short(live.row);
}, 1000);

// the type's own element takes the node's branch rows from the stream (goal/G41.14)
// The row element is the data type's code (G30.18: "rowElements carry the listeners and painters a subject needs
// for real-time updates"); it is loaded with every list of its kind, and since goal/G41.28 the rows are taken by the
// auth family's cache manager it loads. Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
// carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
// of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
test.run('a branch row published lands in the auth family\'s branches by its id, through the family\'s cache manager the row element loads (goal/G41.28)', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'branch', row: { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' } } });
  return JSON.stringify(A.branches.row({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id)) === JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }) ? true : 'data: ' + short(A.branches.rows());
}, 1000);
test.run('a row published again replaces the one kept', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'branch', row: { id: 3, bundle: 7, family: 'desk', verb: '' } } });
  const again = A.branches.row({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id);
  return again && again.verb === '' ? true : 'data: ' + short(again);
}, 1000);
test.run('a row published gone is taken out', 0.2, function () {
  if (!hasA()) return NO_A;
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'branch', row: { id: { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id }, gone: true } });
  return A.branches.row({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id) === null ? true : 'data: ' + short(A.branches.rows());
}, 1000);
test.run('the other table\'s rows, another job\'s, and a row with no id write nothing in the branches', 0.2, function () {
  if (!hasA()) return NO_A;
  const before = JSON.stringify(A.branches.rows());
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'bundle', row: { id: 99, label: 'x', bundle: 1, family: 'f', verb: '' } } });
  DATA.takeJob({ id: 'spirit.contact', data: { row: { id: 98 } } });
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'branch', row: { label: 'no id' } } });
  return JSON.stringify(A.branches.rows()) === before ? true : 'data: ' + short(A.branches.rows());
}, 1000);
