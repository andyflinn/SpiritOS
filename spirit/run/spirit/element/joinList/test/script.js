'use strict';

// spirit/run/spirit/element/joinList/test/script.js
// The tests of spirit/element/joinList/script.js, and of no other module (spec: ./script.md). joinList holds all of Join
// (spirit/app/join/element.js mounts it); its steps are join.json's, drawn from the join news on the node's spirit job as the
// jobs family's cache keeps it. The browser file runs in node on a bare window: its container is a stand-in that keeps the
// markup drawn, the jobs cache a stand-in holding the spirit job, and joinSteps the real helper. It is the proof the
// general rules take for its redraw (Andy, goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you
// ruled for deskDetails in Q24?"): a marked row written into the jobs or the contacts cannot change the steps it draws.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/element/test/ -> the run root, three up.
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/joinList/script.js';
const FILE = path.join(RUN, SUBJECT);
const STEPS = path.join(RUN, 'spirit', 'app', 'join', 'join.json');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';

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
    required: { spirit: { element: {}, app: {}, data: { job: { data: jobs } } } },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
    readyPromise: Promise.resolve({
      fs: { loadFile: function () { return Promise.resolve(fs.readFileSync(STEPS, 'utf8')); } },
      relay: { status: function () { return Promise.resolve({ body: { rows: [] } }); } },
    }),
    // The parts it draws with: joinSteps the real one, run in this window; the forms and the icon are not judged here, nor
    // the job branch's api.js, whose data.js's reads stand above as spirit.required.spirit.data.job.data.
    requireScript: function () { return Promise.resolve({}); },
  };
  // joinSteps, the real one, and the subject: run in this window by their paths, through the page stand-in (goal/G49.6).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/element/joinSteps/script.js', SUBJECT] });
  if (SRC) win.spirit.requireScript(SUBJECT);
  w.win = win;
  w.L = win.spirit.required.spirit.element.joinList;
  return w;
}

// What the tests make, shared by the tests after them.
let steps, w, c, made, first, second, late, lc;
test.run('spirit/element/joinList/script.js is there', 0.2, function () {
  return (!!SRC) ? true : false;
}, test.limit.quick);
test.run('join.json has its steps', 0.2, function () {
  steps = [];
  try { steps = JSON.parse(fs.readFileSync(STEPS, 'utf8')).steps || []; } catch (e) { steps = []; }
  return (steps.length > 1) ? true : false;
}, test.limit.quick);
test.run('it stands at spirit.required.spirit.element.joinList with create', 0.2, function () {
  // it places itself, and draws the steps the spirit job says
  w = world({ seated: false, contact: false });
  return (!!w.L && typeof w.L.create === 'function') ? true : false;
}, test.limit.quick);
test.run('until the job is read it says it waits for the node', 0.2, function () {
  c = box();
  made = w.L.create(c, {});
  return (/Waiting for this node/.test(c.innerHTML)) ? true : false;
}, test.limit.quick);
test.run('each step is drawn with its name and its icon as join.json gives it', 0.2, async function () {
  await settle();
  first = c.host.innerHTML;
  return (steps.every(function (s) { return first.indexOf(s.icon) !== -1 && first.indexOf(s.name) !== -1; })) ? true : false;
}, test.limit.quick);
test.run('with nothing done, every step is marked ⬜', 0.2, function () {
  return (first.indexOf('⬜') !== -1 && first.indexOf('☑️') === -1) ? true : false;
}, test.limit.quick);
test.run('it watches the jobs branch\'s cache once', 0.2, function () {
  return (w.watches === 1) ? true : false;
}, test.limit.quick);
test.run('a new join on the spirit job, taken into spirit.required.spirit.data, redraws the steps', 0.2, async function () {
  // what it watches redraws it
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: false } } });
  await settle();
  second = c.host.innerHTML;
  return (second !== first && second.indexOf('☑️') !== -1) ? true : false;
}, test.limit.quick);
test.run('another job\'s change draws nothing', 0.2, async function () {
  w.publish('spirit.app.other', { id: 'spirit.app.other', data: { join: { seated: false } } });
  await settle();
  return (c.host.innerHTML === second) ? true : false;
}, test.limit.quick);
test.run('every step done, it says so, with ☑️', 0.2, async function () {
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: true } } });
  await settle();
  return (/☑️ Every step is done\./.test(c.host.innerHTML)) ? true : false;
}, test.limit.quick);
test.run('destroy lets its watch go and empties its container', 0.2, function () {
  // destroy
  made.destroy();
  return (w.released === 1 && c.innerHTML === '') ? true : false;
}, test.limit.quick);
test.run('destroyed before the job is read, it keeps no watch and draws nothing', 0.2, async function () {
  late = world({ seated: false });
  lc = box();
  late.L.create(lc, {}).destroy();
  await settle();
  return (late.watches === late.released && lc.host.innerHTML === '') ? true : false;
}, test.limit.quick);
