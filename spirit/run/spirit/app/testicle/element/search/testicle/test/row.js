'use strict';

// spirit/run/spirit/app/testicle/element/search/testicle/test/row.js
// The tests of spirit/app/testicle/element/search/testicle/row.js, and of no other module (spec: ./row.md). Its own test,
// owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// A test row of testicle's test table (goal/G47.1, the search cycle). The browser file runs in node on a bare window, as
// the other rows' tests do (spirit/element/search/job/test/row.js): the shared row element is a stand-in that keeps
// the spec it is handed, so what is judged is what this file says a test row is.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
const SPIRIT = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'row.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let required, specs, indexes, R, s, paint;
const ROW = { key: 'spirit/zz/alpha.js|spirit/zz/test/alpha.js|alpha answers <every> question, in full|1700000000000', script: 'spirit/zz/alpha.js',
  suite: 'spirit/zz/test/alpha.js', test: 'alpha answers <every> question, in full', verified: true, severity: 0, current: true };

test.run('the testicle row element runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = []; specs = []; indexes = [];
  global.window = { spirit: { escapeHtml: function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, element: {} } };
  SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the shared row element a stand-in; testicle's words the real file, run as the page's loader runs it, its answer
  // handed as the require's (goal/G47.1, spirit/app/testicle/words.js).
  const STANDS = {
    'spirit/element/row.js': { index: function (sub) { indexes.push(sub); return { id: indexes.length }; }, create: function (spec) { specs.push(spec); return { spec: spec }; } },
    'spirit/app/testicle/words.js': PAGE_LOAD.runAsPage(path.join(RUN, 'spirit', 'app', 'testicle', 'words.js')),
  };
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    return Object.prototype.hasOwnProperty.call(STANDS, p) ? Promise.resolve(STANDS[p]) : Promise.reject(new Error('no stand-in for ' + p));
  };
  // The row's own answer, what the loader places at its place.
  const answer = PAGE_LOAD.runAsPage(FILE);
  await settle();
  const TE = (((global.window.spirit.required.spirit || {}).app || {}).testicle || {}).element || {};
  R = TE.search && TE.search.testicle && TE.search.testicle.row === answer ? answer : null;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.app.testicle.element.search.testicle.row, with a create', 0.2, function () {
  if (!required) return false;
  return (R && typeof R.create === 'function') || false;
}, test.limit.quick);
test.run('it loads what it draws with: the shared row element', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/element/row.js') !== -1 || false;
}, test.limit.quick);
test.run('create makes a row of kind testicle, keyed by the row\'s full key, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  R.create(ROW);
  s = specs[0];
  paint = function (name, v) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(v) : null; };
  return (s && s.kind === 'testicle' && s.key === ROW.key && s.row === ROW && Array.isArray(s.actions) && !s.actions.length) || false;
}, test.limit.quick);
test.run('rows share one index', 0.2, function () {
  if (!s) return false;
  R.create(Object.assign({}, ROW, { key: 'another' }));
  return (indexes.length === 1 && specs[1].index === specs[0].index) || false;
}, test.limit.quick);
// the box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second;
// the title third; then the script name (no path), then the suite name (no path)"
test.run('its columns are, in order, the result, the severity, the title, the script and the suite', 0.2, function () {
  if (!s) return false;
  const names = s.fields.map(function (f) { return f.name; });
  return JSON.stringify(names) === JSON.stringify(['verified', 'severity', 'test', 'script', 'suite']) || false;
}, test.limit.quick);
test.run('the result is an icon: ✅ for a success, ❌ for a failure', 0.2, function () {
  if (!s) return false;
  const got = [paint('verified', { verified: true }), paint('verified', { verified: false })];
  return JSON.stringify(got) === JSON.stringify(['✅', '❌']) || false;
}, test.limit.quick);
// the box: "The test row also shows its severity, two decimal places, even for 0 and 1 (0.00, 1.00)"
test.run('the severity has two decimal places, even for 0 and 1', 0.2, function () {
  if (!s) return false;
  const got = [0, 1, 0.2, 0.555].map(function (v) { return paint('severity', { severity: v }); });
  return JSON.stringify(got.slice(0, 3)) === JSON.stringify(['0.00', '1.00', '0.20']) && /^0\.5[56]$/.test(got[3]) || false;
}, test.limit.quick);
// the box: "The test title is shown in full."
test.run('the title is shown in full, escaped', 0.2, function () {
  if (!s) return false;
  const t = paint('test', ROW);
  return t === 'alpha answers &lt;every&gt; question, in full' || false;
}, test.limit.quick);
// the box: "The script column and the suite column show the file name only, no path; hovering over a script or a suite
// shows its full name as a tooltip"
test.run('the script shows its file name only, its full name as a tooltip', 0.2, function () {
  if (!s) return false;
  const h = paint('script', ROW);
  return (/title="spirit\/zz\/alpha\.js"/.test(h) && />alpha\.js</.test(h) && h.replace(/title="[^"]*"/, '').indexOf('spirit/zz') === -1) || false;
}, test.limit.quick);
test.run('the suite shows its file name only, its full name as a tooltip', 0.2, function () {
  if (!s) return false;
  const h = paint('suite', ROW);
  return (/title="spirit\/zz\/test\/alpha\.js"/.test(h) && />alpha\.js</.test(h) && h.replace(/title="[^"]*"/, '').indexOf('test/') === -1) || false;
}, test.limit.quick);
