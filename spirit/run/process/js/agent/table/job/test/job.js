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
  // goal/G41.21 (box v17): "The job table gains a field, bundle", "a second field, provider", "a third field, persona".
  ['id','privateKey','sealPublicKey','sealPrivateKey','icon','label','loop','job','bundle','provider','persona'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the job table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 11, 'and nothing else', 'columns: ' + short(cols));

  test.subHeading('server.js: a job, its loop flag and its text');
  const TEXT = 'Read the news.\nSay what changed.';
  const added = call(t.verb, { op: 'add', icon: '📋', label: 'News', loop: true, job: TEXT });
  const got = added.id ? call(t.verb, { op: 'get', id: added.id }) : null;
  ok(got && got.loop === true && got.job === TEXT, 'a job is added with its loop flag, a bool, and its text, kept as typed', 'get: ' + short(got));
  ok(db.prepare('PRAGMA table_info("job")').all().filter(function (c) { return c.name === 'loop'; })[0].type === 'INTEGER', 'the loop flag is kept as an INTEGER', 'loop column');
  call(t.verb, { op: 'set', id: added.id, loop: false });
  ok(call(t.verb, { op: 'get', id: added.id }).loop === false && call(t.verb, { op: 'get', id: added.id }).job === TEXT, 'a set of the flag keeps the text', 'get: ' + short(call(t.verb, { op: 'get', id: added.id })));

  test.subHeading('server.js: a job\'s bundle, provider and persona (goal/G41.21)');
  // A provider's and a persona's id are public keys, as every row's is.
  const keyOf = function () { return require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64'); };
  const P = keyOf();
  const Q = keyOf();
  call(t.verb, { op: 'set', id: added.id, bundle: '7', provider: P, persona: Q });
  const three = call(t.verb, { op: 'get', id: added.id });
  ok(three && String(three.bundle) === '7' && three.provider === P && three.persona === Q && three.job === TEXT, 'a job keeps its bundle, its provider and its persona, its text as it was', 'get: ' + short(three));

  test.subHeading('server.js: a job deleted asks no grant table (goal/G41.21)');
  // "With it go ... the job's delete hook that dropped a job's grants": a job's grant is its bundle, deleted with it.
  ok(call(t.verb, { op: 'delete', id: added.id }).id === added.id && dropped.length === 0, 'deleting a job drops it, and asks no grant table for anything', 'dropped: ' + short(dropped));
  const other = call(t.verb, { op: 'add', icon: '📋', label: 'Other' });
  call(t.verb, { op: 'set', id: other.id, label: 'Still' });

  test.subHeading('server.js: no invalid job row (goal/G41.21)');
  // Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"; "# mandatory fields (server AND ui) - job: icon, label".
  {
    const rowsNow = function () { return db.prepare('SELECT COUNT(*) AS n FROM "job"').get().n; };
    const before = rowsNow();
    const noIcon = call(t.verb, { op: 'add', label: 'No icon' });
    const noLabel = call(t.verb, { op: 'add', icon: '📋' });
    const blank = call(t.verb, { op: 'add', icon: '📋', label: '  ' });
    ok([noIcon, noLabel, blank].every(function (r) { return r.refusal && !r.id; }) && rowsNow() === before, 'an add without its icon or its label, or with a label of blanks, is refused, and makes no row', 'answers: ' + short([noIcon, noLabel, blank]));
    ok(/icon/i.test(String(noIcon.why)) && /label/i.test(String(noLabel.why)), 'each refusal names the field missing', 'why: ' + short([noIcon.why, noLabel.why]));
    const whole = call(t.verb, { op: 'add', icon: '📋', label: 'Whole' });
    ok(whole.id && rowsNow() === before + 1, 'with its icon and its label, it is added', 'answer: ' + short(whole));
    const emptied = call(t.verb, { op: 'set', id: whole.id, label: '' });
    ok(emptied.refusal && call(t.verb, { op: 'get', id: whole.id }).label === 'Whole', 'a change that would empty its label is refused, the row kept', 'answer: ' + short(emptied));
    call(t.verb, { op: 'delete', id: whole.id });
  }

  test.subHeading('server.js: a search answers what the list shows (goal/G41.18)');
  // Andy: "only the ID and the fields shown in a table, that's all it needs"; "that exactly what GET is for, to bring in
  // the rest for detail panels etc...". The list shows a row by its icon and its label.
  {
    const listedId = call(t.verb, { op: 'add', icon: '🧪', label: 'Listed one' }).id;
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
  // The page's one data set (shell/shared/js/spiritData.js), which spirit.js brings with the client: the stream lands there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
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
  // goal/G41.21: "# mandatory fields (server AND ui)": the row hands the shared editor its table's mandatory fields.
  ok(r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label']), 'it hands the editor the job table\'s mandatory fields, [icon, label]', 'required: ' + short(r && r.required));
  ok(r && r.look && r.look.icon === '📋' && r.look.table === 'job', 'its title row has the job table\'s look', 'look: ' + short(r && r.look));
  // goal/G41.21: the bundle set "with a bundleSelector in dropdown mode" (kind bundle), the provider and the persona by a
  // pick field of their table; the order of the box, the code field drawn last by the shared element whatever its place.
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'name', ''], ['loop', 'bool', ''], ['job', 'code', ''],
    ['bundle', 'bundle', ''], ['provider', 'pick', 'provider'], ['persona', 'pick', 'persona']]),
    'its fields are the label, the loop flag, the job, then the bundle by the bundle selector, the provider and the persona each by a pick field of its table', 'fields: ' + short(r && r.fields));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('elementRow.js takes the job table\'s rows from the stream itself (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
  // means for this table, process/js/agent/table/data.js until G41.16, is its row element's, loaded with it.
  {
    const DATA = global.window.spirit.data;
    ok(!made.required.some(function (p) { return /data\.js$/.test(p); }), 'its page files require no data script', 'required: ' + short(made.required));
    const job = function (agent, module) { return { id: 'job-agent', module: module || 'process/js/agent', data: {}, app: { agent: agent } }; };
    const heard = [];
    const off = DATA.watch('agent.job', function (p) { heard.push(p); });
    DATA.take(job({ table: 'job', row: { id: 'KT', label: 'First', extra: 1 } }));
    ok(DATA.get('agent.job/KT') && DATA.get('agent.job/KT').label === 'First' && heard.indexOf('agent.job/KT') !== -1, 'a job row on the stream lands at agent.job/<id>, and the branch\'s watcher hears it', 'agent.job: ' + short(DATA.branch('agent.job')));
    DATA.take(job({ table: 'job', row: { id: 'KT', label: 'Renamed' } }));
    ok(DATA.get('agent.job/KT') && DATA.get('agent.job/KT').label === 'Renamed' && DATA.get('agent.job/KT').extra === 1, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(DATA.get('agent.job/KT')));
    DATA.take(job({ table: 'job', id: 'KT', removed: true }));
    ok(!DATA.get('agent.job/KT'), 'a row removed, by its id, is gone', 'row: ' + short(DATA.get('agent.job/KT')));
    const before = JSON.stringify(DATA.branch('agent.job'));
    DATA.take(job({ table: 'model', row: { id: 'KO', label: 'another table' } }));
    DATA.take(job({ table: 'job', row: { id: 'KX', label: 'from the desk' } }, 'process/js/desk'));
    DATA.take(job({ table: 'job', row: { label: 'no id' } }));
    ok(JSON.stringify(DATA.branch('agent.job')) === before, 'another table\'s rows, another module\'s, and a row with no id write nothing here', 'agent.job: ' + short(DATA.branch('agent.job')));
    off();
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
