'use strict';

// goal/G9.5: [Code✓] in the item Details button bar, so he sets an item's code state himself.
//   Andy, 2026-10-07 (musing "Desk Improvement: User creates goals and items without agents present"): "the item
//   Detail dialog has a check/toggle button, [Code✓], in it's button bar, where the user can set the Code-state of an
//   item, defining if the item is subject to the coding rules (write reds/code/verify)."
// Red on today's tree; wsl wrote it from G9.5's box and does not build it.
//
// WHAT IS TRUE TODAY (read at 53b4de83): the code mark is set by session.set alone (`if (x.code === true &&
// !one.subGoal) one.code = true;`), there is no 'code' press in PRESSES, and the dialog draws no toggle for it.
//
// THE SHAPE ASSERTED, from the item's box, for the builder to hold:
//   press {id, what: 'code'}   toggles the mark on a non-goal item, owner-only, and answers a change.
//   The dialog draws it in the button bar as [Code] / [Code ✓] (id dd-code), from item.get's `code` field, and the
//   click sends that press. A goal has no code state, so its Details draws none.
//   A SUB-GOAL NEVER TAKES THE MARK (goal/G6.8, Andy: an item becomes a sub-goal only when he says split, "and it can
//   no longer be marked as a coding item"), so the press is refused there; that rule is older than this item and is
//   held to here so the new press cannot walk around it.
// NOT ASSERTED: whether the mark may change after his Go (nothing in the box says, and his Go already fixed the
// phases) - a question is on the item instead.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.5: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskCodeToggleTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskCodeToggleTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// The dialog's open() chains item.get, then box, checks and chat, so settling needs real timer turns and not
// microtasks alone; eight setImmediate ticks left the button bar unpainted and would have made this suite pass
// vacuously.
async function settled() { for (let i = 0; i < 6; i++) await sleep(20); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
// A refusal counts only once the press exists: today's bad-request refuses every unknown press and proves nothing.
function refusedByPress(r) { return !took(r) && !(r.body && r.body.code === 'bad-request'); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  return b;
}
const facts = function (o) { return Object.assign({ id: '', title: '', goal: 'ct/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], claims: 0, code: false, asks: 0 }, o); };
// The dialog opened on one item, and what it sent: {html, presses}.
async function dialogOn(item) {
  const doc = fakeDocument();
  const dd = load(DETAILS, doc);
  const presses = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'press') presses.push(ask.press);
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(item), version: 1, change: 1 } });
      return Promise.resolve({ status: 200, body: { items: [], more: false, checks: [], chat: [], chatMore: false, box: '', version: 1, change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: item.id, agents: {} });
  await settled();
  const html = function () { return Object.keys(doc.byId).map(function (k) { return doc.byId[k].innerHTML; }).join('\n'); };
  return { doc: doc, html: html, presses: presses };
}

test.startTest('goal/G9.5: the Code toggle in the item Details button bar');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskcodetoggle-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }
async function item(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // THE WORLD: a goal with a plain item, a code item, and one he has split into a sub-goal.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'ct/G1', title: 'Code toggle' }, items: [
    { id: 'ct/G1.1', title: 'Plain', blocks: ['ct/G1'] },
    { id: 'ct/G1.2', title: 'A code item', blocks: ['ct/G1'], code: true },
    { id: 'ct/G1.3', title: 'Split later', blocks: ['ct/G1'] },
  ] }) }, CW);
  await call('session.set', { json: JSON.stringify({ goal: { id: 'ct/G1', title: 'Code toggle' }, split: ['ct/G1.3'], items: [
    { id: 'ct/G1.1', title: 'Plain', blocks: ['ct/G1'] },
    { id: 'ct/G1.2', title: 'A code item', blocks: ['ct/G1'], code: true },
    { id: 'ct/G1.3', title: 'Split later', blocks: ['ct/G1'] },
    { id: 'ct/G1.4', title: 'Under the sub-goal' },
  ] }) }, CW);
  const w1 = await item('ct/G1.1'); const w2 = await item('ct/G1.2'); const w3 = await item('ct/G1.3');
  if (w1.code === false && w2.code === true && w3.subGoal === true) test.check('the world: a plain item, a code item, and a sub-goal');
  else { test.fail('the world did not land: ' + short({ plain: w1.code, code: w2.code, sub: w3.subGoal })); return; }

  test.subHeading('1. his press marks an item code, and marks it back');
  const on = await call('press', { id: 'ct/G1.1', what: 'code' }, ANDY);
  if (took(on) && (await item('ct/G1.1')).code === true) test.check('press code on ct/G1.1 marks it code');
  else test.fail(OWED + 'press code answered ' + on.status + ' ' + short(on.body) + '; code reads ' + short((await item('ct/G1.1')).code));
  const off = await call('press', { id: 'ct/G1.2', what: 'code' }, ANDY);
  if (took(off) && (await item('ct/G1.2')).code === false) test.check('press code on the code item takes the mark off: it is a toggle');
  else test.fail(OWED + 'press code answered ' + off.status + ' ' + short(off.body) + '; code reads ' + short((await item('ct/G1.2')).code));

  test.subHeading('2. it is his press alone');
  const agent = await call('press', { id: 'ct/G1.1', what: 'code' }, CW);
  if (refusedByPress(agent) && (await item('ct/G1.1')).code === true) test.check('an agent\'s press code is refused and changes nothing');
  else test.fail(OWED + 'the agent\'s press code answered ' + agent.status + ' ' + short(agent.body));

  test.subHeading('3. a sub-goal still takes no code mark (goal/G6.8)');
  const sub = await call('press', { id: 'ct/G1.3', what: 'code' }, ANDY);
  if (refusedByPress(sub) && (await item('ct/G1.3')).code !== true) test.check('press code on a sub-goal is refused');
  else test.fail(OWED + 'press code on the sub-goal answered ' + sub.status + ' ' + short(sub.body) + '; code reads ' + short((await item('ct/G1.3')).code));
  const goal = await call('press', { id: 'ct/G1', what: 'code' }, ANDY);
  if (refusedByPress(goal) && (await item('ct/G1')).code !== true) test.check('and press code on the goal itself is refused');
  else test.fail(OWED + 'press code on the goal answered ' + goal.status + ' ' + short(goal.body));

  test.subHeading('4. the dialog draws the toggle from the item\'s own code field');
  const plain = await dialogOn(facts({ id: 'ct/G1.1', title: 'Plain', code: false, buttons: ['close'] }));
  const marked = await dialogOn(facts({ id: 'ct/G1.2', title: 'A code item', code: true, buttons: ['close'] }));
  // The control: the bar painted at all, so a missing toggle is a missing toggle and not an unpainted dialog.
  if (/id="dd-rename"/.test(plain.html())) test.check('the world: the item\'s button bar is painted');
  else { test.fail('the world: the dialog painted no button bar: ' + plain.html().replace(/\s+/g, ' ').slice(0, 300)); return; }
  if (/id="dd-code"/.test(plain.html())) test.check('an item\'s Details draws #dd-code in its button bar');
  else test.fail(OWED + 'no #dd-code in the bar: ' + plain.html().replace(/\s+/g, ' ').slice(0, 300));
  const unmarked = (/id="dd-code"[^>]*>([^<]*)</.exec(plain.html()) || [])[1] || '';
  const ticked = (/id="dd-code"[^>]*>([^<]*)</.exec(marked.html()) || [])[1] || '';
  if (/Code/.test(unmarked) && !/✓/.test(unmarked) && /Code/.test(ticked) && /✓/.test(ticked)) test.check('it reads "Code" unmarked and "Code ✓" on a code item');
  else test.fail(OWED + 'the labels read ' + short({ plain: unmarked, code: ticked }));

  test.subHeading('5. clicking it sends the press');
  plain.doc.getElementById('dd-code').fire('click', { target: { id: 'dd-code', getAttribute: function () { return null; }, closest: function () { return null; } } });
  await settled();
  const sent = plain.presses.filter(function (p) { return p && p.what === 'code' && p.id === 'ct/G1.1'; });
  if (sent.length === 1) test.check('a click sends press {id, what: code} once');
  else test.fail(OWED + 'the dialog sent ' + short(plain.presses));

  test.subHeading('6. a goal has no code state, so its Details draws no toggle');
  const g = await dialogOn(facts({ id: 'ct/G1', title: 'Code toggle', goal: '', buttons: ['close'] }));
  if (!/id="dd-code"/.test(g.html())) test.check('the goal\'s Details draws no #dd-code');
  else test.fail(OWED + 'the goal\'s Details drew a Code toggle');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
