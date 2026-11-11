'use strict';

// spirit/run/spirit/app/job/test/element.js
// The tests of spirit/app/job/element.js, and of no other module (spec: ./job.md; goal/G43.29, box v3): the Job Monitor in
// spirit/app/job/, "as Contacts and Icons did". Andy: "fill in the box, same icons, shell:mount only.", "a wrapper for
// separate spirit/element/ files", "both apps will be intrinsic"; Q1: "a job row opens detail panel overtop of jobs." Its
// json read from the disc; the app on a real Chrome on a scratch node's face page, through the app selector's tile as a
// user opens it. What it draws is the job search's, spirit/element/search/job.js and its folder (goal/G43.32), judged in their own tests.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const APP = path.join(RUN, 'spirit', 'app', 'job');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
// The code with its line comments blanked, so a word in a comment is no call.
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''); } catch (e) { return ''; } }

// job: the Job Monitor in spirit/app/job/, a wrapper of spirit/element/ files (goal/G43.29). One test.run per test
// (goal/G47.2). What the world made, for the tests after it.
const W = {};
const OWN = function () { return json(path.join(APP, 'job.json')); };
const NO_PAGE = 'no scratch node of its own or no Chrome: the world failed';
test.after(function () {
  const chrome = W.chrome || {}; const node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// the box: "same icons, shell:mount only", "both apps will be intrinsic", no api.js and no data.js
test.run('spirit/app/job/job.json is there', 0.2, function () {
  return !!OWN() || 'spirit/app/job/job.json is not there, or no JSON';
}, test.limit.quick);
test.run('its icon is 📋', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.icon === '📋' || 'its icon is ' + short(id.icon);
}, test.limit.quick);
test.run('its name stays Job Monitor', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.label === 'Job Monitor' || 'its label is ' + short(id.label);
}, test.limit.quick);
test.run('it is intrinsic', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.intrinsic === true || 'identity.intrinsic is ' + short(id.intrinsic);
}, test.limit.quick);
test.run('shell mount true, tile true', 0.2, function () {
  const own = OWN();
  return !!(own && own.shell && own.shell.mount === true && own.shell.tile === true) || 'its shell part: ' + short(own && own.shell);
}, test.limit.quick);
test.run('node mount false: no server, nothing run', 0.2, function () {
  const own = OWN();
  return !!own && !(own.node && own.node.mount === true) && !(own.node && own.node.run === true) ? true : 'its node part: ' + short(own && own.node);
}, test.limit.quick);
test.run('no api.js and no data.js in its folder: the jobs family stays spirit/job/', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) && !fs.existsSync(path.join(APP, 'api.js')) && !fs.existsSync(path.join(APP, 'data.js')) ? true : 'spirit/app/job/ holds an api.js or a data.js';
}, test.limit.quick);

// "a wrapper for separate spirit/element/ files": job.js only mounts
test.run('element.js brings the job search, spirit/element/search/job.js', 0.2, function () {
  return (/spirit\/element\/search\/job\.js/).test(code(path.join(APP, 'element.js'))) || 'element.js names no spirit/element/search/job.js';
}, test.limit.quick);
test.run('and draws nothing itself: no innerHTML, no old shell helper', 0.2, function () {
  const src = code(path.join(APP, 'element.js'));
  return src !== '' && !(/innerHTML|activateApp|callDialog|factRow/).test(src) ? true : 'job.js draws or calls the old shell: ' + short((src.match(/innerHTML|activateApp|callDialog|factRow/g) || []).slice(0, 4));
}, test.limit.quick);

test.run('the world: a scratch node of its own and a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error || !W.node.root) return 'no scratch node of its own or no Chrome: nothing judged. ' + short(W.chrome.error || '');
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  W.page = true;
  return true;
}, test.limit.slow);

// spirit.element.spirit.app.job.element.create(container, { open }) -> { destroy }
test.run('it registers spirit.element.spirit.app.job.element, whose create answers { destroy }', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const made = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/job/element.js"); }).then(function () { var J = spirit.element && spirit.element.spirit.app.job.element; if (!J || typeof J.create !== "function") return "spirit.element.spirit.app.job.element.create is " + typeof (J && J.create); var c = document.createElement("div"); c.id = "alone"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;display:flex;flex-direction:column"; document.body.appendChild(c); window.alone = J.create(c, {}); return window.alone && typeof window.alone.destroy === "function" ? "made" : "create answered " + typeof window.alone; }, function (e) { return String(e && e.message || e); })');
  W.made = made === 'made';
  return W.made || 'it: ' + short(made);
}, test.limit.quick);
test.run('mounted, it draws the node\'s jobs, spirit.fs among them', 0.2, async function () {
  if (!W.made) return 'nothing mounted: the test before failed';
  return await until(function () { return W.chrome.evaluate('String(document.getElementById("alone").innerText).indexOf("spirit.fs") !== -1'); }, 10000) ? true
    : 'mounted, it shows: ' + short(await W.chrome.evaluate('String(document.getElementById("alone").innerText)'));
}, test.limit.quick);
test.run('destroy empties its container', 0.2, async function () {
  if (!W.made) return 'nothing mounted: the test before failed';
  return await W.chrome.evaluate('(function () { window.alone.destroy(); var c = document.getElementById("alone"); var n = c.children.length; c.remove(); return n === 0; }())') ? true : 'destroy left its container holding something';
}, test.limit.quick);
test.run('the page finds the jobs cache at spirit/job/data.js, never spirit/app/job/data.js', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const asked = JSON.parse(await W.chrome.evaluate('JSON.stringify(performance.getEntriesByType("resource").map(function (e) { return e.name; }).filter(function (n) { return /\\/data\\.js/.test(n); }))'));
  return W.made && asked.some(function (n) { return (/spirit\/job\/data\.js/).test(n); }) && !asked.some(function (n) { return (/spirit\/app\/job\/data\.js/).test(n); }) ? true : 'the page asked ' + short(asked);
}, test.limit.quick);

// its tile, and Q1: "a job row opens detail panel overtop of jobs", in the same stack
const TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("Job Monitor") !== -1; })[0]';
const LAYERS = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; })';
const OVER = '(function () { var all = Array.prototype.slice.call(document.querySelectorAll("#faces .app-container")); var shown = all.filter(function (c) { return c.offsetParent !== null; }); if (all.length < 2) return "one layer only: " + all.length; var top = shown.pop(); if (!top) return "no layer shown"; var t = String(top.innerText); if (t.indexOf("spirit.fs") === -1 || !/Status/.test(t)) return "the top layer is not spirit.fs\'s detail: " + t.slice(0, 120); var b = document.getElementById("faces").getBoundingClientRect(); var r = top.getBoundingClientRect(); return r.width >= b.width - 4 && r.height >= b.height - 4 ? "over" : "a layer of " + Math.round(r.width) + "x" + Math.round(r.height); }())';
test.run('the world: the app selector\'s tiles', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const tiles = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
  W.tiles = tiles === 'made';
  return W.tiles || 'the tiles: ' + short(tiles);
}, test.limit.quick);
test.run('Job Monitor has a tile, intrinsic and on', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  return await until(function () { return W.chrome.evaluate('!!' + TILE); }, 10000) ? true
    : 'no Job Monitor tile: ' + short(await W.chrome.evaluate('String(document.getElementById("faces").innerText)'));
}, test.limit.quick);
test.run('its tile opens it, the node\'s jobs listed', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  await W.chrome.evaluate('(function () { var t = ' + TILE + '; if (t) t.click(); return !!t; }())');
  return await until(function () { return W.chrome.evaluate('(function () { var l = ' + LAYERS + '.pop(); return !!l && String(l.innerText).indexOf("spirit.fs") !== -1; }())'); }, 10000) ? true
    : 'after the tile: ' + short(await W.chrome.evaluate('String(document.getElementById("faces").innerText)'));
}, test.limit.quick);
test.run('a row press opens its detail as a layer over Jobs, in the app selector\'s stack', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  await W.chrome.evaluate('(function () { var l = ' + LAYERS + '.pop(); var r = Array.prototype.filter.call(l.querySelectorAll("tr, .list-row"), function (x) { return x.getClientRects().length && String(x.textContent).indexOf("spirit.fs") !== -1; })[0]; if (!r) return false; var leaf = Array.prototype.filter.call(r.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || r; leaf.click(); return true; }())');
  return await until(function () { return W.chrome.evaluate(OVER).then(function (v) { return v === 'over'; }); }, 8000) ? true
    : 'the press: ' + short(await W.chrome.evaluate(OVER));
}, test.limit.quick);
test.run('its ✕ goes one step back, to Jobs', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  await W.chrome.evaluate('(function () { var c = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container-close"), function (x) { return x.offsetParent !== null; }).pop(); if (c) c.click(); return !!c; }())');
  return await until(function () { return W.chrome.evaluate('(function () { var l = ' + LAYERS + '.pop(); return !!l && String(l.innerText).indexOf("spirit.fs") !== -1 && !/Updated[\\s\\S]*Events/.test(String(l.innerText)); }())'); }, 8000) ? true
    : 'after the detail\'s ✕: ' + short(await W.chrome.evaluate('String(document.getElementById("faces").innerText)'));
}, test.limit.quick);
