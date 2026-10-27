'use strict';

// spirit/run/process/js/desk/test/deskLoop.js
// The tests of process/js/desk/deskLoop.js, and of no other module (spec: ./deskLoop.md; goal/G41.11). The loop runs
// in this process as it runs for gemma, with child_process.spawn standing in for every program it starts: its
// listener (deskAgentEar.js <port>), its asks of the desk through deskAgentEar, and the model's command. Each start is
// kept, and answered by the test's script of what each program prints and how it ends. Its 10 s pause after a refused
// listen is shortened. Its usage is run as its own process. No node, no model, no port.

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const childProcess = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskLoop.js');
const EAR = path.join(__dirname, '..', 'deskAgentEar.js');
const MANUAL = fs.readFileSync(path.join(__dirname, '..', 'deskLoopManual.md'), 'utf8').trim();

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };
const sleep = function (ms) { return new Promise(function (r) { realSetTimeout(r, ms); }); };
const realSetTimeout = setTimeout;

const COMMAND = 'C:/fake/opencode.exe';
const ARGS = ['run', '--format', 'json', '--session', 's1'];
const PORT = '11111';
const ev = function (o) { return JSON.stringify(o); };
const line = function (who, verb, body) { return 'DESK ' + who + ' ' + verb + ' ' + JSON.stringify(body); };

// ── THE PROGRAMS, SCRIPTED ───────────────────────────────────────────
// Every start is kept: { file, argv, opts, kind }. listens: what each listen prints and its code, in turn (null: a
// listen that never ends); nicks: what each profile.get prints; models: what each run of the command prints;
// posts: the code of each chat.add.
const started = [];
const script = { listens: [], nicks: [], models: [], posts: [] };
function kid(out, code, failWith) {
  const k = new EventEmitter();
  k.stdout = new EventEmitter();
  realSetTimeout(function () {
    if (failWith) { k.emit('error', new Error(failWith)); return; }
    if (out) String(out).match(/[\s\S]{1,40}/g).forEach(function (chunk) { k.stdout.emit('data', Buffer.from(chunk)); });
    k.emit('close', code);
  }, 1);
  return k;
}
childProcess.spawn = function (file, argv, opts) {
  const s = { file: file, argv: argv, opts: opts };
  started.push(s);
  if (file === process.execPath && argv[0] === EAR && argv.length === 2) {
    s.kind = 'listen';
    const next = script.listens.shift();
    if (!next) { const k = new EventEmitter(); k.stdout = new EventEmitter(); return k; }
    return kid(next.out, next.code);
  }
  if (file === process.execPath && argv[0] === EAR && argv[2] === 'profile.get') { s.kind = 'nick'; return kid(script.nicks.shift() || '{}', 0); }
  if (file === process.execPath && argv[0] === EAR && argv[2] === 'chat.add') { const c = script.posts.shift() || 0; s.kind = 'post'; return kid(c ? 'refused: not yours' : '{"ok":true}', c); }
  if (file === COMMAND) { s.kind = 'model'; const m = script.models.shift() || { out: '', code: 0 }; return kid(m.out, m.code, m.failWith); }
  s.kind = 'other';
  return kid('', 0);
};
const of = function (kind) { return started.filter(function (s) { return s.kind === kind; }); };

// The pause after a refused listen, shortened; everything else as it was.
global.setTimeout = function (fn, ms) { const rest = Array.prototype.slice.call(arguments, 2); return realSetTimeout.apply(null, [fn, ms === 10000 ? 5 : ms].concat(rest)); };
const said = [];
const realError = console.error;
console.error = function () { said.push(Array.prototype.slice.call(arguments).join(' ')); };
const restore = function () { console.error = realError; global.setTimeout = realSetTimeout; };

async function until(cond, ms) { const t = Date.now(); while (!cond() && Date.now() - t < (ms || 5000)) await sleep(5); return cond(); }

test.startTest('deskLoop.js: the driver for a model with no harness');

(async function () {
  test.subHeading('its usage');
  const u1 = childProcess.spawnSync(process.execPath, [FILE], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const u2 = childProcess.spawnSync(process.execPath, [FILE, PORT], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const u3 = childProcess.spawnSync(process.execPath, [FILE, 'abc', COMMAND], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const USAGE = 'usage: node deskLoop.js <port of the agent\'s own node> <command> [args...]';
  ok([u1, u2, u3].every(function (u) { return u.status === 2 && String(u.stderr).trim() === USAGE; }), 'no port, no command, or a port that is no number: exit 2 with its usage', short([u1.status, u2.status, u3.status, String(u1.stderr)]));

  // The script of one run of the loop, in the order it will meet it.
  const mine1 = line('andy', 'chat.add', { id: 'goal/G1.2', text: 'Gemma: what is red?' });
  const mine2 = line('andy', 'chat.add', { id: 'goal/G1.3', text: 'gemma: say nothing' });
  const mine3 = line('andy', 'chat.add', { id: 'goal/G1.4', text: 'GEMMA: no stop' });
  const mine4 = line('andy', 'chat.add', { id: 'goal/G1.5', text: 'gemma: post fails' });
  const others = [line('andy', 'chat.add', { id: 'goal/G1.6', text: 'cw: not for gemma' }), line('wsl-claude', 'chat.add', { id: 'goal/G1.7', text: 'gemma: from an agent' }),
    line('andy', 'box.write', { id: 'goal/G1.8', text: 'gemma: a box' }), 'DESK andy chat.add {not json}', 'some other line', line('andy', 'chat.add', { text: 'gemma: no id' }),
    line('andy', 'chat.add', { id: 'goal/G1.9', text: 'gemmas: a longer nick' })];
  script.listens.push({ out: 'deskAgentEar: unblocked', code: 1 }, { out: '', code: 0 }, { out: [mine1, others[0], others[1], mine2, others[2], others[3], others[4], others[5], others[6], mine3, mine4].join('\n') + '\n', code: 0 },
    { out: mine1 + '\n', code: 0 });
  script.nicks.push('{"ok":true,"nick":"Gemma"}', '{"ok":true,"nick":""}');
  script.models.push(
    { out: [ev({ type: 'step_start' }), ev({ type: 'tool_use', part: { tool: 'bash', state: { input: { command: 'ls' } } } }), ev({ type: 'text', part: { text: 'thinking aloud' } }),
      ev({ type: 'step_finish', part: { reason: 'tool-calls' } }), 'not json at all', ev({ type: 'step_start' }), ev({ type: 'text', part: { text: 'my reasoning<channel|>' } }),
      ev({ type: 'text', part: { text: '  Red is the failing test.  ' } }), ev({ type: 'step_finish', part: { reason: 'stop' } })].join('\n') + '\n', code: 0 },
    { out: [ev({ type: 'step_start' }), ev({ type: 'step_finish', part: { reason: 'stop' } })].join('\n') + '\n', code: 3 },
    { out: [ev({ type: 'step_start' }), ev({ type: 'text', part: { text: 'first step' } }), ev({ type: 'step_finish', part: { reason: 'tool-calls' } }),
      ev({ type: 'step_start' }), ev({ type: 'text', part: { text: 'last step' } }), ev({ type: 'step_finish', part: { reason: 'length' } })].join('\n') + '\n', code: 0 },
    { out: [ev({ type: 'text', part: { text: 'an answer' } }), ev({ type: 'step_finish', part: { reason: 'stop' } })].join('\n') + '\n', code: 0 });
  script.posts.push(0, 0, 1);

  process.argv = [process.argv[0], FILE, PORT, COMMAND].concat(ARGS);
  try { require(FILE); } catch (e) { test.fail('deskLoop.js threw as it loaded: ' + e.message); }
  await until(function () { return of('listen').length >= 5; }, 15000);
  await settle();
  const L = of('listen');
  const N = of('nick');
  const M = of('model');
  const P = of('post');

  test.subHeading('it listens through its own deskAgentEar, and listens again');
  ok(L.length >= 5 && L.every(function (s) { return s.argv[0] === EAR && s.argv[1] === PORT; }), 'each listen is deskAgentEar.js <port>, run by this node.js', 'listens ' + short(L.map(function (s) { return s.argv; })));
  ok(L.every(function (s) { return s.opts && s.opts.stdio && s.opts.stdio[0] === 'ignore' && s.opts.stdio[1] === 'pipe' && s.opts.stdio[2] === 'inherit' && s.opts.windowsHide === true; }), 'its stdout read, its stderr to ours, no window', 'opts ' + short(L[0] && L[0].opts));
  ok(said.some(function (s) { return s === 'deskLoop: the listener ended 1: deskAgentEar: unblocked; listening again in 10 s'; }), 'a refused listen is said, with what it printed, and waited out', 'said ' + short(said));
  ok(said.some(function (s) { return s === 'deskLoop: the listener ended 0; listening again in 10 s'; }), 'a listen that printed nothing is waited out too', 'said ' + short(said));
  ok(N.length === 2 && N[0].argv.slice(1).join(' ') === PORT + ' profile.get {"agent":""}', 'each time lines come, the nick is read from the desk: profile.get {agent: \'\'}, through deskAgentEar', 'nick asks ' + short(N.map(function (s) { return s.argv; })));

  test.subHeading('only his lines for its nick are handed over, one at a time');
  ok(M.length === 4, 'four of the lines are its: his chat.add starting "<nick>:", the nick read case-blind', 'model runs: ' + M.length + ' ' + short(M.map(function (s) { return s.argv[s.argv.length - 1].slice(-60); })));
  const last = function (s) { return s.argv[s.argv.length - 1]; };
  ok(M.length >= 1 && M[0].argv.slice(0, ARGS.length).join(' ') === ARGS.join(' ') && M[0].argv.length === ARGS.length + 1, 'the command runs with its args plus one more', 'argv ' + short(M[0] && M[0].argv.slice(0, -1)));
  ok(M.length >= 1 && last(M[0]) === MANUAL + '\n\n' + mine1, 'that one: deskLoopManual.md, a blank line, and the line as deskAgentEar printed it', 'handed ' + short(M[0] && last(M[0]).slice(-200)));
  ok(M.map(last).every(function (a) { return [mine1, mine2, mine3, mine4].some(function (m) { return a.slice(-m.length) === m; }); }), 'another agent\'s line, a box write, a line for another nick, one with no id or no json: none handed over', 'handed ' + short(M.map(function (s) { return last(s).slice(-80); })));
  ok(said.some(function (s) { return s === 'deskLoop: handing a line under goal/G1.2 to opencode.exe'; }), 'each hand-over is said by its item and the command\'s name', 'said ' + short(said));

  test.subHeading('the final answer is posted under the line\'s item, never its thinking');
  ok(P.length === 3, 'three answers are posted (one run gave none)', 'posts ' + short(P.map(function (s) { return s.argv.slice(2); })));
  const body = function (s) { return JSON.parse(s.argv[3]); };
  ok(P.length >= 1 && P[0].argv[2] === 'chat.add' && body(P[0]).id === 'goal/G1.2' && body(P[0]).text === 'Red is the failing test.', 'the stop step\'s text, after the leaked reasoning (<channel|>), trimmed, under the line\'s item', 'posted ' + short(P[0] && P[0].argv));
  ok(P.length >= 2 && body(P[1]).id === 'goal/G1.4' && body(P[1]).text === 'last step', 'with no stop, the last step\'s text', 'posted ' + short(P[1] && P[1].argv));
  ok(said.some(function (s) { return s === 'deskLoop: opencode.exe ended 3 with no answer to post'; }), 'a run with no text posts nothing, and says so', 'said ' + short(said));
  ok(said.some(function (s) { return s === 'deskLoop: the answer was not posted under goal/G1.5: refused: not yours'; }), 'a post refused is said, with why', 'said ' + short(said));
  ok(said.some(function (s) { return s === '  [bash] {"command":"ls"}'; }) && said.some(function (s) { return s === '  thinking aloud'; }), 'its window sees each event as it comes: a tool by its input, a text by its words', 'said ' + short(said));
  ok(P.every(function (s) { return body(s).text.indexOf('thinking aloud') === -1 && body(s).text.indexOf('my reasoning') === -1; }), 'and Desk sees none of it', 'posted ' + short(P.map(body)));

  test.subHeading('no nick: nothing is its');
  ok(N.length === 2 && M.length === 4, 'with the nick \'\' the line for gemma is passed over, and it listens again', 'model runs ' + M.length + ', nick asks ' + N.length);
  ok(L.length === 5, 'it never ends by itself: a fifth listen is under way', 'listens ' + L.length);
}()).then(function () { restore(); test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { restore(); test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
