'use strict';

// spirit/run/spirit/element/search/app/test/rowElement.js
// The tests of spirit/element/search/app/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'rowElement.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

test.startTest('appSelector/rowElement.js: one app, as a row (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/app/rowElement.js is not there'); return; }
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowElement.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'it loads through spirit.require', 'it did not load: ' + short(loaded));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
    const R = JSON.stringify(ROW);
    const made = await chrome.evaluate('(function () { window.row = spirit.element.search.app.rowElement.create(' + R + '); var c = document.getElementById("under-test"); var hosts = {}; window.row.cells().forEach(function (x) { var s = document.createElement("span"); c.appendChild(s); hosts[x.name] = s; }); window.row.mount(hosts); return true; }())');
    ok(made === true, 'spirit.element.search.app.rowElement.create(row) makes a row', 'it made no row: ' + short(made));
    const t = String(await text());
    ok(t.indexOf(ROW.label) !== -1, 'the row shows the label', 'the row shows ' + short(t));
    ok((await html()).indexOf(ROW.icon) !== -1 || /<svg|<img/.test(await html()), 'the row shows the icon', 'the row has no icon: ' + short(await html()));
    ok(t.split(ROW.label).join('').split(ROW.icon).join('').trim() === '', 'it shows icon and label and nothing else', 'it also shows: ' + short(t));
    // WHAT THE STREAM CHANGES, IT PAINTS (Andy, G41.32: "who paints, listens"), as every row element does.
    await chrome.evaluate('window.row.apply({ label: "Zz New Label", icon: ' + JSON.stringify(ROW.icon) + ' })');
    const painted = await until(function () { return text().then(function (x) { return x.indexOf('Zz New Label') !== -1; }); }, 3000);
    ok(painted, 'a new label paints on the row', 'the row kept its label: ' + short(await text()));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
