'use strict';

// spirit/run/process/js/agent/test/agent.js
// The tests of process/js/agent/agent.js, and of no other module (spec: ./agent.md; goal/G41.1). The server is started
// as the node starts it, on a pipe of the test's own and a scratch --state folder, and asked through the pipe. It is
// started without a job id, so what it publishes reaches no node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));

const DIR = path.join(__dirname, '..');
const SERVER = path.join(DIR, 'agent.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

test.startTest('agent.js: the agent server');

(async function () {
  test.subHeading('its files');
  if (!fs.existsSync(SERVER)) { test.fail('process/js/agent/agent.js is not there'); return; }
  const manifest = readJson(path.join(DIR, 'agent.json')) || {};
  ok(manifest.kind === 'server' && manifest.operated === 'node', 'its manifest says a server the node operates', 'agent.json: ' + short(manifest));
  // Found on his node: with runs [] the node never starts it, so its face app's debug reached nobody.
  ok(Array.isArray(manifest.runs) && manifest.runs.indexOf('home') !== -1, 'its manifest runs it at home, so the node starts it for its face app',
    'agent.json runs ' + short(manifest.runs) + ': the node never starts it');
  let family = null;
  try { family = require(path.join(DIR, 'agent.family', 'api.js')); } catch (e) { family = null; }
  ok(family && family.verbs && family.verbs.debug && family.verbs.debug.on === 'bool', 'its interface declares debug with on, a bool',
    'agent.family/api.js: ' + short(family && family.verbs));
  const described = readJson(path.join(DIR, 'agent.family', 'debug.json'));
  ok(described && typeof described.description === 'string' && described.description && described.request && 'on' in described.request,
    'debug.json describes the verb and its request', 'debug.json: ' + short(described));

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agent-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'agent', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('agent', pipe);
  const env = Object.assign({}, process.env); delete env.SPIRIT_JOB_ID;
  const ask = function (verb, args) { const q = {}; q[verb] = args; return client.ask({ agent: q }, { owner: true, key: 'MCowBQYDK2VwAyEAagentTestOwnerAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function (e) { return { refused: e && (e.code || e.message) }; }); };
  let kid = null;
  const start = async function () {
    kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: env });
    let said = ''; kid.stderr.on('data', function (c) { said = (said + c).slice(-2000); });
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      const r = await ask('DEBUG', {});
      if (r.status === 200 && r.body && r.body.ok !== false) return { up: true };
    }
    return { up: false, said: said };
  };
  const stop = function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); };

  try {
    test.subHeading('it starts on the node\'s pipe and its --state folder');
    const s1 = await start();
    ok(s1.up, 'it starts and answers on its pipe', 'it did not answer: ' + short(s1.said));
    if (!s1.up) return;
    const db = path.join(state, 'agent.db');
    const head = fs.existsSync(db) ? fs.readFileSync(db).subarray(0, 16).toString('latin1') : '';
    ok(head === 'SQLite format 3\u0000', 'agent.db is created in its --state folder, an SQLite database', 'agent.db: ' + (head ? JSON.stringify(head) : 'not there'));
    const d0 = await ask('DEBUG', {});
    ok(d0.body && d0.body.debug === false, 'with no config.json its DEBUG state starts off', 'DEBUG at start: ' + short(d0.body));

    test.subHeading('debug maintains the one DEBUG state');
    const on = await ask('debug', { on: true });
    ok(on.status === 200 && on.body && on.body.debug === true, 'debug {on: true} answers debug true', 'debug on: ' + short(on.body || on));
    const d1 = await ask('DEBUG', {});
    ok(d1.body && d1.body.debug === true, 'the built-in DEBUG verb reads the same state: it answers true', 'DEBUG after debug on: ' + short(d1.body));
    const cfg1 = readJson(path.join(state, 'config.json'));
    ok(cfg1 && cfg1.debug === true, 'config.json in its --state folder holds debug true', 'config.json: ' + short(cfg1));
    await ask('DEBUG', { on: false });
    const d2 = await ask('DEBUG', {});
    ok(d2.body && d2.body.debug === false, 'and the other way round: DEBUG off is the state debug maintains', 'DEBUG: ' + short(d2.body));
    const off = await ask('debug', { on: false });
    const cfg2 = readJson(path.join(state, 'config.json'));
    ok(off.body && off.body.debug === false && cfg2 && cfg2.debug === false, 'debug {on: false} answers false and writes false', 'debug off: ' + short(off.body) + ', config ' + short(cfg2));
    const bad = await ask('debug', { on: 'yes' });
    const cfg3 = readJson(path.join(state, 'config.json'));
    const d3 = await ask('DEBUG', {});
    ok(!(bad.status === 200 && bad.body && bad.body.ok !== false) && cfg3 && cfg3.debug === false && d3.body && d3.body.debug === false,
      'a debug whose on is not true or false is refused, and changes nothing', 'debug "yes": ' + short(bad.body || bad) + ', config ' + short(cfg3));

    test.subHeading('the state persists across restarts');
    await ask('debug', { on: true });
    await stop();
    const s2 = await start();
    const d4 = s2.up ? await ask('DEBUG', {}) : {};
    ok(s2.up && d4.body && d4.body.debug === true, 'started again on the same --state, its DEBUG state is what it was: on', 'after the restart: ' + short(d4.body || s2.said));
  } finally { await stop(); }

  test.subHeading('it streams its state');
  const code = fs.readFileSync(SERVER, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(/serve\([^]*publisher\s*:/.test(code) && /bootstrap/.test(code), 'it serves with a publisher whose bootstrap hands a subscriber its state',
    'no publisher with a bootstrap in agent.js');
  const debugAt = code.search(/\bdebug\s*:\s*\{/);
  ok(debugAt !== -1 && /publish\(/.test(code.slice(debugAt, debugAt + 1500)), 'its debug verb publishes the new state', 'debug does not publish');
  ok(/agent\s*:\s*\{\s*debug\b/.test(code), 'what it streams is { agent: { debug } }', 'no { agent: { debug } } in agent.js');
  ok(!/['"]state['"]\s*:\s*\{|\bstate\s*:\s*\{\s*request/.test(code), 'there is no read verb: the page reads the state from the stream', 'agent.js serves a state verb');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
