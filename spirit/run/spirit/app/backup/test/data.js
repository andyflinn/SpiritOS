'use strict';

// spirit/run/spirit/app/backup/test/data.js
// The tests of spirit/app/backup/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the backup (goal/G41.28): the backup server's status, kept as status.get answered it, under the
// node that served it; its one branch named by this file alone. It runs as a page runs it: in a window of its own beside
// the real spirit.required.spirit.data (spirit/data/script.js), which it writes into. In node it comes with its branch's interface,
// spirit/app/backup/api.js, the one script that requires it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data', 'script.js');

// The node's public key, base64 with a + and a / in it, as a node's key is.
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

// A window of its own, the real spirit.required.spirit.data in it, then this file.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  PAGE_LOAD.runAsPage(SPIRIT_DATA, win);
  win.spirit.required.spirit.data.homeNode(HOME_KEY);
  PAGE_LOAD.runAsPage(FILE, win);
  return { win: win, D: win.spirit.required.spirit.data, B: ((win.spirit.required.spirit.data || {}).backup || {}).data };
}
const STATUS = { lastCheck: '2026-11-13T09:00:00.000Z', lastCopy: '2026-11-13T08:00:00.000Z', lastError: '' };

const W = {};

test.run('in a window, beside the real spirit.required.spirit.data, it stands at spirit.required.spirit.data.backup.data', 0.2, function () {
  try { Object.assign(W, world()); } catch (e) { return false; }
  return !!W.B || false;
}, test.limit.quick);
test.run('its reads are keep, status, watch and branch', 0.2, function () {
  if (!W.B) return false;
  return (['keep', 'status', 'watch'].every(function (f) { return typeof W.B[f] === 'function'; }) && typeof W.B.branch === 'string') || false;
}, test.limit.quick);
test.run('before anything is kept, status answers null', 0.2, function () {
  if (!W.B) return false;
  return W.B.status() === null || false;
}, test.limit.quick);
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: backupStatus, under the node that served it.
test.run('its branch is <node>/backup/backupStatus, under the node that served it', 0.2, function () {
  if (!W.B) return false;
  return W.B.branch === W.D.nodeId(HOME_KEY) + '/backup/backupStatus' || false;
}, test.limit.quick);
test.run('keep keeps what status.get answered, and status answers it', 0.2, function () {
  if (!W.B) return false;
  W.B.keep(Object.assign({}, STATUS));
  const s = W.B.status();
  return (!!s && s.lastCheck === STATUS.lastCheck && s.lastCopy === STATUS.lastCopy) || false;
}, test.limit.quick);
test.run('it is kept at <branch>/now, in the data set', 0.2, function () {
  if (!W.B) return false;
  const s = W.D.getPath(W.B.branch + '/now');
  return (!!s && s.lastCheck === STATUS.lastCheck) || false;
}, test.limit.quick);
test.run('a watch is told the status on every change', 0.2, function () {
  if (!W.B) return false;
  const heard = [];
  W.release = W.B.watch(function (s) { heard.push(s); });
  W.heard = heard;
  W.B.keep(Object.assign({}, STATUS, { lastError: 'disk full' }));
  return (heard.length === 1 && heard[0] && heard[0].lastError === 'disk full') || false;
}, test.limit.quick);
test.run('a refusal kept lets the status go: status answers null, and the watch is told null', 0.2, function () {
  if (!W.heard) return false;
  W.B.keep({ ok: false, error: 'refused' });
  return (W.B.status() === null && W.heard.length === 2 && W.heard[1] === null) || false;
}, test.limit.quick);
test.run('nothing kept lets it go too', 0.2, function () {
  if (!W.B) return false;
  W.B.keep(Object.assign({}, STATUS));
  W.B.keep(null);
  return W.B.status() === null || false;
}, test.limit.quick);
test.run('a watch answers its release, and once released it is told nothing more', 0.2, function () {
  if (typeof W.release !== 'function') return false;
  const n = W.heard.length;
  W.release();
  W.B.keep(Object.assign({}, STATUS));
  return W.heard.length === n || false;
}, test.limit.quick);
// "The server publishes no row of its own, so it translates nothing."
test.run('it translates nothing: a job of the backup on the stream writes nothing', 0.2, function () {
  if (!W.B) return false;
  const w = world();
  w.D.takeJob({ id: 'j1', module: 'spirit.app.backup', data: {}, app: { backup: { status: STATUS } } }, HOME_KEY);
  const kept = w.D.branchAt(w.D.nodeId(HOME_KEY) + '/backup');
  return (w.B.status() === null && Object.keys(kept).length === 0) || false;
}, test.limit.quick);

// ── in node, brought by its branch's interface, the one script that requires it ──
test.run('in node, requiring the interface spirit/app/backup/api.js brings it, and it stands at spirit.required.spirit.data.backup.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const s = globalThis.spirit;
  try { await Promise.resolve(s.requireScript('spirit/app/backup/api.js')); } catch (e) { return false; }
  const B = s.required.spirit.data && s.required.spirit.data.backup && s.required.spirit.data.backup.data;
  return (!!B && typeof B.status === 'function' && typeof B.keep === 'function') || false;
}, test.limit.quick);
