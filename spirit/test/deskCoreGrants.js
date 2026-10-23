'use strict';

// spirit/test/deskCoreGrants.js
// The core grants of the commit check (goal/G4.23), kept when goal/G10.8 removed agent scopes. This was deskScopes.js;
// its scope sections went with the mechanism. Andy, 2026-10-12: "all agents in desk have "/" file scope", the per-agent
// setting removed from desk and commitCheck ("b"), "all in this item". What stays, his words of 2026-10-04: "it should
// refuse to commit a core file that was not granted, and raise an ERROR icon in my list, and a grant request in the
// item?", "the scope still has a grant-lock on core files.", "basicall run/js and intrinsics".
//
// ASSERTED
//   1  THE CORE TABLE: spirit/run/js/coreFiles.js isCore(repoPath): every file under spirit/run/js/, and every file in
//      the folder of a shell app whose manifest says "intrinsic": true.
//   2  THE COMMIT CHECK: with Go on the item, a file anywhere in the repo is taken (no scope since goal/G10.8); a
//      staged core file needs a granted G check on the item naming its path under spirit/run; refused without it. Since
//      goal/G32.2 the refusal raises no grant of its own, one per file (64 of them outgrew the item's answer): it says
//      to list the files with item.files.add, whose ONE grant for all the core files (goal/G8.8) he grants once; granted,
//      the same commit is taken. A path is matched whole in the grant's comma list, never as a part of a longer path.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const verbTable = require('../run/js/verbTable.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G4.23 (core grants): ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CLIENT = path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js');
const CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const CORE = path.join(RUN, 'js', 'coreFiles.js');

const SELF_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestSelfAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestOtherAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskScopesTestDeskNodeAAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ANDY = { owner: true, key: DESK_KEY, label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.23: core files locked behind his grant at the commit (no agent scopes since goal/G10.8)');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-coregrants-'));
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

// The pretend node this agent's deskClient runs on, as deskRules.js builds it: a server's verb by name through the
// real flat apiDoor (verbTable's door, as /api/spirit runs it since goal/G30.6) as the owner (so the commit hook reaches
// deskClient), the contact book (the other agent blocked), and peer.post into
// the real desk as this agent.
const streams = [];
const book = Object.create(null);
book[OTHER_KEY] = { label: 'wsl-claude', blocked: true };
const ownDoor = verbTable.createVerbTable().door(client, { owner: function () { return OWNER; } });
// A verb of a server this pretend node runs (deskClient.desk, desk.item.get), by its name: the family before the first dot.
ownDoor.serves = function (verb) { const v = String(verb || ''); const dot = v.indexOf('.'); return dot > 0 && client.apps().indexOf(v.slice(0, dot)) !== -1; };
const argsOf = function (b) { const a = {}; Object.keys(b).forEach(function (k) { if (k !== 'verb') a[k] = b[k]; }); return a; };
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const json = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') return json(200, { ok: true });
    if (ownDoor.serves(b.verb)) return ownDoor.call(b.verb, argsOf(b)).then(function (a) { json((a && a.status) || 500, a ? a.body : null); }, function (e) { json(500, { ok: false, error: String(e && e.message) }); });
    if (b.verb === 'contact.get') { const row = book[String(b.key || '')]; return row ? json(200, { ok: true, key: b.key, person: { publicKey: b.key, caption: row.label, blocked: !!row.blocked, held: false } }) : json(404, { ok: false }); }
    if (b.verb === 'contact.search') return json(200, { ok: true, items: Object.keys(book).map(function (k) { return { key: k, label: book[k].label + (book[k].blocked ? ' · blocked' : '') }; }), more: false, selfTail: 'self' });
    if (b.verb !== 'peer.post') return json(400, { ok: false, code: 'no-such-verb' });
    const hash = 'H' + Date.now() + Math.random();
    let ask = null; try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const want = (ask && ask.body && ask.body.desk) || {};
    json(200, { ok: true, hash: hash });
    test.peerAnswer(client, ask && ask.body, SELF_AT_DESK).then(function (r) {
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
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  await desk('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Scopes' }, items: [{ id: 'goal/G100.1', title: 'Work', blocks: ['goal/G100'] }] }) }, ANDY);
  await desk('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  await desk('press', { id: 'goal/G100.1', what: 'go' }, ANDY);

  test.subHeading('1. the core table: run/js and the intrinsic apps');
  let core = null;
  try { core = require('../run/js/coreFiles.js'); } catch (e) { core = null; }
  const cases = [['spirit/run/js/jobs.js', true], ['spirit/run/js/client/shell.js', true], ['spirit/run/shell/deskDetails/deskDetails.js', false],
    ['spirit/run/shell/files/files.js', true], ['spirit/run/shell/desk/desk.js', false], ['spirit/run/shell/chatter/chatter.js', false],
    ['spirit/test/deskCoreGrants.js', false], ['design/README.md', false], ['spirit/run/process/js/desk/desk.js', false]];
  const wrong = core && typeof core.isCore === 'function' ? cases.filter(function (c) { return core.isCore(c[0]) !== c[1]; }) : cases;
  if (!wrong.length) test.check('isCore: run/js and the intrinsic apps\' folders (files) are core; deskDetails (intrinsic: false since 6698275a), desk, chatter, tests, design and process folders are not');
  else test.fail(OWED + (core ? 'isCore wrong on ' + short(wrong) : 'no spirit/run/js/coreFiles.js exporting isCore'));

  test.subHeading('2. the commit check takes any file with Go, and refuses a core file nobody granted');
  kids.push(spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: 400, historyMax: 100 }), '--pipe', clientPipe, '--state', clientState, '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/api/spirit' }) }));
  await up('deskClient');
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  const repo = path.join(scratch, 'clone');
  fs.mkdirSync(repo);
  await git(repo, ['init', '-q']);
  const install = await run(process.execPath, [CHECK, 'install', String(node.address().port)], repo);
  if (install.status !== 0) { test.fail('commitCheck install answered ' + install.status + ' ' + String(install.stderr).trim().slice(0, 160)); return; }

  const inside = await commitWith(repo, 'spirit/run/shell/ticTacToe/game.js', 'x', 'goal/G100.1: an app file');
  const n1 = await commits(repo);
  if (inside.status === 0 && n1 === 1) test.check('a file of an app is taken');
  else test.fail('the app file commit answered ' + inside.status + ' ' + String(inside.stderr).trim().slice(0, 160));
  const anywhere = await commitWith(repo, 'other/notes.txt', 'x', 'goal/G100.1: anywhere in the repo');
  if (anywhere.status === 0 && (await commits(repo)) === 2 && !/scope/i.test(anywhere.stderr + anywhere.stdout)) test.check('a file anywhere in the repo is taken too: no scope since goal/G10.8');
  else test.fail('OWED by goal/G10.8: a file outside any folder answered ' + anywhere.status + ' ' + String(anywhere.stderr + anywhere.stdout).trim().slice(0, 160));
  const coreOne = await commitWith(repo, 'spirit/run/js/core.js', 'x', 'goal/G100.1: a core file, not granted');
  const n3 = await commits(repo);
  const checks = ((await desk('item.checks', { id: 'goal/G100.1' }, ANDY)).body || {}).checks || [];
  const raised = checks.filter(function (c) { return c.kind === 'G'; });
  if (coreOne.status !== 0 && n3 === 2 && /grant/i.test(coreOne.stderr + coreOne.stdout)) test.check('a core file nobody granted is refused, saying grant');
  else test.fail(OWED + 'the ungranted core file: commit ' + coreOne.status + ' (' + n3 + ' commits): ' + String(coreOne.stderr).trim().slice(0, 160));
  if (!raised.length && /item\.files\.add/.test(coreOne.stderr + coreOne.stdout)) test.check('the refusal raises no grant of its own and says to list the files with item.files.add');
  else test.fail('OWED by goal/G32.2: the refusal raised ' + short(raised) + ' and said ' + String(coreOne.stderr).trim().slice(0, 160));
  await desk('item.files.add', { id: 'goal/G100.1', paths: ['spirit/run/js/core.js', 'spirit/run/js/client/js/one.js'] }, SELF_AT_DESK);
  const asked = (((await desk('item.checks', { id: 'goal/G100.1' }, ANDY)).body || {}).checks || []).filter(function (c) { return c.kind === 'G' && c.state === 'open'; });
  if (asked.length === 1) test.check('the list raised one open grant for both core files: ' + asked[0].number + ' "' + asked[0].words + '"');
  else test.fail(OWED + 'open G checks after item.files.add: ' + short(asked));
  if (asked.length) await desk('check.set', { id: 'goal/G100.1', check: asked[0].number, state: 'granted' }, ANDY);
  const part = await commitWith(repo, 'spirit/run/js/one.js', 'x', 'goal/G100.1: js/one.js is only the end of js/client/js/one.js, not granted');
  if (part.status !== 0) test.check('a path that is only the end of a granted one is not covered by it');
  else test.fail('OWED by goal/G32.2: js/one.js was taken under the grant naming js/client/js/one.js');
  const granted = await commitWith(repo, 'spirit/run/js/core.js', 'x', 'goal/G100.1: the core file, granted');
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
