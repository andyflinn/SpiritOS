'use strict';

// spirit/run/spirit/app/agent/table/persona/test/server.js
// The tests of spirit/app/agent/table/persona/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
// agent.db as nodeAgent.js makes it; the page files run in node on a window of their own, the shared elements stubs that
// keep what they were handed. One test.run per test (goal/G47.2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const DIR = path.join(__dirname, '..');
// Its list and editor are the agent app's elements, in spirit/app/agent/element/table/persona/ since goal/G43.32 (rule 5).
const EL = path.join(__dirname, '..', '..', '..', 'element', 'table', 'persona');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// What the tests make, for the tests after them.
const X = { scratch: '', db: null, t: null, dropped: [], cols: [], added: null, made: null, E: {}, list: null, o: null, r: null, AD: null, BRANCH: '' };
const NO_TABLE = 'no persona table: server.js was not made';
const NO_ROW = 'no persona added: the add was refused';
const NO_PAGE = 'no page files: they were not placed';
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its files ──
test.run('it has server.js, and elementTable.js and elementRow.js in the app\'s element folder', 0.2, function () {
  const files = [path.join(DIR, 'server.js'), path.join(EL, 'elementTable.js'), path.join(EL, 'elementRow.js')];
  return files.every(function (f) { return fs.existsSync(f); }) ? true : 'missing: ' + short(files.filter(function (f) { return !fs.existsSync(f); }));
}, test.limit.quick);

// ── server.js: the table in agent.db ──
test.run('server.js(ctx) answers the table, its verb and has', 0.2, function () {
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return 'no server.js';
  X.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-persona-'));
  const db = X.db = new DatabaseSync(path.join(X.scratch, 'agent.db'));
  const ctx = { db: db, dbFile: path.join(X.scratch, 'agent.db'), tables: {}, publish: function () {} };
  ctx.tables.grant = { dropJob: function (id) { X.dropped.push(id); } };
  const t = X.t = ctx.tables.persona = require(path.join(DIR, 'server.js'))(ctx);
  X.cols = db.prepare('PRAGMA table_info("persona")').all().map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' ? true : 'answered: ' + short(t && Object.keys(t));
}, test.limit.quick);
// Andy, box v22: "with Label and Description, and a codeMirror-field for the persona-description i give it with every prompt".
// goal/G41.21, Andy: "and where the fuck is my bundle field in persona-table and the fucking picker for a bundle with the
// persona?"
// goal/G41.26, Andy, box: "agent.persona gains a provider field, it's detail provides the same provider-FUCKING-Selector
// in drop down mode, that the job detail panel provides for the agent.job.provider".
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.cols.indexOf(c) !== -1 ? true : 'columns: ' + short(X.cols); };
test.run('the persona table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the persona table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the persona table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the persona table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the persona table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the persona table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the persona table has a persona column', 0.2, function () { return has('persona'); }, test.limit.quick);
test.run('the persona table has a bundle column', 0.2, function () { return has('bundle'); }, test.limit.quick);
test.run('the persona table has a provider column', 0.2, function () { return has('provider'); }, test.limit.quick);
test.run('and nothing else', 0.2, function () { return X.cols.length === 9 ? true : 'columns: ' + short(X.cols); }, test.limit.quick);
const B = { pid: '' };
test.run('a persona keeps its bundle, its text as it was', 0.2, function () {
  if (!X.t) return NO_TABLE;
  B.pid = call(X.t.verb, { op: 'add', icon: '🎭', label: 'With a bundle', persona: 'p' }).id;
  call(X.t.verb, { op: 'set', id: B.pid, bundle: '7' });
  const got = call(X.t.verb, { op: 'get', id: B.pid });
  return got && String(got.bundle) === '7' && got.persona === 'p' ? true : 'get: ' + short(got);
}, test.limit.quick);
test.run('a persona keeps its provider, its bundle and text as they were (goal/G41.26)', 0.2, function () {
  if (!B.pid) return NO_ROW;
  // A provider's id is a public key, as every row's is; the persona keeps it as the job keeps its own.
  const P = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  call(X.t.verb, { op: 'set', id: B.pid, provider: P });
  const withP = call(X.t.verb, { op: 'get', id: B.pid });
  call(X.t.verb, { op: 'delete', id: B.pid });
  return withP && withP.provider === P && String(withP.bundle) === '7' && withP.persona === 'p' ? true : 'get: ' + short(withP);
}, test.limit.quick);

// ── server.js: a persona is its text ──
const TEXT = 'You are careful.\nYou answer short.';
test.run('a persona is added with its text, kept as typed, lines and all', 0.2, function () {
  if (!X.t) return NO_TABLE;
  X.added = call(X.t.verb, { op: 'add', icon: '🎭', label: 'Careful', persona: TEXT });
  const got = X.added.id ? call(X.t.verb, { op: 'get', id: X.added.id }) : null;
  return got && got.persona === TEXT && got.label === 'Careful' ? true : 'get: ' + short(got);
}, test.limit.quick);
test.run('a set of its label keeps its text', 0.2, function () {
  if (!X.added || !X.added.id) return NO_ROW;
  call(X.t.verb, { op: 'set', id: X.added.id, label: 'Renamed' });
  return call(X.t.verb, { op: 'get', id: X.added.id }).persona === TEXT ? true : 'get: ' + short(call(X.t.verb, { op: 'get', id: X.added.id }));
}, test.limit.quick);
test.run('a persona deleted takes no grants: grants are a job\'s', 0.2, function () {
  if (!X.added || !X.added.id) return NO_ROW;
  const dropped = X.dropped;
  return dropped.length === 0 && (call(X.t.verb, { op: 'delete', id: X.added.id }).id === X.added.id) && dropped.length === 0 ? true : 'dropped: ' + short(dropped);
}, test.limit.quick);

// ── server.js: no invalid persona row (goal/G41.21) ──
// Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"; "# mandatory fields (server AND ui) - persona: icon, label".
const V = { before: 0, noIcon: null, noLabel: null, whole: null };
const rowsNow = function () { return X.db.prepare('SELECT COUNT(*) AS n FROM "persona"').get().n; };
test.run('an add without its icon or its label, or with a label of blanks, is refused, and makes no row', 0.2, function () {
  if (!X.t) return NO_TABLE;
  V.before = rowsNow();
  V.noIcon = call(X.t.verb, { op: 'add', label: 'No icon' });
  V.noLabel = call(X.t.verb, { op: 'add', icon: '🎭' });
  const blank = call(X.t.verb, { op: 'add', icon: '🎭', label: '  ' });
  return [V.noIcon, V.noLabel, blank].every(function (r) { return r.refusal && !r.id; }) && rowsNow() === V.before ? true : 'answers: ' + short([V.noIcon, V.noLabel, blank]);
}, test.limit.quick);
test.run('each refusal names the field missing', 0.2, function () {
  if (!V.noIcon) return NO_TABLE;
  return (/icon/i).test(String(V.noIcon.why)) && /label/i.test(String(V.noLabel.why)) ? true : 'why: ' + short([V.noIcon.why, V.noLabel.why]);
}, test.limit.quick);
test.run('with its icon and its label, it is added', 0.2, function () {
  if (!X.t) return NO_TABLE;
  V.whole = call(X.t.verb, { op: 'add', icon: '🎭', label: 'Whole' });
  return V.whole.id && rowsNow() === V.before + 1 ? true : 'answer: ' + short(V.whole);
}, test.limit.quick);
test.run('a change that would empty its label is refused, the row kept', 0.2, function () {
  if (!V.whole || !V.whole.id) return NO_ROW;
  const emptied = call(X.t.verb, { op: 'set', id: V.whole.id, label: '' });
  const verdict = emptied.refusal && call(X.t.verb, { op: 'get', id: V.whole.id }).label === 'Whole' ? true : 'answer: ' + short(emptied);
  call(X.t.verb, { op: 'delete', id: V.whole.id });
  return verdict;
}, test.limit.quick);

// ── server.js: a search answers what the list shows (goal/G41.18) ──
// Andy: "only the ID and the fields shown in a table, that's all it needs"; "that exactly what GET is for, to bring in
// the rest for detail panels etc...". The list shows a row by its icon and its label.
test.run('a search answers the id, the icon and the label of a row, nothing else', 0.2, function () {
  if (!X.t) return NO_TABLE;
  const t = X.t;
  const listedId = call(t.verb, { op: 'add', icon: '🧪', label: 'Listed one' }).id;
  let listedRow = null;
  try { listedRow = (call(t.verb, { op: 'search', text: 'Listed one' }).items || []).map(function (i) { return JSON.parse(i.label); }).filter(function (r) { return r.id === listedId; })[0]; } catch (e) { listedRow = null; }
  call(t.verb, { op: 'delete', id: listedId });
  return listedRow && listedRow.icon === '🧪' && listedRow.label === 'Listed one' && JSON.stringify(Object.keys(listedRow).sort()) === '["icon","id","label"]' ? true : 'found: ' + short(listedRow);
}, test.limit.quick);

// ── the page: elementTable.js and elementRow.js ──
const detail = { open: function () {}, look: function (t2) { return { icon: '🎭', name: 'Persona', title: 'Personas', table: t2 }; } };
const box = { innerHTML: '' };
test.run('they place spirit.element.spirit.app.agent.element.table.persona.elementTable and elementRow', 0.2, function () {
  const made = X.made = { tables: [], rows: [], required: [] };
  global.window = { spirit: { elements: {
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  } } };
  global.spirit = global.window.spirit;
  // goal/G43.32: the shared stand-ins stand where the page files read them, at spirit.element.<their path>.
  const STAND = global.window.spirit.elements; delete global.window.spirit.elements;
  global.window.spirit.element = { spirit: { app: { agent: { element: { table: { tableElement: STAND.agentTable, rowElement: STAND.agentRow } } } } } };
  global.window.spirit.require = function (p) { made.required.push(String(p)); return Promise.resolve(true); };
  // goal/G43.32: the page's spirit.require answers the helper, so each file places itself by installSpiritElement as it
  // runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  // The page's one data set (spirit/data.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.node.key. A family's
  // cache manager is found by spirit.cacheManager(name), the real one, which in node reads it from its own disk.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: HOME_KEY };
  global.window.spirit.data.homeNode(HOME_KEY);
  global.window.spirit.cacheManager = require(path.join(RUN, 'spirit', 'spirit.js')).cacheManager;
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(EL, f), 'utf8'), { filename: path.join(EL, f) }); });
  const T = global.window.spirit.element.spirit.app.agent.element.table.persona || {};
  X.E = { personaTable: T.elementTable, personaRow: T.elementRow };
  return X.E.personaTable && typeof X.E.personaTable.create === 'function' && X.E.personaRow && typeof X.E.personaRow.create === 'function' ? true : 'placed: ' + short(Object.keys(T));
}, test.limit.quick);
test.run('elementTable.js requires the shared element and its own row element', 0.2, async function () {
  if (!X.E.personaTable || !X.E.personaRow) return NO_PAGE;
  X.list = X.E.personaTable.create(box, detail);
  await settle();
  const made = X.made;
  return made.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/element/table/persona/elementRow.js') !== -1 ? true : 'required: ' + short(made.required);
}, test.limit.quick);
test.run('it builds on agentTable, in its box, for the persona table, with the detail pane and no api, and the shared Add', 0.2, function () {
  if (!X.list) return NO_PAGE;
  const made = X.made;
  const o = X.o = made.tables[0] && made.tables[0].o;
  return made.tables.length === 1 && made.tables[0].c === box && o.table === 'persona' && !('api' in o) && o.detail === detail && !o.add ? true : 'agentTable: ' + short(o && { table: o.table, add: !!o.add });
}, test.limit.quick);
test.run('its refresh and destroy are the shared element\'s', 0.2, function () {
  if (!X.list) return NO_PAGE;
  X.list.refresh(); X.list.destroy();
  return X.made.refreshed && X.made.destroyed ? true : 'refreshed ' + X.made.refreshed + ', destroyed ' + X.made.destroyed;
}, test.limit.quick);
test.run('a row it opens is a personaRow, built on agentRow, in the box it is handed, with its id and added, no api', 0.2, async function () {
  if (!X.o) return NO_PAGE;
  const made = X.made;
  const into = { innerHTML: '' };
  X.o.row(into, 'K1', false);
  await settle();
  const r = X.r = made.rows[0] && made.rows[0].o;
  return made.rows.length === 1 && made.rows[0].c === into && r.table === 'persona' && !('api' in r) && r.id === 'K1' && r.added === false ? true : 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added });
}, test.limit.quick);
// goal/G41.21: "# mandatory fields (server AND ui)": the row hands the shared editor its table's mandatory fields.
test.run('it hands the editor the persona table\'s mandatory fields, [icon, label]', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label']) ? true : 'required: ' + short(r && r.required);
}, test.limit.quick);
test.run('its title row has the persona table\'s look', 0.2, function () {
  const r = X.r;
  return r && r.look && r.look.icon === '🎭' && r.look.table === 'persona' ? true : 'look: ' + short(r && r.look);
}, test.limit.quick);
// goal/G41.21: the bundle by the bundle selector in dropdown mode (kind bundle), as the job's.
// goal/G41.26: the provider by the providerSelector in dropdown mode, the same field the job's detail has
// (../../job/elementRow.js: { field: 'provider', kind: 'pick', pick: 'provider' }).
test.run('its fields are the label, the persona in a CodeMirror editor, its bundle by the bundle selector, and its provider by the providerSelector:dropdown, as the job\'s', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'name', ''], ['persona', 'code', ''], ['bundle', 'bundle', ''], ['provider', 'pick', 'provider']])
    ? true : 'fields: ' + short(r && r.fields);
}, test.limit.quick);
test.run('the provider is not mandatory, as the job\'s is not', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label']) ? true : 'required: ' + short(r && r.required);
}, test.limit.quick);

// ── elementRow.js loads the agent family's cache manager, which takes the persona table's rows from the stream (goal/G41.16, G41.28) ──
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
test.run('the agent family\'s cache manager is loaded: spirit.data.agent.data.branch(\'persona\') is the home node\'s <node>/agent/persona', 0.2, function () {
  if (!X.made) return NO_PAGE;
  const DATA = global.window.spirit.data;
  const AD = X.AD = ((global.window.spirit.data || {}).agent || {}).data;
  X.BRANCH = DATA.nodeId(HOME_KEY) + '/agent/persona';
  return !!AD && typeof AD.branch === 'function' && AD.branch('persona') === X.BRANCH ? true : 'agentReads: ' + short(AD ? AD.branch('persona') : AD);
}, test.limit.quick);
test.run('a persona row on the stream lands at <node>/agent/persona/<id>, and the branch\'s watcher hears it', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD, BRANCH = X.BRANCH;
  const heard = [];
  const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
  DATA.takeJob(job({ table: 'persona', row: { id: 'KT', label: 'First', extra: 1 } }));
  off();
  return AD.row('persona', 'KT') && AD.row('persona', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1 ? true : 'persona: ' + short(DATA.branchAt(BRANCH));
}, test.limit.quick);
test.run('a changed row is merged: what it names changes, what it does not stays', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'persona', row: { id: 'KT', label: 'Renamed' } }));
  return AD.row('persona', 'KT') && AD.row('persona', 'KT').label === 'Renamed' && AD.row('persona', 'KT').extra === 1 ? true : 'row: ' + short(AD.row('persona', 'KT'));
}, test.limit.quick);
test.run('a row removed, by its id, is gone', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'persona', id: 'KT', removed: true }));
  return !AD.row('persona', 'KT') && !('KT' in DATA.branchAt(X.BRANCH)) ? true : 'row: ' + short(AD.row('persona', 'KT'));
}, test.limit.quick);
test.run('another table\'s rows, another module\'s, and a row with no id write nothing here', 0.2, function () {
  if (!X.AD) return NO_MANAGER;
  const DATA = global.window.spirit.data;
  const before = JSON.stringify(DATA.branchAt(X.BRANCH));
  DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
  DATA.takeJob(job({ table: 'persona', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
  DATA.takeJob(job({ table: 'persona', row: { label: 'no id' } }));
  return JSON.stringify(DATA.branchAt(X.BRANCH)) === before ? true : 'persona: ' + short(DATA.branchAt(X.BRANCH));
}, test.limit.quick);
