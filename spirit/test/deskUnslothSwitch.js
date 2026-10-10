'use strict';

// spirit/test/deskUnslothSwitch.js
// goal/G14.2: a connect/disconnect switch for Levant, visible in desk. Written first, red on today's code
// (cb987f3a); claude-windows wrote it and builds it (Andy, 2026-10-10: "how many agents are there? ONE. you do it
// all"). The rulings are the item's box, Andy's of 2026-10-10:
//
//   "then one item for the hello-world state: I changed my mind on it's feature: it will be a connect/disconnect
//    switch for Levant to be visible in desk."
//   "this way i can turn it off, so i don't have to waive for you to claim both reds and code."
//   "This will be visible in the brand new deskUnslothRemote shell-app, this is it's hello world and can
//    simultaneously run un the puppet or on my own node."
//
// WHAT IS ASSERTED (the box, SHAPE 1 to 3 and TESTS)
//   1. deskUnsloth declares two verbs on its pipe: connect {on} answering {connected} and state {} answering
//      {connected, persona, model}. It starts connected, as today.
//   2. connect off: the asks for next lines stop within a second, ONE signoff goes to the desk (through its node's
//      deskClient.desk, the way every desk word of its goes), and state says connected false. The process stays up.
//   3. connect on: the asks resume, state says true, and no second signoff is sent; the backlog handed over before
//      the first empty answer is read and not answered, as at a start.
//   4. the shell app, shell/deskUnslothRemote: its manifest beside its script, and ONE function building the ask
//      from the target: for this node a jobs.api ask of deskUnsloth; for a puppet an owner.command carrying that
//      same jobs.api ask, nothing else different. The same function unwraps both answers to the one deskUnsloth
//      gave.
// Not asserted, the builder's: the page's layout and words; where the puppet list in the app's folder is read from
// (the box: "a small list in the app's own folder for now").
//
// THE FAKE is the node: a loopback door answering jobs.api for deskClient alone (next, and desk), as
// deskUnslothContext.js fakes it; it records every ask. The model is never called: no line is addressed to the
// persona here. rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.2: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const APP_DIR = path.join(RUN, 'shell', 'deskUnslothRemote');
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-Test-GGUF', contextLimit: 375, answerTokens: 25, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

// ── THE FAKE NODE: jobs.api for deskClient, recorded ─────────────────────
const nodeAsks = [];     // every jobs.api body the agent sent its node
const deskWords = [];    // every deskClient.desk {verb, args} the agent sent
let nextQueue = [];      // answers to next, each a lines array; an empty queue answers no lines
let nextCount = 0;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    nodeAsks.push(b);
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node answers jobs.api for deskClient alone' });
    if (dc.next) {
      nextCount++;
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      deskWords.push({ verb: String(dc.desk.verb || ''), args: args });
      if (dc.desk.verb === 'signoff') return answer(200, { change: 100 + deskWords.length });
      if (dc.desk.verb === 'AGENTS') return answer(200, { text: 'rules' });
      return answer(404, { ok: false, code: 'no-such-item', error: 'the fake desk holds nothing' });
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});
function signoffs() { return deskWords.filter(function (w) { return w.verb === 'signoff'; }).length; }

// ── THE AGENT, started as the node starts a process: {} --pipe --state ───
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-switch-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskUnsloth', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() {
  return new Promise(function (r) {
    const k = kid;
    if (!k || out.code !== null) return r();
    k.once('exit', function () { r(); });
    try { k.disconnect(); } catch (e) { /* no channel */ }
    setTimeout(function () { try { k.kill(); } catch (e) { /* gone */ } }, 500);
    setTimeout(r, 3000);
  });
}
async function doorUp(client, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await client.ask('api');
      if (r && r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return r.body.deskUnsloth;
    } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}

// ── THE SHELL APP, loaded as the shell would, with a fake shell ─────────
// The script's top-level functions become the context's globals, as in a page; activateApp is caught, not run.
function loadApp() {
  const script = path.join(APP_DIR, 'deskUnslothRemote.js');
  if (!fs.existsSync(script)) return null;
  const ctx = { app: null, spirit: { shell: { activateApp: function (a) { ctx.app = a; } } }, document: {}, window: {}, console: console };
  ctx.window = ctx;
  try { vm.runInNewContext(fs.readFileSync(script, 'utf8'), ctx, { filename: script }); } catch (e) { return { error: String(e && e.message) }; }
  return ctx;
}

test.startTest('goal/G14.2: a connect/disconnect switch for Levant, visible in desk');

async function suite() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'test-key', url: 'http://127.0.0.1:1/v1' }, null, 1));

  test.subHeading('1. the two verbs, and it starts connected');
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskUnsloth never answered api on its pipe (' + (out.code === null ? 'running' : 'exited ' + out.code) + ', ' + JSON.stringify((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  const verbs = Object.keys(tree).sort();
  if (verbs.indexOf('connect') !== -1 && verbs.indexOf('state') !== -1) test.check('its api declares connect and state: ' + verbs.join(', '));
  else { test.fail(OWED + 'the verb tree reads ' + verbs.join(', ')); return; }
  const s0 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  if (s0.connected === true && s0.persona === CONFIGURATION.persona && s0.model === CONFIGURATION.model) test.check('state at start: connected true, the persona and the model of its configuration');
  else test.fail(OWED + 'state at start answered ' + short(s0));
  await until(function () { return nextCount >= 2; }, 5000);
  if (nextCount >= 2) test.check('it is asking its node for next lines, as today');
  else test.fail(OWED + 'it asked next ' + nextCount + ' time(s) in 5 s');

  test.subHeading('2. connect off: the asks stop, one signoff, state false, the process stays up');
  const off = (await client.ask({ deskUnsloth: { connect: { on: false } } })).body || {};
  if (off.connected === false) test.check('connect {on: false} answers {connected: false}');
  else test.fail(OWED + 'connect off answered ' + short(off));
  await sleep(1000);
  const settled = nextCount;
  await sleep(1000);
  if (nextCount === settled) test.check('the asks for next lines stopped within a second (' + settled + ' asked, none in the second after)');
  else test.fail(OWED + 'still asking next after disconnect: ' + settled + ' -> ' + nextCount);
  if (signoffs() === 1) test.check('one signoff went to the desk, through its node\'s deskClient.desk');
  else test.fail(OWED + signoffs() + ' signoff(s) sent; desk words ' + short(deskWords));
  const s1 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  if (s1.connected === false && s1.persona === CONFIGURATION.persona) test.check('state says connected false, the persona still named');
  else test.fail(OWED + 'state after disconnect answered ' + short(s1));
  if (out.code === null) test.check('the process stays up: stopping the job is not this switch');
  else test.fail(OWED + 'the process exited ' + out.code + ' on disconnect');
  const again = (await client.ask({ deskUnsloth: { connect: { on: false } } })).body || {};
  await sleep(300);
  if (again.connected === false && signoffs() === 1) test.check('connect off while off is answered false and sends no second signoff');
  else test.fail(OWED + 'a second connect off: ' + short(again) + ', signoffs ' + signoffs());

  test.subHeading('3. connect on: the asks resume at the present, state true, no second signoff');
  nextQueue = [['DESK andy chat.add ' + JSON.stringify({ id: 'sw/G1', text: 'levant: a line from while it was off' })]];
  const before = nextCount;
  const on = (await client.ask({ deskUnsloth: { connect: { on: true } } })).body || {};
  if (on.connected === true) test.check('connect {on: true} answers {connected: true}');
  else test.fail(OWED + 'connect on answered ' + short(on));
  await until(function () { return nextCount >= before + 3; }, 5000);
  const s2 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  if (nextCount >= before + 3 && s2.connected === true) test.check('the asks for next lines resumed (' + before + ' -> ' + nextCount + ') and state says connected true');
  else test.fail(OWED + 'after connect on: asks ' + before + ' -> ' + nextCount + ', state ' + short(s2));
  await sleep(500);
  const answered = deskWords.filter(function (w) { return w.verb === 'chat.add' || w.verb === 'item.get'; }).length;
  if (signoffs() === 1 && answered === 0) test.check('no second signoff, and the line handed over before the first empty answer was the backlog: read, not answered');
  else test.fail(OWED + 'signoffs ' + signoffs() + ', desk asks for the backlog line ' + answered);
  const onAgain = (await client.ask({ deskUnsloth: { connect: { on: true } } })).body || {};
  if (onAgain.connected === true && nextCount > 0) test.check('connect on while on is answered true and starts no second loop');
  else test.fail(OWED + 'a second connect on: ' + short(onAgain));

  test.subHeading('4. the shell app: a manifest, and one function from target to ask');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'deskUnslothRemote.json'), 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.name && manifest.description && manifest.icon) test.check('shell/deskUnslothRemote/deskUnslothRemote.json names the app: ' + manifest.name);
  else test.fail(OWED + 'no manifest at shell/deskUnslothRemote/deskUnslothRemote.json with name, description and icon');
  const ctx = loadApp();
  if (!ctx || ctx.error) { test.fail(OWED + 'shell/deskUnslothRemote/deskUnslothRemote.js ' + (ctx ? 'failed to load: ' + ctx.error : 'does not exist')); return; }
  if (ctx.app && typeof ctx.app.mount === 'function') test.check('the script activates an app with a mount');
  else test.fail(OWED + 'the script activated ' + short(ctx.app));
  const askFor = ctx.deskUnslothRemoteAskFor;
  if (typeof askFor !== 'function') { test.fail(OWED + 'no deskUnslothRemoteAskFor(target, verb, args) in the script'); return; }
  const KEY = 'MCowBQYDK2VwAyEAZQ/IHHn57kdPt0Vf1wZsAJoAMivrFUEN3co7yzq9ki0=';
  const local = askFor({ kind: 'node' }, 'connect', { on: false });
  const remote = askFor({ kind: 'puppet', key: KEY }, 'connect', { on: false });
  const want = { ask: { deskUnsloth: { connect: { on: false } } } };
  if (local && local.verb === 'jobs.api' && JSON.stringify(local.ask) === JSON.stringify(want.ask)) test.check('for this node the ask is jobs.api with deskUnsloth connect {on: false}');
  else test.fail(OWED + 'the local ask is ' + short(local));
  if (remote && remote.verb === 'owner.command' && remote.to === KEY && remote.command === 'jobs.api' && JSON.stringify(remote.body) === JSON.stringify(want)) test.check('for the puppet the ask is owner.command to its key, carrying that same jobs.api ask as the command\'s body');
  else test.fail(OWED + 'the puppet ask is ' + short(remote));
  const unwrap = ctx.deskUnslothRemoteAnswerOf;
  if (typeof unwrap !== 'function') { test.fail(OWED + 'no deskUnslothRemoteAnswerOf(target, answer) in the script'); return; }
  const said = { connected: false, persona: 'Levant', model: 'm' };
  const a1 = unwrap({ kind: 'node' }, { status: 200, body: said });
  const a2 = unwrap({ kind: 'puppet', key: KEY }, { status: 200, body: { hash: 'h', verb: 'jobs.api', ok: true, status: 200, body: said } });
  const a3 = unwrap({ kind: 'puppet', key: KEY }, { status: 504, body: { ok: false, status: 504, code: 'no-reply-from-puppet', error: 'the puppet did not answer in time' } });
  if (JSON.stringify(a1) === JSON.stringify(said) && JSON.stringify(a2) === JSON.stringify(said)) test.check('the same function hands back deskUnsloth\'s own answer from both: the node\'s body, and the body inside the puppet\'s answer');
  else test.fail(OWED + 'unwrapped ' + short(a1) + ' and ' + short(a2));
  if (a3 && a3.ok === false && a3.code === 'no-reply-from-puppet') test.check('a refusal on the way to the puppet comes back as the refusal, by name');
  else test.fail(OWED + 'the refusal came back as ' + short(a3));
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
