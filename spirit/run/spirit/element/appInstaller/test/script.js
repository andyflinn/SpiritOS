'use strict';

// spirit/run/spirit/element/appInstaller/test/script.js
// The tests of spirit/element/appInstaller/script.js, and of no other module (spec: ./script.md; goal/G41.1, box v14). The
// browser file runs in node on a window of its own: the spirit object's app family and the app family's cache
// (the app branch's client, on the branch requireScript answers; goal/G43.9, G49.23) are stubs that keep what the element asked of them, and the test plays the node's
// answers and the cache's changes.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/appInstaller/script.js';
const FILE = path.join(RUN, SUBJECT);

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

// A world: the app rows the cache holds, what was asked of the node, the cache's watchers, the paths required.
function world(rows) {
  const w = { rows: rows, asked: [], watchers: {}, released: 0, required: [], fsAsked: 0 };
  const fsApi = {
    getAnnotations: function () { w.fsAsked += 1; return Promise.resolve({}); },
    annotate: function () { w.fsAsked += 1; return Promise.resolve({ ok: true }); },
  };
  // The app branch's client (goal/G49.23, box v22 Part 1: the element reads the rows from the branch spirit.requireScript hands
  // back, and asks no client script): its reads, a stub.
  const STORE = { app: { data: {
    rows: function () { return w.rows; },
    watch: function (key, fn) { (w.watchers[key] = w.watchers[key] || []).push(fn); return function () { w.released += 1; w.watchers[key] = w.watchers[key].filter(function (x) { return x !== fn; }); }; },
  } } };
  const BRANCHES = { 'spirit/fs/script.js': fsApi,
    'spirit/app/script.js': { activeApp: function (a) { w.asked.push(JSON.parse(JSON.stringify(a))); return Promise.resolve({ ok: true }); }, client: STORE.app.data } };
  const win = { spirit: {
    // What readyPromise answers holds no branch (goal/G49.6); a branch is answered by its api.js path.
    readyPromise: Promise.resolve({}),
    // The one loader, a recorder: every path it is asked for.
    requireScript: function (p) { w.required.push(String(p)); return Promise.resolve(BRANCHES[String(p)] || true); },
    escapeHtml: function (s) { return String(s); },
  }, setTimeout: setTimeout, Promise: Promise, JSON: JSON, console: { log: function () {}, error: function () {} } };
  win.window = win;
  // goal/G43.32: appInstaller.js places itself at its path as it runs (spirit/testicle/headLessChrome/script.js pageSpirit).
  LOADER.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(win.spirit, null, { window: win, real: [SUBJECT] });
  win.spirit.requireScript(SUBJECT);
  // goal/G49.23: placed on the spirit object itself, spirit.element.appInstaller.
  w.E = win.spirit.element || {};
  w.put = function (key, row) { w.rows[key] = row; (w.watchers[key] || []).slice().forEach(function (fn) { fn(row); }); };
  return w;
}

// What the tests make, shared by the tests after them.
let w0, PATH, w, h, inst, e1, wi, hi, ws, hs, hx;
test.run('it registers spirit.element.appInstaller.create', 0.2, function () {
  // it is a standard shell element
  w0 = world({});
  return (w0.E.appInstaller && typeof w0.E.appInstaller.create === 'function') ? true : false;
}, test.limit.quick);
test.run('it requires the app branch\'s interface, spirit/app/script.js, and no data script', 0.2, async function () {
  // an app in spirit/app: on while its row says active, by the app family's cache (goal/G43.9)
  PATH = 'spirit/app/zz/zz.js';
  w = world({ zz: { key: 'zz', active: false } });
  h = host();
  inst = w.E.appInstaller.create(h, { path: PATH });
  await settle();
  return (w.required.indexOf('spirit/app/script.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); })) ? true : false;
}, test.limit.quick);
test.run('with its app\'s row inactive, the button says Activate and is off', 0.2, function () {
  return (h.button && h.button.text === 'Activate' && !onOf(h)) ? true : false;
}, test.limit.quick);
test.run('a press asks the node through spirit.app.activeApp to make the app with its key active', 0.2, async function () {
  e1 = h.button.click();
  await settle();
  return (w.asked.length === 1 && w.asked[0].key === 'zz' && w.asked[0].active === true) ? true : false;
}, test.limit.quick);
test.run('the click stays its own and does not reach the row around it', 0.2, function () {
  return (e1.stopped) ? true : false;
}, test.limit.quick);
test.run('until the stream says so it stays off, because it draws the cache, not the click', 0.2, function () {
  return (!onOf(h) && h.button.text === 'Activate') ? true : false;
}, test.limit.quick);
test.run('with its app\'s row active in the cache, the button says Deactivate and is on', 0.2, async function () {
  w.put('zz', { key: 'zz', active: true });
  await settle();
  return (onOf(h) && h.button.text === 'Deactivate') ? true : false;
}, test.limit.quick);
test.run('pressed again, it asks for the app to be made inactive', 0.2, async function () {
  h.button.click();
  await settle();
  return (w.asked.length === 2 && w.asked[1].active === false) ? true : false;
}, test.limit.quick);
test.run('with its app\'s row inactive again, the button says Activate and is off again', 0.2, async function () {
  w.put('zz', { key: 'zz', active: false });
  await settle();
  return (!onOf(h) && h.button.text === 'Activate') ? true : false;
}, test.limit.quick);
test.run('it reads and writes no face part', 0.2, function () {
  return (w.fsAsked === 0) ? true : false;
}, test.limit.quick);
test.run('destroy ends its watch', 0.2, function () {
  inst.destroy();
  return (w.released === 1) ? true : false;
}, test.limit.quick);
test.run('nothing is drawn after destroy', 0.2, async function () {
  w.put('zz', { key: 'zz', active: true });
  await settle();
  return (!onOf(h)) ? true : false;
}, test.limit.quick);
test.run('an app whose row says intrinsic gets no button and no note', 0.2, async function () {
  // an intrinsic app gets no button (goal/G43.15)
  wi = world({ core: { key: 'core', active: true, intrinsic: true } });
  hi = host();
  wi.E.appInstaller.create(hi, { path: 'spirit/app/core/core.js' });
  await settle();
  return (!hi.button && hi.innerHTML === '') ? true : false;
}, test.limit.quick);
test.run('a shell app\'s script gets nothing, and no face part is read', 0.2, async function () {
  // the old shell's face parts are gone (goal/G43.20, Andy: "drop the old shells face parts altogether.")
  ws = world({});
  hs = host();
  ws.E.appInstaller.create(hs, { path: 'shell/icons/icons.js' });
  await settle();
  return (!hs.button && hs.innerHTML === '' && ws.fsAsked === 0) ? true : false;
}, test.limit.quick);
test.run('another script of an app folder gets nothing', 0.2, async function () {
  hx = host();
  ws.E.appInstaller.create(hx, { path: 'spirit/app/zz/other.js' });
  await settle();
  return (!hx.button && hx.innerHTML === '') ? true : false;
}, test.limit.quick);
