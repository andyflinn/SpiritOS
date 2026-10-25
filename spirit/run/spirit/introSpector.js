'use strict';

// spirit/run/spirit/introSpector.js
// ONE FAMILY FOLDER, READ AND WRITTEN BY ITS OWNER (goal/G10.5, made FS alone by goal/G30.4).
//
//   A family folder holds AGENTS.md and one description file per verb (<verb>.json), and whatever its consumers
//   place there (verb.design.md, README.md, <verb>.warning.txt). It never holds code: the node's families are
//   js/<family>/, an app's is <module>.family beside its <module>.js.
//
//   family(folder) answers the folder's FS verbs, FS.<name> with the kernel's fs names and a search, scoped to the
//   folder. The AGENTS verbs that stood here (AGENTS, AGENTS.introspect, AGENTS.<verb>) are gone: an agent reads
//   AGENTS.md and the verb files through FS (Andy, 2026-10-20: "cannot the agent simply use FS to retrieve the
//   AGENTS.md file of the verb.json files?"). The verb file is still the allow mark: deskAgent offers a model only
//   a verb that has one.
//
// WHICH .json FILES ARE VERB FILES: one whose name is a verb name, that is not the server's manifest, and that
// parses to an object with a string description. A verb file naming a verb nobody declared is said at boot.

// The spirit object first, as the global spirit (goal/G40.1): app servers load this file too, so it takes from spirit what it took from kernel.js.
require('../spirit.js');
const fs = require('fs');
const path = require('path');
// The node's file system, for the annotations of a folder under spirit/run (goal/G40.6).
const fileSystem = require('./fileSystem');
// The probability modules (goal/G29.19): FS.search ranks with them.
const createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
const probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;

const AGENTS_FILE = 'AGENTS.md';
// A verb name as the server takes it, without the family's own uppercase.
const STEM_RE = /^[a-z_][A-Za-z0-9_.-]{0,63}$/;

function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function refusal(code, extra) {
  const e = new Error(code);
  e.refusal = code;
  if (extra) e.extra = extra;
  return e;
}

// The room one answer has.
function room() { return require('./limits').ANSWER_MAX; }

// The verb files of a folder: {stem: fileName}, and the files that name no
// declared verb. `declared` is the list of verb names the module answers,
// each as the file's stem names it (with the namespace prefix stripped on
// the node, where the folder is the namespace).
function readFolder(dir, declared, manifest) {
  const out = { files: Object.create(null), stale: [] };
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  names.sort().forEach(function (name) {
    if (!/\.json$/.test(name) || name === manifest) return;
    const stem = name.slice(0, -5);
    if (!STEM_RE.test(stem)) return;
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (e) { parsed = null; }
    if (!isPlain(parsed) || typeof parsed.description !== 'string') return;
    if (declared.indexOf(stem) === -1) { out.stale.push(name); return; }
    out.files[stem] = name;
  });
  return out;
}

// THE FAMILY OF ONE FOLDER, in the declaration form {request, reply, handler}.
// opts: { declared: [stem...], manifest, prefix, declarations }
//   prefix        '' on a process server, 'fs.' on the node: it goes before
//                 every verb name the family answers and lists
//   declarations  {verb: {request, reply}} on the node, joined into the
//                 per-verb answer; a process server's file answers as is
// Answers { verbs: {name: declaration}, stale: [fileName] }; no AGENTS.md,
// no verbs at all, and nothing is said of the folder.
// ── FS: THE FAMILY FOLDER, TO ITS OWNER (goal/G30.4) ─────────────────────
//
//   Andy, 2026-10-20: "introSpector will ALWAYS supply the following owner-VERB: FS: it will be a spirit.fs object,
//   scoped to the introSpectors folder", "it will allow any introSpector consumer to place it's on remarks into that
//   folder, for example verb.design.md, README.md for the family", "the exact names that kernel.js has in the fs
//   section, scoped to the family folder in the same way that the kernel equivalents are scoped to spirit/run/", and
//   on listing, "then put a search in there."
//
// One owner verb, multiplexed as AGENTS is: FS.<name>, with the kernel's own names. A path is inside the folder or
// refused; nothing above it is ever reached. A family folder holds no code (an app's is <module>.family beside its
// <module>.js), so the folder needs no fence of its own. Annotations are the node's sidecars, so those two go
// through fileSystem.js, for a folder under spirit/run.
function fsVerbs(dir, prefix) {
  const root = path.resolve(String(dir || ''));
  function inside(p) {
    const rel = String(p == null ? '' : p);
    if (!rel || path.isAbsolute(rel)) throw refusal('bad-request', { why: 'a path inside the family folder' });
    const full = path.resolve(root, rel);
    if (full.indexOf(root + path.sep) !== 0) throw refusal('bad-request', { why: 'nothing above the family folder' });
    return full;
  }
  function underRun(full) {
    const rel = path.relative(fileSystem.ROOT_DIR, full);
    if (!rel || rel.indexOf('..') === 0 || path.isAbsolute(rel)) throw refusal('bad-request', { why: 'annotations live under spirit/run' });
    return { rel: rel.split(path.sep).join('/') };
  }
  function read(full) { try { return fs.readFileSync(full, 'utf8'); } catch (e) { return null; } }
  function write(full, text) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(text == null ? '' : text), 'utf8');
    return { saved: true };
  }
  const v = {};
  v[prefix + 'FS.loadFile'] = { request: { path: '' }, reply: {}, handler: function (a) { return { text: read(inside(a.path)) }; } };
  v[prefix + 'FS.saveFile'] = { request: { path: '', content: '' }, reply: { saved: true }, handler: function (a) { return write(inside(a.path), a.content); } };
  v[prefix + 'FS.deleteFile'] = { request: { path: '' }, reply: { deleted: false }, handler: function (a) {
    const full = inside(a.path);
    try { fs.unlinkSync(full); return { deleted: true }; } catch (e) { return { deleted: false }; }
  } };
  v[prefix + 'FS.statFile'] = { request: { path: '' }, reply: {}, handler: function (a) {
    try { const s = fs.statSync(inside(a.path)); return { size: s.size, mtimeMs: s.mtimeMs, birthtimeMs: s.birthtimeMs }; } catch (e) { if (e && e.refusal) throw e; return {}; }
  } };
  v[prefix + 'FS.fileExists'] = { request: { path: '' }, reply: { exists: false }, handler: function (a) { return { exists: fs.existsSync(inside(a.path)) }; } };
  v[prefix + 'FS.loadJsonValue'] = { request: { path: '' }, reply: {}, handler: function (a) {
    const text = read(inside(a.path));
    try { return { value: text == null ? null : JSON.parse(text) }; } catch (e) { return { value: null }; }
  } };
  v[prefix + 'FS.saveJsonValue'] = { request: { path: '', value: {} }, reply: { saved: true }, handler: function (a) { return write(inside(a.path), JSON.stringify(a.value, null, 2)); } };
  v[prefix + 'FS.getAnnotations'] = { request: { path: '' }, reply: {}, handler: function (a) { const u = underRun(inside(a.path)); return fileSystem.getAnnotations(u.rel); } };
  v[prefix + 'FS.annotateFile'] = { request: { path: '', payload: {} }, reply: { saved: true }, handler: function (a) { const u = underRun(inside(a.path)); const r = fileSystem.annotateFile(u.rel, a.payload); return { saved: !!(r && r.ok) }; } };
  // NO LIST, A SEARCH (Andy's rule: "no lists, only searches"): the folder's file names ranked against the words,
  // every file in name order with none, cut in bytes to one answer with `more`.
  v[prefix + 'FS.search'] = { request: { q: '' }, reply: { items: [{ key: '', label: '' }], more: false }, handler: function (a) {
    const words = String((a && a.q) || '').trim();
    let names = [];
    try { names = fs.readdirSync(root).sort(); } catch (e) { names = []; }
    const bucket = createProbabilityBucket(Infinity);
    names.forEach(function (name, i) {
      const tie = 1e-9 / (1 + i);
      if (!words) { bucket.seatFor(0.5 + tie, name); return; }
      const p = Number(probabilityStringObjectMatch(words, { name: name })) || 0;
      if (p > 0) bucket.seatFor(Math.min(1, p * (1 - 1e-6) + tie), name);
    });
    const out = bucket.serialize(function (name) { return { key: name, label: name }; }, room() - 512);
    return { items: out.items, more: !!out.more };
  } };
  return v;
}

function family(dir, opts) {
  const o = opts || {};
  const prefix = String(o.prefix || '');
  // FS IS ALL THERE IS (goal/G30.4): the AGENTS verbs went (Andy, 2026-10-20: "cannot the agent simply use FS to
  // retrieve the AGENTS.md file of the verb.json files?"), so the folder is read through FS alone. A verb file naming
  // a verb nobody declared is still said at boot (stale).
  const verbs = Object.assign(Object.create(null), fsVerbs(dir, prefix));
  const stale = o.declared ? readFolder(dir, o.declared, o.manifest || '').stale : [];
  return { verbs: verbs, stale: stale };
}

// claim(table, namespace, by, declarations) STOOD HERE (goal/G10.5). It signed a module's verbs up on the node's
// table and wrapped their AGENTS verbs for the web door: the node's wiring, not introspection. It moved into
// verbTable as mount (goal/G30.4; Andy, 2026-10-20: "it does NOT belong in introSpector. a namespace container is not
// known by the namespace.").

module.exports = { family: family, AGENTS_FILE: AGENTS_FILE };
