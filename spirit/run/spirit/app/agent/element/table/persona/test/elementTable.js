'use strict';

// spirit/run/spirit/app/agent/element/table/persona/test/elementTable.js
// The tests of spirit/app/agent/element/table/persona/elementTable.js, and of no other module (spec: ./elementTable.md). Its
// own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
// The persona table in the page (goal/G41.4): its rows in the tables' shared element (../tableElement.js, tested in its own
// folder), a row picked opening in its editor (./elementRow.js, tested by ./elementRow.js here). The browser file runs in
// node on a window of its own; the shared element and the row editor are stand-ins placed by the real installSpiritElement
// as their own files place them, keeping what they were handed. The same world as the other tables' elementTable tests.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const branchPath = require(path.join(RUN, 'spirit', 'spirit.js')).branchPath;
const FILE = path.join(__dirname, '..', 'elementTable.js');
const SHARED = 'spirit/app/agent/element/table/tableElement.js';
const ROW = 'spirit/app/agent/element/table/persona/elementRow.js';

function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.required); };

// ── the world: a window of its own, the shared element and the row editor stand-ins ──
// W.tables: each shared table made, { container, o, refreshed, destroyed }. W.rows: each row editor made. W.held: while
// set, the files it asks for have not loaded yet.
const W = { required: [], tables: [], rows: [], held: null };
function world() {
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, branchPath: branchPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  const helper = require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'));
  // As their own files place themselves: by the one helper, at spirit.required.<their path>.
  helper(global.window.spirit, SHARED, { create: function (container, o) {
    const t = { container: container, o: o, refreshed: 0, destroyed: false, refresh: function () { t.refreshed += 1; }, destroy: function () { t.destroyed = true; } };
    W.tables.push(t); return t;
  } });
  helper(global.window.spirit, ROW, { create: function (box, id, added, detail) { const r = { box: box, id: id, added: added, detail: detail }; W.rows.push(r); return r; } });
  global.window.spirit.require = function (p) {
    W.required.push(String(p));
    if (W.held) return W.held.promise;
    return Promise.resolve(true);
  };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
}
// The page's detail pane, handed on as it is.
const detail = { look: function (t) { return { icon: '•', name: t }; } };
const E = {};

test.run('the file runs on a window of its own, with stand-ins for the shared element and the row editor placed as the page places them', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  world();
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before it runs, the page has no persona table element', 0.2, function () {
  if (!W.up) return false;
  return at('spirit.app.agent.element.table.persona.elementTable') === undefined || false;
}, test.limit.quick);
test.run('it places spirit.required.spirit.app.agent.element.table.persona.elementTable, with create', 0.2, async function () {
  if (!W.up) return false;
  load(FILE);
  await settle();
  E.table = at('spirit.app.agent.element.table.persona.elementTable');
  return (!!E.table && typeof E.table.create === 'function') || false;
}, test.limit.quick);
test.run('the row editor keeps its own place beside it, at spirit.required.spirit.app.agent.element.table.persona.elementRow', 0.2, function () {
  if (!E.table) return false;
  const r = at('spirit.app.agent.element.table.persona.elementRow');
  return (!!r && typeof r.create === 'function') || false;
}, test.limit.quick);

// ── create(container, detail): the shared table, for the persona table ──
test.run('create, given a container and the detail pane, makes the tables\' shared element in that container', 0.2, async function () {
  if (!E.table) return false;
  E.box = { id: 'box' };
  E.made = E.table.create(E.box, detail);
  await settle();
  E.t = W.tables[W.tables.length - 1];
  return (!!E.t && E.t.container === E.box) || false;
}, test.limit.quick);
test.run('it loads the shared element and its own row editor itself', 0.2, function () {
  if (!W.up) return false;
  return (W.required.indexOf(SHARED) !== -1 && W.required.indexOf(ROW) !== -1) || false;
}, test.limit.quick);
test.run('the shared element is told its table, persona, and the page\'s detail pane', 0.2, function () {
  if (!E.t) return false;
  return (E.t.o.table === 'persona' && E.t.o.detail === detail) || false;
}, test.limit.quick);
test.run('picking a row opens the persona row editor in the detail pane, made for that row\'s box, id and added flag', 0.2, function () {
  if (!E.t) return false;
  if (typeof E.t.o.row !== 'function') return false;
  const b = { id: 'detail-box' };
  const got = E.t.o.row(b, 'ID7', true);
  const r = W.rows[W.rows.length - 1];
  return (!!r && got === r && r.box === b && r.id === 'ID7' && r.added === true && r.detail === detail) || false;
}, test.limit.quick);
test.run('its refresh refreshes the shared table', 0.2, function () {
  if (!E.made || !E.t) return false;
  E.made.refresh();
  return E.t.refreshed === 1 || false;
}, test.limit.quick);
test.run('its destroy destroys the shared table', 0.2, function () {
  if (!E.made || !E.t) return false;
  E.made.destroy();
  return E.t.destroyed === true || false;
}, test.limit.quick);
test.run('before its parts have loaded, refresh throws nothing, and destroyed then it makes no table', 0.2, async function () {
  if (!E.table) return false;
  let open = null;
  W.held = { promise: new Promise(function (r) { open = r; }) };
  const n = W.tables.length;
  const early = E.table.create({ id: 'box2' }, detail);
  try { early.refresh(); } catch (e) { W.held = null; return false; }
  early.destroy();
  open(true); W.held = null;
  await settle();
  return W.tables.length === n || false;
}, test.limit.quick);
