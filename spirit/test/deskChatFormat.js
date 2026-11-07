'use strict';

// spirit/test/deskChatFormat.js
// CHAT LINES DRAWN READABLY — desk/G1.10.
//
//   Andy, in a dialog: "it would be nice if the chat log here would show
//   some nicer formatting", then "yes, that would make it much more
//   readable." Decided with the item: line breaks kept; short times
//   (05:49); '- ' lines as a list, backquoted text as code; a session post
//   as one line, not JSON. Only how a line is drawn; nothing on the wire.
//
// THE CONTRACT: the drawn markup of every chat, not a helper's name. The
// one chat the desk draws is the item dialog's (deskDetails); no Team tab or
// group chat goal/G0 is left (goal/G43.22). A time is the local HH:MM (this
// suite runs with TZ=UTC). What is drawn is still escaped: text is never markup.

process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');

const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
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
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (b) { behavior = b; } }, core: spirit.core }, doc, {});
  return behavior;
}
function settle() {
  return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

// One note that carries everything under test, and the minute it came.
const AT = '2026-09-29T05:49:12.000Z';
const NOTE = 'first line\nsecond line\n- item one\n- item two\nrun `node x.js` now <b>not bold</b>';

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
      return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 'goal/G100.1', title: 'Asks Andy', goal: 'goal/G100', status: '', with: '',
        buttons: [], blocking: [], blocked: [], alone: false, star: false }), box: '', version: 0, change: 1, checks: [],
        chat: [{ by: 'claude-windows', at: AT, text: NOTE }] } });
    } };
  dd.mount(fakeElement('dd'), api);
  dd.open({ id: 'goal/G100.1' });
  await settle();
  await settle();
  const ddChat = ddDoc.getElementById('dd-chat').innerHTML;
  report(checks('dialog', ddChat), ddChat);
  // No session check in the dialog: a session is the desk server's record, never a chat line (desk/G2.7).
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
