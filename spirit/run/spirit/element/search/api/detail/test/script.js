'use strict';

// spirit/run/spirit/element/search/api/detail/test/script.js
// The tests of spirit/element/search/api/detail/script.js, and of no other module (spec: ./script.md; goal/G43.32).
// The browser file runs in node on a bare window, the real api tree reader (spirit/fuckingGarbage/apiTreeIndex.js) beside it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');

const FILE = path.join(__dirname, '..', 'script.js');
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

test.run('the detail runs on a bare window, the real api tree reader beside it', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  required = [];
  asked = [];
  global.document = { createElement: node };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, element: {},
    readyPromise: Promise.resolve({ tree: function () { asked.push('tree'); return Promise.resolve(TREE); } }) } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // ITS ONE PART IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): apiTreeIndex.js, the real module, as the page's loader answers it.
  const STANDS = { 'spirit/fuckingGarbage/apiTreeIndex.js': LOADER.requireScript('spirit/fuckingGarbage/apiTreeIndex.js') };
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    return Object.prototype.hasOwnProperty.call(STANDS, p) ? Promise.resolve(STANDS[p]) : Promise.reject(new Error('no stand-in for ' + p));
  };
  // Its own answer, what the loader places at its place.
  const answer = PAGE_LOAD.runAsPage(FILE);
  await settle();
  const SE = ((global.window.spirit.required || {}).spirit || {}).element || {};
  D = SE.search && SE.search.api && SE.search.api.detail === answer ? answer : null;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.element.search.api.detail, with a create', 0.2, function () {
  return D && typeof D.create === 'function' ? true : false;
}, test.limit.quick);
test.run('it loads the api tree reader itself', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/fuckingGarbage/apiTreeIndex.js') !== -1 ? true : false;
}, test.limit.quick);

// a family's verbs, read from the tree it is handed
test.run('it lists each verb the branch serves, as its path, sorted', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return false;
  host = node('div');
  made = D.create(host, { family: 'fs', tree: TREE });
  await settle();
  const box = host.children[0];
  html = box ? box.innerHTML : '';
  return !!box && /fs\.loadFile/.test(html) && /fs\.search/.test(html) && html.indexOf('fs.loadFile') < html.indexOf('fs.search') ? true : false;
}, test.limit.quick);
test.run('each verb is listed with the fields its request takes', 0.2, function () {
  if (html === undefined) return false;
  return /\{ q \}/.test(html) && /\{ path \}/.test(html) ? true : false;
}, test.limit.quick);
test.run('the owner\'s DEBUG is not shown, as no verb is offered', 0.2, function () {
  if (html === undefined) return false;
  return !/DEBUG/.test(html) ? true : false;
}, test.limit.quick);
test.run('it asks nothing: what it shows is the tree it is handed', 0.2, function () {
  if (!asked || html === undefined) return false;
  return !asked.length ? true : false;
}, test.limit.quick);
test.run('a branch that did not answer shows it has no verbs', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return false;
  none = node('div');
  D.create(none, { family: 'broken', tree: TREE });
  D.create(node('div'), { family: 'gone', tree: null });
  await settle();
  return none.children[0] && /no verbs/.test(none.children[0].innerHTML) ? true : false;
}, test.limit.quick);
test.run('what it paints is escaped', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return false;
  odd = node('div');
  D.create(odd, { family: '<b>', tree: { '<b>': { 'x<y': { request: {} } } } });
  await settle();
  return odd.children[0] && !/<b>/.test(odd.children[0].innerHTML) ? true : false;
}, test.limit.quick);

// destroy
test.run('destroy takes it out of its host', 0.2, function () {
  if (!made) return false;
  made.destroy();
  return host.children.length === 0 ? true : false;
}, test.limit.quick);
test.run('a detail destroyed before it drew draws nothing', 0.2, async function () {
  if (!D || typeof D.create !== 'function') return false;
  const late = node('div');
  const gone = D.create(late, { family: 'fs', tree: TREE });
  gone.destroy();
  await settle();
  return late.children.length === 0 ? true : false;
}, test.limit.quick);
