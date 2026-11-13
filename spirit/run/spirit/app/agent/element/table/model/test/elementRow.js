'use strict';

// spirit/run/spirit/app/agent/element/table/model/test/elementRow.js
// The tests of spirit/app/agent/element/table/model/elementRow.js, and of no other module (spec: ./elementRow.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
// One model row in the page (goal/G41.4): the fields the model table names, handed to the tables' row element
// (../rowElement.js, tested in its own folder). The browser file runs in node on a window of its own; the row element is a
// stand-in placed by the real installSpiritElement as its own file places it, keeping what it was handed. The same world
// as the other tables' elementRow tests. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const FILE = path.join(__dirname, '..', 'elementRow.js');
const ROW = 'spirit/app/agent/element/table/rowElement.js';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.element); };

// ── the world: a window of its own, the row element a stand-in ──
// W.made: each row element made, { container, o, destroyed }. W.held: while set, the row element's file has not loaded yet.
const W = { required: [], managers: [], made: [], held: null };
function world() {
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  // A family's cache manager, asked by name (spirit.cacheManager, goal/G41.28): each ask kept.
  global.window.spirit.cacheManager = function (name) { W.managers.push(String(name)); return Promise.resolve({}); };
  const helper = require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'));
  // The tables' row element, as its own file places itself: by the one helper, at spirit.element.<its path>.
  helper(global.window.spirit, ROW, { create: function (container, o) { const m = { container: container, o: o, destroyed: false, destroy: function () { m.destroyed = true; } }; W.made.push(m); return m; } });
  global.window.spirit.require = function (p) {
    W.required.push(String(p));
    if (p === ROW && W.held) return W.held.promise;
    return Promise.resolve(true);
  };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
}
// The page's detail pane: look(table) gives the title row its icon and name; each ask kept.
const looks = [];
const detail = { look: function (t) { looks.push(t); return { icon: '•', name: 'the ' + t + ' look' }; } };
const NO_WORLD = 'no page: the world failed';
const NOT_PLACED = 'no model row element: it was not placed';
const NOT_MADE = 'no row element was made: create failed';
const E = {};
const plain = function (fields) { return (fields || []).map(function (f) { const o = { field: f.field, kind: f.kind }; if (f.pick) o.pick = f.pick; if (f.of) o.of = f.of; return o; }); };
const fieldOf = function (name) { const m = E.m; return m && m.o && Array.isArray(m.o.fields) ? m.o.fields.filter(function (f) { return f.field === name; })[0] || null : null; };

test.run('the world: the file runs on a window of its own, the row element a stand-in placed as the page places it', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/element/table/model/elementRow.js is not there';
  world();
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before it runs, the page has no model row element', 0.2, function () {
  if (!W.up) return NO_WORLD;
  return at('spirit.app.agent.element.table.model.elementRow') === undefined || 'placed already';
}, test.limit.quick);
test.run('it places spirit.element.spirit.app.agent.element.table.model.elementRow, with create', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  load(FILE);
  await settle();
  E.row = at('spirit.app.agent.element.table.model.elementRow');
  return (!!E.row && typeof E.row.create === 'function') || 'placed ' + short(E.row && Object.keys(E.row));
}, test.limit.quick);
// "Its table's rows are the agent family's cache (goal/G41.28) ... it is loaded here, with this element."
test.run('as it loads, it asks for the agent family\'s cache manager, spirit.cacheManager(\'agent\')', 0.2, function () {
  if (!W.up) return NO_WORLD;
  return W.managers.indexOf('agent') !== -1 || 'asked ' + short(W.managers);
}, test.limit.quick);

// ── create(container, id, added, detail): the row element, handed the model table's fields ──
test.run('create(container, id, true, detail) makes the tables\' row element in that container', 0.2, async function () {
  if (!E.row) return NOT_PLACED;
  E.box = { id: 'box' };
  E.made = E.row.create(E.box, 'ID1', true, detail);
  await settle();
  E.m = W.made[W.made.length - 1];
  return (!!E.m && E.m.container === E.box) || 'made ' + short(W.made.length);
}, test.limit.quick);
test.run('it loads the row element itself, spirit/app/agent/element/table/rowElement.js (rule/26)', 0.2, function () {
  if (!W.up) return NO_WORLD;
  return W.required.indexOf(ROW) !== -1 || 'required ' + short(W.required);
}, test.limit.quick);
test.run('the row element is told its table, model, and the row\'s id', 0.2, function () {
  if (!E.m) return NOT_MADE;
  return (E.m.o.table === 'model' && E.m.o.id === 'ID1') || 'told ' + short({ table: E.m.o.table, id: E.m.o.id });
}, test.limit.quick);
test.run('added, the row just made by Add, is told as true', 0.2, function () {
  if (!E.m) return NOT_MADE;
  return E.m.o.added === true || 'added ' + short(E.m.o.added);
}, test.limit.quick);
test.run('the title row\'s look is the detail pane\'s look of the model table', 0.2, function () {
  if (!E.m) return NOT_MADE;
  return (looks.indexOf('model') !== -1 && !!E.m.o.look && E.m.o.look.name === 'the model look') || 'look ' + short(E.m.o.look) + ', asked ' + short(looks);
}, test.limit.quick);
test.run('its fields are the model table\'s: label, providerId, capabilities', 0.2, function () {
  if (!E.m) return NOT_MADE;
  return JSON.stringify(plain(E.m.o.fields)) === JSON.stringify([{'field': 'label', 'kind': 'output'}, {'field': 'providerId', 'kind': 'output', 'pick': 'provider'}, {'field': 'capabilities', 'kind': 'output'}]) || 'fields ' + short(plain(E.m.o.fields));
}, test.limit.quick);
// goal/G41.21: every field shown only; capabilities: "model details, capabilites, is output only".
test.run('every field is output only: a model is shown, never edited (goal/G41.21)', 0.2, function () {
  if (!E.m) return NOT_MADE;
  const edit = (E.m.o.fields || []).filter(function (f) { return f.kind !== 'output'; });
  return ((E.m.o.fields || []).length > 0 && edit.length === 0) || 'editable ' + short(edit);
}, test.limit.quick);
// Andy: "the label hold the model name as provided by the provider, and is output only in the models UI".
test.run('its label is the model\'s name as the provider gives it, shown as Model', 0.2, function () {
  if (!E.m) return NOT_MADE;
  const f = fieldOf('label');
  return (!!f && f.kind === 'output' && f.label === 'Model') || 'label ' + short(f);
}, test.limit.quick);
test.run('its provider is shown by the provider table\'s row, from providerId', 0.2, function () {
  if (!E.m) return NOT_MADE;
  const f = fieldOf('providerId');
  return (!!f && f.kind === 'output' && f.pick === 'provider') || 'providerId ' + short(f);
}, test.limit.quick);
test.run('its destroy destroys the row element it made', 0.2, function () {
  if (!E.made || !E.m) return NOT_MADE;
  E.made.destroy();
  return E.m.destroyed === true || 'the row element was not destroyed';
}, test.limit.quick);
test.run('anything but added === true is told as false; no detail pane, no look', 0.2, async function () {
  if (!E.row) return NOT_PLACED;
  E.row.create({ id: 'box2' }, 'ID2', 'yes');
  await settle();
  const m = W.made[W.made.length - 1];
  return (!!m && m.o.id === 'ID2' && m.o.added === false && m.o.look === null) || 'told ' + short(m && { added: m.o.added, look: m.o.look });
}, test.limit.quick);
test.run('destroyed before the row element has loaded, it makes none', 0.2, async function () {
  if (!E.row) return NOT_PLACED;
  let open = null;
  W.held = { promise: new Promise(function (r) { open = r; }) };
  const n = W.made.length;
  const early = E.row.create({ id: 'box3' }, 'ID3', false, detail);
  early.destroy();
  open(true); W.held = null;
  await settle();
  return W.made.length === n || 'made ' + (W.made.length - n) + ' after its destroy';
}, test.limit.quick);
