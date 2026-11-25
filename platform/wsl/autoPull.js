'use strict';

// platform/wsl/autoPull.js
// ANDY'S TREE KEPT UP TO DATE, RUN OR NO RUN. goal/G47.1, the box, the cleanup loop (Andy: "i agree. let's go."):
// "Auto-pull: a small tool in platform/wsl pulls Andy's main repo every few minutes ... If Andy's tree has edits of his
// own, it pulls nothing and says so in Desk; it never stashes or overwrites." "Restart: never Andy's node. Only testicle is
// switched off and on, and only when a pull changed testicle's own files." Its "only while testicle is idle, so never
// mid-run" is gone (goal/G47.4, Andy: "i myself se absolutely no reason to not modify the code, while my testicle is
// running. when new code arrives, testicle will simple adjust and re-run what needs re-running"): it pulls while testicle
// runs too. Switching testicle off and on would kill its run, so a pull of testicle's own files while it is busy switches
// it at the first look that finds it idle. The decisions are Andy's.
//
//   node platform/wsl/autoPull.js <Andy's repo> <the port of your own node> <Desk item>
//
// Asks of Andy's node go through the spirit object of his checkout (its spirit/state/environment.json names his node):
// testicle.busy, and app.active of testicle, nothing else. What it says goes to Desk as desk.chat.add on the agent's own
// node, over its loopback, under the item given: that node's desk, in client mode, sends it on to Andy's (deskAgentEar.js
// went with deskClient, goal/G48.8).
//
// once({repo, ask, say}): one look. ask(verb, args) answers the node's body; say(text) posts to Desk.

const path = require('path');
const { execFileSync } = require('child_process');

const minutes = 3;
// Testicle's own files, by their path in the repo: a pull that changed one switches testicle off and on.
const TESTICLE_DIR = 'spirit/run/spirit/app/testicle/';

function git(repo, args) { return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function isBusy(b) { return b === true || !!(b && b.busy === true); }

// What was last said of Andy's edits, so a tree left edited is said once, not every few minutes.
let lastSaid = '';
// A pull changed testicle's own files while it was busy: it is switched off and on once it is idle.
let owedRestart = false;

async function restartWhenIdle(o, busy) {
  if (!owedRestart || busy) return false;
  owedRestart = false;
  await o.ask('app.active', { key: 'testicle', active: false });
  await o.ask('app.active', { key: 'testicle', active: true });
  return true;
}

async function once(o) {
  const repo = o.repo;
  const busy = isBusy(await o.ask('testicle.busy', {}));
  // An edit of his own: a tracked file changed or staged. A file git does not track is not touched by a pull.
  const edits = git(repo, ['status', '--porcelain', '--untracked-files=no']);
  if (edits) {
    const text = 'auto-pull: Andy\'s tree has edits of his own, so nothing was pulled: ' + edits.split('\n').map(function (l) { return l.slice(3); }).join(', ');
    if (text !== lastSaid) { lastSaid = text; await o.say(text); }
    await restartWhenIdle(o, busy);
    return { pulled: false, why: 'edits' };
  }
  lastSaid = '';
  const before = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['fetch', '-q']);
  try { git(repo, ['merge', '--ff-only', '-q', '@{u}']); } catch (e) { await restartWhenIdle(o, busy); return { pulled: false, why: 'no fast-forward' }; }
  const after = git(repo, ['rev-parse', 'HEAD']);
  if (after !== before) {
    const changed = git(repo, ['diff', '--name-only', before, after]).split('\n').filter(Boolean);
    if (changed.some(function (f) { return f.indexOf(TESTICLE_DIR) === 0; })) owedRestart = true;
  }
  const restarted = await restartWhenIdle(o, busy);
  if (after === before) return { pulled: false, why: 'up to date', busy: busy, restarted: restarted, restartOwed: owedRestart };
  return { pulled: true, from: before, to: after, busy: busy, restarted: restarted, restartOwed: owedRestart };
}

module.exports = { minutes: minutes, once: once };

if (require.main === module) {
  const repo = path.resolve(String(process.argv[2] || ''));
  const port = Number(process.argv[3]);
  const item = String(process.argv[4] || '');
  if (!process.argv[2] || !Number.isInteger(port) || port <= 0 || !item) {
    console.error('usage: node platform/wsl/autoPull.js <Andy\'s repo> <the port of your own node> <Desk item>');
    process.exit(2);
  }
  // The spirit object of Andy's checkout: its asks go to his node.
  // The spirit object is spirit/script.js since goal/G49.12's flag day, spirit/spirit.js before it: whichever the checkout holds.
  const run = path.join(repo, 'spirit', 'run');
  const fs = require('fs');
  require(fs.existsSync(path.join(run, 'spirit', 'script.js')) ? path.join(run, 'spirit', 'script.js') : path.join(run, 'spirit', 'spirit.js'));
  // A verb by its branch's interface, the answer of spirit.requireScript (goal/G49.9), its outcome through spirit.callOutcome.
  const ask = function (verb, args) {
    const cut = verb.indexOf('.');
    const branch = verb.slice(0, cut);
    const name = verb.slice(cut + 1);
    const at = fs.existsSync(path.join(run, 'spirit', 'app', branch, 'api.js')) ? 'spirit/app/' + branch + '/api.js' : 'spirit/' + branch + '/api.js';
    return spirit.callOutcome(Promise.resolve(spirit.requireScript(at)).then(function (c) { return c[name](args); }))
      .then(function (r) { return r && r.body; });
  };
  const say = function (text) {
    return fetch('http://127.0.0.1:' + Number(port) + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'desk.chat.add', args: { id: item, text: text } }) })
      .then(function (r) { return r.ok; }, function () { return false; });
  };
  const tick = function () {
    once({ repo: repo, ask: ask, say: say })
      .then(function (r) { console.log(new Date().toISOString() + ' ' + JSON.stringify(r)); }, function (e) { console.error(new Date().toISOString() + ' ' + ((e && e.message) || e)); })
      .then(function () { setTimeout(tick, minutes * 60000); });
  };
  tick();
}
