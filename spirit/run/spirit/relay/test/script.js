'use strict';

// spirit/run/spirit/relay/test/script.js
// The tests of spirit/relay/script.js, the spirit.relay branch, and of no other module (spec: ./script.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72); the branch is goal/G49.25's (box v25: "the api
// portion of the spirit.relay branch is removed from spirit/relay/processor and implemented properly as a system branch in the
// tree"; "the entire set of relay verbs moves into spirit.relay.<verb>, with only ONE, SINGLE door: /spirit").
// What it says is read from it: its verbs and their arguments, never a list of them here. It is judged in this process (its
// client, its rules, the relay's node work against it) and on a scratch relay and a scratch node, at their one door.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../script.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchRelay, scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/relay/script.js';
const WORK = 'spirit/relay/server/script.js';

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
const ruleOf = function (r) { return String(r).replace(/\?$/, ''); };
const required = function (args) { return Object.keys(args || {}).filter(function (a) { return !/\?$/.test(String(args[a])); }); };
// A call at a door: { call, args } at POST /spirit, or an upload named in its header, its body raw.
async function ask(base, call, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b };
  } catch (e) { return { status: 0, body: null }; }
}
async function upload(base, call) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'X-Spirit-Call': call }, body: 'x' });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b };
  } catch (e) { return { status: 0, body: null }; }
}
const noVerb = function (r) { return !!r && !!r.body && r.body.code === 'no-such-verb'; };

// What the tests make, each in order, read by the tests after it.
const W = { branch: null, relay: null, node: null, at: {} };
test.after(async function () {
  try { if (W.relay) await W.relay.release(); } catch (e) { /* gone */ }
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
});

// ── IN THIS PROCESS ──
test.run('spirit.requireScript of its path hands back the branch, its verbs table among it', 0.2, async function () {
  try { W.branch = await Promise.resolve(LOADER.requireScript(SUBJECT)); } catch (e) { W.branch = null; }
  return (!!W.branch && !!W.branch.verbs && typeof W.branch.verbs === 'object' && Object.keys(W.branch.verbs).length > 0) || false;
}, test.limit.quick);
test.run('requiring it brings its client, at spirit.relay.client', 0.2, function () {
  const S = globalThis.spirit;
  return (!!W.branch && !!S.relay && !!S.relay.client && typeof S.relay.client === 'object' && W.branch.client === S.relay.client) || false;
}, test.limit.quick);
test.run('every argument of every verb is a spirit.type rule: its script answers isValid, and takes its own default value', 0.2, function () {
  const verbs = (W.branch && W.branch.verbs) || {};
  const rules = [];
  Object.keys(verbs).forEach(function (v) { Object.keys(verbs[v] || {}).forEach(function (a) { rules.push(ruleOf(verbs[v][a])); }); });
  if (!rules.length) return false;
  return rules.every(function (r) {
    if (!/^spirit\/type\/.+\/script\.js$/.test(r)) return false;
    let T = null;
    try { T = LOADER.requireScript(r); } catch (e) { return false; }
    if (!T || typeof T.isValid !== 'function' || typeof T.defaultValue !== 'function') return false;
    try { return T.isValid(T.defaultValue()) === true; } catch (e) { return false; }
  }) || false;
}, test.limit.quick);
// THE BRANCH LISTS EVERY VERB THE RELAY MOUNTS (its own words: "every verb the relay mounts for this branch"): the relay's node
// work, asked as the relay's server asks it, answers exactly the verbs it declares.
test.run('it declares exactly the verbs the relay\'s node work answers on a relay', 0.2, function () {
  const S = globalThis.spirit;
  const was = S.IS_RELAY;
  let mounted = null;
  try {
    S.IS_RELAY = true;
    const hand = new Proxy({}, { get: function () { return function () { return function () {}; }; } });
    mounted = LOADER.requireScript(WORK).verbs(hand);
  } catch (e) { mounted = null; } finally { S.IS_RELAY = was; }
  const declared = Object.keys((W.branch && W.branch.verbs) || {}).sort();
  return (!!mounted && declared.length > 0 && same(Object.keys(mounted).sort(), declared)) || false;
}, test.limit.quick);

// ── ON A SCRATCH RELAY, AT ITS ONE DOOR ──
test.run('a scratch relay comes up', 0.2, async function () {
  W.relay = await scratchRelay();
  return (!!W.relay && W.relay.up) || false;
}, test.limit.long);
// A verb is there when its call is anything but no-such-verb: as { call, args }, or else as an upload named in its header.
test.run('every verb it declares is a verb at the relay\'s one door, as a call or as an upload', 0.2, async function () {
  if (!W.relay || !W.relay.up || !W.branch) return false;
  const verbs = Object.keys(W.branch.verbs);
  for (const v of verbs) {
    const name = 'spirit.relay.' + v;
    let r = await ask(W.relay.base, name, {});
    if (noVerb(r)) r = await upload(W.relay.base, name);
    W.at[v] = r;
    if (!r.status || noVerb(r)) return false;
  }
  return verbs.length > 0;
}, test.limit.long);
test.run('a verb it does not declare is no verb at the relay\'s door', 0.2, async function () {
  if (!W.relay || !W.relay.up) return false;
  return noVerb(await ask(W.relay.base, 'spirit.relay.zzNoSuchVerb', {})) || false;
}, test.limit.quick);
// Called with no arguments (above): a verb with a required argument is refused 400 by the branch's check, naming one of them.
test.run('a verb called without its required arguments is refused 400, the refusal naming one it declares required', 0.2, function () {
  const verbs = (W.branch && W.branch.verbs) || {};
  const judged = Object.keys(verbs).filter(function (v) { return required(verbs[v]).length > 0; });
  if (!judged.length) return false;
  return judged.every(function (v) {
    const r = W.at[v];
    return !!r && r.status === 400 && !!r.body && r.body.code === 'bad-request' && required(verbs[v]).indexOf(r.body.argument) !== -1;
  }) || false;
}, test.limit.quick);
test.run('a verb that requires no argument is never refused for one', 0.2, function () {
  const verbs = (W.branch && W.branch.verbs) || {};
  const judged = Object.keys(verbs).filter(function (v) { return required(verbs[v]).length === 0; });
  if (!judged.length) return false;
  return judged.every(function (v) { const r = W.at[v]; return !!r && !!r.status && !(r.body && r.body.argument); }) || false;
}, test.limit.quick);
test.run('the scratch relay is let go', 0.2, async function () {
  try { if (W.relay) await W.relay.release(); } catch (e) { return false; }
  W.relay = null;
  return true;
}, test.limit.long);

// ── ON A NODE IT IS NO BRANCH (box v25: "the fs watcher, when !spirit.IS_RELAY, will never mark spirit.relay as a branch") ──
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return (!!W.node && W.node.up) || false;
}, test.limit.long);
test.run('on a node no verb it declares is served: each is no such verb at the node\'s door', 0.2, async function () {
  if (!W.node || !W.node.up || !W.branch) return false;
  const verbs = Object.keys(W.branch.verbs);
  for (const v of verbs) {
    const r = await ask(W.node.base, 'spirit.relay.' + v, {});
    if (!(r.status === 400 && r.body && /no such verb/.test(String(r.body.error || '')))) return false;
  }
  return verbs.length > 0;
}, test.limit.long);
