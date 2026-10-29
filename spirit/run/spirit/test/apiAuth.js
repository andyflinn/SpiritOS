'use strict';

// spirit/run/spirit/test/apiAuth.js
// The tests of spirit/apiAuth.js's two bundle verbs, auth.bundle and auth.branch, and their tables in node.db (spec:
// ./apiAuth.md; goal/G41.14). The verbs are called as server.js calls them, on a scratch root of the test's own, so its
// node.db is the test's alone, and the live tree is the test's stand-in.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
require(path.join(RUN, 'spirit.js'));
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const FILE = path.join(RUN, 'spirit', 'apiAuth.js');
const FAMILY = path.join(RUN, 'spirit', 'auth', 'api.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
const isNum = function (k) { return typeof k === 'number' && Number.isInteger(k) && k > 0; };
// One call, answered or refused, as server.js hands it on.
async function call(auth, verb, a) { try { return (await auth[verb](a)) || {}; } catch (e) { return { threw: e && e.message, refusal: e && e.refusal }; } }
const parsed = function (item) { try { return JSON.parse(item.label); } catch (e) { return null; } };

test.startTest('apiAuth.js: auth.bundle and auth.branch, the node\'s bundles');

(async function () {
  test.subHeading('the two verbs, declared');
  const family = require(FAMILY);
  const verbs = (family && family.verbs) || {};
  // Andy, box: "The interfaces to those two tables are TWO verbs under the auth family, auth.bundle and auth.branch,
  // akin to the <tableName> verbs of the agent app: op add, set, delete, get and search. Granted, no review."
  const b = verbs.bundle;
  ok(b && b.op === 'id' && b.id === 'number?' && b.label === 'name?' && b.text === 'text?' && Object.keys(b).length === 4,
    'spirit/auth/api.js declares bundle { op, id, label, text }: a numeric id, a label, nothing more', 'bundle: ' + short(b));
  const r = verbs.branch;
  ok(r && r.op === 'id' && r.id === 'number?' && r.bundle === 'number?' && r.family === 'text?' && r.verb === 'text?' && r.text === 'text?' && Object.keys(r).length === 6,
    'and branch { op, id, bundle, family, verb, text }, flat as the agent tables\' verbs', 'branch: ' + short(r));
  ['bundle', 'branch'].forEach(function (v) {
    const d = readJson(path.join(RUN, 'spirit', 'auth', v + '.json'));
    ok(d && typeof d.description === 'string' && d.description && d.request && 'op' in d.request, 'spirit/auth/' + v + '.json describes the verb and its request', v + '.json: ' + short(d));
  });

  const { createApiAuth } = require(FILE);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-'));
  const tree = { files: { read: {}, list: {} }, desk: { 'chat.add': {}, 'item.get': {} } };
  const auth = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  ok(typeof auth.bundle === 'function' && typeof auth.branch === 'function', 'createApiAuth answers bundle(a) and branch(a) beside grant and revoke', 'verbs: ' + short(Object.keys(auth)));
  if (typeof auth.bundle !== 'function' || typeof auth.branch !== 'function') return;

  test.subHeading('a bundle: a hidden number and a label');
  const reader = await call(auth, 'bundle', { op: 'add', label: 'Reader' });
  ok(isNum(reader.id), 'add {label} answers { id }, a number the node gives it', 'add: ' + short(reader));
  const desk = await call(auth, 'bundle', { op: 'add', label: 'Deskhand' });
  ok(isNum(desk.id) && desk.id !== reader.id, 'each add a number of its own', 'second: ' + short(desk));
  ok((await call(auth, 'bundle', { op: 'add', label: '' })).refusal === 'bad-request' && (await call(auth, 'bundle', { op: 'add' })).refusal === 'bad-request',
    'a label that is empty, or none, is refused bad-request', 'empty label answered');
  const got = await call(auth, 'bundle', { op: 'get', id: reader.id });
  ok(got.id === reader.id && got.label === 'Reader' && Object.keys(got).length === 2, 'get {id} answers { id, label }, no description, no paths', 'get: ' + short(got));
  await call(auth, 'bundle', { op: 'set', id: reader.id, label: 'Lister' });
  ok((await call(auth, 'bundle', { op: 'get', id: reader.id })).label === 'Lister', 'set {id, label} renames it', 'after set: ' + short(await call(auth, 'bundle', { op: 'get', id: reader.id })));
  const all = await call(auth, 'bundle', { op: 'search', text: '' });
  ok(Array.isArray(all.items) && typeof all.more === 'boolean' && all.items.length === 2, 'search with no words answers { items, more }, every bundle', 'search: ' + short(all));
  const row = all.items && parsed(all.items.filter(function (i) { return String(i.key) === String(reader.id); })[0] || {});
  ok(row && row.id === reader.id && row.label === 'Lister', 'each item keyed by the bundle\'s id, its label the bundle as get shows it', 'item: ' + short(row));
  const hit = await call(auth, 'bundle', { op: 'search', text: 'Deskhand' });
  ok(hit.items && hit.items.length >= 1 && String(hit.items[0].key) === String(desk.id), 'a search of words ranks the bundle that has them first', 'search: ' + short(hit.items));

  test.subHeading('a branch: a bundle, a family of the tree, a verb of it or all');
  const whole = await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'files', verb: '' });
  ok(isNum(whole.id), 'add {bundle, family, verb} answers { id }, a number', 'add: ' + short(whole));
  const one = await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'desk', verb: 'chat.add' });
  ok(isNum(one.id) && one.id !== whole.id, 'a branch may name a single verb', 'add: ' + short(one));
  const noVerb = await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'files' });
  ok(isNum(noVerb.id) && (await call(auth, 'branch', { op: 'get', id: noVerb.id })).verb === '', 'a verb left out is the empty verb, all of the family', 'no verb: ' + short(noVerb));
  const g = await call(auth, 'branch', { op: 'get', id: one.id });
  ok(g.id === one.id && g.bundle === desk.id && g.family === 'desk' && g.verb === 'chat.add' && Object.keys(g).length === 4, 'get {id} answers { id, bundle, family, verb }', 'get: ' + short(g));

  test.subHeading('a branch is refused unless it is valid');
  // Andy, box: "a new branch row must contain a valid reference to a bundle row, and a valid reference to a family of
  // the nodes API tree", "family and verb fields MUST be validated against the nodes API tree when a row is added or
  // changed, and refused if the values are not valid", and "two branch rows referencing the same bundle row MUST NOT
  // ... contain the same family AND verb values".
  ok((await call(auth, 'branch', { op: 'add', bundle: 99999, family: 'files', verb: '' })).refusal === 'no-such-bundle', 'a bundle that is not there is refused no-such-bundle', 'no bundle answered');
  ok((await call(auth, 'branch', { op: 'add', bundle: reader.id, verb: 'read' })).refusal === 'bad-request', 'no family is refused bad-request', 'no family answered');
  ok((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'nowhere', verb: '' })).refusal === 'no-such-family', 'a family the tree does not serve is refused no-such-family', 'bad family answered');
  ok((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'files', verb: 'write' })).refusal === 'no-such-verb', 'a verb the family does not serve is refused no-such-verb', 'bad verb answered');
  ok((await call(auth, 'branch', { op: 'add', bundle: desk.id, family: 'desk', verb: 'chat.add' })).refusal === 'already-in-bundle', 'the same family and verb twice in one bundle is refused already-in-bundle', 'duplicate answered');
  ok(isNum((await call(auth, 'branch', { op: 'add', bundle: reader.id, family: 'desk', verb: 'chat.add' })).id), 'the same family and verb in another bundle is a branch of its own', 'other bundle refused');
  ok((await call(auth, 'branch', { op: 'set', id: one.id, verb: 'write' })).refusal === 'no-such-verb', 'a set is checked against the tree as an add is', 'bad set answered');
  ok((await call(auth, 'branch', { op: 'set', id: one.id, family: 'files', verb: '' })).refusal === 'already-in-bundle', 'and a set that would make a duplicate is refused already-in-bundle', 'duplicate set answered');
  await call(auth, 'branch', { op: 'set', id: one.id, verb: 'item.get' });
  ok((await call(auth, 'branch', { op: 'get', id: one.id })).verb === 'item.get' && (await call(auth, 'branch', { op: 'get', id: one.id })).family === 'desk',
    'a valid set changes what it names and keeps the rest', 'after set: ' + short(await call(auth, 'branch', { op: 'get', id: one.id })));
  ok((await call(auth, 'branch', { op: 'get', id: 99999 })).refusal === 'no-such-branch' && (await call(auth, 'branch', { op: 'delete', id: 99999 })).refusal === 'no-such-branch',
    'get or delete of a branch that is not there is refused no-such-branch', 'missing branch answered');
  ok((await call(auth, 'bundle', { op: 'get', id: 99999 })).refusal === 'no-such-bundle' && (await call(auth, 'bundle', { op: 'fly' })).refusal === 'bad-request' && (await call(auth, 'branch', { op: 'fly' })).refusal === 'bad-request',
    'a bundle that is not there is refused no-such-bundle; an op neither verb knows, bad-request', 'refusals answered');

  test.subHeading('the branch search filters by bundle, family and verb');
  // Andy, box: "the auth.branch search needs \"bundle\", \"family\" and \"verb\" filters."
  const keysOf = async function (a) { const s = await call(auth, 'branch', Object.assign({ op: 'search', text: '' }, a)); return (s.items || []).map(function (i) { return parsed(i); }); };
  const ofDesk = await keysOf({ bundle: desk.id });
  ok(ofDesk.length === 2 && ofDesk.every(function (x) { return x && x.bundle === desk.id; }), 'bundle narrows to that bundle\'s branches', 'bundle filter: ' + short(ofDesk));
  const ofFiles = await keysOf({ family: 'files' });
  ok(ofFiles.length === 2 && ofFiles.every(function (x) { return x.family === 'files'; }), 'family narrows to that family', 'family filter: ' + short(ofFiles));
  const ofVerb = await keysOf({ family: 'desk', verb: 'chat.add' });
  ok(ofVerb.length === 1 && ofVerb[0].bundle === reader.id, 'verb narrows to that verb', 'verb filter: ' + short(ofVerb));
  const every = await keysOf({});
  ok(every.length === 4 && every.every(function (x) { return x && isNum(x.id) && 'verb' in x; }), 'no filter, or an empty one, is every branch, each item its branch as get shows it', 'no filter: ' + short(every));
  ok((await keysOf({ family: '', verb: '' })).length === 4, 'an empty family or verb filter narrows nothing', 'empty filters narrowed');

  test.subHeading('the two tables in node.db, and the old ones gone');
  const db = new DatabaseSync(path.join(root, 'relay-state', 'node.db'));
  const colsOf = function (t) { try { return db.prepare('PRAGMA table_info(' + JSON.stringify(t) + ')').all(); } catch (e) { return []; } };
  const names = function (cols) { return cols.map(function (x) { return x.name + (x.pk ? '*' : ''); }).sort(); };
  ok(JSON.stringify(names(colsOf('bundle'))) === '["id*","label"]' && /INT/i.test((colsOf('bundle')[0] || {}).type || ''),
    'node.db has bundle (id, an integer key; label)', 'bundle: ' + short(colsOf('bundle')));
  ok(JSON.stringify(names(colsOf('branch'))) === '["bundle","family","id*","verb"]', 'and branch (id, the key; bundle, family, verb)', 'branch: ' + short(names(colsOf('branch'))));
  const idx = (function () { try { return db.prepare('PRAGMA index_list("branch")').all().map(function (i) { return db.prepare('PRAGMA index_info(' + JSON.stringify(i.name) + ')').all().map(function (c) { return c.name; }); }); } catch (e) { return []; } }());
  ok(idx.some(function (cols) { return cols[0] === 'bundle'; }), 'branch.bundle is indexed', 'indexes: ' + short(idx));
  const tables = db.prepare('SELECT name FROM sqlite_master WHERE type = \'table\'').all().map(function (t) { return t.name; });
  ok(tables.indexOf('bundles') === -1 && tables.indexOf('bundle_paths') === -1, 'the old bundles and bundle_paths tables are made no more', 'tables: ' + short(tables));

  test.subHeading('deleting a bundle deletes its branches');
  const del = await call(auth, 'bundle', { op: 'delete', id: desk.id });
  ok(del.id === desk.id && (await call(auth, 'bundle', { op: 'get', id: desk.id })).refusal === 'no-such-bundle', 'delete {id} removes the bundle and answers { id }', 'delete: ' + short(del));
  const left = db.prepare('SELECT COUNT(*) AS n FROM branch WHERE bundle = ?').get(desk.id).n;
  ok(left === 0 && (await keysOf({ bundle: desk.id })).length === 0 && (await call(auth, 'branch', { op: 'get', id: noVerb.id })).refusal === 'no-such-branch',
    'and every branch that names it', 'branches left: ' + left);
  ok((await keysOf({ bundle: reader.id })).length === 2, 'another bundle\'s branches stay', 'reader\'s: ' + short(await keysOf({ bundle: reader.id })));
  const gone = await call(auth, 'branch', { op: 'delete', id: whole.id });
  ok(gone.id === whole.id && (await keysOf({ bundle: reader.id })).length === 1, 'branch delete {id} removes that branch alone', 'delete: ' + short(gone));
  db.close();

  test.subHeading('a bundle is not granted by reference');
  // Andy, box: "a bundle is a bundle, and in itself does not constitute an authorization."
  const PEER = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  const kept = await call(auth, 'bundle', { op: 'add', label: 'Kept' });
  await call(auth, 'branch', { op: 'add', bundle: kept.id, family: 'files', verb: 'read' });
  await auth.grant({ key: PEER, path: 'files.read' });
  await call(auth, 'bundle', { op: 'delete', id: kept.id });
  ok(JSON.stringify(auth.pathsOf(PEER)) === '["files.read"]', 'a grant made from a bundle stays when the bundle goes', 'paths of the peer: ' + short(auth.pathsOf(PEER)));

  test.subHeading('the bundles persist');
  const again = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  ok((await call(again, 'bundle', { op: 'get', id: reader.id })).label === 'Lister' && (await call(again, 'branch', { op: 'search', text: '', bundle: reader.id })).items.length === 1,
    'opened again on the same root, the bundles and their branches are there', 'get: ' + short(await call(again, 'bundle', { op: 'get', id: reader.id })));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
