'use strict';

// spirit/run/process/js/agent/table/model/test/model.js
// The tests of process/js/agent/table/model/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./model.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
// agent.db as agent.js makes it, beside the provider table it names; the page files run in node on a window of their
// own, the shared elements stubs that keep what they were handed.

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

test.startTest('model/: the model table');

(async function () {
  test.subHeading('its files');
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-model-'));
  const db = new DatabaseSync(path.join(scratch, 'agent.db'));
  const ctx = { db: db, dbFile: path.join(scratch, 'agent.db'), tables: {}, publish: function () {} };
  ctx.tables.provider = require(path.join(DIR, '..', 'provider', 'server.js'))(ctx);
  const t = ctx.tables.model = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function', 'server.js(ctx) answers the table, its verb and has', 'answered: ' + short(t && Object.keys(t)));
  const cols = db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  // Andy, box v22: "with Label and Description, provider-key, and model-name and capabilities".
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'description', 'providerId', 'modelName', 'capabilities'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the model table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 10, 'and nothing else', 'columns: ' + short(cols));

  test.subHeading('server.js: a model names a provider that is there');
  const provider = call(ctx.tables.provider.verb, { op: 'add', label: 'Anthropic' });
  const added = call(t.verb, { op: 'add', label: 'Opus', providerId: provider.id, modelName: 'claude-opus-5-5', capabilities: ['text', 'tools'] });
  const got = added.id ? call(t.verb, { op: 'get', id: added.id }) : null;
  ok(got && got.providerId === provider.id && got.modelName === 'claude-opus-5-5', 'a model is added with its provider\'s id and its model name', 'get: ' + short(got));
  ok(got && JSON.stringify(got.capabilities) === '["text","tools"]', 'its capabilities are a list', 'capabilities: ' + short(got && got.capabilities));
  const gone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  const noProvider = call(t.verb, { op: 'add', label: 'Lost', providerId: gone });
  ok(noProvider.refusal === 'bad-request' && /no provider/.test(noProvider.why), 'a model naming a provider that is not there is refused, saying so', 'answer: ' + short(noProvider));
  ok(call(t.verb, { op: 'set', id: added.id, providerId: gone }).refusal === 'bad-request' && call(t.verb, { op: 'get', id: added.id }).providerId === provider.id,
    'and so is a set to one, the provider kept', 'set answered');

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
  ok(E.modelTable && typeof E.modelTable.create === 'function' && E.modelRow && typeof E.modelRow.create === 'function',
    'they register spirit.elements.modelTable and modelRow', 'elements: ' + short(Object.keys(E)));
  if (!E.modelTable || !E.modelRow) return;
  const api = { stub: true };
  const detail = { open: function () {}, look: function (t2) { return { icon: '🧠', name: 'Model', title: 'Models', table: t2 }; } };
  const box = { innerHTML: '' };
  const list = E.modelTable.create(box, api, detail);
  await settle();
  ok(made.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && made.required.indexOf('process/js/agent/table/model/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(made.required));
  const o = made.tables[0] && made.tables[0].o;
  ok(made.tables.length === 1 && made.tables[0].c === box && o.table === 'model' && o.api === api && o.detail === detail && !o.add,
    'it builds on agentTable, in its box, for the model table, with the page\'s api and detail pane, and the shared Add', 'agentTable: ' + short(o && { table: o.table, add: !!o.add }));
  list.refresh(); list.destroy();
  ok(made.refreshed && made.destroyed, 'its refresh and destroy are the shared element\'s', 'refreshed ' + made.refreshed + ', destroyed ' + made.destroyed);
  const into = { innerHTML: '' };
  o.row(into, 'KM', false);
  await settle();
  const r = made.rows[0] && made.rows[0].o;
  ok(made.rows.length === 1 && made.rows[0].c === into && r.table === 'model' && r.id === 'KM' && r.added === false && r.api === api,
    'a row it opens is a modelRow, built on agentRow, in the box it is handed, with its id and added', 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added }));
  ok(r && r.look && r.look.icon === '🧠' && r.look.table === 'model', 'its title row has the model table\'s look', 'look: ' + short(r && r.look));
  const provField = r && r.fields.filter(function (f) { return f.field === 'providerId'; })[0];
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind]; })) === JSON.stringify([['label', 'name'], ['description', 'description'], ['providerId', 'pick'], ['modelName', 'text'], ['capabilities', 'list']]),
    'its fields are the label, the description, the provider picked, the model name, and the capabilities as a list', 'fields: ' + short(r && r.fields));
  ok(provField && provField.pick === 'provider', 'the provider is picked from a search of the provider table', 'providerId: ' + short(provField));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('elementRow.js takes the model table\'s rows from the stream itself (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
  // means for this table, process/js/agent/table/data.js until G41.16, is its row element's, loaded with it.
  {
    const DATA = global.window.spirit.data;
    ok(!made.required.some(function (p) { return /data\.js$/.test(p); }), 'its page files require no data script', 'required: ' + short(made.required));
    const job = function (agent, module) { return { id: 'job-agent', module: module || 'process/js/agent', data: {}, app: { agent: agent } }; };
    const heard = [];
    const off = DATA.watch('agent.model', function (p) { heard.push(p); });
    DATA.take(job({ table: 'model', row: { id: 'KT', label: 'First', extra: 1 } }));
    ok(DATA.get('agent.model/KT') && DATA.get('agent.model/KT').label === 'First' && heard.indexOf('agent.model/KT') !== -1, 'a model row on the stream lands at agent.model/<id>, and the branch\'s watcher hears it', 'agent.model: ' + short(DATA.branch('agent.model')));
    DATA.take(job({ table: 'model', row: { id: 'KT', label: 'Renamed' } }));
    ok(DATA.get('agent.model/KT') && DATA.get('agent.model/KT').label === 'Renamed' && DATA.get('agent.model/KT').extra === 1, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(DATA.get('agent.model/KT')));
    DATA.take(job({ table: 'model', id: 'KT', removed: true }));
    ok(!DATA.get('agent.model/KT'), 'a row removed, by its id, is gone', 'row: ' + short(DATA.get('agent.model/KT')));
    const before = JSON.stringify(DATA.branch('agent.model'));
    DATA.take(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
    DATA.take(job({ table: 'model', row: { id: 'KX', label: 'from the desk' } }, 'process/js/desk'));
    DATA.take(job({ table: 'model', row: { label: 'no id' } }));
    ok(JSON.stringify(DATA.branch('agent.model')) === before, 'another table\'s rows, another module\'s, and a row with no id write nothing here', 'agent.model: ' + short(DATA.branch('agent.model')));
    off();
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
