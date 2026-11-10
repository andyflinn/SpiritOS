'use strict';

// spirit/run/spirit/app/join/test/join.js
// The tests of spirit/app/join/join.js, and of no other module (spec: ./join.md; goal/G43.26). Since G43.26 the app is a
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
const FILE = path.join(DIR, 'join.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');
const KEY = /^[A-Z_]+$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
  // installSpiritElement at spirit.element.spirit.app.join.join; joinList stands where it reads it.
  win.spirit = { element: { spirit: { element: els, app: {} } },
    require: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error('not-found ' + p));
      const put = function () { if (p === 'spirit/element/joinList.js') els.joinList = joinList; return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.J = (win.spirit.element.spirit.app.join || {}).join;
  return w;
}
function container() { return { innerHTML: '<p>left over</p>', textContent: '' }; }

test.startTest('join.js: the Join app, a wrapper of joinList');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/app/join/join.js is there', 'there is no spirit/app/join/join.js');
  if (!SRC) return;

  test.subHeading('join.json names every icon as a glyph (goal/G41.1)');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'join.json'), 'utf8')); } catch (e) { manifest = null; }
  const steps = (manifest && manifest.steps) || [];
  ok(steps.length > 0, 'join.json has its steps', 'join.json has no steps');
  const keyed = steps.filter(function (s) { return !s.icon || KEY.test(s.icon); }).map(function (s) { return s.until + ':' + s.icon; });
  ok(!keyed.length, 'every step names its icon as the glyph itself', 'steps naming a key or nothing: ' + keyed.join(', '));
  const own = manifest && manifest.identity && manifest.identity.icon;
  ok(!!own && !KEY.test(own), 'its own icon, identity.icon, is a glyph too', 'join.json identity.icon: ' + short(own));

  test.subHeading('mounted the new shell\'s way, a wrapper that loads joinList and nothing of its own');
  const w = world();
  ok(!!w.J && typeof w.J.create === 'function', 'it sets spirit.element.spirit.app.join.join = { create }', 'no join.create');
  if (!w.J) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b/.test(CODE), 'no spirit.shell.activateApp, the old shell\'s way', 'join.js still mounts through spirit.shell');
  ok(JSON.stringify(w.required) === '["spirit/element/joinList.js"]', 'it requires spirit/element/joinList.js, and only that', 'required: ' + short(w.required));
  ok(!/iconIndex|\bICON\b/.test(CODE), 'it names no icon table', 'join.js still names iconIndex or ICON');

  test.subHeading('create(container): joinList made in the container');
  const box = container();
  const m = w.J.create(box, {});
  ok(!!m && typeof m.destroy === 'function', 'create answers { destroy() }', 'create answered ' + short(m && Object.keys(m)));
  ok(box.innerHTML === '', 'it empties its container', 'left: ' + short(box.innerHTML));
  await settle();
  ok(w.made.length === 1 && w.made[0].host === box, 'it makes joinList in its container', 'made: ' + w.made.length);

  test.subHeading('destroy');
  m.destroy();
  ok(w.destroyed === 1 && box.innerHTML === '', 'destroy destroys joinList and empties its container', 'destroyed ' + w.destroyed + ', left ' + short(box.innerHTML));
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  const box2 = container();
  late.J.create(box2, {}).destroy();
  letGo();
  await settle();
  ok(late.made.length === 0, 'destroyed before joinList loads, nothing is made', 'made ' + late.made.length);

  test.subHeading('joinList refused');
  const no = world({ refuse: true });
  const box3 = container();
  no.J.create(box3, {});
  await settle();
  ok(box3.textContent === 'Join could not be loaded.' && no.made.length === 0, 'it says Join could not be loaded.', 'said: ' + short(box3.textContent));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
