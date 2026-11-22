'use strict';

// spirit/run/spirit/element/search/app/test/tile.js
// The tests of spirit/element/search/app/tile.js, and of no other module (spec: ./tile.md; goal/G47.4). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'tile.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };
const R = JSON.stringify(ROW);

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made;

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up with a Chrome on its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads through spirit.require', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app/tile.js"); }).then(function () { return "loaded"; }, function () { return false; })');
  return loaded === 'loaded' ? true : false;
}, test.limit.quick);
test.run('its create answers one node for the app it is handed, keyed by the app', 0.2, async function () {
  if (loaded !== 'loaded') return false;
  made = JSON.parse(await chrome.evaluate('(function () { window.__pressed = []; var n = spirit.required.spirit.element.search.app.tile.create(' + R + ', { press: function (row, key) { window.__pressed.push(key); } }); var c = document.createElement("div"); c.id = "under-test"; c.appendChild(n); document.body.appendChild(c); return JSON.stringify({ isNode: n.nodeType === 1, key: n.getAttribute("data-key"), text: n.innerText, html: n.innerHTML, bar: !!n.querySelector(".tile-bar"), iconFirst: !!(n.firstElementChild && n.firstElementChild.classList.contains("icon")), labelLast: !!(n.lastElementChild && n.lastElementChild.classList.contains("label")) }); }())'));
  return (made.isNode === true && made.key === ROW.key) ? true : false;
}, test.limit.quick);
test.run('the tile shows the app\'s icon above its label, a bar for the relevance between them', 0.2, function () {
  if (!made) return false;
  return (made.iconFirst && made.bar && made.labelLast && made.text.indexOf(ROW.label) !== -1 && (made.html.indexOf(ROW.icon) !== -1 || /<svg|<img/.test(made.html))) ? true : false;
}, test.limit.quick);
test.run('a press on the tile is handed to press, with the app\'s row and key', 0.2, async function () {
  if (!made) return false;
  const pressed = await chrome.evaluate('(function () { document.querySelector("#under-test .app-icon").click(); return JSON.stringify(window.__pressed); }())');
  return pressed === JSON.stringify([ROW.key]) ? true : false;
}, test.limit.quick);
