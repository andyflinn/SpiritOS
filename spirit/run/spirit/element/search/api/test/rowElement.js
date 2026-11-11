'use strict';

// spirit/run/spirit/element/search/api/test/rowElement.js
// The tests of spirit/element/search/api/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G43.32). The
// browser file runs in node on a bare window; the shared row element is a stand-in that keeps the spec it is handed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'rowElement.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, specs, indexes = 0, R, a, b;
const NO_R = 'no row element: the world failed';

test.run('the world: the row runs on a bare window, the shared row element a stand-in', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/api/rowElement.js is not there';
  required = [];
  specs = [];
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element.spirit.element;
  E.rowElement = { index: function () { indexes += 1; return { n: indexes }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  R = E.search && E.search.api && E.search.api.rowElement;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.element.spirit.element.search.api.rowElement, with a create', 0.2, function () {
  return R && typeof R.create === 'function' ? true : 'its place: ' + short(R && Object.keys(R));
}, test.limit.quick);
test.run('it loads the shared row element itself', 0.2, function () {
  if (!required) return NO_R;
  return required.indexOf('spirit/element/rowElement.js') !== -1 ? true : 'required: ' + short(required);
}, test.limit.quick);

// a family, its row
test.run('a row of kind family, keyed and named by the family, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return NO_R;
  R.create({ name: 'fs' });
  R.create({ key: '<x>' });
  a = specs[0]; b = specs[1];
  return a && a.kind === 'family' && a.key === 'fs' && a.row.name === 'fs' && Array.isArray(a.actions) && !a.actions.length ? true : 'spec: ' + short(a && { kind: a.kind, key: a.key, row: a.row });
}, test.limit.quick);
test.run('its one field is the family\'s name', 0.2, function () {
  if (!a) return 'no row was made';
  return a.fields.length === 1 && a.fields[0].name === 'name' && a.fields[0].paint(a.row) === 'fs' ? true : 'fields: ' + short(a.fields.map(function (f) { return f.name; }));
}, test.limit.quick);
test.run('a row handed only a key is named by it, and what it paints is escaped', 0.2, function () {
  return b && b.key === '<x>' && b.fields[0].paint(b.row) === '&lt;x>' ? true : 'spec: ' + short(b && { key: b.key, painted: b.fields[0].paint(b.row) });
}, test.limit.quick);
test.run('its rows share one index', 0.2, function () {
  if (!a || !b) return 'no rows were made';
  return indexes === 1 && a.index === b.index ? true : indexes + ' indexes';
}, test.limit.quick);
