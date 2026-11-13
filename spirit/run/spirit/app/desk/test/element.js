'use strict';

// spirit/run/spirit/app/desk/test/element.js
// The tests of spirit/app/desk/element.js, and of no other module (spec: ./element.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// The desk on a page (goal/G43.27, requirement 23): the page half of ./desk.js, as spirit/app/agent/element.js is the
// agent's. The browser file runs in node on a window of its own; the Desk page it draws (./element/desk/desk.js, tested in
// its own folder) is a stand-in placed by the real installSpiritElement as the page's own would be, keeping what it was
// handed. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const DESK = 'spirit/app/desk/element/desk/desk.js';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.element); };

const W = { required: [], made: [] };
const NO_WORLD = 'no page: the world failed';
const NOT_PLACED = 'no desk element: it was not placed';

test.run('the world: the file runs on a window of its own, the Desk page a stand-in placed as the page places it', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/desk/element.js is not there';
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  const helper = require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'));
  global.window.spirit.require = function (p) {
    W.required.push(String(p));
    // The Desk page, as its own file places itself: by the one helper, at spirit.element.<its path>.
    if (p === DESK) helper(global.window.spirit, DESK, { create: function (container, opts) { const m = { container: container, opts: opts, destroy: function () { m.destroyed = true; } }; W.made.push(m); return m; } });
    return Promise.resolve(true);
  };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before it runs, the page has no desk element', 0.2, function () {
  if (!W.up) return NO_WORLD;
  return at('spirit.app.desk.element') === undefined || 'placed already: ' + short(Object.keys(at('spirit.app.desk.element') || {}));
}, test.limit.quick);
test.run('it places spirit.element.spirit.app.desk.element, with create', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  load(FILE);
  await settle();
  W.E = at('spirit.app.desk.element');
  return (!!W.E && typeof W.E.create === 'function') || 'placed ' + short(W.E && Object.keys(W.E));
}, test.limit.quick);
// "It draws the Desk page ... which it requires itself."
test.run('it asks for the Desk page itself, spirit/app/desk/element/desk/desk.js', 0.2, function () {
  if (!W.up) return NO_WORLD;
  return W.required.indexOf(DESK) !== -1 || 'required ' + short(W.required);
}, test.limit.quick);
test.run('and the Desk page keeps its own place beside it, spirit.element.spirit.app.desk.element.desk.desk', 0.2, function () {
  if (!W.E) return NOT_PLACED;
  const d = at('spirit.app.desk.element.desk.desk');
  return (!!d && typeof d.create === 'function') || 'the Desk page is ' + short(d);
}, test.limit.quick);
test.run('create(container, { title, open }) draws the Desk page in that container, handing it the same title and open', 0.2, function () {
  if (!W.E) return NOT_PLACED;
  const c = { id: 'box' };
  const open = function () {};
  const opts = { title: 'Desk', open: open };
  W.answer = W.E.create(c, opts);
  const m = W.made[W.made.length - 1];
  return (!!m && m.container === c && m.opts.title === 'Desk' && m.opts.open === open) || 'the Desk page was handed ' + short(m && { container: m.container, opts: Object.keys(m.opts || {}) });
}, test.limit.quick);
test.run('it answers what the Desk page answers, its destroy with it', 0.2, function () {
  if (!W.answer) return 'create answered nothing';
  const m = W.made[W.made.length - 1];
  W.answer.destroy();
  return (W.answer === m && m.destroyed === true) || 'answered ' + short(W.answer);
}, test.limit.quick);
test.run('handed no options, the Desk page is handed {}', 0.2, function () {
  if (!W.E) return NOT_PLACED;
  W.E.create({ id: 'bare' });
  const m = W.made[W.made.length - 1];
  return (!!m && m.opts && typeof m.opts === 'object' && Object.keys(m.opts).length === 0) || 'handed ' + short(m && m.opts);
}, test.limit.quick);
