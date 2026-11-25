'use strict';

// spirit/run/spirit/app/agent/table/persona/test/server.js
// The tests of spirit/app/agent/table/persona/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
// agent.db as agent/server/server.js makes it; the page files run in node on a window of their own, the shared elements stubs that
// keep what they were handed. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = S.requireScript('spirit/tempFolder/script.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/agent/table/persona/test/server/' + name + tempAsked); }
const { DatabaseSync } = require('node:sqlite');

const DIR = path.join(__dirname, '..');
// Its list and editor are the agent app's elements, in spirit/app/agent/element/table/persona/ since goal/G43.32 (rule 5).
const EL = path.join(__dirname, '..', '..', '..', 'element', 'table', 'persona');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.required.spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || true, why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// What the tests make, for the tests after them.
const X = { scratch: '', db: null, t: null, dropped: [], cols: [], added: null, made: null, E: {}, list: null, o: null, r: null, AD: null, BRANCH: '' };
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its files ──
test.run('it has server.js, and elementTable.js and elementRow.js in the app\'s element folder', 0.2, function () {
  const files = [path.join(DIR, 'server.js'), path.join(EL, 'elementTable.js'), path.join(EL, 'elementRow.js')];
  return files.every(function (f) { return fs.existsSync(f); }) ? true : false;
}, test.limit.quick);

// ── server.js: the table in agent.db ──
test.run('server.js, given its context, answers the table with its verb and its has function', 0.2, function () {
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return false;
  X.scratch = ownTemp('spirit-persona');
  const db = X.db = new DatabaseSync(path.join(X.scratch, 'agent.db'));
  const ctx = { db: db, dbFile: path.join(X.scratch, 'agent.db'), tables: {}, publish: function () {} };
  ctx.tables.grant = { dropJob: function (id) { X.dropped.push(id); } };
  const t = X.t = ctx.tables.persona = S.requireScript('spirit/app/agent/table/persona/server.js')(ctx);
  X.cols = db.prepare('PRAGMA table_info("persona")').all().map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' ? true : false;
}, test.limit.quick);
// Andy, box v22: "with Label and Description, and a codeMirror-field for the persona-description i give it with every prompt".
// goal/G41.21, Andy: "and where the fuck is my bundle field in persona-table and the fucking picker for a bundle with the
// persona?"
// goal/G41.26, Andy, box: "agent.persona gains a provider field, it's detail provides the same provider-FUCKING-Selector
// in drop down mode, that the job detail panel provides for the agent.job.provider".
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.cols.indexOf(c) !== -1 ? true : false; };
test.run('the persona table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the persona table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the persona table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the persona table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the persona table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the persona table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the persona table has a persona column', 0.2, function () { return has('persona'); }, test.limit.quick);
test.run('the persona table has a bundle column', 0.2, function () { return has('bundle'); }, test.limit.quick);
test.run('the persona table has a provider column', 0.2, function () { return has('provider'); }, test.limit.quick);
test.run('the persona table has no other column', 0.2, function () { return X.cols.length === 9 ? true : false; }, test.limit.quick);
const B = { pid: '' };
test.run('a persona keeps its bundle, with its text as it was', 0.2, function () {
  if (!X.t) return false;
  B.pid = call(X.t.verb, { op: 'add', icon: '🎭', label: 'With a bundle', persona: 'p' }).id;
  call(X.t.verb, { op: 'set', id: B.pid, bundle: '7' });
  const got = call(X.t.verb, { op: 'get', id: B.pid });
  return got && String(got.bundle) === '7' && got.persona === 'p' ? true : false;
}, test.limit.quick);
test.run('a persona keeps its provider, with its bundle and text as they were', 0.2, function () {
  if (!B.pid) return false;
  // A provider's id is a public key, as every row's is; the persona keeps it as the job keeps its own.
  const P = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  call(X.t.verb, { op: 'set', id: B.pid, provider: P });
  const withP = call(X.t.verb, { op: 'get', id: B.pid });
  call(X.t.verb, { op: 'delete', id: B.pid });
  return withP && withP.provider === P && String(withP.bundle) === '7' && withP.persona === 'p' ? true : false;
}, test.limit.quick);

// ── server.js: a persona is its text ──
const TEXT = 'You are careful.\nYou answer short.';
test.run('a persona is added with its text, kept as typed, lines and all', 0.2, function () {
  if (!X.t) return false;
  X.added = call(X.t.verb, { op: 'add', icon: '🎭', label: 'Careful', persona: TEXT });
  const got = X.added.id ? call(X.t.verb, { op: 'get', id: X.added.id }) : null;
  return got && got.persona === TEXT && got.label === 'Careful' ? true : false;
}, test.limit.quick);
test.run('a set of its label keeps its text', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  call(X.t.verb, { op: 'set', id: X.added.id, label: 'Renamed' });
  return call(X.t.verb, { op: 'get', id: X.added.id }).persona === TEXT ? true : false;
}, test.limit.quick);
test.run('a persona deleted takes no grants with it, because grants are a job\'s', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  const dropped = X.dropped;
  return dropped.length === 0 && (call(X.t.verb, { op: 'delete', id: X.added.id }).id === X.added.id) && dropped.length === 0 ? true : false;
}, test.limit.quick);

// ── server.js: no invalid persona row (goal/G41.21) ──
// Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"; "# mandatory fields (server AND ui) - persona: icon, label".
const V = { before: 0, noIcon: null, noLabel: null, whole: null };
const rowsNow = function () { return X.db.prepare('SELECT COUNT(*) AS n FROM "persona"').get().n; };
test.run('an add without its icon or its label, or with a label of blanks, is refused, and makes no row', 0.2, function () {
  if (!X.t) return false;
  V.before = rowsNow();
  V.noIcon = call(X.t.verb, { op: 'add', label: 'No icon' });
  V.noLabel = call(X.t.verb, { op: 'add', icon: '🎭' });
  const blank = call(X.t.verb, { op: 'add', icon: '🎭', label: '  ' });
  return [V.noIcon, V.noLabel, blank].every(function (r) { return r.refusal && !r.id; }) && rowsNow() === V.before ? true : false;
}, test.limit.quick);
test.run('each refusal names the field missing', 0.2, function () {
  if (!V.noIcon) return false;
  return (/icon/i).test(String(V.noIcon.why)) && /label/i.test(String(V.noLabel.why)) ? true : false;
}, test.limit.quick);
test.run('a persona with its icon and its label is added', 0.2, function () {
  if (!X.t) return false;
  V.whole = call(X.t.verb, { op: 'add', icon: '🎭', label: 'Whole' });
  return V.whole.id && rowsNow() === V.before + 1 ? true : false;
}, test.limit.quick);
test.run('a change that would empty its label is refused, and the row is kept', 0.2, function () {
  if (!V.whole || !V.whole.id) return false;
  const emptied = call(X.t.verb, { op: 'set', id: V.whole.id, label: '' });
  const verdict = emptied.refusal && call(X.t.verb, { op: 'get', id: V.whole.id }).label === 'Whole' ? true : false;
  call(X.t.verb, { op: 'delete', id: V.whole.id });
  return verdict;
}, test.limit.quick);

// ── server.js: a search answers what the list shows (goal/G41.18) ──
// Andy: "only the ID and the fields shown in a table, that's all it needs"; "that exactly what GET is for, to bring in
// the rest for detail panels etc...". The list shows a row by its icon and its label.
test.run('a search answers the id, the icon and the label of a row, nothing else', 0.2, function () {
  if (!X.t) return false;
  const t = X.t;
  const listedId = call(t.verb, { op: 'add', icon: '🧪', label: 'Listed one' }).id;
  let listedRow = null;
  try { listedRow = (call(t.verb, { op: 'search', text: 'Listed one' }).items || []).map(function (i) { return JSON.parse(i.label); }).filter(function (r) { return r.id === listedId; })[0]; } catch (e) { listedRow = null; }
  call(t.verb, { op: 'delete', id: listedId });
  return listedRow && listedRow.icon === '🧪' && listedRow.label === 'Listed one' && JSON.stringify(Object.keys(listedRow).sort()) === '["icon","id","label"]' ? true : false;
}, test.limit.quick);

// ── the page: elementTable.js and elementRow.js ──
const detail = { open: function () {}, look: function (t2) { return { icon: '🎭', name: 'Persona', title: 'Personas', table: t2 }; } };
const box = { innerHTML: '' };
test.run('the page files place spirit.required.spirit.app.agent.element.table.persona.elementTable and elementRow', 0.2, function () {
  const made = X.made = { tables: [], rows: [], required: [] };
  const STAND = {
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  };
  global.window = { spirit: {} };
  global.spirit = global.window.spirit;
  const ANSWERS = { 'spirit/app/agent/element/table/tableElement.js': STAND.agentTable, 'spirit/app/agent/element/table/row.js': STAND.agentRow };
  // The agent branch's interface brings its data.js, as the real api.js does: given spirit/app/agent/api.js, its data.js
  // runs once, as the page runs it, into this page's spirit.required.spirit.data.
  global.window.spirit.requireScript = function (p) {
    made.required.push(String(p));
    if (p === 'spirit/app/agent/api.js' && !made.agentData) { made.agentData = true; vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'agent', 'data.js'), 'utf8'), { filename: 'spirit/app/agent/data.js' }); }
    // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
    // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
    // function... or fail/throw"): the shared table and row elements, the page files' own answers once they ran, and an
    // object for anything else they ask (the agent branch's api.js).
    return Promise.resolve(Object.prototype.hasOwnProperty.call(ANSWERS, p) ? ANSWERS[p] : {});
  };
  // goal/G43.32: the page's spirit.requireScript answers the helper, so each file places itself by installSpiritElement as it
  // runs (spirit/test/headLessChrome.js pageSpirit).
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  // The page's one data set (spirit/data/script.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.nodeFacts.key. The agent
  // family's data.js comes with its interface, spirit/app/agent/api.js, which the stand-in require answers as the real one
  // does.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data', 'script.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.nodeFacts = { key: HOME_KEY };
  global.window.spirit.required.spirit.data.homeNode(HOME_KEY);
  // What the page files require is what is asked from here on; the runner's own asks come before it.
  made.from = made.required.length;
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { ANSWERS[path.relative(RUN, path.join(EL, f)).split(path.sep).join('/')] = PAGE_LOAD.runAsPage(path.join(EL, f)); });
  const T = global.window.spirit.required.spirit.app.agent.element.table.persona || {};
  X.E = { personaTable: T.elementTable, personaRow: T.elementRow };
  return X.E.personaTable && typeof X.E.personaTable.create === 'function' && X.E.personaRow && typeof X.E.personaRow.create === 'function' ? true : false;
}, test.limit.quick);
test.run('elementTable.js requires the shared element and its own row element', 0.2, async function () {
  if (!X.E.personaTable || !X.E.personaRow) return false;
  X.list = X.E.personaTable.create(box, detail);
  await settle();
  const made = X.made;
  return made.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/element/table/persona/elementRow.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it builds on agentTable, in its box, for the persona table, with the detail pane and no api, and the shared Add', 0.2, function () {
  if (!X.list) return false;
  const made = X.made;
  const o = X.o = made.tables[0] && made.tables[0].o;
  return made.tables.length === 1 && made.tables[0].c === box && o.table === 'persona' && !('api' in o) && o.detail === detail && !o.add ? true : false;
}, test.limit.quick);
test.run('its refresh and destroy are the shared element\'s', 0.2, function () {
  if (!X.list) return false;
  X.list.refresh(); X.list.destroy();
  return X.made.refreshed && X.made.destroyed ? true : false;
}, test.limit.quick);
test.run('a row it opens is a personaRow, built on agentRow, in the box it is handed, with its id and its added flag and no api', 0.2, async function () {
  if (!X.o) return false;
  const made = X.made;
  const into = { innerHTML: '' };
  X.o.row(into, 'K1', false);
  await settle();
  const r = X.r = made.rows[0] && made.rows[0].o;
  return made.rows.length === 1 && made.rows[0].c === into && r.table === 'persona' && !('api' in r) && r.id === 'K1' && r.added === false ? true : false;
}, test.limit.quick);
// goal/G41.21: "# mandatory fields (server AND ui)": the row hands the shared editor its table's mandatory fields.
test.run('it hands the editor the persona table\'s mandatory fields, icon and label', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label']) ? true : false;
}, test.limit.quick);
test.run('its title row has the persona table\'s look', 0.2, function () {
  const r = X.r;
  return r && r.look && r.look.icon === '🎭' && r.look.table === 'persona' ? true : false;
}, test.limit.quick);
// goal/G41.21: the bundle by the bundle selector in dropdown mode (kind bundle), as the job's.
// goal/G41.26: the provider by the providerSelector in dropdown mode, the same field the job's detail has
// (../../job/elementRow.js: { field: 'provider', kind: 'pick', pick: 'provider' }).
test.run('the persona editor\'s fields in order: label, the persona as code, the bundle by its selector, the provider picked', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'name', ''], ['persona', 'code', ''], ['bundle', 'bundle', ''], ['provider', 'pick', 'provider']])
    ? true : false;
}, test.limit.quick);
test.run('the provider is not mandatory, as the job\'s is not', 0.2, function () {
  const r = X.r;
  return r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label']) ? true : false;
}, test.limit.quick);

// ── elementRow.js requires the agent branch's interface, whose data.js takes the persona table's rows from the stream (goal/G41.16, G41.28) ──
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
// means for this table, spirit/app/agent/table/data.js until G41.16, is the agent family's data.js's
// (spirit/app/agent/data.js, goal/G41.28), which only its api.js requires; it files the rows under the
// node that served them, and is read through spirit.required.spirit.data.agent.data.
const job = function (agent, module) { return { id: 'job-agent', module: module || 'spirit.app.agent', data: {}, app: { agent: agent } }; };
test.run('its page files require no data script', 0.2, function () {
  if (!X.made) return false;
  return !X.made.required.slice(X.made.from).some(function (p) { return (/data\.js$/).test(p); }) ? true : false;
}, test.limit.quick);
test.run('the persona page requires the agent interface, and the persona branch it reads is the home node\'s <node>/agent/persona', 0.2, function () {
  if (!X.made) return false;
  if (X.made.required.slice(X.made.from).indexOf('spirit/app/agent/api.js') === -1) return false;
  const DATA = global.window.spirit.required.spirit.data;
  const AD = X.AD = ((global.window.spirit.required.spirit.data || {}).agent || {}).data;
  X.BRANCH = DATA.nodeId(HOME_KEY) + '/agent/persona';
  return !!AD && typeof AD.branch === 'function' && AD.branch('persona') === X.BRANCH ? true : false;
}, test.limit.quick);
test.run('a persona row on the stream lands at <node>/agent/persona/<id>, and the branch\'s watcher hears it', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD, BRANCH = X.BRANCH;
  const heard = [];
  const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
  DATA.takeJob(job({ table: 'persona', row: { id: 'KT', label: 'First', extra: 1 } }));
  off();
  return AD.row('persona', 'KT') && AD.row('persona', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1 ? true : false;
}, test.limit.quick);
test.run('a changed row is merged, so what it names changes and what it does not name stays', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'persona', row: { id: 'KT', label: 'Renamed' } }));
  return AD.row('persona', 'KT') && AD.row('persona', 'KT').label === 'Renamed' && AD.row('persona', 'KT').extra === 1 ? true : false;
}, test.limit.quick);
test.run('a row removed, by its id, is gone', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data, AD = X.AD;
  DATA.takeJob(job({ table: 'persona', id: 'KT', removed: true }));
  return !AD.row('persona', 'KT') && !('KT' in DATA.branchAt(X.BRANCH)) ? true : false;
}, test.limit.quick);
test.run('another table\'s rows, another module\'s rows and a row with no id write nothing here', 0.2, function () {
  if (!X.AD) return false;
  const DATA = global.window.spirit.required.spirit.data;
  const before = JSON.stringify(DATA.branchAt(X.BRANCH));
  DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
  DATA.takeJob(job({ table: 'persona', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
  DATA.takeJob(job({ table: 'persona', row: { label: 'no id' } }));
  return JSON.stringify(DATA.branchAt(X.BRANCH)) === before ? true : false;
}, test.limit.quick);
// ITS FOLDER GOES LAST, ITS DATABASE CLOSED FIRST (Andy, of the 0.7s: 'it leaves no temp folder behind' on his Windows node):
// on Windows a folder holding an open database cannot be removed, so the database is closed, then the folder removed.
test.after(function () {
  try { if (X.db) X.db.close(); } catch (e) { /* closed */ }
  try { require('fs').rmSync(tempFolder.path('spirit/app/agent/table/persona/test/server'), { recursive: true, force: true }); } catch (e) { /* a door still closing */ }
});
