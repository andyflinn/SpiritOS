'use strict';

// spirit/run/spirit/app/agent/table/model/test/server.js
// The tests of spirit/app/agent/table/model/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4, goal/G41.18, goal/G41.26). What the tables share is tested in ../../test/. The Update
// model list pane is gone (goal/G41.26): its Ask form sits at the top of the model list, tested here. The server is made on a scratch agent.db as nodeAgent.js
// makes it, beside the provider table it names; the page files run in node on a window of their own, the shared
// elements stubs that keep what they were handed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

// One test.run per test (goal/G47.2).
const DIR = path.join(__dirname, '..');
// Its list and editor are the agent app's elements, in spirit/app/agent/element/table/model/ since goal/G43.32 (rule 5).
const EL = path.join(__dirname, '..', '..', '..', 'element', 'table', 'model');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const AGENT = familyPath('agent');
// A box: its markup makes a part per id, each with its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, parts: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) { const id = /\bid="([^"]+)"/.exec(m[0]); if (id) b.parts[id[1]] = part(m[0], id[1]); }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
    appendChild: function (c) { return c; },
    addEventListener: function () {},
  };
  return b;
}
function part(tag, id) {
  const heard = {};
  const n = { tag: tag, id: id, isConnected: true, children: [], style: {}, innerHTML: '', textContent: '', className: '',
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    querySelector: function () { return null; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); } };
  return n;
}
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }
// Everything a box shows: its markup and what was written into its parts since.
function shown(b) { return b.innerHTML + Object.keys(b.parts).map(function (k) { return String(b.parts[k].innerHTML || '') + String(b.parts[k].textContent || ''); }).join(''); }

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }

// What the tests make, for the tests after them.
const X = { scratch: '', db: null, ctx: null, t: null, published: [], cols: [], provider: null, added: null, gone: '', found: null,
  made: null, E: {}, pane: null, list: null, o: null, rf: null, drop: null, askBtn: null, ab: null, r: null, AD: null, BRANCH: '' };
const NO_TABLE = 'no model table: server.js was not made';
const NO_ROW = 'no model added: the add was refused';
const NO_PAGE = 'no page files: they were not placed';
const NO_ASK = 'no Ask button or no provider dropdown: the form was not drawn';
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its files ──
test.run('it has server.js, and elementTable.js and elementRow.js in the app\'s element folder', 0.2, function () {
  const files = [path.join(DIR, 'server.js'), path.join(EL, 'elementTable.js'), path.join(EL, 'elementRow.js')];
  return files.every(function (f) { return fs.existsSync(f); }) ? true : 'missing: ' + short(files.filter(function (f) { return !fs.existsSync(f); }));
}, test.limit.quick);

// ── server.js: the table in agent.db ──
test.run('server.js(ctx) answers the table, its verb and has', 0.2, function () {
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return 'no server.js';
  X.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-model-'));
  const db = X.db = new DatabaseSync(path.join(X.scratch, 'agent.db'));
  const ctx = X.ctx = { db: db, dbFile: path.join(X.scratch, 'agent.db'), tables: {}, publish: function (x) { X.published.push(x); } };
  ctx.tables.provider = require(path.join(DIR, '..', 'provider', 'server.js'))(ctx);
  const t = X.t = ctx.tables.model = require(path.join(DIR, 'server.js'))(ctx);
  X.cols = db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' ? true : 'answered: ' + short(t && Object.keys(t));
}, test.limit.quick);
// Andy, box v22: "with Label and Description, provider-key, and model-name and capabilities"; then, goal/G41.21: "i decided that model, does NOT need a name field, which i also NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the models UI."
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.cols.indexOf(c) !== -1 ? true : 'columns: ' + short(X.cols); };
test.run('the model table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the model table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the model table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the model table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the model table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the model table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the model table has a providerId column', 0.2, function () { return has('providerId'); }, test.limit.quick);
test.run('the model table has a capabilities column', 0.2, function () { return has('capabilities'); }, test.limit.quick);
test.run('and nothing else: no model name column, the label holds it', 0.2, function () {
  return X.cols.length === 8 && X.cols.indexOf('modelName') === -1 ? true : 'columns: ' + short(X.cols);
}, test.limit.quick);

// ── server.js: a model names a provider that is there ──
test.run('a model is added with its provider\'s id, its label the model name as the provider gives it', 0.2, function () {
  if (!X.t) return NO_TABLE;
  X.provider = call(X.ctx.tables.provider.verb, { op: 'add', icon: '🏢', label: 'Anthropic', url: 'https://api.anthropic.example' });
  X.added = call(X.t.verb, { op: 'add', label: 'claude-opus-5-5', providerId: X.provider.id, capabilities: ['text', 'tools'] });
  X.got = X.added.id ? call(X.t.verb, { op: 'get', id: X.added.id }) : null;
  const got = X.got;
  return got && got.providerId === X.provider.id && got.label === 'claude-opus-5-5' ? true : 'get: ' + short(got);
}, test.limit.quick);
test.run('its capabilities are a list', 0.2, function () {
  const got = X.got;
  return got && JSON.stringify(got.capabilities) === '["text","tools"]' ? true : 'capabilities: ' + short(got && got.capabilities);
}, test.limit.quick);
test.run('a model naming a provider that is not there is refused, saying so', 0.2, function () {
  if (!X.t) return NO_TABLE;
  X.gone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  const noProvider = call(X.t.verb, { op: 'add', label: 'Lost', providerId: X.gone });
  return noProvider.refusal === 'bad-request' && /no provider/.test(noProvider.why) ? true : 'answer: ' + short(noProvider);
}, test.limit.quick);
test.run('and so is a set to one, the provider kept', 0.2, function () {
  if (!X.added || !X.added.id) return NO_ROW;
  return call(X.t.verb, { op: 'set', id: X.added.id, providerId: X.gone }).refusal === 'bad-request' && call(X.t.verb, { op: 'get', id: X.added.id }).providerId === X.provider.id ? true : 'set answered';
}, test.limit.quick);

// ── server.js: a model is shown with its provider's icon (goal/G41.18) ──
// Andy, box v17: "the model will [icon] \"model-name\", where the [icon] will be the provider-icon, associated with the
// provider-key on the model row". The server says it with the row (rowTable's shows), so the
// list draws only what the server sends (rule/19).
test.run('a model\'s get carries providerIcon, the icon of its provider row', 0.2, function () {
  if (!X.added || !X.added.id) return NO_ROW;
  call(X.ctx.tables.provider.verb, { op: 'set', id: X.provider.id, icon: '🅰' });
  const shownGet = call(X.t.verb, { op: 'get', id: X.added.id });
  return shownGet && shownGet.providerIcon === '🅰' ? true : 'get: ' + short(shownGet);
}, test.limit.quick);
test.run('and so does each row a search finds', 0.2, function () {
  if (!X.t) return NO_TABLE;
  try { X.found = JSON.parse((call(X.t.verb, { op: 'search', text: 'opus' }).items || [])[0].label); } catch (e) { X.found = null; }
  return X.found && X.found.providerIcon === '🅰' ? true : 'found: ' + short(X.found);
}, test.limit.quick);
// goal/G41.18, Andy: "only the ID and the fields shown in a table, that's all it needs": the model list shows the
// provider's icon and the model name.
test.run('a search answers the id and what the model list shows, the label (the model name) and the provider\'s icon, nothing else', 0.2, function () {
  const found = X.found;
  return found && JSON.stringify(Object.keys(found).sort()) === '["id","label","providerIcon"]' ? true : 'found: ' + short(found && Object.keys(found));
}, test.limit.quick);
test.run('and each model row the server publishes', 0.2, function () {
  if (!X.provider) return NO_TABLE;
  X.published.length = 0;
  call(X.t.verb, { op: 'add', label: 'claude-sonnet-5-5', providerId: X.provider.id });
  const pub = X.published.filter(function (x) { return x.agent && x.agent.table === 'model' && x.agent.row; })[0];
  return pub && pub.agent.row.providerIcon === '🅰' ? true : 'published: ' + short(X.published);
}, test.limit.quick);
test.run('a model with no provider has an empty providerIcon', 0.2, function () {
  if (!X.t) return NO_TABLE;
  const bare = call(X.t.verb, { op: 'add', label: 'Bare' });
  return bare.id && call(X.t.verb, { op: 'get', id: bare.id }).providerIcon === '' ? true : 'get: ' + short(bare.id && call(X.t.verb, { op: 'get', id: bare.id }));
}, test.limit.quick);
test.run('it is shown, not kept: the model table has no providerIcon column', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const cols2 = X.db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  return cols2.indexOf('providerIcon') === -1 ? true : 'columns: ' + short(cols2);
}, test.limit.quick);

// ── the page: elementTable.js and elementRow.js ──
const opened = [];
const detail = { open: function (make) { opened.push(make); }, look: function (t2) { return { icon: '🧠', name: 'Model', title: 'Models', table: t2 }; } };
test.run('they place spirit.element.spirit.app.agent.element.table.model.elementTable and elementRow', 0.2, function () {
  const made = X.made = { tables: [], rows: [], required: [], searches: [], busy: [], calls: [], answer: null, forms: [] };
  made.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    return function (args) { made.calls.push({ table: table, args: args }); const a = made.answer ? made.answer(table, args) : {}; return a instanceof Error ? Promise.reject(a) : Promise.resolve(a); };
  } });
  global.window = { spirit: { familyPath: familyPath, get element() { return this.elements; }, elements: nestSearch({
    // The providerSelector:dropdown and the busyButton, each tested in its own folder: stand-ins that keep what they were
    // handed, as the Update model list pane's test had them.
    'search': { create: function (host, o) { const s2 = { host: host, o: o, value: '', row: null, refresh: function () {}, destroy: function () { s2.destroyed = true; } }; made.searches.push(s2); return s2; } },
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given.
    rowForm: { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: part('<div>', ''), span: part('<span>', ''), button: part('<button>', '') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      made.forms.push(f); return f;
    } },
    busyButton: { attach: function (button, opts) { const a = { button: button, opts: opts || {}, answers: [] }; made.busy.push(a); button.addEventListener('click', function () { if (typeof a.opts.run === 'function') a.answers.push(a.opts.run()); }); return button; } },
    // The agent tables' shared search (../../tableElement.js, agentDetail.search), the providerSelector it makes: a
    // stand-in that hands the search element what the real one does (rule/29): its data the table's branch, as the agent
    // family's cache manager names it (spirit.data.agent.data.branch, goal/G41.28).
    agentDetail: { search: function (host, o2, more) { const E2 = global.window.spirit.element.spirit.element; const AD2 = ((global.window.spirit.data || {}).agent || {}).data; const s3 = E2.search.create(host, Object.assign({ server: 'agent', verb: o2.table, data: AD2 ? AD2.branch(o2.table) : '' }, more || {})); s3.refresh(); return s3; } },
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  }) } };
  // goal/G43.32: the stand-ins stand where the page files read them, at spirit.element.<their path>; the shared table
  // element's pieces (once agentDetail) with its create.
  const STAND = global.window.spirit.elements;
  global.window = { spirit: { familyPath: familyPath, element: { spirit: {
    element: { search: STAND.search, rowForm: STAND.rowForm, busyButton: STAND.busyButton },
    app: { agent: { element: { table: { tableElement: Object.assign({}, STAND.agentDetail, STAND.agentTable), rowElement: STAND.agentRow } } } } } } } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { made.required.push(String(p)); return Promise.resolve(p === AGENT ? made.family : true); };
  // The page's spirit.require answers the helper, so each file places itself by installSpiritElement as it runs
  // (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  // The page's one data set (spirit/data.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.node.key. A family's
  // cache manager is found by spirit.cacheManager(name), the real one, which in node reads it from its own disk.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: HOME_KEY };
  global.window.spirit.data.homeNode(HOME_KEY);
  global.window.spirit.cacheManager = require(path.join(RUN, 'spirit', 'spirit.js')).cacheManager;
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(EL, f), 'utf8'), { filename: path.join(EL, f) }); });
  const T = global.window.spirit.element.spirit.app.agent.element.table.model || {};
  X.E = { modelTable: T.elementTable, modelRow: T.elementRow };
  return X.E.modelTable && typeof X.E.modelTable.create === 'function' && X.E.modelRow && typeof X.E.modelRow.create === 'function' ? true : 'placed: ' + short(Object.keys(T));
}, test.limit.quick);
test.run('elementTable.js requires the shared element and its own row element', 0.2, async function () {
  if (!X.E.modelTable || !X.E.modelRow) return NO_PAGE;
  X.pane = box('models');
  X.list = X.E.modelTable.create(X.pane, detail);
  await settle();
  const made = X.made;
  return made.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/element/table/model/elementRow.js') !== -1 ? true : 'required: ' + short(made.required);
}, test.limit.quick);
test.run('it builds on agentTable, in its box, for the model table, with the detail pane and no api, and no Add (Andy, on G41.18: "get RID of [Add a Model] button ... NOT required")', 0.2, function () {
  if (!X.list) return NO_PAGE;
  const made = X.made;
  const o = X.o = made.tables[0] && made.tables[0].o;
  return made.tables.length === 1 && !!made.tables[0].c && o.table === 'model' && !('api' in o) && o.detail === detail && o.add === false ? true : 'agentTable: ' + short(o && { table: o.table, add: o.add });
}, test.limit.quick);
// goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon.
test.run('its list shows each model by its provider\'s icon and its label, the model name (goal/G41.18, G41.21)', 0.2, function () {
  const o = X.o;
  const shownBy = ((o && o.columns) || []).map(function (c) { return c.from || c.field; });
  return JSON.stringify(shownBy) === '["providerIcon","label"]' ? true : 'columns: ' + short(o && o.columns);
}, test.limit.quick);

// ── the Ask form at the top of 🧠 Models, the Update model list pane gone (goal/G41.26) ──
// Andy, box: "the middle pane (🧠 Update model list): The form \"from [Pick a provider ▾] [Ask]\" moves to the top of
// the left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask]
// button will no longer spit out a list, and simply update the agent.model table".
test.run('the list is handed no provider models button', 0.2, function () {
  if (!X.o) return NO_PAGE;
  const o = X.o;
  return !((o && o.buttons) || []).some(function (b2) { return b2 && b2.label === 'provider models'; }) ? true : 'buttons: ' + short(o && o.buttons);
}, test.limit.quick);
test.run('the Update model list pane is gone: model/updatePanel.js and its test', 0.2, function () {
  return !fs.existsSync(path.join(DIR, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.md'))
    ? true : 'still there: ' + short(['updatePanel.js', 'test/updatePanel.js', 'test/updatePanel.md'].filter(function (f) { return fs.existsSync(path.join(DIR, f)); }));
}, test.limit.quick);
test.run('and nothing loads it', 0.2, function () {
  if (!X.made) return NO_PAGE;
  return X.made.required.indexOf('spirit/app/agent/table/model/updatePanel.js') === -1 && !X.E.modelUpdate ? true : 'required: ' + short(X.made.required);
}, test.limit.quick);
test.run('it loads what the form uses itself (rule/26): the search element, the busyButton and the rowForm', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const made = X.made;
  return made.required.indexOf('spirit/element/search.js') !== -1 && made.required.indexOf('spirit/element/busyButton.js') !== -1 && made.required.indexOf('spirit/element/rowForm.js') !== -1 ? true : 'required: ' + short(made.required);
}, test.limit.quick);
// goal/G41.27, Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]": the form is a rowForm, ❓, the
// providerSelector:dropdown in its span, Ask its button; the word from at its start goes, as new and grant did.
test.run('the Ask form is one rowForm, its icon ❓ and its button Ask', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const made = X.made;
  const rf = X.rf = made.forms[0];
  X.drop = made.searches.filter(function (x) { return x.o && x.o.verb === 'provider'; })[0];
  X.askBtn = rf ? rf.button : the(X.pane, 'ask');
  return made.forms.length === 1 && rf.opts.icon === '❓' && rf.opts.button === 'Ask' ? true : 'rowForms: ' + short(made.forms.map(function (f) { return f.opts; }));
}, test.limit.quick);
test.run('its span holds the providerSelector:dropdown, Pick a provider, and nothing else', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const rf = X.rf, drop = X.drop;
  const inSpan = !!rf && !!drop && (drop.host === rf.span || rf.span.children.indexOf(drop.host) !== -1) && rf.span.children.length <= 1;
  return !!drop && drop.o.face === 'dropdown' && drop.o.server === 'agent' && drop.o.data === global.window.spirit.data.nodeId(HOME_KEY) + '/agent/provider' && drop.o.placeholder === 'Pick a provider' && inSpan
    ? true : 'dropdown ' + short(drop && { face: drop.o.face, verb: drop.o.verb, data: drop.o.data, placeholder: drop.o.placeholder }) + ', in the span ' + inSpan;
}, test.limit.quick);
test.run('the word from is gone, and it draws no Ask button of its own', 0.2, function () {
  if (!X.pane) return NO_PAGE;
  return !/>\s*from\s*</.test(X.pane.innerHTML) && !/<button\b[^>]*>\s*Ask\s*</.test(X.pane.innerHTML) ? true : 'pane: ' + short(X.pane.innerHTML);
}, test.limit.quick);
// At the top: the list is drawn into a part of the pane below the form, never over it.
test.run('the form is at the top of the pane, the model list below it', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const made = X.made, rf = X.rf, pane = X.pane;
  const listAt = made.tables[0] && made.tables[0].c && made.tables[0].c.id ? pane.innerHTML.indexOf('id="' + made.tables[0].c.id + '"') : -1;
  const formAt = rf && rf.container && rf.container.id ? pane.innerHTML.indexOf('id="' + rf.container.id + '"') : -1;
  return formAt !== -1 && listAt > formAt ? true : 'the form\'s box at ' + formAt + ', the list\'s box at ' + listAt;
}, test.limit.quick);
test.run('Ask with no provider chosen asks nothing', 0.2, async function () {
  if (!X.askBtn || !X.drop) return NO_ASK;
  X.askBtn.click(); await settle();
  return !X.made.calls.some(function (c) { return c.args && c.args.op === 'ask'; }) ? true : 'calls: ' + short(X.made.calls);
}, test.limit.quick);
test.run('Ask calls provider { op: ask, id } through the agent\'s interface, the provider chosen', 0.2, async function () {
  if (!X.askBtn || !X.drop) return NO_ASK;
  const made = X.made;
  X.drop.value = 'KP';
  made.calls.length = 0;
  made.answer = function () { return { models: [{ label: 'claude-alpha' }, { label: 'claude-beta' }], updated: true }; };
  X.askBtn.click(); await settle();
  return made.calls.length === 1 && made.calls[0].table === 'provider' && JSON.stringify(made.calls[0].args) === JSON.stringify({ op: 'ask', id: 'KP' }) ? true : 'calls: ' + short(made.calls);
}, test.limit.quick);
test.run('and spits out no list: the model table it updated is the list below', 0.2, function () {
  if (!X.askBtn || !X.drop) return NO_ASK;
  const after = shown(X.pane);
  return after.indexOf('claude-alpha') === -1 && after.indexOf('claude-beta') === -1 && after.indexOf('model list updated') === -1 ? true : 'shown: ' + short(after);
}, test.limit.quick);
test.run('its Ask is a busyButton, the ask its request (goal/G41.23)', 0.2, function () {
  if (!X.askBtn || !X.drop) return NO_ASK;
  const ab = X.ab = X.made.busy.filter(function (x) { return x.button === X.askBtn; }).pop();
  return !!ab && typeof ab.opts.run === 'function' ? true : 'busyButtons: ' + X.made.busy.length;
}, test.limit.quick);
const W8 = { letGo: null, settled: false };
test.run('the request it hands the button waits while the provider has not answered', 0.2, async function () {
  const ab = X.ab;
  if (!ab) return 'no busyButton on Ask';
  X.made.answer = function () { return new Promise(function (r) { W8.letGo = r; }); };
  const before = ab.answers.length;
  X.askBtn.click(); await settle();
  Promise.resolve(ab.answers[before]).then(function () { W8.settled = true; }, function () { W8.settled = true; });
  await settle();
  return !W8.settled ? true : 'settled before the answer';
}, test.limit.quick);
test.run('and settles once it answers', 0.2, async function () {
  if (!X.ab) return 'no busyButton on Ask';
  if (W8.letGo) W8.letGo({ models: [], updated: false });
  await settle();
  return W8.settled ? true : 'still waiting after the answer';
}, test.limit.quick);
test.run('its refresh and destroy are the shared element\'s', 0.2, function () {
  if (!X.list) return NO_PAGE;
  X.list.refresh(); X.list.destroy();
  return X.made.refreshed && X.made.destroyed ? true : 'refreshed ' + X.made.refreshed + ', destroyed ' + X.made.destroyed;
}, test.limit.quick);
test.run('a row it opens is a modelRow, built on agentRow, in the box it is handed, with its id and added, no api', 0.2, async function () {
  if (!X.o) return NO_PAGE;
  const made = X.made;
  const into = { innerHTML: '' };
  X.o.row(into, 'KM', false);
  await settle();
  const r = X.r = made.rows[0] && made.rows[0].o;
  return made.rows.length === 1 && made.rows[0].c === into && r.table === 'model' && !('api' in r) && r.id === 'KM' && r.added === false ? true : 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added });
}, test.limit.quick);
test.run('its title row has the model table\'s look', 0.2, function () {
  const r = X.r;
  return r && r.look && r.look.icon === '🧠' && r.look.table === 'model' ? true : 'look: ' + short(r && r.look);
}, test.limit.quick);
// goal/G41.21, Andy: "In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for
// that.............": the provider is shown (kind output, the provider table's row by its icon and label), never picked.
test.run('its fields are the label shown only (the model name as the provider gives it), the provider shown and never picked, and the capabilities shown only', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'output', ''], ['providerId', 'output', 'provider'], ['capabilities', 'output', '']])
    ? true : 'fields: ' + short(r && r.fields);
}, test.limit.quick);
test.run('the provider is picked from a search of the provider table', 0.2, function () {
  const r = X.r;
  const provField = r && r.fields.filter(function (f) { return f.field === 'providerId'; })[0];
  return provField && provField.pick === 'provider' ? true : 'providerId: ' + short(provField);
}, test.limit.quick);

// ── elementRow.js loads the agent family's cache manager, which takes the model table's rows from the stream (goal/G41.16, G41.28) ──
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
// means for this table, spirit/app/agent/table/data.js until G41.16, is the agent family's data.js's
// (spirit/app/agent/data.js, goal/G41.28), loaded with the row element; it files the rows under the
// node that served them, and is read through spirit.data.agent.data.
const NO_MANAGER = 'no agent family\'s cache manager on the page';
const job = function (agent, module) { return { id: 'job-agent', module: module || 'spirit.app.agent', data: {}, app: { agent: agent } }; };
test.run('its page files require no data script', 0.2, function () {
  if (!X.made) return NO_PAGE;
  return !X.made.required.some(function (p) { return (/data\.js$/).test(p); }) ? true : 'required: ' + short(X.made.required);
}, test.limit.quick);
test.run('the agent family\'s cache manager is loaded: spirit.data.agent.data.branch(\'model\') is the home node\'s <node>/agent/model', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const DATA = global.window.spirit.data;
  const AD = X.AD = ((global.window.spirit.data || {}).agent || {}).data;
  X.BRANCH = DATA.nodeId(HOME_KEY) + '/agent/model';
  return !!AD && typeof AD.branch === 'function' && AD.branch('model') === X.BRANCH ? true : 'agentReads: ' + short(AD ? AD.branch('model') : AD);
}, test.limit.quick);
test.run('a model row on the stream lands at <node>/agent/model/<id>, and the branch\'s watcher hears it', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD, BRANCH = X.BRANCH;
  const heard = [];
  const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
  DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'First', extra: 1 } }));
  off();
  return AD.row('model', 'KT') && AD.row('model', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1 ? true : 'model: ' + short(DATA.branchAt(BRANCH));
}, test.limit.quick);
test.run('a changed row is merged: what it names changes, what it does not stays', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'Renamed' } }));
  return AD.row('model', 'KT') && AD.row('model', 'KT').label === 'Renamed' && AD.row('model', 'KT').extra === 1 ? true : 'row: ' + short(AD.row('model', 'KT'));
}, test.limit.quick);
test.run('a row removed, by its id, is gone', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'model', id: 'KT', removed: true }));
  return !AD.row('model', 'KT') && !('KT' in DATA.branchAt(X.BRANCH)) ? true : 'row: ' + short(AD.row('model', 'KT'));
}, test.limit.quick);
test.run('another table\'s rows, another module\'s, and a row with no id write nothing here', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data;
  const before = JSON.stringify(DATA.branchAt(X.BRANCH));
  DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
  DATA.takeJob(job({ table: 'model', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
  DATA.takeJob(job({ table: 'model', row: { label: 'no id' } }));
  return JSON.stringify(DATA.branchAt(X.BRANCH)) === before ? true : 'model: ' + short(DATA.branchAt(X.BRANCH));
}, test.limit.quick);
