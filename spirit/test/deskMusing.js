'use strict';

// desk/G3.9: musings need no lead.
//   Andy: "First: Why would it require a lead to update my musings?" and "G3.9, yes."
// The contract the builder follows (claude-windows's shape, agreed):
//   Log in the Musings tab keeps the musing with the desk server alone: a log.add line of kind 'musing' (the text
//   still led by 'note to self: ') and a voice.add of what he typed. No agent is sent anything (no peerPost), and
//   no lead is needed: with none known, nothing says 'No lead known yet'. The box clears once it is kept.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by desk/G3.9: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

test.startTest('desk/G3.9: a musing is kept with the desk server, and needs no lead');

(async function () {
  // A Desk that has heard from no agent, so it knows no lead.
  const fake = require('./deskFake.js').create([]);
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const posted = [];
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function (app, to, body) { posted.push({ app: app, to: to, body: body }); return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: target({ 'data-tab': 'musings' }), currentTarget: tabs });
  doc.getElementById('desk-muse').value = 'MUSED-THOUGHT';
  doc.getElementById('desk-muse-send').fire('click', { target: target({ id: 'desk-muse-send' }) });
  await settled();

  test.subHeading('no lead is needed');
  const said = doc.getElementById('desk-muse-error').textContent;
  if (!/No lead known/.test(said)) test.check('Log says nothing about a lead');
  else test.fail(OWED + 'Log answered ' + JSON.stringify(said));

  test.subHeading('it is kept with the desk server');
  const lines = fake.calls.filter(function (c) { return c.verb === 'log.add'; }).map(function (c) { try { return JSON.parse(c.args.json); } catch (e) { return {}; } });
  const kept = lines.filter(function (l) { return l.kind === 'musing' && /^note to self: MUSED-THOUGHT$/.test(String(l.text)); });
  if (kept.length === 1) test.check('one log.add line of kind musing, "note to self: MUSED-THOUGHT"');
  else test.fail(OWED + 'log.add lines ' + JSON.stringify(lines.map(function (l) { return [l.kind, l.text]; })));
  if (fake.voice.some(function (v) { return /MUSED-THOUGHT/.test(v.text); })) test.check('and his voice holds what he typed');
  else test.fail(OWED + 'voice holds ' + JSON.stringify(fake.voice));
  if (doc.getElementById('desk-muse').value === '') test.check('the box clears once it is kept');
  else test.fail(OWED + 'the box still holds ' + JSON.stringify(doc.getElementById('desk-muse').value));

  test.subHeading('and no agent is sent anything');
  if (kept.length === 1 && !posted.length) test.check('it was kept, and no peerPost went out');
  else test.fail(OWED + (kept.length ? 'a musing was posted to ' + JSON.stringify(posted.map(function (p) { return p.to; })) : 'nothing was kept'));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
