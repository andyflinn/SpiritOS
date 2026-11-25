'use strict';

// spirit/run/spirit/element/monitor/value/test/script.js
// The tests of spirit/element/monitor/value/script.js, and of no other module (spec: ./script.md; goal/G47.1, the box, the monitor
// tiles). A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

const FILE = path.join(RUN, 'spirit', 'element', 'monitor', 'value', 'script.js');
const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});
const js = function (s) { return W.chrome.evaluate(s); };
// Mounted into a container of its own, #v-<name>; what it shows, read from the page.
const mount = function (name, opts) { return js('(function () { var d = document.body.appendChild(document.createElement("div")); d.id = "v-' + name + '"; window["v_' + name + '"] = window.spirit.required.spirit.element.monitor.value.create(d, ' + JSON.stringify(opts) + '); return true; })()'); };
const read = async function (name) {
  try { return JSON.parse(await js('(function () { var c = document.getElementById("v-' + name + '"), t = c && c.querySelector("[data-tile]"); if (!t) return JSON.stringify({ html: c ? c.innerHTML : "" }); var v = t.querySelector(".value"), l = t.querySelector(".label"); return JSON.stringify({ tile: t.className === "stat-tile", value: v ? v.textContent : "", label: l ? l.textContent : "", icon: !!t.querySelector(".shell-icon"), html: t.innerHTML, mode: t.getAttribute("data-mode") }); })()')); } catch (e) { return {}; }
};

test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || !W.chrome || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/' });
  W.page = !!(await until(function () { return js('!!(window.spirit && window.spirit.readyPromise)'); }, 20000));
  return W.page || false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript, at spirit.required.spirit.element.monitor.value, with a create', 0.2, async function () {
  if (!W.page) return false;
  W.loaded = await js('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/element/monitor/value/script.js"); }).then(function () { var m = window.spirit.required.spirit.element.monitor; return !!(m && m.value && typeof m.value.create === "function"); }, function () { return false; })');
  return W.loaded === true || false;
}, test.limit.quick);
// The box: "a value, mounted with an icon, a label, a value and a mode ... The mode defaults to tile".
test.run('mounted with an icon, a label and a value, it is a tile showing all three, the icon drawn by the icon element', 0.4, async function () {
  if (!W.loaded) return false;
  await mount('a', { icon: '🧪', label: 'Zz Label', value: '42 zz' });
  W.made = !!(await until(function () { return read('a').then(function (r) { return r.icon; }); }, 8000));
  const r = await read('a');
  return W.made && r.tile && r.value === '42 zz' && r.label === 'Zz Label' && r.html.indexOf('🧪') !== -1 ? true : false;
}, test.limit.quick);
test.run('handed no mode, it is shown as a tile', 0.4, async function () {
  if (!W.made) return false;
  return (await read('a')).mode === 'tile' || false;
}, test.limit.quick);
test.run('handed a mode it does not know yet, it is shown as a tile', 0.2, async function () {
  if (!W.loaded) return false;
  await mount('b', { icon: '🧪', label: 'Zz Row', value: '1', mode: 'row' });
  const r = await read('b');
  return r.tile && r.mode === 'tile' && r.value === '1' ? true : false;
}, test.limit.quick);
test.run('handed no value, it shows a dash', 0.2, async function () {
  if (!W.loaded) return false;
  await mount('c', { icon: '🧪', label: 'Zz Empty' });
  return (await read('c')).value === '–' || false;
}, test.limit.quick);
// "its value can be set again later"
test.run('set writes a new value in place', 0.4, async function () {
  if (!W.made) return false;
  await js('window.v_a.set("43 zz"); true');
  return (await read('a')).value === '43 zz' || false;
}, test.limit.quick);
// A tile that fills itself from a stream redraws on every change written into what it watches (script-sibling-browser.js).
test.run('set with the value it already shows writes it again', 0.4, async function () {
  if (!W.made) return false;
  const n = await js('(function () { var c = document.getElementById("v-a"); var n = 0; var mo = new MutationObserver(function (l) { n += l.length; }); mo.observe(c, { subtree: true, childList: true, characterData: true }); window.v_a.set("43 zz"); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { mo.disconnect(); return n; }); })()');
  return n > 0 || false;
}, test.limit.quick);
test.run('destroyed, it leaves its container empty, and a later set draws nothing', 0.2, async function () {
  if (!W.made) return false;
  const html = await js('(function () { window.v_a.destroy(); window.v_a.set("44 zz"); return document.getElementById("v-a").innerHTML; })()');
  return html === '' ? true : false;
}, test.limit.quick);
