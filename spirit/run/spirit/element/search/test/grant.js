'use strict';

// spirit/run/spirit/element/search/test/grant.js
// The tests of spirit/element/search/grant.js, the grant selector, and of no other module (spec: ./grant.md; goal/G43.32). The box:
// "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js". The browser file runs in node on a window of its own: its list, ./grant/listElement.js, is a recorder in
// its place, so this tests the selector and not the list (the list's own test is ../grant/test/listElement.js).
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant.js');
const LIST = 'spirit/element/search/grant/listElement.js';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// What the world made, for the tests after it.
const W = { required: [], made: [], ANSWER: { list: {}, refresh: function () {}, destroy: function () {} } };

test.run('the world: the selector runs on a window of its own', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/grant.js is not there';
  global.window = { spirit: { element: {}, require: function (p) {
    W.required.push(String(p));
    // Its list, a recorder in its place, placed where the real one places itself.
    if (p === LIST) require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, LIST, { create: function (host, opts) { W.made.push({ host: host, opts: opts }); return W.ANSWER; } });
    return Promise.resolve({});
  } } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  W.ran = true;
  return true;
}, 1000);

// "the selector", over its own list
test.run('as it runs it requires its own list first', 0.2, function () {
  if (!W.ran) return 'the selector never ran: the world failed';
  return W.required[0] === LIST ? true : 'it required ' + short(W.required) + ', not ' + LIST + ' first';
}, 1000);
test.run('it places spirit.element.spirit.element.search.grant.create, by its path', 0.2, function () {
  if (!W.ran) return 'the selector never ran: the world failed';
  const S = (((((global.window.spirit.element || {}).spirit || {}).element || {}).search || {}).grant);
  W.S = S;
  return !!S && typeof S.create === 'function' ? true : 'placed: ' + short(S && Object.keys(S));
}, 1000);
test.run('create draws its list in the box it is handed, with the options as they are', 0.2, function () {
  if (!W.S || typeof W.S.create !== 'function') return 'no create to call: the selector placed none';
  const host = { id: 'the box' };
  const opts = { face: 'pane', zz: 1 };
  W.got = W.S.create(host, opts);
  W.called = true;
  return W.made.length === 1 && W.made[0].host === host && W.made[0].opts === opts ? true : 'the list was made with: ' + short(W.made);
}, 1000);
test.run('and answers what its list answers', 0.2, function () {
  if (!W.called) return 'create was never called';
  return W.got === W.ANSWER ? true : 'it answered ' + short(W.got);
}, 1000);
