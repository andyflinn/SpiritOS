'use strict';

// spirit/run/spirit/element/monitor/test/spirit.js
// The tests of spirit/element/monitor/spirit.js, and of no other module (spec: ./spirit.md; goal/G47.1, Q24). A real Chrome on a
// scratch node's page, the node's own spirit job on the real stream; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const FILE = path.join(RUN, 'spirit', 'element', 'monitor', 'spirit.js');
// Q24: "keep it simple, with the values you suggested": six tiles, in this order.
const TILES = ['Memory', 'CPU', 'Uptime', 'Event loop delay', 'Connections', 'Jobs running'];
// "drop about 50% of the stupid info it shows that interests NOBODY": what the value list showed and the tiles do not.
const DROPPED = ['Heap used', 'Event loop mean', 'Event loop max', 'Files', 'Folders', 'Requests', 'MIME', 'by status', 'by method'];

const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  if (chrome && chrome.kid) chrome.kid.kill();
  if (node.child) node.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});
function readCode() { return fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '') : ''; }
const js = function (s) { return W.chrome.evaluate(s); };
// The tiles as drawn: each its name, its value, and whether it holds an icon.
const read = async function () {
  try {
    return JSON.parse(await js('(function () { var c = window.__box; if (!c) return "{}"; var tiles = [].map.call(c.querySelectorAll("[data-tile]"), function (t) { var v = t.querySelector(".value"), l = t.querySelector(".label"); return { name: l ? l.textContent : "", value: v ? v.textContent : "", icon: !!t.querySelector(".shell-icon") }; }); return JSON.stringify({ text: c.innerText, tiles: tiles }); })()'));
  } catch (e) { return {}; }
};
const valueOf = function (r, name) { return ((r.tiles || []).filter(function (t) { return t.name === name; })[0] || {}).value || ''; };

test.run('spirit.js is there', 0.2, function () {
  return !!readCode() || false;
}, test.limit.quick);
test.run('it names no spirit.shell, nothing under shell/, nothing through spirit.elements, and no valued', 0.2, function () {
  const code = readCode();
  return code && !/spirit\.shell|['"]\/?shell\/|\.elements\b|valued/.test(code) ? true : false;
}, test.limit.quick);
test.run('it draws its icons with the icon element', 0.2, function () {
  const code = readCode();
  return code && /spirit\/element\/icon\.js/.test(code) && /element\.icon/.test(code) ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.chrome || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  W.page = !!(await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000));
  return W.page || false;
}, test.limit.slow);
test.run('the page has spirit.element.spirit.element.monitor.spirit.create', 0.2, async function () {
  if (!W.page) return false;
  const type = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/monitor/spirit.js"); }).then(function () { return typeof (((((window.spirit.element || {}).spirit || {}).element || {}).monitor || {}).spirit || {}).create; }, function () { return ""; })');
  W.create = type === 'function';
  return W.create || false;
}, test.limit.quick);

// "Until the first reading, it says it is waiting."
test.run('with no reading it says it is waiting, before the first tiles', 0.2, async function () {
  if (!W.create) return false;
  await js('(function () { var J = window.spirit.data.job.data; var job = J.find(function (j) { return j && j.id === "spirit"; }); if (job) window.spirit.data.viewAt(null, "job").del("jobs/" + job.id); var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:240px;display:flex;flex-direction:column"; window.__box = d; window.__said = []; new MutationObserver(function () { var t = d.innerText; if (t) window.__said.push(/waiting/i.test(t) && !d.querySelector("[data-tile]") ? "waiting" : "other"); }).observe(d, { childList: true, subtree: true, characterData: true }); window.__made = window.spirit.element.spirit.element.monitor.spirit.create(d); return true; })()');
  W.made = true;
  await until(function () { return js('window.__said.length > 0'); }, 8000);
  const said = await js('window.__said[0] || ""');
  return said === 'waiting' || false;
}, test.limit.quick);

// "a few pretty tiles with icon and a value pair": the six, in order.
test.run('the stream\'s reading brings six tiles: memory, CPU, uptime, event loop delay, connections, jobs running', 0.2, async function () {
  if (!W.made) return false;
  await until(function () { return read().then(function (r) { return (r.tiles || []).length === TILES.length; }); }, 20000);
  const shown = W.shown = await read();
  return JSON.stringify((shown.tiles || []).map(function (t) { return t.name; })) === JSON.stringify(TILES) ? true : false;
}, test.limit.slow);
test.run('each tile holds an icon and a value', 0.2, function () {
  if (!W.shown) return false;
  return (W.shown.tiles || []).length === TILES.length && W.shown.tiles.every(function (t) { return t.icon && t.value.length > 0; }) ? true : false;
}, test.limit.quick);
test.run('once the tiles are in, it no longer says waiting', 0.2, function () {
  if (!W.shown) return false;
  return !/waiting/i.test(String(W.shown.text)) || false;
}, test.limit.quick);
test.run('nothing it no longer shows is there: heap, the event loop mean and max, files, folders, requests, the lists of counts', 0.2, function () {
  if (!W.shown) return false;
  const text = String(W.shown.text);
  return !DROPPED.some(function (n) { return text.indexOf(n) !== -1; }) || false;
}, test.limit.quick);
test.run('jobs running is the count of the node\'s running jobs', 0.2, async function () {
  if (!W.shown) return false;
  const running = await js('String(((window.spirit.data.job.data.job("spirit").data.stats.jobs || {}).byStatus || {}).running || 0)');
  const now = await read();
  return valueOf(now, 'Jobs running') === running || false;
}, test.limit.quick);

// "subscribed to "spirit"": each new reading writes the values, with nothing asked, the tiles themselves kept.
test.run('a new reading changes the uptime on screen, with nothing asked, and the tiles stay the same tiles', 0.2, async function () {
  if (!W.shown) return false;
  await js('window.__first = window.__box.querySelector("[data-tile]"); true');
  const before = valueOf(W.shown, 'Uptime');
  const moved = await until(function () { return read().then(function (r) { return valueOf(r, 'Uptime') && valueOf(r, 'Uptime') !== before; }); }, 20000);
  const same = await js('window.__box.querySelector("[data-tile]") === window.__first');
  return moved && same ? true : false;
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
