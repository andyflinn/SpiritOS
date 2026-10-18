'use strict';

// spirit/run/js/nodeSearches.js
// THE NODE'S JOBS AND FILES, SEARCHED RATHER THAN LISTED (puppets/G2).
//
//   Andy, 2026-09-27: "the verb changes changing list fetches to a
//   search(labe) and geKey(key) pair are approved", and "get is fine".
//
// jobs.list answered every job whole, and one of them, the file watcher,
// carried the node's entire file list: 42,570 bytes on a fresh node, too
// big for a puppet to answer its owner with. So:
//
//   jobs.search { q }    key/label pairs, one per job
//   jobs.get    { key }  one job, WITHOUT the watcher's file list, which is
//                        a collection of its own and searched as one
//   fs.search   { q }    the files the node will serve, by path
//
// ── fs.search's WORDS ARE A PERSON'S, NOT A PATTERN (goal/G29.8) ─────
//
// The words are ranked over each entry's name and path by the probability
// modules, as the shared list ranks a page's rows; no * or ?, and nothing to
// climb out with, since only the tree's own entries are ever offered.

// ── WHAT IT CAN LIST IS WHAT THE NODE WOULD SERVE ────────────────────
//
// The walk is the file watcher's list, and scanFolder builds that from
// fileServable alone: a refused folder is not even entered. So no words
// can name relay-state/ or anything else a read would refuse, because
// nothing outside the servable set is ever offered. Symbolic links are
// neither file nor folder to scanFolder and are never followed. The limit
// that remains (wsl-claude): fileServable is lexical and never realpaths,
// so a link the box's owner makes inside app/ already reads through for
// loadFile. That is his own act on his own box, recorded here, not fixed.

var fs = require('fs');
var path = require('path');
var searchBucket = require('./searchBucket');
var limits = require('./limits');
var probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
var createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
// THE CONTENTS SEARCH'S BOUND (goal/G29.11, the box: "the node also reads text files up to 1 MB (larger ones are found by
// name only)"): a file bigger than this is never read.
var CONTENTS_MAX_BYTES = 1024 * 1024;
// What one fs.search answer may hold: the plaintext room, less its own frame.
var FS_SEARCH_ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ ok: true, items: [], more: false }), 'utf8');

function createNodeSearches(opts) {
  var o = opts || {};
  var jobs = o.jobs;
  // goal/G29.11: the run folder the files are read from, and the kernel's mimetype table that says which are text.
  var rootDir = o.rootDir;
  var mimeTypes = o.mimeTypes || {};

  function jobLabel(j) { return String(j.type || j.id) + ' (' + String(j.status || '') + ')'; }

  function jobsSearch(body) {
    var s = searchBucket.createSearch({
      query: body && body.q,
      getLabelStringFromIncomingObject: function (j) { return jobLabel(j) + ' ' + String(j.kind || ''); },
      extractKeyAndLabelFromRow: function (j) { return { key: j.id, label: jobLabel(j) }; },
    });
    var all = jobs.listJobs();
    for (var i = 0; i < all.length; i += 1) { if (!s.offer(all[i])) break; }
    var r = s.getResult();
    return { ok: true, status: 200, items: r.items, more: r.more };
  }

  function jobsGet(body) {
    var key = String((body && body.key) || '');
    if (!key) return { ok: false, status: 400, error: 'key required' };
    var job = jobs.getJob(key);
    if (!job) return { ok: false, status: 404, error: 'job not found' };
    // A copy without the internals (a leading _). The watcher carries no
    // file list since goal/G4.25 (fs.search serves the tree); its count is
    // added, so the job still says how much it is watching.
    var out = {};
    Object.keys(job).forEach(function (k) { if (k.charAt(0) !== '_') out[k] = job[k]; });
    if (out.type === 'fs-watcher') out.data = Object.assign({}, out.data, { fileCount: jobs.fsTreeEntries().length });
    return searchBucket.boundedGet({ ok: true, status: 200, key: key, job: out });
  }

  // FILES BY WORDS, ON THE NODE'S OWN TREE (goal/G29.8). The item's box: "It stays, on the node's own cached tree (the
  // watcher's), as Files sits on the shell's: the agents' file tool and every caller that is not a page", and "It
  // ranks words by the same probability modules as the shared list, best first; fs.search's patterns (* and ?) and
  // gradedSearch with them go." Each entry is scored by probabilityStringObjectMatch over its name and path; no words
  // is the whole tree in path order. A folder reads with its trailing slash, so a person can tell the two apart.
  // Bounded by bytes, never by rows: what does not fit says more.
  //
  // INSIDE THE TEXT FILES TOO (goal/G29.11, the verb change approved by Andy): with contents: yes, every text file up to
  // CONTENTS_MAX_BYTES is read and a file whose text holds the words is answered by its first matching line, as label
  // {path, line, text}; a file or folder matched by its name only answers line 0 and no text. A word is found wherever
  // it stands, partial words included, case ignored, as the page marks it. A file found both ways counts once, by the
  // better of its two scores.
  function isText(name) {
    var dot = String(name).lastIndexOf('.');
    var mime = String(mimeTypes[dot === -1 ? '' : String(name).slice(dot).toLowerCase()] || '');
    return mime.indexOf('text/') === 0 || /json|javascript/.test(mime);
  }
  function firstLine(file, ws) {
    var full = path.join(rootDir, file.relativePath);
    var st = null;
    try { st = fs.statSync(full); } catch (e) { return null; }
    if (!st.isFile() || st.size > CONTENTS_MAX_BYTES) return null;
    var text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch (e) { return null; }
    var lower = text.toLowerCase();
    var at = -1;
    ws.forEach(function (w) { var i = lower.indexOf(w); if (i !== -1 && (at === -1 || i < at)) at = i; });
    if (at === -1) return null;
    var start = text.lastIndexOf('\n', at - 1) + 1;
    var end = text.indexOf('\n', at);
    var line = text.slice(0, at).split('\n').length;
    return { line: line, text: text.slice(start, end === -1 ? text.length : end).replace(/\r$/, '').slice(0, 300) };
  }
  function fsSearch(body) {
    var words = String((body && body.q) == null ? '' : body.q).trim();
    var contents = !!(body && body.contents === 'yes') && !!rootDir && !!words;
    var ws = words.toLowerCase().split(/\s+/).filter(Boolean);
    var files = jobs.fsTreeEntries();
    var bucket = createProbabilityBucket(Infinity);
    for (var i = 0; i < files.length; i += 1) {
      var f = files[i];
      var p = f.relativePath + (f.kind === 'folder' ? '/' : '');
      var score = words ? probabilityStringObjectMatch(words, { name: f.name, path: f.relativePath }) : 0;
      var found = contents && f.kind === 'file' && isText(f.name) ? firstLine(f, ws) : null;
      // Found inside: as sure as the line holds the words.
      if (found) score = Math.max(score, probabilityStringObjectMatch(words, { line: found.text }));
      if (words && !(score > 0)) continue;
      var label = contents ? JSON.stringify({ path: p, line: found ? found.line : 0, text: found ? found.text : '' }) : p;
      // A tie keeps the tree's order: the earlier entry a hair ahead.
      bucket.seatFor(words ? score * (1 - 1e-9) + 1e-9 / (1 + i) : 1 / (1 + i), { key: p, label: label });
    }
    var r = bucket.serialize(null, FS_SEARCH_ROOM);
    return { ok: true, status: 200, items: r.items, more: r.more };
  }

  return { jobsSearch: jobsSearch, jobsGet: jobsGet, fsSearch: fsSearch };
}

module.exports = { createNodeSearches: createNodeSearches };
