'use strict';

// spirit/run/spirit/app/agent/element/table/test/tableElement.js
// The tests of spirit/app/agent/element/table/tableElement.js, and of no other module (spec: ./tableElement.md; goal/G41.4, goal/G41.18).
// The browser file runs in node on a window of its own, over the real store, spirit.client (spirit/client/script.js). The boxes,
// the probabilitySearch element, the icon selector and the agent server's interface are stubs that keep what was asked
// of them; the agent server answers as rowTable.js does.
// One test.run per test (goal/G47.2): each test does its step and judges it; what the steps make is kept below for the
// tests after them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');

const FILE = path.join(__dirname, '..', 'tableElement.js');
const AGENT = 'spirit/app/agent/api.js';
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (the store's nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
// It answers what the file put out, as the page's loader hands it back (goal/G49.23).
function load(file) { return PAGE_LOAD.runAsPage(file); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A box: its markup makes a part per id, each with its tag's value and its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, className: '', style: {}, parts: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) {
        const id = /\bid="([^"]+)"/.exec(m[0]);
        if (id) b.parts[id[1]] = part(m[0]);
      }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    set textContent(v) { html = String(v); b.parts = {}; },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
    appendChild: function (c) { return c; },
    addEventListener: function () {},
  };
  return b;
}
function part(tag) {
  const heard = {};
  const value = /\svalue="([^"]*)"/.exec(tag);
  const n = { tag: tag, value: value ? value[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '',
    checked: /\schecked(\s|>)/.test(tag), isConnected: true, textContent: '', children: [], className: '', style: {},
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); },
    // An edit finished, as the browser says it: change, then a blur.
    fire: function (type) { (heard[type] || []).slice().forEach(function (fn) { fn({ type: type, target: n }); }); } };
  return n;
}
// The parts of a box whose id ends in the given name.
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }

// The world: the agent server's interface answering as rowTable.js does, the searches made, the icon selectors made.
function world() {
  const w = { calls: [], searches: [], icons: [], bundles: [], arming: [], required: [], answer: null };
  // Not a thenable: Promise.resolve hands the interface itself on.
  w.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    // ITS ROWS ON THE BRANCH, AS THE LOADER HANDS AN OLD-SHAPE BRANCH BACK (goal/G49.23, box v22 Part 1: an api.js answer
    // carries what its data.js put out, as data): the real data.js's, once it has run.
    if (table === 'data') return w.agentRows;
    // An old-shape branch has no client (goal/G49.23): the element reads its client before its data.
    if (table === 'client') return undefined;
    return function (args) {
      w.calls.push({ table: table, args: args });
      const a = w.answer ? w.answer(table, args) : { id: 'KNEW' };
      return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
    };
  } });
  return w;
}
function refused(why) { const e = new Error('no-such-argument'); e.body = { ok: false, error: 'no-such-argument', extra: { why: why } }; return e; }

// What the tests make, for the tests after them.
let w = null;
let D = null;
let AT = null;
let AD = {};
let BRANCH = null;
const E = {};

// ── its file ──
test.run('the shared element runs on a window of its own, over the real store, spirit.client', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  w = world();
  global.window = { spirit: { get element() { return this.elements; }, elements: {}, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  // THE STORE AS THE LOADER HANDS IT BACK (goal/G49.23: no spirit.required), and handed as requireScript's answer below.
  D = load(path.join(RUN, 'spirit', 'client', 'script.js'));
  // THE WINDOW AS THE PAGE NOW STARTS (goal/G41.28): the data set knows its home node, the page's own, from node.card,
  // kept as spirit.nodeFacts.key; the agent family's api.js, asked of the stand-in require below, brings its companion data.js
  // with it, the real file run once from disk, as the real api.js does. That data.js (spirit/app/agent/data.js) keeps the tables'
  // branches, <node>/spirit.app.agent/<table>, and answers them through what it put out, its reads (w.agentRows; goal/G49.23: the store hands
  // out no family by name), the family named by the app's id (goal/G49.19).
  global.window.spirit.nodeFacts = { key: HOME_KEY };
  D.homeNode(HOME_KEY);
  const ran = {};
  BRANCH = function (table) { return D.nodeId(HOME_KEY) + '/spirit.app.agent/' + table; };
  global.window.spirit.readyPromise = Promise.resolve({});
  // EACH PART'S ANSWER IS requireScript's (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the agent family, and stand-ins for the parts tested in their own folders (the search, the icon search, the
  // bundle selector, the are-you-sure button); any other part, the icon element among them, an empty object, so a title row
  // draws its glyph as text, as it did before the icon loaded.
  const STANDS = {
    'spirit/element/search/script.js': { create: function (host, o) {
      const s = { host: host, o: o, refreshed: 0, destroyed: false, value: '', row: null,
        refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } };
      w.searches.push(s); return s;
    } },
    // The shell's element shape (goal/G41.19): create(container, options) appends the dropdown and answers it.
    'spirit/element/search/icon/script.js': { create: function (c, opts) { const sel = { value: (opts && opts.value) || '', opts: opts, container: c }; w.icons.push(sel); c.appendChild(sel); return sel; } },
    // The bundle selector (goal/G41.21), keeping what it was handed.
    'spirit/element/search/bundle/script.js': { create: function (c, opts) {
      const sel = { value: '', row: null, opts: opts || {}, container: c, heard: {}, addEventListener: function (type, fn) { (sel.heard[type] = sel.heard[type] || []).push(fn); },
        refresh: function () {}, destroy: function () { sel.destroyed = true; } };
      w.bundles.push(sel); c.appendChild(sel); return sel;
    } },
    // The are-you-sure button: its first press arms, its second runs, as the real one does.
    'spirit/element/armingButton/script.js': { attach: function (button, opts) {
      const a = { button: button, opts: opts || {}, armed: false };
      w.arming.push(a);
      button.addEventListener('click', function () { if (!a.armed) { a.armed = true; return; } a.armed = false; if (typeof a.opts.run === 'function') a.opts.run(); });
      return button;
    } },
  };
  global.window.spirit.requireScript = function (p) {
    w.required.push(String(p));
    // The agent family's api.js requires its companion data.js, as the real one does: the real file, run once (branch data,
    // read at its place until goal/G49.10).
    if (p === AGENT && !ran[p]) { ran[p] = true; w.agentRows = load(path.join(RUN, 'spirit', 'app', 'agent', 'data.js')); }
    if (p === AGENT) return Promise.resolve(w.family);
    // The store, the real one run above (goal/G49.23: the elements and data.js keep it as handed back).
    if (p === 'spirit/client/script.js') return Promise.resolve(D);
    return Promise.resolve(Object.prototype.hasOwnProperty.call(STANDS, p) ? STANDS[p] : {});
  };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  load(FILE);
  // The element requires the agent family's api.js as it runs, and with it its data.js, once the element's tree has loaded.
  await settle();
  // At its path on the spirit object itself (goal/G49.23: no spirit.required).
  AT = ((((global.window.spirit.app || {}).agent || {}).element || {}).table || {});
  E.agentTable = AT.tableElement;
  AD = AT.tableElement || {};
  // What it asked as it loaded, kept apart from what this process asks later (the runner's own reports to testicle go
  // through the same window.spirit.requireScript).
  w.loaded = w.required.slice();
  return true;
}, test.limit.quick);
// One file, one element (goal/G41.28; the general test: a file registers one element): the row's editor is
// ./row.js's. goal/G43.32: it stands at its path, spirit.app.agent.element.table.tableElement, its shared
// pieces (once an element of their own, agentDetail) with its create.
test.run('the file registers one element, the table editor with its create; the row editor lives in row.js', 0.2, function () {
  if (!AT) return false;
  return AT.tableElement && typeof AT.tableElement.create === 'function' && !AT.row ? true : false;
}, test.limit.quick);
test.run('beside create it places titleRow, fieldLine, stretch, search, branchOf and whyOf, every pane\'s look in one place', 0.2, function () {
  if (!AT) return false;
  return ['titleRow', 'fieldLine', 'search', 'branchOf', 'whyOf'].every(function (k) { return typeof AD[k] === 'function'; }) && typeof AD.stretch === 'string'
    ? true : false;
}, test.limit.quick);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts"; goal/G47.1, Andy: "every api.js requires it's companion
// data.js, and is the only script to require that data.js": the element requires the agent family's api.js, whose
// data.js (spirit/app/agent/data.js) takes the rows from the stream.
test.run('as it loads, it requires the agent branch\'s interface, spirit/app/agent/api.js', 0.2, function () {
  if (!w || !w.loaded) return false;
  return w.loaded.indexOf('spirit/app/agent/api.js') !== -1 || false;
}, test.limit.quick);
test.run('as it loads, it requires no data script, as only an api.js requires its data.js', 0.2, function () {
  if (!w || !w.loaded) return false;
  return !w.loaded.some(function (p) { return (/data\.js$/).test(p); }) ? true : false;
}, test.limit.quick);

// ── the shared pieces ──
test.run('titleRow draws the agent-title row, its icon and then the words, each in a part of its own', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  return (/class="agent-title"/).test(tr) && tr.indexOf('🏢') !== -1 && /<b>Add<\/b>/.test(tr) && /<span>Provider<\/span>/.test(tr) ? true : false;
}, test.limit.quick);
test.run('titleRow sets its words as a title, bigger and semibold (Andy: "a bit more title-like a bit bigger")', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  return (/font-size:1\.3em/).test(tr) && /font-weight:600/.test(tr) ? true : false;
}, test.limit.quick);
test.run('titleRow escapes what it shows', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  return AD.titleRow({ icon: '<x>' }, ['a&b']).indexOf('<x>') === -1 ? true : false;
}, test.limit.quick);
test.run('fieldLine draws the label, a 1em gap, then the input to the right edge', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  const fl = AD.fieldLine('L', '<input>');
  // The 1em is shell.css's .agent-line (box v109: spacing lives in shell.css, never in an element's style attribute).
  let css = ''; try { css = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8'); } catch (e) { css = ''; }
  const rule = (/\.agent-line\s*\{([^}]*)\}/.exec(css) || [])[1] || '';
  return (/display:flex/).test(fl) && /class="agent-line"/.test(fl) && !/gap:/.test(fl) && /gap:\s*1em/.test(rule) && /flex:1 1 0/.test(fl) ? true : false;
}, test.limit.quick);
test.run('branchOf a table is the home node\'s <node>/spirit.app.agent/<table>, as the agent branch\'s cache names it', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  return AD.branchOf('job') === BRANCH('job') ? true : false;
}, test.limit.quick);
// A page where the agent family's cache could not be loaded (its server not running on the node) is refused, saying
// why: never a list drawn with no branch.
test.run('with no agent branch\'s cache on the page, branchOf refuses and says why', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  // The branch's rows gone from what its api.js hands back (goal/G49.23: the element reads them there).
  const keptAD = w.agentRows;
  w.agentRows = null;
  let why = null; let drawn;
  try { drawn = AD.branchOf('job'); } catch (e) { why = e; }
  w.agentRows = keptAD;
  return !!why && /agent/.test(String(why.message)) && /cache/.test(String(why.message)) ? true : false;
}, test.limit.quick);

// ── unconfigured, the table says so and throws nothing (goal/G41.19) ──
const U = { bare: null, made: null };
test.run('agentTable.create with empty options throws nothing and says it is not configured', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  U.bare = box('bare');
  let threw = null;
  try { U.made = E.agentTable.create(U.bare, {}); } catch (e) { threw = e; }
  return !threw && !!U.made && /not configured/.test(U.bare.textContent) ? true : false;
}, test.limit.quick);
test.run('the unconfigured table\'s destroy leaves the box empty', 0.2, function () {
  if (!U.made || typeof U.made.destroy !== 'function') return false;
  U.made.destroy();
  return U.bare.innerHTML === '' ? true : false;
}, test.limit.quick);
test.run('whyOf a refusal is the server\'s own reason, else the refusal\'s words, else refused', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return false;
  return AD.whyOf(refused('job takes no argument verb')) === 'job takes no argument verb' && AD.whyOf(new Error('bad')) === 'bad' && AD.whyOf(null) === 'refused'
    ? true : false;
}, test.limit.quick);

// ── a table: its title row, its Add button, its list shown at once ──
const T = { left: null, t: null, list: null, rows: [] };
const detail = {
  center: box('center'),
  open: function (make) { detail.center.innerHTML = ''; make(detail.center); },
  look: function (t) { return { icon: '🏢', name: 'Provider', title: 'Model providers' }; },
};
test.run('its title row is the table\'s icon and its title, from the detail pane\'s look', 0.2, async function () {
  if (!E.agentTable || !AD.titleRow) return false;
  T.left = box('left');
  T.t = E.agentTable.create(T.left, { table: 'provider', detail: detail, row: function (b, key, added, row) { T.rows.push({ box: b, key: key, added: added, row: row }); return { destroy: function () {} }; } });
  await settle();
  return T.left.innerHTML.indexOf('Model providers') !== -1 && T.left.innerHTML.indexOf('🏢') !== -1 && /class="agent-title"/.test(T.left.innerHTML) ? true : false;
}, test.limit.quick);
test.run('it has an Add button', 0.2, function () {
  if (!T.left) return false;
  return the(T.left, 'add') && /Add a provider/.test(T.left.innerHTML) ? true : false;
}, test.limit.quick);
test.run('its list is a probabilitySearch in its own box, searched as it is made (Andy: "must be immediately shown")', 0.2, function () {
  if (!T.left) return false;
  T.list = w.searches[0];
  return T.list && T.list.host === the(T.left, 'list') && T.list.refreshed >= 1 ? true : false;
}, test.limit.quick);
test.run('it searches the agent server\'s provider verb, seated in the branch <node>/spirit.app.agent/provider of the store', 0.2, function () {
  if (!T.list) return false;
  return T.list.o.api === 'spirit/app/agent/api.js' && T.list.o.verb === 'provider' && T.list.o.data === BRANCH('provider') ? true : false;
}, test.limit.quick);
test.run('its search asks for op search with the text', 0.2, function () {
  if (!T.list) return false;
  return JSON.stringify(T.list.o.args('ab')) === JSON.stringify({ op: 'search', text: 'ab' }) ? true : false;
}, test.limit.quick);
test.run('every row is shown by its icon and its label alone (Andy: "will only show: icon and label")', 0.2, function () {
  if (!T.list) return false;
  return JSON.stringify((T.list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]' ? true : false;
}, test.limit.quick);
test.run('a row\'s name is its icon and its label, as a picker shows it', 0.2, function () {
  if (!T.list) return false;
  return T.list.o.name({ icon: '🏢', label: 'One' }) === '🏢 One' ? true : false;
}, test.limit.quick);

// ── a row picked opens its editor in the detail pane ──
test.run('picking a row opens it in the detail pane by its key, not added, with its row', 0.2, function () {
  if (!T.list) return false;
  T.list.o.pick({ id: 'KP', label: 'One' }, 'KP');
  const rows = T.rows;
  return rows.length === 1 && rows[0].box === detail.center && rows[0].key === 'KP' && rows[0].added === false && rows[0].row.label === 'One'
    ? true : false;
}, test.limit.quick);

// ── Add makes no row: it opens the detail in Add mode (goal/G41.21) ──
// Andy: "NO ROW WILL BE CREATED WITH AN "Add" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"; "the proper way to do
// such a thing is, the detail panel has and "Add" mode".
const ADD = { opened0: 0 };
test.run('pressing Add asks the server nothing: no row is made', 0.2, async function () {
  if (!T.list) return false;
  w.calls.length = 0;
  w.answer = function () { return { id: 'KNEW' }; };
  ADD.opened0 = T.rows.length;
  the(T.left, 'add').click(); await settle();
  return !w.calls.some(function (c) { return c.args && c.args.op === 'add'; }) ? true : false;
}, test.limit.quick);
test.run('it opens an editor with no row of its own, in Add mode', 0.2, function () {
  if (!T.list) return false;
  const rows = T.rows;
  return rows.length === ADD.opened0 + 1 && !rows[rows.length - 1].key && rows[rows.length - 1].added === true ? true : false;
}, test.limit.quick);

// ── a table may make its own Add ──
test.run('given an add function, Add calls it and asks the server nothing', 0.2, async function () {
  if (!T.list) return false;
  w.calls.length = 0;
  const own = [];
  const left2 = box('left2');
  E.agentTable.create(left2, { table: 'grant', detail: detail, add: function (open) { own.push(open); }, row: function () { return {}; } });
  await settle();
  the(left2, 'add').click(); await settle();
  return own.length === 1 && typeof own[0] === 'function' && w.calls.length === 0 ? true : false;
}, test.limit.quick);

// ── a table may hand its own buttons, and its own columns (goal/G41.18) ──
// A table's own buttons (the model table once held "provider models", box v17) and its columns (the model's "[icon]
// \"model-name\"", the provider's icon): what a table hands, the shared element draws.
const COLS = [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }];
const OWN = { left3: null, b0: null, n3: 0, pressed: [] };
test.run('each button is drawn on the Add line, by its label, Add kept', 0.2, async function () {
  if (!T.list) return false;
  OWN.left3 = box('left3');
  OWN.n3 = w.searches.length;
  E.agentTable.create(OWN.left3, { table: 'model', detail: detail, row: function () { return {}; }, columns: COLS,
    buttons: [{ label: 'provider models', press: function () { OWN.pressed.push('provider models'); } }] });
  await settle();
  OWN.b0 = the(OWN.left3, 'button0');
  return !!OWN.b0 && OWN.left3.innerHTML.indexOf('provider models') !== -1 && !!the(OWN.left3, 'add') ? true : false;
}, test.limit.quick);
test.run('a button pressed calls its press()', 0.2, function () {
  if (!OWN.left3) return false;
  if (OWN.b0) OWN.b0.click();
  return OWN.pressed.length === 1 ? true : false;
}, test.limit.quick);
test.run('the columns a table hands are the list\'s, in place of icon and label', 0.2, function () {
  if (!OWN.left3) return false;
  const l3 = w.searches[OWN.n3];
  return l3 && l3.o.columns === COLS ? true : false;
}, test.limit.quick);
test.run('a table that hands none keeps icon and label', 0.2, function () {
  if (!T.list) return false;
  return JSON.stringify((T.list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]' ? true : false;
}, test.limit.quick);

// ── a table may have no Add (goal/G41.18) ──
test.run('given add false, no Add is drawn, but its buttons and title row are', 0.2, async function () {
  if (!T.list) return false;
  w.calls.length = 0;
  const left4 = box('left4');
  E.agentTable.create(left4, { table: 'model', detail: detail, add: false, row: function () { return {}; },
    buttons: [{ label: 'provider models', press: function () {} }] });
  await settle();
  return !the(left4, 'add') && !/Add a model/.test(left4.innerHTML) && !!the(left4, 'button0') && /class="agent-title"/.test(left4.innerHTML) ? true : false;
}, test.limit.quick);

// ── destroy ──
test.run('destroy destroys the list and empties the box', 0.2, function () {
  if (!T.list) return false;
  T.t.destroy();
  return T.list.destroyed && T.left.innerHTML === '' ? true : false;
}, test.limit.quick);
