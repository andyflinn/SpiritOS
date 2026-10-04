'use strict';

// spirit/run/process/js/desk/commitCheck.js
// RULES 3 AND 4 AT THE COMMIT — goal/G3.9.
//
//   Andy, 2026-10-02: "You will not invent, design or implement code outside of the scope of the current goal."
//   and "It is only through your use of the desk application that you will receive authorization to modify or
//   create code"; "the system needs to enforce those rules wherever it can."
//   Andy, 2026-10-03: "- the agents commit from their own clone under andy s name"; "the actual contract is
//   consumed between 'go' and 'done'"; "the at 'done' time, or with the agents request to get the users 'done', the
//   user is presented, via chat, with a list of files modified, in a bullet-list."
//
// WHAT IT IS. Three git hooks in an agent's OWN clone, never in Andy's checkouts: the clone tells an agent's commit
// from his, since both carry his name. A commit must name, in its message, an item of the current goal that has
// HIS Go on record (the desk's `go`) and is not done; else git refuses it and nothing is committed. A commit taken
// is written under that item as one chat line WHEN IT IS PUSHED (goal/G4.19, issue 6; Andy: "Push it is."): its
// hash as the remote holds it and each file it changed, one `- path` per line. A pull --rebase gives a commit a new
// hash, so the hash it was made with would name nothing on the remote; the commit is found again at the push by
// its subject, which a rebase keeps. Every ask
// goes through the agent's own deskClient (its node's jobs.api), so it is counted with the rest; with the node not
// answering, the commit is refused, not waved through.
//
//   node commitCheck.js install <port of the agent's own node>    in the clone's root: writes the two hooks
//   node commitCheck.js check <port> <message file>                the commit-msg hook (git runs it)
//   node commitCheck.js record <port>                              the post-commit hook (git runs it)
//   node commitCheck.js push <port> <remote name>                  the pre-push hook (git runs it, refs on stdin)
//
// The port lives in the hook text install writes; the item a check accepted waits in .git/commitCheck.item for the
// record that follows the commit, which moves it, with the commit's subject, to .git/commitCheck.pending; the push
// writes each pending commit it carries and takes it off. A rebase replays commits through neither hook, so a
// pull --rebase passes. With the node not answering at the push, the push is refused and nothing is taken off.
// Exits: 0 taken; 1 refused or no node (the reason printed); 2 usage.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node commitCheck.js install <port> | check <port> <message file> | record <port> | push <port> <remote>';
const NODE_WAIT_MS = 20000;
const ITEM = /\b([A-Za-z][\w-]*\/G\d+\.\d+)\b/g;

const what = String(process.argv[2] || '');
const port = Number(process.argv[3]);
if (['install', 'check', 'record', 'push'].indexOf(what) === -1 || !Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
function git(args) { return spawnSync('git', args, { encoding: 'utf8', timeout: 30000 }); }
function gitDir() {
  const r = git(['rev-parse', '--git-dir']);
  if (r.status !== 0) end(1, 'commitCheck: not in a git clone');
  return path.resolve(r.stdout.trim());
}

// One ask of the desk through this agent's own deskClient, as deskEar asks it: the desk's answer, parsed; a
// refusal, deskClient's or the desk's, or a node that does not answer, ends the check as refused.
function desk(verb, args) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  const ask = kernel.core.ask('jobs.api', { ask: { deskClient: { desk: { verb: verb, json: JSON.stringify(args) } } } }, 'http://127.0.0.1:' + port);
  return Promise.race([ask, late]).then(function (r) {
    clearTimeout(timer);
    // The desk's answer itself is the body (goal/G4.19): a refusal of the desk's or of deskClient's is ok false.
    if (!r || r.status !== 200 || !r.body || typeof r.body !== 'object') throw new Error('deskClient on port ' + port + ' answered ' + (r ? r.text : 'nothing'));
    if (r.body.ok === false) throw new Error('the desk answered ' + JSON.stringify(r.body));
    return r.body;
  }, function (e) { clearTimeout(timer); end(1, 'commitCheck: REFUSED, the node on port ' + port + ' could not be asked ' + verb + ': ' + ((e && e.message) || e)); });
}

// ── install ──────────────────────────────────────────────────────────
function install() {
  const hooks = path.join(gitDir(), 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const me = __filename.replace(/\\/g, '/');
  const node = process.execPath.replace(/\\/g, '/');
  const write = function (name, args) {
    const file = path.join(hooks, name);
    fs.writeFileSync(file, '#!/bin/sh\n# written by spirit/run/process/js/desk/commitCheck.js (goal/G3.9); install again to change the port\nexec "' + node + '" "' + me + '" ' + args + '\n');
    fs.chmodSync(file, 0o755);
  };
  write('commit-msg', 'check ' + port + ' "$1"');
  write('post-commit', 'record ' + port);
  write('pre-push', 'push ' + port + ' "$1"');
  end(0, 'commitCheck: hooks written in ' + hooks + ', asking the node on port ' + port);
}

// ── check ────────────────────────────────────────────────────────────
// The items the message names, each asked of the desk; the first with his Go and not done lets the commit through.
function check() {
  const file = String(process.argv[4] || '');
  let message = '';
  try { message = fs.readFileSync(file, 'utf8'); } catch (e) { end(1, 'commitCheck: no message file ' + file); }
  const ids = [];
  message.replace(ITEM, function (m, id) { if (ids.indexOf(id) === -1) ids.push(id); return m; });
  if (!ids.length) end(1, 'commitCheck: REFUSED, the message names no item (rule 4: an item of the current goal with his Go, such as area/G1.2)');
  return desk('items.search', { text: '', currentGoalOnly: true, goalsOnly: true }).then(function (goals) {
    const current = (goals.items || []).map(function (p) { try { return JSON.parse(p.label).id; } catch (e) { return ''; } }).filter(Boolean);
    const reasons = [];
    function one(i) {
      if (i >= ids.length) end(1, 'commitCheck: REFUSED (rules 3 and 4)\n' + reasons.join('\n'));
      const id = ids[i];
      return desk('item.get', { id: id }).then(function (got) {
        let f = null;
        try { f = JSON.parse(got.item); } catch (e) { f = null; }
        if (!f) { reasons.push('- ' + id + ': the desk knows no such item'); return one(i + 1); }
        if (current.indexOf(f.goal) === -1) { reasons.push('- ' + id + ': not an item of the current goal'); return one(i + 1); }
        if (f.status === 'done' || f.status === 'closed') { reasons.push('- ' + id + ': ' + f.status + ' already; nothing is owed on it'); return one(i + 1); }
        if (f.go !== true) { reasons.push('- ' + id + ': Andy has not pressed Go on it'); return one(i + 1); }
        fs.writeFileSync(path.join(gitDir(), 'commitCheck.item'), id);
        end(0, 'commitCheck: ' + id + ' has his Go; the commit is taken');
      });
    }
    return one(0);
  });
}

// ── record ───────────────────────────────────────────────────────────
// The commit just made waits for its push, under the item the check accepted, known by its subject.
function pendingFile() { return path.join(gitDir(), 'commitCheck.pending'); }
function readPending() {
  let raw = '';
  try { raw = fs.readFileSync(pendingFile(), 'utf8'); } catch (e) { raw = ''; }
  return raw.split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function writePending(list) { fs.writeFileSync(pendingFile(), list.map(function (p) { return JSON.stringify(p) + '\n'; }).join('')); }
function record() {
  const marker = path.join(gitDir(), 'commitCheck.item');
  let id = '';
  try { id = fs.readFileSync(marker, 'utf8').trim(); fs.unlinkSync(marker); } catch (e) { id = ''; }
  if (!id) end(0, 'commitCheck: no item to record under (the commit passed no check)');
  const subject = git(['log', '-1', '--format=%s']).stdout.trim();
  writePending(readPending().concat([{ id: id, subject: subject }]));
  end(0, 'commitCheck: ' + git(['rev-parse', '--short', 'HEAD']).stdout.trim() + ' is written under ' + id + ' when it is pushed');
}

// ── push ─────────────────────────────────────────────────────────────
// The commits this push carries, oldest first, each written under its item with the hash the remote will hold. A
// commit with nothing pending (made before the hooks, or by somebody else) is passed over.
function push() {
  const remote = String(process.argv[4] || 'origin');
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { input = ''; }
  const ZERO = /^0+$/;
  const hashes = [];
  input.split('\n').filter(Boolean).forEach(function (line) {
    const f = line.trim().split(/\s+/);
    const local = f[1];
    const theirs = f[3];
    if (!local || ZERO.test(local)) return;
    const range = theirs && !ZERO.test(theirs) ? [local, '^' + theirs] : [local, '--not', '--remotes=' + remote];
    git(['rev-list', '--reverse'].concat(range)).stdout.split('\n').map(function (h) { return h.trim(); }).filter(Boolean).forEach(function (h) {
      if (hashes.indexOf(h) === -1) hashes.push(h);
    });
  });
  let pending = readPending();
  function one(i) {
    if (i >= hashes.length) end(0, 'commitCheck: the push wrote every pending commit it carries');
    const hash = hashes[i];
    const subject = git(['log', '-1', '--format=%s', hash]).stdout.trim();
    const at = pending.findIndex(function (p) { return p.subject === subject; });
    if (at === -1) return one(i + 1);
    const id = pending[at].id;
    const files = git(['show', '--name-only', '--format=', hash]).stdout.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    const text = 'commit ' + hash + ': ' + subject.slice(0, 200) + '\n' + files.map(function (f) { return '- ' + f; }).join('\n');
    return desk('chat.add', { id: id, text: text }).then(function () {
      pending.splice(at, 1);
      writePending(pending);
      console.log('commitCheck: ' + hash.slice(0, 7) + ' written under ' + id + ' with ' + files.length + ' file(s)');
      return one(i + 1);
    });
  }
  return one(0);
}

if (what === 'install') install();
else if (what === 'check') check();
else if (what === 'record') record();
else push();
