'use strict';
// spirit/run/spirit/app/testicle/element/test/statusBox.js
// The tests of spirit/app/testicle/element/statusBox.js, and of no other module (goal/G47.1, box v134-142). Asked of a real
// browser on a real testicle: a scratch node with testicle turned on, a Chrome page on the element's DEBUG page, the box
// mounted there alone, and two scripts planted in the scratch tree, one whose own test holds and one whose own test fails,
// each run by a press of testicle.run. What the box shows comes from that testicle's own stream; nothing is fed by hand
// (box v142: "the status element's own test runs on a scratch node with testicle on and a real run, nothing fed by hand").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REL = 'spirit/app/testicle/element/statusBox.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const W = {};
const OK = 'spirit/zzBox/zzOk.js', OKS = 'spirit/zzBox/test/zzOk.js', BAD = 'spirit/zzBox/zzBad.js', BADS = 'spirit/zzBox/test/zzBad.js';
const SUITE_HEAD = "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));\n";
const ev = function (expr) { return W.page.evaluate(expr).catch(function (e) { return 'threw: ' + (e && e.message || e); }); };
const ask = function (verb, args) {
  return fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) })
    .then(function (r) { return r.json(); }, function () { return null; });
};
const idle = function (ms) { return H.until(function () { return ask('testicle.busy', {}).then(function (b) { return b === false; }); }, ms); };
// The page's hands: mount the box alone, record every line and every busy icon it shows, in order.
const HANDS = '(function () { window.zz = { lines: [], icons: [],' +
  ' mount: function () { var b = document.createElement("div"); b.id = "zzA"; b.style.cssText = "width:500px;height:40px"; document.body.appendChild(b);' +
  '   window.m_zzA = window.spirit.element.spirit.app.testicle.element.statusBox.create(b);' +
  '   var note = function () { var l = document.querySelector("#zzA .testicle-last"), i = document.querySelector("#zzA .testicle-busy"), m = document.querySelector("#zzA .testicle-mode");' +
  '     var t = l ? l.textContent : null; if (t && t !== window.zz.lines[window.zz.lines.length - 1]) window.zz.lines.push(t);' +
  '     var g = i ? String(i.innerText || i.textContent || "").trim() : ""; if (g && g !== window.zz.icons[window.zz.icons.length - 1]) window.zz.icons.push(g);' +
  '     window.zz.mode = m ? String(m.innerText || m.textContent || "").trim() : ""; };' +
  '   note(); new MutationObserver(note).observe(b, { subtree: true, childList: true, characterData: true }); return true; },' +
  '}; return true; }())';

test.run('spirit/app/testicle/element/statusBox.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, REL)) || 'there is no ' + REL;
}, test.limit.quick);
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine';
}, test.limit.quick);
test.run('the world: a scratch node comes up with its DEBUG on and testicle on', 0.2, async function () {
  W.node = await H.scratchNode({ servers: ['testicle'] });
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, test.limit.slow);
test.run('the world: a page loads the box by itself and mounts it alone', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.testicle && window.spirit.element.spirit.app.testicle.element.statusBox)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) { await ev(HANDS); W.ok = (await ev('window.zz.mount()')) === true; }
  return !!W.ok || 'the box never stood on the page';
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});
const NOPAGE = 'no page: the world failed';

test.run('mounted, it puts one box into its container with the mode, the busy icon and the line', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { var b = document.getElementById("zzA"); return { kids: b.children.length, mode: !!b.querySelector(".testicle-mode"), busy: !!b.querySelector(".testicle-busy"), line: !!b.querySelector(".testicle-last") }; }())');
  return (r && r.kids === 1 && r.mode && r.busy && r.line) || 'mounted: ' + short(r);
}, test.limit.quick);
test.run('it shows the mode the node\'s testicle stands at: 🖖, interactive, as the node answers it', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const p = await ask('testicle.preferences', {});
  const want = p && (p.preferences || p).interactive === false ? '🤖' : '🖖';
  const ok = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === want; }); }, H.WAIT);
  return !!ok || 'mode shown ' + short(await ev('window.zz.mode')) + ', the node says ' + short(p);
}, test.limit.slow);
test.run('the world: testicle has classified the scratch tree and is idle', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  return (await idle(280000)) || 'testicle still busy after 280 s';
}, test.limit.long);
test.run('while testicle classified, the box showed 🚶‍➡️ and what it was doing, as the stream said', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('({ icons: window.zz.icons, lines: window.zz.lines })');
  const walked = (r.icons || []).some(function (g) { return /🚶/.test(g); });
  const said = (r.lines || []).some(function (l) { return /^classifying \d+ of \d+$/.test(l); });
  return (walked && said) || 'icons ' + short(r.icons) + '; lines ' + short((r.lines || []).filter(function (l) { return !/^added /.test(l); }));
}, test.limit.quick);
test.run('idle, it shows 🛌', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const ok = await H.until(function () { return ev('window.zz.icons[window.zz.icons.length - 1]').then(function (g) { return /🛌/.test(String(g)); }); }, H.WAIT);
  return !!ok || 'icons ' + short(await ev('window.zz.icons'));
}, test.limit.slow);
// A run whose test holds, and one whose test fails: what the box says comes from the scratch testicle's stream.
test.run('the world: zzOk.js and zzBad.js planted with their own tests, and testicle idle again', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzBox', 'test'), { recursive: true });
  fs.writeFileSync(path.join(run, OK), "'use strict';\n// zzOk\n");
  fs.writeFileSync(path.join(run, BAD), "'use strict';\n// zzBad\n");
  fs.writeFileSync(path.join(run, OKS), SUITE_HEAD + "test.run('zzOk holds', 0.2, function () { return true; }, test.limit.quick);\n");
  fs.writeFileSync(path.join(run, BADS), SUITE_HEAD + "test.run('zzBad fails', 0.2, function () { return 'it fails, as planted'; }, test.limit.quick);\n");
  await H.until(function () { return ask('testicle.suite.search', { script: OK, text: '' }).then(function (r) { return !!(r && (r.items || []).length); }); }, 60000);
  return (await idle(280000)) || 'testicle still busy after the plant';
}, test.limit.long);
let fromOk = 0;
test.run('a press of zzOk\'s own suite: the box says it runs, then "1 of 1 reported: spirit/zzBox/zzOk.js success"', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  fromOk = await ev('window.zz.lines.length');
  const r = await ask('testicle.run', { script: OK, suite: OKS });
  if (!r || r.started !== true) return 'the press answered ' + short(r);
  const ok = await H.until(function () { return ev('window.zz.lines.slice(' + fromOk + ')').then(function (l) { return (l || []).indexOf('1 of 1 reported: ' + OK + ' success') !== -1; }); }, 120000);
  const seen = await ev('window.zz.lines.slice(' + fromOk + ')');
  const ran = (seen || []).some(function (l) { return /^running zzOk\.js for spirit\/zzBox\/zzOk\.js$/.test(l); });
  return (!!ok && ran) || 'lines after the press: ' + short(seen);
}, test.limit.long);
test.run('a press of zzBad\'s own suite: the box says "1 of 1 reported: spirit/zzBox/zzBad.js failure", its true outcome', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await idle(60000);
  const from = await ev('window.zz.lines.length');
  const r = await ask('testicle.run', { script: BAD, suite: BADS });
  if (!r || r.started !== true) return 'the press answered ' + short(r);
  const ok = await H.until(function () { return ev('window.zz.lines.slice(' + from + ')').then(function (l) { return (l || []).indexOf('1 of 1 reported: ' + BAD + ' failure') !== -1; }); }, 120000);
  const seen = await ev('window.zz.lines.slice(' + from + ')');
  const lied = (seen || []).some(function (l) { return l === '1 of 1 reported: ' + BAD + ' success'; });
  return (!!ok && !lied) || 'lines after the press: ' + short(seen);
}, test.limit.long);
test.run('its box keeps what it holds inside: overflow hidden, one line, the message ellipsed', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { var s = document.querySelector("#zzA .testicle-status"), l = document.querySelector("#zzA .testicle-last"); var a = getComputedStyle(s), c = getComputedStyle(l); return { box: a.overflow, wrap: c.whiteSpace, ellipsis: c.textOverflow }; }())');
  return (r && r.box === 'hidden' && r.wrap === 'nowrap' && r.ellipsis === 'ellipsis') || 'styles: ' + short(r);
}, test.limit.quick);
// box v143: "all of testicle's elements must subscribe to the data they display": the mode set on the node after the
// box was drawn shows in it by itself, from the stream, with no new mount.
test.run('the node set to auto, the box shows 🤖 by itself; set back to interactive, 🖖', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await idle(60000);
  const a = await ask('testicle.preferences', { interactive: false });
  if (!a) return 'testicle.preferences { interactive: false } answered nothing';
  const auto = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🤖'; }); }, H.WAIT);
  const b = await ask('testicle.preferences', { interactive: true });
  if (!b) return 'testicle.preferences { interactive: true } answered nothing';
  const back = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🖖'; }); }, H.WAIT);
  return (!!auto && !!back) || 'set to auto it showed ' + (auto ? '🤖' : 'no 🤖') + '; set back, ' + short(await ev('window.zz.mode'));
}, test.limit.long);
test.run('destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { window.m_zzA.destroy(); return document.getElementById("zzA").innerHTML; }())');
  return r === '' || 'after destroy: ' + short(r);
}, test.limit.quick);
