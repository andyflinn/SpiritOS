'use strict';

// spirit/run/spirit/test/tempFolder.js
// The tests of spirit/tempFolder.js, and of no other module (spec: ./tempFolder.md; goal/G47.1, the box, OTHER STUFF, no
// pollution: names and folders). Every folder it makes is under the system temp folder and removed after.
require('../spirit.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(RUN, 'spirit', 'tempFolder.js');
let T = null;
const made = [];
test.after(function () { made.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } }); });

// A run of its own, with a key of its own, in the system temp folder.
const KEY = 'zz-test-public-key';
const FAKE_RUN = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-run-'));
made.push(FAKE_RUN);
fs.mkdirSync(path.join(FAKE_RUN, 'spirit', 'state'), { recursive: true });
fs.writeFileSync(path.join(FAKE_RUN, 'spirit', 'state', 'identity.json'), JSON.stringify({ publicKey: KEY }));
const NODE = crypto.createHash('sha256').update(KEY).digest('hex').slice(0, 16);

test.run('it loads through spirit.requireScript and stands at spirit.required.spirit.tempFolder', 0.4, function () {
  if (!fs.existsSync(FILE)) return false;
  T = spirit.requireScript('spirit/tempFolder.js');
  return typeof T === 'function' && spirit.required.spirit && spirit.required.spirit.tempFolder === T || false;
}, test.limit.quick);
// The box: "the system temp folder, then spirit, then the node, then the route".
test.run('a job\'s folder is the system temp folder, then spirit, then the node, then the route', 0.4, function () {
  if (!T) return false;
  const d = T('spirit.app.zzJob', { run: FAKE_RUN }); made.push(path.join(os.tmpdir(), 'spirit', NODE));
  return d === path.join(os.tmpdir(), 'spirit', NODE, 'spirit.app.zzJob') && fs.statSync(d).isDirectory() || false;
}, test.limit.quick);
test.run('a suite\'s path makes a folder of each of its parts', 0.4, function () {
  if (!T) return false;
  const d = T('spirit/zz/test/zzSuite', { run: FAKE_RUN });
  return d === path.join(os.tmpdir(), 'spirit', NODE, 'spirit', 'zz', 'test', 'zzSuite') && fs.statSync(d).isDirectory() || false;
}, test.limit.quick);
// "The node is named by the first 16 hex characters of the hash of its key."
test.run('the node is named by the first 16 hex characters of the sha256 of its key', 0.4, function () {
  if (!T) return false;
  return path.basename(path.dirname(T.path('zzRoute', { run: FAKE_RUN }))) === NODE || false;
}, test.limit.quick);
test.run('two runs with different keys never share a folder', 0.4, function () {
  if (!T) return false;
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-run-')); made.push(other);
  fs.mkdirSync(path.join(other, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(other, 'spirit', 'state', 'identity.json'), JSON.stringify({ publicKey: 'zz-other-key' }));
  return T.path('zzRoute', { run: other }) !== T.path('zzRoute', { run: FAKE_RUN }) || false;
}, test.limit.quick);
// "No process id in a temp path."
test.run('no process id is in the path', 0.4, function () {
  if (!T) return false;
  return T.path('spirit.app.zzJob', { run: FAKE_RUN }).split(path.sep).indexOf(String(process.pid)) === -1 || false;
}, test.limit.quick);
// "made empty when asked"
test.run('asked again, it hands the folder back empty', 0.4, function () {
  if (!T) return false;
  const d = T('spirit.app.zzEmpty', { run: FAKE_RUN });
  fs.writeFileSync(path.join(d, 'left.txt'), 'left behind');
  const again = T('spirit.app.zzEmpty', { run: FAKE_RUN });
  return again === d && fs.readdirSync(d).length === 0 || false;
}, test.limit.quick);
test.run('path names the same folder and makes nothing', 0.4, function () {
  if (!T) return false;
  const p = T.path('spirit.app.zzNever', { run: FAKE_RUN });
  return p === path.join(os.tmpdir(), 'spirit', NODE, 'spirit.app.zzNever') && !fs.existsSync(p) || false;
}, test.limit.quick);
test.run('a route with an empty part, a . or .. part, or another character is refused', 0.4, function () {
  if (!T) return false;
  const bad = ['', 'a//b', '../x', 'a/./b', 'a b', 'a\\b', '/a', 'a/'];
  return bad.every(function (r) { try { T.path(r, { run: FAKE_RUN }); return false; } catch (e) { return /tempFolder:/.test(e.message); } }) || false;
}, test.limit.quick);
test.run('a run with no key yet is named by its own path, hashed the same way', 0.2, function () {
  if (!T) return false;
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tempFolder-bare-')); made.push(bare);
  const want = crypto.createHash('sha256').update('run:' + path.resolve(bare)).digest('hex').slice(0, 16);
  return path.basename(path.dirname(T.path('zzRoute', { run: bare }))) === want || false;
}, test.limit.quick);
