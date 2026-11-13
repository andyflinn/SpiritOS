'use strict';

// spirit/run/spirit/test/serveCommon.js
// The tests of spirit/serveCommon.js, and of no other module (spec: ./serveCommon.md). Its own test, owed since the rule
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
const C = require(path.join(RUN, 'spirit', 'serveCommon.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
function within(promise, ms) {
  return Promise.race([promise, new Promise(function (r) { setTimeout(function () { r('__timeout__'); }, ms); })]);
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
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-serveCommon-'));
process.on('exit', function () { try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { /* gone */ } });

// ── the command line ──
test.run('portFromArgs: --port <n> and --port=<n> give the number, nothing gives null', 0.2, function () {
  const got = [C.portFromArgs(['--port', '4123']), C.portFromArgs(['x', '--port=4124']), C.portFromArgs(['x']), C.portFromArgs(['--port'])];
  return (got[0] === 4123 && got[1] === 4124 && got[2] === null && got[3] === null) || 'got ' + short(got);
}, test.limit.quick);
test.run('emailFromArgs: --email <a> and --email=<a> give the address trimmed, nothing gives an empty string (goal/G30.2)', 0.2, function () {
  const got = [C.emailFromArgs(['--email', ' a@b.c ']), C.emailFromArgs(['--email=d@e.f ']), C.emailFromArgs([])];
  return (got[0] === 'a@b.c' && got[1] === 'd@e.f' && got[2] === '') || 'got ' + short(got);
}, test.limit.quick);

// ── the start refused, loudly ──
test.run('verifyStartupCwd refuses to start, exit 1 and a sentence, from a folder that is not spirit/run', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(HOME); got = withExit(function () { C.verifyStartupCwd('spirit/server.js'); }); } finally { process.chdir(was); }
  return (got.code === 1 && /Refusing to start/.test(got.said) && /spirit\/server\.js/.test(got.said)) || 'got ' + short(got);
}, test.limit.quick);
test.run('verifyStartupCwd lets a start from spirit/run go on, with the folders it names (goal/G16.9: a relay needs only spirit/)', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/relayServer.js'); C.verifyStartupCwd('spirit/server.js', ['spirit']); }); } finally { process.chdir(was); }
  return got.code === null || 'refused from spirit/run: ' + short(got);
}, test.limit.quick);
test.run('verifyStartupCwd refuses a folder the entry point names that is not there', 0.2, function () {
  const was = process.cwd();
  let got = null;
  try { process.chdir(RUN); got = withExit(function () { C.verifyStartupCwd('spirit/server.js', ['spirit', 'no-such-folder-here']); }); } finally { process.chdir(was); }
  return (got.code === 1 && /no-such-folder-here/.test(got.said)) || 'got ' + short(got);
}, test.limit.quick);
test.run('refuseListenError: a port in use stops the process, exit 1, naming the port and the next one to try', 0.2, function () {
  const server = new EventEmitter();
  C.refuseListenError(server, 4500, 'spirit/server.js');
  const got = withExit(function () { server.emit('error', Object.assign(new Error('in use'), { code: 'EADDRINUSE' })); });
  const other = withExit(function () { server.emit('error', new Error('something else')); });
  return (got.code === 1 && /4500 is already in use/.test(got.said) && /--port 4501/.test(got.said) && other.code === 1 && /something else/.test(other.said)) || 'got ' + short([got, other]);
}, test.limit.quick);

// ── sendFile ──
test.run('sendFile answers 200, the file, and its type by extension', 0.2, async function () {
  const f = path.join(HOME, 'page.css');
  fs.writeFileSync(f, 'body{}');
  const r = plantedRes();
  C.sendFile(r, f);
  await within(r.ended, 2000);
  return (r.status === 200 && String(r.body) === 'body{}' && /text\/css/.test(r.headers['Content-Type'])) || 'got ' + short([r.status, r.headers, String(r.body)]);
}, test.limit.quick);
test.run('sendFile: no such file is 404, and a path with a NUL in it is 404, never a crash (goal/G41.30)', 0.2, async function () {
  const a = plantedRes();
  const b = plantedRes();
  C.sendFile(a, path.join(HOME, 'none.html'));
  C.sendFile(b, path.join(HOME, 'bad\0name.html'));
  await within(Promise.all([a.ended, b.ended]), 2000);
  return (a.status === 404 && b.status === 404) || 'got ' + short([a.status, b.status]);
}, test.limit.quick);

// ── readBody: bytes copied, bytes counted (goal/G16.6) ──
test.run('readBody: a character split across two chunks arrives whole, never as U+FFFD', 0.2, async function () {
  const s = new EventEmitter();
  const bytes = Buffer.from('ab\u{1F47B}cd', 'utf8');
  const p = C.readBody(s);
  s.emit('data', bytes.subarray(0, 4));
  s.emit('data', bytes.subarray(4));
  s.emit('end');
  const got = await within(p, 1000);
  return got === 'ab\u{1F47B}cd' || 'got ' + short(got);
}, test.limit.quick);
test.run('readBody: past max it refuses at once, 413 body-too-large, and destroys the stream so the rest stops arriving', 0.2, async function () {
  const s = new EventEmitter();
  let destroyed = false;
  s.destroy = function () { destroyed = true; };
  const p = C.readBody(s, { max: 5 });
  s.emit('data', Buffer.from('abcdefg'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && err.code === 'body-too-large' && err.bytes === 7 && err.max === 5 && destroyed) || 'got ' + short([err && err.statusCode, err && err.code, destroyed]);
}, test.limit.quick);
test.run('readBody: a caller names its own refusal, and onBytes hears the running total', 0.2, async function () {
  const s = new EventEmitter();
  const heard = [];
  const p = C.readBody(s, { max: 3, code: 'relay-answer-too-large', message: 'the answer is too large', onBytes: function (n) { heard.push(n); } });
  s.emit('data', Buffer.from('ab'));
  s.emit('data', Buffer.from('cd'));
  const err = await within(p.then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.code === 'relay-answer-too-large' && err.message === 'the answer is too large' && heard.join() === '2,4') || 'got ' + short([err && err.code, err && err.message, heard]);
}, test.limit.quick);

// ── readJsonBody, bodyBytes, useBody ──
test.run('readJsonBody: the body parsed; an empty body is {}; bad JSON rejects', 0.2, async function () {
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
  return (got !== '__timeout__' && got[0].verb === 'x' && JSON.stringify(got[1]) === '{}' && got[2] === 'rejected') || 'got ' + short(got);
}, test.limit.quick);
test.run('readJsonBody: read once, answerable twice: a second caller gets the same promise', 0.2, function () {
  const q = plantedReq({});
  return C.readJsonBody(q) === C.readJsonBody(q) || 'a second read made a second promise';
}, test.limit.quick);
test.run('readJsonBody: a declared Content-Length past BODY_MAX is refused before a byte is read, 413, the socket destroyed', 0.2, async function () {
  const q = plantedReq({ 'content-length': String(limits.BODY_MAX + 1) });
  const err = await within(C.readJsonBody(q).then(function () { return null; }, function (e) { return e; }), 1000);
  return (err && err.statusCode === 413 && q.destroyed) || 'got ' + short([err && err.statusCode, q.destroyed]);
}, test.limit.quick);
test.run('readJsonBody: a body with no Content-Length that runs past its max is refused by the running total, 413, and bodyBytes says how much was read', 0.2, async function () {
  const q = plantedReq({});
  const p = C.readJsonBody(q, { max: 10 }).then(function () { return null; }, function (e) { return e; });
  q.emit('data', Buffer.from('{"a":"0123456789"}'));
  const err = await within(p, 1000);
  return (err && err.statusCode === 413 && q.destroyed && C.bodyBytes(q) === 18) || 'got ' + short([err && err.statusCode, q.destroyed, C.bodyBytes(q)]);
}, test.limit.quick);
test.run('bodyBytes is 0 before any byte is read', 0.2, function () {
  return C.bodyBytes(plantedReq({})) === 0 || 'bodyBytes ' + C.bodyBytes(plantedReq({}));
}, test.limit.quick);
test.run('useBody: what the door sets is the body every later reader gets (goal/G41.15)', 0.2, async function () {
  const q = plantedReq({});
  C.useBody(q, { call: 'x', n: 1 });
  const got = await within(C.readJsonBody(q), 1000);
  return (got && got.n === 1 && got.call === 'x') || 'got ' + short(got);
}, test.limit.quick);

// ── refusals ──
test.run('refuseTooBig: a declared length past BODY_MAX is answered 413 and true; within it nothing is answered', 0.2, function () {
  const big = plantedRes();
  const yes = C.refuseTooBig({ headers: { 'content-length': String(limits.BODY_MAX + 1) } }, big);
  const small = plantedRes();
  const no = C.refuseTooBig({ headers: { 'content-length': '10' } }, small);
  return (yes === true && big.status === 413 && no === false && small.status === null) || 'got ' + short([yes, big.status, no, small.status]);
}, test.limit.quick);
test.run('nodeRefusal: one answer for every failure, "not now" with its code; the status varies, the string never', 0.2, function () {
  const a = plantedRes();
  const b = plantedRes();
  C.nodeRefusal(a);
  C.nodeRefusal(b, 429);
  return (a.status === 403 && b.status === 429 && a.body === b.body && JSON.parse(a.body).error === 'not now' && JSON.parse(a.body).code === 'node-not-now') || 'got ' + short([a.status, b.status, a.body, b.body]);
}, test.limit.quick);
test.run('parseRequestPath: a good path answers url and the decoded pathname', 0.2, function () {
  const r = plantedRes();
  const got = C.parseRequestPath({ url: '/a%20b?x=1', headers: { host: 'localhost:1' } }, r);
  return (got && got.pathname === '/a b' && got.url.searchParams.get('x') === '1' && r.status === null) || 'got ' + short(got);
}, test.limit.quick);
test.run('parseRequestPath: a malformed escape, and a NUL in the path, are answered 400 and null, never a dead process (goal/G41.30)', 0.2, function () {
  const got = ['/%zz', '/%', '/%00'].map(function (u) { const r = plantedRes(); const p = C.parseRequestPath({ url: u, headers: {} }, r); return [p, r.status]; });
  return got.every(function (g) { return g[0] === null && g[1] === 400; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('answerClientErrors: a request Node cannot parse is answered 400 in order, the rest read and dropped; a reset is only destroyed (goal/G41.30)', 0.2, function () {
  const server = new EventEmitter();
  C.answerClientErrors(server);
  function sock() { const s = new EventEmitter(); s.destroyed = false; s.resumed = false; s.written = ''; s.resume = function () { s.resumed = true; }; s.end = function (t) { s.written += t; }; s.destroy = function () { s.destroyed = true; }; return s; }
  const a = sock();
  server.emit('clientError', new Error('bad header'), a);
  const b = sock();
  server.emit('clientError', Object.assign(new Error('reset'), { code: 'ECONNRESET' }), b);
  return (/^HTTP\/1\.1 400 /.test(a.written) && a.resumed && !a.destroyed && b.destroyed && b.written === '') || 'got ' + short([a.written, a.resumed, a.destroyed, b.destroyed]);
}, test.limit.quick);

// ── clientKeyFor (goal/G22.7) ──
test.run('clientKeyFor: from the loopback, the last X-Forwarded-For entry, the one Caddy appended', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' } });
  return got === '198.51.100.7' || 'got ' + short(got);
}, test.limit.quick);
test.run('clientKeyFor: from anywhere else, the socket address, whatever header it carries', 0.2, function () {
  const got = C.clientKeyFor({ socket: { remoteAddress: '203.0.113.5' }, headers: { 'x-forwarded-for': '198.51.100.7' } });
  return got === '203.0.113.5' || 'got ' + short(got);
}, test.limit.quick);
test.run('clientKeyFor: from the loopback with no header, the socket address; ::1 and ::ffff:127.x count as the loopback', 0.2, function () {
  const got = [C.clientKeyFor({ socket: { remoteAddress: '::1' }, headers: {} }), C.clientKeyFor({ socket: { remoteAddress: '::ffff:127.0.0.2' }, headers: { 'x-forwarded-for': '198.51.100.8' } })];
  return (got[0] === '::1' && got[1] === '198.51.100.8') || 'got ' + short(got);
}, test.limit.quick);

// ── sendVersion ──
test.run('sendVersion answers the version, the commit and since when it started, and whether it is a relay', 0.2, function () {
  const r = plantedRes();
  C.sendVersion(r, { commit: 'abc123', dirty: false, at: '2026-11-13', source: 'git' }, 1234, true);
  let v = null;
  try { v = JSON.parse(r.body); } catch (e) { return 'not JSON: ' + short(r.body); }
  return (r.status === 200 && v.version === spirit.VERSION && v.commit === 'abc123' && v.startedAt === 1234 && v.relay === true && v.untracked === 0) || 'got ' + short(v);
}, test.limit.quick);

// ── first-run defaults (goal/G30.7) ──
test.run('firstDescription: "this <kind> described for the first time <date> <time> UTC", to the second', 0.2, function () {
  const got = C.firstDescription('relay', new Date('2026-09-17T14:23:07.123Z'));
  return got === 'this relay described for the first time 2026-09-17 14:23:07 UTC' || 'got ' + short(got);
}, test.limit.quick);
test.run('ensureFirstRun: no identity, nothing written and null', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'none-'));
  return C.ensureFirstRun(home, { kind: 'node' }) === null || 'answered an identity from nowhere';
}, test.limit.quick);
test.run('ensureFirstRun: a blank description gets the first one; a typed one is never overwritten by a restart', 0.2, function () {
  const auth = spirit.require('spirit/relayAuth.js');
  const home = fs.mkdtempSync(path.join(HOME, 'node-'));
  auth.saveIdentity(home, auth.generateIdentity('a node'));
  const now = new Date('2026-11-13T09:00:00.000Z');
  const first = C.ensureFirstRun(home, { kind: 'node', now: now });
  auth.setDescription(home, 'my own words');
  const again = C.ensureFirstRun(home, { kind: 'node', now: new Date() });
  return (first && first.description === 'this node described for the first time 2026-11-13 09:00:00 UTC' && again && again.description === 'my own words') || 'got ' + short([first && first.description, again && again.description]);
}, test.limit.quick);
test.run('ensureFirstRun: a relay named nothing or "relay" is named "relay" and its machine\'s name; a name of its own stays (rule/13)', 0.2, function () {
  const auth = spirit.require('spirit/relayAuth.js');
  const home = fs.mkdtempSync(path.join(HOME, 'relay-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const got = C.ensureFirstRun(home, { kind: 'relay' });
  auth.saveIdentity(home, Object.assign({}, auth.loadIdentity(home), { name: 'quokka' }));
  const kept = C.ensureFirstRun(home, { kind: 'relay' });
  return (got && got.name === 'relay ' + os.hostname() && /^this relay described/.test(got.description) && kept.name === 'quokka') || 'got ' + short([got && got.name, kept && kept.name]);
}, test.limit.quick);

// ── writeEnvironment (goal/G40.6) ──
test.run('writeEnvironment writes the port to spirit/state/environment.json, making the folder on a fresh tree', 0.2, function () {
  const home = fs.mkdtempSync(path.join(HOME, 'env-'));
  C.writeEnvironment(home, '45999');
  let v = null;
  try { v = JSON.parse(fs.readFileSync(path.join(home, 'spirit', 'state', 'environment.json'), 'utf8')); } catch (e) { return 'no environment.json: ' + e.message; }
  return (v.PORT === 45999) || 'got ' + short(v);
}, test.limit.quick);

// ── the pages' files (goal/G43.18) ──
test.run('pageFile: the browser\'s addresses are served from their files under spirit/; the ghost favicon on the loopback (Q26)', 0.2, function () {
  const got = [C.pageFile('face.html'), C.pageFile('/spirit.js'), C.pageFile('favicon.svg'), C.pageFile('shell/boot.js')];
  return (got[0] === 'spirit/shell/face.html' && got[1] === 'spirit/spirit.js' && got[2] === 'spirit/shell/ghost.svg' && got[3] === 'spirit/shell/boot.js') || 'got ' + short(got);
}, test.limit.quick);
test.run('pageFile: any other address is itself, its leading slash left off', 0.2, function () {
  const got = [C.pageFile('/spirit/app/desk/desk.html'), C.pageFile('toString')];
  return (got[0] === 'spirit/app/desk/desk.html' && got[1] === 'toString') || 'got ' + short(got);
}, test.limit.quick);
test.run('every file PAGE_FILES names is there in the tree', 0.2, function () {
  const missing = Object.keys(C.PAGE_FILES).filter(function (a) { return !fs.existsSync(path.join(RUN, C.PAGE_FILES[a])); });
  return (Object.keys(C.PAGE_FILES).length > 0 && missing.length === 0) || 'missing: ' + short(missing);
}, test.limit.quick);

// ── debugFirst (goal/G41.19) ──
test.run('debugFirst is DEBUG.js\'s answer, handed every request first', 0.2, function () {
  return C.debugFirst === spirit.require('spirit/DEBUG.js').answer || 'debugFirst is not DEBUG.answer';
}, test.limit.quick);
