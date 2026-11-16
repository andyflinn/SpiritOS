'use strict';

// spirit/run/spirit/app/deskClient/test/data.js
// The tests of spirit/app/deskClient/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of the deskClient family (goal/G41.28): nothing yet. Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; so it stands, keeps nothing and names no branch. It runs as a page runs
// it: in a window of its own beside the real spirit.data (spirit/data.js). In node it is loaded by its api.js,
// spirit/app/deskClient/api.js, the one script that requires it. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

const W = {};

test.run('loaded in a window beside the real spirit.data, the deskClient family stands at spirit.data.deskClient', 0.2, function () {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  try {
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
    win.spirit.data.homeNode(HOME_KEY);
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  } catch (e) { return false; }
  W.D = win.spirit.data;
  W.F = W.D.deskClient;
  return (!!W.F && !!W.F.data) || false;
}, test.limit.quick);
// "Its reads stand at spirit.data.deskClient.data as every family's do, and it has none yet."
test.run('its reads stand at spirit.data.deskClient.data, and it has none yet', 0.2, function () {
  if (!W.F) return false;
  return (typeof W.F.data === 'object' && Object.keys(W.F.data).length === 0) || false;
}, test.limit.quick);
// "IT KEEPS NOTHING, AND NAMES NO BRANCH."
test.run('it keeps nothing: its cache is empty', 0.2, function () {
  if (!W.F) return false;
  return Object.keys(W.F.cache || {}).length === 0 || false;
}, test.limit.quick);
test.run('a job of deskClient on the stream writes nothing, because the family translates nothing', 0.2, function () {
  if (!W.F) return false;
  W.D.takeJob({ id: 'j1', module: 'spirit.app.deskClient', data: {}, app: { deskClient: { table: 'history', row: { id: 'r1' } } } }, HOME_KEY);
  const kept = W.D.branchAt(W.D.nodeId(HOME_KEY) + '/deskClient');
  return (Object.keys(kept).length === 0 && Object.keys(W.F.cache).length === 0) || false;
}, test.limit.quick);

// ── in node, loaded by its api.js, the one script that requires it (goal/G47.1) ──
test.run('in node, requiring spirit/app/deskClient/api.js loads it, and the family stands at spirit.data.deskClient', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const s = globalThis.spirit;
  try { require(path.join(RUN, 'spirit', 'app', 'deskClient', 'api.js')); } catch (e) { return false; }
  const F = s.data && s.data.deskClient;
  return (!!F && !!F.data && Object.keys(F.data).length === 0) || false;
}, test.limit.quick);
