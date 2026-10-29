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
//   apiDoor refuses a member's ask for a server's DEBUG and never passes it on; the owner's own call on /api/spirit
//   (<server>.DEBUG through the flat door, goal/G30.6) reaches it.
//   The node answers node.debug, shaped like relay.debug: {debug: {}} reads, {debug: {on}} sets; both answer
//   {debug: <boolean>}. It is claimed in server.js, so the owner door reaches it on a puppet (everyVerb.js).
//   The relay keeps no DEBUG of its own: relay.debug uses the kernel's.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { relayRequest } = require('../run/spirit/relayRequest.js');
const { spawn, execFileSync } = require('child_process');
const test = require('./testSupport.js');
const packet = require('../run/spirit/client/packet');
const arrivals = require('../run/spirit/arrivals.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by desk/G2.5: ';
const RUN = path.join(__dirname, '..', 'run');
const KERNEL = path.join(RUN, 'spirit', 'kernel.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'debugFixture.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(150); } return fn(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
// A node's one door, by its flat apiDoor.
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
  const appClient = require('../run/spirit/appClient.js');
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
  test.subHeading('apiDoor refuses DEBUG to a member; the owner\'s flat door reaches it');
  const apiDoor = require('../run/spirit/apiDoor.js');
  const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';
  const asked = [];
  const posted = [];
  const servers = { ask: function (body) { asked.push(body); return Promise.resolve({ status: 200, body: { debug: true } }); } };
  const door = apiDoor.createApiDoor({
    servers: servers,
    post: function (relay, to, text) { posted.push(packet.decode(text)); return Promise.resolve({ ok: true }); },
    encode: packet.encode, isKnown: function (k) { return k === MEMBER; }, log: function () {},
    // apiAuth/G1.2: the door gates members by their grants; this member holds
    // the whole fake app, so what this suite tests (DEBUG's refusal) stays its own.
    auth: { pathsOf: function (k) { return k === MEMBER ? ['grantFace'] : []; } },
  });
  await door(Object.assign({ fromKey: MEMBER, hash: 'H1', relay: 'https://relay.example', text: packet.encode('api', { grantFace: { DEBUG: { on: true } } }).text}, { envelope: arrivals.envelopeOf(packet.encode('api', { grantFace: { DEBUG: { on: true } } }).text) }));
  await sleep(50);
  const refusal = posted[0] && posted[0].body;
  if (!asked.length && refusal && refusal.ok === false) test.check('a member\'s DEBUG is refused and never reaches the server');
  else test.fail(OWED + 'a member\'s DEBUG: server asked ' + JSON.stringify(asked) + ', answered ' + JSON.stringify(refusal));
  await door(Object.assign({ fromKey: MEMBER, hash: 'H2', relay: 'https://relay.example', text: packet.encode('api', { grantFace: { get: { name: 'x' } } }).text}, { envelope: arrivals.envelopeOf(packet.encode('api', { grantFace: { get: { name: 'x' } } }).text) }));
  await sleep(50);
  if (asked.some(function (a) { return a.grantFace && a.grantFace.get; })) test.check('a member\'s other verbs still pass');
  else test.fail('a member\'s ordinary ask did not pass: ' + JSON.stringify(asked));
  asked.length = 0;
  // The owner's way in since goal/G30.6: /api/spirit hands grantFace.DEBUG to the flat door (verbTable's door), whose
  // in-process call is what the loopback front and the owner door both run.
  const ownDoor = require('../run/spirit/verbTable.js').createVerbTable().door({ apps: function () { return ['grantFace']; }, ask: servers.ask });
  await ownDoor.call('grantFace.DEBUG', {});
  if (asked.length === 1 && asked[0].grantFace && asked[0].grantFace.DEBUG) test.check('the owner\'s way in (grantFace.DEBUG by name on the flat door) still reaches DEBUG');
  else test.fail(OWED + 'the loopback way in no longer reaches DEBUG');

  // ── THE RELAY ───────────────────────────────────────────────────────
  test.subHeading('the relay keeps no DEBUG of its own');
  if (!/\bvar\s+debugging\b|\blet\s+debugging\b/.test(code(path.join(RUN, 'spirit', 'relay.js')))) test.check('relay.js has no debugging flag of its own');
  else test.fail(OWED + 'relay.js still keeps its own debugging flag');

  // ── THE NODE ────────────────────────────────────────────────────────
  test.subHeading('the node answers node.debug, off after a restart');
  const root = setupRelayFakes('debugSwitch').andy;
  // goal/G16.3: the node's relay list is node state, relay-state/relays.json.
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  // Mounted since goal/G30.4: the node family's block declares its verbs bare ('debug'), the table names it node.debug.
  const nodeBlock = /loopbackVerbs\.mount\('node',[\s\S]*?\n {2}\}, \{ wire:/.exec(fs.readFileSync(path.join(root, 'spirit', 'server.js'), 'utf8'));
  const claimed = !!nodeBlock && new RegExp("^ {4}'debug':", 'm').test(nodeBlock[0]);
  if (claimed) test.check('node.debug is mounted in server.js, so the owner door reaches it too');
  else test.fail(OWED + 'node.debug is not mounted in server.js');
  const boot = async function () {
    const port = await freePort();
    const node = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
    const ok = await until(function () { return post(port, { call: 'node.info', args: {} }).then(function (r) { return r.status > 0; }); }, 10000);
    return { port: port, node: node, ok: ok };
  };
  let n = await boot();
  if (!n.ok) test.fail('the node did not boot');
  const r0 = (await post(n.port, { call: 'node.debug', args: { debug: {} } })).body || {};
  const r1 = (await post(n.port, { call: 'node.debug', args: { debug: { on: true } } })).body || {};
  const r2 = (await post(n.port, { call: 'node.debug', args: { debug: {} } })).body || {};
  if (r0.debug === false && r1.debug === true && r2.debug === true) test.check('node.debug reads false, sets true, reads true');
  else test.fail(OWED + 'node.debug answered ' + JSON.stringify([r0, r1, r2]));
  n.node.kill();
  await sleep(500);
  n = await boot();
  const r3 = (await post(n.port, { call: 'node.debug', args: { debug: {} } })).body || {};
  if (r3.debug === false) test.check('after a restart it reads false again: RAM only');
  else test.fail(OWED + 'after a restart node.debug answered ' + JSON.stringify(r3));
  n.node.kill();
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
