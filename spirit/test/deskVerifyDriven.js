'use strict';

// spirit/test/deskVerifyDriven.js
// goal/G33.3: the desk drives verification, and deskVerify knows nothing of the desk. Red first on 2272b8be, reworked
// to the box's v21; claude-windows wrote it and builds it (one agent). The box ("The desk drives verification"), Andy's
// words in it among others: "the desk knows the state of all items. so it can send them when verifier is not busy, and
// i get a fucking button on the ITEM, not the verifier, to trigger a verifier RUN.", "make sure in the box that
// deskVerify has no fucking clue about desk, desk goals or desk items. the goal itself can compile a list of suites
// from its items, to trigger a goal-verifier-run.", "the verifier only is busy or not.", and "the desk can damn well
// read the fucking results from the fucking verifiers database, through the verifiers db-search interface."
//
// THE INTERFACE THIS ASSERTS (no node verb is added; deskVerify.run and the desk's press 'verify' are the new verbs):
//   deskVerify.run {suites, commit}   a run handed to deskVerify: suites the spirit/test paths to run, one at a time;
//                                     commit '' or the hash its checkout must hold first. Never an item or a goal id.
//                                     Answers { taken: true } or { busy: true }, and nothing else; it reports to no one.
//   deskVerify.now                    busy beside what runs (its suite, since), for the Verifier tab; the desk never
//                                     asks it.
//   deskVerify.search {over: 'runs', suite}
//                                     each run a row: the run's suites, each suite's outcome and FAILURE lines, the
//                                     commit and the dirty mark. The one way a result leaves deskVerify.
//   deskVerify itself                 a runner: no desk verb, no desk cursor, no agent, no list of work; old rows in
//                                     verify.db are never read as work.
//   the desk                          compiles the suites (an item's from its file list, a goal's from its items'), and
//                                     hands runs only to its own node's verifier. At each event (a claim, a Verify press,
//                                     a run taken, a Done press) it reads the latest state of the waiting items' suites
//                                     through the search and keeps it in each item's facts: verified 'green', 'red'
//                                     (verifyFailures the failure lines) or 'none' (no run yet); only the current goal's
//                                     items are read. ONLY HIS VERIFY PRESS STARTS A RUN (Andy: "verifies on the
//                                     desk-node get only triggered by MY verify button. NOTHING ELSE.", and "the desk
//                                     has no business queuing verifications"): a claim, an item coming to wait and a
//                                     Done read the states and send no run.
//                                     The switch, verify-busy, only shows the verifier's last answer (verifyAnswer 'taken' or
//                                     'busy', verifierBusy true for either) on the Verify button, and the
//                                     answer travels to every client: the publish carries it (verifier) and every row
//                                     whose facts it changed. Done is offered as soon as an agent claims done (or its
//                                     verifier passes a code item) and is never refused for verification; when it goes
//                                     through on an item not verified green, the desk writes one line under the item
//                                     saying it went over a red run (naming the failures) or a missing run.
//   desk press {id, what: 'verify'}   his Verify button, right after Done in the item's buttons, the one thing that
//                                     starts a run: on an item, a run of its suites; on a goal, a run of its items'
//                                     suites. It always tries, busy or not.
//   the page                          the Done button of an item not verified green carries a warning mark; the first
//                                     press arms it and says why (the failure lines, or no run yet), the second sends
//                                     Done; verified green, one press. In the List row and the dialog alike, from the
//                                     item's facts. The desk keeps no arming.
//   the Verifier tab                  what runs now, its console and Stop; no run buttons.
//   gone                              the desk verbs verify.pass, verify.reject, verify.regress and verify.again (Andy's
//                                     yes, "box this and continue"), with their interface entries and verb file.
//
// WHAT IS ASSERTED
//   0. deskVerify.js, its comments set aside, names no desk, no desk verb, no deskClient; no desk cursor, no agent and
//      no list of work.
//   1. a real desk and a real deskVerify on their own pipes, joined by a pretend node: an item coming to wait starts
//      no run; his Verify hands it over as a run of its suites (no id); taken shows on the switch, and the publish
//      carries the answer and the other rows it changed; Verify sits right after Done; his Done reads the search,
//      green, goes through with no line and starts no run.
//   2. two items coming to wait, a claim-done and a build claim read the states and start no run; his Verify, busy or
//      not, asks deskVerify; the facts say busy, now says busy, run answers busy alone; once stopped, a Done starts no
//      run, and an item answered busy runs on his next Verify; a Done over a missing run, over a stopped run and over a
//      red run each goes through and leaves its one line (the red naming its failure); the facts say green, red with
//      the failures, or none; a claim in a goal that is not current starts no run and is not read; the goal's Verify
//      hands over its items' suites; a run answers taken alone and its outcome is read through search; deskVerify asks
//      the desk nothing and the desk never asks now; the four verify verbs are gone; desk.js keeps no waiting order.
//   3. deskVerify started with rows of the old shape left in verify.db (states 'queued' and 'waiting') never runs them.
//   4. the item dialog: Verify right after Done; busy, it says so, is never disabled and a press still writes press
//      'verify'; on the goal, press 'verify' for the goal; a Done not verified green carries the warning mark, its first
//      press arms it and says why and sends nothing, its second sends Done; verified green, one press.
//   5. the List row: the same Done arming and Verify right after it.
//   6. the Verifier tab draws no "again" and no full-run button, and still draws what runs and Stop.
// rule/11: through testSupport only; a pretend node; deskVerify measures a scratch folder of probe suites (its `repo`),
// never a checkout; the pull is a probe; it stops only the processes it started.

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
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyDrivenTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyDrivenTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };
const WAITING = 'waiting for deskVerify';
const GREEN = 'spirit/test/zzDrivenGreen.js';
const GREEN2 = 'spirit/test/zzDrivenGreen2.js';
const GREEN3 = 'spirit/test/zzDrivenGreen3.js';
const GREEN4 = 'spirit/test/zzDrivenGreen4.js';
const RED = 'spirit/test/zzDrivenRed.js';
const HANG = 'spirit/test/zzDrivenHang.js';
// A commit no tree holds, for the run left waiting in verify.db.
const NOWHERE = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(250); } return fn(); }

test.startTest('goal/G33.3: the desk drives verification: it compiles the suites and sends deskVerify one run at a time, deskVerify knows nothing of the desk, the item\'s Verify button, the Verifier tab without its run buttons');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifydriven-'));

function server(script, name, values, cwd, env) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  let kid = null;
  return {
    start: function () { kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, env: env ? Object.assign({}, process.env, env) : process.env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); },
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    // The whole ask, as the node's flat door hands it on: {app: {verb: args}}, answered {status, body}.
    ask: function (o, caller) { return client.ask(o, caller).then(function (r) { return r || { status: 0, body: {} }; }, function (e) { return { status: 503, body: { ok: false, code: 'not-answering', error: String((e && e.message) || e) } }; }); },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// ── 0. deskVerify.js NAMES NO DESK ──
// Its code with the comments set aside (a line comment, a block comment): no string naming the desk or a deskClient, or
// a desk verb, and no helper that reaches the desk.
function staticHalf() {
  test.subHeading('0. deskVerify.js names no desk, no desk verb and no deskClient');
  // Line by line, so a line number stays the file's: a block comment closed on its own line, then a line comment (a //
  // not after a colon, so a URL in a string stays code).
  const src = fs.readFileSync(VERIFY, 'utf8').split(/\r?\n/).map(function (l) {
    const code = l.replace(/\/\*.*?\*\//g, '');
    const m = /(^|[^:])\/\/.*$/.exec(code);
    return m ? code.slice(0, m.index + m[1].length) : code;
  });
  const PATTERNS = [
    [/['"`]desk(Client)?['"`]/, 'the name desk or deskClient as a string'],
    [/['"`]desk(Client)?\.[A-Za-z]/, 'a desk.* or deskClient.* verb'],
    [/\b(desk|deskVia)\s*\(/, 'a helper that asks the desk'],
    [/['"`](items\.search|items\.find|item\.(get|files|chat|box|checks)|chat\.add|verify\.(pass|reject|regress|again)|changes|profile\.get|goal\.[a-z]+)['"`]/, 'a desk verb by name'],
  ];
  const found = [];
  src.forEach(function (l, i) { PATTERNS.forEach(function (p) { if (p[0].test(l)) found.push((i + 1) + ': ' + p[1] + ': ' + l.trim().slice(0, 120)); }); });
  if (!found.length) test.check('deskVerify.js has no clue about the desk: no desk verb, no deskClient, no desk name in its code');
  else test.fail(OWED + 'deskVerify.js still reaches the desk in ' + found.length + ' line(s), the first: ' + short(found.slice(0, 4)));
  // ITS IDLE HOUR IS ITS OWN CLOCK (Andy: "it knows it's idle for an hour because no verify-requests arrived for an
  // hour"): no cursor over the desk's writes, no newest desk write, no items its agent holds, no agent; and it keeps no
  // list of work (the box: "It keeps no list of work").
  const IDLE = /\b(newestWrite|idleCursor|heldBy|lastWriteAt|agentOf|watchQueue|drainQueue|queuedAt)\b|profile\.get/;
  const idleFound = [];
  src.forEach(function (l, i) { if (IDLE.test(l)) idleFound.push((i + 1) + ': ' + l.trim().slice(0, 120)); });
  if (!idleFound.length) test.check('its idle hour reads no desk cursor and knows no agent, and it keeps no list of work');
  else test.fail(OWED + 'deskVerify.js still judges idleness from the desk, knows its agent or keeps a list of work, in ' + idleFound.length + ' line(s), the first: ' + short(idleFound.slice(0, 4)));
  // THE DESK QUEUES NO VERIFICATION either (Andy: "the desk has no business queuing verifications"): no waiting order,
  // no pick of an oldest item.
  const deskSrc = fs.readFileSync(DESK, 'utf8');
  const queued = deskSrc.split(/\r?\n/).map(function (l, i) { return (i + 1) + ': ' + l.trim(); })
    .filter(function (l) { return /waitingAt|oldest (item|waiting)|oldest with no run/i.test(l); });
  if (!queued.length) test.check('desk.js keeps no waiting order and picks no oldest item to hand over');
  else test.fail(OWED + 'desk.js still orders waiting items: ' + short(queued.slice(0, 3)));
}

// The rows of the old shape a verify.db holds, as an old deskVerify left them: states 'queued' and 'waiting'.
function seedRuns(dbPath) {
  const d = new DatabaseSync(dbPath);
  d.exec('CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,' +
    ' state TEXT NOT NULL, outcome TEXT NOT NULL, queuedAt TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT NOT NULL,' +
    ' "commit" TEXT NOT NULL DEFAULT \'\');');
  const at = new Date(Date.now() - 60000).toISOString();
  const ins = d.prepare('INSERT INTO runs (kind, id, state, outcome, queuedAt, startedAt, endedAt, "commit") VALUES (?, ?, ?, \'\', ?, ?, \'\', ?)');
  ins.run('item', 'dv/G1.7', 'queued', at, '', '');
  ins.run('item', 'dv/G1.8', 'waiting', at, at, NOWHERE);
  d.close();
}

// The probe suites deskVerify measures, in a folder of its own (its `repo`): four green, one red, one that never ends.
function probes() {
  const repo = path.join(scratch, 'repo');
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  fs.writeFileSync(path.join(repo, GREEN), "'use strict';\n// startTest(\nconsole.log('SUCCESS #1 green');\n");
  fs.writeFileSync(path.join(repo, GREEN2), "'use strict';\n// startTest(\nconsole.log('SUCCESS #1 green too');\n");
  fs.writeFileSync(path.join(repo, GREEN3), "'use strict';\n// startTest(\nconsole.log('SUCCESS #1 green three');\n");
  fs.writeFileSync(path.join(repo, GREEN4), "'use strict';\n// startTest(\nconsole.log('SUCCESS #1 green four');\n");
  fs.writeFileSync(path.join(repo, RED), "'use strict';\n// startTest(\nconsole.log('FAILURE #1 red probe');\n");
  fs.writeFileSync(path.join(repo, HANG), "'use strict';\n// startTest(\nsetInterval(function () {}, 1000);\n");
  return repo;
}
async function deskAndVerify() {
  const repo = probes();
  // THE PRETEND NODE: it serves the tree (a desk and a deskVerify, no deskClient), each family's interface, and carries
  // a server's verb by name to that server's pipe. Every desk verb reaching it was asked by deskVerify, every deskVerify
  // verb by the desk: so the logs below are what each asked of the other. Both are called as the owner, as on his node.
  // It also takes what the desk publishes (jobs.update), so what every client hears can be read.
  const fromVerify = [];
  const fromDesk = [];
  const published = [];
  let d = null;
  let v = null;
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const send = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        if (j && j.verb === 'jobs.update') { if (j.app) published.push({ at: Date.now(), app: j.app }); send(200, { ok: true }); return; }
        { const na = test.nodeApi(j); if (na) { send(na.status, na.body); return; } }
        const flat = test.foldAsk(j);
        if (flat === 'api') { send(200, { desk: {}, deskVerify: {} }); return; }
        const fam = flat && Object.keys(flat)[0];
        const verb = fam && Object.keys(flat[fam])[0];
        const args = verb ? flat[fam][verb] : {};
        if (fam === 'desk' && d) { fromVerify.push({ verb: verb, args: args, at: Date.now() }); d.ask(flat, ANDY).then(function (r) { send(r.status || 503, r.body || {}); }); return; }
        if (fam === 'deskVerify' && v) {
          const x = { verb: verb, args: args, at: Date.now() };
          fromDesk.push(x);
          v.ask(flat, ANDY).then(function (r) { x.answer = r.body; send(r.status || 503, r.body || {}); });
          return;
        }
        send(404, { ok: false, code: 'app-not-served', error: String(fam) + '.' + String(verb) });
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });

  const deskRoot = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(deskRoot, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(deskRoot, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  d = server(DESK, 'desk', {}, deskRoot, { SPIRIT_JOB_ID: 'driven-desk', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' });

  const pullProbe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(pullProbe, '// a pull that changes nothing\n');
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const dbPath = path.join(run, 'verify.db');
  seedRuns(dbPath);
  v = server(VERIFY, 'verify', { db: dbPath, repo: repo, suiteMs: 120000, idleCheckMs: 600000,
    pull: '"' + process.execPath + '" "' + pullProbe + '"' }, run);

  const get = async function (id) { return parse(((await d.call('item.get', { id: id }, ANDY)).body || {}).item) || {}; };
  const chat = async function (id) { return (((await d.call('item.chat', { id: id }, ANDY)).body || {}).chat) || []; };
  // THE LINE A DONE LEAVES when it went over a red or a missing run: by the desk, under the item.
  const overLines = async function (id) { return (await chat(id)).filter(function (l) { return l.by === 'desk' && /went over/i.test(String(l.text || '')); }); };
  const asCW = function (verb, a) { return d.call(verb, a, CW); };
  const done = function (id) { return d.call('press', { id: id, what: 'done' }, ANDY); };
  const took = function (r) { return r.status === 200 && r.body && r.body.ok !== false; };
  // Red and build done, so the verify phase is open: the item is one verify pass away from waiting.
  const toVerify = async function (id) {
    await asCW('phase.take', { id: id, phase: 'red' }); await asCW('phase.done', { id: id, phase: 'red' });
    await asCW('phase.take', { id: id, phase: 'build' }); await asCW('phase.done', { id: id, phase: 'build' });
  };
  // THE MOMENT AN ITEM COMES TO WAIT FOR VERIFICATION: its verify-phase pass (desk.js, phase.done).
  const toWaiting = async function (id) {
    await asCW('phase.take', { id: id, phase: 'verify' });
    await asCW('phase.done', { id: id, phase: 'verify', pass: true });
    return (await get(id)).status;
  };
  const runsSent = function (since) { return fromDesk.filter(function (x) { return x.verb === 'run' && x.at >= (since || 0); }); };
  const sentNames = function (since) { return fromDesk.filter(function (x) { return x.at >= (since || 0); }).map(function (x) { return x.verb + ' ' + short(x.args) + ' -> ' + short(x.answer); }); };
  const sameSet = function (a, b) { return Array.isArray(a) && a.slice().sort().join('|') === b.slice().sort().join('|'); };
  const runOnly = function (x) { return x && x.args && Object.keys(x.args).every(function (k) { return k === 'suites' || k === 'commit'; }) && JSON.stringify(x.args).indexOf('dv/G1') === -1; };
  const free = function () { return waitFor(async function () { return ((await v.call('now', {})).body || {}).busy === false; }, 20000); };
  const verdict = function (f) { return { verified: f.verified, verifyFailures: f.verifyFailures }; };
  const t0 = Date.now();
  const FILES = { 'dv/G1.1': [GREEN], 'dv/G1.2': [HANG], 'dv/G1.3': [GREEN3, 'spirit/run/js/kernel.js'], 'dv/G1.4': [RED], 'dv/G1.5': [GREEN4], 'dv/G1.6': [GREEN2], 'dv/G1.7': [GREEN], 'dv/G1.8': [GREEN] };

  try {
    d.start();
    if (!await d.up()) { test.fail('the world: the desk did not start'); return; }
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dv/G1', title: 'Driven' }, items: [
      { id: 'dv/G1.1', title: 'Checked when free', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.2', title: 'Hangs', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.3', title: 'Waits first', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.4', title: 'Waits second', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.5', title: 'Plain, done before any run', blocks: ['dv/G1'] },
      { id: 'dv/G1.6', title: 'Plain', blocks: ['dv/G1'] },
      { id: 'dv/G1.7', title: 'Left over', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.8', title: 'Left over too', blocks: ['dv/G1'], code: true },
    ] }) }, ANDY);
    await d.call('press', { id: 'dv/G1', what: 'end-design' }, ANDY);
    for (const id of Object.keys(FILES)) {
      await d.call('press', { id: id, what: 'go' }, ANDY);
      await asCW('item.files.add', { id: id, paths: FILES[id] });
    }
    for (const id of ['dv/G1.1', 'dv/G1.2', 'dv/G1.3', 'dv/G1.4']) await toVerify(id);
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dv/G2', title: 'Not current' }, items: [{ id: 'dv/G2.1', title: 'Elsewhere', blocks: ['dv/G2'] }] }) }, ANDY);
    await d.call('press', { id: 'dv/G2', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'dv/G2.1', what: 'go' }, ANDY);
    await asCW('item.files.add', { id: 'dv/G2.1', paths: [GREEN] });
    await d.call('press', { id: 'dv/G1', what: 'make-current' }, ANDY);

    v.start();
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(2000);

    // ── 1. AN ITEM THAT COMES TO WAIT IS NOT HANDED OVER; HIS VERIFY IS; THE SWITCH SHOWS TAKEN, EVERYWHERE ──
    test.subHeading('1. coming to wait starts no run; his Verify does; the switch shows taken to every client; Verify sits right after Done');
    const verify = function (id) { return d.call('press', { id: id, what: 'verify' }, ANDY); };
    const w1 = Date.now();
    await toWaiting('dv/G1.1');
    await sleep(500);
    if (!runsSent(w1).length) test.check('dv/G1.1 coming to wait started no run');
    else test.fail(OWED + 'dv/G1.1 coming to wait sent ' + short(sentNames(w1)));
    const pubAt = Date.now();
    const vp1 = await verify('dv/G1.1');
    const sent1 = runsSent(pubAt);
    if (took(vp1) && sent1.length === 1 && sameSet(sent1[0].args.suites, [GREEN]) && runOnly(sent1[0]) && sent1[0].answer && sent1[0].answer.taken === true) test.check('his Verify on dv/G1.1 handed it over as deskVerify.run {suites: [its test file], commit}, with no item id, and taken');
    else test.fail(OWED + 'his Verify on dv/G1.1 answered ' + short(vp1.body) + '; the desk asked ' + short(sentNames(pubAt)));
    const f1 = await get('dv/G1.1');
    if (f1.verifyAnswer === 'taken' && f1.verifierBusy === true) test.check('taken: the switch shows the verifier\'s answer, taken, on the Verify button (verifierBusy)');
    else test.fail(OWED + 'after a taken answer dv/G1.1 reads verifyAnswer ' + short(f1.verifyAnswer) + ', verifierBusy ' + short(f1.verifierBusy));
    await sleep(500);
    const heard = published.filter(function (p) { return p.at >= pubAt && p.app && p.app.verifier && p.app.verifier.answer === 'taken'; });
    const otherRow = heard.some(function (p) { return (p.app.rows || []).some(function (r) { return r.id !== 'dv/G1.1' && r.verifierBusy === true; }); });
    if (heard.length && otherRow) test.check('and every client hears it: the publish carries the answer and the other rows it changed');
    else test.fail(OWED + 'what the desk published after the answer: ' + short(published.filter(function (p) { return p.at >= pubAt; }).map(function (p) { return { verifier: p.app.verifier, rows: (p.app.rows || []).map(function (r) { return r.id + ':' + r.verifierBusy; }) }; })));
    const b1 = f1.buttons || [];
    if (b1.indexOf('done') !== -1 && b1.indexOf('verify') === b1.indexOf('done') + 1) test.check('Done is offered, and Verify sits right after it: ' + short(b1));
    else test.fail(OWED + 'dv/G1.1\'s buttons: ' + short(b1));
    await free();
    const searchedBefore = fromDesk.filter(function (x) { return x.verb === 'search'; }).length;
    const d1At = Date.now();
    const d1 = await done('dv/G1.1');
    const searched1 = fromDesk.filter(function (x) { return x.verb === 'search'; }).length - searchedBefore;
    if (took(d1) && searched1 > 0 && (await get('dv/G1.1')).status === 'done' && !(await overLines('dv/G1.1')).length && !runsSent(d1At).length) test.check('his Done read the search, green, went through with no line, and started no run');
    else test.fail(OWED + 'Done on dv/G1.1 answered ' + short(d1.status) + ' ' + short(d1.body) + ' after ' + searched1 + ' search(es); lines ' + short(await overLines('dv/G1.1')) + '; runs ' + short(sentNames(d1At)));

    // ── 2. ONLY HIS VERIFY STARTS A RUN; DONE NEVER REFUSED ──
    test.subHeading('2. a claim, an item coming to wait and a Done start no run; his Verify does, busy or not; Done is never refused');
    const at2 = Date.now();
    await toWaiting('dv/G1.2');
    await verify('dv/G1.2');
    const busy = await waitFor(async function () { const n = (await v.call('now', {})).body || {}; return !!(n.running && n.running.suite === HANG); }, 20000);
    const r2 = runsSent(at2);
    if (busy && r2.length === 1 && sameSet(r2[0].args.suites, [HANG])) test.check('dv/G1.2 ran on his Verify alone, and its hanging suite runs');
    else test.fail(OWED + 'dv/G1.2: now reads ' + short((await v.call('now', {})).body) + '; asked ' + short(sentNames(at2)));
    const at3 = Date.now();
    const s3 = await toWaiting('dv/G1.3');
    const s4 = await toWaiting('dv/G1.4');
    await asCW('press', { id: 'dv/G1.5', what: 'claim-done' });
    await asCW('claim', { id: 'dv/G1.7', phase: 'build', commit: 'abcdef1' });
    await sleep(800);
    if (busy && s3 === WAITING && s4 === WAITING && !runsSent(at3).length && fromDesk.some(function (x) { return x.verb === 'search' && x.at >= at3; })) test.check('two items coming to wait, a claim-done and a build claim: each read the states (search) and sent no run');
    else test.fail(OWED + 'while busy: statuses ' + short([s3, s4]) + '; runs sent ' + short(sentNames(at3)));
    const nowBusy = (await v.call('now', {})).body || {};
    if (busy && nowBusy.busy === true) test.check('deskVerify.now says busy');
    else test.fail(OWED + 'deskVerify.now while the hanging suite runs: ' + short(nowBusy));
    const busyPressAt = Date.now();
    const bp = await verify('dv/G1.3');
    await sleep(500);
    const asked3 = runsSent(busyPressAt);
    const facts = await get('dv/G1.3');
    if (busy && took(bp) && asked3.length === 1 && sameSet(asked3[0].args.suites, [GREEN3]) && asked3[0].answer && asked3[0].answer.busy === true && facts.status === WAITING) test.check('his Verify while busy still asked deskVerify, was answered busy, and the item stays waiting');
    else test.fail(OWED + 'press verify on dv/G1.3 while busy answered ' + short(bp.status) + ' ' + short(bp.body) + '; asked ' + short(sentNames(busyPressAt)));
    if (busy && facts.verifierBusy === true && facts.verifyAnswer === 'busy' && facts.verified === 'none') test.check('the waiting item\'s facts: the switch busy, and no run of it yet (verified none)');
    else test.fail(OWED + 'dv/G1.3\'s facts while busy: ' + short({ verifierBusy: facts.verifierBusy, verifyAnswer: facts.verifyAnswer, verified: facts.verified }));
    const direct = await v.call('run', { suites: [GREEN], commit: '' }, ANDY);
    const db2 = direct.body || {};
    if (busy && direct.status === 200 && db2.busy === true && db2.taken !== true && Object.keys(db2).every(function (k) { return k === 'busy' || k === 'taken'; })) test.check('deskVerify.run, handed a run while one is under way, answers busy and nothing else');
    else test.fail(OWED + 'deskVerify.run while busy answered ' + short(direct.status) + ' ' + short(db2));

    await v.call('stop', {});
    await free();
    // A DONE OVER A MISSING RUN: dv/G1.5's suite never ran. It goes through, says so, and starts no run.
    const at5 = Date.now();
    const d5 = await done('dv/G1.5');
    const l5 = await overLines('dv/G1.5');
    if (took(d5) && (await get('dv/G1.5')).status === 'done' && l5.length === 1 && /missing|no run/i.test(l5[0].text)) test.check('his Done over a missing run went through, and one line says so: ' + short(l5[0].text));
    else test.fail(OWED + 'Done on dv/G1.5 with no run answered ' + short(d5.status) + ' ' + short(d5.body) + '; lines ' + short(l5));
    await sleep(500);
    if (!runsSent(at5).length) test.check('and that Done started no run: dv/G1.3 and dv/G1.4 still wait for his Verify');
    else test.fail(OWED + 'the Done on dv/G1.5 sent ' + short(sentNames(at5)));
    const v3At = Date.now();
    await verify('dv/G1.3');
    const v3 = runsSent(v3At);
    if (v3.length === 1 && sameSet(v3[0].args.suites, [GREEN3]) && v3[0].answer && v3[0].answer.taken === true) test.check('dv/G1.3, answered busy before, runs on his next Verify: taken');
    else test.fail(OWED + 'his Verify on dv/G1.3 asked ' + short(sentNames(v3At)));
    await free();
    // A DONE OVER A STOPPED RUN: dv/G1.2's hanging suite was stopped, which is no green.
    const at2b = Date.now();
    const d2 = await done('dv/G1.2');
    const l2 = await overLines('dv/G1.2');
    if (took(d2) && (await get('dv/G1.2')).status === 'done' && l2.length === 1 && /red|stopped/i.test(l2[0].text)) test.check('his Done over the stopped run went through, and one line says it went over a red run: ' + short(l2[0].text));
    else test.fail(OWED + 'Done on the stopped dv/G1.2 answered ' + short(d2.status) + ' ' + short(d2.body) + '; lines ' + short(l2));
    const f3 = await get('dv/G1.3');
    if (f3.verified === 'green') test.check('the Done read dv/G1.3\'s run through the search: verified green');
    else test.fail(OWED + 'dv/G1.3 after its run: ' + short(verdict(f3)));
    if (!runsSent(at2b).length) test.check('and started no run');
    else test.fail(OWED + 'the Done on dv/G1.2 sent ' + short(sentNames(at2b)));
    const v4At = Date.now();
    await verify('dv/G1.4');
    const v4 = runsSent(v4At);
    if (v4.length === 1 && sameSet(v4[0].args.suites, [RED]) && v4[0].answer && v4[0].answer.taken === true) test.check('dv/G1.4 runs on his Verify: taken');
    else test.fail(OWED + 'his Verify on dv/G1.4 asked ' + short(sentNames(v4At)));
    await free();
    // A CLAIM ON dv/G1.6 READS dv/G1.4's red run, and starts nothing; his Verify runs dv/G1.6.
    const at6 = Date.now();
    await asCW('press', { id: 'dv/G1.6', what: 'claim-done' });
    await sleep(500);
    const f4 = await get('dv/G1.4');
    if (f4.verified === 'red' && Array.isArray(f4.verifyFailures) && f4.verifyFailures.some(function (x) { return /red probe/.test(x); })) test.check('a claim read dv/G1.4\'s run: verified red, the failure line in its facts');
    else test.fail(OWED + 'dv/G1.4 after its run: ' + short(verdict(f4)));
    if (!runsSent(at6).length) test.check('and the claim on dv/G1.6 started no run');
    else test.fail(OWED + 'the claim on dv/G1.6 sent ' + short(sentNames(at6)));
    await verify('dv/G1.6');
    await free();
    const d3 = await done('dv/G1.3');
    if (took(d3) && (await get('dv/G1.3')).status === 'done' && !(await overLines('dv/G1.3')).length) test.check('his Done on the green dv/G1.3 went through, no line');
    else test.fail(OWED + 'Done on dv/G1.3 answered ' + short(d3.status) + ' ' + short(d3.body));
    const d4 = await done('dv/G1.4');
    const l4 = await overLines('dv/G1.4');
    if (took(d4) && (await get('dv/G1.4')).status === 'done' && l4.length === 1 && /red probe/.test(l4[0].text)) test.check('his Done on the red dv/G1.4 went through, and its line names the failure: ' + short(l4[0].text));
    else test.fail(OWED + 'Done on dv/G1.4 answered ' + short(d4.status) + ' ' + short(d4.body) + '; lines ' + short(l4));
    const d6 = await done('dv/G1.6');
    if (took(d6) && (await get('dv/G1.6')).status === 'done' && !(await overLines('dv/G1.6')).length) test.check('his Done on the plain dv/G1.6, its run green, went through, no line');
    else test.fail(OWED + 'Done on dv/G1.6 answered ' + short(d6.status) + ' ' + short(d6.body) + '; lines ' + short(await overLines('dv/G1.6')));

    // A CLAIM IN A GOAL THAT IS NOT CURRENT: no run, its facts never rewritten (the work is the current goal's). dv/G2.1 lists GREEN, whose run is green, so a read of it would have said green.
    const otherAt = Date.now();
    await asCW('press', { id: 'dv/G2.1', what: 'claim-done' });
    await done('dv/G1.7');
    await sleep(500);
    const fo = await get('dv/G2.1');
    let states = [];
    for (let n = 0, i = 0; i < 100; i++) {
      const ch = (await d.call('changes', { n: n, line: 0 }, ANDY)).body || {};
      const recs = ch.records || [];
      states = states.concat(recs.filter(function (r) { return r.verb === 'verify.state' && (parse(r.body) || {}).id === 'dv/G2.1'; }));
      if (!ch.more || !recs.length || !(Number(ch.n) > n)) break;
      n = Number(ch.n);
    }
    if (!runsSent(otherAt).length && !states.length && fo.verified !== 'green') test.check('a claim in a goal that is not current: no run, its facts never rewritten (verified ' + short(fo.verified) + ')');
    else test.fail(OWED + 'the claim on dv/G2.1 (goal not current): asked ' + short(sentNames(otherAt)) + '; verify.state records ' + states.length + '; verified ' + short(fo.verified));

    // THE GOAL'S VERIFY: the desk compiles the suites from its items' file lists, every spirit/test file once.
    const goalAt = Date.now();
    const gp = await d.call('press', { id: 'dv/G1', what: 'verify' }, ANDY);
    await waitFor(function () { return runsSent(goalAt).length > 0; }, 10000);
    const gr = runsSent(goalAt);
    if (took(gp) && gr.length >= 1 && sameSet(gr[0].args.suites, [GREEN, GREEN2, GREEN3, GREEN4, RED, HANG]) && runOnly(gr[0])) test.check('his Verify on the goal hands over one run of its items\' suites, compiled by the desk: ' + short(gr[0].args.suites));
    else test.fail(OWED + 'press verify on dv/G1 answered ' + short(gp.status) + ' ' + short(gp.body) + '; asked ' + short(sentNames(goalAt)));
    await sleep(1500);
    await v.call('stop', {});
    await free();

    // A RUN ANSWERS TAKEN AND NOTHING ELSE; ITS OUTCOMES ARE READ BACK THROUGH search.
    const own = await v.call('run', { suites: [GREEN, RED], commit: '' }, ANDY);
    const ob = own.body || {};
    if (own.status === 200 && ob.taken === true && Object.keys(ob).every(function (k) { return k === 'taken' || k === 'busy'; })) test.check('deskVerify.run, free, answers taken and nothing else');
    else test.fail(OWED + 'deskVerify.run while free answered ' + short(own.status) + ' ' + short(ob));
    let row = null;
    await waitFor(async function () {
      const n = (await v.call('now', {})).body || {};
      if (n.busy !== false) return false;
      const items = (((await v.call('search', { over: 'runs', suite: RED }, ANDY)).body || {}).items) || [];
      row = items.map(function (i) { return parse(String(i.label || '')); }).filter(function (lab) { const t = JSON.stringify(lab); return t.indexOf(GREEN) !== -1 && t.indexOf(RED) !== -1 && t.indexOf(HANG) === -1; })[0] || null;
      return !!row;
    }, 15000);
    const rowText = JSON.stringify(row || {});
    if (row && /red probe/.test(rowText) && /green/.test(rowText) && typeof row.commit === 'string' && typeof row.dirty === 'boolean') test.check('the run\'s row in search carries each suite\'s outcome, the red\'s failure line, the commit and the dirty mark');
    else test.fail(OWED + 'search over runs for the run of ' + GREEN + ' and ' + RED + ': ' + short(row));

    const asked = fromVerify.filter(function (x) { return x.at >= t0; });
    if (!asked.length) test.check('in all of it, deskVerify asked the desk nothing');
    else test.fail(OWED + 'deskVerify asked the desk ' + asked.length + ' time(s): ' + short(asked.slice(0, 8).map(function (x) { return x.verb + ' ' + ((x.args && x.args.id) || ''); })));
    const polled = fromDesk.filter(function (x) { return x.verb === 'now'; });
    if (runsSent(t0).length && !polled.length) test.check('and the desk never asked deskVerify.now');
    else test.fail(OWED + 'the desk handed over ' + runsSent(t0).length + ' run(s) and asked now ' + polled.length + ' time(s)');

    // THE FOUR VERIFY VERBS ARE GONE (Andy's yes, "box this and continue").
    const GONE = ['verify.pass', 'verify.reject', 'verify.regress', 'verify.again'];
    const still = [];
    for (const verb of GONE) {
      const r = await d.call(verb, { id: 'dv/G1.4', why: 'x' }, ANDY);
      if (!(r.body && r.body.code === 'no-such-verb')) still.push(verb + ' ' + short(r.body));
    }
    const ifaceText = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'api.js'), 'utf8');
    const named = GONE.filter(function (v) { return ifaceText.indexOf("'" + v + "'") !== -1; });
    const files = GONE.filter(function (v) { return fs.existsSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', v + '.json')); });
    if (!still.length && !named.length && !files.length) test.check('the desk serves none of ' + GONE.join(', ') + ', its interface names none, and no verb file is left');
    else test.fail(OWED + 'the verify verbs remain: served ' + short(still) + '; in api.js ' + short(named) + '; verb files ' + short(files));

    // ── 3. THE ROWS LEFT IN verify.db ARE NEVER RUN ──
    test.subHeading('3. the runs left in verify.db are never read as work');
    const left = fromVerify.filter(function (x) { return x.args && (x.args.id === 'dv/G1.7' || x.args.id === 'dv/G1.8'); });
    let oldRows = [];
    try { const dbr = new DatabaseSync(dbPath, { readOnly: true }); oldRows = dbr.prepare('SELECT id, state FROM runs WHERE id IN (\'dv/G1.7\', \'dv/G1.8\')').all(); dbr.close(); } catch (e) { oldRows = []; }
    const ran = oldRows.filter(function (r) { return r.state === 'running' || r.state === 'ended'; });
    if (!left.length && !ran.length) test.check('the old rows of dv/G1.7 and dv/G1.8 were never run');
    else test.fail(OWED + 'the runs left in verify.db were run: asked ' + short(left.map(function (x) { return x.verb + ' ' + x.args.id; })) + '; rows ' + short(oldRows));
  } finally {
    await v.stop();
    await d.stop();
    node.close();
  }
}

function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null }; }

// ── 4. THE ITEM DIALOG: VERIFY RIGHT AFTER DONE, DONE ARMED WHEN NOT VERIFIED ──
async function dialogHalf() {
  test.subHeading('4. the item dialog: Verify right after Done, the switch on it; Done armed in the page when not verified green');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  const RED_LINE = 'FAILURE #1 red probe';
  const item = function (id, extra) { return Object.assign({ id: id, title: id, goal: 'dv/G1', status: WAITING, with: '', code: true, buttons: ['done', 'verify'], verifierBusy: false, verifyAnswer: '', verified: 'none', verifyFailures: [], blocking: ['dv/G1'], blocked: [], asks: 0, claims: 1 }, extra); };
  const FACTS = {
    'dv/G1.3': item('dv/G1.3', { verifierBusy: true, verifyAnswer: 'busy', verified: 'red', verifyFailures: [RED_LINE] }),
    'dv/G1.4': item('dv/G1.4', { verified: 'green' }),
    'dv/G1.5': item('dv/G1.5', { verified: 'none' }),
    'dv/G1': { id: 'dv/G1', title: 'Driven', goal: '', status: '', with: '', buttons: ['verify'], verifierBusy: false, verifyAnswer: '', verified: 'none', verifyFailures: [], blocking: [], blocked: ['dv/G1.3'], asks: 0 },
  };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/js/fieldRules.js') }));
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(FACTS[ask[v].id] || {}), version: 1, change: 1 } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], files: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const body = doc.getElementById('dd-body');
  const bar = function () { return doc.getElementById('dd-name-row').innerHTML; };
  const button = function (id) { return (new RegExp('<button[^>]*id="' + id + '"[^>]*>[\\s\\S]*?</button>').exec(bar()) || [''])[0]; };
  const text = function (h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
  const click = async function (id) { body.fire('click', { target: target({ id: id }), preventDefault: function () {}, stopPropagation: function () {} }); await settled(); await sleep(20); await settled(); };
  const presses = function (from) { return calls.slice(from).filter(function (c) { return c.verb === 'press'; }); };
  const open = async function (id) { await dd.open({ id: id, agents: {} }); await settled(); };
  const nextTo = function () { return /<button[^>]*id="dd-done"[^>]*>[^<]*<\/button>\s*<button[^>]*id="dd-verify"/.test(bar()); };

  await open('dv/G1.3');
  const busyButton = button('dd-verify');
  if (busyButton && nextTo()) test.check('Verify sits right after Done in the dialog');
  else test.fail(OWED + 'the dialog\'s button bar reads ' + short(text(bar())) + ' (' + short(bar().slice(0, 300)) + ')');
  if (busyButton && /busy/i.test(text(busyButton)) && !/\sdisabled/.test(busyButton)) test.check('with the switch busy the Verify button says so, and is not disabled: ' + short(text(busyButton)));
  else test.fail(OWED + 'the Verify button, verifier busy, reads ' + short(busyButton || bar()));
  let n0 = calls.length;
  await click('dd-verify');
  const p0 = presses(n0);
  if (p0.length === 1 && p0[0].args.id === 'dv/G1.3' && p0[0].args.what === 'verify') test.check('and pressed while busy it still writes press verify');
  else test.fail(OWED + 'Verify pressed while busy sent ' + short(p0));

  // A RED ITEM: the warning mark, then the first press arms and says why, the second sends Done.
  const redDone = button('dd-done');
  if (/⚠/.test(redDone)) test.check('Done on an item verified red carries the warning mark: ' + short(text(redDone)));
  else test.fail(OWED + 'Done on a red item reads ' + short(redDone || bar()));
  n0 = calls.length;
  await click('dd-done');
  const armedHtml = bar() + ' ' + doc.getElementById('dd-error').innerHTML + ' ' + doc.getElementById('dd-error').textContent;
  if (!presses(n0).length && /data-armed="1"/.test(button('dd-done')) && armedHtml.indexOf(RED_LINE) !== -1) test.check('its first press sends nothing, arms it and says why: the failure line');
  else test.fail(OWED + 'the first press on the red Done sent ' + short(presses(n0)) + '; the bar reads ' + short(text(armedHtml)));
  await click('dd-done');
  const p1 = presses(n0);
  if (p1.length === 1 && p1[0].args.what === 'done' && p1[0].args.id === 'dv/G1.3') test.check('its second press sends Done');
  else test.fail(OWED + 'the second press on the red Done sent ' + short(p1));

  // NO RUN YET: the same, the why saying so.
  await open('dv/G1.5');
  const noneDone = button('dd-done');
  n0 = calls.length;
  await click('dd-done');
  const noneHtml = bar() + ' ' + doc.getElementById('dd-error').innerHTML + ' ' + doc.getElementById('dd-error').textContent;
  if (/⚠/.test(noneDone) && !presses(n0).length && /no run/i.test(text(noneHtml))) test.check('Done on an item with no run yet: marked, and its first press says there is no run yet');
  else test.fail(OWED + 'the first press on Done with no run sent ' + short(presses(n0)) + '; the bar reads ' + short(text(noneHtml)));

  // VERIFIED GREEN: one press.
  await open('dv/G1.4');
  const greenDone = button('dd-done');
  n0 = calls.length;
  await click('dd-done');
  const p2 = presses(n0);
  if (!/⚠/.test(greenDone) && p2.length === 1 && p2[0].args.what === 'done') test.check('verified green: no mark, one press sends Done');
  else test.fail(OWED + 'Done on a green item reads ' + short(greenDone) + ' and one press sent ' + short(p2));

  // THE GOAL'S VERIFY.
  await open('dv/G1');
  const goalButton = button('dd-verify');
  n0 = calls.length;
  await click('dd-verify');
  const p3 = presses(n0);
  if (goalButton && p3.length === 1 && p3[0].args.id === 'dv/G1' && p3[0].args.what === 'verify') test.check('on the goal the same button presses verify for the goal, its full check');
  else test.fail(OWED + 'the goal\'s Verify: button ' + short(goalButton) + ', sent ' + short(p3));
}

// ── 5. THE LIST ROW: THE SAME DONE ARMING, VERIFY RIGHT AFTER IT ──
async function listHalf() {
  test.subHeading('5. the List row: Verify right after Done; Done armed in the page when not verified green');
  const RED_LINE = 'FAILURE #1 red probe';
  const fake = require('./deskFake.js').create([]);
  const row = function (id, extra) { return Object.assign({ id: id, title: id, goal: 'dl/G1', status: WAITING, with: '', buttons: ['done', 'verify'], blocking: ['dl/G1'], blocked: [], asks: 0, claims: 1, verifierBusy: false, verifyAnswer: '', verified: 'none', verifyFailures: [] }, extra); };
  fake.items = [
    { id: 'dl/G1', title: 'List', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: ['dl/G1.1', 'dl/G1.2'], live: [], working: [], waiting: 0 },
    row('dl/G1.1', { verified: 'red', verifyFailures: [RED_LINE] }),
    row('dl/G1.2', { verified: 'green' }),
  ];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, { spirit: {} });
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () { return function () {}; }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const all = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const rowHtml = function (id) { return (new RegExp('<tr data-row="' + id.replace(/[./]/g, '\\$&') + '"[\\s\\S]*?</tr>').exec(all()) || [''])[0]; };
  const doneOf = function (id) { return (new RegExp('<button[^>]*data-press="done"[^>]*>[\\s\\S]*?</button>').exec(rowHtml(id)) || [''])[0]; };
  const top = doc.getElementById('desk-top');
  const press = async function (id, what) {
    const el = { getAttribute: function (n) { return n === 'data-press' ? what : n === 'data-id' ? id : null; } };
    top.fire('click', { target: { id: '', getAttribute: function () { return null; }, closest: function (sel) { return /data-press/.test(sel) ? el : null; } }, stopPropagation: function () {}, preventDefault: function () {} });
    await settled(); await sleep(20); await settled();
  };
  const presses = function (from) { return fake.calls.slice(from).filter(function (c) { return c.server === 'desk' && c.verb === 'press'; }); };

  const r1 = rowHtml('dl/G1.1');
  if (/<button[^>]*data-press="done"[^>]*>[^<]*<\/button>\s*<button[^>]*data-press="verify"/.test(r1)) test.check('in the row, Verify sits right after Done');
  else test.fail(OWED + 'the row reads ' + short(r1));
  if (/⚠/.test(doneOf('dl/G1.1'))) test.check('a red row\'s Done carries the warning mark');
  else test.fail(OWED + 'the red row\'s Done reads ' + short(doneOf('dl/G1.1')));
  let n0 = fake.calls.length;
  await press('dl/G1.1', 'done');
  if (!presses(n0).length && /data-armed="1"/.test(doneOf('dl/G1.1')) && rowHtml('dl/G1.1').indexOf(RED_LINE) !== -1) test.check('its first press sends nothing, arms it and says why');
  else test.fail(OWED + 'the first press on the red row\'s Done sent ' + short(presses(n0)) + '; the row reads ' + short(rowHtml('dl/G1.1')));
  await press('dl/G1.1', 'done');
  const p1 = presses(n0);
  if (p1.length === 1 && p1[0].args.what === 'done' && p1[0].args.id === 'dl/G1.1') test.check('its second press sends Done');
  else test.fail(OWED + 'the second press sent ' + short(p1));
  n0 = fake.calls.length;
  await press('dl/G1.2', 'done');
  const p2 = presses(n0);
  if (!/⚠/.test(doneOf('dl/G1.2')) && p2.length === 1 && p2[0].args.id === 'dl/G1.2') test.check('a green row: no mark, one press sends Done');
  else test.fail(OWED + 'the green row\'s Done reads ' + short(doneOf('dl/G1.2')) + ' and one press sent ' + short(p2));
}

// ── 6. THE VERIFIER TAB ──
async function tabHalf() {
  test.subHeading('6. the Verifier tab: what runs, its console and Stop, and no run buttons');
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'dv/G1', title: 'Driven', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = {
    // An id beside the suite, as today's deskVerify still says one: the tab must draw no re-verify from it.
    now: function () { return { busy: true, running: { id: 'dv/G1.2', suite: HANG, since: new Date().toISOString() }, stopAsked: false }; },
    stop: function () { return { stopped: true }; },
    console: function () { return { run: '1', start: 0, from: 0, to: 0, more: false, ended: false, text: '' }; },
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
  const text = b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (b.indexOf('id="desk-verify-stop"') !== -1 && b.indexOf('zzDrivenHang.js') !== -1) test.check('the tab shows what runs now and draws Stop');
  else test.fail(OWED + '#desk-verifier lost what runs or its Stop: ' + short(text));
  if (b.indexOf('data-reverify') === -1 && !/again/i.test(text)) test.check('no "Verify ... again" button');
  else test.fail(OWED + 'the tab still draws a re-verify button: ' + short(text));
  if (b.indexOf('id="desk-verify-full"') === -1 && !/full harness/i.test(text)) test.check('no "Run the full harness" button');
  else test.fail(OWED + 'the tab still draws the full-run button: ' + short(text));
}

(async function () {
  staticHalf();
  await deskAndVerify();
  await dialogHalf();
  await listHalf();
  await tabHalf();
})().catch(function (e) { test.fail(OWED + 'the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
