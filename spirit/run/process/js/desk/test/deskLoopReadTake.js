'use strict';

// spirit/run/process/js/desk/test/deskLoopReadTake.js
// deskLoop ARMS THE EAR WITH --read AND TAKES BEFORE IT POSTS (goal/G43.23, item 11; spec: ./deskLoopReadTake.md). The
// box: "deskLoop arms the ear without --read and posts without a take." The loop runs in this process with
// child_process.spawn standing in for every program it starts, as ./deskLoop.js does: the ear prints its lines and,
// last, "next: node deskAgentEar.js <port> --read <key>" (deskAgentEar.js, goal/G41.11); every start is kept in order.
// No node, no model, no port.

const path = require('path');
const EventEmitter = require('events');
const childProcess = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskLoop.js');
const EAR = path.join(__dirname, '..', 'deskAgentEar.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const realSetTimeout = setTimeout;
const sleep = function (ms) { return new Promise(function (r) { realSetTimeout(r, ms); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

const COMMAND = '/fake/opencode';
const PORT = '11111';
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
const of = function (kind) { return started.filter(function (s) { return s.kind === kind; }); };
const body = function (s) { try { return JSON.parse(s.argv[3]); } catch (e) { return null; } };

const said = [];
const realError = console.error;
console.error = function () { said.push(Array.prototype.slice.call(arguments).join(' ')); };
async function until(cond, ms) { const t = Date.now(); while (!cond() && Date.now() - t < (ms || 5000)) await sleep(5); return cond(); }

test.startTest('deskLoopReadTake.js: deskLoop re-arms the ear with --read <key> and takes the line before it posts (goal/G43.23 item 11)');

(async function () {
  script.listens.push(
    { out: line({ id: 'goal/G1.2', text: 'gemma: first' }) + '\n' + next('K1') + '\n', code: 0 },
    { out: line({ id: 'goal/G1.3', text: 'gemma: second' }) + '\n' + next('K2') + '\n', code: 0 });
  script.models.push({ out: answer('one'), code: 0 }, { out: answer('two'), code: 0 });

  process.argv = [process.argv[0], FILE, PORT, COMMAND];
  try { require(FILE); } catch (e) { test.fail('deskLoop.js threw as it loaded: ' + e.message); }
  await until(function () { return of('listen').length >= 3; }, 15000);
  await settle();
  const L = of('listen');
  const P = of('post');

  test.subHeading('the world');
  ok(L.length === 3, 'the world: the loop listened three times (two wakes, then a third listen under way)', 'listens: ' + L.length + ' ' + short(L.map(function (s) { return s.argv.slice(1); })) + '; said ' + short(said));
  ok(of('model').length === 2 && P.length === 2, 'the world: both lines were handed over and both answers posted, so the take before each is judged', 'model runs ' + of('model').length + ', posts ' + P.length + ': nothing judged');

  test.subHeading('it re-arms the ear with --read and the key the ear handed');
  ok(L.length >= 2 && L[1].argv.join(' ') === [EAR, PORT, '--read', 'K1'].join(' '), 'after a wake whose next names K1, it listens as deskAgentEar.js <port> --read K1', 'the second listen was ' + short(L[1] && L[1].argv.slice(1)));
  ok(L.length >= 3 && L[2].argv.join(' ') === [EAR, PORT, '--read', 'K2'].join(' '), 'and after the next wake, --read K2: always the key last handed', 'the third listen was ' + short(L[2] && L[2].argv.slice(1)));

  test.subHeading('it takes the line before it posts');
  P.forEach(function (p) {
    const b = body(p);
    const id = b && b.id;
    const at = started.indexOf(p);
    const take = started.slice(0, at).filter(function (s) { return s.kind === 'take' && body(s) && body(s).id === id; });
    ok(!!id && take.length >= 1 && take[take.length - 1].argv[1] === PORT, 'before its chat.add under ' + id + ', a line.take {id: ' + id + '} through deskAgentEar <port>', 'the chat.add under ' + id + ' was posted with no line.take before it; started ' + short(started.slice(0, at + 1).map(function (s) { return s.kind + (s.argv[2] ? ' ' + s.argv[2] : ''); })));
  });
}()).then(function () { console.error = realError; test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { console.error = realError; test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
