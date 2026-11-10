'use strict';

// spirit/run/spirit/app/agent/test/nodeAgent.js
// The tests of spirit/app/agent/nodeAgent.js, the agent server, and of no other module (spec: ./nodeAgent.md; goal/G41.1).
// The server is started as the node starts it, through agent.js, on a pipe of the test's own and a scratch --state
// folder, and asked through the pipe. It is
// started without a job id, so what it publishes reaches no node.

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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

test.startTest('agent.js: the agent server');

(async function () {
  test.subHeading('its files');
  if (!fs.existsSync(SERVER)) { test.fail('spirit/app/agent/agent.js is not there'); return; }
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  ok(manifest.node && manifest.node.mount === true && !('kind' in manifest) && !('operated' in manifest), 'its manifest says a server the node runs, in the new shape', 'agent.json: ' + short(manifest));
  // Its family is at its top, beside agent.js, as spirit/<family>/ has it (goal/G43.27), each verb with its <verb>.json.
  const API = path.join(DIR, 'api.js');
  let family = null;
  try { family = require(API); } catch (e) { family = null; }
  // goal/G43.15, the box: "The agent's own debug verb and its config.json go. Its switch is serverDEBUG, like any server's."
  ok(!!family && !!family.verbs && !('debug' in family.verbs), 'its interface declares no debug verb of its own', path.relative(RUN, API) + ': ' + short(family && family.verbs));
  ok(!fs.existsSync(path.join(path.dirname(API), 'debug.json')), 'and debug.json is gone', 'debug.json is still there');
  ok(!fs.existsSync(path.join(DIR, 'api')), 'no ./api/ folder is left (goal/G43.27)', 'the agent app still keeps an api folder');
  const verbFiles = Object.keys((family && family.verbs) || {}).filter(function (v) { const j = readJson(path.join(DIR, v + '.json')); return j && typeof j.description === 'string' && j.description.length > 0; });
  ok(!!family && verbFiles.length === Object.keys(family.verbs).length, 'each of its verbs has its <verb>.json with a description: ' + verbFiles.join(', '), 'verb files with a description: ' + verbFiles.join(', ') + ' of ' + short(Object.keys((family && family.verbs) || {})));

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agent-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  // An agent.db from before goal/G41.21, its grant table holding a row: "its rows in agent.db are dropped" at start.
  {
    const { DatabaseSync } = require('node:sqlite');
    const old = new DatabaseSync(path.join(state, 'agent.db'));
    old.exec('CREATE TABLE "grant" (job_id TEXT NOT NULL, path TEXT NOT NULL, PRIMARY KEY (job_id, path))');
    old.prepare('INSERT INTO "grant" (job_id, path) VALUES (?, ?)').run('KOLD', 'fs.search');
    old.close();
  }
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'agent', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('agent', pipe);
  const env = Object.assign({}, process.env); delete env.SPIRIT_JOB_ID;
  const ask = function (verb, args) { const q = {}; q[verb] = args; return client.ask({ agent: q }, { owner: true, key: 'MCowBQYDK2VwAyEAagentTestOwnerAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
  let kid = null;
  const start = async function () {
    kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: env });
    let said = ''; kid.stderr.on('data', function (c) { said = (said + c).slice(-2000); });
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      const r = await ask('DEBUG', {});
      if (r.status === 200 && r.body && r.body.ok !== false) return { up: true };
    }
    return { up: false, said: said };
  };
  const stop = function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); };

  try {
    test.subHeading('it starts on the node\'s pipe and its --state folder');
    const s1 = await start();
    ok(s1.up, 'it starts and answers on its pipe', 'it did not answer: ' + short(s1.said));
    if (!s1.up) return;
    const db = path.join(state, 'agent.db');
    const head = fs.existsSync(db) ? fs.readFileSync(db).subarray(0, 16).toString('latin1') : '';
    ok(head === 'SQLite format 3\u0000', 'agent.db is created in its --state folder, an SQLite database', 'agent.db: ' + (head ? JSON.stringify(head) : 'not there'));
    // goal/G43.15: its DEBUG is appServer's own, as every server's; no debug verb and no config.json of its own.
    test.subHeading('the box: "The agent\'s own debug verb and its config.json go"');
    const own = await ask('debug', { on: true });
    ok(!(own.status === 200 && own.body && own.body.ok !== false), 'a debug {on} of its own is no verb any more', 'debug {on: true}: ' + short(own.body || own));
    const d1 = await ask('DEBUG', { on: true });
    ok(d1.status === 200 && d1.body && d1.body.debug === true, 'appServer\'s DEBUG switches it, as for any server', 'DEBUG {on: true}: ' + short(d1.body || d1));
    ok(!fs.existsSync(path.join(state, 'config.json')), 'and no config.json is written in its --state folder', 'config.json: ' + short(readJson(path.join(state, 'config.json'))));
    await ask('DEBUG', { on: false });

    // ── goal/G41.4: THE DATA SET OF agent.db (box v22) ─────────────────────────────────────────────────────────────────
    // Andy: "a provider table ... a model table ... a persona table ... a job table ... an grant/auth table, keyed by
    // job-ID, structured exactly like the auth table in node"; each "keyed by ID same as the shadow-roll".
    // goal/G41.21 (box v17): "agent.grant is removed altogether"; the provider gains model, the job bundle, provider and
    // persona.
    test.subHeading('goal/G41.4, G41.21: agent.db holds the four tables, each with its fields, and no grant table');
    const { DatabaseSync } = require('node:sqlite');
    const look = new DatabaseSync(db, { readOnly: true });
    const tables = look.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; });
    const tableOf = function (name) { return tables.filter(function (t) { return new RegExp('^' + name + 's?$', 'i').test(t); })[0] || ''; };
    const colsOf = function (t) { return t ? look.prepare('PRAGMA table_info(' + JSON.stringify(t) + ')').all() : []; };
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
    ok(Object.keys(WANT).every(function (name) { return colsOf(tableOf(name)).every(function (c) { return c.name !== 'description'; }); }), 'no agent table has a description column', 'columns: ' + short(Object.keys(WANT).map(function (n) { return [n, colsOf(tableOf(n)).map(function (c) { return c.name; })]; })));
    Object.keys(WANT).forEach(function (name) {
      const t = tableOf(name);
      const cols = colsOf(t).map(function (c) { return c.name; });
      const missing = WANT[name].filter(function (re) { return !cols.some(function (c) { return re.test(c); }); });
      ok(!!t && !missing.length, 'a ' + name + ' table, with ' + WANT[name].map(String).join(', '), name + ': table ' + (t || 'none') + ', columns ' + short(cols) + ', missing ' + missing.map(String).join(', '));
      const pk = colsOf(t).filter(function (c) { return c.pk > 0; }).map(function (c) { return c.name; });
      ok(!!t && pk.length === 1 && /^id$/i.test(pk[0]), name + ' is keyed by its id alone', name + ': primary key ' + short(pk));
    });
    // "its rows in agent.db are dropped": the grant table the scratch agent.db held before the start is gone.
    const grantT = tableOf('grant');
    ok(!grantT, 'agent.db has no grant table: a job\'s grant is its bundle (goal/G41.21)', 'agent.db still has the table ' + grantT);
    look.close();

    test.subHeading('goal/G41.4, G41.21: one verb per table, in its family interface, each in its own folder; grant gone');
    const TABLES = ['provider', 'model', 'persona', 'job'];
    let fam = null;
    try { delete require.cache[require.resolve(API)]; fam = require(API); } catch (e) { fam = null; }
    const verbs = (fam && fam.verbs) || {};
    ok(TABLES.every(function (t) { return verbs[t] && typeof verbs[t] === 'object'; }) && !('grant' in verbs), 'its interface declares the four verbs, provider, model, persona and job, and no grant', 'verbs: ' + short(Object.keys(verbs)));
    // goal/G41.26: the persona's provider is declared as the job's is, a key the call may leave out.
    ok(verbs.persona && verbs.job && verbs.persona.provider === verbs.job.provider && /^key\??$/.test(String(verbs.persona.provider || '')), 'the persona verb takes a provider, declared as the job\'s', 'persona: ' + short(verbs.persona) + ', job.provider ' + short(verbs.job && verbs.job.provider));
    const files = [];
    TABLES.forEach(function (t) { files.push(path.join('spirit', 'app', 'agent', 'table', t, 'server.js')); ['elementTable.js', 'elementRow.js'].forEach(function (f) { files.push(path.join('spirit', 'app', 'agent', 'element', 'table', t, f)); }); });
    const absent = files.filter(function (f) { return !fs.existsSync(path.join(RUN, f)); });
    ok(!absent.length, 'each table has its folder spirit/app/agent/table/<name>/ with server.js, elementTable.js and elementRow.js', absent.length + ' of 12 missing: ' + absent.join(', '));
    // goal/G41.21: "With it go its folder (spirit/app/agent/table/grant)".
    ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'table', 'grant')), 'the grant table\'s folder spirit/app/agent/table/grant is gone', 'spirit/app/agent/table/grant is still there');
    const served = (await ask('DEBUG', {})).status === 200;
    const answers = {};
    for (const t of TABLES) answers[t] = await ask(t, {});
    ok(served && TABLES.every(function (t) { return !(answers[t].body && answers[t].body.code === 'no-such-verb') && !/no.such.verb|unknown verb/i.test(short(answers[t])); }), 'the server serves each of the four verbs', 'answers: ' + short(answers));

    // The verb's shape, as cw named it for the build: flat, as every family verb is, <table> {op, ...fields}, op one of
    // add (answers the new id), set, delete, get (the row without its secrets, apiKeySet in place of the key) and search.
    test.subHeading('goal/G41.4: add makes a row with its key set; set changes it; delete removes it');
    const API_KEY = 'sk-test-' + 'a'.repeat(24);
    const added = await ask('provider', { op: 'add', icon: '🏢', label: 'A provider', url: 'https://api.example.test/v1', apiKey: API_KEY });
    const pid = added.body && added.body.id;
    // The shadow-roll's kind of ID: an ed25519 public key, SPKI DER in base64 (spirit/relayAuth.js generateIdentity).
    const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
    ok(added.status === 200 && isKey(pid), 'provider {op: add} answers the new row\'s id, an ed25519 public key as the shadow-roll keys a row', 'answer: ' + short(added.body || added));
    const look2 = new DatabaseSync(db, { readOnly: true });
    const pT = tableOf('provider');
    const row = pT && isKey(pid) ? look2.prepare('SELECT * FROM ' + JSON.stringify(pT) + ' WHERE id = ?').get(pid) : null;
    const privates = row ? ['privateKey', 'sealPrivateKey'].filter(function (k) { return row[k]; }) : [];
    ok(!!row && row.label === 'A provider' && row.url === 'https://api.example.test/v1' && row.apiKey === API_KEY && !!row.privateKey && !!row.sealPrivateKey && !!row.sealPublicKey,
      'the row holds its fields, its API key, and the private halves of its key set (box: "the rest of the key-set stored on that table row")', 'row: ' + short(row && Object.keys(row)) + ', private columns ' + short(privates));
    // Andy: API_KEY "will never reach the browser or any place outside of the agent process"; "The private halves of that
    // set stay in the agent process".
    const secrets = [API_KEY].concat(privates.map(function (k) { return String(row[k]); }));
    const leaks = function (r) { const t = JSON.stringify(r || {}); return secrets.filter(function (x) { return x && t.indexOf(x) !== -1; }).length; };
    ok(isKey(pid) && leaks(added) === 0, 'the add\'s answer carries no API key and no private key', 'secrets in the answer: ' + leaks(added));
    const changed = await ask('provider', { op: 'set', id: pid, label: 'A provider, renamed' });
    const row2 = pT && isKey(pid) ? look2.prepare('SELECT * FROM ' + JSON.stringify(pT) + ' WHERE id = ?').get(pid) : null;
    ok(changed.status === 200 && !!row2 && row2.label === 'A provider, renamed' && row2.apiKey === API_KEY && leaks(changed) === 0, 'provider {set} changes the field it names, keeps the rest, and answers no secret', 'answer ' + short(changed.body || changed) + ', label ' + short(row2 && row2.label));
    const modelAdd = await ask('model', { op: 'add', label: 'test-model-1', providerId: pid, capabilities: ['text'] });
    const mid = modelAdd.body && modelAdd.body.id;
    const mT = tableOf('model');
    const mrow = mT && isKey(mid) ? look2.prepare('SELECT * FROM ' + JSON.stringify(mT) + ' WHERE id = ?').get(mid) : null;
    ok(isKey(mid) && mid !== pid && !!mrow && mrow.providerId === pid && mrow.label === 'test-model-1' && !('modelName' in mrow), 'model {add} keys its own row, naming its provider by the provider\'s id', 'answer ' + short(modelAdd.body || modelAdd) + ', row ' + short(mrow));
    const jobAdd = await ask('job', { op: 'add', icon: '📋', label: 'Code review', loop: true, job: 'Review the diff.' });
    const jid = jobAdd.body && jobAdd.body.id;
    const personaAdd = await ask('persona', { op: 'add', icon: '🎭', label: 'A reviewer', persona: 'You review code.' });
    ok(isKey(jid) && isKey(personaAdd.body && personaAdd.body.id), 'job {add} and persona {add} each answer a key of their own', 'job ' + short(jobAdd.body || jobAdd) + ', persona ' + short(personaAdd.body || personaAdd));
    // goal/G41.21: a job's grant is its bundle, and it names its provider and its persona; no grant verb is asked.
    const jSet = await ask('job', { op: 'set', id: jid, bundle: '7', provider: pid, persona: personaAdd.body && personaAdd.body.id });
    const jT = tableOf('job');
    const jrow = jT && isKey(jid) ? look2.prepare('SELECT * FROM ' + JSON.stringify(jT) + ' WHERE id = ?').get(jid) : null;
    ok(jSet.status === 200 && jrow && String(jrow.bundle) === '7' && jrow.provider === pid && jrow.persona === (personaAdd.body && personaAdd.body.id),
      'job {op: set, bundle, provider, persona} keeps the job\'s bundle, its provider and its persona', 'answer ' + short(jSet.body || jSet) + ', row ' + short(jrow));
    const got = await ask('provider', { op: 'get', id: pid });
    ok(got.status === 200 && got.body && got.body.label === 'A provider, renamed' && got.body.apiKeySet === true && leaks(got) === 0 && !('apiKey' in got.body) && !('privateKey' in got.body) && !('sealPrivateKey' in got.body),
      'provider {op: get} answers the row without its secrets, apiKeySet true in place of the key', 'answer: ' + short(got.body || got));
    const found = await ask('provider', { op: 'search', text: 'renamed' });
    ok(found.status === 200 && found.body && Array.isArray(found.body.items) && typeof found.body.more === 'boolean' && found.body.items.some(function (i) { return i && i.key === pid; }) && leaks(found) === 0,
      'provider {op: search} answers items and more, as every search does, the row among them, no secret', 'answer: ' + short(found.body || found));
    const gone = await ask('provider', { op: 'delete', id: pid });
    const row3 = pT && isKey(pid) ? look2.prepare('SELECT * FROM ' + JSON.stringify(pT) + ' WHERE id = ?').get(pid) : null;
    ok(gone.status === 200 && isKey(pid) && !row3, 'provider {delete} removes its row', 'answer ' + short(gone.body || gone) + ', row left ' + !!row3);
    const junk = await ask('provider', { op: 'fly' });
    ok(verbs.provider && !(junk.body && junk.body.code === 'no-such-verb') && !(junk.status === 200 && junk.body && junk.body.ok !== false), 'any other action of the verb is refused', 'provider {op: fly}: ' + short(junk.body || junk));
    look2.close();
    // What the server publishes carries no secret: read in its code, since a test server's stream reaches no node.
    const srvCode = TABLES.map(function (t) { try { return fs.readFileSync(path.join(RUN, 'spirit', 'app', 'agent', 'table', t, 'server.js'), 'utf8'); } catch (e) { return ''; } }).filter(Boolean).join('\n');
    ok(srvCode.length > 0 && /publish\(/.test(srvCode + fs.readFileSync(CODE, 'utf8')), 'the table servers publish their rows to the stream', 'no publish in the table servers');

  } finally { await stop(); }

  test.subHeading('it streams its state');
  const code = fs.readFileSync(CODE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(/serve\([^]*publisher\s*:/.test(code) && /bootstrap/.test(code), 'it serves with a publisher whose bootstrap hands a subscriber its state',
    'no publisher with a bootstrap in agent.js');
  // goal/G43.32: what the publisher serves, its api.js declares (Andy: "for now, it needs to declare them in api.js").
  const declared = require(path.join(RUN, 'spirit', 'app', 'agent', 'api.js')).verbs || {};
  ok(!!declared.subscribe && !!declared.unsubscribe, 'its api.js declares subscribe and unsubscribe, which the publisher serves', 'agent\'s api.js declares ' + Object.keys(declared).join(', '));
  ok(!/['"]state['"]\s*:\s*\{|\bstate\s*:\s*\{\s*request/.test(code), 'there is no read verb: the page reads the state from the stream', 'agent.js serves a state verb');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
