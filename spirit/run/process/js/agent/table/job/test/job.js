'use strict';

// spirit/run/process/js/agent/table/job/test/job.js
// The tests of process/js/agent/table/job/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./job.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
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

test.startTest('job/: the job table');

(async function () {
  test.subHeading('its files');
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-job-'));
  const db = new DatabaseSync(path.join(scratch, 'agent.db'));
  const published = [];
  const dropped = [];
  const ctx = { db: db, dbFile: path.join(scratch, 'agent.db'), tables: {}, publish: function (x) { published.push(x); } };
  ctx.tables.grant = { dropJob: function (id) { dropped.push(id); } };
  const t = ctx.tables.job = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function', 'server.js(ctx) answers the table, its verb and has', 'answered: ' + short(t && Object.keys(t)));
  const cols = db.prepare('PRAGMA table_info("job")').all().map(function (c) { return c.name; });
  // Andy, box v22: "with Label and Description, boolean loop-flag (not for the model, for the agent-app), and a codeMirror-field for the
  // job-description that may come with a prompt".
  ['id','privateKey','sealPublicKey','sealPrivateKey','icon','label','description','loop','job'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the job table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 9, 'and nothing else', 'columns: ' + short(cols));

  test.subHeading('server.js: a job, its loop flag and its text');
  const TEXT = 'Read the news.\nSay what changed.';
  const added = call(t.verb, { op: 'add', label: 'News', loop: true, job: TEXT });
  const got = added.id ? call(t.verb, { op: 'get', id: added.id }) : null;
  ok(got && got.loop === true && got.job === TEXT, 'a job is added with its loop flag, a bool, and its text, kept as typed', 'get: ' + short(got));
  ok(db.prepare('PRAGMA table_info("job")').all().filter(function (c) { return c.name === 'loop'; })[0].type === 'INTEGER', 'the loop flag is kept as an INTEGER', 'loop column');
  call(t.verb, { op: 'set', id: added.id, loop: false });
  ok(call(t.verb, { op: 'get', id: added.id }).loop === false && call(t.verb, { op: 'get', id: added.id }).job === TEXT, 'a set of the flag keeps the text', 'get: ' + short(call(t.verb, { op: 'get', id: added.id })));

  test.subHeading('server.js: a job deleted takes its grants with it');
  ok(call(t.verb, { op: 'delete', id: added.id }).id === added.id && JSON.stringify(dropped) === JSON.stringify([added.id]), 'deleting a job asks the grant table to drop that job\'s grants, once', 'dropped: ' + short(dropped));
  const other = call(t.verb, { op: 'add', label: 'Other' });
  call(t.verb, { op: 'set', id: other.id, label: 'Still' });
  ok(dropped.length === 1, 'an add or a set drops nothing', 'dropped: ' + short(dropped));

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
  ok(E.jobTable && typeof E.jobTable.create === 'function' && E.jobRow && typeof E.jobRow.create === 'function',
    'they register spirit.elements.jobTable and jobRow', 'elements: ' + short(Object.keys(E)));
  if (!E.jobTable || !E.jobRow) return;
  const api = { stub: true };
    const detail = { open: function () {}, look: function (t2) { return { icon: '📋', name: 'Job', title: 'Jobs', table: t2 }; } };
  const box = { innerHTML: '' };
  const list = E.jobTable.create(box, api, detail);
  await settle();
  ok(made.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && made.required.indexOf('process/js/agent/table/job/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(made.required));
  const o = made.tables[0] && made.tables[0].o;
  ok(made.tables.length === 1 && made.tables[0].c === box && o.table === 'job' && o.api === api && o.detail === detail && !o.add,
    'it builds on agentTable, in its box, for the job table, with the page\'s api and detail pane, and the shared Add', 'agentTable: ' + short(o && { table: o.table, add: !!o.add }));
  list.refresh(); list.destroy();
  ok(made.refreshed && made.destroyed, 'its refresh and destroy are the shared element\'s', 'refreshed ' + made.refreshed + ', destroyed ' + made.destroyed);
  const into = { innerHTML: '' };
  o.row(into, 'K1', false);
  await settle();
  const r = made.rows[0] && made.rows[0].o;
  ok(made.rows.length === 1 && made.rows[0].c === into && r.table === 'job' && r.id === 'K1' && r.added === false && r.api === api,
    'a row it opens is a jobRow, built on agentRow, in the box it is handed, with its id and added', 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added }));
  ok(r && r.look && r.look.icon === '📋' && r.look.table === 'job', 'its title row has the job table\'s look', 'look: ' + short(r && r.look));
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind]; })) === JSON.stringify([['label', 'name'], ['description', 'description'], ['loop', 'bool'], ['job', 'code']]),
    'its fields are the label, the description, the loop flag as a checkbox, and the job in a CodeMirror editor', 'fields: ' + short(r && r.fields));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
