'use strict';

// spirit/run/spirit/console/test/loop.js
// The tests of spirit/console/loop.js, and of no other module (spec: ./loop.md). goal/G48.2, the box: "the script
// run://spirit/console/loop.js will be the consoles interactive user loop"; its prompt; and "when the user in the interactive
// loop uses the up/down arrow keys, only those history items will be offered that can be used from the current path. since
// the log stores all commands as if typed from root prompt \"spirit: \", the loop must translate those back into its scope".
// The loop is entered as the box says, "node spirit/console/script.js" with no words, on a scratch node of its own. The arrow keys
// are a terminal's: the loop's node is told its input and output are a terminal (isTTY, set before console.js loads, by
// --import), so readline reads keys and draws its line as in one, on every machine; its keys are written to it as a
// terminal sends them (goal/G48.4; Andy's Windows run: script(1), util-linux, which the test used before, is Linux only).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');

const W = {};
const UP = '\x1b[A';
const STATE = function () { return path.join(W.node.run, 'spirit', 'state', 'console', 'node.json'); };
const stateOf = function () { try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')); } catch (e) { return null; } };
const at = function () { const s = stateOf(); return s ? String(s.path || '') : null; };
// What a terminal shows of it: escapes and carriage returns taken out.
const plain = function (t) { return String(t).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '\n'); };
// The loop in a terminal of its own: node spirit/console/script.js, its streams marked a terminal before it loads.
function open() {
  // A data URL, not a file: nothing is left in the lab copy, which keeps its root between runs.
  const tty = 'data:text/javascript,process.stdin.isTTY=true;process.stdout.isTTY=true;process.stdout.columns=200;';
  const kid = spawn(process.execPath, ['--import', tty, path.join(W.node.run, 'spirit', 'console', 'script.js')], { cwd: W.node.root, stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign({}, process.env, { TERM: 'xterm' }) });
  const t = { kid: kid, out: '', ended: false };
  kid.stdout.on('data', function (d) { t.out += String(d); });
  kid.on('exit', function () { t.ended = true; });
  return t;
}
const shut = function (t) { try { if (t && !t.ended) t.kid.kill(); } catch (e) { /* gone */ } };
// The text since a mark, plain.
const since = function (t, mark) { return plain(t.out.slice(mark)); };
// A line typed, then the prompt waited for.
async function type(t, line, prompt) {
  const mark = t.out.length;
  t.kid.stdin.write(line + '\r');
  return H.until(function () { return Promise.resolve(since(t, mark).indexOf(prompt) !== -1); }, 20000);
}
// The lines the up key offers, pressed n times at the current prompt: what stands after the prompt each time.
async function offers(t, prompt, n) {
  const seen = [];
  for (let i = 0; i < n; i += 1) {
    const mark = t.out.length;
    t.kid.stdin.write(UP);
    await H.sleep(700);
    const shown = since(t, mark).split('\n').filter(function (l) { return l.indexOf(prompt) !== -1; }).pop();
    if (shown !== undefined) seen.push(shown.slice(shown.lastIndexOf(prompt) + prompt.length).trim());
  }
  return seen;
}

test.run('spirit/console/loop.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'console', 'loop.js')) || false;
}, test.limit.quick);
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode({});
  return (!!W.node && W.node.up) || false;
}, test.limit.slow);
// The loop's state file, planted at start below, goes at end: a lab copy keeps it between runs.
// So does terminal.js, which b4607b92 wrote to the copy's root before the data URL.
const dropState = function () {
  try { if (W.node) fs.rmSync(STATE(), { force: true }); } catch (e) { /* none */ }
  try { if (W.node) fs.rmSync(path.join(W.node.root, 'terminal.js'), { force: true }); } catch (e) { /* none */ }
};
test.after(async function () {
  shut(W.t);
  dropState();
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.node) H.freeTree(W.node); } catch (e) { /* left */ }
});
const up = function () { return !!W.node && W.node.up; };

// "\"path\" with \"<<\" as an argument navigates to the root, where the prompt always is \"spirit: \""
test.run('the loop starts at the root with the prompt "spirit: "', 0.4, async function () {
  if (!up()) return false;
  // ITS OWN START STATE (goal/G48.4; Andy: "not if spirit/state/console/node.json has an other current path"): the loop shows
  // the stored path (./loop.md), so the test plants the root, no history, before the loop opens, whatever the tree held.
  fs.mkdirSync(path.dirname(STATE()), { recursive: true });
  fs.writeFileSync(STATE(), JSON.stringify({ path: '', history: [] }));
  W.t = open();
  const ok = await H.until(function () { return Promise.resolve(plain(W.t.out).indexOf('spirit: ') !== -1); }, 20000);
  return (!!ok && !W.t.ended) || false;
}, test.limit.slow);
// "if the prompt is \"spirit\" and the user in the loop types \"path app\", then ... the prompt with be \"spirit.app: \""
test.run('"path app" typed at "spirit: " makes the prompt "spirit.app: "', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  return !!(await type(W.t, 'path app', 'spirit.app: ')) || false;
}, test.limit.slow);
// "the path in state will become \"app.agent\" and the prompt will show \"spirit.app.agent: \""
test.run('"path agent" typed at "spirit.app: " makes the prompt "spirit.app.agent: " and the path in state app.agent', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  const ok = await type(W.t, 'path agent', 'spirit.app.agent: ');
  return (!!ok && at() === 'app.agent') || false;
}, test.limit.slow);
// "a path navigation to a path that doesn't exist under run://spirit/ is refused with an error, and the prompt remains as it is."
test.run('"path nope" is refused, and the prompt stays "spirit.app.agent: "', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  const ok = await type(W.t, 'path nope', 'spirit.app.agent: ');
  return (!!ok && at() === 'app.agent') || false;
}, test.limit.slow);
test.run('"path <" typed at "spirit.app.agent: " makes the prompt "spirit.app: "', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  return !!(await type(W.t, 'path <', 'spirit.app: ')) || false;
}, test.limit.slow);
// The history now holds, as typed from the root, "path app" and "path app.agent". At spirit.app the second is offered as
// "path agent", translated back into the loop's scope; "path app" (app.app there) and "path app.agent" as logged are not.
test.run('at "spirit.app: " the up key offers "path agent", the logged "path app.agent" translated back', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  W.atApp = await offers(W.t, 'spirit.app: ', 4);
  return W.atApp.indexOf('path agent') !== -1 || false;
}, test.limit.slow);
test.run('at "spirit.app: " the up key never offers "path app.agent" or "path app", which cannot be used from there', 0.4, function () {
  return (!!W.atApp && W.atApp.length > 0 && W.atApp.indexOf('path app.agent') === -1 && W.atApp.indexOf('path app') === -1) || false;
}, test.limit.quick);
test.run('"path <<" makes the prompt "spirit: " again', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  W.t.kid.stdin.write('\x15');
  const ok = await type(W.t, 'path <<', 'spirit: ');
  return (!!ok && at() === '') || false;
}, test.limit.slow);
test.run('then "path node" makes the prompt "spirit.node: "', 0.4, async function () {
  if (!W.t || W.t.ended) return false;
  W.atNode = !!(await type(W.t, 'path node', 'spirit.node: ')) && at() === 'node';
  return W.atNode || false;
}, test.limit.slow);
test.run('at "spirit.node: " the up key offers neither "path agent" nor "path app.agent": they cannot be used from there', 0.4, async function () {
  if (!W.t || W.t.ended || !W.atNode) return false;
  const seen = await offers(W.t, 'spirit.node: ', 6);
  return (seen.indexOf('path agent') === -1 && seen.indexOf('path app.agent') === -1) || false;
}, test.limit.slow);
// goal/G48.3, Andy: "a successfully run command must be logged in state and be available for re-use with the up-key on the
// keyboad, the up key isn't for navigation only, it's for every command that is successful."
test.run('at "spirit.node: " a verb that ran, "card", is offered again by the up key', 0.4, async function () {
  if (!W.t || W.t.ended || !W.atNode) return false;
  await type(W.t, 'card', 'spirit.node: ');
  await type(W.t, 'nope', 'spirit.node: ');
  W.afterCard = await offers(W.t, 'spirit.node: ', 4);
  return W.afterCard.indexOf('card') !== -1 || false;
}, test.limit.slow);
test.run('a command that failed, "nope", is not offered by the up key', 0.4, function () {
  return (!!W.afterCard && W.afterCard.length > 0 && W.afterCard.indexOf('nope') === -1) || false;
}, test.limit.quick);
