'use strict';

// spirit/run/spirit/app/deskClient/test/data.js
// The tests of spirit/app/deskClient/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of the deskClient family (goal/G41.28): nothing yet. Andy: "WSL, make sure you assert that every
// family in the api tree HAS a clientCacheManager"; so it stands, keeps nothing and names no branch. It runs as a page runs
// it: in a window of its own beside the real spirit.data (spirit/data.js). In node it is asked through
// spirit.cacheManager. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

const W = {};
const NO_WORLD = 'no spirit.data.deskClient: the world failed';

test.run('the world: in a window, beside the real spirit.data, it stands at spirit.data.deskClient', 0.2, function () {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  try {
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
    win.spirit.data.homeNode(HOME_KEY);
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  } catch (e) { return 'it threw: ' + short(e && e.message); }
  W.D = win.spirit.data;
  W.F = W.D.deskClient;
  return (!!W.F && !!W.F.data) || 'spirit.data.deskClient is ' + short(W.F);
}, test.limit.quick);
// "Its reads stand at spirit.data.deskClient.data as every family's do, and it has none yet."
test.run('its reads stand at spirit.data.deskClient.data, and it has none yet', 0.2, function () {
  if (!W.F) return NO_WORLD;
  return (typeof W.F.data === 'object' && Object.keys(W.F.data).length === 0) || 'reads ' + short(Object.keys(W.F.data || {}));
}, test.limit.quick);
// "IT KEEPS NOTHING, AND NAMES NO BRANCH."
test.run('it keeps nothing: its cache is empty', 0.2, function () {
  if (!W.F) return NO_WORLD;
  return Object.keys(W.F.cache || {}).length === 0 || 'cache ' + short(W.F.cache);
}, test.limit.quick);
test.run('and a job of deskClient on the stream writes nothing: it translates nothing', 0.2, function () {
  if (!W.F) return NO_WORLD;
  W.D.takeJob({ id: 'j1', module: 'spirit.app.deskClient', data: {}, app: { deskClient: { table: 'history', row: { id: 'r1' } } } }, HOME_KEY);
  const kept = W.D.branchAt(W.D.nodeId(HOME_KEY) + '/deskClient');
  return (Object.keys(kept).length === 0 && Object.keys(W.F.cache).length === 0) || 'kept ' + short(kept);
}, test.limit.quick);

// ── in node, found by the family's name ──
test.run('in node, spirit.cacheManager(\'deskClient\') finds it, and the family stands at spirit.data.deskClient', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const s = globalThis.spirit;
  try { await s.cacheManager('deskClient'); } catch (e) { return 'cacheManager(deskClient) refused: ' + short(e && e.message); }
  const F = s.data && s.data.deskClient;
  return (!!F && !!F.data && Object.keys(F.data).length === 0) || 'spirit.data.deskClient is ' + short(F);
}, test.limit.quick);
