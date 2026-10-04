'use strict';

// goal/G4.23: agent scopes — each agent bound to folders Andy sets, enforced by the commit check, core files locked
// behind his grant. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.20, G4.22 and G4.23: "it should refuse to commit a core file that was not granted,
//   and raise an ERROR icon in my list, and a grant request in the item?"; "i alone, i definitely will consult you";
//   "ahh, the default: nothing. it can read everything?  we check it's competence..."; "beside the agents key, this
//   might be a growing dataset."; "the scope still has a grant-lock on core files."; "basicall run/js and intrinsics";
//   "your initial scope is repo root"; then his Go on goal/G4.23. The box (v6) holds the rest.
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  THE SCOPE IS DESK STATE, by the agent's key: desk verbs scope.set {agent: <key>, folders: [<repo path>...]},
//      Andy alone (an agent is refused not-owner), and scope.get {agent: <key>} answering {folders}; agent '' is the
//      caller itself. A folder is a repo-relative path ending in '/', or '' for the repo root. An agent never set
//      answers folders [] (his "the default: nothing").
//   2  THE CORE TABLE: spirit/run/process/js/desk/coreFiles.js exports isCore(repoPath): every file under spirit/run/js/,
//      and every file in the folder of a shell app whose manifest (spirit/run/shell/<name>/<name>.json) says
//      "intrinsic": true. The one table the commit check reads and this test reads.
//   3  THE COMMIT CHECK, on top of today's item-and-Go rule: every staged file must lie inside one of the committing
//      agent's folders (scope.get {agent: ''} through its own deskClient), else the commit is refused and nothing is
//      committed. A staged core file also needs a granted G check on the item whose words hold its path relative to
//      spirit/run (as G4.25's "core grant: js/jobs.js — ..."); refused without it, and the refusal adds to the item one
//      open G check "core grant: <that path>" (his "a grant request in the item"; asks then raises his ❌), once.
//
// FOUND IN THE DRY RUN: with "the default: nothing", every commit of an agent Andy has not scoped is refused. So
//   deskRules.js section E (its agent never scoped) goes red until it sets a scope, the builder's to move; and live,
//   claude-windows and wsl-claude cannot commit after this lands until he sets our scopes to the repo root.
// LEFT OPEN, not asserted: the scope pane (the agent bubbles as tab headers, the path selector element on the shell's
// tree) — its element API is not shaped yet, and it gets its red once the server side stands; whether
// spirit/run/node_modules counts as core (RECOMMENDED, NOT YET RULED in the box); the scopes of the agents working
// today, which he sets in Desk ("your initial scope is repo root"), not code.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const apiDoor = require('../run/js/apiDoor.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G4.23: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const CORE = path.join(RUN, 'process', 'js', 'desk', 'coreFiles.js');

const SELF_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestSelfAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestOtherAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestDeskNodeAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.23: agent scopes, enforced at the commit, core files locked behind his grant');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-scopes-'));
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
const call = function (app, verb, args, caller) { const q = {}; q[verb] = args; const b = {}; b[app] = q; return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
const desk = function (verb, args, caller) { return call('desk', verb, args, caller); };

// The pretend node this agent's deskClient runs on, as deskRules.js builds it: jobs.api through the real apiDoor as
// the owner (so the commit hook reaches deskClient), the contact book (the other agent blocked), and peer.post into
// the real desk as this agent.
const streams = [];
const book = Object.create(null);
book[OTHER_KEY] = { label: 'wsl-claude', blocked: true };
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const json = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (b.verb === 'jobs.api') return apiDoor.answer(client, b.ask, OWNER).then(function (a) { json((a && a.status) || 500, a ? a.body : null); }, function (e) { json(500, { ok: false, error: String(e && e.message) }); });
    if (b.verb === 'contact.get') { const row = book[String(b.key || '')]; return row ? json(200, { ok: true, key: b.key, person: { publicKey: b.key, caption: row.label, blocked: !!row.blocked, held: false } }) : json(404, { ok: false }); }
    if (b.verb === 'contact.search') return json(200, { ok: true, items: Object.keys(book).map(function (k) { return { key: k, label: book[k].label + (book[k].blocked ? ' · blocked' : '') }; }), more: false, selfTail: 'self' });
    if (b.verb !== 'peer.post') return json(400, { ok: false, code: 'no-such-verb' });
    const hash = 'H' + Date.now() + Math.random();
    let ask = null; try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const want = (ask && ask.body && ask.body.desk) || {};
    json(200, { ok: true, hash: hash });
    client.ask({ desk: want }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});
async function up(app) {
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ } }
  return null;
}
function run(cmd, args, cwd) {
  return new Promise(function (resolve) {
    const kid = spawn(cmd, args, { cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    kid.stdout.on('data', function (c) { out += c; });
    kid.stderr.on('data', function (c) { err += c; });
    const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 60000);
    kid.on('error', function (e) { clearTimeout(timer); resolve({ status: -1, stdout: out, stderr: String(e && e.message) }); });
    kid.on('exit', function (code) { clearTimeout(timer); resolve({ status: code, stdout: out, stderr: err }); });
  });
}
function git(cwd, args) { return run('git', ['-c', 'user.name=andy', '-c', 'user.email=andy@example.invalid', '-c', 'commit.gpgsign=false'].concat(args), cwd); }
async function commits(cwd) { const r = await git(cwd, ['rev-list', '--count', 'HEAD']); return r.status === 0 ? Number(r.stdout.trim()) : 0; }
async function commitWith(cwd, file, text, message) {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), text);
  await git(cwd, ['add', file]);
  const r = await git(cwd, ['commit', '-m', message]);
  if (r.status !== 0) await git(cwd, ['rm', '-q', '--cached', file]);
  return r;
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  await desk('session.set', { json: JSON.stringify({ goal: { id: 'k/G1', title: 'Scopes' }, items: [{ id: 'k/G1.1', title: 'Work', blocks: ['k/G1'] }] }) }, SELF_AT_DESK);
  await desk('press', { id: 'k/G1', what: 'end-design' }, ANDY);
  await desk('press', { id: 'k/G1.1', what: 'go' }, ANDY);

  test.subHeading('1. the scope is desk state by the agent\'s key, set by Andy alone');
  const none = await desk('scope.get', { agent: '' }, SELF_AT_DESK);
  if (none.status === 200 && Array.isArray((none.body || {}).folders) && none.body.folders.length === 0) test.check('an agent never scoped answers folders []: it may commit nothing');
  else test.fail(OWED + 'scope.get for an unscoped agent answered ' + none.status + ' ' + short(none.body));
  const byAgent = await desk('scope.set', { agent: SELF_KEY, folders: [''] }, SELF_AT_DESK);
  if ((byAgent.body || {}).code === 'not-owner') test.check('an agent setting a scope is refused not-owner');
  else test.fail(OWED + 'an agent\'s scope.set answered ' + byAgent.status + ' ' + short(byAgent.body));
  const set = await desk('scope.set', { agent: SELF_KEY, folders: ['spirit/run/shell/ticTacToe/'] }, ANDY);
  const mine = await desk('scope.get', { agent: '' }, SELF_AT_DESK);
  const his = await desk('scope.get', { agent: SELF_KEY }, ANDY);
  const other = await desk('scope.get', { agent: '' }, OTHER_AT_DESK);
  const f = function (r) { return JSON.stringify((r.body || {}).folders); };
  if (set.status === 200 && f(mine) === '["spirit/run/shell/ticTacToe/"]' && f(his) === f(mine) && f(other) === '[]') test.check('Andy sets it by key; the agent reads its own, Andy reads it by key, another agent is not touched');
  else test.fail(OWED + 'scope.set ' + set.status + ' ' + short(set.body) + '; own ' + f(mine) + ', by key ' + f(his) + ', other ' + f(other));

  test.subHeading('2. the core table: run/js and the intrinsic apps');
  let core = null;
  try { core = require(CORE); } catch (e) { core = null; }
  const cases = [['spirit/run/js/jobs.js', true], ['spirit/run/js/client/shell.js', true], ['spirit/run/shell/deskDetails/deskDetails.js', true],
    ['spirit/run/shell/files/files.js', true], ['spirit/run/shell/desk/desk.js', false], ['spirit/run/shell/chatter/chatter.js', false],
    ['spirit/test/deskScopes.js', false], ['design/README.md', false], ['spirit/run/process/js/desk/desk.js', false]];
  const wrong = core && typeof core.isCore === 'function' ? cases.filter(function (c) { return core.isCore(c[0]) !== c[1]; }) : cases;
  if (!wrong.length) test.check('isCore: run/js and the intrinsic apps\' folders (deskDetails, files) are core; desk, chatter, tests, design and process folders are not');
  else test.fail(OWED + (core ? 'isCore wrong on ' + short(wrong) : 'no spirit/run/process/js/desk/coreFiles.js exporting isCore'));

  test.subHeading('3. the commit check refuses what lies outside the scope, and a core file nobody granted');
  kids.push(spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: 400, historyMax: 100 }), '--pipe', clientPipe, '--state', clientState, '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }) }));
  await up('deskClient');
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  const repo = path.join(scratch, 'clone');
  fs.mkdirSync(repo);
  await git(repo, ['init', '-q']);
  const install = await run(process.execPath, [CHECK, 'install', String(node.address().port)], repo);
  if (install.status !== 0) { test.fail('commitCheck install answered ' + install.status + ' ' + String(install.stderr).trim().slice(0, 160)); return; }

  const inside = await commitWith(repo, 'spirit/run/shell/ticTacToe/game.js', 'x', 'k/G1.1: inside the scope');
  const n1 = await commits(repo);
  if (inside.status === 0 && n1 === 1) test.check('a file inside the agent\'s folder is taken');
  else test.fail('inside the scope the commit answered ' + inside.status + ' ' + String(inside.stderr).trim().slice(0, 160));
  const outside = await commitWith(repo, 'other/notes.txt', 'x', 'k/G1.1: outside the scope');
  const n2 = await commits(repo);
  if (outside.status !== 0 && n2 === 1 && /scope/i.test(outside.stderr + outside.stdout)) test.check('a file outside it is refused, saying scope, and nothing is committed');
  else test.fail(OWED + 'outside the scope the commit answered ' + outside.status + ' (' + n2 + ' commits): ' + String(outside.stderr).trim().slice(0, 160));
  await desk('scope.set', { agent: SELF_KEY, folders: [] }, ANDY);
  const unscoped = await commitWith(repo, 'spirit/run/shell/ticTacToe/two.js', 'x', 'k/G1.1: no scope at all');
  if (unscoped.status !== 0 && (await commits(repo)) === 1) test.check('with folders [] the same folder is refused too: the default is nothing');
  else test.fail(OWED + 'with no scope the commit answered ' + unscoped.status);

  await desk('scope.set', { agent: SELF_KEY, folders: [''] }, ANDY);
  const anywhere = await commitWith(repo, 'other/notes.txt', 'x', 'k/G1.1: the repo root is the scope');
  if (anywhere.status === 0 && (await commits(repo)) === 2) test.check('with the repo root as its scope, the same file is taken');
  else test.fail(OWED + 'with the root as scope the commit answered ' + anywhere.status + ' ' + String(anywhere.stderr).trim().slice(0, 160));
  const coreOne = await commitWith(repo, 'spirit/run/js/core.js', 'x', 'k/G1.1: a core file, not granted');
  const n3 = await commits(repo);
  const checks = ((await desk('item.checks', { id: 'k/G1.1' }, ANDY)).body || {}).checks || [];
  const asked = checks.filter(function (c) { return c.kind === 'G' && c.state === 'open' && c.words.indexOf('js/core.js') !== -1; });
  if (coreOne.status !== 0 && n3 === 2 && /grant/i.test(coreOne.stderr + coreOne.stdout)) test.check('a core file nobody granted is refused, saying grant, even inside the scope');
  else test.fail(OWED + 'the ungranted core file: commit ' + coreOne.status + ' (' + n3 + ' commits): ' + String(coreOne.stderr).trim().slice(0, 160));
  if (asked.length === 1) test.check('and the refusal put one open grant under the item: ' + asked[0].number + ' "' + asked[0].words + '"');
  else test.fail(OWED + 'open G checks naming js/core.js after the refusal: ' + short(checks));
  await commitWith(repo, 'spirit/run/js/core.js', 'x', 'k/G1.1: a core file, still not granted');
  const again = (((await desk('item.checks', { id: 'k/G1.1' }, ANDY)).body || {}).checks || []).filter(function (c) { return c.kind === 'G' && c.words.indexOf('js/core.js') !== -1; });
  if (again.length === 1) test.check('a second refusal asks no second grant');
  else test.fail(OWED + 'after a second refusal there are ' + again.length + ' G checks for js/core.js');
  if (asked.length) await desk('check.set', { id: 'k/G1.1', check: asked[0].number, state: 'granted' }, ANDY);
  const granted = await commitWith(repo, 'spirit/run/js/core.js', 'x', 'k/G1.1: the core file, granted');
  if (granted.status === 0 && (await commits(repo)) === 3) test.check('once he granted it, the same commit is taken');
  else test.fail(OWED + 'after his grant the commit answered ' + granted.status + ' ' + String(granted.stderr).trim().slice(0, 160));
}

main().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } process.exit(0); }, 300);
});
