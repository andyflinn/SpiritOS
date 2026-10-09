'use strict';

// goal/G9.7: an arm-able Delete in the item button bar while in design mode. Red on today's tree; claude-windows
// wrote it from G9.7's box and does not build it.
//   Andy, 2026-10-07: "the button bar of items will offer an arm-able [delete] while in design mode.", and on Q1 (close
//   or erase): "close is enough. that essentially leaves them as \"musings\" on the record."
//
// WHAT IS TRUE TODAY (read in the tree after 4115fbfb): nothing deletes an item; one a session leaves out is closed,
// never deleted (goal/G4.24). There is no item.delete and no delete button.
//
// THE SHAPE ASSERTED (G9.7's box): item.delete {id}, his alone, taken only while the item's goal is in design mode,
// never on a goal. It closes the item as a left-out one is closed: it stays on the record with its box, found by
// Include Closed, and blocks nothing. The server offers `delete` in the item's buttons while it may be taken, so the
// dialog draws it from buttons as every button (desk/G2.7), id dd-delete; the first click arms it, the second sends.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.7: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskDeleteTestCWAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskDeleteTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.7: an arm-able Delete in the item button bar while in design mode');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskdelete-'));
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
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
// A refusal counts only once the verb exists: today's no-such-verb refuses everything and proves nothing.
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function listed(includeClosed) {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: includeClosed }, ANDY);
  return ((r.body && r.body.items) || []).map(function (i) { return (parse(i.label) || {}).id; });
}

async function server() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // A fresh goal arrives in design mode; d/G1.1 blocks d/G1.2.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'd/G1', title: 'Deletes' }, items: [
    { id: 'd/G1.1', title: 'To delete', blocks: ['d/G1', 'd/G1.2'] }, { id: 'd/G1.2', title: 'Waits on it', blocks: ['d/G1'] },
    { id: 'd/G1.3', title: 'Kept', blocks: ['d/G1'] }] }) }, CW);
  await call('box.write', { id: 'd/G1.1', text: 'Its own words.', version: 0 }, CW);
  const g = await facts('d/G1');
  if (g.design === true && ((await facts('d/G1.2')).blocked || []).indexOf('d/G1.1') !== -1) test.check('the world: d/G1 in design mode, d/G1.2 waits on d/G1.1');
  else { test.fail('the world: ' + short({ design: g.design, blocked: (await facts('d/G1.2')).blocked })); return; }

  test.subHeading('1. in design mode the item offers delete, and the goal does not');
  if (((await facts('d/G1.1')).buttons || []).indexOf('delete') !== -1) test.check('d/G1.1 offers delete');
  else test.fail(OWED + 'd/G1.1 offers ' + short((await facts('d/G1.1')).buttons));
  if ((g.buttons || []).indexOf('delete') === -1) test.check('the goal offers no delete');
  else test.fail(OWED + 'the goal offers delete');

  test.subHeading('2. his alone, never on a goal');
  const agent = await call('item.delete', { id: 'd/G1.1' }, CW);
  if (refusedByVerb(agent) && (await listed(false)).indexOf('d/G1.1') !== -1) test.check('an agent\'s item.delete is refused and d/G1.1 stays open');
  else test.fail(OWED + 'an agent\'s item.delete answered ' + agent.status + ' ' + short(agent.body));
  const onGoal = await call('item.delete', { id: 'd/G1' }, ANDY);
  if (refusedByVerb(onGoal) && (await facts('d/G1')).status !== 'closed') test.check('item.delete on the goal is refused');
  else test.fail(OWED + 'item.delete on the goal answered ' + onGoal.status + ' ' + short(onGoal.body));

  test.subHeading('3. his delete closes the item as a left-out one is closed');
  const del = await call('item.delete', { id: 'd/G1.1' }, ANDY);
  if (took(del)) test.check('his item.delete {id: d/G1.1} is taken');
  else test.fail(OWED + 'his item.delete answered ' + del.status + ' ' + short(del.body));
  const open = await listed(false);
  const all = await listed(true);
  if (open.indexOf('d/G1.1') === -1 && all.indexOf('d/G1.1') !== -1) test.check('d/G1.1 leaves the List and Include Closed still finds it');
  else test.fail(OWED + 'open list ' + short(open) + ', with closed ' + short(all));
  const box = await call('item.box', { id: 'd/G1.1' }, ANDY);
  if (box.body && box.body.box === 'Its own words.') test.check('its box stays on the record');
  else test.fail('after the delete its box reads ' + short(box.body));
  if (((await facts('d/G1.2')).blocked || []).indexOf('d/G1.1') === -1) test.check('d/G1.2 no longer waits on it');
  else test.fail(OWED + 'd/G1.2 still waits on ' + short((await facts('d/G1.2')).blocked));

  test.subHeading('4. out of design mode there is no delete');
  await call('press', { id: 'd/G1', what: 'end-design' }, ANDY);
  if ((await facts('d/G1')).design === false) test.check('the world: design mode ended');
  else test.fail('the world: end-design did not take');
  if (((await facts('d/G1.3')).buttons || []).indexOf('delete') === -1) test.check('d/G1.3 offers no delete out of design mode');
  else test.fail(OWED + 'd/G1.3 still offers delete out of design mode');
  const late = await call('item.delete', { id: 'd/G1.3' }, ANDY);
  if (refusedByVerb(late) && (await listed(false)).indexOf('d/G1.3') !== -1) test.check('item.delete out of design mode is refused');
  else test.fail(OWED + 'item.delete out of design mode answered ' + late.status + ' ' + short(late.body));
}

// ── THE DIALOG ─────────────────────────────────────────────────────────
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
const label = function (o) { return Object.assign({ goal: 't/G1', status: '', with: '', buttons: [], blocking: ['t/G1'], blocked: [], star: false, asks: 0 }, o); };

async function dialogOn(buttons) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(label({ id: 't/G1.2', title: 'Second', buttons: buttons })), box: 'BOX', version: 1, change: 1, chatMore: false, checks: [], chat: [] } });
      return Promise.resolve({ status: 200, body: { change: 2, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 't/G1.2', agents: {} });
  const settled = async function () { for (let i = 0; i < 6; i++) await sleep(20); };
  await settled();
  const html = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const click = async function () {
    const ev = { target: { id: 'dd-delete', getAttribute: function (n) { return n === 'id' ? 'dd-delete' : null; }, closest: function () { return null; } }, preventDefault: function () {}, stopPropagation: function () {} };
    doc.getElementById('dd-body').fire('click', ev);
    await settled();
  };
  return { html: html, click: click, deletes: function () { return calls.filter(function (c) { return c.verb === 'item.delete'; }); } };
}

async function dialog() {
  test.subHeading('5. the dialog draws Delete from the item\'s buttons, armed before it sends');
  const on = await dialogOn(['delete']);
  if (/<button[^>]*id="dd-delete"/.test(on.html())) test.check('an item offering delete shows dd-delete in its button bar');
  else { test.fail(OWED + 'no dd-delete drawn for an item offering delete'); return; }
  await on.click();
  if (!on.deletes().length && /<button[^>]*id="dd-delete"[^>]*data-armed="1"/.test(on.html())) test.check('the first click arms it and sends nothing');
  else test.fail(OWED + 'after one click: sent ' + short(on.deletes()) + ', armed ' + /id="dd-delete"[^>]*data-armed/.test(on.html()));
  await on.click();
  const sent = on.deletes();
  if (sent.length === 1 && sent[0].args.id === 't/G1.2') test.check('the second click sends item.delete {id: t/G1.2}');
  else test.fail(OWED + 'after two clicks the dialog sent ' + short(sent));
  const off = await dialogOn([]);
  if (!/id="dd-delete"/.test(off.html())) test.check('an item not offering delete shows none');
  else test.fail(OWED + 'dd-delete drawn though the item does not offer it');
}

(async function () {
  await server();
  await dialog();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
