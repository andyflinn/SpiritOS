'use strict';

// goal/G3.10: the group chat is anchored on a goal of its own, desk/G0.0. Red on today's tree: the desk server
// holds no such goal, and the All tab draws the packets Andy's page recorded, where no agent can answer any more.
//   Andy, 2026-10-02, under goal/G3: "This looks like a perfect team chat. Is it because it has a coal/item to
//   anchor it?", then "so lets change the desk server to be an fake item. Experiment. make it desk/G0.0 in the
//   database. and try to anchor the chat on that?". Under goal/G3.10: "when deskServer Starts up, it makes sure
//   there is a closed goal with the id 'desk/G0.0', instead of the team-chat box, the 'all' tab displays the chat
//   box for 'desk/G0.0'", and "the description box for that chat are the 6 rules i stated a while back. the chat
//   there may change those rules over time., however, for now, we just show the chat box under all. when that is
//   tested, we co a little farther". His Go on this item is his press in Desk.
// The contract the builder follows (the box of goal/G3.10):
//   THE DESK SERVER (process/js/desk/desk.js)
//   1. From its start it holds a goal desk/G0.0: closed, with no buttons. A desk that has recorded nothing has it.
//   2. It is state the server holds, not a session it writes: a fresh desk's record is empty (changes from 0
//      answers no record), the goal is never the current one, and it is not among the open goals.
//   3. Its chat is an item's chat like any other: Andy and every agent write it with chat.add and read it with
//      item.chat, in one order.
//   4. Its box takes the write that exists (box.write): that is where his six rules go, and how they change.
//   5. It stays closed: an agent's bring-back on it is refused not-offered.
//   6. It outlives a restart with its chat and its box; the current goal is still the current goal.
//   THE DESK PAGE (shell/desk/desk.js)
//   7. In Team, the All tab draws desk/G0.0's chat (item.chat) in place of the team box; a line that arrived as a
//      packet under team/chat is no longer drawn there.
//   8. What Andy types under All becomes one chat.add on desk/G0.0, and no packet is posted to anybody.
//   9. A chat line of desk/G0.0 that the server publishes is drawn as it comes, without asking again.
// Nothing else changes yet (Andy: "for now, we just show the chat box under all"): the direct tabs, the take rule,
// older lines and the red star stay as they are. Not asserted, the builder's: the goal's title; the order and
// look of the lines under All; when the page first asks for the chat.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const spirit = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G3.10: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const PAGE = path.join(RUN, 'shell', 'desk', 'desk.js');
const CHAT = 'desk/G0.0';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('goal/G3.10: the group chat is anchored on desk/G0.0');

// ── THE DESK SERVER, a real one ──────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskgroup-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const CW = { key: 'MCowBQYDK2VwAyEAdeskGroupChatTestPeerCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskGroupChatTestPeerWSLAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskGroupChatTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ desk: b }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return; } catch (e) { /* not yet */ } }
}
async function factsOf(id) {
  const r = await call('item.get', { id: id }, ANDY);
  let item = null;
  try { item = JSON.parse((r.body || {}).item); } catch (e) { item = null; }
  return { status: r.status, item: item, body: r.body };
}
const labels = function (r) { return ((r.body || {}).items || []).map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } }); };

async function server() {
  await start();

  test.subHeading('1. a desk that has recorded nothing holds the closed goal desk/G0.0; 2. as its own state, not a session');
  const fresh = await factsOf(CHAT);
  const record = (await call('changes', { n: 0, line: 0 }, ANDY)).body || {};
  if (fresh.status === 200 && fresh.item && fresh.item.id === CHAT && fresh.item.goal === '' && fresh.item.status === 'closed' && Array.isArray(fresh.item.buttons) && !fresh.item.buttons.length) {
    test.check('item.get answers desk/G0.0: a goal, closed, offering no button');
  } else {
    test.fail(OWED + 'a fresh desk answered item.get desk/G0.0 with ' + fresh.status + ' ' + JSON.stringify(fresh.body).slice(0, 200));
    ['2. it is the server\'s own state, never the current goal', '3. its chat takes and gives back everybody\'s lines', '4. its box takes the write that exists',
      '5. it stays closed', '6. it outlives a restart'].forEach(function (what) { test.fail(OWED + what + ': the desk server holds no desk/G0.0'); });
    return;
  }
  // A goal of the ordinary kind, set as every goal is: it is the current one, and desk/G0.0 is not in its way.
  await call('session.set', { json: JSON.stringify({ goal: { id: 't/G1', title: 'An ordinary goal' }, items: [{ id: 't/G1.1', title: 'A', blocks: ['t/G1'] }] }) }, CW);
  const current = labels(await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false }, ANDY)).map(function (i) { return i.id; });
  const open = labels(await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: true }, ANDY)).map(function (i) { return i.id; });
  if (Array.isArray(record.records) && record.records.length === 0 && current.indexOf('t/G1') !== -1 && current.indexOf(CHAT) === -1 && open.indexOf(CHAT) === -1) {
    test.check('the fresh desk\'s record is empty; an ordinary goal is the current one, and desk/G0.0 is not among the open goals');
  } else test.fail(OWED + 'the fresh record held ' + JSON.stringify(record.records).slice(0, 160) + '; the current goal lists ' + JSON.stringify(current) + ', the open goals ' + JSON.stringify(open));

  test.subHeading('3. its chat takes and gives back everybody\'s lines, in one order');
  const w1 = await call('chat.add', { id: CHAT, text: 'andy in the group chat' }, ANDY);
  const w2 = await call('chat.add', { id: CHAT, text: 'claude-windows in the group chat' }, CW);
  const w3 = await call('chat.add', { id: CHAT, text: 'wsl-claude in the group chat' }, WSL);
  const chat = ((await call('item.chat', { id: CHAT }, WSL)).body || {}).chat || [];
  const said = chat.map(function (l) { return l.by + ': ' + l.text; });
  if (w1.status === 200 && w2.status === 200 && w3.status === 200 && said.join(' | ') === 'andy: andy in the group chat | claude-windows: claude-windows in the group chat | wsl-claude: wsl-claude in the group chat') {
    test.check('three lines, Andy\'s and each agent\'s, written with chat.add and read back with item.chat in the order they were said');
  } else test.fail(OWED + 'chat.add answered ' + [w1.status, w2.status, w3.status].join(', ') + ' and item.chat gave ' + JSON.stringify(said));

  test.subHeading('4. its box takes the write that exists');
  const RULES = '1. "Agants will NOT speak to each other behind the users back."';
  const wrote = await call('box.write', { id: CHAT, text: RULES, version: 0 }, CW);
  const box = (await call('item.box', { id: CHAT }, ANDY)).body || {};
  if (wrote.status === 200 && box.box === RULES && box.version === 1) test.check('box.write put the text in desk/G0.0\'s box, version 1');
  else test.fail(OWED + 'box.write answered ' + wrote.status + ' ' + JSON.stringify(wrote.body).slice(0, 120) + ' and item.box gave ' + JSON.stringify(box).slice(0, 160));

  test.subHeading('5. it stays closed');
  const back = await call('press', { id: CHAT, what: 'bring-back' }, WSL);
  const still = await factsOf(CHAT);
  if ((back.body || {}).code === 'not-offered' && still.item && still.item.status === 'closed') test.check('an agent\'s bring-back on it is refused not-offered, and it is still closed');
  else test.fail(OWED + 'bring-back answered ' + back.status + ' ' + JSON.stringify(back.body) + '; its status is then ' + JSON.stringify(still.item && still.item.status));

  test.subHeading('6. it outlives a restart');
  kid.kill();
  await sleep(500);
  await start();
  const after = await factsOf(CHAT);
  const chat2 = ((await call('item.chat', { id: CHAT }, ANDY)).body || {}).chat || [];
  const box2 = (await call('item.box', { id: CHAT }, ANDY)).body || {};
  const current2 = labels(await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false }, ANDY)).map(function (i) { return i.id; });
  if (after.item && after.item.status === 'closed' && chat2.length === 3 && box2.box === RULES && current2.indexOf('t/G1') !== -1 && current2.indexOf(CHAT) === -1) {
    test.check('after a restart: still closed, its three lines and its box intact, and the ordinary goal still the current one');
  } else test.fail(OWED + 'after a restart: status ' + JSON.stringify(after.item && after.item.status) + ', ' + chat2.length + ' line(s), box ' + JSON.stringify(box2.box).slice(0, 60) + ', current goal lists ' + JSON.stringify(current2));
}

// ── THE DESK PAGE, on a fake document and a fake desk ────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    getAttribute: function () { return null; },
    setAttribute: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function settle() {
  let p = Promise.resolve();
  for (let i = 0; i < 6; i++) p = p.then(function () { return new Promise(function (r) { setImmediate(r); }); });
  return p;
}
function clickOn(container, attr, value) {
  const target = { getAttribute: function (n) { return n === attr ? value : null; }, parentNode: null };
  container.fire('click', { target: target, currentTarget: container });
}

async function page() {
  const now = Date.now();
  const AGENT_KEY = 'MCowBQYDK2VwAyEAdeskGroupChatPageAgentAAAAAAAAAAAAAAAA=';
  // What the page's own log holds from before: a line that arrived as a packet under team/chat.
  const log = [{ key: 'old1', at: new Date(now - 60000).toISOString(), dir: 'in', peer: AGENT_KEY, outcome: 'received', from: 'wsl-claude', kind: 'note', text: 'an old packet line under team', todo: 'team/chat' }];
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(log), 'seen.json': JSON.stringify({ rows: {}, team: 0, agents: {} }) });
  fake.items = [{ id: 't/G1', title: 'An ordinary goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false, design: false, waiting: 0 }];
  // The desk server's side of desk/G0.0, answered here as the real one answers: item.chat and chat.add.
  const groupChat = [
    { by: 'andy', at: new Date(now - 30000).toISOString(), text: 'first line of the group chat', taken: '' },
    { by: 'wsl-claude', at: new Date(now - 20000).toISOString(), text: 'an agent answers in the group chat', taken: '' },
  ];
  const asked = [];   // every desk ask the page made: { verb, args }
  const verb = function (name, body) {
    const desk = name === 'jobs.api' && body && body.ask && body.ask.desk;
    const v = desk ? Object.keys(desk)[0] : '';
    if (desk) asked.push({ verb: v, args: desk[v] });
    if (v === 'item.chat' && desk[v] && desk[v].id === CHAT) return Promise.resolve({ status: 200, body: { chat: groupChat.slice(), chatMore: false } });
    if (v === 'chat.add' && desk[v] && desk[v].id === CHAT) {
      groupChat.push({ by: 'andy', at: new Date().toISOString(), text: String(desk[v].text), taken: '' });
      return Promise.resolve({ status: 200, body: { change: 900 + groupChat.length } });
    }
    return fake.verb(name, body);
  };
  const posted = [];
  const published = [];
  const doc = fakeDocument();
  const root = fakeElement('container');
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(PAGE, 'utf8'))({ shell: { activateApp: function (b) { behavior = b; } } }, doc, {});
  behavior.mount(root, {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: spirit.core.util.escapeHtml,
    verb: verb,
    onPublished: function (fn) { published.push(fn); return function () {}; },
    onPacket: function () {},
    peerPost: function (app, key, body) { posted.push({ app: app, key: key, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
    callDialog: function () { return new Promise(function () {}); },
  });
  await settle();
  clickOn(doc.getElementById('desk-tabs'), 'data-tab', 'team');
  await settle();
  clickOn(doc.getElementById('desk-agent-tabs'), 'data-agent', '*');
  await settle();

  test.subHeading('7. the All tab draws desk/G0.0\'s chat in place of the team box');
  const team = doc.getElementById('desk-team');
  const askedChat = asked.some(function (c) { return c.verb === 'item.chat' && c.args && c.args.id === CHAT; });
  if (askedChat && /first line of the group chat/.test(team.innerHTML) && /an agent answers in the group chat/.test(team.innerHTML) && /wsl-claude/.test(team.innerHTML) && !/an old packet line under team/.test(team.innerHTML)) {
    test.check('the page asked item.chat for desk/G0.0 and drew its two lines; the old packet line under team/chat is not drawn there');
  } else test.fail(OWED + 'the page ' + (askedChat ? 'asked' : 'did not ask') + ' item.chat for desk/G0.0, and the All tab shows: ' + team.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 220));

  test.subHeading('8. what Andy types under All is one chat.add on desk/G0.0, and no packet');
  asked.length = 0;
  posted.length = 0;
  doc.getElementById('desk-team-say').value = 'typed under All';
  doc.getElementById('desk-team-send').fire('click', {});
  await settle();
  const adds = asked.filter(function (c) { return c.verb === 'chat.add'; });
  if (adds.length === 1 && adds[0].args.id === CHAT && adds[0].args.text === 'typed under All' && posted.length === 0) test.check('one chat.add {id: desk/G0.0, text}, and nothing posted to any agent');
  else test.fail(OWED + 'the page made ' + adds.length + ' chat.add ask(s) ' + JSON.stringify(adds).slice(0, 160) + ' and posted ' + posted.length + ' packet(s)');

  test.subHeading('9. a published line of desk/G0.0 is drawn as it comes, without asking again');
  asked.length = 0;
  const line = { by: 'claude-windows', at: new Date().toISOString(), text: 'a line the server published', taken: '' };
  published.forEach(function (fn) {
    fn({ change: 5000, verb: 'chat.add', item: { id: CHAT, title: '', goal: '', status: 'closed', with: '', buttons: [], blocking: [], blocked: [] }, listed: false, chat: line });
  });
  await settle();
  const pulled = asked.filter(function (c) { return c.verb === 'item.chat'; }).length;
  if (/a line the server published/.test(doc.getElementById('desk-team').innerHTML) && pulled === 0) test.check('the published line shows under All, and the page asked for nothing');
  else test.fail(OWED + 'after the publish the All tab ' + (/a line the server published/.test(doc.getElementById('desk-team').innerHTML) ? 'shows' : 'does not show') + ' the line, and the page asked item.chat ' + pulled + ' time(s)');
}

server().catch(function (e) { test.fail(OWED + 'the server half tripped: ' + (e && e.stack || e)); })
  .then(function () { return page(); }).catch(function (e) { test.fail(OWED + 'the page half tripped: ' + (e && e.stack || e)); })
  .then(function () {
    if (kid) kid.kill();
    setTimeout(function () {
      try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
      test.reportSuccessFailureCount();
      process.exit(0);
    }, 300);
  });
