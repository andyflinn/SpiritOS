'use strict';

// spirit/run/spirit/job/server/test/script.js
// The tests of spirit/job/server/script.js, the spirit.job branch's node work, and of no other module (spec: ./script.md). Its
// own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's (Q5,
// Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/job/script.js's verbs, read from it; what each answer does, on a scratch
// node at its one door, against that verb's own description, spirit/job/<verb>.json. The jobs it asks of are the node's own,
// read from its search; the apps it would start, the node's own, read from the app search.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/job/server/script.js';
const BRANCH = 'spirit/job/script.js';
const NAME = 'spirit.job';

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
  if (!W.node || !W.node.up) return { status: 0, body: null, text: '' };
  try {
    const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, body: parsed(text), text: text };
  } catch (e) { return { status: 0, body: null, text: '' }; }
}
const refusedAs = function (r, status, code) { return !!r && r.status === status && !!r.body && r.body.ok === false && r.body.code === code; };
const ENDED = ['cancelled', 'completed', 'failed', 'stopped'];

const W = { declared: [], node: null, items: [], running: null };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/job/script.js declares, and for no other', 0.2, async function () {
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
}, test.limit.long, { why: 'it starts a scratch node' });
// search.json: "This node's jobs, every one ... as a bounded list of {key: job id, label: \"type (status)\"}".
test.run('search with no q answers the node\'s jobs as a bounded list, each keyed by its id', 0.2, async function () {
  const r = await ask(NAME + '.search', {});
  W.items = (r.body && r.body.items) || [];
  return (r.status === 200 && typeof r.body.more === 'boolean' && W.items.length > 0 && W.items.every(function (i) { return typeof i.key === 'string' && !!i.key && typeof i.label === 'string'; })) || false;
}, test.limit.quick);
// get.json: "One job by its id (key): {ok, key, job: {id, kind, type, status, createdAt, updatedAt, log, data, module?, app?}}".
test.run('get answers a job by its id, {ok, key, job}, the job with its id, kind, type, status, createdAt, updatedAt, log and data', 0.2, async function () {
  const first = W.items[0];
  if (!first) return false;
  const r = await ask(NAME + '.get', { key: first.key });
  const j = r.body && r.body.job;
  return (r.status === 200 && r.body.ok === true && r.body.key === first.key && !!j && j.id === first.key &&
    ['id', 'kind', 'type', 'status', 'createdAt', 'updatedAt', 'log', 'data'].every(function (k) { return Object.prototype.hasOwnProperty.call(j, k); })) || false;
}, test.limit.quick);
test.run('each job search lists is labelled with its type and its status, as get answers them', 0.2, async function () {
  if (!W.items.length) return false;
  let all = true;
  for (const i of W.items) {
    const j = ((await ask(NAME + '.get', { key: i.key })).body || {}).job;
    // The last running permanent job is the one the last two tests end.
    if (j && j.status === 'running' && j.kind === 'permanent') W.running = j;
    if (!j || i.label !== j.type + ' (' + j.status + ')') all = false;
  }
  return all;
}, test.limit.quick);
test.run('search with q answers the job it names first', 0.2, async function () {
  const last = W.items[W.items.length - 1];
  if (!last) return false;
  const r = await ask(NAME + '.search', { q: last.key });
  const items = (r.body && r.body.items) || [];
  return (r.status === 200 && items.length > 0 && items[0].key === last.key) || false;
}, test.limit.quick);
test.run('get of an id no job has is refused 404', 0.2, async function () {
  const r = await ask(NAME + '.get', { key: 'spirit.zzNoSuchJob' });
  return (r.status === 404 && !!r.body && r.body.ok !== true) || false;
}, test.limit.quick);
// create.json: "Refused not-a-process (403) for any other program or script, process-not-included (403) for an app this node
// does not run"; args "a JSON list in a string".
test.run('create of another program is refused 403 not-a-process', 0.8, async function () {
  return refusedAs(await ask(NAME + '.create', { command: 'bash', args: JSON.stringify(['-c', 'true']) }), 403, 'not-a-process') || false;
}, test.limit.quick);
test.run('create of a script that is no app\'s own is refused 403 not-a-process', 0.8, async function () {
  return refusedAs(await ask(NAME + '.create', { command: 'node', args: JSON.stringify([BRANCH]) }), 403, 'not-a-process') || false;
}, test.limit.quick);
// An app's own script is spirit/app/<name>/<name>.js; one with a server is mounted by the node, never run by it.
test.run('create of an app this node does not run is refused 403 process-not-included', 0.2, async function () {
  const apps = await ask('spirit.app.search', {});
  const one = ((apps.body && apps.body.items) || []).map(function (i) { return parsed(i.label); }).filter(function (a) { return a && a.nodeMount === true && a.run === false; })[0];
  if (!one) return false;
  const dir = globalThis.spirit.slashedPath(one.key);
  const script = dir + '/' + dir.slice(dir.lastIndexOf('/') + 1) + '.js';
  const r = await ask(NAME + '.create', { command: 'node', args: JSON.stringify([script]) });
  return (refusedAs(r, 403, 'process-not-included') && r.body.process === one.key) || false;
}, test.limit.quick);
test.run('create with args that are no JSON list of strings is refused 400', 0.2, async function () {
  const r = await ask(NAME + '.create', { command: 'node', args: JSON.stringify({ a: 1 }) });
  return (r.status === 400 && !!r.body && r.body.ok === false) || false;
}, test.limit.quick);
// cancel.json: "its status becomes cancelled, or stopped for a permanent job ... Answers the job; 404 when there is none."
test.run('cancel of an id no job has is refused 404', 0.2, async function () {
  return ((await ask(NAME + '.cancel', { id: 'spirit.zzNoSuchJob' })).status === 404) || false;
}, test.limit.quick);
// delete.json: "Remove one job that has ended ...; 204 with no body. Refused 404 when there is no such job or it has not ended yet."
test.run('delete of a job that has not ended is refused 404, and the job stays', 0.2, async function () {
  if (!W.running) return false;
  const r = await ask(NAME + '.delete', { id: W.running.id });
  const still = await ask(NAME + '.get', { key: W.running.id });
  return (r.status === 404 && still.status === 200) || false;
}, test.limit.quick);
test.run('delete of an id no job has is refused 404', 0.2, async function () {
  return ((await ask(NAME + '.delete', { id: 'spirit.zzNoSuchJob' })).status === 404) || false;
}, test.limit.quick);
// The last two end a job of the node's own, so nothing after them asks it.
test.run('cancel of a running permanent job answers the job, its status stopped', 0.2, async function () {
  if (!W.running || W.running.kind !== 'permanent') return false;
  const r = await ask(NAME + '.cancel', { id: W.running.id });
  return (r.status === 200 && !!r.body && r.body.id === W.running.id && r.body.status === 'stopped') || false;
}, test.limit.quick);
test.run('delete of a job that has ended answers 204 with no body, and get then refuses it 404', 0.2, async function () {
  if (!W.running) return false;
  const was = ((await ask(NAME + '.get', { key: W.running.id })).body || {}).job;
  if (!was || ENDED.indexOf(was.status) === -1) return false;
  const r = await ask(NAME + '.delete', { id: W.running.id });
  const gone = await ask(NAME + '.get', { key: W.running.id });
  return (r.status === 204 && r.text === '' && gone.status === 404) || false;
}, test.limit.quick);
