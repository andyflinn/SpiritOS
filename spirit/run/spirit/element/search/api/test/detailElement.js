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

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let required, asked, D, host, made, html, none, odd;
const NO_D = 'no detail element: the world failed';

test.run('the world: the detail runs on a bare window, the real api tree reader beside it', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/api/detailElement.js is not there';
  required = [];
  asked = [];
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
  D = global.window.spirit.element.spirit.element.search && global.window.spirit.element.spirit.element.search.api && global.window.spirit.element.spirit.element.search.api.detailElement;
  return true;
}, 1000);
test.run('it places itself at spirit.element.spirit.element.search.api.detailElement, with a create', 0.2, function () {
  return D && typeof D.create === 'function' ? true : 'its place: ' + short(D && Object.keys(D));
}, 1000);
test.run('it loads the api tree reader itself', 0.2, function () {
  if (!required) return NO_D;
  return required.indexOf('spirit/client/apiTreeIndex.js') !== -1 ? true : 'required: ' + short(required);
}, 1000);

// a family's verbs, read from the tree it is handed
test.run('it lists each verb the family serves, as its path, sorted', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return NO_D;
  host = node('div');
  made = D.create(host, { family: 'fs', tree: TREE });
  await settle();
  const box = host.children[0];
  html = box ? box.innerHTML : '';
  return !!box && /fs\.loadFile/.test(html) && /fs\.search/.test(html) && html.indexOf('fs.loadFile') < html.indexOf('fs.search') ? true : 'drawn: ' + short(html);
}, 1000);
test.run('each with the fields its request takes', 0.2, function () {
  if (html === undefined) return NO_D;
  return /\{ q \}/.test(html) && /\{ path \}/.test(html) ? true : 'drawn: ' + short(html);
}, 1000);
test.run('the owner\'s DEBUG is not shown: no verb offered', 0.2, function () {
  if (html === undefined) return NO_D;
  return !/DEBUG/.test(html) ? true : 'drawn: ' + short(html);
}, 1000);
test.run('it asks nothing: what it shows is the tree it is handed', 0.2, function () {
  if (!asked || html === undefined) return NO_D;
  return !asked.length ? true : 'asked: ' + short(asked);
}, 1000);
test.run('a family that did not answer shows it has no verbs', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return NO_D;
  none = node('div');
  D.create(none, { family: 'broken', tree: TREE });
  D.create(node('div'), { family: 'gone', tree: null });
  await settle();
  return none.children[0] && /no verbs/.test(none.children[0].innerHTML) ? true : 'drawn: ' + short(none.children[0] && none.children[0].innerHTML);
}, 1000);
test.run('what it paints is escaped', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return NO_D;
  odd = node('div');
  D.create(odd, { family: '<b>', tree: { '<b>': { 'x<y': { request: {} } } } });
  await settle();
  return odd.children[0] && !/<b>/.test(odd.children[0].innerHTML) ? true : 'drawn: ' + short(odd.children[0] && odd.children[0].innerHTML);
}, 1000);

// destroy
test.run('destroy takes it out of its host', 0.2, function () {
  if (!made) return NO_D;
  made.destroy();
  return host.children.length === 0 ? true : 'host holds ' + host.children.length;
}, 1000);
test.run('one destroyed before it drew draws nothing', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return NO_D;
  const late = node('div');
  const gone = D.create(late, { family: 'fs', tree: TREE });
  gone.destroy();
  await settle();
  return late.children.length === 0 ? true : 'host holds ' + late.children.length;
}, 1000);
