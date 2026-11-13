'use strict';

// spirit/run/spirit/element/search/testicle/test/rowElement.js
// The tests of spirit/element/search/testicle/rowElement.js, and of no other module (spec: ./rowElement.md). Its own test,
// owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// A test row of testicle's test table (goal/G47.1, the search cycle). The browser file runs in node on a bare window, as
// the other rows' tests do (spirit/element/search/job/test/rowElement.js): the shared row element is a stand-in that keeps
// the spec it is handed, so what is judged is what this file says a test row is.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let required, specs, indexes, R, s, paint;
const NO_R = 'no row element placed: the world failed';
const NO_S = 'no row was made';
const ROW = { key: 'spirit/zz/alpha.js|spirit/zz/test/alpha.js|alpha answers <every> question, in full|1700000000000', script: 'spirit/zz/alpha.js',
  suite: 'spirit/zz/test/alpha.js', test: 'alpha answers <every> question, in full', verified: true, severity: 0, current: true };

test.run('the world: the row runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/testicle/rowElement.js is not there';
  required = []; specs = []; indexes = [];
  global.window = { spirit: { escapeHtml: function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  const own = global.window.spirit.require;
  global.window.spirit.require = function (p) { required.push(String(p)); return own.apply(this, arguments); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element.spirit.element;
  E.rowElement = { index: function (sub) { indexes.push(sub); return { id: indexes.length }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  R = E.search && E.search.testicle && E.search.testicle.rowElement;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.element.spirit.element.search.testicle.rowElement, with a create', 0.2, function () {
  if (!required) return 'the row never ran: the world failed';
  return (R && typeof R.create === 'function') || 'its place: ' + short(R && Object.keys(R));
}, test.limit.quick);
test.run('it loads what it draws with: the shared row element', 0.2, function () {
  if (!required) return 'the row never ran: the world failed';
  return required.indexOf('spirit/element/rowElement.js') !== -1 || 'required: ' + short(required);
}, test.limit.quick);
test.run('create makes a row of kind testicle, keyed by the row\'s full key, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return NO_R;
  R.create(ROW);
  s = specs[0];
  paint = function (name, v) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(v) : null; };
  return (s && s.kind === 'testicle' && s.key === ROW.key && s.row === ROW && Array.isArray(s.actions) && !s.actions.length) || 'spec: ' + short(s && { kind: s.kind, key: s.key, actions: s.actions });
}, test.limit.quick);
test.run('rows share one index', 0.2, function () {
  if (!s) return NO_S;
  R.create(Object.assign({}, ROW, { key: 'another' }));
  return (indexes.length === 1 && specs[1].index === specs[0].index) || indexes.length + ' indexes made';
}, test.limit.quick);
// the box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second;
// the title third; then the script name (no path), then the suite name (no path)"
test.run('its columns in order: result, severity, title, script, suite', 0.2, function () {
  if (!s) return NO_S;
  const names = s.fields.map(function (f) { return f.name; });
  return JSON.stringify(names) === JSON.stringify(['verified', 'severity', 'test', 'script', 'suite']) || 'fields: ' + short(names);
}, test.limit.quick);
test.run('the result is an icon: ✅ for a success, ❌ for a failure', 0.2, function () {
  if (!s) return NO_S;
  const got = [paint('verified', { verified: true }), paint('verified', { verified: false })];
  return JSON.stringify(got) === JSON.stringify(['✅', '❌']) || 'drawn: ' + short(got);
}, test.limit.quick);
// the box: "The test row also shows its severity, two decimal places, even for 0 and 1 (0.00, 1.00)"
test.run('the severity has two decimal places, even for 0 and 1', 0.2, function () {
  if (!s) return NO_S;
  const got = [0, 1, 0.2, 0.555].map(function (v) { return paint('severity', { severity: v }); });
  return JSON.stringify(got.slice(0, 3)) === JSON.stringify(['0.00', '1.00', '0.20']) && /^0\.5[56]$/.test(got[3]) || 'drawn: ' + short(got);
}, test.limit.quick);
// the box: "The test title is shown in full."
test.run('the title is shown in full, escaped', 0.2, function () {
  if (!s) return NO_S;
  const t = paint('test', ROW);
  return t === 'alpha answers &lt;every&gt; question, in full' || 'drawn: ' + short(t);
}, test.limit.quick);
// the box: "The script column and the suite column show the file name only, no path; hovering over a script or a suite
// shows its full name as a tooltip"
test.run('the script shows its file name only, its full name as a tooltip', 0.2, function () {
  if (!s) return NO_S;
  const h = paint('script', ROW);
  return (/title="spirit\/zz\/alpha\.js"/.test(h) && />alpha\.js</.test(h) && h.replace(/title="[^"]*"/, '').indexOf('spirit/zz') === -1) || 'drawn: ' + short(h);
}, test.limit.quick);
test.run('the suite shows its file name only, its full name as a tooltip', 0.2, function () {
  if (!s) return NO_S;
  const h = paint('suite', ROW);
  return (/title="spirit\/zz\/test\/alpha\.js"/.test(h) && />alpha\.js</.test(h) && h.replace(/title="[^"]*"/, '').indexOf('test/') === -1) || 'drawn: ' + short(h);
}, test.limit.quick);
