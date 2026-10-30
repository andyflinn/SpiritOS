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
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'url', 'apiKey', 'on', 'tags'].forEach(function (c) {
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
  // goal/G41.18, Andy: "we talked about sending whole fucking rows in search, THAT IS NOT NEEDED for a table. only the ID
  // and the fields shown in a table, that's all it needs."; "that exactly what GET is for, to bring in the rest for detail
  // panels etc...". A whole row cost some 480 bytes, and one answer held 17 of them.
  ok(isKey(item.key) && shownRow && shownRow.id === item.key, 'each item is keyed by the row\'s id, its label carrying the id', 'item: ' + short(item));
  ok(shownRow && JSON.stringify(Object.keys(shownRow).sort()) === '["icon","id","label"]', 'and only what its list shows: by default the id, the icon and the label (goal/G41.18)', 'item: ' + short(shownRow && Object.keys(shownRow)));
  const hit = call(verb, { op: 'search', text: 'Renamed' });
  ok(hit.items.length >= 1 && hit.items[0].key === id, 'a search of words ranks the row that has them first', 'search Renamed: ' + short(hit.items.map(function (i) { return i.key; })));
  const byUrl = call(verb, { op: 'search', text: 'one.example' });
  ok(byUrl.items.length >= 1 && byUrl.items[0].key === id, 'it still ranks by the fields it does not answer: a word of the url finds its row', 'search one.example: ' + short(byUrl.items.map(function (i) { return i.key; })));
  {
    // A table names what its list shows (def.listed); its search answers the id and those fields alone. (def.shows is
    // another thing: fields computed onto every row shown, as the model's providerIcon.)
    const slim = mod.rowTable(db, { name: 'slim', fields: { url: 'url?', apiKey: 'text?' }, secret: ['apiKey'], listed: ['url'] }, function () {});
    const sid = call(slim.verb, { op: 'add', label: 'Hidden label', url: 'https://slim.example', apiKey: SECRET }).id;
    let row = null; try { row = JSON.parse((call(slim.verb, { op: 'search', text: '' }).items || [])[0].label); } catch (e) { row = null; }
    ok(row && row.id === sid && row.url === 'https://slim.example' && JSON.stringify(Object.keys(row).sort()) === '["id","url"]', 'a table naming listed: [url] answers the id and the url, nothing else', 'item: ' + short(row));
    ok(call(slim.verb, { op: 'get', id: sid }).label === 'Hidden label', 'and get still answers the whole row', 'get: ' + short(call(slim.verb, { op: 'get', id: sid })));
  }
  {
    // A SEARCH NARROWED BY A FIELD (goal/G41.21, box v17: "showing only the models whose provider is this provider";
    // "Narrowing a pick field to one provider's models is new"): a search naming one of the table's own fields answers
    // only the rows whose field holds that value, ranked as before.
    const kids = mod.rowTable(db, { name: 'kid', fields: { parentId: 'key?' } }, function () {});
    const A = call(kids.verb, { op: 'add', label: 'Parent A' }).id;
    const B = call(kids.verb, { op: 'add', label: 'Parent B' }).id;
    const a1 = call(kids.verb, { op: 'add', label: 'First of A', parentId: A }).id;
    const a2 = call(kids.verb, { op: 'add', label: 'Second of A', parentId: A }).id;
    const b1 = call(kids.verb, { op: 'add', label: 'First of B', parentId: B }).id;
    const keys = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }).sort(); };
    const ofA = call(kids.verb, { op: 'search', text: '', parentId: A });
    ok(JSON.stringify(keys(ofA)) === JSON.stringify([a1, a2].sort()), 'a search naming parentId answers only the rows whose parentId is it', 'search parentId A: ' + short(ofA));
    const firstOfB = call(kids.verb, { op: 'search', text: 'First', parentId: B });
    ok(JSON.stringify(keys(firstOfB)) === JSON.stringify([b1]), 'with words too: only its rows, ranked by the words', 'search First of B: ' + short(firstOfB));
    const none = call(kids.verb, { op: 'search', text: '', parentId: b1 });
    ok(none && Array.isArray(none.items) && none.items.length === 0 && none.more === false, 'a value no row holds answers no rows', 'search: ' + short(none));
    ok(call(kids.verb, { op: 'search', text: '' }).items.length === 5, 'a search naming no field answers every row, as before', 'search: ' + short(call(kids.verb, { op: 'search', text: '' })));
  }

  test.subHeading('a table names its mandatory fields, and takes no row without them (goal/G41.21)');
  // Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!", "for a new row, a valid label (NOT empty) IS THE MINIMUM
  // required", "# mandatory fields (server AND ui)". A table's def.required names them; the provider, persona and job
  // tables name theirs (their own tests).
  {
    const need = mod.rowTable(db, { name: 'need', fields: { url: 'url?' }, required: ['icon', 'label', 'url'] }, function () {});
    const n = function () { return db.prepare('SELECT COUNT(*) AS n FROM "need"').get().n; };
    const missing = call(need.verb, { op: 'add', label: 'No icon', url: 'https://need.example' });
    const blank = call(need.verb, { op: 'add', icon: '🧪', label: ' ', url: 'https://need.example' });
    const bare = call(need.verb, { op: 'add' });
    ok([missing, blank, bare].every(function (r) { return r.refusal && !r.id; }) && n() === 0, 'an add missing a mandatory field, or with one of blanks, is refused and makes no row', 'answers: ' + short([missing, blank, bare]));
    ok(/icon/.test(String(missing.why)) && /label/.test(String(blank.why)) && /icon/.test(String(bare.why)) && /label/.test(String(bare.why)) && /url/.test(String(bare.why)),
      'the refusal names every mandatory field missing', 'why: ' + short([missing.why, blank.why, bare.why]));
    const whole = call(need.verb, { op: 'add', icon: '🧪', label: 'Whole', url: 'https://need.example' });
    ok(isKey(whole.id) && n() === 1, 'with them all it is added', 'answer: ' + short(whole));
    const emptied = call(need.verb, { op: 'set', id: whole.id, icon: '' });
    ok(emptied.refusal && /icon/.test(String(emptied.why)) && call(need.verb, { op: 'get', id: whole.id }).icon === '🧪', 'a change that would empty one is refused, the row kept', 'answer: ' + short(emptied));
    ok(!call(need.verb, { op: 'set', id: whole.id, label: 'Renamed' }).refusal, 'a change that keeps them all is taken', 'refused');
    const free = mod.rowTable(db, { name: 'free', fields: { url: 'url?' } }, function () {});
    ok(isKey(call(free.verb, { op: 'add' }).id), 'a table naming none takes a bare row, as before', 'refused');
  }

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
  // goal/G41.21, Andy: "ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS.": a table that has one
  // from before loses it at start, its rows kept.
  ok(oldCols.indexOf('description') === -1 && old.label('k') === 'Kept', 'its old description column is dropped at start, the row kept', 'columns: ' + short(oldCols));

  test.subHeading('the rows persist in agent.db');
  db.close();
  const again = mod.rowTable(new DatabaseSync(dbFile), def, function () {});
  ok(again.has(id) && again.label(id) === 'Renamed', 'opened again on the same file, the table has its rows', 'has ' + again.has(id));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}());
test.reportSuccessFailureCount();
