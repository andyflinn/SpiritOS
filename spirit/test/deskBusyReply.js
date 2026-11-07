'use strict';

// goal/G2.5: a message to a busy agent is queued and answered. Red on today's tree. Depends on goal/G2.3.
//   Andy: "if i type messages to busy agents, in a chat box, the app sends an-auto reply after sending the
//   message the agents in-queue, saying \"message delivered, agents busy\".", "after every message",
//   "it won't bother you", "and if desk keeps count of those interactions, we can track them later, if
//   necessary.", "ie: measure how i act, and correct that as well."
// The contract the builder follows (the shapes this red fixes, argued in goal/G2.5 before building):
//   1. ITEM CHAT: his chat.add under an item taken by an agent the server holds as working (goal/G2.3) is recorded
//      as always, and the desk server adds its own line right after it, by 'desk', "message delivered, <agent>
//      busy" — after every such message, never when the agent is listening or the item is nobody's.
//   2. TEAM CHAT: gone. The page's half went with the direct tabs (goal/G3.12), and the Team tab and its group chat
//      goal/G0 with goal/G43.22 (Andy, the box, Q5: "G0 goes, from ui and server, kept in database."); the desk
//      server's own reply (1) is the busy reply that remains.
//   3. COUNTED BY BEING KEPT: those lines are kept like any other, by 'desk', so a search finds them later (chat.search;
//      `changes` went with goal/G33.4).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G2.5: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskBusyReplyTestPeerCWAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBusyReplyTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };
const BUSY = /message delivered, claude-windows busy/;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('goal/G2.5: a message to a busy agent is queued and answered');

(async function () {
  // ── 1 and 3: the desk server, real ───────────────────────────────────
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-busyreply-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const chatOf = async function (id) { const r = await call('item.chat', { id: id }, ANDY); return (r.body && r.body.chat) || []; };
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; since goal/G33.7 (session.set went)
  // it is seeded before the desk starts, which takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Round' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('item.get', { id: 'goal/G100.1' }, ANDY);
    if (set.status !== 200) { test.fail(OWED + 'the seeded world is not there: ' + JSON.stringify(set.body)); return; }
    await call('item.take', { id: 'goal/G100.1' }, CW);

    test.subHeading('1. his line under a working agent\'s item gets the desk\'s own reply, every time');
    await call('agent.state', { word: 'working' }, CW);
    await call('chat.add', { id: 'goal/G100.1', text: 'first while busy' }, ANDY);
    await call('chat.add', { id: 'goal/G100.1', text: 'second while busy' }, ANDY);
    const busyChat = await chatOf('goal/G100.1');
    const replies = busyChat.filter(function (l) { return l.by === 'desk' && BUSY.test(l.text); });
    const afterFirst = busyChat.findIndex(function (l) { return l.text === 'first while busy'; });
    if (replies.length === 2 && afterFirst !== -1 && busyChat[afterFirst + 1] && busyChat[afterFirst + 1].by === 'desk') {
      test.check('two lines while busy, two desk replies, each right after his line');
    } else test.fail(OWED + 'the chat reads ' + JSON.stringify(busyChat.map(function (l) { return l.by + ': ' + l.text; })));

    await call('agent.state', { word: 'listening' }, CW);
    await call('chat.add', { id: 'goal/G100.1', text: 'now it listens' }, ANDY);
    const idleChat = await chatOf('goal/G100.1');
    const idleReplies = idleChat.filter(function (l) { return l.by === 'desk'; }).length;
    if (idleReplies === 2 && idleChat[idleChat.length - 1].text === 'now it listens') test.check('a line while it listens gets no reply');
    else test.fail(OWED + 'after listening the chat holds ' + idleReplies + ' desk lines, last ' + JSON.stringify(idleChat[idleChat.length - 1]));

    const agentLine = await call('chat.add', { id: 'goal/G100.1', text: 'an agent speaks' }, CW);
    await call('agent.state', { word: 'working' }, CW);
    const nobodyChatBefore = (await chatOf('goal/G100.1')).length;
    await call('chat.add', { id: 'goal/G100', text: 'a line under the goal, nobody holds it' }, ANDY);
    const goalChat = await chatOf('goal/G100');
    if (agentLine.status === 200 && !goalChat.some(function (l) { return l.by === 'desk'; }) && (await chatOf('goal/G100.1')).length === nobodyChatBefore) {
      test.check('an agent\'s own line, and his line under an item nobody holds, get no reply');
    } else test.fail(OWED + 'a reply went where none was due: goal chat ' + JSON.stringify(goalChat.map(function (l) { return l.by; })));

    // goal/G33.4: `changes` is gone; the replies are kept as chat lines by desk, and a search over the goal's items
    // finds and counts them later.
    test.subHeading('3. the replies are kept: a search finds them, by desk');
    const ch = await call('chat.search', { id: 'goal/G100', text: 'message delivered', by: 'desk', since: '', before: '', scope: 'items' }, ANDY);
    const recs = ((ch.body || {}).items || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return {}; } })
      .filter(function (l) { return l.by === 'desk' && BUSY.test(String(l.text)); });
    if (recs.length === 2) test.check('chat.search finds the two desk replies as lines by desk, countable and searchable');
    else test.fail(OWED + 'chat.search finds ' + recs.length + ' desk replies: ' + JSON.stringify(ch.body).slice(0, 300));
  } catch (e) {
    test.fail(OWED + 'the red itself tripped on the server half: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }

})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
