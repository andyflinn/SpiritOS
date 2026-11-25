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
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'element.js');
const DESK = 'spirit/app/desk/element/desk/desk.js';

function load(file) { PAGE_LOAD.runAsPage(file); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.required); };

const W = { required: [], made: [] };

test.run('a window of its own is made for the file to run on, with a stand-in Desk page placed as the page places it', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  const helper = S.requireScript('spirit/element/installSpiritElement/script.js');
  global.window.spirit.requireScript = function (p) {
    W.required.push(String(p));
    // THE DESK PAGE IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers"; Andy:
    // "spirit.requireScript must allways return either an object or a function... or fail/throw"), and stands at its place as the
    // loader puts it there; desk's api.js an empty object.
    if (p === DESK) { if (!W.page) { W.page = { create: function (container, opts) { const m = { container: container, opts: opts, destroy: function () { m.destroyed = true; } }; W.made.push(m); return m; } }; helper(global.window.spirit, DESK, W.page); } return Promise.resolve(W.page); }
    return Promise.resolve({});
  };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before the file runs, the page has no desk element', 0.2, function () {
  if (!W.up) return false;
  return at('spirit.app.desk.element') === undefined || false;
}, test.limit.quick);
test.run('the file places the desk element on spirit.required, with a create', 0.2, async function () {
  if (!W.up) return false;
  load(FILE);
  await settle();
  W.E = at('spirit.app.desk.element');
  return (!!W.E && typeof W.E.create === 'function') || false;
}, test.limit.quick);
// "It draws the Desk page ... which it requires itself."
test.run('the file asks for the Desk page itself, spirit/app/desk/element/desk/desk.js', 0.2, function () {
  if (!W.up) return false;
  return W.required.indexOf(DESK) !== -1 || false;
}, test.limit.quick);
test.run('the Desk page keeps its own place on spirit.required beside the desk element', 0.2, function () {
  if (!W.E) return false;
  const d = at('spirit.app.desk.element.desk.desk');
  return (!!d && typeof d.create === 'function') || false;
}, test.limit.quick);
test.run('create, handed a container with a title and an open, draws the Desk page in that container, handing it the same title and open', 0.2, function () {
  if (!W.E) return false;
  const c = { id: 'box' };
  const open = function () {};
  const opts = { title: 'Desk', open: open };
  W.answer = W.E.create(c, opts);
  const m = W.made[W.made.length - 1];
  return (!!m && m.container === c && m.opts.title === 'Desk' && m.opts.open === open) || false;
}, test.limit.quick);
test.run('create answers what the Desk page answers, its destroy with it', 0.2, function () {
  if (!W.answer) return false;
  const m = W.made[W.made.length - 1];
  W.answer.destroy();
  return (W.answer === m && m.destroyed === true) || false;
}, test.limit.quick);
test.run('when create is handed no options, the Desk page is handed an empty object', 0.2, function () {
  if (!W.E) return false;
  W.E.create({ id: 'bare' });
  const m = W.made[W.made.length - 1];
  return (!!m && m.opts && typeof m.opts === 'object' && Object.keys(m.opts).length === 0) || false;
}, test.limit.quick);
