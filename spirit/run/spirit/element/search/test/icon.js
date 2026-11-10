'use strict';

// spirit/run/spirit/element/search/test/icon.js
// What the icon selector offers (spec: ./icon.md; goal/G43.11). Andy: "run://spirit/iconSet.json IS the system set now."
// The box: "So the icon selector reads it too". Since goal/G43.32 it is a thin selector over its list (Andy: "any search-unit
// has ONE list shared by popup and list modes."): its dropdown is icon/listElement.js's. A real Chrome on a scratch node's
// page, the selector made and opened there.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const SET = 'spirit/iconSet.json';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

test.startTest('icon.js: the icon selector, one list with the icons list, offering spirit/iconSet.json (goal/G43.11, G43.32)');

(async function () {
  const set = parsed(fs.readFileSync(path.join(RUN, SET), 'utf8')) || {};
  const glyphs = Object.keys(set);
  const where = findChrome();
  if (!where) { test.fail('no Chrome on this machine: nothing judged'); test.reportSuccessFailureCount(); return; }
  const N = await scratchNode();
  let chrome = null;
  try {
    if (!N.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    await chrome.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const left = glyphs[0];
    const made = await chrome.evaluate('window.spirit.ready.then(function (s) { window.__asks = []; return Promise.resolve(s.fs.loadFile("spirit/fieldRules.js")).then(null, function () {}).then(function () { var read = s.fs.loadFile; s.fs.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }); }).then(function () {' +
      ' return window.spirit.require("spirit/element/search/icon.js"); }).then(function () { var box = document.body.appendChild(document.createElement("div")); box.style.cssText = "position:fixed;left:0;top:0;width:400px;z-index:99999";' +
      ' window.__root = window.spirit.element.spirit.element.search.icon.create(box, { exclude: [' + JSON.stringify(left) + '] }); return "made"; })').catch(function (e) { return String(e && e.message); });
    ok(made === 'made', 'the selector is made', 'the selector: ' + short(made));
    if (made !== 'made') return;
    await until(function () { return chrome.evaluate('window.__asks.length > 0'); }, 8000);
    const rows = async function () {
      // The list's dropdown: its field opens its popup, whose rows carry their glyph as their key.
      await chrome.evaluate('(function () { var f = window.__root.querySelector("button[id$=field]"); var p = f && document.getElementById(f.id.replace(/field$/, "popup")); if (f && p && p.hidden) f.click(); })()');
      return parsed(await chrome.evaluate('JSON.stringify((function () { var f = window.__root.querySelector("button[id$=field]"); var p = f && document.getElementById(f.id.replace(/field$/, "popup")); return [].map.call(p ? p.querySelectorAll("tr[data-key]") : [], function (r) { return r.getAttribute("data-key"); }); })())')) || [];
    };
    await until(function () { return rows().then(function (r) { return r.length > 0; }); }, 8000);
    const offered = await rows();
    // The page's own reads of other files stand beside it (the boot reads join's state).
    const asks = (parsed(await chrome.evaluate('JSON.stringify(window.__asks)')) || []).filter(function (p) { return /iconSet\.json$/.test(p); });
    ok(JSON.stringify(asks) === JSON.stringify([SET]), 'it reads ' + SET + ' and no other, through spirit.fs.loadFile', 'it read: ' + short(asks));
    const want = glyphs.filter(function (g) { return g !== left; });
    const missing = want.filter(function (g) { return offered.indexOf(g) === -1; });
    ok(missing.length === 0, 'it offers every icon of that file: ' + want.length, missing.length + ' are not offered, ' + short(missing.slice(0, 20)));
    ok(offered.length === want.length, 'and nothing else', 'it offers ' + offered.length + ' of ' + want.length);
    ok(offered.indexOf(left) === -1, 'an excluded glyph stays off it', 'an excluded glyph is offered');
    // ONE LIST (goal/G43.32): no rows of its own, its popup the icons list's dropdown.
    const own = await chrome.evaluate('window.__root.querySelectorAll(".icon-selector-row, .icon-selector-list").length');
    ok(own === 0, 'it draws no list of its own: its popup is the icons list\'s dropdown', own + ' rows or lists of its own');
    // A pick: its value is the glyph, and one change bubbles.
    const pickedNow = await chrome.evaluate('(function () { var n = 0; window.__root.parentNode.addEventListener("change", function () { n += 1; }); var f = window.__root.querySelector("button[id$=field]"); var p = document.getElementById(f.id.replace(/field$/, "popup")); var r = p.querySelector("tr[data-key]"); var g = r.getAttribute("data-key"); r.click(); return new Promise(function (res) { setTimeout(function () { res(JSON.stringify({ value: window.__root.value, want: g, changes: n })); }, 300); }); })()');
    const pv = parsed(pickedNow) || {};
    ok(pv.value && pv.value === pv.want && pv.changes === 1, 'a pick makes its value that glyph, with one bubbling change', 'after a pick: ' + short(pickedNow));

    // The box: "A page reads the file once". A fresh page, the list and the selector made at the same moment, the set not yet there.
    test.subHeading('the box: "A page reads the file once"');
    await chrome.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    await chrome.evaluate('window.spirit.ready.then(function (s) { window.__asks = []; return Promise.resolve(s.fs.loadFile("spirit/fieldRules.js")).then(null, function () {}).then(function () { var read = s.fs.loadFile; s.fs.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }); }).then(function () {' +
      ' return Promise.all([window.spirit.require("spirit/element/search/icon.js"), window.spirit.require("spirit/element/search/icon/listElement.js")]); }).then(function () { var box = document.body.appendChild(document.createElement("div"));' +
      ' window.__root = window.spirit.element.spirit.element.search.icon.create(box, {}); window.spirit.element.spirit.element.search.icon.listElement.create(document.body.appendChild(document.createElement("div")), { face: "pane" }); window.spirit.element.spirit.element.search.icon.listElement.create(document.body.appendChild(document.createElement("div")), { face: "pane" }); return 1; })');
    await until(function () { return rows().then(function (r) { return r.length > 0; }); }, 8000);
    const once = (parsed(await chrome.evaluate('JSON.stringify(window.__asks)')) || []).filter(function (p) { return /iconSet\.json$/.test(p); });
    ok(once.length === 1, 'a selector and two lists made together read it once', 'reads: ' + short(once));
    ok((await rows()).length === glyphs.length, 'and the selector has all of it', 'the selector offers ' + (await rows()).length + ' of ' + glyphs.length);
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (N.child) N.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
