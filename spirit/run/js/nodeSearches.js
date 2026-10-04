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
// ── fs.search's PATTERN IS A PATH, CLEANED THE WAY THE NODE CLEANS PATHS ─
//
//   Andy: "the node internals (filePath()?) clean up the path so
//   "/media/*.jpg", is understood as equal to "./media/*.jpg" and equal to
//   "media/*.jpg"", and "a leading "../" is illegal in SpiritOS".
//
// The pattern goes through fsPath, the node's one path rule, before it
// matches anything. A pattern that climbs out of the run folder is refused
// by name (wsl-claude: an empty answer would say "nothing matched", and
// the question itself was refused).
//
// ── WHAT IT CAN LIST IS WHAT THE NODE WOULD SERVE ────────────────────
//
// The walk is the file watcher's list, and scanFolder builds that from
// fileServable alone: a refused folder is not even entered. So no pattern
// can name relay-state/ or anything else a read would refuse, because
// nothing outside the servable set is ever offered. Symbolic links are
// neither file nor folder to scanFolder and are never followed. The limit
// that remains (wsl-claude): fileServable is lexical and never realpaths,
// so a link the box's owner makes inside app/ already reads through for
// loadFile. That is his own act on his own box, recorded here, not fixed.

var path = require('path');
var searchBucket = require('./searchBucket');

function createNodeSearches(opts) {
  var o = opts || {};
  var jobs = o.jobs;
  var rootDir = o.rootDir;
  var fsPath = o.fsPath;

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

  // The pattern, cleaned as the node cleans a path; null when it climbs out.
  function cleanPattern(q) {
    var raw = q == null ? '' : String(q).trim();
    // An empty search is the whole tree, at every depth: '**' (the shell
    // rule, gradedSearch). A '*' typed as such means the top level only.
    if (raw === '') return '**';
    if (/^\*+$/.test(raw)) return raw;
    var resolved = fsPath(rootDir, raw);
    if (!resolved) return null;
    return path.relative(rootDir, resolved).split(path.sep).join('/') || '*';
  }

  function fsSearch(body) {
    var pattern = cleanPattern(body && body.q);
    if (pattern === null) return { ok: false, status: 400, error: 'path outside the run folder' };
    // The watcher's tree, in memory (goal/G4.25), as entries {name, relativePath, kind}.
    var files = jobs.fsTreeEntries();
    // A folder reads with its trailing slash, so a person can tell the two
    // apart and 'shell/desk/' finds the folder itself.
    var pathOf = function (f) { return f.relativePath + (f.kind === 'folder' ? '/' : ''); };
    var s = searchBucket.createSearch({
      query: pattern,
      getLabelStringFromIncomingObject: pathOf,
      extractKeyAndLabelFromRow: function (f) { return { key: pathOf(f), label: pathOf(f) }; },
    });
    for (var i = 0; i < files.length; i += 1) { if (!s.offer(files[i])) break; }
    var r = s.getResult();
    return { ok: true, status: 200, items: r.items, more: r.more };
  }

  return { jobsSearch: jobsSearch, jobsGet: jobsGet, fsSearch: fsSearch, cleanPattern: cleanPattern };
}

module.exports = { createNodeSearches: createNodeSearches };
