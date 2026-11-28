'use strict';

// spirit/run/spirit/app/server/test/script.js
// The tests of spirit/app/server/script.js, the spirit.app branch's node work, and of no other module (spec: ./script.md). Its
// own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's (Q5,
// Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/app/script.js's verbs, read from it; what each answer does, on a scratch
// node at its one door, against that verb's own description, spirit/app/<verb>.json. The apps it asks of are the node's own,
// read from its search, never named here.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const fs = require('fs');
const path = require('path');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/app/server/script.js';
const BRANCH = 'spirit/app/script.js';
const NAME = 'spirit.app';

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
const refused = function (r, status) { return !!r && r.status === status && !!r.body && r.body.ok !== true; };
// The search's rows, each its label read back.
const rowsOf = function (r) { return (r && r.body && Array.isArray(r.body.items) ? r.body.items : []).map(function (i) { return { key: i.key, row: parsed(i.label) }; }); };
async function rowOf(key) {
  const one = rowsOf(await ask(NAME + '.search', {})).filter(function (x) { return x.key === key; })[0];
  return one ? one.row : null;
}

const W = { declared: [], node: null, rows: [], plain: null, intrinsic: null, runOnly: null };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/app/script.js declares, and for no other', 0.2, async function () {
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
// search.json: "a bounded list of {key: the app's folder name, label}; a label is the row as JSON".
test.run('search with no q answers the node\'s apps as {ok, items, more}, each label its row as JSON under the item\'s key', 0.2, async function () {
  const r = await ask(NAME + '.search', {});
  W.rows = rowsOf(r);
  W.plain = (W.rows.filter(function (x) { return x.row && !x.row.intrinsic && !x.row.nodeMount && !x.row.run && !x.row.runOnly; })[0] || {}).row || null;
  W.intrinsic = (W.rows.filter(function (x) { return x.row && x.row.intrinsic === true; })[0] || {}).row || null;
  W.runOnly = (W.rows.filter(function (x) { return x.row && x.row.runOnly === true && !x.row.intrinsic; })[0] || {}).row || null;
  return (r.status === 200 && r.body.ok === true && typeof r.body.more === 'boolean' && W.rows.length > 0 &&
    W.rows.every(function (x) { return !!x.row && x.row.key === x.key && typeof x.row.label === 'string'; })) || false;
}, test.limit.quick);
test.run('search with q answers fewer apps than no q, the app it names first', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const r = await ask(NAME + '.search', { q: one.label });
  const rows = rowsOf(r);
  return (r.status === 200 && rows.length > 0 && rows.length < W.rows.length && rows[0].key === one.key) || false;
}, test.limit.quick);
// label.json: "Sets the label this node shows for an app ... It answers no rows".
test.run('label sets the label search shows for that app, answering no rows', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const r = await ask(NAME + '.label', { key: one.key, label: 'Zz Quokka' });
  const now = await rowOf(one.key);
  return (r.status === 200 && !!r.body && r.body.ok === true && r.body.items === undefined && !!now && now.label === 'Zz Quokka') || false;
}, test.limit.quick);
test.run('label empty goes back to the app\'s own label', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const r = await ask(NAME + '.label', { key: one.key, label: '' });
  const now = await rowOf(one.key);
  return (r.status === 200 && !!now && now.label === one.label) || false;
}, test.limit.quick);
test.run('label of a key that is no app is refused 404', 0.2, async function () {
  return refused(await ask(NAME + '.label', { key: 'zzNoSuchApp', label: 'Zz' }), 404) || false;
}, test.limit.quick);
test.run('icon sets the icon search shows for that app, answering no rows', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const r = await ask(NAME + '.icon', { key: one.key, icon: '🦉' });
  const now = await rowOf(one.key);
  return (r.status === 200 && !!r.body && r.body.ok === true && r.body.items === undefined && !!now && now.icon === '🦉') || false;
}, test.limit.quick);
test.run('icon empty goes back to the app\'s own icon', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const r = await ask(NAME + '.icon', { key: one.key, icon: '' });
  const now = await rowOf(one.key);
  return (r.status === 200 && !!now && now.icon === one.icon) || false;
}, test.limit.quick);
test.run('icon of a key that is no app is refused', 0.2, async function () {
  const r = await ask(NAME + '.icon', { key: 'zzNoSuchApp', icon: '🦉' });
  return (r.status >= 400 && r.status < 500 && !!r.body && r.body.ok !== true) || false;
}, test.limit.quick);
// active.json: "Sets whether an app ... is active, in spirit/state/<key>/node.json ... It answers no rows".
test.run('active switches an app on and off, in its node.json and as search shows it, answering no rows', 0.2, async function () {
  const one = W.plain;
  if (!one) return false;
  const S = globalThis.spirit;
  const file = path.join(W.node.run, ...S.statePath(S.slashedPath(one.key)).split('/'), 'node.json');
  const on = await ask(NAME + '.active', { key: one.key, active: true });
  const onRow = await rowOf(one.key);
  const onFile = parsed(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
  const off = await ask(NAME + '.active', { key: one.key, active: false });
  const offRow = await rowOf(one.key);
  return (on.status === 200 && on.body.ok === true && on.body.items === undefined && !!onRow && onRow.active === true && !!onFile && onFile.active === true &&
    off.status === 200 && !!offRow && offRow.active === false) || false;
}, test.limit.quick);
test.run('active of a key that is no app is refused 404', 0.2, async function () {
  return refused(await ask(NAME + '.active', { key: 'zzNoSuchApp', active: true }), 404) || false;
}, test.limit.quick);
test.run('active of an intrinsic app is refused 409', 0.2, async function () {
  if (!W.intrinsic) return false;
  return refused(await ask(NAME + '.active', { key: W.intrinsic.key, active: false }), 409) || false;
}, test.limit.quick);
test.run('active of an app that is only run is refused 409', 0.2, async function () {
  if (!W.runOnly) return false;
  return refused(await ask(NAME + '.active', { key: W.runOnly.key, active: true }), 409) || false;
}, test.limit.quick);
