'use strict';

// spirit/run/js/includeList.js
// WHAT THIS NODE INCLUDES — slim/G1.3, the one reader of the lists.
//
//   Andy, 2026-09-29: "now every lab node used for testing will be starting
//   4 (FOUR!) server processes", "keep server slim by default". Decided in
//   slim/G1.3, not this file's to undo:
//     - a module is its path: 'process/js/desk', 'shell/textEditor' (Andy:
//       "they're all identified by path")
//     - the list is relay-state/include.json: the owner's choice, so a file
//       he can read and restore, not node.db (decision 0018; Andy, "agreed")
//     - not listed: not started, not offered
//     - intrinsic shell apps are always included and can never be excluded
//       (Andy: "intrinsic apps must always be included, never excluded")
//     - switching on works live; switching off takes effect at the next start
//
// Everything else asks here, so where the list is kept is this file's
// business and nobody else's.
//
//   relay-state/include.json   {"modules": ["process/js/backup", "process/js/desk"]}
//
// "modules" present means the list EXISTS, even empty: an owner who emptied
// his list has a list, and is not seeded again as a node that never had one.
// Written whole, through a temp file and a rename.

const fs = require('fs');
const path = require('path');

const PATH_RE = /^(process\/js|shell)\/[A-Za-z0-9_-]{1,64}$/;

function isPath(p) { return typeof p === 'string' && PATH_RE.test(p); }
function checked(p) {
  if (!isPath(p)) throw new Error('includeList: a module is process/js/<name> or shell/<name>, not ' + JSON.stringify(p));
  return p;
}

function file(rootDir) { return path.join(rootDir, 'relay-state', 'include.json'); }
function read(rootDir) {
  let v = null;
  try { v = JSON.parse(fs.readFileSync(file(rootDir), 'utf8')); } catch (e) { v = null; }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function listed(rootDir) {
  const l = read(rootDir).modules;
  return Array.isArray(l) ? l.filter(isPath) : [];
}
function write(rootDir, modules) {
  const f = file(rootDir);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const lists = read(rootDir);
  lists.modules = modules.filter(function (p, i, a) { return isPath(p) && a.indexOf(p) === i; }).sort();
  const tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(lists, null, 2) + '\n');
  fs.renameSync(tmp, f);
}

// The shell elements whose manifest says intrinsic: always included.
function intrinsicShell(rootDir) {
  const dir = path.join(rootDir, 'shell');
  let es = [];
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  return es.filter(function (e) {
    if (!e.isDirectory() || !isPath('shell/' + e.name)) return false;
    try { return JSON.parse(fs.readFileSync(path.join(dir, e.name, e.name + '.json'), 'utf8')).intrinsic === true; }
    catch (e2) { return false; }
  }).map(function (e) { return 'shell/' + e.name; });
}

// Every module this node includes, sorted.
function paths(rootDir) {
  const all = listed(rootDir).concat(intrinsicShell(rootDir));
  return all.filter(function (p, i) { return all.indexOf(p) === i; }).sort();
}
function includes(rootDir, p) { return paths(rootDir).indexOf(String(p)) !== -1; }
function add(rootDir, p) { write(rootDir, listed(rootDir).concat([checked(p)])); }
// An intrinsic one stays included whatever the list says (paths()).
function remove(rootDir, p) { checked(p); write(rootDir, listed(rootDir).filter(function (x) { return x !== p; })); }

// ── A LIVE NODE KEEPS WHAT IT RAN (T5) ──────────────────────────────
//
// A node that has no list yet, but has relay-state/process/<name>/ folders,
// ran those servers before this rule existed: its list is seeded once from
// them, so Andy's node keeps desk and backup. A fresh node has no such
// folders and starts with nothing. Once the list exists (even empty), a
// folder that appears later is not a reason to include it.
function seedOnce(rootDir) {
  if (Array.isArray(read(rootDir).modules)) return [];
  let es = [];
  try { es = fs.readdirSync(path.join(rootDir, 'relay-state', 'process'), { withFileTypes: true }); } catch (e) { es = []; }
  const ran = es.filter(function (e) { return e.isDirectory() && isPath('process/js/' + e.name); })
    .map(function (e) { return 'process/js/' + e.name; });
  if (!ran.length) return [];
  write(rootDir, ran);
  return ran.sort();
}

// ── config.searchModules: WHAT THIS NODE INCLUDES, AS A SEARCH ───────
//
// Andy: "there are no (complete) lists, only searches". Through searchBucket
// like every search; an empty query is everything, as '**', since a single
// '*' never spans the '/' every path holds (gradedSearch.js).
function search(rootDir, query, maxBytes) {
  const q = String(query == null ? '' : query).trim();
  const bucket = require('./searchBucket').createSearch({
    query: q || '**', maxBytes: maxBytes,
    getLabelStringFromIncomingObject: function (p) { return p; },
    extractKeyAndLabelFromRow: function (p) { return { key: p, label: p }; },
  });
  for (const p of paths(rootDir)) { if (!bucket.offer(p)) break; }
  return bucket.getResult();
}

module.exports = { paths: paths, includes: includes, add: add, remove: remove, seedOnce: seedOnce, search: search, isPath: isPath };
