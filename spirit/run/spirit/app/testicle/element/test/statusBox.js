'use strict';
// spirit/run/spirit/app/testicle/element/test/statusBox.js
// The tests of spirit/app/testicle/element/statusBox.js, and of no other module (goal/G47.1, box v134-135). Asked of a real
// browser: a scratch node with its DEBUG on (no testicle server: the stream is fed by hand into testicle's branch, as the
// cache manager keeps it), a Chrome page on the element's DEBUG page, the element mounted in boxes of its own.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REL = 'spirit/app/testicle/element/statusBox.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const W = {};
const ev = function (expr) { return W.page.evaluate(expr).catch(function (e) { return 'threw: ' + (e && e.message || e); }); };
// The page's hands: mount one into a fresh box, feed the monitor and the suite rows as the stream would, read the line.
const HANDS = '(function () { window.zz = {' +
  ' T: function () { return window.spirit.element.spirit.app.testicle.element.statusBox; },' +
  ' mount: function (id) { var b = document.createElement("div"); b.id = id; b.style.cssText = "width:400px;height:40px"; document.body.appendChild(b); window["m_" + id] = window.zz.T().create(b); return true; },' +
  ' line: function (id) { var l = document.querySelector("#" + id + " .testicle-last"); return l ? l.textContent : null; },' +
  ' text: function (id) { var b = document.getElementById(id); return b ? String(b.innerText || "").trim() : null; },' +
  ' home: function () { return window.spirit.data.testicle.data.branch("suite").replace(/suite$/, ""); },' +
  ' monitor: function (m) { window.spirit.data.mergePath(window.zz.home() + "monitor/now", m); return true; },' +
  ' rows: function (rows) { window.spirit.data.testicle.data.keep("suite", rows); return true; },' +
  '}; return true; }())';

test.run('spirit/app/testicle/element/statusBox.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, REL)) || 'there is no ' + REL;
}, test.limit.quick);
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine';
}, test.limit.quick);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, test.limit.slow);
test.run('the world: a page loads the element by itself', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.testicle && window.spirit.element.spirit.app.testicle.element.statusBox && window.spirit.data && window.spirit.data.testicle)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) await ev(HANDS);
  return !!W.ok || 'the element never stood on the page';
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
const NOPAGE = 'no page: the world failed';

test.run('mounted, it puts one box into its container with the mode, the busy icon and the line', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('window.zz.mount("zzA") && (function () { var b = document.getElementById("zzA"); return { kids: b.children.length, mode: !!b.querySelector(".testicle-mode"), busy: !!b.querySelector(".testicle-busy"), line: !!b.querySelector(".testicle-last") }; }())');
  return (r && r.kids === 1 && r.mode && r.busy && r.line) || 'mounted: ' + short(r);
}, test.limit.quick);
test.run('idle, with nothing streamed, it shows 🛌', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const ok = await H.until(function () { return ev('window.zz.text("zzA")').then(function (t) { return /🛌/.test(String(t)); }); }, 5000);
  return !!ok || 'it shows ' + short(await ev('window.zz.text("zzA")'));
}, test.limit.slow);
test.run('working, as the stream says, it shows 🚶‍➡️ and what the server is doing', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  await ev('window.zz.monitor({ busy: true, doing: "running zz.js for spirit/zz.js", running: "" })');
  const ok = await H.until(function () { return ev('window.zz.text("zzA")').then(function (t) { return /🚶/.test(String(t)) && /running zz\.js for spirit\/zz\.js/.test(String(t)); }); }, 5000);
  return !!ok || 'it shows ' + short(await ev('window.zz.text("zzA")'));
}, test.limit.slow);
// Box v134-135: "<x> of <n> reported: <script> <success|failure>".
const SUITE = 'spirit/zz/test/zz-sibling-general.js';
test.run('a run of three scripts, none reported yet: the line is still what the server is doing', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await ev('window.zz.monitor({ busy: true, doing: "running zz-sibling-general.js for 3 scripts", running: ' + JSON.stringify(JSON.stringify({ suite: SUITE, scripts: ['spirit/zz/a.js', 'spirit/zz/b.js', 'spirit/zz/c.js'], started: 1000 })) + ' })');
  // False arguments: a row of another suite, a row set before the run began, a row still flagged: none is one reported.
  await ev('window.zz.rows([{ key: "spirit/zz/a.js|spirit/zz/test/other.js", script: "spirit/zz/a.js", suite: "spirit/zz/test/other.js", test: false, outcome: "green", changed: 5000 },' +
    ' { key: "spirit/zz/b.js|' + SUITE + '", script: "spirit/zz/b.js", suite: "' + SUITE + '", test: false, outcome: "red", changed: 500 },' +
    ' { key: "spirit/zz/c.js|' + SUITE + '", script: "spirit/zz/c.js", suite: "' + SUITE + '", test: true, outcome: "", changed: 6000 }])');
  const line = await ev('window.zz.line("zzA")');
  return line === 'running zz-sibling-general.js for 3 scripts' || 'the line: ' + short(line);
}, test.limit.quick);
test.run('one script reports success: "1 of 3 reported: spirit/zz/a.js success"', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await ev('window.zz.rows([{ key: "spirit/zz/a.js|' + SUITE + '", script: "spirit/zz/a.js", suite: "' + SUITE + '", test: false, outcome: "green", changed: 2000 }])');
  const ok = await H.until(function () { return ev('window.zz.line("zzA")').then(function (l) { return l === '1 of 3 reported: spirit/zz/a.js success'; }); }, 5000);
  return !!ok || 'the line: ' + short(await ev('window.zz.line("zzA")'));
}, test.limit.slow);
test.run('the next reports failure: "2 of 3 reported: spirit/zz/b.js failure", the newest named', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await ev('window.zz.rows([{ key: "spirit/zz/b.js|' + SUITE + '", script: "spirit/zz/b.js", suite: "' + SUITE + '", test: false, outcome: "red", changed: 3000 }])');
  const ok = await H.until(function () { return ev('window.zz.line("zzA")').then(function (l) { return l === '2 of 3 reported: spirit/zz/b.js failure'; }); }, 5000);
  return !!ok || 'the line: ' + short(await ev('window.zz.line("zzA")'));
}, test.limit.slow);
test.run('the run over, idle again, the line goes back to the last change', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  await ev('window.zz.monitor({ busy: false, doing: "", running: "", last: { table: "suite", key: "spirit/zz/b.js|' + SUITE + '", change: "updated" } })');
  const ok = await H.until(function () { return ev('window.zz.line("zzA")').then(function (l) { return /^updated suite: spirit\/zz\/b\.js \| /.test(String(l)); }); }, 5000);
  return !!ok || 'the line: ' + short(await ev('window.zz.line("zzA")'));
}, test.limit.slow);
test.run('its box keeps what it holds inside: overflow hidden, one line, the message ellipsed', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { var s = document.querySelector("#zzA .testicle-status"), l = document.querySelector("#zzA .testicle-last"); var a = getComputedStyle(s), c = getComputedStyle(l); return { box: a.overflow, wrap: c.whiteSpace, ellipsis: c.textOverflow }; }())');
  return (r && r.box === 'hidden' && r.wrap === 'nowrap' && r.ellipsis === 'ellipsis') || 'styles: ' + short(r);
}, test.limit.quick);
test.run('destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { window.m_zzA.destroy(); return document.getElementById("zzA").innerHTML; }())');
  return r === '' || 'after destroy: ' + short(r);
}, test.limit.quick);
