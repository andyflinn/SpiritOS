'use strict';

// spirit/run/spirit/app/introSpector/test/element.js
// The tests of spirit/app/introSpector/element.js, and of no other module (spec: ./introSpector.md; goal/G43.29, box
// v3): introSpector in spirit/app/introSpector/, "as Contacts and Icons did". Andy: "fill in the box, same icons, shell:mount
// only.", "a wrapper for separate spirit/element/ files", "both apps will be intrinsic". Its json read from the disc; the
// app on a real Chrome on a scratch node's face page, through the app selector's tile as a user opens it. What it draws is
// spirit/element/introSpector.js's, judged in its own test.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const APP = path.join(RUN, 'spirit', 'app', 'introSpector');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''); } catch (e) { return ''; } }

// introSpector: in spirit/app/introSpector/, a wrapper of a spirit/element/ file (goal/G43.29). One test.run per test
// (goal/G47.2). What the world made, for the tests after it.
const W = {};
const OWN = function () { return json(path.join(APP, 'introSpector.json')); };
const NO_PAGE = 'no scratch node or no Chrome: the world failed';
test.after(function () {
  const chrome = W.chrome || {}; const node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// the box: "same icons, shell:mount only", "both apps will be intrinsic", no api.js and no data.js
test.run('spirit/app/introSpector/introSpector.json is there', 0.2, function () {
  return !!OWN() || 'spirit/app/introSpector/introSpector.json is not there, or no JSON';
}, 1000);
test.run('its icon is 👓', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.icon === '👓' || 'its icon is ' + short(id.icon);
}, 1000);
test.run('its name stays introSpector', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.label === 'introSpector' || 'its label is ' + short(id.label);
}, 1000);
test.run('it is intrinsic', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.intrinsic === true || 'identity.intrinsic is ' + short(id.intrinsic);
}, 1000);
test.run('shell mount true, tile true', 0.2, function () {
  const own = OWN();
  return !!(own && own.shell && own.shell.mount === true && own.shell.tile === true) || 'its shell part: ' + short(own && own.shell);
}, 1000);
test.run('node mount false: no server, nothing run', 0.2, function () {
  const own = OWN();
  return !!own && !(own.node && own.node.mount === true) && !(own.node && own.node.run === true) ? true : 'its node part: ' + short(own && own.node);
}, 1000);
test.run('no api.js and no data.js in its folder', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) && !fs.existsSync(path.join(APP, 'api.js')) && !fs.existsSync(path.join(APP, 'data.js')) ? true : 'spirit/app/introSpector/ holds an api.js or a data.js';
}, 1000);

// "a wrapper for separate spirit/element/ files": introSpector.js only mounts
test.run('introSpector.js brings spirit/element/introSpector.js', 0.2, function () {
  return (/spirit\/element\/introSpector\.js/).test(code(path.join(APP, 'element.js'))) || 'introSpector.js names no spirit/element/introSpector.js';
}, 1000);
test.run('and draws nothing itself: no innerHTML, no old shell helper', 0.2, function () {
  const src = code(path.join(APP, 'element.js'));
  return src !== '' && !(/innerHTML|activateApp|callDialog|factRow/).test(src) ? true : 'introSpector.js draws or calls the old shell: ' + short((src.match(/innerHTML|activateApp|callDialog|factRow/g) || []).slice(0, 4));
}, 1000);

test.run('the world: a scratch node and a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(W.chrome.error || '');
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  W.page = true;
  return true;
}, 7000);

// spirit.element.spirit.app.introSpector.element.create(container, { open }) -> { destroy }
test.run('it registers spirit.element.spirit.app.introSpector.element, whose create answers { destroy }', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const made = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/introSpector/element.js"); }).then(function () { var J = spirit.element && spirit.element.spirit.app.introSpector.element; if (!J || typeof J.create !== "function") return "spirit.element.spirit.app.introSpector.element.create is " + typeof (J && J.create); var c = document.createElement("div"); c.id = "alone"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;overflow:auto"; document.body.appendChild(c); window.alone = J.create(c, {}); return window.alone && typeof window.alone.destroy === "function" ? "made" : "create answered " + typeof window.alone; }, function (e) { return String(e && e.message || e); })');
  W.made = made === 'made';
  return W.made || 'it: ' + short(made);
}, 1000);
test.run('mounted, it draws its line, the party self (this node)', 0.2, async function () {
  if (!W.made) return 'nothing mounted: the test before failed';
  return await until(function () { return W.chrome.evaluate('/self \\(this node\\)/.test(document.getElementById("alone").innerHTML)'); }, 10000) ? true
    : 'mounted, it shows: ' + short(await W.chrome.evaluate('String(document.getElementById("alone").innerText)'));
}, 1000);
test.run('destroy empties its container', 0.2, async function () {
  if (!W.made) return 'nothing mounted: the test before failed';
  return await W.chrome.evaluate('(function () { window.alone.destroy(); var c = document.getElementById("alone"); var n = c.children.length; c.remove(); return n === 0; }())') ? true : 'destroy left its container holding something';
}, 1000);

// its tile opens it
const TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("introSpector") !== -1; })[0]';
test.run('the world: the app selector\'s tiles', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const tiles = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/app/element.js"); }).then(function () { var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.app.app.element.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function (e) { return String(e && e.message || e); })');
  W.tiles = tiles === 'made';
  return W.tiles || 'the tiles: ' + short(tiles);
}, 1000);
test.run('introSpector has a tile, intrinsic and on', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  return await until(function () { return W.chrome.evaluate('!!' + TILE); }, 10000) ? true
    : 'no introSpector tile: ' + short(await W.chrome.evaluate('String(document.getElementById("faces").innerText)'));
}, 1000);
test.run('its tile opens it: the party self (this node) and the family selector', 0.2, async function () {
  if (!W.tiles) return 'no tiles: the world failed';
  await W.chrome.evaluate('(function () { var t = ' + TILE + '; if (t) t.click(); return !!t; }())');
  return await until(function () { return W.chrome.evaluate('(function () { var l = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; }).pop(); return !!l && /self \\(this node\\)/.test(l.innerHTML) && !!l.querySelector(".api-family-selector"); }())'); }, 10000) ? true
    : 'after the tile: ' + short(await W.chrome.evaluate('String(document.getElementById("faces").innerText)'));
}, 1000);
