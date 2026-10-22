'use strict';

// spirit/test/deskMirror.js
// goal/G33.3: Desk clients keep the current goal: one cache, two clients. Red on today's tree; claude-windows writes it
// and builds it (one agent). The box (v3), in short:
//   - A desk search answers what the List's rows show: each item's facts, the trunk of the current goal's data tree.
//   - A Desk client keeps them: filled once by a search, kept by the desk's published rows, never asked again.
//   - deskClient takes the rows from the desk's changes answer (Andy: "A it is then"): beside its records, it carries
//     the current facts of the items they touched, and the held item's panels when one of them is it.
//   - deskClient's agent reads its held item from deskClient; only writes go to the desk.
//   - The Desk app keeps the same: the current goal's rows, and the item open in its dialog, whole.
//   - One shared block: shell/js/spiritData.js (as it is) with one desk translator, in node and in the page.
// NAMED HERE: shell/js/desk/data.js registers the translator on spirit.data (spiritData) and fills two branches:
// deskItems (id -> the item's facts, as items.search labels them) and deskItem (id -> { box, version, chat, checks,
// files }). It takes the desk's publishes as jobs of module process/js/desk (job.app the published object), and the
// changes answer through spirit.deskData.takeChanges(answer). The changes answer gains rows ([facts]) and held
// ({ id, box, version, checks, files }, the caller's held item when a record touched it).
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G33.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const TRANSLATOR = path.join(RUN, 'shell', 'js', 'desk', 'data.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

const OWNER = { owner: true, key: 'MCowBQYDK2VwAyEAdeskMirrorTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const AGENT = { key: OWNER.key, label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskMirrorTestAndyAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskMirrorTestDeskNodeAAAAAAAAAAAAAAAAA=';

test.startTest('goal/G33.3: Desk clients keep the current goal, one cache for two clients');

// ── 1. THE TRANSLATOR, IN NODE ───────────────────────────────────────────────────────────────────────────────────
function translatorHalf() {
  test.subHeading('1. the desk translator fills spirit.data from a search, a publish and a changes answer');
  if (!fs.existsSync(TRANSLATOR)) { test.fail(OWED + 'there is no shell/js/desk/data.js'); return; }
  const D = require('../run/shell/js/spiritData.js');
  try { require(TRANSLATOR); } catch (e) { test.fail(OWED + 'shell/js/desk/data.js did not load: ' + e.message); return; }
  D.seat('deskItems', [{ key: 'm/G1.1', label: JSON.stringify({ id: 'm/G1.1', title: 'One', status: 'build' }) }]);
  D.take({ module: 'process/js/desk', data: {}, app: { change: 5, verb: 'chat.add', item: { id: 'm/G1.1', title: 'One', status: 'running' },
    chat: { by: 'claude-windows', at: '2026-10-23T00:00:00Z', text: 'a report' } } });
  const row = D.get('deskItems/m/G1.1') || {};
  const panels = D.get('deskItem/m/G1.1') || {};
  const lines = Array.isArray(panels.chat) ? panels.chat : [];
  if (row.status === 'running' && lines.length && lines[lines.length - 1].text === 'a report') test.check('a publish replaces the row and adds its line to the item\'s chat');
  else test.fail(OWED + 'after the publish the row reads ' + short(row) + ', the item ' + short(panels));
  const takeChanges = (globalThis.spirit && globalThis.spirit.deskData && globalThis.spirit.deskData.takeChanges) || null;
  if (typeof takeChanges !== 'function') { test.fail(OWED + 'no spirit.deskData.takeChanges'); return; }
  takeChanges({ records: [{ n: 6, verb: 'box.write', by: 'andy', body: JSON.stringify({ id: 'm/G1.2', text: 'B' }) }], lines: [], n: 6, line: 0, more: false,
    rows: [{ id: 'm/G1.2', title: 'Two', status: 'design' }], held: { id: 'm/G1.2', box: 'the box', version: 3, checks: [], files: [] } });
  const two = D.get('deskItems/m/G1.2') || {};
  const held = D.get('deskItem/m/G1.2') || {};
  if (two.title === 'Two' && held.box === 'the box' && held.version === 3) test.check('a changes answer brings the touched row and the held item\'s panels');
  else test.fail(OWED + 'after the changes answer the row reads ' + short(two) + ', the item ' + short(held));
}

// ── 2. THE DESK'S CHANGES ANSWER, AND 3. DESKCLIENT ANSWERING FROM ITS KEEPING ────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskmirror-'));
const deskState = path.join(scratch, 'desk-state');
const clientState = path.join(scratch, 'client-state');
fs.mkdirSync(deskState, { recursive: true });
fs.mkdirSync(clientState, { recursive: true });
const win = process.platform === 'win32';
const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const clientPipe = win ? appClient.pipePathFor(scratch, 'deskClient', 'win32', 'process') : path.join(scratch, 'deskClient.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
client.register('deskClient', clientPipe);
const kids = [];
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const streams = [];
const posts = [];
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'contact.get') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const desk = (ask && ask.body && ask.body.desk) || {};
    posts.push(Object.keys(desk)[0] || '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, AGENT).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* waited out */ });
  });
});
async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}

async function serversHalf() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  if (!await up('desk')) { test.fail('the world: the desk did not start'); return; }
  await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'm/G1', title: 'Mirror' }, items: [{ id: 'm/G1.1', title: 'Held', blocks: ['m/G1'] }, { id: 'm/G1.2', title: 'Other', blocks: ['m/G1'] }] }) }, ANDY);
  await call('desk', 'item.take', { id: 'm/G1.1' }, AGENT);

  test.subHeading('2. the desk\'s changes answer carries the rows it touched, and the held item');
  const before = await call('desk', 'changes', { n: 0, line: 0 }, AGENT);
  const from = Number((before.body || {}).n) || 0;
  await call('desk', 'chat.add', { id: 'm/G1.1', text: 'his line on the held item' }, ANDY);
  await call('desk', 'chat.add', { id: 'm/G1.2', text: 'his line on another' }, ANDY);
  const after = await call('desk', 'changes', { n: from, line: 0 }, AGENT);
  const body = after.body || {};
  const rowIds = (Array.isArray(body.rows) ? body.rows : []).map(function (r) { return r && r.id; });
  if (rowIds.indexOf('m/G1.1') !== -1 && rowIds.indexOf('m/G1.2') !== -1) test.check('changes carries the facts of both items its records touched');
  else test.fail(OWED + 'changes carried rows ' + short(body.rows));
  const held = body.held || {};
  if (held.id === 'm/G1.1' && typeof held.box === 'string' && Array.isArray(held.checks) && Array.isArray(held.files)) test.check('and the held item\'s panels: box, checks, files');
  else test.fail(OWED + 'changes carried held ' + short(body.held));

  test.subHeading('3. deskClient answers its agent\'s reads of the held item from what it keeps');
  kids.push(spawn(process.execPath, [CLIENT, '{}', '--pipe', clientPipe, '--state', clientState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }) }));
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  const ask = function (verb, args) { return call('deskClient', 'desk', { name: verb, json: JSON.stringify(args) }, OWNER); };
  await ask('item.get', { id: 'm/G1.1' });
  await ask('item.box', { id: 'm/G1.1' });
  await sleep(300);
  const sent = posts.length;
  const again = await ask('item.get', { id: 'm/G1.1' });
  const boxAgain = await ask('item.box', { id: 'm/G1.1' });
  await sleep(300);
  let facts = null;
  try { facts = JSON.parse((again.body || {}).item); } catch (e) { facts = null; }
  if (facts && facts.id === 'm/G1.1' && typeof (boxAgain.body || {}).box === 'string' && posts.length === sent) test.check('a second read of the held item is answered from deskClient, nothing posted to the desk');
  else test.fail(OWED + 'the second reads posted ' + short(posts.slice(sent)) + '; item.get answered ' + short(again.body) + ', item.box ' + short(boxAgain.body));
}

// ── 4. THE DESK APP'S DIALOG KEEPS THE ITEM IT OPENED ─────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, removeAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {}, contains: function () { return false; },
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
async function dialogHalf() {
  test.subHeading('4. the item dialog asks an item\'s panels once and keeps them');
  const asked = [];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, addEventListener: function () {}, removeEventListener: function () {}, activeElement: null };
  let dd = null;
  const kernel = require('../run/js/kernel.js');
  const win = { spirit: globalThis.spirit, addEventListener: function () {} };
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, win);
  const item = { id: 'm/G1.3', title: 'Opened', goal: 'm/G1', status: 'design', buttons: [], blocking: ['m/G1'], blocked: [] };
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      asked.push(v);
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(item), version: 1, change: 1 } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'BOX', version: 1 } });
      if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [] } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
      if (v === 'item.files') return Promise.resolve({ status: 200, body: { files: [], filesMore: false } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'm/G1.3', agents: {} });
  for (let i = 0; i < 8; i++) await sleep(20);
  const first = asked.filter(function (v) { return v === 'item.box'; }).length;
  dd.open({ id: 'm/G1.3', agents: {} });
  for (let i = 0; i < 8; i++) await sleep(20);
  const boxes = asked.filter(function (v) { return v === 'item.box'; }).length;
  if (first === 1 && boxes === 1) test.check('opened twice, the item\'s box was asked once');
  else test.fail(OWED + 'opened twice, item.box was asked ' + boxes + ' times (asked ' + short(asked) + ')');
}

(async function () {
  translatorHalf();
  await serversHalf();
  await dialogHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } process.exit(0); }, 300);
});
