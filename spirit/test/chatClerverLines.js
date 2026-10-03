'use strict';

// spirit/test/chatClerverLines.js
// goal/G4.2: the chat lines — a peer's line received, one chat read, every kept line published — and the writing half
// made sound (line.write's three faults found in review of goal/G4.6). RED on today's tree: the chatClerver has
// line.write only.
//
//   Andy, 2026-10-03 (the box of goal/G4.2, verbatim there): "the write is fine with me"; "can we keep the paging back
//   in the chat window out of this level of design?"; "appServer.publish, two objects per arrival, the answered line
//   FIRST, then the received line."; "yes. That's why the answered line and the received line must be streamed to the
//   UI separately."; "and the chatClerver is the one who knows what an incoming message may miss, in terms of what it
//   refers to."; and, the design ended, "i meant: build it now." His Go is his go-all on goal/G4. The three faults of
//   line.write were found by claude-windows in review of goal/G4.6, confirmed by wsl-claude, and belong to G4.2's box,
//   which decided the write (wsl-claude, under goal/G4).
//
// THE CONTRACT (claude-windows's shapes where the box names none; wsl-claude builds). process/js/chatClerver, no core.
//   A. line.receive {seq, at, text, re: {writer, seq}} -> {kept}: called by a peer's chatClerver; the writer is the
//      caller's key (a caller with no key is refused). The line is kept as received (sent 0, receivedAt this node's
//      UTC time); the peer's row is born by its first line and keeps the highest seq received. The same line again (a
//      resend after a lost answer) is answered kept and kept once.
//   B. chat.read {peer, before} -> {items: [{key, label}], more}: the owner's alone. The lines of that one chat, both
//      ways, newest first by the writer's time; each label {sent, seq, at, text, receivedAt, re, refused}; before
//      keeps only lines older than it; one bounded answer in half the room (as chat.search), cut with more. No paging.
//   C. THE PUBLISH. Every kept line, written or received, is published (appServer.publish), {line: {peer, sent, seq,
//      at, text, receivedAt, re, refused}}. A received line that names a re this record holds is two publishes, the
//      answered line and the received line; one whose re this record lacks carries missing: {writer, seq} instead.
//      (The order of the two is the server's to keep; a page places lines by their data, so this suite does not
//      measure arrival order.)
//   D. line.write, sound:
//      1. It answers within 10 s (a node gives a server 12 s, appClient.js DOOR_WAIT_MS): a peer that has not answered
//         by then gets {seq, outcome: 'pending'}, and the line stays unsent until the peer keeps it, when its refusal
//         mark clears.
//      2. Two writes to one peer at the same moment take two numbers.
//      3. A node that does not answer the block check, or refuses the grant (already-granted aside), refuses the
//         write: nothing is kept, nothing posted.
// Not asserted, the builder's: the refusal codes in D3; the order of the two publishes; what a pending line's mark
// reads while it waits.
// Not proven: this suite has run only against today's tree.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G4.2: ';
const SERVER = process.env.CHATCLERVER_STUB || path.join(__dirname, '..', 'run', 'process', 'js', 'chatClerver', 'chatClerver.js');
const HALF_ROOM = Math.floor((appClient.ANSWER_MAX - 512) / 2);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const SELF_KEY = 'MCowBQYDK2VwAyEAchatClerverLinesTestSelfAAAAAAAAAAAAA=';
const PEER = 'MCowBQYDK2VwAyEAchatClerverLinesTestPeerAAAAAAAAAAAAA=';
const SLOW = 'MCowBQYDK2VwAyEAchatClerverLinesTestSlowAAAAAAAAAAAAA=';
const TWIN = 'MCowBQYDK2VwAyEAchatClerverLinesTestTwinAAAAAAAAAAAAA=';
const DARK = 'MCowBQYDK2VwAyEAchatClerverLinesTestDarkAAAAAAAAAAAAA=';
const NOGRANT = 'MCowBQYDK2VwAyEAchatClerverLinesTestNoGrantAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const FROM_PEER = { key: PEER, label: 'the peer' };
const NONE = { writer: '', seq: 0 };

test.startTest('goal/G4.2: the chat lines — received, read, published — and line.write made sound');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chatclerver-lines-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'chatClerver', 'win32', 'process') : path.join(scratch, 'chatClerver.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('chatClerver', pipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ chatClerver: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// THE PRETEND NODE, as chatClerverWrite.js builds it, with a peer that can be slow, a node that cannot answer the book
// for one key, a grant that fails for another, and the publishes the server reports (jobs.update {app}).
const posts = [];
const published = [];
const streams = [];
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
    if (b.verb === 'jobs.update') { if (b.app) published.push(b.app); return json(200, { ok: true }); }
    if (b.verb === 'contact.get') {
      if (b.key === DARK) return json(500, { ok: false, error: 'the node broke' });
      return json(200, { ok: true, key: b.key, person: { publicKey: b.key, blocked: false, held: false } });
    }
    if (b.verb === 'jobs.authGrant') {
      if (b.key === NOGRANT) return json(500, { ok: false, code: 'store-failed', error: 'the grant was not kept' });
      return json(200, { key: b.key, label: 'peer', path: b.path });
    }
    if (b.verb !== 'peer.post') return json(400, { ok: false, code: 'no-such-verb' });
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const hash = 'H' + Date.now() + Math.random();
    posts.push({ to: b.to, body: ask && ask.body });
    json(200, { ok: true, hash: hash });
    setTimeout(function () {
      const made = packet.encode('api', { kept: true }, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: b.to, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, b.to === SLOW ? 16000 : 30);
  });
});

const kids = [];
async function up() {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.chatClerver && r.body.chatClerver.ok !== false) return r.body.chatClerver; } catch (e) { /* not yet */ }
  }
  return null;
}
async function read(peer, before) {
  const r = await call('chat.read', { peer: peer, before: before || '' }, OWNER);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  return { status: r.status, body: r.body, more: (r.body || {}).more, lines: items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } }),
    bytes: Buffer.byteLength(JSON.stringify(r.body || null), 'utf8') };
}
const receive = function (seq, text, re, at) { return call('line.receive', { seq: seq, at: at || new Date().toISOString(), text: text, re: re || NONE }, FROM_PEER); };
const posted = function (to) { return posts.filter(function (p) { return p.to === to; }); };
const pubOf = function (sent, seq, peer) { return published.filter(function (o) { return o && o.line && o.line.sent === sent && o.line.seq === seq && o.line.peer === (peer || PEER); }); };

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'chatclerver-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }),
  }));
  const tree = await up() || {};

  test.subHeading('A. line.receive: a peer\'s line kept, once');
  const recvShape = { request: { seq: 0, at: '', text: '', re: { writer: '', seq: 0 } }, reply: { kept: true } };
  const readShape = { request: { peer: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false } };
  if (JSON.stringify(tree['line.receive'] || null) !== JSON.stringify(recvShape) || JSON.stringify(tree['chat.read'] || null) !== JSON.stringify(readShape)) {
    test.fail(OWED + 'the chatClerver answered line.receive ' + JSON.stringify(tree['line.receive'] || null) + ' and chat.read ' + JSON.stringify(tree['chat.read'] || null));
    ['A. received, kept once', 'B. one chat read', 'C. the publish', 'D1. answered within 10 s', 'D2. two writes, two numbers', 'D3. a dark node or a failed grant refuses']
      .forEach(function (w) { test.fail(OWED + w + ': no line.receive or chat.read'); });
    return;
  }
  test.check('line.receive {seq, at, text, re} -> {kept}; chat.read {peer, before} -> {items, more}');
  // The owner writes first, so a received line can answer it.
  const w1 = await call('line.write', { to: PEER, text: 'mine, first', re: NONE }, OWNER);
  const r1 = await receive(1, 'theirs, answering yours', { writer: SELF_KEY, seq: 1 });
  const again = await receive(1, 'theirs, answering yours', { writer: SELF_KEY, seq: 1 });
  const nokey = await call('line.receive', { seq: 9, at: new Date().toISOString(), text: 'from nobody', re: NONE }, { owner: true });
  const chat = await read(PEER);
  const theirs = chat.lines.filter(function (l) { return l.sent === 0; });
  if (r1.body && r1.body.kept === true && again.body && again.body.kept === true && theirs.length === 1 && theirs[0].seq === 1 && theirs[0].receivedAt && theirs[0].text === 'theirs, answering yours') {
    test.check('kept with receivedAt; the same line again answered kept and kept once');
  } else test.fail(OWED + 'receive answered ' + JSON.stringify(r1.body) + ' then ' + JSON.stringify(again.body) + '; their lines: ' + JSON.stringify(theirs).slice(0, 200));
  if (nokey.body && nokey.body.ok === false && !chat.lines.some(function (l) { return l.text === 'from nobody'; })) test.check('a caller with no key is refused, and nothing is kept');
  else test.fail(OWED + 'a keyless line.receive answered ' + JSON.stringify(nokey.body).slice(0, 120));

  test.subHeading('B. chat.read: both ways, newest first, the owner\'s alone, bounded');
  if (w1.body && w1.body.seq === 1 && chat.lines.length === 2 && chat.lines[0].sent === 0 && chat.lines[1].sent === 1 && JSON.stringify(chat.lines[0].re) === JSON.stringify({ writer: SELF_KEY, seq: 1 })) {
    test.check('the two lines of the chat, the newest (theirs, re mine) first');
  } else test.fail(OWED + 'chat.read answered ' + JSON.stringify(chat.lines).slice(0, 240));
  const member = await call('chat.read', { peer: PEER, before: '' }, FROM_PEER);
  if (member.body && member.body.ok === false && member.body.code === 'not-owner') test.check('a member is refused not-owner');
  else test.fail(OWED + 'a member\'s chat.read answered ' + JSON.stringify(member.body).slice(0, 120));
  const base = Date.parse('2026-10-03T12:00:00.000Z');
  for (let i = 0; i < 60; i++) await receive(10 + i, 'long line ' + i + ' ' + 'x'.repeat(200), NONE, new Date(base + i * 1000).toISOString());
  const full = await read(PEER);
  const oldest = full.lines[full.lines.length - 1] || {};
  const older = await read(PEER, oldest.at);
  if (full.more === true && full.bytes <= HALF_ROOM && full.lines.length > 0 && older.lines.length > 0 && older.lines.every(function (l) { return l.at < oldest.at; })) {
    test.check('62 lines: ' + full.lines.length + ' in ' + full.bytes + ' bytes (half the room is ' + HALF_ROOM + '), more true; before brings older ones only');
  } else test.fail(OWED + 'the long chat answered ' + full.lines.length + ' lines, ' + full.bytes + ' bytes, more ' + full.more + '; before gave ' + older.lines.length);

  test.subHeading('C. the publish');
  await sleep(300);
  const mine = pubOf(1, 1);
  const theirsPub = pubOf(0, 1);
  if (mine.length >= 2 && theirsPub.length >= 1) test.check('the written line was published when kept, and again beside the received line that answers it');
  else test.fail(OWED + 'publishes of my line ' + mine.length + ', of theirs ' + theirsPub.length + ': ' + JSON.stringify(published).slice(0, 200));
  await receive(80, 'answering a line I never got', { writer: PEER, seq: 5 });
  await sleep(300);
  const lacking = pubOf(0, 80)[0];
  if (lacking && JSON.stringify(lacking.missing) === JSON.stringify({ writer: PEER, seq: 5 })) test.check('a received line whose re this record lacks is published with missing: {writer, seq}');
  else test.fail(OWED + 'the line with an unknown re was published as ' + JSON.stringify(lacking || null).slice(0, 200));

  test.subHeading('D1. line.write answers within 10 s');
  const t0 = Date.now();
  const slow = await call('line.write', { to: SLOW, text: 'to a slow peer', re: NONE }, OWNER);
  const ms = Date.now() - t0;
  if (slow.body && slow.body.seq === 1 && slow.body.outcome === 'pending' && ms < 11000) test.check('a peer silent past 10 s: answered {seq: 1, outcome: pending} after ' + ms + ' ms');
  else test.fail(OWED + 'to a slow peer line.write answered ' + JSON.stringify(slow.body).slice(0, 120) + ' after ' + ms + ' ms');
  await sleep(8000);
  const slowChat = await read(SLOW);
  if (slowChat.lines.length === 1 && slowChat.lines[0].refused === '') test.check('when the slow peer kept it, the line\'s mark cleared');
  else test.fail(OWED + 'after the slow peer answered, the line reads ' + JSON.stringify(slowChat.lines).slice(0, 160));

  test.subHeading('D2. two writes to one peer at once take two numbers');
  const both = await Promise.all([
    call('line.write', { to: TWIN, text: 'one', re: NONE }, OWNER),
    call('line.write', { to: TWIN, text: 'two', re: NONE }, OWNER),
  ]);
  const seqs = both.map(function (r) { return r.body && r.body.seq; }).sort();
  if (seqs[0] === 1 && seqs[1] === 2 && both.every(function (r) { return r.body && r.body.outcome === 'sent'; })) test.check('seq 1 and seq 2, both sent');
  else test.fail(OWED + 'two writes at once answered ' + JSON.stringify(both.map(function (r) { return r.body; })).slice(0, 200));

  test.subHeading('D3. a node that cannot check, or will not grant, refuses the write');
  const dark = await call('line.write', { to: DARK, text: 'unchecked', re: NONE }, OWNER);
  const nogrant = await call('line.write', { to: NOGRANT, text: 'ungranted', re: NONE }, OWNER);
  const darkChat = await read(DARK);
  const noChat = await read(NOGRANT);
  if (dark.body && dark.body.ok === false && !posted(DARK).length && !darkChat.lines.length) test.check('the block check unanswered: refused, nothing kept, nothing posted');
  else test.fail(OWED + 'with the book dark line.write answered ' + JSON.stringify(dark.body).slice(0, 120) + '; posted ' + posted(DARK).length + ', kept ' + darkChat.lines.length);
  if (nogrant.body && nogrant.body.ok === false && !posted(NOGRANT).length && !noChat.lines.length) test.check('the grant refused: refused, nothing kept, nothing posted');
  else test.fail(OWED + 'with the grant refused line.write answered ' + JSON.stringify(nogrant.body).slice(0, 120) + '; posted ' + posted(NOGRANT).length + ', kept ' + noChat.lines.length);
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
