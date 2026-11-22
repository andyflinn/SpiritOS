'use strict';

// spirit/run/spirit/console/test/script.js
// The tests of spirit/console/script.js, and of no other module (spec: ./script.md). goal/G48.2, the box: "there is only one system
// shell way into console: \"node spirit/console/script.js\", the console itself knows that it must enter the loop if no arguments was
// specified"; "the card feature from 48.1 will be completely dropped and the console will feature namevation only."
// On a scratch node of its own: the console of that node's tree run there.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const W = {};
const consoleOf = function () { return path.join(W.node.run, 'spirit', 'console', 'script.js'); };
const stateOf = function () { try { return JSON.parse(fs.readFileSync(path.join(W.node.run, 'spirit', 'state', 'console', 'node.json'), 'utf8')); } catch (e) { return null; } };
// The console started with the words given; what it printed, and whether and how it ended.
function start(words) {
  const kid = spawn(process.execPath, [consoleOf()].concat(words), { cwd: W.node.root, stdio: ['pipe', 'pipe', 'pipe'] });
  const p = { kid: kid, out: '', ended: false, code: null };
  kid.stdout.on('data', function (d) { p.out += String(d); });
  kid.stderr.on('data', function (d) { p.out += String(d); });
  kid.on('exit', function (code) { p.ended = true; p.code = code; });
  return p;
}
async function once(words) {
  const p = start(words);
  await H.until(function () { return Promise.resolve(p.ended); }, 20000);
  if (!p.ended) { try { p.kid.kill(); } catch (e) { /* gone */ } }
  return p;
}

test.run('spirit/console/script.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'console', 'script.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode({});
  return (!!W.node && W.node.up) || false;
}, test.limit.slow);
test.after(async function () {
  try { if (W.live && !W.live.ended) W.live.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});

// "the console itself knows that it must enter the loop if no arguments was specified"
test.run('with no words, console.js enters the loop: it stays running and shows the prompt "spirit: "', 0.4, async function () {
  if (!W.node || !W.node.up) return false;
  W.live = start([]);
  const ok = await H.until(function () { return Promise.resolve(W.live.out.indexOf('spirit: ') !== -1); }, 20000);
  return (!!ok && !W.live.ended) || false;
}, test.limit.slow);
test.run('the loop it entered takes a line: "path app" moves the stored path to app', 0.4, async function () {
  if (!W.live || W.live.ended) return false;
  W.live.kid.stdin.write('path app\n');
  const ok = await H.until(function () { const s = stateOf(); return Promise.resolve(!!s && s.path === 'app'); }, 20000);
  try { W.live.kid.kill(); } catch (e) { /* gone */ }
  return !!ok || false;
}, test.limit.slow);
// With words: they go to the command processor once, and the console ends.
test.run('with words, console.js does them once and ends: "console.js path agent" at app moves the path to app.agent', 0.4, async function () {
  if (!W.node || !W.node.up) return false;
  const p = await once(['path', 'agent']);
  const s = stateOf();
  return (p.ended && !!s && s.path === 'app.agent') || false;
}, test.limit.slow);
// "the card feature from 48.1 will be completely dropped"
test.run('card is dropped: "console.js card" prints no card of the node', 0.4, async function () {
  if (!W.node || !W.node.up) return false;
  const p = await once(['card']);
  return (p.ended && p.out.indexOf('publicKey') === -1) || false;
}, test.limit.slow);
