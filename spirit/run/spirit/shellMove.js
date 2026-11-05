'use strict';

// spirit/run/spirit/shellMove.js
// A NODE CARRIES ITS OWN FILES FROM app/ INTO shell/ — slim/G1.1.
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
// state, its own identity among it, in app-state/<name>; every process keeps
// its state in relay-state/process/<name>. Moved once, whole, per face; a
// folder the new place already holds is kept and said, never merged.
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
function moveRelayState(rootDir, say) {
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

// Whether this tree's key still waits at the old place for the boot's move (relayAuth asks before it would mint one).
function keyWaitsToMove(rootDir) { return fs.existsSync(path.join(rootDir, 'relay-state', 'identity.json')); }

module.exports = { moveLeftovers: moveLeftovers, moveAppState: moveAppState, moveRelayState: moveRelayState, keyWaitsToMove: keyWaitsToMove, LEGACY_APP_DIR: LEGACY_APP_DIR, LEGACY_APP_STATE_DIR: LEGACY_APP_STATE_DIR };
