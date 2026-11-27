'use strict';

// spirit/run/spirit/app/agent/table/model/test/server.js
// The tests of spirit/app/agent/table/model/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4, goal/G41.18, goal/G41.26). What the tables share is tested in ../../test/. The Update
// model list pane is gone (goal/G41.26): its Ask form sits at the top of the model list, tested here. The server is made on a scratch agent.db as agent/server/server.js
// makes it, beside the provider table it names; the page files run in node on a window of their own, the shared
// elements stubs that keep what they were handed.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
// IT EXPOSES AN OBJECT, NEVER A BARE FUNCTION (goal/G49.16, Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING
// OBJECT. PERIOD!"; box v4: "spirit/app/agent/table/model/server.js { table }"): asked in a process of its own, spirit.requireScript answers an
// object holding table, each a function.
test.run('spirit/app/agent/table/model/server.js exposes an object holding table, never a bare function', 0.2, function () {
  const P = require('path');
  let run = __dirname;
  while (run !== P.dirname(run) && !require('fs').existsSync(P.join(run, 'spirit', 'script.js'))) run = P.dirname(run);
  const r = require('child_process').spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); let m = null; try { m = spirit.requireScript('spirit/app/agent/table/model/server.js'); } catch (e) { m = null; } process.stdout.write(JSON.stringify({ t: typeof m, k: ['table'].map(function (k) { return m ? typeof m[k] : ''; }) }));"], { cwd: run, encoding: 'utf8', timeout: 20000 });
  let o = null; try { o = JSON.parse(r.stdout); } catch (e) { o = null; }
  return (!!o && o.t === 'object' && o.k.length === 1 && o.k.every(function (k) { return k === 'function'; })) || false;
}, test.limit.quick);
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/agent/table/model/test/server/' + name + tempAsked); }
const { DatabaseSync } = require('node:sqlite');

// One test.run per test (goal/G47.2).
const DIR = path.join(__dirname, '..');
// Its list and editor are the agent app's elements, in spirit/app/agent/element/table/model/ since goal/G43.32 (rule 5).
const EL = path.join(__dirname, '..', '..', '..', 'element', 'table', 'model');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.required.spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal, why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const AGENT = 'spirit/app/agent/api.js';
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
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its files ──
test.run('it has server.js, and elementTable.js and elementRow.js in the app\'s element folder', 0.2, function () {
  const files = [path.join(DIR, 'server.js'), path.join(EL, 'elementTable.js'), path.join(EL, 'elementRow.js')];
  return files.every(function (f) { return fs.existsSync(f); }) ? true : false;
}, test.limit.quick);

// ── server.js: the table in agent.db ──
test.run('server.js, handed a context, answers the model table with its verb and its has function', 0.2, function () {
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return false;
  X.scratch = ownTemp('spirit-model');
  const db = X.db = new DatabaseSync(path.join(X.scratch, 'agent.db'));
  const ctx = X.ctx = { db: db, dbFile: path.join(X.scratch, 'agent.db'), tables: {}, publish: function (x) { X.published.push(x); } };
  ctx.tables.provider = SPIRIT.requireScript('spirit/app/agent/table/provider/server.js').table(ctx);
  const t = X.t = ctx.tables.model = SPIRIT.requireScript('spirit/app/agent/table/model/server.js').table(ctx);
  X.cols = db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' ? true : false;
}, test.limit.quick);
// Andy, box v22: "with Label and Description, provider-key, and model-name and capabilities"; then, goal/G41.21: "i decided that model, does NOT need a name field, which i also NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the models UI."
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.cols.indexOf(c) !== -1 ? true : false; };
test.run('the model table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the model table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the model table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the model table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the model table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the model table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the model table has a providerId column', 0.2, function () { return has('providerId'); }, test.limit.quick);
test.run('the model table has a capabilities column', 0.2, function () { return has('capabilities'); }, test.limit.quick);
test.run('the model table has no other column, and no model name column, as the label holds the model name', 0.2, function () {
  return X.cols.length === 8 ? true : false;
}, test.limit.quick);

// ── server.js: a model names a provider that is there ──
test.run('a model is added with its provider\'s id, its label the model name as the provider gives it', 0.2, function () {
  if (!X.t) return false;
  X.provider = call(X.ctx.tables.provider.verb, { op: 'add', icon: '🏢', label: 'Anthropic', url: 'https://api.anthropic.example' });
  X.added = call(X.t.verb, { op: 'add', label: 'claude-opus-5-5', providerId: X.provider.id, capabilities: JSON.stringify(['text', 'tools']) });
  X.got = X.added.id ? call(X.t.verb, { op: 'get', id: X.added.id }) : null;
  const got = X.got;
  return got && got.providerId === X.provider.id && got.label === 'claude-opus-5-5' ? true : false;
}, test.limit.quick);
test.run('an added model\'s capabilities are a list', 0.2, function () {
  const got = X.got;
  return got && JSON.stringify(got.capabilities) === '["text","tools"]' ? true : false;
}, test.limit.quick);
test.run('a model naming a provider that is not there is refused, saying so', 0.2, function () {
  if (!X.t) return false;
  X.gone = SPIRIT.requireScript('spirit/relayAuth/script.js').generateIdentity('').publicKey;
  const noProvider = call(X.t.verb, { op: 'add', label: 'Lost', providerId: X.gone });
  return noProvider.refusal === 'bad-request' && /no provider/.test(noProvider.why) ? true : false;
}, test.limit.quick);
test.run('a set naming a provider that is not there is refused too, and the model keeps its provider', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  return call(X.t.verb, { op: 'set', id: X.added.id, providerId: X.gone }).refusal === 'bad-request' && call(X.t.verb, { op: 'get', id: X.added.id }).providerId === X.provider.id ? true : false;
}, test.limit.quick);

// ── server.js: a model is shown with its provider's icon (goal/G41.18) ──
// Andy, box v17: "the model will [icon] \"model-name\", where the [icon] will be the provider-icon, associated with the
// provider-key on the model row". The server says it with the row (rowTable's shows), so the
// list draws only what the server sends (rule/19).
test.run('a model\'s get carries providerIcon, the icon of its provider row', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  call(X.ctx.tables.provider.verb, { op: 'set', id: X.provider.id, icon: '🅰' });
  const shownGet = call(X.t.verb, { op: 'get', id: X.added.id });
  return shownGet && shownGet.providerIcon === '🅰' ? true : false;
}, test.limit.quick);
test.run('each row a search finds carries its provider\'s icon too', 0.2, function () {
  if (!X.t) return false;
  try { X.found = JSON.parse((call(X.t.verb, { op: 'search', text: 'opus' }).items || [])[0].label); } catch (e) { X.found = null; }
  return X.found && X.found.providerIcon === '🅰' ? true : false;
}, test.limit.quick);
// goal/G41.18, Andy: "only the ID and the fields shown in a table, that's all it needs": the model list shows the
// provider's icon and the model name.
test.run('a search answers the id and what the model list shows, the label (the model name) and the provider\'s icon, nothing else', 0.2, function () {
  const found = X.found;
  return found && JSON.stringify(Object.keys(found).sort()) === '["id","label","providerIcon"]' ? true : false;
}, test.limit.quick);
test.run('each model row the server publishes carries its provider\'s icon', 0.2, function () {
  if (!X.provider) return false;
  X.published.length = 0;
  call(X.t.verb, { op: 'add', label: 'claude-sonnet-5-5', providerId: X.provider.id });
  const pub = X.published.filter(function (x) { return x.agent && x.agent.table === 'model' && x.agent.row; })[0];
  return pub && pub.agent.row.providerIcon === '🅰' ? true : false;
}, test.limit.quick);
test.run('a model with no provider has an empty providerIcon', 0.2, function () {
  if (!X.t) return false;
  const bare = call(X.t.verb, { op: 'add', label: 'Bare' });
  return bare.id && call(X.t.verb, { op: 'get', id: bare.id }).providerIcon === '' ? true : false;
}, test.limit.quick);
test.run('the provider\'s icon is shown, not kept: the model table has no providerIcon column', 0.2, function () {
  if (!X.db) return false;
  const cols2 = X.db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  return cols2.indexOf('providerIcon') === -1 ? true : false;
}, test.limit.quick);

// ── the page: elementTable.js and elementRow.js ──
const opened = [];
const detail = { open: function (make) { opened.push(make); }, look: function (t2) { return { icon: '🧠', name: 'Model', title: 'Models', table: t2 }; } };
test.run('elementTable.js and elementRow.js place the agent app\'s model list and model row elements on spirit.required', 0.2, function () {
  const made = X.made = { tables: [], rows: [], required: [], searches: [], busy: [], calls: [], answer: null, forms: [] };
  made.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    return function (args) { made.calls.push({ table: table, args: args }); const a = made.answer ? made.answer(table, args) : {}; return a instanceof Error ? Promise.reject(a) : Promise.resolve(a); };
  } });
  const STAND = nestSearch({
    // The providerSelector:dropdown and the busyButton, each tested in its own folder: stand-ins that keep what they were
    // handed, as the Update model list pane's test had them.
    'search': { create: function (host, o) { const s2 = { host: host, o: o, value: '', row: null, refresh: function () {}, destroy: function () { s2.destroyed = true; } }; made.searches.push(s2); return s2; } },
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given.
    rowForm: { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: part('<div>', ''), span: part('<span>', ''), button: part('<button>', '') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
      // As the real one: a click calls its press, and what the press answers is what its busy button waits on.
      f.answers = [];
      f.button.addEventListener('click', function () { if (typeof f.opts.press === 'function') f.answers.push(f.opts.press()); });
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      made.forms.push(f); return f;
    } },
    busyButton: { attach: function (button, opts) { const a = { button: button, opts: opts || {}, answers: [] }; made.busy.push(a); button.addEventListener('click', function () { if (typeof a.opts.run === 'function') a.answers.push(a.opts.run()); }); return button; } },
    // The agent tables' shared search (../../tableElement.js, agentDetail.search), the providerSelector it makes: a
    // stand-in that hands the search element what the real one does (rule/29): its data the table's branch, as the agent
    // branch's data.js names it (spirit.required.spirit.data['spirit.app.agent'].data.branch, goal/G41.28, G49.19).
    agentDetail: { search: function (host, o2, more) { const E2 = global.window.spirit.required.spirit.element; const AD2 = ((global.window.spirit.required.spirit.data || {})['spirit.app.agent'] || {}).data; const s3 = E2.search.create(host, Object.assign({ server: 'agent', verb: o2.table, data: AD2 ? AD2.branch(o2.table) : '' }, more || {})); s3.refresh(); return s3; } },
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  });
  // goal/G43.32: the stand-ins stand where the page files read them, at spirit.required.<their path>; the shared table
  // element's pieces (once agentDetail) with its create.
  global.window = { spirit: { required: { spirit: {
    element: { search: STAND.search, rowForm: STAND.rowForm, busyButton: STAND.busyButton },
    app: { agent: { element: { table: { tableElement: Object.assign({}, STAND.agentDetail, STAND.agentTable), row: STAND.agentRow } } } } } } } };
  global.spirit = global.window.spirit;
  // The page's one loader: asked for a branch's api.js, it runs that branch's real data.js once, as the real api.js
  // requires its companion data.js; the data set (spirit/client/script.js) is run below.
  const ANSWERS = { 'spirit/element/search/script.js': STAND.search, 'spirit/element/rowForm/script.js': STAND.rowForm, 'spirit/element/busyButton/script.js': STAND.busyButton,
    'spirit/app/agent/element/table/tableElement.js': Object.assign({}, STAND.agentDetail, STAND.agentTable), 'spirit/app/agent/element/table/row.js': STAND.agentRow };
  const ran = {};
  global.window.spirit.requireScript = function (p) {
    made.required.push(String(p));
    const m = /^spirit\/(.+)\/api\.js$/.exec(String(p));
    const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
    if (companion && !ran[companion] && fs.existsSync(path.join(RUN, companion))) { ran[companion] = true; PAGE_LOAD.runAsPage(path.join(RUN, companion)); }
    // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
    // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
    // function... or fail/throw"): the agent branch's api.js, the search, rowForm and busyButton, the shared table and row
    // elements, the page files' own answers once they ran, an object for anything else. The stand-ins also stay at their
    // places above, since the shared table stand-in's search reads the search element there.
    if (p === AGENT) return Promise.resolve(made.family);
    return Promise.resolve(Object.prototype.hasOwnProperty.call(ANSWERS, p) ? ANSWERS[p] : {});
  };
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so each file is placed at its path as it runs.
  SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  // The page's one data set (spirit/client/script.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.nodeFacts.key. A branch's
  // data.js is loaded by its api.js, through the stand-in above.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'script.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.nodeFacts = { key: HOME_KEY };
  global.window.spirit.required.spirit.data.homeNode(HOME_KEY);
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { ANSWERS[path.relative(RUN, path.join(EL, f)).split(path.sep).join('/')] = PAGE_LOAD.runAsPage(path.join(EL, f)); });
  const T = global.window.spirit.required.spirit.app.agent.element.table.model || {};
  X.E = { modelTable: T.elementTable, modelRow: T.elementRow };
  return X.E.modelTable && typeof X.E.modelTable.create === 'function' && X.E.modelRow && typeof X.E.modelRow.create === 'function' ? true : false;
}, test.limit.quick);
test.run('elementTable.js requires the shared element and its own row element', 0.2, async function () {
  if (!X.E.modelTable || !X.E.modelRow) return false;
  X.pane = box('models');
  X.list = X.E.modelTable.create(X.pane, detail);
  await settle();
  const made = X.made;
  return made.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/element/table/model/elementRow.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('the model list builds on agentTable, in its box, for the model table, with the detail pane, no api and no Add button', 0.2, function () {
  if (!X.list) return false;
  const made = X.made;
  const o = X.o = made.tables[0] && made.tables[0].o;
  return made.tables.length === 1 && !!made.tables[0].c && o.table === 'model' && !('api' in o) && o.detail === detail && o.add === false ? true : false;
}, test.limit.quick);
// goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon.
test.run('the model list shows each model by its provider\'s icon and its label, the model name', 0.2, function () {
  const o = X.o;
  const shownBy = ((o && o.columns) || []).map(function (c) { return c.from || c.field; });
  return JSON.stringify(shownBy) === '["providerIcon","label"]' ? true : false;
}, test.limit.quick);

// ── the Ask form at the top of 🧠 Models, the Update model list pane gone (goal/G41.26) ──
// Andy, box: "the middle pane (🧠 Update model list): The form \"from [Pick a provider ▾] [Ask]\" moves to the top of
// the left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask]
// button will no longer spit out a list, and simply update the agent.model table".
test.run('the list is handed no provider models button', 0.2, function () {
  if (!X.o) return false;
  const o = X.o;
  return !((o && o.buttons) || []).some(function (b2) { return b2 && b2.label === 'provider models'; }) ? true : false;
}, test.limit.quick);
test.run('the Update model list pane is gone: model/updatePanel.js and its test no longer exist', 0.2, function () {
  return !fs.existsSync(path.join(DIR, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.md'))
    ? true : false;
}, test.limit.quick);
test.run('nothing loads the Update model list pane', 0.2, function () {
  if (!X.made) return false;
  return X.made.required.indexOf('spirit/app/agent/table/model/updatePanel.js') === -1 && !X.E.modelUpdate ? true : false;
}, test.limit.quick);
test.run('the model list loads what its Ask form uses itself: the search element and the rowForm', 0.2, function () {
  if (!X.made) return false;
  const made = X.made;
  return made.required.indexOf('spirit/element/search/script.js') !== -1 && made.required.indexOf('spirit/element/rowForm/script.js') !== -1 ? true : false;
}, test.limit.quick);
// goal/G41.27, Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]": the form is a rowForm, ❓, the
// providerSelector:dropdown in its span, Ask its button; the word from at its start goes, as new and grant did.
test.run('the Ask form is one rowForm, its icon ❓ and its button Ask', 0.2, function () {
  if (!X.made) return false;
  const made = X.made;
  const rf = X.rf = made.forms[0];
  X.drop = made.searches.filter(function (x) { return x.o && x.o.verb === 'provider'; })[0];
  X.askBtn = rf ? rf.button : the(X.pane, 'ask');
  return made.forms.length === 1 && rf.opts.icon === '❓' && rf.opts.button === 'Ask' ? true : false;
}, test.limit.quick);
test.run('the Ask form\'s span holds the providerSelector:dropdown, showing Pick a provider, and nothing else', 0.2, function () {
  if (!X.made) return false;
  const rf = X.rf, drop = X.drop;
  const inSpan = !!rf && !!drop && (drop.host === rf.span || rf.span.children.indexOf(drop.host) !== -1) && rf.span.children.length <= 1;
  return !!drop && drop.o.face === 'dropdown' && drop.o.server === 'agent' && drop.o.data === global.window.spirit.required.spirit.data.nodeId(HOME_KEY) + '/spirit.app.agent/provider' && drop.o.placeholder === 'Pick a provider' && inSpan
    ? true : false;
}, test.limit.quick);
test.run('the word from is gone, and it draws no Ask button of its own', 0.2, function () {
  if (!X.pane) return false;
  return !/>\s*from\s*</.test(X.pane.innerHTML) && !/<button\b[^>]*>\s*Ask\s*</.test(X.pane.innerHTML) ? true : false;
}, test.limit.quick);
// At the top: the list is drawn into a part of the pane below the form, never over it.
test.run('the form is at the top of the pane, the model list below it', 0.2, function () {
  if (!X.made) return false;
  const made = X.made, rf = X.rf, pane = X.pane;
  const listAt = made.tables[0] && made.tables[0].c && made.tables[0].c.id ? pane.innerHTML.indexOf('id="' + made.tables[0].c.id + '"') : -1;
  const formAt = rf && rf.container && rf.container.id ? pane.innerHTML.indexOf('id="' + rf.container.id + '"') : -1;
  return formAt !== -1 && listAt > formAt ? true : false;
}, test.limit.quick);
test.run('Ask with no provider chosen asks nothing', 0.2, async function () {
  if (!X.askBtn || !X.drop) return false;
  X.askBtn.click(); await settle();
  return !X.made.calls.some(function (c) { return c.args && c.args.op === 'ask'; }) ? true : false;
}, test.limit.quick);
test.run('Ask asks the provider table for the chosen provider\'s models through the agent\'s interface, by its id', 0.2, async function () {
  if (!X.askBtn || !X.drop) return false;
  const made = X.made;
  X.drop.value = 'KP';
  made.calls.length = 0;
  made.answer = function () { return { models: [{ label: 'claude-alpha' }, { label: 'claude-beta' }], updated: true }; };
  X.askBtn.click(); await settle();
  return made.calls.length === 1 && made.calls[0].table === 'provider' && JSON.stringify(made.calls[0].args) === JSON.stringify({ op: 'ask', id: 'KP' }) ? true : false;
}, test.limit.quick);
test.run('Ask spits out no list: the model table it updated is the list below', 0.2, function () {
  if (!X.askBtn || !X.drop) return false;
  const after = shown(X.pane);
  return after.indexOf('claude-alpha') === -1 && after.indexOf('claude-beta') === -1 && after.indexOf('model list updated') === -1 ? true : false;
}, test.limit.quick);
// ASK IS THE ROWFORM'S PRESS (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer comes"):
// the rowForm's button is a busy button already, so no second one is attached to it.
test.run('the ask is the rowForm\'s press, and no busyButton of its own is attached to Ask', 0.2, function () {
  if (!X.askBtn || !X.drop) return false;
  const ab = X.ab = X.rf;
  return !!ab && typeof ab.opts.press === 'function' && !X.made.busy.some(function (x) { return x.button === X.askBtn; }) ? true : false;
}, test.limit.quick);
const W8 = { letGo: null, settled: false };
test.run('the request it hands the rowForm waits while the provider has not answered', 0.2, async function () {
  const ab = X.ab;
  if (!ab) return false;
  X.made.answer = function () { return new Promise(function (r) { W8.letGo = r; }); };
  const before = ab.answers.length;
  X.askBtn.click(); await settle();
  Promise.resolve(ab.answers[before]).then(function () { W8.settled = true; }, function () { W8.settled = true; });
  await settle();
  return !W8.settled ? true : false;
}, test.limit.quick);
test.run('the request the rowForm is handed settles once the provider answers', 0.2, async function () {
  if (!X.ab) return false;
  if (W8.letGo) W8.letGo({ models: [], updated: false });
  await settle();
  return W8.settled ? true : false;
}, test.limit.quick);
test.run('the model list\'s refresh and destroy are the shared element\'s', 0.2, function () {
  if (!X.list) return false;
  X.list.refresh(); X.list.destroy();
  return X.made.refreshed && X.made.destroyed ? true : false;
}, test.limit.quick);
test.run('a row it opens is a modelRow, built on agentRow, in the box it is handed, with its id and added, no api', 0.2, async function () {
  if (!X.o) return false;
  const made = X.made;
  const into = { innerHTML: '' };
  X.o.row(into, 'KM', false);
  await settle();
  const r = X.r = made.rows[0] && made.rows[0].o;
  return made.rows.length === 1 && made.rows[0].c === into && r.table === 'model' && !('api' in r) && r.id === 'KM' && r.added === false ? true : false;
}, test.limit.quick);
test.run('its title row has the model table\'s look', 0.2, function () {
  const r = X.r;
  return r && r.look && r.look.icon === '🧠' && r.look.table === 'model' ? true : false;
}, test.limit.quick);
// goal/G41.21, Andy: "In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for
// that.............": the provider is shown (kind output, the provider table's row by its icon and label), never picked.
test.run('the model editor\'s fields are all shown, never picked: its label, its provider and its capabilities', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'output', ''], ['providerId', 'output', 'provider'], ['capabilities', 'output', '']])
    ? true : false;
}, test.limit.quick);
test.run('the provider is picked from a search of the provider table', 0.2, function () {
  const r = X.r;
  const provField = r && r.fields.filter(function (f) { return f.field === 'providerId'; })[0];
  return provField && provField.pick === 'provider' ? true : false;
}, test.limit.quick);

// ── elementRow.js requires the agent branch's api.js, whose data.js takes the model table's rows from the stream (goal/G41.16, G41.28) ──
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
// means for this table, spirit/app/agent/table/data.js until G41.16, is the agent family's data.js's
// (spirit/app/agent/data.js, goal/G41.28), which only its api.js requires (goal/G47.1); it files the rows under the
// node that served them, and is read through spirit.required.spirit.data['spirit.app.agent'].data, the family named by the app's id (goal/G49.19).
const job = function (agent, module) { return { id: 'job-agent', module: module || 'spirit.app.agent', data: {}, app: { agent: agent } }; };
test.run('its page files require no data script', 0.2, function () {
  if (!X.made) return false;
  return !X.made.required.some(function (p) { return (/data\.js$/).test(p); }) ? true : false;
}, test.limit.quick);
test.run('the page files require spirit/app/agent/api.js, and its model branch is the home node\'s spirit.app.agent/model branch', 0.2, function () {
  if (!X.made || X.made.required.indexOf('spirit/app/agent/api.js') === -1) return false;
  const DATA = global.window.spirit.required.spirit.data;
  const AD = X.AD = ((global.window.spirit.required.spirit.data || {})['spirit.app.agent'] || {}).data;
  X.BRANCH = DATA.nodeId(HOME_KEY) + '/spirit.app.agent/model';
  return !!AD && typeof AD.branch === 'function' && AD.branch('model') === X.BRANCH ? true : false;
}, test.limit.quick);
test.run('a model row on the stream lands at <node>/spirit.app.agent/model/<id>, and the branch\'s watcher hears it', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD, BRANCH = X.BRANCH;
  const heard = [];
  const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
  DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'First', extra: 1 } }));
  off();
  return AD.row('model', 'KT') && AD.row('model', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1 ? true : false;
}, test.limit.quick);
test.run('a changed row is merged: what it names changes, what it does not stays', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'Renamed' } }));
  return AD.row('model', 'KT') && AD.row('model', 'KT').label === 'Renamed' && AD.row('model', 'KT').extra === 1 ? true : false;
}, test.limit.quick);
test.run('a row removed, by its id, is gone', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'model', id: 'KT', removed: true }));
  return !AD.row('model', 'KT') && !('KT' in DATA.branchAt(X.BRANCH)) ? true : false;
}, test.limit.quick);
test.run('another table\'s rows, another module\'s, and a row with no id write nothing here', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data;
  const before = JSON.stringify(DATA.branchAt(X.BRANCH));
  DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
  DATA.takeJob(job({ table: 'model', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
  DATA.takeJob(job({ table: 'model', row: { label: 'no id' } }));
  return JSON.stringify(DATA.branchAt(X.BRANCH)) === before ? true : false;
}, test.limit.quick);
// ITS FOLDER GOES LAST, ITS DATABASE CLOSED FIRST (Andy, of the 0.7s: 'it leaves no temp folder behind' on his Windows node):
// on Windows a folder holding an open database cannot be removed, so the database is closed, then the folder removed.
test.after(function () {
  try { if (X.db) X.db.close(); } catch (e) { /* closed */ }
  try { require('fs').rmSync(tempFolder.path('spirit/app/agent/table/model/test/server'), { recursive: true, force: true }); } catch (e) { /* a door still closing */ }
});
