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

  test.subHeading('the page: elementTable.js and elementRow.js');
  const made = { tables: [], rows: [], required: [] };
  global.window = { spirit: { elements: {
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  } } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { made.required.push(String(p)); return Promise.resolve(true); };
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
