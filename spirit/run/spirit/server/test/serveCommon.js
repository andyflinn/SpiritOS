'use strict';

// spirit/run/spirit/server/test/serveCommon.js
// The tests of spirit/server/serveCommon.js, and of no other module (spec: ./serveCommon.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What the node and the relay both answer HTTP with: reading a body, sending a file, refusing too big or malformed,
// saying which build this is, the first-run defaults. In process: a planted res, a planted request stream, a planted
// server and socket, and a scratch home for what it writes; process.exit and console.error are planted where it would
// stop the process.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/serveCommon/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/serveCommon'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const C = require(path.join(RUN, 'spirit', 'serveCommon.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

// A res that keeps what was written; done() resolves at its end.
function plantedRes() {
  const r = { status: null, headers: null, body: null };
  r.ended = new Promise(function (resolve) {
    r.writeHead = function (s, h) { r.status = s; r.headers = h || {}; };
    r.end = function (b) { r.body = b === undefined ? '' : b; resolve(r); };
  });
  return r;
}
// A request stream: an emitter with headers, a socket and destroy.
function plantedReq(headers, socketAddress) {
  const q = new EventEmitter();
  q.headers = headers || {};
  q.socket = { remoteAddress: socketAddress || '203.0.113.9' };
  q.destroyed = false;
  q.destroy = function () { q.destroyed = true; };
  return q;
}
const LATE = {};
function within(promise, ms) {
  return Promise.race([promise, new Promise(function (r) { setTimeout(function () { r(LATE); }, ms); })]);
}
// fn with process.exit and console.error planted; answers { code, said }.
function withExit(fn) {
  const was = { exit: process.exit, error: console.error };
  const got = { code: null, said: '' };
  process.exit = function (c) { got.code = c; };
  console.error = function (s) { got.said += String(s); };
  try { fn(); } finally { process.exit = was.exit; console.error = was.error; }
  return got;
}
const HOME = ownTemp('spirit-serveCommon-');
process.on('exit', function () { try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* gone */ } });

// ── the command line ──
test.run('portFromArgs gives the number of --port <n> and of --port=<n>, and null when no port is given', 0.2, function () {
  const got = [C.portFromArgs(['--port', '4123']), C.portFromArgs(['x', '--port=4124']), C.portFromArgs(['x']), C.portFromArgs(['--port'])];
  return (got[0] === 4123 && got[1] === 4124 && got[2] === null && got[3] === null) || false;
}, test.limit.quick);
test.run('emailFromArgs gives the address of --email <a> and of --email=<a> trimmed, and an empty string when no address is given', 0.2, function () {
  const got = [C.emailFromArgs(['--email', ' a@b.c ']), C.emailFromArgs(['--email=d@e.f ']), C.emailFromArgs([])];
  return (got[0] === 'a@b.c' && got[1] === 'd@e.f' && got[2] === '') || false;
}, test.limit.quick);

// ── the start refused, loudly ──
test.run('verifyStartupCwd refuses to start from a folder that is not spirit/run, with exit 1 and a sentence', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(HOME); got = withExit(function () { C.verifyStartupCwd('spirit/server.js'); }); } finally { process.chdir(was); }
  return (got.code === 1 && /Refusing to start/.test(got.said) && /spirit\/server\.js/.test(got.said)) || false;
}, test.limit.quick);
test.run('verifyStartupCwd lets a start from spirit/run go on with the folders it names, and a relay needs only spirit/', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/server/relay.js'); C.verifyStartupCwd('spirit/server.js', ['spirit']); }); } finally { process.chdir(was); }
  return got.code === null || false;
}, test.limit.quick);
test.run('verifyStartupCwd refuses a folder the entry point names that is not there', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/server.js', ['spirit', 'no-such-folder-here']); }); } finally { process.chdir(was); }
  return (got.code === 1 && /no-such-folder-here/.test(got.said)) || false;
}, test.limit.quick);
test.run('refuseListenError stops the process on a port in use with exit 1, naming the port and the next one to try', 0.2, function () {
  const server = new EventEmitter();
  C.refuseListenError(server, 4500, 'spirit/server.js');
  const got = withExit(function () { server.emit('error', Object.assign(new Error('in use'), { code: 'EADDRINUSE' })); });
  const other = withExit(function () { server.emit('error', new Error('something else')); });
  return (got.code === 1 && /4500 is already in use/.test(got.said) && /--port 4501/.test(got.said) && other.code === 1 && /something else/.test(other.said)) || false;
}, test.limit.quick);

// ── sendFile ──
test.run('sendFile answers 200, the file, and its type by extension', 0.2, async function () {
  const f = path.join(HOME, 'page.css');
  fs.writeFileSync(f, 'body{}');
  const r = plantedRes();
  C.sendFile(r, f);
  await within(r.ended, 2000);
  return (r.status === 200 && String(r.body) === 'body{}' && /text\/css/.test(r.headers['Content-Type'])) || false;
}, test.limit.quick);
test.run('sendFile answers 404 for a file that is not there and for a path with a NUL in it, and never crashes', 0.2, async function () {
  const a = plantedRes();
  const b = plantedRes();
  C.sendFile(a, path.join(HOME, 'none.html'));
  C.sendFile(b, path.join(HOME, 'bad\0name.html'));
  await within(Promise.all([a.ended, b.ended]), 2000);
  return (a.status === 404 && b.status === 404) || false;
}, test.limit.quick);

// ── readBody: bytes copied, bytes counted (goal/G16.6) ──
test.run('readBody delivers a character split across two chunks whole, never as U+FFFD', 0.2, async function () {
  const s = new EventEmitter();
  const bytes = Buffer.from('ab\u{1F47B}cd', 'utf8');
  const p = C.readBody(s);
  s.emit('data', bytes.subarray(0, 4));
  s.emit('data', bytes.subarray(4));
  s.emit('end');
  const got = await within(p, 1000);
  return got === 'ab\u{1F47B}cd' || false;
}, test.limit.quick);
test.run('readBody refuses a body past its max at once with 413 body-too-large, and destroys the stream so the rest stops arriving', 0.2, async function () {
  const s = new EventEmitter();
  let destroyed = false;
  s.destroy = function () { destroyed = true; };
  const p = C.readBody(s, { max: 5 });
  s.emit('data', Buffer.from('abcdefg'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && err.code === 'body-too-large' && err.bytes === 7 && err.max === 5 && destroyed) || false;
}, test.limit.quick);
test.run('a caller of readBody names its own refusal, and its onBytes hears the running total', 0.2, async function () {
  const s = new EventEmitter();
  const heard = [];
  const p = C.readBody(s, { max: 3, code: 'relay-answer-too-large', message: 'the answer is too large', onBytes: function (n) { heard.push(n); } });
  s.emit('data', Buffer.from('ab'));
  s.emit('data', Buffer.from('cd'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.code === 'relay-answer-too-large' && err.message === 'the answer is too large' && heard.join() === '2,4') || false;
}, test.limit.quick);

// ── readJsonBody, bodyBytes, useBody ──
test.run('readJsonBody answers the body parsed, answers an empty object for an empty body, and rejects bad JSON', 0.2, async function () {
  const a = plantedReq({});
  const pa = C.readJsonBody(a);
  a.emit('data', Buffer.from('{"verb":"x"}')); a.emit('end');
  const b = plantedReq({});
  const pb = C.readJsonBody(b);
  b.emit('end');
  const c = plantedReq({});
  const pc = C.readJsonBody(c).then(function () { return 'parsed'; }, function () { return 'rejected'; });
  c.emit('data', Buffer.from('{nope')); c.emit('end');
  const got = await within(Promise.all([pa, pb, pc]), 1000);
  return (got !== LATE && got[0].verb === 'x' && JSON.stringify(got[1]) === '{}' && got[2] === 'rejected') || false;
}, test.limit.quick);
test.run('readJsonBody reads a body once, and a second caller gets the same promise', 0.2, function () {
  const q = plantedReq({});
  return C.readJsonBody(q) === C.readJsonBody(q) || false;
}, test.limit.quick);
test.run('readJsonBody refuses a declared Content-Length past BODY_MAX with 413 before a byte is read, and destroys the socket', 0.2, async function () {
  const q = plantedReq({ 'content-length': String(limits.BODY_MAX + 1) });
  const err = await within(C.readJsonBody(q).then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && q.destroyed) || false;
}, test.limit.quick);
test.run('readJsonBody refuses with 413 a body with no Content-Length whose running total passes its max; bodyBytes says what was read', 0.2, async function () {
  const q = plantedReq({});
  const p = C.readJsonBody(q, { max: 10 }).then(function () { return null; }, function (e) { return e; });
  q.emit('data', Buffer.from('{"a":"0123456789"}'));
  const err = await within(p, 1000);
  return (err && err.statusCode === 413 && q.destroyed && C.bodyBytes(q) === 18) || false;
}, test.limit.quick);
test.run('bodyBytes is 0 before any byte is read', 0.2, function () {
  return C.bodyBytes(plantedReq({})) === 0 || false;
}, test.limit.quick);
test.run('the body the door sets with useBody is the body every later reader gets', 0.2, async function () {
  const q = plantedReq({});
  C.useBody(q, { call: 'x', n: 1 });
  const got = await within(C.readJsonBody(q), 1000);
  return (got && got.n === 1 && got.call === 'x') || false;
}, test.limit.quick);

// ── refusals ──
test.run('refuseTooBig answers a declared length past BODY_MAX with 413 and returns true, and answers nothing for a length within it', 0.2, function () {
  const big = plantedRes();
  const yes = C.refuseTooBig({ headers: { 'content-length': String(limits.BODY_MAX + 1) } }, big);
  const small = plantedRes();
  const no = C.refuseTooBig({ headers: { 'content-length': '10' } }, small);
  return (yes === true && big.status === 413 && no === false && small.status === null) || false;
}, test.limit.quick);
test.run('nodeRefusal gives one answer for every failure, "not now" with its code, and only the status varies, never the string', 0.2, function () {
  const a = plantedRes();
  const b = plantedRes();
  C.nodeRefusal(a);
  C.nodeRefusal(b, 429);
  return (a.status === 403 && b.status === 429 && a.body === b.body && JSON.parse(a.body).error === 'not now' && JSON.parse(a.body).code === 'node-not-now') || false;
}, test.limit.quick);
test.run('parseRequestPath answers a good path with its url and its decoded pathname', 0.2, function () {
  const r = plantedRes();
  const got = C.parseRequestPath({ url: '/a%20b?x=1', headers: { host: 'localhost:1' } }, r);
  return (got && got.pathname === '/a b' && got.url.searchParams.get('x') === '1' && r.status === null) || false;
}, test.limit.quick);
test.run('parseRequestPath answers a malformed escape and a NUL in the path with 400 and null, never with a dead process', 0.2, function () {
  const got = ['/%zz', '/%', '/%00'].map(function (u) { const r = plantedRes(); const p = C.parseRequestPath({ url: u, headers: {} }, r); return [p, r.status]; });
  return got.every(function (g) { return g[0] === null && g[1] === 400; }) || false;
}, test.limit.quick);
test.run('answerClientErrors answers a request Node cannot parse with 400 in order and reads and drops the rest, and only destroys a reset', 0.2, function () {
  const server = new EventEmitter();
  C.answerClientErrors(server);
  function sock() { const s = new EventEmitter(); s.destroyed = false; s.resumed = false; s.written = ''; s.resume = function () { s.resumed = true; }; s.end = function (t) { s.written += t; }; s.destroy = function () { s.destroyed = true; }; return s; }
  const a = sock();
  server.emit('clientError', new Error('bad header'), a);
  const b = sock();
  server.emit('clientError', Object.assign(new Error('reset'), { code: 'ECONNRESET' }), b);
  return (/^HTTP\/1\.1 400 /.test(a.written) && a.resumed && !a.destroyed && b.destroyed && b.written === '') || false;
}, test.limit.quick);

// ── clientKeyFor (goal/G22.7) ──
test.run('from the loopback, clientKeyFor is the last X-Forwarded-For entry, the one Caddy appended', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' } });
  return got === '198.51.100.7' || false;
}, test.limit.quick);
test.run('from anywhere else, clientKeyFor is the socket address, whatever header it carries', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '203.0.113.5' }, headers: { 'x-forwarded-for': '198.51.100.7' } });
  return got === '203.0.113.5' || false;
}, test.limit.quick);
test.run('from the loopback with no header, clientKeyFor is the socket address, and ::1 and ::ffff:127.x count as the loopback', 0.2, function () {
  const got = [C.clientKeyFor({ socket: { remoteAddress: '::1' }, headers: {} }), C.clientKeyFor({ socket: { remoteAddress: '::ffff:127.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.8' } })];
  return (got[0] === '::1' && got[1] === '198.51.100.8') || false;
}, test.limit.quick);

// ── sendVersion ──
test.run('sendVersion answers the version, the commit and since when it started, and whether it is a relay', 0.2, function () {
  const r = plantedRes();
  C.sendVersion(r, { commit: 'abc123', dirty: false, at: '2026-11-13', source: 'git' }, 1234, true);
  let v = null;
  try { v = JSON.parse(r.body); } catch (e) { return false; }
  return (r.status === 200 && v.version === spirit.VERSION && v.commit === 'abc123' && v.startedAt === 1234 && v.relay === true && v.untracked === 0) || false;
}, test.limit.quick);

// ── first-run defaults (goal/G30.7) ──
test.run('firstDescription reads "this <kind> described for the first time <date> <time> UTC", to the second', 0.2, function () {
  const got = C.firstDescription('relay', new Date('2026-09-17T14:23:07.123Z'));
  return got === 'this relay described for the first time 2026-09-17 14:23:07 UTC' || false;
}, test.limit.quick);
test.run('with no identity, ensureFirstRun writes nothing and answers null', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'none-'));
  return C.ensureFirstRun(home, { kind: 'node' }) === null || false;
}, test.limit.quick);
test.run('ensureFirstRun gives a blank description the first one, and a restart never overwrites a typed one', 0.2, function () {
  const auth = spirit.require('spirit/relayAuth.js');
  const home = fs.mkdtempSync(path.join(HOME, 'node-'));
  auth.saveIdentity(home, auth.generateIdentity('a node'));
  const now = new Date('2026-11-13T09:00:00.000Z');
  const first = C.ensureFirstRun(home, { kind: 'node', now: now });
  auth.setDescription(home, 'my own words');
  const again = C.ensureFirstRun(home, { kind: 'node', now: new Date() });
  return (first && first.description === 'this node described for the first time 2026-11-13 09:00:00 UTC' && again && again.description === 'my own words') || false;
}, test.limit.quick);
test.run('ensureFirstRun names a relay named nothing or "relay" as "relay" and its machine\'s name, and a name of its own stays', 0.2, function () {
  const auth = spirit.require('spirit/relayAuth.js');
  const home = fs.mkdtempSync(path.join(HOME, 'relay-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const got = C.ensureFirstRun(home, { kind: 'relay' });
  auth.saveIdentity(home, Object.assign({}, auth.loadIdentity(home), { name: 'quokka' }));
  const kept = C.ensureFirstRun(home, { kind: 'relay' });
  return (got && got.name === 'relay ' + os.hostname() && /^this relay described/.test(got.description) && kept.name === 'quokka') || false;
}, test.limit.quick);

// ── writeEnvironment (goal/G40.6) ──
test.run('writeEnvironment writes the port to spirit/state/environment.json, making the folder on a fresh tree', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'env-'));
  C.writeEnvironment(home, '45999');
  let v = null;
  try { v = JSON.parse(fs.readFileSync(path.join(home, 'spirit', 'state', 'environment.json'), 'utf8')); } catch (e) { return false; }
  return (v.PORT === 45999) || false;
}, test.limit.quick);

// ── the pages' files (goal/G43.18) ──
test.run('pageFile serves the browser\'s addresses from their files under spirit/, and the favicon from the ghost on the loopback', 0.2, function () {
  const got = [C.pageFile('face.html'), C.pageFile('/spirit.js'), C.pageFile('favicon.svg'), C.pageFile('shell/boot.js')];
  return (got[0] === 'spirit/shell/face.html' && got[1] === 'spirit/spirit.js' && got[2] === 'spirit/shell/ghost.svg' && got[3] === 'spirit/shell/boot.js') || false;
}, test.limit.quick);
test.run('pageFile leaves any other address as it is, with its leading slash left off', 0.2, function () {
  const got = [C.pageFile('/spirit/app/desk/desk.html'), C.pageFile('toString')];
  return (got[0] === 'spirit/app/desk/desk.html' && got[1] === 'toString') || false;
}, test.limit.quick);
test.run('every file PAGE_FILES names is there in the tree', 0.2, function () {
  const missing = Object.keys(C.PAGE_FILES).filter(function (a) { return !fs.existsSync(path.join(RUN, C.PAGE_FILES[a])); });
  return (Object.keys(C.PAGE_FILES).length > 0 && missing.length === 0) || false;
}, test.limit.quick);

// ── debugFirst (goal/G41.19) ──
test.run('debugFirst is DEBUG.js\'s answer, handed every request first', 0.2, function () {
  return C.debugFirst === spirit.require('spirit/DEBUG.js').answer || false;
}, test.limit.quick);
