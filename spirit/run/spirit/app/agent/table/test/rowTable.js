'use strict';

// spirit/run/spirit/app/agent/table/test/rowTable.js
// The tests of spirit/app/agent/table/rowTable.js, and of no other module (spec: ./rowTable.md; goal/G41.4). One keyed
// table is made on a scratch agent.db, as agent/server/server.js makes each, with a table definition of the test's own, and its verb is
// called as the server calls it; what it publishes is kept.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = S.requireScript('spirit/tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/agent/table/test/rowTable/' + name + tempAsked); }
// THE DATABASES IT OPENS ARE CLOSED BEFORE ITS TEMP FOLDER GOES (goal/G47.1, no pollution; testicle's "it leaves no temp
// folder behind", red on Andy's node 2026-11-18): Windows deletes no open file, so a database still open kept the folder.
// Every DatabaseSync opened from here on, by the test or by what it requires, is recorded and closed first.
const OPEN_DBS = [];
{
  const sqlite = require('node:sqlite');
  const RealDb = sqlite.DatabaseSync;
  sqlite.DatabaseSync = class extends RealDb { constructor() { super(...arguments); OPEN_DBS.push(this); } };
}
test.after(function () {
  OPEN_DBS.forEach(function (d) { try { d.close(); } catch (e) { /* closed */ } });
  try { require('fs').rmSync(tempFolder.path('spirit/app/agent/table/test/rowTable'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
const { DatabaseSync } = require('node:sqlite');

const FILE = path.join(__dirname, '..', 'rowTable.js');

// One test.run per test (goal/G47.2).
const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
// The verb's answer, or its refusal as { refusal, why }.
function call(verb, a) {
  try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || true, why: (e.extra && e.extra.why) || e.message }; }
}
const SECRET = 'sk-the-test-secret-0123456789';

// What the tests make, for the tests after them.
const X = { mod: null, scratch: '', dbFile: '', db: null, published: [], checked: null, deleted: null, def: null, t: null, verb: null,
  cols: [], names: [], added: null, id: '', raw: null, second: null, got: null, found: null };
test.after(function () { try { if (X.scratch) fs.rmSync(X.scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } });

// ── its file ──
test.run('it exports the function rowTable, which takes the database, the table\'s definition and publish', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const mod = X.mod = require(FILE);
  return mod && typeof mod.rowTable === 'function' ? true : false;
}, test.limit.quick);
test.run('it answers its verb, has, label and icon', 0.2, function () {
  if (!X.mod || typeof X.mod.rowTable !== 'function') return false;
  X.scratch = ownTemp('spirit-rowTable');
  X.dbFile = path.join(X.scratch, 'agent.db');
  X.db = new DatabaseSync(X.dbFile);
  X.def = {
    name: 'thing', fields: { url: 'url?', apiKey: 'text?', on: 'bool?', tags: 'spirit.type.string.json?' }, secret: ['apiKey'],
    check: function (a) { X.checked = a; return a.url === 'https://refused.example' ? 'that url is refused' : ''; },
    deleted: function (id) { X.deleted = id; },
  };
  const t = X.t = X.mod.rowTable(X.db, X.def, function (x) { X.published.push(x); });
  X.verb = t && t.verb;
  X.cols = X.db.prepare('PRAGMA table_info("thing")').all();
  X.names = X.cols.map(function (c) { return c.name; });
  return t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function' && typeof t.label === 'function' && typeof t.icon === 'function' ? true : false;
}, test.limit.quick);

// ── the table: the key set, the common fields, the named fields ──
// One check per column, each its own plain title (goal/G45.6: a title names no value built into it).
const has = function (c) { return X.names.indexOf(c) !== -1 ? true : false; };
test.run('the table has an id column', 0.2, function () { return has('id'); }, test.limit.quick);
test.run('the table has a privateKey column', 0.2, function () { return has('privateKey'); }, test.limit.quick);
test.run('the table has a sealPublicKey column', 0.2, function () { return has('sealPublicKey'); }, test.limit.quick);
test.run('the table has a sealPrivateKey column', 0.2, function () { return has('sealPrivateKey'); }, test.limit.quick);
test.run('the table has an icon column', 0.2, function () { return has('icon'); }, test.limit.quick);
test.run('the table has a label column', 0.2, function () { return has('label'); }, test.limit.quick);
test.run('the table has an url column', 0.2, function () { return has('url'); }, test.limit.quick);
test.run('the table has an apiKey column', 0.2, function () { return has('apiKey'); }, test.limit.quick);
test.run('the table has an on column', 0.2, function () { return has('on'); }, test.limit.quick);
test.run('the table has a tags column', 0.2, function () { return has('tags'); }, test.limit.quick);
test.run('id is its one primary key', 0.2, function () {
  const pk = X.cols.filter(function (c) { return c.pk; }).map(function (c) { return c.name; });
  return pk.length === 1 && pk[0] === 'id' ? true : false;
}, test.limit.quick);
test.run('a bool field is kept as an INTEGER', 0.2, function () {
  return (X.cols.filter(function (c) { return c.name === 'on'; })[0] || {}).type === 'INTEGER' ? true : false;
}, test.limit.quick);

// ── add makes the row with its whole key set ──
test.run('add answers the id alone, an ed25519 public key', 0.2, function () {
  if (!X.verb) return false;
  const added = X.added = call(X.verb, { op: 'add', label: 'First', url: 'https://one.example', apiKey: SECRET, on: true, tags: JSON.stringify(['a', 'b']) });
  X.id = added && added.id;
  X.raw = isKey(X.id) ? X.db.prepare('SELECT * FROM "thing" WHERE id = ?').get(X.id) : null;
  return isKey(X.id) && Object.keys(added).length === 1 ? true : false;
}, test.limit.quick);
test.run('the row holds its private key, its seal public key and its seal private key beside the id', 0.2, function () {
  const raw = X.raw;
  return raw && /^MC4CAQAwBQYDK2Vw/.test(String(raw.privateKey)) && String(raw.sealPublicKey) && String(raw.sealPrivateKey) && raw.sealPublicKey !== raw.id
    ? true : false;
}, test.limit.quick);
test.run('the secret is kept as typed, the bool as 1, the list as JSON', 0.2, function () {
  const raw = X.raw;
  return raw && raw.apiKey === SECRET && raw.on === 1 && raw.tags === '["a","b"]' ? true : false;
}, test.limit.quick);
test.run('each add makes a key set of its own', 0.2, function () {
  if (!X.verb) return false;
  X.second = call(X.verb, { op: 'add', label: 'Second' });
  return isKey(X.second.id) && X.second.id !== X.id ? true : false;
}, test.limit.quick);
test.run('the table\'s own check is asked before the row is made', 0.2, function () {
  return X.checked && X.checked.op === 'add' ? true : false;
}, test.limit.quick);

// ── no secret leaves the table ──
const leaks = function (x) { const s = JSON.stringify(x); const raw = X.raw; return s.indexOf(SECRET) !== -1 || (raw && (s.indexOf(String(raw.privateKey)) !== -1 || s.indexOf(String(raw.sealPrivateKey)) !== -1)); };
test.run('get answers the row', 0.2, function () {
  if (!X.id) return false;
  const got = X.got = call(X.verb, { op: 'get', id: X.id });
  return got && got.id === X.id && got.label === 'First' && got.url === 'https://one.example' ? true : false;
}, test.limit.quick);
// A private half or a secret in an answer would leak it to whoever asks.
test.run('get carries no private half and no secret, only apiKeySet true', 0.8, function () {
  const got = X.got;
  return got && !('privateKey' in got) && !('sealPrivateKey' in got) && !('apiKey' in got) && got.apiKeySet === true ? true : false;
}, test.limit.quick);
test.run('get shows the bool as a bool and the list as a list', 0.2, function () {
  const got = X.got;
  return got && got.on === true && JSON.stringify(got.tags) === '["a","b"]' ? true : false;
}, test.limit.quick);
test.run('a row with no secret says apiKeySet false', 0.2, function () {
  if (!X.second || !X.second.id) return false;
  return call(X.verb, { op: 'get', id: X.second.id }).apiKeySet === false ? true : false;
}, test.limit.quick);
test.run('no published row carries a private half or a secret', 0.8, function () {
  return X.published.length >= 2 && !X.published.some(leaks) ? true : false;
}, test.limit.quick);
test.run('no search answer carries one either', 0.8, function () {
  if (!X.verb) return false;
  X.found = call(X.verb, { op: 'search', text: '' });
  return X.found && !leaks(X.found) ? true : false;
}, test.limit.quick);

// ── every change is published ──
test.run('add publishes the table and the row under agent, the row as get shows it', 0.2, function () {
  const p0 = X.published[0] && X.published[0].agent;
  return p0 && p0.table === 'thing' && p0.row && p0.row.id === X.id && p0.row.apiKeySet === true ? true : false;
}, test.limit.quick);

// ── set changes what it names and keeps the rest ──
const SET = { n: 0 };
test.run('a set of an id and a label answers the id, changes the label and keeps the url, the secret and the bool', 0.2, function () {
  if (!X.id) return false;
  SET.n = X.published.length;
  const set = call(X.verb, { op: 'set', id: X.id, label: 'Renamed' });
  const after = call(X.verb, { op: 'get', id: X.id });
  return set && set.id === X.id && after.label === 'Renamed' && after.url === 'https://one.example' && after.apiKeySet === true && after.on === true ? true : false;
}, test.limit.quick);
test.run('that set publishes the changed row', 0.2, function () {
  const n = SET.n, published = X.published;
  const ps = published[n] && published[n].agent;
  return published.length === n + 1 && ps && ps.row && ps.row.label === 'Renamed' ? true : false;
}, test.limit.quick);
test.run('set replaces a secret when it names one', 0.2, function () {
  if (!X.id) return false;
  call(X.verb, { op: 'set', id: X.id, apiKey: 'sk-another' });
  return X.db.prepare('SELECT apiKey FROM "thing" WHERE id = ?').get(X.id).apiKey === 'sk-another' ? true : false;
}, test.limit.quick);

// ── search answers the rows ranked, in one answer ──
const SR = { item: {}, shownRow: null, striped: null };
test.run('search with no words answers its items and more, with every row', 0.2, function () {
  const found = X.found;
  return found && Array.isArray(found.items) && typeof found.more === 'boolean' && found.items.length === 2 ? true : false;
}, test.limit.quick);
// goal/G41.18, Andy: "we talked about sending whole fucking rows in search, THAT IS NOT NEEDED for a table. only the ID
// and the fields shown in a table, that's all it needs."; "that exactly what GET is for, to bring in the rest for detail
// panels etc...". A whole row cost some 480 bytes, and one answer held 17 of them.
test.run('each item is keyed by the row\'s id, its label carrying the id', 0.2, function () {
  if (!X.found || !Array.isArray(X.found.items)) return false;
  const item = SR.item = X.found.items[0] || {};
  try { SR.shownRow = JSON.parse(item.label); } catch (e) { SR.shownRow = null; }
  return isKey(item.key) && SR.shownRow && SR.shownRow.id === item.key ? true : false;
}, test.limit.quick);
test.run('each item carries only what its list shows: by default the id, the icon and the label', 0.2, function () {
  const shownRow = SR.shownRow;
  return shownRow && JSON.stringify(Object.keys(shownRow).sort()) === '["icon","id","label"]' ? true : false;
}, test.limit.quick);
test.run('a search of words ranks the row that has them first', 0.2, function () {
  if (!X.id) return false;
  const hit = call(X.verb, { op: 'search', text: 'Renamed' });
  return hit.items.length >= 1 && hit.items[0].key === X.id ? true : false;
}, test.limit.quick);
test.run('it still ranks by the fields it does not answer: a word of the url finds its row', 0.2, function () {
  if (!X.id) return false;
  const byUrl = call(X.verb, { op: 'search', text: 'one.example' });
  return byUrl.items.length >= 1 && byUrl.items[0].key === X.id ? true : false;
}, test.limit.quick);
// THE WHOLE ROW AS ITS GET SERVES IT (goal/G41.28; Andy, box v15: "a probability search of a dataBase table must
// ALWAYS search the whole bloody ROW, as it is served through a single-row \"get\""): a word in a list field is found,
// and a secret, which no get serves, is never searched.
test.run('a word in a list field its get serves finds its row: the tag zebra', 0.2, function () {
  if (!X.verb) return false;
  SR.striped = call(X.verb, { op: 'add', label: 'Third', tags: JSON.stringify(['zebra']), apiKey: 'quokkasecret' });
  const byTag = call(X.verb, { op: 'search', text: 'zebra' });
  return !!SR.striped.id && byTag.items.length >= 1 && byTag.items[0].key === SR.striped.id ? true : false;
}, test.limit.quick);
// A secret that ranks its row lets a search guess it word by word.
test.run('a secret no get serves is never searched: its words find nothing', 0.8, function () {
  if (!SR.striped || !SR.striped.id) return false;
  const striped = SR.striped;
  const bySecret = call(X.verb, { op: 'search', text: 'quokkasecret' });
  const verdict = !bySecret.items.some(function (i) { return i.key === striped.id && Number(i.probability || i.score || 0) > 0; }) && (bySecret.items[0] || {}).key !== striped.id
    ? true : false;
  call(X.verb, { op: 'delete', id: striped.id });
  return verdict;
}, test.limit.quick);
// A table names what its list shows (def.listed); its search answers the id and those fields alone. (def.shows is
// another thing: fields computed onto every row shown, as the model's providerIcon.)
const SL = { slim: null, sid: '' };
test.run('a table that lists the url answers the id and the url in a search, nothing else', 0.2, function () {
  if (!X.db) return false;
  const slim = SL.slim = X.mod.rowTable(X.db, { name: 'slim', fields: { url: 'url?', apiKey: 'text?' }, secret: ['apiKey'], listed: ['url'] }, function () {});
  const sid = SL.sid = call(slim.verb, { op: 'add', label: 'Hidden label', url: 'https://slim.example', apiKey: SECRET }).id;
  let row = null; try { row = JSON.parse((call(slim.verb, { op: 'search', text: '' }).items || [])[0].label); } catch (e) { row = null; }
  return row && row.id === sid && row.url === 'https://slim.example' && JSON.stringify(Object.keys(row).sort()) === '["id","url"]' ? true : false;
}, test.limit.quick);
test.run('on a table that lists the url, get still answers the whole row', 0.2, function () {
  if (!SL.slim) return false;
  return call(SL.slim.verb, { op: 'get', id: SL.sid }).label === 'Hidden label' ? true : false;
}, test.limit.quick);
// A SEARCH NARROWED BY A FIELD (goal/G41.21, box v17: "showing only the models whose provider is this provider";
// "Narrowing a pick field to one provider's models is new"): a search naming one of the table's own fields answers
// only the rows whose field holds that value, ranked as before.
const KD = { kids: null, A: '', B: '', a1: '', a2: '', b1: '' };
const keysOf = function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }).sort(); };
test.run('a search naming parentId answers only the rows whose parentId is it', 0.2, function () {
  if (!X.db) return false;
  const kids = KD.kids = X.mod.rowTable(X.db, { name: 'kid', fields: { parentId: 'key?' } }, function () {});
  KD.A = call(kids.verb, { op: 'add', label: 'Parent A' }).id;
  KD.B = call(kids.verb, { op: 'add', label: 'Parent B' }).id;
  KD.a1 = call(kids.verb, { op: 'add', label: 'First of A', parentId: KD.A }).id;
  KD.a2 = call(kids.verb, { op: 'add', label: 'Second of A', parentId: KD.A }).id;
  KD.b1 = call(kids.verb, { op: 'add', label: 'First of B', parentId: KD.B }).id;
  const ofA = call(kids.verb, { op: 'search', text: '', parentId: KD.A });
  return JSON.stringify(keysOf(ofA)) === JSON.stringify([KD.a1, KD.a2].sort()) ? true : false;
}, test.limit.quick);
test.run('a search naming parentId and words answers only its rows, ranked by the words', 0.2, function () {
  if (!KD.kids) return false;
  const firstOfB = call(KD.kids.verb, { op: 'search', text: 'First', parentId: KD.B });
  return JSON.stringify(keysOf(firstOfB)) === JSON.stringify([KD.b1]) ? true : false;
}, test.limit.quick);
test.run('a value no row holds answers no rows', 0.2, function () {
  if (!KD.kids) return false;
  const none = call(KD.kids.verb, { op: 'search', text: '', parentId: KD.b1 });
  return none && Array.isArray(none.items) && none.items.length === 0 && none.more === false ? true : false;
}, test.limit.quick);
test.run('a search naming no field answers every row, as before', 0.2, function () {
  if (!KD.kids) return false;
  return call(KD.kids.verb, { op: 'search', text: '' }).items.length === 5 ? true : false;
}, test.limit.quick);

// ── a table names its mandatory fields, and takes no row without them (goal/G41.21) ──
// Andy: "NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!", "for a new row, a valid label (NOT empty) IS THE MINIMUM
// required", "# mandatory fields (server AND ui)". A table's def.required names them; the provider, persona and job
// tables name theirs (their own tests).
const ND = { need: null, missing: null, blank: null, bare: null, whole: null };
const needRows = function () { return X.db.prepare('SELECT COUNT(*) AS n FROM "need"').get().n; };
test.run('an add missing a mandatory field, or with one of blanks, is refused and makes no row', 0.2, function () {
  if (!X.db) return false;
  const need = ND.need = X.mod.rowTable(X.db, { name: 'need', fields: { url: 'url?' }, required: ['icon', 'label', 'url'] }, function () {});
  ND.missing = call(need.verb, { op: 'add', label: 'No icon', url: 'https://need.example' });
  ND.blank = call(need.verb, { op: 'add', icon: '🧪', label: ' ', url: 'https://need.example' });
  ND.bare = call(need.verb, { op: 'add' });
  return [ND.missing, ND.blank, ND.bare].every(function (r) { return r.refusal && !r.id; }) && needRows() === 0 ? true : false;
}, test.limit.quick);
test.run('the refusal names every mandatory field missing', 0.2, function () {
  if (!ND.need) return false;
  const missing = ND.missing, blank = ND.blank, bare = ND.bare;
  return (/icon/).test(String(missing.why)) && /label/.test(String(blank.why)) && /icon/.test(String(bare.why)) && /label/.test(String(bare.why)) && /url/.test(String(bare.why))
    ? true : false;
}, test.limit.quick);
test.run('an add with every mandatory field is added', 0.2, function () {
  if (!ND.need) return false;
  ND.whole = call(ND.need.verb, { op: 'add', icon: '🧪', label: 'Whole', url: 'https://need.example' });
  return isKey(ND.whole.id) && needRows() === 1 ? true : false;
}, test.limit.quick);
test.run('a change that would empty a mandatory field is refused, the row kept', 0.2, function () {
  if (!ND.whole || !ND.whole.id) return false;
  const emptied = call(ND.need.verb, { op: 'set', id: ND.whole.id, icon: '' });
  return emptied.refusal && /icon/.test(String(emptied.why)) && call(ND.need.verb, { op: 'get', id: ND.whole.id }).icon === '🧪' ? true : false;
}, test.limit.quick);
test.run('a change that keeps them all is taken', 0.2, function () {
  if (!ND.whole || !ND.whole.id) return false;
  return !call(ND.need.verb, { op: 'set', id: ND.whole.id, label: 'Renamed' }).refusal ? true : false;
}, test.limit.quick);
test.run('a table naming none takes a bare row, as before', 0.2, function () {
  if (!X.db) return false;
  const free = X.mod.rowTable(X.db, { name: 'free', fields: { url: 'url?' } }, function () {});
  return isKey(call(free.verb, { op: 'add' }).id) ? true : false;
}, test.limit.quick);

// ── a refusal says why ──
test.run('an op it does not know is refused, naming the ops', 0.2, function () {
  if (!X.verb) return false;
  const unknownOp = call(X.verb, { op: 'fly' });
  return unknownOp.refusal === 'bad-request' && /add, set, delete, get, search/.test(unknownOp.why) ? true : false;
}, test.limit.quick);
// The face's calls once reached the tables with verb among the arguments (goal/G41.4: "Not added: job takes no argument
// verb"); the table refuses what it does not declare, and says which.
test.run('an argument it does not declare is refused as no-such-argument, naming it', 0.2, function () {
  if (!X.verb) return false;
  const stray = call(X.verb, { op: 'add', verb: 'thing' });
  return stray.refusal === 'no-such-argument' && /verb/.test(stray.why) ? true : false;
}, test.limit.quick);
test.run('the table\'s own check refuses with its words', 0.2, function () {
  if (!X.verb) return false;
  const badUrl = call(X.verb, { op: 'add', url: 'https://refused.example' });
  return badUrl.refusal === 'bad-request' && /thing: that url is refused/.test(badUrl.why) ? true : false;
}, test.limit.quick);
test.run('an add the table\'s own check refuses writes no row', 0.2, function () {
  if (!X.db) return false;
  const before = X.db.prepare('SELECT count(*) AS n FROM "thing"').get().n;
  return before === 2 ? true : false;
}, test.limit.quick);
test.run('get of a row that is not there is refused no-such-row', 0.2, function () {
  if (!X.verb) return false;
  const missing = call(X.verb, { op: 'get', id: S.requireScript('spirit/relayAuth.js').generateIdentity('').publicKey });
  return missing.refusal === 'no-such-row' ? true : false;
}, test.limit.quick);

// ── has, label and icon ──
test.run('has says whether the row of an id is there', 0.2, function () {
  if (!X.id) return false;
  call(X.verb, { op: 'set', id: X.id, icon: '🧪' });
  return X.t.has(X.id) && !X.t.has('nope') ? true : false;
}, test.limit.quick);
test.run('label answers the row\'s label, an empty text when the row is not there', 0.2, function () {
  if (!X.id) return false;
  return X.t.label(X.id) === 'Renamed' && X.t.label('nope') === '' ? true : false;
}, test.limit.quick);
test.run('icon answers the row\'s icon, an empty text when the row is not there', 0.2, function () {
  if (!X.id) return false;
  return X.t.icon(X.id) === '🧪' && X.t.icon('nope') === '' ? true : false;
}, test.limit.quick);

// ── delete removes the row and says so ──
const DL = { m: 0 };
test.run('delete of an id answers the id, removes the row and tells the table\'s deleted', 0.2, function () {
  if (!X.second || !X.second.id) return false;
  DL.m = X.published.length;
  const del = call(X.verb, { op: 'delete', id: X.second.id });
  return del.id === X.second.id && !X.t.has(X.second.id) && X.deleted === X.second.id ? true : false;
}, test.limit.quick);
test.run('delete publishes the table and the id under agent, marked removed', 0.2, function () {
  if (!X.second || !X.second.id) return false;
  const pd = X.published[DL.m] && X.published[DL.m].agent;
  return pd && pd.table === 'thing' && pd.id === X.second.id && pd.removed === true && !pd.row ? true : false;
}, test.limit.quick);
test.run('a second delete of it is refused no-such-row', 0.2, function () {
  if (!X.second || !X.second.id) return false;
  return call(X.verb, { op: 'delete', id: X.second.id }).refusal === 'no-such-row' ? true : false;
}, test.limit.quick);

// ── the rows persist in agent.db ──
test.run('opened again on the same file, the table has its rows', 0.2, function () {
  if (!X.db) return false;
  X.db.close();
  const again = X.mod.rowTable(new DatabaseSync(X.dbFile), X.def, function () {});
  return again.has(X.id) && again.label(X.id) === 'Renamed' ? true : false;
}, test.limit.quick);
