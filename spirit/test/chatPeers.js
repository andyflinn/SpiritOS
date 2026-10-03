'use strict';

// spirit/test/chatPeers.js
// goal/G4.3: bucket 1, the peer list — peers.search over the chatClerver's memory. RED on today's tree: the
// chatClerver (process/js/chatClerver/chatClerver.js) has no verb peers.search.
//
//   Andy, 2026-10-03, on the suggestions in the box of goal/G4.3: "agreed."; of the pane: "the left/peer pane is a
//   search box at the top to populate a list below, where peers with a chat-record remain sticky?"; "unanswered count
//   (45) in peer/contact row? yes."; and (G4.7) "a blocked contact should not be offered to the chatter user at all."
//   His Go is his go-all on goal/G4.
//
// THE CONTRACT (the box of goal/G4.3, decided 1 to 4; the names and the shapes the box left open are wsl-claude's,
// fixed here and named).
//   1. peers.search {text, since, before} -> {items: [{key, label}], more}: the owner's alone (a member is refused
//      not-owner: the peer list is this node's memory). key is the peer's key; label one row as JSON.
//   2. The row: {peer, at, sent, seq, unanswered} — at, sent and seq are those of the newest line between this node
//      and the peer (by at, the writer's time, the order G4.1 decided); unanswered counts the peer's lines that
//      arrived after the newest line this node sent, by this node's own clock (receivedAt against the sent line's at,
//      both written here, so no peer's clock decides it), every received line when none was sent. No label.
//   3. Newest first, by the row's at. text is found in the peer's key; since keeps peers whose newest line is at
//      or after it, before those whose newest line is earlier than it; an empty filter filters nothing.
//   4. A peer is a row only once a line crossed: a peers row with no line is no row. A key the node's contact book
//      marks blocked (contact.get, person.blocked) is no row at all.
//   5. Bounded: as many rows as fit one answer, more when some did not; nothing pages, before brings older ones.
//   6. A read: it writes nothing to memory.db.
// The suite writes its rows straight into memory.db, the tables of goal/G4.8, because line.receive is goal/G4.2's
// and not built yet; the search must read what is there.
// Not asserted, the builder's: the order among rows of the same at; what a node that does not answer contact.get does
// to the search.
// Not proven: this suite has run only against today's tree and a scratch stub of the verb, never committed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.3: ';
const SERVER = process.env.CHATCLERVER_STUB || path.join(__dirname, '..', 'run', 'process', 'js', 'chatClerver', 'chatClerver.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const key = function (tag) { return 'MCowBQYDK2VwAyEAchatPeers' + tag + 'A'.repeat(Math.max(0, 29 - tag.length)) + '='; };
const SELF = key('Self');
const OWNER = { owner: true, key: SELF, label: 'me' };
const MEMBER = { key: key('Member'), label: 'somebody' };
const ANN = key('Ann');
const BOB = key('Bob');
const CAT = key('Cat');
const BLOCKED = key('Blocked');
const QUIET = key('Quiet');
const NONE = { text: '', since: '', before: '' };

test.startTest('goal/G4.3: peers.search, the peer list');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chatpeers-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'chatClerver', 'win32', 'process') : path.join(scratch, 'chat.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('chatClerver', pipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ chatClerver: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// The pretend node: its contact book alone, which marks BLOCKED blocked.
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const json = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (b.verb === 'contact.get') return json(200, { ok: true, key: b.key, person: { publicKey: b.key, blocked: b.key === BLOCKED, held: false } });
    return json(400, { ok: false, code: 'no-such-verb', error: 'the pretend node has no ' + b.verb });
  });
});

async function find(f, caller) {
  const r = await call('peers.search', Object.assign({}, NONE, f), caller || OWNER);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  const rows = items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } });
  return { status: r.status, body: r.body, keys: items.map(function (p) { return p.key; }), rows: rows, more: (r.body || {}).more,
    bytes: Buffer.byteLength(JSON.stringify(r.body || null), 'utf8') };
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'me', publicKey: SELF })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'chatpeers-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }),
  });
  let tree = null;
  for (let i = 0; i < 60 && !tree; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.chatClerver && r.body.chatClerver.ok !== false) tree = r.body.chatClerver; } catch (e) { /* not yet */ }
  }
  try {
    test.subHeading('1. the verb');
    const shape = { request: { text: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false } };
    if (!tree || JSON.stringify(tree['peers.search'] || null) !== JSON.stringify(shape)) {
      test.fail(OWED + 'the chatClerver answered peers.search ' + JSON.stringify(tree && tree['peers.search'] || null) + ', where ' + JSON.stringify(shape) + ' is owed');
      ['2. the row', '3. order and filters', '4. who is a row', '5. bounded', '6. a read'].forEach(function (w) { test.fail(OWED + w + ': no peers.search'); });
      return;
    }
    test.check('peers.search {text, since, before} -> {items: [{key, label}], more}');

    // The memory: ANN wrote twice after my one line; BOB I wrote to last; CAT only wrote; BLOCKED has lines; QUIET
    // has a peers row and no line.
    const db = new DatabaseSync(path.join(state, 'memory.db'));
    db.exec('PRAGMA busy_timeout=5000');
    const peer = db.prepare('INSERT INTO peers (peer, highestSent, highestReceived, bornAt) VALUES (?, ?, ?, ?)');
    const line = db.prepare("INSERT INTO lines (peer, sent, seq, at, text, receivedAt, reWriter, reSeq, refused, refusedAt) VALUES (?, ?, ?, ?, ?, ?, '', 0, '', '')");
    peer.run(ANN, 1, 3, '2026-10-03T10:00:00.000Z');
    line.run(ANN, 0, 1, '2026-10-03T10:00:00.000Z', 'ann one', '2026-10-03T10:00:01.000Z');
    line.run(ANN, 1, 1, '2026-10-03T10:05:00.000Z', 'me to ann', '');
    line.run(ANN, 0, 2, '2026-10-03T10:06:00.000Z', 'ann two', '2026-10-03T10:06:01.000Z');
    line.run(ANN, 0, 3, '2026-10-03T10:20:00.000Z', 'ann three', '2026-10-03T10:20:01.000Z');
    peer.run(BOB, 2, 1, '2026-10-03T09:00:00.000Z');
    line.run(BOB, 0, 1, '2026-10-03T09:00:00.000Z', 'bob one', '2026-10-03T09:00:01.000Z');
    line.run(BOB, 1, 1, '2026-10-03T09:10:00.000Z', 'me to bob', '');
    line.run(BOB, 1, 2, '2026-10-03T10:10:00.000Z', 'me to bob again', '');
    peer.run(CAT, 0, 2, '2026-10-03T08:00:00.000Z');
    line.run(CAT, 0, 1, '2026-10-03T08:00:00.000Z', 'cat one', '2026-10-03T08:00:02.000Z');
    line.run(CAT, 0, 2, '2026-10-03T08:30:00.000Z', 'cat two', '2026-10-03T08:30:02.000Z');
    peer.run(BLOCKED, 0, 1, '2026-10-03T11:00:00.000Z');
    line.run(BLOCKED, 0, 1, '2026-10-03T11:00:00.000Z', 'blocked one', '2026-10-03T11:00:01.000Z');
    peer.run(QUIET, 0, 0, '2026-10-03T07:00:00.000Z');
    const changes0 = db.prepare('SELECT COUNT(*) AS n FROM lines').get().n + ':' + db.prepare('SELECT COUNT(*) AS n FROM peers').get().n;

    const member = await call('peers.search', NONE, MEMBER);
    if (member.body && member.body.ok === false && member.body.code === 'not-owner') test.check('a member is refused not-owner');
    else test.fail(OWED + 'a member\'s peers.search answered ' + JSON.stringify(member.body).slice(0, 120));

    test.subHeading('2. the row');
    const all = await find({});
    const byKey = {};
    all.rows.forEach(function (r) { if (r && r.peer) byKey[r.peer] = r; });
    const ann = byKey[ANN] || {}; const bob = byKey[BOB] || {}; const cat = byKey[CAT] || {};
    if (ann.at === '2026-10-03T10:20:00.000Z' && ann.sent === 0 && ann.seq === 3 && ann.unanswered === 2) test.check('ANN: newest line hers, seq 3; two of hers came after my last line');
    else test.fail(OWED + 'ANN\'s row: ' + JSON.stringify(ann));
    if (bob.at === '2026-10-03T10:10:00.000Z' && bob.sent === 1 && bob.seq === 2 && bob.unanswered === 0) test.check('BOB: newest line mine, seq 2; nothing unanswered');
    else test.fail(OWED + 'BOB\'s row: ' + JSON.stringify(bob));
    if (cat.unanswered === 2 && cat.sent === 0 && cat.seq === 2) test.check('CAT: I never wrote, so both of hers are unanswered');
    else test.fail(OWED + 'CAT\'s row: ' + JSON.stringify(cat));
    const labelled = all.rows.filter(function (r) { return Object.keys(r || {}).some(function (k) { return /label/i.test(k); }); });
    if (all.rows.length && !labelled.length && all.keys.every(function (k, i) { return all.rows[i].peer === k; })) test.check('each key is the row\'s peer, and no row carries a label');
    else test.fail(OWED + 'keys ' + JSON.stringify(all.keys) + ', rows with a label ' + labelled.length);

    test.subHeading('3. newest first; text, since, before');
    if (all.keys.join() === [ANN, BOB, CAT].join()) test.check('nothing set: ANN, BOB, CAT, newest line first');
    else test.fail(OWED + 'nothing set answered ' + JSON.stringify(all.keys));
    const byText = await find({ text: 'chatPeersBo' });
    if (byText.keys.join() === BOB) test.check('text found in the key: BOB alone');
    else test.fail(OWED + 'text answered ' + JSON.stringify(byText.keys));
    const since = await find({ since: '2026-10-03T10:10:00.000Z' });
    if (since.keys.join() === [ANN, BOB].join()) test.check('since 10:10: the peers whose newest line is at or after it');
    else test.fail(OWED + 'since answered ' + JSON.stringify(since.keys));
    const before = await find({ before: '2026-10-03T10:10:00.000Z' });
    if (before.keys.join() === CAT) test.check('before 10:10: the peers whose newest line is earlier');
    else test.fail(OWED + 'before answered ' + JSON.stringify(before.keys));

    test.subHeading('4. who is a row');
    if (!byKey[BLOCKED] && !byKey[QUIET]) test.check('the blocked key is no row, and a peers row with no line is no row');
    else test.fail(OWED + 'blocked shown ' + !!byKey[BLOCKED] + ', the peer with no line shown ' + !!byKey[QUIET]);

    test.subHeading('5. bounded');
    for (let i = 0; i < 300; i++) {
      const k = key('Many' + i);
      peer.run(k, 0, 1, '2026-10-02T00:00:00.000Z');
      line.run(k, 0, 1, '2026-10-02T' + String(Math.floor(i / 60)).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0') + ':00.000Z', 'many', '2026-10-02T23:59:00.000Z');
    }
    const many = await find({});
    if (many.status === 200 && many.more === true && many.keys.length > 3 && many.keys.length < 303 && many.bytes <= appClient.ANSWER_MAX && many.keys[0] === ANN) test.check('303 peers: ' + many.keys.length + ' came back in ' + many.bytes + ' bytes, newest first, more true');
    else test.fail(OWED + '303 peers answered ' + many.status + ', ' + many.keys.length + ' rows, ' + many.bytes + ' bytes, more ' + many.more);

    test.subHeading('6. a read');
    const counts = function () { return (db.prepare('SELECT COUNT(*) AS n FROM lines').get().n - 300) + ':' + (db.prepare('SELECT COUNT(*) AS n FROM peers').get().n - 300); };
    if (counts() === changes0) test.check('the searches wrote nothing to memory.db');
    else test.fail(OWED + 'memory.db changed across the searches: ' + changes0 + ' -> ' + counts());
    db.close();
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
  }
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
