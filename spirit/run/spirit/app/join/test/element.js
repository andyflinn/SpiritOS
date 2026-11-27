'use strict';

// spirit/run/spirit/app/join/test/element.js
// The tests of spirit/app/join/element.js, and of no other module (spec: ./join.md; goal/G43.26). Since G43.26 the app is a
// wrapper mounted the new shell's way: all of Join is joinList (spirit/element/joinList/script.js, tested in
// spirit/element/joinList/test/script.js). The browser file runs in node on a BARE window (rule/26): joinList is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/join/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');
const KEY = /^[A-Z_]+$/;

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function world(o) {
  const opt = o || {};
  const w = { required: [], made: [], destroyed: 0 };
  const els = {};
  const joinList = { create: function (host, x) { const m = { host: host, opts: x, destroy: function () { w.destroyed += 1; } }; w.made.push(m); return m; } };
  const win = { setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} } };
  win.window = win;
  vm.createContext(win);
  // goal/G43.32: a page's spirit (spirit/test/headLessChrome.js pageSpirit), so join.js is placed at
  // spirit.app.join.element (goal/G49.23: on the spirit object itself); joinList is what its require answers.
  win.spirit = { element: els, app: {},
    requireScript: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error('not-found ' + p));
      // JOINLIST IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
      // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
      // fail/throw"); any other path an empty object.
      const put = function () { return p === 'spirit/element/joinList/script.js' ? joinList : {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit);
  if (SRC) PAGE_LOAD.runAsPage(FILE, win, SRC);
  w.J = (win.spirit.app.join || {}).element;
  return w;
}
function container() { return { innerHTML: '<p>left over</p>', textContent: '' }; }

// join.js: the Join app, a wrapper of joinList. One test.run per test (goal/G47.2). What the tests made, for the tests after them.
const W = {};

test.run('spirit/app/join/element.js is there', 0.2, function () {
  return !!SRC || false;
}, test.limit.quick);

// join.json names every icon as a glyph (goal/G41.1)
const MANIFEST = function () { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'join.json'), 'utf8')); } catch (e) { return null; } };
test.run('join.json has its steps', 0.2, function () {
  const steps = (MANIFEST() || {}).steps || [];
  return steps.length > 0 || false;
}, test.limit.quick);
test.run('every step names its icon as the glyph itself', 0.2, function () {
  const steps = (MANIFEST() || {}).steps || [];
  const keyed = steps.filter(function (s) { return !s.icon || KEY.test(s.icon); });
  return !keyed.length || false;
}, test.limit.quick);
test.run('the app\'s own icon, identity.icon, is a glyph too', 0.2, function () {
  const manifest = MANIFEST();
  const own = manifest && manifest.identity && manifest.identity.icon;
  return !!own && !KEY.test(own) ? true : false;
}, test.limit.quick);

// mounted the new shell's way, a wrapper that loads joinList and nothing of its own
test.run('element.js sets spirit.app.join.element to an object with create', 0.2, function () {
  if (!SRC) return false;
  W.w = world();
  return !!W.w.J && typeof W.w.J.create === 'function' ? true : false;
}, test.limit.quick);
test.run('element.js does not use spirit.shell.activateApp, the old shell\'s way', 0.2, function () {
  return !(/\bactivateApp\b|\bspirit\.shell\b/).test(CODE) || false;
}, test.limit.quick);
test.run('element.js requires spirit/element/joinList/script.js, and only that', 0.2, function () {
  if (!W.w || !W.w.J) return false;
  return JSON.stringify(W.w.required) === '["spirit/element/joinList/script.js"]' || false;
}, test.limit.quick);
test.run('element.js names no icon table', 0.2, function () {
  return !(/iconIndex|\bICON\b/).test(CODE) || false;
}, test.limit.quick);

// create(container): joinList made in the container
test.run('create answers an object with destroy', 0.2, function () {
  if (!W.w || !W.w.J) return false;
  W.box = container();
  W.m = W.w.J.create(W.box, {});
  return !!W.m && typeof W.m.destroy === 'function' ? true : false;
}, test.limit.quick);
test.run('create empties its container', 0.2, function () {
  if (!W.box) return false;
  return W.box.innerHTML === '' || false;
}, test.limit.quick);
test.run('create makes joinList in its container', 0.2, async function () {
  if (!W.box) return false;
  await settle();
  return W.w.made.length === 1 && W.w.made[0].host === W.box ? true : false;
}, test.limit.quick);

// destroy
test.run('destroy destroys joinList and empties its container', 0.2, function () {
  if (!W.m || typeof W.m.destroy !== 'function') return false;
  W.m.destroy();
  return W.w.destroyed === 1 && W.box.innerHTML === '' ? true : false;
}, test.limit.quick);
test.run('when destroyed before joinList loads, nothing is made', 0.2, async function () {
  if (!SRC) return false;
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  if (!late.J) return false;
  late.J.create(container(), {}).destroy();
  letGo();
  await settle();
  return late.made.length === 0 || false;
}, test.limit.quick);

// joinList refused
test.run('when joinList is refused, it says Join could not be loaded.', 0.2, async function () {
  if (!SRC) return false;
  const no = world({ refuse: true });
  if (!no.J) return false;
  const box3 = container();
  no.J.create(box3, {});
  await settle();
  return box3.textContent === 'Join could not be loaded.' && no.made.length === 0 ? true : false;
}, test.limit.quick);
