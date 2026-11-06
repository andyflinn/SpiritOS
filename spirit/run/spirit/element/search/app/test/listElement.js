'use strict';

// spirit/run/spirit/element/search/app/test/listElement.js
// The tests of spirit/element/search/app.js, and of no other module (spec: ./listElement.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

test.startTest('appSelector/listElement.js: the app list (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/app.js is not there'); return; }
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'it loads through spirit.require', 'it did not load: ' + short(loaded));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
    const R = JSON.stringify(ROW);
    const made = await chrome.evaluate('(function () { window.asked = []; var real = spirit.app.searchApp; spirit.app.searchApp = function (a) { window.asked.push(a); return real.call(spirit.app, a); }; window.picks = []; window.list = spirit.elements.appList.create(document.getElementById("under-test"), { face: "pane", pick: function (row) { window.picks.push(row); } }); return true; }())');
    ok(made === true, 'spirit.elements.appList.create(host, opts) makes a list', 'it made no list: ' + short(made));
    const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
    const drawn = await until(function () { return text().then(function (x) { return x.indexOf(identity.label) !== -1; }); }, 8000);
    ok(drawn, 'it draws what app.search finds', 'it drew ' + short(await text()));
    const asked = await chrome.evaluate('JSON.stringify(window.asked)');
    ok(JSON.parse(asked).length > 0 && JSON.parse(asked).every(function (a) { return Object.keys(a).every(function (k) { return k === 'q'; }); }), 'it asks app.search with a search string and nothing more', 'it asked ' + short(asked));
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (!all[i].children.length && String(all[i].innerText || "").indexOf(want) !== -1) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(pressed === true, 'its row can be pressed', 'no row to press');
    const picked = await until(function () { return chrome.evaluate('window.picks.length === 1 && String(window.picks[0].label).indexOf(' + JSON.stringify(identity.label) + ') !== -1'); }, 3000);
    ok(picked, 'a press hands the row to pick', 'pick got ' + short(await chrome.evaluate('JSON.stringify(window.picks)')));
    const refreshed = await chrome.evaluate('(function () { var n = window.asked.length; window.list.refresh(); return new Promise(function (r) { setTimeout(function () { r(window.asked.length > n); }, 500); }); }())');
    ok(refreshed === true, 'refresh asks again', 'refresh asked nothing');
    const empty = await chrome.evaluate('(function () { window.list.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await text()));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
