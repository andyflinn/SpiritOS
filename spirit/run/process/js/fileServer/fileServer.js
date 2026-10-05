'use strict';

// spirit/run/process/js/fileServer/fileServer.js
// THE FILESERVER: files kept by their hash, one folder each (fileTransfer goal/G1).
//
//   Andy: "The basic file transfer design will be about one faceless app, the fileServer.
//   internally files are identified by their hash, to avoid duplication."
//
// Started by the node like desk: [this file, '{}', --pipe <pipe>, --state <folder>]. The store is
// the state folder the node names (relay-state/process/fileServer/); this process never works it
// out itself.
//
// ONE FOLDER PER FILE, NAMED BY ITS ID (goal/G1.1, goal/G1.3 THE FILE ID). The id is 'verb-' and
// the file's sha256 in base64url: 48 characters, one string for the folder, the verb that serves
// the file, the grant path and fileStatus.json's hash. Inside: complete.blob, the whole file and
// only a whole file, and fileStatus.json { hash, bytes, mime, name, at }.
//
// ONE LABEL PER HASH (goal/G5.2). Andy: "There will be only one label (file-name) per verb-hash. All
// the label arbitration will disappear.", "ah the same file added under a new name just replaces the
// labe.", "same is determined by hash." So the same bytes pushed again take the new name; other bytes
// under the same name are another file. A folder written before this with a names list reads as its
// last name, the one it was shared under.
//
// AT MOST 32 FILES, COMPLETE OR PARTIAL (goal/G1.5). Andy: "make the limit 32. that's enough.
// we'll find a method later to clean up that folder." The bound keeps every file's verb inside
// one api answer; push and fetch at the bound are refused pool-full.
//
// push, fetch and delete are the owner's alone, whatever apiAuth grants (Andy: "the fileServer
// will internally deny push and pull, no matter what apiAuth says.").

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const appServer = require('../../../js/appServer.js');
const MIME_TYPES = require('../../../js/kernel.js').core.const.MIME_TYPES;

const argv = process.argv;
const at = argv.indexOf('--state');
const STORE = at !== -1 ? argv[at + 1] : '';
if (!STORE) {
  console.error('fileServer: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STORE, { recursive: true });

const CAP = 32;
const ID_RE = /^verb-[A-Za-z0-9_-]{43}$/;
const BLOB = 'complete.blob';
const STATUS = 'fileStatus.json';

// SLOTS THE NODE RESERVES FOR ITSELF (goal/G5.3). Andy: "there will be slots in fileServer that are reserved by
// the node itself, like PROFILE_PICTURE.", "reserved labels can be updated with any file, the label stays.", "the
// reserved label is protected, the use cannot name a file PROFILE_PICTURE and add it to the pool...". Only fill puts
// a file into a slot; the file it replaces is deleted ("deleted.") and its grants move to the new one ("move the
// grants to the new file.").
const RESERVED = ['PROFILE_PICTURE'];

function refused(code, why) { const e = new Error(code); e.refusal = code; if (why) e.extra = { why: why }; return e; }
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }

// The one line that computes a file's id from its bytes (goal/G1.3: the bare sha256 lives here alone).
function idOf(bytes) { return 'verb-' + crypto.createHash('sha256').update(bytes).digest('base64url'); }

// Every folder in the store is a file held, complete or partial: the count the bound is checked against.
function held() {
  let names = [];
  try { names = fs.readdirSync(STORE, { withFileTypes: true }); } catch (e) { names = []; }
  return names.filter(function (d) { return d.isDirectory() && ID_RE.test(d.name); }).map(function (d) { return d.name; });
}
function isHeld(id) { return ID_RE.test(id) && fs.existsSync(path.join(STORE, id)); }

function readStatus(id) {
  try { return JSON.parse(fs.readFileSync(path.join(STORE, id, STATUS), 'utf8')); } catch (e) { return null; }
}
// The file's one label; an older fileStatus.json's names list gives its last.
function nameOf(s) {
  if (!s) return '';
  if (typeof s.name === 'string') return s.name;
  return Array.isArray(s.names) && s.names.length ? String(s.names[s.names.length - 1]) : '';
}
function writeStatus(id, status) {
  const file = path.join(STORE, id, STATUS);
  fs.writeFileSync(file + '.part', JSON.stringify(status));
  fs.renameSync(file + '.part', file);
}

// A file's own verb: the shape every hash-verb answers in (goal/G1.1, THE HASH-VERB'S SHAPE).
// Andy: "the provider delivers the info, and the chunks, nothing else". Who may ask is apiAuth's
// business at the door, not this server's. info answers the file's one name. chunk answers the asked bytes of complete.blob, base64.
// Every answer is marked no-rush (Andy: "same for responses."). pause and resume are the
// receiver's own, the owner's alone, on a file it is fetching.
function hashVerb(id) {
  return {
    request: { command: '', data: '' },
    reply: { command: '', data: '' },
    background: true,
    handler: function (a, caller) {
      if (a.command === 'info') {
        const s = readStatus(id);
        if (!s) throw refused('no-such-file');
        return { command: 'info', data: JSON.stringify({ bytes: s.bytes, mime: s.mime, name: nameOf(s) }) };
      }
      if (a.command === 'chunk') {
        let d = null;
        try { d = JSON.parse(a.data); } catch (e) { d = null; }
        const start = d && Number(d.start), length = d && Number(d.length);
        if (!d || !Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1) throw refused('bad-request', 'chunk data is {start, length}');
        const blob = path.join(STORE, id, BLOB);
        if (!fs.existsSync(blob)) throw refused('no-such-file');
        const buf = Buffer.alloc(length);
        const fd = fs.openSync(blob, 'r');
        let got = 0;
        try { got = fs.readSync(fd, buf, 0, length, start); } finally { fs.closeSync(fd); }
        return { command: 'chunk', data: buf.subarray(0, got).toString('base64') };
      }
      if (a.command === 'pause' || a.command === 'resume') {
        ownerOnly(caller);
        const t = transfers[id];
        if (!t) throw refused('no-such-file');
        if (a.command === 'pause') { if (t.state === 'fetching') t.state = 'paused'; }
        else if (t.state === 'paused' || t.state === 'stopped') { t.state = 'fetching'; t.failingSince = 0; turn(); }
        progress(id);
        return { command: a.command, data: '' };
      }
      throw refused('bad-request', 'the command ' + JSON.stringify(a.command) + ' is not served');
    },
  };
}

// ── THE TRANSFER (goal/G1.2) ───────────────────────────────────────
//
// The receiver pulls; the provider only answers (Andy: "the client must request subsets of the
// file, because our auth-scheme will only facilitate that direction."). One chunk-request is out
// at a time, the files taking turns; a turn is an attempt, answered or failed (Andy: "it's attempts
// only."). Every ask goes no-rush. The parts on disk are the only transfer state: each lands as
// <start>-<length>.blob under another name first, so a name never claims more than it holds; the
// gaps between them are what is still asked for.
const CHUNK = 6000;                // file bytes per chunk: base64 of it fits one answer (ANSWER_MAX)
const GIVE_UP_MS = 5 * 60 * 1000;  // Andy: "how long a download may keep failing before it stops; 5 minutes."
const RETRY_MS = 1000;             // the pause after a failed turn
const PART_RE = /^(\d+)-(\d+)\.blob$/;
const transfers = Object.create(null);  // id -> { from, state, failingSince }
let asking = false;
let lastTurn = '';

function partsOf(id) {
  let names = [];
  try { names = fs.readdirSync(path.join(STORE, id)); } catch (e) { names = []; }
  return names.map(function (n) { const m = PART_RE.exec(n); return m ? { name: n, start: Number(m[1]), length: Number(m[2]) } : null; })
    .filter(Boolean).sort(function (x, y) { return x.start - y.start; });
}
function heldBytes(id) { return partsOf(id).reduce(function (n, p) { return n + p.length; }, 0); }
function firstGap(id, bytes) {
  let at = 0;
  const parts = partsOf(id);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].start > at) return { start: at, length: parts[i].start - at };
    at = Math.max(at, parts[i].start + parts[i].length);
  }
  return at < bytes ? { start: at, length: bytes - at } : null;
}

// One row per change (goal/G1.2 PROGRESS); the page times the rows itself.
function progress(id) {
  const t = transfers[id];
  const s = readStatus(id);
  if (!t || !s) return;
  appServer.publish({ transfer: {
    id: id, name: nameOf(s),
    held: t.state === 'complete' ? (s ? s.bytes : 0) : heldBytes(id), bytes: s ? s.bytes : 0, state: t.state,
  } });
}

// The parts cover the file: joined, checked against the id they were asked under, one rename.
// A mismatch throws the parts away and the gaps are asked for again.
function finish(id) {
  const dir = path.join(STORE, id);
  const parts = partsOf(id);
  const whole = Buffer.concat(parts.map(function (p) { return fs.readFileSync(path.join(dir, p.name)); }));
  if (idOf(whole) !== id) {
    parts.forEach(function (p) { fs.rmSync(path.join(dir, p.name), { force: true }); });
    return false;
  }
  fs.writeFileSync(path.join(dir, BLOB + '.part'), whole);
  fs.renameSync(path.join(dir, BLOB + '.part'), path.join(dir, BLOB));
  parts.forEach(function (p) { fs.rmSync(path.join(dir, p.name), { force: true }); });
  return true;
}

function ask(id, command, data) {
  const one = {}; one[id] = { command: command, data: data };
  return require('../../../js/kernel.js').peerPost(transfers[id].from, 'api', { fileServer: one }, { kind: 'background' });
}

// The wheel: the next live download after the last one asked for, one ask, then the next turn.
function turn() {
  if (asking) return;
  const live = Object.keys(transfers).filter(function (id) { return transfers[id].state === 'fetching'; });
  if (!live.length) return;
  const id = live[(live.indexOf(lastTurn) + 1) % live.length] || live[0];
  lastTurn = id;
  asking = true;
  let failed = false;
  attempt(id).then(function (ok) {
    const t = transfers[id];
    failed = !ok;
    if (t) {
      if (ok) t.failingSince = 0;
      else if (!t.failingSince) t.failingSince = Date.now();
      else if (Date.now() - t.failingSince > GIVE_UP_MS && t.state === 'fetching') { t.state = 'stopped'; progress(id); }
    }
  }, function () { failed = true; }).then(function () {
    asking = false;
    // A failed turn waits a second before the next, so a peer that refuses at once is not asked in
    // a tight loop; an answered one goes straight on.
    setTimeout(turn, failed ? RETRY_MS : 0);
  });
}

// One attempt for one file: the info-call first if its size is unknown, else the first gap.
function attempt(id) {
  const t = transfers[id];
  const s = readStatus(id);
  if (!s || !(s.bytes >= 0)) {
    return ask(id, 'info', '').then(function (r) {
      let d = null;
      try { d = r && r.command === 'info' ? JSON.parse(r.data) : null; } catch (e) { d = null; }
      if (!d || !(d.bytes >= 0)) return false;
      writeStatus(id, { hash: id, bytes: d.bytes, mime: String(d.mime || ''), name: String(d.name || ''), at: new Date().toISOString() });
      progress(id);
      return true;
    });
  }
  const gap = firstGap(id, s.bytes);
  if (!gap) {
    if (finish(id)) { t.state = 'complete'; progress(id); delete transfers[id]; }
    else progress(id);
    return Promise.resolve(true);
  }
  const length = Math.min(gap.length, CHUNK);
  return ask(id, 'chunk', JSON.stringify({ start: gap.start, length: length })).then(function (r) {
    if (!r || r.command !== 'chunk' || typeof r.data !== 'string') return false;
    const bytes = Buffer.from(r.data, 'base64');
    if (!bytes.length || bytes.length > length) return false;
    const dir = path.join(STORE, id);
    const name = gap.start + '-' + bytes.length + '.blob';
    fs.writeFileSync(path.join(dir, name + '.part'), bytes);
    fs.renameSync(path.join(dir, name + '.part'), path.join(dir, name));
    progress(id);
    return true;
  });
}

const server = appServer.serve({
  push: {
    request: { path: '' }, reply: { hash: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      let bytes = null;
      try { bytes = fs.readFileSync(a.path); } catch (e) { throw refused('bad-request', 'cannot read ' + a.path); }
      const id = idOf(bytes);
      const name = path.basename(a.path);
      if (RESERVED.indexOf(name) !== -1) throw refused('bad-request', name + ' is a reserved label; fill puts a file into it');
      // The same bytes already held: no new folder, the new name replaces the label (goal/G5.2), unless the file
      // fills a slot: a slot's label stays (goal/G5.3).
      if (isHeld(id)) {
        const old = readStatus(id) || {};
        if (RESERVED.indexOf(nameOf(old)) !== -1) return { hash: id };
        writeStatus(id, { hash: id, bytes: bytes.length, mime: mimeOf(name), name: name, at: old.at || new Date().toISOString() });
        return { hash: id };
      }
      if (held().length >= CAP) throw refused('pool-full');
      const dir = path.join(STORE, id);
      fs.mkdirSync(dir, { recursive: true });
      // Written under another name, then one rename: a partial never looks whole.
      fs.writeFileSync(path.join(dir, BLOB + '.part'), bytes);
      fs.renameSync(path.join(dir, BLOB + '.part'), path.join(dir, BLOB));
      writeStatus(id, { hash: id, bytes: bytes.length, mime: mimeOf(name), name: name, at: new Date().toISOString() });
      server.addVerb(id, hashVerb(id));
      return { hash: id };
    },
  },
  // fill puts a file into a reserved slot (goal/G5.3): the new file takes the slot's label, its verb is served, the
  // grants on the file it replaces move to it, and that file is deleted.
  fill: {
    request: { slot: '', path: '' }, reply: { hash: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (RESERVED.indexOf(a.slot) === -1) throw refused('bad-request', JSON.stringify(a.slot) + ' is not a reserved slot');
      let bytes = null;
      try { bytes = fs.readFileSync(a.path); } catch (e) { throw refused('bad-request', 'cannot read ' + a.path); }
      const id = idOf(bytes);
      const old = held().filter(function (h) { return h !== id && nameOf(readStatus(h)) === a.slot; })[0] || '';
      if (!isHeld(id)) {
        if (held().length >= CAP) throw refused('pool-full');
        const dir = path.join(STORE, id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, BLOB + '.part'), bytes);
        fs.renameSync(path.join(dir, BLOB + '.part'), path.join(dir, BLOB));
      }
      writeStatus(id, { hash: id, bytes: bytes.length, mime: mimeOf(a.path), name: a.slot, at: new Date().toISOString() });
      try { server.addVerb(id, hashVerb(id)); } catch (e) { /* already served */ }
      if (!old) return { hash: id };
      // The new verb is served before its grant, or the node refuses it unknown-path (apiAuth.js 90).
      return moveGrants(old, id).then(function () {
        delete transfers[old];
        fs.rmSync(path.join(STORE, old), { recursive: true, force: true });
        try { server.dropVerb(old); } catch (e) { /* never served */ }
        return { hash: id };
      });
    },
  },
  // fetch answers at once; the transfer runs on after it (goal/G1.2). A folder already there is a
  // download resumed from its parts; a complete one asks nothing.
  fetch: {
    request: { id: '', from: '' }, reply: { id: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!ID_RE.test(a.id)) throw refused('bad-request', 'an id is verb- and 43 base64url characters');
      // The bound is checked before any peer is asked (goal/G1.5).
      if (!isHeld(a.id) && held().length >= CAP) throw refused('pool-full');
      if (fs.existsSync(path.join(STORE, a.id, BLOB))) return { id: a.id };
      fs.mkdirSync(path.join(STORE, a.id), { recursive: true });
      // The verb is born with the folder, so pause and resume have somewhere to go.
      try { server.addVerb(a.id, hashVerb(a.id)); } catch (e) { /* already served */ }
      transfers[a.id] = { from: a.from, state: 'fetching', failingSince: 0 };
      // The first row rides the info-call's answer: before it the name and size are unknown.
      turn();
      return { id: a.id };
    },
  },
  // pull never overwrites (Andy, on a different file already at the path: "fail: already exists.").
  // The same bytes already there are said, not refused: copied false, already true.
  pull: {
    request: { hash: '', path: '' }, reply: { copied: true, already: true },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!isHeld(a.hash) || !fs.existsSync(path.join(STORE, a.hash, BLOB))) throw refused('no-such-file');
      const blob = path.join(STORE, a.hash, BLOB);
      if (fs.existsSync(a.path)) {
        let there = null;
        try { there = fs.readFileSync(a.path); } catch (e) { throw refused('already-exists'); }
        if (idOf(there) === a.hash) return { copied: false, already: true };
        throw refused('already-exists');
      }
      // Written under another name, then one rename, so a half-copied file never sits at the path.
      try {
        fs.copyFileSync(blob, a.path + '.part');
        fs.renameSync(a.path + '.part', a.path);
      } catch (e) { try { fs.rmSync(a.path + '.part', { force: true }); } catch (x) { /* none */ } throw refused('bad-request', 'cannot write ' + a.path); }
      return { copied: true, already: false };
    },
  },
  status: {
    // name, one string, in place of the names list: Andy's yes on the verb change (goal/G5.2 Q2).
    request: { hash: '' }, reply: { hash: '', bytes: 0, mime: '', name: '', at: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const s = isHeld(a.hash) ? readStatus(a.hash) : null;
      if (!s) throw refused('no-such-file');
      return { hash: s.hash, bytes: s.bytes, mime: s.mime, name: nameOf(s), at: String(s.at || '') };
    },
  },
  delete: {
    request: { hash: '' }, reply: { deleted: true },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!isHeld(a.hash)) throw refused('no-such-file');
      delete transfers[a.hash];
      fs.rmSync(path.join(STORE, a.hash), { recursive: true, force: true });
      try { server.dropVerb(a.hash); } catch (e) { /* never served: a partial with no verb yet */ }
      return { deleted: true };
    },
  },
});

// Every grant on fileServer.<from> becomes one on fileServer.<to>, through the node's own loopback auth verbs
// (server.js jobs.authSearch, jobs.authGrant, jobs.authRevoke); no auth verb of its own. Run outside a node (no
// SPIRIT_CALLBACK_URL), there are no grants to move.
function moveGrants(from, to) {
  const url = process.env.SPIRIT_CALLBACK_URL;
  if (!url) return Promise.resolve();
  const base = new URL(url).origin;
  const ask = function (verb, args) { return require('../../../js/kernel.js').core.ask(verb, args, base).then(function (r) { return (r && r.body) || {}; }); };
  const fromPath = 'fileServer.' + from, toPath = 'fileServer.' + to;
  return ask('jobs.authSearch', { text: from }).then(function (found) {
    const rows = (found.records || []).filter(function (r) { return r.path === fromPath; });
    return rows.reduce(function (p, r) {
      return p.then(function () { return ask('jobs.authGrant', { key: r.key, path: toPath }); })
        .then(function () { return ask('jobs.authRevoke', { key: r.key, path: fromPath }); });
    }, Promise.resolve());
  }).catch(function (e) { console.error('fileServer: grants on ' + from + ' were not moved: ' + ((e && e.message) || e)); });
}

function mimeOf(name) { return MIME_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream'; }

// Files held before this start get their verbs back: the api lists what the store holds.
held().forEach(function (id) {
  if (fs.existsSync(path.join(STORE, id, BLOB))) { try { server.addVerb(id, hashVerb(id)); } catch (e) { /* already served */ } }
});
