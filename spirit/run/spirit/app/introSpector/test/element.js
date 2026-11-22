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

function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''); } catch (e) { return ''; } }

// introSpector: in spirit/app/introSpector/, a wrapper of a spirit/element/ file (goal/G43.29). One test.run per test
// (goal/G47.2). What the world made, for the tests after it.
const W = {};
const OWN = function () { return json(path.join(APP, 'introSpector.json')); };
test.after(function () {
  const chrome = W.chrome || {}; const node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

// the box: "same icons, shell:mount only", "both apps will be intrinsic", no api.js and no data.js
test.run('spirit/app/introSpector/introSpector.json is there', 0.2, function () {
  return !!OWN() || false;
}, test.limit.quick);
// WHICH ICON IS ANDY'S, AND IT CHANGES (goal/G47.1, Andy: "I'm not sure if it's worth testing for specific icons.. hey will
// only settle slowly over the next while...", then "yes" to keeping 'it has an icon' and dropping which one).
test.run('introSpector has an icon', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return (typeof id.icon === 'string' && id.icon.trim() !== '') || false;
}, test.limit.quick);
test.run('introSpector\'s label stays introSpector', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.label === 'introSpector' || false;
}, test.limit.quick);
test.run('introSpector is an intrinsic app', 0.2, function () {
  const id = (OWN() || {}).identity || {};
  return id.intrinsic === true || false;
}, test.limit.quick);
test.run('introSpector is mounted in the shell and has a tile', 0.2, function () {
  const own = OWN();
  return !!(own && own.shell && own.shell.mount === true && own.shell.tile === true) || false;
}, test.limit.quick);
test.run('introSpector is not mounted on the node, so it has no server and nothing is run', 0.2, function () {
  const own = OWN();
  return !!own && !(own.node && own.node.mount === true) && !(own.node && own.node.run === true) ? true : false;
}, test.limit.quick);
test.run('introSpector\'s folder holds element.js but no api.js and no data.js', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) && !fs.existsSync(path.join(APP, 'api.js')) && !fs.existsSync(path.join(APP, 'data.js')) ? true : false;
}, test.limit.quick);

// "a wrapper for separate spirit/element/ files": introSpector.js only mounts
test.run('introSpector\'s element.js brings in spirit/element/introSpector.js', 0.2, function () {
  return (/spirit\/element\/introSpector\.js/).test(code(path.join(APP, 'element.js'))) || false;
}, test.limit.quick);
test.run('introSpector\'s element.js draws nothing itself, using neither innerHTML nor an old shell helper', 0.2, function () {
  const src = code(path.join(APP, 'element.js'));
  return src !== '' && !(/innerHTML|activateApp|callDialog|factRow/).test(src) ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up with a Chrome page open on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  W.page = true;
  return true;
}, test.limit.slow);

// spirit.element.spirit.app.introSpector.element.create(container, { open }) -> { destroy }
test.run('the element registers itself on spirit.element, and its create answers an object with a destroy', 0.2, async function () {
  if (!W.page) return false;
  const made = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/app/introSpector/element.js"); }).then(function () { var J = spirit.element && spirit.element.spirit.app.introSpector.element; if (!J || typeof J.create !== "function") return false; var c = document.createElement("div"); c.id = "alone"; c.style.cssText = "position:fixed;left:0;top:0;width:900px;height:600px;overflow:auto"; document.body.appendChild(c); window.alone = J.create(c, {}); return window.alone && typeof window.alone.destroy === "function" ? "made" : false; }, function () { return false; })');
  W.made = made === 'made';
  return W.made || false;
}, test.limit.quick);
test.run('once mounted, the element draws its line for the party self, this node', 0.2, async function () {
  if (!W.made) return false;
  return await until(function () { return W.chrome.evaluate('/self \\(this node\\)/.test(document.getElementById("alone").innerHTML)'); }, 10000) ? true
    : false;
}, test.limit.quick);
test.run('destroying the element empties its container', 0.2, async function () {
  if (!W.made) return false;
  return await W.chrome.evaluate('(function () { window.alone.destroy(); var c = document.getElementById("alone"); var n = c.children.length; c.remove(); return n === 0; }())') ? true : false;
}, test.limit.quick);

// its tile opens it
const TILE = 'Array.prototype.filter.call(document.querySelectorAll("#faces .app-icon"), function (t) { return t.offsetParent !== null && String(t.textContent).indexOf("introSpector") !== -1; })[0]';
test.run('the app selector is drawn as tiles on the page', 0.2, async function () {
  if (!W.page) return false;
  const tiles = await W.chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/script.js"); }).then(function () { var c = document.createElement("div"); c.id = "faces"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.fsel = spirit.element.spirit.element.script.create(c, { face: "tiles" }); if (window.fsel.parentNode !== c) c.appendChild(window.fsel); return "made"; }, function () { return false; })');
  W.tiles = tiles === 'made';
  return W.tiles || false;
}, test.limit.quick);
test.run('introSpector has a visible tile in the app selector', 0.2, async function () {
  if (!W.tiles) return false;
  return await until(function () { return W.chrome.evaluate('!!' + TILE); }, 10000) ? true
    : false;
}, test.limit.quick);
test.run('pressing introSpector\'s tile opens it, showing the party self, this node, and the branch selector', 0.2, async function () {
  if (!W.tiles) return false;
  await W.chrome.evaluate('(function () { var t = ' + TILE + '; if (t) t.click(); return !!t; }())');
  return await until(function () { return W.chrome.evaluate('(function () { var l = Array.prototype.filter.call(document.querySelectorAll("#faces .app-container"), function (c) { return c.offsetParent !== null; }).pop(); return !!l && /self \\(this node\\)/.test(l.innerHTML) && !!l.querySelector(".api-family-selector"); }())'); }, 10000) ? true
    : false;
}, test.limit.quick);
