'use strict';

// spirit/run/shell/agent/test/agent.js
// The tests of shell/agent/agent.js, and of no other module (spec: ./agent.md; goal/G41.1). The browser file runs in
// node on a window of its own: the shell, the workBench element, the file calls and the api are stubs that keep what
// the app asked of them, and the stream is a function the test calls as the shell would.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'agent.js');
const CONFIG = 'relay-state/shell/agent/config.json';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A box: its markup makes a node per id and per input, each hearing its own listeners; a change bubbles to the box.
function box(name) {
  const heard = {}; let html = '';
  const b = { name: name, style: {}, className: '', parts: {}, inputs: [], hidden: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.inputs = [];
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) {
        const tag = m[0]; const id = /\bid="([^"]+)"/.exec(tag);
        const n = (id && b.parts[id[1]]) || part(tag);
        n.tag = tag; n.className = (/class="([^"]*)"/.exec(tag) || [])[1] || '';
        if (/^<input/i.test(tag)) { n.checked = /\schecked(\s|>|=|\/)/.test(tag); n.parent = b; b.inputs.push(n); }
        if (id) b.parts[id[1]] = n;
      }
    },
    querySelector: function (sel) {
      if (sel.charAt(0) === '#') return b.parts[sel.slice(1)] || null;
      if (/^input/.test(sel)) return b.inputs[0] || null;
      const cls = /^\.([\w-]+)$/.exec(sel); if (cls) return Object.keys(b.parts).map(function (k) { return b.parts[k]; }).filter(function (n) { return n.className.split(/\s+/).indexOf(cls[1]) !== -1; })[0] || null;
      return null;
    },
    querySelectorAll: function (sel) { return /^input/.test(sel) ? b.inputs.slice() : []; },
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    removeEventListener: function () {},
    appendChild: function (c) { return c; },
    fire: function (type, e) { (heard[type] || []).slice().forEach(function (fn) { fn(e); }); },
  };
  return b;
}
function part(tag) {
  const heard = {};
  const n = { tag: tag, className: '', style: {}, checked: false, hidden: false, value: '',
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); }, removeEventListener: function () {},
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    fire: function (type, e) { (heard[type] || []).slice().forEach(function (fn) { fn(e); }); },
    querySelector: function () { return null; }, appendChild: function (c) { return c; }, innerHTML: '' };
  return n;
}
// The user ticks or unticks a checkbox: its state set, the change heard on it, then on its box.
function change(b, checked) {
  const input = b.inputs[0];
  if (!input) return false;
  input.checked = checked;
  const e = { target: input, currentTarget: input, type: 'change', preventDefault: function () {}, stopPropagation: function () {} };
  input.fire('change', e); input.fire('input', e);
  b.fire('change', e); b.fire('input', e);
  return true;
}
const isOn = function (b) { return !!(b.inputs[0] && b.inputs[0].checked === true); };

function world(configText) {
  const w = { created: [], loads: [], saves: [], verbs: [], titles: [], onJobs: [], def: null };
  w.workBench = { create: function (into, opts) {
    const made = { into: into, opts: opts || {}, center: box('center'), press: function () {}, shown: function () { return ''; }, width: function () { return 0; }, destroy: function () {} };
    w.created.push(made); return made;
  } };
  w.fs = {
    loadFile: function (p) { w.loads.push(String(p)); return Promise.resolve(p === CONFIG ? configText : null); },
    saveFile: function (p, text) { w.saves.push({ path: String(p), text: String(text) }); return Promise.resolve({ ok: true }); },
  };
  w.api = {
    verb: function (name, args) { w.verbs.push({ name: name, args: args }); return Promise.resolve({ status: 200, body: { ok: true, debug: !!(args && args.on) } }); },
    onJobs: function (fn) { w.onJobs.push(fn); return function () {}; },
    setScreenTitle: function (t) { w.titles.push(String(t)); },
    escapeHtml: function (s) { return String(s); },
    ui: { elements: {} },
  };
  w.api.ui.elements.workBench = w.workBench;
  w.stream = function (debug) { const job = { id: 'job-agent', app: { agent: { debug: debug } } }; const all = { 'job-agent': job }; w.onJobs.forEach(function (fn) { fn(all, job, { visible: true }); }); };
  w.title = function () { return w.titles.length ? w.titles[w.titles.length - 1] : ''; };
  return w;
}
// The app loaded on a window of its own, with this world's stubs.
function load(w) {
  global.window = { spirit: { shell: { activateApp: function (def) { w.def = def; } }, elements: { workBench: w.workBench }, fs: w.fs, escapeHtml: function (s) { return String(s); } } };
  global.spirit = global.window.spirit;
  global.document = { createElement: function () { return box('made'); }, addEventListener: function () {}, removeEventListener: function () {} };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  return w.def;
}

test.startTest('agent.js: the agent face app');

(async function () {
  test.subHeading('its files');
  if (!fs.existsSync(FILE)) { test.fail('shell/agent/agent.js is not there'); return; }
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  ok(manifest.server === 'agent', 'its manifest names its server, agent', 'agent.json: ' + short(manifest));
  const side = (readJson(path.join(DIR, 'agent.js.sidecar.json')) || {}).face || {};
  ok(side.app === true && side.name && side.icon && side.description, 'its sidecar marks it a face app, with its name, icon and description',
    'face mark: ' + short(side));

  test.subHeading('it mounts one workBench into a box of the whole app area');
  const w = world(JSON.stringify({ showDebug: true }));
  let def = null; let loadError = null;
  try { def = load(w); } catch (e) { loadError = e; }
  ok(!loadError && def && typeof def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'loading: ' + (loadError ? loadError.message : 'no activateApp with mount'));
  if (!def || typeof def.mount !== 'function') return;
  const app = box('app');
  def.mount(app, w.api);
  await settle();
  ok(w.created.length === 1, 'it creates one workBench', 'workBench.create calls: ' + w.created.length);
  if (!w.created.length) return;
  const wb = w.created[0];
  const into = wb.into || {};
  ok(/\bfill\b/.test(String(into.className || '')) || (into === app && false), 'the box it hands the workBench takes the shell\'s fill class',
    'the box: ' + short(into.tag || into.className || (into === app ? 'the container itself, unsized' : typeof into)));
  const L = wb.opts.left || []; const R = wb.opts.right || [];
  ok(L.length === 1 && R.length === 1 && [L[0], R[0]].every(function (t) { return t && t.name && t.icon && t.title && typeof t.mount === 'function'; }),
    'one tool on the left strip and one on the right, each with its name, icon, title and mount', 'tools: ' + short({ left: L.map(function (t) { return t && t.name; }), right: R.map(function (t) { return t && t.name; }) }));
  if (L.length !== 1 || R.length !== 1) return;

  test.subHeading('the left tool keeps the app\'s own config');
  const lb = box('left'); L[0].mount(lb); await settle();
  ok(w.loads.indexOf(CONFIG) !== -1, 'at mount it reads ' + CONFIG, 'files read: ' + short(w.loads));
  ok(lb.inputs.length === 1 && /type="checkbox"/.test(lb.inputs[0].tag), 'it draws one checkbox', 'inputs: ' + lb.inputs.length);
  ok(isOn(lb), 'checked, since the config says showDebug true', 'the checkbox is not checked');
  change(lb, false); await settle();
  const saved = w.saves.filter(function (s) { return s.path === CONFIG; }).pop();
  let savedJson = null; try { savedJson = saved && JSON.parse(saved.text); } catch (e) { savedJson = null; }
  ok(savedJson && savedJson.showDebug === false, 'unticking it saves the config with showDebug false', 'saved: ' + short(w.saves));
  ok(w.saves.every(function (s) { return s.path === CONFIG; }), 'it saves nothing anywhere but its own state folder', 'saves: ' + short(w.saves.map(function (s) { return s.path; })));
  change(lb, true); await settle();

  test.subHeading('the right tool sets the server\'s DEBUG state, and follows the stream');
  const rb = box('right'); R[0].mount(rb); await settle();
  ok(rb.inputs.length === 1 && /type="checkbox"/.test(rb.inputs[0].tag), 'it draws one checkbox', 'inputs: ' + rb.inputs.length);
  change(rb, true); await settle();
  const asked = w.verbs.filter(function (v) { return v.name === 'agent.debug'; }).pop();
  ok(asked && asked.args && asked.args.on === true, 'ticking it calls agent.debug {on: true}', 'verbs: ' + short(w.verbs));
  change(rb, false); await settle();
  const asked2 = w.verbs.filter(function (v) { return v.name === 'agent.debug'; }).pop();
  ok(asked2 && asked2.args && asked2.args.on === false, 'unticking it calls agent.debug {on: false}', 'verbs: ' + short(w.verbs));
  ok(w.onJobs.length > 0, 'it listens to the stream', 'no onJobs');
  w.stream(true); await settle();
  ok(isOn(rb), 'the checkbox follows the server\'s state on the stream: on', 'after the stream said on: unchecked');
  w.stream(false); await settle();
  ok(!isOn(rb), 'and off', 'after the stream said off: checked');

  test.subHeading('the title bar says DEBUG only with both on');
  const says = function () { return /DEBUG/.test(w.title()); };
  ok(!says(), 'showDebug on, the server off: no DEBUG in the title', 'title: ' + short(w.title()));
  w.stream(true); await settle();
  ok(says(), 'showDebug on, the server on: the title says DEBUG', 'title: ' + short(w.title()));
  change(lb, false); await settle();
  ok(!says(), 'showDebug off, the server on: no DEBUG', 'title: ' + short(w.title()));
  change(lb, true); await settle();
  ok(says(), 'showDebug on again: DEBUG again', 'title: ' + short(w.title()));
  w.stream(false); await settle();
  ok(!says(), 'the server off again: no DEBUG', 'title: ' + short(w.title()));

  test.subHeading('it bootstraps its own components');
  const w3 = world(null);
  const required = [];
  const def3 = load(w3);
  global.window.spirit.elements = {};
  global.window.spirit.require = function (p) { required.push(String(p)); global.window.spirit.elements.workBench = w3.workBench; return Promise.resolve(true); };
  w3.api.ui.elements = global.window.spirit.elements;
  def3.mount(box('app3'), w3.api); await settle();
  ok(required.indexOf('shell/js/workBench.js') !== -1 && w3.created.length === 1, 'with no workBench on the page it loads shell/js/workBench.js through spirit.require, then builds one',
    'required ' + short(required) + ', workbenches ' + w3.created.length);

  test.subHeading('with no config of its own');
  const w2 = world(null);
  const def2 = load(w2);
  def2.mount(box('app2'), w2.api); await settle();
  const L2 = ((w2.created[0] || {}).opts || {}).left || [];
  const lb2 = box('left2'); if (L2[0]) L2[0].mount(lb2); await settle();
  ok(L2.length === 1 && !isOn(lb2), 'with no config file, showDebug is false: the checkbox is unchecked', 'checkbox: ' + (lb2.inputs[0] ? lb2.inputs[0].checked : 'none'));
  w2.stream(true); await settle();
  ok(!/DEBUG/.test(w2.title()), 'and the title does not say DEBUG, the server on or not', 'title: ' + short(w2.title()));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
