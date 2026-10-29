'use strict';

// spirit/test/deskDetailsPanels.js
// goal/G30.8, "Desk item details: icon strip, fixed halves, lazy panels". Red on today's tree; claude-windows writes it
// and builds it (one agent).
// The item's box (v5), in short:
//   - The header (the button bar) stays, minus the yellow bubble "How you check it: no checks written yet.", which goes.
//   - Below it the upper half, about 30% of the page height, fixed: a strip of icons down its left edge, the wide
//     section to their right showing one panel at a time.
//   - The panels, one icon each: the box (shown on open), the red Qs, the files with their grants, the blocks. The
//     icons: box 📃, red Qs ❌, blocks 🪠, files 📂; kernel.js ICON gains PAGE 📃 and PLUNGER 🪠.
//   - A panel asks for its own content only when its icon is pressed.
//   - An icon blinks while something in its panel waits on Andy: a red Q not answered, a grant not given.
//   - Each red Q has a remove button beside it, which clears that Q (Andy's to press).
//   - Below: the chat search, the chat input, then the chat history, as before. Fixed heights, so nothing moves.
// NAMED HERE where the box names none:
//   - The upper half is #dd-upper (height 30vh, its own scroll); the icons are buttons data-panel="box|qs|blocks|files"
//     in #dd-icons; the panel is #dd-panel. A blinking icon carries the class dd-blink.
//   - The blink is read from item.checks, asked on open with the box and the chat; block.targets is asked only when 🪠
//     is pressed.
//   - The remove button is data-qclear="<Qn>"; it sends his clear, the chat line "<Qn>: clear" (desk clearOf).
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G30.8: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
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
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function target(id, attrs) {
  const a = attrs || {};
  return { id: id, getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(a, n) ? a[n] : null; },
    closest: function () { return null; }, parentNode: null };
}
function dialog(answer) {
  const doc = fakeDocument();
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk({ call: name, args: body || {} }) || {}).desk;
      if (ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'block.targets') return Promise.resolve({ status: 200, body: { items: [] } });
        if (v === 'item.get' || v === 'item.box' || v === 'item.checks' || v === 'item.chat' || v === 'item.files') return Promise.resolve({ status: 200, body: answer });
        return Promise.resolve({ status: 200, body: { change: 1 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const html = function (id) { return doc.getElementById(id).innerHTML; };
  const page = function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); };
  const click = function (id, attrs) { doc.getElementById('dd-body').fire('click', { target: target(id, attrs), preventDefault: function () {} }); };
  return { dd: dd, asked: asked, html: html, page: page, click: click };
}
const facts = JSON.stringify({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: '', buttons: ['done'],
  blocking: ['t/G1'], blocked: [], files: [{ path: 'spirit/run/spirit/hub.js', by: 'claude-windows', core: true }] });
function answer(checks) {
  // goal/G33.8: item.files answers the file the grant covers, so the files panel draws both.
  return { item: facts, box: 'BOX-TEXT', version: 2, change: 7, checks: checks, chat: [{ by: 'andy', at: '2026-10-20T10:00:00Z', text: 'CHAT-HELLO' }],
    files: [{ path: 'spirit/run/spirit/hub.js', by: 'claude-windows', core: true }], filesMore: false };
}

(async function () {
  test.startTest('goal/G30.8: the item details hold still: an icon strip, one panel at a time, the chat below');

  test.subHeading('1. the icons');
  const ICON = kernel.core.const.ICON;
  if (ICON.PAGE === '📃' && ICON.PLUNGER === '🪠' && ICON.NO === '❌' && ICON.OPENFOLDER === '📂') test.check('kernel.js ICON has PAGE 📃, PLUNGER 🪠, NO ❌ and OPENFOLDER 📂');
  else test.fail(OWED + 'ICON has PAGE ' + short(ICON.PAGE) + ', PLUNGER ' + short(ICON.PLUNGER));

  test.subHeading('2. the frame: a fixed upper half with its strip, the chat below');
  const Q = { number: 'Q1', kind: 'Q', words: 'WHICH-ONE', test: '', state: 'open', by: '', at: '' };
  const G = { number: 'G1', kind: 'G', words: 'core grant: js/hub.js', test: '', state: 'open', by: '', at: '' };
  const d = dialog(answer([Q, G]));
  d.dd.open({ id: 't/G1.2' });
  await settled();
  const body = d.html('dd-body');
  const upperAt = body.indexOf('id="dd-upper"');
  const searchAt = body.indexOf('id="dd-chat-search"');
  if (upperAt !== -1 && searchAt > upperAt && /id="dd-upper"[^>]*height:\s*30vh/.test(body) && body.indexOf('id="dd-icons"') !== -1 && body.indexOf('id="dd-panel"') !== -1)
    test.check('#dd-upper (30vh) holds #dd-icons and #dd-panel, above the chat search, input and history');
  else test.fail(OWED + 'the frame reads ' + short(body.slice(0, 400)));
  const icons = d.html('dd-icons');
  const has = ['box', 'qs', 'blocks', 'files'].every(function (p) { return icons.indexOf('data-panel="' + p + '"') !== -1; });
  if (has && icons.indexOf('📃') !== -1 && icons.indexOf('❌') !== -1 && icons.indexOf('🪠') !== -1 && icons.indexOf('📂') !== -1)
    test.check('the strip has its four icons: 📃 box, ❌ red Qs, 🪠 blocks, 📂 files');
  else test.fail(OWED + 'the strip reads ' + short(icons));
  if (!/How you check it/.test(d.page())) test.check('the yellow "How you check it" bubble is gone');
  else test.fail(OWED + 'the yellow bubble is still drawn');

  test.subHeading('3. one panel at a time, and only what it needs');
  if (/BOX-TEXT/.test(d.html('dd-panel')) && !/WHICH-ONE/.test(d.html('dd-panel'))) test.check('on open the panel is the box');
  else test.fail(OWED + 'the open panel reads ' + short(d.html('dd-panel')));
  // Andy, 2026-10-20: "the box no longer needs to be foldable, it is now space-limited and contained".
  if (!/data-fold="item"/.test(d.html('dd-panel')) && /id="dd-box-input"/.test(d.html('dd-panel'))) test.check('the box has no fold; its textarea fills the panel');
  else test.fail(OWED + 'the box still folds: ' + short(d.html('dd-panel')));
  if (!d.asked.some(function (a) { return a.verb === 'block.targets'; })) test.check('opening asks no block.targets');
  else test.fail(OWED + 'opening asked block.targets: ' + short(d.asked.map(function (a) { return a.verb; })));
  d.click('', { 'data-panel': 'qs' });
  await settled();
  if (/WHICH-ONE/.test(d.html('dd-panel')) && !/BOX-TEXT/.test(d.html('dd-panel'))) test.check('❌ shows the red Qs in place of the box');
  else test.fail(OWED + 'after ❌ the panel reads ' + short(d.html('dd-panel')));
  if (/data-qclear="Q1"/.test(d.html('dd-panel'))) test.check('each red Q has its remove button');
  else test.fail(OWED + 'no remove button beside Q1');
  d.click('', { 'data-qclear': 'Q1' });
  await settled();
  const cleared = d.asked.filter(function (a) { return a.verb === 'chat.add' && /^Q1: clear$/.test(String(a.args && a.args.text)); })[0];
  if (cleared) test.check('remove sends his clear, "Q1: clear"');
  else test.fail(OWED + 'remove sent ' + short(d.asked.slice(-2)));
  d.click('', { 'data-panel': 'blocks' });
  await settled();
  if (d.asked.some(function (a) { return a.verb === 'block.targets'; }) && /Blocking|Blocked by|Also blocks/.test(d.html('dd-panel'))) test.check('🪠 asks block.targets then, and shows the blocks');
  else test.fail(OWED + 'after 🪠: ' + short(d.html('dd-panel')));
  d.click('', { 'data-panel': 'files' });
  await settled();
  if (/hub\.js/.test(d.html('dd-panel')) && /data-grant="G1"/.test(d.html('dd-panel'))) test.check('📂 shows the files with their grants');
  else test.fail(OWED + 'after 📂: ' + short(d.html('dd-panel')));
  // goal/G33.8 (box v10, Andy: "the red grant buttons are still at the bottom of the file list"): the open grants and their
  // buttons come first, at the top, before the files.
  const filesPanel = d.html('dd-panel');
  const firstGrant = filesPanel.indexOf('data-grant=');
  const firstFile = filesPanel.indexOf('data-file=');
  if (firstGrant !== -1 && firstFile !== -1 && firstGrant < firstFile) test.check('the open grant\'s button comes before the first file');
  else test.fail('OWED by goal/G33.8: in the files panel the first grant button is at ' + firstGrant + ', the first file at ' + firstFile);

  test.subHeading('4. the icons say what waits on him');
  const blinkOf = function (dd, p) { return new RegExp('data-panel="' + p + '"[^>]*class="[^"]*dd-blink|class="[^"]*dd-blink[^"]*"[^>]*data-panel="' + p + '"').test(dd.html('dd-icons')); };
  if (blinkOf(d, 'qs') && blinkOf(d, 'files') && !blinkOf(d, 'box')) test.check('an open red Q blinks ❌, an open grant blinks 📂');
  else test.fail(OWED + 'the strip with Q1 and G1 open reads ' + short(d.html('dd-icons')));
  const quiet = dialog(answer([Object.assign({}, Q, { state: 'answered' }), Object.assign({}, G, { state: 'granted' })]));
  quiet.dd.open({ id: 't/G1.2' });
  await settled();
  if (!/dd-blink/.test(quiet.html('dd-icons'))) test.check('nothing waiting, nothing blinks');
  else test.fail(OWED + 'with nothing open the strip reads ' + short(quiet.html('dd-icons')));

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
