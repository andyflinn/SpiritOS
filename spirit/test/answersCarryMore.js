'use strict';

// spirit/test/answersCarryMore.js
// goal/G4.19, issue 4: an answer may carry more than it declares; a request stays exact. RED on today's tree: the app
// server refuses any reply with a key it did not declare (appServer.js matches, used for replies too), so
// deskClient.desk hands the desk's answer back inside a JSON string, {json}, and the escaping pushes a big desk read
// past the travel limit (app-answer-too-large, 8833 > 8377 on a changes read).
//
//   Andy, 2026-10-04, the box of goal/G4.19: "4. a MAX_PAYLOAD pop is serious."; "ah, it's a check that say it' must
//   have all the declared elements, but NO MORE! / the alternativeL it must have all the declared elements, or
//   more...?"; "if the request shape is a complex object, will it be checked all the way to the leaf, of only the data
//   type?"; "your recommendations, in english?"; "agreed."; "appServer. yes, you may correct that in appServer"; "i
//   hereby grant the permission to modify, commit and push the core file appServer.js, to loosen constraints on reply
//   shape."; then his Go on goal/G4.19.
//
// THE CONTRACT (the box of goal/G4.19).
//   1. THE APP SERVER (js/appServer.js, the one core file granted): a reply must carry every key its prototype
//      declares, of the declared type, and may carry more, at every depth; a reply missing a declared key is still
//      refused handler-failed. A request stays exact: a key more or less is refused no-such-argument, as today.
//      A reply prototype {} therefore takes any object.
//   2. deskClient.desk declares its reply {} and hands back the desk's answer as it is, an object: no json string.
//   3. A desk read near the desk's room comes back whole through deskClient.desk: a changes read from the start of a
//      long desk is answered, not refused app-answer-too-large.
//   4. deskEar prints the desk's answer as JSON and exits 0, a big read too.
// NOT ASSERTED, the builder's: how deskClient.desk passes a desk refusal on (deskEar must still exit 1 on one);
// deskClientAsk.js, which reads today's {json} shape, moves with the change.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const errors = require('../run/js/spiritErrors.js');
const { pipeRequest } = require('../run/js/relayRequest.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'owed by goal/G4.19: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const EAR = path.join(RUN, 'process', 'js', 'desk', 'deskEar.js');
const appServer = require('../run/js/appServer.js');

const OWNER = { owner: true, key: 'MCowBQYDK2VwAyEAanswersCarryMoreOwnerAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const DESK_KEY = 'MCowBQYDK2VwAyEAanswersCarryMoreDeskNodeAAAAAAAAAAAAA=';
const AGENT = { key: OWNER.key, label: 'claude-windows' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function isError(b, code) { return !!b && b.ok === false && b.code === code && !!errors.byCode(code); }

test.startTest('goal/G4.19 issue 4: an answer may carry more than it declares; a request stays exact');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-answersmore-'));
const kids = [];
const streams = [];
const win = process.platform === 'win32';
function pipeFor(name) { return win ? appClient.pipePathFor(scratch, name, 'win32', 'process') : path.join(scratch, name + '.sock'); }
function ask(pipe, body) {
  return pipeRequest(pipe, 'POST', '/', JSON.stringify(body), { type: 'application/json', timeoutMs: 3000 }).then(function (a) {
    let parsed = null;
    try { parsed = JSON.parse(a.text); } catch (e) { parsed = null; }
    return { status: a.status, body: parsed };
  });
}

// ── 1. THE APP SERVER ───────────────────────────────────────────────

async function theAppServer() {
  test.subHeading('1. the app server: replies may carry more, at every depth; requests stay exact');
  const pipe = pipeFor('shapes');
  const server = appServer.createAppServer({
    more: { request: { a: '' }, reply: { a: '' }, handler: function (x) { return { a: x.a, extra: 1 }; } },
    deep: { request: {}, reply: { o: { a: '' } }, handler: function () { return { o: { a: 'x', b: 2 }, c: true }; } },
    short: { request: {}, reply: { a: '', b: 0 }, handler: function () { return { a: 'x' }; } },
    wrongType: { request: {}, reply: { a: '' }, handler: function () { return { a: 5, extra: 1 }; } },
    open: { request: {}, reply: {}, handler: function () { return { anything: [1, 2], at: 'all' }; } },
  });
  await new Promise(function (r) { server.listen(pipe, r); });
  const more = await ask(pipe, { more: { a: 'hi' } });
  if (more.status === 200 && more.body && more.body.a === 'hi' && more.body.extra === 1) test.check('a reply with a key more than declared passes, the key kept');
  else test.fail(OWED + 'a reply with one key more answered ' + more.status + ' ' + JSON.stringify(more.body));
  const deep = await ask(pipe, { deep: {} });
  if (deep.status === 200 && deep.body && deep.body.o && deep.body.o.b === 2 && deep.body.c === true) test.check('more is allowed at every depth');
  else test.fail(OWED + 'a nested reply with keys more answered ' + deep.status + ' ' + JSON.stringify(deep.body));
  const open = await ask(pipe, { open: {} });
  if (open.status === 200 && open.body && open.body.at === 'all') test.check('a reply prototype {} takes any object');
  else test.fail(OWED + 'a reply prototype {} answered ' + open.status + ' ' + JSON.stringify(open.body));
  const shortR = await ask(pipe, { short: {} });
  if (isError(shortR.body, 'handler-failed')) test.check('a reply missing a declared key is still handler-failed');
  else test.fail('a reply missing a declared key answered ' + shortR.status + ' ' + JSON.stringify(shortR.body));
  const wrong = await ask(pipe, { wrongType: {} });
  if (isError(wrong.body, 'handler-failed')) test.check('a declared key of the wrong type is still handler-failed, whatever more it carries');
  else test.fail('a reply with a wrong-typed key answered ' + wrong.status + ' ' + JSON.stringify(wrong.body));
  const reqMore = await ask(pipe, { more: { a: 'hi', b: 1 } });
  if (isError(reqMore.body, 'no-such-argument')) test.check('a request with a key more is still refused no-such-argument: requests stay exact');
  else test.fail('a request with one key more answered ' + reqMore.status + ' ' + JSON.stringify(reqMore.body));
  server.close();
}

// ── 2-4. deskClient AND deskEar ─────────────────────────────────────

const deskPipe = pipeFor('desk');
const clientPipe = pipeFor('deskClient');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
client.register('deskClient', clientPipe);
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// THE PRETEND NODE: deskClient's peer.post goes into the real desk server as the agent's own ask, its answer back down
// the event stream by re, as a relay brings it; jobs.api from deskEar reaches deskClient as its node's owner.
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': open\n\n');
    streams.push(res);
    return;
  }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'jobs.api') {
      client.ask(b.ask, OWNER).then(function (r) {
        res.writeHead((r && r.status) || 502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r && r.body));
      }, function (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e.message })); });
      return;
    }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let asked = null;
    try { asked = packet.decode(b.text); } catch (e) { asked = null; }
    const desk = (asked && asked.body && asked.body.desk) || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, AGENT).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
function ear(port, verb, json) {
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [EAR, String(port), verb, json], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    kid.stdout.on('data', function (c) { out += c; });
    kid.stderr.on('data', function (c) { err += c; });
    const t = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 40000);
    kid.on('exit', function (code) { clearTimeout(t); resolve({ code: code, out: out, err: err }); });
  });
}

async function theDeskPath() {
  test.subHeading('2-4. deskClient.desk hands the desk\'s answer back as it is; a big read comes through whole');
  const deskState = path.join(scratch, 'desk-state');
  const clientState = path.join(scratch, 'client-state');
  fs.mkdirSync(deskState, { recursive: true });
  fs.mkdirSync(clientState, { recursive: true });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const port = node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'b/G1', title: 'Big' }, items: [{ id: 'b/G1.1', title: 'Long chat', blocks: ['b/G1'] }] }) }, AGENT);
  // A desk with more records than one answer holds: forty lines of three hundred characters.
  for (let i = 0; i < 40; i++) await call('desk', 'chat.add', { id: 'b/G1.1', text: 'line ' + i + ' "quoted" ' + 'x'.repeat(290) }, AGENT);
  kids.push(spawn(process.execPath, [CLIENT, '{}', '--pipe', clientPipe, '--state', clientState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + port + '/' }),
  }));
  const tree = await up('deskClient') || {};
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);

  const shape = JSON.stringify((tree.desk || {}).reply || null);
  if (shape === '{}') test.check('deskClient.desk declares its reply {}');
  else test.fail(OWED + 'deskClient.desk declares its reply ' + shape);

  const one = await call('deskClient', 'desk', { verb: 'item.get', json: JSON.stringify({ id: 'b/G1.1' }) }, OWNER);
  const b1 = one.body || {};
  if (one.status === 200 && typeof b1.item === 'string' && b1.json === undefined) test.check('item.get comes back as the desk\'s answer itself, {item, version, change}, no json string');
  else test.fail(OWED + 'deskClient.desk item.get answered ' + one.status + ' with keys ' + JSON.stringify(Object.keys(b1)));

  const big = await call('deskClient', 'desk', { verb: 'changes', json: JSON.stringify({ n: 0, line: 0 }) }, OWNER);
  const bb = big.body || {};
  const bigBytes = Buffer.byteLength(JSON.stringify(bb), 'utf8');
  if (big.status === 200 && Array.isArray(bb.records) && bb.records.length > 0 && !isError(bb, 'app-answer-too-large')) test.check('a changes read from the start comes back whole (' + bigBytes + ' bytes, ' + bb.records.length + ' records)');
  else test.fail(OWED + 'a changes read from the start answered ' + big.status + ' ' + JSON.stringify(bb).slice(0, 200));

  const e1 = await ear(port, 'item.get', JSON.stringify({ id: 'b/G1.1' }));
  let p1 = null; try { p1 = JSON.parse(e1.out); } catch (e) { p1 = null; }
  if (e1.code === 0 && p1 && typeof p1.item === 'string') test.check('deskEar item.get prints the desk\'s answer as JSON and exits 0');
  else test.fail(OWED + 'deskEar item.get exited ' + e1.code + ': ' + (e1.out || e1.err).trim().slice(0, 200));
  const e2 = await ear(port, 'changes', JSON.stringify({ n: 0, line: 0 }));
  let p2 = null; try { p2 = JSON.parse(e2.out); } catch (e) { p2 = null; }
  if (e2.code === 0 && p2 && Array.isArray(p2.records) && p2.records.length > 0) test.check('deskEar changes from the start prints the big answer whole and exits 0');
  else test.fail(OWED + 'deskEar changes exited ' + e2.code + ': ' + (e2.out || e2.err).trim().slice(0, 200));
}

async function main() {
  await theAppServer();
  await theDeskPath();
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } process.exit(0); }, 300);
});
