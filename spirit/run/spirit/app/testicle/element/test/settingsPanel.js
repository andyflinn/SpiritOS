'use strict';
// spirit/run/spirit/app/testicle/element/test/settingsPanel.js
// The tests of spirit/app/testicle/element/settingsPanel.js, and of no other module (goal/G47.1, box v134-135). Asked of a
// real browser: a scratch node with its DEBUG on and testicle turned on, a Chrome page on the element's DEBUG page, the panel
// mounted in a box of its own; its switch pressed both ways, and the preference read back from the node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REL = 'spirit/app/testicle/element/settingsPanel.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const W = {};
const ev = function (expr) { return W.page.evaluate(expr).catch(function (e) { return 'threw: ' + (e && e.message || e); }); };
const ask = function (verb, args) {
  return fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) })
    .then(function (r) { return r.json(); }, function () { return null; });
};
const HANDS = '(function () { window.zz = {' +
  ' mount: function () { var b = document.createElement("div"); b.id = "zzP"; b.style.cssText = "width:400px;height:300px"; document.body.appendChild(b); window.m_zzP = window.spirit.element.spirit.app.testicle.element.settingsPanel.create(b); return true; },' +
  ' text: function () { var b = document.getElementById("zzP"); return b ? String(b.innerText || "").trim() : null; },' +
  ' press: function () { var b = document.querySelector("#zzP .testicle-config-form button, #zzP .testicle-config-form input"); if (!b) return false; b.click(); return true; },' +
  '}; return true; }())';
const interactive = function (r) { const p = r && (r.preferences || r); return p && typeof p.interactive === 'boolean' ? p.interactive : null; };

test.run('spirit/app/testicle/element/settingsPanel.js exists', 0.2, function () {
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
test.run('the world: a page loads the element by itself, and the panel is mounted', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.testicle && window.spirit.element.spirit.app.testicle.element.settingsPanel)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) { await ev(HANDS); await ev('window.zz.mount()'); }
  return !!W.ok || 'the element never stood on the page';
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W.node); } catch (e) { /* left */ }
});
const NOPAGE = 'no page: the world failed';

test.run('its title is "⚙ Configuration"', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const t = await ev('window.zz.text()');
  return /^⚙ Configuration/.test(String(t)) || 'it shows ' + short(t);
}, test.limit.quick);
test.run('its switch shows the node\'s preference: interactive at the start', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  const ok = await H.until(function () { return ev('window.zz.text()').then(function (t) { return /interactive/.test(String(t)); }); }, H.WAIT);
  return !!ok || 'it shows ' + short(await ev('window.zz.text()'));
}, test.limit.slow);
test.run('a press sends the other mode: the node is auto, and the switch follows the stream', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  if (!(await ev('window.zz.press()'))) return 'no switch to press: ' + short(await ev('window.zz.text()'));
  const node = await H.until(function () { return ask('testicle.preferences', {}).then(function (r) { return interactive(r) === false; }); }, H.WAIT);
  const shown = await H.until(function () { return ev('window.zz.text()').then(function (t) { return /auto/.test(String(t)); }); }, H.WAIT);
  return (!!node && !!shown) || 'node ' + short(await ask('testicle.preferences', {})) + '; it shows ' + short(await ev('window.zz.text()'));
}, test.limit.slow);
test.run('a second press sends interactive back', 0.4, async function () {
  if (!W.ok) return NOPAGE;
  if (!(await ev('window.zz.press()'))) return 'no switch to press';
  const node = await H.until(function () { return ask('testicle.preferences', {}).then(function (r) { return interactive(r) === true; }); }, H.WAIT);
  return !!node || 'node ' + short(await ask('testicle.preferences', {}));
}, test.limit.slow);
test.run('its box keeps what it holds inside: overflow not visible', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const o = await ev('getComputedStyle(document.querySelector("#zzP .testicle-config")).overflowY');
  return (o && o !== 'visible') || 'overflow ' + short(o);
}, test.limit.quick);
test.run('destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return NOPAGE;
  const r = await ev('(function () { window.m_zzP.destroy(); return document.getElementById("zzP").innerHTML; }())');
  return r === '' || 'after destroy: ' + short(r);
}, test.limit.quick);
