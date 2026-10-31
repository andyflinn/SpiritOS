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
// The agent server's family, as the one family path function names it (goal/G41.12).
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;
const AGENT_FAMILY = familyPath('agent');
const BUG = '🐞';
// The tables of agent.db, in the order of their left tools (goal/G41.4, box v22).
// goal/G41.21 (box v17): "agent.grant is removed altogether: its table, its server, and the Grants tool in the left strip".
const TABLES = ['provider', 'model', 'persona', 'job'];

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
  // The agent server's interface, as spirit.require hands it: its debug call recorded, answered as the server does.
  w.calls = []; w.required = [];
  w.family = { debug: function (args) { w.calls.push(args); return Promise.resolve({ debug: !!(args && args.on) }); } };
  w.stream = function (debug) { const job = { id: 'job-agent', app: { agent: { debug: debug } } }; const all = { 'job-agent': job }; w.onJobs.forEach(function (fn) { fn(all, job, { visible: true }); }); };
  // What the shell hands a new reader at once: the whole set of jobs, and no single job that changed.
  w.snapshot = function (debug) { const all = { 'job-agent': { id: 'job-agent', app: { agent: { debug: debug } } } }; w.onJobs.forEach(function (fn) { fn(all, null, { visible: true }); }); };
  w.title = function () { return w.titles.length ? w.titles[w.titles.length - 1] : ''; };
  return w;
}
// The app loaded on a window of its own, with this world's stubs.
function load(w) {
  global.window = { spirit: { shell: { activateApp: function (def) { w.def = def; } }, elements: { workBench: w.workBench }, fs: w.fs, escapeHtml: function (s) { return String(s); }, familyPath: familyPath,
    require: function (p) { w.required.push(String(p)); return Promise.resolve(p === AGENT_FAMILY ? w.family : true); } } };
  global.spirit = global.window.spirit;
  global.document = { createElement: function () { return box('made'); }, addEventListener: function () {}, removeEventListener: function () {} };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  return w.def;
}

test.startTest('agent.js: the agent face app');
// An app that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its files');
  if (!fs.existsSync(FILE)) { test.fail('shell/agent/agent.js is not there'); return; }
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  ok(manifest.server === 'agent', 'its manifest names its server, agent', 'agent.json: ' + short(manifest));
  // Its face mark is each node's own (goal/G41.1, box v16-v17): no sidecar beside its code, and none tracked.
  ok(!fs.existsSync(path.join(DIR, 'agent.js.sidecar.json')), 'no sidecar beside its code: whether a node shows it is that node\'s own state', 'shell/agent/agent.js.sidecar.json is there');

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
  // The app's own tool, then one per table of agent.db (goal/G41.4, box v22: "every one of these tables will come with a
  // left-edge icon that puts up a panel in the left-side tool-display of the workBench UI used in this app").
  // goal/G41.26, Andy, box: "the left site icon strip gains a [chat] icon, that opens the following, NEW panel, titled:
  // \"💬 Select Persona\"". Its place in the strip is not said; it is the one tool that is neither the app's nor a table's.
  const LEFT = ['app'].concat(TABLES);
  // goal/G41.21: "The right strip gets its first real tool: the bundle editor ... It joins the agent server's DEBUG box".
  const CHAT_TOOL = L.filter(function (t) { return t && LEFT.indexOf(t.name) === -1; });
  ok(JSON.stringify(L.map(function (t) { return t && t.name; }).filter(function (n) { return LEFT.indexOf(n) !== -1; })) === JSON.stringify(LEFT) && R.length === 2 && R.some(function (t) { return t && t.name === 'server'; }) &&
    L.concat(R).every(function (t) { return t && t.name && t.icon && t.title && typeof t.mount === 'function'; }),
    'the left strip holds the app\'s tool, then one per table (' + TABLES.join(', ') + '), no grant; the right two tools, the server\'s and one more; each with its name, icon, title and mount',
    'tools: ' + short({ left: L.map(function (t) { return t && t.name; }), right: R.map(function (t) { return t && t.name; }) }));
  ok(new Set(L.map(function (t) { return t && t.icon; })).size === L.length, 'every left tool has an icon of its own', 'icons: ' + short(L.map(function (t) { return t && t.icon; })));
  ok(!/grantsPanel|table\/grant\b|agent\.grant/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'the app names no grants panel and no grant table any more (goal/G41.21)', 'shell/agent/agent.js still names the grant table or the grants panel');
  ok(CHAT_TOOL.length === 1 && CHAT_TOOL[0].icon === '💬' && CHAT_TOOL[0].title === 'Select Persona', 'and one more left tool: 💬, titled Select Persona (goal/G41.26)', 'other left tools: ' + short(CHAT_TOOL.map(function (t) { return { name: t.name, icon: t.icon, title: t.title }; })));
  if (R.length !== 2) return;
  const SERVER_TOOL = R.filter(function (t) { return t.name === 'server'; })[0];
  const BUNDLE_TOOL = R.filter(function (t) { return t.name !== 'server'; })[0];

  test.subHeading('each table\'s tool mounts that table\'s own element');
  for (const name of TABLES) {
    const t = L.filter(function (x) { return x.name === name; })[0];
    const before = w.required.length;
    const made = [];
    global.window.spirit.elements[name + 'Table'] = { create: function (into, api, detail) { made.push({ into: into, api: api, detail: detail }); return { refresh: function () {}, destroy: function () {} }; } };
    const tb = box('table-' + name); t.mount(tb); await settle();
    const asked = w.required.slice(before);
    ok(asked.indexOf('process/js/agent/table/' + name + '/elementTable.js') !== -1 && /\bfill\b/.test(tb.className),
      'the ' + name + ' tool requires process/js/agent/table/' + name + '/elementTable.js into a fill box', 'required ' + short(asked) + ', class ' + short(tb.className));
    const d = made[0] && made[0].detail;
    ok(made.length === 1 && made[0].into === tb && made[0].api === w.api && d && typeof d.open === 'function' && typeof d.look === 'function',
      'and creates ' + name + 'Table once in that box, with the app\'s api and its detail pane', 'created: ' + made.length);
    const look = d && d.look(name);
    ok(look && look.icon === t.icon && look.name && look.title === t.title, 'the detail pane\'s look of ' + name + ' is its tool\'s icon and title, and its one name', 'look: ' + short(look));
  }

  test.subHeading('💬 Select Persona: a personaSelector:pane, a persona picked opens its chat in the centre (goal/G41.26)');
  // Andy, box: "this new panel, below the title contains, for now, only a personaSelector:pane", "When the user clicks on
  // a persona in the left hand \"💬 Select Persona\" pane, the chat pane shows up in the center pane of workBench".
  // A personaSelector:pane is the persona table's probabilitySearch in pane mode (rule/29), the agent tables' own
  // (process/js/agent/table/tableElement.js, agentDetail.search); the chat pane is shell/agent/chatPane.js, tested in
  // its own file.
  if (CHAT_TOOL.length === 1) {
    const sels = [];
    const chats = [];
    const prevDetail = global.window.spirit.elements.agentDetail;
    global.window.spirit.elements.agentDetail = Object.assign({}, prevDetail || {}, {
      titleRow: function (look, names) { return '<div class="agent-title"><span>' + (look && look.icon || '') + '</span> ' + (names || []).join(' ') + '</div>'; },
      search: function (host, o, more) { const s2 = { host: host, o: o, more: more || {}, refresh: function () {}, destroy: function () {} }; sels.push(s2); return s2; },
    });
    global.window.spirit.elements.chatPane = { create: function (into, opts) { const c = { into: into, opts: opts || {}, destroy: function () { c.destroyed = true; } }; chats.push(c); return c; } };
    const before = w.required.length;
    const cb = box('chat'); CHAT_TOOL[0].mount(cb); await settle();
    const asked = w.required.slice(before);
    ok(asked.indexOf('process/js/agent/table/tableElement.js') !== -1, 'its mount loads the agent tables\' element itself (rule/26)', 'required: ' + short(asked));
    ok(/class="agent-title"/.test(cb.innerHTML) && cb.innerHTML.indexOf('💬') !== -1 && /Select Persona/.test(cb.innerHTML), 'its panel is titled 💬 Select Persona', 'panel: ' + short(cb.innerHTML));
    const sel = sels[0];
    ok(sels.length === 1 && sel.o && sel.o.table === 'persona' && sel.o.api === w.api && sel.more.face === 'pane' && typeof sel.more.pick === 'function',
      'below the title, only a personaSelector:pane: the persona table\'s search in pane mode, with the app\'s api', 'selectors: ' + short(sels.map(function (x) { return { table: x.o && x.o.table, face: x.more.face }; })));
    ok(!!sel && !!sel.host && sel.host !== cb && !/Add a persona/.test(cb.innerHTML), 'in a box of its own, not over the title, with no Add', 'panel: ' + short(cb.innerHTML));
    if (sel && typeof sel.more.pick === 'function') {
      const cBefore = w.required.length;
      sel.more.pick({ id: 'KA', label: 'Ada <the reviewer>' }, 'KA'); await settle();
      ok(w.required.slice(cBefore).indexOf('shell/agent/chatPane.js') !== -1, 'a persona picked loads shell/agent/chatPane.js', 'required: ' + short(w.required.slice(cBefore)));
      ok(chats.length === 1 && chats[0].into === wb.center && chats[0].opts.persona && chats[0].opts.persona.id === 'KA' && chats[0].opts.persona.label === 'Ada <the reviewer>',
        'and opens the chat pane in the workBench\'s centre, for that persona', 'chat panes: ' + short(chats.map(function (c) { return { centre: c.into === wb.center, persona: c.opts.persona }; })));
      sel.more.pick({ id: 'KB', label: 'Bea' }, 'KB'); await settle();
      ok(chats.length === 2 && chats[0].destroyed === true && chats[1].opts.persona.id === 'KB', 'another persona picked opens its own chat in place of the first', 'chat panes: ' + short(chats.map(function (c) { return { id: c.opts.persona && c.opts.persona.id, destroyed: !!c.destroyed }; })));
    }
    global.window.spirit.elements.agentDetail = prevDetail;
    delete global.window.spirit.elements.chatPane;
  }

  test.subHeading('the right strip\'s bundle editor (goal/G41.21)');
  // Box v17: "the bundle editor (shell/js/bundleEditor.js, the shell element that lists, makes and edits bundles)".
  {
    const before = w.required.length;
    const editors = [];
    global.window.spirit.elements.bundleEditor = { create: function (into, cfg) { editors.push({ into: into, cfg: cfg || {} }); return { destroy: function () {} }; } };
    const bb = box('bundles'); BUNDLE_TOOL.mount(bb); await settle();
    const asked = w.required.slice(before);
    ok(asked.indexOf('shell/js/bundleEditor.js') !== -1, 'its mount requires shell/js/bundleEditor.js', 'required: ' + short(asked));
    ok(editors.length === 1 && editors[0].into === bb && editors[0].cfg.api === w.api, 'and makes the bundle editor in the box it is handed, with the app\'s api', 'bundle editors: ' + short(editors.map(function (x) { return { here: x.into === bb, api: x.cfg.api === w.api }; })));
    delete global.window.spirit.elements.bundleEditor;
  }

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
  const rb = box('right'); SERVER_TOOL.mount(rb); await settle();
  ok(rb.inputs.length === 1 && /type="checkbox"/.test(rb.inputs[0].tag), 'it draws one checkbox', 'inputs: ' + rb.inputs.length);
  change(rb, true); await settle();
  const asked = w.calls[w.calls.length - 1];
  ok(w.required.indexOf(AGENT_FAMILY) !== -1 && asked && asked.on === true, 'ticking it requires the agent server\'s interface through spirit and calls its debug {on: true}',
    'required ' + short(w.required) + ', debug calls ' + short(w.calls));
  ok(!w.verbs.length, 'nothing goes out as a raw verb', 'api.verb calls: ' + short(w.verbs));
  ok(!isOn(rb), 'until the stream says so, the checkbox shows the state last streamed, not the click', 'after the tick, with nothing streamed: checked');
  change(rb, false); await settle();
  const asked2 = w.calls[w.calls.length - 1];
  ok(asked2 && asked2.on === false, 'unticking it calls debug {on: false}', 'debug calls: ' + short(w.calls));
  ok(w.onJobs.length > 0, 'it listens to the stream', 'no onJobs');
  w.stream(true); await settle();
  ok(isOn(rb), 'the checkbox follows the server\'s state on the stream: on', 'after the stream said on: unchecked');
  w.stream(false); await settle();
  ok(!isOn(rb), 'and off', 'after the stream said off: checked');

  test.subHeading('the title bar shows the bug only with both on');
  const says = function () { return w.title().indexOf(BUG) !== -1; };
  ok(!says(), 'showDebug on, the server off: no bug in the title', 'title: ' + short(w.title()));
  w.stream(true); await settle();
  ok(says(), 'showDebug on, the server on: the title shows the bug ' + BUG, 'title: ' + short(w.title()));
  change(lb, false); await settle();
  ok(!says(), 'showDebug off, the server on: no bug', 'title: ' + short(w.title()));
  change(lb, true); await settle();
  ok(says(), 'showDebug on again: the bug again', 'title: ' + short(w.title()));
  w.stream(false); await settle();
  ok(!says(), 'the server off again: no bug', 'title: ' + short(w.title()));

  test.subHeading('the state streamed before it opened is there at once');
  const w4 = world(JSON.stringify({ showDebug: true }));
  const def4 = load(w4);
  def4.mount(box('app4'), w4.api); await settle();
  w4.snapshot(true); await settle();
  const R4 = ((w4.created[0] || {}).opts || {}).right || [];
  const L4 = ((w4.created[0] || {}).opts || {}).left || [];
  const rb4 = box('right4'); if (R4[0]) R4[0].mount(rb4);
  if (L4[0]) L4[0].mount(box('left4'));
  await settle();
  ok(isOn(rb4), 'handed the whole set of jobs with no single one, the right checkbox shows the server on', 'right checkbox: ' + (rb4.inputs[0] ? rb4.inputs[0].checked : 'none'));
  ok(w4.title().indexOf(BUG) !== -1, 'and the title shows the bug', 'title: ' + short(w4.title()));

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
  // The app's tool, one per table, and 💬 Select Persona (goal/G41.26).
  ok(L2.length === 2 + TABLES.length && !isOn(lb2), 'with no config file, showDebug is false: the checkbox is unchecked', 'checkbox: ' + (lb2.inputs[0] ? lb2.inputs[0].checked : 'none'));
  w2.stream(true); await settle();
  ok(w2.title().indexOf(BUG) === -1, 'and the title shows no bug, the server on or not', 'title: ' + short(w2.title()));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
