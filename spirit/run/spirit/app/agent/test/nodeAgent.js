'use strict';

// spirit/run/spirit/app/agent/test/nodeAgent.js
// The tests of spirit/app/agent/nodeAgent.js, the agent server, and of no other module (spec: ./nodeAgent.md; goal/G41.1).
// The server is started as the node starts it, through agent.js, on a pipe of the test's own and a scratch --state
// folder, and asked through the pipe. It is
// started without a job id, so what it publishes reaches no node. One test.run per test (goal/G47.2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

const DIR = path.join(__dirname, '..');
const SERVER = path.join(DIR, 'agent.js');
// The server's own code: agent.js only loads it in a node (goal/G43.13).
const CODE = path.join(DIR, 'nodeAgent.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

// What the tests make, for the tests after them.
const X = { family: null, scratch: '', state: '', pipe: '', client: null, kid: null, up: false, db: '' };
const NOT_UP = 'the agent server did not answer: the world failed';
const API = path.join(DIR, 'api.js');
const ask = function (verb, args) { const q = {}; q[verb] = args; return X.client.ask({ agent: q }, { owner: true, key: 'MCowBQYDK2VwAyEAagentTestOwnerAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
const stop = function () { return new Promise(function (r) { const kid = X.kid; X.kid = null; if (!kid || kid.exitCode !== null) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); };
test.after(async function () {
  await stop();
  try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
});

// ── its files ──
test.run('its manifest says a server the node runs, in the new shape', 0.2, function () {
  if (!fs.existsSync(SERVER)) return 'spirit/app/agent/agent.js is not there';
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  return manifest.node && manifest.node.mount === true && !('kind' in manifest) && !('operated' in manifest) ? true : 'agent.json: ' + short(manifest);
}, test.limit.quick);
// Its family is at its top, beside agent.js, as spirit/<family>/ has it (goal/G43.27), each verb with its <verb>.json.
// goal/G43.15, the box: "The agent's own debug verb and its config.json go. Its switch is serverDEBUG, like any server's."
test.run('its interface declares no debug verb of its own', 0.2, function () {
  try { X.family = require(API); } catch (e) { X.family = null; }
  const family = X.family;
  return !!family && !!family.verbs && !('debug' in family.verbs) ? true : path.relative(RUN, API) + ': ' + short(family && family.verbs);
}, test.limit.quick);
test.run('and debug.json is gone', 0.2, function () {
  return !fs.existsSync(path.join(path.dirname(API), 'debug.json')) ? true : 'debug.json is still there';
}, test.limit.quick);
test.run('no ./api/ folder is left (goal/G43.27)', 0.2, function () {
  return !fs.existsSync(path.join(DIR, 'api')) ? true : 'the agent app still keeps an api folder';
}, test.limit.quick);
test.run('each of its verbs has its <verb>.json with a description', 0.2, function () {
  const family = X.family;
  const verbFiles = Object.keys((family && family.verbs) || {}).filter(function (v) { const j = readJson(path.join(DIR, v + '.json')); return j && typeof j.description === 'string' && j.description.length > 0; });
  return !!family && verbFiles.length === Object.keys(family.verbs).length ? true : 'verb files with a description: ' + verbFiles.join(', ') + ' of ' + short(Object.keys((family && family.verbs) || {}));
}, test.limit.quick);

// ── it starts on the node's pipe and its --state folder ──
test.run('it starts and answers on its pipe', 0.2, async function () {
  if (!fs.existsSync(SERVER)) return 'spirit/app/agent/agent.js is not there';
  const scratch = X.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agent-'));
  const state = X.state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  // An agent.db from before goal/G41.21, its grant table holding a row: "its rows in agent.db are dropped" at start.
  {
    const { DatabaseSync } = require('node:sqlite');
    const old = new DatabaseSync(path.join(state, 'agent.db'));
    old.exec('CREATE TABLE "grant" (job_id TEXT NOT NULL, path TEXT NOT NULL, PRIMARY KEY (job_id, path))');
    old.prepare('INSERT INTO "grant" (job_id, path) VALUES (?, ?)').run('KOLD', 'fs.search');
    old.close();
  }
  const pipe = X.pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'agent', 'win32', 'process') : path.join(scratch, 'door.sock');
  X.client = appClient.createAppClient({ rootDir: scratch });
  X.client.register('agent', pipe);
  const env = Object.assign({}, process.env); delete env.SPIRIT_JOB_ID;
  const kid = X.kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: env });
  let said = ''; kid.stderr.on('data', function (c) { said = (said + c).slice(-2000); });
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const r = await ask('DEBUG', {});
    if (r.status === 200 && r.body && r.body.ok !== false) { X.up = true; break; }
  }
  X.db = path.join(state, 'agent.db');
  return X.up ? true : 'it did not answer: ' + short(said);
}, test.limit.quick);
test.run('agent.db is created in its --state folder, an SQLite database', 0.2, function () {
  if (!X.up) return NOT_UP;
  const head = fs.existsSync(X.db) ? fs.readFileSync(X.db).subarray(0, 16).toString('latin1') : '';
  return head === 'SQLite format 3\u0000' ? true : 'agent.db: ' + (head ? JSON.stringify(head) : 'not there');
}, test.limit.quick);
// goal/G43.15: its DEBUG is appServer's own, as every server's; no debug verb and no config.json of its own.
// ── the box: "The agent's own debug verb and its config.json go" ──
test.run('a debug {on} of its own is no verb any more', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const own = await ask('debug', { on: true });
  return !(own.status === 200 && own.body && own.body.ok !== false) ? true : 'debug {on: true}: ' + short(own.body || own);
}, test.limit.quick);
test.run('appServer\'s DEBUG switches it, as for any server', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const d1 = await ask('DEBUG', { on: true });
  return d1.status === 200 && d1.body && d1.body.debug === true ? true : 'DEBUG {on: true}: ' + short(d1.body || d1);
}, test.limit.quick);
test.run('and no config.json is written in its --state folder', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const verdict = !fs.existsSync(path.join(X.state, 'config.json')) ? true : 'config.json: ' + short(readJson(path.join(X.state, 'config.json')));
  await ask('DEBUG', { on: false });
  return verdict;
}, test.limit.quick);

// ── goal/G41.4: THE DATA SET OF agent.db (box v22) ─────────────────────────────────────────────────────────────────
// Andy: "a provider table ... a model table ... a persona table ... a job table ... an grant/auth table, keyed by
// job-ID, structured exactly like the auth table in node"; each "keyed by ID same as the shadow-roll".
// goal/G41.21 (box v17): "agent.grant is removed altogether"; the provider gains model, the job bundle, provider and
// persona.
// ── goal/G41.4, G41.21: agent.db holds the four tables, each with its fields, and no grant table ──
const { DatabaseSync } = require('node:sqlite');
const T = { look: null, tables: [] };
const tableOf = function (name) { return T.tables.filter(function (t) { return new RegExp('^' + name + 's?$', 'i').test(t); })[0] || ''; };
const colsOf = function (t) { return t ? T.look.prepare('PRAGMA table_info(' + JSON.stringify(t) + ')').all() : []; };
// The columns, as cw named them for the build: camelCase as the shadow-roll is, every table's id the public key and
// the rest of its key set beside it.
// goal/G41.21, Andy: "ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS.", "ALL, from all agent-tables I mean...".
const KEYSET = [/^id$/, /^privateKey$/, /^sealPublicKey$/, /^sealPrivateKey$/, /^label$/];
const WANT = {
  provider: KEYSET.concat([/^url$/, /^apiKey$/, /^model$/]),
  model: KEYSET.concat([/^providerId$/, /^capabilities$/]),
  // goal/G41.26, Andy, box: "agent.persona gains a provider field".
  persona: KEYSET.concat([/^persona$/, /^bundle$/, /^provider$/]),
  job: KEYSET.concat([/^loop$/, /^job$/, /^bundle$/, /^provider$/, /^persona$/]),
};
// One table at a time, each check its own plain title (goal/G45.6: a title has no value built into it).
function tableSays(name) {
  const t = tableOf(name);
  const cols = colsOf(t).map(function (c) { return c.name; });
  const missing = WANT[name].filter(function (re) { return !cols.some(function (c) { return re.test(c); }); });
  const pk = colsOf(t).filter(function (c) { return c.pk > 0; }).map(function (c) { return c.name; });
  return { has: !!t && !missing.length, hasSays: name + ': table ' + (t || 'none') + ', columns ' + short(cols) + ', missing ' + missing.map(String).join(', '),
    keyed: !!t && pk.length === 1 && /^id$/i.test(pk[0]), keyedSays: name + ': primary key ' + short(pk) };
}
const hasTable = function (name) { if (!T.look) return NOT_UP; const s = tableSays(name); return s.has ? true : s.hasSays; };
const keyedTable = function (name) { if (!T.look) return NOT_UP; const s = tableSays(name); return s.keyed ? true : s.keyedSays; };
test.run('no agent table has a description column', 0.2, function () {
  if (!X.up) return NOT_UP;
  T.look = new DatabaseSync(X.db, { readOnly: true });
  T.tables = T.look.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; });
  return Object.keys(WANT).every(function (name) { return colsOf(tableOf(name)).every(function (c) { return c.name !== 'description'; }); })
    ? true : 'columns: ' + short(Object.keys(WANT).map(function (n) { return [n, colsOf(tableOf(n)).map(function (c) { return c.name; })]; }));
}, test.limit.quick);
test.run('a provider table, with its keys, label, url, apiKey and model', 0.2, function () { return hasTable('provider'); }, test.limit.quick);
test.run('the provider table is keyed by its id alone', 0.2, function () { return keyedTable('provider'); }, test.limit.quick);
test.run('a model table, with its keys, label, providerId and capabilities', 0.2, function () { return hasTable('model'); }, test.limit.quick);
test.run('the model table is keyed by its id alone', 0.2, function () { return keyedTable('model'); }, test.limit.quick);
test.run('a persona table, with its keys, label, persona, bundle and provider', 0.2, function () { return hasTable('persona'); }, test.limit.quick);
test.run('the persona table is keyed by its id alone', 0.2, function () { return keyedTable('persona'); }, test.limit.quick);
test.run('a job table, with its keys, label, loop, job, bundle, provider and persona', 0.2, function () { return hasTable('job'); }, test.limit.quick);
test.run('the job table is keyed by its id alone', 0.2, function () { return keyedTable('job'); }, test.limit.quick);
// "its rows in agent.db are dropped": the grant table the scratch agent.db held before the start is gone.
test.run('agent.db has no grant table: a job\'s grant is its bundle (goal/G41.21)', 0.2, function () {
  if (!T.look) return NOT_UP;
  const grantT = tableOf('grant');
  T.look.close();
  return !grantT ? true : 'agent.db still has the table ' + grantT;
}, test.limit.quick);

// ── goal/G41.4, G41.21: one verb per table, in its family interface, each in its own folder; grant gone ──
const TABLES = ['provider', 'model', 'persona', 'job'];
const V = { verbs: {} };
test.run('its interface declares the four verbs, provider, model, persona and job, and no grant', 0.2, function () {
  let fam = null;
  try { delete require.cache[require.resolve(API)]; fam = require(API); } catch (e) { fam = null; }
  const verbs = V.verbs = (fam && fam.verbs) || {};
  return TABLES.every(function (t) { return verbs[t] && typeof verbs[t] === 'object'; }) && !('grant' in verbs) ? true : 'verbs: ' + short(Object.keys(verbs));
}, test.limit.quick);
// goal/G41.26: the persona's provider is declared as the job's is, a key the call may leave out.
test.run('the persona verb takes a provider, declared as the job\'s', 0.2, function () {
  const verbs = V.verbs;
  return verbs.persona && verbs.job && verbs.persona.provider === verbs.job.provider && /^key\??$/.test(String(verbs.persona.provider || '')) ? true : 'persona: ' + short(verbs.persona) + ', job.provider ' + short(verbs.job && verbs.job.provider);
}, test.limit.quick);
test.run('each table has its folder spirit/app/agent/table/<name>/ with server.js, elementTable.js and elementRow.js', 0.2, function () {
  const files = [];
  TABLES.forEach(function (t) { files.push(path.join('spirit', 'app', 'agent', 'table', t, 'server.js')); ['elementTable.js', 'elementRow.js'].forEach(function (f) { files.push(path.join('spirit', 'app', 'agent', 'element', 'table', t, f)); }); });
  const absent = files.filter(function (f) { return !fs.existsSync(path.join(RUN, f)); });
  return !absent.length ? true : absent.length + ' of 12 missing: ' + absent.join(', ');
}, test.limit.quick);
// goal/G41.21: "With it go its folder (spirit/app/agent/table/grant)".
test.run('the grant table\'s folder spirit/app/agent/table/grant is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'grant')) ? true : 'spirit/app/agent/table/grant is still there';
}, test.limit.quick);
test.run('the server serves each of the four verbs', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const served = (await ask('DEBUG', {})).status === 200;
  const answers = {};
  for (const t of TABLES) answers[t] = await ask(t, {});
  return served && TABLES.every(function (t) { return !(answers[t].body && answers[t].body.code === 'no-such-verb') && !/no.such.verb|unknown verb/i.test(short(answers[t])); }) ? true : 'answers: ' + short(answers);
}, test.limit.quick);

// The verb's shape, as cw named it for the build: flat, as every family verb is, <table> {op, ...fields}, op one of
// add (answers the new id), set, delete, get (the row without its secrets, apiKeySet in place of the key) and search.
// ── goal/G41.4: add makes a row with its key set; set changes it; delete removes it ──
const API_KEY = 'sk-test-' + 'a'.repeat(24);
// The shadow-roll's kind of ID: an ed25519 public key, SPKI DER in base64 (spirit/relayAuth.js generateIdentity).
const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
const R = { added: null, pid: '', look2: null, pT: '', secrets: [API_KEY], jid: '', personaId: '' };
const leaks = function (r) { const t = JSON.stringify(r || {}); return R.secrets.filter(function (x) { return x && t.indexOf(x) !== -1; }).length; };
const NO_PID = 'no provider row: the add was refused';
test.run('provider {op: add} answers the new row\'s id, an ed25519 public key as the shadow-roll keys a row', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const added = R.added = await ask('provider', { op: 'add', icon: '🏢', label: 'A provider', url: 'https://api.example.test/v1', apiKey: API_KEY });
  R.pid = added.body && added.body.id;
  R.look2 = new DatabaseSync(X.db, { readOnly: true });
  T.tables = R.look2.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; });
  R.pT = tableOf('provider');
  return added.status === 200 && isKey(R.pid) ? true : 'answer: ' + short(added.body || added);
}, test.limit.quick);
const rowOf = function (t, id) { return t && isKey(id) ? R.look2.prepare('SELECT * FROM ' + JSON.stringify(t) + ' WHERE id = ?').get(id) : null; };
test.run('the row holds its fields, its API key, and the private halves of its key set (box: "the rest of the key-set stored on that table row")', 0.2, function () {
  if (!R.look2) return NOT_UP;
  const row = rowOf(R.pT, R.pid);
  const privates = row ? ['privateKey', 'sealPrivateKey'].filter(function (k) { return row[k]; }) : [];
  // Andy: API_KEY "will never reach the browser or any place outside of the agent process"; "The private halves of that
  // set stay in the agent process".
  R.secrets = [API_KEY].concat(privates.map(function (k) { return String(row[k]); }));
  return !!row && row.label === 'A provider' && row.url === 'https://api.example.test/v1' && row.apiKey === API_KEY && !!row.privateKey && !!row.sealPrivateKey && !!row.sealPublicKey
    ? true : 'row: ' + short(row && Object.keys(row)) + ', private columns ' + short(privates);
}, test.limit.quick);
// A secret in an answer leaves the agent process.
test.run('the add\'s answer carries no API key and no private key', 0.8, function () {
  if (!R.added) return NOT_UP;
  return isKey(R.pid) && leaks(R.added) === 0 ? true : 'secrets in the answer: ' + leaks(R.added);
}, test.limit.quick);
test.run('provider {set} changes the field it names, keeps the rest, and answers no secret', 0.8, async function () {
  if (!isKey(R.pid)) return NO_PID;
  const changed = await ask('provider', { op: 'set', id: R.pid, label: 'A provider, renamed' });
  const row2 = rowOf(R.pT, R.pid);
  return changed.status === 200 && !!row2 && row2.label === 'A provider, renamed' && row2.apiKey === API_KEY && leaks(changed) === 0 ? true : 'answer ' + short(changed.body || changed) + ', label ' + short(row2 && row2.label);
}, test.limit.quick);
test.run('model {add} keys its own row, naming its provider by the provider\'s id', 0.2, async function () {
  if (!isKey(R.pid)) return NO_PID;
  const modelAdd = await ask('model', { op: 'add', label: 'test-model-1', providerId: R.pid, capabilities: ['text'] });
  const mid = modelAdd.body && modelAdd.body.id;
  const mrow = rowOf(tableOf('model'), mid);
  return isKey(mid) && mid !== R.pid && !!mrow && mrow.providerId === R.pid && mrow.label === 'test-model-1' && !('modelName' in mrow) ? true : 'answer ' + short(modelAdd.body || modelAdd) + ', row ' + short(mrow);
}, test.limit.quick);
test.run('job {add} and persona {add} each answer a key of their own', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const jobAdd = await ask('job', { op: 'add', icon: '📋', label: 'Code review', loop: true, job: 'Review the diff.' });
  R.jid = jobAdd.body && jobAdd.body.id;
  const personaAdd = await ask('persona', { op: 'add', icon: '🎭', label: 'A reviewer', persona: 'You review code.' });
  R.personaId = personaAdd.body && personaAdd.body.id;
  return isKey(R.jid) && isKey(R.personaId) ? true : 'job ' + short(jobAdd.body || jobAdd) + ', persona ' + short(personaAdd.body || personaAdd);
}, test.limit.quick);
// goal/G41.21: a job's grant is its bundle, and it names its provider and its persona; no grant verb is asked.
test.run('job {op: set, bundle, provider, persona} keeps the job\'s bundle, its provider and its persona', 0.2, async function () {
  if (!isKey(R.jid)) return 'no job row: the add was refused';
  const jSet = await ask('job', { op: 'set', id: R.jid, bundle: '7', provider: R.pid, persona: R.personaId });
  const jrow = rowOf(tableOf('job'), R.jid);
  return jSet.status === 200 && jrow && String(jrow.bundle) === '7' && jrow.provider === R.pid && jrow.persona === R.personaId ? true : 'answer ' + short(jSet.body || jSet) + ', row ' + short(jrow);
}, test.limit.quick);
test.run('provider {op: get} answers the row without its secrets, apiKeySet true in place of the key', 0.8, async function () {
  if (!isKey(R.pid)) return NO_PID;
  const got = await ask('provider', { op: 'get', id: R.pid });
  return got.status === 200 && got.body && got.body.label === 'A provider, renamed' && got.body.apiKeySet === true && leaks(got) === 0 && !('apiKey' in got.body) && !('privateKey' in got.body) && !('sealPrivateKey' in got.body)
    ? true : 'answer: ' + short(got.body || got);
}, test.limit.quick);
test.run('provider {op: search} answers items and more, as every search does, the row among them, no secret', 0.8, async function () {
  if (!isKey(R.pid)) return NO_PID;
  const found = await ask('provider', { op: 'search', text: 'renamed' });
  return found.status === 200 && found.body && Array.isArray(found.body.items) && typeof found.body.more === 'boolean' && found.body.items.some(function (i) { return i && i.key === R.pid; }) && leaks(found) === 0
    ? true : 'answer: ' + short(found.body || found);
}, test.limit.quick);
test.run('provider {delete} removes its row', 0.2, async function () {
  if (!isKey(R.pid)) return NO_PID;
  const gone = await ask('provider', { op: 'delete', id: R.pid });
  const row3 = rowOf(R.pT, R.pid);
  return gone.status === 200 && isKey(R.pid) && !row3 ? true : 'answer ' + short(gone.body || gone) + ', row left ' + !!row3;
}, test.limit.quick);
test.run('any other action of the verb is refused', 0.2, async function () {
  if (!X.up) return NOT_UP;
  const junk = await ask('provider', { op: 'fly' });
  if (R.look2) R.look2.close();
  return V.verbs.provider && !(junk.body && junk.body.code === 'no-such-verb') && !(junk.status === 200 && junk.body && junk.body.ok !== false) ? true : 'provider {op: fly}: ' + short(junk.body || junk);
}, test.limit.quick);
// What the server publishes carries no secret: read in its code, since a test server's stream reaches no node.
test.run('the table servers publish their rows to the stream', 0.2, async function () {
  const srvCode = TABLES.map(function (t) { try { return fs.readFileSync(path.join(RUN, 'spirit', 'app', 'agent', 'table', t, 'server.js'), 'utf8'); } catch (e) { return ''; } }).filter(Boolean).join('\n');
  await stop();
  return srvCode.length > 0 && /publish\(/.test(srvCode + fs.readFileSync(CODE, 'utf8')) ? true : 'no publish in the table servers';
}, test.limit.quick);

// ── it streams its state ──
const code = function () { return fs.readFileSync(CODE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); };
test.run('it serves with a publisher whose bootstrap hands a subscriber its state', 0.2, function () {
  const c = code();
  return (/serve\([^]*publisher\s*:/).test(c) && /bootstrap/.test(c) ? true : 'no publisher with a bootstrap in agent.js';
}, test.limit.quick);
// goal/G43.32: what the publisher serves, its api.js declares (Andy: "for now, it needs to declare them in api.js").
test.run('its api.js declares subscribe and unsubscribe, which the publisher serves', 0.2, function () {
  const declared = require(path.join(RUN, 'spirit', 'app', 'agent', 'api.js')).verbs || {};
  return !!declared.subscribe && !!declared.unsubscribe ? true : 'agent\'s api.js declares ' + Object.keys(declared).join(', ');
}, test.limit.quick);
test.run('there is no read verb: the page reads the state from the stream', 0.2, function () {
  return !/['"]state['"]\s*:\s*\{|\bstate\s*:\s*\{\s*request/.test(code()) ? true : 'agent.js serves a state verb';
}, test.limit.quick);
