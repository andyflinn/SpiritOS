'use strict';

// spirit/run/spirit/element/search/file/tile/test/script.js
// The tests of spirit/element/search/file/tile/script.js, and of no other module (spec: ./script.md; goal/G47.4). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'tile', 'script.js');
const ROW = { key: 'zz/folder/notes.txt', kind: 'file' };
const R = JSON.stringify(ROW);

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made;

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up with a Chrome on its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
}, test.limit.slow, { why: 'it starts a scratch node and opens it in Chrome' });
test.run('it loads through spirit.requireScript', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/file/tile/script.js"); }).then(function () { return "loaded"; }, function () { return false; })');
  return loaded === 'loaded' ? true : false;
}, test.limit.quick);
test.run('its create answers one node for the file it is handed, keyed by its path', 0.2, async function () {
  if (loaded !== 'loaded') return false;
  made = JSON.parse(await chrome.evaluate('(function () { window.__pressed = []; var n = spirit.element.search.file.tile.create(' + R + ', { icon: "📄", press: function (row, key) { window.__pressed.push(key); } }); var c = document.createElement("div"); c.id = "under-test"; c.appendChild(n); document.body.appendChild(c); return JSON.stringify({ isNode: n.nodeType === 1, key: n.getAttribute("data-key"), label: (n.querySelector(".label") || {}).textContent, html: n.innerHTML, bar: !!n.querySelector(".tile-bar"), iconFirst: !!(n.firstElementChild && n.firstElementChild.classList.contains("icon")) }); }())'));
  return (made.isNode === true && made.key === ROW.key) ? true : false;
}, test.limit.quick);
test.run('the tile shows the icon it is handed above the file\'s name, a bar for the relevance between them', 0.2, function () {
  if (!made) return false;
  return (made.iconFirst && made.bar && made.label === 'notes.txt' && (made.html.indexOf('📄') !== -1 || /<svg|<img/.test(made.html))) ? true : false;
}, test.limit.quick);
test.run('a press on the tile is handed to press, with the file\'s row and path', 0.2, async function () {
  if (!made) return false;
  const pressed = await chrome.evaluate('(function () { document.querySelector("#under-test .app-icon").click(); return JSON.stringify(window.__pressed); }())');
  return pressed === JSON.stringify([ROW.key]) ? true : false;
}, test.limit.quick);
