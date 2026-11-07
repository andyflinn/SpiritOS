'use strict';

// spirit/run/spirit/element/search/test/valued.js
// The tests of spirit/element/search/valued.js, and of no other module (spec: ./valued.md; goal/G43.6). Andy, box: "It will be
// spirit.element.valued, on disc and in spirit", "It is searchable (probabilitySearch), over rows it already holds, with no node
// verb." Since goal/G43.18 (Q5) it is spirit.element.search.valued. A real Chrome on a scratch node's page, the element mounted by itself, rows of the test's own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

test.startTest('valued.js: rows of name and value, searchable, with no node verb (goal/G43.6)');

(async function () {
  const code = fs.existsSync(path.join(__dirname, '..', 'valued.js')) ? fs.readFileSync(path.join(__dirname, '..', 'valued.js'), 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  ok(!!code, 'spirit/element/search/valued.js is there', 'spirit/element/search/valued.js is not there: nothing below can pass');
  ok(code && !/\.elements\b|spirit\.shell/.test(code), 'it reaches no old code', 'valued.js names spirit.elements or spirit.shell');
  ok(code && /spirit\/element\/search\.js|element\.search\.create/.test(code), 'it is a probabilitySearch (spirit/element/search.js since goal/G43.18)', 'valued.js does not use probabilitySearch');
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const js = function (s) { return chrome.evaluate(s); };
    const loaded = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/valued.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
    ok(loaded === 'loaded', 'it loads on a page', 'loading it: ' + short(loaded));
    const homes = await js('JSON.stringify({ now: typeof (((window.spirit.element || {}).search || {}).valued || {}).create, old: typeof (window.spirit.elements || {}).valued })');
    let h = {}; try { h = JSON.parse(homes); } catch (e) { h = {}; }
    ok(h.now === 'function' && h.old === 'undefined', 'spirit.element.search.valued.create, and nothing on spirit.elements', 'homes: ' + short(h));
    if (h.now !== 'function') return;
    // Every call to the node, from here on, written down, but the face's own file reads (fs, and jobs.FS.path, shell/boot.js): it asks none for its rows.
    await js('(function () { window.__asks = []; var f = window.fetch; window.fetch = function (u, o) { var b = o && o.body ? String(o.body) : ""; if (/\\/api\\//.test(String(u)) && !/events\\.subscribe|\"call\":\"fs\\.|\"call\":\"jobs\\.FS\\./.test(b)) window.__asks.push(b.slice(0, 120)); return f.apply(this, arguments); }; window.__rows = []; for (var i = 0; i < 60; i++) window.__rows.push({ group: i % 2 ? "Odd" : "Even", name: "row" + i, value: String(i) }); var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:700px;height:220px;display:flex;flex-direction:column"; window.__box = d; window.__made = window.spirit.element.search.valued.create(d, { rows: function () { return window.__rows; }, columns: [{ field: "group", label: "group" }, { field: "name", label: "name" }, { field: "value", label: "value" }] }); return true; })()');
    const read = async function () {
      try {
        return JSON.parse(await js('(function () { var c = window.__box; var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); var rows = [].map.call(c.querySelectorAll("tr, [data-row], .row"), function (r) { return r.innerText.replace(/\\s+/g, " ").trim(); }).filter(function (t) { return /row\\d+/.test(t); }); var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); return JSON.stringify({ text: c.innerText, inputs: inputs.length, word: inputs[0] ? inputs[0].value : "", rows: rows, scroll: best ? best.scrollTop : -1, canScroll: !!best, asks: window.__asks }); })()'));
      } catch (e) { return { threw: String(e) }; }
    };
    await until(function () { return read().then(function (r) { return (r.rows || []).length > 0; }); }, 8000);
    const first = await read();
    test.subHeading('the rows it is handed, one per line');
    ok((first.rows || []).length === 60, 'all 60 rows show', 'it shows ' + short((first.rows || []).length) + ' rows: ' + short(first.threw || (first.rows || []).slice(0, 3)));
    ok((first.rows || []).some(function (l) { return /Even/.test(l) && /row0/.test(l); }), 'a row shows its columns', 'the rows: ' + short((first.rows || []).slice(0, 3)));
    ok(first.inputs === 1, 'one search field', first.inputs + ' search fields');
    test.subHeading('rule/16: its list scrolls inside the box it is given');
    ok(first.canScroll === true, 'more rows than fit: a part of it scrolls, in the box', 'nothing in it scrolls');
    await js('(function () { var c = window.__box; var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); if (best) best.scrollTop = 60; return true; })()');
    test.subHeading('redraw(): what the rows say now, the scroll kept');
    await js('(function () { window.__rows[0] = { group: "Even", name: "row0", value: "changed0" }; window.__made.redraw(); return true; })()');
    await sleep(300);
    const redrawn = await read();
    ok((redrawn.rows || []).some(function (l) { return /row0 /.test(l + ' ') && /changed0/.test(l); }), 'redraw shows the changed value', 'after redraw: ' + short((redrawn.rows || []).slice(0, 3)));
    ok(redrawn.scroll === 60, 'and keeps the scroll', 'the scroll is ' + short(redrawn.scroll));
    test.subHeading('searchable, "over rows it already holds, with no node verb"');
    await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = "row17"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    await sleep(600);
    const found = await read();
    ok((found.rows || [])[0] && /row17/.test(found.rows[0]), 'words put the matching row first', 'searching: ' + short((found.rows || []).slice(0, 3)));
    ok(found.word === 'row17', 'the words stay in the field', 'the field holds ' + short(found.word));
    await js('(function () { window.__rows[17] = { group: "Odd", name: "row17", value: "changed17" }; window.__made.redraw(); return true; })()');
    await sleep(300);
    const keeps = await read();
    ok(keeps.word === 'row17' && (keeps.rows || []).some(function (l) { return /changed17/.test(l); }), 'redraw keeps the words and shows the new value', 'after redraw: ' + short({ word: keeps.word, rows: (keeps.rows || []).slice(0, 2) }));
    // A list that was searched goes to its top when it draws: a repaint is no search, so the scroll stays.
    await js('(function () { var c = window.__box; var i = [].filter.call(c.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = "row"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    await sleep(500);
    await js('(function () { var c = window.__box; var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); if (best) best.scrollTop = 70; window.__made.redraw(); return true; })()');
    await sleep(300);
    const searchedScroll = await read();
    ok(searchedScroll.scroll === 70, 'after a search too, redraw keeps the scroll', 'after a search, redraw left the scroll at ' + short(searchedScroll.scroll));
    ok(Array.isArray(keeps.asks) && !keeps.asks.length, 'and it asked the node nothing', 'it asked: ' + short(keeps.asks));
    test.subHeading('destroy()');
    const after = await js('(function () { window.__made.destroy(); return window.__box.children.length; })()');
    ok(after === 0, 'destroy leaves its container empty', 'after destroy it holds ' + short(after) + ' children');
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
