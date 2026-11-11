'use strict';

// spirit/run/spirit/app/join/test/element.js
// The tests of spirit/app/join/element.js, and of no other module (spec: ./join.md; goal/G43.26). Since G43.26 the app is a
// wrapper mounted the new shell's way: all of Join is joinList (spirit/element/joinList.js, tested in
// spirit/element/test/joinList.js). The browser file runs in node on a BARE window (rule/26): joinList is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/join/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');
const KEY = /^[A-Z_]+$/;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
  // goal/G43.32: a page's spirit (spirit/test/headLessChrome.js pageSpirit), so join.js places itself by
  // installSpiritElement at spirit.element.spirit.app.join.element; joinList stands where it reads it.
  win.spirit = { element: { spirit: { element: els, app: {} } },
    require: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error('not-found ' + p));
      const put = function () { if (p === 'spirit/element/joinList.js') els.joinList = joinList; return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.J = (win.spirit.element.spirit.app.join || {}).element;
  return w;
}
function container() { return { innerHTML: '<p>left over</p>', textContent: '' }; }

// join.js: the Join app, a wrapper of joinList. One test.run per test (goal/G47.2). What the tests made, for the tests after them.
const W = {};
const NO_JOIN = 'no join.create: the test before failed';

test.run('spirit/app/join/element.js is there', 0.2, function () {
  return !!SRC || 'there is no spirit/app/join/element.js';
}, test.limit.quick);

// join.json names every icon as a glyph (goal/G41.1)
const MANIFEST = function () { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'join.json'), 'utf8')); } catch (e) { return null; } };
test.run('join.json has its steps', 0.2, function () {
  const steps = (MANIFEST() || {}).steps || [];
  return steps.length > 0 || 'join.json has no steps';
}, test.limit.quick);
test.run('every step names its icon as the glyph itself', 0.2, function () {
  const steps = (MANIFEST() || {}).steps || [];
  const keyed = steps.filter(function (s) { return !s.icon || KEY.test(s.icon); }).map(function (s) { return s.until + ':' + s.icon; });
  return !keyed.length || 'steps naming a key or nothing: ' + keyed.join(', ');
}, test.limit.quick);
test.run('its own icon, identity.icon, is a glyph too', 0.2, function () {
  const manifest = MANIFEST();
  const own = manifest && manifest.identity && manifest.identity.icon;
  return !!own && !KEY.test(own) ? true : 'join.json identity.icon: ' + short(own);
}, test.limit.quick);

// mounted the new shell's way, a wrapper that loads joinList and nothing of its own
test.run('it sets spirit.element.spirit.app.join.element = { create }', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/join/element.js';
  W.w = world();
  return !!W.w.J && typeof W.w.J.create === 'function' ? true : 'no join.create';
}, test.limit.quick);
test.run('no spirit.shell.activateApp, the old shell\'s way', 0.2, function () {
  return !(/\bactivateApp\b|\bspirit\.shell\b/).test(CODE) || 'join.js still mounts through spirit.shell';
}, test.limit.quick);
test.run('it requires spirit/element/joinList.js, and only that', 0.2, function () {
  if (!W.w || !W.w.J) return NO_JOIN;
  return JSON.stringify(W.w.required) === '["spirit/element/joinList.js"]' || 'required: ' + short(W.w.required);
}, test.limit.quick);
test.run('it names no icon table', 0.2, function () {
  return !(/iconIndex|\bICON\b/).test(CODE) || 'join.js still names iconIndex or ICON';
}, test.limit.quick);

// create(container): joinList made in the container
test.run('create answers { destroy() }', 0.2, function () {
  if (!W.w || !W.w.J) return NO_JOIN;
  W.box = container();
  W.m = W.w.J.create(W.box, {});
  return !!W.m && typeof W.m.destroy === 'function' ? true : 'create answered ' + short(W.m && Object.keys(W.m));
}, test.limit.quick);
test.run('it empties its container', 0.2, function () {
  if (!W.box) return 'nothing created: the test before failed';
  return W.box.innerHTML === '' || 'left: ' + short(W.box.innerHTML);
}, test.limit.quick);
test.run('it makes joinList in its container', 0.2, async function () {
  if (!W.box) return 'nothing created: the test before failed';
  await settle();
  return W.w.made.length === 1 && W.w.made[0].host === W.box ? true : 'made: ' + W.w.made.length;
}, test.limit.quick);

// destroy
test.run('destroy destroys joinList and empties its container', 0.2, function () {
  if (!W.m || typeof W.m.destroy !== 'function') return 'nothing to destroy: create answered none';
  W.m.destroy();
  return W.w.destroyed === 1 && W.box.innerHTML === '' ? true : 'destroyed ' + W.w.destroyed + ', left ' + short(W.box.innerHTML);
}, test.limit.quick);
test.run('destroyed before joinList loads, nothing is made', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/join/element.js';
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  if (!late.J) return 'no join.create';
  late.J.create(container(), {}).destroy();
  letGo();
  await settle();
  return late.made.length === 0 || 'made ' + late.made.length;
}, test.limit.quick);

// joinList refused
test.run('it says Join could not be loaded.', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/join/element.js';
  const no = world({ refuse: true });
  if (!no.J) return 'no join.create';
  const box3 = container();
  no.J.create(box3, {});
  await settle();
  return box3.textContent === 'Join could not be loaded.' && no.made.length === 0 ? true : 'said: ' + short(box3.textContent);
}, test.limit.quick);
