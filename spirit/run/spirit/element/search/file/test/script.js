'use strict';

// spirit/run/spirit/element/search/file/test/script.js
// The tests of spirit/element/search/file/script.js, the file selector, and of no other module (spec: ./script.md; goal/G43.32). The box:
// "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js". The browser file runs in node on a window of its own: its list, ./file/list.js, is a recorder in
// its place, so this tests the selector and not the list (the list's own test is ../list/test/script.js).
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/testicle/headLessChrome/script.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
// Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
// stands at its place (a folder's script.js at its folder's name), a stand-in or a real file loaded; nothing there is refused.
function placedAnswer(p, w) {
  const keys = String(p).replace(/\.js$/, '').split('/');
  if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
  // goal/G49.23: on the spirit object itself, its first key spirit the object.
  const at = keys.slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, (w || global.window).spirit);
  if (at && (typeof at === 'object' || typeof at === 'function')) return Promise.resolve(at);
  const no = Promise.reject(new Error('no stand-in for ' + p));
  no.catch(function () {});
  return no;
}
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'script.js');
const LIST = 'spirit/element/search/file/list/script.js';

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// What the world made, for the tests after it.
const W = { required: [], made: [], ANSWER: { list: {}, refresh: function () {}, destroy: function () {} } };

test.run('the selector runs on a window of its own', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  const listStand = { create: function (host, opts) { W.made.push({ host: host, opts: opts }); return W.ANSWER; } };
  global.window = { spirit: { element: {}, requireScript: function (p) {
    W.required.push(String(p));
    // Its list, a recorder, requireScript's answer (goal/G49.23; goal/G49.9, box v5).
    if (p === LIST) return Promise.resolve(listStand);
    return placedAnswer(p);
  } } };
  LOADER.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(global.window.spirit);
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
test.run('it places its create on the spirit object, by its path, spirit.element.search.file', 0.2, function () {
  if (!W.ran) return false;
  const S = (((global.window.spirit.element || {}).search || {}).file);
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
