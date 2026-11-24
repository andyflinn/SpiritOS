'use strict';

// spirit/run/spirit/element/search/icon/row/test/script.js
// The tests of spirit/element/search/icon/row/script.js, and of no other module (spec: ./script.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// One icon as a row element (goal/G30.21). The browser file runs in node on a bare window, as the other rows' tests do
// (spirit/element/search/job/row/test/script.js): the shared row element is a stand-in that keeps the spec it is handed,
// and the icon element a stand-in that marks the glyph it draws.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'script.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let required, specs, indexes, R, E, s, paint;
const KEYWORDS = ['smile', 'happy <face>'];

test.run('the icon row element runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = []; specs = []; indexes = [];
  global.document = { createElement: function () { return { innerHTML: '' }; } };
  global.window = { spirit: { element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  const own = global.window.spirit.requireScript;
  global.window.spirit.requireScript = function (p) { required.push(String(p)); return own.apply(this, arguments); };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = global.window.spirit.required.spirit.element;
  E.row = { index: function (sub) { indexes.push(sub); return { id: indexes.length }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } };
  R = E.search && E.search.icon && E.search.icon.row;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.element.search.icon.row, with a create', 0.2, function () {
  if (!required) return false;
  return (R && typeof R.create === 'function') || false;
}, test.limit.quick);
// goal/G41.3, goal/G41.23
test.run('it loads what it draws with: the shared row element and the icon element', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/row/script.js', 'spirit/element/icon/script.js'].every(function (p) { return required.indexOf(p) !== -1; }) || false;
}, test.limit.quick);
// Andy: "it's the icon we store or use"
test.run('create makes a row of kind icon, keyed by its glyph, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  R.create({ glyph: '🙂', keywords: KEYWORDS });
  s = specs[0];
  paint = function (name, v) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(v) : null; };
  return (s && s.kind === 'icon' && s.key === '🙂' && Array.isArray(s.actions) && !s.actions.length) || false;
}, test.limit.quick);
test.run('its fields are the glyph and the keywords it is found by', 0.2, function () {
  if (!s) return false;
  const names = s.fields.map(function (f) { return f.name; });
  return (JSON.stringify(names) === JSON.stringify(['glyph', 'keywords']) && s.row.glyph === '🙂' && JSON.stringify(s.row.keywords) === JSON.stringify(KEYWORDS)) || false;
}, test.limit.quick);
test.run('a row keyed but with no glyph takes its key as the glyph, and a row with no keywords has none', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  R.create({ key: '⭐' });
  const k = specs[specs.length - 1];
  return (k.key === '⭐' && k.row.glyph === '⭐' && Array.isArray(k.row.keywords) && !k.row.keywords.length) || false;
}, test.limit.quick);
test.run('rows share one index', 0.2, function () {
  if (!s) return false;
  return (indexes.length === 1 && specs.every(function (x) { return x.index === specs[0].index; })) || false;
}, test.limit.quick);
test.run('the keywords are drawn joined by a comma, escaped', 0.2, function () {
  if (!s) return false;
  const h = paint('keywords', s.row);
  return h === 'smile, happy &lt;face&gt;' || false;
}, test.limit.quick);
// "the glyph as plain text while icon.js has not loaded"
test.run('while the icon element has not loaded, the glyph is drawn as plain text', 0.2, function () {
  if (!s) return false;
  const h = paint('glyph', { glyph: '<b>' });
  return (h.indexOf('&lt;b&gt;') !== -1 && h.indexOf('<b>') === -1) || false;
}, test.limit.quick);
// goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all shell elements and apps."
test.run('once the icon element is in, the glyph is the icon element\'s markup', 0.2, function () {
  if (!s) return false;
  const asked = [];
  E.icon = { create: function (hold, o) { asked.push(o); hold.innerHTML = '<span class="the-icon">' + o.glyph + '</span>'; return hold; } };
  const h = paint('glyph', s.row);
  return (h.indexOf('<span class="the-icon">🙂</span>') !== -1 && asked.length === 1 && asked[0].glyph === '🙂') || false;
}, test.limit.quick);
