'use strict';

// spirit/run/spirit/app/testicle/element/search/suite/test/row.js
// The tests of spirit/app/testicle/element/search/suite/row.js, and of no other module (spec: ./row.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// A suite row of testicle's suite table, with its 🏃‍♂️ (goal/G47.1, the UI and run cycles). The browser file runs in node on
// a bare window, as the other rows' tests do (spirit/element/search/job/test/row.js): the shared row element is a
// stand-in that keeps the spec it is handed, the busy button a stand-in that keeps what it was made with, testicle's
// interface a recorder of the runs asked.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'row.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let required, specs, indexes, buttons, runs, R, E, s, paint, el, cell, refuseApi = false, unhandled = [];
const ROW = { key: 'spirit/zz/alpha.js|spirit/zz/test/alpha.js', script: 'spirit/zz/alpha.js', suite: 'spirit/zz/test/alpha.js', status: 'needs running' };
function aCell() {
  const heard = {};
  return { innerHTML: 'old', heard: heard, addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); } };
}
process.on('unhandledRejection', function () { unhandled.push(true); });

test.run('the row runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = []; specs = []; indexes = []; buttons = []; runs = [];
  global.window = { spirit: { escapeHtml: function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, element: {} } };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the shared row element, the busy button and testicle's interface, the three it requires.
  const STANDS = {
    'spirit/element/row.js': { index: function (sub) { indexes.push(sub); return { id: indexes.length }; },
      create: function (spec) { specs.push(spec); return { spec: spec, mount: function () {} }; } },
    'spirit/element/busyButton.js': { create: function (c, o) { const b = { cell: c, o: o }; buttons.push(b); return b; } },
    'spirit/app/testicle/api.js': { run: function (a) { runs.push(a); return Promise.resolve({ ok: true }); } },
  };
  E = { row: STANDS['spirit/element/row.js'], busyButton: STANDS['spirit/element/busyButton.js'] };
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    if (p === 'spirit/app/testicle/api.js' && refuseApi) return Promise.reject(new Error('no testicle on this node'));
    return Object.prototype.hasOwnProperty.call(STANDS, p) ? Promise.resolve(STANDS[p]) : Promise.reject(new Error('no stand-in for ' + p));
  };
  // The row's own answer, what the loader places at its place.
  const answer = PAGE_LOAD.runAsPage(FILE);
  await settle();
  const TE = (((global.window.spirit.required.spirit || {}).app || {}).testicle || {}).element || {};
  R = TE.search && TE.search.suite && TE.search.suite.row === answer ? answer : null;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.app.testicle.element.search.suite.row, with a create', 0.2, function () {
  if (!required) return false;
  return (R && typeof R.create === 'function') || false;
}, test.limit.quick);
test.run('it loads what it draws with, the shared row element, the busy button and testicle\'s interface', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/row.js', 'spirit/element/busyButton.js', 'spirit/app/testicle/api.js'].every(function (p) { return required.indexOf(p) !== -1; }) || false;
}, test.limit.quick);
test.run('create makes a row of kind suite, keyed by the row\'s key, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return false;
  el = R.create(ROW);
  s = specs[0];
  paint = function (name, v) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(v) : null; };
  return (s && s.kind === 'suite' && s.key === ROW.key && Array.isArray(s.actions) && !s.actions.length) || false;
}, test.limit.quick);
// the run cycle: "The 🏃‍♂️ column is on every row of the script detail tab, the first column"
test.run('its fields are the run button first, then the suite\'s filename, then its status', 0.2, function () {
  if (!s) return false;
  const names = s.fields.map(function (f) { return f.name; });
  return JSON.stringify(names) === JSON.stringify(['run', 'suite', 'status']) || false;
}, test.limit.quick);
test.run('the suite cell is the suite, escaped', 0.2, function () {
  if (!s) return false;
  return paint('suite', { suite: 'spirit/zz/test/<a>.js' }) === 'spirit/zz/test/&lt;a&gt;.js' || false;
}, test.limit.quick);
// the box: "the filename AND its status \"needs running\", which will be shown as red in the UI"; "green" shown green
test.run('the statuses "needs running" and "still red" are shown red, and "green" is shown green', 0.2, function () {
  if (!s) return false;
  const red = [paint('status', { status: 'needs running' }), paint('status', { status: 'still red' })];
  const green = paint('status', { status: 'green' });
  return (red.every(function (h) { return /color:#c00/.test(h); }) && /color:#080/.test(green) && /needs running/.test(red[0]) && /still red/.test(red[1]) && />green</.test(green)) || false;
}, test.limit.quick);
test.run('a row with no status draws nothing in the status cell', 0.2, function () {
  if (!s) return false;
  return paint('status', { status: '' }) === '' || false;
}, test.limit.quick);

// "each row's button running its own suite", "The button is the busy button exactly as it is"
test.run('once mounted, its first cell holds a busy button labelled with the runner', 0.2, async function () {
  if (!el || typeof el.mount !== 'function') return false;
  cell = aCell();
  el.mount({ run: cell });
  await settle();
  const b = buttons[0];
  return (buttons.length === 1 && b.cell === cell && b.o.label === '🏃‍♂️' && typeof b.o.run === 'function' && cell.innerHTML === '') || false;
}, test.limit.quick);
test.run('a press runs the row\'s own suite for its own script through testicle.run, naming the script and the suite', 0.2, async function () {
  if (!buttons || !buttons.length) return false;
  await buttons[0].o.run();
  return (runs.length === 1 && runs[0].script === ROW.script && runs[0].suite === ROW.suite) || false;
}, test.limit.quick);
test.run('a press on the button is its own, never the row\'s pick', 0.2, function () {
  if (!cell) return false;
  let stopped = false;
  const e = { target: { closest: function (sel) { return sel === 'button' ? {} : null; } }, stopPropagation: function () { stopped = true; } };
  (cell.heard.click || []).forEach(function (fn) { fn(e); });
  return stopped || false;
}, test.limit.quick);
test.run('drawn again, the row makes its button anew in the new cell, and makes only one', 0.2, async function () {
  if (!el) return false;
  const before = buttons.length;
  const c1 = aCell(), c2 = aCell();
  el.mount({ run: c1 });
  el.mount({ run: c2 });
  await settle();
  const made = buttons.slice(before);
  return (made.length === 1 && made[0].cell === c2) || false;
}, test.limit.quick);
// "A row of every suite, no script ... nothing to run it for, no button."
test.run('a row with no script (every suite) draws no button', 0.2, async function () {
  if (!R) return false;
  const before = buttons.length;
  const c = aCell();
  R.create({ key: 'spirit/zz/test/alpha.js', suite: 'spirit/zz/test/alpha.js', script: '', status: 'green' }).mount({ run: c });
  await settle();
  return (buttons.length === before && c.innerHTML === '') || false;
}, test.limit.quick);
// "A node with no testicle refuses its interface: nothing to run the suite with, so no button."
test.run('on a node with no testicle the row draws no button, and the refusal is never left unhandled', 0.2, async function () {
  if (!R) return false;
  refuseApi = true;
  const before = buttons.length;
  const c = aCell();
  R.create(ROW).mount({ run: c });
  await settle();
  refuseApi = false;
  return (buttons.length === before && !unhandled.length) || false;
}, test.limit.quick);
