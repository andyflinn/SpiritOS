'use strict';

// spirit/run/spirit/element/search/file/detail/test/script.js
// The tests of spirit/element/search/file/detail/script.js, and of no other module (spec: ./script.md; goal/G43.32).
// The box: "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js". A real Chrome on a scratch node's face page, the detail mounted by itself on a file of the tree; neither
// Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

// A file every tree holds, of a known size.
const PATH = 'spirit/script.js';

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let code, node, chrome, made;
const SRC = path.join(__dirname, '..', 'script.js');
const js = function (s) { return chrome.evaluate(s); };
const text = function () { return js('String((document.getElementById("zzDetail") || {}).innerText || "")'); };

test.after(function () {
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});

test.run('spirit/element/search/file/detail/script.js is there', 0.2, function () {
  code = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  return !!code || false;
}, test.limit.quick);
test.run('a scratch node comes up with a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads on a page, at spirit.element.search.file.detail, and makes its detail', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  // WHAT IT ASKS FOR, AND ITS OWN ANSWER, AS spirit.requireScript HANDS THEM (goal/G49.9, box v5; Andy: "spirit.requireScript must
  // allways return either an object or a function... or fail/throw"): every path the page's requireScript is asked, and fstat's
  // create counted on what fstat's own require hands back; the detail made by the answer of its require.
  made = await js('window.spirit.readyPromise.then(function () { var own = window.spirit.requireScript; window.__asked = []; window.__fstatMade = 0; window.spirit.requireScript = function (p) { window.__asked.push(String(p)); var a = own.apply(this, arguments); if (String(p) === "spirit/element/fstat/script.js") a = Promise.resolve(a).then(function (m) { var c = m && m.create; if (typeof c === "function" && !m.__counted) { m.__counted = true; m.create = function () { window.__fstatMade += 1; return c.apply(this, arguments); }; } return m; }); return a; }; return window.spirit.requireScript("spirit/element/search/file/detail/script.js"); }).then(function (answer) { var E = answer; var at = (((window.spirit.element || {}).search || {}).file || {}).detail; if (!E || typeof E.create !== "function" || at !== E) return false; return new Promise(function (r) { setTimeout(r, 300); }).then(function () { var b = document.body.appendChild(document.createElement("div")); b.id = "zzDetail"; window.__made = E.create(b, { path: ' + JSON.stringify(PATH) + ' }); return "made"; }); }, function () { return false; })');
  return made === 'made' ? true : false;
}, test.limit.quick);
test.run('it draws with fstat, which it loads itself', 0.2, async function () {
  if (made !== 'made') return false;
  const asked = JSON.parse((await js('JSON.stringify(window.__asked || [])')) || '[]');
  const drew = await until(function () { return js('window.__fstatMade > 0'); }, 10000);
  return asked.indexOf('spirit/element/fstat/script.js') !== -1 && drew ? true : false;
}, test.limit.quick);
// fstat's facts: the MIME type at once, then the size once fs.stat answers.
test.run('it shows the file\'s info: its MIME type and its size', 0.2, async function () {
  if (made !== 'made') return false;
  const shown = await until(function () { return text().then(function (t) { return /javascript/i.test(t) && /\d/.test(t); }); }, 10000);
  return shown ? true : false;
}, test.limit.quick);
test.run('destroy leaves its host empty', 0.2, async function () {
  if (made !== 'made') return false;
  const after = await js('(function () { window.__made.destroy(); return document.getElementById("zzDetail").children.length; })()');
  return after === 0 ? true : false;
}, test.limit.quick);
