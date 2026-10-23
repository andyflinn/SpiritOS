'use strict';

// goal/G8.11: the verifier tab in Desk. Red on today's tree; claude-windows wrote it from G8.11's box and does not
// build it.
//   Andy, 2026-10-09: "So, i was thinking. shouldn't i have, if the desk verifier is mounted and running, a verifier
//   tab in desk, right after [musings], that allows me to monitor a) status and progress of the running verifier, and
//   if/when necessary, allow intervention?", then "i still don't see a verifier tab on my desk", and "add it".
//
// WHAT IS TRUE TODAY (read at 0aa6d159): deskVerify watches the desk and runs claim.check one item at a time
// (goal/G8.10), but nothing outside it can see what it is running, read its records, or stop a run; the Desk face has
// no such tab. The face already shows a server only while it answers - backup's status (desk/G1.7) is the pattern.
//
// THE SHAPE ASSERTED (reshaped by goal/G33.3, where deskVerify became a runner that knows no item, and the box: "The
// Verifier tab shows only what runs now, its console, and Stop."):
//   deskVerify: now {} -> {busy, running: {suite, since}, stopAsked}; stop {} -> {stopped}, ending the suite running
//   now, the run kept as stopped, never green.
//   THE FACE: a Verifier tab right after Musings, drawn only while deskVerify answers `now`. Its body, #desk-verifier,
//   shows the suite running now, no records and no waiting run; a Stop button (#desk-verify-stop) asks deskVerify stop,
//   and nothing else: no re-verify (a run starts from the item now). Clicks are taken on #desk-verifier.
// NOT ASSERTED: layout, colours and refresh timing - UI that is his to judge on his own node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.11: ';
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyTabTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const SLOW = 'zzTabSlow.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G8.11: the verifier tab in Desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifytab-'));

async function serverHalf() {
  // Since goal/G33.3 a run is handed to deskVerify with run {suites, commit}; it asks the desk nothing.
  test.subHeading('1. deskVerify: now and stop');
  fs.writeFileSync(path.join(__dirname, SLOW), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('tab slow probe');\nsetTimeout(function () { test.check('slow'); test.reportSuccessFailureCount(); process.exit(0); }, 8000);\n");
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
          // (Its answer to the desk's `changes` went with goal/G33.4: the verb is gone, and deskVerify never asked it.)
          {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.files') out = { files: (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }) || {}).files ? (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }).files || []).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }) : [], filesMore: false }; // goal/G32.2: the file list is its own answer
            else if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'goal/G100', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'verify');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify({ db: path.join(root, 'verify.db'), watchMs: 300, suiteMs: 60000, pull: '' }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: deskVerify did not start'); return; }

    const idleNow = await call('now');
    if (took(idleNow) && idleNow.body.busy === false && idleNow.body.running && idleNow.body.running.suite === '') test.check('now, idle: not busy, nothing running');
    else test.fail(OWED + 'now answered ' + idleNow.status + ' ' + short(idleNow.body));

    await call('run', { suites: ['spirit/test/' + SLOW], commit: '' });
    await sleep(2500);
    const busy = await call('now');
    const r = busy.body && busy.body.running;
    if (took(busy) && busy.body.busy === true && r && /zzTabSlow\.js/.test(String(r.suite)) && r.since) test.check('now, while a run runs: busy, its suite and since when');
    else test.fail(OWED + 'now during a run answered ' + busy.status + ' ' + short(busy.body));

    const stop = await call('stop');
    let done = false;
    for (let i = 0; i < 25 && !done; i++) { await sleep(200); done = ((await call('now')).body || {}).busy === false; }
    if (took(stop) && stop.body.stopped === true && done) test.check('stop ends the run at once');
    else test.fail(OWED + 'stop answered ' + stop.status + ' ' + short(stop.body) + (done ? '' : '; the run was still on 5 s later'));
    const rows = ((((await call('search', { over: 'runs', suite: SLOW })).body || {}).items) || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return null; } }).filter(Boolean);
    if (rows.length === 1 && rows[0].outcome === 'stopped' && rows[0].suites[0].outcome === 'stopped') test.check('a stopped run is kept as stopped, never green');
    else test.fail(OWED + 'after stop the run reads ' + short(rows));
    const after = await call('now');
    if (took(after) && after.body.busy === false && after.body.running && after.body.running.suite === '') test.check('and now reads idle again');
    else test.fail(OWED + 'now after stop answered ' + short(after.body));
    if (!asks.length) test.check('and deskVerify asked the desk nothing');
    else test.fail(OWED + 'deskVerify asked the desk ' + short(asks.slice(0, 4)));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
    try { fs.unlinkSync(path.join(__dirname, SLOW)); } catch (e) { /* gone */ }
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
function target(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}
async function mount(fake) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const container = fakeElement('container');
  behavior.mount(container, {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  return doc;
}

async function faceHalf() {
  test.subHeading('2. the face: a Verifier tab after Musings, only while deskVerify answers');
  const goal = { id: 'goal/G100', title: 'Tab', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };

  const without = require('./deskFake.js').create([]);
  without.items = [goal];
  const docA = await mount(without);
  if (docA.getElementById('desk-tabs').innerHTML.indexOf('data-tab="verifier"') === -1) test.check('with no deskVerify on the node there is no Verifier tab');
  else test.fail(OWED + 'a Verifier tab is drawn with no deskVerify answering');

  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  const at = new Date().toISOString();
  fake.verifier = {
    now: function () { return { busy: true, running: { suite: 'spirit/test/zzRunning.js', since: at }, stopAsked: false }; },
    'records.search': function () { return { items: [{ key: '9', label: JSON.stringify({ suite: 'zzRecorded.js', title: 'a record title', outcome: 'red', commit: 'abc1234', at: at }) }], more: false }; },
    stop: function () { return { stopped: true }; },
  };
  const docB = await mount(fake);
  const tabs = docB.getElementById('desk-tabs');
  // The page may learn of the verifier on a later turn, as backup's status arrives: give it a few.
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  const html = tabs.innerHTML;
  const mus = html.indexOf('data-tab="musings"');
  const ver = html.indexOf('data-tab="verifier"');
  const des = Math.min.apply(null, ['desk-end-design', 'desk-start-design'].map(function (id) { const p = html.indexOf('id="' + id + '"'); return p === -1 ? Number.MAX_SAFE_INTEGER : p; }));
  if (ver !== -1 && ver > mus && ver < des) test.check('with deskVerify answering, a Verifier tab sits right after Musings');
  else test.fail(OWED + 'in the tab row: ' + short({ musingsAt: mus, verifierAt: ver }));

  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(50); await settled();
  const body = docB.getElementById('desk-verifier');
  const b = body.innerHTML;
  if (/zzRunning\.js/.test(b)) test.check('the tab shows what runs now: its suite');
  else test.fail(OWED + '#desk-verifier reads ' + short(b));
  // THE RECORDS LIST WENT (goal/G8.12). Andy, 2026-10-09: "i want that damn log display gone. and only show the
  // latest status." This section asserted the list until that word; it now asserts its absence, so a session that
  // brings the log back goes red. (records.search, which still served the rows, went in goal/G19.11; the fake verifier
  // above still offers a row so a tab that asked for one would draw it.)
  if (!/zzRecorded\.js/.test(b) && !/a record title/.test(b)) test.check('and no records list: the tab shows the run alone, never a log');
  else test.fail(OWED + 'the tab still draws the records list: ' + short(b));
  if (/id="desk-verify-stop"/.test(b) && !/data-reverify/.test(b) && !/desk-verify-full/.test(b)) test.check('with a Stop button, and no re-verify or full-run button (goal/G33.3)');
  else test.fail(OWED + 'the buttons read: ' + short(b));

  const before = fake.calls.length;
  body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body });
  await settled();
  if (fake.calls.slice(before).some(function (c) { return c.server === 'deskVerify' && c.verb === 'stop'; })) test.check('Stop asks deskVerify stop');
  else test.fail(OWED + 'after Stop the calls were ' + short(fake.calls.slice(before)));
}

(async function () {
  await serverHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, SLOW)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
