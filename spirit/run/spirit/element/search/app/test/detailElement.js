'use strict';

// spirit/run/spirit/element/search/app/test/detailElement.js
// The tests of spirit/element/search/app/detailElement.js, and of no other module (spec: ./detailElement.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'detailElement.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

test.startTest('detailElement.js: one app, its detail (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/app/detailElement.js is not there'); return; }
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app/detailElement.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'it loads through spirit.require', 'it did not load: ' + short(loaded));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
    const R = JSON.stringify(ROW);
    const made = await chrome.evaluate('(function () { window.detail = spirit.element.spirit.element.search.app.detailElement.create(document.getElementById("under-test"), { row: ' + R + ' }); return !!window.detail; }())');
    ok(made === true, 'spirit.element.spirit.element.search.app.detailElement.create(host, { row }) makes a detail', 'it made no detail: ' + short(made));
    const t = String(await text());
    ok(t.indexOf(ROW.label) !== -1, 'the detail shows the label', 'the detail shows ' + short(t));
    ok((await html()).indexOf(ROW.icon) !== -1 || /<svg|<img/.test(await html()), 'the detail shows the icon', 'the detail has no icon: ' + short(await html()));
    const empty = await chrome.evaluate('(function () { window.detail.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await text()));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
