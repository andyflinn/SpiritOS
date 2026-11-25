'use strict';

// spirit/run/spirit/element/search/api/row/test/script.js
// The tests of spirit/element/search/api/row/script.js, and of no other module (spec: ./script.md; goal/G43.32). The
// browser file runs in node on a bare window; the shared row element is a stand-in that keeps the spec it is handed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');

const FILE = path.join(__dirname, '..', 'script.js');
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, specs, indexes = 0, R, a, b;

test.run('the row runs on a bare window, with a stand-in for the shared row element', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = [];
  specs = [];
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, readyPromise: Promise.resolve({}), element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // ITS STAND-IN IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never
  // by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the shared row element, the one script it requires.
  const ROW = { index: function () { indexes += 1; return { n: indexes }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  const STANDS = { 'spirit/element/row/script.js': ROW };
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    return Object.prototype.hasOwnProperty.call(STANDS, p) ? Promise.resolve(STANDS[p]) : Promise.reject(new Error('no stand-in for ' + p));
  };
  R = PAGE_LOAD.runAsPage(FILE);
  await settle();
  return true;
}, test.limit.quick);
test.run('it places itself on spirit.required at its path, with a create', 0.2, function () {
  return R && typeof R.create === 'function' ? true : false;
}, test.limit.quick);
test.run('it loads the shared row element itself', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/element/row/script.js') !== -1 ? true : false;
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
