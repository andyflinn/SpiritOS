'use strict';

// spirit/run/spirit/app/agent/test/browserAgent.js
// The tests of spirit/app/agent/browserAgent.js, and of no other module (spec: ./browserAgent.md; goal/G41.1, goal/G43.13). The
// browser file runs in node on a window of its own: the workBench element and the server's family are stubs that keep what the
// app asked of them, and the stream is a function the test calls as the page's data set would. There is no shell on this window:
// a tile hands the app only its container.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'browserAgent.js');
// The agent server's family, as the one family path function names it (goal/G41.12).
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;
const AGENT_FAMILY = familyPath('agent');
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

function world() {
  const w = { created: [], loads: [], saves: [], def: null };
  // The tabContainer in the centre (goal/G41.31), a stand-in: its contract and test are ../../js/test/tabContainer.md. Each tab added
  // mounts at once in a box of its own; its real behaviour is judged in spirit/app/agent/test/agentCentreTabs.js.
  w.tabs = [];
  w.tabContainer = { create: function (into) {
    w.tabsInto = into;
    return { add: function (t) {
      if (w.tabs.some(function (x) { return x.name === t.name; })) return;
      const b = box('tab');
      w.tabs.push({ name: t.name, label: t.label, box: b, made: t.mount(b) });
    }, close: function () {}, rename: function () {} };
  } };
  w.workBench = { create: function (into, opts) {
    const made = { into: into, opts: opts || {}, center: box('center'), press: function () {}, shown: function () { return ''; }, width: function () { return 0; }, destroy: function () {} };
    w.created.push(made); return made;
  } };
  w.fs = {
    loadFile: function (p) { w.loads.push(String(p)); return Promise.resolve(null); },
    saveFile: function (p, text) { w.saves.push({ path: String(p), text: String(text) }); return Promise.resolve({ ok: true }); },
  };
  // The agent server's interface, as spirit.require hands it: its debug call recorded, answered as the server does.
  w.calls = []; w.required = [];
  w.provider = [];
  w.family = { debug: function (args) { w.calls.push(args); return Promise.resolve({ debug: !!(args && args.on) }); },
    provider: function (args) { w.provider.push(args); return Promise.resolve({ ok: true, items: [{ key: 'KP', label: '{}' }], more: false }); } };
  // The server's job as the node's stream hands it to the page's spirit.data, which the jobs family's cache keeps.
  w.stream = function (debug) { w.win.spirit.data.takeJob({ id: 'job-agent', module: 'spirit.app.agent', app: { agent: { debug: debug } } }); };
  return w;
}
// The app loaded on a window of its own, with this world's stubs.
function load(w) {
  global.window = { spirit: { get element() { return this.elements; }, elements: { workBench: w.workBench, tabContainer: w.tabContainer }, fs: w.fs, escapeHtml: function (s) { return String(s); }, familyPath: familyPath, isBrowser: function () { return true; },
    require: function (p) { w.required.push(String(p)); return Promise.resolve(p === AGENT_FAMILY ? w.family : true); },
    // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
    cacheManager: function (name) {
      w.managers = (w.managers || []).concat(name);
      vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
      return Promise.resolve(true);
    } } };
  global.window.spirit.ready = Promise.resolve(Object.assign(Object.create(global.window.spirit), { agent: w.family }));
  global.spirit = global.window.spirit;
  w.win = global.window;
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: 'KEY+AGENT/APP==' };
  global.window.spirit.data.homeNode(global.window.spirit.node.key);
  global.document = { createElement: function () { return box('made'); }, addEventListener: function () {}, removeEventListener: function () {} };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  return global.window.spirit.elements.agent;
}

test.startTest('browserAgent.js: the agent face app');
// An app that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its files');
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/agent/browserAgent.js is not there'); return; }
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  ok(manifest.node && manifest.node.mount === true && manifest.shell && manifest.shell.mount === true && !('server' in manifest), 'its manifest has the new shape: it mounts on the node and on the shell', 'agent.json: ' + short(manifest));

  test.subHeading('it mounts one workBench into a box of the whole app area');
  const w = world();
  let def = null; let loadError = null;
  try { def = load(w); } catch (e) { loadError = e; }
  // The box: "spirit.elements.agent.create(container) answers { destroy() }", "Its activateApp goes". This window has no shell, so a call to it throws.
  ok(!loadError && def && typeof def.create === 'function', 'it is an element: spirit.elements.agent has create', 'loading: ' + (loadError ? loadError.message : 'no spirit.elements.agent.create'));
  if (!def || typeof def.create !== 'function') return;
  const app = box('app');
  const made0 = def.create(app);
  await settle();
  ok(!!made0 && typeof made0.destroy === 'function', 'create answers { destroy() }', 'create answered: ' + short(made0));
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
  const LEFT = TABLES.slice();
  // goal/G41.21: "The right strip gets its first real tool: the bundle editor ... It joins the agent server's DEBUG box".
  const CHAT_TOOL = L.filter(function (t) { return t && t.icon === '💬'; });
  ok(JSON.stringify(L.map(function (t) { return t && t.name; }).filter(function (n) { return LEFT.indexOf(n) !== -1; })) === JSON.stringify(LEFT) && R.length === 2 && R.some(function (t) { return t && t.name === 'server'; }) &&
    L.concat(R).every(function (t) { return t && t.name && t.icon && t.title && typeof t.mount === 'function'; }),
    'the left strip holds one tool per table (' + TABLES.join(', ') + '), no grant; the right two tools, the server\'s and one more; each with its name, icon, title and mount',
    'tools: ' + short({ left: L.map(function (t) { return t && t.name; }), right: R.map(function (t) { return t && t.name; }) }));
  ok(new Set(L.map(function (t) { return t && t.icon; })).size === L.length, 'every left tool has an icon of its own', 'icons: ' + short(L.map(function (t) { return t && t.icon; })));
  ok(!/grantsPanel|table\/grant\b|agent\.grant/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'the app names no grants panel and no grant table any more (goal/G41.21)', 'spirit/app/agent/agent.js still names the grant table or the grants panel');
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
    ok(asked.indexOf('spirit/app/agent/table/' + name + '/elementTable.js') !== -1 && /\bfill\b/.test(tb.className),
      'the ' + name + ' tool requires spirit/app/agent/table/' + name + '/elementTable.js into a fill box', 'required ' + short(asked) + ', class ' + short(tb.className));
    const d = made[0] && made[0].detail;
    ok(made.length === 1 && made[0].into === tb && !!made[0].api && typeof made[0].api.verb === 'function' && d && typeof d.open === 'function' && typeof d.look === 'function',
      'and creates ' + name + 'Table once in that box, with an object holding verb and its detail pane', 'created: ' + made.length + ', api: ' + short(made[0] && Object.keys(made[0].api || {})));
    if (name === 'provider' && made[0] && made[0].api && typeof made[0].api.verb === 'function') {
      // The box: "one small object of its own, { verb }, calling the same server verbs". A list reads { status, body } (probabilitySearch).
      const got = await made[0].api.verb('agent.provider', { op: 'search', text: 'zz' });
      ok(w.provider.length === 1 && w.provider[0].text === 'zz', 'its verb calls the server\'s own verb, with the arguments given', 'server asked: ' + short(w.provider));
      ok(!!got && got.status === 200 && !!got.body && Array.isArray(got.body.items) && got.body.items[0].key === 'KP', 'and answers as a list reads it, { status: 200, body }', 'it answered: ' + short(got));
    }
    const look = d && d.look(name);
    ok(look && look.icon === t.icon && look.name && look.title === t.title, 'the detail pane\'s look of ' + name + ' is its tool\'s icon and title, and its one name', 'look: ' + short(look));
  }

  test.subHeading('💬 Select Persona: a personaSelector:pane, a persona picked opens its chat in the centre (goal/G41.26)');
  // Andy, box: "this new panel, below the title contains, for now, only a personaSelector:pane", "When the user clicks on
  // a persona in the left hand \"💬 Select Persona\" pane, the chat pane shows up in the center pane of workBench".
  // A personaSelector:pane is the persona table's probabilitySearch in pane mode (rule/29), the agent tables' own
  // (spirit/app/agent/table/tableElement.js, agentDetail.search); the chat pane is spirit/app/agent/chatPane.js, tested in
  // its own file.
  if (CHAT_TOOL.length === 1) {
    const sels = [];
    const chats = [];
    const prevDetail = global.window.spirit.elements.agentDetail;
    global.window.spirit.elements.agentDetail = Object.assign({}, prevDetail || {}, { branchOf: function (table) { return 'agent/' + table; },
      titleRow: function (look, names) { return '<div class="agent-title"><span>' + (look && look.icon || '') + '</span> ' + (names || []).join(' ') + '</div>'; },
      search: function (host, o, more) { const s2 = { host: host, o: o, more: more || {}, refresh: function () {}, destroy: function () {} }; sels.push(s2); return s2; },
    });
    global.window.spirit.elements.chatPane = { create: function (into, opts) { const c = { into: into, opts: opts || {}, destroy: function () { c.destroyed = true; } }; chats.push(c); return c; } };
    const before = w.required.length;
    const cb = box('chat'); CHAT_TOOL[0].mount(cb); await settle();
    const asked = w.required.slice(before);
    ok(asked.indexOf('spirit/app/agent/table/tableElement.js') !== -1, 'its mount loads the agent tables\' element itself (rule/26)', 'required: ' + short(asked));
    ok(/class="agent-title"/.test(cb.innerHTML) && cb.innerHTML.indexOf('💬') !== -1 && /Select Persona/.test(cb.innerHTML), 'its panel is titled 💬 Select Persona', 'panel: ' + short(cb.innerHTML));
    const sel = sels[0];
    ok(sels.length === 1 && sel.o && sel.o.table === 'persona' && !!sel.o.api && typeof sel.o.api.verb === 'function' && sel.more.face === 'pane' && typeof sel.more.pick === 'function',
      'below the title, only a personaSelector:pane: the persona table\'s search in pane mode, with an object holding verb', 'selectors: ' + short(sels.map(function (x) { return { table: x.o && x.o.table, face: x.more.face }; })));
    ok(!!sel && !!sel.host && sel.host !== cb && !/Add a persona/.test(cb.innerHTML), 'in a box of its own, not over the title, with no Add', 'panel: ' + short(cb.innerHTML));
    if (sel && typeof sel.more.pick === 'function') {
      const cBefore = w.required.length;
      sel.more.pick({ id: 'KA', label: 'Ada <the reviewer>' }, 'KA'); await settle();
      ok(w.required.slice(cBefore).indexOf('spirit/app/agent/chatPane.js') !== -1, 'a persona picked loads spirit/app/agent/chatPane.js', 'required: ' + short(w.required.slice(cBefore)));
      const tab = w.tabs.filter(function (t) { return t.name === 'chat/KA'; })[0];
      ok(w.tabsInto === wb.center, 'the centre holds the tabContainer', 'tabs in: ' + short(w.tabsInto && w.tabsInto.tag));
      ok(chats.length === 1 && !!tab && chats[0].into === tab.box && chats[0].opts.persona && chats[0].opts.persona.id === 'KA' && chats[0].opts.persona.label === 'Ada <the reviewer>',
        'and opens the chat pane in a tab of the workBench\'s centre, for that persona', 'chat panes: ' + short(chats.map(function (c) { return { persona: c.opts.persona }; })));
      sel.more.pick({ id: 'KB', label: 'Bea' }, 'KB'); await settle();
      ok(chats.length === 2 && chats[0].destroyed !== true && chats[1].opts.persona.id === 'KB', 'another persona picked opens its own chat in a tab beside the first (goal/G41.31)', 'chat panes: ' + short(chats.map(function (c) { return { id: c.opts.persona && c.opts.persona.id, destroyed: !!c.destroyed }; })));
    }
    global.window.spirit.elements.agentDetail = prevDetail;
    delete global.window.spirit.elements.chatPane;
  }

  test.subHeading('the right strip\'s bundle editor (goal/G41.21)');
  // Box v17: "the bundle editor (shell/js/bundleEditor.js, the shell element that lists, makes and edits bundles)".
  {
    const before = w.required.length;
    const editors = [];
    global.window.spirit.element.bundleEditor = { create: function (into, cfg) { editors.push({ into: into, cfg: cfg || {} }); return { destroy: function () {} }; } };
    const bb = box('bundles'); BUNDLE_TOOL.mount(bb); await settle();
    const asked = w.required.slice(before);
    ok(asked.indexOf('spirit/element/bundleEditor.js') !== -1, 'its mount requires spirit/element/bundleEditor.js', 'required: ' + short(asked));
    ok(editors.length === 1 && editors[0].into === bb, 'and makes the bundle editor in the box it is handed', 'bundle editors: ' + editors.length);
    delete global.window.spirit.element.bundleEditor;
  }

  test.subHeading('the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json"');
  const source = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/showDebug/.test(source) && !/relay-state/.test(source) && !/setScreenTitle/.test(source), 'the app\'s code names no showDebug, no relay-state and no title of the old shell', 'browserAgent.js still names one');
  ok(!/activateApp/.test(source), 'and no activateApp', 'browserAgent.js still names activateApp');
  ok(!w.saves.length, 'opening the app saves no file', 'saved: ' + short(w.saves));

  // goal/G43.15, Andy: "WHY WOULD THE FUCKING agent server have a separate debug switch, it belongs to the node, and should work like
  // any other servers debug switch.", and "on the right icon strip the ⚙ icon instead of 🐞, and that panel will show...".
  test.subHeading('the box: "On the agent\'s right icon strip, the server\'s tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG"');
  ok(!!SERVER_TOOL && /⚙/.test(String(SERVER_TOOL.icon)) && !/🐞/.test(String(SERVER_TOOL.icon)), 'the server\'s tool on the right strip takes ⚙', 'its icon: ' + short(SERVER_TOOL && SERVER_TOOL.icon));
  const debugs = [];
  const made = [];
  global.window.spirit.elements.serverDEBUG = { create: function (into, o) { debugs.push({ into: into, o: o || {} }); made.push('serverDEBUG'); return { destroy: function () {} }; } };
  // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG".
  ['changeAppIcon', 'changeAppLabel'].forEach(function (n) { global.window.spirit.elements[n] = { create: function (into, o) { made.push(n + ':' + ((o || {}).key || '')); return { destroy: function () {} }; } }; });
  const callsBefore = w.calls.length;
  var rb = box('right'); SERVER_TOOL.mount(rb); await settle();
  ok(w.required.indexOf('spirit/app/appSelector/serverDEBUG.js') !== -1, 'its mount loads spirit/app/appSelector/serverDEBUG.js through spirit.require', 'required: ' + short(w.required));
  ok(debugs.length === 1 && debugs[0].o.key === 'agent', 'and makes serverDEBUG for the agent', 'serverDEBUGs: ' + short(debugs.map(function (d) { return { here: d.into === rb, key: d.o.key }; })));
  ok(rb.inputs.length === 0, 'it draws no checkbox of its own', 'inputs: ' + rb.inputs.length);
  ok(w.calls.length === callsBefore, 'and calls no debug verb of the agent\'s', 'debug calls: ' + short(w.calls.slice(callsBefore)));
  ok(!/\.debug\(/.test(source), 'the app\'s code calls no agent debug verb', 'browserAgent.js still calls .debug(');
  ok(['spirit/app/appSelector/changeAppIcon.js', 'spirit/app/appSelector/changeAppLabel.js'].every(function (p) { return w.required.indexOf(p) !== -1; }), 'its mount loads changeAppIcon.js and changeAppLabel.js', 'required: ' + short(w.required));
  ok(JSON.stringify(made) === JSON.stringify(['changeAppIcon:agent', 'changeAppLabel:agent', 'serverDEBUG']), 'and makes the icon, then the label, for the agent, above serverDEBUG', 'made, in order: ' + short(made));
  delete global.window.spirit.elements.serverDEBUG;
  delete global.window.spirit.elements.changeAppIcon;
  delete global.window.spirit.elements.changeAppLabel;

  test.subHeading('it bootstraps its own components');
  const w3 = world();
  const required = [];
  const def3 = load(w3);
  global.window.spirit.elements = {};
  global.window.spirit.require = function (p) { required.push(String(p)); global.window.spirit.element.workBench = w3.workBench; global.window.spirit.element.tabContainer = w3.tabContainer; return Promise.resolve(true); };
  def3.create(box('app3')); await settle();
  ok(required.indexOf('spirit/element/workBench.js') !== -1 && w3.created.length === 1, 'with no workBench on the page it loads spirit/element/workBench.js through spirit.require, then builds one',
    'required ' + short(required) + ', workbenches ' + w3.created.length);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
