'use strict';
// spirit/run/spirit/app/testicle/element/test/scriptDetail.js
// The tests of spirit/app/testicle/element/scriptDetail.js, and of no other module (goal/G47.1, box v134-135). Asked of a
// real browser: a scratch node with its DEBUG on and testicle turned on, a Chrome page on the element's DEBUG page, the
// element mounted in boxes of its own: with no script, with a production script, with a name that is none.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REL = 'spirit/app/testicle/element/scriptDetail.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const W = {};
const ev = function (expr) { return W.page.evaluate(expr).catch(function (e) { return 'threw: ' + (e && e.message || e); }); };
const HANDS = '(function () { window.zz = {' +
  ' mount: function (id, o) { var b = document.createElement("div"); b.id = id; b.style.cssText = "width:500px;height:300px;display:flex;flex-direction:column"; document.body.appendChild(b);' +
  '   try { window["m_" + id] = window.spirit.element.spirit.app.testicle.element.scriptDetail.create(b, o); return true; } catch (e) { return "threw: " + (e && e.message || e); } },' +
  ' title: function (id) { var t = document.querySelector("#" + id + " .testicle-title"); return t ? t.textContent : null; },' +
  ' below: function (id) { var t = document.querySelector("#" + id + " .testicle-below"); return t ? String(t.innerText || "").trim() : null; },' +
  ' list: function (id) { var t = document.querySelector("#" + id + " .testicle-below"); return t ? t.querySelectorAll("[id$=\\"list\\"]").length : -1; },' +
  '}; return true; }())';

test.run('spirit/app/testicle/element/scriptDetail.js exists', 0.2, function () {
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
test.run('the world: a page loads the element by itself', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.testicle && window.spirit.element.spirit.app.testicle.element.scriptDetail)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) await ev(HANDS);
  return !!W.ok || 'the element never stood on the page';
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});
const NOPAGE = 'no page: the world failed';

test.run('mounted with no script, it draws its empty box, an empty title, and asks nothing', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const m = await ev('window.zz.mount("zzNone", {})');
  if (m !== true) return 'mount: ' + short(m);
  await H.sleep(1500);
  const r = await ev('({ title: window.zz.title("zzNone"), below: window.zz.below("zzNone"), kids: document.getElementById("zzNone").children.length })');
  return (r && r.title === '' && r.below === '' && r.kids === 1) || 'drawn: ' + short(r);
}, test.limit.slow);
test.run('mounted with a production script, its title is the script\'s full path', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const m = await ev('window.zz.mount("zzSpirit", { script: "spirit/spirit.js" })');
  if (m !== true) return 'mount: ' + short(m);
  const t = await ev('window.zz.title("zzSpirit")');
  return t === 'spirit/spirit.js' || 'its title: ' + short(t);
}, test.limit.quick);
test.run('and below it, once script.get answered, the suite search of that script', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const ok = await H.until(function () { return ev('window.zz.list("zzSpirit")').then(function (n) { return n > 0; }); }, H.WAIT);
  return !!ok || 'below: ' + short(await ev('window.zz.below("zzSpirit")'));
}, test.limit.slow);
test.run('a name that is no production script: below the title, the error script.get gives, and no search', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const m = await ev('window.zz.mount("zzNot", { script: "spirit/zz/notes.md" })');
  if (m !== true) return 'mount: ' + short(m);
  const ok = await H.until(function () { return ev('window.zz.below("zzNot")').then(function (t) { return /not a production script|not-a-production-script/i.test(String(t)); }); }, H.WAIT);
  const n = await ev('window.zz.list("zzNot")');
  return (!!ok && n === 0) || 'below: ' + short(await ev('window.zz.below("zzNot")')) + ', lists ' + n;
}, test.limit.slow);
// Its own test in red when missing (scriptDetail.js's head, from the box: "A script tab shows, right under its title line,
// the name of the script's own test in red when that test is missing on disc", "When the own test is there, nothing shows
// in that place"), and box v143: "all of testicle's elements must subscribe to the data they display, the testicle detail
// included": the own test written while the detail is open, the red name goes by itself.
const LONE = 'spirit/zzDetail/zzLone.js', LONE_OWN = 'spirit/zzDetail/test/zzLone.js';
const own = function (id) { return ev('(function () { var t = document.querySelector("#' + id + ' .testicle-own-missing"); return t ? { text: t.textContent, color: getComputedStyle(t).color } : null; }())'); };
test.run('a script with no own test on disc: right under its title, the own test\'s name in red', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzDetail'), { recursive: true });
  fs.writeFileSync(path.join(run, LONE), "'use strict';\n// zzLone, with no own test\n");
  await H.sleep(3000);
  const m = await ev('window.zz.mount("zzLone", { script: "' + LONE + '" })');
  if (m !== true) return 'mount: ' + short(m);
  const ok = await H.until(function () { return own('zzLone').then(function (o) { return !!o && o.text === LONE_OWN; }); }, H.WAIT);
  const o = await own('zzLone');
  const next = await ev('(function () { var t = document.querySelector("#zzLone .testicle-title"); return t && t.nextElementSibling ? t.nextElementSibling.className : null; }())');
  return (!!ok && /^rgb\(\s*(2[0-9]{2}|1[5-9][0-9]),\s*0,\s*0\)$/.test(o.color) && next === 'testicle-own-missing') || 'under the title: ' + short(o) + ', next to the title ' + short(next);
}, test.limit.slow);
test.run('its own test written while it is open: the red name goes by itself, with no new mount', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  if (!((await own('zzLone')) || {}).text) return 'no red name to go: the test before failed';
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzDetail', 'test'), { recursive: true });
  fs.writeFileSync(path.join(run, LONE_OWN), "'use strict';\n// the own test of zzLone\n");
  const ok = await H.until(function () { return own('zzLone').then(function (o) { return !!o && o.text === ''; }); }, H.WAIT);
  return !!ok || 'still under the title: ' + short(await own('zzLone'));
}, test.limit.slow);
test.run('a script whose own test is on disc: nothing shows in that place', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  await H.sleep(3000);
  const o = await own('zzSpirit');
  return (!!o && o.text === '') || 'under spirit/spirit.js\'s title: ' + short(o);
}, test.limit.slow);
test.run('its box keeps what it holds inside: overflow not visible', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const o = await ev('getComputedStyle(document.querySelector("#zzSpirit .testicle-detail")).overflowY');
  return (o && o !== 'visible') || 'overflow ' + short(o);
}, test.limit.quick);
test.run('destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { window.m_zzSpirit.destroy(); return document.getElementById("zzSpirit").innerHTML; }())');
  return r === '' || 'after destroy: ' + short(r);
}, test.limit.quick);
