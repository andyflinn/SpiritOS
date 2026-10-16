'use strict';

// spirit/test/deskAgentCommandJob.js
// goal/G23.8, the long path. A deskAgent verb answers within 12 s (appClient DOOR_WAIT_MS), so command.run is a job
// (option B, recorded in the box): it waits about ten seconds for the command, and a command still running answers
// {id, running: true}; command.result {id} answers the same reply until running is false. The timeout runs on the
// command, never on the answer. deskAgentCommand.js holds the short path.
//
// WHAT IS ASSERTED
//   1. command.result.json: request id, with a description; command.run.json tells the model to call command_result.
//   2. a command of ~14 s answers {id, running: true} within the door's 12 s; command.result answers running while it
//      runs, then running false with its exit (4) and its whole output.
//   3. an unknown id is refused, saying why.
//   4. a command running as a job past its timeoutMs (12000) ends timedOut, its process gone.
// rule/11: through testSupport only; its own folders and ports; never 65432. Only the PIDs this suite's commands print
// are ever killed, and only when the verb left them alive.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent');
const AGENT = path.join(DIR, 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

test.startTest('goal/G23.8: a long command runs as a job, asked with command.result');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothcommandjob-'));
const repo = path.join(scratch, 'clone');

let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
const leftAlive = [];
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return { status: r.status, body: r.body || {} }; }, function (e) { return { status: 0, body: { ok: false, error: String(e) } }; }); };
async function resultUntilDone(id, ms) {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await ask('command.result', { id: id });
    seen.push(r.body);
    if (r.body.ok === false || r.body.running === false) break;
    await sleep(500);
  }
  return seen;
}

async function suite() {
  test.subHeading('1. the verb files');
  let res = null, run = null;
  try { res = JSON.parse(fs.readFileSync(path.join(DIR, 'command.result.json'), 'utf8')); } catch (e) { res = null; }
  try { run = JSON.parse(fs.readFileSync(path.join(DIR, 'command.run.json'), 'utf8')); } catch (e) { run = null; }
  if (res && JSON.stringify(Object.keys(res.request || {})) === '["id"]' && String(res.description || '').length) test.check('command.result.json: request id, with a description');
  else test.fail('command.result.json reads ' + short(res));
  if (run && /command_result/.test(String(run.description))) test.check('command.run.json tells the model to call command_result while it runs');
  else test.fail('command.run.json does not name command_result: ' + short(run && run.description));

  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: repo }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }

  test.subHeading('2. a command of ~14 s: running, then done');
  const t0 = Date.now();
  const r1 = await ask('command.run', { command: 'node -e "console.log(\'START\'); setTimeout(function () { console.log(\'FINISH\'); process.exit(4); }, 14000)"', timeoutMs: 30000 });
  const took = Date.now() - t0;
  if (r1.body.running === true && typeof r1.body.id === 'string' && r1.body.id && took < 12000 && r1.body.timedOut === false) test.check('answered after ' + took + ' ms: {id: ' + r1.body.id + ', running: true}');
  else test.fail('a 14 s command answered after ' + took + ' ms: ' + r1.status + ' ' + short(r1.body));
  if (r1.body.id) {
    const seen = await resultUntilDone(r1.body.id, 15000);
    const last = seen[seen.length - 1] || {};
    if (seen.length > 1 && seen[0].running === true) test.check('command.result answered running true while it ran');
    else test.fail('command.result while running answered ' + short(seen[0]));
    if (last.running === false && last.exit === 4 && /START/.test(String(last.output)) && /FINISH/.test(String(last.output)) && last.timedOut === false && last.cut === false) test.check('then running false, exit 4, START and FINISH in its output');
    else test.fail('command.result at the end answered ' + short(last));
  }

  test.subHeading('3. an unknown id');
  const r2 = await ask('command.result', { id: 'no-such-command' });
  if (r2.body.ok === false && r2.body.code !== 'no-such-verb' && /no-such-command|unknown/.test(String((r2.body.extra && r2.body.extra.why) || ''))) test.check('refused: ' + r2.body.extra.why);
  else test.fail('an unknown id answered ' + r2.status + ' ' + short(r2.body));

  test.subHeading('4. a job past its timeout is stopped');
  const r3 = await ask('command.run', { command: 'node -e "console.log(\'PID \' + process.pid); setTimeout(function () {}, 60000)"', timeoutMs: 12000 });
  const pid = Number((/PID (\d+)/.exec(String(r3.body.output || '')) || [])[1]);
  if (r3.body.running === true && r3.body.id) test.check('it runs as a job: ' + r3.body.id + (pid ? ', its PID ' + pid : ''));
  else test.fail('a command with timeoutMs 12000 answered ' + short(r3.body));
  const seen3 = r3.body.id ? await resultUntilDone(r3.body.id, 10000) : [];
  const last3 = seen3[seen3.length - 1] || {};
  const pid3 = pid || Number((/PID (\d+)/.exec(String(last3.output || '')) || [])[1]);
  await sleep(500);
  if (last3.running === false && last3.timedOut === true) test.check('it ended timedOut');
  else test.fail('past its timeout command.result answered ' + short(last3));
  if (pid3 > 0 && !alive(pid3)) test.check('its process (' + pid3 + ') is gone');
  else { test.fail('the timed-out job\'s process: ' + (pid3 > 0 ? pid3 + ' is still alive' : 'no PID seen')); if (pid3 > 0) leftAlive.push(pid3); }
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  leftAlive.forEach(function (pid) { try { process.kill(pid); } catch (e) { /* gone */ } });
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
