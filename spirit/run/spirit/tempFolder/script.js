'use strict';
require('../script.js');

// spirit/run/spirit/tempFolder/script.js
// THE ONE DOOR TO A TEMP FOLDER (goal/G47.1, the box, OTHER STUFF, no pollution: names and folders). Its contract and its
// test: ./test/script.md and ./test/tempFolder.js. The decisions are Andy's (Q30: "spirit/tempFolder/script.js is fine");
// change them in the box first:
//   "Temp: the system temp folder, then spirit, then the node, then the route: a job by its route (spirit.app.publishData),
//   a test by its suite's path ... The node is named by the first 16 hex characters of the hash of its key. No process id
//   in a temp path."
//   "One helper on the spirit object hands a process its temp folder, made empty when asked; nothing else builds a temp
//   path."
//
//   tempFolder(route, { run }) -> the folder's absolute path, made, and empty
//   tempFolder.path(route, { run }) -> the same path, nothing made or removed: for whoever checks it is gone
//     route  a job's route (spirit.app.publishData) or a suite's path (spirit/app/publishData/test/publishData): letters,
//            digits, dot, dash, underscore and slash; no empty part, no '.' or '..' part
//     run    the run folder whose node it is (default: the run folder this file lives in); its node is named by its key,
//            spirit/state/identity.json, and a run with no key yet by its own path, hashed the same way
// Node only: a page has no temp folder. Placed at spirit.required.spirit.tempFolder by spirit.requireScript, as every helper.
(function () {
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const RUN = path.join(__dirname, '..', '..');
const ROUTE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

// The node's name in a temp path: the first 16 hex characters of the sha256 of its public key.
function nodeName(run) {
  let key = '';
  try { key = String(JSON.parse(fs.readFileSync(path.join(run, 'spirit', 'state', 'identity.json'), 'utf8')).publicKey || ''); } catch (e) { key = ''; }
  return crypto.createHash('sha256').update(key || ('run:' + path.resolve(run))).digest('hex').slice(0, 16);
}
function partsOf(route) {
  const r = String(route == null ? '' : route);
  if (!ROUTE.test(r)) throw new Error('tempFolder: a route is letters, digits, . - _ and /, with no empty part: ' + JSON.stringify(r));
  const parts = r.split('/');
  if (parts.some(function (p) { return p === '.' || p === '..'; })) throw new Error('tempFolder: no . or .. in a route: ' + JSON.stringify(r));
  return parts;
}
function pathOf(route, opts) {
  const run = (opts && opts.run) || RUN;
  return path.join.apply(path, [os.tmpdir(), 'spirit', nodeName(run)].concat(partsOf(route)));
}
// IT LEAVES NO GARBAGE (goal/G49.23, Q8; Andy: "make sure spirit/tempFolder/ leaves NO garbage", "yes." to: "Shall tempFolder
// mark each spot it hands out with the asking process and remove the spots of processes that are gone"): a process killed by
// its time limit or a crash never cleans its own spot, so each spot it hands out is written down with the asking process in
// the node's owners list, <temp>/spirit/<node>/.owners/, beside the spots and never inside one (no process id in a temp path,
// Andy's), and every hand-out removes the spots whose process is gone. A live process's spots, its own among them, stay.
function ownersOf(opts) {
  const run = (opts && opts.run) || RUN;
  return path.join(os.tmpdir(), 'spirit', nodeName(run), '.owners');
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
}
function sweep(opts) {
  const owners = ownersOf(opts);
  let names = [];
  try { names = fs.readdirSync(owners); } catch (e) { return; }
  names.forEach(function (n) {
    const file = path.join(owners, n);
    let row = null;
    try { row = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { row = null; }
    if (row && alive(row.pid)) return;
    if (row && typeof row.dir === 'string' && row.dir.indexOf(path.dirname(owners) + path.sep) === 0) {
      try { fs.rmSync(row.dir, { recursive: true, force: true }); } catch (e) { /* the system temp folder keeps it */ }
    }
    try { fs.rmSync(file, { force: true }); } catch (e) { /* gone already */ }
  });
}
// EVERY NODE'S ROOT, NOT ONLY THE ASKING ONE'S (goal/G49.27; Andy: "the test system is STILL littering all over the TEMP folders";
// cw measured 191 run folders in his Windows temp, most holding only .owners, some a whole tree): sweep() visits the root of
// the node that asks, so a scratch node's root, once that node was gone, was never visited again. Once a process, every root
// under <tmp>/spirit is swept the same way, and a root no live process owns any more, untouched for an hour, goes whole.
const HOUR = 3600000;
let allSwept = false;
function sweepAll() {
  if (allSwept) return;
  allSwept = true;
  const base = path.join(os.tmpdir(), 'spirit');
  let roots = [];
  try { roots = fs.readdirSync(base); } catch (e) { return; }
  roots.forEach(function (r) {
    const root = path.join(base, r);
    const owners = path.join(root, '.owners');
    let live = 0;
    let names = [];
    try { names = fs.readdirSync(owners); } catch (e) { names = []; }
    names.forEach(function (n) {
      const file = path.join(owners, n);
      let row = null;
      try { row = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { row = null; }
      if (row && alive(row.pid)) { live += 1; return; }
      if (row && typeof row.dir === 'string' && row.dir.indexOf(root + path.sep) === 0) {
        try { fs.rmSync(row.dir, { recursive: true, force: true }); } catch (e) { /* the system temp folder keeps it */ }
      }
      try { fs.rmSync(file, { force: true }); } catch (e) { /* gone already */ }
    });
    if (live) return;
    let st = null;
    try { st = fs.statSync(root); } catch (e) { return; }
    if (!st.isDirectory() || Date.now() - st.mtimeMs < HOUR) return;
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* locked: the next sweep */ }
  });
}
function tempFolder(route, opts) {
  const dir = pathOf(route, opts);
  sweep(opts);
  sweepAll();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const owners = ownersOf(opts);
  try {
    fs.mkdirSync(owners, { recursive: true });
    const name = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32) + '.json';
    fs.writeFileSync(path.join(owners, name), JSON.stringify({ pid: process.pid, dir: dir }));
  } catch (e) { /* unmarked: its own process still removes it */ }
  return dir;
}
tempFolder.path = pathOf;

// What it hands out: an object holding its two functions (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { tempFolder: tempFolder, path: pathOf };
}());
