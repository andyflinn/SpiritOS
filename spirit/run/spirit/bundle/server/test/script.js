'use strict';

// spirit/run/spirit/bundle/server/test/script.js
// The tests of spirit/bundle/server/script.js, the spirit.bundle branch's node work, and of no other module (spec: ./script.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's
// (Q5, Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/bundle/script.js's verbs, read from it; what each answer does, on a scratch
// node at its one door, against that verb's own description, spirit/bundle/<verb>.json. The app server it names is the node's
// own, read from its app search.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/bundle/server/script.js';
const BRANCH = 'spirit/bundle/script.js';
const NAME = 'spirit.bundle';

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
const parsed = function (t) { try { return JSON.parse(t); } catch (e) { return null; } };
// What the node server hands every branch's node work (spirit/server/script.js, branchNode): here anything asked of it a
// function that makes a handler, its reply shapes objects.
const HAND = new Proxy({}, { get: function (t, k) { return k === 'LIST' || k === 'JOB' ? { shape: true } : function () { return function () {}; }; } });
let M = null;
try { M = LOADER.requireScript(SUBJECT); } catch (e) { M = null; }
function handed(relay) {
  const S = globalThis.spirit;
  const was = S.IS_RELAY;
  try { S.IS_RELAY = relay; return M.verbs(HAND); } catch (e) { return null; } finally { S.IS_RELAY = was; }
}
async function ask(call, args) {
  if (!W.node || !W.node.up) return { status: 0, body: null };
  try {
    const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const out = { status: r.status, body: parsed(await r.text()) };
    // Every bundle an add made, whatever the test that asked it, for the search of every bundle.
    if (call === NAME + '.add' && out.status === 200 && out.body && isId(out.body.id)) W.made.push(out.body.id);
    return out;
  } catch (e) { return { status: 0, body: null }; }
}
const refused = function (r) { return !!r && r.status >= 400 && r.status < 500 && !!r.body && r.body.ok === false; };
const isId = function (v) { return typeof v === 'number' && v > 0 && Math.floor(v) === v; };
const keysOf = function (r) { return ((r && r.body && r.body.items) || []).map(function (i) { return i.key; }); };

const W = { declared: [], node: null, id: 0, other: 0, row: 0, made: [] };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/bundle/script.js declares, and for no other', 0.2, async function () {
  let branch = null;
  try { branch = await Promise.resolve(LOADER.requireScript(BRANCH)); } catch (e) { branch = null; }
  W.declared = Object.keys((branch && branch.verbs) || {}).sort();
  const got = handed(false);
  return (!!got && W.declared.length > 0 && same(Object.keys(got).sort(), W.declared)) || false;
}, test.limit.quick);
test.run('each answer it hands holds its reply, an object, and its handler, a function', 0.2, function () {
  const got = handed(false) || {};
  const verbs = Object.keys(got);
  return (verbs.length > 0 && verbs.every(function (v) { return !!got[v] && !!got[v].reply && typeof got[v].reply === 'object' && typeof got[v].handler === 'function'; })) || false;
}, test.limit.quick);
test.run('on a relay it hands no answer', 0.2, function () {
  const got = handed(true);
  return (!!got && same(Object.keys(got), []) && Object.keys(handed(false) || {}).length > 0) || false;
}, test.limit.quick);

// ── WHAT EACH ANSWER DOES, ON A SCRATCH NODE ──
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return (!!W.node && W.node.up) || false;
}, test.limit.long);
// add.json: "A new bundle ... {id}. Owned by node (an owner naming an app server is refused not-node-owned, an invalid one is
// read as node); its label is never empty, unique among node's bundles (label-taken)".
test.run('add makes a node-owned bundle, answering {id}', 0.2, async function () {
  const r = await ask(NAME + '.add', { label: 'Zz Quokka Bundle' });
  W.id = r.body && r.body.id;
  return (r.status === 200 && isId(W.id) && same(Object.keys(r.body), ['id'])) || false;
}, test.limit.quick);
test.run('add of a label one of node\'s bundles has is refused label-taken', 0.2, async function () {
  if (!W.id) return false;
  const r = await ask(NAME + '.add', { label: 'Zz Quokka Bundle' });
  return (refused(r) && r.body.code === 'label-taken') || false;
}, test.limit.quick);
test.run('add with an empty label is refused', 0.2, async function () {
  return refused(await ask(NAME + '.add', { label: '' })) || false;
}, test.limit.quick);
test.run('add naming an app server for its owner is refused not-node-owned', 0.2, async function () {
  const apps = await ask('spirit.app.search', {});
  const server = ((apps.body && apps.body.items) || []).map(function (i) { return parsed(i.label); }).filter(function (a) { return a && a.nodeMount === true; })[0];
  if (!server) return false;
  const r = await ask(NAME + '.add', { label: 'Zz Server Bundle', owner: server.key });
  return (refused(r) && r.body.code === 'not-node-owned') || false;
}, test.limit.quick);
test.run('add naming an owner that is no owner reads it as node', 0.2, async function () {
  const r = await ask(NAME + '.add', { label: 'Zz Other Bundle', owner: 'zz.no.owner' });
  W.other = r.body && r.body.id;
  const g = isId(W.other) ? await ask(NAME + '.get', { id: W.other }) : null;
  return (r.status === 200 && !!g && g.status === 200 && g.body.owner === 'node') || false;
}, test.limit.quick);
// get.json: "One bundle by its number: {id, label, owner}; no-such-bundle when the table does not hold it."
test.run('get answers the bundle by its number, {id, label, owner}', 0.2, async function () {
  if (!W.id) return false;
  const r = await ask(NAME + '.get', { id: W.id });
  return (r.status === 200 && same(r.body, { id: W.id, label: 'Zz Quokka Bundle', owner: 'node' })) || false;
}, test.limit.quick);
test.run('get of a number the table does not hold is refused no-such-bundle', 0.2, async function () {
  const r = await ask(NAME + '.get', { id: 9999 });
  return (refused(r) && r.body.code === 'no-such-bundle') || false;
}, test.limit.quick);
// search.json: "The node's bundles ranked by the words (text) over their labels, an owner narrowing it ...: {items, more}."
test.run('search with no words answers every bundle as {items, more}, each label the bundle as get shows it', 0.2, async function () {
  if (!W.id || !W.other) return false;
  const r = await ask(NAME + '.search', {});
  const items = (r.body && r.body.items) || [];
  const mine = parsed((items.filter(function (i) { return i.key === String(W.id); })[0] || {}).label);
  return (r.status === 200 && typeof r.body.more === 'boolean' && same(keysOf(r).sort(), W.made.map(String).sort()) &&
    same(mine, { id: W.id, label: 'Zz Quokka Bundle', owner: 'node' })) || false;
}, test.limit.quick);
test.run('search by text ranks the bundle its words name first', 0.2, async function () {
  if (!W.id) return false;
  const k = keysOf(await ask(NAME + '.search', { text: 'Quokka' }));
  return (k.length > 0 && k[0] === String(W.id)) || false;
}, test.limit.quick);
test.run('search narrowed by an owner answers that owner\'s bundles alone', 0.2, async function () {
  if (!W.id) return false;
  const node = keysOf(await ask(NAME + '.search', { owner: 'node' }));
  const none = await ask(NAME + '.search', { owner: 'zzNoSuchOwner' });
  return (node.indexOf(String(W.id)) !== -1 && none.status === 200 && same(keysOf(none), [])) || false;
}, test.limit.quick);
// delete.json: "A node-owned bundle and every branch row that names it, in one step: {id}; no-such-bundle".
test.run('delete takes the bundle and every branch row naming it, answering {id}', 0.2, async function () {
  if (!W.id) return false;
  const b = await ask('spirit.branch.add', { bundle: W.id, family: NAME });
  W.row = b.body && b.body.id;
  if (!isId(W.row)) return false;
  const r = await ask(NAME + '.delete', { id: W.id });
  const gone = await ask(NAME + '.get', { id: W.id });
  const rowGone = await ask('spirit.branch.get', { id: W.row });
  const kept = await ask(NAME + '.get', { id: W.other });
  return (r.status === 200 && same(r.body, { id: W.id }) && refused(gone) && refused(rowGone) && kept.status === 200) || false;
}, test.limit.quick);
test.run('delete of a number the table does not hold is refused no-such-bundle', 0.2, async function () {
  const r = await ask(NAME + '.delete', { id: 9999 });
  return (refused(r) && r.body.code === 'no-such-bundle') || false;
}, test.limit.quick);
