'use strict';

// spirit/run/spirit/element/search/test/file.js
// The tests of spirit/element/search/file.js, the file selector, and of no other module (spec: ./file.md; goal/G43.32). The box:
// "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js". The browser file runs in node on a window of its own: its list, ./file/listElement.js, is a recorder in
// its place, so this tests the selector and not the list (the list's own test is ../file/test/listElement.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file.js');
const LIST = 'spirit/element/search/file/listElement.js';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

test.startTest('file.js: the file selector, a thin element over its own list (goal/G43.32)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/file.js is not there'); return; }
  const required = [];
  const made = [];
  const ANSWER = { list: {}, refresh: function () {}, destroy: function () {} };
  global.window = { spirit: { element: {}, require: function (p) {
    required.push(String(p));
    // Its list, a recorder in its place, placed where the real one places itself.
    if (p === LIST) require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, LIST, { create: function (host, opts) { made.push({ host: host, opts: opts }); return ANSWER; } });
    return Promise.resolve({});
  } } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();

  test.subHeading('"the selector", over its own list');
  ok(required[0] === LIST, 'as it runs it requires its own list first', 'it required ' + short(required) + ', not ' + LIST + ' first');
  const S = (((((global.window.spirit.element || {}).spirit || {}).element || {}).search || {}).file);
  ok(!!S && typeof S.create === 'function', 'it places spirit.element.spirit.element.search.file.create, by its path', 'placed: ' + short(S && Object.keys(S)));
  if (!S || typeof S.create !== 'function') return;
  const host = { id: 'the box' };
  const opts = { face: 'pane', zz: 1 };
  const got = S.create(host, opts);
  ok(made.length === 1 && made[0].host === host && made[0].opts === opts, 'create draws its list in the box it is handed, with the options as they are', 'the list was made with: ' + short(made));
  ok(got === ANSWER, 'and answers what its list answers', 'it answered ' + short(got));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
