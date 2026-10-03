'use strict';

// spirit/test/deskRules.js
// goal/G3.9: the six rules are served to every agent and enforced wherever the system can. RED on today's tree.
//
//   Andy, 2026-10-02 (goal/G3): the six rules, and "the system needs to enforce those rules wherever it can. my
//   grants for this project entitle you to make decision with in the scope of the desk project, with the
//   understanding that it will help enforce a truthful contract among all of us."
//   Andy, 2026-10-03 (goal/G3.9): "- the agents commit from their own clone under andy s name"; "the at done time,
//   or with the agents request to get the users done, the user is presented, via chat, with a list of files
//   modified, in a bullet-list."; "yes, the desk may refuse a claim-done, on an item without 'go' on record. A
//   close - with arm-button is available on the right edge of the button bar, before an item has received a 'go'
//   or a 'done', so the user can get it off the desk, since close is more of an 'visibility' issue than a process
//   issue"; "the actual contract is consumed between 'go' and 'done'"; "the close-with arm is only visible on the
//   item detail". His Go on this item is his press in Desk (record 4409).
//
// IN THE TREE TODAY: process/js/desk/AGENTS.md carries none of the six sentences; nothing on an agent's node
// blocks the other agent, and deskClient.next asks nothing about it; no process/js/desk/commitCheck.js exists and
// a commit names what it likes; the desk takes a claim-done on an item he never pressed Go on and marks it gone
// (desk.js, "a claim consumes the Go", goal/G2.13); an item's facts do not say whether HE pressed Go; Close is
// offered only once an item is done (desk.js buttons()); the List draws every button a row has but go-all and
// reopen (shell/desk/desk.js DESK_NOT_IN_ROW); the dialog's Close presses on the first click.
//
// THE CONTRACT (the box of goal/G3.9; the shapes below are claude-windows's where the box names none, for
// wsl-claude to build against). No core module is touched: not kernel.js, server.js, hub.js, jobs.js,
// appServer.js, appClient.js or apiDoor.js.
//
//   A. THE RULES ARE SERVED. The six sentences head process/js/desk/AGENTS.md verbatim, in his order, before the
//      file's first "## " section, so the desk server's AGENTS verb (appServer, slim/G1.8) hands them to every
//      agent at the start of a sitting.
//   B. THE DESK (process/js/desk/desk.js).
//      1. An item's facts (item.get, items.search) carry go: true once HE pressed go or go-all on it, false before;
//         an agent's claim-done never sets it.
//      2. A claim-done on an item without his Go on record is refused (ok: false) and changes nothing: the item
//         is not gone (go false, not running) and offers no Done. After his Go the same claim-done is taken and Done is
//         offered. (This replaces "a claim consumes the Go", goal/G2.13, for the claim before Go: his ruling above.)
//      3. An item not yet gone and not done offers close beside go; his close press on it is taken, and the item
//         is closed. A done item offers close as before; a closed item offers nothing but bring-back.
//   C. THE DESK PAGE.
//      1. The dialog (shell/deskDetails/deskDetails.js): on an item that is neither done nor closed, Close is the
//         LAST button of the bar (dd-name-row, the right edge) and is armed: the first click sends no press and marks the button
//         data-armed="1"; the second click sends press {id, what: 'close'}. On a done item Close presses on the
//         first click, as desk/G3.8 built it.
//      2. The List (shell/desk/desk.js): a row that is neither done nor closed draws no Close, whatever its buttons
//         say; a done row draws its Close as today.
//   D. RULE 1 AT deskClient (process/js/deskClient/deskClient.js). Each agent's node blocks the other agent's key
//      (contact.block on its own loopback door; contacts.js: a blocked key is not heard). While its agent waits on
//      next, deskClient asks its own node whether every OTHER AGENT it has seen write at the desk (a record whose
//      key is not its own, not by andy, not by desk) is blocked there; one that is not has next refused with code
//      unblocked and the agent's name and key in the answer, until it holds. Andy's own writes never cause it.
//      The pretend node of this suite answers contact.get {key} -> {person: {publicKey, blocked}} and contact.search
//      {q} -> {items: [{key, label}]} as hub.js does, from a book the suite controls.
//   E. RULES 3 AND 4 AT THE COMMIT (process/js/desk/commitCheck.js, new). Run by hand in an agent's OWN clone,
//      never in Andy's checkouts (his ruling above): `node commitCheck.js install <port of the agent's node>` in
//      the clone's root points git at the check. From then on:
//      1. A commit whose message names no item of the current goal with his Go on record (go: true) and not done
//         is refused: git commit exits non-zero and nothing is committed. A message naming an item without his Go,
//         or a done item, or no item at all, is refused alike.
//      2. A commit naming such an item is taken, and the agent's deskClient writes it under the item as a chat
//         line: the commit's hash (its first seven characters at least) and each file it changed, one `- path`
//         line each. The asks go through the agent's own deskClient (jobs.api {deskClient: ...}), so they are
//         counted.
//      3. With the agent's node unreachable the commit is refused, not waved through.
//      The claim-done line listing the item's files is the agents' by hand until this lands (Andy's ruling above);
//      this suite asserts nothing about it.
// NOT ASSERTED, the builder's: where install keeps the port and the hook files it writes; how deskClient learns the
// other agents' keys beyond their writes; the wording of the refusals; the exact text of the commit line beyond the
// hash and the bullets; the arm's label and colour.
// NOT PROVEN: this suite has run only against today's tree, where every owed check is red.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');
const apiDoor = require('../run/js/apiDoor.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G3.9: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const AGENTS_MD = path.join(RUN, 'process', 'js', 'desk', 'AGENTS.md');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const PAGE = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const POLL_MS = 400;

// The six, verbatim from the box of goal/G3 (his spelling stays).
const RULES = [
  'Agants will NOT speak to each other behind the users back.',
  'the agents APP is no longer permitted in this REPO',
  'You will not invent, design or implement code outside of the scope of the current goal.',
  'It is only through your use of the desk application that you will receive authorization to modify or create code',
  'You will be completely honest and forthright with the user, at all times.',
  'You will state facts, based on the reading of code, not comments, and not you own memory',
];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

// This agent (the owner of its node), the other agent, and Andy at his own desk.
const SELF_KEY = 'MCowBQYDK2VwAyEAdeskRulesTestSelfAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskRulesTestOtherAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskRulesTestDeskNodeAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'andy' };

test.startTest('goal/G3.9: the six rules are served to every agent and enforced wherever the system can');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-rules-'));
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
const desk = function (verb, args, caller) { return call('desk', verb, args, caller); };
const factsOf = async function (id) { const r = await desk('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return null; } };
const chatOf = async function (id) { const r = await desk('item.chat', { id: id }, ANDY); return (r.body && r.body.chat) || []; };

// THE PRETEND NODE this agent's deskClient runs on (as deskClientNext.js builds it), with two more doors:
// jobs.api, answered through the real apiDoor as the owner, so a hook in a clone reaches deskClient; and the
// contact book, from which contact.get and contact.search answer who is blocked.
const streams = [];
const asked = [];                    // every loopback ask: { verb, body }
const book = Object.create(null);    // key -> { label, blocked }
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': open\n\n');
    streams.push(res);
    return;
  }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    asked.push({ verb: b.verb, body: b });
    const json = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (b.verb === 'jobs.api') {
      return apiDoor.answer(client, b.ask, OWNER).then(function (a) { json((a && a.status) || 500, a ? a.body : null); }, function (e) { json(500, { ok: false, error: String(e && e.message) }); });
    }
    if (b.verb === 'contact.get') {
      const row = book[String(b.key || '')];
      if (!row) return json(404, { ok: false, error: 'not in the book' });
      return json(200, { ok: true, key: b.key, person: { publicKey: b.key, caption: row.label, blocked: !!row.blocked, held: false } });
    }
    if (b.verb === 'contact.search') {
      const items = Object.keys(book).map(function (k) { return { key: k, label: book[k].label + (book[k].blocked ? ' · blocked' : '') }; });
      return json(200, { ok: true, items: items, more: false, selfTail: 'self' });
    }
    if (b.verb !== 'peer.post') return json(400, { ok: false, code: 'no-such-verb', error: 'the pretend node has no ' + b.verb });
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const want = (ask && ask.body && ask.body.desk) || {};
    json(200, { ok: true, hash: hash });
    client.ask({ desk: want }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

function startClient(nodeUrl) {
  const kid = spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: 100 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }),
  });
  kids.push(kid);
  return kid;
}
async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
async function next() {
  const t0 = Date.now();
  const r = await call('deskClient', 'next', {}, OWNER);
  return { status: r.status, body: r.body || {}, lines: (r.body && Array.isArray(r.body.lines)) ? r.body.lines : null, ms: Date.now() - t0 };
}

// ── C. the page, on fake documents ──────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, checked: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
const common = function (verb) {
  return {
    escapeHtml: kernel.core.util.escapeHtml, verb: verb,
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  };
};
function dialog(facts) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const presses = [];
  dd.mount(fakeElement('dd'), common(function (name, body) {
    const ask = body && body.ask && body.ask.desk;
    const v = ask && Object.keys(ask)[0];
    if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(facts), version: 1, change: 3 } });
    if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'BOX', version: 1 } });
    if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [] } });
    if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
    if (v === 'press') { presses.push(ask.press); return Promise.resolve({ status: 200, body: { change: 9 } }); }
    return Promise.resolve({ status: 200, body: { change: 1 } });
  }));
  dd.open({ id: facts.id, agents: {} });
  const click = function (id) { doc.getElementById('dd-body').fire('click', { target: { id: id, getAttribute: function () { return null; }, closest: function () { return null; } }, preventDefault: function () {} }); };
  const html = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  // The button bar alone (dd-name-row, where ddButtonsHtml lands): the box's fold toggle comes after it in the dialog.
  const bar = function () { return doc.getElementById('dd-name-row').innerHTML; };
  return { presses: presses, click: click, html: html, bar: bar };
}
function list(rows) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(PAGE, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('c'), common(function (name, body) {
    const ask = body && body.ask && body.ask.desk;
    const v = ask && Object.keys(ask)[0];
    if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: rows.map(function (r) { return { key: r.id, label: JSON.stringify(r) }; }), more: false } });
    if (v === 'log.search' || v === 'chat.search') return Promise.resolve({ status: 200, body: { items: [], more: false } });
    if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
    return Promise.resolve({ status: 200, body: { change: 1 } });
  }));
  return { html: function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); } };
}
const row = function (o) { return Object.assign({ goal: 'r/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], alone: false, star: false, alert: false }, o); };
const hasClose = function (html, id) { return new RegExp('data-press="close" data-id="' + id.replace(/[/.]/g, '\\$&') + '"').test(html); };

// ── E. git, in a clone of the suite's own ──────────────────────────────────
// Asynchronous, awaited (wsl-claude's review of the first red): the pretend node lives in this process, and a hook's
// ask of it can only be answered while this process is free to answer.
function run(cmd, args, cwd) {
  return new Promise(function (resolve) {
    const kid = spawn(cmd, args, { cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    kid.stdout.on('data', function (c) { out += c; });
    kid.stderr.on('data', function (c) { err += c; });
    const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 60000);
    kid.on('error', function (e) { clearTimeout(timer); resolve({ status: -1, stdout: out, stderr: String(e && e.message) }); });
    kid.on('exit', function (code) { clearTimeout(timer); resolve({ status: code, stdout: out, stderr: err }); });
  });
}
function git(cwd, args) {
  return run('git', ['-c', 'user.name=andy', '-c', 'user.email=andy@example.invalid', '-c', 'commit.gpgsign=false'].concat(args), cwd);
}
async function commits(cwd) { const r = await git(cwd, ['rev-list', '--count', 'HEAD']); return r.status === 0 ? Number(r.stdout.trim()) : 0; }
async function commitWith(cwd, file, text, message) {
  fs.writeFileSync(path.join(cwd, file), text);
  await git(cwd, ['add', file]);
  const r = await git(cwd, ['commit', '-m', message]);
  // A refused commit leaves its file staged (git keeps the index when commit-msg refuses); unstage it, so the next
  // commit carries its own file alone (wsl-claude's review).
  if (r.status !== 0) await git(cwd, ['rm', '-q', '--cached', file]);
  return r;
}

async function main() {
  test.subHeading('A. the six rules head AGENTS.md, verbatim and in order, and the desk server serves them');
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  const served = await desk('AGENTS', {}, SELF_AT_DESK);
  const text = (served.body && typeof served.body.text === 'string') ? served.body.text : '';
  const onDisk = fs.existsSync(AGENTS_MD) ? fs.readFileSync(AGENTS_MD, 'utf8') : '';
  const at = RULES.map(function (r) { return text.indexOf(r); });
  const firstSection = text.indexOf('\n## ');
  const inOrder = at.every(function (i, n) { return i !== -1 && (n === 0 || i > at[n - 1]); });
  if (served.status === 200 && text === onDisk && inOrder && (firstSection === -1 || at[0] < firstSection)) test.check('AGENTS {} serves process/js/desk/AGENTS.md, and the six sentences head it in his order');
  else test.fail(OWED + 'AGENTS served ' + served.status + ', the file matched: ' + (text === onDisk) + ', sentences found at ' + JSON.stringify(at) + ', first section at ' + firstSection);

  test.subHeading('B. the desk: go is his press; a claim before Go is refused; Close before Go');
  const set = await desk('session.set', { json: JSON.stringify({ goal: { id: 'r/G1', title: 'Rules' }, items: [
    // r/G1.1 blocks r/G1.2, so his go-all on the goal never reaches r/G1.2 (wsl-claude's review of the first red).
    { id: 'r/G1.1', title: 'Gone by his press', blocks: ['r/G1.2'] },
    { id: 'r/G1.2', title: 'Never gone', blocks: ['r/G1'] },
    { id: 'r/G1.3', title: 'Gone by go-all', blocks: ['r/G1'] },
    { id: 'r/G1.4', title: 'Closed before Go', blocks: ['r/G1'] },
  ] }) }, SELF_AT_DESK);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  // A session arrives in design mode, where nothing offers Go (desk/G3.1); his end-design opens the goal.
  await desk('press', { id: 'r/G1', what: 'end-design' }, ANDY);
  let f1 = await factsOf('r/G1.1');
  const before = f1 && f1.go === false && f1.buttons.indexOf('go') !== -1;
  const claimEarly = await desk('press', { id: 'r/G1.2', what: 'claim-done' }, SELF_AT_DESK);
  const f2 = await factsOf('r/G1.2');
  const refusedEarly = claimEarly.status !== 200 || (claimEarly.body && claimEarly.body.ok === false);
  if (refusedEarly && f2 && f2.go === false && f2.buttons.indexOf('done') === -1 && f2.status !== 'running') test.check('B2: a claim-done on an item without his Go is refused (' + JSON.stringify(claimEarly.body).slice(0, 80) + '), and the item is not gone and offers no Done');
  else test.fail(OWED + 'B2: claim-done before Go answered ' + claimEarly.status + ' ' + JSON.stringify(claimEarly.body).slice(0, 120) + '; facts after: ' + JSON.stringify(f2));
  const go = await desk('press', { id: 'r/G1.1', what: 'go' }, ANDY);
  f1 = await factsOf('r/G1.1');
  if (before && go.status === 200 && f1 && f1.go === true) test.check('B1: go is false before his press and true after it');
  else test.fail(OWED + 'B1: facts before ' + JSON.stringify(before) + ', his go answered ' + go.status + ', facts after ' + JSON.stringify(f1));
  const claim = await desk('press', { id: 'r/G1.1', what: 'claim-done' }, SELF_AT_DESK);
  f1 = await factsOf('r/G1.1');
  if (claim.status === 200 && f1 && f1.go === true && f1.buttons.indexOf('done') !== -1) test.check('B2: after his Go the claim-done is taken and Done is offered');
  else test.fail(OWED + 'B2: claim-done after Go answered ' + claim.status + ' ' + JSON.stringify(claim.body).slice(0, 100) + '; facts ' + JSON.stringify(f1));
  // B3 BEFORE THE GO-ALL (wsl-claude's review of the first red): r/G1.4 is goable, so his go-all would reach it.
  let f4 = await factsOf('r/G1.4');
  const offered = f4 && f4.buttons.indexOf('close') !== -1 && f4.buttons.indexOf('go') !== -1;
  const close = await desk('press', { id: 'r/G1.4', what: 'close' }, ANDY);
  f4 = await factsOf('r/G1.4');
  if (offered && close.status === 200 && f4 && f4.status === 'closed' && f4.buttons.length === 0) test.check('B3: an item not gone and not done offers close beside go; his close is taken and the item is closed');
  else test.fail(OWED + 'B3: offered close before Go: ' + offered + ', his close answered ' + close.status + ' ' + JSON.stringify(close.body).slice(0, 100) + ', facts ' + JSON.stringify(f4));
  await desk('press', { id: 'r/G1.3', what: 'go-all' }, ANDY);
  await desk('press', { id: 'r/G1', what: 'go-all' }, ANDY);
  const f3 = await factsOf('r/G1.3');
  if (f3 && f3.go === true) test.check('B1: go-all sets go on each item it reached');
  else test.fail(OWED + 'B1: after go-all, r/G1.3 facts ' + JSON.stringify(f3));

  test.subHeading('C. the page: an armed Close at the right edge of the dialog, none on the List row');
  const early = dialog({ id: 'r/G1.4', title: 'Closed before Go', goal: 'r/G1', status: '', with: '', buttons: ['go', 'close'], blocking: [], blocked: [], alone: false, star: false, go: false });
  await settled();
  const bar0 = early.bar();
  const closeAt = bar0.indexOf('id="dd-close"');
  const lastButton = bar0.lastIndexOf('<button');
  early.click('dd-close');
  await settled();
  const armed = /id="dd-close"[^>]*data-armed="1"/.test(early.bar());
  const noPress = early.presses.length === 0;
  early.click('dd-close');
  await settled();
  const pressed = early.presses.length === 1 && early.presses[0].what === 'close' && early.presses[0].id === 'r/G1.4';
  if (closeAt !== -1 && closeAt >= lastButton && noPress && armed && pressed) test.check('C1: before Go, Close is the last button of the bar; the first click arms it, the second presses close');
  else test.fail(OWED + 'C1: Close at ' + closeAt + ' (last button at ' + lastButton + '), first click sent ' + (noPress ? 'nothing' : JSON.stringify(early.presses)) + ', armed: ' + armed + ', second click pressed: ' + pressed);
  const done = dialog({ id: 'r/G1.1', title: 'Done', goal: 'r/G1', status: 'done', with: '', buttons: ['close', 'reopen'], blocking: [], blocked: [], alone: false, star: false, go: true });
  await settled();
  done.click('dd-close');
  await settled();
  if (done.presses.length === 1 && done.presses[0].what === 'close') test.check('C1: on a done item Close presses on the first click, as before');
  else test.fail('C1: on a done item the first click sent ' + JSON.stringify(done.presses));
  const l = list([row({ id: 'r/G1.4', title: 'Open', status: '', buttons: ['go', 'close'], go: false }), row({ id: 'r/G1.1', title: 'Done', status: 'done', buttons: ['close', 'reopen'], go: true })]);
  await settled();
  const page = l.html();
  const openRow = hasClose(page, 'r/G1.4');
  const doneRow = hasClose(page, 'r/G1.1');
  if (!openRow && doneRow) test.check('C2: the List draws no Close on a row that is not done, and keeps it on a done row');
  else test.fail(OWED + 'C2: the List drew Close on the open row: ' + openRow + ', on the done row: ' + doneRow);

  test.subHeading('D. rule 1 at deskClient: next is refused by name while the other agent is not blocked');
  startClient(nodeUrl);
  const tree = await up('deskClient') || {};
  if (!tree.next) { test.fail(OWED + 'D: deskClient has no verb next'); }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  // A first run starts at now (goal/G3.4): his line is written once the wait is on, so it is new to deskClient.
  const waiting = next();
  await sleep(1500);
  await desk('chat.add', { id: 'r/G1.1', text: 'his line, before any other agent wrote' }, ANDY);
  const his = await waiting;
  if (his.status === 200 && his.lines && his.lines.some(function (x) { return x.indexOf('before any other agent wrote') !== -1; })) test.check('D: his write is handed over; Andy is no agent to block');
  else test.fail(OWED + 'D: after his line next answered ' + his.status + ' ' + JSON.stringify(his.body).slice(0, 160));
  await desk('chat.add', { id: 'r/G1.1', text: 'the other agent speaks' }, OTHER_AT_DESK);
  const unblocked = await next();
  const names = JSON.stringify(unblocked.body);
  if (unblocked.body.ok === false && unblocked.body.code === 'unblocked' && names.indexOf('wsl-claude') !== -1 && names.indexOf(OTHER_KEY) !== -1) test.check('D: with wsl-claude unblocked on this node, next is refused unblocked, naming it and its key');
  else test.fail(OWED + 'D: with the other agent unblocked next answered ' + unblocked.status + ' ' + names.slice(0, 200));
  const askedBook = asked.filter(function (a) { return a.verb === 'contact.get' || a.verb === 'contact.search'; }).length;
  book[OTHER_KEY] = { label: 'wsl-claude', blocked: true };
  const held = await next();
  if (held.status === 200 && held.lines && held.lines.some(function (x) { return x.indexOf('the other agent speaks') !== -1; }) && askedBook > 0) test.check('D: once the node blocks that key (asked ' + askedBook + ' times of the book), next hands the held line over');
  else test.fail(OWED + 'D: with the other agent blocked next answered ' + held.status + ' ' + JSON.stringify(held.body).slice(0, 160) + '; the book was asked ' + askedBook + ' times');
  book[OTHER_KEY].blocked = false;
  await desk('chat.add', { id: 'r/G1.1', text: 'the other agent speaks again' }, OTHER_AT_DESK);
  const again = await next();
  if (again.body.ok === false && again.body.code === 'unblocked') test.check('D: unblocked again, refused again: the check holds for every wait');
  else test.fail(OWED + 'D: after the block was lifted next answered ' + again.status + ' ' + JSON.stringify(again.body).slice(0, 160));
  book[OTHER_KEY].blocked = true;
  await next();

  test.subHeading('E. rules 3 and 4 at the commit: refused without an item with his Go; recorded under it with its files');
  const repo = path.join(scratch, 'clone');
  fs.mkdirSync(repo);
  await git(repo, ['init', '-q']);
  const install = fs.existsSync(CHECK) ? await run(process.execPath, [CHECK, 'install', String(node.address().port)], repo) : { status: -1, stdout: '', stderr: 'no process/js/desk/commitCheck.js' };
  if (install.status === 0) test.check('E: `node commitCheck.js install <port>` in the clone exits 0');
  else test.fail(OWED + 'E: install answered ' + install.status + ' ' + String(install.stderr || install.stdout).trim().slice(0, 160));
  const noItem = await commitWith(repo, 'a.txt', 'a', 'names no item at all');
  const notGone = await commitWith(repo, 'b.txt', 'b', 'r/G1.2: an item he never pressed Go on');
  const n0 = await commits(repo);
  if (install.status === 0 && noItem.status !== 0 && notGone.status !== 0 && n0 === 0) test.check('E1: a commit naming no item, or an item without his Go, is refused and nothing is committed');
  else test.fail(OWED + 'E1: no item -> ' + noItem.status + ', item without Go -> ' + notGone.status + ', commits on record: ' + n0);
  const taken = await commitWith(repo, 'c.txt', 'c', 'r/G1.1: taken, he pressed Go');
  const hash = (await git(repo, ['rev-parse', 'HEAD'])).stdout.trim();
  const n1 = await commits(repo);
  await sleep(1500);
  const lines = (await chatOf('r/G1.1')).filter(function (c) { return c.by !== 'andy' && c.by !== 'desk'; });
  const line = lines.filter(function (c) { return hash && c.text.indexOf(hash.slice(0, 7)) !== -1; })[0];
  const bullets = line ? line.text.split('\n').filter(function (x) { return /^- /.test(x.trim()); }).map(function (x) { return x.trim().slice(2).trim(); }) : [];
  if (taken.status === 0 && n1 === 1 && line && bullets.length === 1 && bullets[0] === 'c.txt') test.check('E2: a commit naming an item with his Go is taken and written under it: ' + hash.slice(0, 7) + ' with "- c.txt"');
  else test.fail(OWED + 'E2: commit -> ' + taken.status + ' ' + String(taken.stderr).trim().slice(0, 120) + '; commits: ' + n1 + '; line under r/G1.1: ' + JSON.stringify(line || lines.map(function (c) { return c.text; })).slice(0, 200));
  const viaClient = asked.filter(function (a) { return a.verb === 'jobs.api' && a.body.ask && a.body.ask.deskClient; }).length;
  if (viaClient > 0) test.check('E2: the check asked through this agent\'s own deskClient (' + viaClient + ' jobs.api asks), so it is counted');
  else test.fail(OWED + 'E2: no jobs.api ask of deskClient came from the check');
  await desk('press', { id: 'r/G1.1', what: 'done' }, ANDY);
  const isDone = await commitWith(repo, 'd.txt', 'd', 'r/G1.1: done already');
  const n2 = await commits(repo);
  if (isDone.status !== 0 && n2 === 1) test.check('E1: a commit naming a done item is refused');
  else test.fail(OWED + 'E1: after his Done a commit naming r/G1.1 -> ' + isDone.status + ', commits: ' + n2);
  const dark = fs.existsSync(CHECK) ? await run(process.execPath, [CHECK, 'install', '1'], repo) : { status: -1 };
  const unreachable = dark.status === 0 ? await commitWith(repo, 'e.txt', 'e', 'r/G1.3: the node is down') : { status: 0 };
  const n3 = await commits(repo);
  if (unreachable.status !== 0 && n3 === 1) test.check('E3: with the node unreachable the commit is refused, not waved through');
  else test.fail(OWED + 'E3: with no node on port 1 the commit -> ' + unreachable.status + ', commits: ' + n3);
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  node.close();
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy on win32 */ } process.exit(0); }, 300);
});
