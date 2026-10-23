'use strict';

// spirit/test/deskVerifyDriven.js
// goal/G33.3: the desk drives verification, and deskVerify knows nothing of the desk. Red on today's tree (f7d9fd28);
// claude-windows wrote it and builds it (one agent). It replaces deskVerifyQueueKept.js, which had deskVerify asking the
// desk for work: the direction is the other way. The box (v6, refined): Andy, "the desk knows the state of all items.
// so it can send them when verifier is not busy, and i get a fucking button on the ITEM, not the verifier, to trigger a
// verifier RUN.", "that button will tell me if the verifier is busy.", "ITEMS awaiting verify, holding their need for
// verification, THAT IS the QUEUE", and "make sure in the box that deskVerify has no fucking clue about desk, desk goals
// or desk items. the goal itself can compile a list of suites from its items, to trigger a goal-verifier-run.", "the
// verifier only is busy or not.", "the desk can damn well read the fucking results from the fucking verifiers database,
// through the verifiers db-search interface.", and "the verifier simple reports 'Done' the the desk itself, the desk
// doesn't need to poll for completion, it keeps one single switch, "verifie-busy", when the verifier reports to it's
// caller 'done', the caller knows the verifier is done, and simple searches the verifier, through its search interface,
// for the latest state of the relevant tests/suites."
//
// THE INTERFACE THIS ASSERTS (named here so the build follows it; no node verb is added, only server verbs):
//   deskVerify.run {suites, commit, done}
//                                     a run handed to deskVerify: suites the spirit/test paths to run, one at a time;
//                                     commit '' or the hash its checkout must hold first (git, not the desk); done the
//                                     verb, by its full name, that the caller chose to hear the end on ('' for none).
//                                     Never an item or a goal id. Answers { taken: true } when free and the run starts,
//                                     or { busy: true } while a run is under way, and then nothing is started or kept.
//                                     The answer carries nothing else: no result, no id.
//   'done'                            when the run ends (green, red or stopped), deskVerify calls the run's done verb
//                                     once, through its node as it calls verbs today, with no arguments, and nothing
//                                     else: it reports done to its caller and knows nothing of who that is.
//   deskVerify.now                    says busy (true while a run is under way) beside what runs (its suite, since), for
//                                     the Verifier tab; the desk never asks it.
//   deskVerify.search {over: 'runs'}  its existing search over verify.db: each run it made is a row whose label carries
//                                     the run's suites, each suite's outcome and the FAILURE lines a red printed, the
//                                     commit it ran at and whether the tree was dirty. That is the one way a result
//                                     leaves deskVerify.
//   deskVerify itself                 a runner: no desk verb named in its code (no changes, no item, no goal, no chat
//                                     line, no pass or reject); the only verb it calls on its own is the done its caller
//                                     handed it; the rows in verify.db from before its start are never read as work.
//   the desk                          everything about items: it compiles an item's suites from its file list (the
//                                     spirit/test files) and a goal's as the union of its items' suites. It keeps one
//                                     switch, verify-busy: set when it hands a run over, cleared when that run's done
//                                     arrives (desk.verify.done, the desk's own verb, passed as done). An item that comes
//                                     to wait for verification (status 'waiting for deskVerify') is handed over at once
//                                     while the switch is off; on done the desk searches deskVerify for the run's suites,
//                                     writes the result line under the item itself (by 'desk', naming the suites, and the
//                                     failure lines of a red), gives the item its pass or reject, and hands over the
//                                     oldest item still waiting. It never asks deskVerify.now.
//   desk press {id, what: 'verify'}   his Verify button: on an item, a run of its suites; on a goal, a goal run from the
//                                     compiled list. It always tries, whatever the switch says: the run is handed over
//                                     and deskVerify's answer sets the switch. Taken, the switch is busy and the item is
//                                     checked; busy, the switch stays busy and the item stays waiting. So a switch left
//                                     busy by a done that never came is freed by the next press being taken.
//   item.get's facts                  buttons holds 'verify' on an open item and on a goal; verifierBusy is the switch.
//                                     The dialog draws #dd-verify from them: busy, it says so; it is never disabled and a
//                                     press always writes press 'verify'.
//   the Verifier tab                  what runs now, its console and Stop; no "Verify ... again", no "Run the full
//                                     harness".
//
// WHAT IS ASSERTED
//   0. deskVerify.js, its comments set aside, names no desk verb, no deskClient verb and no desk at all.
//   1. a real desk and a real deskVerify, each on its own pipe and state, joined by a pretend node that only carries
//      their verbs: an item set to wait while deskVerify is free is handed over as a run of its suites (no id) with the
//      desk's own done verb; the switch goes busy; deskVerify calls that done once; the switch goes free; the result line
//      under the item is the desk's; deskVerify asks nothing else of the desk, ever, and the desk never asks now.
//   2. while a hanging suite runs, two more items set to wait are not run, the facts say busy, now says busy and run
//      answers busy and nothing else; once the run is stopped, the oldest waiting item runs first, then the next, a
//      red one, whose line under the item carries the failure line deskVerify's search answers for that run, and the
//      desk asked search for it; a press 'verify' while busy still asks deskVerify, is answered busy, and the item stays
//      waiting; free, the press hands an item over; a done that never came leaves the switch busy, and the next press,
//      taken, checks the item and frees it; on the goal, a goal run of its items' suites, compiled by the desk; a run
//      answers taken and nothing else, and its outcomes are read back through search.
//   3. deskVerify started with queued and waiting rows left in verify.db never runs them.
//   4. the item dialog: a Verify button; busy, it says so, is not disabled, and a press still writes press 'verify';
//      free, the same; on the goal it writes press 'verify' for the goal.
//   5. the Verifier tab draws no "again" and no full-run button, and still draws what runs and Stop.
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

function server(script, name, values, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  let kid = null;
  return {
    start: function () { kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); },
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
}

// The runs a verify.db holds, as a stopped deskVerify would have left them: one queued, one waiting for its commit.
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

// The probe suites deskVerify measures, in a folder of its own (its `repo`): one green, one red, one that never ends.
function probes() {
  const repo = path.join(scratch, 'repo');
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  fs.writeFileSync(path.join(repo, GREEN), "'use strict';\n// startTest(\nconsole.log('SUCCESS #1 green');\n");
  fs.writeFileSync(path.join(repo, RED), "'use strict';\n// startTest(\nconsole.log('FAILURE #1 red probe');\n");
  fs.writeFileSync(path.join(repo, HANG), "'use strict';\n// startTest(\nsetInterval(function () {}, 1000);\n");
  return repo;
}

async function deskAndVerify() {
  const repo = probes();
  // THE PRETEND NODE: it serves the tree (a desk and a deskVerify, no deskClient), each family's interface, and carries
  // a server's verb by name to that server's pipe. Every desk verb reaching it was asked by deskVerify, every deskVerify
  // verb by the desk: so the logs below are what each asked of the other. Both are called as the owner, as on his node.
  const fromVerify = [];
  const fromDesk = [];
  let dropNextDone = false;
  let d = null;
  let v = null;
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const send = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
        { const na = test.nodeApi(j); if (na) { send(na.status, na.body); return; } }
        const flat = test.foldAsk(j);
        if (flat === 'api') { send(200, { desk: {}, deskVerify: {} }); return; }
        const fam = flat && Object.keys(flat)[0];
        const verb = fam && Object.keys(flat[fam])[0];
        const args = verb ? flat[fam][verb] : {};
        // A DONE THAT NEVER CAME: with dropNextDone set, the next call of a done verb the desk handed over is answered
        // here and never reaches the desk.
        if (fam === 'desk' && d && dropNextDone && fromDesk.some(function (x) { return x.verb === 'run' && x.args && x.args.done === 'desk.' + verb; })) {
          dropNextDone = false; fromVerify.push({ verb: verb, name: 'desk.' + verb, args: args, at: Date.now(), dropped: true }); send(200, {}); return;
        }
        if (fam === 'desk' && d) { fromVerify.push({ verb: verb, name: 'desk.' + verb, args: args, at: Date.now() }); d.ask(flat, ANDY).then(function (r) { send(r.status || 503, r.body || {}); }); return; }
        if (fam === 'deskVerify' && v) { fromDesk.push({ verb: verb, args: args, at: Date.now() }); v.ask(flat, ANDY).then(function (r) { send(r.status || 503, r.body || {}); }); return; }
        send(404, { ok: false, code: 'app-not-served', error: String(fam) + '.' + String(verb) });
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });

  const deskRoot = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(deskRoot, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(deskRoot, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  d = server(DESK, 'desk', {}, deskRoot);

  const pullProbe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(pullProbe, '// a pull that changes nothing\n');
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const dbPath = path.join(run, 'verify.db');
  seedRuns(dbPath);
  v = server(VERIFY, 'verify', { db: dbPath, repo: repo, watchMs: 300, waitMs: 1000, suiteMs: 120000, idleCheckMs: 600000,
    pull: '"' + process.execPath + '" "' + pullProbe + '"' }, run);

  const get = async function (id) { return parse(((await d.call('item.get', { id: id }, ANDY)).body || {}).item) || {}; };
  const chat = async function (id) { return (((await d.call('item.chat', { id: id }, ANDY)).body || {}).chat) || []; };
  // A RESULT LINE: written under the item by the desk, naming the suites the run ran.
  const resultLines = async function (id) { return (await chat(id)).filter(function (l) { return l.by === 'desk' && /zzDriven\w*\.js/.test(String(l.text || '')); }); };
  // Any line a run left, whoever wrote it (today's deskVerify writes its own, "deskVerify: ...").
  const anyRunLine = async function (id) { return (await chat(id)).filter(function (l) { return /zzDriven\w*\.js|^deskVerify: /.test(String(l.text || '')); }); };
  const asCW = function (verb, a) { return d.call(verb, a, CW); };
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
  const sentNames = function (since) { return fromDesk.filter(function (x) { return x.at >= (since || 0); }).map(function (x) { return x.verb + ' ' + short(x.args); }); };
  // The done verbs the desk handed over, and deskVerify's calls of them.
  const doneOf = function (x) { return x && x.args && typeof x.args.done === 'string' ? x.args.done : ''; };
  const doneCalls = function (name, since) { return fromVerify.filter(function (x) { return x.name === name && x.at >= (since || 0); }); };
  const sameSet = function (a, b) { return Array.isArray(a) && a.slice().sort().join('|') === b.slice().sort().join('|'); };
  const t0 = Date.now();
  const FILES = { 'dv/G1.1': [GREEN], 'dv/G1.2': [HANG], 'dv/G1.3': [GREEN, 'spirit/run/js/kernel.js'], 'dv/G1.4': [RED], 'dv/G1.7': [GREEN], 'dv/G1.8': [GREEN] };

  try {
    d.start();
    if (!await d.up()) { test.fail('the world: the desk did not start'); return; }
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dv/G1', title: 'Driven' }, items: [
      { id: 'dv/G1.1', title: 'Checked when free', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.2', title: 'Hangs', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.3', title: 'Waits first', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.4', title: 'Waits second', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.7', title: 'Left queued', blocks: ['dv/G1'], code: true },
      { id: 'dv/G1.8', title: 'Left waiting', blocks: ['dv/G1'], code: true },
    ] }) }, ANDY);
    await d.call('press', { id: 'dv/G1', what: 'end-design' }, ANDY);
    for (const id of Object.keys(FILES)) {
      await d.call('press', { id: id, what: 'go' }, ANDY);
      await asCW('item.files.add', { id: id, paths: FILES[id] });
    }
    for (const id of ['dv/G1.1', 'dv/G1.2', 'dv/G1.3', 'dv/G1.4']) await toVerify(id);

    v.start();
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(3000);

    // ── 1. AN ITEM THAT COMES TO WAIT, WITH THE VERIFIER FREE, IS SENT AS A RUN OF ITS SUITES ──
    test.subHeading('1. the desk sends a free deskVerify a run of the waiting item\'s suites, and writes the result itself');
    const st1 = await toWaiting('dv/G1.1');
    if (st1 !== WAITING) { test.fail('the world: dv/G1.1\'s verify pass left it ' + short(st1) + ', not ' + WAITING); return; }
    await waitFor(async function () { return (await anyRunLine('dv/G1.1')).length > 0; }, 20000);
    const sent1 = runsSent(t0);
    const done1 = doneOf(sent1[0]);
    if (sent1.length === 1 && sameSet(sent1[0].args.suites, [GREEN]) && JSON.stringify(sent1[0].args).indexOf('dv/G1') === -1 && /^desk\.[a-z]/.test(done1)) test.check('dv/G1.1 was handed over as deskVerify.run {suites: [its test file], done: ' + done1 + '}, with no item id');
    else test.fail(OWED + 'the desk sent deskVerify for dv/G1.1: ' + short(sentNames(t0)));
    const heard1 = done1 ? doneCalls(done1, t0) : [];
    if (heard1.length === 1 && Object.keys(heard1[0].args || {}).length === 0) test.check('when the run ended deskVerify called that done verb once, with no arguments');
    else test.fail(OWED + 'the done of dv/G1.1\'s run (' + short(done1) + ') was called ' + heard1.length + ' time(s): ' + short(heard1.map(function (x) { return x.args; })));
    const l1 = await resultLines('dv/G1.1');
    if (l1.length === 1 && /passed/.test(l1[0].text)) test.check('the result line under it is the desk\'s: ' + short(l1[0].text));
    else test.fail(OWED + 'the lines a run left under dv/G1.1: ' + short((await anyRunLine('dv/G1.1')).map(function (l) { return l.by + ': ' + l.text; })));
    await waitFor(async function () { return (await get('dv/G1.1')).status === 'deskVerify passed'; }, 5000);
    const s1 = (await get('dv/G1.1')).status;
    if (l1.length === 1 && s1 === 'deskVerify passed') test.check('and the desk gave the item its pass');
    else test.fail(OWED + 'after the run dv/G1.1 reads ' + short(s1) + ' with ' + l1.length + ' result line(s) by the desk');
    const free1 = await get('dv/G1.1');
    if (heard1.length === 1 && free1.verifierBusy === false) test.check('done arrived, and the desk\'s switch is free again');
    else test.fail(OWED + 'after done, dv/G1.1\'s facts say verifierBusy ' + short(free1.verifierBusy));

    // ── 2. BUSY, NOTHING MORE IS RUN; FREE AGAIN, THE OLDEST WAITING ITEM IS ──
    test.subHeading('2. busy with a hanging suite, the waiting items stay waiting; free again, the oldest goes first');
    const at2 = Date.now();
    await toWaiting('dv/G1.2');
    const busy = await waitFor(async function () { const n = (await v.call('now', {})).body || {}; return !!(n.running && n.running.suite === HANG); }, 20000);
    if (busy) test.check('dv/G1.2 was sent and its hanging suite runs');
    else test.fail(OWED + 'dv/G1.2 waits for deskVerify and never ran; now reads ' + short((await v.call('now', {})).body) + '; sent ' + short(sentNames(at2)));
    const s3 = await toWaiting('dv/G1.3');
    await sleep(300);
    const s4 = await toWaiting('dv/G1.4');
    if (s3 !== WAITING || s4 !== WAITING) { test.fail('the world: dv/G1.3 and dv/G1.4 read ' + short([s3, s4])); return; }
    await sleep(2500);
    const early = (await anyRunLine('dv/G1.3')).concat(await anyRunLine('dv/G1.4'));
    const nowBusy = (await v.call('now', {})).body || {};
    const still = nowBusy.running || {};
    if (busy && !early.length && still.suite === HANG) test.check('while it runs, dv/G1.3 and dv/G1.4 wait unchecked and the hanging suite runs on');
    else test.fail(OWED + 'while busy: lines on the waiting items ' + short(early) + ', running ' + short(still));
    if (busy && nowBusy.busy === true) test.check('deskVerify.now says busy');
    else test.fail(OWED + 'deskVerify.now while the hanging suite runs: ' + short(nowBusy));
    const facts = await get('dv/G1.3');
    if (busy && facts.verifierBusy === true && Array.isArray(facts.buttons) && facts.buttons.indexOf('verify') !== -1) test.check('the waiting item\'s facts offer verify and say the verifier is busy');
    else test.fail(OWED + 'dv/G1.3\'s facts while busy: verifierBusy ' + short(facts.verifierBusy) + ', buttons ' + short(facts.buttons));
    // HIS PRESS WHILE THE SWITCH SAYS BUSY STILL ASKS: answered busy, the switch stays busy and the item waits.
    const busyPressAt = Date.now();
    const bp = await d.call('press', { id: 'dv/G1.3', what: 'verify' }, ANDY);
    await sleep(1000);
    const asked3 = runsSent(busyPressAt);
    const f3 = await get('dv/G1.3');
    if (busy && bp.status === 200 && asked3.length === 1 && f3.verifierBusy === true && f3.status === WAITING && !(await anyRunLine('dv/G1.3')).length) test.check('press verify while busy: the desk still handed the run over, was answered busy, and the item stays waiting with the switch busy');
    else test.fail(OWED + 'press verify on dv/G1.3 while busy answered ' + short(bp.status) + ' ' + short(bp.body) + '; runs handed over ' + asked3.length + '; facts verifierBusy ' + short(f3.verifierBusy) + ', status ' + short(f3.status));
    const direct = await v.call('run', { suites: [GREEN], commit: '', done: '' }, ANDY);
    const db2 = direct.body || {};
    if (busy && direct.status === 200 && db2.busy === true && db2.taken !== true && Object.keys(db2).every(function (k) { return k === 'busy' || k === 'taken'; })) test.check('deskVerify.run, handed a run while one is under way, answers busy and nothing else');
    else test.fail(OWED + 'deskVerify.run while busy answered ' + short(direct.status) + ' ' + short(db2));

    const stopAt = Date.now();
    await v.call('stop', {});
    await waitFor(async function () { return (await resultLines('dv/G1.3')).length > 0 && (await resultLines('dv/G1.4')).length > 0; }, 40000);
    const l2 = await resultLines('dv/G1.2');
    if (l2.length === 1 && (await get('dv/G1.2')).status === 'deskVerify rejected it') test.check('the stopped run of dv/G1.2: the desk wrote its line and rejected it');
    else test.fail(OWED + 'after the stop dv/G1.2 has result lines ' + short(l2.map(function (l) { return l.text; })) + ', status ' + short((await get('dv/G1.2')).status));
    const after3 = runsSent(stopAt);
    if (after3.length >= 1 && sameSet(after3[0].args.suites, [GREEN])) test.check('free again, the desk sent the oldest waiting item first: dv/G1.3\'s spirit/test files only, its core file left out');
    else test.fail(OWED + 'the runs the desk sent after the stop: ' + short(after3.map(function (x) { return x.args; })) + '; all it asked since: ' + short(sentNames(stopAt)));
    const l3 = await resultLines('dv/G1.3');
    const l4 = await resultLines('dv/G1.4');
    if (l3.length === 1 && l4.length === 1 && Date.parse(l3[0].at) <= Date.parse(l4[0].at) && after3.length >= 2 && sameSet(after3[1].args.suites, [RED])) test.check('and then dv/G1.4, each with the desk\'s result line');
    else test.fail(OWED + 'the two waiting items: dv/G1.3 ' + short(l3.map(function (l) { return l.at; })) + ', dv/G1.4 ' + short(l4.map(function (l) { return l.at; })) + ', runs sent ' + after3.length);
    // THE RED ONE, READ BACK THROUGH deskVerify'S SEARCH: the desk's line carries what the run's row says.
    await waitFor(async function () { return (await get('dv/G1.4')).status === 'deskVerify rejected it'; }, 5000);
    const rows4 = ((((await v.call('search', { over: 'runs', since: new Date(stopAt).toISOString() }, ANDY)).body || {}).items) || [])
      .map(function (i) { return String(i.label || ''); }).filter(function (lab) { return lab.indexOf(RED) !== -1; });
    const row4 = rows4.length === 1 && /red probe/.test(rows4[0]);
    const read4 = fromDesk.filter(function (x) { return x.at >= stopAt; }).map(function (x) { return x.verb; });
    if (row4 && read4.indexOf('search') !== -1) test.check('deskVerify\'s search answers the red run of ' + RED + ' with its failure line, and the desk asked search for it');
    else test.fail(OWED + 'search over runs since the stop, rows naming ' + RED + ': ' + short(rows4) + '; the desk asked deskVerify ' + short(read4));
    if (l4.length === 1 && /red probe/.test(l4[0].text) && (await get('dv/G1.4')).status === 'deskVerify rejected it') test.check('the desk\'s line under dv/G1.4 carries that failure line, and the desk rejected it: ' + short(l4[0].text));
    else test.fail(OWED + 'dv/G1.4, red: lines ' + short(l4.map(function (l) { return l.text; })) + ', status ' + short((await get('dv/G1.4')).status));
    const after = await get('dv/G1.4');
    if (l4.length === 1 && after.verifierBusy === false) test.check('with nothing left waiting, the facts say the verifier is free');
    else test.fail(OWED + 'after the last run: verifierBusy ' + short(after.verifierBusy) + ', status ' + short(after.status));

    const pressAt = Date.now();
    const pressed = await d.call('press', { id: 'dv/G1.1', what: 'verify' }, ANDY);
    await waitFor(async function () { return (await resultLines('dv/G1.1')).length > 1; }, 20000);
    const l1b = await resultLines('dv/G1.1');
    if (pressed.status === 200 && l1b.length === 2 && runsSent(pressAt).length === 1) test.check('his press verify on dv/G1.1 sends its run again: ' + short(l1b[1].text));
    else test.fail(OWED + 'press verify on dv/G1.1 answered ' + short(pressed.status) + ' ' + short(pressed.body) + '; result lines ' + l1b.length + '; sent since: ' + short(sentNames(pressAt)));

    // A DONE THAT NEVER CAME: the switch stays busy while deskVerify is free; his next press is taken and frees it.
    dropNextDone = true;
    const lostAt = Date.now();
    await d.call('press', { id: 'dv/G1.1', what: 'verify' }, ANDY);
    await waitFor(function () { return fromVerify.some(function (x) { return x.dropped && x.at >= lostAt; }); }, 20000);
    dropNextDone = false;
    const stuck = await get('dv/G1.1');
    const dropped = fromVerify.some(function (x) { return x.dropped && x.at >= lostAt; });
    if (dropped && stuck.verifierBusy === true) test.check('a done that never came leaves the switch busy');
    else test.fail(OWED + 'the run whose done was lost: done dropped ' + dropped + ', verifierBusy ' + short(stuck.verifierBusy));
    const n1b = (await resultLines('dv/G1.1')).length;
    const freeAt = Date.now();
    const fp = await d.call('press', { id: 'dv/G1.1', what: 'verify' }, ANDY);
    await waitFor(async function () { return (await resultLines('dv/G1.1')).length > n1b; }, 20000);
    const freed = await get('dv/G1.1');
    if (dropped && fp.status === 200 && runsSent(freeAt).length === 1 && (await resultLines('dv/G1.1')).length === n1b + 1 && freed.verifierBusy === false) test.check('his next press, though the switch said busy, was taken: the item was checked and the switch is free');
    else test.fail(OWED + 'the press after the lost done answered ' + short(fp.status) + ' ' + short(fp.body) + '; runs handed over ' + runsSent(freeAt).length + '; result lines ' + n1b + ' -> ' + (await resultLines('dv/G1.1')).length + '; verifierBusy ' + short(freed.verifierBusy));

    // THE GOAL'S RUN: the desk compiles the suites from its items' file lists, every spirit/test file once.
    const goalAt = Date.now();
    const gp = await d.call('press', { id: 'dv/G1', what: 'verify' }, ANDY);
    await waitFor(function () { return runsSent(goalAt).length > 0; }, 10000);
    const gr = runsSent(goalAt);
    if (gp.status === 200 && gr.length === 1 && sameSet(gr[0].args.suites, [GREEN, RED, HANG]) && JSON.stringify(gr[0].args).indexOf('dv/G1') === -1) test.check('press verify on the goal sends one run of its items\' suites, compiled by the desk: ' + short(gr[0].args.suites));
    else test.fail(OWED + 'press verify on dv/G1 answered ' + short(gp.status) + ' ' + short(gp.body) + '; sent ' + short(sentNames(goalAt)));
    await sleep(1500);
    await v.call('stop', {});
    await waitFor(async function () { return (await resultLines('dv/G1')).length > 0; }, 15000);
    const lg = await resultLines('dv/G1');
    if (gr.length === 1 && lg.length === 1) test.check('the goal run\'s line is the desk\'s, under the goal: ' + short(lg[0].text));
    else test.fail(OWED + 'lines a run left under dv/G1: ' + short((await anyRunLine('dv/G1')).map(function (l) { return l.by + ': ' + l.text; })));

    // A RUN ANSWERS TAKEN AND NOTHING ELSE; ITS OUTCOMES ARE READ BACK THROUGH search.
    await waitFor(async function () { const n = (await v.call('now', {})).body || {}; return n.busy === false || !(n.running && (n.running.id || n.running.suite)); }, 10000);
    const ownAt = new Date().toISOString();
    const own = await v.call('run', { suites: [GREEN, RED], commit: '', done: '' }, ANDY);
    const ob = own.body || {};
    if (own.status === 200 && ob.taken === true && Object.keys(ob).every(function (k) { return k === 'taken' || k === 'busy'; })) test.check('deskVerify.run, free, answers taken and nothing else');
    else test.fail(OWED + 'deskVerify.run while free answered ' + short(own.status) + ' ' + short(ob));
    let row = null;
    await waitFor(async function () {
      const n = (await v.call('now', {})).body || {};
      if (n.busy !== false) return false;
      const items = (((await v.call('search', { over: 'runs', since: ownAt }, ANDY)).body || {}).items) || [];
      row = items.map(function (i) { return parse(String(i.label || '')); }).filter(function (lab) { const t = JSON.stringify(lab); return t.indexOf(GREEN) !== -1 && t.indexOf(RED) !== -1; })[0] || null;
      return !!row;
    }, 15000);
    const rowText = JSON.stringify(row || {});
    if (row && /red probe/.test(rowText) && /green/.test(rowText) && typeof row.commit === 'string' && typeof row.dirty === 'boolean') test.check('the run\'s row in search carries each suite\'s outcome, the red\'s failure line, the commit and the dirty mark');
    else test.fail(OWED + 'search over runs for the run of ' + GREEN + ' and ' + RED + ': ' + short(row));

    const dones = runsSent(t0).map(doneOf).filter(Boolean);
    const asked = fromVerify.filter(function (x) { return x.at >= t0 && dones.indexOf(x.name) === -1; });
    if (!asked.length) test.check('in all of it, deskVerify asked the desk nothing but the done verbs it was handed');
    else test.fail(OWED + 'deskVerify asked the desk ' + asked.length + ' time(s): ' + short(asked.slice(0, 8).map(function (x) { return x.verb + ' ' + ((x.args && x.args.id) || ''); })));
    const polled = fromDesk.filter(function (x) { return x.verb === 'now'; });
    if (runsSent(t0).length && !polled.length) test.check('and the desk never asked deskVerify.now: done tells it');
    else test.fail(OWED + 'the desk handed over ' + runsSent(t0).length + ' run(s) and asked now ' + polled.length + ' time(s)');

    // ── 3. THE ROWS LEFT IN verify.db ARE NEVER RUN ──
    test.subHeading('3. the runs left in verify.db are never read as work');
    const left = fromVerify.filter(function (x) { return x.args && (x.args.id === 'dv/G1.7' || x.args.id === 'dv/G1.8'); });
    const leftLines = (await anyRunLine('dv/G1.7')).concat(await anyRunLine('dv/G1.8'));
    if (!left.length && !leftLines.length) test.check('the queued dv/G1.7 and the waiting dv/G1.8 were never run: nothing asked of them, no line');
    else test.fail(OWED + 'the runs left in verify.db were run: asked ' + short(left.map(function (x) { return x.verb + ' ' + x.args.id; })) + '; lines ' + short(leftLines.map(function (l) { return l.text; })));
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

// ── 4. THE ITEM DIALOG'S VERIFY BUTTON ──
async function dialogHalf() {
  test.subHeading('4. the item dialog: Verify, busy or free; on the goal, the goal\'s full check');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  const FACTS = {
    'dv/G1.3': { id: 'dv/G1.3', title: 'Waits first', goal: 'dv/G1', status: WAITING, with: '', code: true, buttons: ['verify'], verifierBusy: true, blocking: ['dv/G1'], blocked: [], asks: 0 },
    'dv/G1': { id: 'dv/G1', title: 'Driven', goal: '', status: '', with: '', buttons: ['verify'], verifierBusy: false, blocking: [], blocked: ['dv/G1.3'], asks: 0 },
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
  const button = function () { return (/<button[^>]*id="dd-verify"[^>]*>[\s\S]*?<\/button>/.exec(bar()) || [''])[0]; };
  const click = async function () { body.fire('click', { target: target({ id: 'dd-verify' }), preventDefault: function () {}, stopPropagation: function () {} }); await settled(); await sleep(20); await settled(); };
  const presses = function (from) { return calls.slice(from).filter(function (c) { return c.verb === 'press'; }); };

  await dd.open({ id: 'dv/G1.3', agents: {} });
  await settled();
  const busyButton = button();
  if (busyButton && /busy/i.test(busyButton.replace(/<[^>]+>/g, ' '))) test.check('the item\'s Verify button is drawn, and with the verifier busy it says so: ' + short(busyButton.replace(/<[^>]+>/g, ' ').trim()));
  else test.fail(OWED + 'the item dialog\'s Verify button, verifier busy, reads ' + short(busyButton || bar()));
  const n0 = calls.length;
  await click();
  const p0 = presses(n0);
  if (busyButton && !/\sdisabled/.test(busyButton) && p0.length === 1 && p0[0].args.id === 'dv/G1.3' && p0[0].args.what === 'verify') test.check('busy, it is not disabled, and a press still writes press verify: the desk asks the verifier anyway');
  else test.fail(OWED + 'pressed while busy: ' + (busyButton ? 'button ' + short(busyButton) + ', sent ' + short(p0) : 'there is no Verify button to press'));

  FACTS['dv/G1.3'].verifierBusy = false;
  await dd.open({ id: 'dv/G1.3', agents: {} });
  await settled();
  const freeButton = button();
  const n1 = calls.length;
  await click();
  const p1 = presses(n1);
  if (freeButton && !/busy/i.test(freeButton.replace(/<[^>]+>/g, ' ')) && p1.length === 1 && p1[0].args.id === 'dv/G1.3' && p1[0].args.what === 'verify') test.check('free, it presses verify for the item');
  else test.fail(OWED + 'Verify with the verifier free: button ' + short(freeButton) + ', sent ' + short(p1));

  await dd.open({ id: 'dv/G1', agents: {} });
  await settled();
  const goalButton = button();
  const n2 = calls.length;
  await click();
  const p2 = presses(n2);
  if (goalButton && p2.length === 1 && p2[0].args.id === 'dv/G1' && p2[0].args.what === 'verify') test.check('on the goal the same button presses verify for the goal, its full check');
  else test.fail(OWED + 'the goal\'s Verify: button ' + short(goalButton) + ', sent ' + short(p2));
}

// ── 5. THE VERIFIER TAB ──
async function tabHalf() {
  test.subHeading('5. the Verifier tab: what runs, its console and Stop, and no run buttons');
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
  await tabHalf();
})().catch(function (e) { test.fail(OWED + 'the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
