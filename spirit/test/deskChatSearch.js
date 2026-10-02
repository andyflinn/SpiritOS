'use strict';

// goal/G3.11: a search on the chat lines of an item, the group chat's (desk/G0.0) first. Red on today's tree: the desk server has no verb chat.search;
// the group chat answers only its newest lines that fit one answer (item.chat), and an older line cannot be found.
//   Andy, 2026-10-02: "a search on the chat lines of 'desk/G0.0'" — "nothing else". Earlier, of the same: "you may
//   introduce a search() just for the records of 'desk/G0.0' s chat, if you like.", "with time boundaries etc....
//   just for you agents". Of an item chat answering only its newest lines: "and that is as it should be. what's the
//   problem with having to be brief?" And of handing a full answer on in pieces: "no. none of this joing shit."
//   His Go on this item is his press in Desk. Then, with the first red on master: "why dont you generalize the
//   search so you can do it to the chat lines for any item in desk?" — so the search names its item (id), and
//   this red is amended for it.
// The contract the builder follows (the spec in the box of goal/G3.11, wsl-claude's; the four filters are the ones
// Andy asked it to name):
//   1. One verb on the desk server, chat.search {id, text, by, since, before} -> {items: [{key, label}], more}: what
//      every search here answers.
//   2. It searches the chat lines of the ONE item named by id and nothing else: asked for desk/G0.0, a line of
//      another item's chat is never answered, and the other way round. An id no item has is refused
//      no-such-item.
//   3. Each label is one line as JSON {by, at, text}; the newest first; the keys differ.
//   4. The filters, one left empty filtering nothing: text, words in the line; by, who wrote it (andy, or an agent
//      as the desk names it); since, lines from that time on; before, lines earlier than that time. Together they
//      narrow: a line is answered when every filter given lets it through.
//   5. It is a read: it writes no record, and takes no by of its own (an argument it does not name is refused
//      no-such-argument, as every verb here refuses one).
//   6. It is brief. A chat too long for one answer comes back cut, newest first, and says more. And the fullest
//      answer it gives passes through an agent's deskClient in one piece: deskClient.desk answers it {json}, not
//      app-answer-too-large (a desk answer filled to the desk's own room does not: 8,716 bytes against 8,377).
//   7. Nothing pages and nothing is joined: an agent that wants more narrows the search, and before = the oldest
//      time it got answers the next older lines.
// Not asserted, the builder's: what a key is; whether text matches whatever the case; how much room the answer
// keeps for the way through deskClient.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G3.11: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const CHAT = 'desk/G0.0';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const DESK_KEY = 'MCowBQYDK2VwAyEAdeskChatSearchTestDeskNodeAAAAAAAAAAA=';
const CW_KEY = 'MCowBQYDK2VwAyEAdeskChatSearchTestPeerCWAAAAAAAAAAAAA=';
const ANDY = { owner: true, key: DESK_KEY, label: 'andy' };
const CW = { key: CW_KEY, label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskChatSearchTestPeerWSLAAAAAAAAAAAA=', label: 'wsl-claude' };
const CW_OWNER = { owner: true, key: CW_KEY, label: 'claude-windows' };

test.startTest('goal/G3.11: a search on the chat lines of desk/G0.0');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskchatsearch-'));
const deskState = path.join(scratch, 'desk-state');
const clientState = path.join(scratch, 'client-state');
fs.mkdirSync(deskState, { recursive: true });
fs.mkdirSync(clientState, { recursive: true });
const win = process.platform === 'win32';
const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const clientPipe = win ? appClient.pipePathFor(scratch, 'deskClient', 'win32', 'process') : path.join(scratch, 'deskClient.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
client.register('deskClient', clientPipe);
const kids = [];
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const NONE = { id: CHAT, text: '', by: '', since: '', before: '' };
const filter = function (f) { return Object.assign({}, NONE, f); };
// One search, as an agent asks it: { status, code, lines: [{by, at, text}], keys, more }.
async function search(f, caller) {
  const r = await call('desk', 'chat.search', filter(f), caller || CW);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  const lines = items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } });
  return { status: r.status, code: (r.body || {}).code, lines: lines, keys: items.map(function (p) { return p.key; }), more: (r.body || {}).more, body: r.body };
}
const texts = function (s) { return s.lines.map(function (l) { return l.text; }).join(' | '); };

// THE PRETEND NODE an agent's deskClient runs on, as deskClientAsk.js builds it: its peer.post goes into the real
// desk server as the agent's own ask, and the answer comes back down the event stream by re.
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
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: (ask && ask.body && ask.body.desk) || {} }, CW).then(function (r) {
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

async function main() {
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  const tree = await up('desk') || {};

  test.subHeading('1. the verb');
  if (JSON.stringify(tree['chat.search'] || null) !== JSON.stringify({ request: { id: '', text: '', by: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false } })) {
    test.fail(OWED + 'the desk server answered chat.search ' + JSON.stringify(tree['chat.search'] || null) + ', where {id, text, by, since, before} -> {items, more} is owed');
    ['2. the chat lines of the item named and nothing else', '3. each line as {by, at, text}, the newest first', '4. the four filters, alone and together', '5. a read',
      '6. brief: cut to fit, and whole through deskClient', '7. narrowing brings the next older lines'].forEach(function (what) { test.fail(OWED + what + ': the desk server has no verb chat.search'); });
    return;
  }
  test.check('chat.search {id, text, by, since, before} -> {items: [{key, label}], more}');

  // An ordinary goal with an item, whose chat must never be answered; then four lines in the group chat, each at
  // its own moment.
  await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 't/G1', title: 'An ordinary goal' }, items: [{ id: 't/G1.1', title: 'A', blocks: ['t/G1'] }] }) }, CW);
  await call('desk', 'chat.add', { id: 't/G1.1', text: 'alpha in another item' }, ANDY);
  const said = [[ANDY, 'alpha one'], [CW, 'alpha two'], [WSL, 'beta three'], [ANDY, 'beta four']];
  for (const s of said) { await sleep(25); await call('desk', 'chat.add', { id: CHAT, text: s[1] }, s[0]); }
  const held = (((await call('desk', 'item.chat', { id: CHAT }, ANDY)).body || {}).chat || []);
  const at = held.map(function (l) { return l.at; });
  if (held.length !== 4 || new Set(at).size !== 4) { test.fail(OWED + 'the test desk holds ' + held.length + ' group chat lines at ' + new Set(at).size + ' moments; four of each are needed'); return; }

  test.subHeading('2. the chat lines of the item named and nothing else; 3. each line as {by, at, text}, the newest first');
  const all = await search({});
  if (all.status === 200 && texts(all) === 'beta four | beta three | alpha two | alpha one' && all.more === false) test.check('with no filter: the four lines of the group chat, newest first, and not the other item\'s line');
  else test.fail(OWED + 'with no filter chat.search answered ' + all.status + ' ' + JSON.stringify(all.body).slice(0, 240));
  const shaped = all.lines.length === 4 && all.lines.every(function (l, i) { const h = held[3 - i]; return Object.keys(l).sort().join(',') === 'at,by,text' && l.by === h.by && l.at === h.at && l.text === h.text; });
  if (shaped && new Set(all.keys).size === 4) test.check('each label is the line as the chat holds it, {by, at, text}, and the four keys differ');
  else test.fail(OWED + 'the labels read ' + JSON.stringify(all.lines).slice(0, 240) + ' with keys ' + JSON.stringify(all.keys));

  const other = await search({ id: 't/G1.1' });
  const otherAlpha = await search({ id: 't/G1.1', text: 'alpha' });
  const nowhere = await search({ id: 'nope/G9.9' });
  if (texts(other) === 'alpha in another item' && texts(otherAlpha) === 'alpha in another item' && nowhere.code === 'no-such-item') {
    test.check('asked for another item, it answers the one line of that item and none of the group chat; an id no item has is refused no-such-item');
  } else test.fail(OWED + 'asked for t/G1.1 it gave [' + texts(other) + '], with text alpha [' + texts(otherAlpha) + ']; an unknown id answered ' + nowhere.status + ' ' + JSON.stringify(nowhere.body).slice(0, 120));

  test.subHeading('4. the four filters, alone and together');
  const byText = await search({ text: 'alpha' });
  const byWho = await search({ by: 'wsl-claude' });
  const byAndy = await search({ by: 'andy' });
  if (texts(byText) === 'alpha two | alpha one' && texts(byWho) === 'beta three' && texts(byAndy) === 'beta four | alpha one') test.check('text finds the lines holding the words; by finds an agent\'s lines, and Andy\'s');
  else test.fail(OWED + 'text alpha gave [' + texts(byText) + '], by wsl-claude [' + texts(byWho) + '], by andy [' + texts(byAndy) + ']');
  const since = await search({ since: at[2] });
  const before = await search({ before: at[2] });
  const between = await search({ since: at[1], before: at[3] });
  if (texts(since) === 'beta four | beta three' && texts(before) === 'alpha two | alpha one' && texts(between) === 'beta three | alpha two') test.check('since answers lines from that time on, before the lines earlier than it, and the two together the lines between');
  else test.fail(OWED + 'since the third line gave [' + texts(since) + '], before it [' + texts(before) + '], between the second and the fourth [' + texts(between) + ']');
  const together = await search({ text: 'beta', by: 'andy', since: at[0], before: '9999-01-01T00:00:00.000Z' });
  const nobody = await search({ text: 'alpha', by: 'wsl-claude' });
  if (texts(together) === 'beta four' && nobody.status === 200 && nobody.lines.length === 0 && nobody.more === false) test.check('all four together answer the one line every filter lets through; filters that agree on no line answer none');
  else test.fail(OWED + 'all four together gave [' + texts(together) + ']; text alpha by wsl-claude gave ' + nobody.status + ' [' + texts(nobody) + ']');

  test.subHeading('5. a read: no record written, no by taken');
  const n0 = ((await call('desk', 'changes', { n: 0, line: 0 }, ANDY)).body || {}).n;
  await search({ text: 'alpha' });
  await search({}, ANDY);
  const n1 = ((await call('desk', 'changes', { n: 0, line: 0 }, ANDY)).body || {}).n;
  const withBy = await call('desk', 'chat.search', Object.assign({ who: 'andy' }, NONE), CW);
  if (typeof n0 === 'number' && n0 === n1 && (withBy.body || {}).code === 'no-such-argument') test.check('two searches left the record where it stood (change ' + n1 + '), and an argument it does not name is refused no-such-argument');
  else test.fail(OWED + 'the record stood at ' + n0 + ' before and ' + n1 + ' after two searches; an unnamed argument answered ' + withBy.status + ' ' + JSON.stringify(withBy.body).slice(0, 120));

  test.subHeading('6. brief: a long chat comes back cut, and whole through deskClient');
  // 120 lines full of quotes: every quote gains a backslash each time the answer is packed as text, which is what
  // made a full desk answer too large for deskClient to pass on.
  const QUOTED = '"q" '.repeat(45);
  for (let i = 0; i < 120; i++) await call('desk', 'chat.add', { id: CHAT, text: 'long ' + String(i).padStart(3, '0') + ' ' + QUOTED }, i % 2 ? CW : ANDY);
  const full = await search({ text: 'long' });
  if (full.status === 200 && full.more === true && full.lines.length > 0 && full.lines.length < 120 && /^long 119 /.test((full.lines[0] || {}).text || '')) test.check('120 long lines: ' + full.lines.length + ' came back, the newest first, and more is true');
  else test.fail(OWED + 'the long chat answered ' + full.status + ', ' + full.lines.length + ' line(s), more ' + full.more + ', first ' + JSON.stringify((full.lines[0] || {}).text || '').slice(0, 40));

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [CLIENT, '{}', '--pipe', clientPipe, '--state', clientState, '--node', JSON.stringify({ name: 'claude-windows', publicKey: CW_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  }));
  await up('deskClient');
  await call('deskClient', 'setDesk', { key: DESK_KEY }, CW_OWNER);
  const through = await call('deskClient', 'desk', { verb: 'chat.search', json: JSON.stringify(filter({ text: 'long' })) }, CW_OWNER);
  let passed = null;
  try { passed = JSON.parse((through.body || {}).json); } catch (e) { passed = null; }
  if (through.status === 200 && passed && Array.isArray(passed.items) && passed.items.length === full.lines.length && passed.more === true) {
    test.check('the same fullest answer came through deskClient in one piece: ' + passed.items.length + ' lines as {json}');
  } else test.fail(OWED + 'through deskClient the fullest answer came back ' + through.status + ' ' + JSON.stringify(through.body).slice(0, 200));

  test.subHeading('7. narrowing brings the next older lines');
  const oldest = full.lines[full.lines.length - 1] || {};
  const older = await search({ text: 'long', before: oldest.at });
  const overlap = older.lines.filter(function (l) { return full.lines.some(function (f) { return f.at === l.at && f.text === l.text; }); }).length;
  const firstOlder = (older.lines[0] || {}).text || '';
  const expectNext = 'long ' + String(Number(String(oldest.text || '').slice(5, 8)) - 1).padStart(3, '0') + ' ';
  if (older.status === 200 && older.lines.length > 0 && overlap === 0 && firstOlder.indexOf(expectNext) === 0) test.check('before = the oldest time answered brought the next older lines, starting with ' + expectNext.trim() + ', and none twice');
  else test.fail(OWED + 'narrowed by before, the search answered ' + older.lines.length + ' line(s), ' + overlap + ' of them answered already, the first ' + JSON.stringify(firstOlder.slice(0, 20)) + ' where ' + JSON.stringify(expectNext.trim()) + ' is next');
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
