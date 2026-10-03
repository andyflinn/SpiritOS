'use strict';

// goal/G2.2: Desk for the agents — notes 1, 2 and 6 of its box. Red on today's tree. (Note 4, an item in design
// mode while the goal is not, has no shape yet and is not here; note 5 is deferred to the agent-management goal.)
//   1. The box cap. Andy: "there will be no second box per item. absolutely not.", "orange at 50%, red at 75%",
//      and the box's own words: the desk server marks an item by its box's share of one answer (ANSWER_MAX 8377);
//      the dialog borders the box orange at 50% full, red at 75% full; nothing is refused below the answer limit;
//      the split is negotiated, never automated.
//   2. Taking his message. Andy: "an item can \"take\" my message and be the only one to answer after that, i then
//      can solicit an answer from others." Shape: a take on his line, by program, first wins, the second refused
//      taken; only the taker answers after that; the other agent can be asked for an opinion afterward.
//   6. Team tabs from the goal row. wsl-claude, found live (Andy: "you're suggesting to fix this now? i agree."):
//      the tabs come from the goal row's live (and working, for the blink); the lines only fill the chat.
// The contract the builder follows (the shapes this red fixes, argued in goal/G2.2 before building):
//   1a. An item's facts carry half: true once its box, measured as its one answer (item.box), passes 50% of
//       appClient.ANSWER_MAX, and full: true from 75%; both false below. Nothing is refused below the limit.
//   1b. The dialog paints the box with a 2px solid border, orange while half and red while full, none otherwise.
//   2a. line.take { id } takes his latest line under that item for the caller (an agent, by its key): it answers
//       { change }, the line shows taken: <label> in item.chat, and a second take answers taken (a catalogue
//       code). While it is unanswered, any other agent's chat.add under that item is refused taken; the taker's
//       chat.add answers it and frees the item; his own lines are never refused. A take on an item with no line
//       of his is refused no-row.
//   6a. The goal row's facts carry agents: {name: key} for its live agents (the server knows every writer's key;
//       wsl-claude's shape: one field, no new verb), beside live and working.
//   6b. The Team strip has a tab for every agent in the goal row's live, lines or none; a line typed under that
//       tab goes to the key the goal row gives for it; the log lines only fill the chat.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.2: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskForAgentsTestPeerCWAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskForAgentsTestPeerWSLAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskForAgentsTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// ── FAKE ELEMENTS, AS deskDialog.js AND deskWorking.js MOUNT THE PAGES ─────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function (n, v) { el['attr_' + n] = String(v); }, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function api(answers, sent) {
  return {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      return Promise.resolve({ status: 200, body: (v && answers[v]) || { change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function (app, key, body) { if (sent) sent.push({ key: key, text: body && body.text }); return Promise.resolve({ ok: true }); },
    callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  };
}
function mountPage(file, answers) {
  const doc = fakeDocument();
  const sent = [];
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(file, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('c'), api(answers, sent));
  return { doc: doc, app: b, sent: sent };
}
// What a box element shows and wears: its markup and its inline style, together.
function boxLook(doc) { const el = doc.all['dd-box']; return el ? el.innerHTML + ' ' + JSON.stringify(el.style) : ''; }
function itemFacts(over) {
  return Object.assign({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: 'wsl-claude',
    buttons: [], blocking: ['t/G1'], blocked: [], alone: false, star: false, half: false, full: false }, over || {});
}
function goalRow(live, agents) {
  return { id: 'g/G1', title: 'Round', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false,
    design: false, waiting: 0, live: live, working: [], agents: agents || {} };
}
function logLine(key, from, peer) {
  return { key: key, at: '2026-10-02T01:00:00.000Z', dir: 'in', from: from, peer: peer, kind: 'note', text: 'hello from ' + from, todo: 'team/chat' };
}

test.startTest('goal/G2.2: Desk for the agents — the box cap, taking his line, Team tabs from the goal row');

(async function () {
  // ── THE DESK SERVER, REAL: 1a and 2a ──────────────────────────────────
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-foragents-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item); } catch (e) { return {}; } };
  const chatOf = async function (id) { const r = await call('item.chat', { id: id }, ANDY); return (r.body && r.body.chat) || []; };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }

    test.subHeading('1a. the item says how full its box is: half from 50%, full from 75%');
    const max = appClient.ANSWER_MAX;
    const small = await factsOf('g/G1.1');
    let v = ((await call('item.box', { id: 'g/G1.1' }, CW)).body || {}).version || 0;
    const halfText = 'h'.repeat(Math.floor(max * 0.55));
    const w1 = await call('box.write', { id: 'g/G1.1', text: halfText, version: v }, CW);
    const half = await factsOf('g/G1.1');
    v = (w1.body || {}).version || v;
    const fullText = 'f'.repeat(Math.floor(max * 0.8));
    const w2 = await call('box.write', { id: 'g/G1.1', text: fullText, version: v }, CW);
    const full = await factsOf('g/G1.1');
    if (w1.status === 200 && w2.status === 200 && small.half === false && small.full === false
      && half.half === true && half.full === false && full.half === true && full.full === true) {
      test.check('empty: neither; 55% of one answer: half; 80%: full — and both writes were taken');
    } else test.fail(OWED + 'facts read empty ' + JSON.stringify([small.half, small.full]) + ', at 55% ' + JSON.stringify([half.half, half.full]) + ' (write ' + w1.status + '), at 80% ' + JSON.stringify([full.half, full.full]) + ' (write ' + w2.status + ')');

    test.subHeading('2a. an agent takes his line; the other waits until the taker answers');
    const noLine = await call('line.take', { id: 'g/G1.2' }, CW);
    await call('chat.add', { id: 'g/G1.2', text: 'who can tell me?' }, ANDY);
    const first = await call('line.take', { id: 'g/G1.2' }, CW);
    const second = await call('line.take', { id: 'g/G1.2' }, WSL);
    const chat = await chatOf('g/G1.2');
    const his = chat.filter(function (l) { return l.text === 'who can tell me?'; })[0] || {};
    if (noLine.status !== 200 && (noLine.body || {}).code === 'no-row' && first.status === 200 && typeof (first.body || {}).change === 'number'
      && second.status !== 200 && (second.body || {}).code === 'taken' && his.taken === 'claude-windows') {
      test.check('no line, no take (no-row); the first take wins and the line shows taken: claude-windows; the second is refused taken');
    } else test.fail(OWED + 'take with no line ' + JSON.stringify((noLine.body || {}).code) + ', first ' + first.status + ', second ' + JSON.stringify((second.body || {}).code) + ', line taken ' + JSON.stringify(his.taken));

    const other = await call('chat.add', { id: 'g/G1.2', text: 'I will answer too' }, WSL);
    const himself = await call('chat.add', { id: 'g/G1.2', text: 'and more from me' }, ANDY);
    const taker = await call('chat.add', { id: 'g/G1.2', text: 'here is my answer' }, CW);
    const freed = await call('chat.add', { id: 'g/G1.2', text: 'my opinion, since you ask' }, WSL);
    if (other.status !== 200 && (other.body || {}).code === 'taken' && himself.status === 200 && taker.status === 200 && freed.status === 200) {
      test.check('the other agent is refused taken while the take stands; his own line is never refused; the taker\'s answer frees the item');
    } else test.fail(OWED + 'other ' + JSON.stringify((other.body || {}).code) + ', his own ' + himself.status + ', taker ' + taker.status + ', after ' + freed.status);

    test.subHeading('6a. the goal row names its live agents with their keys');
    const g = await factsOf('g/G1');
    const live = Array.isArray(g.live) ? g.live : [];
    const agents = g.agents && typeof g.agents === 'object' ? g.agents : {};
    if (live.indexOf('claude-windows') !== -1 && live.indexOf('wsl-claude') !== -1
      && agents['claude-windows'] === CW.key && agents['wsl-claude'] === WSL.key) {
      test.check('both writers are live, and agents maps each name to the key it wrote with');
    } else test.fail(OWED + 'goal row live ' + JSON.stringify(live) + ', agents ' + JSON.stringify(agents));
  } catch (e) {
    test.fail(OWED + 'the red itself tripped on the server half: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }

  // ── THE DIALOG: 1b ─────────────────────────────────────────────────────
  test.subHeading('1b. the dialog borders the box orange at half, red at full');
  const looks = {};
  for (const state2 of ['none', 'half', 'full']) {
    const f = itemFacts(state2 === 'none' ? {} : state2 === 'half' ? { half: true } : { half: true, full: true });
    const d = mountPage(DETAILS, { 'item.get': { item: JSON.stringify(f), version: 1, change: 3 }, 'item.box': { box: 'BOX-TEXT', version: 1 },
      'item.checks': { checks: [] }, 'item.chat': { chat: [], chatMore: false } });
    d.app.open({ id: 't/G1.2' });
    await settled();
    looks[state2] = boxLook(d.doc);
  }
  const orange = /orange/i, red = /\bred\b/i;
  if (!orange.test(looks.none) && !red.test(looks.none) && orange.test(looks.half) && !red.test(looks.half) && red.test(looks.full)) {
    test.check('no border below half; an orange border at half; a red border at full');
  } else test.fail(OWED + 'the box wears: none ' + JSON.stringify(looks.none.slice(0, 100)) + ' | half ' + JSON.stringify(looks.half.slice(0, 100)) + ' | full ' + JSON.stringify(looks.full.slice(0, 100)));

  // ── THE TEAM STRIP: 6a ─────────────────────────────────────────────────
  // 6b STOOD HERE: a tab for every live agent, and a line under it to the key the goal row gives. The tabs and the
  // direct line went with goal/G3.12; what 6a guards (an agent live through item chat alone is not lost) now shows
  // as a bubble in the tab row, drawn from the goal row's live.
  test.subHeading('6b. a bubble for every live agent, lines or none, from the goal row');
  const keys = {}; keys['claude-windows'] = CW.key; keys['wsl-claude'] = WSL.key;
  const p = mountPage(DESK, {
    'items.search': { items: [{ key: 'g/G1', label: JSON.stringify(goalRow(['claude-windows', 'wsl-claude'], keys)) }], more: false },
    'log.search': { items: [{ key: 'l1', label: JSON.stringify(logLine('l1', 'claude-windows', CW.key)) }], more: false },
  });
  await settled();
  const strip = p.doc.getElementById('desk-tabs').innerHTML;
  const bubbles = (strip.match(/data-bubble="([^"]+)"/g) || []).map(function (s) { return s.slice(13, -1); });
  if (bubbles.indexOf('wsl-claude') !== -1 && bubbles.indexOf('claude-windows') !== -1 && !/data-agent=/.test(strip)) {
    test.check('wsl-claude, live with no line in the window, has its bubble beside claude-windows; no agent tab');
  } else test.fail(OWED + 'the tab row has bubbles ' + JSON.stringify(bubbles) + ' — an agent working only through item chat vanishes');
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
