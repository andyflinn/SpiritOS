'use strict';

// spirit/run/shell/stackFrameCheckDetail/test/stackFrameCheckDetail.js
// The tests of shell/stackFrameCheckDetail/stackFrameCheckDetail.js, and of no other module (spec: ./stackFrameCheckDetail.md; goal/G41.9). The browser file runs in node
// on a window of its own: the app's api records every verb; armingButton is a stub that keeps every button made or
// attached with what it was handed, so each two-press button's run is driven here as its second press would.

const FILE = require('path').join(__dirname, '..', 'stackFrameCheckDetail.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SRC = fs.readFileSync(FILE, 'utf8');
const CODE = SRC.replace(/\/\/.*$/gm, '');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () {
  for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 5); });
};

// A box whose markup makes a node per tag; a tag with an id is found by getElementById, a button keeps its own text.
const byId = {};
function node(tag) {
  const heard = {}; let html = ''; const attrs = {};
  const n = { tag: tag || '', kids: [], textContent: '', value: '', style: {}, className: '', disabled: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        const id = /\sid="([^"]*)"/.exec(m[2]);
        if (m[1].toLowerCase() === 'button') {
          const end = html.indexOf('</button>', re.lastIndex);
          c.textContent = end === -1 ? '' : html.slice(re.lastIndex, end).replace(/<[^>]*>/g, '');
        }
        if (id) { c.id = id[1]; byId[id[1]] = c; }
      }
    },
    setAttribute: function (k, v) { attrs[k] = String(v); }, getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
    removeAttribute: function (k) { delete attrs[k]; },
    appendChild: function (c) { n.kids.push(c); return c; }, replaceChild: function () {}, insertBefore: function (c) { return c; },
    get firstChild() { return null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  };
  return n;
}

// The world: the app's api records every verb; spirit.require records each path; armingButton is a stub that keeps
// every button made or attached with what it was handed.
function world(answer) {
  const w = { calls: [], required: [], arming: [], closed: [], def: null, handed: 0 };
  const stub = {
    create: function (opts) { const b = node('<button>'); w.arming.push({ how: 'create', button: b, opts: opts || {} }); return b; },
    attach: function (button, opts) { w.arming.push({ how: 'attach', button: button, opts: opts || {} }); return button; },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) { w.calls.push({ name: name, args: args }); return Promise.resolve({ status: 200, body: answer(name, args) }); },
    armUntilElsewhere: function () { w.handed += 1; },
    closeDialog: function (r) { w.closed.push(r); },
    setScreenTitle: function () {}, onPublished: function () {},
    ui: { elements: {} },
  };
  const win = {
    document: { getElementById: function (id) { return byId[id] || null; }, createElement: function (t) { return node('<' + t + '>'); }, body: null },
    setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = { elements: { armingButton: stub },
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    shell: { activateApp: function (d) { w.def = d; } } };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.api = api;
  return w;
}
// The newest arming button for a button id (attached) or a label (made): what the page shows now.
function armingFor(w, id, label) {
  const found = w.arming.filter(function (a) {
    const said = a.opts.label != null ? a.opts.label : a.button && a.button.textContent;
    return (a.button && a.button.id === id) || said === label;
  });
  return found[found.length - 1] || null;
}
function nothingHandRolled(flag) {
  ok(!/data-armed/.test(CODE), 'no data-armed of its own: the arming button carries it', 'its code still writes data-armed');
  ok(!/armUntilElsewhere/.test(CODE), 'it hands nothing to armUntilElsewhere itself: the arming button does', 'its code still calls armUntilElsewhere');
  ok(!new RegExp('\\b' + flag + '\\b').test(CODE), 'no armed flag of its own (' + flag + ')', 'its code still keeps ' + flag);
  ok(!/classList\.(add|remove|toggle)\(\s*['"]armed['"]/.test(CODE) && !/armedButton/.test(CODE), 'no armed class and no armedButton helper of its own', 'its code still has an armed class or an armedButton helper');
}
function loadsArming(w) {
  ok(w.required.indexOf('shell/js/armingButton.js') !== -1, 'it loads shell/js/armingButton.js itself, through spirit.require', 'required: ' + short(w.required));
}

test.startTest('stackFrameCheckDetail.js: one stack-frame door, its Remove on the arming button');

(async function () {
  test.subHeading('nothing hand-rolled is left (goal/G41.9)');
  nothingHandRolled('sdArmed');

  const w = world(function (name, args) {
    if (name === 'desk.stackFrameChecks.door') return { ok: true, id: args.id, gate: 'g', endpoint: 'e', paths: [], suites: [] };
    if (name === 'desk.stackFrameChecks.runState') return { ok: true, running: false, verdict: {} };
    return { ok: true };
  });
  ok(w.def && typeof w.def.mount === 'function' && typeof w.def.open === 'function', 'it mounts through spirit.shell.activateApp, with mount and open', 'activateApp got ' + short(w.def && Object.keys(w.def)));
  if (!w.def) return;
  const box = node('container');
  await w.def.mount(box, w.api);
  await w.def.open({ id: 'D3' });
  await settle();
  loadsArming(w);

  test.subHeading('Remove is an arming button');
  const a = armingFor(w, 'sfcd-remove', 'Remove');
  ok(!!a, 'Remove is made or attached through window.spirit.elements.armingButton', 'arming buttons: ' + short(w.arming.map(function (x) { return x.button && x.button.id || x.opts.label; })));
  if (!a) return;
  const label = a.opts.label != null ? a.opts.label : a.button.textContent;
  ok(label === 'Remove' && a.opts.armedLabel === 'Remove: sure?', 'it says Remove, and armed Remove: sure?', 'label ' + short(label) + ', armedLabel ' + short(a.opts.armedLabel));
  ok(a.opts.api === w.api, 'it is handed the app\'s api, so a click elsewhere disarms it', 'api handed: ' + short(a.opts.api === w.api));
  ok(w.calls.filter(function (c) { return c.name === 'desk.stackFrameChecks.remove'; }).length === 0, 'nothing is removed before its run', 'removed already');
  ok(!armingFor(w, 'sfcd-save', 'Save') && !armingFor(w, 'sfcd-run', 'Run'), 'Save and Run stay plain buttons', 'arming buttons: ' + short(w.arming.map(function (x) { return x.button && x.button.id || x.opts.label; })));

  test.subHeading('its run removes the door, and the dialog closes');
  ok(typeof a.opts.run === 'function', 'it has a run', 'no run');
  if (typeof a.opts.run !== 'function') return;
  await a.opts.run(); await settle();
  const rm = w.calls.filter(function (c) { return c.name === 'desk.stackFrameChecks.remove'; });
  ok(rm.length === 1 && rm[0].args.id === 'D3', 'its run asks stackFrameChecks.remove of this door', 'asked: ' + short(rm));
  ok(w.closed.length === 1 && w.closed[0] && w.closed[0].removed === 'D3', 'then closes the dialog, saying which door went', 'closed: ' + short(w.closed));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
