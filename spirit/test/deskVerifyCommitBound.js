'use strict';

// spirit/test/deskVerifyCommitBound.js
// goal/G18.10: deskVerify: commit-bound pass, re-verify while idle. Red on today's tree (9a9a30db); claude-windows wrote
// it and builds it (one agent). The item's box, in full: "deskVerify: no pass without the item's commit, and re-verify
// answers while idle", Andy: "yes."; found live on 2026-10-12: deskVerify passed goal/G18.7 "at 24533a26 (dirty, not
// pulled)" while the item's commit was 227b0ad4, so it checked other code than the item's; and Andy: "verify, when
// idling, does not react to my attempts of pushing it's re-verify button."
//
// WHAT IS ASSERTED
//   1. THE DESK: verify.again refused says why (an item done or closed, an item whose verify has not passed).
//   2. THE PASS IS BOUND TO THE COMMIT: an item whose chat names a commit (commitCheck's "commit <hash>: ..." line) that
//      the tree lacks gets no pass and no reject, and one line saying it was not checked and which commit is missing;
//      an item whose commit the tree holds passes as before; an item with no commit line passes as before.
//   3. THE BUTTON ANSWERS: a re-verify the desk refuses shows the refusal's why in the Verifier tab, never nothing.
// rule/11: through testSupport only; a fake node and its own desk; the pull is a probe, never a real git pull.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G18.10: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyCommitBoundTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyCommitBoundTestOwnerAAAAAAAAAAAAA=', label: 'andy' };
const GREEN = 'zzCommitBoundGreen.js';
const MISSING = '0123456789abcdef0123456789abcdef01234567';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G18.10: deskVerify passes only the item\'s commit, and the re-verify button always answers');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifycommitbound-'));

function server(script, name, args, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const kid = spawn(process.execPath, [script, JSON.stringify(args || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// ── 1. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('1. a refused verify.again says why');
  const d = server(DESK, 'desk');
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'vb/G1', title: 'Bound' }, items: [{ id: 'vb/G1.1', title: 'Unverified', blocks: ['vb/G1'] }, { id: 'vb/G1.2', title: 'Closed', blocks: ['vb/G1'] }] }) }, ANDY);
    await d.call('press', { id: 'vb/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'vb/G1.1', what: 'code' }, ANDY);
    await d.call('press', { id: 'vb/G1.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'vb/G1.2', what: 'close' }, ANDY);
    const early = (await d.call('verify.again', { id: 'vb/G1.1' }, ANDY)).body || {};
    const closed = (await d.call('verify.again', { id: 'vb/G1.2' }, ANDY)).body || {};
    if (early.ok === false && early.extra && /verif/i.test(String(early.extra.why))) test.check('on an item whose verify has not passed: refused, saying so (' + early.extra.why + ')');
    else test.fail(OWED + 'verify.again on an unverified item answered ' + short(early));
    if (closed.ok === false && closed.extra && /closed|done/i.test(String(closed.extra.why))) test.check('on a closed item: refused, saying so (' + closed.extra.why + ')');
    else test.fail(OWED + 'verify.again on a closed item answered ' + short(closed));
  } finally { await d.stop(); }
}

// ── 2. THE PASS IS BOUND TO THE ITEM'S COMMIT ───────────────────────────
async function verifyHalf() {
  test.subHeading('2. no pass without the item\'s commit in the tree');
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('commit-bound green probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const repo = path.join(__dirname, '..', '..');
  const head = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout || '').trim();
  const files = [{ path: 'spirit/test/' + GREEN, by: 'claude-windows', core: false }];
  // commitCheck's line under an item, as it writes it once the remote holds the commit.
  const commitLine = function (hash) { return { by: 'claude-windows', at: new Date().toISOString(), text: 'commit ' + hash + ': vb: a commit\n- spirit/test/' + GREEN, taken: '' }; };
  const CHATS = { 'vb/G1.1': [commitLine(head)], 'vb/G1.2': [commitLine(MISSING)], 'vb/G1.3': [] };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
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
            asks.push({ verb: verb, args: a });
            if (verb === 'item.files') out = { files: (({ id: a.id, goal: 'vb/G1', code: false, go: true, files: files }) || {}).files ? (({ id: a.id, goal: 'vb/G1', code: false, go: true, files: files }).files || []).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }) : [], filesMore: false }; // goal/G32.2: the file list is its own answer
            else if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'vb/G1', code: false, go: true, files: files }), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: (CHATS[a.id] || []).slice(), chatMore: false };
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
  const v = server(VERIFY, 'verify', { db: path.join(run, 'verify.db'), watchMs: 300, suiteMs: 20000, pull: process.execPath + ' ' + probe }, run);
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && x.args.id === id; }); };
  const lineOn = function (id) { return said('chat.add', id).map(function (x) { return String(x.args.text || ''); }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  try {
    if (!await v.up()) { test.fail('deskVerify did not start'); return; }
    await sleep(1500);
    for (const id of ['vb/G1.1', 'vb/G1.2', 'vb/G1.3']) {
      rec('press', { id: id, what: 'claim-done' });
      await waitFor(function () { return lineOn(id).length > 0; }, 15000);
    }
    const missing = lineOn('vb/G1.2')[0] || '';
    if (!said('verify.pass', 'vb/G1.2').length && !said('verify.reject', 'vb/G1.2').length) test.check('the tree lacks the item\'s commit: no pass and no reject');
    else test.fail(OWED + 'an item whose commit the tree lacks got ' + said('verify.pass', 'vb/G1.2').length + ' pass(es) and ' + said('verify.reject', 'vb/G1.2').length + ' reject(s); its line: ' + short(missing));
    if (/not checked/i.test(missing) && missing.indexOf(MISSING.slice(0, 8)) !== -1) test.check('and one line saying it was not checked, naming the missing commit');
    else test.fail(OWED + 'the line on that item reads ' + short(missing));
    if (said('verify.pass', 'vb/G1.1').length === 1) test.check('the item whose commit the tree holds passes as before');
    else test.fail(OWED + 'the item at HEAD got ' + said('verify.pass', 'vb/G1.1').length + ' pass(es); its line: ' + short(lineOn('vb/G1.1')));
    if (said('verify.pass', 'vb/G1.3').length === 1) test.check('an item with no commit line passes as before');
    else test.fail(OWED + 'the item without a commit line got ' + said('verify.pass', 'vb/G1.3').length + ' pass(es)');
  } finally {
    await v.stop();
    node.close();
    try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  }
}

// ── 3. THE BUTTON ANSWERS ───────────────────────────────────────────────
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
  test.subHeading('3. a refused re-verify shows its why in the Verifier tab');
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'vb/G1', title: 'Bound', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = {
    now: function () { return { running: { id: '', suite: '', since: '' }, queued: [], last: 'vb/G1.2' }; },
    stop: function () { return { stopped: true }; },
  };
  const WHY = 'vb/G1.2 is closed: a settled item is not verified again';
  fake.verifyAgain = function () { return { ok: false, code: 'not-offered', error: 'desk: that press is not offered for this item now', extra: { why: WHY } }; };
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
  const body = doc.getElementById('desk-verifier');
  body.fire('click', { target: target({ 'data-reverify': 'vb/G1.2' }), currentTarget: body });
  await settled(); await sleep(50); await settled();
  const asked = fake.calls.some(function (c) { return c.server === 'desk' && c.verb === 'verify.again' && c.args && c.args.id === 'vb/G1.2'; });
  const shown = Object.keys(byId).map(function (k) { return byId[k].innerHTML + ' ' + byId[k].textContent; }).join('\n');
  if (asked) test.check('the world: the button asked the desk verify.again');
  else test.fail('the world: no verify.again was asked: ' + short(fake.calls.slice(-4)));
  if (shown.indexOf(WHY) !== -1) test.check('the desk\'s refusal is shown with its why');
  else test.fail(OWED + 'after a refused re-verify the page shows nothing of it; #desk-verifier reads ' + short(body.innerHTML));
}

(async function () {
  await deskHalf();
  await verifyHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
