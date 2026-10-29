'use strict';

// spirit/run/process/js/agent/table/provider/test/provider.js
// The tests of process/js/agent/table/provider/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./provider.md; goal/G41.4). What the tables share is tested in ../../test/. The server is made on a scratch
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

const TABLE = 'provider';
const DIR = path.join(__dirname, '..');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const SECRET = 'sk-provider-test-0123456789';

test.startTest('provider/: the provider table');

(async function () {
  test.subHeading('its files');
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-provider-'));
  const db = new DatabaseSync(path.join(scratch, 'agent.db'));
  const published = [];
  const ctx = { db: db, dbFile: path.join(scratch, 'agent.db'), tables: {}, publish: function (x) { published.push(x); } };
  const t = ctx.tables.provider = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function', 'server.js(ctx) answers the table, its verb and has', 'answered: ' + short(t && Object.keys(t)));
  const cols = db.prepare('PRAGMA table_info("provider")').all().map(function (c) { return c.name; });
  // Andy, box v22: "with Label and Description, URL, and API_KEY".
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'description', 'url', 'apiKey'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the provider table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 9, 'and nothing else', 'columns: ' + short(cols));

  test.subHeading('server.js: the API key never leaves the agent process');
  const added = call(t.verb, { op: 'add', label: 'Anthropic', url: 'https://api.anthropic.com', apiKey: SECRET });
  const raw = added.id ? db.prepare('SELECT apiKey FROM "provider" WHERE id = ?').get(added.id) : null;
  ok(raw && raw.apiKey === SECRET, 'the API key is kept on the row', 'row: ' + short(raw && { set: !!raw.apiKey }));
  const got = call(t.verb, { op: 'get', id: added.id });
  const seen = JSON.stringify([got, call(t.verb, { op: 'search', text: 'Anthropic' }), published]);
  ok(got && got.apiKeySet === true && !('apiKey' in got) && seen.indexOf(SECRET) === -1, 'no get, search or published row carries it: only apiKeySet true',
    'get: ' + short(got));
  ok(got && got.url === 'https://api.anthropic.com' && got.label === 'Anthropic', 'its url and label are shown', 'get: ' + short(got));
  ok(call(t.verb, { op: 'add', url: 'not a url' }).refusal === 'bad-request', 'a url that is not one is refused', 'bad url answered');

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
  ok(E.providerTable && typeof E.providerTable.create === 'function' && E.providerRow && typeof E.providerRow.create === 'function',
    'they register spirit.elements.providerTable and providerRow', 'elements: ' + short(Object.keys(E)));
  if (!E.providerTable || !E.providerRow) return;
  const api = { stub: true };
  const detail = { open: function () {}, look: function (t2) { return { icon: '🏢', name: 'Provider', title: 'Model providers', table: t2 }; } };
  const box = { innerHTML: '' };
  const list = E.providerTable.create(box, api, detail);
  await settle();
  ok(made.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && made.required.indexOf('process/js/agent/table/provider/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(made.required));
  const o = made.tables[0] && made.tables[0].o;
  ok(made.tables.length === 1 && made.tables[0].c === box && o.table === 'provider' && o.api === api && o.detail === detail && !o.add,
    'it builds on agentTable, in its box, for the provider table, with the page\'s api and detail pane, and the shared Add', 'agentTable: ' + short(o && { table: o.table, add: !!o.add }));
  list.refresh(); list.destroy();
  ok(made.refreshed && made.destroyed, 'its refresh and destroy are the shared element\'s', 'refreshed ' + made.refreshed + ', destroyed ' + made.destroyed);
  const into = { innerHTML: '' };
  o.row(into, 'KP', true);
  await settle();
  const r = made.rows[0] && made.rows[0].o;
  ok(made.rows.length === 1 && made.rows[0].c === into && r.table === 'provider' && r.id === 'KP' && r.added === true && r.api === api,
    'a row it opens is a providerRow, built on agentRow, in the box it is handed, with its id and added', 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added }));
  ok(r && r.look && r.look.icon === '🏢' && r.look.table === 'provider', 'its title row has the provider table\'s look', 'look: ' + short(r && r.look));
  // Andy, box v22: "with Label and Description, URL, and API_KEY"; the icon comes first of every editor (tableElement.js).
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind]; })) === JSON.stringify([['label', 'name'], ['description', 'description'], ['url', 'url'], ['apiKey', 'secret']]),
    'its fields are the label, the description, the url, and the API key as a secret', 'fields: ' + short(r && r.fields));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('elementRow.js takes the provider table\'s rows from the stream itself (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
  // means for this table, process/js/agent/table/data.js until G41.16, is its row element's, loaded with it.
  {
    const DATA = global.window.spirit.data;
    ok(!made.required.some(function (p) { return /data\.js$/.test(p); }), 'its page files require no data script', 'required: ' + short(made.required));
    const job = function (agent, module) { return { id: 'job-agent', module: module || 'process/js/agent', data: {}, app: { agent: agent } }; };
    const heard = [];
    const off = DATA.watch('agent.provider', function (p) { heard.push(p); });
    DATA.take(job({ table: 'provider', row: { id: 'KT', label: 'First', extra: 1 } }));
    ok(DATA.get('agent.provider/KT') && DATA.get('agent.provider/KT').label === 'First' && heard.indexOf('agent.provider/KT') !== -1, 'a provider row on the stream lands at agent.provider/<id>, and the branch\'s watcher hears it', 'agent.provider: ' + short(DATA.branch('agent.provider')));
    DATA.take(job({ table: 'provider', row: { id: 'KT', label: 'Renamed' } }));
    ok(DATA.get('agent.provider/KT') && DATA.get('agent.provider/KT').label === 'Renamed' && DATA.get('agent.provider/KT').extra === 1, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(DATA.get('agent.provider/KT')));
    DATA.take(job({ table: 'provider', id: 'KT', removed: true }));
    ok(!DATA.get('agent.provider/KT'), 'a row removed, by its id, is gone', 'row: ' + short(DATA.get('agent.provider/KT')));
    const before = JSON.stringify(DATA.branch('agent.provider'));
    DATA.take(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
    DATA.take(job({ table: 'provider', row: { id: 'KX', label: 'from the desk' } }, 'process/js/desk'));
    DATA.take(job({ table: 'provider', row: { label: 'no id' } }));
    ok(JSON.stringify(DATA.branch('agent.provider')) === before, 'another table\'s rows, another module\'s, and a row with no id write nothing here', 'agent.provider: ' + short(DATA.branch('agent.provider')));
    off();
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
