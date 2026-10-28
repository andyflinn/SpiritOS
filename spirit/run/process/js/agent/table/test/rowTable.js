'use strict';

// spirit/run/process/js/agent/table/test/rowTable.js
// The tests of process/js/agent/table/rowTable.js, and of no other module (spec: ./rowTable.md; goal/G41.4). One keyed
// table is made on a scratch agent.db, as agent.js makes each, with a table definition of the test's own, and its verb is
// called as the server calls it; what it publishes is kept.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
require(path.join(RUN, 'spirit.js'));
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const FILE = path.join(__dirname, '..', 'rowTable.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
// The verb's answer, or its refusal as { refusal, why }.
function call(verb, a) {
  try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; }
}
const SECRET = 'sk-the-test-secret-0123456789';

test.startTest('rowTable.js: one keyed table of agent.db and its one verb');

(function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('process/js/agent/table/rowTable.js is not there'); return; }
  const mod = require(FILE);
  ok(mod && typeof mod.rowTable === 'function', 'it exports rowTable(db, def, publish)', 'exports: ' + short(Object.keys(mod || {})));
  if (!mod || typeof mod.rowTable !== 'function') return;

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-rowTable-'));
  const dbFile = path.join(scratch, 'agent.db');
  const db = new DatabaseSync(dbFile);
  const published = [];
  let checked = null;
  let deleted = null;
  const def = {
    name: 'thing', fields: { url: 'url?', apiKey: 'text?', on: 'bool?', tags: 'list?' }, secret: ['apiKey'],
    check: function (a) { checked = a; return a.url === 'https://refused.example' ? 'that url is refused' : ''; },
    deleted: function (id) { deleted = id; },
  };
  const t = mod.rowTable(db, def, function (x) { published.push(x); });
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' && typeof t.label === 'function' && typeof t.icon === 'function',
    'it answers { verb, has, label, icon }', 'answered: ' + short(t && Object.keys(t)));
  const verb = t.verb;

  test.subHeading('the table: the key set, the common fields, the named fields');
  const cols = db.prepare('PRAGMA table_info("thing")').all();
  const names = cols.map(function (c) { return c.name; });
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'description', 'url', 'apiKey', 'on', 'tags'].forEach(function (c) {
    ok(names.indexOf(c) !== -1, 'it has the column ' + c, 'columns: ' + short(names));
  });
  const pk = cols.filter(function (c) { return c.pk; }).map(function (c) { return c.name; });
  ok(pk.length === 1 && pk[0] === 'id', 'id is its one primary key', 'primary key: ' + short(pk));
  ok((cols.filter(function (c) { return c.name === 'on'; })[0] || {}).type === 'INTEGER', 'a bool field is kept as an INTEGER', 'on: ' + short(cols.filter(function (c) { return c.name === 'on'; })));

  test.subHeading('add makes the row with its whole key set');
  const added = call(verb, { op: 'add', label: 'First', url: 'https://one.example', apiKey: SECRET, on: true, tags: ['a', 'b'] });
  const id = added && added.id;
  ok(isKey(id) && Object.keys(added).length === 1, 'add answers { id } alone, an ed25519 public key', 'answer: ' + short(added));
  const raw = isKey(id) ? db.prepare('SELECT * FROM "thing" WHERE id = ?').get(id) : null;
  ok(raw && /^MC4CAQAwBQYDK2Vw/.test(String(raw.privateKey)) && String(raw.sealPublicKey) && String(raw.sealPrivateKey) && raw.sealPublicKey !== raw.id,
    'the row holds its private key, its seal public key and its seal private key beside the id', 'row: ' + short(raw && { privateKey: String(raw.privateKey).slice(0, 20), seal: !!raw.sealPublicKey }));
  ok(raw && raw.apiKey === SECRET && raw.on === 1 && raw.tags === '["a","b"]', 'the secret is kept as typed, the bool as 1, the list as JSON', 'row: ' + short(raw && { apiKey: raw.apiKey === SECRET, on: raw.on, tags: raw.tags }));
  const second = call(verb, { op: 'add', label: 'Second' });
  ok(isKey(second.id) && second.id !== id, 'each add makes a key set of its own', 'second: ' + short(second));
  ok(checked && checked.op === 'add', 'the table\'s own check is asked before the row is made', 'checked: ' + short(checked));

  test.subHeading('no secret leaves the table');
  const leaks = function (x) { const s = JSON.stringify(x); return s.indexOf(SECRET) !== -1 || (raw && (s.indexOf(String(raw.privateKey)) !== -1 || s.indexOf(String(raw.sealPrivateKey)) !== -1)); };
  const got = call(verb, { op: 'get', id: id });
  ok(got && got.id === id && got.label === 'First' && got.url === 'https://one.example', 'get answers the row', 'get: ' + short(got));
  ok(got && !('privateKey' in got) && !('sealPrivateKey' in got) && !('apiKey' in got) && got.apiKeySet === true,
    'get carries no private half and no secret, only apiKeySet true', 'get: ' + short(got && Object.keys(got)));
  ok(got && got.on === true && JSON.stringify(got.tags) === '["a","b"]', 'get shows the bool as a bool and the list as a list', 'get: ' + short(got && { on: got.on, tags: got.tags }));
  ok(call(verb, { op: 'get', id: second.id }).apiKeySet === false, 'a row with no secret says apiKeySet false', 'get second: ' + short(call(verb, { op: 'get', id: second.id })));
  ok(published.length >= 2 && !published.some(leaks), 'no published row carries a private half or a secret', 'published: ' + short(published));
  const found = call(verb, { op: 'search', text: '' });
  ok(found && !leaks(found), 'no search answer carries one either', 'search: ' + short(found));

  test.subHeading('every change is published');
  const p0 = published[0] && published[0].agent;
  ok(p0 && p0.table === 'thing' && p0.row && p0.row.id === id && p0.row.apiKeySet === true, 'add publishes { agent: { table, row } }, the row as get shows it', 'published: ' + short(published[0]));

  test.subHeading('set changes what it names and keeps the rest');
  const n = published.length;
  const set = call(verb, { op: 'set', id: id, label: 'Renamed' });
  const after = call(verb, { op: 'get', id: id });
  ok(set && set.id === id && after.label === 'Renamed' && after.url === 'https://one.example' && after.apiKeySet === true && after.on === true,
    'set {id, label} answers { id }, changes the label and keeps url, the secret and the bool', 'after: ' + short(after));
  const ps = published[n] && published[n].agent;
  ok(published.length === n + 1 && ps && ps.row && ps.row.label === 'Renamed', 'and publishes the changed row', 'published: ' + short(published.slice(n)));
  call(verb, { op: 'set', id: id, apiKey: 'sk-another' });
  ok(db.prepare('SELECT apiKey FROM "thing" WHERE id = ?').get(id).apiKey === 'sk-another', 'set replaces a secret when it names one', 'apiKey not replaced');

  test.subHeading('search answers the rows ranked, in one answer');
  ok(found && Array.isArray(found.items) && typeof found.more === 'boolean' && found.items.length === 2, 'search with no words answers { items, more }, every row', 'search: ' + short(found));
  const item = found.items[0] || {};
  let shownRow = null; try { shownRow = JSON.parse(item.label); } catch (e) { shownRow = null; }
  ok(isKey(item.key) && shownRow && shownRow.id === item.key, 'each item is keyed by the row\'s id, its label the row as get shows it', 'item: ' + short(item));
  const hit = call(verb, { op: 'search', text: 'Renamed' });
  ok(hit.items.length >= 1 && hit.items[0].key === id, 'a search of words ranks the row that has them first', 'search Renamed: ' + short(hit.items.map(function (i) { return i.key; })));

  test.subHeading('a refusal says why');
  const unknownOp = call(verb, { op: 'fly' });
  ok(unknownOp.refusal === 'bad-request' && /add, set, delete, get, search/.test(unknownOp.why), 'an op it does not know is refused, naming the ops', 'fly: ' + short(unknownOp));
  // The face's calls once reached the tables with verb among the arguments (goal/G41.4: "Not added: job takes no argument
  // verb"); the table refuses what it does not declare, and says which.
  const stray = call(verb, { op: 'add', verb: 'thing' });
  ok(stray.refusal === 'no-such-argument' && /verb/.test(stray.why), 'an argument it does not declare is refused as no-such-argument, naming it', 'stray verb: ' + short(stray));
  const badUrl = call(verb, { op: 'add', url: 'https://refused.example' });
  ok(badUrl.refusal === 'bad-request' && /thing: that url is refused/.test(badUrl.why), 'the table\'s own check refuses with its words', 'check: ' + short(badUrl));
  const before = db.prepare('SELECT count(*) AS n FROM "thing"').get().n;
  ok(before === 2, 'and a refused add writes no row', 'rows: ' + before);
  const missing = call(verb, { op: 'get', id: require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey });
  ok(missing.refusal === 'no-such-row', 'get of a row that is not there is refused no-such-row', 'get missing: ' + short(missing));

  test.subHeading('has, label and icon');
  call(verb, { op: 'set', id: id, icon: '🧪' });
  ok(t.has(id) && !t.has('nope'), 'has(id) says whether the row is there', 'has: ' + t.has(id) + ' ' + t.has('nope'));
  ok(t.label(id) === 'Renamed' && t.label('nope') === '', 'label(id) is its label, \'\' when it is not there', 'label: ' + short(t.label(id)));
  ok(t.icon(id) === '🧪' && t.icon('nope') === '', 'icon(id) is its icon, \'\' when it is not there', 'icon: ' + short(t.icon(id)));

  test.subHeading('delete removes the row and says so');
  const m = published.length;
  const del = call(verb, { op: 'delete', id: second.id });
  ok(del.id === second.id && !t.has(second.id) && deleted === second.id, 'delete {id} answers { id }, removes the row and tells the table\'s deleted', 'delete: ' + short(del) + ', deleted ' + short(deleted));
  const pd = published[m] && published[m].agent;
  ok(pd && pd.table === 'thing' && pd.id === second.id && pd.removed === true && !pd.row, 'and publishes { agent: { table, id, removed: true } }', 'published: ' + short(published.slice(m)));
  ok(call(verb, { op: 'delete', id: second.id }).refusal === 'no-such-row', 'a second delete of it is refused no-such-row', 'second delete answered');

  test.subHeading('a table made before a field was takes the field at start');
  db.exec('CREATE TABLE "old" (id TEXT PRIMARY KEY, privateKey TEXT NOT NULL, sealPublicKey TEXT NOT NULL, sealPrivateKey TEXT NOT NULL, label TEXT NOT NULL DEFAULT \'\', description TEXT NOT NULL DEFAULT \'\')');
  db.prepare('INSERT INTO "old" (id, privateKey, sealPublicKey, sealPrivateKey, label) VALUES (?, ?, ?, ?, ?)').run('k', 'p', 's', 'sp', 'Kept');
  const old = mod.rowTable(db, { name: 'old', fields: { persona: 'text?' } }, function () {});
  const oldCols = db.prepare('PRAGMA table_info("old")').all().map(function (c) { return c.name; });
  ok(oldCols.indexOf('icon') !== -1 && oldCols.indexOf('persona') !== -1, 'the missing icon and named fields are added to it', 'columns: ' + short(oldCols));
  ok(old.label('k') === 'Kept' && old.icon('k') === '', 'and its rows are kept, the new fields empty', 'label ' + short(old.label('k')) + ', icon ' + short(old.icon('k')));

  test.subHeading('the rows persist in agent.db');
  db.close();
  const again = mod.rowTable(new DatabaseSync(dbFile), def, function () {});
  ok(again.has(id) && again.label(id) === 'Renamed', 'opened again on the same file, the table has its rows', 'has ' + again.has(id));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}());
test.reportSuccessFailureCount();
