'use strict';

// spirit/run/spirit/app/agent/table/test/rowTable.js
// The tests of spirit/app/agent/table/rowTable.js, and of no other module (spec: ./rowTable.md; goal/G41.4). One keyed
// table is made on a scratch agent.db, as nodeAgent.js makes each, with a table definition of the test's own, and its verb is
// called as the server calls it; what it publishes is kept.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const FILE = path.join(__dirname, '..', 'rowTable.js');

// One test.run per test (goal/G47.2).
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
// The verb's answer, or its refusal as { refusal, why }.
function call(verb, a) {
  try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; }
}
const SECRET = 'sk-the-test-secret-0123456789';

// What the tests make, for the tests after them.
const X = { mod: null, scratch: '', dbFile: '', db: null, published: [], checked: null, deleted: null, def: null, t: null, verb: null,
  cols: [], names: [], added: null, id: '', raw: null, second: null, got: null, found: null };
const NO_MOD = 'no rowTable: it did not load';
const NO_TABLE = 'no table: rowTable made none';
const NO_ROW = 'no row: the add was refused';
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its file ──
test.run('it exports rowTable(db, def, publish)', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/table/rowTable.js is not there';
  const mod = X.mod = require(FILE);
  return mod && typeof mod.rowTable === 'function' ? true : 'exports: ' + short(Object.keys(mod || {}));
}, 1000);
test.run('it answers { verb, has, label, icon }', 0.2, function () {
  if (!X.mod || typeof X.mod.rowTable !== 'function') return NO_MOD;
  X.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-rowTable-'));
  X.dbFile = path.join(X.scratch, 'agent.db');
  X.db = new DatabaseSync(X.dbFile);
  X.def = {
    name: 'thing', fields: { url: 'url?', apiKey: 'text?', on: 'bool?', tags: 'list?' }, secret: ['apiKey'],
    check: function (a) { X.checked = a; return a.url === 'https://refused.example' ? 'that url is refused' : ''; },
    deleted: function (id) { X.deleted = id; },
  };
  const t = X.t = X.mod.rowTable(X.db, X.def, function (x) { X.published.push(x); });
  X.verb = t && t.verb;
  X.cols = X.db.prepare('PRAGMA table_info("thing")').all();
  X.names = X.cols.map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' && typeof t.label === 'function' && typeof t.icon === 'function' ? true : 'answered: ' + short(t && Object.keys(t));
}, 1000);

// ── the table: the key set, the common fields, the named fields ──
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.names.indexOf(c) !== -1 ? true : 'columns: ' + short(X.names); };
test.run('the table has an id column', 0.2, function () { return has('id'); }, 1000);
test.run('the table has a privateKey column', 0.2, function () { return has('privateKey'); }, 1000);
test.run('the table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, 1000);
test.run('the table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, 1000);
test.run('the table has an icon column', 0.2, function () { return has('icon'); }, 1000);
test.run('the table has a label column', 0.2, function () { return has('label'); }, 1000);
test.run('the table has an url column', 0.2, function () { return has('url'); }, 1000);
test.run('the table has an apiKey column', 0.2, function () { return has('apiKey'); }, 1000);
test.run('the table has an on column', 0.2, function () { return has('on'); }, 1000);
test.run('the table has a tags column', 0.2, function () { return has('tags'); }, 1000);
test.run('id is its one primary key', 0.2, function () {
  const pk = X.cols.filter(function (c) { return c.pk; }).map(function (c) { return c.name; });
  return pk.length === 1 && pk[0] === 'id' ? true : 'primary key: ' + short(pk);
}, 1000);
test.run('a bool field is kept as an INTEGER', 0.2, function () {
  return (X.cols.filter(function (c) { return c.name === 'on'; })[0] || {}).type === 'INTEGER' ? true : 'on: ' + short(X.cols.filter(function (c) { return c.name === 'on'; }));
}, 1000);

// ── add makes the row with its whole key set ──
test.run('add answers { id } alone, an ed25519 public key', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  const added = X.added = call(X.verb, { op: 'add', label: 'First', url: 'https://one.example', apiKey: SECRET, on: true, tags: ['a', 'b'] });
  X.id = added && added.id;
  X.raw = isKey(X.id) ? X.db.prepare('SELECT * FROM "thing" WHERE id = ?').get(X.id) : null;
  return isKey(X.id) && Object.keys(added).length === 1 ? true : 'answer: ' + short(added);
}, 1000);
test.run('the row holds its private key, its seal public key and its seal private key beside the id', 0.2, function () {
  const raw = X.raw;
  return raw && /^MC4CAQAwBQYDK2Vw/.test(String(raw.privateKey)) && String(raw.sealPublicKey) && String(raw.sealPrivateKey) && raw.sealPublicKey !== raw.id
    ? true : 'row: ' + short(raw && { privateKey: String(raw.privateKey).slice(0, 20), seal: !!raw.sealPublicKey });
}, 1000);
test.run('the secret is kept as typed, the bool as 1, the list as JSON', 0.2, function () {
  const raw = X.raw;
  return raw && raw.apiKey === SECRET && raw.on === 1 && raw.tags === '["a","b"]' ? true : 'row: ' + short(raw && { apiKey: raw.apiKey === SECRET, on: raw.on, tags: raw.tags });
}, 1000);
test.run('each add makes a key set of its own', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  X.second = call(X.verb, { op: 'add', label: 'Second' });
  return isKey(X.second.id) && X.second.id !== X.id ? true : 'second: ' + short(X.second);
}, 1000);
test.run('the table\'s own check is asked before the row is made', 0.2, function () {
  return X.checked && X.checked.op === 'add' ? true : 'checked: ' + short(X.checked);
}, 1000);

// ── no secret leaves the table ──
const leaks = function (x) { const s = JSON.stringify(x); const raw = X.raw; return s.indexOf(SECRET) !== -1 || (raw && (s.indexOf(String(raw.privateKey)) !== -1 || s.indexOf(String(raw.sealPrivateKey)) !== -1)); };
test.run('get answers the row', 0.2, function () {
  if (!X.id) return NO_ROW;
  const got = X.got = call(X.verb, { op: 'get', id: X.id });
  return got && got.id === X.id && got.label === 'First' && got.url === 'https://one.example' ? true : 'get: ' + short(got);
}, 1000);
// A private half or a secret in an answer would leak it to whoever asks.
test.run('get carries no private half and no secret, only apiKeySet true', 0.8, function () {
  const got = X.got;
  return got && !('privateKey' in got) && !('sealPrivateKey' in got) && !('apiKey' in got) && got.apiKeySet === true ? true : 'get: ' + short(got && Object.keys(got));
}, 1000);
test.run('get shows the bool as a bool and the list as a list', 0.2, function () {
  const got = X.got;
  return got && got.on === true && JSON.stringify(got.tags) === '["a","b"]' ? true : 'get: ' + short(got && { on: got.on, tags: got.tags });
}, 1000);
test.run('a row with no secret says apiKeySet false', 0.2, function () {
  if (!X.second || !X.second.id) return NO_ROW;
  return call(X.verb, { op: 'get', id: X.second.id }).apiKeySet === false ? true : 'get second: ' + short(call(X.verb, { op: 'get', id: X.second.id }));
}, 1000);
test.run('no published row carries a private half or a secret', 0.8, function () {
  return X.published.length >= 2 && !X.published.some(leaks) ? true : 'published: ' + short(X.published);
}, 1000);
test.run('no search answer carries one either', 0.8, function () {
  if (!X.verb) return NO_TABLE;
  X.found = call(X.verb, { op: 'search', text: '' });
  return X.found && !leaks(X.found) ? true : 'search: ' + short(X.found);
}, 1000);

// ── every change is published ──
test.run('add publishes { agent: { table, row } }, the row as get shows it', 0.2, function () {
  const p0 = X.published[0] && X.published[0].agent;
  return p0 && p0.table === 'thing' && p0.row && p0.row.id === X.id && p0.row.apiKeySet === true ? true : 'published: ' + short(X.published[0]);
}, 1000);

// ── set changes what it names and keeps the rest ──
const SET = { n: 0 };
test.run('set {id, label} answers { id }, changes the label and keeps url, the secret and the bool', 0.2, function () {
  if (!X.id) return NO_ROW;
  SET.n = X.published.length;
  const set = call(X.verb, { op: 'set', id: X.id, label: 'Renamed' });
  const after = call(X.verb, { op: 'get', id: X.id });
  return set && set.id === X.id && after.label === 'Renamed' && after.url === 'https://one.example' && after.apiKeySet === true && after.on === true ? true : 'after: ' + short(after);
}, 1000);
test.run('and publishes the changed row', 0.2, function () {
  const n = SET.n, published = X.published;
  const ps = published[n] && published[n].agent;
  return published.length === n + 1 && ps && ps.row && ps.row.label === 'Renamed' ? true : 'published: ' + short(published.slice(n));
}, 1000);
test.run('set replaces a secret when it names one', 0.2, function () {
  if (!X.id) return NO_ROW;
  call(X.verb, { op: 'set', id: X.id, apiKey: 'sk-another' });
  return X.db.prepare('SELECT apiKey FROM "thing" WHERE id = ?').get(X.id).apiKey === 'sk-another' ? true : 'apiKey not replaced';
}, 1000);

// ── search answers the rows ranked, in one answer ──
const SR = { item: {}, shownRow: null, striped: null };
test.run('search with no words answers { items, more }, every row', 0.2, function () {
  const found = X.found;
  return found && Array.isArray(found.items) && typeof found.more === 'boolean' && found.items.length === 2 ? true : 'search: ' + short(found);
}, 1000);
// goal/G41.18, Andy: "we talked about sending whole fucking rows in search, THAT IS NOT NEEDED for a table. only the ID
// and the fields shown in a table, that's all it needs."; "that exactly what GET is for, to bring in the rest for detail
// panels etc...". A whole row cost some 480 bytes, and one answer held 17 of them.
test.run('each item is keyed by the row\'s id, its label carrying the id', 0.2, function () {
  if (!X.found || !Array.isArray(X.found.items)) return 'no search answer';
  const item = SR.item = X.found.items[0] || {};
  try { SR.shownRow = JSON.parse(item.label); } catch (e) { SR.shownRow = null; }
  return isKey(item.key) && SR.shownRow && SR.shownRow.id === item.key ? true : 'item: ' + short(item);
}, 1000);
test.run('and only what its list shows: by default the id, the icon and the label (goal/G41.18)', 0.2, function () {
  const shownRow = SR.shownRow;
  return shownRow && JSON.stringify(Object.keys(shownRow).sort()) === '["icon","id","label"]' ? true : 'item: ' + short(shownRow && Object.keys(shownRow));
}, 1000);
test.run('a search of words ranks the row that has them first', 0.2, function () {
  if (!X.id) return NO_ROW;
  const hit = call(X.verb, { op: 'search', text: 'Renamed' });
  return hit.items.length >= 1 && hit.items[0].key === X.id ? true : 'search Renamed: ' + short(hit.items.map(function (i) { return i.key; }));
}, 1000);
test.run('it still ranks by the fields it does not answer: a word of the url finds its row', 0.2, function () {
  if (!X.id) return NO_ROW;
  const byUrl = call(X.verb, { op: 'search', text: 'one.example' });
  return byUrl.items.length >= 1 && byUrl.items[0].key === X.id ? true : 'search one.example: ' + short(byUrl.items.map(function (i) { return i.key; }));
}, 1000);
// THE WHOLE ROW AS ITS GET SERVES IT (goal/G41.28; Andy, box v15: "a probability search of a dataBase table must
// ALWAYS search the whole bloody ROW, as it is served through a single-row \"get\""): a word in a list field is found,
// and a secret, which no get serves, is never searched.
test.run('a word in a list field its get serves finds its row: tags ["zebra"]', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  SR.striped = call(X.verb, { op: 'add', label: 'Third', tags: ['zebra'], apiKey: 'quokkasecret' });
  const byTag = call(X.verb, { op: 'search', text: 'zebra' });
  return !!SR.striped.id && byTag.items.length >= 1 && byTag.items[0].key === SR.striped.id ? true : 'search zebra: ' + short(byTag.items.map(function (i) { return i.key; })) + ', the row ' + short(SR.striped.id);
}, 1000);
// A secret that ranks its row lets a search guess it word by word.
test.run('a secret no get serves is never searched: its words find nothing', 0.8, function () {
  if (!SR.striped || !SR.striped.id) return NO_ROW;
  const striped = SR.striped;
  const bySecret = call(X.verb, { op: 'search', text: 'quokkasecret' });
  const verdict = !bySecret.items.some(function (i) { return i.key === striped.id && Number(i.probability || i.score || 0) > 0; }) && (bySecret.items[0] || {}).key !== striped.id
    ? true : 'search of the secret ranked its row: ' + short(bySecret.items.slice(0, 3));
  call(X.verb, { op: 'delete', id: striped.id });
  return verdict;
}, 1000);
// A table names what its list shows (def.listed); its search answers the id and those fields alone. (def.shows is
// another thing: fields computed onto every row shown, as the model's providerIcon.)
const SL = { slim: null, sid: '' };
test.run('a table naming listed: [url] answers the id and the url, nothing else', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const slim = SL.slim = X.mod.rowTable(X.db, { name: 'slim', fields: { url: 'url?', apiKey: 'text?' }, secret: ['apiKey'], listed: ['url'] }, function () {});
  const sid = SL.sid = call(slim.verb, { op: 'add', label: 'Hidden label', url: 'https://slim.example', apiKey: SECRET }).id;
  let row = null; try { row = JSON.parse((call(slim.verb, { op: 'search', text: '' }).items || [])[0].label); } catch (e) { row = null; }
  return row && row.id === sid && row.url === 'https://slim.example' && JSON.stringify(Object.keys(row).sort()) === '["id","url"]' ? true : 'item: ' + short(row);
}, 1000);
test.run('and get still answers the whole row', 0.2, function () {
  if (!SL.slim) return NO_TABLE;
  return call(SL.slim.verb, { op: 'get', id: SL.sid }).label === 'Hidden label' ? true : 'get: ' + short(call(SL.slim.verb, { op: 'get', id: SL.sid }));
}, 1000);
// A SEARCH NARROWED BY A FIELD (goal/G41.21, box v17: "showing only the models whose provider is this provider";
// "Narrowing a pick field to one provider's models is new"): a search naming one of the table's own fields answers
// only the rows whose field holds that value, ranked as before.
const KD = { kids: null, A: '', B: '', a1: '', a2: '', b1: '' };
const keysOf = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }).sort(); };
test.run('a search naming parentId answers only the rows whose parentId is it', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const kids = KD.kids = X.mod.rowTable(X.db, { name: 'kid', fields: { parentId: 'key?' } }, function () {});
  KD.A = call(kids.verb, { op: 'add', label: 'Parent A' }).id;
  KD.B = call(kids.verb, { op: 'add', label: 'Parent B' }).id;
  KD.a1 = call(kids.verb, { op: 'add', label: 'First of A', parentId: KD.A }).id;
  KD.a2 = call(kids.verb, { op: 'add', label: 'Second of A', parentId: KD.A }).id;
  KD.b1 = call(kids.verb, { op: 'add', label: 'First of B', parentId: KD.B }).id;
  const ofA = call(kids.verb, { op: 'search', text: '', parentId: KD.A });
  return JSON.stringify(keysOf(ofA)) === JSON.stringify([KD.a1, KD.a2].sort()) ? true : 'search parentId A: ' + short(ofA);
}, 1000);
test.run('with words too: only its rows, ranked by the words', 0.2, function () {
  if (!KD.kids) return NO_TABLE;
  const firstOfB = call(KD.kids.verb, { op: 'search', text: 'First', parentId: KD.B });
  return JSON.stringify(keysOf(firstOfB)) === JSON.stringify([KD.b1]) ? true : 'search First of B: ' + short(firstOfB);
}, 1000);
test.run('a value no row holds answers no rows', 0.2, function () {
  if (!KD.kids) return NO_TABLE;
  const none = call(KD.kids.verb, { op: 'search', text: '', parentId: KD.b1 });
  return none && Array.isArray(none.items) && none.items.length === 0 && none.more === false ? true : 'search: ' + short(none);
}, 1000);
test.run('a search naming no field answers every row, as before', 0.2, function () {
  if (!KD.kids) return NO_TABLE;
  return call(KD.kids.verb, { op: 'search', text: '' }).items.length === 5 ? true : 'search: ' + short(call(KD.kids.verb, { op: 'search', text: '' }));
}, 1000);

// ── a table names its mandatory fields, and takes no row without them (goal/G41.21) ──
// Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!", "for a new row, a valid label (NOT empty) IS THE MINIMUM
// required", "# mandatory fields (server AND ui)". A table's def.required names them; the provider, persona and job
// tables name theirs (their own tests).
const ND = { need: null, missing: null, blank: null, bare: null, whole: null };
const needRows = function () { return X.db.prepare('SELECT COUNT(*) AS n FROM "need"').get().n; };
test.run('an add missing a mandatory field, or with one of blanks, is refused and makes no row', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const need = ND.need = X.mod.rowTable(X.db, { name: 'need', fields: { url: 'url?' }, required: ['icon', 'label', 'url'] }, function () {});
  ND.missing = call(need.verb, { op: 'add', label: 'No icon', url: 'https://need.example' });
  ND.blank = call(need.verb, { op: 'add', icon: '🧪', label: ' ', url: 'https://need.example' });
  ND.bare = call(need.verb, { op: 'add' });
  return [ND.missing, ND.blank, ND.bare].every(function (r) { return r.refusal && !r.id; }) && needRows() === 0 ? true : 'answers: ' + short([ND.missing, ND.blank, ND.bare]);
}, 1000);
test.run('the refusal names every mandatory field missing', 0.2, function () {
  if (!ND.need) return NO_TABLE;
  const missing = ND.missing, blank = ND.blank, bare = ND.bare;
  return (/icon/).test(String(missing.why)) && /label/.test(String(blank.why)) && /icon/.test(String(bare.why)) && /label/.test(String(bare.why)) && /url/.test(String(bare.why))
    ? true : 'why: ' + short([missing.why, blank.why, bare.why]);
}, 1000);
test.run('with them all it is added', 0.2, function () {
  if (!ND.need) return NO_TABLE;
  ND.whole = call(ND.need.verb, { op: 'add', icon: '🧪', label: 'Whole', url: 'https://need.example' });
  return isKey(ND.whole.id) && needRows() === 1 ? true : 'answer: ' + short(ND.whole);
}, 1000);
test.run('a change that would empty one is refused, the row kept', 0.2, function () {
  if (!ND.whole || !ND.whole.id) return NO_ROW;
  const emptied = call(ND.need.verb, { op: 'set', id: ND.whole.id, icon: '' });
  return emptied.refusal && /icon/.test(String(emptied.why)) && call(ND.need.verb, { op: 'get', id: ND.whole.id }).icon === '🧪' ? true : 'answer: ' + short(emptied);
}, 1000);
test.run('a change that keeps them all is taken', 0.2, function () {
  if (!ND.whole || !ND.whole.id) return NO_ROW;
  return !call(ND.need.verb, { op: 'set', id: ND.whole.id, label: 'Renamed' }).refusal ? true : 'refused';
}, 1000);
test.run('a table naming none takes a bare row, as before', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const free = X.mod.rowTable(X.db, { name: 'free', fields: { url: 'url?' } }, function () {});
  return isKey(call(free.verb, { op: 'add' }).id) ? true : 'refused';
}, 1000);

// ── a refusal says why ──
test.run('an op it does not know is refused, naming the ops', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  const unknownOp = call(X.verb, { op: 'fly' });
  return unknownOp.refusal === 'bad-request' && /add, set, delete, get, search/.test(unknownOp.why) ? true : 'fly: ' + short(unknownOp);
}, 1000);
// The face's calls once reached the tables with verb among the arguments (goal/G41.4: "Not added: job takes no argument
// verb"); the table refuses what it does not declare, and says which.
test.run('an argument it does not declare is refused as no-such-argument, naming it', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  const stray = call(X.verb, { op: 'add', verb: 'thing' });
  return stray.refusal === 'no-such-argument' && /verb/.test(stray.why) ? true : 'stray verb: ' + short(stray);
}, 1000);
test.run('the table\'s own check refuses with its words', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  const badUrl = call(X.verb, { op: 'add', url: 'https://refused.example' });
  return badUrl.refusal === 'bad-request' && /thing: that url is refused/.test(badUrl.why) ? true : 'check: ' + short(badUrl);
}, 1000);
test.run('and a refused add writes no row', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const before = X.db.prepare('SELECT count(*) AS n FROM "thing"').get().n;
  return before === 2 ? true : 'rows: ' + before;
}, 1000);
test.run('get of a row that is not there is refused no-such-row', 0.2, function () {
  if (!X.verb) return NO_TABLE;
  const missing = call(X.verb, { op: 'get', id: require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey });
  return missing.refusal === 'no-such-row' ? true : 'get missing: ' + short(missing);
}, 1000);

// ── has, label and icon ──
test.run('has(id) says whether the row is there', 0.2, function () {
  if (!X.id) return NO_ROW;
  call(X.verb, { op: 'set', id: X.id, icon: '🧪' });
  return X.t.has(X.id) && !X.t.has('nope') ? true : 'has: ' + X.t.has(X.id) + ' ' + X.t.has('nope');
}, 1000);
test.run('label(id) is its label, \'\' when it is not there', 0.2, function () {
  if (!X.id) return NO_ROW;
  return X.t.label(X.id) === 'Renamed' && X.t.label('nope') === '' ? true : 'label: ' + short(X.t.label(X.id));
}, 1000);
test.run('icon(id) is its icon, \'\' when it is not there', 0.2, function () {
  if (!X.id) return NO_ROW;
  return X.t.icon(X.id) === '🧪' && X.t.icon('nope') === '' ? true : 'icon: ' + short(X.t.icon(X.id));
}, 1000);

// ── delete removes the row and says so ──
const DL = { m: 0 };
test.run('delete {id} answers { id }, removes the row and tells the table\'s deleted', 0.2, function () {
  if (!X.second || !X.second.id) return NO_ROW;
  DL.m = X.published.length;
  const del = call(X.verb, { op: 'delete', id: X.second.id });
  return del.id === X.second.id && !X.t.has(X.second.id) && X.deleted === X.second.id ? true : 'delete: ' + short(del) + ', deleted ' + short(X.deleted);
}, 1000);
test.run('and publishes { agent: { table, id, removed: true } }', 0.2, function () {
  if (!X.second || !X.second.id) return NO_ROW;
  const pd = X.published[DL.m] && X.published[DL.m].agent;
  return pd && pd.table === 'thing' && pd.id === X.second.id && pd.removed === true && !pd.row ? true : 'published: ' + short(X.published.slice(DL.m));
}, 1000);
test.run('a second delete of it is refused no-such-row', 0.2, function () {
  if (!X.second || !X.second.id) return NO_ROW;
  return call(X.verb, { op: 'delete', id: X.second.id }).refusal === 'no-such-row' ? true : 'second delete answered';
}, 1000);

// ── a table made before a field was takes the field at start ──
const OL = { old: null, oldCols: [] };
test.run('the missing icon and named fields are added to it', 0.2, function () {
  if (!X.db) return NO_TABLE;
  const db = X.db;
  db.exec('CREATE TABLE "old" (id TEXT PRIMARY KEY, privateKey TEXT NOT NULL, sealPublicKey TEXT NOT NULL, sealPrivateKey TEXT NOT NULL, label TEXT NOT NULL DEFAULT \'\', description TEXT NOT NULL DEFAULT \'\')');
  db.prepare('INSERT INTO "old" (id, privateKey, sealPublicKey, sealPrivateKey, label) VALUES (?, ?, ?, ?, ?)').run('k', 'p', 's', 'sp', 'Kept');
  OL.old = X.mod.rowTable(db, { name: 'old', fields: { persona: 'text?' } }, function () {});
  OL.oldCols = db.prepare('PRAGMA table_info("old")').all().map(function (c) { return c.name; });
  return OL.oldCols.indexOf('icon') !== -1 && OL.oldCols.indexOf('persona') !== -1 ? true : 'columns: ' + short(OL.oldCols);
}, 1000);
test.run('and its rows are kept, the new fields empty', 0.2, function () {
  const old = OL.old;
  if (!old) return NO_TABLE;
  return old.label('k') === 'Kept' && old.icon('k') === '' ? true : 'label ' + short(old.label('k')) + ', icon ' + short(old.icon('k'));
}, 1000);
// goal/G41.21, Andy: "ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS.": a table that has one
// from before loses it at start, its rows kept.
test.run('its old description column is dropped at start, the row kept', 0.2, function () {
  const old = OL.old;
  if (!old) return NO_TABLE;
  return OL.oldCols.indexOf('description') === -1 && old.label('k') === 'Kept' ? true : 'columns: ' + short(OL.oldCols);
}, 1000);

// ── the rows persist in agent.db ──
test.run('opened again on the same file, the table has its rows', 0.2, function () {
  if (!X.db) return NO_TABLE;
  X.db.close();
  const again = X.mod.rowTable(new DatabaseSync(X.dbFile), X.def, function () {});
  return again.has(X.id) && again.label(X.id) === 'Renamed' ? true : 'has ' + again.has(X.id);
}, 1000);
