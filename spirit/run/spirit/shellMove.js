'use strict';

// spirit/run/spirit/shellMove.js
// A NODE CARRIES ITS OWN FILES FROM app/ INTO shell/ — slim/G1.1; its
// app-state/ into relay-state/process/ (slim/G1.4); and relay-state/ into
// spirit/state/ (goal/G43.8, goal/G43.10), all below.
//
//   Andy, 2026-09-29: "shell replaces app", with the shell's own CSS at its
//   top. The rename is a git mv, and git moves only what it tracks. What a
//   live node keeps in app/ is gitignored (natter's relays, contacts'
//   files, appFaceApp's grants, fixList's fixes, the AI status), so a pull
//   leaves it behind in app/, where nothing reads it any more.
//
// So at start, before anything reads shell/, every file still in app/ moves
// to the same place under shell/, once, and each move is said. A file whose
// name shell/ already holds is KEPT where it is and said, never written over:
// the one in shell/ is the newer. Once app/ is empty it goes, and later
// starts find nothing to do and say nothing.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Where the shell lived before slim/G1.1; read here and nowhere else.
const LEGACY_APP_DIR = 'app';

function filesUnder(dir) {
  const out = [];
  (function walk(d, rel) {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else out.push(r);
    });
  })(dir, '');
  return out.sort();
}
function removeEmptyDirs(dir) {
  let es = [];
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  es.forEach(function (e) { if (e.isDirectory()) removeEmptyDirs(path.join(dir, e.name)); });
  try { if (!fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch (e) { /* not empty, or gone */ }
}

function moveLeftovers(rootDir, say) {
  const tell = typeof say === 'function' ? say : function (line) { console.log(line); };
  const from = path.join(rootDir, LEGACY_APP_DIR);
  const to = path.join(rootDir, 'shell');
  if (!fs.existsSync(from)) return { moved: [], kept: [] };
  const moved = [];
  const kept = [];
  filesUnder(from).forEach(function (rel) {
    const src = path.join(from, ...rel.split('/'));
    const dest = path.join(to, ...rel.split('/'));
    if (fs.existsSync(dest)) {
      kept.push(rel);
      tell('shell: kept app/' + rel + ' where it is: shell/' + rel + ' already exists');
      return;
    }
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      moved.push(rel);
      tell('shell: moved app/' + rel + ' to shell/' + rel);
    } catch (e) {
      kept.push(rel);
      tell('shell: could not move app/' + rel + ': ' + ((e && e.message) || e));
    }
  });
  removeEmptyDirs(from);
  return { moved: moved, kept: kept };
}

// A FACE'S STATE FOLLOWS IT INTO process/ (slim/G1.4). A face kept its
// state, its own identity among it, in app-state/<name>; it moves, once,
// whole, per face, to relay-state/process/<name>, where processes kept their
// state until goal/G43.10. server.js calls this after moveRelayState, so what
// it moves is carried on to spirit/state/<name>/data at the next boot, and
// only when process/js/<name>/ exists (moveProcessState, below); a face's
// folder with no such process stays in relay-state/process/. A folder the
// new place already holds is kept and said, never merged.
//
// DISCREPANCY WITH ANDY's RULES: goal/G41.30 (Andy: "let's get rid of those
// \"rescue operations\"", nodeStore.js) and the box of goal/G41.32 ("no
// \"old-data-rescue-missions\"") rule out moving old stores in. moveLeftovers
// (app/ into shell/, slim/G1.1) and moveAppState (app-state/, slim/G1.4)
// are such rescues, still called on every boot (server.js); the moves of
// goal/G43.8 and goal/G43.10 below are Andy's own later order, not this.
const LEGACY_APP_STATE_DIR = 'app-state';

function moveAppState(rootDir, say) {
  const tell = typeof say === 'function' ? say : function (line) { console.log(line); };
  const from = path.join(rootDir, LEGACY_APP_STATE_DIR);
  if (!fs.existsSync(from)) return { moved: [], kept: [] };
  const moved = [];
  const kept = [];
  let names = [];
  try { names = fs.readdirSync(from, { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }); }
  catch (e) { names = []; }
  names.forEach(function (name) {
    const dest = path.join(rootDir, 'relay-state', 'process', name);
    if (fs.existsSync(dest)) {
      kept.push(name);
      tell('shell: kept app-state/' + name + ' where it is: relay-state/process/' + name + ' already exists');
      return;
    }
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(path.join(from, name), dest);
      moved.push(name);
      tell('shell: moved app-state/' + name + ' to relay-state/process/' + name);
    } catch (e) {
      kept.push(name);
      tell('shell: could not move app-state/' + name + ': ' + ((e && e.message) || e));
    }
  });
  removeEmptyDirs(from);
  return { moved: moved, kept: kept };
}

// relay-state's OWN FILES MOVE TO spirit/state/ (goal/G43.8; Andy: "we move just the remaining files to spirit/state/", "flag day.").
// Everything at its top, files and folders, by what is there: Q3, "yes. include the garbage files. this is just about the move."
// process/ and shell/ stay. Once, at boot, before anything opens them: server.js and relayServer.js call this first of all, since
// spirit.js reads environment.json as it loads. A move that fails stops the node (Q2: "yes."): relay-state.
const STAYS_IN_RELAY_STATE = ['process', 'shell'];

// A rename a dying process still holds open on Windows fails for a moment: it is tried again, for a few seconds.
function renameSoon(from, to) {
  for (let tries = 40; ; tries--) {
    try { fs.renameSync(from, to); return; } catch (e) {
      if (tries <= 0 || (e.code !== 'EBUSY' && e.code !== 'EPERM' && e.code !== 'EACCES')) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}
// The public key an identity's private key gives, or a throw: what proves a copy is the same node.
function publicOf(id) {
  const key = crypto.createPrivateKey({ key: Buffer.from(String(id.privateKey), 'base64'), format: 'der', type: 'pkcs8' });
  return crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).toString('base64');
}
// The box: "identity.json: copy it, read the copy back, check it gives the same public key, then remove the old one. No second
// private key stays on disc, and a failed move cannot bring the node up as someone else."
function moveIdentity(from, to) {
  const was = JSON.parse(fs.readFileSync(from, 'utf8'));
  const want = publicOf(was);
  if (want !== was.publicKey) throw new Error('its private key does not give its public key');
  const tmp = to + '.tmp';
  fs.writeFileSync(tmp, fs.readFileSync(from), { mode: 0o600 });
  if (publicOf(JSON.parse(fs.readFileSync(tmp, 'utf8'))) !== want) { fs.unlinkSync(tmp); throw new Error('the copy does not read back'); }
  renameSoon(tmp, to);
  try { fs.chmodSync(to, 0o600); } catch (e) { /* no such thing on this disc */ }
  fs.unlinkSync(from);
}
function moveRelayStateTop(rootDir, say) {
  const tell = typeof say === 'function' ? say : function (line) { console.log(line); };
  const from = path.join(rootDir, 'relay-state');
  const to = path.join(rootDir, 'spirit', 'state');
  let names = [];
  try { names = fs.readdirSync(from).filter(function (n) { return STAYS_IN_RELAY_STATE.indexOf(n) === -1; }); } catch (e) { return { moved: [] }; }
  if (!names.length) return { moved: [] };
  const moved = [];
  try {
    fs.mkdirSync(to, { recursive: true });
    try { fs.chmodSync(to, 0o700); } catch (e) { /* no such thing on this disc */ }
    // The key last and alone, and proved before anything moves, so a broken key leaves the node as it found it.
    if (names.indexOf('identity.json') !== -1) publicOf(JSON.parse(fs.readFileSync(path.join(from, 'identity.json'), 'utf8')));
    names.filter(function (n) { return n !== 'identity.json'; }).forEach(function (n) {
      if (fs.existsSync(path.join(to, n))) throw new Error('spirit/state/' + n + ' already exists');
      renameSoon(path.join(from, n), path.join(to, n));
      moved.push(n);
    });
    if (names.indexOf('identity.json') !== -1) {
      if (fs.existsSync(path.join(to, 'identity.json'))) throw new Error('spirit/state/identity.json already exists');
      moveIdentity(path.join(from, 'identity.json'), path.join(to, 'identity.json'));
      moved.push('identity.json');
    }
  } catch (e) {
    console.error('state: could not move relay-state to spirit/state: ' + ((e && e.message) || e));
    process.exit(1);
  }
  tell('state: moved ' + moved.length + ' from relay-state to spirit/state: ' + moved.join(', '));
  return { moved: moved };
}

// A PROCESS'S FILES MOVE TO ITS data/ (goal/G43.10; Andy: "JUST state data.", "we will only move process relay-state data if the
// corresponding run://process/<name> still exists.", "whatever leftovers there are of now-eliminated process, we disregard"). Once, at
// boot, after relay-state's top. A folder with no process/js/<name>/ stays where it lies. door.sock, the sidecars (Q6) and bundles.json
// (Q13) stay: door.sock and the sidecars are not state data, and bundles.json is the node's own record (apiAuth.js). Every name is
// checked before anything moves, so a name data/ already holds stops the node (Q6) with nothing written over and nothing half moved.
const STAYS_WITH_PROCESS = ['door.sock', 'bundles.json'];
function staysWithProcess(rel) { return STAYS_WITH_PROCESS.indexOf(rel) !== -1 || rel.endsWith('.sidecar.json'); }
function moveProcessState(rootDir, say) {
  const tell = typeof say === 'function' ? say : function (line) { console.log(line); };
  const from = path.join(rootDir, 'relay-state', 'process');
  let names = [];
  try { names = fs.readdirSync(from, { withFileTypes: true }).filter(function (e) { return e.isDirectory(); }).map(function (e) { return e.name; }); } catch (e) { return { moved: [] }; }
  names = names.filter(function (n) { return fs.existsSync(path.join(rootDir, 'process', 'js', n)); });
  const moved = [];
  try {
    const moves = [];
    names.forEach(function (name) {
      filesUnder(path.join(from, name)).filter(function (rel) { return !staysWithProcess(rel); }).forEach(function (rel) {
        const dest = path.join(rootDir, 'spirit', 'state', name, 'data', ...rel.split('/'));
        if (fs.existsSync(dest)) throw new Error('spirit/state/' + name + '/data/' + rel + ' already exists');
        moves.push({ name: name, rel: rel, from: path.join(from, name, ...rel.split('/')), to: dest });
      });
    });
    moves.forEach(function (m) {
      fs.mkdirSync(path.dirname(m.to), { recursive: true });
      renameSoon(m.from, m.to);
      moved.push(m.name + '/' + m.rel);
    });
    names.forEach(function (name) { removeEmptyDirs(path.join(from, name)); });
  } catch (e) {
    console.error('state: could not move relay-state/process to spirit/state/<name>/data: ' + ((e && e.message) || e));
    process.exit(1);
  }
  if (moved.length) tell('state: moved ' + moved.length + ' from relay-state/process to spirit/state/<name>/data');
  return { moved: moved };
}
// server.js and relayServer.js call this first of all (above).
function moveRelayState(rootDir, say) {
  const top = moveRelayStateTop(rootDir, say);
  return { moved: top.moved, processes: moveProcessState(rootDir, say).moved };
}

// Whether this tree's key still waits at the old place for the boot's move (relayAuth asks before it would mint one).
function keyWaitsToMove(rootDir) { return fs.existsSync(path.join(rootDir, 'relay-state', 'identity.json')); }

module.exports = { moveLeftovers: moveLeftovers, moveAppState: moveAppState, moveRelayState: moveRelayState, keyWaitsToMove: keyWaitsToMove, LEGACY_APP_DIR: LEGACY_APP_DIR, LEGACY_APP_STATE_DIR: LEGACY_APP_STATE_DIR };
