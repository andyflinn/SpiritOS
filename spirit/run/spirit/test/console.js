'use strict';

// spirit/run/spirit/test/console.js
// The tests of spirit/console.js, and of no other module (spec: ./console.md). goal/G48.1, the box, "console hello world":
//   - "node spirit/run/spirit/console.js card" prints the node's card using JSON.stringify(card,0,2)
//   - "node spirit/run/spirit/console.js" puts the console into interactive mode, where
//     - "exit" exits the interactive loop and the console script
//     - "card" prints the node's card using JSON.stringify(card,0,2)
// On a scratch node of its own: the console of that node's tree is run there, so it is a client of that node, and its card is
// what the node itself answers to node.card.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const W = {};
const consoleOf = function () { return path.join(W.node.run, 'spirit', 'console.js'); };
// The card as the node answers it, asked over its own door, not through the console.
async function card() {
  try {
    const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'node.card', args: {} }) });
    return r.status === 200 ? await r.json() : null;
  } catch (e) { return null; }
}
// The console started with the words given; what it printed, and whether and how it ended.
function start(words) {
  const kid = spawn(process.execPath, [consoleOf()].concat(words), { cwd: W.node.root, stdio: ['pipe', 'pipe', 'pipe'] });
  const p = { kid: kid, out: '', ended: false, code: null };
  kid.stdout.on('data', function (d) { p.out += String(d); });
  kid.stderr.on('data', function () {});
  kid.on('exit', function (code) { p.ended = true; p.code = code; });
  return p;
}
const printed = function (p, n) { return p.out.split(W.want).length - 1 >= n; };

test.run('spirit/console.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'console.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up and answers its card', 0.2, async function () {
  W.node = await H.scratchNode({});
  if (!W.node || !W.node.up) return false;
  W.card = await card();
  W.want = W.card ? JSON.stringify(W.card, 0, 2) : '';
  return (!!W.card && W.card.ok === true && typeof W.card.publicKey === 'string') || false;
}, test.limit.slow);
test.after(async function () {
  try { if (W.live && !W.live.ended) W.live.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});

// "node spirit/run/spirit/console.js card" prints the node's card using JSON.stringify(card,0,2)
test.run('"console.js card" prints the node\'s card as JSON.stringify(card,0,2), and nothing else', 0.4, async function () {
  if (!W.want) return false;
  const p = start(['card']);
  await H.until(function () { return Promise.resolve(p.ended); }, 20000);
  if (!p.ended) { try { p.kid.kill(); } catch (e) { /* gone */ } }
  W.once = p;
  return (p.ended && p.out.trim() === W.want) || false;
}, test.limit.slow);
test.run('"console.js card" ends by itself once it has printed, without an error', 0.2, function () {
  return (!!W.once && W.once.ended && W.once.code === 0) || false;
}, test.limit.quick);

// "node spirit/run/spirit/console.js" puts the console into interactive mode
test.run('"console.js" with no word stays running, waiting for a line', 0.4, async function () {
  if (!W.want) return false;
  W.live = start([]);
  await H.sleep(3000);
  return (!W.live.ended && !printed(W.live, 1)) || false;
}, test.limit.slow);
test.run('at the prompt, "card" prints the node\'s card as JSON.stringify(card,0,2)', 0.4, async function () {
  if (!W.live || W.live.ended) return false;
  W.live.kid.stdin.write('card\n');
  const ok = await H.until(function () { return Promise.resolve(printed(W.live, 1)); }, 20000);
  return !!ok || false;
}, test.limit.slow);
test.run('after "card" the console stays in interactive mode, and "card" again prints the card again', 0.4, async function () {
  if (!W.live || W.live.ended) return false;
  await H.sleep(1000);
  if (W.live.ended) return false;
  W.live.kid.stdin.write('card\n');
  const ok = await H.until(function () { return Promise.resolve(printed(W.live, 2)); }, 20000);
  return (!!ok && !W.live.ended) || false;
}, test.limit.slow);
test.run('"exit" exits the interactive loop and the console script', 0.4, async function () {
  if (!W.live || W.live.ended) return false;
  W.live.kid.stdin.write('exit\n');
  const ok = await H.until(function () { return Promise.resolve(W.live.ended); }, 20000);
  return (!!ok && W.live.code === 0) || false;
}, test.limit.slow);
