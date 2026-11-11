'use strict';

// spirit/run/spirit/app/agent/element/table/test/tableElement.js
// The tests of spirit/app/agent/element/table/tableElement.js, and of no other module (spec: ./tableElement.md; goal/G41.4, goal/G41.18).
// The browser file runs in node on a window of its own, over the real spirit.data (spirit/data.js). The boxes,
// the probabilitySearch element, the icon selector and the agent server's interface are stubs that keep what was asked
// of them; the agent server answers as rowTable.js does.
// One test.run per test (goal/G47.2): each test does its step and judges it; what the steps make is kept below for the
// tests after them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'tableElement.js');
const AGENT = familyPath('agent');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
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
const NO_WORLD = 'no page: the world failed';
const NO_TABLE = 'no table element: it was not placed';

// ── its file ──
test.run('the world: the shared element runs on a window of its own, over the real spirit.data', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/element/table/tableElement.js is not there';
  w = world();
  global.window = { spirit: { get element() { return this.elements; }, elements: {}, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  load(path.join(RUN, 'spirit', 'data.js'));
  D = global.window.spirit.data;
  // THE WINDOW AS THE PAGE NOW STARTS (goal/G41.28): the data set knows its home node, the page's own, from node.card,
  // kept as spirit.node.key; a family's cache manager is found by spirit.cacheManager(name), the real one, which in node
  // reads it from its own disk. The agent family's (spirit/app/agent/data.js) keeps the tables'
  // branches, <node>/agent/<table>, and answers them through spirit.data.agent.data.
  global.window.spirit.node = { key: HOME_KEY };
  D.homeNode(HOME_KEY);
  global.window.spirit.cacheManager = require(path.join(RUN, 'spirit', 'spirit.js')).cacheManager;
  BRANCH = function (table) { return D.nodeId(HOME_KEY) + '/agent/' + table; };
  // The node's bundles (auth.bundle, the one dictionary of bundles): get answers a bundle the node has, refuses one it
  // has not; each ask kept.
  w.bundleAsks = [];
  w.bundlesHeld = { 7: 'Reader', 9: 'Writer' };
  global.window.spirit.ready = Promise.resolve({ auth: { bundle: function (a) {
    w.bundleAsks.push(a);
    if (a && a.op === 'get') return w.bundlesHeld[Number(a.id)] ? Promise.resolve({ id: Number(a.id), label: w.bundlesHeld[Number(a.id)] }) : Promise.reject(Object.assign(new Error('auth.bundle has no row ' + a.id), { code: 'no-such-row' }));
    return Promise.resolve({ items: [], more: false });
  } } });
  const PE = function () { const e = global.window.spirit.element; e.spirit = e.spirit || {}; e.spirit.element = e.spirit.element || {}; return e.spirit.element; };
  global.window.spirit.require = function (p) {
    w.required.push(String(p));
    // The bundle selector (goal/G41.21), tested in its own folder: a stand-in on the page once it is asked for, keeping
    // what it was handed.
    // The are-you-sure button (spirit/element/armingButton.js), tested in its own folder: a stand-in whose first press arms and
    // whose second runs, as the real one does.
    if (p === 'spirit/element/armingButton.js') PE().armingButton = { attach: function (button, opts) {
      const a = { button: button, opts: opts || {}, armed: false };
      w.arming.push(a);
      button.addEventListener('click', function () { if (!a.armed) { a.armed = true; return; } a.armed = false; if (typeof a.opts.run === 'function') a.opts.run(); });
      return button;
    } };
    if (p === 'spirit/element/search/bundle.js') (PE().search = PE().search || {}).bundle = { create: function (c, opts) {
      const sel = { value: '', row: null, opts: opts || {}, container: c, heard: {}, addEventListener: function (type, fn) { (sel.heard[type] = sel.heard[type] || []).push(fn); },
        refresh: function () {}, destroy: function () { sel.destroyed = true; } };
      w.bundles.push(sel); c.appendChild(sel); return sel;
    } };
    return Promise.resolve(p === AGENT ? w.family : true);
  };
  // goal/G43.32: the page's own spirit.require answers the helper, so the element places itself by installSpiritElement,
  // as it runs (spirit/test/headLessChrome.js pageSpirit); the parts it uses stand where it reads them, at
  // spirit.element.<their path>.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  PE().search = Object.assign(PE().search || {}, { create: function (host, o) {
    const s = { host: host, o: o, refreshed: 0, destroyed: false, value: '', row: null,
      refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } };
    w.searches.push(s); return s;
  } });
  // The shell's element shape (goal/G41.19): create(container, options) appends the dropdown and answers it.
  PE().search.icon = { create: function (c, opts) { const sel = { value: (opts && opts.value) || '', opts: opts, container: c }; w.icons.push(sel); c.appendChild(sel); return sel; } };
  load(FILE);
  // The element asks for the agent family's cache manager as it runs; the page has it once the element's tree has loaded.
  await settle();
  AT = (((((global.window.spirit.element.spirit || {}).app || {}).agent || {}).element || {}).table || {});
  E.agentTable = AT.tableElement;
  AD = AT.tableElement || {};
  return true;
}, 1000);
// One file, one element (goal/G41.28; the general test: a file registers one element): the row's editor is
// ./rowElement.js's. goal/G43.32: it stands at its path, spirit.element.spirit.app.agent.element.table.tableElement, its shared
// pieces (once an element of their own, agentDetail) with its create.
test.run('it places spirit.element.spirit.app.agent.element.table.tableElement, with create, and no other element: the row\'s editor is rowElement.js\'s', 0.2, function () {
  if (!AT) return NO_WORLD;
  return AT.tableElement && typeof AT.tableElement.create === 'function' && !AT.rowElement ? true : 'placed: ' + short(Object.keys(AT));
}, 1000);
test.run('and with it { titleRow, fieldLine, stretch, search, branchOf, whyOf }, every pane\'s look in one place', 0.2, function () {
  if (!AT) return NO_WORLD;
  return ['titleRow', 'fieldLine', 'search', 'branchOf', 'whyOf'].every(function (k) { return typeof AD[k] === 'function'; }) && typeof AD.stretch === 'string'
    ? true : 'tableElement: ' + short(Object.keys(AD));
}, 1000);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": the shared element requires no data script; the agent
// family's data.js (spirit/app/agent/data.js, goal/G41.28) takes the rows from the stream, asked for by cacheManager.
test.run('it requires no data script: each table\'s row element takes its own rows from the stream (goal/G41.16)', 0.2, function () {
  if (!w) return NO_WORLD;
  return !w.required.some(function (p) { return (/data\.js$/).test(p); }) ? true : 'required: ' + short(w.required);
}, 1000);

// ── the shared pieces ──
test.run('titleRow(look, words): the agent-title row, its icon, then the words, each in a part of its own', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  return (/class="agent-title"/).test(tr) && tr.indexOf('🏢') !== -1 && /<b>Add<\/b>/.test(tr) && /<span>Provider<\/span>/.test(tr) ? true : 'titleRow: ' + short(tr);
}, 1000);
test.run('set as a title, bigger and semibold (Andy: "a bit more title-like a bit bigger")', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  return (/font-size:1\.3em/).test(tr) && /font-weight:600/.test(tr) ? true : 'titleRow: ' + short(tr);
}, 1000);
test.run('and escapes what it shows', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  return AD.titleRow({ icon: '<x>' }, ['a&b']).indexOf('<x>') === -1 ? true : 'titleRow: ' + short(AD.titleRow({ icon: '<x>' }, ['a&b']));
}, 1000);
test.run('fieldLine(label, input): the label, 1em, then the input to the right edge', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  const fl = AD.fieldLine('L', '<input>');
  return (/display:flex/).test(fl) && /gap:1em/.test(fl) && /flex:1 1 0/.test(fl) ? true : 'fieldLine: ' + short(fl);
}, 1000);
test.run('branchOf(table) is the home node\'s <node>/agent/<table>, as ((spirit.data || {}).agent || {}).data names it (goal/G41.28)', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  return AD.branchOf('job') === BRANCH('job') ? true : 'branchOf: ' + short(AD.branchOf('job'));
}, 1000);
// A page where the agent family's cache could not be loaded (its server not running on the node) is refused, saying
// why: never a list drawn with no branch.
test.run('with no agent family\'s cache on the page, branchOf refuses and says why', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  const keptAD = ((global.window.spirit.data || {}).agent || {}).data;
  delete ((global.window.spirit.data || {}).agent || {}).data;
  let why = null; let drawn;
  try { drawn = AD.branchOf('job'); } catch (e) { why = e; }
  global.window.spirit.data.agent.data = keptAD;
  return !!why && /agent/.test(String(why.message)) && /cache/.test(String(why.message)) ? true : 'branchOf answered ' + short(drawn) + (why ? ', said ' + short(why.message) : '');
}, 1000);

// ── unconfigured, the table says so and throws nothing (goal/G41.19) ──
const U = { bare: null, made: null };
test.run('agentTable.create(box, {}) throws nothing and says it is not configured', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  U.bare = box('bare');
  let threw = null;
  try { U.made = E.agentTable.create(U.bare, {}); } catch (e) { threw = e; }
  return !threw && !!U.made && /not configured/.test(U.bare.textContent) ? true : 'threw ' + short(threw && threw.message) + ', box: ' + short(U.bare.textContent);
}, 1000);
test.run('and its destroy leaves the box empty', 0.2, function () {
  if (!U.made || typeof U.made.destroy !== 'function') return 'the unconfigured table has no destroy';
  U.made.destroy();
  return U.bare.innerHTML === '' ? true : 'box: ' + short(U.bare.innerHTML);
}, 1000);
test.run('whyOf(refusal) is the server\'s own reason, else the refusal\'s words, else refused', 0.2, function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  return AD.whyOf(refused('job takes no argument verb')) === 'job takes no argument verb' && AD.whyOf(new Error('bad')) === 'bad' && AD.whyOf(null) === 'refused'
    ? true : 'whyOf: ' + short([AD.whyOf(refused('x')), AD.whyOf(new Error('bad')), AD.whyOf(null)]);
}, 1000);

// ── a table: its title row, its Add button, its list shown at once ──
const T = { left: null, t: null, list: null, rows: [] };
const detail = {
  center: box('center'),
  open: function (make) { detail.center.innerHTML = ''; make(detail.center); },
  look: function (t) { return { icon: '🏢', name: 'Provider', title: 'Model providers' }; },
};
test.run('its title row is the table\'s icon and its title, from the detail pane\'s look', 0.2, async function () {
  if (!E.agentTable || !AD.titleRow) return NO_TABLE;
  T.left = box('left');
  T.t = E.agentTable.create(T.left, { table: 'provider', detail: detail, row: function (b, key, added, row) { T.rows.push({ box: b, key: key, added: added, row: row }); return { destroy: function () {} }; } });
  await settle();
  return T.left.innerHTML.indexOf('Model providers') !== -1 && T.left.innerHTML.indexOf('🏢') !== -1 && /class="agent-title"/.test(T.left.innerHTML) ? true : 'left: ' + short(T.left.innerHTML);
}, 1000);
test.run('it has an Add button', 0.2, function () {
  if (!T.left) return 'no table: it was not made';
  return the(T.left, 'add') && /Add a provider/.test(T.left.innerHTML) ? true : 'left: ' + short(T.left.innerHTML);
}, 1000);
test.run('its list is a probabilitySearch in its own box, searched as it is made (Andy: "must be immediately shown")', 0.2, function () {
  if (!T.left) return 'no table: it was not made';
  T.list = w.searches[0];
  return T.list && T.list.host === the(T.left, 'list') && T.list.refreshed >= 1 ? true : 'searches: ' + w.searches.length + ', refreshed ' + (T.list && T.list.refreshed);
}, 1000);
const NO_LIST = 'no list: the table made none';
test.run('it searches the agent server\'s provider verb, seated in the branch <node>/agent/provider of spirit.data', 0.2, function () {
  if (!T.list) return NO_LIST;
  return T.list.o.server === 'agent' && T.list.o.verb === 'provider' && T.list.o.data === BRANCH('provider') ? true : 'search: ' + short({ server: T.list.o.server, verb: T.list.o.verb, data: T.list.o.data });
}, 1000);
test.run('its search asks { op: search, text }', 0.2, function () {
  if (!T.list) return NO_LIST;
  return JSON.stringify(T.list.o.args('ab')) === JSON.stringify({ op: 'search', text: 'ab' }) ? true : 'args: ' + short(T.list.o.args('ab'));
}, 1000);
test.run('every row is shown by its icon and its label alone (Andy: "will only show: icon and label")', 0.2, function () {
  if (!T.list) return NO_LIST;
  return JSON.stringify((T.list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]' ? true : 'columns: ' + short(T.list.o.columns);
}, 1000);
test.run('a row\'s name is its icon and its label, as a picker shows it', 0.2, function () {
  if (!T.list) return NO_LIST;
  return T.list.o.name({ icon: '🏢', label: 'One' }) === '🏢 One' ? true : 'name: ' + short(T.list.o.name({ icon: '🏢', label: 'One' }));
}, 1000);

// ── a row picked opens its editor in the detail pane ──
test.run('pick opens row(box, key, false, row) in the detail pane', 0.2, function () {
  if (!T.list) return NO_LIST;
  T.list.o.pick({ id: 'KP', label: 'One' }, 'KP');
  const rows = T.rows;
  return rows.length === 1 && rows[0].box === detail.center && rows[0].key === 'KP' && rows[0].added === false && rows[0].row.label === 'One'
    ? true : 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; }));
}, 1000);

// ── Add makes no row: it opens the detail in Add mode (goal/G41.21) ──
// Andy: "NO ROW WILL BE CREATED WITH AN "Add" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"; "the proper way to do
// such a thing is, the detail panel has and "Add" mode".
const ADD = { opened0: 0 };
test.run('pressing Add asks the server nothing: no row is made', 0.2, async function () {
  if (!T.list) return NO_LIST;
  w.calls.length = 0;
  w.answer = function () { return { id: 'KNEW' }; };
  ADD.opened0 = T.rows.length;
  the(T.left, 'add').click(); await settle();
  return !w.calls.some(function (c) { return c.args && c.args.op === 'add'; }) ? true : 'calls: ' + short(w.calls);
}, 1000);
test.run('it opens an editor with no row of its own, in Add mode', 0.2, function () {
  if (!T.list) return NO_LIST;
  const rows = T.rows;
  return rows.length === ADD.opened0 + 1 && !rows[rows.length - 1].key && rows[rows.length - 1].added === true ? true : 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; }));
}, 1000);

// ── a table may make its own Add ──
test.run('given add(open), Add calls it and asks the server nothing', 0.2, async function () {
  if (!T.list) return NO_LIST;
  w.calls.length = 0;
  const own = [];
  const left2 = box('left2');
  E.agentTable.create(left2, { table: 'grant', detail: detail, add: function (open) { own.push(open); }, row: function () { return {}; } });
  await settle();
  the(left2, 'add').click(); await settle();
  return own.length === 1 && typeof own[0] === 'function' && w.calls.length === 0 ? true : 'add called ' + own.length + ', calls ' + short(w.calls);
}, 1000);

// ── a table may hand its own buttons, and its own columns (goal/G41.18) ──
// A table's own buttons (the model table once held "provider models", box v17) and its columns (the model's "[icon]
// \"model-name\"", the provider's icon): what a table hands, the shared element draws.
const COLS = [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }];
const OWN = { left3: null, b0: null, n3: 0, pressed: [] };
test.run('each button is drawn on the Add line, by its label, Add kept', 0.2, async function () {
  if (!T.list) return NO_LIST;
  OWN.left3 = box('left3');
  OWN.n3 = w.searches.length;
  E.agentTable.create(OWN.left3, { table: 'model', detail: detail, row: function () { return {}; }, columns: COLS,
    buttons: [{ label: 'provider models', press: function () { OWN.pressed.push('provider models'); } }] });
  await settle();
  OWN.b0 = the(OWN.left3, 'button0');
  return !!OWN.b0 && OWN.left3.innerHTML.indexOf('provider models') !== -1 && !!the(OWN.left3, 'add') ? true : 'left3: ' + short(OWN.left3.innerHTML);
}, 1000);
test.run('a button pressed calls its press()', 0.2, function () {
  if (!OWN.left3) return 'no table with buttons: it was not made';
  if (OWN.b0) OWN.b0.click();
  return OWN.pressed.length === 1 ? true : 'pressed: ' + short(OWN.pressed);
}, 1000);
test.run('the columns a table hands are the list\'s, in place of icon and label', 0.2, function () {
  if (!OWN.left3) return 'no table with buttons: it was not made';
  const l3 = w.searches[OWN.n3];
  return l3 && l3.o.columns === COLS ? true : 'columns: ' + short(l3 && l3.o.columns);
}, 1000);
test.run('a table that hands none keeps icon and label', 0.2, function () {
  if (!T.list) return NO_LIST;
  return JSON.stringify((T.list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]' ? true : 'columns: ' + short(T.list.o.columns);
}, 1000);

// ── a table may have no Add (goal/G41.18) ──
test.run('given add false, no Add is drawn; its buttons and title row are', 0.2, async function () {
  if (!T.list) return NO_LIST;
  w.calls.length = 0;
  const left4 = box('left4');
  E.agentTable.create(left4, { table: 'model', detail: detail, add: false, row: function () { return {}; },
    buttons: [{ label: 'provider models', press: function () {} }] });
  await settle();
  return !the(left4, 'add') && !/Add a model/.test(left4.innerHTML) && !!the(left4, 'button0') && /class="agent-title"/.test(left4.innerHTML) ? true : 'left4: ' + short(left4.innerHTML);
}, 1000);

// ── destroy ──
test.run('destroy destroys the list and empties the box', 0.2, function () {
  if (!T.list) return NO_LIST;
  T.t.destroy();
  return T.list.destroyed && T.left.innerHTML === '' ? true : 'destroyed ' + T.list.destroyed + ', box ' + short(T.left.innerHTML);
}, 1000);
