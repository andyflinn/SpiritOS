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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
    data: { jobs: { data: jobs } },
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

test.startTest('joinList.js: all of Join, its steps drawn from the spirit job');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/element/joinList.js is there', 'there is no spirit/element/joinList.js');
  if (!SRC) return;
  let steps = [];
  try { steps = JSON.parse(fs.readFileSync(STEPS, 'utf8')).steps || []; } catch (e) { steps = []; }
  ok(steps.length > 1, 'the world: join.json has its steps', 'join.json has ' + steps.length + ' steps');

  test.subHeading('it places itself, and draws the steps the spirit job says');
  const w = world({ seated: false, contact: false });
  ok(!!w.L && typeof w.L.create === 'function', 'it stands at spirit.element.spirit.element.joinList with create', 'no joinList.create');
  if (!w.L) return;
  const c = box();
  const made = w.L.create(c, {});
  ok(/Waiting for this node/.test(c.innerHTML), 'until the job is read it says it waits for the node', 'drawn: ' + short(c.innerHTML));
  await settle();
  const first = c.host.innerHTML;
  ok(steps.every(function (s) { return first.indexOf(s.icon) !== -1 && first.indexOf(s.name) !== -1; }), 'each step drawn with its name and its icon as join.json gives it', 'drawn: ' + short(first));
  ok(first.indexOf('⬜') !== -1 && first.indexOf('☑️') === -1, 'nothing done: every step marked ⬜', 'marks: ' + short(first));
  ok(w.watches === 1, 'it watches the jobs family\'s cache once', 'watches: ' + w.watches);

  test.subHeading('what it watches redraws it');
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: false } } });
  await settle();
  const second = c.host.innerHTML;
  ok(second !== first && second.indexOf('☑️') !== -1, 'a new join on the spirit job, taken into spirit.data, redraws the steps', 'after the join changed: ' + short(second));
  w.publish('spirit.app.other', { id: 'spirit.app.other', data: { join: { seated: false } } });
  await settle();
  ok(c.host.innerHTML === second, 'another job\'s change draws nothing', 'redrawn for another job: ' + short(c.host.innerHTML));
  w.publish('spirit', { id: 'spirit', data: { join: { seated: true, contact: true } } });
  await settle();
  ok(/☑️ Every step is done\./.test(c.host.innerHTML), 'every step done, it says so, with ☑️', 'drawn: ' + short(c.host.innerHTML));

  test.subHeading('destroy');
  made.destroy();
  ok(w.released === 1 && c.innerHTML === '', 'destroy lets its watch go and empties its container', 'released ' + w.released + ', left ' + short(c.innerHTML));
  const late = world({ seated: false });
  const lc = box();
  late.L.create(lc, {}).destroy();
  await settle();
  ok(late.watches === late.released && lc.host.innerHTML === '', 'destroyed before the job is read, it keeps no watch and draws nothing', 'watches ' + late.watches + ', released ' + late.released);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
