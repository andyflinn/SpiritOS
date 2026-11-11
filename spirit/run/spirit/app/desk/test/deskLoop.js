'use strict';

// spirit/run/spirit/app/desk/test/deskLoop.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: readTake.
// The tests of spirit/app/desk/deskLoop.js, and of no other module (spec: ./deskLoop.md; goal/G41.11). The loop runs
// in this process as it runs for gemma, with child_process.spawn standing in for every program it starts: its
// listener (deskAgentEar.js <port>), its asks of the desk through deskAgentEar, and the model's command. Each start is
// kept, and answered by the test's script of what each program prints and how it ends. Its 10 s pause after a refused
// listen is shortened. Its usage is run as its own process. No node, no model, no port.

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const childProcess = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskLoop.js');
const EAR = path.join(__dirname, '..', 'deskAgentEar.js');
const MANUAL = fs.readFileSync(path.join(__dirname, '..', 'deskLoopManual.md'), 'utf8').trim();

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
// The script of one run of the loop, in the order it will meet it.
const mine1 = line('andy', 'chat.add', { id: 'goal/G1.2', text: 'Gemma: what is red?' });
const mine2 = line('andy', 'chat.add', { id: 'goal/G1.3', text: 'gemma: say nothing' });
const mine3 = line('andy', 'chat.add', { id: 'goal/G1.4', text: 'GEMMA: no stop' });
const mine4 = line('andy', 'chat.add', { id: 'goal/G1.5', text: 'gemma: post fails' });
const others = [line('andy', 'chat.add', { id: 'goal/G1.6', text: 'cw: not for gemma' }), line('wsl-claude', 'chat.add', { id: 'goal/G1.7', text: 'gemma: from an agent' }),
  line('andy', 'box.write', { id: 'goal/G1.8', text: 'gemma: a box' }), 'DESK andy chat.add {not json}', 'some other line', line('andy', 'chat.add', { text: 'gemma: no id' }),
  line('andy', 'chat.add', { id: 'goal/G1.9', text: 'gemmas: a longer nick' })];
const last = function (s) { return s.argv[s.argv.length - 1]; };
const body = function (s) { return JSON.parse(s.argv[3]); };
// What the run of the loop started, kept by the world test for the tests after it.
const W = {};
test.after(function () { restore(); });

// its usage
test.run('no port, no command, or a port that is no number: exit 2 with its usage', 0.2, function () {
  const u1 = childProcess.spawnSync(process.execPath, [FILE], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const u2 = childProcess.spawnSync(process.execPath, [FILE, PORT], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const u3 = childProcess.spawnSync(process.execPath, [FILE, 'abc', COMMAND], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const USAGE = 'usage: node deskLoop.js <port of the agent\'s own node> <command> [args...]';
  return ([u1, u2, u3].every(function (u) { return u.status === 2 && String(u.stderr).trim() === USAGE; })) ? true : short([u1.status, u2.status, u3.status, String(u1.stderr)]);
}, 1000);

test.run('the world: deskLoop.js loads and runs the script of its programs', 0.2, async function () {
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
  try { require(FILE); } catch (e) { return 'deskLoop.js threw as it loaded: ' + e.message; }
  await until(function () { return of('listen').length >= 5; }, 15000);
  await settle();
  W.L = of('listen');
  W.N = of('nick');
  W.M = of('model');
  W.P = of('post');
  return true;
}, 1000);


// it listens through its own deskAgentEar, and listens again
test.run('each listen is deskAgentEar.js <port>, run by this node.js', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (L.length >= 5 && L.every(function (s) { return s.argv[0] === EAR && s.argv[1] === PORT; })) ? true : 'listens ' + short(L.map(function (s) { return s.argv; }));
}, 1000);
test.run('its stdout read, its stderr to ours, no window', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (L.every(function (s) { return s.opts && s.opts.stdio && s.opts.stdio[0] === 'ignore' && s.opts.stdio[1] === 'pipe' && s.opts.stdio[2] === 'inherit' && s.opts.windowsHide === true; })) ? true : 'opts ' + short(L[0] && L[0].opts);
}, 1000);
test.run('a refused listen is said, with what it printed, and waited out', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === 'deskLoop: the listener ended 1: deskAgentEar: unblocked; listening again in 10 s'; })) ? true : 'said ' + short(said);
}, 1000);
test.run('a listen that printed nothing is waited out too', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === 'deskLoop: the listener ended 0; listening again in 10 s'; })) ? true : 'said ' + short(said);
}, 1000);
test.run('each time lines come, the nick is read from the desk: profile.get {agent: \'\'}, through deskAgentEar', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (N.length === 2 && N[0].argv.slice(1).join(' ') === PORT + ' profile.get {"agent":""}') ? true : 'nick asks ' + short(N.map(function (s) { return s.argv; }));
}, 1000);


// only his lines for its nick are handed over, one at a time
test.run('four of the lines are its: his chat.add starting "<nick>:", the nick read case-blind', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (M.length === 4) ? true : 'model runs: ' + M.length + ' ' + short(M.map(function (s) { return s.argv[s.argv.length - 1].slice(-60); }));
}, 1000);
test.run('the command runs with its args plus one more', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (M.length >= 1 && M[0].argv.slice(0, ARGS.length).join(' ') === ARGS.join(' ') && M[0].argv.length === ARGS.length + 1) ? true : 'argv ' + short(M[0] && M[0].argv.slice(0, -1));
}, 1000);
test.run('that one: deskLoopManual.md, a blank line, and the line as deskAgentEar printed it', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (M.length >= 1 && last(M[0]) === MANUAL + '\n\n' + mine1) ? true : 'handed ' + short(M[0] && last(M[0]).slice(-200));
}, 1000);
test.run('another agent\'s line, a box write, a line for another nick, one with no id or no json: none handed over', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (M.map(last).every(function (a) { return [mine1, mine2, mine3, mine4].some(function (m) { return a.slice(-m.length) === m; }); })) ? true : 'handed ' + short(M.map(function (s) { return last(s).slice(-80); }));
}, 1000);
test.run('each hand-over is said by its item and the command\'s name', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === 'deskLoop: handing a line under goal/G1.2 to opencode.exe'; })) ? true : 'said ' + short(said);
}, 1000);


// the final answer is posted under the line's item, never its thinking
test.run('three answers are posted (one run gave none)', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (P.length === 3) ? true : 'posts ' + short(P.map(function (s) { return s.argv.slice(2); }));
}, 1000);
test.run('the stop step\'s text, after the leaked reasoning (<channel|>), trimmed, under the line\'s item', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (P.length >= 1 && P[0].argv[2] === 'chat.add' && body(P[0]).id === 'goal/G1.2' && body(P[0]).text === 'Red is the failing test.') ? true : 'posted ' + short(P[0] && P[0].argv);
}, 1000);
test.run('with no stop, the last step\'s text', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (P.length >= 2 && body(P[1]).id === 'goal/G1.4' && body(P[1]).text === 'last step') ? true : 'posted ' + short(P[1] && P[1].argv);
}, 1000);
test.run('a run with no text posts nothing, and says so', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === 'deskLoop: opencode.exe ended 3 with no answer to post'; })) ? true : 'said ' + short(said);
}, 1000);
test.run('a post refused is said, with why', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === 'deskLoop: the answer was not posted under goal/G1.5: refused: not yours'; })) ? true : 'said ' + short(said);
}, 1000);
test.run('its window sees each event as it comes: a tool by its input, a text by its words', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (said.some(function (s) { return s === '  [bash] {"command":"ls"}'; }) && said.some(function (s) { return s === '  thinking aloud'; })) ? true : 'said ' + short(said);
}, 1000);
test.run('and Desk sees none of it', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (P.every(function (s) { return body(s).text.indexOf('thinking aloud') === -1 && body(s).text.indexOf('my reasoning') === -1; })) ? true : 'posted ' + short(P.map(body));
}, 1000);


// no nick: nothing is its
test.run('with the nick \'\' the line for gemma is passed over, and it listens again', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (N.length === 2 && M.length === 4) ? true : 'model runs ' + M.length + ', nick asks ' + N.length;
}, 1000);
test.run('it never ends by itself: a fifth listen is under way', 0.2, function () {
  if (!W.L) return 'no run of the loop: the world failed';
  const L = W.L, N = W.N, M = W.M, P = W.P;
  return (L.length === 5) ? true : 'listens ' + L.length;
}, 1000);

// ── THE readTake PART ────────────────────────────────────────────────────────────────────────────────────────────
// The readTake part of ./deskLoop.js.
// deskLoop ARMS THE EAR WITH --read AND TAKES BEFORE IT POSTS (goal/G43.23, item 11; spec: ./deskLoop.md, its readTake section). The
// box: "deskLoop arms the ear without --read and posts without a take." The loop runs in this process with
// child_process.spawn standing in for every program it starts, as ./deskLoop.js does: the ear prints its lines and,
// last, "next: node deskAgentEar.js <port> --read <key>" (deskAgentEar.js, goal/G41.11); every start is kept in order.
// No node, no model, no port.
const RT = {};
// Its programs, scripted, and started after the part above has put back console.error and setTimeout.
function readTakeWorld() {
  const COMMAND = '/fake/opencode';
  const ev = function (o) { return JSON.stringify(o); };
  const line = function (body) { return 'DESK andy chat.add ' + JSON.stringify(body); };
  const next = function (key) { return 'next: node deskAgentEar.js ' + PORT + ' --read ' + key; };
  const answer = function (text) { return [ev({ type: 'step_start' }), ev({ type: 'text', part: { text: text } }), ev({ type: 'step_finish', part: { reason: 'stop' } })].join('\n') + '\n'; };

  const started = [];
  const script = { listens: [], models: [] };
  function kid(out, code) {
    const k = new EventEmitter();
    k.stdout = new EventEmitter();
    realSetTimeout(function () {
      if (out) String(out).match(/[\s\S]{1,40}/g).forEach(function (chunk) { k.stdout.emit('data', Buffer.from(chunk)); });
      k.emit('close', code);
    }, 1);
    return k;
  }
  childProcess.spawn = function (file, argv, opts) {
    const s = { file: file, argv: argv, opts: opts };
    started.push(s);
    if (file === process.execPath && argv[0] === EAR && (argv.length === 2 || argv[2] === '--read')) {
      s.kind = 'listen';
      const n = script.listens.shift();
      if (!n) { const k = new EventEmitter(); k.stdout = new EventEmitter(); return k; }
      return kid(n.out, n.code);
    }
    if (file === process.execPath && argv[0] === EAR && argv[2] === 'profile.get') { s.kind = 'nick'; return kid('{"ok":true,"nick":"gemma"}', 0); }
    if (file === process.execPath && argv[0] === EAR && argv[2] === 'line.take') { s.kind = 'take'; return kid('{"ok":true}', 0); }
    if (file === process.execPath && argv[0] === EAR && argv[2] === 'chat.add') { s.kind = 'post'; return kid('{"ok":true}', 0); }
    if (file === COMMAND) { s.kind = 'model'; const m = script.models.shift() || { out: '', code: 0 }; return kid(m.out, m.code); }
    s.kind = 'other';
    return kid('', 0);
  };
  RT.started = started;
  RT.of = function (kind) { return started.filter(function (s) { return s.kind === kind; }); };
  RT.body = function (s) { try { return JSON.parse(s.argv[3]); } catch (e) { return null; } };
  RT.said = [];
  script.listens.push(
    { out: line({ id: 'goal/G1.2', text: 'gemma: first' }) + '\n' + next('K1') + '\n', code: 0 },
    { out: line({ id: 'goal/G1.3', text: 'gemma: second' }) + '\n' + next('K2') + '\n', code: 0 });
  script.models.push({ out: answer('one'), code: 0 }, { out: answer('two'), code: 0 });
  process.argv = [process.argv[0], FILE, PORT, COMMAND];
}
// Before its answer i is posted, its ear took that line: '' if so, else what was started instead.
function tookBefore(i) {
  const p = RT.P[i];
  if (!p) return 'there is no answer ' + (i + 1) + ' posted';
  const b = RT.body(p);
  const id = b && b.id;
  const at = RT.started.indexOf(p);
  const take = RT.started.slice(0, at).filter(function (s) { return s.kind === 'take' && RT.body(s) && RT.body(s).id === id; });
  const took = !!id && take.length >= 1 && take[take.length - 1].argv[1] === PORT;
  return took ? '' : 'the chat.add under ' + id + ' was posted with no line.take before it; started ' + short(RT.started.slice(0, at + 1).map(function (s) { return s.kind + (s.argv[2] ? ' ' + s.argv[2] : ''); }));
}

// readTake: deskLoop re-arms the ear with --read <key> and takes the line before it posts (goal/G43.23 item 11)
test.run('the world: the loop listened three times (two wakes, then a third listen under way)', 0.2, async function () {
  // The part above is done with: console.error and setTimeout as they were, then this part's own stand-ins.
  restore();
  readTakeWorld();
  const realError = console.error;
  console.error = function () { RT.said.push(Array.prototype.slice.call(arguments).join(' ')); };
  try {
    // In one file with ./deskLoop.js above, deskLoop.js is loaded already, and it took spawn as it loaded: it is loaded afresh, so this
    // part's stand-in is the spawn it takes. The loop above waits on a listen that never ends, and starts nothing more.
    delete require.cache[require.resolve(FILE)];
    try { require(FILE); } catch (e) { return 'deskLoop.js threw as it loaded: ' + e.message; }
    await until(function () { return RT.of('listen').length >= 3; }, 15000);
    await settle();
  } finally { console.error = realError; }
  RT.L = RT.of('listen');
  RT.P = RT.of('post');
  const L = RT.L, said = RT.said;
  return (L.length === 3) ? true : 'listens: ' + L.length + ' ' + short(L.map(function (s) { return s.argv.slice(1); })) + '; said ' + short(said);
}, 1000);
test.run('the world: both lines were handed over and both answers posted, so the take before each is judged', 0.2, function () {
  if (!RT.L) return 'no run of the loop: the readTake world failed';
  const L = RT.L, P = RT.P, said = RT.said, of = RT.of;
  return (of('model').length === 2 && P.length === 2) ? true : 'model runs ' + of('model').length + ', posts ' + P.length + ': nothing judged';
}, 1000);

test.run('after a wake whose next names K1, it listens as deskAgentEar.js <port> --read K1', 0.2, function () {
  if (!RT.L) return 'no run of the loop: the readTake world failed';
  const L = RT.L, P = RT.P, said = RT.said, of = RT.of;
  return (L.length >= 2 && L[1].argv.join(' ') === [EAR, PORT, '--read', 'K1'].join(' ')) ? true : 'the second listen was ' + short(L[1] && L[1].argv.slice(1));
}, 1000);
test.run('and after the next wake, --read K2: always the key last handed', 0.2, function () {
  if (!RT.L) return 'no run of the loop: the readTake world failed';
  const L = RT.L, P = RT.P, said = RT.said, of = RT.of;
  return (L.length >= 3 && L[2].argv.join(' ') === [EAR, PORT, '--read', 'K2'].join(' ')) ? true : 'the third listen was ' + short(L[2] && L[2].argv.slice(1));
}, 1000);

// it takes the line before it posts
test.run('before its first answer is posted, its ear takes that line', 0.2, function () {
  if (!RT.P) return 'no run of the loop: the readTake world failed';
  return tookBefore(0) || true;
}, 1000);
test.run('before its second answer is posted, its ear takes that line', 0.2, function () {
  if (!RT.P) return 'no run of the loop: the readTake world failed';
  return tookBefore(1) || true;
}, 1000);
