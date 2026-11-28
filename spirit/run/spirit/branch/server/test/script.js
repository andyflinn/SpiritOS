'use strict';

// spirit/run/spirit/branch/server/test/script.js
// The tests of spirit/branch/server/script.js, the spirit.branch branch's node work, and of no other module (spec: ./script.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's
// (Q5, Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/branch/script.js's verbs, read from it; what each answer does, on a scratch
// node at its one door, against that verb's own description, spirit/branch/<verb>.json. The branches it puts in a bundle are the
// node's own, read from the scripts that declare them.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/branch/server/script.js';
const BRANCH = 'spirit/branch/script.js';
const NAME = 'spirit.branch';

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
    return { status: r.status, body: parsed(await r.text()) };
  } catch (e) { return { status: 0, body: null }; }
}
const refusedAs = function (r, status, code) { return !!r && r.status === status && !!r.body && r.body.code === code; };
const refused = function (r) { return !!r && r.status >= 400 && r.status < 500 && !!r.body && r.body.ok === false; };
const isId = function (v) { return typeof v === 'number' && v > 0 && Math.floor(v) === v; };
async function verbsOf(script) { try { const b = await Promise.resolve(LOADER.requireScript(script)); return Object.keys((b && b.verbs) || {}); } catch (e) { return []; } }

const W = { declared: [], node: null, bundle: 0, one: 0, whole: 0 };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/branch/script.js declares, and for no other', 0.2, async function () {
  W.declared = (await verbsOf(BRANCH)).sort();
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
// A node-owned bundle to put branches into, by the bundle branch (spirit.bundle.add).
test.run('a scratch node comes up, with a node-owned bundle to fill', 0.2, async function () {
  W.node = await scratchNode();
  if (!W.node || !W.node.up) return false;
  const b = await ask('spirit.bundle.add', { label: 'Zz Holder' });
  W.bundle = b.body && b.body.id;
  return isId(W.bundle) || false;
}, test.limit.long);
// add.json: "A branch of the node's API, and one verb of it or '' for all of it, into a bundle: {id}".
test.run('add puts a branch and one verb the node serves into the bundle, answering {id}', 0.2, async function () {
  if (!W.bundle || !W.declared.length) return false;
  const r = await ask(NAME + '.add', { bundle: W.bundle, family: NAME, verb: W.declared[0] });
  W.one = r.body && r.body.id;
  return (r.status === 200 && isId(W.one) && same(Object.keys(r.body), ['id'])) || false;
}, test.limit.quick);
test.run('add with no verb puts the whole branch in, its verb empty', 0.2, async function () {
  if (!W.bundle) return false;
  const r = await ask(NAME + '.add', { bundle: W.bundle, family: 'spirit.bundle' });
  W.whole = r.body && r.body.id;
  const g = isId(W.whole) ? await ask(NAME + '.get', { id: W.whole }) : null;
  return (r.status === 200 && !!g && g.status === 200 && g.body.verb === '' && g.body.family === 'spirit.bundle') || false;
}, test.limit.quick);
test.run('add of a branch and verb the bundle holds already is refused already-in-bundle', 0.2, async function () {
  if (!W.one) return false;
  return refusedAs(await ask(NAME + '.add', { bundle: W.bundle, family: NAME, verb: W.declared[0] }), 409, 'already-in-bundle') || false;
}, test.limit.quick);
test.run('add into a bundle that is not there is refused no-such-bundle', 0.2, async function () {
  const r = await ask(NAME + '.add', { bundle: W.bundle + 999, family: NAME });
  return (refused(r) && r.body.code === 'no-such-bundle') || false;
}, test.limit.quick);
test.run('add of a branch the node does not serve is refused', 0.2, async function () {
  if (!W.bundle) return false;
  return refused(await ask(NAME + '.add', { bundle: W.bundle, family: 'spirit.zzNoSuchBranch' })) || false;
}, test.limit.quick);
test.run('add of a verb its branch does not serve is refused', 0.2, async function () {
  if (!W.bundle) return false;
  return refused(await ask(NAME + '.add', { bundle: W.bundle, family: NAME, verb: 'zzNoSuchVerb' })) || false;
}, test.limit.quick);
// get.json: "One row by its number: {id, bundle, family, verb}; no-such-branch when the table does not hold it."
test.run('get answers the row by its number, {id, bundle, family, verb}', 0.2, async function () {
  if (!W.one) return false;
  const r = await ask(NAME + '.get', { id: W.one });
  return (r.status === 200 && same(r.body, { id: W.one, bundle: W.bundle, family: NAME, verb: W.declared[0] })) || false;
}, test.limit.quick);
test.run('get of a number the table does not hold is refused no-such-branch', 0.2, async function () {
  const r = await ask(NAME + '.get', { id: 9999 });
  return (refused(r) && r.body.code === 'no-such-branch') || false;
}, test.limit.quick);
// search.json: "one row per branch and verb ... {items, more}, ranked by the words (text) and narrowed by each filter given".
test.run('search narrowed by bundle answers that bundle\'s rows as {items, more}, each label the row as get shows it', 0.2, async function () {
  if (!W.one || !W.whole) return false;
  const r = await ask(NAME + '.search', { bundle: W.bundle });
  const items = (r.body && r.body.items) || [];
  const keys = items.map(function (i) { return i.key; }).sort();
  const row = (items.filter(function (i) { return i.key === String(W.one); })[0] || {}).label;
  return (r.status === 200 && typeof r.body.more === 'boolean' && same(keys, [String(W.one), String(W.whole)].sort()) &&
    same(parsed(row), { id: W.one, bundle: W.bundle, family: NAME, verb: W.declared[0] })) || false;
}, test.limit.quick);
test.run('search narrowed by family answers that family\'s rows alone', 0.2, async function () {
  if (!W.whole) return false;
  const r = await ask(NAME + '.search', { family: 'spirit.bundle' });
  const keys = ((r.body && r.body.items) || []).map(function (i) { return i.key; });
  return (r.status === 200 && same(keys, [String(W.whole)])) || false;
}, test.limit.quick);
test.run('search by text ranks the row its words name first', 0.2, async function () {
  if (!W.whole) return false;
  const r = await ask(NAME + '.search', { text: 'bundle' });
  const items = (r.body && r.body.items) || [];
  return (r.status === 200 && items.length > 0 && items[0].key === String(W.whole)) || false;
}, test.limit.quick);
// "no spirit.fs verb is taken (owner-only)": a verb of spirit.fs, read from its own script.
test.run('add of a spirit.fs verb is refused owner-only', 0.8, async function () {
  const fsVerbs = await verbsOf('spirit/fs/script.js');
  if (!W.bundle || !fsVerbs.length) return false;
  const r = await ask(NAME + '.add', { bundle: W.bundle, family: 'spirit.fs', verb: fsVerbs[0] });
  return (refused(r) && r.body.code === 'owner-only') || false;
}, test.limit.quick);
// delete.json: "That row alone: {id}; no-such-branch".
test.run('delete takes that row alone, answering {id}: get then refuses it, the other row stays', 0.2, async function () {
  if (!W.one || !W.whole) return false;
  const r = await ask(NAME + '.delete', { id: W.one });
  const gone = await ask(NAME + '.get', { id: W.one });
  const kept = await ask(NAME + '.get', { id: W.whole });
  return (r.status === 200 && same(r.body, { id: W.one }) && refused(gone) && kept.status === 200) || false;
}, test.limit.quick);
test.run('delete of a number the table does not hold is refused no-such-branch', 0.2, async function () {
  const r = await ask(NAME + '.delete', { id: 9999 });
  return (refused(r) && r.body.code === 'no-such-branch') || false;
}, test.limit.quick);
