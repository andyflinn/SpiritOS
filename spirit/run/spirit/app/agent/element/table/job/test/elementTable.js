'use strict';

// spirit/run/spirit/app/agent/element/table/job/test/elementTable.js
// The tests of spirit/app/agent/element/table/job/elementTable.js, and of no other module (spec: ./elementTable.md). Its
// own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
// The job table in the page (goal/G41.4): its rows in the tables' shared element (../tableElement.js, tested in its own
// folder), a row picked opening in its editor (./elementRow.js, tested by ./elementRow.js here). The browser file runs in
// node on a window of its own; the shared element and the row editor are stand-ins handed as
// spirit.requireScript's answers, keeping what they were handed. The same world as the other tables' elementTable tests.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'elementTable.js');
const SHARED = 'spirit/app/agent/element/table/tableElement.js';
const ROW = 'spirit/app/agent/element/table/job/elementRow.js';

function load(file) { PAGE_LOAD.runAsPage(file); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.required); };

// ── the world: a window of its own, the shared element and the row editor stand-ins ──
// W.tables: each shared table made, { container, o, refreshed, destroyed }. W.rows: each row editor made. W.held: while
// set, the files it asks for have not loaded yet.
const W = { required: [], tables: [], rows: [], held: null };
function world() {
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
  // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
  // function... or fail/throw"): the shared element and the row editor, each for its path; any other path an empty object.
  const STANDS = {};
  STANDS[SHARED] = { create: function (container, o) {
    const t = { container: container, o: o, refreshed: 0, destroyed: false, refresh: function () { t.refreshed += 1; }, destroy: function () { t.destroyed = true; } };
    W.tables.push(t); return t;
  } };
  STANDS[ROW] = { create: function (box, id, added, detail) { const r = { box: box, id: id, added: added, detail: detail }; W.rows.push(r); return r; } };
  const answerOf = function (p) { return Object.prototype.hasOwnProperty.call(STANDS, p) ? STANDS[p] : {}; };
  global.window.spirit.requireScript = function (p) {
    W.required.push(String(p));
    if (W.held) return W.held.promise.then(function () { return answerOf(p); });
    return Promise.resolve(answerOf(p));
  };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
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
test.run('before it runs, the page has no job table element', 0.2, function () {
  if (!W.up) return false;
  return at('spirit.app.agent.element.table.job.elementTable') === undefined || false;
}, test.limit.quick);
test.run('it places the job table\'s elementTable on spirit.required by its path, with create', 0.2, async function () {
  if (!W.up) return false;
  // Its row editor's file run first, as the page's loader runs it, so it stands at its own place by the loader's placing
  // (goal/G49.9), never written there by this test; then this file, whose place sits beside it.
  try { PAGE_LOAD.runAsPage(path.join(RUN, ROW)); } catch (e) { /* a row editor that throws as it loads stands nowhere: the place check says so */ }
  load(FILE);
  await settle();
  E.table = at('spirit.app.agent.element.table.job.elementTable');
  return (!!E.table && typeof E.table.create === 'function') || false;
}, test.limit.quick);
test.run('the job row editor, elementRow, keeps its own place beside the elementTable', 0.2, function () {
  if (!E.table) return false;
  const r = at('spirit.app.agent.element.table.job.elementRow');
  return (!!r && typeof r.create === 'function') || false;
}, test.limit.quick);

// ── create(container, detail): the shared table, for the job table ──
test.run('create, handed a container and a detail pane, makes the tables\' shared element in that container', 0.2, async function () {
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
test.run('the shared element is told its table, job, and the page\'s detail pane', 0.2, function () {
  if (!E.t) return false;
  return (E.t.o.table === 'job' && E.t.o.detail === detail) || false;
}, test.limit.quick);
test.run('picking a row opens the job row editor in the detail pane, made for that row\'s box, id and added flag', 0.2, function () {
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
test.run('before its parts have loaded, refresh throws nothing; destroyed then, it makes no table', 0.2, async function () {
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
