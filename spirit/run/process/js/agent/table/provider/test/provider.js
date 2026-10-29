'use strict';

// spirit/run/process/js/agent/table/provider/test/provider.js
// The tests of process/js/agent/table/provider/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./provider.md; goal/G41.4, goal/G41.18). What the tables share is tested in ../../test/. The server is made on
// a scratch agent.db as agent.js makes it, with the model table beside it for ask, and the provider ask reaches is a
// stand-in on 127.0.0.1; the plugins themselves are tested in ../../../provider/. The page files run in node on a window
// of their own, the shared elements stubs that keep what they were handed.

const fs = require('fs');
const http = require('http');
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
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

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
  // Andy, box v22: "with Label and Description, URL, and API_KEY"; goal/G41.18, box v17: "if it fails, the provider row
  // will be flagged as unusable".
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'description', 'url', 'apiKey', 'unusable'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the provider table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 10, 'and nothing else', 'columns: ' + short(cols));

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

  test.subHeading('server.js: one provider row per url (goal/G41.18)');
  // Andy, box v17: "a new provider row will not be added if the URL is the same as an existing URL in the provider table,
  // nor will a change be allowed if the change would result in duplicate URL's, trailing slashes don't count as
  // different."
  const count = function () { return db.prepare('SELECT COUNT(*) AS n FROM "provider"').get().n; };
  const n0 = count();
  ok(call(t.verb, { op: 'add', label: 'Again', url: 'https://api.anthropic.com' }).refusal === 'bad-request' && count() === n0, 'a new row with a url already in the table is refused, and nothing is added', 'rows ' + count() + ' of ' + n0);
  ok(call(t.verb, { op: 'add', label: 'Slash', url: 'https://api.anthropic.com/' }).refusal === 'bad-request' && count() === n0, 'and so is the same url with a trailing slash', 'rows ' + count() + ' of ' + n0);
  const n1 = count();
  const other = call(t.verb, { op: 'add', label: 'Other', url: 'https://api.openai.com/v1' });
  ok(other.id && count() === n1 + 1, 'a row with a url of its own is added', 'answer: ' + short(other));
  const moved = call(t.verb, { op: 'set', id: other.id, url: 'https://api.anthropic.com/' });
  ok(moved.refusal === 'bad-request' && call(t.verb, { op: 'get', id: other.id }).url === 'https://api.openai.com/v1', 'a change to another row\'s url is refused, the url kept', 'answer: ' + short(moved));
  ok(!call(t.verb, { op: 'set', id: other.id, url: 'https://api.openai.com/v1/' }).refusal && !call(t.verb, { op: 'set', id: other.id, label: 'Renamed' }).refusal,
    'a row may keep its own url, with or without the slash, and change its other fields', 'own url refused');
  const e1 = call(t.verb, { op: 'add', label: 'No url one' });
  const e2 = call(t.verb, { op: 'add', label: 'No url two' });
  ok(e1.id && e2.id, 'rows with no url are no duplicates of each other', 'answers: ' + short([e1, e2]));
  [other.id, e1.id, e2.id].forEach(function (id) { if (id) call(t.verb, { op: 'delete', id: id }); });

  test.subHeading('server.js: ask, a provider\'s models into the model table (goal/G41.18)');
  // Andy, box v17: "the provider table gets a new verb: \"ask\", which does the model-list fetching and model-table
  // updating"; the plugin by the row's label, "case-insensitive", else the OpenAI plugin, "if it fails, the provider row
  // will be flagged as unusable"; "Updated means, unavailable models from that provider will be removed, also"; "only if a
  // provider answers with a list of more than 0 models, will the agent's model table be \"updated\"". The provider is a
  // stand-in on 127.0.0.1 that answers as Anthropic does to x-api-key and as an OpenAI-compatible server does otherwise.
  ctx.tables.model = require(path.join(DIR, '..', 'model', 'server.js'))(ctx);
  const ask = async function (a) { try { return await t.verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } };
  const stand = { heard: [], anthropic: [], openai: [], fail: false };
  const server = http.createServer(function (req, res) {
    stand.heard.push({ url: req.url, headers: req.headers });
    const u = new URL(req.url, 'http://x');
    let status = 404; let body = '';
    if (u.pathname === '/v1/models' && req.headers['x-api-key']) {
      status = 200; body = { data: stand.anthropic.map(function (m) { return { type: 'model', id: m[0], display_name: m[1] }; }), has_more: false };
    } else if (u.pathname === '/v1/models') {
      status = stand.fail ? 500 : 200; body = stand.fail ? { error: 'down' } : { object: 'list', data: stand.openai.map(function (id) { return { id: id, object: 'model' }; }) };
    }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const host = 'http://127.0.0.1:' + server.address().port;
  const modelsOf = function (pid) { return db.prepare('SELECT * FROM "model" WHERE providerId = ? ORDER BY modelName').all(pid); };
  const names = function (pid) { return modelsOf(pid).map(function (m) { return m.modelName; }); };
  const usable = function (id) { try { return db.prepare('SELECT unusable FROM "provider" WHERE id = ?').get(id).unusable; } catch (e) { return 'no column: ' + e.message; } };

  call(t.verb, { op: 'delete', id: added.id });
  const anth = call(t.verb, { op: 'add', label: 'Anthropic', url: host, apiKey: SECRET });
  ok((await ask({ op: 'ask', id: require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey })).refusal === 'no-such-row', 'ask of a row that is not there is refused no-such-row', 'ask answered');
  stand.anthropic = [['claude-a', 'Claude A'], ['claude-b', 'Claude B']];
  published.length = 0;
  const first = await ask({ op: 'ask', id: anth.id });
  ok(stand.heard.length >= 1 && stand.heard[0].headers['x-api-key'] === SECRET, 'a row labelled Anthropic asks through the Anthropic plugin, with its key', 'heard: ' + short(stand.heard.map(function (x) { return x.url; })));
  ok(first && Array.isArray(first.models) && JSON.stringify(first.models) === JSON.stringify([{ modelName: 'claude-a', label: 'Claude A' }, { modelName: 'claude-b', label: 'Claude B' }]) && first.updated === true,
    'it answers the provider\'s list, { models: [{ modelName, label }], updated: true }', 'answer: ' + short(first));
  const mA = modelsOf(anth.id);
  ok(JSON.stringify(names(anth.id)) === '["claude-a","claude-b"]' && mA.every(function (m) { return m.label === (m.modelName === 'claude-a' ? 'Claude A' : 'Claude B'); }),
    'each model not yet in the table is added, for that provider, its label the provider\'s name of it', 'models: ' + short(mA.map(function (m) { return [m.modelName, m.label]; })));
  ok(published.filter(function (p) { return p.agent && p.agent.table === 'model' && p.agent.row; }).length === 2, 'and each new model row is published, so the lists follow', 'published: ' + short(published.map(function (p) { return p.agent && p.agent.table; })));

  stand.heard.length = 0;
  call(t.verb, { op: 'set', id: anth.id, label: 'ANTHROPIC' });
  await ask({ op: 'ask', id: anth.id });
  ok(stand.heard.length >= 1 && stand.heard[0].headers['x-api-key'] === SECRET, 'the plugin is matched to the label in any case: ANTHROPIC is Anthropic', 'heard: ' + short(stand.heard.map(function (x) { return Object.keys(x.headers); })));

  test.subHeading('ask updates: new models added, gone ones removed, his own words kept');
  // With no claude-b from the first ask, one stands in for it, so what follows still tries the update.
  const keep = modelsOf(anth.id).filter(function (m) { return m.modelName === 'claude-b'; })[0] ||
    ctx.tables.model.verb.handler({ op: 'add', providerId: anth.id, modelName: 'claude-b', label: 'Claude B' });
  ctx.tables.model.verb.handler({ op: 'set', id: keep.id, label: 'My B', description: 'mine' });
  const openaiRow = call(t.verb, { op: 'add', label: 'OpenAI', url: host + '/v1', apiKey: 'sk-other' });
  const otherModel = ctx.tables.model.verb.handler({ op: 'add', providerId: openaiRow.id, modelName: 'gpt-kept', label: 'Kept' });
  stand.anthropic = [['claude-b', 'Claude B'], ['claude-c', 'Claude C']];
  published.length = 0;
  await ask({ op: 'ask', id: anth.id });
  const after = modelsOf(anth.id);
  const b = after.filter(function (m) { return m.modelName === 'claude-b'; })[0];
  ok(JSON.stringify(names(anth.id)) === '["claude-b","claude-c"]', 'a model the provider no longer lists is removed; a new one is added', 'models: ' + short(names(anth.id)));
  ok(b && b.id === keep.id && b.label === 'My B' && b.description === 'mine', 'a model it still lists keeps its row, its label and description as he set them', 'claude-b: ' + short(b && { id: b.id === keep.id, label: b.label, description: b.description }));
  ok(published.some(function (p) { return p.agent && p.agent.table === 'model' && p.agent.removed === true; }), 'the removed model is published removed', 'published: ' + short(published));
  ok(names(openaiRow.id).indexOf('gpt-kept') !== -1 && ctx.tables.model.has(otherModel.id), 'another provider\'s models are not touched', 'other provider: ' + short(names(openaiRow.id)));

  test.subHeading('an empty list changes nothing');
  stand.anthropic = [];
  const before = JSON.stringify(modelsOf(anth.id));
  const none = await ask({ op: 'ask', id: anth.id });
  ok(none && Array.isArray(none.models) && none.models.length === 0 && none.updated === false && JSON.stringify(modelsOf(anth.id)) === before,
    'a provider answering no models: { models: [], updated: false }, and the model table is as it was', 'answer ' + short(none) + ', models ' + short(names(anth.id)));

  test.subHeading('no plugin for the label: the OpenAI plugin; it failing flags the row unusable');
  // One url, one row: the OpenAI row of the last part goes, so the Unsloth row may take the stand-in's /v1.
  call(t.verb, { op: 'delete', id: openaiRow.id });
  const unsloth = call(t.verb, { op: 'add', label: 'Unsloth', url: host + '/v1/' });
  stand.openai = ['qwen-local', 'llama-local'];
  stand.heard.length = 0;
  const local = await ask({ op: 'ask', id: unsloth.id });
  ok(stand.heard.length === 1 && !stand.heard[0].headers['x-api-key'] && new URL(stand.heard[0].url, 'http://x').pathname === '/v1/models', 'a row no plugin matches (Unsloth) asks as the OpenAI plugin does, GET <url>/models', 'heard: ' + short(stand.heard));
  ok(local && local.updated === true && JSON.stringify(names(unsloth.id)) === '["llama-local","qwen-local"]', 'and its models are added', 'answer ' + short(local) + ', models ' + short(names(unsloth.id)));
  stand.fail = true;
  const keptLocal = JSON.stringify(modelsOf(unsloth.id));
  stand.heard.length = 0;
  const failed = await ask({ op: 'ask', id: unsloth.id });
  ok(failed && failed.refusal !== undefined && stand.heard.length === 1, 'a provider that fails, once asked, is refused', 'answer ' + short(failed) + ', asked ' + stand.heard.length);
  ok(usable(unsloth.id) === 1 && call(t.verb, { op: 'get', id: unsloth.id }).unusable === true, 'and the provider row is flagged unusable, kept on the row and shown', 'unusable: ' + short(call(t.verb, { op: 'get', id: unsloth.id })));
  ok(JSON.stringify(modelsOf(unsloth.id)) === keptLocal, 'a failed ask removes nothing', 'models: ' + short(names(unsloth.id)));
  stand.fail = false;
  await ask({ op: 'ask', id: unsloth.id });
  ok(usable(unsloth.id) === 0, 'an ask that is answered again clears the flag', 'unusable: ' + usable(unsloth.id));
  ok(JSON.stringify([first, local, failed, published]).indexOf(SECRET) === -1, 'no answer of ask, and no row it publishes, carries the API key', 'the key left the process');
  await new Promise(function (r) { server.close(r); });

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
