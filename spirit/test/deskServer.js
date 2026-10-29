'use strict';

// spirit/test/deskServer.js
// THE DESK SERVER THAT OWNS desk.db — desk/G1.3, written FIRST, red on
// today's code.
//
//   Andy's go on desk/G1.3. Decided (Desk, desk/G1): the desk server owns
//   desk.db (D5), in the process's state folder relay-state/process/desk/,
//   never in git ("any appServer state is none of git's business"); his
//   voice file was a plain file there until goal/G2.1; the local shell reaches
//   it by its verbs on the loopback door (D4; desk.<verb> on the flat apiDoor
//   since goal/G30.6), a member by an 'api' packet.
//   Andy: "test suites need their own copy of node", so the node T3 boots
//   is planted in a temp home, never the checkout.
//
// THE CONTRACT (claude-windows' shapes, agreed with wsl-claude before the
// build; all keys strings unless marked, no reply uses 'ok'):
//   process/js/desk/desk.{js,json}: kind 'server', operated 'node', built on
//     appServer.js; started with --pipe <p> --state <dir> (the node names
//     both; the server never works out its own folder).
//   (log.add, log.search and pending.get went with goal/G33.4, Andy: "log.add, log.search and pending.get: delete
//   them."; the old lines table they wrote and read was dumped at the migration. T2 holds that they are gone.)
//   (state.get and state.set went with goal/G33.7, nothing called them; seen became one value per item.)
//   seen.get   {id} -> {at};  seen.set  {id, at} -> {change}
//   (voice.add, a line in <state>/voice.jsonl, left with goal/G2.1)
//   desk.<verb> POST /api/spirit {verb: 'desk.<verb>', ...args} -> appClient.ask's
//              status and body, through verbTable's door (its in-process
//              call is door.call); 'api' answers the flat table.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');
const packet = require('../run/spirit/client/packet.js');
const arrivals = require('../run/spirit/arrivals.js');
const { relayRequest } = require('../run/spirit/relayRequest.js');
const plantRun = require('./plantRun.js');

test.startTest('desk/G1.3: the desk server owns desk.db, and the node reaches it');

const OWED = 'OWED by desk/G1.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DIR = path.join(RUN, 'process', 'js', 'desk');
const SCRIPT = path.join(DIR, 'desk.js');
// pending.get joined with desk/G1.5; fresh.get with slim/G1.6; AGENTS with
// slim/G1.8 (its AGENTS.md, which appServer.serve detects); DEBUG with desk/G2.5 (every server has it).
// changes: apiAuth/G1.12, Andy's "yes on the verb" (its own suite is deskChanges.js).
// DEPENDENCIES: apiAuth/G1.10, every appServer process answers it.
// chat.search: goal/G3.11, the search on an item's chat lines (its own suite is deskChatSearch.js).
// goal/G9.7 added item.delete, his alone, on an item of a goal in design mode.
// goal/G8.8 added item.files.add: the files an agent touched, kept by the item.
// goal/G8.3, goal/G8.10 and goal/G19.2 added verify.reject, verify.pass, verify.again and verify.regress; goal/G33.3 took
// all four away (Andy's yes, "box this and continue"): deskVerify knows nothing of the desk, so nothing writes them.
// goal/G9.3 added box.release: the holder lets a box go without writing it.
// goal/G9.9 added goal.add and item.add: the desk names every goal and item id, and the same two verbs serve him and
// the agents (Andy, 2026-10-07: "the desk owns (is in charge of) goal and item ID's.").
// goal/G8.5 added signoff: a leaving agent is gone at once and its phases are freed.
// goal/G10.5 added AGENTS.introspect beside AGENTS: the family every server with an AGENTS.md carries (introSpector.js);
// the desk has no verb files yet, so no AGENTS.<verb> is listed.
// THE VERBS, WITHOUT THEIR DESCRIPTIONS (goal/G19.12). Since goal/G10.8 the api also lists AGENTS.<verb> for every verb
// an agent may use, each the description its verb file gives; frozen into this list they made it red with every verb
// file added. So the verbs are compared exactly, and each AGENTS.<verb> is checked to name one of them.
// goal/G19.13 added claim {id, phase, commit}: a claim carries the commit it was made at, and deskVerify waits for it.
// goal/G21.4 added item.release {id}: an agent lets go of the one task it holds (its own suite is deskChatFlowOneTask.js).
// Since goal/G22.3: the desk mounts every plugin in process/js/desk/plugins/js/ and serves their verbs beside its own;
// the stackFrameChecks plugin brings stackFrameChecks.make {gate, endpoint} (its own suite is deskPluginsGg.js), and
// since its list of doors (goal/G22.3) the list read back, since goal/G33.7 as stackFrameChecks.doors.search (bounded, more) and stackFrameChecks.door (one door); since Andy's "RUN the show"
// (goal/G22.3, 2026-10-13) make takes {gate, endpoint, paths, suites}, and update, remove, run and runState join; stop
// went when the runs became deskVerify's (Andy, 2026-10-13: "every run here should report to deskVerify.").
// SINCE goal/G30.4 the AGENTS family is gone: every server carries its family folder's FS verbs instead (FS.loadFile,
// FS.search ...; introSpector.js), the verb files read through them. So the verbs are compared without the FS set, and
// the FS set is checked to be exactly introSpector's, nothing more.
const FS_VERBS = ['FS.annotateFile', 'FS.deleteFile', 'FS.fileExists', 'FS.getAnnotations', 'FS.loadFile', 'FS.loadJsonValue', 'FS.saveFile', 'FS.saveJsonValue', 'FS.search', 'FS.statFile'];
function verbsOf(tree) { return Object.keys(tree || {}).filter(function (k) { return k.indexOf('FS.') !== 0; }).sort(); }
function familyNamesVerbs(tree) { return Object.keys(tree || {}).filter(function (k) { return k.indexOf('FS.') === 0; }).sort().join(',') === FS_VERBS.join(','); }
// goal/G40.3: one row a write on every list table: item.files.remove, item.suites.add/.remove, and the doors'
// stackFrameChecks.paths.add/.remove/.search and .suites.add/.remove/.search; make and update take {gate, endpoint} only.
// goal/G33.7: items.find, rule.history, session.set, state.get and state.set went; every table has its search.
const VERBS = ['DEBUG', 'DEPENDENCIES', 'agent.state', 'agents.search', 'block', 'block.targets', 'box.release', 'box.take', 'box.write', 'chat.add', 'chat.search', 'check.add', 'check.set', 'claim', 'goal.add', 'item.add', 'item.box', 'item.box.search', 'item.chat', 'item.checks', 'item.checks.search', 'item.claims.search', 'item.delete', 'item.files', 'item.files.add', 'item.files.remove', 'item.files.search', 'item.get', 'item.release', 'item.rename', 'item.status', 'item.suites.add', 'item.suites.remove', 'item.suites.search', 'item.take', 'items.search', 'line.take', 'phase.done', 'phase.may', 'phase.take', 'press', 'profile.get', 'profile.set', 'rule.add', 'rule.draft', 'rule.get', 'rule.version', 'rules.search', 'seen.get', 'seen.set', 'signoff', 'stackFrameChecks.door', 'stackFrameChecks.doors.search', 'stackFrameChecks.make', 'stackFrameChecks.paths.add', 'stackFrameChecks.paths.remove', 'stackFrameChecks.paths.search', 'stackFrameChecks.remove', 'stackFrameChecks.run', 'stackFrameChecks.runState', 'stackFrameChecks.suites.add', 'stackFrameChecks.suites.remove', 'stackFrameChecks.suites.search', 'stackFrameChecks.update', 'subscribe', 'unblock', 'unsubscribe', 'work.open'];

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
  if (tree && verbsOf(tree).join(',') === VERBS.join(',') && familyNamesVerbs(tree)) test.check('api lists exactly ' + VERBS.join(', ') + ', and the family folder\'s FS verbs beside them');
  else test.fail(OWED + 'api answered ' + JSON.stringify(tree));

  // ── T2 ──────────────────────────────────────────────────────────────
  test.subHeading('T2: it keeps desk.db in the state folder it was handed, and nothing else opens it');
  // goal/G33.4: the verbs of the old lines are gone.
  const gone = [];
  if (up) for (const v of ['log.add', 'log.search', 'pending.get']) gone.push(((await ask({ desk: { [v]: {} } })).body || {}).code);
  if (up && gone.every(function (c) { return c === 'no-such-verb'; })) test.check('log.add, log.search and pending.get are no-such-verb (goal/G33.4)');
  else test.fail('goal/G33.4: the old log verbs answered ' + JSON.stringify(gone));
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

  // Seen, voice. goal/G33.7: state.get and state.set went (nothing called them), and seen is one value per item: the
  // arrival time of the newest thing he looked at under it, the group chat's on goal/G0.
  const SEEN = '2026-10-23T05:00:00.000Z';
  const sGone = up ? [await call('state.set', { json: '{}' }), await call('state.get', {})] : [];
  // A write needs its writer (apiAuth/G1.13): his own seen, written as the owner.
  const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskServerTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
  const n1 = up ? await client.ask({ desk: { 'seen.set': { id: 'goal/G0', at: SEEN } } }, ANDY).then(function (r) { return r.body || {}; }) : {};
  const ng = up ? await call('seen.get', { id: 'goal/G0' }) : {};
  if (sGone.length && sGone.every(function (r) { return r.code === 'no-such-verb'; }) && typeof n1.change === 'number' && ng.at === SEEN) {
    test.check('state.get and state.set are no-such-verb; seen of goal/G0 is saved and read back as the time given');
  } else {
    test.fail(OWED + 'state/seen answered ' + JSON.stringify(sGone.concat([n1, ng])));
  }
  // voice.add IS GONE (goal/G2.1 note 8): it appended {text, day} to <state>/voice.jsonl, the hack Andy named;
  // the brain reads his lines through the desk api now, and the vault's own tool keeps his corpus.
  const v = up ? await call('voice.add', { text: 'typed by andy', day: '2026-09-29' }) : {};
  if (v.code === 'no-such-verb' && !fs.existsSync(path.join(state, 'voice.jsonl'))) test.check('voice.add is no-such-verb, and no voice.jsonl is written');
  else test.fail('OWED by goal/G2.1: voice.add answered ' + JSON.stringify(v) + ', file present ' + fs.existsSync(path.join(state, 'voice.jsonl')));

  // Tightened after the mutation run: a seen of an item the desk does not hold is refused too.
  const badSeen = up ? await client.ask({ desk: { 'seen.set': { id: 'goal/G999', at: SEEN } } }, ANDY).then(function (r) { return r.body || {}; }) : {};
  if (badSeen.ok === false) test.check('a seen of no item is refused, by an error');
  else test.fail(OWED + 'a seen of no item answered ' + JSON.stringify(badSeen));

  // It survives its own restart: the node brings it back, desk.db holds.
  await stop(kid);
  kid = start();
  const again = kid ? await waitFor(function () { return ask('api').then(function (r) { return r.body && r.body.desk && r.body.desk.ok !== false; }); }) : false;
  const sAgain = again ? await call('seen.get', { id: 'goal/G0' }) : {};
  if (again && sAgain.at === SEEN) test.check('after a restart its seen is still there');
  else test.fail(OWED + 'after a restart: search ' + again + ', seen ' + JSON.stringify(sAgain));

  // ── T4 ──────────────────────────────────────────────────────────────
  test.subHeading('T4: a known member\'s packet {desk: ...} reaches it');
  let apiDoor = null;
  try { apiDoor = require('../run/spirit/apiDoor.js'); } catch (e) { apiDoor = null; }
  const posted = [];
  const door = apiDoor && apiDoor.createApiDoor({
    servers: client,
    post: function (relay, to, text) { posted.push({ to: to, text: text }); return Promise.resolve({ ok: true }); },
    encode: packet.encode,
    isKnown: function (key) { return key === 'MEMBER'; },
    // apiAuth/G1.2: the door gates members by their grants; this member
    // holds desk whole, so what this suite tests stays its own.
    auth: { pathsOf: function (key) { return key === 'MEMBER' ? ['desk'] : []; } },
    log: function () {},
  });
  // The envelope arrives read, as arrivals.js hands it to a witness (goal/G16.5).
  const ask4 = packet.encode('api', { desk: { 'seen.get': { id: 'goal/G0' } } }).text;
  if (door) await door({ text: ask4, envelope: arrivals.envelopeOf(ask4), fromKey: 'MEMBER', hash: 'H4' });
  await waitFor(function () { return posted.length > 0; }, 4000);
  const r4 = posted[0] ? packet.decode(posted[0].text) : null;
  if (r4 && r4.re === 'H4' && r4.body && r4.body.at === SEEN) test.check('the member\'s packet reached the desk server; its seen came back as an answer to it');
  else test.fail(OWED + 'the member got ' + JSON.stringify(r4));

  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: desk.<verb> on the loopback door reaches it');
  const flat = require('../run/spirit/verbTable.js').createVerbTable().door(client);
  const shared = flat && typeof flat.call === 'function' ? await flat.call('desk.seen.get', { id: 'goal/G0' }) : null;
  if (shared && shared.status === 200 && shared.body && shared.body.at === SEEN) test.check('the flat door /api/spirit runs (door.call(desk.seen.get)) reached the desk server');
  else test.fail(OWED + 'door.call ' + (flat && flat.call ? 'answered ' + JSON.stringify(shared) : 'is missing'));
  await stop(kid);

  // A whole node, planted in a temp home (Andy: "test suites need their own
  // copy of node"): it starts its own desk server, and its verbs by name reach it.
  // A node runs only from a folder named spirit/run.
  const home = path.join(scratch, 'home', 'spirit', 'run');
  plantRun.plantRunTree(home);
  // It starts the desk server only if it includes it (its manifest runs it at home, goal/G30.20).
  require('./tools/runsHome.js')(home, 'process/js/desk');
  const port = await freePort();
  const node = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(node);
  let said = '';
  node.stderr.on('data', function (b) { said = (said + b).slice(-2000); });
  const base = 'http://127.0.0.1:' + port;
  const flatAsk = function (body) {
    return relayRequest(base, 'POST', '/api/spirit', body).then(function (r) {
      let b = null;
      try { b = JSON.parse(r.text); } catch (e) { b = null; }
      return { status: r.status, body: b };
    });
  };
  let whole = null;
  await waitFor(function () {
    return flatAsk({ call: 'desk.seen.get', args: { id: 'goal/G0' } }).then(function (r) { whole = r; return r.status === 200 && r.body && typeof r.body.at === 'string'; });
  }, 15000);
  const listed = await flatAsk({ call: 'api', args: {} }).catch(function () { return null; });
  if (whole && whole.status === 200 && whole.body && typeof whole.body.at === 'string' &&
      listed && listed.body && listed.body.desk && verbsOf(listed.body.desk).join(',') === VERBS.join(',') && familyNamesVerbs(listed.body.desk)) {
    test.check('a planted node started its desk server; the verb api listed its verbs and desk.seen.get answered');
  } else {
    test.fail(OWED + 'desk.seen.get answered ' + JSON.stringify(whole) + ' / api ' + JSON.stringify(listed && listed.body) + (said.trim() ? ' — node said: ' + said.trim().slice(-300) : ''));
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
