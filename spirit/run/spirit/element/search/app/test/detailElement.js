'use strict';

// spirit/run/spirit/element/search/app/test/detailElement.js
// The tests of spirit/element/search/app/detailElement.js, and of no other module (spec: ./detailElement.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'detailElement.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made, t;
const NO_WORLD = 'no scratch node or no Chrome: the world failed';
const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
const R = JSON.stringify(ROW);

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('the world: a scratch node, and a Chrome on its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/app/detailElement.js is not there';
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : 'the face page never had spirit.ready';
}, test.limit.slow);
test.run('it loads through spirit.require', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app/detailElement.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
  return loaded === 'loaded' ? true : 'it did not load: ' + short(loaded);
}, test.limit.quick);
test.run('spirit.element.spirit.element.search.app.detailElement.create(host, { row }) makes a detail', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  made = await chrome.evaluate('(function () { window.detail = spirit.element.spirit.element.search.app.detailElement.create(document.getElementById("under-test"), { row: ' + R + ' }); return !!window.detail; }())');
  return made === true ? true : 'it made no detail: ' + short(made);
}, test.limit.quick);
test.run('the detail shows the label', 0.2, async function () {
  if (made !== true) return 'no detail was made';
  t = String(await text());
  return t.indexOf(ROW.label) !== -1 ? true : 'the detail shows ' + short(t);
}, test.limit.quick);
test.run('the detail shows the icon', 0.2, async function () {
  if (made !== true) return 'no detail was made';
  return (await html()).indexOf(ROW.icon) !== -1 || /<svg|<img/.test(await html()) ? true : 'the detail has no icon: ' + short(await html());
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return 'no detail was made';
  const empty = await chrome.evaluate('(function () { window.detail.destroy(); return document.getElementById("under-test").children.length === 0; }())');
  return empty === true ? true : 'destroy left ' + short(await text());
}, test.limit.quick);
