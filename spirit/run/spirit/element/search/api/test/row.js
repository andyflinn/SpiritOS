'use strict';

// spirit/run/spirit/element/search/api/test/row.js
// The tests of spirit/element/search/api/row.js, and of no other module (spec: ./row.md; goal/G43.32). The
// browser file runs in node on a bare window; the shared row element is a stand-in that keeps the spec it is handed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'row.js');
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, specs, indexes = 0, R, a, b;

test.run('the row runs on a bare window, with a stand-in for the shared row element', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = [];
  specs = [];
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.required.spirit.element;
  E.row = { index: function () { indexes += 1; return { n: indexes }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  R = E.search && E.search.api && E.search.api.row;
  return true;
}, test.limit.quick);
test.run('it places itself on spirit.required at its path, with a create', 0.2, function () {
  return R && typeof R.create === 'function' ? true : false;
}, test.limit.quick);
test.run('it loads the shared row element itself', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/element/row.js') !== -1 ? true : false;
}, test.limit.quick);

// a family, its row
test.run('it makes a row of kind branch, keyed and named by the branch, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  R.create({ name: 'fs' });
  R.create({ key: '<x>' });
  a = specs[0]; b = specs[1];
  return a && a.kind === 'family' && a.key === 'fs' && a.row.name === 'fs' && Array.isArray(a.actions) && !a.actions.length ? true : false;
}, test.limit.quick);
test.run('its one field is the branch\'s name', 0.2, function () {
  if (!a) return false;
  return a.fields.length === 1 && a.fields[0].name === 'name' && a.fields[0].paint(a.row) === 'fs' ? true : false;
}, test.limit.quick);
test.run('a row handed only a key is named by it, and what it paints is escaped', 0.2, function () {
  return b && b.key === '<x>' && b.fields[0].paint(b.row) === '&lt;x>' ? true : false;
}, test.limit.quick);
test.run('its rows share one index', 0.2, function () {
  if (!a || !b) return false;
  return indexes === 1 && a.index === b.index ? true : false;
}, test.limit.quick);
