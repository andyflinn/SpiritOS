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

const W = {};
const OK = 'spirit/zzBox/zzOk.js', OKS = 'spirit/zzBox/test/zzOk.js', BAD = 'spirit/zzBox/zzBad.js', BADS = 'spirit/zzBox/test/zzBad.js';
const SUITE_HEAD = "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));\n";
const ev = function (expr) { return W.page.evaluate(expr).catch(function () { return null; }); };
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
  return fs.existsSync(path.join(RUN, REL)) || false;
}, test.limit.quick);
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on and testicle on', 0.2, async function () {
  W.node = await H.scratchNode({ servers: ['testicle'] });
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('a page loads the box by itself and mounts it alone', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.testicle && window.spirit.element.spirit.app.testicle.element.statusBox)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) { await ev(HANDS); W.ok = (await ev('window.zz.mount()')) === true; }
  return !!W.ok || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});

test.run('when mounted, it puts one box into its container with the mode, the busy icon and the line', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var b = document.getElementById("zzA"); return { kids: b.children.length, mode: !!b.querySelector(".testicle-mode"), busy: !!b.querySelector(".testicle-busy"), line: !!b.querySelector(".testicle-last") }; }())');
  return (r && r.kids === 1 && r.mode && r.busy && r.line) || false;
}, test.limit.quick);
test.run('it shows the mode the node\'s testicle stands at: 🖖, interactive, as the node answers it', 0.2, async function () {
  if (!W.ok) return false;
  const p = await ask('testicle.preferences', {});
  const want = p && (p.preferences || p).interactive === false ? '🤖' : '🖖';
  const ok = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === want; }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
test.run('testicle has classified the scratch tree and is idle', 0.2, async function () {
  if (!W.ok) return false;
  return (await idle(280000)) || false;
}, test.limit.long);
test.run('while testicle classified, the box showed 🚶‍➡️ and what it was doing, as the stream said', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('({ icons: window.zz.icons, lines: window.zz.lines })');
  const walked = (r.icons || []).some(function (g) { return /🚶/.test(g); });
  const said = (r.lines || []).some(function (l) { return /^classifying \d+ of \d+$/.test(l); });
  return (walked && said) || false;
}, test.limit.quick);
test.run('when testicle is idle, the box shows 🛌', 0.2, async function () {
  if (!W.ok) return false;
  const ok = await H.until(function () { return ev('window.zz.icons[window.zz.icons.length - 1]').then(function (g) { return /🛌/.test(String(g)); }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
// A run whose test holds, and one whose test fails: what the box says comes from the scratch testicle's stream.
test.run('zzOk.js and zzBad.js are planted with their own tests, and testicle is idle again', 0.2, async function () {
  if (!W.ok) return false;
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzBox', 'test'), { recursive: true });
  fs.writeFileSync(path.join(run, OK), "'use strict';\n// zzOk\n");
  fs.writeFileSync(path.join(run, BAD), "'use strict';\n// zzBad\n");
  fs.writeFileSync(path.join(run, OKS), SUITE_HEAD + "test.run('zzOk holds', 0.2, function () { return true; }, test.limit.quick);\n");
  fs.writeFileSync(path.join(run, BADS), SUITE_HEAD + "test.run('zzBad fails', 0.2, function () { return false; }, test.limit.quick);\n");
  await H.until(function () { return ask('testicle.suite.search', { script: OK, text: '' }).then(function (r) { return !!(r && (r.items || []).length); }); }, 60000);
  return (await idle(280000)) || false;
}, test.limit.long);
let fromOk = 0;
// The result an icon (Andy: "why are the results in status messages not icons?"), and the count after the running line
// while the run still goes (goal/G47.1): a line holding it, not a line of it alone.
const holds = function (lines, words) { return (lines || []).some(function (l) { return String(l).indexOf(words) !== -1; }); };
test.run('after a press of zzOk\'s own suite the box says it runs, then "1 of 1 reported: spirit/zzBox/zzOk.js ✅"', 0.4, async function () {
  if (!W.ok) return false;
  fromOk = await ev('window.zz.lines.length');
  const r = await ask('testicle.run', { script: OK, suite: OKS });
  if (!r || r.started !== true) return false;
  const ok = await H.until(function () { return ev('window.zz.lines.slice(' + fromOk + ')').then(function (l) { return holds(l, '1 of 1 reported: ' + OK + ' ✅'); }); }, 120000);
  const seen = await ev('window.zz.lines.slice(' + fromOk + ')');
  W.okSeen = seen || [];
  const ran = (seen || []).some(function (l) { return /^running zzOk\.js for spirit\/zzBox\/zzOk\.js$/.test(l); });
  return (!!ok && ran) || false;
}, test.limit.long);
// EACH TEST SAID AS IT IS REPORTED (Andy, watching "running testicle.js for spirit/app/testicle/testicle.js": "Does NOT report
// what it's doing!"): while its suite runs, the running line names the test reported and its result as an icon.
const namesTest = function (lines, suite, title, icon) {
  return (lines || []).some(function (l) { return String(l).indexOf('running ' + suite) === 0 && String(l).indexOf(title) !== -1 && String(l).indexOf(icon) !== -1; });
};
test.run('while zzOk\'s suite runs, its running line names the test reported, "zzOk holds", with ✅', 0.4, function () {
  if (!W.okSeen) return false;
  return namesTest(W.okSeen, 'zzOk.js for spirit/zzBox/zzOk.js', 'zzOk holds', '✅') || false;
}, test.limit.quick);
test.run('after a press of zzBad\'s own suite the box says "1 of 1 reported: spirit/zzBox/zzBad.js ❌", its true outcome', 0.4, async function () {
  if (!W.ok) return false;
  await idle(60000);
  const from = await ev('window.zz.lines.length');
  const r = await ask('testicle.run', { script: BAD, suite: BADS });
  if (!r || r.started !== true) return false;
  const ok = await H.until(function () { return ev('window.zz.lines.slice(' + from + ')').then(function (l) { return holds(l, '1 of 1 reported: ' + BAD + ' ❌'); }); }, 120000);
  const seen = await ev('window.zz.lines.slice(' + from + ')');
  const lied = holds(seen, '1 of 1 reported: ' + BAD + ' ✅');
  W.badSeen = seen || [];
  return (!!ok && !lied) || false;
}, test.limit.long);
test.run('while zzBad\'s suite runs, its running line names the test reported, "zzBad fails", with ❌ and never ✅', 0.4, function () {
  if (!W.badSeen) return false;
  return (namesTest(W.badSeen, 'zzBad.js for spirit/zzBox/zzBad.js', 'zzBad fails', '❌') && !namesTest(W.badSeen, 'zzBad.js for spirit/zzBox/zzBad.js', 'zzBad fails', '✅')) || false;
}, test.limit.quick);
test.run('its box keeps what it holds inside, with overflow hidden, one line and the message ellipsed', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var s = document.querySelector("#zzA .testicle-status"), l = document.querySelector("#zzA .testicle-last"); var a = getComputedStyle(s), c = getComputedStyle(l); return { box: a.overflow, wrap: c.whiteSpace, ellipsis: c.textOverflow }; }())');
  return (r && r.box === 'hidden' && r.wrap === 'nowrap' && r.ellipsis === 'ellipsis') || false;
}, test.limit.quick);
// box v143: "all of testicle's elements must subscribe to the data they display": the mode set on the node after the
// box was drawn shows in it by itself, from the stream, with no new mount.
test.run('with the node set to auto the box shows 🤖 by itself, and set back to interactive it shows 🖖', 0.4, async function () {
  if (!W.ok) return false;
  await idle(60000);
  const a = await ask('testicle.preferences', { interactive: false });
  if (!a) return false;
  const auto = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🤖'; }); }, H.WAIT);
  const b = await ask('testicle.preferences', { interactive: true });
  if (!b) return false;
  const back = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🖖'; }); }, H.WAIT);
  return (!!auto && !!back) || false;
}, test.limit.long);
test.run('once the box is destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { window.m_zzA.destroy(); return document.getElementById("zzA").innerHTML; }())');
  return r === '' || false;
}, test.limit.quick);
