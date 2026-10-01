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
// only a whole file, and fileStatus.json { hash, bytes, mime, names, at }.
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
function writeStatus(id, status) {
  const file = path.join(STORE, id, STATUS);
  fs.writeFileSync(file + '.part', JSON.stringify(status));
  fs.renameSync(file + '.part', file);
}

// A file's own verb: the shape every hash-verb answers in (goal/G1.1, THE HASH-VERB'S SHAPE).
// Andy: "the provider delivers the info, and the chunks, nothing else". Who may ask is apiAuth's
// business at the door, not this server's. info answers one name, the one being shared (the
// newest), never the owner's list. chunk is goal/G1.2's to build; until then it is refused by name.
function hashVerb(id) {
  return {
    request: { command: '', data: '' },
    reply: { command: '', data: '' },
    handler: function (a) {
      if (a.command === 'info') {
        const s = readStatus(id);
        if (!s) throw refused('no-such-file');
        const names = Array.isArray(s.names) ? s.names : [];
        return { command: 'info', data: JSON.stringify({ bytes: s.bytes, mime: s.mime, name: names.length ? names[names.length - 1] : '' }) };
      }
      throw refused('bad-request', 'the command ' + JSON.stringify(a.command) + ' is not served');
    },
  };
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
      // The same bytes already held: no new folder, the name joins the list (Andy: "add the
      // filename to the names.").
      if (isHeld(id)) {
        const status = readStatus(id) || { hash: id, bytes: bytes.length, mime: mimeOf(name), names: [] };
        if (status.names.indexOf(name) === -1) status.names.push(name);
        writeStatus(id, status);
        return { hash: id };
      }
      if (held().length >= CAP) throw refused('pool-full');
      const dir = path.join(STORE, id);
      fs.mkdirSync(dir, { recursive: true });
      // Written under another name, then one rename: a partial never looks whole.
      fs.writeFileSync(path.join(dir, BLOB + '.part'), bytes);
      fs.renameSync(path.join(dir, BLOB + '.part'), path.join(dir, BLOB));
      writeStatus(id, { hash: id, bytes: bytes.length, mime: mimeOf(name), names: [name], at: new Date().toISOString() });
      server.addVerb(id, hashVerb(id));
      return { hash: id };
    },
  },
  fetch: {
    request: { id: '', from: '' }, reply: { id: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!ID_RE.test(a.id)) throw refused('bad-request', 'an id is verb- and 43 base64url characters');
      // The bound is checked before any peer is asked (goal/G1.5).
      if (!isHeld(a.id) && held().length >= CAP) throw refused('pool-full');
      // Asking the peer is goal/G1.2's to build.
      throw refused('bad-request', 'fetching from a peer is not built yet');
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
    request: { hash: '' }, reply: { hash: '', bytes: 0, mime: '', names: [''], at: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const s = isHeld(a.hash) ? readStatus(a.hash) : null;
      if (!s) throw refused('no-such-file');
      return { hash: s.hash, bytes: s.bytes, mime: s.mime, names: s.names, at: String(s.at || '') };
    },
  },
  delete: {
    request: { hash: '' }, reply: { deleted: true },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!isHeld(a.hash)) throw refused('no-such-file');
      fs.rmSync(path.join(STORE, a.hash), { recursive: true, force: true });
      try { server.dropVerb(a.hash); } catch (e) { /* never served: a partial with no verb yet */ }
      return { deleted: true };
    },
  },
});

function mimeOf(name) { return MIME_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream'; }

// Files held before this start get their verbs back: the api lists what the store holds.
held().forEach(function (id) {
  if (fs.existsSync(path.join(STORE, id, BLOB))) { try { server.addVerb(id, hashVerb(id)); } catch (e) { /* already served */ } }
});
