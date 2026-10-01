'use strict';

// desk/G3.8: Close in the item dialog closes the dialog.
//   Andy: "oh, when i click on Close in the Detail dialog, the Dialog should close, since it doesn't exist in the list
//   anymore either."
// The contract the builder follows (claude-windows's picks where the box names no shape):
//   A click on #dd-close sends press {id, what: 'close'} (no by since apiAuth/G1.13: the desk takes the owner from his caller). Once the server has answered it without a
//   refusal, the dialog leaves through api.closeDialog(), the same way out as Back. A refused close leaves the dialog
//   open and says why. The other presses (done, go, reopen) keep the dialog open.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by desk/G3.8: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

function dialog(pressAnswer, buttons) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const presses = [];
  const closed = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'item.get') {
        return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'done', with: '',
          buttons: buttons, blocking: [], blocked: [], alone: false, star: false }), box: 'BOX', version: 1, change: 3, chatMore: false, checks: [], chat: [] } });
      }
      if (v === 'press') { presses.push(ask.press); return Promise.resolve(pressAnswer); }
      return Promise.resolve({ status: 200, body: { change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {},
    closeDialog: function (r) { closed.push(r === undefined ? null : r); },
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 't/G1.2', agents: {} });
  const click = function (id) { doc.getElementById('dd-body').fire('click', { target: { id: id, getAttribute: function () { return null; }, closest: function () { return null; } }, preventDefault: function () {} }); };
  return { presses: presses, closed: closed, click: click, doc: doc };
}

test.startTest('desk/G3.8: Close in the item dialog closes the dialog');

(async function () {
  test.subHeading('a close the server takes closes the dialog');
  const a = dialog({ status: 200, body: { change: 9 } }, ['close', 'reopen']);
  await settled();
  a.click('dd-close');
  await settled();
  const sent = a.presses[0];
  if (sent && sent.what === 'close' && sent.id === 't/G1.2' && sent.by === undefined) test.check('Close sent press {id, what: close}, no by (apiAuth/G1.13)');
  else test.fail('Close sent ' + JSON.stringify(a.presses));
  if (a.closed.length === 1) test.check('once the server took it, the dialog left through closeDialog');
  else test.fail(OWED + 'after a taken close, closeDialog was called ' + a.closed.length + ' times');

  test.subHeading('a refused close keeps the dialog open');
  const b = dialog({ status: 409, body: { ok: false, code: 'not-offered', error: 'not offered' } }, ['close', 'reopen']);
  await settled();
  b.click('dd-close');
  await settled();
  if (b.presses.length === 1 && !b.closed.length) test.check('a refused close leaves the dialog open');
  else test.fail(OWED + 'a refused close: presses ' + b.presses.length + ', closeDialog called ' + b.closed.length + ' times');

  test.subHeading('other presses keep it open');
  const c = dialog({ status: 200, body: { change: 9 } }, ['done']);
  await settled();
  c.click('dd-done');
  await settled();
  if (c.presses.length === 1 && c.presses[0].what === 'done' && !c.closed.length) test.check('Done does not close the dialog');
  else test.fail(OWED + 'Done: presses ' + JSON.stringify(c.presses) + ', closeDialog called ' + c.closed.length + ' times');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
