'use strict';

// spirit/run/spirit/app/icons/test/data.js
// The tests of spirit/app/icons/data.js, and of no other module (spec: ./data.md; goal/G43.19, box v16). The box: "it
// implements a database-table interface, also reflected in api.js and data.js", and 10: "data.js on every open page follows
// that one job", spirit.app.icons. The translator runs as it does: in a window of its own beside the real spirit.required.spirit.data
// (spirit/client/script.js), which it writes into; the runs' rows are handed in as the node's stream hands them, jobs of module
// spirit.app.icons.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'client', 'script.js');

// The sender's public key, base64 with a + and a / in it, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  PAGE_LOAD.runAsPage(SPIRIT_DATA, win);
  PAGE_LOAD.runAsPage(FILE, win);
  const D = win.spirit.required.spirit.data;
  let n = 0;
  // The family is the app's id (goal/G49.19): spirit.required.spirit.data['spirit.app.icons'].
  const I = ((D || {})['spirit.app.icons'] || {}).data;
  return { D: D, I: I,
    // A run's publish as the stream hands it: a job of module spirit.app.icons whose app is the row.
    job: function (app, module) { D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.icons', data: {}, app: app }, SENDER); } };
}

// data.js: what a page knows of the icon set, following the one job spirit.app.icons (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
let w = null;
test.run('the icons branch\'s data answers rows, row and watch', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const made = world();
  if (!made.I) return false;
  w = made;
  return typeof w.I.rows === 'function' && typeof w.I.row === 'function' && typeof w.I.watch === 'function' ? true : false;
}, test.limit.quick);

// the box, 10: a run's publish, { icons: { row } }, is on the page
test.run('an added row is there, its glyph and keywords', 0.2, function () {
  if (!w) return false;
  w.job({ icons: { row: { glyph: '🌀', keywords: ['cyclone', 'spin'] } } });
  const r1 = w.I.row('🌀');
  return !!r1 && r1.glyph === '🌀' && JSON.stringify(r1.keywords) === '["cyclone","spin"]' ? true : false;
}, test.limit.quick);
test.run('an added row is among the rows', 0.2, function () {
  if (!w) return false;
  return Object.keys(w.I.rows() || {}).indexOf('🌀') !== -1 || false;
}, test.limit.quick);
test.run('a changed row replaces the one before', 0.2, function () {
  if (!w) return false;
  w.job({ icons: { row: { glyph: '🌀', keywords: ['storm'] } } });
  return JSON.stringify((w.I.row('🌀') || {}).keywords) === '["storm"]' || false;
}, test.limit.quick);

// a watch follows every change, and the row gone
const heard = [];
let off = null;
test.run('it hears a new row by its glyph', 0.2, function () {
  if (!w) return false;
  off = w.I.watch(function (g, v) { heard.push([g, v ? v.keywords : undefined]); });
  w.job({ icons: { row: { glyph: '🌁', keywords: ['fog'] } } });
  return heard.some(function (h) { return h[0] === '🌁' && JSON.stringify(h[1]) === '["fog"]'; }) || false;
}, test.limit.quick);
test.run('a publish of a glyph marked removed takes the row away', 0.2, function () {
  if (!w) return false;
  w.job({ icons: { glyph: '🌁', removed: true } });
  return w.I.row('🌁') === null || false;
}, test.limit.quick);
test.run('the watch hears the removed row gone', 0.2, function () {
  if (!w) return false;
  return heard.some(function (h) { return h[0] === '🌁' && h[1] === undefined; }) || false;
}, test.limit.quick);
test.run('a watch answers its release', 0.2, function () {
  if (!w) return false;
  return typeof off === 'function' || false;
}, test.limit.quick);
test.run('a released watch hears nothing more', 0.2, function () {
  if (!w) return false;
  if (typeof off === 'function') off();
  const before = heard.length;
  w.job({ icons: { row: { glyph: '🌆', keywords: ['dusk'] } } });
  return heard.length === before || false;
}, test.limit.quick);

// the attacker: what is not the icons job's publish changes nothing
const snap = function () { return JSON.stringify(w.I.rows() || {}); };
let was = '';
test.run('a row on another app\'s job, spirit.app.desk, is not taken', 0.8, function () {
  if (!w) return false;
  was = snap();
  w.job({ icons: { row: { glyph: '🌌', keywords: ['galaxy'] } } }, 'spirit.app.desk');
  return w.I.row('🌌') === null && snap() === was ? true : false;
}, test.limit.quick);
const crooked = function (app) {
  if (!w) return false;
  let threw = false;
  try { w.job(app); } catch (e) { threw = true; }
  return !threw && snap() === was ? true : false;
};
test.run('a crooked publish of null changes nothing', 0.2, function () { return crooked(null); }, test.limit.quick);
test.run('a crooked publish of a string changes nothing', 0.2, function () { return crooked('text'); }, test.limit.quick);
test.run('a crooked publish of a number changes nothing', 0.2, function () { return crooked(5); }, test.limit.quick);
test.run('a crooked publish of a list changes nothing', 0.2, function () { return crooked([]); }, test.limit.quick);
test.run('a crooked publish of icons that are null changes nothing', 0.2, function () { return crooked({ icons: null }); }, test.limit.quick);
test.run('a crooked publish of icons that are a string changes nothing', 0.2, function () { return crooked({ icons: 'x' }); }, test.limit.quick);
test.run('a crooked publish of a row that is null changes nothing', 0.2, function () { return crooked({ icons: { row: null } }); }, test.limit.quick);
test.run('a crooked publish of a row with no glyph changes nothing', 0.2, function () { return crooked({ icons: { row: { keywords: ['no glyph'] } } }); }, test.limit.quick);
test.run('a crooked publish of a removal with no glyph changes nothing', 0.2, function () { return crooked({ icons: { removed: true } }); }, test.limit.quick);
test.run('a crooked publish of a row under another name than icons changes nothing', 0.2, function () { return crooked({ other: { row: { glyph: '🌑' } } }); }, test.limit.quick);
let r2 = null;
test.run('keywords that are no list are never kept as one', 0.2, function () {
  if (!w) return false;
  w.job({ icons: { row: { glyph: '🌒', keywords: 'not a list' } } });
  r2 = w.I.row('🌒');
  return !r2 || Array.isArray(r2.keywords) ? true : false;
}, test.limit.quick);
test.run('removing an icon that is not there changes nothing', 0.2, function () {
  if (!w) return false;
  w.job({ icons: { glyph: '🌓', removed: true } });
  return snap() === was || !!r2 ? true : false;
}, test.limit.quick);
