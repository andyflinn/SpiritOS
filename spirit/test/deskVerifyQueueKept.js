'use strict';

// spirit/test/deskVerifyQueueKept.js
// goal/G33.3: deskVerify keeps no queue. Red on today's tree (c0b20b15); claude-windows wrote it and builds it (one
// agent). The file name is goal/G19.3's, whose queue this eradicates. The box: "deskVerify keeps no queue: it is busy,
// or it is not. Busy, it takes nothing new; free, it asks the desk which items still wait for verification and takes
// the oldest, since the item knows whether it still needs it. The runs it held waiting are dropped at its start, never
// worked off." Andy: "deskVerifier should NOT have a queue, it's either busy, or it's not.", "the item knows if it
// still needs verification", and "if it is not stopped from working of the fucking queue, it will NEVER work again."
//
// WHAT IS ASSERTED
//   1. started with runs left in verify.db as queued and waiting, it drops them: they are never run (no check, no line),
//      and no row of theirs reads queued or waiting any more.
//   2. busy (a hanging suite), a new claim is not queued: now answers no queued run, verify.db holds no queued row.
//   3. free again, it asks the desk which items still wait for deskVerify and checks them: the one claimed while it was
//      busy, and one the desk marks waiting without a record it ever saw; the item that no longer waits is not re-run.
//   4. the Verifier tab stays, its buttons drawn, and lists no waiting run (goal/G33.2).
// rule/11: through testSupport only; a fake node; it kills only the processes this suite started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G33.3: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const HANG = 'zzQueueKeptHang.js';
const GREEN = 'zzQueueKeptGreen.js';
const WAITING = 'waiting for deskVerify';
// A commit no tree holds, for the run left waiting in verify.db.
const NOWHERE = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G33.3: deskVerify keeps no queue: the runs left in verify.db are dropped, a claim while busy is not queued, and free it takes what the desk says still waits');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyqueuekept-'));

function server(script, name, args, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  let kid = null;
  return {
    start: function () { kid = spawn(process.execPath, [script, JSON.stringify(args || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); },
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a) { const q = {}; q[verb] = a; const o = {}; o[app] = q; return client.ask(o).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// The runs a verify.db holds, as a stopped deskVerify would have left them: one queued, one waiting for its commit.
function seedRuns(dbPath) {
  const d = new DatabaseSync(dbPath);
  d.exec('CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,' +
    ' state TEXT NOT NULL, outcome TEXT NOT NULL, queuedAt TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT NOT NULL,' +
    ' "commit" TEXT NOT NULL DEFAULT \'\');');
  const at = new Date(Date.now() - 60000).toISOString();
  const ins = d.prepare('INSERT INTO runs (kind, id, state, outcome, queuedAt, startedAt, endedAt, "commit") VALUES (?, ?, ?, \'\', ?, ?, \'\', ?)');
  ins.run('item', 'qk/G1.7', 'queued', at, '', '');
  ins.run('item', 'qk/G1.8', 'waiting', at, at, NOWHERE);
  d.close();
}
function runRows(dbPath) {
  try { const d = new DatabaseSync(dbPath, { readOnly: true }); const rows = d.prepare('SELECT kind, id, state FROM runs ORDER BY rowid').all(); d.close(); return rows; } catch (e) { return []; }
}

async function verifyHalf() {
  fs.writeFileSync(path.join(__dirname, HANG), "'use strict';\nsetInterval(function () {}, 1000);\n");
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('queue green probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const files = function (f) { return [{ path: 'spirit/test/' + f, by: 'claude-windows', core: false }]; };
  // THE ITEMS, EACH WITH ITS STATUS: what the desk says is what deskVerify takes. qk/G1.7 and qk/G1.8 are the runs left
  // in verify.db, and the desk no longer has them waiting, so dropping them loses nothing.
  const ITEMS = {
    'qk/G1.1': { files: files(HANG), status: 'running' },
    'qk/G1.2': { files: files(GREEN), status: 'running' },
    'qk/G1.3': { files: files(GREEN), status: 'running' },
    'qk/G1.7': { files: files(GREEN), status: 'deskVerify passed' },
    'qk/G1.8': { files: files(GREEN), status: 'running' },
  };
  const factsOf = function (id) { const it = ITEMS[id] || { files: [], status: '' }; return { id: id, title: id, goal: 'qk/G1', status: it.status, code: false, go: true, fileCount: it.files.length }; };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
  // A claim on the desk: its record, and the item marked as waiting for deskVerify.
  const claim = function (id) { ITEMS[id].status = WAITING; rec('press', { id: id, what: 'claim-done' }); };
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          const a = flatCall.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a, at: Date.now() });
            if (verb === 'item.files') out = { files: ((ITEMS[a.id] || { files: [] }).files).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }), filesMore: false }; // goal/G32.2
            else if (verb === 'item.get') out = ITEMS[a.id] ? { item: JSON.stringify(factsOf(a.id)), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
            else if (verb === 'items.search') {
              // The desk's own search: every item of the goal, its facts as the label, the text matched on id and files.
              const text = String(a.text || '');
              const ids = Object.keys(ITEMS).filter(function (id) { return !text || id.indexOf(text) !== -1 || ITEMS[id].files.some(function (f) { return f.path.indexOf(text) !== -1; }); });
              out = { items: ids.map(function (id) { return { key: id, label: JSON.stringify(factsOf(id)) }; }), more: false };
            } else if (verb === 'item.chat') out = { chat: [], chatMore: false };
            else if (verb === 'verify.pass') { if (ITEMS[a.id]) ITEMS[a.id].status = 'deskVerify passed'; out = { change: 1 }; }
            else if (verb === 'verify.reject') { if (ITEMS[a.id]) ITEMS[a.id].status = 'deskVerify rejected it'; out = { change: 1 }; }
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const probe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(probe, '// a pull that changes nothing\n');
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const dbPath = path.join(run, 'verify.db');
  seedRuns(dbPath);
  const v = server(VERIFY, 'verify', { db: dbPath, watchMs: 300, waitMs: 1000, suiteMs: 60000, pull: process.execPath + ' ' + probe }, run);
  const lineOn = function (id) { return asks.filter(function (x) { return x.verb === 'chat.add' && x.args.id === id; }).map(function (x) { return String(x.args.text || ''); }); };
  const touched = function (id, since) { return asks.filter(function (x) { return x.at >= (since || 0) && x.args && x.args.id === id && x.verb !== 'item.get'; }).map(function (x) { return x.verb; }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return fn(); };
  try {
    v.start();
    if (!await v.up()) { test.fail(OWED + 'deskVerify did not start'); return; }

    test.subHeading('1. the runs left in verify.db are dropped at its start, never worked off');
    await sleep(4000);
    const left = touched('qk/G1.7').concat(touched('qk/G1.8'));
    if (!left.length) test.check('the queued qk/G1.7 and the waiting qk/G1.8 were not run: no check asked, no line posted');
    else test.fail(OWED + 'the runs left in verify.db were worked off: ' + short(left) + '; lines: G1.7 ' + short(lineOn('qk/G1.7')) + ', G1.8 ' + short(lineOn('qk/G1.8')));
    const open0 = runRows(dbPath).filter(function (r) { return (r.id === 'qk/G1.7' || r.id === 'qk/G1.8') && (r.state === 'queued' || r.state === 'waiting' || r.state === 'running'); });
    if (!open0.length) test.check('no row of theirs reads queued or waiting any more');
    else test.fail(OWED + 'verify.db still holds them open: ' + short(open0));

    test.subHeading('2. busy, a new claim is not queued');
    claim('qk/G1.1');
    const busy = await waitFor(async function () { const n = (await v.call('now', {})).body || {}; return n.running && n.running.id === 'qk/G1.1'; }, 20000);
    if (busy) test.check('the claim of qk/G1.1 is taken while free: it runs its hanging suite');
    else test.fail(OWED + 'qk/G1.1, claimed and waiting for deskVerify, was never run; now reads ' + short((await v.call('now', {})).body));
    const busySince = Date.now();
    claim('qk/G1.2');
    await sleep(2000);
    const now = (await v.call('now', {})).body || {};
    const queued = now.queued;
    if (now.ok !== false && (queued === undefined || (Array.isArray(queued) && !queued.length))) test.check('now names no queued run while qk/G1.1 runs');
    else test.fail(OWED + 'now answered a queue while busy: ' + short(now));
    const rows2 = runRows(dbPath).filter(function (r) { return r.state === 'queued' || r.state === 'waiting'; });
    if (!rows2.length) test.check('verify.db holds no queued or waiting row');
    else test.fail(OWED + 'verify.db queued the claim made while busy: ' + short(rows2));
    if (!touched('qk/G1.2', busySince).length) test.check('busy, it took nothing of qk/G1.2');
    else test.fail(OWED + 'busy, it worked on qk/G1.2: ' + short(touched('qk/G1.2', busySince)));

    test.subHeading('3. free again, it asks the desk what still waits, and nothing is lost');
    // qk/G1.3 waits for deskVerify with no record deskVerify ever read: only the item knows it.
    ITEMS['qk/G1.3'].status = WAITING;
    // qk/G1.1 no longer waits (the desk moved on), so its stop does not bring it back.
    ITEMS['qk/G1.1'].status = 'running';
    const freeAt = Date.now();
    await v.call('stop', {});
    await waitFor(function () { return lineOn('qk/G1.2').length > 0 && lineOn('qk/G1.3').length > 0; }, 40000);
    const searched = asks.filter(function (x) { return x.verb === 'items.search' && x.at >= freeAt && !x.args.text; });
    if (searched.length) test.check('free, it asked the desk which items wait (items.search, ' + searched.length + ' times)');
    else test.fail(OWED + 'free, it never asked the desk which items wait; desk verbs asked since: ' + short(asks.filter(function (x) { return x.at >= freeAt; }).map(function (x) { return x.verb + ' ' + (x.args.id || ''); })));
    if (lineOn('qk/G1.2').length) test.check('qk/G1.2, claimed while it was busy, was checked once it was free: ' + short(lineOn('qk/G1.2')[0]));
    else test.fail(OWED + 'qk/G1.2, claimed while busy, got no check after the run ended');
    if (lineOn('qk/G1.3').length) test.check('qk/G1.3, which the desk alone says waits, was checked: ' + short(lineOn('qk/G1.3')[0]));
    else test.fail(OWED + 'qk/G1.3 waits for deskVerify on the desk and was never checked (the item knows, not a queue)');
    const again = asks.filter(function (x) { return x.at >= freeAt + 1000 && x.verb === 'item.files' && x.args.id === 'qk/G1.1'; });
    if (!again.length) test.check('qk/G1.1, no longer waiting on the desk, was not run again');
    else test.fail(OWED + 'qk/G1.1 was run again though the desk no longer has it waiting');
  } finally {
    await v.stop();
    node.close();
    try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
    try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  }
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null }; }

async function faceHalf() {
  test.subHeading('4. the tab stays and lists no waiting run');
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'qk/G1', title: 'Queue', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = {
    now: function () { return { running: { id: 'qk/G1.1', suite: 'spirit/test/zzRunning.js', since: new Date().toISOString() }, queued: [{ kind: 'item', id: 'qk/G1.2' }, { kind: 'goal', id: 'qk/G1' }] }; },
    stop: function () { return { stopped: true }; },
  };
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const tabs = doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(50); await settled();
  const b = doc.getElementById('desk-verifier').innerHTML;
  const buttons = b.indexOf('id="desk-verify-full"');
  const one = b.indexOf('item qk/G1.2');
  const two = b.indexOf('goal qk/G1');
  // THE QUEUE IS GONE FROM THE TAB (goal/G33.2, Andy: "remove verifier queue"); the tab itself stays.
  if (b.indexOf('[object Object]') === -1 && buttons !== -1 && one === -1 && two === -1) test.check('the tab stays, its buttons drawn, and no waiting run is listed');
  else test.fail(OWED + '#desk-verifier reads ' + short(b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')));
}

(async function () {
  await verifyHalf();
  await faceHalf();
})().catch(function (e) { test.fail(OWED + 'the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
