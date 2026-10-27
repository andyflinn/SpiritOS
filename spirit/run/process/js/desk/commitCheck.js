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
// its subject and its patch (git patch-id, goal/G19.6), which a rebase keeps. Every ask
// goes through the agent's own deskClient (by its verbs on its node), so it is counted with the rest; with the node not
// answering, the commit is refused, not waved through.
//
//   node commitCheck.js install <port of the agent's own node>    in the clone's root: writes the two hooks
//   node commitCheck.js check <port> <message file>                the commit-msg hook (git runs it)
//   node commitCheck.js record <port>                              the post-commit hook (git runs it)
//   node commitCheck.js push <port> <remote name>                  the pre-push hook (git runs it, refs on stdin)
//   node commitCheck.js confirm <port> <job file>                  the detached helper push starts (goal/G4.27)
//
// The port lives in the hook text install writes; the item a check accepted waits in .git/commitCheck.item for the
// record that follows the commit, which moves it, with the commit's subject and patch-id, to .git/commitCheck.pending; the push
// writes each pending commit it carries and takes it off. A rebase replays commits through neither hook, so a
// pull --rebase passes. With the node not answering at the push, the push is refused and nothing is taken off.
// Exits: 0 taken; 1 refused or no node (the reason printed); 2 usage.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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

// One ask through this agent's own deskClient, as deskAgentEar asks it: deskClient's answer, parsed, as {status, body};
// a node that does not answer is no answer.
function viaClient(request) {
  let timer = null;
  const late = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('no answer in ' + NODE_WAIT_MS / 1000 + ' s')); }, NODE_WAIT_MS); });
  // Through the one spirit object (goal/G32.3, goal/G40.6): deskClient.desk on this clone's own node, as {status, body}.
  const ask = spirit.outcome(spirit.require('process/js/deskClient/deskClient.family/api.js').then(function (c) { return c.desk(request); }));
  return Promise.race([ask, late]).then(function (r) {
    clearTimeout(timer);
    // The desk's answer itself is the body (goal/G4.19): a refusal of the desk's or of deskClient's is ok false.
    if (!r || r.status !== 200 || !r.body || typeof r.body !== 'object') throw new Error('deskClient on port ' + port + ' answered ' + (r ? r.status + ' ' + JSON.stringify(r.body) : 'nothing'));
    return r.body;
  });
}
// One ask of the desk itself, for the push alone (its chat line, once the remote holds the commit): a refusal, or a
// node that does not answer, ends it as refused.
function desk(verb, args) {
  return viaClient({ name: verb, json: JSON.stringify(args) }).then(function (body) {
    if (body.ok === false) throw new Error('the desk answered ' + JSON.stringify(body));
    return body;
  }).catch(function (e) { end(1, 'commitCheck: REFUSED, the node on port ' + port + ' could not be asked ' + verb + ': ' + ((e && e.message) || e)); });
}
// A COMMIT ASKS THE DESK NOTHING (goal/G41.11). Andy: "the agents verifier has ALL the information needed for commits
// right on the agents node.... so we put in specific cache-searches into the deskClients api". Every ask the check makes
// is a kept read of deskClient's (KEPT_READS in deskClient.js), answered from its cache or refused not-kept, never asked
// of the desk; so a lagging desk refuses nothing the cache can say. Answers the body, a not-kept refusal included, for
// the caller to refuse with; any other refusal, or a node that does not answer, ends the check as refused.
function kept(verb, args) {
  return viaClient({ name: verb, json: JSON.stringify(args), kept: true }).then(function (body) {
    if (body.ok === false && body.code !== 'not-kept') throw new Error('deskClient answered ' + JSON.stringify(body));
    return body;
  }).catch(function (e) { end(1, 'commitCheck: REFUSED, the node on port ' + port + ' could not be asked ' + verb + ' from its cache: ' + ((e && e.message) || e)); });
}
// A kept read the cache could not answer refuses the commit, saying what was not there; nothing else is asked.
function notInCache(verb, id, body) {
  end(1, 'commitCheck: REFUSED, ' + verb + ' of ' + id + ' is not in the cache of deskClient on port ' + port + ': ' + String((body && (body.why || body.error)) || 'not kept') +
    '\n(the commit asks the desk nothing; once the desk has pushed the item to this node, commit again)');
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
// The items the message names, each read from deskClient's cache (goal/G41.11); the first with his Go and not done lets the commit through.
function check() {
  const file = String(process.argv[4] || '');
  let message = '';
  try { message = fs.readFileSync(file, 'utf8'); } catch (e) { end(1, 'commitCheck: no message file ' + file); }
  const ids = [];
  message.replace(ITEM, function (m, id) { if (ids.indexOf(id) === -1) ids.push(id); return m; });
  return ownFolderOnly().then(function (own) {
    if (own) end(0, 'commitCheck: agents/' + own + '/ alone: the standing grant for publishing takes it, no item needed');
    if (!ids.length) end(1, 'commitCheck: REFUSED, the message names no item (rule 4: an item of the current goal with his Go, such as area/G1.2)');
    return checkItems(ids);
  });
}

// THE STANDING GRANT FOR PUBLISHING (goal/G4.33). Andy: "automated publishing will have a standing grant, attached to
// the script in deskClient"; "and the whole agent-specific folders will be included per agent." A commit whose staged
// files all lie in agents/<this agent>/ passes with no item; the agent is the name Andy set in its profile. Any other
// file, or another agent's folder, is checked as before. Answers the agent's name, or '' when the grant does not apply.
function ownFolderOnly() {
  const staged = git(['diff', '--cached', '--name-only']).stdout.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!staged.length || !staged.every(function (f) { return /^agents\//.test(f); })) return Promise.resolve('');
  // goal/G41.11: the agent is the one its deskClient serves (a kept item.get names it as self), not asked of the desk.
  return kept('item.get', {}).then(function (p) {
    const name = String((p && p.ok !== false && p.self) || '');
    const mine = 'agents/' + name + '/';
    return name && staged.every(function (f) { return f.indexOf(mine) === 0; }) ? name : '';
  });
}

// goal/G41.11: the current goal is the one the kept item.get names beside the facts (current), not an items.search.
function checkItems(ids) {
  const reasons = [];
  function one(i) {
    if (i >= ids.length) end(1, 'commitCheck: REFUSED (rules 3 and 4)\n' + reasons.join('\n'));
    const id = ids[i];
    return kept('item.get', { id: id }).then(function (got) {
      let f = null;
      try { f = got.ok === false ? null : JSON.parse(got.item); } catch (e) { f = null; }
      if (!f) { reasons.push('- ' + id + ': not in the cache of deskClient (' + String(got.why || 'not kept') + '); only an item of the current goal is kept'); return one(i + 1); }
      if (!got.current || f.goal !== got.current) { reasons.push('- ' + id + ': not an item of the current goal'); return one(i + 1); }
      if (f.status === 'done' || f.status === 'closed') { reasons.push('- ' + id + ': ' + f.status + ' already; nothing is owed on it'); return one(i + 1); }
      if (f.go !== true) { reasons.push('- ' + id + ': Andy has not pressed Go on it'); return one(i + 1); }
      return Promise.all([kept('item.files', { id: id }), kept('item.checks', { id: id })]).then(function (parts) {
        const files = parts[0];
        const checks = parts[1];
        if (files.ok === false || !Array.isArray(files.files)) notInCache('item.files', id, files);
        if (files.filesMore !== false) notInCache('item.files', id, { why: 'the kept file list of ' + id + ' is cut short' });
        if (checks.ok === false || !Array.isArray(checks.checks)) notInCache('item.checks', id, checks);
        onTheList(id, files.files, checks.checks);
        redWriterBuilds(id, f, got, checks.checks);
        fs.writeFileSync(path.join(gitDir(), 'commitCheck.item'), id);
        end(0, 'commitCheck: ' + id + ' has his Go; the commit is taken');
      });
    });
  }
  return one(0);
}

// ── the core grants (goal/G4.23) ───────────────────────────────────
// Andy: "it should refuse to commit a core file that was not granted, and raise an ERROR icon in my list, and a
// grant request in the item?". A staged core file (spirit/run/spirit/coreFiles.js) needs a granted G check on the item
// naming its path under spirit/run. Refused without it. SINCE goal/G32.2 THE REFUSAL RAISES NO GRANT OF ITS OWN: one G
// check per file (64 on G32.2) outgrew the item's one answer and Desk refused his grants. It says to list the files
// with item.files.add instead, whose one grant for all the core files (goal/G8.8: "all files that need a grant should
// get one 'grant' button together") he grants once. A path is matched whole against a grant's comma list, as the full
// repository path or under spirit/run, never as the end of a longer path.
// NO SCOPE SINCE goal/G10.8: Andy, 2026-10-12, "all agents in desk have "/" file scope", the per-agent setting removed
// from desk and commitCheck ("b"). Every agent commits anywhere in the repo; the core grants still hold.
// EVERY STAGED FILE ON THE LIST, CORE OR NOT (goal/G41.11). The item's whole kept list (item.files, filesMore false;
// one cut short refused above) is the list: a staged file not on it is refused by name, core or not.
// ONE GRANT FOR THE LIST (goal/G40.3). Andy: "yes to the commit-check making sure each file exists in the granted
// list." A staged core file needs the list's one core grant standing granted (from the kept checks): a core file added
// after his press voids it, so a granted one covers every core file on the list.
function onTheList(id, files, checks) {
  const staged = git(['diff', '--cached', '--name-only']).stdout.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  const top = git(['rev-parse', '--show-toplevel']).stdout.trim();
  const paths = files.map(function (f) { return String((f && f.path) || ''); });
  // By the full repository path, or the same path under spirit/run, never as the end of a longer path.
  const listed = function (f) { return paths.indexOf(f) !== -1 || (f.indexOf('spirit/run/') === 0 && paths.indexOf(f.slice('spirit/run/'.length)) !== -1); };
  const missing = staged.filter(function (f) { return !listed(f); });
  if (missing.length) {
    end(1, 'commitCheck: REFUSED (list): staged files not on the list of ' + id + ': add each with item.files.add' +
      (missing.some(function (f) { return require('../../../spirit/coreFiles.js').isCore(f, top); }) ? ', then Andy grants the list.' : '.') + '\n' +
      missing.map(function (f) { return '- ' + f; }).join('\n'));
  }
  const core = staged.filter(function (f) { return require('../../../spirit/coreFiles.js').isCore(f, top); });
  if (!core.length) return;
  const granted = checks.some(function (c) { return !!c && c.kind === 'G' && String(c.words).indexOf('core grant: ') === 0 && c.state === 'granted'; });
  if (granted) return;
  end(1, 'commitCheck: REFUSED (grant): the list of ' + id + ' has no standing grant: Andy grants the whole list once, and a core file added after it asks again.\n' +
    core.map(function (f) { return '- ' + f; }).join('\n'));
}

// ── the red writer's build (goal/G5.9) ─────────────────────────────
// Andy, to Q7: "it should trigger a red GRANT request for me." Whether this agent may commit on the item is the desk's
// phase.may, read here from the kept facts (goal/G41.11: a commit asks the desk nothing), as phase.may reads its own:
// not while its own red Q is open on the item, nor while the item, its goal or the current goal is in design; and not
// by the agent who wrote the red of a code item in build, unless he waived it or a G check "red writer builds" on the
// item stands granted. Refused, it says why; the grant request is the agent's to place (check.add), since the commit
// writes nothing to the desk.
function redWriterBuilds(id, f, got, checks) {
  const self = String(got.self || '');
  const names = (f.names && typeof f.names === 'object') ? f.names : {};
  const nameOf = function (label) { return names[label] || label; };
  let why = '';
  const q = checks.filter(function (c) { return !!c && c.kind === 'Q' && c.state === 'open' && c.placedBy === self; })[0];
  if (q) why = 'red Q: ' + q.number + ' of ' + self + ' is open on ' + id + '; it is resolved with Andy before anything lands';
  else if (f.design === true || got.goalDesign === true) why = 'design: ' + id + ' or its goal is in design, so no commit lands';
  else if (f.code === true && f.phase === 'build' && f.waived !== true && !!f.red && nameOf(f.red) === self) why = 'red writer: ' + self + ' wrote the red of ' + id + ', which is in build';
  if (!why) return;
  const mine = checks.filter(function (c) { return !!c && c.kind === 'G' && /red writer builds/i.test(String(c.words)); });
  if (mine.some(function (c) { return c.state === 'granted'; })) return;
  end(1, 'commitCheck: REFUSED (red writer): ' + why + (mine.length ? ' (a grant request is under the item)' :
    ' (ask his grant: check.add on ' + id + ', kind G, words "red writer builds: ' + why + '")'));
}

// ── record ───────────────────────────────────────────────────────────
// The commit just made waits for its push, under the item the check accepted, known by its subject and its patch.
function pendingFile() { return path.join(gitDir(), 'commitCheck.pending'); }
function readPending() {
  let raw = '';
  try { raw = fs.readFileSync(pendingFile(), 'utf8'); } catch (e) { raw = ''; }
  return raw.split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function writePending(list) { fs.writeFileSync(pendingFile(), list.map(function (p) { return JSON.stringify(p) + '\n'; }).join('')); }
// A PENDING COMMIT IS KNOWN BY ITS SUBJECT AND ITS PATCH (goal/G19.6; the box: "commitCheck keys a pending commit by
// more than its subject"). By the subject alone a second commit saying the same words, one that passed no check, was
// written under the first one's item and took its place. The patch is git patch-id --stable of the commit's diff: a
// pull --rebase gives the commit a new hash but keeps its patch, so it is still found at the push; a rebase that had to
// resolve a clash in it changes the patch, and that commit is then passed over as one with nothing pending. An entry
// written before goal/G19.6 has no patch and is matched by its subject, as then.
function patchOf(hash) {
  const diff = spawnSync('git', ['show', '--format=', '-p', hash], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const id = spawnSync('git', ['patch-id', '--stable'], { input: String(diff.stdout || ''), encoding: 'utf8', timeout: 30000, windowsHide: true });
  return (String(id.stdout || '').trim().split(/\s+/)[0]) || '';
}
function pendingAt(pending, hash) {
  const subject = git(['log', '-1', '--format=%s', hash]).stdout.trim();
  let patch = null;
  return pending.findIndex(function (p) {
    if (p.subject !== subject) return false;
    if (typeof p.patch !== 'string') return true;
    if (patch === null) patch = patchOf(hash);
    return p.patch === patch;
  });
}
function record() {
  const marker = path.join(gitDir(), 'commitCheck.item');
  let id = '';
  try { id = fs.readFileSync(marker, 'utf8').trim(); fs.unlinkSync(marker); } catch (e) { id = ''; }
  if (!id) end(0, 'commitCheck: no item to record under (the commit passed no check)');
  const subject = git(['log', '-1', '--format=%s']).stdout.trim();
  writePending(readPending().concat([{ id: id, subject: subject, patch: patchOf('HEAD') }]));
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
      return pendingAt(pending, h) !== -1;
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
      const at = pendingAt(pending, hash);
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
