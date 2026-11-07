'use strict';

// goal/G3.12: the front page of Desk — the agent bubbles sit beside the tabs, and no direct agent tabs are drawn.
// Andy, 2026-10-03: "the main botton row now reads: [List] [Team] [Musings], those are buttons, and Info
// [Agent1-status] [Agent2-status]... Where the Agent - bubbles are highlighted with a red-blinking border when busy."
// Since goal/G43.22 there is no Team or Apps tab and no group chat goal/G0 (Andy, the box, Q5: "G0 goes, from ui and
// server, kept in database."; "the apps and plugin system goes."): the tab row is List and Rules (desk.js deskDrawTabs).
// The contract:
//   1. THE BUBBLES. The tab row #desk-tabs holds, after the tab buttons, one element per agent the goal row
//      says is live (its `live`), each marked data-bubble="<name>" and carrying the name; one the goal row says is
//      working (its `working`) also carries data-working="1", the mark the blink is declared on. They show on
//      every tab, the List included, and follow the goal row's publish.
//   2. STATE ONLY. A click on a bubble asks the server nothing, posts nothing and changes no tab.
//   3. NO TEAM. No element with data-agent is drawn anywhere, no Team tab, chat or input, and nothing is asked of
//      goal/G0.
//   4. ONE PIECE OF CODE. shell/desk/desk.js has no deskDrawAgentTabs, no deskDirectChat, no deskSend, and draws
//      no data-agent= attribute: the direct tabs are gone, not hidden.
// Not asserted: the look of a bubble, the word Info or its place. deskAgentTabs.js (desk/G1.2) asserts the direct
// tabs inside Team that this file holds are gone.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G3.12: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const GROUP = 'goal/G0';   // the group chat, gone with goal/G43.22: nothing may ask it

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
  return JSON.stringify(Object.assign({ id: 'goal/G100.1', title: 'Alpha', goal: 'goal/G100', status: '', with: '', buttons: ['go'],
    blocking: [], blocked: [], alone: false, star: false, go: false }, over || {}));
};
const goalRow = function (over) {
  return label(Object.assign({ id: 'goal/G100', title: 'The goal', goal: '', buttons: [], design: false, waiting: 0,
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
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk({ call: name, args: body || {} }) || {}).desk;
      if (ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: [{ key: 'goal/G100', label: goalRow() }, { key: 'goal/G100.1', label: label() }], more: false } });
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
  // List and Rules: no Musings (goal/G27.3), no Apps or Team (goal/G43.22; Andy: "the apps and plugin system goes.").
  const threeTabs = /data-tab="list"/.test(t0) && /data-tab="rules"/.test(t0) && !/data-tab="apps"/.test(t0) && !/data-tab="team"/.test(t0) && !/data-tab="musings"/.test(t0);
  const cw = bubble(t0, 'claude-windows');
  const wsl = bubble(t0, 'wsl-claude');
  if (threeTabs && cw && wsl) test.check('List and Rules, no Apps, Team or Musings, then a bubble for each live agent, drawn on the List tab');
  else test.fail(OWED + 'the tab row: ' + JSON.stringify(t0.slice(0, 400)));
  if (wsl && /data-working="1"/.test(wsl) && cw && !/data-working="1"/.test(cw)) test.check('the working agent\'s bubble carries data-working="1", the other\'s does not');
  else test.fail(OWED + 'working marks: wsl ' + JSON.stringify(wsl) + ', cw ' + JSON.stringify(cw));
  const tabOrder = t0.indexOf('data-tab="rules"') < t0.indexOf('data-bubble=');
  if (tabOrder) test.check('the bubbles come after the tab buttons');
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

  test.subHeading('3. no Team: no tab, no input, nothing asked of the group chat (goal/G43.22)');
  p.click('desk-tabs', { 'data-tab': 'team' });
  await settled();
  const drawn = p.html();
  if (!/data-agent="/.test(drawn) && !/data-tab="team"/.test(p.tabs()) && !/desk-team/.test(drawn)) test.check('no Team tab, no agent tab and no Team chat or input is drawn, even after a press on a team tab');
  else test.fail('goal/G43.22: still drawn: ' + JSON.stringify((drawn.match(/<[^>]*(data-agent="|data-tab="team"|desk-team)[^>]*>/g) || []).slice(0, 4)));
  const groupAsks = p.asked.filter(function (a) { return a.args && a.args.id === GROUP; });
  if (p.asked.length && !groupAsks.length && !p.posted.length) test.check('of ' + p.asked.length + ' asks none names goal/G0, and nothing was posted');
  else test.fail('goal/G43.22: asks naming goal/G0 ' + JSON.stringify(groupAsks).slice(0, 200) + ', posted ' + JSON.stringify(p.posted).slice(0, 200));

  test.subHeading('4. one piece of code: the direct tabs are gone, not hidden');
  const src = code(DESK);
  const left = ['deskDrawAgentTabs', 'deskDirectChat', 'deskSend(', 'data-agent='].filter(function (w) { return src.indexOf(w) !== -1; });
  if (!left.length) test.check('shell/desk/desk.js has no deskDrawAgentTabs, deskDirectChat, deskSend or data-agent=');
  else test.fail(OWED + 'shell/desk/desk.js still has ' + left.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
