'use strict';

// goal/G9.10: an Add blocking item section in the item Details. Red on today's tree; claude-windows wrote it from
// G9.10's box and does not build it.
//   Andy, 2026-10-07: "In the item/Goals detail dialog, there will be a new section bubble, immediately following the
//   \"Blocked by/Blocking\" section, and right before the users chat input. the \"Add blocking item\" form is the
//   following set up items arranged inline as follows: \"Title\" [Title String, subject to label rules] [add-button].
//   When the user presses the [add-button], The desk will add a blocking item with the entered title and a blank text
//   box. The blocked-by section will be updated immediately."
//
// WHAT IS TRUE TODAY (read in the tree after 53b4de83): item.add {goal, title} (goal/G9.9) adds an item that blocks
// its goal and nothing else; the dialog has no add form.
//
// THE SHAPE ASSERTED, the red writer's reconciling of two boxes: G9.10's box names item.add {id, title}, but G9.9 has
// since built item.add {goal, title}. So item.add gains one optional argument, `blocks`, the id the new item blocks,
// an item of that goal or the goal itself, the goal when left out. One verb, nothing renamed. The title obeys the label
// rules (js/fieldRules.js problem: 64 bytes at most, among others); the box starts empty.
// The dialog's section: an input dd-add-title and a button dd-add (the red writer's names), after #dd-links and before
// the chat input #dd-say; the button sends item.add with the dialog's own item as `blocks`, and the Blocked by part
// shows the new id without waiting for anything else.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.10: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskAddBlockingTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskAddBlockingTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function same(a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); }

test.startTest('goal/G9.10: Add blocking item, in the item Details');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskaddblocking-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }

async function server() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G3', title: 'Old' }, items: [
    { id: 'goal/G3.1', title: 'One', blocks: ['goal/G3'] }] }) }, CW);
  await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G5', title: 'Elsewhere' }, items: [
    { id: 'goal/G5.1', title: 'Other goal', blocks: ['goal/G5'] }] }) }, CW);
  const plain = await call('item.add', { goal: 'goal/G3', title: 'Plain' }, ANDY);
  if (took(plain) && same((await facts(plain.body.id)).blocking, ['goal/G3'])) test.check('the world: item.add without blocks blocks its goal (goal/G9.9)');
  else { test.fail('the world: a plain item.add answered ' + plain.status + ' ' + short(plain.body)); return; }

  test.subHeading('1. item.add with blocks adds an item blocking that item, with an empty box');
  const add = await call('item.add', { goal: 'goal/G3', title: 'Needed first', blocks: 'goal/G3.1' }, ANDY);
  const nid = add.body && add.body.id;
  if (took(add) && /^goal\/G3\.\d+$/.test(String(nid))) test.check('item.add {goal, title, blocks} answers ' + nid);
  else { test.fail(OWED + 'item.add with blocks answered ' + add.status + ' ' + short(add.body)); return; }
  const f = await facts(nid);
  if (f.goal === 'goal/G3' && same(f.blocking, ['goal/G3.1'])) test.check(nid + ' is goal/G3\'s and blocks goal/G3.1 alone');
  else test.fail(OWED + nid + ' reads ' + short({ goal: f.goal, blocking: f.blocking }));
  const parent = await facts('goal/G3.1');
  if ((parent.blocked || []).indexOf(nid) !== -1) test.check('goal/G3.1 now waits on ' + nid);
  else test.fail(OWED + 'goal/G3.1 waits on ' + short(parent.blocked));
  const box = await call('item.box', { id: nid }, ANDY);
  if (box.body && box.body.box === '') test.check('its box is blank');
  else test.fail(OWED + 'the new box reads ' + short(box.body));

  test.subHeading('2. what it may block, and the title\'s rules');
  const across = await call('item.add', { goal: 'goal/G3', title: 'Across', blocks: 'goal/G5.1' }, ANDY);
  if (!took(across) && across.body && across.body.code !== 'no-such-argument') test.check('blocks naming another goal\'s item is refused');
  else test.fail(OWED + 'blocks across goals answered ' + across.status + ' ' + short(across.body));
  const ghost = await call('item.add', { goal: 'goal/G3', title: 'Ghost', blocks: 'goal/G3.99' }, ANDY);
  if (!took(ghost) && ghost.body && ghost.body.code !== 'no-such-argument') test.check('blocks naming an item the desk does not hold is refused');
  else test.fail(OWED + 'blocks naming goal/G3.99 answered ' + ghost.status + ' ' + short(ghost.body));
  const long = await call('item.add', { goal: 'goal/G3', title: 'x'.repeat(65), blocks: 'goal/G3.1' }, ANDY);
  if (!took(long) && long.body && long.body.code !== 'no-such-argument') test.check('a 65-byte title is refused by the label rules');
  else test.fail(OWED + 'a 65-byte title answered ' + long.status + ' ' + short(long.body));
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
const label = function (o) { return Object.assign({ goal: 't/G1', status: 'running', with: '', buttons: [], blocking: ['t/G1'], blocked: [], star: false, asks: 0 }, o); };

async function dialog() {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let added = false;
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.add') { added = true; return Promise.resolve({ status: 200, body: { id: 't/G1.7', change: 9 } }); }
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(label({ id: 't/G1.2', title: 'Second', blocked: added ? ['t/G1.7'] : [] })), box: 'BOX', version: 1, change: added ? 9 : 1, chatMore: false, checks: [], chat: [] } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 't/G1.2', agents: {} });
  const settled = async function () { for (let i = 0; i < 12; i++) await new Promise(function (r) { setImmediate(r); }); };
  await settled();
  const body = doc.getElementById('dd-body').innerHTML;
  const at = function (id) { return body.indexOf('id="' + id + '"'); };

  test.subHeading('3. the section sits after Blocked by and before his chat input');
  const all = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (/<input[^>]*id="dd-add-title"/.test(all) && /<button[^>]*id="dd-add"/.test(all)) test.check('the dialog draws the title input dd-add-title and the button dd-add');
  else test.fail(OWED + 'no dd-add-title input and dd-add button in the dialog');
  const sectionAt = Math.min.apply(null, ['dd-add-title', 'dd-add-row', 'dd-add'].map(at).filter(function (n) { return n !== -1; }).concat([Number.MAX_SAFE_INTEGER]));
  if (at('dd-links') !== -1 && sectionAt > at('dd-links') && at('dd-say') !== -1 && sectionAt < at('dd-say')) test.check('it comes after #dd-links and before #dd-say');
  else test.fail(OWED + 'links at ' + at('dd-links') + ', the section at ' + (sectionAt === Number.MAX_SAFE_INTEGER ? -1 : sectionAt) + ', chat input at ' + at('dd-say'));

  test.subHeading('4. the button adds a blocking item and Blocked by shows it at once');
  doc.getElementById('dd-add-title').value = 'Do this first';
  const target = { id: 'dd-add', getAttribute: function (n) { return n === 'id' ? 'dd-add' : null; }, closest: function () { return null; } };
  doc.getElementById('dd-body').fire('click', { target: target, preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  const sent = calls.filter(function (c) { return c.verb === 'item.add'; })[0];
  if (sent && sent.args.goal === 't/G1' && sent.args.blocks === 't/G1.2' && sent.args.title === 'Do this first' && sent.args.id === undefined) test.check('it sent item.add {goal: t/G1, title, blocks: t/G1.2}, naming no id');
  else test.fail(OWED + 'the button sent ' + short(sent));
  const links = doc.getElementById('dd-links').innerHTML;
  if (/t\/G1\.7/.test(links)) test.check('Blocked by now shows t/G1.7');
  else test.fail(OWED + 'after the add the links read ' + short(links));
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
