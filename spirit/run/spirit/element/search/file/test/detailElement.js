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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// A file every tree holds, of a known size.
const PATH = 'spirit/spirit.js';

test.startTest('detailElement.js: one file, its detail, drawn by fstat (goal/G43.32)');

(async function () {
  const SRC = path.join(__dirname, '..', 'detailElement.js');
  const code = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  ok(!!code, 'spirit/element/search/file/detailElement.js is there', 'spirit/element/search/file/detailElement.js is not there: nothing below can pass');
  ok(/spirit\/element\/fstat\.js/.test(code) && /fstat\.create\(/.test(code), 'it draws with fstat, which it loads itself', 'it does not load spirit/element/fstat.js and draw with it');
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const js = function (s) { return chrome.evaluate(s); };
    const made = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/file/detailElement.js"); }).then(function () { var E = (((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).file || {}).detailElement; if (!E || typeof E.create !== "function") return "no create"; var b = document.body.appendChild(document.createElement("div")); b.id = "zzDetail"; window.__made = E.create(b, { path: ' + JSON.stringify(PATH) + ' }); return "made"; }, function (e) { return "ERR " + e; })');
    ok(made === 'made', 'it loads on a page, at spirit.element.spirit.element.search.file.detailElement, and makes its detail', 'mounting it: ' + short(made));
    if (made !== 'made') return;
    const text = function () { return js('String((document.getElementById("zzDetail") || {}).innerText || "")'); };
    // fstat's facts: the MIME type at once, then the size once fs.stat answers.
    const shown = await until(function () { return text().then(function (t) { return /javascript/i.test(t) && /\d/.test(t); }); }, 10000);
    ok(shown, 'it shows the file\'s info: its MIME type and its size', 'the detail shows: ' + short(await text()));
    const after = await js('(function () { window.__made.destroy(); return document.getElementById("zzDetail").children.length; })()');
    ok(after === 0, 'destroy leaves its host empty', 'after destroy it holds ' + short(after) + ' children');
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
