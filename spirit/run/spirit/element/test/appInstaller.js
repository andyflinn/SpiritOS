'use strict';

// spirit/run/spirit/element/test/appInstaller.js
// The tests of spirit/element/appInstaller.js, and of no other module (spec: ./appInstaller.md; goal/G41.1, box v14). The
// browser file runs in node on a window of its own: the spirit object's app family and the app family's cache
// (spirit.data.app.data, goal/G43.9) are stubs that keep what the element asked of them, and the test plays the node's
// answers and the cache's changes.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'appInstaller.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// A host: its markup's one button, if any, as a node that hears clicks.
function host() {
  let html = '';
  const h = { button: null,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const m = /<button\b([^>]*)>([\s\S]*?)<\/button>/i.exec(html);
      if (!m) { h.button = null; return; }
      const heard = [];
      h.button = { attrs: m[1], text: m[2].replace(/<[^>]+>/g, '').trim(), addEventListener: function (t, fn) { if (t === 'click') heard.push(fn); },
        click: function () { const e = { stopped: false, stopPropagation: function () { e.stopped = true; }, preventDefault: function () {} }; heard.forEach(function (fn) { fn(e); }); return e; } };
    },
    querySelector: function (sel) { return /^button/.test(sel) ? h.button : null; },
    get text() { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); },
  };
  return h;
}
const onOf = function (h) { return !!h.button && /data-on="true"/.test(h.button.attrs); };

// A world: the app rows the cache holds, what was asked of the node, the cache's watchers, the managers loaded.
function world(rows) {
  const w = { rows: rows, asked: [], watchers: {}, released: 0, managers: [], fsAsked: 0 };
  const fsApi = {
    getAnnotations: function () { w.fsAsked += 1; return Promise.resolve({}); },
    annotate: function () { w.fsAsked += 1; return Promise.resolve({ ok: true }); },
  };
  const win = { spirit: {
    ready: Promise.resolve({ fs: fsApi, app: { activeApp: function (a) { w.asked.push(JSON.parse(JSON.stringify(a))); return Promise.resolve({ ok: true }); } } }), fs: fsApi,
    cacheManager: function (name) { w.managers.push(name); return Promise.resolve(true); },
    data: { app: { data: {
      rows: function () { return w.rows; },
      watchApp: function (key, fn) { (w.watchers[key] = w.watchers[key] || []).push(fn); return function () { w.released += 1; w.watchers[key] = w.watchers[key].filter(function (x) { return x !== fn; }); }; },
    } } },
    escapeHtml: function (s) { return String(s); },
  }, setTimeout: setTimeout, Promise: Promise, JSON: JSON, console: { log: function () {}, error: function () {} } };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.element || {};
  w.put = function (key, row) { w.rows[key] = row; (w.watchers[key] || []).slice().forEach(function (fn) { fn(row); }); };
  return w;
}

test.startTest('appInstaller.js: one activate/deactivate button for one app');

(async function () {
  test.subHeading('it is a standard shell element');
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/appInstaller.js is not there'); return; }
  const w0 = world({});
  ok(w0.E.appInstaller && typeof w0.E.appInstaller.create === 'function', 'it registers spirit.element.appInstaller.create', 'elements: ' + short(Object.keys(w0.E)));
  if (!w0.E.appInstaller) return;

  test.subHeading('an app in spirit/app: on while its row says active, by the app family\'s cache (goal/G43.9)');
  const PATH = 'spirit/app/zz/zz.js';
  const w = world({ zz: { key: 'zz', active: false } });
  const h = host();
  const inst = w.E.appInstaller.create(h, { path: PATH });
  await settle();
  ok(w.managers.indexOf('app') !== -1, 'it loads the app family\'s cache', 'managers: ' + short(w.managers));
  ok(h.button && h.button.text === 'Activate' && !onOf(h), 'its row inactive: Activate, off', 'button: ' + short(h.button && { text: h.button.text, attrs: h.button.attrs }));
  const e1 = h.button.click(); await settle();
  ok(w.asked.length === 1 && w.asked[0].key === 'zz' && w.asked[0].active === true, 'a press asks the node, spirit.app.activeApp { key, active: true }', 'asked ' + short(w.asked));
  ok(e1.stopped, 'the click stays its own: it does not reach the row around it', 'the click propagated');
  ok(!onOf(h) && h.button.text === 'Activate', 'until the stream says so, it stays off: it draws the cache, not the click', 'after the press: ' + short(h.button.text));
  w.put('zz', { key: 'zz', active: true }); await settle();
  ok(onOf(h) && h.button.text === 'Deactivate', 'its row active in the cache: Deactivate, on', 'after active: ' + short(h.button && h.button.text));
  h.button.click(); await settle();
  ok(w.asked.length === 2 && w.asked[1].active === false, 'pressed again it asks active false', 'asked ' + short(w.asked));
  w.put('zz', { key: 'zz', active: false }); await settle();
  ok(!onOf(h) && h.button.text === 'Activate', 'its row inactive again: Activate, off', 'after inactive: ' + short(h.button && h.button.text));
  ok(w.fsAsked === 0, 'it reads and writes no face part (goal/G43.20)', 'fs asked ' + w.fsAsked + ' times');
  inst.destroy();
  ok(w.released === 1, 'destroy ends its watch', 'released ' + w.released);
  w.put('zz', { key: 'zz', active: true }); await settle();
  ok(!onOf(h), 'and nothing is drawn after it', 'drew after destroy');

  test.subHeading('an intrinsic app gets no button (goal/G43.15)');
  const wi = world({ core: { key: 'core', active: true, intrinsic: true } });
  const hi = host(); wi.E.appInstaller.create(hi, { path: 'spirit/app/core/core.js' }); await settle();
  ok(!hi.button && hi.innerHTML === '', 'its row says intrinsic: no button and no note', 'drew: ' + short(hi.innerHTML));

  test.subHeading('the old shell\'s face parts are gone (goal/G43.20, Andy: "drop the old shells face parts altogether.")');
  const ws = world({});
  const hs = host(); ws.E.appInstaller.create(hs, { path: 'shell/icons/icons.js' }); await settle();
  ok(!hs.button && hs.innerHTML === '' && ws.fsAsked === 0, 'a shell app\'s script gets nothing, and no face part is read', 'drew: ' + short(hs.innerHTML) + ', fs asked ' + ws.fsAsked);
  const hx = host(); ws.E.appInstaller.create(hx, { path: 'spirit/app/zz/other.js' }); await settle();
  ok(!hx.button && hx.innerHTML === '', 'another script of an app folder gets nothing', 'drew: ' + short(hx.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
