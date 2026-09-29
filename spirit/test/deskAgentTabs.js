'use strict';

// spirit/test/deskAgentTabs.js
// ONE TAB PER AGENT INSIDE TEAM — desk/G1.2, written FIRST, red today.
//
//   Decided (Desk, desk/G1): D2 "the top level [lead] tab moves into [team]
//   as [agent-name], karked as lead": clicking Team shows the team chat to
//   every agent; clicking an agent's tab is a channel between Andy and that
//   agent alone. D7 (Andy: "agreed."): the count of what waits on him on
//   the List tab; an unread star on each agent tab; renaming a row by its
//   own button, never from the note box.
//
// THE CONTRACT this holds desk.js and deskDetails.js to:
//   - #desk-tabs has data-tab list, team and musings, and no lead.
//   - #desk-agent-tabs, drawn under the tabs, has a button data-agent="*"
//     (All) and one data-agent="<name>" per agent heard from; the lead's
//     carries data-lead="1".
//   - With an agent's tab chosen, #desk-team-send posts #desk-team-say to
//     that agent's key alone, as a line with no todo (today's Lead line).
//   - #desk-tabs and #desk-agent-tabs are each drawn whole, as markup.
//   - The List tab's label carries "(n)", n the rows waiting on Andy.
//   - An agent tab with a line he has not seen shows the red *.
//   - deskDetails draws no #dd-name box until #dd-rename is pressed.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'app', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwsl=';

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
function load(script, doc) {
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (b) { behavior = b; } } }, doc, {});
  return behavior;
}
function settle() {
  return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); });
}
// A click on a container, landing on a button that carries `attr`.
function clickOn(container, attr, value) {
  const target = { getAttribute: function (n) { return n === attr ? value : null; }, parentNode: null };
  container.fire('click', { target: target, currentTarget: container });
}

const now = Date.now();
let n = 0;
function row(dir, from, peer, kind, text, todo) {
  n += 1;
  return { key: 'k' + n, at: new Date(now - 60000 + n * 1000).toISOString(), dir: dir, peer: peer,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const SESSION = JSON.stringify({ goal: { id: 'test/G1', title: 'The goal' }, rules: [],
  items: [{ id: 'test/G1.1', title: 'Asks Andy' }, { id: 'test/G1.2', title: 'Quiet' }] });
const log = [
  row('in', 'claude-windows', LEAD, 'session', SESSION, 'team/chat'),
  row('in', 'claude-windows', LEAD, 'note', 'a line from the lead to Andy alone', ''),
  row('in', 'wsl-claude', WSL, 'note', 'wsl in the team chat', 'team/chat'),
  row('in', 'claude-windows', LEAD, 'note', 'IN PLACE VERIFIED', 'test/G1.1'),
  row('in', 'claude-windows', LEAD, 'ask', 'ready: go?', 'test/G1.1'),
  row('in', 'wsl-claude', WSL, 'note', 'wsl to Andy alone, unseen', ''),
];

const posted = [];
const doc = fakeDocument();
const root = fakeElement('container');
load(DESK, doc).mount(root, {
  // A seen.json that has seen nothing: without one, Desk counts all it holds
  // as seen on the first open (deskLoadSeen), and no star could ever show.
  fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; }, saveFile: function () { return Promise.resolve(); } },
  escapeHtml: spirit.core.util.escapeHtml,
  verb: function () { return Promise.resolve({ status: 200, body: {} }); },
  onPacket: function () {},
  peerPost: function (app, key, body) { posted.push({ key: key, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
  callDialog: function () { return new Promise(function () {}); },
});

test.startTest('desk/G1.2: one tab per agent inside Team, the lead marked');
settle().then(function () {
  const tabs = doc.getElementById('desk-tabs');
  const agents = doc.getElementById('desk-agent-tabs');
  clickOn(tabs, 'data-tab', 'team');
  const strip = root.innerHTML + tabs.innerHTML;

  test.subHeading('T1: Team shows All and one tab per agent heard from; Lead is no longer a top tab');
  const a = agents.innerHTML;
  if (!/data-tab="lead"/.test(strip) && /data-agent="\*"/.test(a) && /data-agent="claude-windows"/.test(a) && /data-agent="wsl-claude"/.test(a)) {
    test.check('no Lead top tab; Team shows All, claude-windows and wsl-claude');
  } else test.fail('top Lead tab ' + /data-tab="lead"/.test(strip) + '; agent tabs: ' + a.slice(0, 200));

  test.subHeading("T2: the lead's tab is marked");
  if (/data-agent="claude-windows"[^>]*data-lead="1"|data-lead="1"[^>]*data-agent="claude-windows"/.test(a) &&
      !/data-agent="wsl-claude"[^>]*data-lead="1"/.test(a)) test.check("claude-windows's tab carries the lead mark, wsl-claude's does not");
  else test.fail('lead mark not on the lead\'s tab alone: ' + a.slice(0, 200));

  // Before T3: opening a tab is seeing it.
  test.subHeading('T6: an agent tab with a line he has not seen shows the red *');
  const wslTab = (agents.innerHTML.match(/<button[^>]*data-agent="wsl-claude"[^>]*>[\s\S]*?<\/button>/) || [''])[0];
  if (/title="unseen changes"/.test(wslTab)) test.check('wsl-claude\'s tab shows the unseen star');
  else test.fail('wsl-claude tab: ' + wslTab);

  test.subHeading("T3: a line typed in an agent's tab goes to that agent only");
  clickOn(agents, 'data-agent', 'wsl-claude');
  doc.getElementById('desk-team-say').value = 'for wsl only';
  posted.length = 0;
  doc.getElementById('desk-team-send').fire('click', {});
  return settle().then(function () {
    if (posted.length === 1 && posted[0].key === WSL && !posted[0].body.todo) test.check('one post, to wsl-claude\'s key, as a direct line');
    else test.fail('posted: ' + JSON.stringify(posted.map(function (p) { return [p.key.slice(16, 22), p.body.todo]; })));

    test.subHeading("T4: today's Lead chat appears in the lead's tab");
    clickOn(agents, 'data-agent', 'claude-windows');
    const chat = doc.getElementById('desk-team').innerHTML;
    if (/a line from the lead to Andy alone/.test(chat) && !/wsl in the team chat/.test(chat)) test.check('the lead\'s tab shows the lead\'s direct line, not the team chat');
    else test.fail('lead tab shows: ' + chat.slice(0, 200));

    test.subHeading('T5: the List tab carries the count of rows waiting on Andy');
    const listLabel = (tabs.innerHTML.match(/data-tab="list"[^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/button>/) || ['', ''])[1];
    if (/\(1\)/.test(listLabel)) test.check('List shows (1): one row asks Andy');
    else test.fail('List tab label: ' + JSON.stringify(listLabel));

    test.subHeading('T7: renaming is its own button; the dialog shows no name box until it is pressed');
    const ddDoc = fakeDocument();
    const dd = load(DETAILS, ddDoc);
    const box = fakeElement('dd');
    try {
      dd.mount(box, { escapeHtml: spirit.core.util.escapeHtml, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
        fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
      if (dd.open) dd.open({ id: 'test/G1.1', row: { id: 'test/G1.1', title: 'Asks Andy' }, thread: [], agents: {}, session: [], rules: [] });
    } catch (e) { /* drawn below */ }
    // The dialog draws its frame into #dd-body, not into the container.
    const html = ddDoc.getElementById('dd-body').innerHTML;
    if (!/id="dd-name"/.test(html) && /id="dd-rename"/.test(html)) test.check('no name box on opening, a Rename button instead');
    else test.fail('dialog on opening: name box ' + /id="dd-name"/.test(html) + ', rename button ' + /id="dd-rename"/.test(html));
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
