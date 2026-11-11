'use strict';

// spirit/run/spirit/app/agent/test/element.js
// The tests of spirit/app/agent/element.js, and of no other module (spec: ./browserAgent.md; goal/G41.1, goal/G43.13). The
// browser file runs in node on a window of its own: the workBench element and the server's family are stubs that keep what the
// app asked of them, and the stream is a function the test calls as the page's data set would. There is no shell on this window:
// a tile hands the app only its container. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'element.js');
// The agent server's family, as the one family path function names it (goal/G41.12).
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const AGENT_FAMILY = familyPath('agent');
// The tables of agent.db, in the order of their left tools (goal/G41.4, box v22).
// goal/G41.21 (box v17): "agent.grant is removed altogether: its table, its server, and the Grants tool in the left strip".
const TABLES = ['provider', 'model', 'persona', 'job'];

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
  // The tabContainer in the centre (goal/G41.31), a stand-in: its contract and test are spirit/element/test/tabContainer.md. Each tab added
  // mounts at once in a box of its own; its real behaviour is judged in spirit/app/agent/test/agent.js, its centreTabs part.
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
  // goal/G43.32: the parts stand where the app reads them, at spirit.element.<their path>.
  global.window = { spirit: { element: { spirit: { element: { workBench: w.workBench, tabContainer: w.tabContainer, search: { app: {} } }, app: { agent: {} } } }, fs: w.fs, escapeHtml: function (s) { return String(s); }, familyPath: familyPath, isBrowser: function () { return true; },
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
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so the app places itself by installSpiritElement as it runs.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  // Its tables' elements stand under it, in spirit/app/agent/element/table/ (goal/G43.32, rule 5); the test hands its own there.
  const placed = global.window.spirit.element.spirit.app.agent.element;
  if (placed && !placed.table) placed.table = {};
  return placed;
}

// What the tests make, for the tests after them.
const X = { w: null, def: null, made0: null, wb: null, L: [], R: [], CHAT_TOOL: [], SERVER_TOOL: null, BUNDLE_TOOL: null };
const NO_APP = 'no app element: it did not load';
const NO_BENCH = 'no workBench: the app made none';
const NO_TOOLS = 'no right tools: the app made other than two';

// ── its files ──
test.run('its manifest has the new shape: it mounts on the node and on the shell', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/element.js is not there';
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  return manifest.node && manifest.node.mount === true && manifest.shell && manifest.shell.mount === true && !('server' in manifest) ? true : 'agent.json: ' + short(manifest);
}, 1000);

// ── it mounts one workBench into a box of the whole app area ──
// The box: "spirit.element.spirit.app.agent.element.create(container) answers { destroy() }", "Its activateApp goes". This window has no shell, so a call to it throws.
test.run('it is an element: spirit.element.spirit.app.agent.element has create', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/element.js is not there';
  X.w = world();
  let loadError = null;
  try { X.def = load(X.w); } catch (e) { loadError = e; }
  return !loadError && X.def && typeof X.def.create === 'function' ? true : 'loading: ' + (loadError ? loadError.message : 'no spirit.element.spirit.app.agent.element.create');
}, 1000);
test.run('create answers { destroy() }', 0.2, async function () {
  if (!X.def || typeof X.def.create !== 'function') return NO_APP;
  X.app = box('app');
  X.made0 = X.def.create(X.app);
  await settle();
  return !!X.made0 && typeof X.made0.destroy === 'function' ? true : 'create answered: ' + short(X.made0);
}, 1000);
test.run('it creates one workBench', 0.2, function () {
  if (!X.w) return NO_APP;
  const w = X.w;
  if (w.created.length) {
    X.wb = w.created[0];
    X.L = X.wb.opts.left || []; X.R = X.wb.opts.right || [];
    // goal/G41.21: "The right strip gets its first real tool: the bundle editor ... It joins the agent server's DEBUG box".
    X.CHAT_TOOL = X.L.filter(function (t) { return t && t.icon === '💬'; });
    X.SERVER_TOOL = X.R.filter(function (t) { return t.name === 'server'; })[0];
    X.BUNDLE_TOOL = X.R.filter(function (t) { return t.name !== 'server'; })[0];
  }
  return w.created.length === 1 ? true : 'workBench.create calls: ' + w.created.length;
}, 1000);
test.run('the box it hands the workBench takes the shell\'s fill class', 0.2, function () {
  if (!X.wb) return NO_BENCH;
  const into = X.wb.into || {};
  return (/\bfill\b/).test(String(into.className || '')) || (into === X.app && false) ? true : 'the box: ' + short(into.tag || into.className || (into === X.app ? 'the container itself, unsized' : typeof into));
}, 1000);
// One per table of agent.db (goal/G41.4, box v22: "every one of these tables will come with a
// left-edge icon that puts up a panel in the left-side tool-display of the workBench UI used in this app").
// goal/G41.26, Andy, box: "the left site icon strip gains a [chat] icon, that opens the following, NEW panel, titled:
// \"💬 Select Persona\"". Its place in the strip is not said; it is the one left tool that is not a table's.
test.run('the left strip holds one tool per table, provider, model, persona and job, and no grant; the right two tools, the server\'s and one more; each with its name, icon, title and mount', 0.2, function () {
  if (!X.wb) return NO_BENCH;
  const L = X.L, R = X.R, LEFT = TABLES.slice();
  return JSON.stringify(L.map(function (t) { return t && t.name; }).filter(function (n) { return LEFT.indexOf(n) !== -1; })) === JSON.stringify(LEFT) && R.length === 2 && R.some(function (t) { return t && t.name === 'server'; }) &&
    L.concat(R).every(function (t) { return t && t.name && t.icon && t.title && typeof t.mount === 'function'; })
    ? true : 'tools: ' + short({ left: L.map(function (t) { return t && t.name; }), right: R.map(function (t) { return t && t.name; }) });
}, 1000);
test.run('every left tool has an icon of its own', 0.2, function () {
  if (!X.wb) return NO_BENCH;
  const L = X.L;
  return new Set(L.map(function (t) { return t && t.icon; })).size === L.length ? true : 'icons: ' + short(L.map(function (t) { return t && t.icon; }));
}, 1000);
test.run('the app names no grants panel and no grant table any more (goal/G41.21)', 0.2, function () {
  return !/grantsPanel|table\/grant\b|agent\.grant/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')) ? true : 'spirit/app/agent/agent.js still names the grant table or the grants panel';
}, 1000);
test.run('and one more left tool: 💬, titled Select Persona (goal/G41.26)', 0.2, function () {
  if (!X.wb) return NO_BENCH;
  const CHAT_TOOL = X.CHAT_TOOL;
  return CHAT_TOOL.length === 1 && CHAT_TOOL[0].icon === '💬' && CHAT_TOOL[0].title === 'Select Persona' ? true : 'other left tools: ' + short(CHAT_TOOL.map(function (t) { return { name: t.name, icon: t.icon, title: t.title }; }));
}, 1000);

// ── each table's tool mounts that table's own element ──
const CODE = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
test.run('it makes no api for its tables: each list asks agent.<table> through the spirit object itself (goal/G43.24)', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  return !/\bapi\b/.test(CODE) ? true : 'element.js still makes or hands an api';
}, 1000);
// One table at a time, each check its own plain title (goal/G45.6: a title has no value built into it).
async function mountTable(name) {
  const w = X.w, L = X.L;
  const t = L.filter(function (x) { return x.name === name; })[0];
  const before = w.required.length;
  const made = [];
  global.window.spirit.element.spirit.app.agent.element.table[name] = { elementTable: { create: function (into, detail) { made.push({ into: into, detail: detail, handed: arguments.length }); return { refresh: function () {}, destroy: function () {} }; } } };
  const tb = box('table-' + name); t.mount(tb); await settle();
  const asked = w.required.slice(before);
  const d = made[0] && made[0].detail;
  const look = d && d.look(name);
  return {
    required: asked.indexOf('spirit/app/agent/element/table/' + name + '/elementTable.js') !== -1 && /\bfill\b/.test(tb.className),
    requiredSays: 'required ' + short(asked) + ', class ' + short(tb.className),
    // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
    // needs...."): the table is handed its box and the detail pane, no api; its list asks agent.<table> itself.
    created: made.length === 1 && made[0].into === tb && made[0].handed === 2 && d && typeof d.open === 'function' && typeof d.look === 'function',
    createdSays: 'created: ' + made.length + ', handed ' + (made[0] && made[0].handed) + ' arguments',
    looks: !!(look && look.icon === t.icon && look.name && look.title === t.title),
    looksSays: 'look: ' + short(look),
  };
}
const MT = {};
test.run('the provider tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  MT.provider = await mountTable('provider');
  return MT.provider.required ? true : MT.provider.requiredSays;
}, 1000);
test.run('and creates the provider table once in that box, with its detail pane and no api', 0.2, function () { if (!MT.provider) return NO_TOOLS; return MT.provider.created ? true : MT.provider.createdSays; }, 1000);
test.run('the detail pane\'s look of a provider is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.provider) return NO_TOOLS; return MT.provider.looks ? true : MT.provider.looksSays; }, 1000);
test.run('the model tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  MT.model = await mountTable('model');
  return MT.model.required ? true : MT.model.requiredSays;
}, 1000);
test.run('and creates the model table once in that box, with its detail pane and no api', 0.2, function () { if (!MT.model) return NO_TOOLS; return MT.model.created ? true : MT.model.createdSays; }, 1000);
test.run('the detail pane\'s look of a model is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.model) return NO_TOOLS; return MT.model.looks ? true : MT.model.looksSays; }, 1000);
test.run('the persona tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  MT.persona = await mountTable('persona');
  return MT.persona.required ? true : MT.persona.requiredSays;
}, 1000);
test.run('and creates the persona table once in that box, with its detail pane and no api', 0.2, function () { if (!MT.persona) return NO_TOOLS; return MT.persona.created ? true : MT.persona.createdSays; }, 1000);
test.run('the detail pane\'s look of a persona is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.persona) return NO_TOOLS; return MT.persona.looks ? true : MT.persona.looksSays; }, 1000);
test.run('the job tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  MT.job = await mountTable('job');
  return MT.job.required ? true : MT.job.requiredSays;
}, 1000);
test.run('and creates the job table once in that box, with its detail pane and no api', 0.2, function () { if (!MT.job) return NO_TOOLS; return MT.job.created ? true : MT.job.createdSays; }, 1000);
test.run('the detail pane\'s look of a job is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.job) return NO_TOOLS; return MT.job.looks ? true : MT.job.looksSays; }, 1000);

// ── 💬 Select Persona: a personaSelector:pane, a persona picked opens its chat in the centre (goal/G41.26) ──
// Andy, box: "this new panel, below the title contains, for now, only a personaSelector:pane", "When the user clicks on
// a persona in the left hand \"💬 Select Persona\" pane, the chat pane shows up in the center pane of workBench".
// A personaSelector:pane is the persona table's probabilitySearch in pane mode (rule/29), the agent tables' own
// (spirit/app/agent/element/table/tableElement.js, agentDetail.search); the chat pane is spirit/app/agent/element/chatPane.js, tested in
// its own file.
const C = { sels: [], chats: [], prevDetail: null, cb: null, asked: [], sel: null };
const NO_CHAT_TOOL = 'no 💬 tool: the app made none';
const NO_PICK = 'no personaSelector:pane with a pick';
test.run('its mount loads the agent tables\' element itself (rule/26)', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  if (X.CHAT_TOOL.length !== 1) return NO_CHAT_TOOL;
  const w = X.w;
  C.prevDetail = global.window.spirit.element.spirit.app.agent.element.table.tableElement;
  global.window.spirit.element.spirit.app.agent.element.table.tableElement = Object.assign({}, C.prevDetail || {}, { branchOf: function (table) { return 'agent/' + table; },
    titleRow: function (look, names) { return '<div class="agent-title"><span>' + (look && look.icon || '') + '</span> ' + (names || []).join(' ') + '</div>'; },
    search: function (host, o, more) { const s2 = { host: host, o: o, more: more || {}, refresh: function () {}, destroy: function () {} }; C.sels.push(s2); return s2; },
  });
  global.window.spirit.element.spirit.app.agent.element.chatPane = { create: function (into, opts) { const c = { into: into, opts: opts || {}, destroy: function () { c.destroyed = true; } }; C.chats.push(c); return c; } };
  const before = w.required.length;
  C.cb = box('chat'); X.CHAT_TOOL[0].mount(C.cb); await settle();
  C.asked = w.required.slice(before);
  C.sel = C.sels[0];
  return C.asked.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 ? true : 'required: ' + short(C.asked);
}, 1000);
test.run('its panel is titled 💬 Select Persona', 0.2, function () {
  const cb = C.cb;
  if (!cb) return NO_CHAT_TOOL;
  return (/class="agent-title"/).test(cb.innerHTML) && cb.innerHTML.indexOf('💬') !== -1 && /Select Persona/.test(cb.innerHTML) ? true : 'panel: ' + short(cb.innerHTML);
}, 1000);
test.run('below the title, only a personaSelector:pane: the persona table\'s search in pane mode, handed no api', 0.2, function () {
  if (!C.cb) return NO_CHAT_TOOL;
  const sels = C.sels, sel = C.sel;
  return sels.length === 1 && sel.o && sel.o.table === 'persona' && !('api' in sel.o) && sel.more.face === 'pane' && typeof sel.more.pick === 'function'
    ? true : 'selectors: ' + short(sels.map(function (x) { return { table: x.o && x.o.table, face: x.more.face }; }));
}, 1000);
test.run('in a box of its own, not over the title, with no Add', 0.2, function () {
  if (!C.cb) return NO_CHAT_TOOL;
  const sel = C.sel, cb = C.cb;
  return !!sel && !!sel.host && sel.host !== cb && !/Add a persona/.test(cb.innerHTML) ? true : 'panel: ' + short(cb.innerHTML);
}, 1000);
test.run('a persona picked loads spirit/app/agent/element/chatPane.js', 0.2, async function () {
  const sel = C.sel;
  if (!sel || typeof sel.more.pick !== 'function') return NO_PICK;
  const w = X.w;
  const cBefore = w.required.length;
  sel.more.pick({ id: 'KA', label: 'Ada <the reviewer>' }, 'KA'); await settle();
  return w.required.slice(cBefore).indexOf('spirit/app/agent/element/chatPane.js') !== -1 ? true : 'required: ' + short(w.required.slice(cBefore));
}, 1000);
test.run('the centre holds the tabContainer', 0.2, function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return NO_PICK;
  const w = X.w;
  return w.tabsInto === X.wb.center ? true : 'tabs in: ' + short(w.tabsInto && w.tabsInto.tag);
}, 1000);
test.run('and opens the chat pane in a tab of the workBench\'s centre, for that persona', 0.2, function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return NO_PICK;
  const chats = C.chats;
  const tab = X.w.tabs.filter(function (t) { return t.name === 'chat/KA'; })[0];
  return chats.length === 1 && !!tab && chats[0].into === tab.box && chats[0].opts.persona && chats[0].opts.persona.id === 'KA' && chats[0].opts.persona.label === 'Ada <the reviewer>'
    ? true : 'chat panes: ' + short(chats.map(function (c) { return { persona: c.opts.persona }; }));
}, 1000);
test.run('another persona picked opens its own chat in a tab beside the first (goal/G41.31)', 0.2, async function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return NO_PICK;
  const chats = C.chats;
  C.sel.more.pick({ id: 'KB', label: 'Bea' }, 'KB'); await settle();
  const verdict = chats.length === 2 && chats[0].destroyed !== true && chats[1].opts.persona.id === 'KB' ? true : 'chat panes: ' + short(chats.map(function (c) { return { id: c.opts.persona && c.opts.persona.id, destroyed: !!c.destroyed }; }));
  global.window.spirit.element.spirit.app.agent.element.table.tableElement = C.prevDetail;
  delete global.window.spirit.element.spirit.app.agent.element.chatPane;
  return verdict;
}, 1000);

// ── the right strip's bundle editor (goal/G41.21) ──
// Box v17: "the bundle editor (shell/js/bundleEditor.js, the shell element that lists, makes and edits bundles)"; it is
// spirit/element/bundleEditor.js now.
const BE = { asked: [], editors: [], bb: null };
test.run('its mount requires spirit/element/bundleEditor.js', 0.2, async function () {
  if (!X.BUNDLE_TOOL) return NO_TOOLS;
  const w = X.w;
  const before = w.required.length;
  global.window.spirit.element.spirit.element.bundleEditor = { create: function (into, cfg) { BE.editors.push({ into: into, cfg: cfg || {} }); return { destroy: function () {} }; } };
  BE.bb = box('bundles'); X.BUNDLE_TOOL.mount(BE.bb); await settle();
  BE.asked = w.required.slice(before);
  delete global.window.spirit.element.spirit.element.bundleEditor;
  return BE.asked.indexOf('spirit/element/bundleEditor.js') !== -1 ? true : 'required: ' + short(BE.asked);
}, 1000);
test.run('and makes the bundle editor in the box it is handed, handed no api', 0.2, function () {
  if (!BE.bb) return NO_TOOLS;
  const editors = BE.editors;
  return editors.length === 1 && editors[0].into === BE.bb && !('api' in editors[0].cfg) ? true : 'bundle editors: ' + editors.length + ', handed ' + short(editors[0] && Object.keys(editors[0].cfg));
}, 1000);

// ── the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json" ──
const source = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
test.run('the app\'s code names no showDebug, no relay-state and no title of the old shell', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  return !/showDebug/.test(source) && !/relay-state/.test(source) && !/setScreenTitle/.test(source) ? true : 'element.js still names one';
}, 1000);
test.run('and no activateApp', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  return !/activateApp/.test(source) ? true : 'element.js still names activateApp';
}, 1000);
test.run('opening the app saves no file', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  return !X.w.saves.length ? true : 'saved: ' + short(X.w.saves);
}, 1000);

// goal/G43.15, Andy: "WHY WOULD THE FUCKING agent server have a separate debug switch, it belongs to the node, and should work like
// any other servers debug switch.", and "on the right icon strip the ⚙ icon instead of 🐞, and that panel will show...".
// ── the box: "On the agent's right icon strip, the server's tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG" ──
const SD = { debugs: [], made: [], callsBefore: 0, rb: null };
test.run('the server\'s tool on the right strip takes ⚙', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  const SERVER_TOOL = X.SERVER_TOOL;
  return !!SERVER_TOOL && /⚙/.test(String(SERVER_TOOL.icon)) && !/🐞/.test(String(SERVER_TOOL.icon)) ? true : 'its icon: ' + short(SERVER_TOOL && SERVER_TOOL.icon);
}, 1000);
test.run('its mount loads spirit/element/search/app/serverDEBUG.js through spirit.require', 0.2, async function () {
  if (!X.SERVER_TOOL) return NO_TOOLS;
  const w = X.w;
  global.window.spirit.element.spirit.element.search.app.serverDEBUG = { create: function (into, o) { SD.debugs.push({ into: into, o: o || {} }); SD.made.push('serverDEBUG'); return { destroy: function () {} }; } };
  // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG".
  ['changeAppIcon', 'changeAppLabel'].forEach(function (n) { global.window.spirit.element.spirit.element.search.app[n] = { create: function (into, o) { SD.made.push(n + ':' + ((o || {}).key || '')); return { destroy: function () {} }; } }; });
  SD.callsBefore = w.calls.length;
  SD.rb = box('right'); X.SERVER_TOOL.mount(SD.rb); await settle();
  delete global.window.spirit.element.spirit.element.search.app.serverDEBUG;
  delete global.window.spirit.element.spirit.element.search.app.changeAppIcon;
  delete global.window.spirit.element.spirit.element.search.app.changeAppLabel;
  return w.required.indexOf('spirit/element/search/app/serverDEBUG.js') !== -1 ? true : 'required: ' + short(w.required);
}, 1000);
test.run('and makes serverDEBUG for the agent', 0.2, function () {
  if (!SD.rb) return NO_TOOLS;
  return SD.debugs.length === 1 && SD.debugs[0].o.key === 'agent' ? true : 'serverDEBUGs: ' + short(SD.debugs.map(function (d) { return { here: d.into === SD.rb, key: d.o.key }; }));
}, 1000);
test.run('it draws no checkbox of its own', 0.2, function () {
  if (!SD.rb) return NO_TOOLS;
  return SD.rb.inputs.length === 0 ? true : 'inputs: ' + SD.rb.inputs.length;
}, 1000);
test.run('and calls no debug verb of the agent\'s', 0.2, function () {
  if (!SD.rb) return NO_TOOLS;
  return X.w.calls.length === SD.callsBefore ? true : 'debug calls: ' + short(X.w.calls.slice(SD.callsBefore));
}, 1000);
test.run('the app\'s code calls no agent debug verb', 0.2, function () {
  if (X.R.length !== 2) return NO_TOOLS;
  return !/\.debug\(/.test(source) ? true : 'element.js still calls .debug(';
}, 1000);
test.run('its mount loads changeAppIcon.js and changeAppLabel.js', 0.2, function () {
  if (!SD.rb) return NO_TOOLS;
  const w = X.w;
  return ['spirit/element/search/app/changeAppIcon.js', 'spirit/element/search/app/changeAppLabel.js'].every(function (p) { return w.required.indexOf(p) !== -1; }) ? true : 'required: ' + short(w.required);
}, 1000);
test.run('and makes the icon, then the label, for the agent, above serverDEBUG', 0.2, function () {
  if (!SD.rb) return NO_TOOLS;
  return JSON.stringify(SD.made) === JSON.stringify(['changeAppIcon:agent', 'changeAppLabel:agent', 'serverDEBUG']) ? true : 'made, in order: ' + short(SD.made);
}, 1000);

// ── it bootstraps its own components ──
test.run('with no workBench on the page it loads spirit/element/workBench.js through spirit.require, then builds one', 0.2, async function () {
  if (X.R.length !== 2) return NO_TOOLS;
  const w3 = world();
  const required = [];
  const def3 = load(w3);
  // No workBench on the page (goal/G43.32: an element stands at spirit.element.<its path>).
  global.window.spirit.element.spirit.element = {};
  global.window.spirit.require = function (p) { required.push(String(p)); global.window.spirit.element.spirit.element.workBench = w3.workBench; global.window.spirit.element.spirit.element.tabContainer = w3.tabContainer; return Promise.resolve(true); };
  def3.create(box('app3')); await settle();
  return required.indexOf('spirit/element/workBench.js') !== -1 && w3.created.length === 1 ? true : 'required ' + short(required) + ', workbenches ' + w3.created.length;
}, 1000);
