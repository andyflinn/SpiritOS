'use strict';

// platform/wsl/autoPull.js
// ANDY'S TREE KEPT UP TO DATE, BETWEEN TESTICLE'S RUNS. goal/G47.1, the box, the cleanup loop (Andy: "i agree. let's
// go."): "Auto-pull: a small tool in platform/wsl pulls Andy's main repo every few minutes, only while testicle is idle,
// so never mid-run. If Andy's tree has edits of his own, it pulls nothing and says so in Desk; it never stashes or
// overwrites." "Restart: never Andy's node. Only testicle is switched off and on, and only when a pull changed testicle's
// own files." The decisions are Andy's; change them in the box first.
//
//   node platform/wsl/autoPull.js <Andy's repo> <the port of your own node> <Desk item>
//
// Asks of Andy's node go through the spirit object of his checkout (its spirit/state/environment.json names his node):
// testicle.busy, and app.active of testicle, nothing else. What it says goes to Desk through deskAgentEar.js of this
// checkout, on the agent's own node, under the item given.
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

async function once(o) {
  const repo = o.repo;
  if (isBusy(await o.ask('testicle.busy', {}))) return { pulled: false, why: 'busy' };
  // An edit of his own: a tracked file changed or staged. A file git does not track is not touched by a pull.
  const edits = git(repo, ['status', '--porcelain', '--untracked-files=no']);
  if (edits) {
    const text = 'auto-pull: Andy\'s tree has edits of his own, so nothing was pulled: ' + edits.split('\n').map(function (l) { return l.slice(3); }).join(', ');
    if (text !== lastSaid) { lastSaid = text; await o.say(text); }
    return { pulled: false, why: 'edits' };
  }
  lastSaid = '';
  const before = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['fetch', '-q']);
  try { git(repo, ['merge', '--ff-only', '-q', '@{u}']); } catch (e) { return { pulled: false, why: 'no fast-forward' }; }
  const after = git(repo, ['rev-parse', 'HEAD']);
  if (after === before) return { pulled: false, why: 'up to date' };
  const changed = git(repo, ['diff', '--name-only', before, after]).split('\n').filter(Boolean);
  if (changed.some(function (f) { return f.indexOf(TESTICLE_DIR) === 0; })) {
    await o.ask('app.active', { key: 'testicle', active: false });
    await o.ask('app.active', { key: 'testicle', active: true });
  }
  return { pulled: true, from: before, to: after };
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
  require(path.join(repo, 'spirit', 'run', 'spirit', 'spirit.js'));
  const ask = function (verb, args) {
    const cut = verb.indexOf('.');
    const family = verb.slice(0, cut);
    const name = verb.slice(cut + 1);
    return spirit.outcome(spirit.require(spirit.familyPath(family)).then(function (c) { return c[name](args); }))
      .then(function (r) { return r && r.body; });
  };
  const ear = path.join(__dirname, '..', '..', 'spirit', 'run', 'spirit', 'app', 'desk', 'deskAgentEar.js');
  const say = function (text) {
    execFileSync(process.execPath, [ear, String(port), 'chat.add', JSON.stringify({ id: item, text: 'wsl: ' + text })], { stdio: 'ignore' });
    return Promise.resolve(true);
  };
  const tick = function () {
    once({ repo: repo, ask: ask, say: say })
      .then(function (r) { console.log(new Date().toISOString() + ' ' + JSON.stringify(r)); }, function (e) { console.error(new Date().toISOString() + ' ' + ((e && e.message) || e)); })
      .then(function () { setTimeout(tick, minutes * 60000); });
  };
  tick();
}
