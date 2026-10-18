'use strict';

// goal/G19.6: deskClient pulls beside the call that hands an agent its lines, never inside it, and never aborts a
// rebase it did not start. Red on today's tree.
//   Andy, 2026-10-12, to the findings of goal/G19.6: "agreed to the whole thing as stated in your last message." The
//   box: "deskClient pulls beside the call that hands an agent its lines, never inside it, and never aborts a rebase
//   it did not start." Today pullClone (goal/G5.8) runs a synchronous git pull --rebase inside next, past the node's
//   12 s door, and a failed pull runs git rebase --abort whatever rebase was in progress.
//
// THE SHAPES (the builder's picks; the box names none):
//   1  next hands over the commit line at once, while the pull it starts is still running (made slow here by a
//      reference-transaction hook in the clone that sleeps 6 s once); what the pull has to tell comes on a later next,
//      worded as today ("commit X landed; ... the pull clashed and was undone ...").
//   2  A clashing pull it started is undone: the clone's HEAD is where it was, no rebase left in progress.
//   3  A rebase already in progress in the clone (the agent's own) is not pulled into and not aborted: "commit X
//      landed; a rebase is in progress in your clone, so it was not pulled."
//   4  Unsaved edits are told as today: "commit X landed; your clone has unsaved edits, so it was not pulled."
// deskClient finds its clone from its own folder (git rev-parse --show-toplevel), so this suite plants a run tree in a
// fresh git clone and starts deskClient from there; nothing in the node or deskClient is a test helper.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G19.6: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const POLL_MS = 400;
const SELF_KEY = 'MCowBQYDK2VwAyEAdeskClientPullTestSelfAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskClientPullTestOtherAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskClientPullTestDeskNodeAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-windows' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-windows' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'wsl-claude' };
const ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function git(cwd, args) { const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8', env: ENV, timeout: 120000 }); return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() }; }

test.startTest('goal/G19.6: deskClient pulls beside next, never inside it, and aborts only its own rebase');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclient-pull-'));
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

// THE PRETEND NODE deskClient runs on, as deskClientNext.js builds it: its peer.post goes into the real desk server,
// the answer comes back down the event stream; every other agent is blocked here (rule 1).
const streams = [];
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
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const desk = (ask && ask.body && ask.body.desk) || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: desk }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

async function up(app) {
  for (let i = 0; i < 80; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
  }
  return null;
}
async function next() {
  const t0 = Date.now();
  const r = await call('deskClient', 'next', {}, OWNER);
  return { lines: (r.body && Array.isArray(r.body.lines)) ? r.body.lines : [], ms: Date.now() - t0, body: r.body };
}
// The nexts after the first, until one hands over a line holding `text`, or `tries` have passed.
async function nextUntil(text, tries) {
  const seen = [];
  for (let i = 0; i < tries; i++) {
    const n = await next();
    n.lines.forEach(function (l) { seen.push(l); });
    if (n.lines.some(function (l) { return l.indexOf(text) !== -1; })) return { found: true, seen: seen };
  }
  return { found: false, seen: seen };
}
// Another agent's commit line under the item, as commitCheck writes it once the remote holds the commit.
async function landed(hash, subject) {
  await call('desk', 'item.take', { id: 'a/G1.1' }, OTHER_AT_DESK);
  await call('desk', 'chat.add', { id: 'a/G1.1', text: 'commit ' + hash + ': ' + subject + '\n- x.txt' }, OTHER_AT_DESK);
}
function rebasing(clone) {
  return ['rebase-merge', 'rebase-apply'].some(function (d) { return fs.existsSync(path.join(clone, '.git', d)); });
}

async function main() {
  // THE CLONE: a planted run tree in a fresh git repo, pushed to a bare origin, and another clone that pushes past it.
  const bare = path.join(scratch, 'origin.git');
  git(scratch, ['init', '-q', '--bare', '--initial-branch=master', bare]);
  const clone = path.join(scratch, 'clone');
  fs.mkdirSync(clone);
  git(clone, ['init', '-q', '--initial-branch=master']);
  git(clone, ['config', 'core.autocrlf', 'false']);
  plantRun.plantRunTree(path.join(clone, 'spirit', 'run'));
  fs.writeFileSync(path.join(clone, '.gitignore'), 'spirit/run/relay-state/\nspirit/run/app-state/\n');
  fs.writeFileSync(path.join(clone, 'shared.txt'), 'line one\nline two\n');
  git(clone, ['add', '-A']);
  git(clone, ['commit', '-q', '-m', 'the planted tree']);
  git(clone, ['remote', 'add', 'origin', bare]);
  const seeded = git(clone, ['push', '-q', '-u', 'origin', 'master']);
  const theirs = path.join(scratch, 'theirs');
  git(scratch, ['clone', '-q', '-c', 'core.autocrlf=false', bare, theirs]);
  if (seeded.status !== 0 || !fs.existsSync(path.join(theirs, 'shared.txt'))) { test.fail('the world: origin was not seeded: ' + short(seeded.err)); return; }
  const CLIENT = path.join(clone, 'spirit', 'run', 'process', 'js', 'deskClient', 'deskClient.js');

  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  await up('desk');
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  await call('desk', 'session.set', { json: JSON.stringify({ goal: { id: 'a/G1', title: 'Pulled' }, items: [{ id: 'a/G1.1', title: 'A', blocks: ['a/G1'] }] }) }, OWNER);
  kids.push(spawn(process.execPath, [CLIENT, JSON.stringify({ pollMs: POLL_MS, historyMax: 100 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-windows', publicKey: SELF_KEY })], {
    cwd: clone, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  }));
  if (!await up('deskClient')) { test.fail('the world: deskClient did not come up from the clone'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  // A first run starts at now: one empty wait takes the place.
  await next();

  // ── 1 and 2. A SLOW PULL THAT CLASHES ──
  test.subHeading('1. next answers while a slow pull runs; what the pull tells comes on a later next');
  fs.writeFileSync(path.join(clone, 'shared.txt'), 'line one CHANGED BY US\nline two\n');
  git(clone, ['commit', '-q', '-am', 'ours changed line one']);
  const ours = git(clone, ['rev-parse', 'HEAD']).out;
  fs.writeFileSync(path.join(theirs, 'shared.txt'), 'line one CHANGED BY THEM\nline two\n');
  git(theirs, ['commit', '-q', '-am', 'theirs changed line one']);
  git(theirs, ['push', '-q', 'origin', 'master']);
  const o1 = git(theirs, ['rev-parse', 'HEAD']).out;
  // The pull made slow on purpose: the clone's first ref update after the mark sleeps 6 s.
  const mark = path.join(scratch, 'slow.on');
  const hook = path.join(clone, '.git', 'hooks', 'reference-transaction');
  fs.writeFileSync(hook, '#!/bin/sh\nif [ -f "' + mark.replace(/\\/g, '/') + '" ]; then rm -f "' + mark.replace(/\\/g, '/') + '"; "' +
    process.execPath.replace(/\\/g, '/') + '" -e "setTimeout(function () {}, 6000)"; fi\nexit 0\n');
  fs.chmodSync(hook, 0o755);
  fs.writeFileSync(mark, 'slow');
  await landed(o1, 'theirs changed line one');
  await sleep(POLL_MS + 100);
  const first = await next();
  const handed = first.lines.some(function (l) { return l.indexOf('commit ' + o1) !== -1; });
  const toldAtOnce = first.lines.some(function (l) { return l.indexOf('clashed') !== -1; });
  if (handed && first.ms < 3000) test.check('next handed over the commit line after ' + first.ms + ' ms, the pull still running');
  else test.fail(OWED + 'next answered after ' + first.ms + ' ms with ' + short(first.lines));
  const later = await nextUntil('commit ' + o1 + ' landed; the pull clashed and was undone', 4);
  if (!toldAtOnce && later.found) test.check('the clash was told on a later next, worded as before');
  else test.fail(OWED + 'told in the first next: ' + toldAtOnce + '; the later nexts handed over ' + short(later.seen));
  test.subHeading('2. a clashing pull it started is undone');
  const head = git(clone, ['rev-parse', 'HEAD']).out;
  if (!fs.existsSync(mark) && head === ours && !rebasing(clone)) test.check('the clone is where it was (' + ours.slice(0, 7) + '), no rebase in progress');
  else test.fail(OWED + 'after the clash: the slow hook ran ' + !fs.existsSync(mark) + ', HEAD ' + head.slice(0, 7) + ' (was ' + ours.slice(0, 7) + '), rebase in progress ' + rebasing(clone));

  // ── 3. THE AGENT'S OWN REBASE ──
  test.subHeading('3. a rebase in progress in the clone is not pulled into and not aborted');
  const stopped = git(clone, ['rebase', '-x', 'false', 'HEAD~1']);
  if (!rebasing(clone)) { test.fail('the world: no rebase could be left in progress: ' + short(stopped.err || stopped.out)); return; }
  fs.writeFileSync(path.join(theirs, 'other.txt'), 'other\n');
  git(theirs, ['add', 'other.txt']);
  git(theirs, ['commit', '-q', '-m', 'theirs added a file']);
  git(theirs, ['push', '-q', 'origin', 'master']);
  const o2 = git(theirs, ['rev-parse', 'HEAD']).out;
  await landed(o2, 'theirs added a file');
  await sleep(POLL_MS + 100);
  const told = await nextUntil('commit ' + o2 + ' landed; a rebase is in progress in your clone, so it was not pulled.', 4);
  if (told.found) test.check('told: "commit ' + o2.slice(0, 7) + ' landed; a rebase is in progress in your clone, so it was not pulled."');
  else test.fail(OWED + 'with a rebase in progress the nexts handed over ' + short(told.seen));
  if (rebasing(clone)) test.check('the agent\'s rebase is still in progress');
  else test.fail(OWED + 'the agent\'s own rebase was aborted');
  git(clone, ['rebase', '--abort']);

  // ── 4. UNSAVED EDITS ──
  test.subHeading('4. unsaved edits are told, as before');
  fs.writeFileSync(path.join(clone, 'shared.txt'), 'an unsaved edit\n');
  fs.writeFileSync(path.join(theirs, 'third.txt'), 'third\n');
  git(theirs, ['add', 'third.txt']);
  git(theirs, ['commit', '-q', '-m', 'theirs added a third']);
  git(theirs, ['push', '-q', 'origin', 'master']);
  const o3 = git(theirs, ['rev-parse', 'HEAD']).out;
  await landed(o3, 'theirs added a third');
  await sleep(POLL_MS + 100);
  const unsaved = await nextUntil('commit ' + o3 + ' landed; your clone has unsaved edits, so it was not pulled.', 4);
  if (unsaved.found && fs.readFileSync(path.join(clone, 'shared.txt'), 'utf8') === 'an unsaved edit\n') test.check('told: "commit ' + o3.slice(0, 7) + ' landed; your clone has unsaved edits, so it was not pulled.", the edit untouched');
  else test.fail(OWED + 'with an unsaved edit the nexts handed over ' + short(unsaved.seen));
}

main().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
