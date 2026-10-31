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
  // goal/G41.25, box: "the bundle table gains 1 field: \"owner\"", and "changes to the auth.bundle verb for the addition
  // of the \"owner\" field are approved by andy and need no review."
  ok(b && b.op === 'id' && b.id === 'number?' && b.label === 'name?' && b.text === 'text?' && typeof b.owner === 'string' && /\?$/.test(b.owner) && Object.keys(b).length === 5,
    'spirit/auth/api.js declares bundle { op, id, label, text, owner }: a numeric id, a label, an owner left out at will, nothing more', 'bundle: ' + short(b));
  const r = verbs.branch;
  ok(r && r.op === 'id' && r.id === 'number?' && r.bundle === 'number?' && r.family === 'text?' && r.verb === 'text?' && r.text === 'text?' && Object.keys(r).length === 6,
    'and branch { op, id, bundle, family, verb, text }, flat as the agent tables\' verbs', 'branch: ' + short(r));
  ['bundle', 'branch'].forEach(function (v) {
    const d = readJson(path.join(RUN, 'spirit', 'auth', v + '.json'));
    ok(d && typeof d.description === 'string' && d.description && d.request && 'op' in d.request, 'spirit/auth/' + v + '.json describes the verb and its request', v + '.json: ' + short(d));
  });
  const bj = readJson(path.join(RUN, 'spirit', 'auth', 'bundle.json'));
  ok(bj && bj.request && 'owner' in bj.request && /owner/.test(String(bj.description || '')), 'spirit/auth/bundle.json names the owner in its request and its description', 'bundle.json: ' + short(bj));

  const { createApiAuth } = require(FILE);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-'));
  // goal/G41.25: agent is an app server of the tree, so a bundle it owns names a server the node has.
  const tree = { files: { read: {}, list: {} }, desk: { 'chat.add': {}, 'item.get': {} }, agent: { job: {} } };
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
  ok(got.id === reader.id && got.label === 'Reader' && got.owner === 'node' && Object.keys(got).length === 3, 'get {id} answers { id, label, owner }, no description, no paths', 'get: ' + short(got));
  await call(auth, 'bundle', { op: 'set', id: reader.id, label: 'Lister' });
  ok((await call(auth, 'bundle', { op: 'get', id: reader.id })).label === 'Lister', 'set {id, label} renames it', 'after set: ' + short(await call(auth, 'bundle', { op: 'get', id: reader.id })));
  const all = await call(auth, 'bundle', { op: 'search', text: '' });
  ok(Array.isArray(all.items) && typeof all.more === 'boolean' && all.items.length === 2, 'search with no words answers { items, more }, every bundle', 'search: ' + short(all));
  const row = all.items && parsed(all.items.filter(function (i) { return String(i.key) === String(reader.id); })[0] || {});
  ok(row && row.id === reader.id && row.label === 'Lister' && row.owner === 'node', 'each item keyed by the bundle\'s id, its label the bundle as get shows it, its owner with it', 'item: ' + short(row));
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
  ok(JSON.stringify(names(colsOf('bundle'))) === '["id*","label","owner"]' && /INT/i.test((colsOf('bundle').filter(function (c) { return c.name === 'id'; })[0] || {}).type || ''),
    'node.db has bundle (id, an integer key; label; owner)', 'bundle: ' + short(colsOf('bundle')));
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

  test.subHeading('every change is told, row by row, for the stream');
  // Andy, goal/G41.14: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set. and the
  // SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the fucking elements".
  // The node publishes each changed row on one permanent job, as it does each contact row (server.js, the shadow job);
  // apiAuth tells it: onChange(fn), fn({ table, row }) for a row added or set, fn({ table, row: { id }, gone: true }) for
  // one deleted, a bundle's branches each told gone with it.
  ok(typeof auth.onChange === 'function', 'createApiAuth answers onChange(fn), what the node publishes from', 'verbs: ' + short(Object.keys(auth)));
  if (typeof auth.onChange === 'function') {
    const told = [];
    auth.onChange(function (c) { told.push(JSON.parse(JSON.stringify(c))); });
    const tb = await call(auth, 'bundle', { op: 'add', label: 'Told' });
    ok(told.length === 1 && told[0].table === 'bundle' && told[0].row.id === tb.id && told[0].row.label === 'Told' && told[0].row.owner === 'node' && !told[0].gone, 'a bundle added is told { table: bundle, row }, the row as get shows it, its owner with it', 'told: ' + short(told));
    await call(auth, 'bundle', { op: 'set', id: tb.id, label: 'Told again' });
    ok(told.length === 2 && told[1].table === 'bundle' && told[1].row.label === 'Told again', 'a bundle set is told with its new row', 'told: ' + short(told.slice(1)));
    const tr = await call(auth, 'branch', { op: 'add', bundle: tb.id, family: 'files', verb: 'read' });
    ok(told.length === 3 && told[2].table === 'branch' && told[2].row.id === tr.id && told[2].row.bundle === tb.id && told[2].row.family === 'files' && told[2].row.verb === 'read', 'a branch added is told { table: branch, row }', 'told: ' + short(told.slice(2)));
    await call(auth, 'branch', { op: 'set', id: tr.id, verb: 'list' });
    ok(told.length === 4 && told[3].table === 'branch' && told[3].row.verb === 'list', 'a branch set is told with its new row', 'told: ' + short(told.slice(3)));
    const tr2 = await call(auth, 'branch', { op: 'add', bundle: tb.id, family: 'desk', verb: '' });
    await call(auth, 'bundle', { op: 'delete', id: tb.id });
    const gone = told.slice(5);
    ok(gone.some(function (c) { return c.table === 'bundle' && c.gone === true && c.row.id === tb.id; }) &&
      [tr.id, tr2.id].every(function (id) { return gone.some(function (c) { return c.table === 'branch' && c.gone === true && c.row.id === id; }); }),
      'a bundle deleted is told gone, and each of its branches with it', 'told: ' + short(gone));
    const n = told.length;
    await call(auth, 'bundle', { op: 'add', label: '' });
    await call(auth, 'branch', { op: 'add', bundle: 99999, family: 'files', verb: '' });
    ok(told.length === n, 'a refused add tells nothing', 'told: ' + short(told.slice(n)));
  }

  test.subHeading('a grant made or revoked is told too');
  // Andy, goal/G41.14: "SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????", "FIX THEN NOW!!!". A grant row is
  // { key, path, label }, one per peer and path, told { table: grant, row } when made and { table, row: { key, path },
  // gone: true } when revoked.
  if (typeof auth.onChange === 'function') {
    const toldG = [];
    auth.onChange(function (c) { if (c && c.table === 'grant') toldG.push(JSON.parse(JSON.stringify(c))); });
    const GPEER = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
    await auth.grant({ key: GPEER, path: 'files.list' });
    ok(toldG.length === 1 && toldG[0].row.key === GPEER && toldG[0].row.path === 'files.list' && typeof toldG[0].row.label === 'string' && !toldG[0].gone,
      'a grant made is told { table: grant, row: { key, path, label } }', 'told: ' + short(toldG));
    await auth.grant({ key: GPEER, path: 'files.list' });
    ok(toldG.length === 1, 'a grant refused already-granted tells nothing', 'told: ' + short(toldG));
    await auth.revoke({ key: GPEER, path: 'files.list' });
    ok(toldG.length === 2 && toldG[1].gone === true && toldG[1].row.key === GPEER && toldG[1].row.path === 'files.list', 'a grant revoked is told gone, by key and path', 'told: ' + short(toldG));
    await auth.revoke({ key: GPEER, path: 'files.list' });
    ok(toldG.length === 2, 'a revoke refused not-granted tells nothing', 'told: ' + short(toldG));
  }

  test.subHeading('goal/G41.25: a bundle\'s owner, "node" or an app server');
  // Andy, box: "the bundle table gains 1 field: \"owner\", which can contains either \"node\" (default), or the name of
  // an appServer", "the owner field can never be changed after a bundle is added", and "for bundles without a valid
  // \"owner\" field, the auth.bundle verb will replace the content of the invalid \"owner\" field with \"node\", incoming
  // or outgoing."
  const plain = await call(auth, 'bundle', { op: 'add', label: 'Plain' });
  ok((await call(auth, 'bundle', { op: 'get', id: plain.id })).owner === 'node', 'a bundle added with no owner is owned by "node"', 'get: ' + short(await call(auth, 'bundle', { op: 'get', id: plain.id })));
  const mine = await call(auth, 'bundle', { op: 'add', label: 'For the agent', owner: 'agent' });
  ok(isNum(mine.id) && (await call(auth, 'bundle', { op: 'get', id: mine.id })).owner === 'agent', 'a bundle added with an app server\'s name is owned by that server', 'add: ' + short(mine) + ', get ' + short(await call(auth, 'bundle', { op: 'get', id: mine.id })));
  await call(auth, 'bundle', { op: 'set', id: mine.id, owner: 'desk' });
  await call(auth, 'bundle', { op: 'set', id: mine.id, label: 'Agent tools', owner: 'node' });
  await call(auth, 'bundle', { op: 'set', id: plain.id, owner: 'agent' });
  const afterSet = await call(auth, 'bundle', { op: 'get', id: mine.id });
  ok(afterSet.owner === 'agent' && (await call(auth, 'bundle', { op: 'get', id: plain.id })).owner === 'node', 'the owner never changes after the add: a set naming another owner leaves it as it was', 'after set: ' + short(afterSet));
  // Incoming: an add whose owner is not valid stores "node".
  const badIn = [];
  for (const bad of ['', 42, 'not a name!', 'a.b', null]) {
    const r = await call(auth, 'bundle', { op: 'add', label: 'Bad ' + badIn.length, owner: bad });
    badIn.push([bad, isNum(r.id) ? (await call(auth, 'bundle', { op: 'get', id: r.id })).owner : r, r.id]);
  }
  ok(badIn.every(function (x) { return x[1] === 'node'; }), 'an add whose owner is not valid (empty, not a text, not a name) is owned by "node"', 'owners: ' + short(badIn));
  // Incoming means kept: the table itself holds "node" for each, not the invalid owner read out as "node".
  const kdb = new DatabaseSync(path.join(root, 'relay-state', 'node.db'), { readOnly: true });
  const kept2 = badIn.map(function (x) { try { const r = kdb.prepare('SELECT owner FROM bundle WHERE id = ?').get(x[2]); return r && r.owner; } catch (e) { return null; } });
  kdb.close();
  ok(kept2.length === badIn.length && kept2.every(function (v) { return v === 'node'; }), 'and the table keeps "node" for it, never the owner it was given', 'kept: ' + short(kept2));
  // Outgoing: a row the table holds with an owner that is not valid is answered "node", by get, search and the stream.
  const odb = new DatabaseSync(path.join(root, 'relay-state', 'node.db'));
  let wrote = true;
  try { odb.prepare('UPDATE bundle SET owner = ? WHERE id = ?').run('not a name!', plain.id); } catch (e) { wrote = false; }
  odb.close();
  const outGet = await call(auth, 'bundle', { op: 'get', id: plain.id });
  const outItem = ((await call(auth, 'bundle', { op: 'search', text: '' })).items || []).map(parsed).filter(function (x) { return x && x.id === plain.id; })[0];
  ok(wrote && outGet.owner === 'node' && outItem && outItem.owner === 'node', 'a kept row whose owner is not valid is answered "node", by get and by search', 'wrote ' + wrote + ', get ' + short(outGet) + ', item ' + short(outItem));
  test.subHeading('goal/G41.25: the search narrowed to one owner');
  // Andy, box: "if the bundleSelector IS configured for an appServer, then it will only list bundles \"owned\" by that
  // Appserver"; the selector asks the node for them, as every narrowed list does (cw, agreed in the item's chat).
  const owned = ((await call(auth, 'bundle', { op: 'search', text: '', owner: 'agent' })).items || []).map(parsed);
  ok(owned.length === 1 && owned[0] && owned[0].id === mine.id && owned[0].owner === 'agent', 'search {text, owner} answers that owner\'s bundles alone', 'items: ' + short(owned));
  const ofNode = ((await call(auth, 'bundle', { op: 'search', text: '', owner: 'node' })).items || []).map(parsed);
  ok(ofNode.length > 1 && ofNode.every(function (x) { return x && x.owner === 'node'; }), 'owner "node" answers the node\'s bundles alone, a row read as "node" among them', 'items: ' + short(ofNode));
  const every2 = ((await call(auth, 'bundle', { op: 'search', text: '' })).items || []).map(parsed);
  ok(every2.some(function (x) { return x && x.owner === 'agent'; }) && every2.some(function (x) { return x && x.owner === 'node'; }), 'no owner is every bundle, whoever owns it', 'items: ' + short(every2));
  ok((((await call(auth, 'bundle', { op: 'search', text: '', owner: '' })).items) || []).length === every2.length, 'an empty owner narrows nothing', 'empty owner narrowed');

  test.subHeading('goal/G41.25: the bundles from before are owned by "node"');
  // A node.db whose bundle table has no owner column yet, as every node has it before this item.
  const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-old-'));
  fs.mkdirSync(path.join(oldRoot, 'relay-state'), { recursive: true });
  const pre = new DatabaseSync(path.join(oldRoot, 'relay-state', 'node.db'));
  pre.exec('CREATE TABLE bundle (id INTEGER PRIMARY KEY, label TEXT NOT NULL); INSERT INTO bundle (id, label) VALUES (5, \'From before\');');
  pre.close();
  const oldAuth = createApiAuth({ rootDir: oldRoot, tree: function () { return Promise.resolve(tree); } });
  const fromBefore = await call(oldAuth, 'bundle', { op: 'get', id: 5 });
  ok(fromBefore.label === 'From before' && fromBefore.owner === 'node', 'opened on a node.db from before the owner, its bundles are there, each owned by "node"', 'get: ' + short(fromBefore));
  try { fs.rmSync(oldRoot, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('goal/G41.24: each appServer\'s bundles, written at the node\'s boot');
  // Andy, box: "each appServer has a file process/js/<appServerName>/<appServerName>Bundles.json", "this json file at
  // it's root has one key for each bundle ... and the objects held those keys, contain the value for one bundle \"row\",
  // without \"owner\" name, and all required branch rows", "the apiAuth.js module, when the node boots, will check for all
  // valid \"process/js/<appServerName>/<appServerName>Bundles.json.\" files, and update the auth.bundle and auth.branch,
  // adding new verbs, when needed, and deleting verbs, if they are no longer in the ... file, always using/asserting the
  // server <appServerName> as \"owner\"", "when apiAuth.js adds a bundle for the first time, it stores its key in the
  // appServers state file relay-state/process/<appServerName>/bundles.json, with its key, and and the same \"label\"",
  // "if a USER deletes a bundle owned by an Server, apiAuth.js it will create a new bundle it owns under the exact same
  // key that was used before", and "if a key is deleted from an ... file, apiAuth.js will delete that key from auth.bundle
  // AND all its rows in auth.branch."
  // The boot is createApiAuth on the node's root, as server.js makes it; the appServers are its process/js/ folders.
  // The row's shape (./apiAuth.md): { label, branches: [{ family, verb }] }, the branch rows auth.branch keeps.
  const bootRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-apiAuth-boot-'));
  const APPS = path.join(bootRoot, 'process', 'js');
  const writeBundles = function (app, obj) {
    fs.mkdirSync(path.join(APPS, app), { recursive: true });
    fs.writeFileSync(path.join(APPS, app, app + 'Bundles.json'), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  };
  const stateOf = function (app) { return readJson(path.join(bootRoot, 'relay-state', 'process', app, 'bundles.json')); };
  // probe is an appServer the live tree does not serve yet: at the node's boot no appServer runs.
  const bootTree = { files: { read: {}, list: {} }, desk: { 'chat.add': {}, 'item.get': {} } };
  const boot = function () { return createApiAuth({ rootDir: bootRoot, tree: function () { return Promise.resolve(bootTree); } }); };
  const ownedBy = async function (a, app) { return ((await call(a, 'bundle', { op: 'search', text: '' })).items || []).map(parsed).filter(function (x) { return x && x.owner === app; }); };
  const branchesOf = async function (a, id) { return ((await call(a, 'branch', { op: 'search', text: '', bundle: id })).items || []).map(parsed).map(function (b) { return b.family + '.' + b.verb; }).sort(); };
  const settleBoot = async function () { for (let i = 0; i < 50; i++) await new Promise(function (r) { setImmediate(r); }); await new Promise(function (r) { setTimeout(r, 100); }); };
  writeBundles('probe', {
    probeAgent: { label: 'Probe agent', owner: 'someone else', branches: [{ family: 'probe', verb: 'ping' }, { family: 'files', verb: 'read' }] },
    probeUser: { label: 'Probe user', branches: [{ family: 'probe', verb: 'ping' }] },
  });
  fs.mkdirSync(path.join(APPS, 'plain'), { recursive: true });
  writeBundles('broken', '{ this is not json');
  let a1 = boot(); await settleBoot();
  let mine1 = await ownedBy(a1, 'probe');
  const agentRow = mine1.filter(function (x) { return x.label === 'Probe agent'; })[0];
  const userRow = mine1.filter(function (x) { return x.label === 'Probe user'; })[0];
  ok(mine1.length === 2 && !!agentRow && !!userRow, 'at boot, each key of process/js/<appServerName>/<appServerName>Bundles.json is a bundle of auth.bundle, its label the row\'s', 'probe owns: ' + short(mine1));
  ok(!!agentRow && agentRow.owner === 'probe' && (await ownedBy(a1, 'someone else')).length === 0, 'owned by the appServer, <appServerName>, whatever owner the row names', 'row: ' + short(agentRow));
  ok(!!agentRow && JSON.stringify(await branchesOf(a1, agentRow.id)) === JSON.stringify(['files.read', 'probe.ping']), 'with its branch rows, the appServer\'s own verbs among them though it is not served yet', 'branches: ' + short(agentRow && await branchesOf(a1, agentRow.id)));
  // The rest asks of these two, so a boot that made neither fails each check instead of stopping the test.
  const AID = agentRow ? AID : -1;
  const UID = userRow ? UID : -1;
  const st1 = stateOf('probe');
  ok(!!st1 && !!agentRow && !!userRow && st1.probeAgent && st1.probeAgent.id === AID && st1.probeAgent.label === 'Probe agent' && st1.probeUser && st1.probeUser.id === UID && st1.probeUser.label === 'Probe user',
    'and each key kept in relay-state/process/<appServerName>/bundles.json with its bundle\'s id and the same label', 'state: ' + short(st1));
  ok((await call(a1, 'bundle', { op: 'search', text: '' })).items.map(parsed).every(function (x) { return x.owner !== 'plain' && x.owner !== 'broken'; }) && stateOf('broken') === null,
    'an appServer with no Bundles.json, or one that is not valid, gets nothing, and the others are written all the same', 'owners: ' + short((await call(a1, 'bundle', { op: 'search', text: '' })).items.map(parsed).map(function (x) { return x.owner; })));
  // A bundle the editor added for that appServer (goal/G41.25) is the user's: no key of the file names it.
  const byEditor = await call(a1, 'bundle', { op: 'add', label: 'Made in the editor', owner: 'probe' });
  await call(a1, 'branch', { op: 'add', bundle: byEditor.id, family: 'files', verb: 'list' });

  const a2 = boot(); await settleBoot();
  const mine2 = await ownedBy(a2, 'probe');
  ok(mine2.filter(function (x) { return x.label === 'Probe agent'; }).length === 1 && mine2.filter(function (x) { return x.label === 'Probe user'; }).length === 1 && JSON.stringify(stateOf('probe')) === JSON.stringify(st1),
    'booted again on the same file, nothing is added twice: the kept key is the bundle', 'probe owns: ' + short(mine2) + ', state ' + short(stateOf('probe')));

  writeBundles('probe', {
    probeAgent: { label: 'Probe agent', branches: [{ family: 'probe', verb: 'ping' }, { family: 'probe', verb: 'pong' }] },
  });
  await call(a2, 'bundle', { op: 'delete', id: UID });
  const a3 = boot(); await settleBoot();
  const mine3 = await ownedBy(a3, 'probe');
  ok(JSON.stringify(await branchesOf(a3, AID)) === JSON.stringify(['probe.ping', 'probe.pong']), 'a verb added to a key is added, a verb no longer in it is deleted, the same bundle', 'branches: ' + short(await branchesOf(a3, AID)));
  ok(mine3.filter(function (x) { return x.label === 'Probe user'; }).length === 0 && !('probeUser' in (stateOf('probe') || {})),
    'a key taken out of the file: its bundle goes from auth.bundle, and from the state file', 'probe owns: ' + short(mine3) + ', state ' + short(stateOf('probe')));
  ok(((await call(a3, 'branch', { op: 'search', text: '' })).items || []).map(parsed).every(function (b) { return b.bundle !== UID; }), 'and all its rows in auth.branch', 'branches left: ' + short(((await call(a3, 'branch', { op: 'search', text: '' })).items || []).map(parsed).filter(function (b) { return b.bundle === UID; })));
  ok((await call(a3, 'bundle', { op: 'get', id: byEditor.id })).label === 'Made in the editor' && JSON.stringify(await branchesOf(a3, byEditor.id)) === JSON.stringify(['files.list']),
    'a bundle the user added for that appServer, kept under no key, is left as it was', 'editor\'s: ' + short(await call(a3, 'bundle', { op: 'get', id: byEditor.id })));

  // A USER deletes the appServer's bundle: the next boot makes it again under the same key.
  await call(a3, 'bundle', { op: 'delete', id: AID });
  const a4 = boot(); await settleBoot();
  const again4 = (await ownedBy(a4, 'probe')).filter(function (x) { return x.label === 'Probe agent'; });
  const st4 = stateOf('probe');
  ok(again4.length === 1 && again4[0].id !== AID && !!st4 && st4.probeAgent && st4.probeAgent.id === again4[0].id && JSON.stringify(await branchesOf(a4, again4[0].id)) === JSON.stringify(['probe.ping', 'probe.pong']),
    'a bundle of the appServer\'s that the user deleted is made again at the next boot, its new id kept under the same key', 'probe owns: ' + short(again4) + ', state ' + short(st4));
  try { fs.rmSync(bootRoot, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('the bundles persist');
  const again = createApiAuth({ rootDir: root, tree: function () { return Promise.resolve(tree); } });
  ok((await call(again, 'bundle', { op: 'get', id: reader.id })).label === 'Lister' && (await call(again, 'branch', { op: 'search', text: '', bundle: reader.id })).items.length === 1,
    'opened again on the same root, the bundles and their branches are there', 'get: ' + short(await call(again, 'bundle', { op: 'get', id: reader.id })));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
