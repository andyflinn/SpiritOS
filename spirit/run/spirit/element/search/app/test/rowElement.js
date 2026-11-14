'use strict';

// spirit/run/spirit/element/search/app/test/rowElement.js
// The tests of spirit/element/search/app/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'rowElement.js');
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
  if (!fs.existsSync(FILE)) return 'spirit/element/search/app/rowElement.js is not there';
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : 'the face page never had spirit.ready';
}, test.limit.slow);
test.run('it loads through spirit.require', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowElement.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
  return loaded === 'loaded' ? true : 'it did not load: ' + short(loaded);
}, test.limit.quick);
test.run('spirit.element.spirit.element.search.app.rowElement.create(row) makes a row', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  made = await chrome.evaluate('(function () { window.row = spirit.element.spirit.element.search.app.rowElement.create(' + R + '); var c = document.getElementById("under-test"); var hosts = {}; window.row.cells().forEach(function (x) { var s = document.createElement("span"); c.appendChild(s); hosts[x.name] = s; }); window.row.mount(hosts); return true; }())');
  return made === true ? true : 'it made no row: ' + short(made);
}, test.limit.quick);
test.run('the row shows the label', 0.2, async function () {
  if (made !== true) return 'no row was made';
  t = String(await text());
  return t.indexOf(ROW.label) !== -1 ? true : 'the row shows ' + short(t);
}, test.limit.quick);
test.run('the row shows the icon', 0.2, async function () {
  if (made !== true) return 'no row was made';
  return (await html()).indexOf(ROW.icon) !== -1 || /<svg|<img/.test(await html()) ? true : 'the row has no icon: ' + short(await html());
}, test.limit.quick);
test.run('it shows icon and label and nothing else', 0.2, function () {
  if (t === undefined) return 'no row was made';
  return t.split(ROW.label).join('').split(ROW.icon).join('').trim() === '' ? true : 'it also shows: ' + short(t);
}, test.limit.quick);
// WHAT THE STREAM CHANGES, IT PAINTS (Andy, G41.32: "who paints, listens"), as every row element does.
test.run('a new label paints on the row', 0.2, async function () {
  if (made !== true) return 'no row was made';
  await chrome.evaluate('window.row.apply({ label: "Zz New Label", icon: ' + JSON.stringify(ROW.icon) + ' })');
  const painted = await until(function () { return text().then(function (x) { return x.indexOf('Zz New Label') !== -1; }); }, 3000);
  return painted ? true : 'the row kept its label: ' + short(await text());
}, test.limit.quick);
