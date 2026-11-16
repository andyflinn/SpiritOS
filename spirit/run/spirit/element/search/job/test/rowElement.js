'use strict';

// spirit/run/spirit/element/search/job/test/rowElement.js
// The tests of spirit/element/search/job/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G43.32). The
// browser file runs in node on a bare window; the shared row element (spirit/element/rowElement.js) is a stand-in that keeps
// the spec it is handed, so what is judged is what this file says a job is. The progress bar and the icon element are
// stand-ins too. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'rowElement.js');
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// What the world and the tests make, for the tests after them.
let required, specs, indexes, R, s, paint;
let latest = 'a';

test.run('the row runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  const SRC = fs.readFileSync(FILE, 'utf8');
  required = [];
  specs = [];
  indexes = [];
  global.document = { createElement: function () { return { innerHTML: '' }; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  const E = function () { return global.window.spirit.element.spirit.element; };
  global.window.spirit.require = function (p) { required.push(String(p)); return Promise.resolve(true); };
  vm.runInThisContext(SRC, { filename: FILE });
  await settle();
  // The shared parts, as the page has them once they are loaded: the row element keeps its spec; the bar says its numbers.
  E().rowElement = { index: function (sub) { indexes.push(sub); return { id: indexes.length }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  E().progressBar = function (done, total, text) { return '[bar ' + done + '/' + total + ' ' + text + ']'; };
  R = E().search && E().search.job && E().search.job.rowElement;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.element.spirit.element.search.job.rowElement, with a create', 0.2, function () {
  if (!required) return false;
  return R && typeof R.create === 'function' ? true : false;
}, test.limit.quick);
test.run('it loads what it draws with, the shared row element, the icon element and the progress bar', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  return ['spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/element/progressBar.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : false;
}, test.limit.quick);

// a job, its cells
test.run('create makes a row of kind job, keyed by the job\'s id, with no actions, since a press opens its detail', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  R.create({ id: 'a', status: 'running', kind: 'server', module: 'spirit.app.x', updatedAt: Date.UTC(2030, 0, 1), app: { job: { state: 'progress', done: 2, total: 4, text: 'half' } } }, { latest: function () { return latest; } });
  s = specs[0];
  paint = function (name, j) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(j) : null; };
  return s && s.kind === 'job' && s.key === 'a' && Array.isArray(s.actions) && !s.actions.length ? true : false;
}, test.limit.quick);
test.run('its fields are latest, status, name, kind, progress and updated', 0.2, function () {
  if (!s) return false;
  return JSON.stringify(s.fields.map(function (f) { return f.name; })) === JSON.stringify(['latest', 'status', 'name', 'kind', 'progress', 'updated']) ? true : false;
}, test.limit.quick);
test.run('the job that changed last carries the one green dot', 0.2, function () {
  if (!s) return false;
  return /●/.test(paint('latest', s.row)) ? true : false;
}, test.limit.quick);
test.run('a job loses the green dot once another job changed last, since the dot follows latest, read when painted', 0.2, function () {
  if (!s) return false;
  latest = 'b';
  return paint('latest', s.row) === '' ? true : false;
}, test.limit.quick);
test.run('it shows its status with its glyph', 0.2, function () {
  if (!s) return false;
  return /running/.test(paint('status', s.row)) && /🏃/.test(paint('status', s.row)) ? true : false;
}, test.limit.quick);
test.run('its name is its module, else its id', 0.2, function () {
  if (!s) return false;
  return paint('name', s.row) === 'spirit.app.x' && paint('name', { id: 'z' }) === 'z' ? true : false;
}, test.limit.quick);
test.run('its kind shows the node\'s own jobs as node, appServers as server, and a run as transient', 0.2, function () {
  if (!s) return false;
  return paint('kind', { kind: 'permanent' }) === 'node' && paint('kind', { kind: 'server' }) === 'server' && paint('kind', { kind: 'process' }) === 'transient' ? true
    : false;
}, test.limit.quick);
test.run('a job in progress draws the bar from its own app object', 0.2, function () {
  if (!s) return false;
  return paint('progress', s.row) === '[bar 2/4 half]' ? true : false;
}, test.limit.quick);
test.run('a terminal job, or one with no job cycle, draws no bar', 0.2, function () {
  if (!s) return false;
  return paint('progress', { status: 'completed', app: { job: { state: 'progress', done: 4, total: 4 } } }) === '' && paint('progress', { status: 'running' }) === '' ? true
    : false;
}, test.limit.quick);
test.run('it shows when it was updated, and nothing when it never was', 0.2, function () {
  if (!s) return false;
  return paint('updated', s.row) !== '' && paint('updated', { id: 'q' }) === '' ? true : false;
}, test.limit.quick);
test.run('what it paints is escaped', 0.2, function () {
  if (!s) return false;
  const escaped = /&lt;/.test(paint('name', { id: '<b>' }));
  return escaped ? true : false;
}, test.limit.quick);

// what the list reads of it
test.run('its rows share one index', 0.2, function () {
  if (!s) return false;
  R.create({ id: 'c' });
  return indexes.length === 1 && specs[1].index === specs[0].index ? true : false;
}, test.limit.quick);
test.run('it hands kindOf, a job\'s kind, to the list\'s kind filter', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  return typeof R.kindOf === 'function' && R.kindOf({ kind: 'server' }) === 'server' ? true : false;
}, test.limit.quick);
test.run('it hands STATUS_ICON, a status\'s glyph, to the detail\'s layer', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  return R.STATUS_ICON && R.STATUS_ICON.failed === '❌' ? true : false;
}, test.limit.quick);
