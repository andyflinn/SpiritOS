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
function tempFolder(route, opts) {
  const dir = pathOf(route, opts);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
tempFolder.path = pathOf;

module.exports = tempFolder;
}());
