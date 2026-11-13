'use strict';

// spirit/run/spirit/test/sendMail.js
// The tests of spirit/sendMail.js, and of no other module (spec: ./sendMail.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The relay sends mail through a driver, never a vendor (goal/G30.2): createSender reads spirit/state/mail.json and
// loads the driver it names from sendMail/. Each test writes its own mail.json in a scratch home, never the owner's.
// NO MAIL LEAVES THE MACHINE: the platform fetch is replaced by one that refuses, and the sender is handed a planted
// fetch that keeps what it was asked.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const M = require(path.join(RUN, 'spirit', 'sendMail.js'));

// The platform fetch never reaches past this machine: a mail that would leave it is a thrown error instead.
const netFetched = [];
// The test reporter's own posts to this machine's node pass; anything else is kept and refused.
const platformFetch = globalThis.fetch;
globalThis.fetch = function (url, init) {
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(String(url))) return platformFetch(url, init);
  netFetched.push(String(url));
  return Promise.reject(new Error('no network in this suite'));
};

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-sendMail-'));
process.on('exit', function () { try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* gone */ } });
// A scratch home whose mail.json is the value given (a string is written as it is; undefined writes none).
let n = 0;
function home(mail) {
  n += 1;
  const h = path.join(HOME, 'h' + n);
  fs.mkdirSync(path.join(h, 'spirit', 'state'), { recursive: true });
  if (mail !== undefined) fs.writeFileSync(path.join(h, 'spirit', 'state', 'mail.json'), typeof mail === 'string' ? mail : JSON.stringify(mail));
  return h;
}
const MAILGUN = { driver: 'mailgun', url: 'https://mail.example.invalid', domain: 'relay.example', key: 'k-not-real' };
function planted() {
  const asked = [];
  return { asked: asked, fetch: function (url, init) { asked.push({ url: url, init: init }); return Promise.resolve({ ok: true, status: 200 }); } };
}

// ── no driver named, no mail ──
test.run('no mail.json: no sender, null', 0.2, function () {
  return M.createSender(home(undefined)) === null || 'a sender with no mail.json';
}, test.limit.quick);
test.run('a mail.json that is not JSON, or not an object: null', 0.2, function () {
  const got = [M.createSender(home('{not json')), M.createSender(home('"mailgun"')), M.createSender(home('null'))];
  return got.every(function (x) { return x === null; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('a mail.json naming no driver sends no mail, whatever settings it holds: no fallback in core (decided by Andy)', 0.2, function () {
  const settings = Object.assign({}, MAILGUN);
  delete settings.driver;
  return M.createSender(home(settings), { fetch: planted().fetch }) === null || 'a sender with no driver named';
}, test.limit.quick);
test.run('a driver with no file in sendMail/ is no sender', 0.2, function () {
  return M.createSender(home({ driver: 'carrierPigeon' }), { fetch: planted().fetch }) === null || 'a sender for a driver that is not there';
}, test.limit.quick);
test.run('the driver name must be a plain word: a path, a dot, a slash or an upper first letter loads nothing outside sendMail/', 0.2, function () {
  const names = ['../serveCommon', '../sendMail/mailgun', 'mailgun.js', 'sendMail/mailgun', '/etc/passwd', 'Mailgun', ' ', '1mailgun'];
  const made = names.filter(function (d) { return M.createSender(home(Object.assign({}, MAILGUN, { driver: d })), { fetch: planted().fetch }) !== null; });
  return made.length === 0 || 'a sender for: ' + short(made);
}, test.limit.quick);
test.run('settings the driver will not take give no sender (mailgun with no key)', 0.2, function () {
  return M.createSender(home(Object.assign({}, MAILGUN, { key: '' })), { fetch: planted().fetch }) === null || 'a sender with no key';
}, test.limit.quick);

// ── a driver named, a sender ──
let S = null;
let P = null;
test.run('the world: a mail.json naming mailgun gives { driver: "mailgun", send }', 0.2, function () {
  P = planted();
  S = M.createSender(home(MAILGUN), { fetch: P.fetch });
  return (!!S && S.driver === 'mailgun' && typeof S.send === 'function') || 'got ' + short(S);
}, test.limit.quick);
test.run('the driver name is trimmed before it is judged', 0.2, function () {
  const s = M.createSender(home(Object.assign({}, MAILGUN, { driver: ' mailgun ' })), { fetch: planted().fetch });
  return (!!s && s.driver === 'mailgun') || 'got ' + short(s);
}, test.limit.quick);
test.run('send goes through the driver, on the fetch the caller handed, and never the platform fetch', 0.2, async function () {
  if (!S) return 'no sender: the world failed';
  const r = await S.send({ to: 'a@b.example', subject: 'hi', text: 'body' });
  return (r && r.ok === true && P.asked.length === 1 && /^https:\/\/mail\.example\.invalid\//.test(P.asked[0].url) && netFetched.length === 0) || 'got ' + short([r, P.asked.length, netFetched]);
}, test.limit.quick);
test.run('the answer is the driver and send alone: no settings, no key', 0.2, function () {
  if (!S) return 'no sender: the world failed';
  return (Object.keys(S).sort().join() === 'driver,send' && JSON.stringify(S).indexOf('k-not-real') === -1) || 'keys ' + short(Object.keys(S));
}, test.limit.quick);
