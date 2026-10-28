'use strict';

// spirit/run/spirit/test/apiAuth.js
// The tests of spirit/apiAuth.js's bundle verb, auth.bundle, and its bundle table in node.db (spec: ./apiAuth.md;
// goal/G41.13). The verbs are called as server.js calls them, on a scratch root of the test's own, so its node.db is
// the test's alone.

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
const isKey = function (k) { return typeof k === 'string' && /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/.test(k); };
// One call, answered or refused, as server.js hands it on.
async function call(auth, a) { try { return (await auth.bundle(a)) || {}; } catch (e) { return { threw: e && e.message }; } }

test.startTest('apiAuth.js: auth.bundle, the node\'s bundles');

(async function () {
  test.subHeading('the verb, declared');
  const family = require(FAMILY);
  const decl = family && family.verbs && family.verbs.bundle;
  // Andy, box v7: "The bundle interface is one verb under the auth family, auth.bundle, akin to the <tableName> verbs
  // of the agent app: op add, set, delete, get and search."
  ok(decl && decl.op === 'id' && decl.id === 'key?' && decl.label === 'name?' && decl.description === 'description?' && decl.paths === 'list?' && decl.text === 'text?',
    'spirit/auth/api.js declares bundle { op, id, label, description, paths, text }, flat as the agent tables\' verbs', 'bundle: ' + short(decl));
  const described = readJson(path.join(RUN, 'spirit', 'auth', 'bundle.json'));
  ok(described && typeof described.description === 'string' && described.description && described.request && 'op' in described.request,
    'spirit/auth/bundle.json describes the verb and its request', 'bundle.json: ' + short(described));

  const { createApiAuth } = require(FILE);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-'));
  const tree = { files: { read: {}, list: {} }, desk: { 'chat.add': {} } };
  const auth = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  ok(typeof auth.bundle === 'function', 'createApiAuth answers bundle(a) beside grant and revoke', 'verbs: ' + short(Object.keys(auth)));
  if (typeof auth.bundle !== 'function') return;

  test.subHeading('add makes a bundle, keyed as the shadow roll keys a row');
  const added = await call(auth, { op: 'add', label: 'Reader', description: 'reads files', paths: ['files.read', 'files.list'] });
  const id = added.id;
  ok(isKey(id), 'add answers { id }, an ed25519 public key made at add', 'add: ' + short(added));
  const second = await call(auth, { op: 'add', label: 'Deskhand', paths: ['desk.chat.add', 'files'] });
  ok(isKey(second.id) && second.id !== id, 'each add makes an id of its own; a bundle may span families and hold a whole family', 'second: ' + short(second));
  const one = await call(auth, { op: 'add', label: 'One', paths: ['files.read'] });
  ok(isKey(one.id), 'a bundle may hold a single path', 'one: ' + short(one));

  test.subHeading('the bundle table in node.db');
  const db = new DatabaseSync(path.join(root, 'relay-state', 'node.db'));
  const colsOf = function (t) { try { return db.prepare('PRAGMA table_info(' + JSON.stringify(t) + ')').all(); } catch (e) { return []; } };
  const b = colsOf('bundles');
  const bp = colsOf('bundle_paths');
  ok(['id', 'label', 'description'].every(function (c) { return b.some(function (x) { return x.name === c; }); }) &&
    JSON.stringify(b.filter(function (x) { return x.pk; }).map(function (x) { return x.name; })) === '["id"]',
    'node.db has bundles (id the key, label, description)', 'bundles: ' + short(b.map(function (x) { return x.name + (x.pk ? '*' : ''); })));
  ok(bp.length === 2 && JSON.stringify(bp.filter(function (x) { return x.pk; }).sort(function (x, y) { return x.pk - y.pk; }).map(function (x) { return x.name; })) === '["bundle_id","path"]',
    'and bundle_paths (bundle_id, path), both its key and nothing else: a bundle\'s paths are rows of their own', 'bundle_paths: ' + short(bp.map(function (x) { return x.name + (x.pk ? '*' : ''); })));
  const rows = bp.length ? db.prepare('SELECT path FROM bundle_paths WHERE bundle_id = ? ORDER BY path').all(id).map(function (r) { return r.path; }) : [];
  ok(JSON.stringify(rows) === '["files.list","files.read"]', 'the paths of a bundle are its rows there', 'rows: ' + short(rows));
  db.close();

  test.subHeading('get, set, search, delete');
  const got = await call(auth, { op: 'get', id: id });
  ok(got.id === id && got.label === 'Reader' && got.description === 'reads files' && JSON.stringify((got.paths || []).slice().sort()) === '["files.list","files.read"]',
    'get answers { id, label, description, paths }', 'get: ' + short(got));
  const set = await call(auth, { op: 'set', id: id, label: 'Lister' });
  const after = await call(auth, { op: 'get', id: id });
  ok(set.id === id && after.label === 'Lister' && after.description === 'reads files' && after.paths.length === 2, 'set changes what it names and keeps the rest', 'after: ' + short(after));
  await call(auth, { op: 'set', id: id, paths: ['files.list'] });
  ok(JSON.stringify((await call(auth, { op: 'get', id: id })).paths) === '["files.list"]', 'set with paths replaces the whole list', 'paths: ' + short((await call(auth, { op: 'get', id: id })).paths));
  const found = await call(auth, { op: 'search', text: '' });
  ok(Array.isArray(found.items) && typeof found.more === 'boolean' && found.items.length === 3, 'search with no words answers { items, more }, every bundle', 'search: ' + short(found));
  let row = null; try { row = JSON.parse((found.items.filter(function (i) { return i.key === id; })[0] || {}).label); } catch (e) { row = null; }
  ok(row && row.id === id && row.label === 'Lister' && Array.isArray(row.paths), 'each item keyed by the bundle\'s id, its label the bundle as get shows it', 'item: ' + short(row));
  const hit = await call(auth, { op: 'search', text: 'Deskhand' });
  ok(hit.items && hit.items.length >= 1 && hit.items[0].key === second.id, 'a search of words ranks the bundle that has them first', 'search: ' + short(hit.items && hit.items.map(function (i) { return i.key; })));
  const del = await call(auth, { op: 'delete', id: one.id });
  ok(del.id === one.id && (await call(auth, { op: 'get', id: one.id })).refusal === 'no-such-bundle', 'delete {id} removes the bundle and answers { id }', 'delete: ' + short(del));

  test.subHeading('a refusal says which');
  ok((await call(auth, { op: 'fly' })).refusal === 'bad-request', 'an op it does not know is refused bad-request', 'fly answered');
  ok((await call(auth, { op: 'add', label: 'Bad', paths: ['not a path'] })).refusal === 'not-a-path', 'a path that is not one is refused not-a-path', 'bad path answered');
  // The fs family is the owner's (goal/G33.10): no bundle may hold it, as no grant may.
  ok((await call(auth, { op: 'add', label: 'Files', paths: ['fs.loadFile'] })).refusal === 'owner-only', 'a bundle holding the fs family is refused owner-only', 'fs answered');
  const count = (await call(auth, { op: 'search', text: '' })).items.length;
  ok(count === 2, 'and a refused add makes no bundle', 'bundles: ' + count);
  const gone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  ok((await call(auth, { op: 'get', id: gone })).refusal === 'no-such-bundle' && (await call(auth, { op: 'set', id: gone, label: 'x' })).refusal === 'no-such-bundle',
    'get or set of a bundle that is not there is refused no-such-bundle', 'missing answered');

  test.subHeading('a bundle is not granted by reference');
  // Andy, box v7: "changing or deleting the bundle later changes no grant already made".
  const PEER = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  for (const p of (await call(auth, { op: 'get', id: second.id })).paths) await auth.grant({ key: PEER, path: p });
  await call(auth, { op: 'set', id: second.id, paths: ['files.read'] });
  await call(auth, { op: 'delete', id: second.id });
  ok(JSON.stringify(auth.pathsOf(PEER).slice().sort()) === '["desk.chat.add","files"]', 'the grants made from a bundle stay when the bundle changes or goes', 'paths of the peer: ' + short(auth.pathsOf(PEER)));
  ok((await auth.grant({ key: PEER, path: 'files' })).refusal === 'already-granted', 'and a grant that exists already is not made twice', 'grant again answered');

  test.subHeading('the bundles persist');
  const again = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  ok((await call(again, { op: 'get', id: id })).label === 'Lister', 'opened again on the same root, the bundles are there', 'get: ' + short(await call(again, { op: 'get', id: id })));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
