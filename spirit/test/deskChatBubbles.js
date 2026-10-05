'use strict';

// goal/G6.2: chat entries left-aligned, everyone's in bubbles 1em apart, in desk and deskDetails. Red on today's tree;
// wsl-claude wrote it from G6.2's box and does not build it.
//   Andy, FACE.md: "I want all my chat-log entries to be left-aligned, not right-aligned." / "i want chat log entries
//   for everybody to display in bubbles, separated vertically be 1em space." In goal/G6: "split as proposed"; his Go.
//   The box: "the item chats of desk and deskDetails (shell/desk, shell/deskDetails); layout and CSS only".
//
// THE CONTRACT:
//   C1 no chat line is right-aligned: no text-align right or end, no margin-left:auto, no flex-end on a line.
//   C2 every line, his and every agent's, is a bubble: an inline style with padding all round and a mark around the
//      whole line (a background, a full border, a border-radius or a box-shadow); a left bar alone is not one.
//   C3 consecutive bubbles are 1em apart: each carries 1em of vertical margin (margin-top, margin-bottom, or the
//      top or bottom of the margin shorthand).
//   Drawn where: Desk's Team (the group chat, desk.js deskGroupChat) and the dialog's chat (deskDetails.js ddChatHtml),
//   the two chats that draw his line right-aligned today (desk.js 731, deskDetails.js 250).
// LEFT OPEN, not asserted: the colours. FACE.md names none for these bubbles; his lines black today is not ruled away.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const OWED = 'OWED by goal/G6.2: ';
const AT = '2026-10-06T05:49:12.000Z';
const LINES = [{ by: 'andy', at: AT, text: 'his line, alpha' }, { by: 'claude-windows', at: AT, text: 'an agent line, beta' },
  { by: 'claude-ubuntu', at: AT, text: 'another agent, gamma' }];

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {}, offsetHeight: 40,
  };
  el.style.setProperty = function (k, v) { el.style[k] = v; };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() { const byId = {}; return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } }; }
function load(script, doc) {
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (b) { behavior = b; } }, core: spirit.core }, doc, {});
  return behavior;
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

// The element whose text holds each line, read with its own inline style: the nearest opening tag before the text
// that carries a style. A line's wrapper is what the eye sees as the line.
function lineWrappers(html) {
  return LINES.map(function (l) {
    const at = html.indexOf(l.text);
    if (at === -1) return { text: l.text, by: l.by, style: null };
    const before = html.slice(0, at);
    const re = /<([a-z]+)[^>]*?\bstyle\s*=\s*"([^"]*)"[^>]*>/gi;
    let m; let last = null;
    while ((m = re.exec(before))) last = m[2];
    return { text: l.text, by: l.by, style: last };
  });
}
function vertical1em(style) {
  if (/(?:^|[;\s])margin-(?:top|bottom)\s*:\s*1em\b/.test(style)) return true;
  const m = /(?:^|[;\s])margin\s*:\s*([^;]+)/.exec(style);
  if (!m) return false;
  const t = m[1].trim().split(/\s+/);
  return t[0] === '1em' || (t.length >= 3 && t[2] === '1em');
}
function rightAligned(style) {
  return /text-align\s*:\s*(right|end)\b/.test(style) || /margin-left\s*:\s*auto\b/.test(style) || /(align-self|justify-content|justify-self)\s*:\s*(flex-end|end|right)\b/.test(style);
}
// A bubble is closed all round: padding on every side (the padding shorthand) and a mark around the whole line
// (a background, a full border, a border-radius or a box-shadow). The agents' left bar of today (border-left,
// padding-left) is a bar, not a bubble.
function bubble(style) {
  return /(?:^|[;\s])padding\s*:/.test(style) && /(?:^|[;\s])(background(?:-color)?|border|border-radius|box-shadow)\s*:/.test(style);
}
function judge(where, html) {
  const w = lineWrappers(html);
  const missing = w.filter(function (x) { return x.style === null; });
  if (missing.length) { test.fail(OWED + where + ': lines not drawn with an inline style: ' + missing.map(function (x) { return x.by; }).join(', ') + ' — drew: ' + html.replace(/\s+/g, ' ').slice(0, 240)); return; }
  const right = w.filter(function (x) { return rightAligned(x.style); });
  if (!right.length) test.check('C1 ' + where + ': no line is right-aligned, his included');
  else test.fail(OWED + 'C1 ' + where + ': right-aligned: ' + right.map(function (x) { return x.by + ' {' + x.style + '}'; }).join('; '));
  const flat = w.filter(function (x) { return !bubble(x.style); });
  if (!flat.length) test.check('C2 ' + where + ': every line, his and the agents\', is a bubble (padding and a visual mark)');
  else test.fail(OWED + 'C2 ' + where + ': not bubbles: ' + flat.map(function (x) { return x.by + ' {' + x.style + '}'; }).join('; '));
  const tight = w.filter(function (x) { return !vertical1em(x.style); });
  if (!tight.length) test.check('C3 ' + where + ': every bubble carries 1em of vertical margin');
  else test.fail(OWED + 'C3 ' + where + ': without 1em vertical margin: ' + tight.map(function (x) { return x.by + ' {' + x.style + '}'; }).join('; '));
}

test.startTest('goal/G6.2: chat entries left-aligned, everyone in bubbles 1em apart');

(async function () {
  test.subHeading('The dialog (deskDetails): an item\'s chat');
  const ddDoc = fakeDocument();
  const dd = load(DETAILS, ddDoc);
  const api = { escapeHtml: spirit.core.util.escapeHtml, onPacket: function () {}, onPublished: function () {}, closeDialog: function () {}, setScreenTitle: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    verb: function () {
      return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 'test/G1.1', title: 'Chat', goal: 'test/G1', status: '', with: '',
        buttons: [], blocking: [], blocked: [], alone: false }), box: '', version: 0, change: 1, checks: [], chat: LINES.slice() } });
    } };
  dd.mount(fakeElement('dd'), api);
  dd.open({ id: 'test/G1.1' });
  await settle(); await settle();
  judge('dialog', ddDoc.getElementById('dd-chat').innerHTML);

  test.subHeading('Desk, Team (the group chat)');
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': '[]', 'seen.json': JSON.stringify({ rows: {}, team: 0, agents: {} }) });
  const verb = function (name, body) {
    const asked = name === 'jobs.api' && body && body.ask && body.ask.desk && body.ask.desk['item.chat'];
    if (asked && asked.id === 'desk/G0.0') return Promise.resolve({ status: 200, body: { chat: LINES.slice(), chatMore: false } });
    return fake.verb(name, body);
  };
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? '[]' : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: spirit.core.util.escapeHtml, verb: verb, onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settle();
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: { getAttribute: function (n) { return n === 'data-tab' ? 'team' : null; }, parentNode: null, closest: function () { return null; } }, currentTarget: tabs });
  await settle();
  judge('Team', doc.getElementById('desk-team').innerHTML);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () { test.reportSuccessFailureCount(); });
