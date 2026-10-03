'use strict';

// goal/G3.8: the Desk page stops nudging; the desk server does it now.
// The box: "the page s nudge to agents after a press (shell/desk/desk.js 448, packet name agents) is removed; the
// desk server s nudge of G3.5 replaces it. A test asserts the page posts no changed packet." Check: "green when a
// press reaches a listening agent with the page s nudge gone." Turn: wsl-claude writes the red, claude-windows builds.
// In the tree today (3ca46cac): deskPress posts {kind: 'changed'} to every live agent once the server has answered
// (shell/desk/desk.js 456-460), and the item dialog does the same after every write but seen, through ddNudge
// (shell/deskDetails/deskDetails.js 50-57, 63); the page opens the dialog with `agents: deskLiveAgents()` for that
// nudge alone (desk.js 813). The server's own nudge, one api packet {deskClient: {changed: {}}} to each agent heard
// from, is asserted by deskNudge.js (goal/G3.5): that is the "reaches a listening agent" half, already green.
// The contract (wsl-claude's reading of the box; the dialog is the page's, opened by it and handed its agents only
// for the nudge, so it is in):
//   1. A press from a row goes to the server as press {id, what} and posts no packet to anybody.
//   2. A press in the item dialog goes to the server and posts no packet.
//   3. Ticking a check in the dialog (check.set) posts no packet either: every write nudged, every one stops.
//   4. Andy's direct line to an agent still leaves as an agents packet: only the nudge goes.
//   5. The source of the page and the dialog carries no 'changed' packet: no `kind: 'changed'`, no ddNudge.
// Not asserted (the builder's): whether deskLiveAgents and the dialog's `agents` parameter stay for anything else.
// deskList.js asserted the old nudge (its point "after the server answered, the agent got one bare changed packet");
// that point is turned to this contract in the same commit.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G3.8: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const AGENT_KEY = 'MCowBQYDK2VwAyEAagentagentagentagentagentagentagen=';

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, checked: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function target(attrs) {
  const a = attrs || {};
  const t = { id: a.id || '', getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(a, n) ? a[n] : null; }, parentNode: null };
  t.closest = function (sel) {
    const m = /^\[([\w-]+)\]$/.exec(sel);
    return m && t.getAttribute(m[1]) !== null ? t : null;
  };
  return t;
}
function load(file, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(file, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
const changedPackets = function (posted) { return posted.filter(function (p) { return p.body && p.body.kind === 'changed'; }); };

// The page, with one live agent it has heard from (the goal row's live names him, a packet gave his key).
const label = function (over) {
  return JSON.stringify(Object.assign({ id: 't/G1.1', title: 'Alpha', goal: 't/G1', status: '', with: '', buttons: ['go'],
    blocking: [], blocked: [], alone: false, star: false }, over || {}));
};
const LIST = { items: [
  { key: 't/G1', label: label({ id: 't/G1', title: 'The goal', goal: '', buttons: [], design: false, waiting: 0, live: ['claude-windows'] }) },
  { key: 't/G1.1', label: label() },
], more: false };
function page() {
  const doc = fakeDocument();
  const behavior = load(DESK, doc);
  const asked = [];
  const posted = [];
  const packets = [];
  behavior.mount(fakeElement('container'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'items.search') return Promise.resolve({ status: 200, body: LIST });
        if (v === 'press') return Promise.resolve({ status: 200, body: { change: 12 } });
        if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], more: false } });
        return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}', change: 1 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; },
    onPacket: function (app, fn) { packets.push(fn); return function () {}; },
    peerPost: function (app, to, body) { posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
    callDialog: function () { return new Promise(function () {}); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return {
    doc: doc, asked: asked, posted: posted,
    click: function (id, attrs) { doc.getElementById(id).fire('click', { target: target(attrs), currentTarget: doc.getElementById(id), preventDefault: function () {} }); },
    arrive: function (from, key) { packets.forEach(function (fn) { fn({ from: from, kind: 'note', text: 'hello', todo: '' }, { hash: 'h-' + from, fromKey: key, sentAt: new Date().toISOString() }); }); },
  };
}

// The dialog, opened as the page opens it: {id, agents}.
function dialog() {
  const doc = fakeDocument();
  const dd = load(DETAILS, doc);
  const asked = [];
  const posted = [];
  const answer = { item: JSON.stringify({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: 'wsl-claude', buttons: ['done'], blocking: [], blocked: [], alone: false, star: false }),
    box: 'BOX', version: 2, change: 7, checks: [{ number: 'C1', kind: 'C', words: 'LOOK', test: '', state: 'open', by: '', at: '' }], chat: [] };
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'item.get') return Promise.resolve({ status: 200, body: answer });
        return Promise.resolve({ status: 200, body: { change: 8 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; },
    onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function (app, to, body) { posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return {
    dd: dd, asked: asked, posted: posted,
    click: function (id, attrs) { doc.getElementById('dd-body').fire('click', { target: Object.assign(target(attrs), { id: id, closest: function () { return null; } }), preventDefault: function () {} }); },
  };
}

test.startTest('goal/G3.8: the Desk page stops nudging; the desk server does it now');

(async function () {
  test.subHeading('1. a press from a row: to the server, and no packet to anybody');
  const l = page();
  await settled();
  l.arrive('claude-windows', AGENT_KEY);
  await settled();
  l.posted.length = 0;
  l.click('desk-top', { 'data-press': 'go', 'data-id': 't/G1.1' });
  await settled();
  const pressed = l.asked.filter(function (a) { return a.verb === 'press'; })[0];
  if (pressed && pressed.args.id === 't/G1.1' && pressed.args.what === 'go') test.check('Go! reached the server as press {id: t/G1.1, what: go}');
  else test.fail('the press did not reach the server: ' + JSON.stringify(l.asked));
  if (pressed && !l.posted.length) test.check('and the page posted nothing: no changed packet, to nobody');
  else test.fail(OWED + 'after the press the page posted ' + JSON.stringify(l.posted));

  test.subHeading('2. a press in the item dialog: to the server, and no packet');
  const d = dialog();
  d.dd.open({ id: 't/G1.2', agents: { 'claude-windows': { key: AGENT_KEY } } });
  await settled();
  d.posted.length = 0;
  d.click('dd-done');
  await settled();
  const ddPressed = d.asked.filter(function (a) { return a.verb === 'press'; })[0];
  if (ddPressed && ddPressed.args.id === 't/G1.2' && ddPressed.args.what === 'done') test.check('Done reached the server as press {id: t/G1.2, what: done}');
  else test.fail('the dialog\'s press did not reach the server: ' + JSON.stringify(d.asked));
  if (ddPressed && !changedPackets(d.posted).length) test.check('and the dialog posted no changed packet');
  else test.fail(OWED + 'after its press the dialog posted ' + JSON.stringify(d.posted));

  test.subHeading('3. a check ticked in the dialog: no packet either');
  d.posted.length = 0;
  d.click('', { 'data-check': 'C1' });
  await settled();
  const set = d.asked.filter(function (a) { return a.verb === 'check.set'; })[0];
  if (set && set.args.check === 'C1') test.check('the tick reached the server as check.set C1');
  else test.fail('the tick did not reach the server: ' + JSON.stringify(d.asked));
  if (set && !changedPackets(d.posted).length) test.check('and no changed packet followed it');
  else test.fail(OWED + 'after check.set the dialog posted ' + JSON.stringify(d.posted));

  test.subHeading('4. his direct line to an agent still leaves as a packet');
  l.click('desk-tabs', { 'data-tab': 'team' });
  await settled();
  l.click('desk-agent-tabs', { 'data-agent': 'claude-windows' });
  await settled();
  l.doc.getElementById('desk-team-say').value = 'for claude-windows alone';
  l.posted.length = 0;
  l.doc.getElementById('desk-team-send').fire('click', {});
  await settled();
  const line = l.posted.filter(function (p) { return p.to === AGENT_KEY && p.body && p.body.text === 'for claude-windows alone'; });
  if (line.length === 1 && l.posted.length === 1) test.check('one agents packet, his line, to that agent\'s key; nothing else');
  else test.fail('his direct line: posted ' + JSON.stringify(l.posted));

  test.subHeading('5. the source carries no changed packet');
  const pageSrc = code(DESK);
  const ddSrc = code(DETAILS);
  const left = [];
  if (/kind:\s*'changed'/.test(pageSrc)) left.push('shell/desk/desk.js posts kind: \'changed\'');
  if (/kind:\s*'changed'/.test(ddSrc)) left.push('shell/deskDetails/deskDetails.js posts kind: \'changed\'');
  if (/\bddNudge\b/.test(ddSrc)) left.push('deskDetails.js still has ddNudge');
  if (!left.length) test.check('neither the page nor the dialog posts a changed packet; ddNudge is gone');
  else test.fail(OWED + left.join('; '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
