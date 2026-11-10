'use strict';

// spirit/run/spirit/element/search/job/test/rowElement.js
// The tests of spirit/element/search/job/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G43.32). The
// browser file runs in node on a bare window; the shared row element (spirit/element/rowElement.js) is a stand-in that keeps
// the spec it is handed, so what is judged is what this file says a job is. The progress bar and the icon element are
// stand-ins too.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'rowElement.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

test.startTest('search/job/rowElement.js: one job, as a row element (goal/G43.32)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/job/rowElement.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const required = [];
  const specs = [];
  const indexes = [];
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
  const R = E().search && E().search.job && E().search.job.rowElement;
  ok(R && typeof R.create === 'function', 'it places itself at spirit.element.spirit.element.search.job.rowElement, with a create', 'its place: ' + short(R && Object.keys(R)));
  if (!R || typeof R.create !== 'function') return;
  ok(['spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/element/progressBar.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it loads what it draws with: the shared row element, the icon element, the progress bar', 'required: ' + short(required));

  test.subHeading('a job, its cells');
  let latest = 'a';
  R.create({ id: 'a', status: 'running', kind: 'server', module: 'spirit.app.x', updatedAt: Date.UTC(2030, 0, 1), app: { job: { state: 'progress', done: 2, total: 4, text: 'half' } } }, { latest: function () { return latest; } });
  const s = specs[0];
  ok(s && s.kind === 'job' && s.key === 'a' && Array.isArray(s.actions) && !s.actions.length, 'a row of kind job, keyed by the job\'s id, with no actions: a press opens its detail', 'spec: ' + short(s && { kind: s.kind, key: s.key, actions: s.actions }));
  const paint = function (name, j) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(j) : null; };
  ok(JSON.stringify(s.fields.map(function (f) { return f.name; })) === JSON.stringify(['latest', 'status', 'name', 'kind', 'progress', 'updated']),
    'its fields: latest, status, name, kind, progress, updated', 'fields: ' + short(s.fields.map(function (f) { return f.name; })));
  ok(/●/.test(paint('latest', s.row)), 'the job that changed last carries the one green dot', 'latest: ' + short(paint('latest', s.row)));
  latest = 'b';
  ok(paint('latest', s.row) === '', 'and loses it once another job changed last: the dot follows latest(), read when painted', 'latest: ' + short(paint('latest', s.row)));
  ok(/running/.test(paint('status', s.row)) && /🏃/.test(paint('status', s.row)), 'its status, with its glyph', 'status: ' + short(paint('status', s.row)));
  ok(paint('name', s.row) === 'spirit.app.x' && paint('name', { id: 'z' }) === 'z', 'its name is its module, else its id', 'name: ' + short([paint('name', s.row), paint('name', { id: 'z' })]));
  ok(paint('kind', { kind: 'permanent' }) === 'node' && paint('kind', { kind: 'server' }) === 'server' && paint('kind', { kind: 'process' }) === 'transient',
    'its kind: the node\'s own jobs node, appServers server, a run transient', 'kinds: ' + short([paint('kind', { kind: 'permanent' }), paint('kind', { kind: 'server' }), paint('kind', { kind: 'process' })]));
  ok(paint('progress', s.row) === '[bar 2/4 half]', 'a job in progress draws the bar from its own app object', 'progress: ' + short(paint('progress', s.row)));
  ok(paint('progress', { status: 'completed', app: { job: { state: 'progress', done: 4, total: 4 } } }) === '' && paint('progress', { status: 'running' }) === '',
    'a terminal job, or one with no job cycle, draws no bar', 'progress: ' + short(paint('progress', { status: 'completed', app: { job: { state: 'progress' } } })));
  ok(paint('updated', s.row) !== '' && paint('updated', { id: 'q' }) === '', 'it shows when it was updated, and nothing when it never was', 'updated: ' + short([paint('updated', s.row), paint('updated', { id: 'q' })]));
  ok(/&lt;/.test(paint('name', { id: '<b>' })), 'what it paints is escaped', 'name: ' + short(paint('name', { id: '<b>' })));

  test.subHeading('what the list reads of it');
  R.create({ id: 'c' });
  ok(indexes.length === 1 && specs[1].index === specs[0].index, 'its rows share one index', indexes.length + ' indexes');
  ok(typeof R.kindOf === 'function' && R.kindOf({ kind: 'server' }) === 'server', 'kindOf(job) for the list\'s kind filter', 'kindOf: ' + short(R.kindOf));
  ok(R.STATUS_ICON && R.STATUS_ICON.failed === '❌', 'STATUS_ICON, a status\'s glyph, for the detail\'s layer', 'STATUS_ICON: ' + short(R.STATUS_ICON));
}()).then(function () { test.reportSuccessFailureCount(); }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
