'use strict';

// spirit/test/deskMirror.js
// goal/G33.3: Desk clients keep the current goal: one cache, two clients. Red on today's tree; claude-windows writes it
// and builds it (one agent). The box (v3), in short:
//   - A desk search answers what the List's rows show: each item's facts, the trunk of the current goal's data tree.
//   - A Desk client keeps them: filled once by a search, kept by the desk's published rows, never asked again.
//   - deskClient takes the rows from the desk's stream (goal/G33.4: `changes` is gone; the desk publishes each row a
//     write touched, and a goal made current whole, and appServer files them in spirit.data through the translator).
//   - deskClient's agent reads its held item from deskClient; only writes go to the desk.
//   - The Desk app keeps the same: the current goal's rows, and the item open in its dialog, whole.
//   - One shared block: shell/js/spiritData.js (as it is) with one desk translator, in node and in the page.
// NAMED HERE: shell/js/desk/data.js registers the translator on spirit.data (spiritData) and fills two branches:
// deskItems (id -> the item's facts, as items.search labels them) and deskItem (id -> { box, version, chat, checks,
// files }). It takes the desk's publishes as jobs of module process/js/desk (job.app the published object), in the
// page and in deskClient alike (goal/G33.4).
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');
const packet = require('../run/spirit/client/packet.js');

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
  test.subHeading('1. the desk translator fills spirit.data from a search, a publish, a goal pushed and a part read');
  if (!fs.existsSync(TRANSLATOR)) { test.fail(OWED + 'there is no shell/js/desk/data.js'); return; }
  const D = require('../run/shell/js/spiritData.js');
  try { require(TRANSLATOR); } catch (e) { test.fail(OWED + 'shell/js/desk/data.js did not load: ' + e.message); return; }
  D.seat('deskItems', [{ key: 'goal/G100.1', label: JSON.stringify({ id: 'goal/G100.1', title: 'One', status: 'build' }) }]);
  // Kept whole, as the dialog or deskClient keeps the item it opened or holds; only such an item takes chat lines,
  // since a line alone would leave a chat that is not the item's whole one.
  D.set('deskItem/goal/G100.1', { box: '', version: 0, chat: [], chatMore: false, checks: [], files: [], filesMore: false });
  // goal/G33.4: the item's List row and its chat line are two publishes, one row each.
  D.take({ module: 'process/js/desk', data: {}, app: { change: 5, verb: 'chat.add', item: { id: 'goal/G100.1', title: 'One', status: 'running' }, key: { goal: 100, item: 1 } } });
  D.take({ module: 'process/js/desk', data: {}, app: { change: 5, table: 'chat', goal: 100, item: 1, id: 'goal/G100.1',
    row: { by: 'claude-windows', at: '2026-10-23T00:00:00Z', text: 'a report' } } });
  const row = D.get('deskItems/goal/G100.1') || {};
  const panels = D.get('deskItem/goal/G100.1') || {};
  const lines = Array.isArray(panels.chat) ? panels.chat : [];
  if (row.status === 'running' && lines.length && lines[lines.length - 1].text === 'a report') test.check('a publish replaces the row and adds its line to the item\'s chat');
  else test.fail(OWED + 'after the publish the row reads ' + short(row) + ', the item ' + short(panels));
  // goal/G33.7 (box v46, Andy: "a new deskClient connect should start a stream-push of the goal, and the items, the box
  // and other parts will come when needed and stay"): a goal becoming current brings its items' rows alone; a part is
  // kept once it was read (took), and the side rows keep it current from then on.
  D.take({ module: 'process/js/desk', data: {}, app: { change: 6, verb: 'goal.whole', item: { id: 'goal/G100.2', goal: 'goal/G100', title: 'Two', status: 'design' }, key: { goal: 100, item: 2 } } });
  D.take({ module: 'process/js/desk', data: {}, app: { change: 6, table: 'box', goal: 100, item: 2, id: 'goal/G100.2', row: { text: 'the box', version: 3 } } });
  const two = D.get('deskItems/goal/G100.2') || {};
  const unread = D.get('deskItem/goal/G100.2');
  if (two.title === 'Two' && !(unread && typeof unread.box === 'string')) test.check('a goal pushed brings the item\'s row, and a box row of an item whose box was never read is not kept');
  else test.fail(OWED + 'after the goal was pushed the row reads ' + short(two) + ', the item ' + short(unread));
  globalThis.spirit.deskData.took('item.box', { id: 'goal/G100.2' }, { box: 'the box', version: 3 });
  D.take({ module: 'process/js/desk', data: {}, app: { change: 7, table: 'box', goal: 100, item: 2, id: 'goal/G100.2', row: { text: 'the box, again', version: 4 } } });
  const held = D.get('deskItem/goal/G100.2') || {};
  if (held.box === 'the box, again' && held.version === 4 && held.chat === undefined) test.check('the box read once is kept, and the next box row keeps it current; the chat, never read, is not kept');
  else test.fail(OWED + 'after the read and a box row the item reads ' + short(held));
}

// ── 2. THE DESK'S PUBLISHED ROWS, AND 3. DESKCLIENT ANSWERING FROM ITS KEEPING ────────────────────────────────────
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
const published = [];
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
    // goal/G33.4: what the desk publishes, each row it wrote, written down.
    if (b.verb === 'jobs.update' && b.id === 'desk-job' && b.app && b.app.change !== undefined) published.push(b.app);
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'contact.get') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    // One node for both ends: what the desk posts to the agent's key (its stream, goal/G33.4) goes into deskClient as
    // the desk's; what deskClient posts goes into the desk as the agent's ask, and is counted.
    const fromDesk = b.to === AGENT.key;
    const desk = (ask && ask.body && ask.body.desk) || {};
    if (!fromDesk) posts.push(Object.keys(desk)[0] || '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    test.peerAnswer(client, ask && ask.body, fromDesk ? { key: DESK_KEY, label: 'Andy' } : AGENT).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: fromDesk ? AGENT.key : DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
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
  // The world (goal/G33.7: session.set went), seeded before the desk starts; the desk pushes it, its current goal, at
  // start.
  test.seedDesk(deskState, { goal: { id: 'goal/G100', title: 'Mirror' }, items: [{ id: 'goal/G100.1', title: 'Held', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Other', blocks: ['goal/G100'] }] });
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }) }));
  if (!await up('desk')) { test.fail('the world: the desk did not start'); return; }
  await call('desk', 'item.take', { id: 'goal/G100.1' }, AGENT);

  // goal/G33.4: `changes` is gone; the desk publishes each row a write touched, and a goal made current whole.
  test.subHeading('2. the desk publishes the rows it touched, and the current goal\'s panels');
  await sleep(300);
  const from = published.length;
  await call('desk', 'chat.add', { id: 'goal/G100.1', text: 'his line on the held item' }, ANDY);
  await call('desk', 'chat.add', { id: 'goal/G100.2', text: 'his line on another' }, ANDY);
  await sleep(500);
  const rows = published.slice(from);
  const rowIds = rows.filter(function (o) { return o.item && o.item.id; }).map(function (o) { return o.item.id; });
  const lineOn = function (id, text) { return rows.some(function (o) { return o.table === 'chat' && o.id === id && o.row && o.row.text === text; }); };
  if (rowIds.indexOf('goal/G100.1') !== -1 && rowIds.indexOf('goal/G100.2') !== -1 && lineOn('goal/G100.1', 'his line on the held item') && lineOn('goal/G100.2', 'his line on another')) test.check('the desk published the facts of both items its writes touched, and each line as its own row');
  else test.fail(OWED + 'the desk published ' + short(rows));
  // goal/G100 is current, so the desk's start pushed its rows; a panel written since goes out as its own row.
  const boxFrom = published.length;
  const wrote = await call('desk', 'box.write', { id: 'goal/G100.1', text: 'THE HELD BOX', version: 0 }, ANDY);
  await sleep(500);
  const boxOf = published.slice(boxFrom).filter(function (o) { return o.table === 'box' && o.id === 'goal/G100.1' && o.row && o.row.text === 'THE HELD BOX'; });
  const whole = ['goal/G100', 'goal/G100.1', 'goal/G100.2'].filter(function (id) { return published.some(function (o) { return o.verb === 'goal.whole' && o.item && o.item.id === id; }); });
  if (whole.length === 3 && wrote.status === 200 && boxOf.length === 1) test.check('goal/G100 went out whole, all three rows, and the held item\'s box, once written, went out as its own row');
  else test.fail(OWED + 'goal.whole rows for ' + short(whole) + '; box.write answered ' + wrote.status + ', box rows ' + short(boxOf));

  test.subHeading('3. deskClient answers its agent\'s reads of the held item from what it keeps');
  // Who it is, as its node hands every server it starts (--node): it knows its agent's held item by that name.
  kids.push(spawn(process.execPath, [CLIENT, '{}', '--pipe', clientPipe, '--state', clientState, '--node', JSON.stringify({ name: 'claude-windows', publicKey: OWNER.key })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }) }));
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  const ask = function (verb, args) { return call('deskClient', 'desk', { name: verb, json: JSON.stringify(args) }, OWNER); };
  // Its first ask makes it known to the desk, which pushes it the current goal's rows (goal/G33.7); the box read once
  // after that is kept.
  await ask('item.get', { id: 'goal/G100.1' });
  await sleep(1000);
  await ask('item.box', { id: 'goal/G100.1' });
  await sleep(300);
  const sent = posts.length;
  const again = await ask('item.get', { id: 'goal/G100.1' });
  const boxAgain = await ask('item.box', { id: 'goal/G100.1' });
  await sleep(300);
  let facts = null;
  try { facts = JSON.parse((again.body || {}).item); } catch (e) { facts = null; }
  if (facts && facts.id === 'goal/G100.1' && typeof (boxAgain.body || {}).box === 'string' && posts.length === sent) test.check('a second read of the held item is answered from deskClient, nothing posted to the desk (the first read of the box fetched it)');
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
  const kernel = require('../run/spirit/kernel.js');
  const win = { spirit: globalThis.spirit, addEventListener: function () {} };
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, win);
  const item = { id: 'goal/G100.3', title: 'Opened', goal: 'goal/G100', status: 'design', buttons: [], blocking: ['goal/G100'], blocked: [] };
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk({ call: name, args: body || {} }) || {}).desk;
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
  dd.open({ id: 'goal/G100.3', agents: {} });
  for (let i = 0; i < 8; i++) await sleep(20);
  const first = asked.filter(function (v) { return v === 'item.box'; }).length;
  dd.open({ id: 'goal/G100.3', agents: {} });
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
