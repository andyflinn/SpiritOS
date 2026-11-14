'use strict';

// spirit/run/spirit/element/search/suite/test/rowElement.js
// The tests of spirit/element/search/suite/rowElement.js, and of no other module (spec: ./rowElement.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// A suite row of testicle's suite table, with its 🏃‍♂️ (goal/G47.1, the UI and run cycles). The browser file runs in node on
// a bare window, as the other rows' tests do (spirit/element/search/job/test/rowElement.js): the shared row element is a
// stand-in that keeps the spec it is handed, the busy button a stand-in that keeps what it was made with, testicle's
// interface a recorder of the runs asked.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

let required, specs, indexes, buttons, runs, R, E, s, paint, el, cell, refuseApi = false, unhandled = [];
const NO_R = 'no row element placed: the world failed';
const NO_S = 'no row was made';
const ROW = { key: 'spirit/zz/alpha.js|spirit/zz/test/alpha.js', script: 'spirit/zz/alpha.js', suite: 'spirit/zz/test/alpha.js', status: 'needs running' };
function aCell() {
  const heard = {};
  return { innerHTML: 'old', heard: heard, addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); } };
}
process.on('unhandledRejection', function (e) { unhandled.push(String(e && e.message || e)); });

test.run('the world: the row runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/suite/rowElement.js is not there';
  required = []; specs = []; indexes = []; buttons = []; runs = [];
  global.window = { spirit: { escapeHtml: function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  const own = global.window.spirit.require;
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (p === 'spirit/app/testicle/api.js' && refuseApi) return Promise.reject(new Error('no testicle on this node'));
    return own.apply(this, arguments);
  };
  global.window.spirit.testicle = { run: function (a) { runs.push(a); return Promise.resolve({ ok: true }); } };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = global.window.spirit.element.spirit.element;
  E.rowElement = { index: function (sub) { indexes.push(sub); return { id: indexes.length }; },
    create: function (spec) { specs.push(spec); return { spec: spec, mount: function () {} }; } };
  E.busyButton = { create: function (c, o) { const b = { cell: c, o: o }; buttons.push(b); return b; } };
  R = E.search && E.search.suite && E.search.suite.rowElement;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.element.spirit.element.search.suite.rowElement, with a create', 0.2, function () {
  if (!required) return 'the row never ran: the world failed';
  return (R && typeof R.create === 'function') || 'its place: ' + short(R && Object.keys(R));
}, test.limit.quick);
test.run('it loads what it draws with: the shared row element, the busy button, testicle\'s interface', 0.2, function () {
  if (!required) return 'the row never ran: the world failed';
  return ['spirit/element/rowElement.js', 'spirit/element/busyButton.js', 'spirit/app/testicle/api.js'].every(function (p) { return required.indexOf(p) !== -1; }) || 'required: ' + short(required);
}, test.limit.quick);
test.run('create makes a row of kind suite, keyed by the row\'s key, with no actions', 0.2, function () {
  if (!R || typeof R.create !== 'function') return NO_R;
  el = R.create(ROW);
  s = specs[0];
  paint = function (name, v) { const f = s.fields.filter(function (x) { return x.name === name; })[0]; return f ? f.paint(v) : null; };
  return (s && s.kind === 'suite' && s.key === ROW.key && Array.isArray(s.actions) && !s.actions.length) || 'spec: ' + short(s && { kind: s.kind, key: s.key, actions: s.actions });
}, test.limit.quick);
// the run cycle: "The 🏃‍♂️ column is on every row of the script detail tab, the first column"
test.run('its fields: the 🏃‍♂️ first, then the suite\'s filename, then its status', 0.2, function () {
  if (!s) return NO_S;
  const names = s.fields.map(function (f) { return f.name; });
  return JSON.stringify(names) === JSON.stringify(['run', 'suite', 'status']) || 'fields: ' + short(names);
}, test.limit.quick);
test.run('the suite cell is the suite, escaped', 0.2, function () {
  if (!s) return NO_S;
  return paint('suite', { suite: 'spirit/zz/test/<a>.js' }) === 'spirit/zz/test/&lt;a&gt;.js' || 'drawn: ' + short(paint('suite', { suite: 'spirit/zz/test/<a>.js' }));
}, test.limit.quick);
// the box: "the filename AND its status \"needs running\", which will be shown as red in the UI"; "green" shown green
test.run('the status "needs running" and "still red" are shown red, "green" green', 0.2, function () {
  if (!s) return NO_S;
  const red = [paint('status', { status: 'needs running' }), paint('status', { status: 'still red' })];
  const green = paint('status', { status: 'green' });
  return (red.every(function (h) { return /color:#c00/.test(h); }) && /color:#080/.test(green) && /needs running/.test(red[0]) && /still red/.test(red[1]) && />green</.test(green)) || 'drawn: ' + short(red.concat([green]));
}, test.limit.quick);
test.run('no status, nothing drawn', 0.2, function () {
  if (!s) return NO_S;
  return paint('status', { status: '' }) === '' || 'drawn: ' + short(paint('status', { status: '' }));
}, test.limit.quick);

// "each row's button running its own suite", "The button is the busy button exactly as it is"
test.run('mounted, its 🏃‍♂️ cell holds a busy button, labelled 🏃‍♂️', 0.2, async function () {
  if (!el || typeof el.mount !== 'function') return NO_S;
  cell = aCell();
  el.mount({ run: cell });
  await settle();
  const b = buttons[0];
  return (buttons.length === 1 && b.cell === cell && b.o.label === '🏃‍♂️' && typeof b.o.run === 'function' && cell.innerHTML === '') || 'buttons: ' + short(buttons.map(function (x) { return { label: x.o.label, same: x.cell === cell }; }));
}, test.limit.quick);
test.run('a press runs the row\'s own suite for its own script: testicle.run { script, suite }', 0.2, async function () {
  if (!buttons || !buttons.length) return 'no button was made';
  await buttons[0].o.run();
  return (runs.length === 1 && runs[0].script === ROW.script && runs[0].suite === ROW.suite) || 'runs: ' + short(runs);
}, test.limit.quick);
test.run('a press on the button is its own, never the row\'s pick', 0.2, function () {
  if (!cell) return NO_S;
  let stopped = false;
  const e = { target: { closest: function (sel) { return sel === 'button' ? {} : null; } }, stopPropagation: function () { stopped = true; } };
  (cell.heard.click || []).forEach(function (fn) { fn(e); });
  return stopped || 'the click went on to the row';
}, test.limit.quick);
test.run('drawn again, the row makes its button anew in the new cell, and only one', 0.2, async function () {
  if (!el) return NO_S;
  const before = buttons.length;
  const c1 = aCell(), c2 = aCell();
  el.mount({ run: c1 });
  el.mount({ run: c2 });
  await settle();
  const made = buttons.slice(before);
  return (made.length === 1 && made[0].cell === c2) || made.length + ' buttons made for two draws';
}, test.limit.quick);
// "A row of every suite, no script ... nothing to run it for, no button."
test.run('a row with no script (every suite) draws no button', 0.2, async function () {
  if (!R) return NO_R;
  const before = buttons.length;
  const c = aCell();
  R.create({ key: 'spirit/zz/test/alpha.js', suite: 'spirit/zz/test/alpha.js', script: '', status: 'green' }).mount({ run: c });
  await settle();
  return (buttons.length === before && c.innerHTML === '') || 'buttons made ' + (buttons.length - before) + ', cell ' + short(c.innerHTML);
}, test.limit.quick);
// "A node with no testicle refuses its interface: nothing to run the suite with, so no button."
test.run('on a node with no testicle the row draws no button, and the refusal is never left unhandled', 0.2, async function () {
  if (!R) return NO_R;
  refuseApi = true;
  const before = buttons.length;
  const c = aCell();
  R.create(ROW).mount({ run: c });
  await settle();
  refuseApi = false;
  return (buttons.length === before && !unhandled.length) || 'buttons made ' + (buttons.length - before) + ', unhandled ' + short(unhandled);
}, test.limit.quick);
