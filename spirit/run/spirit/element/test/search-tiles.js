'use strict';

// spirit/run/spirit/element/test/search-tiles.js
// probabilitySearch's third face (spec: ./search-tiles.md; goal/G43.6). Andy, box: "probabilitySearch gets a third face,
// 'tiles', beside 'pane' and 'dropdown': the same ranked rows, drawn as tiles. Any list can use it." A real Chrome on a scratch
// node's page, what a tile looks like measured there, rows of the test's own; and the one scan, from the module itself.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const match = require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500); }

test.startTest('probabilitySearch: the face tiles (goal/G43.6)');

(async function () {
  // Andy, box: "assembled by scanning the row without knowing its meaning, with the one scan probabilityStringObjectMatch uses:
  // the scan also hands each string's js object path."
  test.subHeading('the one scan: each string with its js object path');
  ok(typeof match.measureObject === 'function', 'probabilityStringObjectMatch hands out its scan, measureObject', 'it exports ' + short(Object.keys(match)));
  if (typeof match.measureObject === 'function') {
    const table = match.measureObject({ label: 'Nest', stats: { cpu: 12 }, files: [{ name: 'a.txt' }] });
    const at = function (s) { return table.filter(function (r) { return r.objectString === s; })[0] || {}; };
    ok(at('Nest').path === 'label', 'a value carries its path: label', 'Nest: ' + short(at('Nest')));
    ok(at('12').path === 'stats.cpu', 'a nested one: stats.cpu', '12: ' + short(at('12')));
    ok(at('a.txt').path === 'files[0].name', 'one in an array: files[0].name', 'a.txt: ' + short(at('a.txt')));
    ok(match.probabilityStringObjectMatch('Nest', { label: 'Nest' }) > 0, 'the match still scores with it', 'the match answered 0');
  }

  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const js = function (s) { return chrome.evaluate(s); };
    const loaded = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
    ok(loaded === 'loaded', 'the world: it loads', short(loaded));
    await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__box = d; window.__picked = []; window.__rows = [{ key: "alpha", label: "Alpha", icon: "🅰️" }, { key: "nest", label: "Nest", icon: "🧩", stats: { cpu: 12 }, files: [{ name: "a.txt" }] }, { key: "gamma", label: "Gamma", icon: "🍀" }]; window.__made = window.spirit.element.search.create(d, { face: "tiles", rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], pick: function (row, key) { window.__picked.push(key); } }); if (window.__made.refresh) window.__made.refresh(); return true; })()');
    await until(function () { return js('window.__box.querySelectorAll(".app-icon").length > 0'); }, 3000);
    const read = async function () {
      return JSON.parse(await js('(function () { var c = window.__box; var tiles = [].map.call(c.querySelectorAll(".app-icon"), function (t) { var r = t.getBoundingClientRect(); var bar = t.querySelector(".list-rank"); var fill = bar ? (bar.querySelector("div div") || bar.firstElementChild) : null; var img = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(e.textContent); })[0]; var lab = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /^(Alpha|Nest|Gamma)$/.test(e.textContent.trim()); })[0]; var rect = function (e) { if (!e) return null; var b = e.getBoundingClientRect(); return { t: Math.round(b.top - r.top), b: Math.round(b.bottom - r.top), l: Math.round(b.left - r.left), r: Math.round(b.right - r.left), w: Math.round(b.width), h: Math.round(b.height) }; }; return { text: t.innerText.replace(/\\s+/g, " ").trim(), w: Math.round(r.width), h: Math.round(r.height), img: rect(img), lab: rect(lab), hasBar: !!bar, bar: rect(bar), fill: rect(fill), colour: fill ? getComputedStyle(fill).borderTopColor : "", number: bar ? bar.getAttribute("title") : "", title: t.getAttribute("title") }; }); var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); return JSON.stringify({ tiles: tiles, inputs: inputs.length, headers: c.querySelectorAll("th").length, sorts: c.querySelectorAll("[data-sort]").length, tables: c.querySelectorAll("table").length }); })()'));
    };
    const type = async function (w) { await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(w) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()'); await sleep(500); };
    const plain = await read();
    test.subHeading('"the same ranked rows, drawn as tiles", "No column headers or sorting"');
    ok(plain.tiles.length === 3, 'one tile per row', short(plain.tiles.length) + ' tiles');
    ok(plain.headers === 0 && plain.sorts === 0 && plain.tables === 0, 'no table, no column headers, no sort trigger', short({ h: plain.headers, s: plain.sorts, t: plain.tables }));
    ok(plain.inputs === 1, 'one search field', plain.inputs + ' search fields');
    const nest = plain.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
    ok(!!nest.img && !!nest.lab && nest.img.b <= nest.lab.t + 1, '"A tile: its image, the relevance, its label": image above label', 'the tile: ' + short(nest));
    test.subHeading('"With no search words there is no bar. Its space stays, so the tiles do not jump."');
    ok(plain.tiles.every(function (t) { return !t.hasBar || !t.fill || t.fill.w === 0; }), 'no words: no bar shows', short(plain.tiles.map(function (t) { return t.fill; })));
    await type('Nest');
    const searching = await read();
    const nest2 = searching.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
    ok(!!nest2.lab && !!nest.lab && nest2.lab.t === nest.lab.t && nest2.h === nest.h, 'with words the label stands where it stood', 'label ' + short(nest.lab) + ' then ' + short(nest2.lab));
    test.subHeading('"The relevance is a centered, horizontal bar, between the tile image and the tile label: the bar the lists draw, the same colour and number."');
    ok(/Nest/.test(searching.tiles[0].text), 'the row that fits comes first', 'first: ' + short(searching.tiles[0].text));
    const best = searching.tiles[0];
    ok(best.hasBar && !!best.bar && !!best.img && !!best.lab && best.bar.t >= best.img.b - 1 && best.bar.b <= best.lab.t + 1, 'its bar stands between image and label', short({ bar: best.bar, img: best.img, lab: best.lab }));
    ok(best.hasBar && !!best.fill && best.fill.w > best.fill.h, 'horizontal', short(best.fill));
    ok(best.hasBar && !!best.bar && Math.abs((best.bar.l + best.bar.r) / 2 - best.w / 2) <= 2, 'centered in the tile', short({ bar: best.bar, w: best.w }));
    ok(best.number === '1.00', 'the same number as a list: its rank against the best row\'s', 'number: ' + short(best.number));
    const expected = await js('getComputedStyle(document.documentElement).getPropertyValue("--spirit-match")');
    const probe = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.style.borderTop = "1px solid var(--spirit-match, rgba(130,180,240,0.55))"; var c = getComputedStyle(d).borderTopColor; d.remove(); return c; })()');
    ok(best.colour === probe, 'the same colour as a list\'s bar', 'colour ' + short(best.colour) + ', a list\'s ' + short(probe) + ' (' + short(expected) + ')');
    test.subHeading('"A tile the words miss stays, last, with an empty bar. Nothing is cut."');
    await type('Nest');
    const missed = searching.tiles.slice(1);
    ok(searching.tiles.length === 3, 'all three tiles stay', short(searching.tiles.length) + ' tiles');
    await type('qqqqzzzzxxxx');
    const none = await read();
    ok(none.tiles.length === 3 && none.tiles.every(function (t) { return t.hasBar && (!t.fill || t.fill.w === 0); }), 'words nothing fits: the tiles stay, every bar empty', short(none.tiles.map(function (t) { return { text: t.text, fill: t.fill }; })));
    ok(missed.length === 2, 'the world: two others behind the best', short(missed.length));
    await type('');
    test.subHeading('"arrow keys also go left and right": Enter picks where they went');
    // Each key goes where the focus really is, as a real key does: from the empty search field an arrow moves into the tiles.
    await js('[].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0].focus(); true');
    const press = async function (key) { await js('(function () { var at = document.activeElement || document.body; at.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(key) + ', bubbles: true, cancelable: true })); return true; })()'); await sleep(120); };
    const order = (await read()).tiles.map(function (t) { return t.text; });
    await press('ArrowRight'); await press('ArrowRight'); await press('ArrowLeft'); await press('Enter');
    const picked1 = JSON.parse(await js('JSON.stringify(window.__picked)'));
    ok(picked1.length === 1, 'Right, Right, Left, Enter picks one tile', 'picked: ' + short(picked1) + ', order ' + short(order));
    await press('ArrowRight'); await press('Enter');
    const picked2 = JSON.parse(await js('JSON.stringify(window.__picked)'));
    ok(picked2.length === 2 && picked2[0] !== picked2[1], 'a further Right, Enter picks the next one', 'picked: ' + short(picked2));
    test.subHeading('"A press opens": a pressed tile is the list\'s pick');
    await js('window.__picked.length = 0; [].filter.call(window.__box.querySelectorAll(".app-icon"), function (t) { return /Gamma/.test(t.innerText); })[0].click(); true');
    await sleep(150);
    ok(await js('window.__picked[0] === "gamma"'), 'pressing Gamma picks gamma', 'picked: ' + short(await js('JSON.stringify(window.__picked)')));
    test.subHeading('"The tooltip shows the contents of the row, one above the other", "If the object is nested, it shows the js object path", "It drops the icon row"');
    const tip = async function (label) {
      return js('(function () { var t = [].filter.call(window.__box.querySelectorAll(".app-icon"), function (x) { return x.innerText.indexOf(' + JSON.stringify(label) + ') !== -1; })[0]; t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); t.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); var own = t.getAttribute("title") || ""; var pop = [].map.call(document.querySelectorAll("[role=tooltip]"), function (e) { return e.innerText; }).join("\\n"); return own || pop; })()');
    };
    const tipNest = String(await tip('Nest'));
    const lines = tipNest.split('\n').map(function (l) { return l.trim(); });
    ok(lines.indexOf('key: nest') !== -1 && lines.indexOf('label: Nest') !== -1, 'its row, one above the other', 'the tooltip: ' + short(tipNest));
    ok(lines.indexOf('stats.cpu: 12') !== -1 && lines.indexOf('files[0].name: a.txt') !== -1, 'nested: stats.cpu: 12, files[0].name: a.txt', 'the tooltip: ' + short(tipNest));
    ok(!/icon/.test(tipNest), 'no icon row', 'the tooltip: ' + short(tipNest));
    test.subHeading('"Any list can use it": the other two faces stay');
    const pane = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:500px;height:200px"; window.spirit.element.search.create(d, { rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }] }); return new Promise(function (r) { setTimeout(function () { var n = JSON.stringify({ tiles: d.querySelectorAll(".app-icon").length, headers: d.querySelectorAll("th").length }); d.remove(); r(n); }, 300); }); })()');
    const pn = JSON.parse(pane);
    ok(pn.tiles === 0 && pn.headers > 0, 'a pane stays a table with headers', short(pn));

    // Named here for the builder: the toggle is .list-toggle, and the owner hears through the option onFace(face).
    test.subHeading('the box: "A new option, toggle: true. Without it nothing changes for any other list."');
    const make = function (opts) { return js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__t = d; window.__faces = []; window.__tl = window.spirit.element.search.create(d, Object.assign({ rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], onFace: function (f) { window.__faces.push(f); } }, ' + JSON.stringify(opts) + ')); if (window.__tl.refresh) window.__tl.refresh(); return new Promise(function (r) { setTimeout(function () { r(true); }, 300); }); })()'); };
    const drop = function () { return js('(function () { window.__t.remove(); return true; })()'); };
    const toggles = function () { return js('window.__t.querySelectorAll(".list-toggle").length'); };
    await make({ face: 'pane' });
    ok(await toggles() === 0, 'a pane without the option has no toggle', 'a pane without the option has a toggle');
    await drop();
    await make({ face: 'tiles' });
    ok(await toggles() === 0, 'tiles without the option have no toggle', 'tiles without the option have a toggle');
    await drop();
    test.subHeading('the box: "It flips pane and tiles only. Dropdown closes to a field, so it never shows the toggle."');
    await make({ face: 'dropdown', toggle: true });
    ok(await toggles() === 0, 'a dropdown with the option has no toggle', 'a dropdown shows a toggle');
    await drop();
    await make({ face: 'pane', toggle: true });
    ok(await toggles() === 1, 'a pane with the option has one toggle', 'toggles on a pane with the option: ' + short(await toggles()));
    test.subHeading('the box: "The toggle sits on the search row, right after the Search button."');
    const placed = await js('(function () { var t = window.__t.querySelector(".list-toggle"); if (!t) return "none"; var b = [].filter.call(window.__t.querySelectorAll("button"), function (x) { return x.textContent === "Search"; })[0]; if (!b) return "no Search button"; return t.previousElementSibling === b ? "after" : "elsewhere"; })()');
    ok(placed === 'after', 'it follows the Search button', 'the toggle stands: ' + short(placed));
    test.subHeading('the box: "The face can change while the list lives, keeping the search words."');
    await js('(function () { var i = [].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; if (!i) return false; i.value = "Nest"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    const seen = function () { return js('JSON.stringify({ tiles: window.__t.querySelectorAll(".app-icon").length, headers: window.__t.querySelectorAll("th").length, words: ([].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0] || {}).value, faces: window.__faces })'); };
    const click = function () { return js('(function () { var t = window.__t.querySelector(".list-toggle"); if (t) t.click(); return !!t; })()'); };
    const asPane = JSON.parse(await seen());
    ok(asPane.tiles === 0 && asPane.headers > 0, 'it starts as a pane', short(asPane));
    await click();
    await until(function () { return js('window.__t.querySelectorAll(".app-icon").length > 0'); }, 3000);
    const asTiles = JSON.parse(await seen());
    ok(asTiles.tiles === 3 && asTiles.headers === 0, 'a press draws tiles, one per row', short(asTiles));
    ok(asTiles.words === 'Nest', 'the search words stay', 'the words after a press: ' + short(asTiles.words));
    ok(await toggles() === 1, 'the toggle stays, to go back', 'no toggle on the tiles');
    test.subHeading('the box: "It tells its owner the new face."');
    ok(JSON.stringify(asTiles.faces) === '["tiles"]', 'the owner hears tiles', 'the owner heard: ' + short(asTiles.faces));
    await click();
    await until(function () { return js('window.__t.querySelectorAll("th").length > 0'); }, 3000);
    const back = JSON.parse(await seen());
    ok(back.tiles === 0 && back.headers > 0 && back.words === 'Nest' && JSON.stringify(back.faces) === '["tiles","pane"]', 'a second press goes back, words kept, the owner told', short(back));
    await drop();
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
