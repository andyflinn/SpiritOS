'use strict';

// desk/G2.5: DEBUG, one switch, off after a restart.
// Andy: "the relay-stream upgrade was designed to change const DEBUG to let DEBUG, we even talked about restart
// setting it back to it's default DEBUG = false." "DEBUG is Off by default, returned and set by owner-only api",
// "DEBUG is not persisted. it lives in RAM only". "DEBUG auto-verb supplied by appServer is approved."
// "DEBUG verb is never allowed through peerPost()". "node.debug: yes."
// The contract the builder follows:
//   The kernel's DEBUG is a let, false at start, one per process; print() writes only while it is on.
//   appServer gives every server a DEBUG verb, as it gives AGENTS: {} reads, {on: true|false} sets; both
//   answer {debug: <boolean>} with the state that resulted. It flips that process's kernel DEBUG.
//   apiDoor refuses a member's ask for a server's DEBUG and never passes it on; jobs.api (loopback) reaches it.
//   The node answers node.debug, shaped like relay.debug: {debug: {}} reads, {debug: {on}} sets; both answer
//   {debug: <boolean>}. It is claimed in server.js, so the owner door reaches it on a puppet (everyVerb.js).
//   The relay keeps no DEBUG of its own: relay.debug uses the kernel's.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { relayRequest } = require('../run/js/relayRequest.js');
const { spawn, execFileSync } = require('child_process');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by desk/G2.5: ';
const RUN = path.join(__dirname, '..', 'run');
const KERNEL = path.join(RUN, 'js', 'kernel.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'debugFixture.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(150); } return fn(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
// includeLists.js's way to a node's one door.
function post(port, body) {
  return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
    let j = null;
    try { j = JSON.parse(r.text); } catch (e) { j = null; }
    return { status: r.status, body: j };
  }, function () { return { status: 0, body: null }; });
}

test.startTest('desk/G2.5: DEBUG is one switch per process, off at start, owner only');

(async function () {
  // ── THE KERNEL ──────────────────────────────────────────────────────
  test.subHeading('the kernel\'s DEBUG starts off');
  const printed = execFileSync(process.execPath, ['-e', 'require(' + JSON.stringify(KERNEL) + ').core.util.print("seen")'], { encoding: 'utf8' });
  if (printed.indexOf('seen') === -1) test.check('a fresh process prints nothing through print()');
  else test.fail(OWED + 'a fresh process prints: DEBUG starts on');
  if (!/\bconst\s+DEBUG\b/.test(code(KERNEL))) test.check('kernel.js has no const DEBUG');
  else test.fail(OWED + 'kernel.js still says const DEBUG');

  // ── A SERVER'S DEBUG VERB ───────────────────────────────────────────
  test.subHeading('appServer gives every server a DEBUG verb that flips its own DEBUG');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-debug-'));
  const pipe = process.platform === 'win32' ? '\\\\.\\pipe\\spirit-debug-' + process.pid : path.join(scratch, 'door.sock');
  const kid = spawn(process.execPath, [FIXTURE, '--pipe', pipe], { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = '';
  kid.stdout.on('data', function (c) { out += c; });
  const appClient = require('../run/js/appClient.js');
  const client = appClient.createAppClient({ rootDir: scratch });
  if (typeof client.register === 'function') client.register('debugFixture', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ debugFixture: b }).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const up = await until(function () { return call('ping', {}).then(function (r) { return r.pong === 'yes'; }); }, 8000);
  if (!up) test.fail('the fixture server never answered ping');
  const pingedBefore = /pinged/.test(out);
  const read0 = await call('DEBUG', {});
  if (read0.debug === false) test.check('DEBUG {} reads false at start');
  else test.fail(OWED + 'DEBUG {} answered ' + JSON.stringify(read0));
  const set1 = await call('DEBUG', { on: true });
  await call('ping', {});
  await sleep(300);
  if (set1.debug === true && !pingedBefore && /pinged/.test(out)) test.check('DEBUG {on: true} answers true, and the server\'s print() now writes');
  else test.fail(OWED + 'DEBUG {on: true} answered ' + JSON.stringify(set1) + ', printed before ' + pingedBefore + ', after ' + /pinged/.test(out));
  const read1 = await call('DEBUG', {});
  const set0 = await call('DEBUG', { on: false });
  if (read1.debug === true && set0.debug === false) test.check('it reads back true, and {on: false} turns it off');
  else test.fail(OWED + 'read ' + JSON.stringify(read1) + ', off ' + JSON.stringify(set0));
  kid.kill();

  // ── MEMBERS NEVER REACH IT ──────────────────────────────────────────
  test.subHeading('apiDoor refuses DEBUG to a member; jobs.api reaches it');
  const apiDoor = require('../run/js/apiDoor.js');
  const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';
  const asked = [];
  const posted = [];
  const servers = { ask: function (body) { asked.push(body); return Promise.resolve({ status: 200, body: { debug: true } }); } };
  const door = apiDoor.createApiDoor({
    servers: servers,
    post: function (relay, to, text) { posted.push(packet.decode(text)); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode, isKnown: function (k) { return k === MEMBER; }, log: function () {},
  });
  await door({ fromKey: MEMBER, hash: 'H1', relay: 'https://relay.example', text: packet.encode('api', { grantFace: { DEBUG: { on: true } } }).text });
  await sleep(50);
  const refusal = posted[0] && posted[0].body;
  if (!asked.length && refusal && refusal.ok === false) test.check('a member\'s DEBUG is refused and never reaches the server');
  else test.fail(OWED + 'a member\'s DEBUG: server asked ' + JSON.stringify(asked) + ', answered ' + JSON.stringify(refusal));
  await door({ fromKey: MEMBER, hash: 'H2', relay: 'https://relay.example', text: packet.encode('api', { grantFace: { get: { name: 'x' } } }).text });
  await sleep(50);
  if (asked.some(function (a) { return a.grantFace && a.grantFace.get; })) test.check('a member\'s other verbs still pass');
  else test.fail('a member\'s ordinary ask did not pass: ' + JSON.stringify(asked));
  asked.length = 0;
  await apiDoor.answer(servers, { grantFace: { DEBUG: {} } });
  if (asked.length === 1) test.check('jobs.api\'s way in (apiDoor.answer) still reaches DEBUG');
  else test.fail(OWED + 'the loopback way in no longer reaches DEBUG');

  // ── THE RELAY ───────────────────────────────────────────────────────
  test.subHeading('the relay keeps no DEBUG of its own');
  if (!/\bvar\s+debugging\b|\blet\s+debugging\b/.test(code(path.join(RUN, 'js', 'relay.js')))) test.check('relay.js has no debugging flag of its own');
  else test.fail(OWED + 'relay.js still keeps its own debugging flag');

  // ── THE NODE ────────────────────────────────────────────────────────
  test.subHeading('the node answers node.debug, off after a restart');
  const root = setupRelayFakes('debugSwitch').andy;
  fs.writeFileSync(path.join(root, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  const claimed = new RegExp("^ {4}'node\\.debug':", 'm').test(fs.readFileSync(path.join(root, 'js', 'server.js'), 'utf8'));
  if (claimed) test.check('node.debug is claimed in server.js, so the owner door reaches it too');
  else test.fail(OWED + 'node.debug is not claimed in server.js');
  const boot = async function () {
    const port = await freePort();
    const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
    const ok = await until(function () { return post(port, { verb: 'node.info' }).then(function (r) { return r.status > 0; }); }, 10000);
    return { port: port, node: node, ok: ok };
  };
  let n = await boot();
  if (!n.ok) test.fail('the node did not boot');
  const r0 = (await post(n.port, { verb: 'node.debug', debug: {} })).body || {};
  const r1 = (await post(n.port, { verb: 'node.debug', debug: { on: true } })).body || {};
  const r2 = (await post(n.port, { verb: 'node.debug', debug: {} })).body || {};
  if (r0.debug === false && r1.debug === true && r2.debug === true) test.check('node.debug reads false, sets true, reads true');
  else test.fail(OWED + 'node.debug answered ' + JSON.stringify([r0, r1, r2]));
  n.node.kill();
  await sleep(500);
  n = await boot();
  const r3 = (await post(n.port, { verb: 'node.debug', debug: {} })).body || {};
  if (r3.debug === false) test.check('after a restart it reads false again: RAM only');
  else test.fail(OWED + 'after a restart node.debug answered ' + JSON.stringify(r3));
  n.node.kill();
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
