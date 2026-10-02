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
//   2. TEAM CHAT: his line to one agent in Team goes to the agent as always (peerPost, the queue is the agent's
//      record); when the goal row says that agent is working, the page adds a line from 'desk', "message
//      delivered, <agent> busy", to that agent's chat and logs it (log.add) like every line. Nothing goes to
//      the agent for it.
//   3. COUNTED BY BEING KEPT: those lines are records like any other, so changes answers them (by 'desk') and a
//      search finds them later.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.5: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskBusyReplyTestPeerCWAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBusyReplyTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };
const BUSY = /message delivered, claude-windows busy/;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// ── THE PAGE, MOUNTED ON FAKE ELEMENTS (as deskWorking.js mounts it) ─────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function mount(answers) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  const writes = [];   // every desk verb the page sent, { verb, args }
  const posted = [];   // every peerPost the page sent, { to, body }
  b.mount(fakeElement('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) writes.push({ verb: v, args: ask[v] });
      return Promise.resolve({ status: 200, body: answers[v] || { change: 1, added: true } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function (app, to, body) { posted.push({ to: to, body: body }); return Promise.resolve({ ok: true, hash: 'sent-' + posted.length }); },
    callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return { doc: doc, writes: writes, posted: posted };
}
function goalRow(working) {
  return { id: 'g/G1', title: 'Round', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false,
    design: false, waiting: 0, live: ['claude-windows'], working: working };
}
function line(key, from, peer) {
  return { key: key, at: '2026-10-02T01:00:00.000Z', dir: 'in', from: from, peer: peer, kind: 'note', text: 'hello', todo: 'team/chat' };
}

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
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [{ id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }
    await call('item.take', { id: 'g/G1.1' }, CW);

    test.subHeading('1. his line under a working agent\'s item gets the desk\'s own reply, every time');
    await call('agent.state', { word: 'working' }, CW);
    await call('chat.add', { id: 'g/G1.1', text: 'first while busy' }, ANDY);
    await call('chat.add', { id: 'g/G1.1', text: 'second while busy' }, ANDY);
    const busyChat = await chatOf('g/G1.1');
    const replies = busyChat.filter(function (l) { return l.by === 'desk' && BUSY.test(l.text); });
    const afterFirst = busyChat.findIndex(function (l) { return l.text === 'first while busy'; });
    if (replies.length === 2 && afterFirst !== -1 && busyChat[afterFirst + 1] && busyChat[afterFirst + 1].by === 'desk') {
      test.check('two lines while busy, two desk replies, each right after his line');
    } else test.fail(OWED + 'the chat reads ' + JSON.stringify(busyChat.map(function (l) { return l.by + ': ' + l.text; })));

    await call('agent.state', { word: 'listening' }, CW);
    await call('chat.add', { id: 'g/G1.1', text: 'now it listens' }, ANDY);
    const idleChat = await chatOf('g/G1.1');
    const idleReplies = idleChat.filter(function (l) { return l.by === 'desk'; }).length;
    if (idleReplies === 2 && idleChat[idleChat.length - 1].text === 'now it listens') test.check('a line while it listens gets no reply');
    else test.fail(OWED + 'after listening the chat holds ' + idleReplies + ' desk lines, last ' + JSON.stringify(idleChat[idleChat.length - 1]));

    const agentLine = await call('chat.add', { id: 'g/G1.1', text: 'an agent speaks' }, CW);
    await call('agent.state', { word: 'working' }, CW);
    const nobodyChatBefore = (await chatOf('g/G1.1')).length;
    await call('chat.add', { id: 'g/G1', text: 'a line under the goal, nobody holds it' }, ANDY);
    const goalChat = await chatOf('g/G1');
    if (agentLine.status === 200 && !goalChat.some(function (l) { return l.by === 'desk'; }) && (await chatOf('g/G1.1')).length === nobodyChatBefore) {
      test.check('an agent\'s own line, and his line under an item nobody holds, get no reply');
    } else test.fail(OWED + 'a reply went where none was due: goal chat ' + JSON.stringify(goalChat.map(function (l) { return l.by; })));

    test.subHeading('3. the replies are records: changes answers them, by desk');
    const ch = await call('changes', { n: 0, line: 0 }, ANDY);
    const recs = ((ch.body || {}).records || []).filter(function (r) { return r.by === 'desk' && r.verb === 'chat.add' && BUSY.test(r.body); });
    if (recs.length === 2) test.check('changes lists the two desk replies as chat.add records by desk, countable and searchable');
    else test.fail(OWED + 'changes holds ' + recs.length + ' desk reply records');
  } catch (e) {
    test.fail(OWED + 'the red itself tripped on the server half: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }

  // ── 2: the page, Team tab ─────────────────────────────────────────────
  test.subHeading('2. a Team line to a working agent is answered by the page, once per line, and logged');
  const page = mount({
    'items.search': { items: [{ key: 'g/G1', label: JSON.stringify(goalRow(['claude-windows'])) }], more: false },
    'log.search': { items: [{ key: 'l1', label: JSON.stringify(line('l1', 'claude-windows', CW.key)) }], more: false },
  });
  await settled();
  // Onto claude-windows' own tab, then a line to it.
  const strip = page.doc.getElementById('desk-agent-tabs');
  strip.fire('click', { target: { getAttribute: function (a) { return a === 'data-agent' ? 'claude-windows' : null; }, id: '' }, currentTarget: strip, preventDefault: function () {} });
  await settled();
  page.doc.getElementById('desk-team-say').value = 'are you there?';
  page.doc.getElementById('desk-team-send').fire('click', { preventDefault: function () {} });
  await settled();
  const sent = page.posted.filter(function (p) { return p.to === CW.key; });
  const logged = page.writes.filter(function (w) { return w.verb === 'log.add'; }).map(function (w) { try { return JSON.parse(w.args.json); } catch (e) { return {}; } });
  const reply = logged.filter(function (l) { return l.from === 'desk' && BUSY.test(String(l.text)); });
  const chatHtml = page.doc.getElementById('desk-team').innerHTML;
  if (sent.length === 1 && reply.length === 1 && BUSY.test(chatHtml) && !page.posted.some(function (p) { return BUSY.test(String(p.body && p.body.text)); })) {
    test.check('the line went to the agent once, the page answered once from desk, logged it, and sent the agent nothing for it');
  } else test.fail(OWED + 'posted ' + sent.length + ' to the agent, desk replies logged ' + reply.length + ', shown ' + BUSY.test(chatHtml));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
