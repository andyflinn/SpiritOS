'use strict';

// spirit/run/shell/stackFrameCheckDetail/test/stackFrameCheckDetail.js
// The tests of shell/stackFrameCheckDetail/stackFrameCheckDetail.js, and of no other module (spec: ./stackFrameCheckDetail.md; goal/G41.9). The browser file runs in node
// on a window of its own: the app's api records every verb; armingButton is a stub that keeps every button made or
// attached with what it was handed, so each two-press button's run is driven here as its second press would. The page's
// one data set and the desk family's cache manager are the real ones (spirit/data.js, process/js/desk/family/).

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
function world(answer, fields) {
  const w = { calls: [], required: [], arming: [], closed: [], def: null, handed: 0, listeners: 0 };
  const stub = {
    create: function (opts) { const b = node('<button>'); w.arming.push({ how: 'create', button: b, opts: opts || {} }); return b; },
    attach: function (button, opts) { w.arming.push({ how: 'attach', button: button, opts: opts || {} }); return button; },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) { w.calls.push({ name: name, args: args }); return Promise.resolve({ status: 200, body: answer(name, args) }); },
    armUntilElsewhere: function () { w.handed += 1; },
    closeDialog: function (r) { w.closed.push(r); },
    setScreenTitle: function () {}, onPublished: function () { w.listeners += 1; },
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
    shell: { activateApp: function (d) { w.def = d; } },
    // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
    cacheManager: function (name) {
      w.managers = (w.managers || []).concat(name);
      vm.runInContext(fs.readFileSync(path.join(RUN, 'process', 'js', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
      return Promise.resolve(true);
    } };
  // The door's fields, the shared element, as a stand-in whose form says the door it is handed (fields).
  if (fields) win.spirit.elements.deskDoorFields = { FIELDS: [], html: function () { return ''; }, fill: function () {}, check: function () {},
    why: function () { return ''; }, door: function () { return fields; } };
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+STACK/FRAME==' };
  win.spirit.data.home(win.spirit.node.key);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
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
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it loads spirit/element/armingButton.js itself, through spirit.require', 'required: ' + short(w.required));
}

test.startTest('stackFrameCheckDetail.js: one stack-frame door, its Remove on the arming button');

function answer(name, args) {
  if (name === 'desk.stackFrameChecks.door') return { ok: true, id: args.id, gate: 'g', endpoint: 'e', paths: [], suites: [] };
  if (name === 'desk.stackFrameChecks.runState') return { ok: true, running: false, verdict: {} };
  return { ok: true };
}
function asked(w, verb) { return w.calls.filter(function (c) { return c.name === 'desk.stackFrameChecks.' + verb; }).length; }

(async function () {
  test.subHeading('nothing hand-rolled is left (goal/G41.9)');
  nothingHandRolled('sdArmed');

  const w = world(answer);
  ok(w.def && typeof w.def.mount === 'function' && typeof w.def.open === 'function', 'it mounts through spirit.shell.activateApp, with mount and open', 'activateApp got ' + short(w.def && Object.keys(w.def)));
  if (!w.def) return;
  const box = node('container');
  await w.def.mount(box, w.api);
  await w.def.open({ id: 'D3' });
  await settle();
  loadsArming(w);

  test.subHeading('Remove is an arming button');
  const a = armingFor(w, 'sfcd-remove', 'Remove');
  ok(!!a, 'Remove is made or attached through window.spirit.element.armingButton', 'arming buttons: ' + short(w.arming.map(function (x) { return x.button && x.button.id || x.opts.label; })));
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

  // Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the
  // spirit object" (goal/G41.28).
  test.subHeading('the door and its run are the desk family\'s cache, and it draws from their watches (goal/G41.28)');
  const v = world(answer, { gate: 'g2', endpoint: 'e', paths: [], suites: [] });
  const cv = node('container');
  await v.def.mount(cv, v.api);
  await v.def.open({ id: 'D3' });
  await settle();
  const K = ((v.win.spirit.data || {}).desk || {}).data;
  ok((v.managers || []).indexOf('desk') !== -1 && !!K, 'it loads the desk family\'s cache manager (((spirit.data || {}).desk || {}).data)', 'managers: ' + short(v.managers));
  if (!K) return;
  const kept = v.win.spirit.data.at(null, 'desk');
  ok(!!kept.get('deskDoors/D3') && kept.get('deskDoors/D3').gate === 'g', 'the plugin\'s door read is kept in ((spirit.data || {}).desk || {}).data\'s doors', 'kept: ' + short(kept.get('deskDoors/D3')));
  ok(!!kept.get('deskDoorRuns/D3') && kept.get('deskDoorRuns/D3').running === false, 'and its runState read in its doorRuns', 'kept: ' + short(kept.get('deskDoorRuns/D3')));
  ok(v.listeners === 0, 'it sets no listener of its own on the desk\'s publishes: the cache is what it hears', 'onPublished asked ' + v.listeners + ' time(s)');
  K.doorRuns.keep('D3', { ok: true, running: false, endedAt: '2026-11-02T10:00:00.000Z', verdict: { ran: true, green: true, of: 4 } }); await settle();
  ok(/green: 4 production call/.test(byId['sfcd-state'] ? byId['sfcd-state'].innerHTML : ''), 'a run changed in the cache is drawn', 'its run: ' + short(byId['sfcd-state'] && byId['sfcd-state'].innerHTML));
  K.doors.keep({ ok: true, id: 'D3', item: 'goal/G9.1', gate: 'g', endpoint: 'e', paths: [], suites: [] }); await settle();
  ok(/asked by goal\/G9\.1/.test(byId['sfcd-head'] ? byId['sfcd-head'].textContent : ''), 'a door changed in the cache is drawn', 'head: ' + short(byId['sfcd-head'] && byId['sfcd-head'].textContent));

  test.subHeading('what the plugin says changed is dropped from the cache, and read again');
  let d0 = asked(v, 'door'), r0 = asked(v, 'runState');
  K.published({ plugin: 'stackFrameChecks', data: { what: 'run', id: 'D3' } }); await settle();
  ok(asked(v, 'runState') === r0 + 1 && asked(v, 'door') === d0, 'a run of this door: its run is read again, the door not', 'door ' + d0 + '→' + asked(v, 'door') + ', runState ' + r0 + '→' + asked(v, 'runState'));
  d0 = asked(v, 'door'); r0 = asked(v, 'runState');
  K.published({ plugin: 'stackFrameChecks', data: { what: 'update', id: 'D3' } }); await settle();
  ok(asked(v, 'runState') === r0 + 1 && asked(v, 'door') === d0 + 1, 'any other change of this door: the door and its run are read again', 'door ' + d0 + '→' + asked(v, 'door') + ', runState ' + r0 + '→' + asked(v, 'runState'));
  d0 = asked(v, 'door'); r0 = asked(v, 'runState');
  K.published({ plugin: 'stackFrameChecks', data: { what: 'update', id: 'D4' } }); await settle();
  ok(asked(v, 'runState') === r0 && asked(v, 'door') === d0, 'another door\'s change reads nothing', 'door ' + d0 + '→' + asked(v, 'door') + ', runState ' + r0 + '→' + asked(v, 'runState'));

  test.subHeading('Save reads nothing back itself: the door and its cleared run come back through the cache');
  d0 = asked(v, 'door'); r0 = asked(v, 'runState');
  cv.fire('click', { target: byId['sfcd-save'] }); await settle();
  const up = v.calls.filter(function (c) { return c.name === 'desk.stackFrameChecks.update'; }).pop();
  ok(!!up && up.args.id === 'D3' && up.args.gate === 'g2', 'Save sends the door as its form says it (stackFrameChecks.update)', 'asked: ' + short(up));
  ok(asked(v, 'runState') === r0, 'and reads no run after it', 'runState ' + r0 + '→' + asked(v, 'runState'));
  ok(/Saved/.test(byId['sfcd-note'] ? byId['sfcd-note'].textContent : ''), 'and says Saved', 'note: ' + short(byId['sfcd-note'] && byId['sfcd-note'].textContent));
  r0 = asked(v, 'runState');
  K.published({ plugin: 'stackFrameChecks', data: { what: 'update', id: 'D3' } }); await settle();
  ok(asked(v, 'runState') === r0 + 1, 'its run comes back when the plugin\'s publish of the save drops it', 'runState ' + r0 + '→' + asked(v, 'runState'));
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
