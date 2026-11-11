'use strict';

// spirit/run/spirit/element/test/joinList.js
// The tests of spirit/element/joinList.js, and of no other module (spec: ./joinList.md). joinList holds all of Join
// (spirit/app/join/element.js mounts it); its steps are join.json's, drawn from the join news on the node's spirit job as the
// jobs family's cache keeps it. The browser file runs in node on a bare window: its container is a stand-in that keeps the
// markup drawn, the jobs cache a stand-in holding the spirit job, and joinSteps the real helper. It is the proof the
// general rules take for its redraw (Andy, goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you
// ruled for deskDetails in Q24?"): a marked row written into the jobs or the contacts cannot change the steps it draws.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/element/test/ -> the run root, three up.
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'joinList.js');
const STEPS = path.join(RUN, 'spirit', 'app', 'join', 'join.json');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// A box that keeps what is drawn into it: the list's host is found by its class, a step's form box finds nothing (no
// form is judged here).
function box() {
  const host = { innerHTML: '', textContent: '', addEventListener: function () {}, contains: function () { return false; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
  const c = { innerHTML: '', host: host, querySelector: function (s) { return s === '.join-list' ? host : null; } };
  return c;
}

function world(join) {
  const w = { watches: 0, released: 0, fns: [] };
  const job = { id: 'spirit', data: { join: join } };
  const win = {
    document: { activeElement: null },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  const jobs = {
    job: function (id) { return id === 'spirit' ? job : null; },
    watch: function (fn) { w.watches += 1; w.fns.push(fn); return function () { w.released += 1; w.fns = w.fns.filter(function (f) { return f !== fn; }); }; },
  };
  w.publish = function (id, j) { w.fns.slice().forEach(function (fn) { fn(id, j); }); };
  win.spirit = {
    element: { spirit: { element: {}, app: {} } },
    data: { job: { data: jobs } },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
    ready: Promise.resolve({
      fs: { loadFile: function () { return Promise.resolve(fs.readFileSync(STEPS, 'utf8')); } },
      relay: { status: function () { return Promise.resolve({ body: { rows: [] } }); } },
    }),
    cacheManager: function () { return Promise.resolve(); },
    // The parts it draws with: joinSteps the real one, run in this window; the forms and the icon are not judged here.
    require: function (p) {
      if (p === 'spirit/element/joinSteps.js') vm.runInContext(fs.readFileSync(path.join(RUN, p), 'utf8'), win, { filename: p });
      return Promise.resolve({});
    },
  };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  w.L = win.spirit.element.spirit.element.joinList;
  return w;
}

// What the tests make, shared by the tests after them.
let steps, w, c, made, first, second, late, lc;
test.run('spirit/element/joinList.js is there', 0.2, function () {
  return (!!SRC) ? true : 'there is no spirit/element/joinList.js';
}, 1000);
test.run('the world: join.json has its steps', 0.2, function () {
  steps = [];
  try { steps = JSON.parse(fs.readFileSync(STEPS, 'utf8')).steps || []; } catch (e) { steps = []; }
  return (steps.length > 1) ? true : 'join.json has ' + steps.length + ' steps';
}, 1000);
test.run('it stands at spirit.element.spirit.element.joinList with create', 0.2, function () {
  // it places itself, and draws the steps the spirit job says
  w = world({ seated: false, contact: false });
  return (!!w.L && typeof w.L.create === 'function') ? true : 'no joinList.create';
}, 1000);
test.run('until the job is read it says it waits for the node', 0.2, function () {
  c = box();
  made = w.L.create(c, {});
  return (/Waiting for this node/.test(c.innerHTML)) ? true : 'drawn: ' + short(c.innerHTML);
}, 1000);
test.run('each step drawn with its name and its icon as join.json gives it', 0.2, async function () {
  await settle();
  first = c.host.innerHTML;
  return (steps.every(function (s) { return first.indexOf(s.icon) !== -1 && first.indexOf(s.name) !== -1; })) ? true : 'drawn: ' + short(first);
}, 1000);
test.run('nothing done: every step marked ⬜', 0.2, function () {
  return (first.indexOf('⬜') !== -1 && first.indexOf('☑️') === -1) ? true : 'marks: ' + short(first);
}, 1000);
test.run('it watches the jobs family\'s cache once', 0.2, function () {
  return (w.watches === 1) ? true : 'watches: ' + w.watches;
}, 1000);
test.run('a new join on the spirit job, taken into spirit.data, redraws the steps', 0.2, async function () {
  // what it watches redraws it
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: false } } });
  await settle();
  second = c.host.innerHTML;
  return (second !== first && second.indexOf('☑️') !== -1) ? true : 'after the join changed: ' + short(second);
}, 1000);
test.run('another job\'s change draws nothing', 0.2, async function () {
  w.publish('spirit.app.other', { id: 'spirit.app.other', data: { join: { seated: false } } });
  await settle();
  return (c.host.innerHTML === second) ? true : 'redrawn for another job: ' + short(c.host.innerHTML);
}, 1000);
test.run('every step done, it says so, with ☑️', 0.2, async function () {
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: true } } });
  await settle();
  return (/☑️ Every step is done\./.test(c.host.innerHTML)) ? true : 'drawn: ' + short(c.host.innerHTML);
}, 1000);
test.run('destroy lets its watch go and empties its container', 0.2, function () {
  // destroy
  made.destroy();
  return (w.released === 1 && c.innerHTML === '') ? true : 'released ' + w.released + ', left ' + short(c.innerHTML);
}, 1000);
test.run('destroyed before the job is read, it keeps no watch and draws nothing', 0.2, async function () {
  late = world({ seated: false });
  lc = box();
  late.L.create(lc, {}).destroy();
  await settle();
  return (late.watches === late.released && lc.host.innerHTML === '') ? true : 'watches ' + late.watches + ', released ' + late.released;
}, 1000);
