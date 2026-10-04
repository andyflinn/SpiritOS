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
// is written under that item as one chat line ONCE THE REMOTE HOLDS IT (goal/G4.19, issue 6; Andy: "Push it is.";
// goal/G4.27: a detached helper waits for the remote, since the pre-push hook runs before the server answers): its
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
//   node commitCheck.js confirm <port> <job file>                  the detached helper push starts (goal/G4.27)
//
// The port lives in the hook text install writes; the item a check accepted waits in .git/commitCheck.item for the
// record that follows the commit, which moves it, with the commit's subject, to .git/commitCheck.pending; the push
// writes each pending commit it carries and takes it off. A rebase replays commits through neither hook, so a
// pull --rebase passes. With the node not answering at the push, the push is refused and nothing is taken off.
// Exits: 0 taken; 1 refused or no node (the reason printed); 2 usage.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const kernel = require('../../../js/kernel.js');

const USAGE = 'usage: node commitCheck.js install <port> | check <port> <message file> | record <port> | push <port> <remote>';
const NODE_WAIT_MS = 20000;
const ITEM = /\b([A-Za-z][\w-]*\/G\d+\.\d+)\b/g;

const what = String(process.argv[2] || '');
const port = Number(process.argv[3]);
if (['install', 'check', 'record', 'push', 'confirm'].indexOf(what) === -1 || !Number.isInteger(port) || port <= 0) { console.error(USAGE); process.exit(2); }

function end(code, text) { (code ? console.error : console.log)(text); process.exit(code); }
// windowsHide: the detached confirm helper has no console, and without it Windows makes one for every git it runs
// (about 1.4 s each, measured).
function git(args) { return spawnSync('git', args, { encoding: 'utf8', timeout: 30000, windowsHide: true }); }
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
  return desk('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }).then(function (goals) {
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
        return scopeAndGrants(id).then(function () {
          fs.writeFileSync(path.join(gitDir(), 'commitCheck.item'), id);
          end(0, 'commitCheck: ' + id + ' has his Go; the commit is taken');
        });
      });
    }
    return one(0);
  });
}

// ── the scope and the core grants (goal/G4.23) ───────────────────────
// Andy: "it should refuse to commit a core file that was not granted, and raise an ERROR icon in my list, and a
// grant request in the item?", "the default: nothing", "the scope still has a grant-lock on core files.". Every staged
// file must lie in this agent's one scope (scope.get, as he set it); a staged core file (coreFiles.js) also
// needs a granted G check on the item naming its path under spirit/run. Refused without it, and the refusal puts one
// open G check "core grant: <path>" under the item, once, so his List shows it.
function scopeAndGrants(id) {
  const staged = git(['diff', '--cached', '--name-only']).stdout.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  const top = git(['rev-parse', '--show-toplevel']).stdout.trim();
  return desk('scope.get', { agent: '' }).then(function (scope) {
    // One field (goal/G4.23; Andy: "you set one field: '' = nothing '/' = repo-root"): '' nothing, '/' the repo root,
    // else a folder.
    const one = typeof scope.folder === 'string' ? scope.folder : '';
    const outside = one === '/' ? [] : staged.filter(function (f) { return one === '' || f.indexOf(one) !== 0; });
    if (outside.length) {
      end(1, 'commitCheck: REFUSED (scope): outside the scope Andy set for this agent (' + (one === '' ? 'none yet' : one === '/' ? '/ (the repo root)' : one) + '):\n' +
        outside.map(function (f) { return '- ' + f; }).join('\n'));
    }
    const core = staged.filter(function (f) { return require('./coreFiles.js').isCore(f, top); });
    if (!core.length) return null;
    const under = function (f) { return f.replace(/^spirit\/run\//, ''); };
    return desk('item.checks', { id: id }).then(function (got) {
      const checks = Array.isArray(got.checks) ? got.checks : [];
      const grants = checks.filter(function (c) { return c.kind === 'G'; });
      const ungranted = core.filter(function (f) { return !grants.some(function (c) { return c.state === 'granted' && c.words.indexOf(under(f)) !== -1; }); });
      if (!ungranted.length) return null;
      const toAsk = ungranted.filter(function (f) { return !grants.some(function (c) { return c.words.indexOf(under(f)) !== -1; }); });
      return toAsk.reduce(function (chain, f) {
        return chain.then(function () { return desk('check.add', { id: id, kind: 'G', words: 'core grant: ' + under(f), test: '' }); });
      }, Promise.resolve()).then(function () {
        end(1, 'commitCheck: REFUSED (grant): core files Andy has not granted under ' + id + ' (a grant request is under the item):\n' +
          ungranted.map(function (f) { return '- ' + f; }).join('\n'));
      });
    });
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
// The commits this push carries, oldest first, by the ref they go to. The pre-push hook runs BEFORE the server
// answers, so nothing is written here (goal/G4.27; Andy, to "Fix it so the line is written only once GitHub holds the
// commit": "if that's what's needed. do it."): the hook hands the commits to a detached helper (confirm, below) and
// returns, and the push goes on. A commit with nothing pending (made before the hooks, or by somebody else) is passed
// over; pending entries stay until the helper has written them, so a refused push leaves them for the next one.
const CONFIRM_WAIT_MS = 60000;
function push() {
  const remote = String(process.argv[4] || 'origin');
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch (e) { input = ''; }
  const ZERO = /^0+$/;
  const pending = readPending();
  const seen = [];
  const refs = [];
  input.split('\n').filter(Boolean).forEach(function (line) {
    const f = line.trim().split(/\s+/);
    const local = f[1];
    const ref = f[2];
    const theirs = f[3];
    if (!local || ZERO.test(local)) return;
    const range = theirs && !ZERO.test(theirs) ? [local, '^' + theirs] : [local, '--not', '--remotes=' + remote];
    const commits = git(['rev-list', '--reverse'].concat(range)).stdout.split('\n').map(function (h) { return h.trim(); }).filter(function (h) {
      if (!h || seen.indexOf(h) !== -1) return false;
      seen.push(h);
      const subject = git(['log', '-1', '--format=%s', h]).stdout.trim();
      return pending.some(function (p) { return p.subject === subject; });
    });
    if (commits.length) refs.push({ ref: ref, sha: local, commits: commits });
  });
  if (!refs.length) end(0, 'commitCheck: the push carries no pending commit');
  const job = path.join(gitDir(), 'commitCheck.confirm.' + process.pid + '.json');
  fs.writeFileSync(job, JSON.stringify({ remote: remote, refs: refs }));
  spawn(process.execPath, [__filename, 'confirm', String(port), job], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  const n = refs.reduce(function (a, r) { return a + r.commits.length; }, 0);
  end(0, 'commitCheck: ' + n + ' pending commit(s) are written under their items once the remote holds them');
}

// ── confirm ──────────────────────────────────────────────────────────
// The detached helper: asks the remote (git ls-remote) four times a second until each ref holds what was pushed, or a commit
// the push carried lies under what it holds; then writes each commit under its item with the id the remote holds. A
// push the server refused never shows, and after CONFIRM_WAIT_MS the helper gives up and writes nothing. Two helpers
// (a refused push, then a second) may both see the same commit land: a lock file and a re-read of the pending list
// let only the first write it.
function holds(remote, ref, sha, hash) {
  const r = git(['ls-remote', remote, ref]);
  const tip = (r.stdout.split('\n')[0] || '').trim().split(/\s+/)[0] || '';
  if (!tip) return false;
  if (tip === sha) return true;
  return git(['merge-base', '--is-ancestor', hash, tip]).status === 0;
}
function withLock(fn) {
  const lock = path.join(gitDir(), 'commitCheck.lock');
  const until = Date.now() + 30000;
  const tryIt = function () {
    let fd = -1;
    try { fd = fs.openSync(lock, 'wx'); } catch (e) {
      if (Date.now() > until) { try { fs.unlinkSync(lock); } catch (e2) { /* gone */ } }
      return new Promise(function (r) { setTimeout(r, 200); }).then(tryIt);
    }
    fs.closeSync(fd);
    return Promise.resolve().then(fn).then(function (v) { try { fs.unlinkSync(lock); } catch (e) { /* gone */ } return v; },
      function (e) { try { fs.unlinkSync(lock); } catch (e2) { /* gone */ } throw e; });
  };
  return tryIt();
}
function confirm() {
  const job = String(process.argv[4] || '');
  let work = null;
  try { work = JSON.parse(fs.readFileSync(job, 'utf8')); } catch (e) { work = null; }
  try { fs.unlinkSync(job); } catch (e) { /* gone */ }
  if (!work || !Array.isArray(work.refs)) end(1, 'commitCheck: no confirm job ' + job);
  const until = Date.now() + CONFIRM_WAIT_MS;
  const write = function (hash) {
    return withLock(function () {
      const pending = readPending();
      const subject = git(['log', '-1', '--format=%s', hash]).stdout.trim();
      const at = pending.findIndex(function (p) { return p.subject === subject; });
      if (at === -1) return null;
      const id = pending[at].id;
      const files = git(['show', '--name-only', '--format=', hash]).stdout.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      const text = 'commit ' + hash + ': ' + subject.slice(0, 200) + '\n' + files.map(function (f) { return '- ' + f; }).join('\n');
      return desk('chat.add', { id: id, text: text }).then(function () {
        pending.splice(at, 1);
        writePending(pending);
      });
    });
  };
  const round = function (left) {
    const still = [];
    return left.reduce(function (chain, r) {
      return chain.then(function () {
        if (!holds(work.remote, r.ref, r.sha, r.commits[r.commits.length - 1])) { still.push(r); return null; }
        return r.commits.reduce(function (c, h) { return c.then(function () { return write(h); }); }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () {
      if (!still.length) end(0, 'commitCheck: confirmed');
      if (Date.now() > until) end(0, 'commitCheck: the remote never held it; nothing written');
      return new Promise(function (res) { setTimeout(res, 250); }).then(function () { return round(still); });
    });
  };
  return round(work.refs);
}

if (what === 'install') install();
else if (what === 'check') check();
else if (what === 'record') record();
else if (what === 'confirm') confirm();
else push();
