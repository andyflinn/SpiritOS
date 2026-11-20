'use strict';

// platform/wsl/test/autoPull.js
// The tests of platform/wsl/autoPull.js, and of no other module.
// goal/G47.1, the box, the cleanup loop (Andy: "i agree. let's go."): "Auto-pull: a small tool in platform/wsl pulls Andy's
// main repo every few minutes, only while testicle is idle, so never mid-run. If Andy's tree has edits of his own, it pulls
// nothing and says so in Desk; it never stashes or overwrites." "Restart: never Andy's node. Only testicle is switched off
// and on, and only when a pull changed testicle's own files."
// Real git, in scratch folders: an origin, Andy's tree cloned from it, and a second clone that pushes. The node is the
// tool's ask(verb, args), recorded: testicle.busy answers as each test sets it; app.active switches an app off and on.
// What it says in Desk is its say(text), recorded.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(ROOT, 'spirit', 'run', 'spirit', 'test', 'testReport.js'));
const FILE = path.join(ROOT, 'platform', 'wsl', 'autoPull.js');

const git = function (cwd, args) { return execFileSync('git', args, { cwd: cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); };
const write = function (dir, rel, text) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const head = function (dir) { return git(dir, ['rev-parse', 'HEAD']); };
const TESTICLE = 'spirit/run/spirit/app/testicle/testicle.js';

let tool, scratch, origin, andy, other, busy, asked, said;
function ask(verb, args) {
  asked.push({ verb: verb, args: args });
  if (verb === 'testicle.busy') return Promise.resolve(busy);
  return Promise.resolve({ ok: true });
}
function say(text) { said.push(String(text)); return Promise.resolve(true); }
// Another agent's push to the origin: one commit touching rel.
function pushed(rel, text) { write(other, rel, text); git(other, ['add', rel]); git(other, ['commit', '-q', '-m', 'a push']); git(other, ['push', '-q']); }
function run() { asked = []; said = []; return Promise.resolve(tool.once({ repo: andy, ask: ask, say: say })); }

test.run('the tool is there and loads, with once and its period in minutes', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { tool = require(FILE); } catch (e) { return false; }
  return tool && typeof tool.once === 'function' && typeof tool.minutes === 'number' ? true : false;
}, test.limit.quick);
test.run('it pulls every few minutes', 0.2, function () {
  if (!tool) return false;
  return tool.minutes >= 1 && tool.minutes <= 10 ? true : false;
}, test.limit.quick);

test.run('a scratch origin, Andy\'s tree cloned from it, and another clone that pushes are made', 0.2, function () {
  if (!tool) return false;
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'autoPull-'));
  origin = path.join(scratch, 'origin.git');
  andy = path.join(scratch, 'andy');
  other = path.join(scratch, 'other');
  git(scratch, ['init', '-q', '--bare', '-b', 'master', origin]);
  git(scratch, ['clone', '-q', origin, other]);
  [other].forEach(function (d) { git(d, ['config', 'user.email', 't@t']); git(d, ['config', 'user.name', 't']); });
  write(other, 'README.md', 'one\n');
  write(other, TESTICLE, '// testicle\n');
  git(other, ['add', '.']);
  git(other, ['commit', '-q', '-m', 'first']);
  git(other, ['push', '-q', 'origin', 'master']);
  git(scratch, ['clone', '-q', origin, andy]);
  git(andy, ['config', 'user.email', 'a@a']);
  git(andy, ['config', 'user.name', 'a']);
  return head(andy) === head(other) ? true : false;
}, test.limit.quick);
test.after(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

// goal/G47.4, Andy: "i myself se absolutely no reason to not modify the code, while my testicle is running. when new code
// arrives, testicle will simple adjust and re-run what needs re-running"; "testicle i meant to simple catch up with the
// state of the code".
test.run('while testicle is busy, it pulls Andy\'s tree up to the origin all the same', 0.2, async function () {
  if (!andy) return false;
  pushed('README.md', 'two\n');
  busy = true;
  await run();
  return head(andy) === head(other) ? true : false;
}, test.limit.slow);
test.run('a pull that changed no file of testicle switches nothing off or on', 0.2, function () {
  if (!asked) return false;
  return !asked.some(function (a) { return a.verb === 'app.active'; }) ? true : false;
}, test.limit.quick);

test.run('with an edit of Andy\'s own in his tree, it pulls nothing', 0.2, async function () {
  if (!andy) return false;
  write(andy, 'README.md', 'Andy\'s own edit\n');
  pushed('other.txt', 'more\n');
  busy = false;
  const before = head(andy);
  await run();
  return head(andy) === before ? true : false;
}, test.limit.slow);
test.run('with an edit of Andy\'s own, it says so in Desk', 0.2, function () {
  if (!said) return false;
  return said.length === 1 ? true : false;
}, test.limit.quick);
test.run('it never stashes or overwrites Andy\'s edit: his file is as he left it and git keeps no stash', 0.2, function () {
  if (!andy) return false;
  return fs.readFileSync(path.join(andy, 'README.md'), 'utf8') === 'Andy\'s own edit\n' && git(andy, ['stash', 'list']) === '' ? true : false;
}, test.limit.quick);

test.run('a pull that changed testicle\'s own files switches testicle off, then on', 0.2, async function () {
  if (!andy) return false;
  git(andy, ['checkout', '-q', '--', 'README.md']);
  pushed(TESTICLE, '// testicle, changed\n');
  busy = false;
  await run();
  const sw = asked.filter(function (a) { return a.verb === 'app.active'; });
  return head(andy) === head(other) && sw.length === 2 &&
    sw[0].args.key === 'testicle' && sw[0].args.active === false && sw[1].args.key === 'testicle' && sw[1].args.active === true ? true : false;
}, test.limit.slow);
// Switching testicle off and on kills its run: a pull of testicle's own files while it is busy waits for it to be idle.
test.run('a pull while testicle is busy that changed testicle\'s own files pulls, but switches nothing off or on', 0.2, async function () {
  if (!andy) return false;
  pushed(TESTICLE, '// testicle, changed again\n');
  busy = true;
  await run();
  return head(andy) === head(other) && !asked.some(function (a) { return a.verb === 'app.active'; }) ? true : false;
}, test.limit.slow);
test.run('the next look with testicle idle switches testicle off, then on, though nothing new was pulled', 0.2, async function () {
  if (!andy) return false;
  busy = false;
  await run();
  const sw = asked.filter(function (a) { return a.verb === 'app.active'; });
  return sw.length === 2 && sw[0].args.active === false && sw[1].args.active === true ? true : false;
}, test.limit.slow);
test.run('a look after that switches nothing off or on', 0.2, async function () {
  if (!andy) return false;
  busy = false;
  await run();
  return !asked.some(function (a) { return a.verb === 'app.active'; }) ? true : false;
}, test.limit.slow);
test.run('it never restarts Andy\'s node: it asks nothing but testicle.busy and app.active of testicle', 0.2, function () {
  if (!asked) return false;
  return asked.every(function (a) { return a.verb === 'testicle.busy' || (a.verb === 'app.active' && a.args && a.args.key === 'testicle'); }) ? true : false;
}, test.limit.quick);
