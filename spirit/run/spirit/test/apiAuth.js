'use strict';

// spirit/run/spirit/test/apiAuth.js
// The tests of spirit/apiAuth.js's two bundle verbs, auth.bundle and auth.branch, and their tables in node.db (spec:
// ./apiAuth.md; goal/G41.14). The verbs are called as server.js calls them, on a scratch root of the test's own, so its
// node.db is the test's alone, and the live tree is the test's stand-in.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const FILE = path.join(RUN, 'spirit', 'apiAuth.js');
const FAMILY = path.join(RUN, 'spirit', 'auth', 'api.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
const isNum = function (k) { return typeof k === 'number' && Number.isInteger(k) && k > 0; };
// One call, answered or refused, as server.js hands it on.
async function call(auth, verb, a) { try { return (await auth[verb](a)) || {}; } catch (e) { return { threw: e && e.message, refusal: e && e.refusal }; } }
const parsed = function (item) { try { return JSON.parse(item.label); } catch (e) { return null; } };

// Every test's names, shared down the sequence: each test assigns what later ones read.
let family, verbs, b, r, bj, createApiAuth, root, tree, auth, reader, desk, got, renamed, all, row, hit, whole, one, noVerb, g, keysOf, ofDesk, ofFiles, ofVerb, every, db, colsOf, names, idx, tables, del, left, gone, PEER, kept, told, tb, tr, tr2, n, toldG, GPEER, plain, asked, mine, mdb, afterSet, badIn, kdb, kept2, odb, wrote, outGet, outItem, owned, ofNode, every2, bootRoot, probeDir, bootTree, boot, ownedBy, settleBoot, a1, all1, records, heldMade, hdb, aU, heldRow, first, countOf, twice, other, twoCase, reborn, hb, addB, setB, delB, nb, nbr, nset, ndel, fsRoot, fsTree, fsAuth, fsBundle, keptId, addedloadFile, addedpath, addedsaveFile, moved, again;

// The two verbs, declared.
test.run('spirit/auth/api.js declares bundle { op, id, label, text, owner }: a numeric id, a label, an owner left out at will, nothing more', 0.2, async function () {
  family = require(FAMILY);
  verbs = (family && family.verbs) || {};
  // Andy, box: "The interfaces to those two tables are TWO verbs under the auth family, auth.bundle and auth.branch,
  // akin to the <tableName> verbs of the agent app: op add, set, delete, get and search. Granted, no review."
  b = verbs.bundle;
  // goal/G41.25, box: "the bundle table gains 1 field: \"owner\"", and "changes to the auth.bundle verb for the addition
  // of the \"owner\" field are approved by andy and need no review."
  return (b && b.op === 'id' && b.id === 'number?' && b.label === 'name?' && b.text === 'text?' && typeof b.owner === 'string' && /\?$/.test(b.owner) && Object.keys(b).length === 5) ? true : 'bundle: ' + short(b);
}, 1000);

test.run('and branch { op, id, bundle, family, verb, text }, flat as the agent tables\' verbs', 0.2, async function () {
  r = verbs.branch;
  return (r && r.op === 'id' && r.id === 'number?' && r.bundle === 'number?' && r.family === 'text?' && r.verb === 'text?' && r.text === 'text?' && Object.keys(r).length === 6) ? true : 'branch: ' + short(r);
}, 1000);

test.run('spirit/auth/bundle.json describes the verb and its request', 0.2, async function () {
  return (!!(function (d) { return d && typeof d.description === 'string' && d.description && d.request && 'op' in d.request; }(readJson(path.join(RUN, 'spirit', 'auth', 'bundle.json'))))) ? true : 'bundle.json: ' + short(readJson(path.join(RUN, 'spirit', 'auth', 'bundle.json')));
}, 1000);

test.run('spirit/auth/branch.json describes the verb and its request', 0.2, async function () {
  return (!!(function (d) { return d && typeof d.description === 'string' && d.description && d.request && 'op' in d.request; }(readJson(path.join(RUN, 'spirit', 'auth', 'branch.json'))))) ? true : 'branch.json: ' + short(readJson(path.join(RUN, 'spirit', 'auth', 'branch.json')));
}, 1000);

test.run('spirit/auth/bundle.json names the owner in its request and its description, and offers no op set {...} (goal/G41.26; its words may say set is refused)', 0.2, async function () {
  bj = readJson(path.join(RUN, 'spirit', 'auth', 'bundle.json'));
  return (bj && bj.request && 'owner' in bj.request && /owner/.test(String(bj.description || '')) && !/\bset \{/.test(String(bj.description || ''))) ? true : 'bundle.json: ' + short(bj);
}, 1000);

test.run('createApiAuth answers bundle(a) and branch(a) beside grant and revoke', 0.2, async function () {
  createApiAuth = require(FILE).createApiAuth;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-'));
  // goal/G41.25: agent is an app server of the tree, so a bundle it owns names a server the node has.
  tree = { files: { read: {}, list: {} }, desk: { 'chat.add': {}, 'item.get': {} }, agent: { job: {} } };
  auth = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  return (typeof auth.bundle === 'function' && typeof auth.branch === 'function') ? true : 'verbs: ' + short(Object.keys(auth));
}, 1000);

// A bundle: a hidden number and a label.
test.run('add {label} answers { id }, a number the node gives it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  reader = await call(auth, 'bundle', { op: 'add', label: 'Reader' });
  return (isNum(reader.id)) ? true : 'add: ' + short(reader);
}, 2000);

test.run('each add a number of its own', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  desk = await call(auth, 'bundle', { op: 'add', label: 'Deskhand' });
  return (isNum(desk.id) && desk.id !== reader.id) ? true : 'second: ' + short(desk);
}, 1000);

test.run('a label that is empty, or none, is refused bad-request', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'bundle', { op: 'add', label: '' })).refusal === 'bad-request' && (await call(auth, 'bundle', { op: 'add' })).refusal === 'bad-request') ? true : 'empty label answered';
}, 1000);

test.run('get {id} answers { id, label, owner }, no description, no paths', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  got = await call(auth, 'bundle', { op: 'get', id: reader.id });
  return (got.id === reader.id && got.label === 'Reader' && got.owner === 'node' && Object.keys(got).length === 3) ? true : 'get: ' + short(got);
}, 1000);

// goal/G41.26, Andy, box: "A bundles label is determined when it's added, and cannot be modified. This will protect
// family owned bundles from having their label mutilated. the auth.bundle set op will be removed."
test.run('there is no set op: a set is refused bad-request and the label stays what the add made it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  renamed = await call(auth, 'bundle', { op: 'set', id: reader.id, label: 'Lister' });
  return (renamed.refusal === 'bad-request' && (await call(auth, 'bundle', { op: 'get', id: reader.id })).label === 'Reader') ? true : 'set: ' + short(renamed) + ', get ' + short(await call(auth, 'bundle', { op: 'get', id: reader.id }));
}, 1000);

test.run('search with no words answers { items, more }, every bundle', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  all = await call(auth, 'bundle', { op: 'search', text: '' });
  return (Array.isArray(all.items) && typeof all.more === 'boolean' && all.items.length === 2) ? true : 'search: ' + short(all);
}, 1000);

test.run('each item keyed by the bundle\'s id, its label the bundle as get shows it, its owner with it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  row = all.items && parsed(all.items.filter(function (i) { return String(i.key) === String(reader.id); })[0] || {});
  return (row && row.id === reader.id && row.label === 'Reader' && row.owner === 'node') ? true : 'item: ' + short(row);
}, 1000);

test.run('a search of words ranks the bundle that has them first', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  hit = await call(auth, 'bundle', { op: 'search', text: 'Deskhand' });
  return (hit.items && hit.items.length >= 1 && String(hit.items[0].key) === String(desk.id)) ? true : 'search: ' + short(hit.items);
}, 1000);

// A branch: a bundle, a family of the tree, a verb of it or all.
test.run('add {bundle, family, verb} answers { id }, a number', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  whole = await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'files', verb: '' });
  return (isNum(whole.id)) ? true : 'add: ' + short(whole);
}, 1000);

test.run('a branch may name a single verb', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  one = await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'desk', verb: 'chat.add' });
  return (isNum(one.id) && one.id !== whole.id) ? true : 'add: ' + short(one);
}, 1000);

test.run('a verb left out is the empty verb, all of the family', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  noVerb = await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'files' });
  return (isNum(noVerb.id) && (await call(auth, 'branch', { op: 'get', id: noVerb.id })).verb === '') ? true : 'no verb: ' + short(noVerb);
}, 1000);

test.run('get {id} answers { id, bundle, family, verb }', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  g = await call(auth, 'branch', { op: 'get', id: one.id });
  return (g.id === one.id && g.bundle === desk.id && g.family === 'desk' && g.verb === 'chat.add' && Object.keys(g).length === 4) ? true : 'get: ' + short(g);
}, 1000);

// A branch is refused unless it is valid.
// Andy, box: "a new branch row must contain a valid reference to a bundle row, and a valid reference to a family of
// the nodes API tree", "family and verb fields MUST be validated against the nodes API tree when a row is added or
// changed, and refused if the values are not valid", and "two branch rows referencing the same bundle row MUST NOT
// ... contain the same family AND verb values".
test.run('a bundle that is not there is refused no-such-bundle', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'add', bundle: 99999, family: 'files', verb: '' })).refusal === 'no-such-bundle') ? true : 'no bundle answered';
}, 1000);

test.run('no family is refused bad-request', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'add', bundle: reader.id, verb: 'read' })).refusal === 'bad-request') ? true : 'no family answered';
}, 1000);

test.run('a family the tree does not serve is refused no-such-family', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'nowhere', verb: '' })).refusal === 'no-such-family') ? true : 'bad family answered';
}, 1000);

test.run('a verb the family does not serve is refused no-such-verb', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'files', verb: 'write' })).refusal === 'no-such-verb') ? true : 'bad verb answered';
}, 1000);

test.run('the same family and verb twice in one bundle is refused already-in-bundle', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'desk', verb: 'chat.add' })).refusal === 'already-in-bundle') ? true : 'duplicate answered';
}, 1000);

test.run('the same family and verb in another bundle is a branch of its own', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return (isNum((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'desk', verb: 'chat.add' })).id)) ? true : 'other bundle refused';
}, 1000);

test.run('a set is checked against the tree as an add is', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'set', id: one.id, verb: 'write' })).refusal === 'no-such-verb') ? true : 'bad set answered';
}, 1000);

test.run('and a set that would make a duplicate is refused already-in-bundle', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'set', id: one.id, family: 'files', verb: '' })).refusal === 'already-in-bundle') ? true : 'duplicate set answered';
}, 1000);

test.run('a valid set changes what it names and keeps the rest', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await call(auth, 'branch', { op: 'set', id: one.id, verb: 'item.get' });
  return ((await call(auth, 'branch', { op: 'get', id: one.id })).verb === 'item.get' && (await call(auth, 'branch', { op: 'get', id: one.id })).family === 'desk') ? true : 'after set: ' + short(await call(auth, 'branch', { op: 'get', id: one.id }));
}, 1000);

test.run('get or delete of a branch that is not there is refused no-such-branch', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'branch', { op: 'get', id: 99999 })).refusal === 'no-such-branch' && (await call(auth, 'branch', { op: 'delete', id: 99999 })).refusal === 'no-such-branch') ? true : 'missing branch answered';
}, 1000);

test.run('a bundle that is not there is refused no-such-bundle; an op neither verb knows, bad-request', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(auth, 'bundle', { op: 'get', id: 99999 })).refusal === 'no-such-bundle' && (await call(auth, 'bundle', { op: 'fly' })).refusal === 'bad-request' && (await call(auth, 'branch', { op: 'fly' })).refusal === 'bad-request') ? true : 'refusals answered';
}, 1000);

// The branch search filters by bundle, family and verb.
// Andy, box: "the auth.branch search needs \"bundle\", \"family\" and \"verb\" filters."
test.run('bundle narrows to that bundle\'s branches', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  keysOf = async function (a) { const s = await call(auth, 'branch', Object.assign({ op: 'search', text: '' }, a)); return (s.items || []).map(function (i) { return parsed(i); }); };
  ofDesk = await keysOf({ bundle: desk.id });
  return (ofDesk.length === 2 && ofDesk.every(function (x) { return x && x.bundle === desk.id; })) ? true : 'bundle filter: ' + short(ofDesk);
}, 1000);

test.run('family narrows to that family', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  ofFiles = await keysOf({ family: 'files' });
  return (ofFiles.length === 2 && ofFiles.every(function (x) { return x.family === 'files'; })) ? true : 'family filter: ' + short(ofFiles);
}, 1000);

test.run('verb narrows to that verb', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  ofVerb = await keysOf({ family: 'desk', verb: 'chat.add' });
  return (ofVerb.length === 1 && ofVerb[0].bundle === reader.id) ? true : 'verb filter: ' + short(ofVerb);
}, 1000);

test.run('no filter, or an empty one, is every branch, each item its branch as get shows it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  every = await keysOf({});
  return (every.length === 4 && every.every(function (x) { return x && isNum(x.id) && 'verb' in x; })) ? true : 'no filter: ' + short(every);
}, 1000);

test.run('an empty family or verb filter narrows nothing', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await keysOf({ family: '', verb: '' })).length === 4) ? true : 'empty filters narrowed';
}, 1000);

// The two tables in node.db, and the old ones gone.
test.run('node.db has bundle (id, an integer key; label; owner)', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  db = new DatabaseSync(path.join(root, 'spirit', 'state', 'node.db'));
  colsOf = function (t) { try { return db.prepare('PRAGMA table_info(' + JSON.stringify(t) + ')').all(); } catch (e) { return []; } };
  names = function (cols) { return cols.map(function (x) { return x.name + (x.pk ? '*' : ''); }).sort(); };
  return (JSON.stringify(names(colsOf('bundle'))) === '["id*","label","owner"]' && /INT/i.test((colsOf('bundle').filter(function (c) { return c.name === 'id'; })[0] || {}).type || '')) ? true : 'bundle: ' + short(colsOf('bundle'));
}, 1000);

test.run('and branch (id, the key; bundle, family, verb)', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return (JSON.stringify(names(colsOf('branch'))) === '["bundle","family","id*","verb"]') ? true : 'branch: ' + short(names(colsOf('branch')));
}, 1000);

test.run('branch.bundle is indexed', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  idx = (function () { try { return db.prepare('PRAGMA index_list("branch")').all().map(function (i) { return db.prepare('PRAGMA index_info(' + JSON.stringify(i.name) + ')').all().map(function (c) { return c.name; }); }); } catch (e) { return []; } }());
  return (idx.some(function (cols) { return cols[0] === 'bundle'; })) ? true : 'indexes: ' + short(idx);
}, 1000);

test.run('the old bundles and bundle_paths tables are made no more', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  tables = db.prepare('SELECT name FROM sqlite_master WHERE type = \'table\'').all().map(function (t) { return t.name; });
  return (tables.indexOf('bundles') === -1 && tables.indexOf('bundle_paths') === -1) ? true : 'tables: ' + short(tables);
}, 1000);

// Deleting a bundle deletes its branches.
test.run('delete {id} removes the bundle and answers { id }', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  del = await call(auth, 'bundle', { op: 'delete', id: desk.id });
  return (del.id === desk.id && (await call(auth, 'bundle', { op: 'get', id: desk.id })).refusal === 'no-such-bundle') ? true : 'delete: ' + short(del);
}, 1000);

test.run('and every branch that names it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  left = db.prepare('SELECT COUNT(*) AS n FROM branch WHERE bundle = ?').get(desk.id).n;
  return (left === 0 && (await keysOf({ bundle: desk.id })).length === 0 && (await call(auth, 'branch', { op: 'get', id: noVerb.id })).refusal === 'no-such-branch') ? true : 'branches left: ' + left;
}, 1000);

test.run('another bundle\'s branches stay', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await keysOf({ bundle: reader.id })).length === 2) ? true : 'reader\'s: ' + short(await keysOf({ bundle: reader.id }));
}, 1000);

test.run('branch delete {id} removes that branch alone', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  gone = await call(auth, 'branch', { op: 'delete', id: whole.id });
  return (gone.id === whole.id && (await keysOf({ bundle: reader.id })).length === 1) ? true : 'delete: ' + short(gone);
}, 1000);

test.run('a grant made from a bundle stays when the bundle goes', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  db.close();
  // A bundle is not granted by reference.
  // Andy, box: "a bundle is a bundle, and in itself does not constitute an authorization."
  PEER = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  kept = await call(auth, 'bundle', { op: 'add', label: 'Kept' });
  await call(auth, 'branch', { op: 'add', bundle: kept.id, family: 'files', verb: 'read' });
  await auth.grant({ key: PEER, path: 'files.read' });
  await call(auth, 'bundle', { op: 'delete', id: kept.id });
  return (JSON.stringify(auth.pathsOf(PEER)) === '["files.read"]') ? true : 'paths of the peer: ' + short(auth.pathsOf(PEER));
}, 1000);

// Every change is told, row by row, for the stream.
// Andy, goal/G41.14: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set. and the
// SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the fucking elements".
// The node publishes each changed row on one permanent job, as it does each contact row (server.js, the shadow job);
// apiAuth tells it: onChange(fn), fn({ table, row }) for a row added or set, fn({ table, row: { id }, gone: true }) for
// one deleted, a bundle's branches each told gone with it.
test.run('createApiAuth answers onChange(fn), what the node publishes from', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return (typeof auth.onChange === 'function') ? true : 'verbs: ' + short(Object.keys(auth));
}, 1000);

test.run('a bundle added is told { table: bundle, row }, the row as get shows it, its owner with it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  told = [];
  auth.onChange(function (c) { told.push(JSON.parse(JSON.stringify(c))); });
  tb = await call(auth, 'bundle', { op: 'add', label: 'Told' });
  return (told.length === 1 && told[0].table === 'bundle' && told[0].row.id === tb.id && told[0].row.label === 'Told' && told[0].row.owner === 'node' && !told[0].gone) ? true : 'told: ' + short(told);
}, 1000);

test.run('a refused set tells nothing (goal/G41.26: there is no set op)', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await call(auth, 'bundle', { op: 'set', id: tb.id, label: 'Told again' });
  return (told.length === 1) ? true : 'told: ' + short(told.slice(1));
}, 1000);

test.run('a branch added is told { table: branch, row }', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  tr = await call(auth, 'branch', { op: 'add', bundle: tb.id, family: 'files', verb: 'read' });
  return (told.length === 2 && told[1].table === 'branch' && told[1].row.id === tr.id && told[1].row.bundle === tb.id && told[1].row.family === 'files' && told[1].row.verb === 'read') ? true : 'told: ' + short(told.slice(1));
}, 1000);

test.run('a branch set is told with its new row', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await call(auth, 'branch', { op: 'set', id: tr.id, verb: 'list' });
  return (told.length === 3 && told[2].table === 'branch' && told[2].row.verb === 'list') ? true : 'told: ' + short(told.slice(2));
}, 1000);

test.run('a bundle deleted is told gone, and each of its branches with it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  tr2 = await call(auth, 'branch', { op: 'add', bundle: tb.id, family: 'desk', verb: '' });
  await call(auth, 'bundle', { op: 'delete', id: tb.id });
  gone = told.slice(4);
  return (gone.some(function (c) { return c.table === 'bundle' && c.gone === true && c.row.id === tb.id; }) &&
    [tr.id, tr2.id].every(function (id) { return gone.some(function (c) { return c.table === 'branch' && c.gone === true && c.row.id === id; }); })) ? true : 'told: ' + short(gone);
}, 1000);

test.run('a refused add tells nothing', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  n = told.length;
  await call(auth, 'bundle', { op: 'add', label: '' });
  await call(auth, 'branch', { op: 'add', bundle: 99999, family: 'files', verb: '' });
  return (told.length === n) ? true : 'told: ' + short(told.slice(n));
}, 1000);

// A grant made or revoked is told too.
// Andy, goal/G41.14: "SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????", "FIX THEN NOW!!!". A grant row is
// { key, path, label }, one per peer and path, told { table: grant, row } when made and { table, row: { key, path },
// gone: true } when revoked.
test.run('a grant made is told { table: grant, row: { key, path, label } }', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  toldG = [];
  auth.onChange(function (c) { if (c && c.table === 'grant') toldG.push(JSON.parse(JSON.stringify(c))); });
  GPEER = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  await auth.grant({ key: GPEER, path: 'files.list' });
  return (toldG.length === 1 && toldG[0].row.key === GPEER && toldG[0].row.path === 'files.list' && typeof toldG[0].row.label === 'string' && !toldG[0].gone) ? true : 'told: ' + short(toldG);
}, 1000);

test.run('a grant refused already-granted tells nothing', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await auth.grant({ key: GPEER, path: 'files.list' });
  return (toldG.length === 1) ? true : 'told: ' + short(toldG);
}, 1000);

test.run('a grant revoked is told gone, by key and path', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await auth.revoke({ key: GPEER, path: 'files.list' });
  return (toldG.length === 2 && toldG[1].gone === true && toldG[1].row.key === GPEER && toldG[1].row.path === 'files.list') ? true : 'told: ' + short(toldG);
}, 1000);

test.run('a revoke refused not-granted tells nothing', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await auth.revoke({ key: GPEER, path: 'files.list' });
  return (toldG.length === 2) ? true : 'told: ' + short(toldG);
}, 1000);

// Goal/G41.25: a bundle's owner, "node" or an app server.
// Andy, box: "the bundle table gains 1 field: \"owner\", which can contains either \"node\" (default), or the name of
// an appServer", "the owner field can never be changed after a bundle is added", and "for bundles without a valid
// \"owner\" field, the auth.bundle verb will replace the content of the invalid \"owner\" field with \"node\", incoming
// or outgoing."
test.run('a bundle added with no owner is owned by "node"', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  plain = await call(auth, 'bundle', { op: 'add', label: 'Plain' });
  return ((await call(auth, 'bundle', { op: 'get', id: plain.id })).owner === 'node') ? true : 'get: ' + short(await call(auth, 'bundle', { op: 'get', id: plain.id }));
}, 1000);

// goal/G41.32, the box: "A user can only create, change and delete node-owned bundles and branches": a server's bundle
// is never made through this verb, so one is made in the table here.
test.run('a user\'s add naming an app server as owner is refused', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  asked = await call(auth, 'bundle', { op: 'add', label: 'For the agent', owner: 'agent' });
  return (!!asked.refusal && !isNum(asked.id)) ? true : 'an add naming an app server answered ' + short(asked);
}, 1000);

test.run('the owner never changes after the add: a set naming another owner is refused and leaves it as it was', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  mine = await call(auth, 'bundle', { op: 'add', label: 'For the agent, in the table' });
  mdb = new DatabaseSync(path.join(root, 'spirit', 'state', 'node.db'));
  mdb.prepare('UPDATE bundle SET owner = ? WHERE id = ?').run('agent', mine.id);
  mdb.close();
  await call(auth, 'bundle', { op: 'set', id: mine.id, owner: 'desk' });
  await call(auth, 'bundle', { op: 'set', id: mine.id, label: 'Agent tools', owner: 'node' });
  await call(auth, 'bundle', { op: 'set', id: plain.id, owner: 'agent' });
  afterSet = await call(auth, 'bundle', { op: 'get', id: mine.id });
  return (afterSet.owner === 'agent' && (await call(auth, 'bundle', { op: 'get', id: plain.id })).owner === 'node') ? true : 'after set: ' + short(afterSet);
}, 1000);

// Incoming: an add whose owner is not valid stores "node".
test.run('an add whose owner is not valid (empty, not a text, not a name) is owned by "node"', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  badIn = [];
  for (const bad of ['', 42, 'not a name!', 'a.b', null]) {
    const r = await call(auth, 'bundle', { op: 'add', label: 'Bad ' + badIn.length, owner: bad });
    badIn.push([bad, isNum(r.id) ? (await call(auth, 'bundle', { op: 'get', id: r.id })).owner : r, r.id]);
  }
  return (badIn.every(function (x) { return x[1] === 'node'; })) ? true : 'owners: ' + short(badIn);
}, 1000);

// Incoming means kept: the table itself holds "node" for each, not the invalid owner read out as "node".
test.run('and the table keeps "node" for it, never the owner it was given', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  kdb = new DatabaseSync(path.join(root, 'spirit', 'state', 'node.db'), { readOnly: true });
  kept2 = badIn.map(function (x) { try { const r = kdb.prepare('SELECT owner FROM bundle WHERE id = ?').get(x[2]); return r && r.owner; } catch (e) { return null; } });
  kdb.close();
  return (kept2.length === badIn.length && kept2.every(function (v) { return v === 'node'; })) ? true : 'kept: ' + short(kept2);
}, 1000);

// Outgoing: a row the table holds with an owner that is not valid is answered "node", by get, search and the stream.
test.run('a kept row whose owner is not valid is answered "node", by get and by search', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  odb = new DatabaseSync(path.join(root, 'spirit', 'state', 'node.db'));
  wrote = true;
  try { odb.prepare('UPDATE bundle SET owner = ? WHERE id = ?').run('not a name!', plain.id); } catch (e) { wrote = false; }
  odb.close();
  outGet = await call(auth, 'bundle', { op: 'get', id: plain.id });
  outItem = ((await call(auth, 'bundle', { op: 'search', text: '' })).items || []).map(parsed).filter(function (x) { return x && x.id === plain.id; })[0];
  return (wrote && outGet.owner === 'node' && outItem && outItem.owner === 'node') ? true : 'wrote ' + wrote + ', get ' + short(outGet) + ', item ' + short(outItem);
}, 1000);

// Goal/G41.25: the search narrowed to one owner.
// Andy, box: "if the bundleSelector IS configured for an appServer, then it will only list bundles \"owned\" by that
// Appserver"; the selector asks the node for them, as every narrowed list does (cw, agreed in the item's chat).
test.run('search {text, owner} answers that owner\'s bundles alone', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  owned = ((await call(auth, 'bundle', { op: 'search', text: '', owner: 'agent' })).items || []).map(parsed);
  return (owned.length === 1 && owned[0] && owned[0].id === mine.id && owned[0].owner === 'agent') ? true : 'items: ' + short(owned);
}, 1000);

test.run('owner "node" answers the node\'s bundles alone, a row read as "node" among them', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  ofNode = ((await call(auth, 'bundle', { op: 'search', text: '', owner: 'node' })).items || []).map(parsed);
  return (ofNode.length > 1 && ofNode.every(function (x) { return x && x.owner === 'node'; })) ? true : 'items: ' + short(ofNode);
}, 1000);

test.run('no owner is every bundle, whoever owns it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  every2 = ((await call(auth, 'bundle', { op: 'search', text: '' })).items || []).map(parsed);
  return (every2.some(function (x) { return x && x.owner === 'agent'; }) && every2.some(function (x) { return x && x.owner === 'node'; })) ? true : 'items: ' + short(every2);
}, 1000);

test.run('an empty owner narrows nothing', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((((await call(auth, 'bundle', { op: 'search', text: '', owner: '' })).items) || []).length === every2.length) ? true : 'empty owner narrowed';
}, 1000);

// Goal/G43.20: no bundle sync: no file makes a bundle at boot.
// The box: "the bundle sync goes altogether (Andy: "just delete that file auth bundles, auth is the ONE api that REALLY can
// do without."): apiAuth reads no <name>Bundles.json and keeps no bundles.json record any more". A boot on a tree whose
// app folder holds such a file makes no bundle of it, and writes no record of it anywhere.
test.run('a <name>Bundles.json in an app folder makes no bundle at boot', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  bootRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-boot-'));
  probeDir = path.join(bootRoot, 'spirit', 'app', 'probe');
  fs.mkdirSync(probeDir, { recursive: true });
  fs.writeFileSync(path.join(probeDir, 'probeBundles.json'), JSON.stringify({ probeAgent: { label: 'Probe agent', branches: [{ family: 'probe', verb: 'ping' }] } }));
  bootTree = { files: { read: {}, list: {} }, desk: { 'chat.add': {}, 'item.get': {} } };
  boot = function () { return createApiAuth({ rootDir: bootRoot, tree: function () { return Promise.resolve(bootTree); } }); };
  ownedBy = async function (a, app) { return ((await call(a, 'bundle', { op: 'search', text: '' })).items || []).map(parsed).filter(function (x) { return x && x.owner === app; }); };
  settleBoot = async function () { for (let i = 0; i < 50; i++) await new Promise(function (r) { setImmediate(r); }); await new Promise(function (r) { setTimeout(r, 100); }); };
  a1 = boot(); await settleBoot();
  all1 = ((await call(a1, 'bundle', { op: 'search', text: '' })).items || []).map(parsed);
  return (!all1.some(function (x) { return x && (x.owner === 'probe' || x.label === 'Probe agent'); })) ? true : 'bundles after boot: ' + short(all1);
}, 3000);

test.run('and no bundles.json record is written anywhere', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  records = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'bundles.json') records.push(path.relative(bootRoot, p)); }); }(bootRoot));
  return (!records.length) ? true : 'records written: ' + short(records);
}, 1000);

// A server's bundle, made in the table, since no verb makes one: the world for the checks of goal/G41.32 below.
test.run('a server\'s bundle stands, made in the table', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  heldMade = await call(a1, 'bundle', { op: 'add', label: 'Held' });
  await call(a1, 'branch', { op: 'add', bundle: heldMade.id, family: 'files', verb: 'read' });
  hdb = new DatabaseSync(path.join(bootRoot, 'spirit', 'state', 'node.db'));
  hdb.prepare('UPDATE bundle SET owner = ? WHERE id = ?').run('zzHeld', heldMade.id);
  hdb.close();
  // GOAL/G41.32. THE BOX: "Bundle labels should be unique per owner. They are NOT."; "A user can only create, change and delete
  // node-owned bundles and branches, and sees the others read-only"; "no "old-data-rescue-missions"". Only the exact same
  // label is a duplicate (wsl, in the item's chat, unless Andy says otherwise). The verbs are the gate.
  // Goal/G41.32: a bundle's label is unique per owner.
  aU = a1;
  heldRow = (await ownedBy(aU, 'zzHeld')).filter(function (x) { return x.label === 'Held'; })[0];
  return (!!heldRow) ? true : 'no bundle of the server: the rest judges nothing';
}, 1000);

test.run('a new label is added', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  first = await call(aU, 'bundle', { op: 'add', label: 'Twice' });
  return (isNum(first.id)) ? true : 'add: ' + short(first);
}, 1000);

test.run('the same label again, by the same owner, is refused', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  countOf = async function (label) { return ((await call(aU, 'bundle', { op: 'search', text: '' })).items || []).map(parsed).filter(function (x) { return x && x.label === label && x.owner === 'node'; }).length; };
  twice = await call(aU, 'bundle', { op: 'add', label: 'Twice' });
  return (!!twice.refusal && !isNum(twice.id)) ? true : 'a second "Twice" answered ' + short(twice);
}, 1000);

test.run('and no second row is made', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await countOf('Twice')) === 1) ? true : 'rows labelled Twice: ' + (await countOf('Twice'));
}, 1000);

test.run('the same label under another owner is another bundle: the server\'s "Held" leaves "Held" free for the node', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  other = await call(aU, 'bundle', { op: 'add', label: 'Held' });
  return (isNum(other.id)) ? true : 'add "Held": ' + short(other);
}, 1000);

test.run('only the exact same label is a duplicate: "twice" beside "Twice" is added', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  twoCase = await call(aU, 'bundle', { op: 'add', label: 'twice' });
  return (isNum(twoCase.id)) ? true : 'add "twice": ' + short(twoCase);
}, 1000);

test.run('a label is free again once its bundle is deleted', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  await call(aU, 'bundle', { op: 'delete', id: first.id });
  reborn = await call(aU, 'bundle', { op: 'add', label: 'Twice' });
  return (isNum(reborn.id)) ? true : 'add after delete: ' + short(reborn);
}, 1000);

// Goal/G41.32: a user changes node-owned bundles and branches alone.
test.run('the server\'s bundle has its branch', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  hb = ((await call(aU, 'branch', { op: 'search', text: '', bundle: heldRow.id })).items || []).map(parsed)[0];
  return (!!hb) ? true : 'no branch: the branch checks judge nothing';
}, 1000);

test.run('deleting a server\'s bundle is refused, and it stays', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  del = await call(aU, 'bundle', { op: 'delete', id: heldRow.id });
  return (!!del.refusal && (await call(aU, 'bundle', { op: 'get', id: heldRow.id })).id === heldRow.id) ? true : 'delete answered ' + short(del);
}, 1000);

test.run('adding a branch to it is refused', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  addB = await call(aU, 'branch', { op: 'add', bundle: heldRow.id, family: 'desk', verb: 'chat.add' });
  return (!!addB.refusal && !isNum(addB.id)) ? true : 'branch add answered ' + short(addB);
}, 1000);

test.run('changing its branch is refused', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  setB = await call(aU, 'branch', { op: 'set', id: hb.id, family: 'files', verb: 'list' });
  return (!!setB.refusal) ? true : 'branch set answered ' + short(setB);
}, 1000);

test.run('deleting its branch is refused, and it stays', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  delB = await call(aU, 'branch', { op: 'delete', id: hb.id });
  return (!!delB.refusal && (await call(aU, 'branch', { op: 'get', id: hb.id })).id === hb.id) ? true : 'branch delete answered ' + short(delB);
}, 1000);

test.run('it is still read: get answers it', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  return ((await call(aU, 'bundle', { op: 'get', id: heldRow.id })).owner === 'zzHeld') ? true : 'get of the server\'s bundle failed';
}, 1000);

test.run('on a node-owned bundle a branch is added', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  nb = await call(aU, 'bundle', { op: 'add', label: 'Mine to change' });
  nbr = await call(aU, 'branch', { op: 'add', bundle: nb.id, family: 'files', verb: 'read' });
  return (isNum(nbr.id)) ? true : 'branch add: ' + short(nbr);
}, 1000);

test.run('changed', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  nset = await call(aU, 'branch', { op: 'set', id: nbr.id, verb: 'list' });
  return (!nset.refusal) ? true : 'branch set: ' + short(nset);
}, 1000);

test.run('and the bundle deleted', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  ndel = await call(aU, 'bundle', { op: 'delete', id: nb.id });
  return (!ndel.refusal) ? true : 'bundle delete: ' + short(ndel);
}, 1000);

test.run('the world: a verb the family serves makes a branch', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  try { fs.rmSync(bootRoot, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
  // Goal/G43.20: no branch carries an FS set, so none is granted.
  // Andy: "those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
  // to all those files". The node's tree holds no FS verb, so a branch or a grant naming one names a
  // verb nobody serves, and is refused as any such verb is.
  fsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-fs-'));
  fsTree = { desk: { 'chat.add': {} } };
  fsAuth = createApiAuth({ rootDir: fsRoot, tree: function () { return Promise.resolve(fsTree); } });
  fsBundle = await call(fsAuth, 'bundle', { op: 'add', label: 'FS probe' });
  keptId = (await call(fsAuth, 'branch', { op: 'add', bundle: fsBundle.id, family: 'desk', verb: 'chat.add' })).id;
  return (isNum(keptId)) ? true : 'chat.add branch refused';
}, 2000);

test.run('auth.branch add of desk.FS.loadFile is refused: no branch serves it', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  addedloadFile = await call(fsAuth, 'branch', { op: 'add', bundle: fsBundle.id, family: 'desk', verb: 'FS.loadFile' });
  return (!!addedloadFile.refusal && !isNum(addedloadFile.id)) ? true : 'auth.branch add of desk.FS.loadFile: ' + short(addedloadFile);
}, 1000);

test.run('auth.branch add of desk.FS.path is refused: no branch serves it', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  addedpath = await call(fsAuth, 'branch', { op: 'add', bundle: fsBundle.id, family: 'desk', verb: 'FS.path' });
  return (!!addedpath.refusal && !isNum(addedpath.id)) ? true : 'auth.branch add of desk.FS.path: ' + short(addedpath);
}, 1000);

test.run('auth.branch add of desk.FS.saveFile is refused: no branch serves it', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  addedsaveFile = await call(fsAuth, 'branch', { op: 'add', bundle: fsBundle.id, family: 'desk', verb: 'FS.saveFile' });
  return (!!addedsaveFile.refusal && !isNum(addedsaveFile.id)) ? true : 'auth.branch add of desk.FS.saveFile: ' + short(addedsaveFile);
}, 1000);

test.run('auth.branch set onto desk.FS.loadFile is refused, the branch kept', 0.8, async function () {
  if (!auth) return 'no auth: the world failed';
  moved = await call(fsAuth, 'branch', { op: 'set', id: keptId, verb: 'FS.loadFile' });
  return (!!moved.refusal && (await call(fsAuth, 'branch', { op: 'get', id: keptId })).verb === 'chat.add') ? true : 'set: ' + short(moved);
}, 1000);

test.run('opened again on the same root, the bundles and their branches are there', 0.2, async function () {
  if (!auth) return 'no auth: the world failed';
  try { fs.rmSync(fsRoot, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
  // The bundles persist.
  again = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  return ((await call(again, 'bundle', { op: 'get', id: reader.id })).label === 'Reader' && (await call(again, 'branch', { op: 'search', text: '', bundle: reader.id })).items.length === 1) ? true : 'get: ' + short(await call(again, 'bundle', { op: 'get', id: reader.id }));
}, 1000);

test.after(function () {
  for (const d of [root, bootRoot, fsRoot]) { try { if (d) fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ } }
});
