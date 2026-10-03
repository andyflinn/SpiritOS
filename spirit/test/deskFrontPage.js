'use strict';

// goal/G3.12: the front page of Desk re-arranged — the agent bubbles move up beside the tabs, Team is the group chat.
// Andy, 2026-10-03 (a musing, then "add the items" under goal/G3): "the main botton row now reads: [List] [Team]
// [Musings], those are buttons, and Info [Agent1-status] [Agent2-status]... Where the Agent - bubbles are
// highlighted with a red-blinking border when busy." and "the The team tab will only show the team chat interface
// (Chat of goal 'desk/G0.0')". His Go is his go-all on goal/G3 (2026-10-03).
// The shape, named by claude-windows under goal/G3 and not contradicted: the bubbles beside Info show state only
// (a click does nothing); the direct tabs and the direct line go; Team is the group chat alone.
// In the tree today (e3506e6b): the tab strip is List, Team, Musings (shell/desk/desk.js deskDrawTabs); the agents
// are tabs INSIDE Team (#desk-agent-tabs, deskDrawAgentTabs) with the busy blink on data-working (goal/G2.4); a
// line typed in an agent's tab leaves as an agents packet (deskSend, goal/G1.2); All is the group chat (goal/G3.10).
// The contract (wsl-claude's reading; shapes it fixes are named):
//   1. THE BUBBLES. The tab row #desk-tabs holds, after the three tab buttons, one element per agent the goal row
//      says is live (its `live`), each marked data-bubble="<name>" and carrying the name; one the goal row says is
//      working (its `working`) also carries data-working="1", the mark the blink is declared on. They show on
//      every tab, the List included, and follow the goal row's publish.
//   2. STATE ONLY. A click on a bubble asks the server nothing, posts nothing and changes no tab.
//   3. TEAM IS THE GROUP CHAT. No element with data-agent is drawn anywhere, on Team or elsewhere; what he types
//      under Team is one chat.add on desk/G0.0 and no packet to anybody, with no tab to pick first.
//   4. ONE PIECE OF CODE. shell/desk/desk.js has no deskDrawAgentTabs, no deskDirectChat, no deskSend, and draws
//      no data-agent= attribute: the direct tabs are gone, not hidden.
// Not asserted (the builder's): the look of a bubble, the word Info or its place, what becomes of the recorded
// direct lines of the past and of the agents packet handler (onPacket), whether deskAgents stays for the keys.
// deskAgentTabs.js (goal/G1.2) asserts the direct tabs; it is the builder's to retire or bring along.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G3.12: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const GROUP = 'desk/G0.0';

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

const label = function (over) {
  return JSON.stringify(Object.assign({ id: 'f/G1.1', title: 'Alpha', goal: 'f/G1', status: '', with: '', buttons: ['go'],
    blocking: [], blocked: [], alone: false, star: false, go: false }, over || {}));
};
const goalRow = function (over) {
  return label(Object.assign({ id: 'f/G1', title: 'The goal', goal: '', buttons: [], design: false, waiting: 0,
    live: ['claude-windows', 'wsl-claude'], working: ['wsl-claude'], agents: {} }, over || {}));
};
function page() {
  const doc = fakeDocument();
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  const posted = [];
  const published = [];
  behavior.mount(fakeElement('container'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: [{ key: 'f/G1', label: goalRow() }, { key: 'f/G1.1', label: label() }], more: false } });
        if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], more: false } });
        return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}', change: 1 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function (fn) { published.push(fn); return function () {}; },
    onPacket: function () { return function () {}; },
    peerPost: function (app, to, body) { posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
    callDialog: function () { return new Promise(function () {}); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return {
    doc: doc, asked: asked, posted: posted,
    html: function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); },
    tabs: function () { return doc.getElementById('desk-tabs').innerHTML; },
    click: function (id, attrs) { doc.getElementById(id).fire('click', { target: target(attrs), currentTarget: doc.getElementById(id), preventDefault: function () {} }); },
    publish: function (obj) { published.forEach(function (fn) { fn(obj); }); },
  };
}
const bubble = function (html, name) { return (html.match(new RegExp('<[^>]*data-bubble="' + name + '"[^>]*>')) || [''])[0]; };
const tabOn = function (html, tab) { return new RegExp('data-tab="' + tab + '"[^>]*aria-selected="true"').test(html); };

test.startTest('goal/G3.12: the front page — agent bubbles beside the tabs, Team is the group chat');

(async function () {
  test.subHeading('1. the bubbles sit in the tab row, on the List tab too, and follow the goal row');
  const p = page();
  await settled();
  const t0 = p.tabs();
  const threeTabs = /data-tab="list"/.test(t0) && /data-tab="team"/.test(t0) && /data-tab="musings"/.test(t0);
  const cw = bubble(t0, 'claude-windows');
  const wsl = bubble(t0, 'wsl-claude');
  if (threeTabs && cw && wsl) test.check('List, Team, Musings, then a bubble for each live agent, drawn on the List tab');
  else test.fail(OWED + 'the tab row: ' + JSON.stringify(t0.slice(0, 400)));
  if (wsl && /data-working="1"/.test(wsl) && cw && !/data-working="1"/.test(cw)) test.check('the working agent\'s bubble carries data-working="1", the other\'s does not');
  else test.fail(OWED + 'working marks: wsl ' + JSON.stringify(wsl) + ', cw ' + JSON.stringify(cw));
  const tabOrder = t0.indexOf('data-tab="musings"') < t0.indexOf('data-bubble=');
  if (tabOrder) test.check('the bubbles come after the three tab buttons');
  else test.fail(OWED + 'a bubble is drawn before the tab buttons');
  p.publish({ change: 20, verb: 'agent.state', item: JSON.parse(goalRow({ working: ['claude-windows'] })) });
  await settled();
  const t1 = p.tabs();
  if (/data-working="1"/.test(bubble(t1, 'claude-windows')) && !/data-working="1"/.test(bubble(t1, 'wsl-claude'))) test.check('a published goal row moves the working mark to the other bubble');
  else test.fail(OWED + 'after the publish: ' + JSON.stringify(t1.slice(0, 400)));
  p.publish({ change: 21, verb: 'agent.state', item: JSON.parse(goalRow({ live: ['claude-windows'], working: [] })) });
  await settled();
  if (bubble(p.tabs(), 'claude-windows') && !bubble(p.tabs(), 'wsl-claude')) test.check('an agent the goal row no longer lists as live loses its bubble');
  else test.fail(OWED + 'after wsl-claude left: ' + JSON.stringify(p.tabs().slice(0, 400)));

  test.subHeading('2. a bubble shows state only');
  const asks = p.asked.length;
  p.click('desk-tabs', { 'data-bubble': 'claude-windows' });
  await settled();
  if (p.asked.length === asks && !p.posted.length && tabOn(p.tabs(), 'list')) test.check('a click on a bubble asks nothing, posts nothing and leaves the List tab on');
  else test.fail(OWED + 'the bubble click: asked ' + (p.asked.length - asks) + ', posted ' + p.posted.length + ', List on: ' + tabOn(p.tabs(), 'list'));

  test.subHeading('3. Team is the group chat and nothing else');
  p.click('desk-tabs', { 'data-tab': 'team' });
  await settled();
  if (!/data-agent="/.test(p.html())) test.check('no agent tab is drawn under Team: no All, no direct tab');
  else test.fail(OWED + 'Team still draws agent tabs: ' + JSON.stringify((p.html().match(/<[^>]*data-agent="[^>]*>/g) || []).slice(0, 4)));
  p.doc.getElementById('desk-team-say').value = 'to the team';
  p.posted.length = 0;
  const before = p.asked.length;
  p.doc.getElementById('desk-team-send').fire('click', {});
  await settled();
  const added = p.asked.slice(before).filter(function (a) { return a.verb === 'chat.add'; });
  if (added.length === 1 && added[0].args.id === GROUP && added[0].args.text === 'to the team' && !p.posted.length) test.check('his line under Team is one chat.add on desk/G0.0 and no packet');
  else test.fail(OWED + 'his line went as ' + JSON.stringify(p.asked.slice(before)) + ', posted ' + JSON.stringify(p.posted));

  test.subHeading('4. one piece of code: the direct tabs are gone, not hidden');
  const src = code(DESK);
  const left = ['deskDrawAgentTabs', 'deskDirectChat', 'deskSend(', 'data-agent='].filter(function (w) { return src.indexOf(w) !== -1; });
  if (!left.length) test.check('shell/desk/desk.js has no deskDrawAgentTabs, deskDirectChat, deskSend or data-agent=');
  else test.fail(OWED + 'shell/desk/desk.js still has ' + left.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
