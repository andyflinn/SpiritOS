'use strict';

// spirit/run/spirit/app/agent/element/table/test/row.js
// The tests of spirit/app/agent/element/table/row.js, and of no other module (spec: ./row.md; goal/G41.4, goal/G41.28).
// Its tables' shared element (../tableElement.js, spirit.element.spirit.app.agent.element.table.tableElement) is part of its tree and runs real beside it.
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
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/agent/element/table/test/row/' + name + tempAsked); }
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/agent/element/table/test/row'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'row.js');
const SHARED = path.join(__dirname, '..', 'tableElement.js');
const AGENT = familyPath('agent');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
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
let PE = null;
let rowPath = null;
let BRANCH = null;
const E = {};

// ── its file ──
test.run('the shared element runs on a window of its own, over the real spirit.data', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  w = world();
  global.window = { spirit: { get element() { return this.elements; }, elements: {}, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  load(path.join(RUN, 'spirit', 'data.js'));
  D = global.window.spirit.data;
  // THE WINDOW AS THE PAGE NOW STARTS (goal/G41.28): the data set knows its home node, the page's own, from node.card,
  // kept as spirit.node.key; the row element requires the agent branch's interface (spirit/app/agent/api.js), which brings
  // its data.js; the stand-in require below runs that data.js through the real one, which in node reads it from its own
  // disk. The agent family's data.js (spirit/app/agent/data.js) keeps the tables' branches, <node>/agent/<table>, and answers them through
  // spirit.data.agent.data.
  global.window.spirit.node = { key: HOME_KEY };
  D.homeNode(HOME_KEY);
  // A row's whole path in its table's branch, as the agent family's cache manager names it.
  rowPath = function (table, id) { return global.window.spirit.data.agent.data.branch(table) + '/' + id; };
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
  PE = function () { const e = global.window.spirit.element; e.spirit = e.spirit || {}; e.spirit.element = e.spirit.element || {}; return e.spirit.element; };
  global.window.spirit.require = function (p) {
    w.required.push(String(p));
    // The agent branch's interface brings its data.js, as the real api.js does: run once, as the page runs it, into
    // this page's spirit.data.
    if (p === AGENT && !w.agentData) { w.agentData = true; load(path.join(RUN, 'spirit', 'app', 'agent', 'data.js')); }
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
  // goal/G43.32: the page's own spirit.require answers the helper, so each element places itself by installSpiritElement,
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
  // Its tree as the page loads it: the shared element first, then this file.
  load(SHARED);
  await settle();
  AT = function () { return (((((global.window.spirit.element.spirit || {}).app || {}).agent || {}).element || {}).table || {}); };
  return true;
}, test.limit.quick);
test.run('before row.js runs, the page has no row element', 0.2, function () {
  if (!AT) return false;
  return !AT().row ? true : false;
}, test.limit.quick);
test.run('row.js places spirit.element.spirit.app.agent.element.table.row, with create', 0.2, async function () {
  if (!AT) return false;
  load(FILE);
  await settle();
  // One file, one element (goal/G41.28; the general test: a file registers one element). goal/G43.32: at its path,
  // spirit.element.spirit.app.agent.element.table.row.
  E.agentRow = AT().row;
  return E.agentRow && typeof E.agentRow.create === 'function' ? true : false;
}, test.limit.quick);
test.run('the row element loads the tables\' shared element itself, as part of its tree', 0.2, function () {
  if (!w) return false;
  return w.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('the row element registers no other element: agentTable is tableElement.js\'s', 0.2, function () {
  return !/E\.agentTable\s*=/.test(fs.readFileSync(FILE, 'utf8')) ? true : false;
}, test.limit.quick);

// ── unconfigured, the row says so and throws nothing (goal/G41.19, box v23) ──
// The general test mounts every element by itself, handed nothing; the shared element says it is not configured.
const U = { bare: null, made: null };
test.run('agentRow.create, handed a box and no options, throws nothing and says it is not configured', 0.2, async function () {
  if (!E.agentRow) return false;
  U.bare = box('bare');
  let threw = null;
  try { U.made = E.agentRow.create(U.bare, {}); } catch (e) { threw = e; }
  await settle();
  return !threw && !!U.made && /not configured/.test(U.bare.textContent) ? true : false;
}, test.limit.quick);
test.run('the unconfigured row\'s destroy leaves the box empty', 0.2, function () {
  if (!U.made || typeof U.made.destroy !== 'function') return false;
  U.made.destroy();
  return U.bare.innerHTML === '' ? true : false;
}, test.limit.quick);

// ── a row's editor: from the server's get, put where the stream writes it ──
const FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'url', label: 'URL', kind: 'url' }, { field: 'apiKey', label: 'API key', kind: 'secret' },
  { field: 'on', label: 'On', kind: 'bool' }, { field: 'tags', label: 'Tags', kind: 'list' }];
const ROW = { id: 'KR', icon: '', label: 'Row one', url: 'https://one.example', apiKeySet: true, on: true, tags: ['a', 'b'] };
const look = { icon: '🏢', name: 'Provider' };
let ed = null;
let r = null;
test.run('with the row not in its branch, the editor asks provider for a get by its id', 0.2, async function () {
  if (!E.agentRow) return false;
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? Object.assign({}, ROW) : { id: 'KR' }; };
  ed = box('editor');
  r = E.agentRow.create(ed, { table: 'provider', id: 'KR', added: true, look: look, fields: FIELDS });
  await settle();
  return w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'get', id: 'KR' }) ? true : false;
}, test.limit.quick);
test.run('the editor puts the answer at the provider row\'s path under the node\'s agent branch, where the stream writes it', 0.2, function () {
  if (!ed) return false;
  return global.window.spirit.data.agent.data.row('provider', 'KR') && global.window.spirit.data.agent.data.row('provider', 'KR').label === 'Row one' ? true : false;
}, test.limit.quick);
test.run('the editor\'s title row says Add while the row is new', 0.2, function () {
  if (!ed) return false;
  return (/<b>Add<\/b>/).test(ed.innerHTML) && ed.innerHTML.indexOf('Provider') !== -1 ? true : false;
}, test.limit.quick);
test.run('the icon is the editor\'s first field, before the ones the table names (Andy: "the detail panel\'s first input will be the icon")', 0.2, function () {
  if (!ed) return false;
  const ids = Object.keys(ed.parts).map(function (k) { return k.replace(/^ar\d+-/, ''); });
  return ids.indexOf('icon') !== -1 && ids.indexOf('icon') < ids.indexOf('label') ? true : false;
}, test.limit.quick);
test.run('each field shows the row: a line shows its value, a bool its tick, and a list its words split by commas', 0.2, function () {
  if (!ed) return false;
  return the(ed, 'label').value === 'Row one' && the(ed, 'url').value === 'https://one.example' && the(ed, 'on').checked === true && the(ed, 'tags').value === 'a, b'
    ? true : false;
}, test.limit.quick);
test.run('a secret is an empty password box that says only whether it is set', 0.2, function () {
  if (!ed) return false;
  return (/type="password"/).test(the(ed, 'apiKey').tag) && the(ed, 'apiKey').value === '' && /set; type to replace/.test(the(ed, 'apiKey').tag) ? true : false;
}, test.limit.quick);
test.run('the icon chooser is the shell\'s icon selector, on the table\'s icon while the row has none', 0.2, function () {
  if (!ed) return false;
  const sel = w.icons[w.icons.length - 1];
  return sel && sel.value === '🏢' ? true : false;
}, test.limit.quick);
test.run('the icon selector, made with iconSelector.create in the icon field, stands in that field', 0.2, function () {
  if (!ed) return false;
  const sel = w.icons[w.icons.length - 1];
  return sel && sel.container === the(ed, 'icon') && the(ed, 'icon').children.indexOf(sel) !== -1 ? true : false;
}, test.limit.quick);

// ── the Add mode: "Add new <name>", and nothing made until every mandatory field is filled (goal/G41.21) ──
// Andy: "with an "Add new <provider|persona|job>" button at the bottom. Only when all fields, including icon, are filled,
// will the "Add" button not respopnd with an error."; "# mandatory fields (server AND ui) - provider: icon, label,
// valid URL". The table hands its editor its mandatory fields, as its server names them (o.required).
const A = { ea: null, ra: null, addBtn: null };
const addButtonOf = function (b) { return Object.keys(b.parts).filter(function (k) { return new RegExp('id="' + k + '"[^>]*>\\s*Add new Provider').test(b.innerHTML); }).map(function (k) { return b.parts[k]; })[0] || null; };
test.run('with no row, the editor asks no get', 0.2, async function () {
  if (!E.agentRow) return false;
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'add' ? { id: 'KADD' } : (a.op === 'get' ? { id: 'KADD', icon: '🏢', label: 'Fresh', url: 'https://fresh.example' } : { id: 'KADD' }); };
  A.ea = box('adding');
  A.ra = E.agentRow.create(A.ea, { table: 'provider', id: '', added: true, look: look, required: ['icon', 'label', 'url'],
    fields: [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'url', label: 'URL', kind: 'url' }] });
  await settle(); await settle();
  return !w.calls.some(function (c) { return c.args && c.args.op === 'get'; }) ? true : false;
}, test.limit.quick);
test.run('the editor\'s bottom button says Add new Provider, and there is no Delete', 0.2, function () {
  if (!A.ea) return false;
  const addBtnHtml = /<button[^>]*>\s*Add new Provider\s*<\/button>/.test(A.ea.innerHTML);
  return addBtnHtml && !/>\s*Delete\s*</.test(A.ea.innerHTML) ? true : false;
}, test.limit.quick);
test.run('in Add mode a field changed saves nothing', 0.2, async function () {
  if (!A.ea) return false;
  A.addBtn = addButtonOf(A.ea);
  the(A.ea, 'label').value = 'Fresh';
  the(A.ea, 'label').fire('change'); await settle();
  return !w.calls.some(function (c) { return c.args && (c.args.op === 'add' || c.args.op === 'set'); }) ? true : false;
}, test.limit.quick);
test.run('pressed with the URL empty, Add makes nothing and says the URL is missing', 0.2, async function () {
  if (!A.ea) return false;
  if (A.addBtn) A.addBtn.click(); await settle();
  const said = A.ea.innerHTML + ' ' + Object.keys(A.ea.parts).map(function (k) { return String(A.ea.parts[k].textContent || ''); }).join(' ');
  return !w.calls.some(function (c) { return c.args && c.args.op === 'add'; }) && /url/i.test(said) && /not added|missing|required/i.test(said)
    ? true : false;
}, test.limit.quick);
test.run('with every mandatory field filled, Add adds the whole row once, asking provider to add its icon, label and url', 0.2, async function () {
  if (!A.ea) return false;
  the(A.ea, 'url').value = 'https://fresh.example';
  const addBtn2 = addButtonOf(A.ea) || A.addBtn;
  if (addBtn2) addBtn2.click(); await settle(); await settle();
  const adds = w.calls.filter(function (c) { return c.args && c.args.op === 'add'; });
  return adds.length === 1 && adds[0].table === 'provider' && adds[0].args.icon === '🏢' && adds[0].args.label === 'Fresh' && adds[0].args.url === 'https://fresh.example'
    ? true : false;
}, test.limit.quick);
test.run('once added, the editor is the new row\'s, with the title Change', 0.2, function () {
  if (!A.ea) return false;
  const verdict = /<b>Change<\/b>/.test(A.ea.innerHTML) && !/Add new Provider/.test(A.ea.innerHTML) ? true : false;
  A.ra.destroy();
  return verdict;
}, test.limit.quick);

// ── the editor follows its row in spirit.data ──
test.run('a row written to its path shows at once, with nothing listening by hand', 0.2, async function () {
  if (!ed) return false;
  D.mergePath(rowPath('provider', 'KR'), { label: 'From the stream' });
  await settle();
  return the(ed, 'label').value === 'From the stream' ? true : false;
}, test.limit.quick);

// ── a field changed saves the whole row at once; there is no Save (goal/G41.21) ──
// Andy: "and why the fuck does a row not automatically save when i make a change to a field?", and on Q2, does the Save
// button go: "yes, send the whole row for update. it costs nothing, and we don't need more fucking verbs than
// necessary."
const sets = function () { return w.calls.filter(function (c) { return c.args && c.args.op === 'set'; }); };
test.run('the editor has no Save button', 0.2, function () {
  if (!ed) return false;
  return !the(ed, 'save') && !/>\s*Save\s*</.test(ed.innerHTML) ? true : false;
}, test.limit.quick);
test.run('changing the label saves the whole row by itself, asking provider to set its id, icon, label, url, on and tags, with the untyped secret left out', 0.2, async function () {
  if (!ed) return false;
  w.calls.length = 0;
  the(ed, 'label').value = 'Typed';
  the(ed, 'label').fire('change'); await settle();
  const whole = sets()[0];
  // The whole row as the editor shows it: every field, the icon its chooser shows (the table's while the row has none:
  // "all table rows will have an icon, by default the tables icon"); a secret only when typed, so an untyped key is kept.
  return sets().length === 1 && whole.table === 'provider' && JSON.stringify(whole.args) === JSON.stringify({ op: 'set', id: 'KR', icon: '🏢', label: 'Typed', url: 'https://one.example', on: true, tags: ['a', 'b'] })
    ? true : false;
}, test.limit.quick);
test.run('the editor draws nothing it typed into the row: the row changes only by the server\'s stream', 0.2, function () {
  if (!ed) return false;
  return global.window.spirit.data.agent.data.row('provider', 'KR').label === 'From the stream' ? true : false;
}, test.limit.quick);
test.run('a tick changed saves the whole row too, with the label as typed', 0.2, async function () {
  if (!ed) return false;
  // The server takes it and its stream says so, as rowTable publishes every row it changes.
  D.mergePath(rowPath('provider', 'KR'), { label: 'Typed' }); await settle();
  w.calls.length = 0;
  the(ed, 'on').checked = false;
  the(ed, 'on').fire('change'); await settle();
  return sets().length === 1 && sets()[0].args.on === false && sets()[0].args.label === 'Typed' ? true : false;
}, test.limit.quick);
test.run('a secret typed is saved with the row', 0.2, async function () {
  if (!ed) return false;
  w.calls.length = 0;
  the(ed, 'apiKey').value = 'sk-new';
  the(ed, 'apiKey').fire('change'); await settle();
  return sets().length === 1 && sets()[0].args.apiKey === 'sk-new' ? true : false;
}, test.limit.quick);
test.run('a refused save says the server\'s reason', 0.2, async function () {
  if (!ed) return false;
  w.calls.length = 0;
  w.answer = function () { return refused('provider: url must be a url'); };
  the(ed, 'url').value = 'not a url';
  the(ed, 'url').fire('change'); await settle();
  const verdict = /Not saved: provider: url must be a url/.test(ed.innerHTML + ' ' + String((the(ed, 'note') || {}).textContent || ''))
    ? true : false;
  w.answer = function () { return { id: 'KR' }; };
  the(ed, 'url').value = 'https://one.example';
  the(ed, 'url').fire('change'); await settle();
  return verdict;
}, test.limit.quick);

// ── Delete is an are-you-sure button; the stream says it is gone (goal/G41.21) ──
// Andy: "and why are the 'Delete' buttons in the detail panels not armingButtons?"
test.run('the editor\'s Delete button is an armingButton, loaded by the editor itself', 0.2, function () {
  if (!ed) return false;
  w.calls.length = 0;
  w.answer = function () { return { id: 'KR' }; };
  return w.required.indexOf('spirit/element/armingButton.js') !== -1 && w.arming.some(function (a) { return a.button === the(ed, 'delete'); })
    ? true : false;
}, test.limit.quick);
test.run('a first press of Delete deletes nothing: it arms', 0.2, async function () {
  if (!ed) return false;
  the(ed, 'delete').click(); await settle();
  return !w.calls.some(function (c) { return c.args && c.args.op === 'delete'; }) ? true : false;
}, test.limit.quick);
test.run('the second press of Delete asks provider once to delete the row by its id', 0.2, async function () {
  if (!ed) return false;
  the(ed, 'delete').click(); await settle();
  const deletes = w.calls.filter(function (c) { return c.args && c.args.op === 'delete'; });
  return deletes.length === 1 && JSON.stringify(deletes[0].args) === JSON.stringify({ op: 'delete', id: 'KR' }) ? true : false;
}, test.limit.quick);
test.run('once the row is deleted from its branch, the editor says Deleted.', 0.2, async function () {
  if (!ed) return false;
  D.delPath(rowPath('provider', 'KR')); await settle();
  return (/Deleted\./).test(ed.innerHTML) ? true : false;
}, test.limit.quick);

// ── a row already in its branch is read whole by get (goal/G41.18) ──
// A search answers only what a list shows (Andy: "only the ID and the fields shown in a table"), so a row in the branch
// may be that slim row: the editor asks get as it opens, whatever the branch holds (Andy: "that exactly what GET is
// for, to bring in the rest for detail panels etc...").
let ed2 = null;
let r2 = null;
test.run('the editor asks provider for a get by its id, though the branch holds a row', 0.2, async function () {
  if (!E.agentRow) return false;
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? { id: 'KS', icon: '🧪', label: 'Seated', url: 'https://whole.example', apiKeySet: false } : { id: 'KS' }; };
  D.setPath(rowPath('provider', 'KS'), { id: 'KS', icon: '🧪', label: 'Seated' });
  ed2 = box('editor2');
  r2 = E.agentRow.create(ed2, { table: 'provider', id: 'KS', added: false, look: look, fields: FIELDS });
  await settle();
  return w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'get', id: 'KS' }) ? true : false;
}, test.limit.quick);
test.run('the whole row then goes where the stream writes it, with its fields shown', 0.2, function () {
  if (!ed2) return false;
  return global.window.spirit.data.agent.data.row('provider', 'KS') && global.window.spirit.data.agent.data.row('provider', 'KS').url === 'https://whole.example' && the(ed2, 'url') && the(ed2, 'url').value === 'https://whole.example'
    ? true : false;
}, test.limit.quick);
test.run('the editor says Change when opened from the list', 0.2, function () {
  if (!ed2) return false;
  return the(ed2, 'label').value === 'Seated' && /<b>Change<\/b>/.test(ed2.innerHTML) ? true : false;
}, test.limit.quick);
test.run('the icon chooser shows the row\'s own icon', 0.2, function () {
  if (!ed2) return false;
  return w.icons[w.icons.length - 1].value === '🧪' ? true : false;
}, test.limit.quick);
test.run('once destroyed, the editor empties its box and hears its row no more', 0.2, async function () {
  if (!ed2) return false;
  r2.destroy();
  D.mergePath(rowPath('provider', 'KS'), { label: 'After' }); await settle();
  const verdict = ed2.innerHTML === '' ? true : false;
  if (r) r.destroy();
  return verdict;
}, test.limit.quick);

// ── a pick field narrowed to this row: of (goal/G41.21) ──
// Box v17: "a dropdown search of the model table ... showing only the models whose provider is this provider", and
// "The Model field is hidden while the model table holds no model of this provider". of names the picked table's field
// that holds this row's id; the narrowing goes to the table's search (../rowTable.js).
const NARROW = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'model', label: 'Model', kind: 'pick', pick: 'model', of: 'providerId' }];
const N = { LIST: null, scratchDb: null, sctx: null, PA: '', PB: '', MA: '', MB: '', withModels: null, withNone: null };
const offered = function (s) {
  if (!s || !N.LIST || typeof N.LIST.order !== 'function') return null;
  const rows = s.o.data ? D.rowsOf(s.o.data) : (typeof s.o.rows === 'function' ? s.o.rows() || [] : []);
  const entries = rows.map(function (r, i) { return { key: String(r.key), row: r, at: i }; });
  return N.LIST.order(entries, { words: '', values: {}, filters: s.o.filters || [], columns: s.o.columns || [], matched: s.o.matched, score: s.o.score })
    .map(function (e) { return e.key; }).sort();
};
// What a row shows in the dropdown: its columns' values (from, else field), as the list draws its cells.
const cellsOf = function (s, key) { const r = global.window.spirit.data.agent.data.row('model', key) || {}; return (s.o.columns || []).map(function (c) { const v = r[c.from || c.field]; return v == null ? '' : String(v); }).join(' ').trim(); };
const narrowed = async function (models) {
  w.calls.length = 0;
  const before = w.searches.length;
  w.answer = function (table, a) {
    if (a.op === 'get') return { id: N.PA, icon: '', label: 'Narrow' };
    if (table === 'model' && a.op === 'search') return { items: models.map(function (k) { return { key: k, label: JSON.stringify({ id: k, label: k }) }; }), more: false };
    return { id: N.PA };
  };
  const ed3 = box('narrow');
  const r3 = E.agentRow.create(ed3, { table: 'provider', id: N.PA, added: false, look: look, fields: NARROW });
  await settle(); await settle();
  const s = w.searches.slice(before).filter(function (x) { return x.o && x.o.verb === 'model'; })[0] || null;
  let args = null; try { args = s && typeof s.o.args === 'function' ? s.o.args('claude') : null; } catch (e) { args = null; }
  const at = ed3.innerHTML.search(/for="[^"]*-model"/);
  const lineStart = at === -1 ? -1 : ed3.innerHTML.lastIndexOf('<div', at);
  const line = lineStart === -1 ? '' : ed3.innerHTML.slice(lineStart, at);
  const shown = at !== -1 && !/\bhidden\b|display:\s*none/.test(line);
  const out = { search: s, args: args, shown: shown, calls: w.calls.slice(), offered: offered(s), cells: s ? (offered(s) || []).map(function (k) { return cellsOf(s, k); }) : [] };
  r3.destroy();
  return out;
};
test.after(function () { if (N.scratchDb) fs.rmSync(N.scratchDb, { recursive: true, force: true }); });
test.run('the real provider and model servers run on a scratch agent.db, with the model table\'s search seated in the page\'s branch', 0.2, function () {
  if (!E.agentRow) return false;
  // WHAT THE DROPDOWN SHOWS (Andy: "the model picker in provider details of course shows models at all, when it must show
  // models from that provider"): the list is a view of its rows (its data branch, or rows()), filtered and ranked by the
  // real list's own heart, probabilitySearch.order, the state it is made with.
  N.LIST = (function () {
    // goal/G43.32: a page's spirit, so the list places itself at spirit.element.spirit.element.search as it runs.
    const win = { window: null, spirit: require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit({ element: {} }), console: console };
    win.window = win;
    vm.createContext(win);
    ['spirit/search/string.js', 'spirit/search/object.js', 'spirit/listLimiter.js', 'spirit/element/search.js'].forEach(function (rel) {
      vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), win, { filename: rel });
    });
    return ((win.spirit.element.spirit || {}).element || {}).search;
  }());
  // The page holds two models in its branch, one of this provider's and one of another's.
  // THE ROWS AS THE MODEL TABLE ITSELF ANSWERS THEM: the real provider and model servers (../provider/server.js,
  // ../model/server.js) on a scratch agent.db, two providers with a model each, the model table's search seated in the
  // page's branch as the list seats it (spirit.data.seatRows).
  const { DatabaseSync } = require('node:sqlite');
  N.scratchDb = ownTemp('spirit-tableElement');
  // The servers check their arguments through the one spirit object's rules (spirit.check), as in the agent process.
  global.window.spirit.check = require(path.join(RUN, 'spirit', 'spirit.js')).check;
  N.sctx = { db: new DatabaseSync(path.join(N.scratchDb, 'agent.db')), dbFile: path.join(N.scratchDb, 'agent.db'), tables: {}, publish: function () {} };
  // goal/G43.32: a server runs in node, where spirit is spirit.js itself and spirit.require answers at once (decided 3);
  // the page's stand-in is the global spirit only for the page's scripts.
  const pageSpiritObj = global.spirit;
  global.spirit = require(path.join(RUN, 'spirit', 'spirit.js'));
  try {
    N.sctx.tables.provider = require(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'provider', 'server.js'))(N.sctx);
    N.sctx.tables.model = require(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'model', 'server.js'))(N.sctx);
  } finally { global.spirit = pageSpiritObj; }
  N.PA = N.sctx.tables.provider.verb.handler({ op: 'add', icon: '🏢', label: 'Mine', url: 'https://mine.example' }).id;
  N.PB = N.sctx.tables.provider.verb.handler({ op: 'add', icon: '🏛', label: 'Theirs', url: 'https://theirs.example' }).id;
  N.MA = N.sctx.tables.model.verb.handler({ op: 'add', label: 'claude-mine', providerId: N.PA }).id;
  N.MB = N.sctx.tables.model.verb.handler({ op: 'add', label: 'claude-theirs', providerId: N.PB }).id;
  D.seatRows(BRANCH('model'), N.sctx.tables.model.verb.handler({ op: 'search', text: '' }).items);
  // Only what a search answers is in the branch, as when the model list was opened first: no row came whole on the stream.
  return true;
}, test.limit.quick);
test.run('the Model dropdown searches the model table narrowed to this row, by its text and this row\'s id as providerId', 0.2, async function () {
  if (!N.sctx) return false;
  N.withModels = await narrowed([N.MA]);
  return N.withModels.args && N.withModels.args.op === 'search' && N.withModels.args.text === 'claude' && N.withModels.args.providerId === N.PA ? true : false;
}, test.limit.quick);
test.run('with a model of this provider in the model table, the Model field is shown', 0.2, function () {
  if (!N.withModels) return false;
  return N.withModels.shown ? true : false;
}, test.limit.quick);
test.run('of the page\'s models, the dropdown offers this provider\'s alone, not another provider\'s', 0.2, function () {
  if (!N.withModels) return false;
  return JSON.stringify(N.withModels.offered) === JSON.stringify([N.MA]) ? true : false;
}, test.limit.quick);
// Andy: "the model picker for the provider table showed a bunch of EMPTY rows": a row is drawn by what its table's
// search answers, the model's name.
test.run('each row the dropdown offers shows the model, as the model table answers it', 0.2, function () {
  if (!N.withModels) return false;
  return N.withModels.cells.length > 0 && N.withModels.cells.every(function (c) { return (/claude-mine/).test(c); })
    ? true : false;
}, test.limit.quick);
test.run('the editor asks the model table for this provider\'s models, narrowed the same way', 0.2, async function () {
  if (!N.sctx) return false;
  N.withNone = await narrowed([]);
  return N.withNone.calls.some(function (c) { return c.table === 'model' && c.args && c.args.op === 'search' && c.args.providerId === N.PA; }) ? true : false;
}, test.limit.quick);
test.run('with no model of this provider, the Model field is hidden', 0.2, function () {
  if (!N.withNone) return false;
  return !N.withNone.shown ? true : false;
}, test.limit.quick);

// ── an output field shows, and is never picked or sent (goal/G41.21) ──
// Andy: "In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for that.............".
const O = { eo: null, ro: null, before: 0 };
test.run('an output field shows the provider by its label', 0.2, async function () {
  if (!E.agentRow) return false;
  D.setPath(rowPath('provider', 'KOUT'), { id: 'KOUT', icon: '🅰', label: 'Anthropic' });
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? { id: 'KM', icon: '🧠', label: 'A model', providerId: 'KOUT' } : { id: 'KM' }; };
  O.before = w.searches.length;
  O.eo = box('output');
  O.ro = E.agentRow.create(O.eo, { table: 'model', id: 'KM', added: false, look: look,
    fields: [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'providerId', label: 'Provider', kind: 'output', pick: 'provider' }] });
  await settle(); await settle();
  const shownAll = O.eo.innerHTML + ' ' + Object.keys(O.eo.parts).map(function (k) { return String(O.eo.parts[k].textContent || '') + String(O.eo.parts[k].innerHTML || ''); }).join(' ');
  return (/Anthropic/).test(shownAll) ? true : false;
}, test.limit.quick);
test.run('the output field has no picker and no input for the provider', 0.2, function () {
  if (!O.eo) return false;
  return !w.searches.slice(O.before).some(function (s) { return s.o && s.o.verb === 'provider'; }) && !/<input[^>]*id="[^"]*-providerId"/.test(O.eo.innerHTML)
    ? true : false;
}, test.limit.quick);
test.run('a save of the row never sends the output field', 0.2, async function () {
  if (!O.eo) return false;
  the(O.eo, 'label').value = 'Renamed';
  the(O.eo, 'label').fire('change'); await settle();
  const set = w.calls.filter(function (c) { return c.args && c.args.op === 'set'; })[0];
  const verdict = set && set.args.label === 'Renamed' && !('providerId' in set.args) ? true : false;
  O.ro.destroy();
  return verdict;
}, test.limit.quick);

// ── a pick on a real job row saves, whatever else is unpicked (goal/G41.21) ──
// Andy: "when i pick a persona, provider, or a bundle, the UI responds to ALL three of those picker changes with exactly
// these words: "Not saved: agent.job: provider must be a peer's public key".... WTF!", and "that message could not be more
// stupid, when the user just selected a key by label for the respective table!!!!!". The agent server here is the real
// job, persona and provider tables on the scratch agent.db: a job whose provider and persona are not picked yet.
const J = { ej: null, rj: null, before: 0, bBefore: 0, PZ: '', JZ: '' };
const viaTables = function (table, a) {
  try { return N.sctx.tables[table].verb.handler(a); } catch (e) { return refused(String((e.extra && e.extra.why) || e.message)); }
};
const saidNow = function () { return J.ej.innerHTML + ' ' + Object.keys(J.ej.parts).map(function (k) { return String(J.ej.parts[k].textContent || ''); }).join(' '); };
const pickIn = function (table, key) {
  const s = w.searches.slice(J.before).filter(function (x) { return x.o && x.o.verb === table; }).pop();
  if (!s) return false;
  s.value = key; s.row = { id: key, label: table };
  if (typeof s.o.pick === 'function') s.o.pick(s.row, key);
  return true;
};
test.run('picking a persona, with the provider not picked yet, saves the job with the persona picked, and nothing says Not saved', 0.2, async function () {
  if (!N.sctx) return false;
  // In node, as above.
  const pageSpiritAgain = global.spirit;
  global.spirit = require(path.join(RUN, 'spirit', 'spirit.js'));
  try {
    N.sctx.tables.persona = require(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'persona', 'server.js'))(N.sctx);
    N.sctx.tables.job = require(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'job', 'server.js'))(N.sctx);
  } finally { global.spirit = pageSpiritAgain; }
  J.PZ = viaTables('persona', { op: 'add', icon: '🎭', label: 'A reviewer', persona: 'You review.' }).id;
  J.JZ = viaTables('job', { op: 'add', icon: '📋', label: 'A job' }).id;
  w.calls.length = 0;
  w.answer = viaTables;
  J.before = w.searches.length;
  J.bBefore = w.bundles.length;
  J.ej = box('real-job');
  J.rj = E.agentRow.create(J.ej, { table: 'job', id: J.JZ, added: false, look: look, fields: [{ field: 'label', label: 'Label', kind: 'name' },
    { field: 'bundle', label: 'Bundle', kind: 'bundle' }, { field: 'provider', label: 'Provider', kind: 'pick', pick: 'provider' }, { field: 'persona', label: 'Persona', kind: 'pick', pick: 'persona' }] });
  await settle(); await settle();
  const personaPicked = pickIn('persona', J.PZ); await settle(); await settle();
  const afterPersona = viaTables('job', { op: 'get', id: J.JZ });
  return personaPicked && afterPersona.persona === J.PZ && !/Not saved/.test(saidNow())
    ? true : false;
}, test.limit.quick);
test.run('picking a bundle saves the job too, with the persona kept, and nothing says Not saved', 0.2, async function () {
  if (!J.ej) return false;
  const bsel = w.bundles.slice(J.bBefore).pop();
  if (bsel) { bsel.value = 7; bsel.row = { id: 7, label: 'Reader' }; (bsel.heard.change || []).forEach(function (fn) { fn({ target: bsel }); }); }
  await settle(); await settle();
  const afterBundle = viaTables('job', { op: 'get', id: J.JZ });
  return !!bsel && String(afterBundle.bundle) === '7' && afterBundle.persona === J.PZ && !/Not saved/.test(saidNow())
    ? true : false;
}, test.limit.quick);
test.run('picking a provider saves the job, and nothing says Not saved', 0.2, async function () {
  if (!J.ej) return false;
  const PV = viaTables('provider', { op: 'add', icon: '🏢', label: 'A provider', url: 'https://picked.example' }).id;
  const providerPicked = pickIn('provider', PV); await settle(); await settle();
  const afterProvider = viaTables('job', { op: 'get', id: J.JZ });
  const verdict = providerPicked && afterProvider.provider === PV && !/Not saved/.test(saidNow())
    ? true : false;
  J.rj.destroy();
  return verdict;
}, test.limit.quick);

// ── a bundle field: the bundle selector in dropdown mode (goal/G41.21) ──
// Box v17: "The job's detail panel ... sets it with a bundleSelector in dropdown mode."
const B = { ed4: null, r4: null, bsel: null };
test.run('the editor loads the bundle selector itself', 0.2, async function () {
  if (!E.agentRow) return false;
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? { id: 'KJ', icon: '', label: 'A job', bundle: '7' } : { id: 'KJ' }; };
  B.ed4 = box('bundle');
  B.r4 = E.agentRow.create(B.ed4, { table: 'job', id: 'KJ', added: false, look: look, fields: [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'bundle', label: 'Bundle', kind: 'bundle' }] });
  await settle(); await settle();
  B.bsel = w.bundles[w.bundles.length - 1];
  return w.required.indexOf('spirit/element/search/bundle.js') !== -1 ? true : false;
}, test.limit.quick);
// Andy: "why would the bundle picker show "bundle 2" for it's selection instead of the fucking label?": the field says
// the bundle by its label, as the node has it (auth.bundle get: 7 is Reader).
test.run('the bundle field shows the job\'s bundle by its label, not its number', 0.2, function () {
  if (!B.ed4) return false;
  const bundleSays = B.bsel ? String((B.bsel.row && B.bsel.row.label) || B.bsel.opts.placeholder || '') : '';
  return (/Reader/).test(bundleSays) && !/bundle\s*7/i.test(bundleSays) ? true : false;
}, test.limit.quick);
test.run('a bundle selector is made in the bundle field, in dropdown mode', 0.2, function () {
  if (!B.ed4) return false;
  return !!B.bsel && B.bsel.container === the(B.ed4, 'bundle') && B.bsel.opts.face !== 'pane'
    ? true : false;
}, test.limit.quick);
// goal/G41.25, Andy, box: "so the bundle pickers in the persona and job details will always list ALL bundles": the
// selector is mounted for no app server (spirit/element/search/bundle.js, options.family).
test.run('the bundle field lists every bundle, as its selector is mounted for no app server', 0.2, function () {
  if (!B.ed4) return false;
  return !!B.bsel && (B.bsel.opts.family === undefined || B.bsel.opts.family === '') ? true : false;
}, test.limit.quick);
test.run('a bundle picked saves the whole row at once, asking job to set its id, label and bundle', 0.2, async function () {
  if (!B.bsel) return false;
  w.calls.length = 0;
  B.bsel.value = 9; B.bsel.row = { id: 9, label: 'Reader' };
  (B.bsel.heard.change || []).forEach(function (fn) { fn({ target: B.bsel }); });
  await settle();
  const set = w.calls.filter(function (c) { return c.args && c.args.op === 'set'; })[0];
  return set && set.table === 'job' && String(set.args.bundle) === '9' && set.args.label === 'A job' ? true : false;
}, test.limit.quick);
// Andy: "persona detail: the bundle picker doesn not let me change values! (actually it does let me change it, i just
// doesn't seem to hear the change from the server)": the row's bundle changed on the stream, the field says the new one.
test.run('when the server changes the row\'s bundle, the field says the new one, Writer', 0.2, async function () {
  if (!B.ed4) return false;
  D.mergePath(rowPath('job', 'KJ'), { bundle: '9' }); await settle(); await settle();
  const bsel2 = w.bundles[w.bundles.length - 1];
  const bundleSays2 = bsel2 ? String((bsel2.row && bsel2.row.label) || bsel2.opts.placeholder || '') : '';
  const verdict = /Writer/.test(bundleSays2) && !/Reader/.test(bundleSays2) ? true : false;
  B.r4.destroy();
  return verdict;
}, test.limit.quick);

// Box v17: "A bundle deleted while a job names it leaves that job with no grant, and the job says so in its detail
// panel, never silently."
const openedJob = async function (bundle) {
  w.calls.length = 0;
  w.bundleAsks.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? { id: 'KG', icon: '', label: 'A job', bundle: bundle } : { id: 'KG' }; };
  const ed5 = box('gone-' + bundle);
  const r5 = E.agentRow.create(ed5, { table: 'job', id: 'KG', added: false, look: look, fields: [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'bundle', label: 'Bundle', kind: 'bundle' }] });
  await settle(); await settle();
  // Everything the editor shows: its markup and what it wrote into its parts since.
  const said = ed5.innerHTML + Object.keys(ed5.parts).map(function (k) { return String(ed5.parts[k].innerHTML || '') + String(ed5.parts[k].textContent || ''); }).join(' ');
  const asked = w.bundleAsks.slice();
  r5.destroy();
  return { said: said, asked: asked };
};
const G = { goneOne: null };
test.run('a job naming a bundle asks the node for it with an auth.bundle get by its id', 0.2, async function () {
  if (!E.agentRow) return false;
  G.goneOne = await openedJob('5');
  return G.goneOne.asked.some(function (a) { return a && a.op === 'get' && Number(a.id) === 5; }) ? true : false;
}, test.limit.quick);
test.run('a bundle the node no longer has is said in the detail panel, with the bundle and that the job has no grant', 0.2, function () {
  if (!G.goneOne) return false;
  return (/\b5\b/).test(G.goneOne.said) && /no grant/i.test(G.goneOne.said) ? true : false;
}, test.limit.quick);
test.run('a bundle the node has is said as no such thing', 0.2, async function () {
  if (!E.agentRow) return false;
  const heldOne = await openedJob('7');
  return !/no grant/i.test(heldOne.said) ? true : false;
}, test.limit.quick);
