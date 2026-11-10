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
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

test.startTest('search/api/rowElement.js: one family of an api tree, as a row element (goal/G43.32)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/api/rowElement.js is not there'); return; }
  const required = [];
  const specs = [];
  let indexes = 0;
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element.spirit.element;
  E.rowElement = { index: function () { indexes += 1; return { n: indexes }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  const R = E.search && E.search.api && E.search.api.rowElement;
  ok(R && typeof R.create === 'function', 'it places itself at spirit.element.spirit.element.search.api.rowElement, with a create', 'its place: ' + short(R && Object.keys(R)));
  if (!R || typeof R.create !== 'function') return;
  ok(required.indexOf('spirit/element/rowElement.js') !== -1, 'it loads the shared row element itself', 'required: ' + short(required));

  test.subHeading('a family, its row');
  R.create({ name: 'fs' });
  R.create({ key: '<x>' });
  const a = specs[0], b = specs[1];
  ok(a && a.kind === 'family' && a.key === 'fs' && a.row.name === 'fs' && Array.isArray(a.actions) && !a.actions.length, 'a row of kind family, keyed and named by the family, with no actions', 'spec: ' + short(a && { kind: a.kind, key: a.key, row: a.row }));
  ok(a && a.fields.length === 1 && a.fields[0].name === 'name' && a.fields[0].paint(a.row) === 'fs', 'its one field is the family\'s name', 'fields: ' + short(a && a.fields.map(function (f) { return f.name; })));
  ok(b && b.key === '<x>' && b.fields[0].paint(b.row) === '&lt;x>', 'a row handed only a key is named by it, and what it paints is escaped', 'spec: ' + short(b && { key: b.key, painted: b.fields[0].paint(b.row) }));
  ok(indexes === 1 && a.index === b.index, 'its rows share one index', indexes + ' indexes');
}()).then(function () { test.reportSuccessFailureCount(); }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
