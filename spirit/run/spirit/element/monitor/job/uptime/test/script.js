'use strict';

// spirit/run/spirit/element/monitor/job/uptime/test/script.js
// The tests of spirit/element/monitor/job/uptime/script.js, and of no other module (spec: ./script.md; goal/G47.1, the box, the monitor
// tiles). A real Chrome on a scratch node's face page, the node's own spirit job on the real stream; neither Andy's node nor
// an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

const FILE = path.join(RUN, 'spirit', 'element', 'monitor', 'job', 'uptime', 'script.js');
// Its value, worked out from the stats the spirit job published: how long the node has run, in its two largest units.
const EXPECTED = "(function (t) { t = Math.floor(t); var D = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60); return D ? D + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm ' + (t % 60) + 's'; })(d.uptimeSeconds)";
const SHAPE = /^\d+[dhm] \d+[hms]$/;

const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* left */ }
});
const js = function (s) { return W.chrome.evaluate(s); };
// The tile as drawn in its container.
const READ = '(function () { var c = window.__box, t = c && c.querySelector("[data-tile]"); if (!t) return JSON.stringify({ html: c ? c.innerHTML : "" }); var v = t.querySelector(".value"), l = t.querySelector(".label"); return JSON.stringify({ label: l ? l.textContent : "", value: v ? v.textContent : "", icon: !!t.querySelector(".shell-icon"), glyph: t.innerHTML.indexOf(' + JSON.stringify("⏱️") + ') !== -1, mode: t.getAttribute("data-mode"), html: c.innerHTML }); })()';
const read = async function () { try { return JSON.parse(await js(READ)); } catch (e) { return {}; } };

test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || !W.chrome || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/' });
  W.page = !!(await until(function () { return js('!!(window.spirit && window.spirit.readyPromise)'); }, 20000));
  return W.page || false;
}, test.limit.slow);
// goal/G49.23: no spirit.required; what spirit.requireScript placed stands on the spirit object itself (spirit.element.<path>, the store at spirit.client).
test.run('it loads through spirit.requireScript, at spirit.element.monitor.job.uptime, with a create', 0.2, async function () {
  if (!W.page) return false;
  // WHAT IT ASKS FOR, AND ITS OWN ANSWER, AS spirit.requireScript HANDS THEM (goal/G49.9, box v5; Andy: "spirit.requireScript must
  // allways return either an object or a function... or fail/throw"): every path the page's requireScript is asked while it
  // loads is kept, and the element is mounted by the answer its own require hands back.
  W.loaded = await js('window.spirit.readyPromise.then(function () { var own = window.spirit.requireScript; window.__asked = []; window.spirit.requireScript = function (p) { window.__asked.push(String(p)); return own.apply(this, arguments); }; return window.spirit.requireScript("spirit/element/monitor/job/uptime/script.js"); }).then(function (answer) { window.__subject = answer; var m = window.spirit.element.monitor.job; return !!(m && m.uptime && typeof m.uptime.create === "function"); }, function () { return false; })');
  return W.loaded === true || false;
}, test.limit.quick);
// The box: "Each requires the jobs family's interface".
test.run('it requires the jobs branch\'s interface and the value tile itself', 0.2, async function () {
  if (!W.loaded) return false;
  const asked = JSON.parse((await js('JSON.stringify(window.__asked || [])')) || '[]');
  return asked.indexOf('spirit/job/script.js') !== -1 && asked.indexOf('spirit/element/monitor/value/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('mounted, it is a value tile: its icon ⏱️ drawn by the icon element, and its label Uptime', 0.4, async function () {
  if (!W.loaded) return false;
  await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:300px;height:200px"; window.__box = d; window.__made = window.__subject.create(d); return true; })()');
  W.made = !!(await until(function () { return read().then(function (r) { return r.icon; }); }, 8000));
  const r = await read();
  return W.made && r.glyph && r.label === "Uptime" && r.mode === 'tile' ? true : false;
}, test.limit.quick);
// The box: "fills itself from the stats the node's spirit job publishes".
// goal/G49.23: the job row read from the job branch's client (spirit.job.client), the store kept at the branch's path, spirit.job.
test.run('its value is how long the node has run, in its two largest units, from the spirit job\'s stats', 0.4, async function () {
  if (!W.made) return false;
  if (!(await until(function () { return js('!!((window.spirit.job.client.job("spirit") || {}).data || {}).stats'); }, 20000))) return false;
  let shown = '';
  const ok = await until(function () { return js('(function () { var S = window.spirit, d = S.job.client.job("spirit").data.stats; var want = ' + EXPECTED + '; var v = window.__box.querySelector(".value").textContent; return v === want ? v : ""; })()').then(function (v) { shown = v; return !!v; }); }, 10000);
  return ok && SHAPE.test(String(shown)) ? true : false;
}, test.limit.slow);
// script-sibling-browser.js: "a change written into what it watches redraws it": the row written again, its stats unchanged.
test.run('a change written into the spirit job\'s row writes its value again at once', 0.4, async function () {
  if (!W.made) return false;
  const said = await js('(function () { var D = window.spirit.client; var at = D.homeNode() + "/spirit.job/jobs/spirit"; var before = D.getPath(at); if (!before) return Promise.resolve("no row"); var n = 0; var mo = new MutationObserver(function (l) { n += l.length; }); mo.observe(window.__box, { subtree: true, childList: true, characterData: true }); D.setPath(at, Object.assign({}, before, { label: "zzprobe" })); return new Promise(function (r) { setTimeout(r, 300); }).then(function () { mo.disconnect(); D.setPath(at, before); return n > 0 ? "redrew" : "still"; }); })()');
  return said === 'redrew' || false;
}, test.limit.quick);
test.run('destroyed, it leaves its container empty, and a change of the row draws nothing', 0.2, async function () {
  if (!W.made) return false;
  const html = await js('(function () { window.__made.destroy(); var D = window.spirit.client; var at = D.homeNode() + "/spirit.job/jobs/spirit"; var before = D.getPath(at); if (before) { D.setPath(at, Object.assign({}, before, { label: "zzafter" })); D.setPath(at, before); } return window.__box.innerHTML; })()');
  return html === '' ? true : false;
}, test.limit.quick);
