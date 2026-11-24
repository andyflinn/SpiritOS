'use strict';

// spirit/run/spirit/element/search/test/grant.js
// The tests of spirit/element/search/grant.js, the grant selector, and of no other module (spec: ./grant.md; goal/G43.32). The box:
// "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js". The browser file runs in node on a window of its own: its list, ./grant/list.js, is a recorder in
// its place, so this tests the selector and not the list (the list's own test is ../grant/test/list.js).
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
// Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
// stands at its place (a folder's script.js at its folder's name), a stand-in or a real file loaded; nothing there is refused.
function placedAnswer(p, w) {
  const keys = String(p).replace(/\.js$/, '').split('/');
  if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
  const at = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, ((w || global.window).spirit || {}).required);
  if (at && (typeof at === 'object' || typeof at === 'function')) return Promise.resolve(at);
  const no = Promise.reject(new Error('no stand-in for ' + p));
  no.catch(function () {});
  return no;
}
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant.js');
const LIST = 'spirit/element/search/grant/list.js';

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// What the world made, for the tests after it.
const W = { required: [], made: [], ANSWER: { list: {}, refresh: function () {}, destroy: function () {} } };

test.run('the grant selector runs on a window of its own', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  global.window = { spirit: { element: {}, requireScript: function (p) {
    W.required.push(String(p));
    // Its list, a recorder in its place, placed where the real one places itself.
    if (p === LIST) LOADER.requireScript('spirit/element/installSpiritElement.js')(global.window.spirit, LIST, { create: function (host, opts) { W.made.push({ host: host, opts: opts }); return W.ANSWER; } });
    return placedAnswer(p);
  } } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  global.spirit = global.window.spirit;
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  W.ran = true;
  return true;
}, test.limit.quick);

// "the selector", over its own list
test.run('as it runs it requires its own list first', 0.2, function () {
  if (!W.ran) return false;
  return W.required[0] === LIST ? true : false;
}, test.limit.quick);
test.run('it places spirit.required.spirit.element.search.grant.create, by its path', 0.2, function () {
  if (!W.ran) return false;
  const S = (((((global.window.spirit.required || {}).spirit || {}).element || {}).search || {}).grant);
  W.S = S;
  return !!S && typeof S.create === 'function' ? true : false;
}, test.limit.quick);
test.run('create draws its list in the box it is handed, with the options as they are', 0.2, function () {
  if (!W.S || typeof W.S.create !== 'function') return false;
  const host = { id: 'the box' };
  const opts = { face: 'pane', zz: 1 };
  W.got = W.S.create(host, opts);
  W.called = true;
  return W.made.length === 1 && W.made[0].host === host && W.made[0].opts === opts ? true : false;
}, test.limit.quick);
test.run('create answers what its list answers', 0.2, function () {
  if (!W.called) return false;
  return W.got === W.ANSWER ? true : false;
}, test.limit.quick);

// NO DEPRECATED (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well,
// what the hell is it even for?"): nothing marks a grant deprecated, and nothing asks whether a server serves its path.
test.run('grant.js names no deprecated and takes no serves, its comments left out', 0.2, function () {
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, 'spirit/element/search/grant.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return false; }
  return (src.length > 0 && !/deprecated/i.test(src) && !/\bserves\b/.test(src)) ? true : false;
}, test.limit.quick);
