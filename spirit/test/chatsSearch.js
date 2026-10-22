'use strict';

// spirit/test/chatsSearch.js
// goal/G29.18: chatClerver and chatter cleaned up — chats.search in place of peers.search, chat.search for one chat's
// lines, both lists off the old graded bucket. Red on today's tree; claude-windows writes it and builds it (one agent).
// The item's box (v3):
//   - peers.search becomes chats.search: which peers have a chat, the newest line, the unanswered count; keys and chat
//     facts only. No arguments: text matched part of a key, and keys are never searched; since and before go. A chat
//     is revived by finding the person by name (contact.search) and opening it; chat.read reads it from memory.db.
//   - chats.search and chat.read leave the old graded bucket: newest first, cut by bytes,
//     through the probability bucket's serialize.
//   - A new verb, chat.search {peer, text}: that chat's lines ranked by the probability modules, newest first on a
//     tie, cut by bytes. The chat window searches with it. chatClerver no longer requires the old graded search.
//   - chatter asks chats.search with no arguments; its chat window has a search over its own lines, through chat.search.
// It replaces goal/G4.3's chatPeers.js, whose peers.search it removes: the row, the blocked rule, the bound and the
// read are asserted here instead.
// NAMED HERE where the box names none: chat.search answers {items: [{key: sent + ':' + seq, label: the line as json}],
// more}, as chat.read does; a line that does not match is left out; the owner's alone.
// rule/11: through testSupport only; its own scratch folder and pipe; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.18: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'chatClerver', 'chatClerver.js');
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const key = function (tag) { return 'MCowBQYDK2VwAyEAchatsSearch' + tag + 'A'.repeat(Math.max(0, 32 - tag.length)) + '='; }; // 43 characters, a real key's length (the spirit object checks it, goal/G32.3)
const SELF = key('Self');
const OWNER = { owner: true, key: SELF, label: 'me' };
const MEMBER = { key: key('Member'), label: 'somebody' };
const ANN = key('Ann');
const BOB = key('Bob');
const CAT = key('Cat');
const BLOCKED = key('Blocked');
const QUIET = key('Quiet');

test.startTest('goal/G29.18: chats.search and chat.search in chatClerver, off the old graded bucket');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chatssearch-'));
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
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (b.verb === 'contact.get') return json(200, { ok: true, key: b.key, person: { publicKey: b.key, blocked: b.key === BLOCKED, held: false } });
    return json(400, { ok: false, code: 'no-such-verb', error: 'the pretend node has no ' + b.verb });
  });
});
function listed(r) {
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  return { status: r.status, body: r.body, keys: items.map(function (p) { return p.key; }),
    rows: items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } }), more: (r.body || {}).more,
    bytes: Buffer.byteLength(JSON.stringify(r.body || null), 'utf8') };
}

async function main() {
  test.subHeading('0. the code: no peers.search, no graded bucket; chatter asks the new verbs');
  const clerver = code('process/js/chatClerver/chatClerver.js');
  if (!/'peers\.search'/.test(clerver) && /'chats\.search'/.test(clerver) && /'chat\.search'/.test(clerver)) test.check('chatClerver serves chats.search and chat.search, and no peers.search');
  else test.fail(OWED + 'chatClerver\'s verbs are not chats.search and chat.search in place of peers.search');
  if (!/searchBucket/.test(clerver) && /probabilityBucket/.test(clerver)) test.check('chatClerver requires no searchBucket; its lists go through the probability bucket');
  else test.fail(OWED + 'chatClerver still uses searchBucket, or not the probability bucket');
  const chatter = code('shell/chatter/chatter.js');
  if (!/'peers\.search'/.test(chatter) && /'chats\.search',\s*\{\s*\}/.test(chatter)) test.check('chatter asks chats.search with no arguments');
  else test.fail(OWED + 'chatter does not ask chats.search {}');
  if (/'chat\.search',\s*\{\s*peer:[^}]*who:/.test(chatter)) test.check('chatter\'s chat window searches its lines through chat.search {peer, text, who}');
  else test.fail(OWED + 'chatter has no search over a chat\'s lines');
  // A DROPDOWN WHOSE PICK IS A LINE IN THE HISTORY (Andy, 2026-10-18): put in by time when missing, then current.
  const chatSearchList = (/chSearch = window\.spirit.elements\.shellCreateListSearch\([\s\S]*?\n {4}\}\);/.exec(chatter) || [''])[0];
  if (/mode:\s*'dropdown'/.test(chatSearchList) && /pick:\s*function \(l\) \{[\s\S]*chUpsert\(l\);[\s\S]*chSetCurrent\(chKey\(l\.sent, l\.seq\)\)/.test(chatSearchList)) test.check('the chat search is a dropdown; a picked line is put into the history when missing (chUpsert) and becomes the current line');
  else test.fail(OWED + 'the chat search is not a dropdown whose pick puts the line in and makes it current');
  // EVERY LINE FOUND JOINS THE HISTORY (Andy, 2026-10-18: "all found lines are added to the chat, if they're missing").
  if (/chItemsToLines\(\(b && b\.items\) \|\| \[\]\)[\s\S]{0,120}chUpsert\(l\)/.test(chatSearchList)) test.check('every line a search finds is put into the history when missing');
  else test.fail(OWED + 'the lines a search finds are not put into the history');
  if (/chAsk\('chat\.read', \{ peer: peer, before: String\(l\.at[^}]*after: '' \}\)[\s\S]{0,200}chAsk\('chat\.read', \{ peer: peer, before: '', after: String\(l\.at/.test(chatSearchList)) test.check('a pick asks the line right before it and the line right after, one after the other');
  else test.fail(OWED + 'a pick does not bring the lines around it');
  if (!fs.existsSync(path.join(__dirname, 'chatPeers.js'))) test.check('goal/G4.3\'s chatPeers.js is retired; this suite holds its checks');
  else test.fail(OWED + 'spirit/test/chatPeers.js still asserts peers.search');

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'me', publicKey: SELF })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'chatssearch-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }),
  });
  let tree = null;
  for (let i = 0; i < 60 && !tree; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.chatClerver && r.body.chatClerver.ok !== false) tree = r.body.chatClerver; } catch (e) { /* not yet */ }
  }
  try {
    test.subHeading('1. the verbs');
    const listShape = { request: {}, reply: { items: [{ key: '', label: '' }], more: false } };
    const searchShape = { request: { peer: '', text: '', who: '' }, reply: { items: [{ key: '', label: '' }], more: false } };
    if (tree && JSON.stringify(tree['chats.search'] || null) === JSON.stringify(listShape)) test.check('chats.search {} -> {items: [{key, label}], more}');
    else test.fail(OWED + 'chats.search is ' + JSON.stringify(tree && tree['chats.search'] || null));
    if (tree && JSON.stringify(tree['chat.search'] || null) === JSON.stringify(searchShape)) test.check('chat.search {peer, text, who} -> {items: [{key, label}], more}');
    else test.fail(OWED + 'chat.search is ' + JSON.stringify(tree && tree['chat.search'] || null));
    if (tree && JSON.stringify((tree['chat.read'] || {}).request || null) === JSON.stringify({ peer: '', before: '', after: '' })) test.check('chat.read takes {peer, before, after} (Andy: "chat.read gains after")');
    else test.fail('chat.read changed: ' + JSON.stringify(tree && tree['chat.read'] || null));

    const db = new DatabaseSync(path.join(state, 'memory.db'));
    db.exec('PRAGMA busy_timeout=5000');
    const peer = db.prepare('INSERT INTO peers (peer, highestSent, highestReceived, bornAt) VALUES (?, ?, ?, ?)');
    const line = db.prepare("INSERT INTO lines (peer, sent, seq, at, text, receivedAt, reWriter, reSeq, refused, refusedAt) VALUES (?, ?, ?, ?, ?, ?, '', 0, '', '')");
    peer.run(ANN, 1, 3, '2026-10-03T10:00:00.000Z');
    line.run(ANN, 0, 1, '2026-10-03T10:00:00.000Z', 'ann one about the harbour', '2026-10-03T10:00:01.000Z');
    line.run(ANN, 1, 1, '2026-10-03T10:05:00.000Z', 'me to ann, the boat', '');
    line.run(ANN, 0, 2, '2026-10-03T10:06:00.000Z', 'ann two, harbour again', '2026-10-03T10:06:01.000Z');
    line.run(ANN, 0, 3, '2026-10-03T10:20:00.000Z', 'ann three, the weather', '2026-10-03T10:20:01.000Z');
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
    const counts0 = db.prepare('SELECT COUNT(*) AS n FROM lines').get().n + ':' + db.prepare('SELECT COUNT(*) AS n FROM peers').get().n;

    test.subHeading('2. chats.search: the chats, newest first, the blocked and the silent left out');
    const member = await call('chats.search', {}, MEMBER);
    if (member.body && member.body.ok === false && member.body.code === 'not-owner') test.check('a member is refused not-owner');
    else test.fail(OWED + 'a member\'s chats.search answered ' + JSON.stringify(member.body).slice(0, 120));
    const all = listed(await call('chats.search', {}, OWNER));
    const byKey = {};
    all.rows.forEach(function (r) { if (r && r.peer) byKey[r.peer] = r; });
    const ann = byKey[ANN] || {}; const bob = byKey[BOB] || {}; const cat = byKey[CAT] || {};
    if (all.keys.join() === [ANN, BOB, CAT].join()) test.check('ANN, BOB, CAT: newest line first');
    else test.fail(OWED + 'chats.search answered ' + JSON.stringify(all.keys));
    if (ann.at === '2026-10-03T10:20:00.000Z' && ann.sent === 0 && ann.seq === 3 && ann.unanswered === 2 && bob.unanswered === 0 && cat.unanswered === 2) test.check('each row: its newest line and its unanswered count (ANN 2, BOB 0, CAT 2)');
    else test.fail(OWED + 'rows ' + JSON.stringify([ann, bob, cat]));
    if (all.rows.length && !byKey[BLOCKED] && !byKey[QUIET]) test.check('the blocked key is no row, and a peer with no line is no row');
    else test.fail(OWED + 'blocked shown ' + !!byKey[BLOCKED] + ', the peer with no line shown ' + !!byKey[QUIET]);
    const labelled = all.rows.filter(function (r) { return Object.keys(r || {}).some(function (k) { return /label|name/i.test(k); }); });
    if (all.rows.length && !labelled.length) test.check('keys and chat facts only: no row carries a name');
    else test.fail(OWED + labelled.length + ' rows carry a name');

    test.subHeading('3. chat.search: one chat\'s lines, ranked by the words, newest first on a tie');
    const memberSearch = await call('chat.search', { peer: ANN, text: 'harbour', who: '' }, MEMBER);
    if (memberSearch.body && memberSearch.body.ok === false && memberSearch.body.code === 'not-owner') test.check('a member is refused not-owner');
    else test.fail(OWED + 'a member\'s chat.search answered ' + JSON.stringify(memberSearch.body).slice(0, 120));
    const harbour = listed(await call('chat.search', { peer: ANN, text: 'harbour', who: '' }, OWNER));
    const texts = harbour.rows.map(function (l) { return l.text; });
    if (texts.length === 2 && texts.every(function (t) { return /harbour/.test(t); }) && harbour.keys.join() === '0:2,0:1') test.check('harbour: the two lines that say it, the newer first (0:2, 0:1); the others left out');
    else test.fail(OWED + 'harbour answered ' + JSON.stringify(harbour.keys) + ' ' + JSON.stringify(texts));
    const boat = listed(await call('chat.search', { peer: ANN, text: 'boat', who: '' }, OWNER));
    if (boat.keys.join() === '1:1' && boat.rows[0] && boat.rows[0].text === 'me to ann, the boat') test.check('my own lines are searched too: boat finds 1:1');
    else test.fail(OWED + 'boat answered ' + JSON.stringify(boat.keys));
    const other = listed(await call('chat.search', { peer: BOB, text: 'harbour', who: '' }, OWNER));
    if (other.status === 200 && !other.keys.length) test.check('one chat only: harbour in BOB\'s chat finds nothing');
    else test.fail(OWED + 'harbour in BOB\'s chat answered ' + JSON.stringify(other.keys));

    // WHO WROTE IT (Andy, 2026-10-18: "the chat-history-search should have filters me, other person or both").
    const mine = listed(await call('chat.search', { peer: ANN, text: 'harbour boat', who: 'me' }, OWNER));
    if (mine.keys.join() === '1:1') test.check('who me: only my lines, boat in 1:1');
    else test.fail(OWED + 'who me answered ' + JSON.stringify(mine.keys));
    const theirs = listed(await call('chat.search', { peer: ANN, text: 'harbour boat', who: 'them' }, OWNER));
    if (theirs.keys.join() === '0:2,0:1') test.check('who them: only the other person\'s, harbour in 0:2 and 0:1');
    else test.fail(OWED + 'who them answered ' + JSON.stringify(theirs.keys));
    const both = listed(await call('chat.search', { peer: ANN, text: 'harbour boat', who: 'both' }, OWNER));
    if (both.keys.length === 3 && both.keys.indexOf('1:1') !== -1 && both.keys.indexOf('0:2') !== -1) test.check('who both: either writer, all three');
    else test.fail(OWED + 'who both answered ' + JSON.stringify(both.keys));

    // THE CONTEXT OF A FOUND LINE (Andy: "the lines befor and after the selected one"; "chat.read gains after").
    const older = listed(await call('chat.read', { peer: ANN, before: '2026-10-03T10:06:00.000Z', after: '' }, OWNER));
    const newer = listed(await call('chat.read', { peer: ANN, before: '', after: '2026-10-03T10:06:00.000Z' }, OWNER));
    if (older.keys[0] === '1:1' && newer.keys.join() === '0:3') test.check('around 0:2: before gives 1:1 first, after gives 0:3, oldest first');
    else test.fail(OWED + 'around 0:2: before ' + JSON.stringify(older.keys) + ', after ' + JSON.stringify(newer.keys));

    test.subHeading('4. bounded, both lists');
    for (let i = 0; i < 300; i++) {
      const k = key('Many' + i);
      peer.run(k, 0, 1, '2026-10-02T00:00:00.000Z');
      line.run(k, 0, 1, '2026-10-02T' + String(Math.floor(i / 60)).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0') + ':00.000Z', 'many', '2026-10-02T23:59:00.000Z');
      line.run(ANN, 0, 100 + i, '2026-10-01T00:00:00.000Z', 'harbour ' + 'x'.repeat(200) + ' ' + i, '2026-10-01T00:00:01.000Z');
    }
    const many = listed(await call('chats.search', {}, OWNER));
    if (many.status === 200 && many.more === true && many.keys.length > 3 && many.keys.length < 303 && many.bytes <= appClient.ANSWER_MAX && many.keys[0] === ANN) test.check('303 chats: ' + many.keys.length + ' came back in ' + many.bytes + ' bytes, newest first, more true');
    else test.fail(OWED + '303 chats answered ' + many.status + ', ' + many.keys.length + ' rows, ' + many.bytes + ' bytes, more ' + many.more);
    const lots = listed(await call('chat.search', { peer: ANN, text: 'harbour', who: '' }, OWNER));
    if (lots.status === 200 && lots.more === true && lots.keys.length > 2 && lots.bytes <= appClient.ANSWER_MAX) test.check('302 harbour lines: ' + lots.keys.length + ' came back in ' + lots.bytes + ' bytes, more true');
    else test.fail(OWED + '302 harbour lines answered ' + lots.status + ', ' + lots.keys.length + ' rows, ' + lots.bytes + ' bytes, more ' + lots.more);

    test.subHeading('5. reads');
    const counts = function () { return (db.prepare('SELECT COUNT(*) AS n FROM lines').get().n - 600) + ':' + (db.prepare('SELECT COUNT(*) AS n FROM peers').get().n - 300); };
    if (counts() === counts0) test.check('the searches wrote nothing to memory.db');
    else test.fail(OWED + 'memory.db changed across the searches: ' + counts0 + ' -> ' + counts());
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
