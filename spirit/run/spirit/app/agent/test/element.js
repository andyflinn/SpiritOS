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
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');

const DIR = path.join(__dirname, '..');
const FILE = path.join(DIR, 'element.js');
// The agent server's family, as the one family path function names it (goal/G41.12).
const AGENT_FAMILY = 'spirit/app/agent/api.js';
// The tables of agent.db, in the order of their left tools (goal/G41.4, box v22).
// goal/G41.21 (box v17): "agent.grant is removed altogether: its table, its server, and the Grants tool in the left strip".
const TABLES = ['provider', 'model', 'persona', 'job'];

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
  // The tabContainer in the centre (goal/G41.31), a stand-in: its contract and test are spirit/element/tabContainer/test/script.md. Each tab added
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
  // The agent server's interface, as spirit.requireScript hands it: its debug call recorded, answered as the server does.
  w.calls = []; w.required = [];
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
  // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
  // function... or fail/throw"): by path, what the app's requires answer; anything else answers an object.
  w.stands = { 'spirit/element/workBench/script.js': w.workBench, 'spirit/element/tabContainer/script.js': w.tabContainer };
  w.provider = [];
  w.family = { debug: function (args) { w.calls.push(args); return Promise.resolve({ debug: !!(args && args.on) }); },
    provider: function (args) { w.provider.push(args); return Promise.resolve({ ok: true, items: [{ key: 'KP', label: '{}' }], more: false }); } };
  // ITS ROWS ON THE BRANCH, AS THE LOADER HANDS AN OLD-SHAPE BRANCH BACK (goal/G49.23, box v22 Part 1: an api.js answer carries
  // what its data.js put out, as data, not enumerable): the real data.js's, once the stand-in below has run it.
  w.rows = {};
  Object.defineProperty(w.family, 'data', { enumerable: false, get: function () { return w.rows[AGENT_FAMILY] || null; } });
  // The server's job as the node's stream hands it to the page's store (spirit.client), which the jobs family's cache keeps.
  w.stream = function (debug) { w.store.takeJob({ id: 'job-agent', module: 'spirit.app.agent', app: { agent: { debug: debug } } }); };
  return w;
}
// The app loaded on a window of its own, with this world's stubs.
function load(w) {
  // spirit/element/search/app/'s parts are handed as requireScript's answers (w.stands; goal/G49.23: no spirit.required).
  global.window = { spirit: { fs: w.fs, escapeHtml: function (s) { return String(s); }, isBrowser: function () { return true; },
    // A branch's api.js: its real companion data.js run on this window over the real data set, as the real api.js
    // requires it (goal/G47.1).
    requireScript: function (p) {
      w.required.push(String(p));
      const m = /^spirit\/(.+)\/api\.js$/.exec(String(p));
      const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
      if (companion && fs.existsSync(path.join(RUN, companion))) w.rows[p] = PAGE_LOAD.runAsPage(path.join(RUN, companion));
      if (p === AGENT_FAMILY) return Promise.resolve(w.family);
      return Promise.resolve(Object.prototype.hasOwnProperty.call(w.stands, p) ? w.stands[p] : {});
    } } };
  global.window.spirit.readyPromise = Promise.resolve(Object.assign(Object.create(global.window.spirit), { agent: w.family }));
  global.spirit = global.window.spirit;
  w.win = global.window;
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.startPage leaves it before any app runs.
  // The store as the page's loader hands it back (goal/G49.23: no spirit.required), and handed as requireScript's answer.
  w.store = w.stands['spirit/client/script.js'] = PAGE_LOAD.runAsPage(path.join(RUN, 'spirit', 'client', 'script.js'));
  global.window.spirit.nodeFacts = { key: 'KEY+AGENT/APP==' };
  w.store.homeNode(global.window.spirit.nodeFacts.key);
  global.document = { createElement: function () { return box('made'); }, addEventListener: function () {}, removeEventListener: function () {} };
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so the app is placed at its path as it runs.
  SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  // The app's own answer, what it set as module.exports (goal/G49.9).
  return PAGE_LOAD.runAsPage(FILE);
}

// What the tests make, for the tests after them.
const X = { w: null, def: null, made0: null, wb: null, L: [], R: [], CHAT_TOOL: [], SERVER_TOOL: null, BUNDLE_TOOL: null };

// ── its files ──
test.run('its manifest has the new shape: it mounts on the node and on the shell', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  return manifest.node && manifest.node.mount === true && manifest.shell && manifest.shell.mount === true && !('server' in manifest) ? true : false;
}, test.limit.quick);

// ── it mounts one workBench into a box of the whole app area ──
// The box: "spirit.element.spirit.app.agent.element.create(container) answers { destroy() }", "Its activateApp goes". This window has no shell, so a call to it throws.
test.run('the app loads as an element that has a create function', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  X.w = world();
  let loadError = null;
  try { X.def = load(X.w); } catch (e) { loadError = e; }
  return !loadError && X.def && typeof X.def.create === 'function' ? true : false;
}, test.limit.quick);
test.run('create answers an object with a destroy function', 0.2, async function () {
  if (!X.def || typeof X.def.create !== 'function') return false;
  X.app = box('app');
  X.made0 = X.def.create(X.app);
  await settle();
  return !!X.made0 && typeof X.made0.destroy === 'function' ? true : false;
}, test.limit.quick);
test.run('it creates one workBench', 0.2, function () {
  if (!X.w) return false;
  const w = X.w;
  if (w.created.length) {
    X.wb = w.created[0];
    X.L = X.wb.opts.left || []; X.R = X.wb.opts.right || [];
    // goal/G41.21: "The right strip gets its first real tool: the bundle editor ... It joins the agent server's DEBUG box".
    X.CHAT_TOOL = X.L.filter(function (t) { return t && t.icon === '💬'; });
    X.SERVER_TOOL = X.R.filter(function (t) { return t.name === 'server'; })[0];
    X.BUNDLE_TOOL = X.R.filter(function (t) { return t.name !== 'server'; })[0];
  }
  return w.created.length === 1 ? true : false;
}, test.limit.quick);
test.run('the box it hands the workBench takes the shell\'s fill class', 0.2, function () {
  if (!X.wb) return false;
  const into = X.wb.into || {};
  return (/\bfill\b/).test(String(into.className || '')) || (into === X.app && false) ? true : false;
}, test.limit.quick);
// One per table of agent.db (goal/G41.4, box v22: "every one of these tables will come with a
// left-edge icon that puts up a panel in the left-side tool-display of the workBench UI used in this app").
// goal/G41.26, Andy, box: "the left site icon strip gains a [chat] icon, that opens the following, NEW panel, titled:
// \"💬 Select Persona\"". Its place in the strip is not said; it is the one left tool that is not a table's.
test.run('the left strip has one tool per agent table and no grants tool, the right strip two, the server\'s among them', 0.2, function () {
  if (!X.wb) return false;
  const L = X.L, R = X.R, LEFT = TABLES.slice();
  return JSON.stringify(L.map(function (t) { return t && t.name; }).filter(function (n) { return LEFT.indexOf(n) !== -1; })) === JSON.stringify(LEFT) && R.length === 2 && R.some(function (t) { return t && t.name === 'server'; }) &&
    L.concat(R).every(function (t) { return t && t.name && t.icon && t.title && typeof t.mount === 'function'; })
    ? true : false;
}, test.limit.quick);
test.run('every left tool has an icon of its own', 0.2, function () {
  if (!X.wb) return false;
  const L = X.L;
  return new Set(L.map(function (t) { return t && t.icon; })).size === L.length ? true : false;
}, test.limit.quick);
test.run('the app names no grants panel and no grant table any more', 0.2, function () {
  return !/grantsPanel|table\/grant\b|agent\.grant/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')) ? true : false;
}, test.limit.quick);
test.run('the left strip has one more tool, 💬, titled Select Persona', 0.2, function () {
  if (!X.wb) return false;
  const CHAT_TOOL = X.CHAT_TOOL;
  return CHAT_TOOL.length === 1 && CHAT_TOOL[0].icon === '💬' && CHAT_TOOL[0].title === 'Select Persona' ? true : false;
}, test.limit.quick);

// ── each table's tool mounts that table's own element ──
const CODE = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
test.run('it makes no api for its tables: each list asks agent.<table> through the spirit object itself', 0.2, function () {
  if (X.R.length !== 2) return false;
  // An api.js asked by its path (goal/G49.6) is no api it makes.
  return !/\bapi\b/.test(CODE.replace(/'spirit\/[\w/]*api\.js'/g, "''")) ? true : false;
}, test.limit.quick);
// One table at a time, each check its own plain title (goal/G45.6: a title has no value built into it).
async function mountTable(name) {
  const w = X.w, L = X.L;
  const t = L.filter(function (x) { return x.name === name; })[0];
  const before = w.required.length;
  const made = [];
  const standIn = { create: function (into, detail) { made.push({ into: into, detail: detail, handed: arguments.length }); return { refresh: function () {}, destroy: function () {} }; } };
  w.stands['spirit/app/agent/element/table/' + name + '/elementTable.js'] = standIn;
  // Handed as requireScript's answer alone (goal/G49.23): the app keeps what the require hands back, no place.
  const tb = box('table-' + name); t.mount(tb); await settle();
  const asked = w.required.slice(before);
  const d = made[0] && made[0].detail;
  const look = d && d.look(name);
  return {
    required: asked.indexOf('spirit/app/agent/element/table/' + name + '/elementTable.js') !== -1 && /\bfill\b/.test(tb.className),
    // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
    // needs...."): the table is handed its box and the detail pane, no api; its list asks agent.<table> itself.
    created: made.length === 1 && made[0].into === tb && made[0].handed === 2 && d && typeof d.open === 'function' && typeof d.look === 'function',
    looks: !!(look && look.icon === t.icon && look.name && look.title === t.title),
  };
}
const MT = {};
test.run('the provider tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return false;
  MT.provider = await mountTable('provider');
  return MT.provider.required ? true : false;
}, test.limit.quick);
test.run('the provider tool creates the provider table once in its fill box, with its detail pane and no api', 0.2, function () { if (!MT.provider) return false; return MT.provider.created ? true : false; }, test.limit.quick);
test.run('the detail pane\'s look of a provider is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.provider) return false; return MT.provider.looks ? true : false; }, test.limit.quick);
test.run('the model tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return false;
  MT.model = await mountTable('model');
  return MT.model.required ? true : false;
}, test.limit.quick);
test.run('the model tool creates the model table once in its fill box, with its detail pane and no api', 0.2, function () { if (!MT.model) return false; return MT.model.created ? true : false; }, test.limit.quick);
test.run('the detail pane\'s look of a model is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.model) return false; return MT.model.looks ? true : false; }, test.limit.quick);
test.run('the persona tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return false;
  MT.persona = await mountTable('persona');
  return MT.persona.required ? true : false;
}, test.limit.quick);
test.run('the persona tool creates the persona table once in its fill box, with its detail pane and no api', 0.2, function () { if (!MT.persona) return false; return MT.persona.created ? true : false; }, test.limit.quick);
test.run('the detail pane\'s look of a persona is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.persona) return false; return MT.persona.looks ? true : false; }, test.limit.quick);
test.run('the job tool requires its own elementTable.js into a fill box', 0.2, async function () {
  if (X.R.length !== 2) return false;
  MT.job = await mountTable('job');
  return MT.job.required ? true : false;
}, test.limit.quick);
test.run('the job tool creates the job table once in its fill box, with its detail pane and no api', 0.2, function () { if (!MT.job) return false; return MT.job.created ? true : false; }, test.limit.quick);
test.run('the detail pane\'s look of a job is its tool\'s icon and title, and its one name', 0.2, function () { if (!MT.job) return false; return MT.job.looks ? true : false; }, test.limit.quick);

// ── 💬 Select Persona: a personaSelector:pane, a persona picked opens its chat in the centre (goal/G41.26) ──
// Andy, box: "this new panel, below the title contains, for now, only a personaSelector:pane", "When the user clicks on
// a persona in the left hand \"💬 Select Persona\" pane, the chat pane shows up in the center pane of workBench".
// A personaSelector:pane is the persona table's probabilitySearch in pane mode (rule/29), the agent tables' own
// (spirit/app/agent/element/table/tableElement.js, agentDetail.search); the chat pane is spirit/app/agent/element/chatPane.js, tested in
// its own file.
const C = { sels: [], chats: [], prevDetail: null, cb: null, asked: [], sel: null };
test.run('the Select Persona tool\'s mount loads the agent tables\' element itself', 0.2, async function () {
  if (X.R.length !== 2) return false;
  if (X.CHAT_TOOL.length !== 1) return false;
  const w = X.w;
  C.prevDetail = w.stands['spirit/app/agent/element/table/tableElement.js'];
  w.stands['spirit/app/agent/element/table/tableElement.js'] = Object.assign({}, C.prevDetail || {}, { branchOf: function (table) { return 'agent/' + table; },
    titleRow: function (look, names) { return '<div class="agent-title"><span>' + (look && look.icon || '') + '</span> ' + (names || []).join(' ') + '</div>'; },
    search: function (host, o, more) { const s2 = { host: host, o: o, more: more || {}, refresh: function () {}, destroy: function () {} }; C.sels.push(s2); return s2; },
  });
  w.stands['spirit/app/agent/element/chatPane.js'] = { create: function (into, opts) { const c = { into: into, opts: opts || {}, destroy: function () { c.destroyed = true; } }; C.chats.push(c); return c; } };
  const before = w.required.length;
  C.cb = box('chat'); X.CHAT_TOOL[0].mount(C.cb); await settle();
  C.asked = w.required.slice(before);
  C.sel = C.sels[0];
  return C.asked.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('its panel is titled 💬 Select Persona', 0.2, function () {
  const cb = C.cb;
  if (!cb) return false;
  return (/class="agent-title"/).test(cb.innerHTML) && cb.innerHTML.indexOf('💬') !== -1 && /Select Persona/.test(cb.innerHTML) ? true : false;
}, test.limit.quick);
test.run('below the title the panel holds only a persona selector in pane mode, the persona table\'s search, handed no api', 0.2, function () {
  if (!C.cb) return false;
  const sels = C.sels, sel = C.sel;
  return sels.length === 1 && sel.o && sel.o.table === 'persona' && !('api' in sel.o) && sel.more.face === 'pane' && typeof sel.more.pick === 'function'
    ? true : false;
}, test.limit.quick);
test.run('the persona selector stands in a box of its own, not over the title, with no Add', 0.2, function () {
  if (!C.cb) return false;
  const sel = C.sel, cb = C.cb;
  return !!sel && !!sel.host && sel.host !== cb && !/Add a persona/.test(cb.innerHTML) ? true : false;
}, test.limit.quick);
test.run('a persona picked loads spirit/app/agent/element/chatPane.js', 0.2, async function () {
  const sel = C.sel;
  if (!sel || typeof sel.more.pick !== 'function') return false;
  const w = X.w;
  const cBefore = w.required.length;
  sel.more.pick({ id: 'KA', label: 'Ada <the reviewer>' }, 'KA'); await settle();
  return w.required.slice(cBefore).indexOf('spirit/app/agent/element/chatPane.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('the centre holds the tabContainer', 0.2, function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return false;
  const w = X.w;
  return w.tabsInto === X.wb.center ? true : false;
}, test.limit.quick);
test.run('a persona picked opens the chat pane in a tab of the workBench\'s centre, for that persona', 0.2, function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return false;
  const chats = C.chats;
  const tab = X.w.tabs.filter(function (t) { return t.name === 'chat/KA'; })[0];
  return chats.length === 1 && !!tab && chats[0].into === tab.box && chats[0].opts.persona && chats[0].opts.persona.id === 'KA' && chats[0].opts.persona.label === 'Ada <the reviewer>'
    ? true : false;
}, test.limit.quick);
test.run('another persona picked opens its own chat in a tab beside the first', 0.2, async function () {
  if (!C.sel || typeof C.sel.more.pick !== 'function') return false;
  const chats = C.chats;
  C.sel.more.pick({ id: 'KB', label: 'Bea' }, 'KB'); await settle();
  const verdict = chats.length === 2 && chats[0].destroyed !== true && chats[1].opts.persona.id === 'KB' ? true : false;
  X.w.stands['spirit/app/agent/element/table/tableElement.js'] = C.prevDetail;
  delete X.w.stands['spirit/app/agent/element/chatPane.js'];
  return verdict;
}, test.limit.quick);

// ── the right strip's bundle editor (goal/G41.21) ──
// Box v17: "the bundle editor (shell/js/bundleEditor.js, the shell element that lists, makes and edits bundles)"; it is
// spirit/element/bundleEditor/script.js now.
const BE = { asked: [], editors: [], bb: null };
test.run('its mount requires spirit/element/bundleEditor/script.js', 0.2, async function () {
  if (!X.BUNDLE_TOOL) return false;
  const w = X.w;
  const before = w.required.length;
  w.stands['spirit/element/bundleEditor/script.js'] = { create: function (into, cfg) { BE.editors.push({ into: into, cfg: cfg || {} }); return { destroy: function () {} }; } };
  BE.bb = box('bundles'); X.BUNDLE_TOOL.mount(BE.bb); await settle();
  BE.asked = w.required.slice(before);
  delete w.stands['spirit/element/bundleEditor/script.js'];
  return BE.asked.indexOf('spirit/element/bundleEditor/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('the bundle tool makes the bundle editor in the box it is handed, handed no api', 0.2, function () {
  if (!BE.bb) return false;
  const editors = BE.editors;
  return editors.length === 1 && editors[0].into === BE.bb && !('api' in editors[0].cfg) ? true : false;
}, test.limit.quick);

// ── the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json" ──
const source = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
test.run('the app\'s code names no showDebug, no relay-state and no title of the old shell', 0.2, function () {
  if (X.R.length !== 2) return false;
  return !/showDebug/.test(source) && !/relay-state/.test(source) && !/setScreenTitle/.test(source) ? true : false;
}, test.limit.quick);
test.run('the app\'s code names no activateApp', 0.2, function () {
  if (X.R.length !== 2) return false;
  return !/activateApp/.test(source) ? true : false;
}, test.limit.quick);
test.run('opening the app saves no file', 0.2, function () {
  if (X.R.length !== 2) return false;
  return !X.w.saves.length ? true : false;
}, test.limit.quick);

// goal/G43.15, Andy: "WHY WOULD THE FUCKING agent server have a separate debug switch, it belongs to the node, and should work like
// any other servers debug switch.", and "on the right icon strip the ⚙ icon instead of 🐞, and that panel will show...".
// ── the box: "On the agent's right icon strip, the server's tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG" ──
const SD = { debugs: [], made: [], callsBefore: 0, rb: null };
test.run('the server\'s tool on the right strip takes ⚙', 0.2, function () {
  if (X.R.length !== 2) return false;
  const SERVER_TOOL = X.SERVER_TOOL;
  return !!SERVER_TOOL && /⚙/.test(String(SERVER_TOOL.icon)) && !/🐞/.test(String(SERVER_TOOL.icon)) ? true : false;
}, test.limit.quick);
test.run('its mount loads spirit/element/search/app/serverDEBUG/script.js through spirit.requireScript', 0.2, async function () {
  if (!X.SERVER_TOOL) return false;
  const w = X.w;
  // Each handed as requireScript's answer (goal/G49.23: no spirit.required).
  w.stands['spirit/element/search/app/serverDEBUG/script.js'] = { create: function (into, o) { SD.debugs.push({ into: into, o: o || {} }); SD.made.push('serverDEBUG'); return { destroy: function () {} }; } };
  // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG".
  ['changeAppIcon', 'changeAppLabel'].forEach(function (n) { w.stands['spirit/element/search/app/' + n + '/script.js'] = { create: function (into, o) { SD.made.push(n + ':' + ((o || {}).key || '')); return { destroy: function () {} }; } }; });
  SD.callsBefore = w.calls.length;
  SD.rb = box('right'); X.SERVER_TOOL.mount(SD.rb); await settle();
  delete w.stands['spirit/element/search/app/serverDEBUG/script.js'];
  delete w.stands['spirit/element/search/app/changeAppIcon/script.js'];
  delete w.stands['spirit/element/search/app/changeAppLabel/script.js'];
  return w.required.indexOf('spirit/element/search/app/serverDEBUG/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('the server tool makes serverDEBUG for the agent', 0.2, function () {
  if (!SD.rb) return false;
  return SD.debugs.length === 1 && SD.debugs[0].o.key === 'spirit.app.agent' ? true : false;
}, test.limit.quick);
test.run('it draws no checkbox of its own', 0.2, function () {
  if (!SD.rb) return false;
  return SD.rb.inputs.length === 0 ? true : false;
}, test.limit.quick);
test.run('the server tool calls no debug verb of the agent\'s', 0.2, function () {
  if (!SD.rb) return false;
  return X.w.calls.length === SD.callsBefore ? true : false;
}, test.limit.quick);
test.run('the app\'s code calls no agent debug verb', 0.2, function () {
  if (X.R.length !== 2) return false;
  return !/\.debug\(/.test(source) ? true : false;
}, test.limit.quick);
test.run('its mount loads changeAppIcon.js and changeAppLabel.js', 0.2, function () {
  if (!SD.rb) return false;
  const w = X.w;
  return ['spirit/element/search/app/changeAppIcon/script.js', 'spirit/element/search/app/changeAppLabel/script.js'].every(function (p) { return w.required.indexOf(p) !== -1; }) ? true : false;
}, test.limit.quick);
test.run('the server tool makes the icon, then the label, for the agent, above serverDEBUG', 0.2, function () {
  if (!SD.rb) return false;
  return JSON.stringify(SD.made) === JSON.stringify(['changeAppIcon:agent', 'changeAppLabel:agent', 'serverDEBUG']) ? true : false;
}, test.limit.quick);

// ── it bootstraps its own components ──
test.run('with no workBench on the page it loads spirit/element/workBench/script.js through spirit.requireScript, then builds one', 0.2, async function () {
  if (X.R.length !== 2) return false;
  const w3 = world();
  const required = [];
  const def3 = load(w3);
  // No workBench on the page: none was loaded yet, so the app requires it; the stand-ins are what requireScript answers (goal/G49.9).
  global.window.spirit.requireScript = function (p) { required.push(String(p)); return Promise.resolve(p === 'spirit/element/workBench/script.js' ? w3.workBench : p === 'spirit/element/tabContainer/script.js' ? w3.tabContainer : {}); };
  def3.create(box('app3')); await settle();
  return required.indexOf('spirit/element/workBench/script.js') !== -1 && w3.created.length === 1 ? true : false;
}, test.limit.quick);

// ── THE PARTS ON A REAL PAGE (goal/G47.1) ──────────────────────────────────────────────────────────────────────────────
// The centreTabs and listBoxes parts, once in ./agent.js (folded there by name in goal/G45.1): they judge what element.js
// draws, its centre's tabs and the boxes of its list panes, in a real Chrome on a scratch node. Andy: "THE TEST TEST
// EVERYTHING!". What they share from that file comes with them, in this block.
{
  const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
  const { until, sleep, chromePage, findChrome } = LABH;
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function scratch() {
    const root = LABH.scratchTree().root;
    return { root: root, run: path.join(root, 'spirit', 'run') };
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: '', body: null }; }
  }
  function answers(r) { return r.status === 200 && !!r.body && typeof r.body.debug === 'boolean'; }

// ── THE centreTabs PART ────────────────────────────────────────
{
  // The centreTabs part, once of ./agent.js.
  // THE AGENT APP'S CENTRE IS TABS (goal/G41.31; Andy, the box: "i need a tabContainer permanently situated in the center pane of
  // the workBench."; "each panel, that the agent app placed into the center panel now becomes a closable tab in the
  // tabContainer, activated if it already exists, created if it doesn't have a tab yet."; each tab's header, by kind; "any tab
  // that hears (by listening) of it's own rows deletion will close itself."; "an unsaved add-tab will say: "new <row-type>*"";
  // and Q1, the tabs stay open when the left tool changes). What a person sees is judged, by real clicks in a real Chrome on a
  // scratch node, on the shell Andy uses, / (spirit/shell/face.html).

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..','..','..','..');
  const test = SPIRIT.requireScript('spirit/test/testReport.js');
  const { scratchNode, chromePage, findChrome, sleep, until } = SPIRIT.requireScript('spirit/test/headLessChrome.js');

  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  const ICON = { provider: '🧪', model: '🧬', persona: '🧙', job: '🧰' };
  const CHAT = '💬';

  // ── centreTabs: the agent app's centre is closable tabs (goal/G41.31) ──

  // True once an earlier test of this part failed: nothing after it is judged.
  let STOP = false;
  let N, c, home, P, M, Pe, J, B, where, LEAF, press, appOpen, CENTRE, tabs, tabOf, tool, pressRow, waitTab, PROVIDER_TAB, MODEL_TAB, PERSONA_TAB, JOB_TAB, again, stacked, before, chatWords, chat, styleOf, closed, hadPersona, opened, afterClose, hadJob, hadBundle, fresh, filled, saved, onlyOne, threw;
  test.after(async function () {
    try { if (c && c.sock) c.sock.close(); if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    try { if (c && c.profile) fs.rmSync(c.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (N && N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N && N.root) LABH.freeTree(N); } catch (e) { /* scratch */ }
  });
  test.run('the agent server answers, and a provider stands', 0.2, async function () {
    if (STOP) return false;
      N = await scratchNode();
      c = null;
    if (!N.up) { STOP = true; return false; }
    home = async function (verb, args) {
      const r = await fetch(N.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    };
    // active is its one switch (goal/G43.13); the app is known and called by its id, spirit.app.agent (goal/G49.19).
    await home('spirit.app.active', { key: 'spirit.app.agent', active: true });
    P = null;
    await until(function () { return home('spirit.app.agent.provider', { op: 'add', icon: ICON.provider, label: 'zzProvider', url: 'http://192.0.2.1:9/' }).then(function (a) { P = a; return a.status === 200 && !!(a.body && a.body.id); }); }, 20000);
    return (!!(P && P.body && P.body.id)) ? true : false;
  }, test.limit.slow);
  test.run('a model, a persona and a job are added', 0.2, async function () {
    if (STOP) return false;
    if (!(P && P.body && P.body.id)) { STOP = true; return false; }
    M = await home('spirit.app.agent.model', { op: 'add', icon: ICON.model, label: 'zzModel', providerId: P.body.id });
    Pe = await home('spirit.app.agent.persona', { op: 'add', icon: ICON.persona, label: 'zzPersona', persona: 'zz', bundle: 'zz', provider: P.body.id });
    J = await home('spirit.app.agent.job', { op: 'add', icon: ICON.job, label: 'zzJob', job: 'zz', bundle: 'zz', provider: P.body.id, persona: Pe.body && Pe.body.id });
    return (M.status === 200 && Pe.status === 200 && J.status === 200) ? true : false;
  }, test.limit.quick);
  test.run('a bundle of the node\'s is added', 0.2, async function () {
    if (STOP) return false;
    // goal/G49.21: auth.bundle {op: 'add'} is spirit.bundle.add, no op argument.
    B = await home('spirit.bundle.add', { label: 'zzNodeBundle' });
    return (B.status === 200) ? true : false;
  }, test.limit.quick);
  test.run('the Agent app opens', 0.2, async function () {
    if (STOP) return false;
    where = findChrome();
    if (!where) { STOP = true; return false; }
    c = await chromePage(where);
    if (c.error) { STOP = true; return false; }
    await c.send('Page.navigate', { url: N.base + '/' });
    await until(function () { return c.evaluate('!!(window.spirit && window.spirit.eventStream)'); }, 20000);
    LEAF = 'function leaf(w, within) { var root = within ? document.querySelector(within) : document; if (!root) return null; return Array.prototype.slice.call(root.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === w && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === w; }); })[0] || null; }';
    press = function (words, within) { return c.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
    // The Agent opens from the appSelector's tiles, as the shell app makes them (goal/G43.13).
    await c.evaluate('(function () { var b = document.createElement("div"); b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function (E) { E.create(b, { face: "tiles" }); return 1; }); }())');
    await until(function () { return press('Agent'); }, 20000);
    await until(function () { return c.evaluate('!!document.querySelector("[data-tool=provider]")'); }, 10000);
    appOpen = await c.evaluate('!!document.querySelector("[data-tool=provider]")');
    return (appOpen) ? true : false;
  }, test.limit.slow);
  // ── a tabContainer stands in the centre, from the start ──
  test.run('with nothing opened, a tabContainer stands in the centre', 0.2, async function () {
    if (STOP) return false;
    if (!appOpen) { STOP = true; return false; }
    CENTRE = '[id$="center"]';
    tabs = function () { return c.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).map(function (b) { return { text: b.textContent.replace(/✕/g, "").replace(/\\s+/g, " ").trim(), on: b.getAttribute("aria-selected") === "true", close: !!b.querySelector("[data-tab-close]") }; }))').then(function (t) { return parsed(t) || []; }); };
    tabOf = async function (words) { return (await tabs()).filter(function (t) { return t.text === words; }); };
    // A tool is opened, never toggled: a press on the one already shown collapses it (workBench.js, data-current).
    tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("[data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };
    // A row of a tool's list, by its label, outside the centre.
    pressRow = function (label) { return c.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && !e.closest(' + JSON.stringify(CENTRE) + ') && e.textContent.trim() === ' + JSON.stringify(label) + ' && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === ' + JSON.stringify(label) + '; }); }); if (!all[0]) return false; all[0].click(); return true; }())'); };
    waitTab = function (words) { return until(function () { return tabOf(words).then(function (t) { return t.length > 0; }); }, 6000); };

    return (await c.evaluate('!!document.querySelector(' + JSON.stringify(CENTRE + ' .tab-content') + ')')) ? true : false;
  }, test.limit.quick);
  test.run('the tabContainer has no tabs yet', 0.2, async function () {
    if (STOP) return false;
    return ((await tabs()).length === 0) ? true : false;
  }, test.limit.quick);
  // ── each kind of row opens a closable tab, named by the box ──
async function tabOpens(kind, row) {
  const words = ICON[kind] + ' ' + row;
  const shown = await tool(kind);
  await until(function () { return pressRow(row); }, 6000);
  await waitTab(words);
  const t = await tabOf(words);
  return { opens: !!(shown && t.length === 1 && t[0].on), closable: !!(t.length === 1 && t[0].close) };
}
  test.run('a provider row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return false;

    // One kind of row at a time, each check its own plain title (goal/G45.6): its tab reads its table's icon and the row's label.
    PROVIDER_TAB = await tabOpens('provider', 'zzProvider');
    return (PROVIDER_TAB.opens) ? true : false;
  }, test.limit.quick);
  test.run('the provider row\'s tab has a close button', 0.2, async function () {
    if (STOP) return false;
    return (PROVIDER_TAB.closable) ? true : false;
  }, test.limit.quick);
  test.run('a model row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return false;
    MODEL_TAB = await tabOpens('model', 'zzModel');
    return (MODEL_TAB.opens) ? true : false;
  }, test.limit.quick);
  test.run('the model row\'s tab has a close button', 0.2, async function () {
    if (STOP) return false;
    return (MODEL_TAB.closable) ? true : false;
  }, test.limit.quick);
  test.run('a persona row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return false;
    PERSONA_TAB = await tabOpens('persona', 'zzPersona');
    return (PERSONA_TAB.opens) ? true : false;
  }, test.limit.quick);
  test.run('the persona row\'s tab has a close button', 0.2, async function () {
    if (STOP) return false;
    return (PERSONA_TAB.closable) ? true : false;
  }, test.limit.quick);
  test.run('a job row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return false;
    JOB_TAB = await tabOpens('job', 'zzJob');
    return (JOB_TAB.opens) ? true : false;
  }, test.limit.quick);
  test.run('the job row\'s tab has a close button', 0.2, async function () {
    if (STOP) return false;
    return (JOB_TAB.closable) ? true : false;
  }, test.limit.quick);
  // ── a row already open: its tab is made active, no second one ──
  test.run('the provider\'s tab is active again, and alone', 0.2, async function () {
    if (STOP) return false;

    await tool('provider');
    await until(function () { return pressRow('zzProvider'); }, 6000);
    await sleep(500);
    again = await tabOf(ICON.provider + ' zzProvider');
    return (again.length === 1 && again[0].on) ? true : false;
  }, test.limit.quick);
  // ── a tab has one listener on its row, and lets go of it when it closes ──
  test.run('three more presses on an open row add no listener', 0.2, async function () {
    if (STOP) return false;

    // Who listens, listens once: a press on a row that has its tab adds no second listener, and closing a tab lets go of its own.
    // A row's listeners are counted where the tab and its editor ask for them: the agent family's cache, its table's watch(id, fn) (goal/G43.32:
    // a reader asks its family's cache, which alone names its addresses).
    await c.evaluate('(function () { var A = window.spirit.client[\"spirit.app.agent\"].data; window.__live = 0; window.__rowPath = ' + JSON.stringify('/' + P.body.id) + '; A.tables.forEach(function (t) { var B = A[t]; var made = B.watch; B.watch = function (id, fn) { var mine = typeof id === "string" && "/" + id === window.__rowPath; var off = made.call(B, id, fn); if (!mine) return off; window.__live++; var done = false; return function () { if (!done) { done = true; window.__live--; } return off(); }; }; }); return true; }())');
    for (let i = 0; i < 3; i++) { await pressRow('zzProvider'); await sleep(250); }
    stacked = await c.evaluate('window.__live');
    return (stacked === 0) ? true : false;
  }, test.limit.slow);
  // ── the tabs stay when the left tool changes ──
  test.run('showing another tool closes none of the open tabs', 0.2, async function () {
    if (STOP) return false;

    before = (await tabs()).length;
    await tool('job');
    await sleep(500);
    return (before >= 4 && (await tabs()).length === before) ? true : false;
  }, test.limit.quick);
  // ── a chat is a tab of its own beside its persona's ──
  test.run('a persona picked opens its chat as a tab named by the chat icon and the persona, and it is active', 0.2, async function () {
    if (STOP) return false;

    await tool('chat');
    await until(function () { return pressRow('zzPersona'); }, 6000);
    chatWords = CHAT + ' zzPersona';
    await waitTab(chatWords);
    chat = await tabOf(chatWords);
    return (chat.length === 1 && chat[0].on) ? true : false;
  }, test.limit.quick);
  test.run('the persona\'s own tab is still there beside its chat', 0.2, async function () {
    if (STOP) return false;
    return ((await tabOf(ICON.persona + ' zzPersona')).length === 1) ? true : false;
  }, test.limit.quick);
  // ── a bundle's tab: its name; not the node's: in brackets and italic ──
  test.run('a node\'s bundle opens a tab reading its name, "zzNodeBundle", alone', 0.2, async function () {
    if (STOP) return false;

    await tool('bundles');
    await until(function () { return pressRow('zzNodeBundle'); }, 6000);
    await waitTab('zzNodeBundle');
    return ((await tabOf('zzNodeBundle')).length === 1) ? true : false;
  }, test.limit.quick);
  test.run('the node\'s bundle tab is in plain print, not italic', 0.2, async function () {
    if (STOP) return false;
    styleOf = function (words) { return c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(words) + ') !== -1; })[0]; if (!b) return null; var all = [b].concat(Array.prototype.slice.call(b.querySelectorAll("*"))); return all.some(function (e) { return e.textContent.indexOf(' + JSON.stringify(words) + ') !== -1 && getComputedStyle(e).fontStyle === "italic"; }); }())'); };
    return ((await styleOf('zzNodeBundle')) === false) ? true : false;
  }, test.limit.quick);
  // ── a label changed anywhere: its tab says so ──
  test.run('the model\'s header follows its row', 0.2, async function () {
    if (STOP) return false;

    await home('spirit.app.agent.model', { op: 'set', id: M.body.id, label: 'zzModelTwo' });
    await waitTab(ICON.model + ' zzModelTwo');
    return ((await tabOf(ICON.model + ' zzModelTwo')).length === 1 && (await tabOf(ICON.model + ' zzModel')).length === 0) ? true : false;
  }, test.limit.quick);
  // ── the close button takes a tab away, and the row stays ──
  test.run('the close button takes the model\'s tab away', 0.2, async function () {
    if (STOP) return false;

    closed = await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf("zzModelTwo") !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (!k) return false; k.click(); return true; }())');
    await until(function () { return tabOf(ICON.model + ' zzModelTwo').then(function (t) { return !t.length; }); }, 4000);
    return (closed === true && (await tabOf(ICON.model + ' zzModelTwo')).length === 0) ? true : false;
  }, test.limit.quick);
  test.run('the model is still there', 0.2, async function () {
    if (STOP) return false;
    return ((await home('spirit.app.agent.model', { op: 'get', id: M.body.id })).status === 200) ? true : false;
  }, test.limit.quick);
  // ── a closed tab listens no more ──
  test.run('a tab opened again has one listener for the tab and one for its editor', 0.2, async function () {
    if (STOP) return false;

    await c.evaluate('window.__rowPath = ' + JSON.stringify('/' + Pe.body.id) + '; window.__live = 0; 1');
    await tool('persona');
    hadPersona = (await tabOf(ICON.persona + ' zzPersona')).length === 1;
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    await until(function () { return pressRow('zzPersona'); }, 6000);
    await waitTab(ICON.persona + ' zzPersona');
    opened = await c.evaluate('window.__live');
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    afterClose = await c.evaluate('window.__live');
    // Two, each once: the tab follows its row, and the row's own editor (agentRow) watches the same path to repaint itself.
    return (hadPersona && opened === 2) ? true : false;
  }, test.limit.quick);
  test.run('a closed tab leaves no listener', 0.2, async function () {
    if (STOP) return false;
    return (afterClose === 0) ? true : false;
  }, test.limit.quick);
  // ── a row deleted elsewhere closes its tab ──
  test.run('the job\'s tab closes itself', 0.2, async function () {
    if (STOP) return false;

    hadJob = (await tabOf(ICON.job + ' zzJob')).length === 1;
    await home('spirit.app.agent.job', { op: 'delete', id: J.body.id });
    await until(function () { return tabOf(ICON.job + ' zzJob').then(function (t) { return !t.length; }); }, 5000);
    return (hadJob && (await tabOf(ICON.job + ' zzJob')).length === 0) ? true : false;
  }, test.limit.quick);
  test.run('the bundle\'s tab closes itself too when its bundle is deleted', 0.2, async function () {
    if (STOP) return false;
    hadBundle = (await tabOf('zzNodeBundle')).length === 1;
    // goal/G49.21: auth.bundle {op: 'delete'} is spirit.bundle.delete.
    await home('spirit.bundle.delete', { id: B.body.id });
    await until(function () { return tabOf('zzNodeBundle').then(function (t) { return !t.length; }); }, 5000);
    return (hadBundle && (await tabOf('zzNodeBundle')).length === 0) ? true : false;
  }, test.limit.quick);
  // ── Add: "new <row-type>*", until it is saved; then it is that row's tab ──
  test.run('a tab reading "new provider*" opens, and is active', 0.2, async function () {
    if (STOP) return false;

    await tool('provider');
    await until(function () { return press('Add a provider'); }, 6000);
    await waitTab('new provider*');
    fresh = await tabOf('new provider*');
    return (fresh.length === 1 && fresh[0].on) ? true : false;
  }, test.limit.quick);
  test.run('its fields are filled', 0.2, async function () {
    if (STOP) return false;
    filled = await c.evaluate('(function () { var box = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-content > *') + ')).filter(function (x) { return !x.hidden; })[0]; if (!box) return false; var inputs = Array.prototype.slice.call(box.querySelectorAll("input")); var set = function (word, v) { var i = inputs.filter(function (x) { return x.id.slice(-word.length - 1) === "-" + word.toLowerCase(); })[0]; if (!i) return false; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); return true; }; return set("Label", "zzSaved") && set("URL", "http://192.0.2.2:9/") ? "ok" : false; }())');
    return (filled === 'ok') ? true : false;
  }, test.limit.quick);
  test.run('once saved, the new tab\'s header is the row\'s', 0.2, async function () {
    if (STOP) return false;
    await press('Add new Provider');
    await until(function () { return tabs().then(function (ts) { return ts.some(function (t) { return t.text.indexOf('zzSaved') !== -1; }); }); }, 6000);
    saved = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    return (saved.length === 1 && saved[0].on) ? true : false;
  }, test.limit.quick);
  test.run('the "new provider*" tab is gone', 0.2, async function () {
    if (STOP) return false;
    return ((await tabOf('new provider*')).length === 0) ? true : false;
  }, test.limit.quick);
  test.run('pressing that row in the list activates it: no second tab', 0.2, async function () {
    if (STOP) return false;
    await until(function () { return pressRow('zzSaved'); }, 6000);
    await sleep(600);
    onlyOne = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    return (onlyOne.length === 1 && onlyOne[0].on) ? true : false;
  }, test.limit.quick);
  test.run('nothing threw in the page', 0.2, async function () {
    if (STOP) return false;
    threw = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
    return (!threw.length) ? true : false;
  }, test.limit.quick);
}

// ── THE listBoxes PART ────────────────────────────────────────
{
  // The listBoxes part, once of ./agent.js.
  // The tests of spirit/app/agent/agent.js as one app, and of no other module (spec: ./agent.md, its listBoxes section; goal/G41.18): every list
  // pane it draws stands in a box of a stated size, each box above it up to the app too (rule/16). The app runs on a small
  // page, with the real workBench, the real table elements in it; the search element is a
  // recorder that keeps the box each list was made in, and the selectors and the agent server are stand-ins.

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const RUN = path.resolve(__dirname, '../../../..');
  const test = SPIRIT.requireScript('spirit/test/testReport.js');

  const FILE = path.join(__dirname, '..', 'element.js');
  const settle = async function () { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); };

  // ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  // The small forgiving page Desk's suite drives (spirit/app/desk/element/desk/test/desk.js), copied as it is: markup parsed into elements,
  // with ids, attributes, parents, closest and simple selectors, and a click that reaches every listener above its
  // target. Desk keeps its own while it lives (Andy: "do all but desk").
  const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
  function makeDom() {
    const doc = {};
    function el(tag) {
      const attrs = {}; const heard = {};
      const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
        get id() { return attrs.id || ''; }, set id(v) { attrs.id = String(v); },
        get className() { return attrs.class || ''; }, set className(v) { attrs.class = String(v); },
        get firstChild() { return e.children[0] || null; },
        get nextSibling() { const k = e.parentNode ? e.parentNode.children : []; return k[k.indexOf(e) + 1] || null; },
        get isConnected() { let p = e; while (p.parentNode) p = p.parentNode; return p === doc.root; },
        get textContent() { return e.children.length ? e.children.map(function (c) { return c.textContent; }).join('') : e._text; },
        set textContent(v) { e.children = []; e._text = String(v == null ? '' : v); },
        get innerHTML() { return e._html || ''; },
        set innerHTML(v) { e._html = String(v); e.children = []; e._text = ''; parseInto(e, String(v)); },
        getAttribute: function (k) { if (k === 'id') return attrs.id || null; return k in attrs ? attrs[k] : null; },
        setAttribute: function (k, v) { attrs[k] = String(v); },
        removeAttribute: function (k) { delete attrs[k]; },
        hasAttribute: function (k) { return k in attrs; },
        classList: { add: function (c) { const l = (attrs.class || '').split(/\s+/).filter(Boolean); if (l.indexOf(c) === -1) l.push(c); attrs.class = l.join(' '); },
          remove: function (c) { attrs.class = (attrs.class || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
          contains: function (c) { return (attrs.class || '').split(/\s+/).indexOf(c) !== -1; },
          toggle: function (c, on) { if (on === undefined ? !e.classList.contains(c) : on) e.classList.add(c); else e.classList.remove(c); } },
        appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
        insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = e.children.indexOf(ref); if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
        removeChild: function (c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; return c; },
        replaceChild: function (n, o) { const i = e.children.indexOf(o); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = e; if (i !== -1) e.children[i] = n; o.parentNode = null; return o; },
        remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
        addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
        removeEventListener: function (t, fn) { heard[t] = (heard[t] || []).filter(function (f) { return f !== fn; }); },
        dispatch: function (t, ev) { (heard[t] || []).slice().forEach(function (fn) { fn(ev); }); },
        closest: function (sel) { let p = e; while (p && p.tagName) { if (matches(p, sel)) return p; p = p.parentNode; } return null; },
        matches: function (sel) { return matches(e, sel); },
        querySelectorAll: function (sel) { const out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); }(e)); return out; },
        querySelector: function (sel) { return e.querySelectorAll(sel)[0] || null; },
        focus: function () {}, blur: function () {}, scrollIntoView: function () {}, getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
        attrs: attrs,
      };
      return e;
    }
    function one(n, sel) {
      sel = sel.trim();
      const m = /^([a-z]*)((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(sel);
      if (!m) return false;
      if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
      const parts = m[2].match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/g) || [];
      return parts.every(function (p) {
        if (p[0] === '#') return n.getAttribute('id') === p.slice(1);
        if (p[0] === '.') return n.classList.contains(p.slice(1));
        const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
        return a[2] === undefined ? n.hasAttribute(a[1]) : n.getAttribute(a[1]) === a[2];
      });
    }
    // A descendant selector, "a b": the last part on the element, each part before it on an element above it.
    function chain(n, s) {
      const parts = s.trim().split(/\s+/);
      if (!one(n, parts[parts.length - 1])) return false;
      let p = n.parentNode;
      for (let i = parts.length - 2; i >= 0; i--) { while (p && !(p.tagName && one(p, parts[i]))) p = p.parentNode; if (!p) return false; p = p.parentNode; }
      return true;
    }
    function matches(n, sel) { return String(sel).split(',').some(function (s) { return chain(n, s); }); }
    function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&'); }
    function parseInto(root, html) {
      const stack = [root];
      const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g; let m;
      let raw = null;
      while ((m = re.exec(html))) {
        const top = stack[stack.length - 1];
        if (raw) { if (m[1] === '/' && m[2] && m[2].toLowerCase() === raw) { stack.pop(); raw = null; } continue; }
        if (m[5] !== undefined) { if (m[5].trim() || top.children.length === 0) { const t = el('#text'); t._text = unesc(m[5]); t.tagName = '#TEXT'; top.children.push(t); t.parentNode = top; } continue; }
        if (!m[2]) continue;
        const tag = m[2].toLowerCase();
        if (m[1] === '/') { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
        const n = el(tag);
        const ar = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
        while ((a = ar.exec(m[3]))) n.attrs[a[1]] = unesc(a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5] !== undefined ? a[5] : '');
        if ('hidden' in n.attrs) n.hidden = true;
        if ('disabled' in n.attrs) n.disabled = true;
        if (n.attrs.type) n.type = n.attrs.type;
        if (n.attrs.title) n.title = n.attrs.title;
        if (n.attrs.value) n.value = n.attrs.value;
        n.parentNode = top; top.children.push(n);
        if (!VOID[tag] && !m[4]) { stack.push(n); if (tag === 'style' || tag === 'script') raw = tag; }
      }
    }
    doc.root = el('html');
    doc.body = doc.root.appendChild(el('body'));
    doc.head = doc.root.appendChild(el('head'));
    doc.documentElement = doc.root;
    doc.readyState = 'complete';
    doc.createElement = function (t) { return el(t); };
    doc.createTextNode = function (t) { const n = el('#text'); n._text = String(t); return n; };
    doc.getElementById = function (id) { return doc.root.querySelector('#' + id); };
    doc.querySelector = function (s) { return doc.root.querySelector(s); };
    doc.querySelectorAll = function (s) { return doc.root.querySelectorAll(s); };
    doc.addEventListener = function () {};
    doc.removeEventListener = function () {};
    // A click on an element, bubbling to every listener above it.
    doc.click = function (t) {
      const ev = { type: 'click', target: t, preventDefault: function () {}, stopPropagation: function () {} };
      let p = t; while (p) { if (p.dispatch) p.dispatch('click', ev); p = p.parentNode; }
    };
    return doc;
  }

  // The real files the app and its elements load, run on the page when they are required; anything else is answered and
  // not run.
  const REAL = [
    'spirit/client/script.js', 'spirit/element/workBench/script.js', 'spirit/element/tabContainer/script.js', 'spirit/app/agent/element/table/tableElement.js', 'spirit/app/agent/element/table/row.js',
    'spirit/app/agent/element/table/provider/elementTable.js', 'spirit/app/agent/element/table/provider/elementRow.js',
    'spirit/app/agent/element/table/model/elementTable.js', 'spirit/app/agent/element/table/model/elementRow.js', 'spirit/element/busyButton/script.js',
    // The one-row form and the icon it draws with (goal/G41.27): the model table's Ask form is one.
    'spirit/element/rowForm/script.js', 'spirit/element/icon/script.js',
    'spirit/app/agent/element/table/persona/elementTable.js', 'spirit/app/agent/element/table/persona/elementRow.js',
    'spirit/app/agent/element/table/job/elementTable.js', 'spirit/app/agent/element/table/job/elementRow.js',
  ];

  function world() {
    const document = makeDom();
    const panes = [];
    const loaded = {};
    const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
      Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error, Proxy: Proxy,
      console: { log: function () {}, error: function () {}, warn: function () {} }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
      location: { hash: '', hostname: '127.0.0.1' }, addEventListener: function () {} };
    win.window = win;
    // The agent server: every verb answers an empty table. Its rows, data, are what its data.js put out, as the loader hands an
    // old-shape branch back (goal/G49.23, box v22 Part 1).
    const family = new Proxy({}, { get: function (o, verb) { if (verb === 'then') return undefined; if (verb === 'data') return loaded['spirit/app/agent/data.js'] || null; return function () { return Promise.resolve({ items: [], more: false }); }; } });
    // A selector stand-in in the shell's element shape (goal/G41.19): create(container, options) appends it and answers it.
    const selector = { create: function (c) { const s = document.createElement('span'); c.appendChild(s); return s; } };
    // THE STAND-INS BY THEIR PATH, HANDED AS requireScript's ANSWERS (goal/G49.23: no spirit.required; the elements keep what the
    // require hands back): one tree, its first key spirit, kept by the test and placed nowhere.
    const STOOD = { spirit: { app: {}, element: nestSearch({
        // The recorder: the box each list is made in, and whether it is a dropdown.
        'search': { create: function (host, o) { panes.push({ host: host, o: o || {} }); return { refresh: function () {}, redraw: function () {}, destroy: function () {}, value: '' }; } },
        'search.contact': selector, 'search.bundle': selector, 'search.api': selector,
        // The server tool's three (goal/G43.15): the app's icon and label and its DEBUG switch, each a rowForm on the page.
        // A stand-in that draws a span and answers destroy, as the server panel asks of them.
        'search.app.changeAppIcon': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
        'search.app.changeAppLabel': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
        'search.app.serverDEBUG': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
      }) } };
    win.spirit = {
      escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
      isBrowser: function () { return true; },
      fs: { loadFile: function () { return Promise.reject(new Error('none')); }, saveFile: function () { return Promise.resolve(); } },
      apiTree: function () { return Promise.resolve({}); },
      // A branch's api.js, a node branch's or an app's: its real companion data.js is run on this page once, over the real
      // data set, as the real api.js requires it (goal/G47.1).
      requireScript: function (p) {
        const rel = String(p).replace(/^\/+/, '');
        const m = /^spirit\/(.+)\/api\.js$/.exec(rel);
        const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
        if (companion && !loaded[companion] && fs.existsSync(path.join(RUN, companion))) { loaded[companion] = true; loaded[companion] = PAGE_LOAD.runAsPage(path.join(RUN, companion), win); }
        if (rel === 'spirit/app/agent/api.js') return Promise.resolve(family);
        // WHAT IT REQUIRES, requireScript ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
        // Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a real file its
        // own answer, what it set as module.exports (the store among them); a stand-in the one in STOOD at that path; anything
        // else an object.
        if (REAL.indexOf(rel) !== -1) { if (!Object.prototype.hasOwnProperty.call(loaded, rel) || loaded[rel] === true) loaded[rel] = PAGE_LOAD.runAsPage(path.join(RUN, rel), win); return Promise.resolve(loaded[rel]); }
        const keys = rel.replace(/\.js$/, '').split('/'); if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
        const at = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, STOOD);
        return Promise.resolve(at && (typeof at === 'object' || typeof at === 'function') ? at : {});
      },
    };
    win.spirit.readyPromise = Promise.resolve(win.spirit);
    // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so each file is placed at its path as it runs.
    SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit);
    vm.createContext(win);
    loaded['spirit/client/script.js'] = PAGE_LOAD.runAsPage(path.join(RUN, 'spirit/client/script.js'), win);
    // Its node known (goal/G41.28, Q10), as spirit.startPage leaves it before any app runs.
    win.spirit.nodeFacts = { key: 'KEY+AGENT/BOXES==' };
    loaded['spirit/client/script.js'].homeNode(win.spirit.nodeFacts.key);
    // The app's own answer, what it set as module.exports (goal/G49.9).
    const appAnswer = PAGE_LOAD.runAsPage(FILE, win);
    return { document: document, win: win, panes: panes, app: appAnswer, store: loaded['spirit/client/script.js'] };
  }

  const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
  // Every box from a list's own up to the app's that is not a fill box.
  function gaps(host, app) {
    const out = [];
    for (let n = host; n && n !== app; n = n.parentNode) if (!isFill(n)) out.push(n);
    return out;
  }
  const under = function (n, app) { for (let p = n; p; p = p.parentNode) if (p === app) return true; return false; };

  // ── listBoxes: agent.js, as one app: every list in a box of a stated size (rule/16) ──

  // THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
  function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
  // True once an earlier test of this part failed: nothing after it is judged.
  let STOP = false;
  let w, app, modelOrder, order, strip, want, PROVIDER_PANE, MODEL_PANE, PERSONA_PANE, JOB_PANE, mo, all, bad, AD, off;
  // ── each tool's list pane ──
async function paneFills(t) {
  const b = strip(t[0]);
  if (!b) return { ok: false };
  w.document.click(b);
  await settle();
  const made = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && p.o.verb === t[1] && under(p.host, app); });
  if (!made.length) return { ok: false };
  const g = gaps(made[made.length - 1].host, app);
  if (t[0] === 'model') {
    const drop = w.panes.filter(function (p) { return p.o.face === 'dropdown' && p.o.verb === 'provider' && under(p.host, app); }).pop();
    modelOrder = order(app, made[made.length - 1].host, drop ? drop.host : null);
  }
  return { ok: !g.length };
}
  let READY = null;
  // The app mounted once, its tools then shown one at a time; what it throws where nothing catches it lands on this test.
  test.run('the app mounts on a small page, with the real workBench and table elements in it', 0.2, function () {
    if (STOP) return false;
    if (!fs.existsSync(FILE)) { STOP = true; return false; }
    READY = (async function () {
      // Andy, on G41.18: "the lists violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right,
      // agents must as well."; "ALL lists, otherwise my took bars at the top of a container keep scrolling away...."; "when a
      // probabilitySearch is in pane-mode it must display 1) filters 2) search input row 3) a pane that uses the rest of the
      // vertical space, all box elements really have to follow to follow that rule", "the agent app must also constrain all
      // it's probability-panes". rule/16: every probabilitySearch in a box of class fill, inside a pane that fills its app.
      // A list drawn as a dropdown stands inline, as every picker in the tree does, and is not asked here.
      w = world();
      app = w.document.body.appendChild(w.document.createElement('div'));
      app.className = 'fill';
      // A tile hands it only its container (goal/G43.13).
      w.app.create(app);
      await settle();
      modelOrder = null;
      // Where, in the app's order of elements, the Models title rows, the Ask row (its providerSelector:dropdown, since
      // goal/G41.27 drops the word from), and the model list stand.
      order = function (root, host, askRow) {
        const seq = [];
        (function walk(n) { n.children.forEach(function (c) { seq.push(c); walk(c); }); }(root));
        const titles = seq.filter(function (n) { return n.classList && n.classList.contains('agent-title') && /Models/.test(n.textContent); });
        return { titles: titles.length, title: titles.length ? seq.indexOf(titles[0]) : -1, from: askRow ? seq.indexOf(askRow) : -1, list: seq.indexOf(host) };
      };
      strip = function (name) { return w.document.querySelectorAll('[data-tool]').filter(function (b) { return b.getAttribute('data-tool') === name; })[0]; };

      // goal/G41.21: the grant tool went with agent.grant.
      want = [['provider', 'provider'], ['model', 'model'], ['persona', 'persona'], ['job', 'job']];
      // One tool at a time, each check its own plain title (goal/G45.6: a title has no value built into it).

    }());
    return READY.then(function () { return true; });
  }, test.limit.quick);
  test.run('the provider tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return false;
    if (!READY) return false;
    await READY;
    PROVIDER_PANE = await paneFills(want[0]);
    return (PROVIDER_PANE.ok) ? true : false;
  }, test.limit.quick);
  test.run('the model tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return false;
    MODEL_PANE = await paneFills(want[1]);
    return (MODEL_PANE.ok) ? true : false;
  }, test.limit.quick);
  test.run('the persona tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return false;
    PERSONA_PANE = await paneFills(want[2]);
    return (PERSONA_PANE.ok) ? true : false;
  }, test.limit.quick);
  test.run('the job tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return false;
    JOB_PANE = await paneFills(want[3]);
    return (JOB_PANE.ok) ? true : false;
  }, test.limit.quick);
  // ── the 🧠 Models pane: its title row first (goal/G41.26) ──
  test.run('the pane draws one 🧠 Models title row', 0.2, async function () {
    if (STOP) return false;

    // Andy, on G41.26: "i the left side models panel: the title row \"🧠Models\" must come before the \"from [🛖 Unsloth
    // Studio ▾] [Ask] row."
    mo = modelOrder || {};
    return (mo.titles === 1) ? true : false;
  }, test.limit.quick);
  test.run('the title row comes before the Ask row, its providerSelector:dropdown', 0.2, async function () {
    if (STOP) return false;
    return (mo.title !== -1 && mo.from !== -1 && mo.title < mo.from) ? true : false;
  }, test.limit.quick);
  test.run('the model list comes after the Ask row', 0.2, async function () {
    if (STOP) return false;
    return (mo.from !== -1 && mo.list !== -1 && mo.from < mo.list) ? true : false;
  }, test.limit.quick);
  // ── every list pane the app drew ──
  test.run('every list pane the app draws stands in a fill box, none only as tall as its content', 0.2, async function () {
    if (STOP) return false;

    all = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && under(p.host, app); });
    bad = all.filter(function (p) { return gaps(p.host, app).length; });
    return (all.length >= 4 && !bad.length) ? true : false;
  }, test.limit.quick);
  // ── each list pane is a view of its table in the agent family's cache (goal/G41.28) ──
  test.run('every list pane is handed its table\'s branch of the agent branch\'s cache', 0.2, async function () {
    if (STOP) return false;

    // The store as the loader handed it back to the page (goal/G49.23: no spirit.required).
    AD = ((w.store || {})['spirit.app.agent'] || {}).data;
    off = all.filter(function (p) { return !AD || !p.o.data || p.o.data !== AD.branch(p.o.verb); });
    return (!!AD && all.length >= 4 && !off.length) ? true : false;
  }, test.limit.quick);
}
}
