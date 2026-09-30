'use strict';

// spirit/test/deskChatFormat.js
// CHAT LINES DRAWN READABLY — desk/G1.10, written FIRST, red on today's
// code.
//
//   Andy, in a dialog: "it would be nice if the chat log here would show
//   some nicer formatting", then "yes, that would make it much more
//   readable." Decided with the item: line breaks kept; short times
//   (05:49); '- ' lines as a list, backquoted text as code; a session post
//   as one line, not JSON. Only how a line is drawn; nothing on the wire.
//
// THE CONTRACT (wsl-claude's, for claude-windows' build): the drawn markup
// of every chat, not a helper's name (claude-windows plans one shared
// formatter). Every chat: the dialog's (deskDetails), and Desk's Team (All),
// an agent's tab, and Musings. A time is the local HH:MM (this suite runs
// with TZ=UTC). What is drawn is still escaped: text is never markup.

process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const OWED = 'OWED by desk/G1.10: ';

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
function clickOn(container, attr, value) {
  const target = { getAttribute: function (n) { return n === attr ? value : null; }, parentNode: null };
  container.fire('click', { target: target, currentTarget: container });
}

// One note that carries everything under test, and the minute it came.
const AT = '2026-09-29T05:49:12.000Z';
const NOTE = 'first line\nsecond line\n- item one\n- item two\nrun `node x.js` now <b>not bold</b>';
const SESSION = JSON.stringify({ goal: { id: 'test/G1', title: 'The goal' }, rules: [],
  items: [{ id: 'test/G1.1', title: 'Asks Andy' }] });
let n = 0;
function row(dir, from, kind, text, todo) {
  n += 1;
  return { key: 'k' + n, at: AT, dir: dir, peer: dir === 'in' ? LEAD : LEAD, outcome: dir === 'in' ? 'received' : 'sent',
    from: from, kind: kind, text: text, todo: todo };
}

// What every chat must show for NOTE.
function checks(where, html) {
  const r = [];
  r.push(['T1', where + ': a line break is kept', /first line\s*(<br\s*\/?>|<\/(p|div|span)>)/.test(html) && !/first line second line/.test(html)]);
  r.push(['T2', where + ': the time reads 05:49, not the ISO stamp', /05:49/.test(html) && !/T05:49/.test(html)]);
  r.push(['T3', where + ': dash lines are a list', /<li[^>]*>\s*item one\s*<\/li>\s*<li[^>]*>\s*item two\s*<\/li>/.test(html) && /<ul/.test(html)]);
  r.push(['T3', where + ': backquoted text is code', /<code[^>]*>node x\.js<\/code>/.test(html) && !/`node x\.js`/.test(html)]);
  r.push(['guard', where + ': text is still escaped, never markup', /&lt;b&gt;not bold&lt;\/b&gt;/.test(html) && !/<b>not bold/.test(html)]);
  return r;
}
function report(list, html) {
  list.forEach(function (c) {
    if (c[2]) test.check(c[0] + ' ' + c[1]);
    else test.fail((c[0] === 'guard' ? '' : OWED) + c[0] + ' ' + c[1] + ' — drew: ' + String(html).replace(/\s+/g, ' ').slice(0, 220));
  });
}

test.startTest('desk/G1.10: chat lines drawn readably, in Desk and its dialogs');

(async function () {
  // ── The dialog ──────────────────────────────────────────────────────
  test.subHeading('The dialog (deskDetails): a note under a row');
  const ddDoc = fakeDocument();
  const dd = load(DETAILS, ddDoc);
  // Since desk/G2.7 the dialog reads its chat from the desk server (item.get), not a handed thread.
  const api = { escapeHtml: spirit.core.util.escapeHtml, onPacket: function () {}, onPublished: function () {}, closeDialog: function () {}, setScreenTitle: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    verb: function () {
      return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 'test/G1.1', title: 'Asks Andy', goal: 'test/G1', status: '', with: '',
        buttons: [], blocking: [], blocked: [], alone: false, star: false }), box: '', version: 0, change: 1, checks: [],
        chat: [{ by: 'claude-windows', at: AT, text: NOTE }] } });
    } };
  dd.mount(fakeElement('dd'), api);
  dd.open({ id: 'test/G1.1' });
  await settle();
  await settle();
  const ddChat = ddDoc.getElementById('dd-chat').innerHTML;
  report(checks('dialog', ddChat), ddChat);
  // T4 in the dialog went with desk/G2.7: a session is the desk server's record, never a chat line.

  // ── Desk ────────────────────────────────────────────────────────────
  const log = [
    row('in', 'claude-windows', 'session', SESSION, 'team/chat'),
    row('in', 'claude-windows', 'note', NOTE, 'team/chat'),
    row('in', 'claude-windows', 'note', NOTE, ''),
    row('out', 'andy', 'musing', 'note to self: ' + NOTE, ''),
  ];
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; },
      saveFile: function () { return Promise.resolve(); } },
    escapeHtml: spirit.core.util.escapeHtml,
    verb: require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(log), 'seen.json': JSON.stringify({ rows: {}, team: 0, agents: {} }) }).verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); },
  });
  await settle();
  const tabs = doc.getElementById('desk-tabs');
  const agents = doc.getElementById('desk-agent-tabs');
  clickOn(tabs, 'data-tab', 'team');

  test.subHeading('Desk, Team (All)');
  const team = doc.getElementById('desk-team').innerHTML;
  report(checks('Team', team), team);
  test.subHeading('T4 in Team: the session post is one line, never its JSON');
  if (/test\/G1/.test(team) && !/&quot;goal&quot;|"goal"|&quot;items&quot;|"items"/.test(team)) test.check('T4 Team: the session post names its goal, and no JSON shows');
  else test.fail(OWED + 'T4 Team: drew ' + team.replace(/\s+/g, ' ').slice(0, 220));

  test.subHeading("Desk, the lead's own tab");
  clickOn(agents, 'data-agent', 'claude-windows');
  const direct = doc.getElementById('desk-team').innerHTML;
  report(checks('agent tab', direct), direct);

  test.subHeading('Desk, Musings');
  const musings = doc.getElementById('desk-musings').innerHTML;
  report(checks('Musings', musings), musings);
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
