'use strict';

// spirit/test/deskServer.js
// THE DESK SERVER THAT OWNS desk.db — desk/G1.3, written FIRST, red on
// today's code.
//
//   Andy's go on desk/G1.3. Decided (Desk, desk/G1): the desk server owns
//   desk.db (D5), in the process's state folder relay-state/process/desk/,
//   never in git ("any appServer state is none of git's business"); the
//   voice file stays a plain file, written there; the local shell reaches
//   it by jobs.api on the loopback door (D4), a member by an 'api' packet.
//   Andy: "test suites need their own copy of node", so the node T3 boots
//   is planted in a temp home, never the checkout.
//
// THE CONTRACT (claude-windows' shapes, agreed with wsl-claude before the
// build; all keys strings unless marked, no reply uses 'ok'):
//   process/js/desk/desk.{js,json}: kind 'server', operated 'node', built on
//     appServer.js; started with --pipe <p> --state <dir> (the node names
//     both; the server never works out its own folder).
//   log.add    {json}            -> {added: bool}   (false: key already held)
//   log.search {text, todo, since} -> {lines: [json], partial: bool}
//              bounded by bytes under appClient.ANSWER_MAX; '' matches all
//   state.get  {} -> {json};  state.set {json} -> {saved: true}
//   seen.get   {} -> {json};  seen.set  {json} -> {saved: true}
//   voice.add  {text, day} -> {added: true}, a line in <state>/voice.jsonl
//   jobs.api   POST /api/spirit {verb: 'jobs.api', ask} -> appClient.ask's
//              status and body; apiDoor.answer(servers, ask) is the function
//              it shares with the member door.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const plantRun = require('./plantRun.js');

test.startTest('desk/G1.3: the desk server owns desk.db, and the node reaches it');

const OWED = 'OWED by desk/G1.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DIR = path.join(RUN, 'process', 'js', 'desk');
const SCRIPT = path.join(DIR, 'desk.js');
const VERBS = ['log.add', 'log.search', 'seen.get', 'seen.set', 'state.get', 'state.set', 'voice.add'];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskserver-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32'
  ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process')
  : path.join(scratch, 'door.sock');
const kids = [];

function start() {
  if (!fs.existsSync(SCRIPT)) return null;
  const kid = spawn(process.execPath, [SCRIPT, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  return kid;
}
function stop(kid) {
  return new Promise(function (r) {
    if (!kid || kid.exitCode !== null) return r();
    kid.once('exit', function () { r(); });
    kid.kill();
  });
}
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 8000);
  return (function again() {
    return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return new Promise(function (r) { setTimeout(r, 150); }).then(again);
    });
  })();
}
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function line(key, todo, text, extra) {
  return JSON.stringify(Object.assign({ key: key, at: new Date(Date.UTC(2026, 8, 29, 5, 0, Number(key.replace(/\D/g, '')) || 0)).toISOString(),
    dir: 'in', peer: 'K', outcome: 'received', from: 'claude-windows', kind: 'note', text: text, todo: todo }, extra || {}));
}

(async function () {
  const client = appClient.createAppClient({ rootDir: scratch });
  if (typeof client.register === 'function') client.register('desk', pipe);
  const ask = function (body) { return client.ask(body); };
  const call = function (verb, args) { const b = {}; b[verb] = args; return ask({ desk: b }).then(function (r) { return r.body || {}; }); };

  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: the desk server is node-operated and answers api with its verbs');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'desk.json'), 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.kind === 'server' && manifest.operated === 'node') test.check('process/js/desk/desk.json: kind server, operated node');
  else test.fail(OWED + 'no process/js/desk/desk.json saying kind server, operated node');
  let kid = start();
  const up = kid ? await waitFor(function () { return ask('api').then(function (r) { return r.body && r.body.desk && r.body.desk.ok !== false; }); }) : false;
  const tree = up ? (await ask('api')).body.desk : null;
  if (tree && Object.keys(tree).sort().join(',') === VERBS.join(',')) test.check('api lists exactly ' + VERBS.join(', '));
  else test.fail(OWED + 'api answered ' + JSON.stringify(tree));

  // ── T2 ──────────────────────────────────────────────────────────────
  test.subHeading('T2: it keeps desk.db in the state folder it was handed, and nothing else opens it');
  const a1 = up ? await call('log.add', { json: line('k1', 'desk/G1.3', 'first line', { to: 'andy', reported: true }) }) : {};
  const a2 = up ? await call('log.add', { json: line('k1', 'desk/G1.3', 'first line') }) : {};
  if (a1.added === true && a2.added === false) test.check('a line is added once; the same key again says added: false; a report line\'s own keys ride along');
  else test.fail(OWED + 'log.add answered ' + JSON.stringify([a1, a2]));
  if (fs.existsSync(path.join(state, 'desk.db'))) test.check('desk.db sits in the --state folder');
  else test.fail(OWED + 'no desk.db in ' + state);
  // Only process/js/desk names desk.db in code; a comment elsewhere may.
  const namers = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (['brains', 'relay-state', 'node_modules', 'app-state'].indexOf(e.name) === -1 && p !== DIR) walk(p); return; }
      if (!/\.js$/.test(e.name)) return;
      const code = fs.readFileSync(p, 'utf8').split('\n').filter(function (l) { return !/^\s*(\/\/|\*)/.test(l); }).join('\n');
      if (/desk\.db/.test(code)) namers.push(path.relative(RUN, p));
    });
  })(RUN);
  if (!namers.length && fs.existsSync(SCRIPT)) test.check('no code outside process/js/desk names desk.db');
  else test.fail(OWED + (fs.existsSync(SCRIPT) ? 'desk.db named in ' + namers.join(', ') : 'no process/js/desk/desk.js'));

  // Searching: by todo, by text, since, and bounded by bytes.
  if (up) {
    await call('log.add', { json: line('k2', 'desk/G1.4', 'second line') });
    await call('log.add', { json: line('k3', 'desk/G1.3', 'third LINE') });
  }
  const byTodo = up ? await call('log.search', { text: '', todo: 'desk/G1.3', since: '' }) : {};
  const byText = up ? await call('log.search', { text: 'second', todo: '', since: '' }) : {};
  const since = up ? await call('log.search', { text: '', todo: '', since: new Date(Date.UTC(2026, 8, 29, 5, 0, 2)).toISOString() }) : {};
  const keys = function (r) { return (r.lines || []).map(function (l) { try { return JSON.parse(l).key; } catch (e) { return '?'; } }).sort().join(','); };
  if (keys(byTodo) === 'k1,k3' && keys(byText) === 'k2' && keys(since) === 'k2,k3' && byTodo.partial === false) {
    test.check('search by todo, by text, and since: each finds its lines, whole, as JSON text');
  } else {
    test.fail(OWED + 'search found todo ' + keys(byTodo) + ', text ' + keys(byText) + ', since ' + keys(since));
  }
  const report = (byTodo.lines || []).map(function (l) { try { return JSON.parse(l); } catch (e) { return {}; } }).filter(function (l) { return l.key === 'k1'; })[0];
  if (report && report.reported === true && report.to === 'andy') test.check('a report line comes back with its to and reported');
  else test.fail(OWED + 'k1 came back as ' + JSON.stringify(report));

  const big = 'x'.repeat(1000);
  if (up) for (let i = 10; i < 30; i++) await call('log.add', { json: line('b' + i, 'desk/big', big) });
  const cut = up ? await call('log.search', { text: '', todo: 'desk/big', since: '' }) : {};
  const bytes = Buffer.byteLength(JSON.stringify(cut), 'utf8');
  if (cut.partial === true && (cut.lines || []).length > 0 && (cut.lines || []).length < 20 && bytes <= appClient.ANSWER_MAX) {
    test.check('20 lines over ANSWER_MAX (' + appClient.ANSWER_MAX + ' bytes): ' + cut.lines.length + ' came back, partial, ' + bytes + ' bytes');
  } else {
    test.fail(OWED + 'a search over the bound answered ' + ((cut.lines || []).length) + ' lines, partial ' + cut.partial + ', ' + bytes + ' bytes');
  }

  // State, seen, voice.
  const s1 = up ? await call('state.set', { json: JSON.stringify({ decided: { 'desk/G1.3': 'go' } }) }) : {};
  const sg = up ? await call('state.get', {}) : {};
  const n1 = up ? await call('seen.set', { json: JSON.stringify({ team: 5 }) }) : {};
  const ng = up ? await call('seen.get', {}) : {};
  if (s1.saved === true && n1.saved === true && sg.json === JSON.stringify({ decided: { 'desk/G1.3': 'go' } }) && ng.json === JSON.stringify({ team: 5 })) {
    test.check('state and seen are saved and read back as the JSON text given');
  } else {
    test.fail(OWED + 'state/seen answered ' + JSON.stringify([s1, sg, n1, ng]));
  }
  const v = up ? await call('voice.add', { text: 'typed by andy', day: '2026-09-29' }) : {};
  let voice = '';
  try { voice = fs.readFileSync(path.join(state, 'voice.jsonl'), 'utf8'); } catch (e) { voice = ''; }
  if (v.added === true && voice === JSON.stringify({ text: 'typed by andy', day: '2026-09-29' }) + '\n') test.check('voice.add appends {text, day} to voice.jsonl, a plain file in the state folder');
  else test.fail(OWED + 'voice.add ' + JSON.stringify(v) + ', file ' + JSON.stringify(voice));

  const bad = up ? await call('log.add', { json: 'not json' }) : {};
  if (bad.ok === false) test.check('a line that is not JSON is refused, by an error');
  else test.fail(OWED + 'a non-JSON line answered ' + JSON.stringify(bad));
  // Tightened after the mutation run: a state that is not JSON is refused too.
  const badState = up ? await call('state.set', { json: 'not json' }) : {};
  if (badState.ok === false) test.check('a state that is not JSON is refused, by an error');
  else test.fail(OWED + 'a non-JSON state answered ' + JSON.stringify(badState));

  // It survives its own restart: the node brings it back, desk.db holds.
  await stop(kid);
  kid = start();
  const again = kid ? await waitFor(function () {
    return call('log.search', { text: 'third', todo: '', since: '' }).then(function (r) { return keys(r) === 'k3'; });
  }) : false;
  const sAgain = again ? await call('state.get', {}) : {};
  if (again && sAgain.json === JSON.stringify({ decided: { 'desk/G1.3': 'go' } })) test.check('after a restart its lines and state are still there');
  else test.fail(OWED + 'after a restart: search ' + again + ', state ' + JSON.stringify(sAgain));

  // ── T4 ──────────────────────────────────────────────────────────────
  test.subHeading('T4: a known member\'s packet {desk: ...} reaches it');
  let apiDoor = null;
  try { apiDoor = require('../run/js/apiDoor.js'); } catch (e) { apiDoor = null; }
  const posted = [];
  const door = apiDoor && apiDoor.createApiDoor({
    servers: client,
    post: function (relay, to, text) { posted.push({ to: to, text: text }); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode,
    isKnown: function (key) { return key === 'MEMBER'; },
    log: function () {},
  });
  if (door) await door({ text: packet.encode('api', { desk: { 'state.get': {} } }).text, fromKey: 'MEMBER', hash: 'H4' });
  await waitFor(function () { return posted.length > 0; }, 4000);
  const r4 = posted[0] ? packet.decode(posted[0].text) : null;
  if (r4 && r4.re === 'H4' && r4.body && r4.body.json === JSON.stringify({ decided: { 'desk/G1.3': 'go' } })) test.check('the member\'s packet reached the desk server; its state came back as an answer to it');
  else test.fail(OWED + 'the member got ' + JSON.stringify(r4));

  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: jobs.api on the loopback door reaches it');
  const shared = apiDoor && typeof apiDoor.answer === 'function' ? await apiDoor.answer(client, { desk: { 'seen.get': {} } }) : null;
  if (shared && shared.status === 200 && shared.body && shared.body.json === JSON.stringify({ team: 5 })) test.check('apiDoor.answer, the function jobs.api shares, reached the desk server');
  else test.fail(OWED + 'apiDoor.answer ' + (apiDoor && apiDoor.answer ? 'answered ' + JSON.stringify(shared) : 'is missing'));
  await stop(kid);

  // A whole node, planted in a temp home (Andy: "test suites need their own
  // copy of node"): it starts its own desk server, and jobs.api reaches it.
  // A node runs only from a folder named spirit/run.
  const home = path.join(scratch, 'home', 'spirit', 'run');
  plantRun.plantRunTree(home);
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(node);
  let said = '';
  node.stderr.on('data', function (b) { said = (said + b).slice(-2000); });
  const base = 'http://127.0.0.1:' + port;
  const jobsApi = function (body) {
    return relayRequest(base, 'POST', '/api/spirit', { verb: 'jobs.api', ask: body }).then(function (r) {
      let b = null;
      try { b = JSON.parse(r.text); } catch (e) { b = null; }
      return { status: r.status, body: b };
    });
  };
  let whole = null;
  await waitFor(function () {
    return jobsApi({ desk: { 'state.get': {} } }).then(function (r) { whole = r; return r.status === 200 && r.body && typeof r.body.json === 'string'; });
  }, 15000);
  const listed = await jobsApi('api').catch(function () { return null; });
  if (whole && whole.status === 200 && whole.body && typeof whole.body.json === 'string' &&
      listed && listed.body && listed.body.desk && Object.keys(listed.body.desk).sort().join(',') === VERBS.join(',')) {
    test.check('a planted node started its desk server; jobs.api answered api with its verbs and a state.get');
  } else {
    test.fail(OWED + 'jobs.api answered ' + JSON.stringify(whole) + ' / api ' + JSON.stringify(listed && listed.body) + (said.trim() ? ' — node said: ' + said.trim().slice(-300) : ''));
  }
  if (fs.existsSync(path.join(home, 'relay-state', 'process', 'desk', 'desk.db'))) test.check('its desk.db is in the planted node\'s relay-state/process/desk');
  else test.fail(OWED + 'the planted node has no relay-state/process/desk/desk.db');
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
