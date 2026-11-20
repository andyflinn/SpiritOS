'use strict';

// spirit/run/spirit/app/agent/table/provider/test/server.js
// The tests of spirit/app/agent/table/provider/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4, goal/G41.18). What the tables share is tested in ../../test/. The server is made on
// a scratch agent.db as nodeAgent.js makes it, with the model table beside it for ask, and the provider ask reaches is a
// stand-in on 127.0.0.1; the plugins themselves are tested in ../../../provider/. The page files run in node on a window
// of their own, the shared elements stubs that keep what they were handed. One test.run per test (goal/G47.2).

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/agent/table/provider/test/server/' + name + tempAsked); }
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/agent/table/provider/test/server'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const { DatabaseSync } = require('node:sqlite');

const TABLE = 'provider';
const DIR = path.join(__dirname, '..');
// Its list and editor are the agent app's elements, in spirit/app/agent/element/table/provider/ since goal/G43.32 (rule 5).
const EL = path.join(__dirname, '..', '..', '..', 'element', 'table', 'provider');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || true, why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const SECRET = 'sk-provider-test-0123456789';

// What the tests make, for the tests after them.
const X = { scratch: '', db: null, ctx: null, t: null, published: [], cols: [], added: null, got: null, other: null };
const count = function () { return X.db.prepare('SELECT COUNT(*) AS n FROM "provider"').get().n; };
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its files ──
test.run('it has server.js, and elementTable.js and elementRow.js in the app\'s element folder', 0.2, function () {
  const files = [path.join(DIR, 'server.js'), path.join(EL, 'elementTable.js'), path.join(EL, 'elementRow.js')];
  return files.every(function (f) { return fs.existsSync(f); }) ? true : false;
}, test.limit.quick);

// ── server.js: the table in agent.db ──
test.run('server.js, handed its context, answers the table, its verb and its has', 0.2, function () {
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return false;
  X.scratch = ownTemp('spirit-provider');
  const db = X.db = new DatabaseSync(path.join(X.scratch, 'agent.db'));
  const ctx = X.ctx = { db: db, dbFile: path.join(X.scratch, 'agent.db'), tables: {}, publish: function (x) { X.published.push(x); } };
  const t = X.t = ctx.tables.provider = require(path.join(DIR, 'server.js'))(ctx);
  X.cols = db.prepare('PRAGMA table_info("provider")').all().map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' ? true : false;
}, test.limit.quick);
// Andy, box v22: "with Label and Description, URL, and API_KEY"; goal/G41.18, box v17: "if it fails, the provider row
// will be flagged as unusable".
// goal/G41.21 (box v17): "The provider table gains a field, model: the id of one row of the model table".
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.cols.indexOf(c) !== -1 ? true : false; };
test.run('the provider table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the provider table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the provider table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the provider table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the provider table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the provider table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the provider table has an url column', 0.2, function () { return has('url'); }, test.limit.quick);
test.run('the provider table has an apiKey column', 0.2, function () { return has('apiKey'); }, test.limit.quick);
test.run('the provider table has an unusable column', 0.2, function () { return has('unusable'); }, test.limit.quick);
test.run('the provider table has a model column', 0.2, function () { return has('model'); }, test.limit.quick);
test.run('the provider table has no column but these ten', 0.2, function () { return X.cols.length === 10 ? true : false; }, test.limit.quick);

// ── server.js: the API key never leaves the agent process ──
test.run('the API key is kept on the row', 0.2, function () {
  if (!X.t) return false;
  X.added = call(X.t.verb, { op: 'add', icon: '🏢', label: 'Anthropic', url: 'https://api.anthropic.com', apiKey: SECRET });
  const raw = X.added.id ? X.db.prepare('SELECT apiKey FROM "provider" WHERE id = ?').get(X.added.id) : null;
  return raw && raw.apiKey === SECRET ? true : false;
}, test.limit.quick);
// The key in a get, a search or a published row would leak it to every page.
test.run('no get, search or published row carries it: only apiKeySet true', 0.8, function () {
  if (!X.added || !X.added.id) return false;
  const got = X.got = call(X.t.verb, { op: 'get', id: X.added.id });
  const seen = JSON.stringify([got, call(X.t.verb, { op: 'search', text: 'Anthropic' }), X.published]);
  return got && got.apiKeySet === true && !('apiKey' in got) && seen.indexOf(SECRET) === -1 ? true : false;
}, test.limit.quick);
test.run('its url and label are shown', 0.2, function () {
  const got = X.got;
  return got && got.url === 'https://api.anthropic.com' && got.label === 'Anthropic' ? true : false;
}, test.limit.quick);
test.run('a url that is not one is refused', 0.2, function () {
  if (!X.t) return false;
  return call(X.t.verb, { op: 'add', url: 'not a url' }).refusal === 'bad-request' ? true : false;
}, test.limit.quick);

// ── server.js: one provider row per url (goal/G41.18) ──
// Andy, box v17: "a new provider row will not be added if the URL is the same as an existing URL in the provider table,
// nor will a change be allowed if the change would result in duplicate URL's, trailing slashes don't count as
// different."
test.run('a new row with a url already in the table is refused, and nothing is added', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  const n0 = count();
  return call(X.t.verb, { op: 'add', icon: '🏢', label: 'Again', url: 'https://api.anthropic.com' }).refusal === 'bad-request' && count() === n0 ? true : false;
}, test.limit.quick);
test.run('a new row with the same url and a trailing slash is refused too', 0.2, function () {
  if (!X.added || !X.added.id) return false;
  const n0 = count();
  return call(X.t.verb, { op: 'add', icon: '🏢', label: 'Slash', url: 'https://api.anthropic.com/' }).refusal === 'bad-request' && count() === n0 ? true : false;
}, test.limit.quick);
test.run('a row with a url of its own is added', 0.2, function () {
  if (!X.t) return false;
  const n1 = count();
  X.other = call(X.t.verb, { op: 'add', icon: '🏢', label: 'Other', url: 'https://api.openai.com/v1' });
  return X.other.id && count() === n1 + 1 ? true : false;
}, test.limit.quick);
test.run('a change to another row\'s url is refused, the url kept', 0.2, function () {
  if (!X.other || !X.other.id) return false;
  const moved = call(X.t.verb, { op: 'set', id: X.other.id, url: 'https://api.anthropic.com/' });
  return moved.refusal === 'bad-request' && call(X.t.verb, { op: 'get', id: X.other.id }).url === 'https://api.openai.com/v1' ? true : false;
}, test.limit.quick);
test.run('a row may keep its own url, with or without the slash, and change its other fields', 0.2, function () {
  if (!X.other || !X.other.id) return false;
  const t = X.t, other = X.other;
  const verdict = !call(t.verb, { op: 'set', id: other.id, url: 'https://api.openai.com/v1/' }).refusal && !call(t.verb, { op: 'set', id: other.id, label: 'Renamed' }).refusal ? true : false;
  call(t.verb, { op: 'delete', id: other.id });
  return verdict;
}, test.limit.quick);

// ── server.js: no invalid provider row (goal/G41.21) ──
// Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"; "# mandatory fields (server AND ui) - provider: icon,
// label, valid URL".
const V = { before: 0, noUrl: null, noIcon: null, noLabel: null, whole: null };
test.run('an add without its url, its icon or its label, or with a label of blanks, is refused, and makes no row', 0.2, function () {
  if (!X.t) return false;
  const t = X.t;
  V.before = count();
  V.noUrl = call(t.verb, { op: 'add', icon: '🏢', label: 'No url' });
  V.noIcon = call(t.verb, { op: 'add', label: 'No icon', url: 'https://no-icon.example' });
  V.noLabel = call(t.verb, { op: 'add', icon: '🏢', url: 'https://no-label.example' });
  const blank = call(t.verb, { op: 'add', icon: '🏢', label: '   ', url: 'https://blank.example' });
  return [V.noUrl, V.noIcon, V.noLabel, blank].every(function (r) { return r.refusal && !r.id; }) && count() === V.before ? true : false;
}, test.limit.quick);
test.run('each refusal names the field missing', 0.2, function () {
  if (!V.noUrl) return false;
  return (/url/i).test(String(V.noUrl.why)) && /icon/i.test(String(V.noIcon.why)) && /label/i.test(String(V.noLabel.why)) ? true : false;
}, test.limit.quick);
test.run('with its icon, its label and a url, it is added', 0.2, function () {
  if (!X.t) return false;
  V.whole = call(X.t.verb, { op: 'add', icon: '🏢', label: 'Whole', url: 'https://whole.example' });
  return V.whole.id && count() === V.before + 1 ? true : false;
}, test.limit.quick);
test.run('a change that would empty its label or its url is refused, the row kept', 0.2, function () {
  if (!V.whole || !V.whole.id) return false;
  const t = X.t;
  const emptied = call(t.verb, { op: 'set', id: V.whole.id, label: '' });
  const unurled = call(t.verb, { op: 'set', id: V.whole.id, url: '' });
  const verdict = emptied.refusal && unurled.refusal && call(t.verb, { op: 'get', id: V.whole.id }).label === 'Whole' ? true : false;
  call(t.verb, { op: 'delete', id: V.whole.id });
  return verdict;
}, test.limit.quick);

// ── server.js: ask, a provider's models into the model table (goal/G41.18) ──
// Andy, box v17: "the provider table gets a new verb: \"ask\", which does the model-list fetching and model-table
// updating"; the plugin by the row's label, "case-insensitive", else the OpenAI plugin, "if it fails, the provider row
// will be flagged as unusable"; "Updated means, unavailable models from that provider will be removed, also"; "only if a
// provider answers with a list of more than 0 models, will the agent's model table be \"updated\"". The provider is a
// stand-in on 127.0.0.1 that answers as Anthropic does to x-api-key and as an OpenAI-compatible server does otherwise.
const A = { server: null, host: '', anth: null, first: null, openaiRow: null, otherModel: null, keep: null, unsloth: null, local: null, keptLocal: '', failed: null };
const stand = { heard: [], anthropic: [], openai: [], fail: false };
const ask = async function (a) { try { return await X.t.verb.handler(a); } catch (e) { return { refusal: e.refusal || true, why: (e.extra && e.extra.why) || e.message }; } };
const modelsOf = function (pid) { return X.db.prepare('SELECT * FROM "model" WHERE providerId = ? ORDER BY label').all(pid); };
const names = function (pid) { return modelsOf(pid).map(function (m) { return m.label; }); };
const usable = function (id) { try { return X.db.prepare('SELECT unusable FROM "provider" WHERE id = ?').get(id).unusable; } catch (e) { return null; } };
test.after(function () { if (A.server && A.server.listening) return new Promise(function (r) { A.server.close(r); }); });
test.run('ask of a row that is not there is refused no-such-row', 0.2, async function () {
  if (!X.t) return false;
  X.ctx.tables.model = require(path.join(DIR, '..', 'model', 'server.js'))(X.ctx);
  A.server = http.createServer(function (req, res) {
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
  await new Promise(function (r) { A.server.listen(0, '127.0.0.1', r); });
  A.host = 'http://127.0.0.1:' + A.server.address().port;
  if (X.added && X.added.id) call(X.t.verb, { op: 'delete', id: X.added.id });
  A.anth = call(X.t.verb, { op: 'add', icon: '🏢', label: 'Anthropic', url: A.host, apiKey: SECRET });
  return (await ask({ op: 'ask', id: require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey })).refusal === 'no-such-row' ? true : false;
}, test.limit.quick);
test.run('a row labelled Anthropic asks through the Anthropic plugin, with its key', 0.2, async function () {
  if (!A.anth || !A.anth.id) return false;
  stand.anthropic = [['claude-a', 'Claude A'], ['claude-b', 'Claude B']];
  X.published.length = 0;
  A.first = await ask({ op: 'ask', id: A.anth.id });
  return stand.heard.length >= 1 && stand.heard[0].headers['x-api-key'] === SECRET ? true : false;
}, test.limit.quick);
test.run('ask answers the provider\'s list of models, each with its model name and its label, and says it updated', 0.2, function () {
  const first = A.first;
  if (!first) return false;
  return first && Array.isArray(first.models) && JSON.stringify(first.models) === JSON.stringify([{ modelName: 'claude-a', label: 'Claude A' }, { modelName: 'claude-b', label: 'Claude B' }]) && first.updated === true
    ? true : false;
}, test.limit.quick);
// goal/G41.21: "the label hold the model name as provided by the provider": never its display name (Claude A).
test.run('each model not yet in the table is added, for that provider, its label the model name exactly as the provider gives it', 0.2, function () {
  if (!A.anth || !A.anth.id) return false;
  const mA = modelsOf(A.anth.id);
  return JSON.stringify(names(A.anth.id)) === '["claude-a","claude-b"]' && mA.every(function (m) { return !('modelName' in m); }) ? true : false;
}, test.limit.quick);
test.run('each new model row is published, so the lists follow', 0.2, function () {
  if (!A.first) return false;
  const published = X.published;
  return published.filter(function (p) { return p.agent && p.agent.table === 'model' && p.agent.row; }).length === 2 ? true : false;
}, test.limit.quick);
test.run('the plugin is matched to the label in any case: ANTHROPIC is Anthropic', 0.2, async function () {
  if (!A.anth || !A.anth.id) return false;
  stand.heard.length = 0;
  call(X.t.verb, { op: 'set', id: A.anth.id, label: 'ANTHROPIC' });
  await ask({ op: 'ask', id: A.anth.id });
  return stand.heard.length >= 1 && stand.heard[0].headers['x-api-key'] === SECRET ? true : false;
}, test.limit.quick);

// ── ask updates: new models added, gone ones removed, his own words kept ──
test.run('a model the provider no longer lists is removed; a new one is added', 0.2, async function () {
  if (!A.anth || !A.anth.id) return false;
  const ctx = X.ctx, anth = A.anth;
  // With no claude-b from the first ask, one stands in for it, so what follows still tries the update.
  A.keep = modelsOf(anth.id).filter(function (m) { return m.label === 'claude-b'; })[0] ||
    ctx.tables.model.verb.handler({ op: 'add', providerId: anth.id, label: 'claude-b' });
  ctx.tables.model.verb.handler({ op: 'set', id: A.keep.id, capabilities: JSON.stringify(['mine']) });
  A.openaiRow = call(X.t.verb, { op: 'add', icon: '🏢', label: 'OpenAI', url: A.host + '/v1', apiKey: 'sk-other' });
  A.otherModel = ctx.tables.model.verb.handler({ op: 'add', providerId: A.openaiRow.id, label: 'gpt-kept' });
  stand.anthropic = [['claude-b', 'Claude B'], ['claude-c', 'Claude C']];
  X.published.length = 0;
  await ask({ op: 'ask', id: anth.id });
  return JSON.stringify(names(anth.id)) === '["claude-b","claude-c"]' ? true : false;
}, test.limit.quick);
test.run('a model it still lists keeps its row, its label the model name, and what else it holds', 0.2, function () {
  if (!A.keep) return false;
  const b = modelsOf(A.anth.id).filter(function (m) { return m.label === 'claude-b'; })[0];
  return b && b.id === A.keep.id && b.label === 'claude-b' && b.capabilities === JSON.stringify(['mine']) ? true : false;
}, test.limit.quick);
test.run('the removed model is published removed', 0.2, function () {
  if (!A.keep) return false;
  return X.published.some(function (p) { return p.agent && p.agent.table === 'model' && p.agent.removed === true; }) ? true : false;
}, test.limit.quick);
test.run('another provider\'s models are not touched', 0.2, function () {
  if (!A.openaiRow) return false;
  return names(A.openaiRow.id).indexOf('gpt-kept') !== -1 && X.ctx.tables.model.has(A.otherModel.id) ? true : false;
}, test.limit.quick);

// ── an empty list changes nothing ──
test.run('a provider answering no models gets an empty list of models, not updated, and the model table is as it was', 0.2, async function () {
  if (!A.anth || !A.anth.id) return false;
  stand.anthropic = [];
  const before = JSON.stringify(modelsOf(A.anth.id));
  const none = await ask({ op: 'ask', id: A.anth.id });
  return none && Array.isArray(none.models) && none.models.length === 0 && none.updated === false && JSON.stringify(modelsOf(A.anth.id)) === before
    ? true : false;
}, test.limit.quick);

// ── no plugin for the label: the OpenAI plugin; it failing flags the row unusable ──
test.run('a row no plugin matches, Unsloth, asks as the OpenAI plugin does, a GET of the models path under its url', 0.2, async function () {
  if (!A.server) return false;
  // One url, one row: the OpenAI row of the last part goes, so the Unsloth row may take the stand-in's /v1.
  if (A.openaiRow) call(X.t.verb, { op: 'delete', id: A.openaiRow.id });
  A.unsloth = call(X.t.verb, { op: 'add', icon: '🏢', label: 'Unsloth', url: A.host + '/v1/' });
  stand.openai = ['qwen-local', 'llama-local'];
  stand.heard.length = 0;
  A.local = await ask({ op: 'ask', id: A.unsloth.id });
  return stand.heard.length === 1 && !stand.heard[0].headers['x-api-key'] && new URL(stand.heard[0].url, 'http://x').pathname === '/v1/models' ? true : false;
}, test.limit.quick);
test.run('the models of a row no plugin matches are added', 0.2, function () {
  if (!A.unsloth) return false;
  return A.local && A.local.updated === true && JSON.stringify(names(A.unsloth.id)) === '["llama-local","qwen-local"]' ? true : false;
}, test.limit.quick);
test.run('a provider that fails, once asked, is refused', 0.2, async function () {
  if (!A.unsloth) return false;
  stand.fail = true;
  A.keptLocal = JSON.stringify(modelsOf(A.unsloth.id));
  stand.heard.length = 0;
  A.failed = await ask({ op: 'ask', id: A.unsloth.id });
  return A.failed && A.failed.refusal !== undefined && stand.heard.length === 1 ? true : false;
}, test.limit.quick);
test.run('the provider row that failed is flagged unusable, the flag kept on the row and shown', 0.2, function () {
  if (!A.unsloth) return false;
  return usable(A.unsloth.id) === 1 && call(X.t.verb, { op: 'get', id: A.unsloth.id }).unusable === true ? true : false;
}, test.limit.quick);
test.run('a failed ask removes nothing', 0.2, function () {
  if (!A.unsloth) return false;
  return JSON.stringify(modelsOf(A.unsloth.id)) === A.keptLocal ? true : false;
}, test.limit.quick);
test.run('an ask that is answered again clears the flag', 0.2, async function () {
  if (!A.unsloth) return false;
  stand.fail = false;
  await ask({ op: 'ask', id: A.unsloth.id });
  return usable(A.unsloth.id) === 0 ? true : false;
}, test.limit.quick);
// The key in an answer or a published row would leak it to every page.
test.run('no answer of ask, and no row it publishes, carries the API key', 0.8, async function () {
  if (!A.server) return false;
  const verdict = JSON.stringify([A.first, A.local, A.failed, X.published]).indexOf(SECRET) === -1 ? true : false;
  await new Promise(function (r) { A.server.close(r); });
  return verdict;
}, test.limit.quick);

// ── server.js: a search answers what the list shows (goal/G41.18) ──
// Andy: "only the ID and the fields shown in a table, that's all it needs"; "that exactly what GET is for, to bring in
// the rest for detail panels etc...". The list shows a row by its icon and its label.
test.run('a search answers the id, the icon and the label of a row, nothing else', 0.2, function () {
  if (!X.t) return false;
  const t = X.t;
  const listedId = call(t.verb, { op: 'add', icon: '🧪', label: 'Listed one', url: 'https://listed.example' }).id;
  let listedRow = null;
  try { listedRow = (call(t.verb, { op: 'search', text: 'Listed one' }).items || []).map(function (i) { return JSON.parse(i.label); }).filter(function (r) { return r.id === listedId; })[0]; } catch (e) { listedRow = null; }
  call(t.verb, { op: 'delete', id: listedId });
  return listedRow && listedRow.icon === '🧪' && listedRow.label === 'Listed one' && JSON.stringify(Object.keys(listedRow).sort()) === '["icon","id","label"]' ? true : false;
}, test.limit.quick);

// A GRANTED PEER CANNOT STEAL THE MODEL KEYS (goal/G41.30, the review, RH4: "a peer granted the agent's remoteUser bundle
// can steal the model API keys"; its fix: "make provider add, set, delete and ask owner-only, and clear apiKey whenever
// url changes without a new key"; Andy, Q3: "yes."). The peer sets a provider's url to his own server, keeping apiKey,
// then asks: the stand-in on 127.0.0.1 is his server.
// ── server.js: a key never follows a changed url (goal/G41.30) ──
const KEY = 'sk-theirs-do-not-follow';
const K = { row: '', peers: null, heard: [] };
const keyOf = function (id) { const r = X.db.prepare('SELECT apiKey FROM "provider" WHERE id = ?').get(id); return r ? r.apiKey : undefined; };
test.after(function () { if (K.peers && K.peers.listening) return new Promise(function (r) { K.peers.close(r); }); });
test.run('a row keeps its key', 0.2, function () {
  if (!X.t) return false;
  K.row = call(X.t.verb, { op: 'add', icon: '🔑', label: 'Anthropic', url: 'https://steal.example', apiKey: KEY }).id;
  return keyOf(K.row) === KEY ? true : false;
}, test.limit.quick);
test.run('a set with no new url keeps the key', 0.2, function () {
  if (!K.row) return false;
  call(X.t.verb, { op: 'set', id: K.row, label: 'Anthropic' });
  return keyOf(K.row) === KEY ? true : false;
}, test.limit.quick);
test.run('a set of the same url keeps the key', 0.2, function () {
  if (!K.row) return false;
  call(X.t.verb, { op: 'set', id: K.row, url: 'https://steal.example' });
  return keyOf(K.row) === KEY ? true : false;
}, test.limit.quick);
test.run('the set of a new url is taken', 0.2, async function () {
  if (!K.row) return false;
  // The peer's own server.
  K.peers = http.createServer(function (req, res) { K.heard.push(req.headers); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"data":[],"has_more":false}'); });
  await new Promise(function (r) { K.peers.listen(0, '127.0.0.1', r); });
  const peerUrl = 'http://127.0.0.1:' + K.peers.address().port;
  const moved = call(X.t.verb, { op: 'set', id: K.row, url: peerUrl });
  return !moved.refusal ? true : false;
}, test.limit.quick);
// A key kept with a changed url goes to whoever owns the new url.
test.run('a set of a new url with no new key clears the key', 0.8, function () {
  if (!K.row) return false;
  return !keyOf(K.row) ? true : false;
}, test.limit.quick);
test.run('an ask after that set sends the new url and no old key', 0.8, async function () {
  if (!K.peers) return false;
  await ask({ op: 'ask', id: K.row });
  await new Promise(function (r) { K.peers.close(r); });
  const heard = K.heard;
  return heard.length > 0 && JSON.stringify(heard).indexOf(KEY) === -1 ? true : false;
}, test.limit.quick);
test.run('a set of a url and a new key keeps the new key', 0.2, function () {
  if (!K.row) return false;
  call(X.t.verb, { op: 'set', id: K.row, url: 'https://steal-other.example', apiKey: 'sk-new-one' });
  const verdict = keyOf(K.row) === 'sk-new-one' ? true : false;
  call(X.t.verb, { op: 'delete', id: K.row });
  return verdict;
}, test.limit.quick);

// ── the page: elementTable.js and elementRow.js ──
const P = { made: null, E: {}, list: null, o: null, r: null, AD: null, BRANCH: '' };
const detail = { open: function () {}, look: function (t2) { return { icon: '🏢', name: 'Provider', title: 'Model providers', table: t2 }; } };
const box = { innerHTML: '' };
test.run('the provider\'s elementTable and elementRow are placed on spirit.element by their path', 0.2, function () {
  const made = P.made = { tables: [], rows: [], required: [] };
  const STAND = {
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  };
  global.window = { spirit: {} };
  global.spirit = global.window.spirit;
  // goal/G43.32: the shared stand-ins stand where the page files read them, at spirit.element.<their path>.
  global.window.spirit.element = { spirit: { app: { agent: { element: { table: { tableElement: STAND.agentTable, row: STAND.agentRow } } } } } };
  // The agent family's api.js requires its companion data.js, as the real one does: the real file, run once; anything
  // else is a stand-in.
  const ran = {};
  global.window.spirit.require = function (p) {
    made.required.push(String(p));
    if (p === 'spirit/app/agent/api.js' && !ran[p]) { ran[p] = true; vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'agent', 'data.js'), 'utf8'), { filename: 'spirit/app/agent/data.js' }); }
    return Promise.resolve(true);
  };
  // goal/G43.32: the page's spirit.require answers the helper, so each file places itself by installSpiritElement as it
  // runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  // The page's one data set (spirit/data.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.node.key. A branch's
  // data.js comes with its api.js, and the stand-in require above runs the real file for it.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: HOME_KEY };
  global.window.spirit.data.homeNode(HOME_KEY);
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(EL, f), 'utf8'), { filename: path.join(EL, f) }); });
  const T = global.window.spirit.element.spirit.app.agent.element.table.provider || {};
  P.E = { providerTable: T.elementTable, providerRow: T.elementRow };
  return P.E.providerTable && typeof P.E.providerTable.create === 'function' && P.E.providerRow && typeof P.E.providerRow.create === 'function' ? true : false;
}, test.limit.quick);
test.run('elementTable.js requires the shared element and its own row element', 0.2, async function () {
  if (!P.E.providerTable || !P.E.providerRow) return false;
  P.list = P.E.providerTable.create(box, detail);
  await settle();
  const made = P.made;
  return made.required.indexOf('spirit/app/agent/element/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/element/table/provider/elementRow.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('it builds on agentTable, in its box, for the provider table, with the detail pane and no api, and the shared Add', 0.2, function () {
  if (!P.list) return false;
  const made = P.made;
  const o = P.o = made.tables[0] && made.tables[0].o;
  return made.tables.length === 1 && made.tables[0].c === box && o.table === 'provider' && !('api' in o) && o.detail === detail && !o.add ? true : false;
}, test.limit.quick);
test.run('its refresh and destroy are the shared element\'s', 0.2, function () {
  if (!P.list) return false;
  P.list.refresh(); P.list.destroy();
  return P.made.refreshed && P.made.destroyed ? true : false;
}, test.limit.quick);
test.run('a row it opens is a providerRow, built on agentRow, in the box it is handed, with its id and added, no api', 0.2, async function () {
  if (!P.o) return false;
  const made = P.made;
  const into = { innerHTML: '' };
  P.o.row(into, 'KP', true);
  await settle();
  const r = P.r = made.rows[0] && made.rows[0].o;
  return made.rows.length === 1 && made.rows[0].c === into && r.table === 'provider' && !('api' in r) && r.id === 'KP' && r.added === true ? true : false;
}, test.limit.quick);
// goal/G41.21: "# mandatory fields (server AND ui)": the row hands the shared editor its table's mandatory fields.
test.run('it hands the editor the provider table\'s mandatory fields: the icon, the label and the url', 0.2, function () {
  const r = P.r;
  return r && JSON.stringify(r.required) === JSON.stringify(['icon', 'label', 'url']) ? true : false;
}, test.limit.quick);
test.run('its title row has the provider table\'s look', 0.2, function () {
  const r = P.r;
  return r && r.look && r.look.icon === '🏢' && r.look.table === 'provider' ? true : false;
}, test.limit.quick);
// Andy, box v22: "with Label and Description, URL, and API_KEY"; the icon comes first of every editor (tableElement.js).
// goal/G41.21: "a Model field at the bottom. It is a pick field ... showing only the models whose provider is this
// provider": of names the picked table's field that must hold this row's id (../../tableElement.js).
test.run('the provider editor\'s fields in order: label, url, API key as a secret, and the model picked from this provider\'s models', 0.2, function () {
  const r = P.r;
  return r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '', f.of || '']; })) === JSON.stringify([['label', 'name', '', ''], ['url', 'url', '', ''], ['apiKey', 'secret', '', ''], ['model', 'pick', 'model', 'providerId']])
    ? true : false;
}, test.limit.quick);

// ── elementRow.js requires the agent family's api.js, whose data.js takes the provider table's rows from the stream (goal/G41.16, G41.28) ──
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
// means for this table, spirit/app/agent/table/data.js until G41.16, is the agent family's data.js's
// (spirit/app/agent/data.js, goal/G41.28), loaded with the row element; it files the rows under the
// node that served them, and is read through spirit.data.agent.data.
const job = function (agent, module) { return { id: 'job-agent', module: module || 'spirit.app.agent', data: {}, app: { agent: agent } }; };
test.run('its page files require the agent family\'s interface, spirit/app/agent/api.js', 0.2, function () {
  if (!P.made) return false;
  return P.made.required.indexOf('spirit/app/agent/api.js') !== -1 || false;
}, test.limit.quick);
test.run('its page files require no data script, as only an api.js requires its data.js', 0.2, function () {
  if (!P.made) return false;
  return !P.made.required.some(function (p) { return (/data\.js$/).test(p); }) ? true : false;
}, test.limit.quick);
test.run('the agent family\'s data.js is loaded with its api.js, and its provider branch is the home node\'s agent/provider path', 0.2, function () {
  if (!P.made) return false;
  const DATA = global.window.spirit.data;
  const AD = P.AD = ((global.window.spirit.data || {}).agent || {}).data;
  P.BRANCH = DATA.nodeId(HOME_KEY) + '/agent/provider';
  return !!AD && typeof AD.branch === 'function' && AD.branch('provider') === P.BRANCH ? true : false;
}, test.limit.quick);
test.run('a provider row on the stream lands under the node\'s agent/provider path at its id, and the branch\'s watcher hears it', 0.2, function () {
  if (!P.AD) return false;
  const DATA = global.window.spirit.data, AD = P.AD, BRANCH = P.BRANCH;
  const heard = [];
  const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
  DATA.takeJob(job({ table: 'provider', row: { id: 'KT', label: 'First', extra: 1 } }));
  off();
  return AD.row('provider', 'KT') && AD.row('provider', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1 ? true : false;
}, test.limit.quick);
test.run('a changed row is merged: what it names changes, what it does not stays', 0.2, function () {
  if (!P.AD) return false;
  const DATA = global.window.spirit.data, AD = P.AD;
  DATA.takeJob(job({ table: 'provider', row: { id: 'KT', label: 'Renamed' } }));
  return AD.row('provider', 'KT') && AD.row('provider', 'KT').label === 'Renamed' && AD.row('provider', 'KT').extra === 1 ? true : false;
}, test.limit.quick);
test.run('a row removed, by its id, is gone', 0.2, function () {
  if (!P.AD) return false;
  const DATA = global.window.spirit.data, AD = P.AD;
  DATA.takeJob(job({ table: 'provider', id: 'KT', removed: true }));
  return !AD.row('provider', 'KT') && !('KT' in DATA.branchAt(P.BRANCH)) ? true : false;
}, test.limit.quick);
test.run('another table\'s rows, another module\'s, and a row with no id write nothing here', 0.2, function () {
  if (!P.AD) return false;
  const DATA = global.window.spirit.data;
  const before = JSON.stringify(DATA.branchAt(P.BRANCH));
  DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
  DATA.takeJob(job({ table: 'provider', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
  DATA.takeJob(job({ table: 'provider', row: { label: 'no id' } }));
  return JSON.stringify(DATA.branchAt(P.BRANCH)) === before ? true : false;
}, test.limit.quick);

// ── THE MODEL PICKER IN A REAL BROWSER (goal/G41.21; Andy: "the model picker for anthropic simply shows: "Nothing
// matches.", no if the search field is empty or not", "make sure that the picker is filled, from the beginning, with the
// result of the default search (empty search input)", "wsl, make sure your tests actually checks if this thing works,
// get some damn DEBUG.js test to fucking assert that this shit is done right!"). The real provider and model servers on
// a scratch agent.db answer; ./server-picker.html draws the provider's detail with the real elements in Chrome, on a
// scratch node with its DEBUG on, and opens its Model field.
// ── /spirit/app/agent/table/provider/test/server-picker.html: the provider's Model field, opened ──
const ADDRESS = '/DEBUG/spirit/app/agent/table/provider/test/server-picker.html';
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const PK = { pdir: '', node: null, page: null, m: null, mine: [], theirs: '' };
test.after(function () {
  const page = PK.page, node = PK.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
  try { if (PK.pdir) fs.rmSync(PK.pdir, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('the page server-picker.html draws the provider\'s detail with the real elements in Chrome, on a scratch node with its DEBUG on', 0.2, async function () {
  PK.pdir = ownTemp('spirit-provider-picker');
  // The servers check their arguments through the one spirit object's rules, as in the agent process; the page section
  // above put a stand-in in its place.
  global.spirit.check = require(path.join(RUN, 'spirit', 'spirit.js')).check;
  const pdir = PK.pdir;
  const pctx = { db: new DatabaseSync(path.join(pdir, 'agent.db')), dbFile: path.join(pdir, 'agent.db'), tables: {}, publish: function () {} };
  pctx.tables.provider = require(path.join(DIR, 'server.js'))(pctx);
  pctx.tables.model = require(path.join(DIR, '..', 'model', 'server.js'))(pctx);
  const PV = pctx.tables.provider.verb;
  const M = pctx.tables.model.verb;
  const ANTH = call(PV, { op: 'add', icon: '🅰', label: 'Anthropic', url: 'https://anthropic.example' }).id;
  const OTHER = call(PV, { op: 'add', icon: '🅾', label: 'Other', url: 'https://other.example' }).id;
  const mine = PK.mine = ['claude-alpha', 'claude-beta'].map(function (n) { return call(M, { op: 'add', label: n, providerId: ANTH }).id; });
  PK.theirs = call(M, { op: 'add', label: 'other-gamma', providerId: OTHER }).id;
  // What the real tables answer, keyed by the call: the page's stand-in agent server hands these on as they are.
  const answers = { provider: ANTH };
  const keep = function (table, verb, args) { answers[table + ' ' + JSON.stringify(args)] = call(verb, args); };
  // The provider's current model is its first (goal/G41.21, Andy: "provider details: when the panel opens, pickers must
  // reflect the value or the row field (model)").
  call(PV, { op: 'set', id: ANTH, model: mine[0] });
  keep('provider', PV, { op: 'get', id: ANTH });
  keep('model', M, { op: 'get', id: mine[0] });
  [{ op: 'search', text: '' }, { op: 'search', text: '', providerId: ANTH }].forEach(function (a) { keep('model', M, a); });
  const chrome = H.findChrome();
  if (!chrome) return false;
  const node = PK.node = await H.scratchNode();
  if (!node.up || !node.debug) return false;
  const page = PK.page = await H.chromePage(chrome);
  if (page.error) return false;
  await page.send('Page.navigate', { url: node.base + ADDRESS });
  await H.until(function () { return page.evaluate('typeof window.picker === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await page.evaluate('window.picker(' + JSON.stringify(answers) + ')').catch(function () { return ''; });
  let m = null;
  try { m = JSON.parse(s); } catch (e) { m = null; }
  PK.m = m;
  return m ? true : false;
}, test.limit.slow);
test.run('the provider\'s detail shows its Model field, the provider having models', 0.2, function () {
  const m = PK.m;
  if (!m) return false;
  return m.label && m.shown ? true : false;
}, test.limit.quick);
test.run('as the panel opens, the Model field shows the provider\'s current model, claude-alpha', 0.2, function () {
  const m = PK.m;
  if (!m) return false;
  return (/claude-alpha/).test(m.fieldText) ? true : false;
}, test.limit.quick);
test.run('pressed, the Model field opens its dropdown', 0.2, function () {
  const m = PK.m;
  if (!m) return false;
  return m.field && m.popupOpen ? true : false;
}, test.limit.quick);
test.run('with the search empty, from the start, it lists this provider\'s two models and nothing else', 0.2, function () {
  const m = PK.m;
  if (!m) return false;
  const keys = m.rows.map(function (r) { return r.key; }).sort();
  return !m.nothing && JSON.stringify(keys) === JSON.stringify(PK.mine.slice().sort())
    ? true : false;
}, test.limit.quick);
test.run('each row says its model', 0.2, function () {
  const m = PK.m;
  if (!m) return false;
  return m.rows.length > 0 && m.rows.every(function (r) { return (/claude-(alpha|beta)/).test(r.text); }) ? true : false;
}, test.limit.quick);
