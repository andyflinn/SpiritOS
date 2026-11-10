'use strict';

// spirit/run/spirit/element/search/api/test/detailElement.js
// The tests of spirit/element/search/api/detailElement.js, and of no other module (spec: ./detailElement.md; goal/G43.32).
// The browser file runs in node on a bare window, the real api tree reader (spirit/client/apiTreeIndex.js) beside it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'detailElement.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };
function node(tag) {
  const n = { tag: tag, className: '', innerHTML: '', textContent: '', children: [], parentNode: null,
    appendChild: function (c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild: function (c) { n.children = n.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; } };
  return n;
}

const TREE = { fs: { search: { request: { q: '' } }, loadFile: { request: { path: '' } }, DEBUG: { request: {} } }, broken: { ok: false } };

test.startTest('search/api/detailElement.js: one family\'s verbs, the api search\'s detail (goal/G43.32)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/api/detailElement.js is not there'); return; }
  const required = [];
  const asked = [];
  global.document = { createElement: node };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, element: {},
    ready: Promise.resolve({ tree: function () { asked.push('tree'); return Promise.resolve(TREE); } }) } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); return Promise.resolve(true); };
  // In node apiTreeIndex.js answers its module; a page has it at spirit.apiTreeIndex, as here.
  global.window.spirit.apiTreeIndex = require(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'));
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const D = global.window.spirit.element.spirit.element.search && global.window.spirit.element.spirit.element.search.api && global.window.spirit.element.spirit.element.search.api.detailElement;
  ok(D && typeof D.create === 'function', 'it places itself at spirit.element.spirit.element.search.api.detailElement, with a create', 'its place: ' + short(D && Object.keys(D)));
  if (!D || typeof D.create !== 'function') return;
  ok(required.indexOf('spirit/client/apiTreeIndex.js') !== -1, 'it loads the api tree reader itself', 'required: ' + short(required));

  test.subHeading('a family\'s verbs, read from the tree it is handed');
  const host = node('div');
  const made = D.create(host, { family: 'fs', tree: TREE });
  await settle();
  const box = host.children[0];
  const html = box ? box.innerHTML : '';
  ok(!!box && /fs\.loadFile/.test(html) && /fs\.search/.test(html) && html.indexOf('fs.loadFile') < html.indexOf('fs.search'), 'it lists each verb the family serves, as its path, sorted', 'drawn: ' + short(html));
  ok(/\{ q \}/.test(html) && /\{ path \}/.test(html), 'each with the fields its request takes', 'drawn: ' + short(html));
  ok(!/DEBUG/.test(html), 'the owner\'s DEBUG is not shown: no verb offered', 'drawn: ' + short(html));
  ok(!asked.length, 'it asks nothing: what it shows is the tree it is handed', 'asked: ' + short(asked));
  const none = node('div');
  D.create(none, { family: 'broken', tree: TREE });
  D.create(node('div'), { family: 'gone', tree: null });
  await settle();
  ok(/no verbs/.test(none.children[0].innerHTML), 'a family that did not answer shows it has no verbs', 'drawn: ' + short(none.children[0].innerHTML));
  const odd = node('div');
  D.create(odd, { family: '<b>', tree: { '<b>': { 'x<y': { request: {} } } } });
  await settle();
  ok(!/<b>/.test(odd.children[0].innerHTML), 'what it paints is escaped', 'drawn: ' + short(odd.children[0].innerHTML));

  test.subHeading('destroy');
  made.destroy();
  ok(host.children.length === 0, 'destroy takes it out of its host', 'host holds ' + host.children.length);
  const late = node('div');
  const gone = D.create(late, { family: 'fs', tree: TREE });
  gone.destroy();
  await settle();
  ok(late.children.length === 0, 'one destroyed before it drew draws nothing', 'host holds ' + late.children.length);
}()).then(function () { test.reportSuccessFailureCount(); }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
