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
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let set = {}, glyphs = [], N, chrome, left, made, rows, offered, want;
const NO_PAGE = 'no page: the world failed';
const NO_SEL = 'the selector was not made';
const ASKS = 'window.spirit.ready.then(function (s) { window.__asks = []; return Promise.resolve(s.fs.loadFile("spirit/fieldRules.js")).then(null, function () {}).then(function () { var read = s.fs.loadFile; s.fs.loadFile = function (p) { window.__asks.push(String(p)); return read.apply(this, arguments); }; }); })';

test.after(function () {
  if (chrome && chrome.kid) chrome.kid.kill();
  if (N && N.child) N.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (N && N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('the world: a scratch node, and Chrome on its face page', 0.2, async function () {
  set = parsed(fs.readFileSync(path.join(RUN, SET), 'utf8')) || {};
  glyphs = Object.keys(set);
  const where = findChrome();
  if (!where) return 'no Chrome on this machine: nothing judged';
  N = await scratchNode();
  if (!N.up) return 'the scratch node did not come up: nothing judged';
  const c = await chromePage(where);
  if (c.error) { if (c.kid) chrome = c; return 'Chrome: ' + c.error; }
  chrome = c;
  await chrome.send('Page.navigate', { url: N.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  rows = async function () {
    // The list's dropdown: its field opens its popup, whose rows carry their glyph as their key.
    await chrome.evaluate('(function () { var f = window.__root.querySelector("button[id$=field]"); var p = f && document.getElementById(f.id.replace(/field$/, "popup")); if (f && p && p.hidden) f.click(); })()');
    return parsed(await chrome.evaluate('JSON.stringify((function () { var f = window.__root.querySelector("button[id$=field]"); var p = f && document.getElementById(f.id.replace(/field$/, "popup")); return [].map.call(p ? p.querySelectorAll("tr[data-key]") : [], function (r) { return r.getAttribute("data-key"); }); })())')) || [];
  };
  return true;
}, 10000);
test.run('the selector is made', 0.2, async function () {
  if (!rows) return NO_PAGE;
  left = glyphs[0];
  made = await chrome.evaluate(ASKS + '.then(function () {' +
    ' return window.spirit.require("spirit/element/search/icon.js"); }).then(function () { var box = document.body.appendChild(document.createElement("div")); box.style.cssText = "position:fixed;left:0;top:0;width:400px;z-index:99999";' +
    ' window.__root = window.spirit.element.spirit.element.search.icon.create(box, { exclude: [' + JSON.stringify(left) + '] }); return "made"; })').catch(function (e) { return String(e && e.message); });
  return made === 'made' ? true : 'the selector: ' + short(made);
}, 5000);
test.run('it reads the icon set file and no other, through spirit.fs.loadFile', 0.2, async function () {
  if (made !== 'made') return NO_SEL;
  await until(function () { return chrome.evaluate('window.__asks.length > 0'); }, 8000);
  await until(function () { return rows().then(function (r) { return r.length > 0; }); }, 8000);
  offered = await rows();
  // The page's own reads of other files stand beside it (the boot reads join's state).
  const asks = (parsed(await chrome.evaluate('JSON.stringify(window.__asks)')) || []).filter(function (p) { return /iconSet\.json$/.test(p); });
  return JSON.stringify(asks) === JSON.stringify([SET]) ? true : 'it read ' + short(asks) + ', not ' + SET + ' alone';
}, 40000);
test.run('it offers every icon of that file', 0.2, function () {
  if (!offered) return NO_SEL;
  want = glyphs.filter(function (g) { return g !== left; });
  const missing = want.filter(function (g) { return offered.indexOf(g) === -1; });
  return missing.length === 0 ? true : missing.length + ' of ' + want.length + ' are not offered, ' + short(missing.slice(0, 20));
}, 1000);
test.run('and nothing else', 0.2, function () {
  if (!offered || !want) return NO_SEL;
  return offered.length === want.length ? true : 'it offers ' + offered.length + ' of ' + want.length;
}, 1000);
test.run('an excluded glyph stays off it', 0.2, function () {
  if (!offered) return NO_SEL;
  return offered.indexOf(left) === -1 ? true : 'an excluded glyph is offered';
}, 1000);
// ONE LIST (goal/G43.32): no rows of its own, its popup the icons list's dropdown.
test.run('it draws no list of its own: its popup is the icons list\'s dropdown', 0.2, async function () {
  if (made !== 'made') return NO_SEL;
  const own = await chrome.evaluate('window.__root.querySelectorAll(".icon-selector-row, .icon-selector-list").length');
  return own === 0 ? true : own + ' rows or lists of its own';
}, 3000);
// A pick: its value is the glyph, and one change bubbles.
test.run('a pick makes its value that glyph, with one bubbling change', 0.2, async function () {
  if (made !== 'made') return NO_SEL;
  const pickedNow = await chrome.evaluate('(function () { var n = 0; window.__root.parentNode.addEventListener("change", function () { n += 1; }); var f = window.__root.querySelector("button[id$=field]"); var p = document.getElementById(f.id.replace(/field$/, "popup")); var r = p.querySelector("tr[data-key]"); var g = r.getAttribute("data-key"); r.click(); return new Promise(function (res) { setTimeout(function () { res(JSON.stringify({ value: window.__root.value, want: g, changes: n })); }, 300); }); })()');
  const pv = parsed(pickedNow) || {};
  return pv.value && pv.value === pv.want && pv.changes === 1 ? true : 'after a pick: ' + short(pickedNow);
}, 3000);

// The box: "A page reads the file once". A fresh page, the list and the selector made at the same moment, the set not yet there.
// the box: "A page reads the file once"
test.run('a selector and two lists made together read it once', 0.2, async function () {
  if (!rows) return NO_PAGE;
  await chrome.send('Page.navigate', { url: N.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  await chrome.evaluate(ASKS + '.then(function () {' +
    ' return Promise.all([window.spirit.require("spirit/element/search/icon.js"), window.spirit.require("spirit/element/search/icon/listElement.js")]); }).then(function () { var box = document.body.appendChild(document.createElement("div"));' +
    ' window.__root = window.spirit.element.spirit.element.search.icon.create(box, {}); window.spirit.element.spirit.element.search.icon.listElement.create(document.body.appendChild(document.createElement("div")), { face: "pane" }); window.spirit.element.spirit.element.search.icon.listElement.create(document.body.appendChild(document.createElement("div")), { face: "pane" }); return 1; })');
  await until(function () { return rows().then(function (r) { return r.length > 0; }); }, 8000);
  const once = (parsed(await chrome.evaluate('JSON.stringify(window.__asks)')) || []).filter(function (p) { return /iconSet\.json$/.test(p); });
  return once.length === 1 ? true : 'reads: ' + short(once);
}, 100000);
test.run('and the selector has all of it', 0.2, async function () {
  if (!rows) return NO_PAGE;
  const n = (await rows()).length;
  return n === glyphs.length ? true : 'the selector offers ' + n + ' of ' + glyphs.length;
}, 5000);
