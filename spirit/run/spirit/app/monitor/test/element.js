'use strict';

// spirit/run/spirit/app/monitor/test/element.js
// The tests of spirit/app/monitor/element.js, and of no other module (spec: ./monitor.md; goal/G43.6). Andy, box: "An app that
// reads and displays a stream, called "monitor". It resides in spirit.app.monitor". A real Chrome on a scratch node's page, the
// node's own server-stats job on the real stream; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until, sleep } = SPIRIT.requireScript('spirit/test/headLessChrome.js');

const FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'element.js');
const JSON_FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.json');


// element.js: the monitor, an app that reads and displays a stream (goal/G43.6). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  if (chrome && chrome.kid) chrome.kid.kill();
  if (node.child) node.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});
function readJson() { try { return JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); } catch (e) { return {}; } }
function readCode() { return fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '') : ''; }
const js = function (s) { return W.chrome.evaluate(s); };
const read = async function () { try { return JSON.parse(await js('JSON.stringify({ text: window.__box ? window.__box.innerText : "" })')); } catch (e) { return {}; } };

// monitor.json: "icon 🦻, label "Monitor", mount monitor.js, shell mount and tile true, node mount false." Since goal/G43.32 it mounts element.js (rule 4)
// WHICH ICON IS ANDY'S, AND IT CHANGES (goal/G47.1, Andy: "I'm not sure if it's worth testing for specific icons.. hey will
// only settle slowly over the next while...", then "yes" to keeping 'it has an icon' and dropping which one).
test.run('it has an icon, and its label is Monitor', 0.2, function () {
  const m = readJson();
  return m.identity && typeof m.identity.icon === 'string' && m.identity.icon.trim() !== '' && m.identity.label === 'Monitor' ? true : false;
}, test.limit.quick);
test.run('it mounts element.js', 0.2, function () {
  const m = readJson();
  return m.mount && m.mount['element.js'] === true ? true : false;
}, test.limit.quick);
test.run('its shell mount and its tile are true', 0.2, function () {
  const m = readJson();
  return m.shell && m.shell.mount === true && m.shell.tile === true ? true : false;
}, test.limit.quick);
test.run('its node mount is false', 0.2, function () {
  const m = readJson();
  return m.node && m.node.mount === false ? true : false;
}, test.limit.quick);

// "It requires no old code: no spirit.shell." "It opens no other app"
test.run('monitor.js is there', 0.2, function () {
  return !!readCode() || false;
}, test.limit.quick);
test.run('it names no spirit.shell and launches nothing', 0.2, function () {
  const code = readCode();
  return code && !/spirit\.shell|launchApp|data-launch-app/.test(code) ? true : false;
}, test.limit.quick);
test.run('it requires nothing under shell/', 0.2, function () {
  const code = readCode();
  return code && !/['"]\/?shell\//.test(code) ? true : false;
}, test.limit.quick);
test.run('it reaches nothing through spirit.elements', 0.2, function () {
  const code = readCode();
  return code && !/\.elements\b/.test(code) ? true : false;
}, test.limit.quick);
// Q24: it shows the spirit job's monitor, six tiles, and no value list (Andy: "throw out "valued" completely"); the monitor is
// spirit/element/monitor/job/script.js since goal/G47.1, the box, the monitor tiles.
test.run('it loads and shows the spirit job monitor element, and no valued', 0.2, function () {
  const code = readCode();
  // It shows the job monitor through its own require's answer (goal/G49.9: never at its spirit.required place).
  return code && code.indexOf('spirit/element/monitor/job/script.js') !== -1 && code.indexOf("ANSWER['spirit/element/monitor/job/script.js'].create") !== -1 && code.indexOf('monitor/spirit.js') === -1 && code.indexOf('valued') === -1 ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.chrome || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  W.page = !!(await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000));
  return W.page || false;
}, test.limit.slow);
test.run('monitor.js loads on a page', 0.2, async function () {
  if (!W.page) return false;
  const started = await js('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/job/api.js"); }).then(function () { return window.spirit.requireScript("spirit/app/monitor/element.js"); }).then(function () { return "loaded"; }, function () { return null; })');
  return started === 'loaded' || false;
}, test.limit.quick);

// goal/G43.32, the box: "Monitor too: its createApp becomes its element.js, and appSelector's createApp path goes."
// the box (goal/G43.32): "its createApp becomes its element.js": spirit.required.spirit.app.monitor.element.create(container) -> { destroy() }
test.run('the page has spirit.required.spirit.app.monitor.element.create', 0.2, async function () {
  if (!W.page) return false;
  const home = await js('(function () { var a = ((window.spirit.required || {}).spirit || {}).app || {}; return JSON.stringify({ create: typeof ((a.monitor || {}).element || {}).create, createApp: typeof ((window.spirit.app || {}).monitor || {}).createApp, old: typeof (window.spirit.elements || {}).monitor }); })()');
  let h = {}; try { h = JSON.parse(home); } catch (e) { h = {}; }
  W.h = h;
  W.create = h.create === 'function';
  return W.create || false;
}, test.limit.quick);
test.run('the page has no spirit.app.monitor.createApp, nor any monitor on spirit.elements', 0.2, function () {
  if (!W.h) return false;
  return W.h.createApp === 'undefined' && W.h.old === 'undefined' ? true : false;
}, test.limit.quick);

// Its tiles are the element's, tested in spirit/element/monitor/test/spirit.js; here, that the app shows them.
test.run('opened, it shows the six tiles', 0.2, async function () {
  if (!W.create) return false;
  await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:240px;display:flex;flex-direction:column"; window.__box = d; window.__made = window.spirit.required.spirit.app.monitor.element.create(d); return true; })()');
  W.made = true;
  const n = await until(function () { return js('window.__box.querySelectorAll("[data-tile]").length === 6'); }, 20000);
  return n ? true : false;
}, test.limit.slow);

// { destroy() }
test.run('destroy leaves its container empty', 0.2, async function () {
  if (!W.made) return false;
  const count = await js('(function () { var before = window.__box.innerText.length; window.__made.destroy(); return JSON.stringify({ before: before, after: window.__box.innerText.length }); })()');
  let c = {}; try { c = JSON.parse(count); } catch (e) { c = {}; }
  W.destroyed = true;
  return c.before > 0 && c.after === 0 ? true : false;
}, test.limit.quick);
test.run('after destroy, a later reading paints nothing', 0.2, async function () {
  if (!W.destroyed) return false;
  const quiet = await read();
  await sleep(6000);
  const still = await read();
  return String(still.text) === String(quiet.text) ? true : false;
}, test.limit.slow);
