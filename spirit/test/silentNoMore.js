'use strict';

// NOTHING DOWNSTREAM FAILS SILENTLY EITHER.
//   Andy, 2026-09-30: "would have been diagnosed in an instant had the shell rejected the package", "and downstream
//   who else didn't do their job. think!", "and , like i said, this needs a test".
// The contract:
//   appServer.publish, given an object over its cap, publishes instead a small {dropped: {bytes, max}}, so every page
//   hears that an update was lost; the List asks items.search again and an open dialog reloads its item.
//   A refusal reaches his screen by its name, size and limit: the dialog and the List show the code, and for a size
//   refusal its bytes and max, never only "did not answer".

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appServer = require('../run/js/appServer.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function el(id) {
  let html = '';
  const e = { id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {},
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    fire: function (t, ev) { (e.listeners[t] || []).forEach(function (fn) { fn(ev || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; }, getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {} };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); } });
  return e;
}
function mount(file, verb) {
  const byId = {};
  let b = null;
  const subs = [];
  new Function('spirit', 'document', 'window', fs.readFileSync(file, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core },
    { getElementById: function (id) { return byId[id] || (byId[id] = el(id)); } }, {});
  b.mount(el('c'), {
    escapeHtml: kernel.core.util.escapeHtml, verb: verb,
    onPublished: function (fn) { subs.push(fn); return function () {}; }, onPacket: function () {}, onReconnect: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return { b: b, byId: byId, publish: function (o) { subs.forEach(function (fn) { fn(o); }); },
    page: function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML + ' ' + byId[k].textContent; }).join('\n'); } };
}

test.startTest('nothing downstream fails silently');

(async function () {
  test.subHeading('an update too large to publish is said, not dropped');
  const reported = [];
  const real = kernel.core.jobs.report;
  kernel.core.jobs.report = function (patch) { reported.push(patch); return Promise.resolve(); };
  const took = appServer.publish({ big: 'x'.repeat(70 * 1024) });
  await sleep(250);
  kernel.core.jobs.report = real;
  const last = (reported[reported.length - 1] || {}).app || {};
  if (last.dropped && last.dropped.bytes > last.dropped.max && Buffer.byteLength(JSON.stringify(last), 'utf8') < 1024) test.check('publish sent {dropped: {bytes: ' + last.dropped.bytes + ', max: ' + last.dropped.max + '}} instead');
  else test.fail('an oversized publish reported ' + JSON.stringify(reported).slice(0, 200) + ' (publish answered ' + took + ')');

  test.subHeading('a page that hears of a dropped update asks again');
  const asked = [];
  const list = mount(DESK, function (name, body) { const a = body.ask && body.ask.desk; if (a) asked.push(Object.keys(a)[0]); return Promise.resolve({ status: 200, body: { items: [], more: false, json: '' } }); });
  await settled();
  const before = asked.filter(function (v) { return v === 'items.search'; }).length;
  list.publish({ dropped: { bytes: 70000, max: 65536 } });
  await settled();
  if (asked.filter(function (v) { return v === 'items.search'; }).length === before + 1) test.check('the List asks items.search again');
  else test.fail('the List did not ask again after a dropped update');
  const dAsked = [];
  const dlg = mount(DETAILS, function (name, body) {
    const a = body.ask.desk; const v = Object.keys(a)[0]; dAsked.push(v);
    if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 't/G1', title: 'T', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }), version: 1, change: 3 } });
    return Promise.resolve({ status: 200, body: { box: '', version: 1, checks: [], chat: [], chatMore: false } });
  });
  dlg.b.open({ id: 't/G1', agents: {} });
  await settled();
  const g0 = dAsked.filter(function (v) { return v === 'item.get'; }).length;
  dlg.publish({ dropped: { bytes: 70000, max: 65536 } });
  await settled();
  if (dAsked.filter(function (v) { return v === 'item.get'; }).length === g0 + 1) test.check('an open dialog reloads its item');
  else test.fail('the dialog did not reload after a dropped update');

  test.subHeading('a refusal shows its name, size and limit');
  const refuse = { status: 502, body: { ok: false, code: 'app-answer-too-large', error: 'the app server\'s answer is too large to travel', extra: { bytes: 9001, max: 8377 } } };
  const d2 = mount(DETAILS, function () { return Promise.resolve(refuse); });
  d2.b.open({ id: 't/G1', agents: {} });
  await settled();
  const shown = d2.byId['dd-error'] ? d2.byId['dd-error'].textContent : '';
  if (/app-answer-too-large/.test(shown) && /9001/.test(shown) && /8377/.test(shown) && !/did not answer/.test(shown)) test.check('the dialog says: ' + shown);
  else test.fail('the dialog said ' + JSON.stringify(shown));
  const l2 = mount(DESK, function (name, body) { const a = body.ask && body.ask.desk; if (a && a['items.search']) return Promise.resolve(refuse); return Promise.resolve({ status: 200, body: { items: [], more: false, json: '' } }); });
  await settled();
  const top = l2.byId['desk-top'] ? l2.byId['desk-top'].innerHTML : '';
  if (/app-answer-too-large/.test(top) && /9001/.test(top) && /8377/.test(top)) test.check('the List says the refusal by name, size and limit');
  else test.fail('the List showed ' + JSON.stringify(top.replace(/<[^>]*>/g, ' ').slice(0, 200)));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
