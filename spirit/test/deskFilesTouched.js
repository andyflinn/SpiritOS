'use strict';

// goal/G8.8: files touched per item, kept by the desk, approved by Andy with one grant. Red on today's tree;
// claude-windows wrote it from G8.8's box and does not build it.
//   Andy, 2026-10-09: "ideally written by the claiming agent. the coding agent and the testing agent should be adding
//   files they test/touch in a list that can be fetched per item.", "the list should be owned by the item. so updates
//   to it are available to all participants.", "and that file list should be visible in desk ui per item, core files
//   market as requiring grants.", "all files that need a grant should get one 'grant' button together.", and "oh, and
//   the Delete button never should show in the list. only in the detals."
//
// WHAT IS TRUE TODAY (read at c32427af): the desk holds no file list per item and has no item.files.add; the List
// draws every button an item offers except go-all, reopen and make-current (shell/desk/desk.js DESK_NOT_IN_ROW).
//
// THE SHAPE ASSERTED, from the box and the red writer's naming where the box leaves it open:
//   item.files.add {id, paths}: the caller's whole list for that item, replacing its own entries and leaving others'.
//   item.get carries it as facts.files, [{path, by, core}], core read from js/coreFiles.js isCore (never a second list).
//   A list holding any core file puts ONE open G check on the item for all of them, not one per file.
//   The Details draws the list in #dd-files, a core path marked data-core="1". The List never draws Delete.
// NOT ASSERTED: a file added after the grant turning the grant red again (both agents proposed it, he has not ruled),
// and Done waiting on every grant (goal/G8.5 builds that).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G8.8: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskFilesTouchedTestCWAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskFilesTouchedTestWSLAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskFilesTouchedTestOwnerAAAAAAAAAAAA=', label: 'andy' };
const CORE = 'spirit/run/js/kernel.js';
const CORE2 = 'spirit/run/js/appClient.js';
const PLAIN = 'spirit/test/deskSword.js';
const PLAIN2 = 'spirit/run/shell/desk/desk.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function listOf(f) { return (Array.isArray(f.files) ? f.files : []).map(function (e) { return (e && e.by) + ':' + (e && e.path); }).sort(); }

test.startTest('goal/G8.8: files touched per item, kept by the desk, one grant for the core ones');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskfilestouched-'));
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
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function openGrants(id) {
  const r = await call('item.checks', { id: id }, ANDY);
  return ((r.body && r.body.checks) || []).filter(function (c) { return c.kind === 'G' && c.state === 'open'; });
}

async function server() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'ft/G1', title: 'Files' }, items: [
    { id: 'ft/G1.1', title: 'Touches files', blocks: ['ft/G1'] }, { id: 'ft/G1.2', title: 'Touches no core', blocks: ['ft/G1'] }] }) }, CW);
  if ((await facts('ft/G1.1')).id === 'ft/G1.1') test.check('the world: two items');
  else { test.fail('the world did not land'); return; }

  test.subHeading('1. an agent adds the files it touched, and the item carries them');
  const add = await call('item.files.add', { id: 'ft/G1.1', paths: [PLAIN, CORE] }, CW);
  if (took(add)) test.check('item.files.add {id, paths} is taken');
  else test.fail(OWED + 'item.files.add answered ' + add.status + ' ' + short(add.body));
  const f1 = await facts('ft/G1.1');
  if (JSON.stringify(listOf(f1)) === JSON.stringify(['claude-windows:' + CORE, 'claude-windows:' + PLAIN].sort())) test.check('item.get carries both paths, written by claude-windows');
  else test.fail(OWED + 'facts.files reads ' + short(f1.files));
  const core = (f1.files || []).filter(function (e) { return e && e.path === CORE; })[0] || {};
  const plain = (f1.files || []).filter(function (e) { return e && e.path === PLAIN; })[0] || {};
  if (core.core === true && plain.core === false) test.check(CORE + ' is marked core, ' + PLAIN + ' is not (coreFiles.isCore)');
  else test.fail(OWED + 'core marks read ' + short({ core: core.core, plain: plain.core }));

  test.subHeading('2. the list is the item\'s: each writer replaces its own entries, never another\'s');
  await call('item.files.add', { id: 'ft/G1.1', paths: [PLAIN2] }, WSL);
  await call('item.files.add', { id: 'ft/G1.1', paths: [CORE, CORE2] }, CW);
  const f2 = await facts('ft/G1.1');
  const want = ['claude-windows:' + CORE, 'claude-windows:' + CORE2, 'wsl-claude:' + PLAIN2].sort();
  if (JSON.stringify(listOf(f2)) === JSON.stringify(want)) test.check('claude-windows\'s second list replaced its first; wsl-claude\'s entry stands');
  else test.fail(OWED + 'after both writers the list reads ' + short(listOf(f2)));

  test.subHeading('3. one grant for all the core files, and none without them');
  const g = await openGrants('ft/G1.1');
  if (g.length === 1 && g[0].words.indexOf(CORE) !== -1 && g[0].words.indexOf(CORE2) !== -1) test.check('one open G check names both core files');
  else test.fail(OWED + 'the open grants read ' + short(g.map(function (c) { return c.words; })));
  // GROWN IN THE VERIFY (claude-windows): a list he has granted, sent again unchanged, asks him nothing new. Each call
  // carries the writer's whole list, so agents re-send it as they work; a fresh red grant for files he already granted
  // would make him grant the same list over and over.
  const g1 = g[0] && g[0].number;
  await call('check.set', { id: 'ft/G1.1', check: g1, state: 'granted' }, ANDY);
  await call('item.files.add', { id: 'ft/G1.1', paths: [CORE, CORE2] }, CW);
  const again = await openGrants('ft/G1.1');
  if (g1 && !again.length) test.check('the same list sent again after his grant raises no new grant');
  else test.fail(OWED + 'after his grant, the unchanged list raised ' + short(again.map(function (c) { return c.number + ' ' + c.words; })));
  await call('item.files.add', { id: 'ft/G1.2', paths: [PLAIN] }, CW);
  const none = await openGrants('ft/G1.2');
  if (!none.length && listOf(await facts('ft/G1.2')).length === 1) test.check('a list with no core file raises no grant');
  else test.fail(OWED + 'ft/G1.2 has grants ' + short(none.map(function (c) { return c.words; })) + ' and list ' + short(listOf(await facts('ft/G1.2'))));

  test.subHeading('4. what it refuses');
  const notList = await call('item.files.add', { id: 'ft/G1.1', paths: PLAIN }, CW);
  if (refusedByVerb(notList)) test.check('paths that is not a list is refused');
  else test.fail(OWED + 'a string for paths answered ' + notList.status + ' ' + short(notList.body));
  const ghost = await call('item.files.add', { id: 'ft/G1.99', paths: [PLAIN] }, CW);
  if (refusedByVerb(ghost)) test.check('an item the desk does not hold is refused');
  else test.fail(OWED + 'item.files.add on ft/G1.99 answered ' + ghost.status + ' ' + short(ghost.body));
}

// ── THE PAGES ──────────────────────────────────────────────────────────
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

async function pages() {
  test.subHeading('5. the Details draws the list, core files marked');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  const item = label({ id: 't/G1.2', title: 'Second', files: [{ path: CORE, by: 'claude-windows', core: true }, { path: PLAIN, by: 'wsl-claude', core: false }] });
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(item), box: 'BOX', version: 1, change: 1, chatMore: false, checks: [], chat: [] } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 't/G1.2', agents: {} });
  for (let i = 0; i < 6; i++) await sleep(20);
  const files = doc.getElementById('dd-files').innerHTML;
  if (files.indexOf(CORE) !== -1 && files.indexOf(PLAIN) !== -1) test.check('#dd-files lists both paths');
  else test.fail(OWED + '#dd-files reads ' + short(files));
  const coreTag = (files.match(new RegExp('<[^>]*data-core="1"[^>]*>[^<]*' + CORE.replace(/[./]/g, '\\$&'))) || [''])[0];
  const plainCore = new RegExp('data-core="1"[^>]*>[^<]*' + PLAIN.replace(/[./]/g, '\\$&')).test(files);
  if (coreTag && !plainCore) test.check('the core file carries data-core="1", the plain one does not');
  else test.fail(OWED + 'core marks in #dd-files: ' + short(files));

  test.subHeading('6. the List never draws Delete; the Details still does');
  const fake = require('./deskFake.js').create([]);
  fake.items = [label({ id: 't/G1', title: 'Goal', goal: '', buttons: ['close'] }), label({ id: 't/G1.3', title: 'In design', buttons: ['delete'] })];
  const ldoc = { byId: {}, getElementById: function (id) { return this.byId[id] || (this.byId[id] = fakeElement(id)); } };
  let desk = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { desk = x; } }, core: kernel.core }, ldoc, { addEventListener: function () {} });
  desk.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200 }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) await sleep(20);
  const all = Object.keys(ldoc.byId).map(function (k) { return ldoc.byId[k].innerHTML; }).join('\n');
  const at = all.indexOf('<tr data-row="t/G1.3"');
  const row = at === -1 ? '' : all.slice(at, all.indexOf('</tr>', at));
  if (row && !/data-press="delete"/.test(row)) test.check('the row of an item offering delete draws no Delete');
  else test.fail(OWED + (row ? 'the List draws Delete: ' + short(row) : 'the List drew no row for t/G1.3'));
}

(async function () {
  await server();
  await pages();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
