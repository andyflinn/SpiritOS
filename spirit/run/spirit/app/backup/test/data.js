'use strict';

// spirit/run/spirit/app/backup/test/data.js
// The tests of spirit/app/backup/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the backup (goal/G41.28): the backup server's status, kept as status.get answered it, under the
// node that served it; its one branch named by this file alone. It runs as a page runs it: in a window of its own beside
// the real spirit.data (spirit/data.js), which it writes into. In node it is asked as appServer asks it, through
// spirit.cacheManager. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The node's public key, base64 with a + and a / in it, as a node's key is.
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

// A window of its own, the real spirit.data in it, then this file.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  win.spirit.data.homeNode(HOME_KEY);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  return { win: win, D: win.spirit.data, B: ((win.spirit.data || {}).backup || {}).data };
}
const STATUS = { lastCheck: '2026-11-13T09:00:00.000Z', lastCopy: '2026-11-13T08:00:00.000Z', lastError: '' };

const W = {};
const NO_WORLD = 'no spirit.data.backup.data: the world failed';

test.run('the world: in a window, beside the real spirit.data, it stands at spirit.data.backup.data', 0.2, function () {
  try { Object.assign(W, world()); } catch (e) { return 'it threw: ' + short(e && e.message); }
  return !!W.B || 'spirit.data.backup is ' + short(W.D && W.D.backup);
}, test.limit.quick);
test.run('its reads are keep, status, watch and branch', 0.2, function () {
  if (!W.B) return NO_WORLD;
  return (['keep', 'status', 'watch'].every(function (f) { return typeof W.B[f] === 'function'; }) && typeof W.B.branch === 'string') || 'reads ' + short(Object.keys(W.B));
}, test.limit.quick);
test.run('before anything is kept, status() is null', 0.2, function () {
  if (!W.B) return NO_WORLD;
  return W.B.status() === null || 'status ' + short(W.B.status());
}, test.limit.quick);
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: backupStatus, under the node that served it.
test.run('its branch is <node>/backup/backupStatus, under the node that served it', 0.2, function () {
  if (!W.B) return NO_WORLD;
  return W.B.branch === W.D.nodeId(HOME_KEY) + '/backup/backupStatus' || 'branch ' + short(W.B.branch);
}, test.limit.quick);
test.run('keep(status) keeps what status.get answered, and status() answers it', 0.2, function () {
  if (!W.B) return NO_WORLD;
  W.B.keep(Object.assign({}, STATUS));
  const s = W.B.status();
  return (!!s && s.lastCheck === STATUS.lastCheck && s.lastCopy === STATUS.lastCopy) || 'status ' + short(s);
}, test.limit.quick);
test.run('it is kept at <branch>/now, in the data set', 0.2, function () {
  if (!W.B) return NO_WORLD;
  const s = W.D.getPath(W.B.branch + '/now');
  return (!!s && s.lastCheck === STATUS.lastCheck) || 'at ' + W.B.branch + '/now: ' + short(s);
}, test.limit.quick);
test.run('watch(fn) is told the status on every change', 0.2, function () {
  if (!W.B) return NO_WORLD;
  const heard = [];
  W.release = W.B.watch(function (s) { heard.push(s); });
  W.heard = heard;
  W.B.keep(Object.assign({}, STATUS, { lastError: 'disk full' }));
  return (heard.length === 1 && heard[0] && heard[0].lastError === 'disk full') || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a refusal kept lets the status go: status() is null, and the watch is told null', 0.2, function () {
  if (!W.heard) return 'no watch: the test before it failed';
  W.B.keep({ ok: false, error: 'refused' });
  return (W.B.status() === null && W.heard.length === 2 && W.heard[1] === null) || 'status ' + short(W.B.status()) + ', heard ' + short(W.heard);
}, test.limit.quick);
test.run('nothing kept lets it go too', 0.2, function () {
  if (!W.B) return NO_WORLD;
  W.B.keep(Object.assign({}, STATUS));
  W.B.keep(null);
  return W.B.status() === null || 'status ' + short(W.B.status());
}, test.limit.quick);
test.run('watch answers its release: released, it is told nothing more', 0.2, function () {
  if (typeof W.release !== 'function') return 'watch answered no release';
  const n = W.heard.length;
  W.release();
  W.B.keep(Object.assign({}, STATUS));
  return W.heard.length === n || 'heard after release: ' + short(W.heard.slice(n));
}, test.limit.quick);
// "The server publishes no row of its own, so it translates nothing."
test.run('it translates nothing: a job of the backup on the stream writes nothing', 0.2, function () {
  if (!W.B) return NO_WORLD;
  const w = world();
  w.D.takeJob({ id: 'j1', module: 'spirit.app.backup', data: {}, app: { backup: { status: STATUS } } }, HOME_KEY);
  const kept = w.D.branchAt(w.D.nodeId(HOME_KEY) + '/backup');
  return (w.B.status() === null && Object.keys(kept).length === 0) || 'kept ' + short(kept);
}, test.limit.quick);

// ── in node, as appServer asks for it ──
test.run('in node, spirit.cacheManager(\'backup\') loads it, and it stands at spirit.data.backup.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const s = globalThis.spirit;
  try { await s.cacheManager('backup'); } catch (e) { return 'cacheManager(backup) refused: ' + short(e && e.message); }
  const B = s.data && s.data.backup && s.data.backup.data;
  return (!!B && typeof B.status === 'function' && typeof B.keep === 'function') || 'spirit.data.backup is ' + short(s.data && s.data.backup);
}, test.limit.quick);
