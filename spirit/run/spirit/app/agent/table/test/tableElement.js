'use strict';

// spirit/run/spirit/app/agent/table/test/tableElement.js
// The tests of spirit/app/agent/table/tableElement.js, and of no other module (spec: ./tableElement.md; goal/G41.4, goal/G41.18).
// The browser file runs in node on a window of its own, over the real spirit.data (spirit/data.js). The boxes,
// the probabilitySearch element, the icon selector and the agent server's interface are stubs that keep what was asked
// of them; the agent server answers as rowTable.js does.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'tableElement.js');
const AGENT = familyPath('agent');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('tableElement.js: what the tables\' elements share');

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/agent/table/tableElement.js is not there'); return; }
  const w = world();
  global.window = { spirit: { get element() { return this.elements; }, elements: {}, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  load(path.join(RUN, 'spirit', 'data.js'));
  const D = global.window.spirit.data;
  // THE WINDOW AS THE PAGE NOW STARTS (goal/G41.28): the data set knows its home node, the page's own, from node.card,
  // kept as spirit.node.key; a family's cache manager is found by spirit.cacheManager(name), the real one, which in node
  // reads it from its own disk. The agent family's (spirit/app/agent/data.js) keeps the tables'
  // branches, <node>/agent/<table>, and answers them through spirit.data.agent.data.
  global.window.spirit.node = { key: HOME_KEY };
  D.homeNode(HOME_KEY);
  global.window.spirit.cacheManager = require(path.join(RUN, 'spirit', 'spirit.js')).cacheManager;
  // A row's whole path in its table's branch, as the agent family's cache manager names it.
  const rowPath = function (table, id) { return global.window.spirit.data.agent.data.branch(table) + '/' + id; };
  const BRANCH = function (table) { return D.nodeId(HOME_KEY) + '/agent/' + table; };
  // The node's bundles (auth.bundle, the one dictionary of bundles): get answers a bundle the node has, refuses one it
  // has not; each ask kept.
  w.bundleAsks = [];
  w.bundlesHeld = { 7: 'Reader', 9: 'Writer' };
  global.window.spirit.ready = Promise.resolve({ auth: { bundle: function (a) {
    w.bundleAsks.push(a);
    if (a && a.op === 'get') return w.bundlesHeld[Number(a.id)] ? Promise.resolve({ id: Number(a.id), label: w.bundlesHeld[Number(a.id)] }) : Promise.reject(Object.assign(new Error('auth.bundle has no row ' + a.id), { code: 'no-such-row' }));
    return Promise.resolve({ items: [], more: false });
  } } });
  global.window.spirit.require = function (p) {
    w.required.push(String(p));
    // The bundle selector (goal/G41.21), tested in its own folder: a stand-in on the page once it is asked for, keeping
    // what it was handed.
    // The are-you-sure button (spirit/element/armingButton.js), tested in its own folder: a stand-in whose first press arms and
    // whose second runs, as the real one does.
    if (p === 'spirit/element/armingButton.js') global.window.spirit.element.armingButton = { attach: function (button, opts) {
      const a = { button: button, opts: opts || {}, armed: false };
      w.arming.push(a);
      button.addEventListener('click', function () { if (!a.armed) { a.armed = true; return; } a.armed = false; if (typeof a.opts.run === 'function') a.opts.run(); });
      return button;
    } };
    if (p === 'spirit/element/search/bundle.js') (global.window.spirit.element.search = global.window.spirit.element.search || {}).bundle = { create: function (c, opts) {
      const sel = { value: '', row: null, opts: opts || {}, container: c, heard: {}, addEventListener: function (type, fn) { (sel.heard[type] = sel.heard[type] || []).push(fn); },
        refresh: function () {}, destroy: function () { sel.destroyed = true; } };
      w.bundles.push(sel); c.appendChild(sel); return sel;
    } };
    return Promise.resolve(p === AGENT ? w.family : true);
  };
  global.window.spirit.element.search = Object.assign(global.window.spirit.element.search || {}, { create: function (host, o) {
    const s = { host: host, o: o, refreshed: 0, destroyed: false, value: '', row: null,
      refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } };
    w.searches.push(s); return s;
  } });
  // The shell's element shape (goal/G41.19): create(container, options) appends the dropdown and answers it.
  (global.window.spirit.element.search = global.window.spirit.element.search || {}).icon = { create: function (c, opts) { const sel = { value: (opts && opts.value) || '', opts: opts, container: c }; w.icons.push(sel); c.appendChild(sel); return sel; } };
  load(FILE);
  // The element asks for the agent family's cache manager as it runs; the page has it once the element's tree has loaded.
  await settle();
  const E = global.window.spirit.elements;
  // One file, one element (goal/G41.28; the general test: a file registers one element): the row's editor, agentRow, is
  // ./rowElement.js's.
  ok(E.agentTable && typeof E.agentTable.create === 'function' && !E.agentRow,
    'it registers spirit.elements.agentTable, with create, and no other element: agentRow is rowElement.js\'s', 'elements: ' + short(Object.keys(E)));
  const AD = E.agentDetail || {};
  ok(['titleRow', 'fieldLine', 'search', 'branchOf', 'whyOf'].every(function (k) { return typeof AD[k] === 'function'; }) && typeof AD.stretch === 'string',
    'and spirit.elements.agentDetail { titleRow, fieldLine, stretch, search, branchOf, whyOf }, every pane\'s look in one place', 'agentDetail: ' + short(Object.keys(AD)));
  // goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": each table's row element takes its own rows from the
  // stream; the shared element loads no data script.
  ok(!w.required.some(function (p) { return /data\.js$/.test(p); }), 'it requires no data script: each table\'s row element takes its own rows from the stream (goal/G41.16)', 'required: ' + short(w.required));
  if (!E.agentTable || !AD.titleRow) return;

  test.subHeading('the shared pieces');
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  ok(/class="agent-title"/.test(tr) && tr.indexOf('🏢') !== -1 && /<b>Add<\/b>/.test(tr) && /<span>Provider<\/span>/.test(tr),
    'titleRow(look, words): the agent-title row, its icon, then the words, each in a part of its own', 'titleRow: ' + short(tr));
  ok(/font-size:1\.3em/.test(tr) && /font-weight:600/.test(tr), 'set as a title, bigger and semibold (Andy: "a bit more title-like a bit bigger")', 'titleRow: ' + short(tr));
  ok(AD.titleRow({ icon: '<x>' }, ['a&b']).indexOf('<x>') === -1, 'and escapes what it shows', 'titleRow: ' + short(AD.titleRow({ icon: '<x>' }, ['a&b'])));
  const fl = AD.fieldLine('L', '<input>');
  ok(/display:flex/.test(fl) && /gap:1em/.test(fl) && /flex:1 1 0/.test(fl), 'fieldLine(label, input): the label, 1em, then the input to the right edge', 'fieldLine: ' + short(fl));
  ok(AD.branchOf('job') === BRANCH('job'), 'branchOf(table) is the home node\'s <node>/agent/<table>, as ((spirit.data || {}).agent || {}).data names it (goal/G41.28)', 'branchOf: ' + short(AD.branchOf('job')));
  // A page where the agent family's cache could not be loaded (its server not running on the node) is refused, saying
  // why: never a list drawn with no branch.
  const keptAD = ((global.window.spirit.data || {}).agent || {}).data;
  delete ((global.window.spirit.data || {}).agent || {}).data;
  let why = null; let drawn;
  try { drawn = AD.branchOf('job'); } catch (e) { why = e; }
  global.window.spirit.data.agent.data = keptAD;
  ok(!!why && /agent/.test(String(why.message)) && /cache/.test(String(why.message)), 'with no agent family\'s cache on the page, branchOf refuses and says why', 'branchOf answered ' + short(drawn) + (why ? ', said ' + short(why.message) : ''));

  test.subHeading('unconfigured, the table says so and throws nothing (goal/G41.19)');
  const bare = box('bare');
  let threw = null; let made = null;
  try { made = E.agentTable.create(bare, {}); } catch (e) { threw = e; }
  ok(!threw && !!made && /not configured/.test(bare.textContent), 'agentTable.create(box, {}) throws nothing and says it is not configured', 'threw ' + short(threw && threw.message) + ', box: ' + short(bare.textContent));
  if (made && typeof made.destroy === 'function') { made.destroy(); ok(bare.innerHTML === '', 'and its destroy leaves the box empty', 'box: ' + short(bare.innerHTML)); }
  ok(AD.whyOf(refused('job takes no argument verb')) === 'job takes no argument verb' && AD.whyOf(new Error('bad')) === 'bad' && AD.whyOf(null) === 'refused',
    'whyOf(refusal) is the server\'s own reason, else the refusal\'s words, else refused', 'whyOf: ' + short([AD.whyOf(refused('x')), AD.whyOf(new Error('bad')), AD.whyOf(null)]));

  test.subHeading('a table: its title row, its Add button, its list shown at once');
  const opened = [];
  const detail = {
    center: box('center'),
    open: function (make) { detail.center.innerHTML = ''; opened.push(make(detail.center)); },
    look: function (t) { return { icon: '🏢', name: 'Provider', title: 'Model providers' }; },
  };
  const rows = [];
  const left = box('left');
  const t = E.agentTable.create(left, { api: { stub: true }, table: 'provider', detail: detail, row: function (b, key, added, row) { rows.push({ box: b, key: key, added: added, row: row }); return { destroy: function () {} }; } });
  await settle();
  ok(left.innerHTML.indexOf('Model providers') !== -1 && left.innerHTML.indexOf('🏢') !== -1 && /class="agent-title"/.test(left.innerHTML),
    'its title row is the table\'s icon and its title, from the detail pane\'s look', 'left: ' + short(left.innerHTML));
  ok(the(left, 'add') && /Add a provider/.test(left.innerHTML), 'it has an Add button', 'left: ' + short(left.innerHTML));
  const list = w.searches[0];
  ok(list && list.host === the(left, 'list') && list.refreshed >= 1, 'its list is a probabilitySearch in its own box, searched as it is made (Andy: "must be immediately shown")',
    'searches: ' + w.searches.length + ', refreshed ' + (list && list.refreshed));
  if (!list) return;
  ok(list.o.server === 'agent' && list.o.verb === 'provider' && list.o.data === BRANCH('provider'), 'it searches the agent server\'s provider verb, seated in the branch <node>/agent/provider of spirit.data',
    'search: ' + short({ server: list.o.server, verb: list.o.verb, data: list.o.data }));
  ok(JSON.stringify(list.o.args('ab')) === JSON.stringify({ op: 'search', text: 'ab' }), 'its search asks { op: search, text }', 'args: ' + short(list.o.args('ab')));
  ok(JSON.stringify((list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]', 'every row is shown by its icon and its label alone (Andy: "will only show: icon and label")',
    'columns: ' + short(list.o.columns));
  ok(list.o.name({ icon: '🏢', label: 'One' }) === '🏢 One', 'a row\'s name is its icon and its label, as a picker shows it', 'name: ' + short(list.o.name({ icon: '🏢', label: 'One' })));

  test.subHeading('a row picked opens its editor in the detail pane');
  list.o.pick({ id: 'KP', label: 'One' }, 'KP');
  ok(rows.length === 1 && rows[0].box === detail.center && rows[0].key === 'KP' && rows[0].added === false && rows[0].row.label === 'One',
    'pick opens row(box, key, false, row) in the detail pane', 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; })));

  test.subHeading('Add makes no row: it opens the detail in Add mode (goal/G41.21)');
  // Andy: "NO ROW WILL BE CREATED WITH AN "Add" BUTTON for provider, persona, OR JOB!!!!!!!!!!!!"; "the proper way to do
  // such a thing is, the detail panel has and "Add" mode".
  w.calls.length = 0;
  w.answer = function () { return { id: 'KNEW' }; };
  const opened0 = rows.length;
  the(left, 'add').click(); await settle();
  ok(!w.calls.some(function (c) { return c.args && c.args.op === 'add'; }), 'pressing Add asks the server nothing: no row is made', 'calls: ' + short(w.calls));
  ok(rows.length === opened0 + 1 && !rows[rows.length - 1].key && rows[rows.length - 1].added === true, 'it opens an editor with no row of its own, in Add mode', 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; })));

  test.subHeading('a table may make its own Add');
  w.calls.length = 0;
  const own = [];
  const left2 = box('left2');
  E.agentTable.create(left2, { api: {}, table: 'grant', detail: detail, add: function (open) { own.push(open); }, row: function () { return {}; } });
  await settle();
  the(left2, 'add').click(); await settle();
  ok(own.length === 1 && typeof own[0] === 'function' && w.calls.length === 0, 'given add(open), Add calls it and asks the server nothing', 'add called ' + own.length + ', calls ' + short(w.calls));

  test.subHeading('a table may hand its own buttons, and its own columns (goal/G41.18)');
  // The model table's button row holds "provider models" (box v17), and its list shows "[icon] \"model-name\"", the
  // provider's icon: what a table hands, the shared element draws.
  const pressed = [];
  const left3 = box('left3');
  const COLS = [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }];
  const n3 = w.searches.length;
  E.agentTable.create(left3, { api: {}, table: 'model', detail: detail, row: function () { return {}; }, columns: COLS,
    buttons: [{ label: 'provider models', press: function () { pressed.push('provider models'); } }] });
  await settle();
  const b0 = the(left3, 'button0');
  ok(!!b0 && left3.innerHTML.indexOf('provider models') !== -1 && !!the(left3, 'add'), 'each button is drawn on the Add line, by its label, Add kept', 'left3: ' + short(left3.innerHTML));
  if (b0) b0.click();
  ok(pressed.length === 1, 'a button pressed calls its press()', 'pressed: ' + short(pressed));
  const l3 = w.searches[n3];
  ok(l3 && l3.o.columns === COLS, 'the columns a table hands are the list\'s, in place of icon and label', 'columns: ' + short(l3 && l3.o.columns));
  ok(JSON.stringify((list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]', 'a table that hands none keeps icon and label', 'columns: ' + short(list.o.columns));

  test.subHeading('a table may have no Add (goal/G41.18)');
  w.calls.length = 0;
  const left4 = box('left4');
  E.agentTable.create(left4, { api: {}, table: 'model', detail: detail, add: false, row: function () { return {}; },
    buttons: [{ label: 'provider models', press: function () {} }] });
  await settle();
  ok(!the(left4, 'add') && !/Add a model/.test(left4.innerHTML) && !!the(left4, 'button0') && /class="agent-title"/.test(left4.innerHTML),
    'given add false, no Add is drawn; its buttons and title row are', 'left4: ' + short(left4.innerHTML));

  test.subHeading('destroy');
  t.destroy();
  ok(list.destroyed && left.innerHTML === '', 'destroy destroys the list and empties the box', 'destroyed ' + list.destroyed + ', box ' + short(left.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
