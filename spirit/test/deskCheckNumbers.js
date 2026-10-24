'use strict';

// spirit/test/deskCheckNumbers.js
// goal/G19.5: Desk checks: numbers never repeat; box blur on its own item. Red on today's tree (db4d1a12); claude-windows
// wrote it and builds it (one agent). The item's box: check numbers are count + 1 and item.files.add deletes and
// renumbers G checks, so a number comes back and a grant can land on the wrong check; the dialog's box blur uses the
// live item id, so a write can land on the item opened since. Andy, 2026-10-12, to "Should check numbers never repeat,
// and the dialog box write only to the item it was opened for?": "yes."
//
// WHAT IS ASSERTED
//   1. A core grant G check that is removed (its core path left the list) and raised again gets a new number, never
//      the one it had.
//   2. The dialog's box, focused on one item, writes to that item when it blurs after another item was opened.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G19.5: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskCheckNumbersTestCWAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskCheckNumbersTestOwnerAAAAAAAAAAAA=', label: 'andy' };
const CORE = 'spirit/run/spirit/relay.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G19.5: check numbers never repeat; the dialog box writes to the item it was focused on');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskchecknumbers-'));

async function deskHalf() {
  test.subHeading('1. a removed check never lends its number again');
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {} } : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; seeded before the desk starts
  // (goal/G33.7: session.set went).
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Numbers' }, items: [{ id: 'goal/G100.1', title: 'Grants', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const gChecks = async function () { return ((await call('item.checks', { id: 'goal/G100.1' }, ANDY)).checks || []).filter(function (c) { return c.kind === 'G'; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
    await call('item.take', { id: 'goal/G100.1' }, CW);
    // goal/G40.3: one row a write. The core path leaves the list by item.files.remove (no write replaces the list any
    // more) and comes back by one item.files.add.
    await call('item.files.add', { id: 'goal/G100.1', path: CORE }, CW);
    const first = (await gChecks()).map(function (c) { return c.number; });
    if (first.join() === 'G1') test.check('the world: a core path raises the grant G1');
    else test.fail('the world: after a core path the G checks are ' + short(first));
    await call('item.files.add', { id: 'goal/G100.1', path: 'spirit/test/zzPlain.js' }, CW);
    await call('item.files.remove', { id: 'goal/G100.1', path: CORE }, CW);
    const gone = await gChecks();
    if (!gone.filter(function (c) { return c.state === 'open'; }).length) test.check('the world: with the core path removed from the list, the open grant is gone');
    else test.fail('the world: after the core path left, G checks read ' + short(gone));
    await call('item.files.add', { id: 'goal/G100.1', path: CORE }, CW);
    const again = (await gChecks()).filter(function (c) { return c.state === 'open'; }).map(function (c) { return c.number; });
    if (again.length === 1 && again[0] !== 'G1') test.check('raised again, the grant gets a new number (' + again[0] + '), not G1');
    else test.fail(OWED + 'the grant raised again is numbered ' + short(again));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.close();
  }
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, removeAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

async function dialogHalf() {
  test.subHeading('2. the dialog box writes to the item it was focused on');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/spirit/fieldRules.js') }));
  const facts = function (id) { return { id: id, title: id, goal: 'goal/G100', status: 'running', with: '', buttons: [], blocking: ['goal/G100'], blocked: [], asks: 0 }; };
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(facts(ask[v].id)), version: 1, change: 1 } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'box of ' + ask[v].id, version: 1 } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'goal/G100.1', agents: {} });
  await settled(); await sleep(20); await settled();
  const body = doc.getElementById('dd-body');
  const input = doc.getElementById('dd-box-input');
  input.value = 'box of goal/G100.1';
  body.fire('focusin', { target: { id: 'dd-box-input' } });
  await settled();
  const took = calls.filter(function (c) { return c.verb === 'box.take'; }).pop();
  if (took && took.args.id === 'goal/G100.1') test.check('the world: focus took the box of goal/G100.1');
  else test.fail('the world: focus asked ' + short(took));
  dd.open({ id: 'goal/G100.2', agents: {} });
  await settled(); await sleep(20); await settled();
  doc.getElementById('dd-box-input').value = 'what he typed for goal/G100.1';
  const n0 = calls.length;
  body.fire('focusout', { target: { id: 'dd-box-input' } });
  await settled(); await sleep(20); await settled();
  const wrote = calls.slice(n0).filter(function (c) { return c.verb === 'box.write' || c.verb === 'box.release'; });
  if (wrote.length && wrote.every(function (c) { return c.args.id === 'goal/G100.1'; })) test.check('the blur after opening goal/G100.2 goes to goal/G100.1, where the box was focused (' + wrote[0].verb + ')');
  else test.fail(OWED + 'the blur went to ' + short(wrote.map(function (c) { return c.verb + ' ' + c.args.id; })));
}

(async function () {
  await deskHalf();
  await dialogHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
