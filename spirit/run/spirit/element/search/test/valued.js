'use strict';

// spirit/run/spirit/element/search/test/valued.js
// The tests of spirit/element/search/valued.js, and of no other module (spec: ./valued.md; goal/G43.6). Andy, box: "It will be
// spirit.element.spirit.element.valued, on disc and in spirit", "It is searchable (probabilitySearch), over rows it already holds, with no node
// verb." Since goal/G43.18 (Q5) it is spirit.element.spirit.element.search.valued. A real Chrome on a scratch node's page, the element mounted by itself, rows of the test's own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));


// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let code = '', node, chrome, js, loaded, h = {}, read, first, redrawn, found, keeps;
const BEST = 'var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; });';

test.run('spirit/element/search/valued.js is there', 0.2, function () {
  code = fs.existsSync(path.join(__dirname, '..', 'valued.js')) ? fs.readFileSync(path.join(__dirname, '..', 'valued.js'), 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  return !!code ? true : false;
}, test.limit.quick);
test.run('it reaches no old code', 0.2, function () {
  return code && !/\.elements\b|spirit\.shell/.test(code) ? true : false;
}, test.limit.quick);
test.run('it is a probabilitySearch (spirit/element/search.js since goal/G43.18)', 0.2, function () {
  return code && /spirit\/element\/search\.js|element\.search\.create/.test(code) ? true : false;
}, test.limit.quick);

test.after(function () {
  if (chrome && chrome.kid) chrome.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});
test.run('the world: a scratch node, and Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  js = function (s) { return chrome.evaluate(s); };
  return true;
}, test.limit.slow);
test.run('it loads on a page', 0.2, async function () {
  if (!js) return false;
  loaded = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/valued.js"); }).then(function () { return "loaded"; }, function () { return false; })');
  return loaded === 'loaded' ? true : false;
}, test.limit.slow);
test.run('spirit.element.spirit.element.search.valued.create, and nothing on spirit.elements', 0.2, async function () {
  if (!js) return false;
  const homes = await js('JSON.stringify({ now: typeof (((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).valued || {}).create, old: typeof (window.spirit.elements || {}).valued })');
  try { h = JSON.parse(homes); } catch (e) { h = {}; }
  return h.now === 'function' && h.old === 'undefined' ? true : false;
}, test.limit.slow);
// THE FACE SETTLES FIRST (cw traced it): the face page's own app selector is still loading its app cache as the page comes
// up, and those calls are the page's, not valued's. Counting starts once the page has asked nothing new for two seconds.
test.run('the world: the face page has settled before valued is mounted', 0.2, async function () {
  if (h.now !== 'function') return false;
  let seen = -1, still = 0;
  const settled = await until(async function () {
    const n = await js('performance.getEntriesByType("resource").length');
    still = n === seen ? still + 1 : 0; seen = n;
    return still >= 4;
  }, 30000);
  return settled ? true : false;
}, test.limit.long);

// the rows it is handed, one per line
test.run('all 60 rows show', 0.2, async function () {
  if (h.now !== 'function') return false;
  // Every call to the node, from here on, written down, but the face's own file reads (fs, shell/boot.js): it asks none for its rows.
  await js('(function () { window.__asks = []; var f = window.fetch; window.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ""; if (/\\/api\\//.test(String(u)) && !/event\\.subscribe|\"call\":\"fs\\.|\"call\":\"job\\.FS\\./.test(b)) window.__asks.push(b.slice(0, 120)); return f.apply(this, arguments); }; window.__rows = []; for (var i = 0; i < 60; i++) window.__rows.push({ group: i % 2 ? "Odd" : "Even", name: "row" + i, value: String(i) }); var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:700px;height:220px;display:flex;flex-direction:column"; window.__box = d; window.__made = window.spirit.element.spirit.element.search.valued.create(d, { rows: function () { return window.__rows; }, columns: [{ field: "group", label: "group" }, { field: "name", label: "name" }, { field: "value", label: "value" }] }); return true; })()');
  read = async function () {
    try {
      return JSON.parse(await js('(function () { var c = window.__box; var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); var rows = [].map.call(c.querySelectorAll("tr, [data-row], .row"), function (r) { return r.innerText.replace(/\\s+/g, " ").trim(); }).filter(function (t) { return /row\\d+/.test(t); }); ' + BEST + ' return JSON.stringify({ text: c.innerText, inputs: inputs.length, word: inputs[0] ? inputs[0].value : "", rows: rows, scroll: best ? best.scrollTop : -1, canScroll: !!best, asks: window.__asks }); })()'));
    } catch (e) { return {}; }
  };
  await until(function () { return read().then(function (r) { return (r.rows || []).length > 0; }); }, 8000);
  first = await read();
  return (first.rows || []).length === 60 ? true : false;
}, test.limit.slow);
test.run('a row shows its columns', 0.2, function () {
  if (!first) return false;
  return (first.rows || []).some(function (l) { return /Even/.test(l) && /row0/.test(l); }) ? true : false;
}, test.limit.quick);
test.run('one search field', 0.2, function () {
  if (!first) return false;
  return first.inputs === 1 ? true : false;
}, test.limit.quick);
// rule/16: its list scrolls inside the box it is given
test.run('more rows than fit: a part of it scrolls, in the box', 0.2, function () {
  if (!first) return false;
  return first.canScroll === true ? true : false;
}, test.limit.quick);
// redraw(): what the rows say now, the scroll kept
test.run('redraw shows the changed value', 0.2, async function () {
  if (!first) return false;
  await js('(function () { var c = window.__box; ' + BEST + ' if (best) best.scrollTop = 60; return true; })()');
  await js('(function () { window.__rows[0] = { group: "Even", name: "row0", value: "changed0" }; window.__made.redraw(); return true; })()');
  await sleep(300);
  redrawn = await read();
  return (redrawn.rows || []).some(function (l) { return /row0 /.test(l + ' ') && /changed0/.test(l); }) ? true : false;
}, test.limit.slow);
test.run('and keeps the scroll', 0.2, function () {
  if (!redrawn) return false;
  return redrawn.scroll === 60 ? true : false;
}, test.limit.quick);
// searchable, "over rows it already holds, with no node verb"
test.run('words put the matching row first', 0.2, async function () {
  if (!first) return false;
  await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = "row17"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
  await sleep(600);
  found = await read();
  return (found.rows || [])[0] && /row17/.test(found.rows[0]) ? true : false;
}, test.limit.slow);
test.run('the words stay in the field', 0.2, function () {
  if (!found) return false;
  return found.word === 'row17' ? true : false;
}, test.limit.quick);
test.run('redraw keeps the words and shows the new value', 0.2, async function () {
  if (!first) return false;
  await js('(function () { window.__rows[17] = { group: "Odd", name: "row17", value: "changed17" }; window.__made.redraw(); return true; })()');
  await sleep(300);
  keeps = await read();
  return keeps.word === 'row17' && (keeps.rows || []).some(function (l) { return /changed17/.test(l); }) ? true : false;
}, test.limit.slow);
// A list that was searched goes to its top when it draws: a repaint is no search, so the scroll stays.
test.run('after a search too, redraw keeps the scroll', 0.2, async function () {
  if (!first) return false;
  await js('(function () { var c = window.__box; var i = [].filter.call(c.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = "row"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
  await sleep(500);
  await js('(function () { var c = window.__box; ' + BEST + ' if (best) best.scrollTop = 70; window.__made.redraw(); return true; })()');
  await sleep(300);
  const searchedScroll = await read();
  return searchedScroll.scroll === 70 ? true : false;
}, test.limit.slow);
test.run('and it asked the node nothing', 0.2, function () {
  if (!keeps) return false;
  return Array.isArray(keeps.asks) && !keeps.asks.length ? true : false;
}, test.limit.quick);
// destroy()
test.run('destroy leaves its container empty', 0.2, async function () {
  if (h.now !== 'function') return false;
  const after = await js('(function () { window.__made.destroy(); return window.__box.children.length; })()');
  return after === 0 ? true : false;
}, test.limit.slow);
