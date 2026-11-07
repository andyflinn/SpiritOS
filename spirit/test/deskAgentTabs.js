'use strict';

// spirit/test/deskAgentTabs.js
// WHAT STANDS OF desk/G1.2's TABS. The agents show as bubbles in the tab row
// (goal/G3.12, deskFrontPage.js), and Team and Apps are gone (goal/G43.22:
// Andy, the box, Q5: "G0 goes, from ui and server, kept in database.").
//
// WHAT IS ASSERTED of desk.js and deskDetails.js:
//   - T1: #desk-tabs has data-tab list, and no lead, team or apps tab; no
//     data-agent tab is drawn.
//   - T5: the List tab's label carries "(n)", n the rows waiting on Andy.
//   - T7: deskDetails draws no #dd-name box until #dd-rename is pressed.
//
// The shell's desk.js now calls spirit.require, which the page stub below
// does not give it, so the file throws "no spirit.require on this page"
// before the checks run.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
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
const SESSION = JSON.stringify({ goal: { id: 'goal/G100', title: 'The goal' }, rules: [],
  items: [{ id: 'goal/G100.1', title: 'Asks Andy' }, { id: 'goal/G100.2', title: 'Quiet' }] });
const log = [
  row('in', 'claude-windows', LEAD, 'session', SESSION, 'team/chat'),
  row('in', 'claude-windows', LEAD, 'note', 'a line from the lead to Andy alone', ''),
  row('in', 'wsl-claude', WSL, 'note', 'wsl in the team chat', 'team/chat'),
  row('in', 'claude-windows', LEAD, 'note', 'IN PLACE VERIFIED', 'goal/G100.1'),
  row('in', 'claude-windows', LEAD, 'ask', 'ready: go?', 'goal/G100.1'),
  row('in', 'wsl-claude', WSL, 'note', 'wsl to Andy alone, unseen', ''),
];

const posted = [];
// WHAT WAITS ON ANDY IS THE DESK SERVER'S COUNT, on the goal row (desk/G2.6).
const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(log), 'seen.json': JSON.stringify({ rows: {}, team: 0, agents: {} }) });
fake.items = [{ id: 'goal/G100', title: 'The goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false, design: false, waiting: 1 }];
const doc = fakeDocument();
const root = fakeElement('container');
load(DESK, doc).mount(root, {
  // A seen.json that has seen nothing. The shell's desk.js reads no files;
  // the desk server's seen values come from deskFake (fromFiles above).
  fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; }, saveFile: function () { return Promise.resolve(); } },
  escapeHtml: spirit.core.util.escapeHtml,
  verb: fake.verb,
  onPublished: function () {}, onPacket: function () {},
  peerPost: function (app, key, body) { posted.push({ key: key, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
  callDialog: function () { return new Promise(function () {}); },
});

test.startTest('desk/G1.2: one tab per agent inside Team, the lead marked');
settle().then(function () {
  const tabs = doc.getElementById('desk-tabs');
  // The strip as drawn: there is no Team tab to click first.
  const strip = root.innerHTML + tabs.innerHTML;

  test.subHeading('T1: Lead is no longer a top tab, and no agent tab stands in its place; no Team or Apps tab (goal/G43.22)');
  if (/data-tab="list"/.test(strip) && !/data-tab="lead"/.test(strip) && !/data-agent=/.test(root.innerHTML + tabs.innerHTML)) test.check('no Lead top tab, no agent tab');
  else test.fail('top Lead tab ' + /data-tab="lead"/.test(strip) + '; agent tabs: ' + /data-agent=/.test(root.innerHTML) + '; list tab drawn ' + /data-tab="list"/.test(strip));
  if (/data-tab="list"/.test(strip) && !/data-tab="team"/.test(strip) && !/data-tab="apps"/.test(strip)) test.check('no Team tab and no Apps tab');
  else test.fail('goal/G43.22: the strip still holds ' + (strip.match(/data-tab="(team|apps)"/g) || ['no list tab']).join(', '));
  return settle().then(function () {
    test.subHeading('T5: the List tab carries the count of rows waiting on Andy');
    const listLabel = (tabs.innerHTML.match(/data-tab="list"[^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/button>/) || ['', ''])[1];
    if (/\(1\)/.test(listLabel)) test.check('List shows (1): one row asks Andy');
    else test.fail('List tab label: ' + JSON.stringify(listLabel));

    test.subHeading('T7: renaming is its own button; the dialog shows no name box until it is pressed');
    const ddDoc = fakeDocument();
    const dd = load(DETAILS, ddDoc);
    const box = fakeElement('dd');
    try {
      dd.mount(box, { escapeHtml: spirit.core.util.escapeHtml, onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
        fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
      if (dd.open) dd.open({ id: 'goal/G100.1', row: { id: 'goal/G100.1', title: 'Asks Andy' }, thread: [], agents: {}, session: [], rules: [] });
    } catch (e) { /* drawn below */ }
    // The dialog draws its frame into #dd-body, not into the container; the
    // Rename row is redrawn into #dd-name-row on every draw (desk/G1.12).
    const html = ddDoc.getElementById('dd-body').innerHTML + ddDoc.getElementById('dd-name-row').innerHTML;
    if (!/id="dd-name"/.test(html) && /id="dd-rename"/.test(html)) test.check('no name box on opening, a Rename button instead');
    else test.fail('dialog on opening: name box ' + /id="dd-name"/.test(html) + ', rename button ' + /id="dd-rename"/.test(html));
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
