'use strict';

// spirit/run/spirit/sendMail/test/mailgun.js
// The tests of spirit/sendMail/mailgun.js, and of no other module (spec: ./mailgun.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// A sendMail driver: Mailgun (goal/G30.2). create(settings, fetch) answers { send } or null; send is one HTTPS post per
// mail. NO MAIL LEAVES THE MACHINE: every send here goes to a planted fetch that keeps what it was asked, and the
// platform fetch is replaced by one that refuses. The settings are made up; no real key or mail.json is read.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const G = require(path.join(RUN, 'spirit', 'sendMail', 'mailgun.js'));

const netFetched = [];
// The test reporter's own posts to this machine's node pass; anything else is kept and refused.
const platformFetch = globalThis.fetch;
globalThis.fetch = function (url, init) {
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(String(url))) return platformFetch(url, init);
  netFetched.push(String(url));
  return Promise.reject(new Error('no network in this suite'));
};

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const KEY = 'key-made-up-0123456789';
const SETTINGS = { url: 'https://mail.example.invalid/', domain: 'Relay.Example', key: ' ' + KEY + ' ' };
// A fetch that keeps what it was asked and answers what it is given (a value, or a function for a throw or rejection).
function planted(answer) {
  const asked = [];
  return {
    asked: asked,
    fetch: function (url, init) { asked.push({ url: url, init: init }); return typeof answer === 'function' ? answer() : answer; },
  };
}

// ── settings ──
test.run('create refuses, null, with a setting missing: no url, an url that is not https, no domain, no key', 0.2, function () {
  const bad = [{}, null, Object.assign({}, SETTINGS, { url: '' }), Object.assign({}, SETTINGS, { url: 'http://mail.example.invalid' }), Object.assign({}, SETTINGS, { domain: ' ' }), Object.assign({}, SETTINGS, { key: '' })];
  const made = bad.map(function (s) { return G.create(s, planted({ ok: true }).fetch); });
  return made.every(function (x) { return x === null; }) || 'made: ' + short(made);
}, test.limit.quick);
test.run('create answers { send } over good settings', 0.2, function () {
  const s = G.create(SETTINGS, planted({ ok: true }).fetch);
  return (!!s && typeof s.send === 'function') || 'got ' + short(s);
}, test.limit.quick);

// ── one post per mail ──
let A = null;
let R = null;
test.run('the world: one mail sent on a planted fetch that answers ok', 0.2, async function () {
  A = planted(Promise.resolve({ ok: true, status: 200 }));
  R = await G.create(SETTINGS, A.fetch).send({ to: 'friend@example.org', subject: 'your code', text: 'it is 1234' });
  return A.asked.length === 1 || 'posts made: ' + A.asked.length;
}, test.limit.quick);
test.run('it posts to <url>/v3/<domain>/messages, the url\'s trailing slash and the domain\'s case gone', 0.2, function () {
  if (!A) return 'the world failed';
  const a = A.asked[0];
  return (a.url === 'https://mail.example.invalid/v3/relay.example/messages' && a.init.method === 'POST') || 'got ' + short([a.url, a.init && a.init.method]);
}, test.limit.quick);
test.run('HTTP basic, user api and the key', 0.2, function () {
  if (!A) return 'the world failed';
  const auth = A.asked[0].init.headers.Authorization;
  return auth === 'Basic ' + Buffer.from('api:' + KEY).toString('base64') || 'Authorization ' + short(auth);
}, test.limit.quick);
test.run('the fields as a form: from postmaster@<domain>, to, subject and text', 0.2, function () {
  if (!A) return 'the world failed';
  const init = A.asked[0].init;
  const f = new URLSearchParams(init.body);
  return (init.headers['Content-Type'] === 'application/x-www-form-urlencoded' && f.get('from') === 'postmaster@relay.example' && f.get('to') === 'friend@example.org' && f.get('subject') === 'your code' && f.get('text') === 'it is 1234') || 'got ' + short(init.body);
}, test.limit.quick);
test.run('a mail the service took answers { ok: true }', 0.2, function () {
  if (!A) return 'the world failed';
  return (R && R.ok === true) || 'got ' + short(R);
}, test.limit.quick);
test.run('a mail with no fields still posts, each field an empty string', 0.2, async function () {
  const p = planted(Promise.resolve({ ok: true }));
  await G.create(SETTINGS, p.fetch).send();
  const f = p.asked[0] ? new URLSearchParams(p.asked[0].init.body) : null;
  return (!!f && f.get('to') === '' && f.get('subject') === '' && f.get('text') === '') || 'got ' + short(p.asked[0] && p.asked[0].init.body);
}, test.limit.quick);

// ── refused, and the key never in an answer ──
test.run('a refusal by the service: ok false, its status, "the mail service refused the mail"', 0.2, async function () {
  const r = await G.create(SETTINGS, planted(Promise.resolve({ ok: false, status: 401 })).fetch).send({ to: 'a@b.c' });
  return (r && r.ok === false && r.status === 401 && r.error === 'the mail service refused the mail') || 'got ' + short(r);
}, test.limit.quick);
test.run('a refusal with no status is 502', 0.2, async function () {
  const r = await G.create(SETTINGS, planted(Promise.resolve(null)).fetch).send({ to: 'a@b.c' });
  return (r && r.ok === false && r.status === 502) || 'got ' + short(r);
}, test.limit.quick);
test.run('no answer from the service: ok false, 502, "the mail service did not answer", never a throw', 0.2, async function () {
  const p = planted(function () { return Promise.reject(new Error('ECONNREFUSED ' + KEY)); });
  let r = null;
  try { r = await G.create(SETTINGS, p.fetch).send({ to: 'a@b.c' }); } catch (e) { return 'it threw: ' + e.message; }
  return (r && r.ok === false && r.status === 502 && r.error === 'the mail service did not answer') || 'got ' + short(r);
}, test.limit.quick);
test.run('the key is in no answer: not on the sender, not in a success, a refusal or a failure', 0.2, async function () {
  const s = G.create(SETTINGS, planted(Promise.resolve({ ok: true })).fetch);
  const answers = [
    s,
    await s.send({ to: 'a@b.c' }),
    await G.create(SETTINGS, planted(Promise.resolve({ ok: false, status: 400 })).fetch).send({}),
    await G.create(SETTINGS, planted(function () { return Promise.reject(new Error(KEY)); }).fetch).send({}),
  ];
  const leaked = answers.filter(function (a) { return JSON.stringify(a || null).indexOf(KEY) !== -1 || JSON.stringify(a || null).indexOf(Buffer.from('api:' + KEY).toString('base64')) !== -1; });
  return leaked.length === 0 || 'the key is in: ' + short(leaked);
}, test.limit.quick);
test.run('no send in this suite reached the platform fetch', 0.2, function () {
  return (netFetched.length === 0 && A !== null) || 'the platform fetch was asked: ' + short(netFetched);
}, test.limit.quick);
