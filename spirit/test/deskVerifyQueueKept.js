'use strict';

// spirit/test/deskVerifyQueueKept.js
// goal/G19.3: deskVerify: the Verifier tab vanishes when work is queued. Red on today's tree (7b60cdb7); claude-windows
// wrote it and builds it (one agent). The item's box: the now verb declares queued: [''] but returns objects, so its
// reply is refused and the tab vanishes. Andy, 2026-10-12: "is there queued work in verifier? if so, then yes, the
// verifier tab may keep an updated queue list below it's current ui elements."; "and we make sure it doesn't stop
// working until the queue is worked off."; "so the runs must be stored verifier history, in verifier.db".
//
// WHAT IS ASSERTED
//   1. now answers while work is queued, each queued run as {kind, id}.
//   2. every run is a row in verify.db; a restart takes up the runs that had not ended, in their order.
//   3. the Verifier tab lists the queue below its current elements, kind and id each.
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

const OWED = 'OWED by goal/G19.3: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const HANG = 'zzQueueKeptHang.js';
const GREEN = 'zzQueueKeptGreen.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G19.3: the Verifier queue is answered, kept in verify.db across a restart, and listed in the tab');
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

async function verifyHalf() {
  fs.writeFileSync(path.join(__dirname, HANG), "'use strict';\nsetInterval(function () {}, 1000);\n");
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('queue green probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const files = function (f) { return [{ path: 'spirit/test/' + f, by: 'claude-windows', core: false }]; };
  const ITEMS = { 'qk/G1.1': files(HANG), 'qk/G1.2': files(GREEN), 'qk/G1.3': files(GREEN) };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          const a = j.ask.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'qk/G1', code: false, go: true, files: ITEMS[a.id] || [] }), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: [], chatMore: false };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
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
  const v = server(VERIFY, 'verify', { db: dbPath, watchMs: 300, suiteMs: 60000, pull: process.execPath + ' ' + probe }, run);
  const lineOn = function (id) { return asks.filter(function (x) { return x.verb === 'chat.add' && x.args.id === id; }).map(function (x) { return String(x.args.text || ''); }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return fn(); };
  try {
    v.start();
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    await sleep(1500);

    test.subHeading('1. now answers while work is queued');
    rec('press', { id: 'qk/G1.1', what: 'claim-done' });
    await waitFor(async function () { const n = (await v.call('now', {})).body || {}; return n.running && n.running.id === 'qk/G1.1'; }, 15000);
    rec('press', { id: 'qk/G1.2', what: 'claim-done' });
    rec('press', { id: 'qk/G1.3', what: 'claim-done' });
    await sleep(1500);
    const now = (await v.call('now', {})).body || {};
    const queued = Array.isArray(now.queued) ? now.queued : null;
    if (now.ok !== false && queued && queued.length === 2 && queued.every(function (q) { return q && typeof q === 'object' && q.kind === 'item'; }) &&
        queued.map(function (q) { return q.id; }).join() === 'qk/G1.2,qk/G1.3') test.check('now answers with qk/G1.1 running and two runs waiting, each {kind, id}');
    else test.fail(OWED + 'now answered ' + short(now));

    test.subHeading('2. kept in verify.db, taken up after a restart');
    let rows = [];
    try { const d = new DatabaseSync(dbPath, { readOnly: true }); rows = d.prepare('SELECT kind, id, state FROM runs ORDER BY rowid').all(); d.close(); } catch (e) { rows = []; }
    const said = rows.map(function (r) { return r.kind + ' ' + r.id + ' ' + r.state; }).join(' | ');
    if (said === 'item qk/G1.1 running | item qk/G1.2 queued | item qk/G1.3 queued') test.check('verify.db holds the runs: ' + said);
    else test.fail(OWED + 'verify.db runs read ' + short(rows));
    await v.stop();
    v.start();
    if (!await v.up()) { test.fail('deskVerify did not come back'); return; }
    // No new word from the desk: the restart alone takes the runs up (the hanging one runs again, from the start).
    await waitFor(function () { return lineOn('qk/G1.2').length > 0 || lineOn('qk/G1.3').length > 0; }, 4000);
    const after = (await v.call('now', {})).body || {};
    const back = [after.running && after.running.id].concat((after.queued || []).map(function (q) { return q && q.id; })).filter(Boolean).join();
    if (back === 'qk/G1.1,qk/G1.2,qk/G1.3') test.check('after a restart it runs qk/G1.1 again and qk/G1.2, qk/G1.3 still wait, in their order');
    else test.fail(OWED + 'after a restart now reads ' + short(after));
    await v.call('stop', {});
    await waitFor(function () { return lineOn('qk/G1.2').length > 0 && lineOn('qk/G1.3').length > 0; }, 30000);
    if (lineOn('qk/G1.2').length && lineOn('qk/G1.3').length) test.check('and it works the queue off: both waiting runs got their line');
    else test.fail(OWED + 'lines after the restart: G1.2 ' + short(lineOn('qk/G1.2')) + ', G1.3 ' + short(lineOn('qk/G1.3')));
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
  test.subHeading('3. the tab lists the queue below its current elements');
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
  if (b.indexOf('[object Object]') === -1 && buttons !== -1 && one > buttons && two > one) test.check('below the buttons: item qk/G1.2, then goal qk/G1');
  else test.fail(OWED + '#desk-verifier reads ' + short(b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')));
}

(async function () {
  await verifyHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, HANG)); } catch (e) { /* gone */ }
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
