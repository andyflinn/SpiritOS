'use strict';

// spirit/test/chatClerverWrite.js
// goal/G4.6 and goal/G4.7: the owner writes a line to a peer — the record begins, the peer is granted, a refusal is
// kept and the line goes again, a blocked key is refused, a held key is released by the first line. RED on today's
// tree: there is no process/js/chatClerver.
//
//   Andy, 2026-10-03, his go-all on goal/G4 and then: "thanks for the diligence: i meant: build it now." The rulings
//   stand verbatim in the boxes of goal/G4.6 and G4.7: "the writers keeps refusals, they are proof that contact was
//   attempted."; "writing to a peer should automatically be a grant to accept an answer, writing to a blocked peer,
//   (marker in peer-table?) should result in an error-peer is blocked, this implies that blocks are bidirectional.";
//   "a node-level-block supersedes app level blocks"; "in this first, faceless version, the use (agents really) need
//   to know the keys."; "release happens when the users sends a message to a held contact, since that will usually
//   be when the chatClerver opens a history for the peer, it can call the node to remove a hold on the contact/peer";
//   "i prefer no are-you-sure."
//
// THE CONTRACT (the boxes of goal/G4.6, G4.7, G4.2 and G4.8; the verbs as the agents agreed them under goal/G4).
// process/js/chatClerver/chatClerver.js, an appServer its node starts (args, --pipe, --state, --node), no core module.
//   1. line.write {to, text, re: {writer, seq}} -> {seq, outcome}: the owner's alone (a member is refused not-owner).
//      to is the peer's key; re names the line answered, both fields empty for none, and travels as given.
//   2. BLOCKED (G4.6): a key the node's book marks blocked (contact.get, person.blocked) is refused peer-blocked;
//      nothing is granted and nothing is posted.
//   3. HELD (G4.7): a key the book marks held (person.held) is first released by contact.accept {publicKey} on the
//      writer's own node; a key not held is not.
//   4. THE GRANT (G4.6): before the line leaves, the writer's node grants the peer chatClerver.line.receive
//      (jobs.authGrant {key, path}); already-granted is no error.
//   5. THE POST (G4.2): one api packet to the peer's key (kernel.peerPost), body {chatClerver: {'line.receive':
//      {seq, at, text, re}}}; seq the writer's own number for this chat, 1, 2, 3 ... per peer; at the writer's UTC
//      time (ISO). The answer {seq, outcome: 'sent'} once the peer kept it.
//   6. REFUSALS ARE KEPT (G4.6): a peer that refuses (its door's not-granted, sealed) leaves the line in the record,
//      outcome 'refused'; the number is used. Once the peer takes lines, the next line.write sends the refused lines
//      again first, in their order, with their own seq and at, then the new one. The record is on disk: a restart of
//      the chatClerver between loses nothing.
//   7. ONE LINE, ONE PACKET (G4.2): a line too large to travel is refused line-too-large; nothing is posted or kept.
// The refusal peer-blocked is a new code in spiritErrors.js (shared, not core), as goal/G3.9 added unblocked; until
// it is defined, appServer answers handler-failed.
// Not asserted, the builder's: the order of the asks to the book; what outcome a no-answer gives; how the record is
// laid out (G4.8's); what the publish carries.
// Not proven: this suite has run only against today's tree (and a scratch stub of the verb, never committed).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G4.6: ';
const OWED7 = 'OWED by goal/G4.7: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = process.env.CHATCLERVER_STUB || path.join(RUN, 'process', 'js', 'chatClerver', 'chatClerver.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const SELF_KEY = 'MCowBQYDK2VwAyEAchatClerverWriteTestSelfAAAAAAAAAAAAA=';
const PEER = 'MCowBQYDK2VwAyEAchatClerverWriteTestPeerAAAAAAAAAAAAA=';
const BLOCKED = 'MCowBQYDK2VwAyEAchatClerverWriteTestBlockedAAAAAAAAAA=';
const HELD = 'MCowBQYDK2VwAyEAchatClerverWriteTestHeldAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const MEMBER = { key: 'MCowBQYDK2VwAyEAchatClerverWriteTestMemberAAAAAAAAAAA=', label: 'somebody' };
const NONE = { writer: '', seq: 0 };

test.startTest('goal/G4.6 and G4.7: the owner writes a line to a peer');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chatclerver-write-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'chatClerver', 'win32', 'process') : path.join(scratch, 'chatClerver.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('chatClerver', pipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ chatClerver: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// THE PRETEND NODE the chatClerver runs on: its contact book, its grants, and its peer.post, whose answer comes back
// down the event stream by re, as a relay brings the peer's answer. `peerAnswers` decides what the peer's door says.
const book = Object.create(null);    // key -> { blocked, held }
const asked = [];                     // every loopback ask, in order: { verb, body }
const posts = [];                     // every peer.post: { to, app, body }
const streams = [];
let peerAnswers = 'kept';             // 'kept' | 'refused'
book[PEER] = { blocked: false, held: false };
book[BLOCKED] = { blocked: true, held: false };
book[HELD] = { blocked: false, held: true };
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
    const json = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    asked.push({ verb: b.verb, body: b });
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (b.verb === 'contact.get') {
      const row = book[String(b.key || '')];
      if (!row) return json(404, { ok: false, error: 'not in the book' });
      return json(200, { ok: true, key: b.key, person: { publicKey: b.key, blocked: row.blocked, held: row.held } });
    }
    if (b.verb === 'contact.accept') {
      const row = book[String(b.publicKey || '')];
      if (!row) return json(404, { ok: false, error: 'no row for that key' });
      row.held = false;
      return json(200, { publicKey: b.publicKey, acquiredVia: 'message', blocked: row.blocked, held: false });
    }
    if (b.verb === 'jobs.authGrant') {
      const granted = asked.filter(function (a) { return a.verb === 'jobs.authGrant' && a.body.key === b.key && a.body.path === b.path; }).length > 1;
      if (granted) return json(409, { ok: false, code: 'already-granted', error: 'already granted' });
      return json(200, { key: b.key, label: 'peer', path: b.path });
    }
    if (b.verb !== 'peer.post') return json(400, { ok: false, code: 'no-such-verb', error: 'the pretend node has no ' + b.verb });
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const hash = 'H' + Date.now() + Math.random();
    posts.push({ to: b.to, app: ask && ask.app, body: ask && ask.body });
    json(200, { ok: true, hash: hash });
    const answer = peerAnswers === 'kept' ? { kept: true } : { ok: false, code: 'not-granted', error: 'not granted to this caller' };
    setTimeout(function () {
      const made = packet.encode('api', answer, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: b.to, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, 30);
  });
});

const kids = [];
function start(nodeUrl) {
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'chatclerver-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }),
  });
  kids.push(kid);
  return kid;
}
async function up() {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.chatClerver && r.body.chatClerver.ok !== false) return r.body.chatClerver; } catch (e) { /* not yet */ }
  }
  return null;
}
function stop(kid) { return new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 2000); }); }
const receives = function (to) { return posts.filter(function (p) { return p.to === to && p.app === 'api' && p.body && p.body.chatClerver && p.body.chatClerver['line.receive']; }).map(function (p) { return p.body.chatClerver['line.receive']; }); };
const write = function (to, text, re) { return call('line.write', { to: to, text: text, re: re || NONE }, OWNER); };
const iso = function (s) { return typeof s === 'string' && !isNaN(Date.parse(s)) && /T.*Z$/.test(s); };

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  let kid = start(nodeUrl);
  const tree = await up() || {};

  test.subHeading('1. the verb line.write, the owner\'s alone');
  const shape = { request: { to: '', text: '', re: { writer: '', seq: 0 } }, reply: { seq: 0, outcome: '' } };
  if (JSON.stringify(tree['line.write'] || null) !== JSON.stringify(shape)) {
    test.fail(OWED + 'the chatClerver answered line.write ' + JSON.stringify(tree['line.write'] || null) + ', where ' + JSON.stringify(shape) + ' is owed');
    ['2. a blocked key', '3. a held key', '4 and 5. the grant and the post', '6. refusals kept, sent again, across a restart', '7. one line, one packet']
      .forEach(function (what) { test.fail(OWED + what + ': there is no chatClerver with line.write'); });
    return;
  }
  test.check('line.write {to, text, re: {writer, seq}} -> {seq, outcome}');
  const theirs = await call('line.write', { to: PEER, text: 'from a member', re: NONE }, MEMBER);
  if (theirs.body && theirs.body.ok === false && theirs.body.code === 'not-owner' && !receives(PEER).length) test.check('a member is refused not-owner, and nothing is posted');
  else test.fail(OWED + 'a member\'s line.write answered ' + JSON.stringify(theirs.body).slice(0, 160));

  test.subHeading('2. a blocked key is refused, nothing granted, nothing posted');
  const blocked = await write(BLOCKED, 'to the blocked one');
  const grantedBlocked = asked.some(function (a) { return a.verb === 'jobs.authGrant' && a.body.key === BLOCKED; });
  if (blocked.body && blocked.body.ok === false && blocked.body.code === 'peer-blocked' && !receives(BLOCKED).length && !grantedBlocked) test.check('refused peer-blocked; no grant, no post');
  else test.fail(OWED + 'to a blocked key: ' + JSON.stringify(blocked.body).slice(0, 160) + '; granted ' + grantedBlocked + ', posted ' + receives(BLOCKED).length);

  test.subHeading('4 and 5. the grant, then the post; seq counts per peer; re travels as given');
  const at0 = asked.length;
  const one = await write(PEER, 'first line');
  const order = asked.slice(at0).map(function (a) { return a.verb; });
  const grant = asked.slice(at0).filter(function (a) { return a.verb === 'jobs.authGrant'; })[0];
  const r1 = receives(PEER)[0] || {};
  if (one.body && one.body.seq === 1 && one.body.outcome === 'sent') test.check('answered {seq: 1, outcome: sent}');
  else test.fail(OWED + 'the first line answered ' + JSON.stringify(one.body).slice(0, 160));
  if (grant && grant.body.key === PEER && grant.body.path === 'chatClerver.line.receive' && order.indexOf('jobs.authGrant') !== -1 && order.indexOf('jobs.authGrant') < order.indexOf('peer.post')) test.check('jobs.authGrant {key: the peer, path: chatClerver.line.receive} was asked before the post');
  else test.fail(OWED + 'the asks in order: ' + JSON.stringify(order) + '; the grant: ' + JSON.stringify(grant && grant.body));
  if (r1.seq === 1 && r1.text === 'first line' && iso(r1.at) && JSON.stringify(r1.re) === JSON.stringify(NONE)) test.check('one api packet to the peer: line.receive {seq: 1, at (UTC), text, re: none}');
  else test.fail(OWED + 'the peer received ' + JSON.stringify(receives(PEER)).slice(0, 200));
  const re = { writer: PEER, seq: 7 };
  const two = await write(PEER, 'second line', re);
  const r2 = receives(PEER)[1] || {};
  if (two.body && two.body.seq === 2 && two.body.outcome === 'sent' && r2.seq === 2 && JSON.stringify(r2.re) === JSON.stringify(re)) test.check('the second line is seq 2, its re carried as given; already-granted was no error');
  else test.fail(OWED + 'the second line answered ' + JSON.stringify(two.body) + ', the peer got ' + JSON.stringify(r2).slice(0, 160));

  test.subHeading('6. a refusal is kept and the line goes again, across a restart');
  peerAnswers = 'refused';
  const three = await write(PEER, 'third line, refused');
  const r3 = receives(PEER)[2] || {};
  if (three.body && three.body.seq === 3 && three.body.outcome === 'refused') test.check('the peer refused it: answered {seq: 3, outcome: refused}');
  else test.fail(OWED + 'the refused line answered ' + JSON.stringify(three.body).slice(0, 160));
  await stop(kid);
  kid = start(nodeUrl);
  await up();
  peerAnswers = 'kept';
  const before = receives(PEER).length;
  const four = await write(PEER, 'fourth line');
  const again = receives(PEER).slice(before);
  if (again.length === 2 && again[0].seq === 3 && again[0].text === 'third line, refused' && again[0].at === r3.at && again[1].seq === 4 && four.body && four.body.seq === 4 && four.body.outcome === 'sent') {
    test.check('after a restart, the next line sent the refused seq 3 again first, its own text and at, then seq 4');
  } else test.fail(OWED + 'after the restart the peer got ' + JSON.stringify(again.map(function (l) { return [l.seq, l.text]; })) + '; line.write answered ' + JSON.stringify(four.body));

  test.subHeading('7. one line, one packet');
  const beforeBig = receives(PEER).length;
  // Past the packet's room (limits.js PAYLOAD_MAX) yet inside what the appServer's door takes, so the chatClerver itself must refuse it.
  const big = await write(PEER, 'x'.repeat(22900));
  const five = await write(PEER, 'fifth line');
  if (big.body && big.body.ok === false && big.body.code === 'line-too-large' && receives(PEER).length === beforeBig + 1 && five.body && five.body.seq === 5) test.check('a line too large is refused line-too-large; nothing posted, no number used');
  else test.fail(OWED + 'the large line answered ' + JSON.stringify(big.body).slice(0, 160) + '; the next seq was ' + JSON.stringify(five.body));

  test.subHeading('3. a held key is released by the first line (goal/G4.7)');
  const at1 = asked.length;
  const held = await write(HELD, 'to the one who knocked');
  const seq = asked.slice(at1).map(function (a) { return a.verb; });
  const accepted = asked.slice(at1).filter(function (a) { return a.verb === 'contact.accept'; })[0];
  if (held.body && held.body.outcome === 'sent' && accepted && accepted.body.publicKey === HELD && seq.indexOf('contact.accept') < seq.indexOf('jobs.authGrant') && seq.indexOf('jobs.authGrant') < seq.indexOf('peer.post')) {
    test.check('contact.accept {publicKey}, then the grant, then the post; answered sent');
  } else test.fail(OWED7 + 'to a held key the asks were ' + JSON.stringify(seq) + '; answered ' + JSON.stringify(held.body).slice(0, 120));
  if (!asked.slice(at0, at1).some(function (a) { return a.verb === 'contact.accept'; })) test.check('no contact.accept was asked for a key that was not held');
  else test.fail(OWED7 + 'contact.accept was asked for a key that was not held');
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
