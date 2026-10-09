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
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.11 for him to overrule:
//   deskVerify gains three verbs of its own (no grant of his: an app's own verbs, until he rules it intrinsic):
//     now {}                 -> {running: {id, suite, since}, queued: [id]}   running.id '' when idle
//     records.search {text}  -> {items: [{key, label}], more}  its dataset rows, newest first, text matched on the
//                               suite or title; a search with an empty query, bucket-bounded, never a list
//     stop {}                -> {stopped}  ends the suite running now; the claim it belonged to is rejected, its why
//                               saying it was stopped - never passed
//   THE FACE: a Verifier tab right after Musings, drawn only while deskVerify answers `now`. Its body, #desk-verifier,
//   shows what runs now (item and suite) and what waits. It listed the newest records too until goal/G8.12, when Andy
//   had that display removed; the assertion below now holds it gone. A Stop button
//   (#desk-verify-stop) asks deskVerify stop; a re-verify button (data-reverify="<id>") on the item running or last
//   checked asks the desk verify.again for that item. Clicks are taken on #desk-verifier.
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
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyTabTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const SLOW = 'zzTabSlow.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G8.11: the verifier tab in Desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifytab-'));

async function serverHalf() {
  test.subHeading('1. deskVerify: now, records.search and stop');
  fs.writeFileSync(path.join(__dirname, SLOW), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('tab slow probe');\nsetTimeout(function () { test.check('slow'); test.reportSuccessFailureCount(); process.exit(0); }, 8000);\n");
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
          if (verb === 'changes') out = { records: [], lines: [], n: Number(a.n) || 0, line: 0, more: false };
          else {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'tb/G1', code: true, go: true, files: [{ path: 'spirit/test/' + SLOW, by: 'claude-windows', core: false }] }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
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
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify({ db: path.join(root, 'verify.db'), watchMs: 60000, suiteMs: 60000 }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: deskVerify did not start'); return; }

    const idleNow = await call('now');
    if (took(idleNow) && idleNow.body.running && idleNow.body.running.id === '' && Array.isArray(idleNow.body.queued)) test.check('now, idle: nothing running, an empty queue');
    else test.fail(OWED + 'now answered ' + idleNow.status + ' ' + short(idleNow.body));

    const check = call('claim.check', { id: 'tb/G1.2' });
    await sleep(2000);
    const busy = await call('now');
    const r = busy.body && busy.body.running;
    if (took(busy) && r && r.id === 'tb/G1.2' && /zzTabSlow\.js/.test(String(r.suite)) && r.since) test.check('now, while a check runs: the item, its suite and since when');
    else test.fail(OWED + 'now during a run answered ' + busy.status + ' ' + short(busy.body));

    const stop = await call('stop');
    const done = await Promise.race([check, sleep(5000).then(function () { return null; })]);
    if (took(stop) && stop.body.stopped === true && done) test.check('stop ends the run at once');
    else test.fail(OWED + 'stop answered ' + stop.status + ' ' + short(stop.body) + (done ? '' : '; the check was still running 5 s later'));
    const rj = asks.filter(function (x) { return x.verb === 'verify.reject' && x.args.id === 'tb/G1.2'; });
    const ps = asks.filter(function (x) { return x.verb === 'verify.pass' && x.args.id === 'tb/G1.2'; });
    if (rj.length === 1 && !ps.length && /stop/i.test(String(rj[0].args.why))) test.check('a stopped run is a rejection saying so, never a pass');
    else test.fail(OWED + 'after stop the desk was asked ' + short(asks.filter(function (x) { return x.args.id === 'tb/G1.2'; })));
    const after = await call('now');
    if (took(after) && after.body.running && after.body.running.id === '') test.check('and now reads idle again');
    else test.fail(OWED + 'now after stop answered ' + short(after.body));

    await call('record', { suite: 'zzOld.js', title: 'first', outcome: 'green' });
    await sleep(20);
    await call('record', { suite: 'zzMid.js', title: 'second', outcome: 'red' });
    await sleep(20);
    await call('record', { suite: 'zzNew.js', title: 'third', outcome: 'green' });
    const all = await call('records.search', { text: '' });
    const rows = (all.body && Array.isArray(all.body.items) ? all.body.items : []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
    const names = rows.map(function (x) { return x.suite; }).filter(function (s) { return /^zz(Old|Mid|New)\.js$/.test(s); });
    if (took(all) && JSON.stringify(names) === JSON.stringify(['zzNew.js', 'zzMid.js', 'zzOld.js']) && rows.every(function (x) { return x.title && x.outcome && x.at; }) && typeof all.body.more === 'boolean') test.check('records.search with an empty query: the rows newest first, each with suite, title, outcome and time');
    else test.fail(OWED + 'records.search answered ' + all.status + ' ' + short(all.body));
    const one = await call('records.search', { text: 'zzMid' });
    const oneRows = (one.body && one.body.items || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
    if (took(one) && oneRows.length === 1 && oneRows[0].suite === 'zzMid.js' && oneRows[0].outcome === 'red') test.check('records.search with a query narrows to the matching rows');
    else test.fail(OWED + 'records.search zzMid answered ' + short(one.body));
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
  const goal = { id: 'tb/G1', title: 'Tab', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };

  const without = require('./deskFake.js').create([]);
  without.items = [goal];
  const docA = await mount(without);
  if (docA.getElementById('desk-tabs').innerHTML.indexOf('data-tab="verifier"') === -1) test.check('with no deskVerify on the node there is no Verifier tab');
  else test.fail(OWED + 'a Verifier tab is drawn with no deskVerify answering');

  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  const at = new Date().toISOString();
  fake.verifier = {
    now: function () { return { running: { id: 'tb/G1.2', suite: 'spirit/test/zzRunning.js', since: at }, queued: ['tb/G1.3'] }; },
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
  if (/tb\/G1\.2/.test(b) && /zzRunning\.js/.test(b) && /tb\/G1\.3/.test(b)) test.check('the tab shows what runs now, for which item, and what waits');
  else test.fail(OWED + '#desk-verifier reads ' + short(b));
  // THE RECORDS LIST WENT (goal/G8.12). Andy, 2026-10-09: "i want that damn log display gone. and only show the
  // latest status." This section asserted the list until that word; it now asserts its absence, so a session that
  // brings the log back goes red. The rows are still readable through deskVerify's records.search, asserted above.
  if (!/zzRecorded\.js/.test(b) && !/a record title/.test(b)) test.check('and no records list: the tab shows the run alone, never a log');
  else test.fail(OWED + 'the tab still draws the records list: ' + short(b));
  if (/id="desk-verify-stop"/.test(b) && /data-reverify="tb\/G1\.2"/.test(b)) test.check('with a Stop button and a re-verify for the running item');
  else test.fail(OWED + 'the buttons are missing: ' + short(b));

  const before = fake.calls.length;
  body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body });
  await settled();
  if (fake.calls.slice(before).some(function (c) { return c.server === 'deskVerify' && c.verb === 'stop'; })) test.check('Stop asks deskVerify stop');
  else test.fail(OWED + 'after Stop the calls were ' + short(fake.calls.slice(before)));
  const mid = fake.calls.length;
  body.fire('click', { target: target({ 'data-reverify': 'tb/G1.2' }), currentTarget: body });
  await settled();
  if (fake.calls.slice(mid).some(function (c) { return c.server === 'desk' && c.verb === 'verify.again' && c.args && c.args.id === 'tb/G1.2'; })) test.check('re-verify asks the desk verify.again for that item');
  else test.fail(OWED + 'after re-verify the calls were ' + short(fake.calls.slice(mid)));
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
