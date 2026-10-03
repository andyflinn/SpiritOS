'use strict';

// goal/G2.4: the Team tab shows who is working. Red on today's tree. Depends on goal/G2.3 (the server's state).
//   Andy: "in the [team] tab. every agents tab has a blinking border while it's working.", "i can then check the
//   tabs in team", and the motive: "i get frustrated if i think the agent ignores my while idle. while an agent is
//   working, i should leave it alone."
// The contract the builder follows (the shapes this red fixes, argued in goal/G2.4 before building):
//   1. The goal row's facts carry working: [names], the agents the server (G2.3) holds as working, beside live.
//   2. An agent's tab inside Team carries data-working="1" while its name is in that list; All and the idle
//      agents carry none; the shell's markup declares the blink for [data-working] (a CSS animation).
//   3. The mark follows the publish: a goal row published with the name gone redraws the strip without the
//      mark, and the List asks nothing to learn it — no pulling.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.4: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const CW_KEY = 'MCowBQYDK2VwAyEAdeskWorkingTestPeerCWAAAAAAAAAAAAAAAA=';
const WSL_KEY = 'MCowBQYDK2VwAyEAdeskWorkingTestPeerWSAAAAAAAAAAAAAAAA=';

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function mount(answers) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  const subs = [];
  b.mount(fakeElement('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) asked.push(v);
      return Promise.resolve({ status: 200, body: answers[v] || { change: 1 } });
    },
    onPublished: function (fn) { subs.push(fn); return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return { doc: doc, asked: asked, publish: function (o) { subs.forEach(function (fn) { fn(o); }); } };
}
// A goal row as the server labels it; `working` is the field this red fixes.
function goalRow(working) {
  return { id: 'g/G1', title: 'Round', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false,
    design: false, waiting: 0, live: ['claude-windows', 'wsl-claude'], working: working };
}
function line(key, from, peer) {
  return { key: key, at: '2026-10-02T01:00:00.000Z', dir: 'in', from: from, peer: peer, kind: 'note', text: 'hello', todo: 'team/chat' };
}

test.startTest('goal/G2.4: the Team tab shows who is working');

(async function () {
  const list = mount({
    'items.search': { items: [{ key: 'g/G1', label: JSON.stringify(goalRow(['claude-windows'])) }], more: false },
    'log.search': { items: [
      { key: 'l1', label: JSON.stringify(line('l1', 'claude-windows', CW_KEY)) },
      { key: 'l2', label: JSON.stringify(line('l2', 'wsl-claude', WSL_KEY)) }], more: false },
  });
  await settled();
  // THE MARK IS ON THE BUBBLES (goal/G3.12): the agent tabs inside Team went; the bubbles sit in the tab row.
  const strip = function () { return list.doc.getElementById('desk-tabs').innerHTML; };
  const tabOf = function (name) { return (strip().match(new RegExp('<[^>]*data-bubble="' + name + '"[^>]*>')) || [''])[0]; };

  test.subHeading('1. a working agent\'s bubble carries the mark, the other none');
  if (/data-working="1"/.test(tabOf('claude-windows')) && tabOf('wsl-claude') && !/data-working/.test(tabOf('wsl-claude'))) {
    test.check('claude-windows (working) is marked; wsl-claude is not');
  } else test.fail(OWED + 'the bubbles read ' + JSON.stringify(strip().slice(0, 300)));

  test.subHeading('2. the blink is declared for the mark');
  const src = fs.readFileSync(DESK, 'utf8');
  if (/\[data-working/.test(src) && /animation|@keyframes|blink/.test(src)) test.check('the shell declares an animation for [data-working]');
  else test.fail(OWED + 'no blink declared for [data-working] in shell/desk/desk.js');

  test.subHeading('3. the mark follows the publish, no pulling');
  const asksBefore = list.asked.length;
  list.publish({ change: 12, verb: 'press', item: goalRow([]), listed: true, rows: [goalRow([])] });
  await settled();
  if (!/data-working/.test(tabOf('claude-windows')) && list.asked.length === asksBefore) {
    test.check('a goal row published with working empty clears the mark, and the List asked nothing for it');
  } else test.fail(OWED + (/data-working/.test(tabOf('claude-windows')) ? 'the mark stayed after the publish' : 'the List pulled ' + (list.asked.length - asksBefore) + ' asks to learn it'));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
