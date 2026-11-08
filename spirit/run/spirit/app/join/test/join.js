'use strict';

// spirit/run/shell/join/test/join.js
// The tests of shell/join/join.js (spec: ./join.md; goal/G41.1): its steps' icons are glyphs, drawn as they are. The
// browser file runs in node on a window of its own: the page, the shell and the spirit object are stubs.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'join.js');
const KEY = /^[A-Z_]+$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

function node(id) {
  const n = { id: id, innerHTML: '', textContent: '', addEventListener: function () {}, contains: function () { return false; }, querySelector: function () { return null; } };
  return n;
}

test.startTest('join.js: the Join app\'s steps, their icons glyphs');

(async function () {
  test.subHeading('join.json names every icon as a glyph');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'join.json'), 'utf8')); } catch (e) { manifest = null; }
  const steps = (manifest && manifest.steps) || [];
  ok(steps.length > 0, 'join.json has its steps', 'join.json has no steps');
  const keyed = steps.filter(function (s) { return !s.icon || KEY.test(s.icon); }).map(function (s) { return s.until + ':' + s.icon; });
  ok(!keyed.length, 'every step names its icon as the glyph itself', 'steps naming a key or nothing: ' + keyed.join(', '));
  ok(manifest && manifest.icon && !KEY.test(manifest.icon), 'its own icon is a glyph too', 'join.json icon: ' + short(manifest && manifest.icon));

  test.subHeading('join.js reads no icon table');
  const code = fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '');
  ok(!/iconIndex|\bICON\b/.test(code), 'join.js names no icon table', 'join.js still names iconIndex or ICON');

  test.subHeading('it draws the glyphs as given');
  const list = node('join-list');
  const els = { 'join-list': list };
  let def = null;
  const win = {
    spirit: {
      shell: { activateApp: function (d) { def = d; } },
      fs: { loadFile: function () { return Promise.resolve(JSON.stringify(manifest || {})); }, saveFile: function () { return Promise.resolve({ ok: true }); } },
      require: function () { return Promise.resolve(true); },
      relay: { status: function () { return Promise.resolve({ body: { rows: [] } }); } },
      elements: {},
    },
    document: { getElementById: function (id) { return els[id] || null; }, activeElement: null },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  ok(def && typeof def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!def) return;
  def.mount(node('container'), { escapeHtml: function (s) { return String(s); } });
  await settle();
  const done = steps.map(function (s, i) { return i === 0; });
  def.onSteps({ facts: {}, open: steps[1] ? steps[1].until : null, done: done });
  await settle();
  const html = list.innerHTML;
  ok(steps.length > 1 && html.indexOf(steps[1].icon) !== -1 && html.indexOf(steps[0].icon) !== -1, 'each step\'s icon is drawn exactly as join.json gives it',
    'drawn: ' + short(html));
  ok(html.indexOf('☑️') !== -1 && html.indexOf('⬜') !== -1, 'a done step is marked ☑️, an open one ⬜', 'marks drawn: ' + short(html));
  def.onSteps({ facts: {}, open: null, done: steps.map(function () { return true; }) });
  await settle();
  ok(/☑️ Every step is done\./.test(list.innerHTML), 'with every step done it says so, with ☑️', 'drawn: ' + short(list.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
