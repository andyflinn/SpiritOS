'use strict';

// spirit/run/spirit/element/monitor/job/test/script.js
// The tests of spirit/element/monitor/job/script.js, and of no other module (spec: ./script.md; goal/G47.1, the box, the monitor tiles).
// A real Chrome on a scratch node's page, the node's own spirit job on the real stream; neither Andy's node nor an agent's is
// touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

const FILE = path.join(RUN, 'spirit', 'element', 'monitor', 'job', 'script.js');
const OLD = path.join(RUN, 'spirit', 'element', 'monitor', 'spirit.js');
// The six, in this order (the box: "it lays out the six job tiles").
const NAMES = ['memory', 'cpu', 'uptime', 'delay', 'connections', 'running'];
const TILES = ['Memory', 'CPU', 'Uptime', 'Event loop delay', 'Connections', 'Jobs running'];

const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});
function readCode() { return fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '') : ''; }
const js = function (s) { return W.chrome.evaluate(s); };
const read = async function () {
  try { return JSON.parse(await js('(function () { var c = window.__box; if (!c) return "{}"; var tiles = [].map.call(c.querySelectorAll("[data-tile]"), function (t) { var v = t.querySelector(".value"), l = t.querySelector(".label"); return { name: l ? l.textContent : "", value: v ? v.textContent : "", icon: !!t.querySelector(".shell-icon") }; }); return JSON.stringify({ html: c.innerHTML, grid: !!c.querySelector(".stats-grid"), tiles: tiles }); })()')); } catch (e) { return {}; }
};

// The box: "spirit/element/monitor/job/script.js replaces spirit/element/monitor/spirit.js ... and the old file goes."
test.run('job.js is there, and the old spirit monitor is gone', 0.4, function () {
  return !!readCode() && !fs.existsSync(OLD) ? true : false;
}, test.limit.quick);
test.run('it requires each of the six job tiles, and reads no stats itself', 0.4, function () {
  const code = readCode();
  return code && NAMES.every(function (n) { return code.indexOf("'" + n + "'") !== -1; }) && code.indexOf("'spirit/element/monitor/job/' + n + '/script.js'") !== -1 && !/\.stats\b|job\.data\.job\(/.test(code) ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || !W.chrome || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  W.page = !!(await until(function () { return js('!!(window.spirit && window.spirit.readyPromise)'); }, 20000));
  return W.page || false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript, at spirit.required.spirit.element.monitor.job, with a create, the six tiles beside it', 0.2, async function () {
  if (!W.page) return false;
  W.loaded = await js('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/element/monitor/job/script.js"); }).then(function () { var j = window.spirit.required.spirit.element.monitor.job; return !!(j && typeof j.create === "function") && ' + JSON.stringify(NAMES) + '.every(function (n) { return j[n] && typeof j[n].create === "function"; }); }, function () { return false; })');
  return W.loaded === true || false;
}, test.limit.quick);
test.run('mounted, it lays out the six tiles in one grid, in order: memory, CPU, uptime, event loop delay, connections, jobs running', 0.4, async function () {
  if (!W.loaded) return false;
  await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:240px;display:flex;flex-direction:column"; window.__box = d; window.__made = window.spirit.required.spirit.element.monitor.job.create(d); return true; })()');
  W.made = !!(await until(function () { return read().then(function (r) { return (r.tiles || []).length === TILES.length; }); }, 10000));
  const r = W.shown = await read();
  return W.made && r.grid && JSON.stringify((r.tiles || []).map(function (t) { return t.name; })) === JSON.stringify(TILES) ? true : false;
}, test.limit.quick);
test.run('once the stream\'s reading is in, each tile holds its icon and a value', 0.4, async function () {
  if (!W.made) return false;
  const filled = await until(function () { return read().then(function (r) { return (r.tiles || []).every(function (t) { return t.icon && t.value && t.value !== '–'; }); }); }, 20000);
  return filled ? true : false;
}, test.limit.slow);
test.run('destroyed, it leaves its container empty, and a later change of the spirit job draws nothing', 0.2, async function () {
  if (!W.made) return false;
  const html = await js('(function () { window.__made.destroy(); var D = window.spirit.required.spirit.data; var at = D.homeNode() + "/job/jobs/spirit"; var before = D.getPath(at); if (before) { D.setPath(at, Object.assign({}, before, { label: "zzafter" })); D.setPath(at, before); } return window.__box.innerHTML; })()');
  return html === '' ? true : false;
}, test.limit.quick);
