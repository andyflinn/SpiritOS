'use strict';

// spirit/run/spirit/test/verbTable.js
// The tests of spirit/verbTable.js, and of no other module (spec: ./verbTable.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 7: verbTable
// was red in the garbage rule because it had none).
//
// createVerbTable(): what the loopback client door can be asked, and who answers it. Each test makes a table of its own,
// in process; a handler is a function of (req, res) that ends res with JSON, as the node's handlers are.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { createVerbTable } = require(path.join(RUN, 'spirit', 'verbTable.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A handler answering body as JSON with status, as the node's handlers end their response.
function answers(body, status) { return function (req, res) { res.writeHead(status || 200); res.end(JSON.stringify(body)); }; }
// What a call throws, as its message, or '' when it does not.
function throws(fn) { try { fn(); return ''; } catch (e) { return String(e && e.message); } }

// ── claim: a namespace owned ──
test.run('claim takes a namespace and its verbs: each verb is answered by its handler', 0.2, function () {
  const t = createVerbTable();
  const h = answers({ ok: true });
  t.claim('zz', 'zzModule', { 'zz.ping': h }, { wire: false });
  return t.handlerFor('zz.ping') === h || 'handlerFor(zz.ping): ' + short(t.handlerFor('zz.ping'));
}, test.limit.quick);
test.run('a namespace claimed twice is refused at once, naming its owner', 0.2, function () {
  const t = createVerbTable();
  t.claim('zz', 'first', { 'zz.a': answers({}) }, { wire: false });
  const m = throws(function () { t.claim('zz', 'second', { 'zz.b': answers({}) }, { wire: false }); });
  return /already claimed by first/.test(m) || 'the second claim: ' + short(m || 'taken');
}, test.limit.quick);
test.run('a module may not answer outside its own namespace', 0.2, function () {
  const t = createVerbTable();
  const m = throws(function () { t.claim('fs', 'fsModule', { 'peer.post': answers({}) }, { wire: false }); });
  return /a module answers in its own namespace/.test(m) || 'fs offering peer.post: ' + short(m || 'taken');
}, test.limit.quick);
test.run('a claim must say wire: true or false', 0.2, function () {
  const t = createVerbTable();
  const m = throws(function () { t.claim('zz', 'zzModule', { 'zz.a': answers({}) }, {}); });
  return /must say wire/.test(m) || 'a claim with no wire: ' + short(m || 'taken');
}, test.limit.quick);
test.run('a bad namespace, a malformed verb and a verb that is no function are each refused', 0.2, function () {
  const bad = [
    throws(function () { createVerbTable().claim('Zz', 'm', { 'Zz.a': answers({}) }, { wire: false }); }),
    throws(function () { createVerbTable().claim('zz', 'm', { 'zz.': answers({}) }, { wire: false }); }),
    throws(function () { createVerbTable().claim('zz', 'm', { 'zz.a': 'not a function' }, { wire: false }); }),
  ];
  return (/bad namespace/.test(bad[0]) && /malformed verb/.test(bad[1]) && /is not a function/.test(bad[2])) || 'refusals: ' + short(bad);
}, test.limit.quick);
test.run('a claim refused claims no namespace', 0.2, function () {
  const t = createVerbTable();
  throws(function () { t.claim('zz', 'm', { 'zz.a': answers({}), 'zz.b': 'not a function' }, { wire: false }); });
  return (t.namespaces().length === 0) || 'namespaces after a refused claim: ' + short(t.namespaces());
}, test.limit.quick);

// ── what it answers about itself ──
const T = createVerbTable();
T.claim('zz', 'zzModule', { 'zz.b': answers({}), 'zz.a': answers({}) }, { wire: true });
T.claim('yy', 'yyModule', { 'yy.c': answers({}) }, { wire: false });
test.run('verbs lists every verb answered, sorted', 0.2, function () {
  return JSON.stringify(T.verbs()) === JSON.stringify(['yy.c', 'zz.a', 'zz.b']) || 'verbs: ' + short(T.verbs());
}, test.limit.quick);
test.run('handlerFor answers null for a verb nobody answers, and for an inherited name', 0.2, function () {
  return (T.handlerFor('zz.none') === null && T.handlerFor('toString') === null && T.handlerFor('constructor') === null) || 'handlerFor: ' + short([T.handlerFor('zz.none'), typeof T.handlerFor('toString')]);
}, test.limit.quick);
test.run('needsWire says what its namespace claimed, and null for an unclaimed one', 0.2, function () {
  return (T.needsWire('zz.a') === true && T.needsWire('yy.c') === false && T.needsWire('xx.d') === null) || 'needsWire: ' + short([T.needsWire('zz.a'), T.needsWire('yy.c'), T.needsWire('xx.d')]);
}, test.limit.quick);
test.run('namespaces lists each owner, sorted, with its wire', 0.2, function () {
  const want = [{ namespace: 'yy', by: 'yyModule', wire: false }, { namespace: 'zz', by: 'zzModule', wire: true }];
  return JSON.stringify(T.namespaces()) === JSON.stringify(want) || 'namespaces: ' + short(T.namespaces());
}, test.limit.quick);

// ── mount: a family's declarations, as an app server mounts them ──
test.run('mount takes declarations of request, reply and handler, and the tree shows each verb\'s shape', 0.2, function () {
  const t = createVerbTable();
  t.mount('zz', '', { ping: { request: { x: '' }, reply: { y: 0 }, handler: answers({ y: 1 }) } }, { wire: false });
  return (JSON.stringify(t.tree()) === JSON.stringify({ zz: { ping: { request: { x: '' }, reply: { y: 0 } } } }) && typeof t.handlerFor('zz.ping') === 'function') || 'tree: ' + short(t.tree());
}, test.limit.quick);
test.run('a declaration with no request, no reply or no handler is refused', 0.2, function () {
  const t = createVerbTable();
  const m = [
    throws(function () { t.mount('aa', '', { v: { reply: {}, handler: answers({}) } }, { wire: false }); }),
    throws(function () { t.mount('bb', '', { v: { request: {}, handler: answers({}) } }, { wire: false }); }),
    throws(function () { t.mount('cc', '', { v: { request: {}, reply: {} } }, { wire: false }); }),
  ];
  return m.every(function (x) { return /needs request \(an object\), reply and handler/.test(x); }) || 'refusals: ' + short(m);
}, test.limit.quick);

// ── call: a verb asked in process ──
test.run('call answers what the handler ends its response with, status and body', 0.2, async function () {
  const t = createVerbTable();
  t.claim('zz', 'm', { 'zz.echo': function (req, res) { let s = ''; req.on('data', function (c) { s += c; }); req.on('end', function () { res.writeHead(201); res.end(JSON.stringify({ got: JSON.parse(s) })); }); } }, { wire: false });
  const r = await t.call('zz.echo', { a: 1 });
  return (r.ok === true && r.status === 201 && r.body && r.body.got && r.body.got.a === 1) || 'call: ' + short(r);
}, test.limit.quick);
test.run('call of a verb nobody answers says no-such-verb', 0.2, async function () {
  const r = await createVerbTable().call('zz.none', {});
  return (r.ok === false && r.status === 400 && r.code === 'no-such-verb') || 'call: ' + short(r);
}, test.limit.quick);
test.run('call of a handler that throws says handler-failed', 0.2, async function () {
  const t = createVerbTable();
  t.claim('zz', 'm', { 'zz.boom': function () { throw new Error('boom'); } }, { wire: false });
  const r = await t.call('zz.boom', {});
  return (r.ok === false && r.status === 500 && r.code === 'handler-failed') || 'call: ' + short(r);
}, test.limit.quick);
test.run('call of a handler whose promise fails says handler-failed', 0.2, async function () {
  const t = createVerbTable();
  t.claim('zz', 'm', { 'zz.late': function () { return Promise.reject(new Error('late')); } }, { wire: false });
  const r = await t.call('zz.late', {});
  return (r.ok === false && r.code === 'handler-failed') || 'call: ' + short(r);
}, test.limit.quick);

// ── door: the loopback door over the table and the app servers ──
test.run('the door\'s api is the app servers\' tree with the table\'s own families in it', 0.2, async function () {
  const t = createVerbTable();
  t.mount('zz', '', { ping: { request: {}, reply: {}, handler: answers({}) } }, { wire: false });
  const apps = { apps: function () { return ['app1']; }, ask: function () { return Promise.resolve({ status: 200, body: { app1: { v: { request: {}, reply: {} } } } }); } };
  const r = await t.door(apps).ask('api');
  return (r.status === 200 && !!r.body.app1 && !!r.body.zz && !!r.body.zz.ping) || 'the door\'s api: ' + short(r);
}, test.limit.quick);
test.run('the door\'s call of a verb neither the table nor an app answers says no-such-verb', 0.2, async function () {
  const apps = { apps: function () { return []; }, ask: function () { return Promise.resolve({ status: 200, body: {} }); } };
  const r = await createVerbTable().door(apps).call('zz.none', {});
  return (r.ok === false && r.code === 'no-such-verb') || 'the door\'s call: ' + short(r);
}, test.limit.quick);
