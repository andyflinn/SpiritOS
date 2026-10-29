'use strict';

// spirit/run/process/js/agent/table/persona/test/persona.js
// The tests of process/js/agent/table/persona/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./persona.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
// agent.db as agent.js makes it; the page files run in node on a window of their own, the shared elements stubs that
// keep what they were handed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit.js'));
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const DIR = path.join(__dirname, '..');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

test.startTest('persona/: the persona table');

(async function () {
  test.subHeading('its files');
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-persona-'));
  const db = new DatabaseSync(path.join(scratch, 'agent.db'));
  const published = [];
  const dropped = [];
  const ctx = { db: db, dbFile: path.join(scratch, 'agent.db'), tables: {}, publish: function (x) { published.push(x); } };
  ctx.tables.grant = { dropJob: function (id) { dropped.push(id); } };
  const t = ctx.tables.persona = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function', 'server.js(ctx) answers the table, its verb and has', 'answered: ' + short(t && Object.keys(t)));
  const cols = db.prepare('PRAGMA table_info("persona")').all().map(function (c) { return c.name; });
  // Andy, box v22: "with Label and Description, and a codeMirror-field for the persona-description i give it with every prompt".
  ['id','privateKey','sealPublicKey','sealPrivateKey','icon','label','description','persona'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the persona table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 8, 'and nothing else', 'columns: ' + short(cols));

  test.subHeading('server.js: a persona is its text');
  const TEXT = 'You are careful.\nYou answer short.';
  const added = call(t.verb, { op: 'add', label: 'Careful', persona: TEXT });
  const got = added.id ? call(t.verb, { op: 'get', id: added.id }) : null;
  ok(got && got.persona === TEXT && got.label === 'Careful', 'a persona is added with its text, kept as typed, lines and all', 'get: ' + short(got));
  call(t.verb, { op: 'set', id: added.id, label: 'Renamed' });
  ok(call(t.verb, { op: 'get', id: added.id }).persona === TEXT, 'a set of its label keeps its text', 'get: ' + short(call(t.verb, { op: 'get', id: added.id })));
  ok(dropped.length === 0 && (call(t.verb, { op: 'delete', id: added.id }).id === added.id) && dropped.length === 0, 'a persona deleted takes no grants: grants are a job\'s', 'dropped: ' + short(dropped));

  test.subHeading('server.js: a search answers what the list shows (goal/G41.18)');
  // Andy: "only the ID and the fields shown in a table, that's all it needs"; "that exactly what GET is for, to bring in
  // the rest for detail panels etc...". The list shows a row by its icon and its label.
  {
    const listedId = call(t.verb, { op: 'add', icon: '🧪', label: 'Listed one', description: 'not in a search' }).id;
    let listedRow = null;
    try { listedRow = (call(t.verb, { op: 'search', text: 'Listed one' }).items || []).map(function (i) { return JSON.parse(i.label); }).filter(function (r) { return r.id === listedId; })[0]; } catch (e) { listedRow = null; }
    ok(listedRow && listedRow.icon === '🧪' && listedRow.label === 'Listed one' && JSON.stringify(Object.keys(listedRow).sort()) === '["icon","id","label"]',
      'a search answers the id, the icon and the label of a row, nothing else', 'found: ' + short(listedRow));
    call(t.verb, { op: 'delete', id: listedId });
  }

  test.subHeading('the page: elementTable.js and elementRow.js');
  const made = { tables: [], rows: [], required: [] };
  global.window = { spirit: { elements: {
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  } } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { made.required.push(String(p)); return Promise.resolve(true); };
  // The page's one data set (shell/js/spiritData.js), which spirit.js brings with the client: the stream lands there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: path.join(DIR, f) }); });
  const E = global.window.spirit.elements;
  ok(E.personaTable && typeof E.personaTable.create === 'function' && E.personaRow && typeof E.personaRow.create === 'function',
    'they register spirit.elements.personaTable and personaRow', 'elements: ' + short(Object.keys(E)));
  if (!E.personaTable || !E.personaRow) return;
  const api = { stub: true };
    const detail = { open: function () {}, look: function (t2) { return { icon: '🎭', name: 'Persona', title: 'Personas', table: t2 }; } };
  const box = { innerHTML: '' };
  const list = E.personaTable.create(box, api, detail);
  await settle();
  ok(made.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && made.required.indexOf('process/js/agent/table/persona/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(made.required));
  const o = made.tables[0] && made.tables[0].o;
  ok(made.tables.length === 1 && made.tables[0].c === box && o.table === 'persona' && o.api === api && o.detail === detail && !o.add,
    'it builds on agentTable, in its box, for the persona table, with the page\'s api and detail pane, and the shared Add', 'agentTable: ' + short(o && { table: o.table, add: !!o.add }));
  list.refresh(); list.destroy();
  ok(made.refreshed && made.destroyed, 'its refresh and destroy are the shared element\'s', 'refreshed ' + made.refreshed + ', destroyed ' + made.destroyed);
  const into = { innerHTML: '' };
  o.row(into, 'K1', false);
  await settle();
  const r = made.rows[0] && made.rows[0].o;
  ok(made.rows.length === 1 && made.rows[0].c === into && r.table === 'persona' && r.id === 'K1' && r.added === false && r.api === api,
    'a row it opens is a personaRow, built on agentRow, in the box it is handed, with its id and added', 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added }));
  ok(r && r.look && r.look.icon === '🎭' && r.look.table === 'persona', 'its title row has the persona table\'s look', 'look: ' + short(r && r.look));
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind]; })) === JSON.stringify([['label', 'name'], ['description', 'description'], ['persona', 'code']]),
    'its fields are the label, the description, and the persona in a CodeMirror editor', 'fields: ' + short(r && r.fields));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('elementRow.js takes the persona table\'s rows from the stream itself (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
  // means for this table, process/js/agent/table/data.js until G41.16, is its row element's, loaded with it.
  {
    const DATA = global.window.spirit.data;
    ok(!made.required.some(function (p) { return /data\.js$/.test(p); }), 'its page files require no data script', 'required: ' + short(made.required));
    const job = function (agent, module) { return { id: 'job-agent', module: module || 'process/js/agent', data: {}, app: { agent: agent } }; };
    const heard = [];
    const off = DATA.watch('agent.persona', function (p) { heard.push(p); });
    DATA.take(job({ table: 'persona', row: { id: 'KT', label: 'First', extra: 1 } }));
    ok(DATA.get('agent.persona/KT') && DATA.get('agent.persona/KT').label === 'First' && heard.indexOf('agent.persona/KT') !== -1, 'a persona row on the stream lands at agent.persona/<id>, and the branch\'s watcher hears it', 'agent.persona: ' + short(DATA.branch('agent.persona')));
    DATA.take(job({ table: 'persona', row: { id: 'KT', label: 'Renamed' } }));
    ok(DATA.get('agent.persona/KT') && DATA.get('agent.persona/KT').label === 'Renamed' && DATA.get('agent.persona/KT').extra === 1, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(DATA.get('agent.persona/KT')));
    DATA.take(job({ table: 'persona', id: 'KT', removed: true }));
    ok(!DATA.get('agent.persona/KT'), 'a row removed, by its id, is gone', 'row: ' + short(DATA.get('agent.persona/KT')));
    const before = JSON.stringify(DATA.branch('agent.persona'));
    DATA.take(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
    DATA.take(job({ table: 'persona', row: { id: 'KX', label: 'from the desk' } }, 'process/js/desk'));
    DATA.take(job({ table: 'persona', row: { label: 'no id' } }));
    ok(JSON.stringify(DATA.branch('agent.persona')) === before, 'another table\'s rows, another module\'s, and a row with no id write nothing here', 'agent.persona: ' + short(DATA.branch('agent.persona')));
    off();
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
