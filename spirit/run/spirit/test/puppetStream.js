'use strict';

// spirit/run/spirit/test/puppetStream.js
// The tests of spirit/puppetStream.js, and of no other module (spec: ./puppetStream.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// createPuppetStream(opts): a puppet streams what its servers publish to its master (goal/G14.5), one job-updated at a
// time, only while the master is reachable, serialized at the source. In process: puppet, route, encode and post are
// planted, and a post is held open until the test lets it return.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const S = require(path.join(RUN, 'spirit', 'puppetStream.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = function () { return new Promise(function (r) { setTimeout(r, 20); }); };
const OWNER = 'owner-key';

// A stream on planted parts. hold: every post waits until release() is called; answer: what a post answers.
function stream(o) {
  const x = o || {};
  const said = { posts: [], log: [], held: [], state: { puppet: x.puppet !== false, reachable: x.reachable !== false } };
  said.s = S.createPuppetStream({
    log: function (line) { said.log.push(line); },
    puppet: function () { return said.state.puppet ? { puppet: true, owner: OWNER } : { puppet: false, owner: '' }; },
    route: function (owner) { return said.state.reachable ? { relayUrl: 'https://relay.example', owner: owner } : { unreachable: true }; },
    encode: x.encode || function (type, body) { return { text: JSON.stringify({ type: type, body: body }) }; },
    post: function (relay, to, text) {
      said.posts.push({ relay: relay, to: to, sent: JSON.parse(text) });
      if (x.hold) return new Promise(function (r) { said.held.push(r); });
      return typeof x.answer === 'function' ? x.answer() : Promise.resolve(x.answer || { ok: true });
    },
  });
  said.release = function () { const r = said.held.shift(); if (r) r({ ok: true }); };
  return said;
}
function job(module, app) { return { module: module, app: app }; }
function sent(said) { return said.posts.map(function (p) { return p.sent.body.module + '=' + JSON.stringify(p.sent.body.app); }); }

// ── what is posted ──
test.run('a changed app object of an app\'s job is posted to the owner, at the route\'s relay, as a packet named published', 0.2, async function () {
  const t = stream();
  t.s.onJob(job('spirit.app.chat', { unread: 2 }));
  await settle();
  const p = t.posts[0] || { sent: {} };
  return (t.posts.length === 1 && p.relay === 'https://relay.example' && p.to === OWNER && p.sent.type === 'published' &&
    short(p.sent.body) === short({ module: 'spirit.app.chat', app: { unread: 2 } })) || 'posts ' + short(t.posts);
}, test.limit.quick);
test.run('every app server\'s objects, always: two apps both posted, no verb or subscription asked', 0.2, async function () {
  const t = stream();
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  t.s.onJob(job('spirit.app.desk', { b: 1 })); await settle();
  return short(sent(t)) === short(['spirit.app.chat={"a":1}', 'spirit.app.desk={"b":1}']) || 'sent ' + short(sent(t));
}, test.limit.quick);

// ── what is not posted ──
test.run('the same object again (a job-updated for a log line) is not posted', 0.2, async function () {
  const t = stream();
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  t.s.onJob(job('spirit.app.chat', { a: 2 })); await settle();
  return short(sent(t)) === short(['spirit.app.chat={"a":1}', 'spirit.app.chat={"a":2}']) || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('a job with no app object (none, an array, a string) is not posted', 0.2, async function () {
  const t = stream();
  [undefined, null, [1], 'text', 5].forEach(function (a) { t.s.onJob(job('spirit.app.chat', a)); });
  await settle();
  return t.posts.length === 0 || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('anything that is no app\'s (spirit.app.<name>) is not posted', 0.2, async function () {
  const t = stream();
  ['spirit.contact', 'spirit.app', 'spirit.app.chat.sub', 'other.app.chat', '', null].forEach(function (m) { t.s.onJob(job(m, { a: 1 })); });
  t.s.onJob(null);
  await settle();
  return t.posts.length === 0 || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('nothing is posted from a node that is not a puppet', 0.2, async function () {
  const t = stream({ puppet: false });
  t.s.onJob(job('spirit.app.chat', { a: 1 }));
  await settle();
  return t.posts.length === 0 || 'sent ' + short(sent(t));
}, test.limit.quick);

// ── only while the master is reachable ──
test.run('unreachable: no post, no log line, nothing queued; the next change tries the route again', 0.2, async function () {
  const t = stream({ reachable: false });
  t.s.onJob(job('spirit.app.chat', { a: 1 }));
  t.s.onJob(job('spirit.app.desk', { b: 1 }));
  await settle();
  const before = { posts: t.posts.length, log: t.log.length };
  t.state.reachable = true;
  t.s.onJob(job('spirit.app.chat', { a: 2 }));
  await settle();
  return (before.posts === 0 && before.log === 0 && short(sent(t)) === short(['spirit.app.chat={"a":2}'])) || 'while unreachable ' + short(before) + ', then sent ' + short(sent(t));
}, test.limit.quick);
test.run('a relay that refuses is one line in the log, and that object is not posted again', 0.2, async function () {
  const t = stream({ answer: { ok: false, error: 'over quota' } });
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  return (t.posts.length === 1 && t.log.length === 1 && /spirit\.app\.chat not posted: over quota/.test(t.log[0])) || 'posts ' + t.posts.length + ', log ' + short(t.log);
}, test.limit.quick);
test.run('a post that throws is one line in the log, and the stream goes on', 0.2, async function () {
  let n = 0;
  const t = stream({ answer: function () { n += 1; return n === 1 ? Promise.reject(new Error('socket hang up')) : Promise.resolve({ ok: true }); } });
  t.s.onJob(job('spirit.app.chat', { a: 1 })); await settle();
  t.s.onJob(job('spirit.app.chat', { a: 2 })); await settle();
  return (t.posts.length === 2 && t.log.length === 1 && /socket hang up/.test(t.log[0])) || 'posts ' + t.posts.length + ', log ' + short(t.log);
}, test.limit.quick);
test.run('an object that cannot be packed is one line in the log, and the next module is still posted', 0.2, async function () {
  const t = stream({ hold: true, encode: function (type, body) { return body.app.big ? null : { text: JSON.stringify({ type: type, body: body }) }; } });
  t.s.onJob(job('spirit.app.first', { a: 1 }));
  t.s.onJob(job('spirit.app.big', { big: true }));
  t.s.onJob(job('spirit.app.desk', { b: 1 }));
  t.release(); await settle();
  return (short(sent(t)) === short(['spirit.app.first={"a":1}', 'spirit.app.desk={"b":1}']) && t.log.length === 1 && /could not be packed/.test(t.log[0])) || 'sent ' + short(sent(t)) + ', log ' + short(t.log);
}, test.limit.quick);

// ── serialized at the source ──
test.run('one post in flight at a time: nothing more is posted until the one out returns', 0.2, async function () {
  const t = stream({ hold: true });
  t.s.onJob(job('spirit.app.chat', { a: 1 }));
  t.s.onJob(job('spirit.app.desk', { b: 1 }));
  await settle();
  const during = t.posts.length;
  t.release(); await settle();
  return (during === 1 && t.posts.length === 2) || 'in flight ' + during + ', after return ' + t.posts.length;
}, test.limit.quick);
test.run('a burst collapses: a module publishing meanwhile keeps only its newest object', 0.2, async function () {
  const t = stream({ hold: true });
  t.s.onJob(job('spirit.app.chat', { a: 1 }));
  t.s.onJob(job('spirit.app.chat', { a: 2 }));
  t.s.onJob(job('spirit.app.chat', { a: 3 }));
  t.s.onJob(job('spirit.app.chat', { a: 4 }));
  t.release(); await settle();
  t.release(); await settle();
  return short(sent(t)) === short(['spirit.app.chat={"a":1}', 'spirit.app.chat={"a":4}']) || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('modules keep the order they first came in', 0.2, async function () {
  const t = stream({ hold: true });
  t.s.onJob(job('spirit.app.first', { x: 1 }));
  t.s.onJob(job('spirit.app.b', { x: 1 }));
  t.s.onJob(job('spirit.app.c', { x: 1 }));
  t.s.onJob(job('spirit.app.b', { x: 2 }));
  for (let i = 0; i < 4; i += 1) { t.release(); await settle(); }
  return short(sent(t)) === short(['spirit.app.first={"x":1}', 'spirit.app.b={"x":2}', 'spirit.app.c={"x":1}']) || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('the route lost while objects wait: what was waiting is dropped, not posted later', 0.2, async function () {
  const t = stream({ hold: true });
  t.s.onJob(job('spirit.app.first', { x: 1 }));
  t.s.onJob(job('spirit.app.b', { x: 1 }));
  t.s.onJob(job('spirit.app.c', { x: 1 }));
  t.state.reachable = false;
  t.release(); await settle();
  t.state.reachable = true;
  t.s.onJob(job('spirit.app.d', { x: 1 }));
  t.release(); await settle();
  t.release(); await settle();
  return short(sent(t)) === short(['spirit.app.first={"x":1}', 'spirit.app.d={"x":1}']) || 'sent ' + short(sent(t));
}, test.limit.quick);
test.run('the module answers createPuppetStream alone, with onJob its one door', 0.2, function () {
  const keys = Object.keys(S.createPuppetStream({}));
  return (short(Object.keys(S)) === short(['createPuppetStream']) && short(keys) === short(['onJob'])) || 'exports ' + short(Object.keys(S)) + ', stream ' + short(keys);
}, test.limit.quick);
