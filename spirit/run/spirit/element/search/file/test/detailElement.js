'use strict';

// spirit/run/spirit/element/search/file/test/detailElement.js
// The tests of spirit/element/search/file/detailElement.js, and of no other module (spec: ./detailElement.md; goal/G43.32).
// The box: "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js". A real Chrome on a scratch node's face page, the detail mounted by itself on a file of the tree; neither
// Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// A file every tree holds, of a known size.
const PATH = 'spirit/spirit.js';

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let code, node, chrome, made;
const SRC = path.join(__dirname, '..', 'detailElement.js');
const js = function (s) { return chrome.evaluate(s); };
const text = function () { return js('String((document.getElementById("zzDetail") || {}).innerText || "")'); };

test.after(function () {
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});

test.run('spirit/element/search/file/detailElement.js is there', 0.2, function () {
  code = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  return !!code || 'spirit/element/search/file/detailElement.js is not there: nothing below can pass';
}, test.limit.quick);
test.run('it draws with fstat, which it loads itself', 0.2, function () {
  return /spirit\/element\/fstat\.js/.test(code) && /fstat\.create\(/.test(code) ? true : 'it does not load spirit/element/fstat.js and draw with it';
}, test.limit.quick);
test.run('the world: a scratch node, and a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : 'the face page never had spirit.ready';
}, test.limit.slow);
test.run('it loads on a page, at spirit.element.spirit.element.search.file.detailElement, and makes its detail', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
  made = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/file/detailElement.js"); }).then(function () { var E = (((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).file || {}).detailElement; if (!E || typeof E.create !== "function") return "no create"; var b = document.body.appendChild(document.createElement("div")); b.id = "zzDetail"; window.__made = E.create(b, { path: ' + JSON.stringify(PATH) + ' }); return "made"; }, function (e) { return "ERR " + e; })');
  return made === 'made' ? true : 'mounting it: ' + short(made);
}, test.limit.quick);
// fstat's facts: the MIME type at once, then the size once fs.stat answers.
test.run('it shows the file\'s info: its MIME type and its size', 0.2, async function () {
  if (made !== 'made') return 'no detail was made';
  const shown = await until(function () { return text().then(function (t) { return /javascript/i.test(t) && /\d/.test(t); }); }, 10000);
  return shown ? true : 'the detail shows: ' + short(await text());
}, test.limit.quick);
test.run('destroy leaves its host empty', 0.2, async function () {
  if (made !== 'made') return 'no detail was made';
  const after = await js('(function () { window.__made.destroy(); return document.getElementById("zzDetail").children.length; })()');
  return after === 0 ? true : 'after destroy it holds ' + short(after) + ' children';
}, test.limit.quick);
