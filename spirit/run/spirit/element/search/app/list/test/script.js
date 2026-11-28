'use strict';

// spirit/run/spirit/element/search/app/list/test/script.js
// The tests of spirit/element/search/app/list/script.js, and of no other module (spec: ./script.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72); until now it was judged only through
// its selector (../../test/script.js). Here it is mounted alone.
//
// The app list, a drop-in element (goal/G43.2): a view of the app family's cache, asked of app.search. A real Chrome on a
// scratch node's face page, the world of ../../test/script.js; neither Andy's node nor an agent's is touched. What each face
// must list is read from the tree: each spirit/app/<name>/<name>.json.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'list', 'script.js');

// THE TREE'S APPS, BY THE SYSTEM'S OWN RULE (goal/G49.23; Andy: "the system has clear rules for old and new format branches and
// apps"): every folder of the run root that spirit/fs/filter/app/script.js takes for an app, old format or new, wherever it
// stands (the fs cache flags the same folders, and app.search answers them). Each keyed by its folder's path in dots,
// spirit.app.desk (goal/G49.19); which show a tile (shell.mount), which only run (node.run alone), from its manifest, its
// <name>.json or, new style, its manifest.json. Which may be a shell is no longer asked: goal/G49.4 took shell.true and the
// list's shells option out.
const APP = LOADER.requireScript('spirit/fs/filter/app/script.js');
const has = function (q) { return fs.existsSync(path.join(RUN, q)); };
const readOf = function (q) { try { return fs.readFileSync(path.join(RUN, q), 'utf8'); } catch (e) { return null; } };
const DIRS = [];
(function walk(rel) {
  let names = [];
  try { names = fs.readdirSync(path.join(RUN, rel), { withFileTypes: true }); } catch (e) { return; }
  names.forEach(function (d) {
    if (!d.isDirectory() || d.name === '.git') return;
    const r = rel + '/' + d.name;
    if (APP.app(r, has, readOf)) DIRS.push(r);
    walk(r);
  });
}('spirit'));
const TREE = DIRS.map(function (dir) {
  const base = dir.slice(dir.lastIndexOf('/') + 1);
  let j = {};
  try { j = JSON.parse(readOf(dir + '/' + base + '.json') || readOf(dir + '/manifest.json') || '{}'); } catch (e) { j = {}; }
  const sh = j.shell || {}, nd = j.node || {};
  return { key: dir.split('/').join('.'), tile: sh.mount === true, run: nd.run === true && nd.mount !== true && sh.mount !== true };
});
const keysOf = function (f) { return TREE.filter(f).map(function (a) { return a.key; }).sort(); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made;
// The keys a list in #<id> shows: its visible rows or tiles (a row the list hides stays in the page), never its selector rows.
const shown = function (id) { return chrome.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); if (!b) return []; var out = []; Array.prototype.forEach.call(b.querySelectorAll("[data-key]"), function (r) { if (!r.getClientRects().length) return; var k = r.getAttribute("data-key"); if (out.indexOf(k) === -1) out.push(k); }); return out.sort(); }())'); };
const fieldsOf = function (id) { return chrome.evaluate('(function () { var r = Array.prototype.filter.call(document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("tr[data-key]"), function (x) { return x.getClientRects().length; })[0]; return r ? Array.prototype.map.call(r.querySelectorAll("td[data-field]"), function (td) { return td.getAttribute("data-field"); }) : null; }())'); };
const make = function (id, opts) { return chrome.evaluate('(function () { var c = document.createElement("div"); c.id = ' + JSON.stringify(id) + '; c.style.cssText = "position:relative;width:900px;height:700px;display:flex;"; document.body.appendChild(c); window[' + JSON.stringify(id) + '] = spirit.element.search.app.list.create(c, ' + opts + '); var m = window[' + JSON.stringify(id) + ']; return !!m && !!m.list && typeof m.refresh === "function" && typeof m.destroy === "function"; }())'); };
const openDropdown = function (id) { return chrome.evaluate('(function () { var f = document.getElementById(' + JSON.stringify(id) + ').querySelector("button[id$=\\"field\\"]"); if (!f) return false; f.click(); return true; }())'); };

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up, with Chrome on its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) || false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript and is spirit.element.search.app.list', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/app/list/script.js"); }).then(function () { var L = spirit.element.search.app.list; return !!(L && typeof L.create === "function"); }, function () { return false; })');
  return loaded === true || false;
}, test.limit.slow);

// create(host, opts) -> { list, refresh(), destroy() }
test.run('create, given a host and options, answers an object holding list, refresh and destroy', 0.2, async function () {
  if (loaded !== true) return false;
  // goal/G49.23: the app branch is spirit.app itself, what spirit.requireScript('spirit/app/script.js') hands back, its function searchApp on it (no spirit.app.api).
  await chrome.evaluate('(function () { window.asked = []; var real = spirit.app.searchApp; spirit.app.searchApp = function (a) { window.asked.push(a); return real.call(spirit.app, a); }; window.picks = []; return true; }())');
  made = await make('pane', '{ face: "pane", pick: function (row, key) { window.picks.push({ row: row, key: key }); } }');
  return made === true || false;
}, test.limit.slow);
test.run('as a pane it lists every app of the tree, the apps that only run among them', 0.2, async function () {
  if (made !== true) return false;
  const want = keysOf(function () { return true; });
  const ok = await until(function () { return shown('pane').then(function (k) { return JSON.stringify(k) === JSON.stringify(want); }); }, 10000);
  return (ok && keysOf(function (a) { return a.run; }).length > 0) || false;
}, test.limit.slow);
// Andy, box: "no filters, just a search string"
test.run('it asks app.search with a search string and nothing more', 0.2, async function () {
  if (made !== true) return false;
  const asked = JSON.parse(await chrome.evaluate('JSON.stringify(window.asked)'));
  return (asked.length > 0 && asked.every(function (a) { return JSON.stringify(Object.keys(a)) === '["q"]' && typeof a.q === 'string'; })) || false;
}, test.limit.quick);
// Andy, box: "with the (de)activate buttons at the end of each row"
test.run('as a pane each row has the icon, the label, and the active cell at its end', 0.2, async function () {
  if (made !== true) return false;
  const f = await fieldsOf('pane');
  return JSON.stringify(f) === JSON.stringify(['icon', 'label', 'active']) || false;
}, test.limit.quick);
test.run('a press on a row hands the row and its key to pick', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('(function () { var r = document.getElementById("pane").querySelector("tr[data-key=\\"spirit.app.grants\\"] td[data-field=\\"label\\"]"); if (r) r.click(); return !!r; }())');
  const ok = await until(function () { return chrome.evaluate('window.picks.length > 0 && window.picks[0].key === "spirit.app.grants"'); }, 3000);
  return !!ok || false;
}, test.limit.slow);
test.run('refresh asks app.search again', 0.2, async function () {
  if (made !== true) return false;
  const again = await chrome.evaluate('(function () { var n = window.asked.length; window.pane.refresh(); return new Promise(function (r) { setTimeout(function () { r(window.asked.length > n); }, 800); }); }())');
  return again === true || false;
}, test.limit.slow);

// goal/G43.20; Andy: "MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!"
test.run('as tiles it shows only the apps whose <name>.json says shell.mount true', 0.2, async function () {
  if (loaded !== true) return false;
  await make('tiles', '{ face: "tiles" }');
  const want = keysOf(function (a) { return a.tile; });
  const ok = await until(function () { return shown('tiles').then(function (k) { return JSON.stringify(k) === JSON.stringify(want); }); }, 10000);
  return (!!ok && want.length < TREE.length) || false;
}, test.limit.slow);
// goal/G43.21; Andy: "spirit app search will list these jobs (node:run) only in pane mode"; "the appSelector will only show icon and label"
test.run('as a dropdown it lists no app that only runs', 0.2, async function () {
  if (loaded !== true) return false;
  await make('drop', '{ face: "dropdown" }');
  await openDropdown('drop');
  const runs = keysOf(function (a) { return a.run; });
  await until(function () { return shown('drop').then(function (k) { return k.length > 1; }); }, 10000);
  const k = await shown('drop');
  return (k.length > 1 && runs.every(function (r) { return k.indexOf(r) === -1; })) || false;
}, test.limit.slow);
test.run('as a dropdown each row shows the icon and the label only', 0.2, async function () {
  if (loaded !== true) return false;
  const f = await fieldsOf('drop');
  return JSON.stringify(f) === JSON.stringify(['icon', 'label']) || false;
}, test.limit.quick);
// goal/G43.18: "this filter is hidden by default"; Q4: the caller makes it visible, by servers: true
test.run('the server filter is hidden by default, and shown by servers: true', 0.2, async function () {
  if (loaded !== true) return false;
  await make('servers', '{ face: "pane", servers: true }');
  await until(function () { return shown('servers').then(function (k) { return k.length > 1; }); }, 10000);
  const n = await chrome.evaluate('[document.getElementById("pane").querySelectorAll("button[data-filter]").length, document.getElementById("servers").querySelectorAll("button[data-filter]").length]');
  return JSON.stringify(n) === '[0,1]' || false;
}, test.limit.slow);
test.run('destroy leaves its host empty', 0.2, async function () {
  if (made !== true) return false;
  const empty = await chrome.evaluate('(function () { window.pane.destroy(); var b = document.getElementById("pane"); return b.innerHTML === ""; }())');
  return empty === true || false;
}, test.limit.quick);
