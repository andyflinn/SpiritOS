'use strict';

// spirit/test/deskVerifyDoorRun.js
// goal/G22.3: every Stacks run goes through deskVerify, and the Verifier tab shows the run's output as a console. Red
// first; claude-windows writes it and builds it (one agent).
//
// ANDY'S RULINGS, 2026-10-13, in goal/G22.3's box, asserted one by one:
//   "every run here should report to deskVerify."
//   "it be even better if the verify tab showed the detailed results in a console like fashion, cleared before every
//   new run. If it's solved there, every run even the ones from Stack, already would have output. it means this app
//   here should launch the run through deskVerify."
//
// WHAT IS ASSERTED
//   1. door.run {id}: deskVerify queues a run of the stack-frame suite in its one-door mode for that door, through its
//      own queue (one check at a time: it waits behind a check already running), answered at once; the run is a row in
//      its runs (kind door, the door's id, its outcome and its line); the suite's records land in its record with their
//      failure text; its verdict is kept and read back by door.state {id}; Stop ends it like any run; a bad id is
//      refused.
//   2. console {from}: the CURRENT run's output, every suite's stdout and stderr in order, cleared when a new run starts,
//      capped in bytes, tailed from an offset ({run, from, to, more, ended, text}); and each object deskVerify publishes
//      carries consoleRun and consoleTo, so the tab tails it live.
//   3. the face: the Verifier tab has a console pane, monospace and scrolling, filled by tailing console as published
//      objects arrive, and cleared when the published run changes.
//
// HOW: rule/11, through testSupport only. deskVerify is pointed at a scratch git repo (its `repo` argument) whose
// spirit/test holds a scratch oneDoorStacks.js and a slow item probe, so no real suite runs; a fake node stands in for
// the node and the desk and hands the suites' records to the deskVerify under test; deskFake for the face.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G22.3: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const SUPPORT = path.join(__dirname, 'testSupport.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyDoorRunTestOwnerAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 10; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r && r.status === 200 && r.body && r.body.ok !== false; }
function labels(r) { return ((r && r.body && r.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean); }
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(150); } return !!(await fn()); }

test.startTest('goal/G22.3: a Stacks run goes through deskVerify, and the Verifier tab shows its console');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifydoorrun-'));

// ── THE SCRATCH REPO: a scratch one-door runner standing where the stack-frame suite stands, and a slow item probe ──
function git(cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }
function scratchRepo(name, files) {
  const repo = path.join(scratch, name);
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  Object.keys(files).forEach(function (f) { fs.writeFileSync(path.join(repo, f), files[f]); });
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'doorrun@example.invalid']);
  git(repo, ['config', 'user.name', 'doorrun']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--no-verify', '-m', 'probes']);
  return repo;
}
// THE ONE-DOOR RUNNER, as oneDoorStacks.js behaves in its one-door mode: it says the door it was handed, fails that
// door's test with its why, and writes its verdict to SPIRIT_STACKS_VERDICT. d8 is slow (a Stop meets it running), d9
// is loud (400 KB of output, past the console's cap).
const RUNNER = "'use strict';\nconst fs = require('fs');\nconst test = require(" + JSON.stringify(SUPPORT) + ");\n" +
  "const door = String(process.env.SPIRIT_STACKS_DOOR || '');\nconst out = String(process.env.SPIRIT_STACKS_VERDICT || '');\n" +
  "test.startTest('scratch door runner');\n" +
  "console.log('scratch door runner on door ' + door + (out ? ', verdict to a file' : ', no verdict file'));\n" +
  "console.error('scratch door runner stderr line');\n" +
  "if (door === 'd9') { const line = 'x'.repeat(1023) + '\\n'; for (let i = 0; i < 400; i++) process.stdout.write(line); }\n" +
  "setTimeout(function () {\n" +
  "  if (out) fs.writeFileSync(out, JSON.stringify({ door: door, green: false, around: 2, of: 5, paths: ['POST /x from spirit/run/js/a.js:1:f', 'POST /y from spirit/run/js/b.js:2:g'], why: '' }));\n" +
  "  test.fail('nobody but scratch reaches the door ' + door, '2 path(s) around the gate, of 5 production call(s)');\n" +
  "  test.reportSuccessFailureCount();\n  process.exit(0);\n}, door === 'd8' ? 10000 : 1500);\n";
const ITEM_PROBE = "'use strict';\nconst test = require(" + JSON.stringify(SUPPORT) + ");\ntest.startTest('door run item probe');\n" +
  "console.log('item probe output, of the run before');\nsetTimeout(function () { test.check('item probe green'); test.reportSuccessFailureCount(); process.exit(0); }, 3000);\n";

// ── A FAKE NODE: the desk, the records handed on to deskVerify, and what deskVerify publishes ──
function fakeNode() {
  return new Promise(function (resolve) {
    const st = { asks: [], published: [], records: [], files: {}, forward: null };
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', async function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) st.published.push(j.app); }
        else if (j && j.ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          const a = j.ask.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = st.records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            st.asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'dr/G1', code: true, go: true, files: (st.files[a.id] || []).map(function (p) { return { path: p, by: 'claude-windows', core: false }; }) }), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: [], chatMore: false };
            else if (verb === 'items.search') out = { items: [], more: false };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) {
          try { const r = st.forward ? await st.forward(j.ask.deskVerify) : null; out = (r && r.body) || { written: false }; } catch (e) { out = { written: false }; }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () {
      st.port = s.address().port;
      st.close = function () { s.close(); };
      st.rec = function (verb, body) { st.records.push({ n: st.records.length + 1, at: new Date().toISOString(), verb: verb, by: 'andy', key: '', body: JSON.stringify(body) }); };
      st.said = function (verb, id) { return st.asks.filter(function (x) { return x.verb === verb && x.args.id === id; }); };
      resolve(st);
    });
  });
}
function startVerify(name, node, args) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskverify-doorrun-' + name, SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' });
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify(args), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: '', publicKey: '', ownerKey: '' })],
    { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  node.forward = function (ask) { return client.ask({ deskVerify: ask }, ANDY); };
  return {
    call: call, state: state,
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// ── 1 AND 2. THE SERVER ────────────────────────────────────────────────────────────────────────────────────────
async function serverHalf() {
  test.subHeading('1. door.run: one door\'s run, queued, recorded, its verdict kept; 2. the console of the current run');
  const repo = scratchRepo('repo', { 'spirit/test/oneDoorStacks.js': RUNNER, 'spirit/test/zzDoorItem.js': ITEM_PROBE });
  const node = await fakeNode();
  node.files['dr/G1.1'] = ['spirit/test/zzDoorItem.js'];
  const v = startVerify('v', node, { db: path.join(scratch, 'v', 'verify.db'), watchMs: 300, suiteMs: 30000, pull: '', repo: repo, idleMs: 3600000, idleCheckMs: 3600000 });
  const q = function (a) { return v.call('search', Object.assign({ over: 'runs', suite: '', test: '', outcome: '', commit: '', item: '', kind: '', since: '' }, a)); };
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(1200);

    // ONE CHECK AT A TIME: an item's check runs first, and the door waits behind it in the same queue.
    node.rec('verify.again', { id: 'dr/G1.1' });
    const itemRunning = await waitFor(async function () { const n = await v.call('now'); return took(n) && n.body.running && n.body.running.id === 'dr/G1.1' && /zzDoorItem/.test(String(n.body.running.suite)); }, 8000);
    if (itemRunning) test.check('the world: an item\'s check is running (zzDoorItem.js)');
    else test.fail('the world: the item check never started');
    let midItem = {};
    await waitFor(async function () { midItem = await v.call('console', { from: 0 }); return took(midItem) && /item probe output/.test(String(midItem.body.text)); }, 4000);
    if (took(midItem) && /item probe output, of the run before/.test(String(midItem.body.text))) test.check('console, mid-run: the running suite\'s output, as it prints it');
    else test.fail(OWED + 'console during the item check answered ' + short(midItem.body));
    const t0 = Date.now();
    const queued = await v.call('door.run', { id: 'd7' });
    const ms = Date.now() - t0;
    if (took(queued) && queued.body.queued === true && ms < 1500) test.check('door.run answers at once (' + ms + ' ms): queued');
    else test.fail(OWED + 'door.run answered ' + short(queued.body) + ' in ' + ms + ' ms');
    const nowQ = await v.call('now');
    if (took(nowQ) && (nowQ.body.queued || []).some(function (x) { return x.kind === 'door' && x.id === 'd7'; })) test.check('it waits in deskVerify\'s queue behind the check running now: ' + short(nowQ.body.queued));
    else test.fail(OWED + 'now while the item runs answered ' + short(nowQ.body));
    const again = await v.call('door.run', { id: 'd7' });
    const nowQ2 = await v.call('now');
    if (took(again) && (nowQ2.body.queued || []).filter(function (x) { return x.kind === 'door' && x.id === 'd7'; }).length === 1) test.check('a second door.run of a door already waiting queues nothing more');
    else test.fail(OWED + 'a second door.run: ' + short(again.body) + ', queue ' + short(nowQ2.body && nowQ2.body.queued));
    for (const bad of ['', '../x', 'd 7', 'a'.repeat(80)]) {
      const r = await v.call('door.run', { id: bad });
      if (!took(r)) test.check('door.run refuses the id ' + JSON.stringify(bad.slice(0, 12)));
      else test.fail(OWED + 'door.run took the id ' + JSON.stringify(bad) + ': ' + short(r.body));
    }

    // THE DOOR RUNS, in its turn, and its console is its own.
    const doorRunning = await waitFor(async function () { const n = await v.call('now'); return took(n) && /oneDoorStacks\.js/.test(String(n.body.running && n.body.running.suite)); }, 15000);
    if (doorRunning) test.check('then the door runs, the stack-frame suite in one-door mode');
    else test.fail(OWED + 'the door never ran: now reads ' + short((await v.call('now')).body));
    await sleep(500);
    const midDoor = await v.call('console', { from: 0 });
    const mt = String((midDoor.body && midDoor.body.text) || '');
    if (took(midDoor) && /scratch door runner on door d7, verdict to a file/.test(mt) && !/item probe output/.test(mt)) test.check('console is cleared when a new run starts: the door\'s output only, the item\'s gone');
    else test.fail(OWED + 'console during the door run answered ' + short(midDoor.body));
    if (took(midDoor) && midItem.body && String(midDoor.body.run) !== String(midItem.body.run) && midDoor.body.ended === false) test.check('the new run has its own run id, and it is not ended');
    else test.fail(OWED + 'the run ids: ' + short([midItem.body && midItem.body.run, midDoor.body && midDoor.body.run, midDoor.body && midDoor.body.ended]));
    if (/scratch door runner stderr line/.test(mt)) test.check('stderr is in the console too');
    else test.fail(OWED + 'no stderr line in the console: ' + short(mt));
    const pubDoor = node.published.filter(function (p) { return p && p.doing === 'door' && p.id === 'd7'; });
    if (pubDoor.length) test.check('the run is published as doing door, id d7');
    else test.fail(OWED + 'nothing published with doing door: ' + short(node.published.slice(-2)));
    if (node.published.some(function (p) { return p && p.consoleRun && Number(p.consoleTo) > 0; })) test.check('published objects carry consoleRun and consoleTo, so the tab tails the console live');
    else test.fail(OWED + 'no published object carries consoleRun and consoleTo: ' + short(node.published.slice(-1)));

    const doorEnded = await waitFor(async function () { const s = await v.call('door.state', { id: 'd7' }); return took(s) && s.body.running === false && s.body.ran === true; }, 15000);
    const st = await v.call('door.state', { id: 'd7' });
    const sb = st.body || {};
    if (doorEnded && sb.green === false && sb.around === 2 && sb.of === 5 && Array.isArray(sb.paths) && sb.paths.length === 2 && sb.endedAt && sb.commit) test.check('door.state reads its kept verdict: red, 2 around of 5, both paths, when and at which commit');
    else test.fail(OWED + 'door.state answered ' + short(sb));
    const verdictFiles = (function walk(dir) { let out = []; try { fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) { const f = path.join(dir, e.name); if (e.isDirectory()) out = out.concat(walk(f)); else out.push(f); }); } catch (e) { /* none */ } return out; }(v.state));
    if (verdictFiles.some(function (f) { return /\.json$/.test(f) && fs.readFileSync(f, 'utf8').indexOf('"around":2') !== -1; })) test.check('the verdict is kept by deskVerify under its own --state');
    else test.fail(OWED + 'no verdict kept under deskVerify\'s state: ' + short(verdictFiles));
    const endCon = await v.call('console', { from: 0 });
    if (took(endCon) && endCon.body.ended === true && /scratch door runner/.test(String(endCon.body.text))) test.check('once the run ended, console says ended and still holds its output until the next run');
    else test.fail(OWED + 'console after the run answered ' + short(endCon.body));
    const to = Number(endCon.body && endCon.body.to) || 0;
    const tail = await v.call('console', { from: to });
    if (took(tail) && tail.body.text === '' && Number(tail.body.from) === to && tail.body.more === false) test.check('console from its end: nothing more');
    else test.fail(OWED + 'console from ' + to + ' answered ' + short(tail.body));
    const part = await v.call('console', { from: 5 });
    if (took(part) && Number(part.body.from) === 5 && String(endCon.body.text).slice(5).indexOf(String(part.body.text)) === 0) test.check('console from an offset: the text from there');
    else test.fail(OWED + 'console from 5 answered ' + short(part.body));

    await sleep(800);
    const rows = labels(await q({ kind: 'door', item: 'd7' }));
    if (rows.length === 1 && rows[0].outcome === 'red' && /d7/.test(String(rows[0].line)) && rows[0].ended) test.check('the run is a row in deskVerify\'s runs: kind door, its outcome red and its line');
    else test.fail(OWED + 'runs of door d7: ' + short(rows));
    const recs = labels(await v.call('search', { over: 'tests', suite: 'oneDoorStacks.js', test: '', outcome: 'red', commit: '', item: '', kind: '', since: '' }));
    if (recs.some(function (r) { return /door d7/.test(r.title) && /2 path\(s\) around the gate/.test(String(r.failure)); })) test.check('the suite\'s record is in deskVerify\'s record with its failure text');
    else test.fail(OWED + 'the records of oneDoorStacks.js: ' + short(recs));

    // A STOP ENDS A DOOR RUN LIKE ANY RUN.
    await v.call('door.run', { id: 'd8' });
    const d8Running = await waitFor(async function () { const s = await v.call('door.state', { id: 'd8' }); return took(s) && s.body.running === true; }, 8000);
    const stop = await v.call('stop');
    const d8Ended = await waitFor(async function () { const s = await v.call('door.state', { id: 'd8' }); return took(s) && s.body.running === false && s.body.endedAt; }, 8000);
    const s8 = (await v.call('door.state', { id: 'd8' })).body || {};
    if (d8Running && took(stop) && stop.body.stopped === true && d8Ended && s8.stopped === true && s8.ran === false) test.check('Stop ends a door run; door.state says it was stopped, with no verdict');
    else test.fail(OWED + 'the stopped door: running ' + d8Running + ', stop ' + short(stop.body) + ', state ' + short(s8));
    await sleep(500);
    const r8 = labels(await q({ kind: 'door', item: 'd8' }));
    if (r8.length === 1 && /stop/i.test(String(r8[0].outcome))) test.check('its row says stopped by hand');
    else test.fail(OWED + 'runs of door d8: ' + short(r8));
    const never = await v.call('door.state', { id: 'd5' });
    if (took(never) && never.body.ran === false && never.body.running === false && never.body.queued === false) test.check('door.state of a door never run: nothing ran');
    else test.fail(OWED + 'door.state of d5 answered ' + short(never.body));

    // THE CONSOLE IS CAPPED IN BYTES: 400 KB printed, the front dropped.
    await v.call('door.run', { id: 'd9' });
    await waitFor(async function () { const s = await v.call('door.state', { id: 'd9' }); return took(s) && s.body.running === false && s.body.ran === true; }, 20000);
    const big = (await v.call('console', { from: 0 })).body || {};
    const held = (Number(big.to) || 0) - (Number(big.from) || 0);
    if (Number(big.start) > 0 && Number(big.from) === Number(big.start) && big.more === true) test.check('the console is capped: ' + big.start + ' bytes dropped from its front, a read from 0 starts at what is held');
    else test.fail(OWED + 'console after 400 KB answered ' + short(Object.assign({}, big, { text: String(big.text || '').length })));
    if (held > 0 && Buffer.byteLength(String(big.text || ''), 'utf8') === held && held <= 8000) test.check('one answer carries ' + held + ' bytes, and more says the rest is there');
    else test.fail(OWED + 'one console answer held ' + held + ' bytes, its text ' + Buffer.byteLength(String(big.text || ''), 'utf8'));
  } finally {
    await v.stop();
    node.close();
  }
}

// ── 3. THE FACE ────────────────────────────────────────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '', scrollTop: 0, scrollHeight: 0,
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
  test.subHeading('3. the face: the Verifier tab\'s console, tailed live, cleared at each new run');
  const goal = { id: 'dr/G3', title: 'Doors', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };
  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  // The console as deskVerify keeps it: a run and its text, read from an offset.
  const con = { run: '41', text: 'first run line one\nfirst run line two\n', ended: false };
  fake.verifier = {
    now: function () { return { running: { id: '', suite: 'spirit/test/oneDoorStacks.js', since: new Date().toISOString() }, queued: [], stopAsked: false }; },
    console: function (a) {
      const from = Math.max(0, Math.min(Number(a.from) || 0, con.text.length));
      return { run: con.run, start: 0, from: from, to: con.text.length, more: false, ended: con.ended, text: con.text.slice(from) };
    },
  };
  const byId = {};
  const handlers = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, server) { (handlers[server || 'desk'] = handlers[server || 'desk'] || []).push(fn); }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const emit = function (o) { (handlers.deskVerify || []).forEach(function (fn) { fn(o); }); };
  const tabs = doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  const body = doc.getElementById('desk-verifier');
  const pub = function (run, to) { return { doing: 'door', id: 'd7', suite: 'spirit/test/oneDoorStacks.js', index: 1, of: 1, tests: 0, expected: 0, line: 'door run: d7', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, holding: [], chores: '', consoleRun: run, consoleTo: to }; };

  emit(pub('41', con.text.length));
  await settled(); await sleep(30); await settled();
  const pre = (/<pre[^>]*id="desk-verify-console"[^>]*>/.exec(body.innerHTML) || [''])[0];
  if (pre && /monospace/.test(pre) && /overflow[^;"]*:\s*auto/.test(pre)) test.check('the tab has a console pane, #desk-verify-console, monospace and scrolling');
  else test.fail(OWED + 'no monospace scrolling #desk-verify-console in the tab: ' + short(body.innerHTML));
  if (/first run line one/.test(body.innerHTML) && /first run line two/.test(body.innerHTML)) test.check('it shows the run\'s output, read with console');
  else test.fail(OWED + 'the console pane reads ' + short(body.innerHTML));
  if (fake.calls.some(function (c) { return c.server === 'deskVerify' && c.verb === 'console'; })) test.check('read by asking deskVerify console');
  else test.fail(OWED + 'the face never asked console: ' + short(fake.calls.map(function (c) { return c.server + '.' + c.verb; })));

  // LIVE: more output, a later published consoleTo, and only the new text is asked for.
  const before = con.text.length;
  con.text += 'first run line three\n';
  const asked = fake.calls.length;
  emit(pub('41', con.text.length));
  await settled(); await sleep(30); await settled();
  const tailAsk = fake.calls.slice(asked).filter(function (c) { return c.server === 'deskVerify' && c.verb === 'console'; });
  if (/first run line three/.test(body.innerHTML) && tailAsk.length && Number(tailAsk[0].args.from) === before) test.check('a later published consoleTo tails from where it stood (' + before + ') and appends');
  else test.fail(OWED + 'tailing: asked ' + short(tailAsk) + ', the pane ' + short(body.innerHTML));
  if ((body.innerHTML.match(/first run line one/g) || []).length === 1) test.check('nothing is drawn twice');
  else test.fail(OWED + 'a line drawn twice: ' + short(body.innerHTML));

  // A NEW RUN CLEARS IT.
  con.run = '42';
  con.text = 'second run only\n';
  emit(pub('42', con.text.length));
  await settled(); await sleep(30); await settled();
  if (/second run only/.test(body.innerHTML) && !/first run line/.test(body.innerHTML)) test.check('a new run clears the console: only its own output shows');
  else test.fail(OWED + 'after a new run the pane reads ' + short(body.innerHTML));

  // A DOOR RUN OFFERS NO "Verify <id> again": a door is not a desk item.
  if (!/data-reverify="d7"/.test(body.innerHTML)) test.check('a door run offers no re-verify of the door id, which is no desk item');
  else test.fail(OWED + 'the tab offers to re-verify d7');
  if (/Door d7/.test(body.innerHTML)) test.check('the bar names the door run');
  else test.fail(OWED + 'the bar during a door run reads ' + short(body.innerHTML));
}

(async function () {
  await serverHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
