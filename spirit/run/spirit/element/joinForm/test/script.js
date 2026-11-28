'use strict';

// spirit/run/spirit/element/joinForm/test/script.js
// The tests of spirit/element/joinForm/script.js, and of no other module (spec: ./script.md; goal/G41.27): its form, a rowForm,
// in its modes. Asked of a real browser, the real rowForm composed: ./joinForm-laid.html, on a scratch node with its
// DEBUG on, mounts the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const H = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

const ADDRESS = '/DEBUG/spirit/element/joinForm/test/joinForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let code, rJoin, rChange, rFixed, f;
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow, { why: 'it starts a scratch node' });
test.run('the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m && !!m.made || false;
}, test.limit.slow, { why: 'it opens the page in Chrome and waits for it' });
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(W.node); } catch (e) { /* left */ }
});
test.run('it loads the rowForm itself', 0.2, function () {
  if (!m) return false;
  // Andy, on G41.27: "joinForm? it has several modes:\n\nsuggestions?", then "wsl, agreed." to wsl's: Join (no seat)
  // [➕] [relay ▾] [email] [Join]; Change (seated) [✏️] [relay ▾] [email] [Change]; fixed (relay details) the same,
  // the dropdown fixed to its one relay; the icon following the mode, as the words do; the words Relay and Your email
  // gone; the title above the bubble, the sent line below.
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  code = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8').replace(/\/\/.*$/gm, '');
  // Since goal/G49.9 (box v5) it keeps requireScript's answer by one helper of its own, keepAnswer(path), which calls
  // spirit.requireScript with it: asking that helper for the path is asking requireScript for it.
  return (/spirit\.requireScript\(\s*['"]spirit\/element\/rowForm\/script\.js['"]/.test(code) ||
    (/function keepAnswer\(p\)[\s\S]*?spirit\.requireScript\(p\)/.test(code) && /keepAnswer\(\s*['"]spirit\/element\/rowForm\/script\.js['"]\s*\)/.test(code))) ? true : false;
}, test.limit.quick);
test.run('with no seat it draws one rowForm, with the icon ➕ and the button Join', 0.2, function () {
  if (!m) return false;
  // Join, no seat
  rJoin = m.join || {};
  return (rJoin.forms === 1 && rJoin.icon === '➕' && rJoin.button === 'Join') ? true : false;
}, test.limit.quick);
test.run('with no seat, its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return false;
  return ((rJoin.span || []).length === 2 && rJoin.span[0].tag === 'SELECT' && rJoin.span[1].tag === 'INPUT' && rJoin.span[1].type === 'email') ? true : false;
}, test.limit.quick);
test.run('with no seat, the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return false;
  return (rJoin.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rJoin.bubbleWords || '')) ? true : false;
}, test.limit.quick);
test.run('with no seat, its title Join a relay stands above the bubble', 0.2, function () {
  if (!m) return false;
  return (rJoin.title === 'Join a relay' && rJoin.titleAbove) ? true : false;
}, test.limit.quick);
test.run('with no seat, its Join is the rowForm\'s button and the only one', 0.2, function () {
  if (!m) return false;
  return (rJoin.adds === 0) ? true : false;
}, test.limit.quick);
test.run('with a seat it draws one rowForm, with the icon ✏️ and the button Change', 0.2, function () {
  if (!m) return false;
  // Change, a seat (another relay picked)
  rChange = m.change || {};
  return (rChange.forms === 1 && rChange.icon === '✏️' && rChange.button === 'Change') ? true : false;
}, test.limit.quick);
test.run('with a seat, its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return false;
  return ((rChange.span || []).length === 2 && rChange.span[0].tag === 'SELECT' && rChange.span[1].tag === 'INPUT' && rChange.span[1].type === 'email') ? true : false;
}, test.limit.quick);
test.run('with a seat, the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return false;
  return (rChange.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rChange.bubbleWords || '')) ? true : false;
}, test.limit.quick);
test.run('with a seat, its title Change email address stands above the bubble', 0.2, function () {
  if (!m) return false;
  return (rChange.title === 'Change email address' && rChange.titleAbove) ? true : false;
}, test.limit.quick);
test.run('with a seat, its Change is the rowForm\'s button and the only one', 0.2, function () {
  if (!m) return false;
  return (rChange.adds === 0) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, it draws one rowForm, with the icon ✏️ and the button Change', 0.2, function () {
  if (!m) return false;
  // fixed to its one relay
  rFixed = m.fixed || {};
  return (rFixed.forms === 1 && rFixed.icon === '✏️' && rFixed.button === 'Change') ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return false;
  return ((rFixed.span || []).length === 2 && rFixed.span[0].tag === 'SELECT' && rFixed.span[1].tag === 'INPUT' && rFixed.span[1].type === 'email') ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return false;
  return (rFixed.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rFixed.bubbleWords || '')) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, its title Change email address stands above the bubble', 0.2, function () {
  if (!m) return false;
  return (rFixed.title === 'Change email address' && rFixed.titleAbove) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, its Change is the rowForm\'s button and the only one', 0.2, function () {
  if (!m) return false;
  return (rFixed.adds === 0) ? true : false;
}, test.limit.quick);
test.run('when fixed, the dropdown holds its one relay and cannot be changed', 0.2, function () {
  if (!m) return false;
  f = (m.fixed && m.fixed.span) || [];
  return (f[0] && f[0].disabled && JSON.stringify(f[0].options) === '["wss://b.example"]') ? true : false;
}, test.limit.quick);
// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": its press is the rowForm's, read
// once the press itself is done, while the relay is still asked.
test.run('pressed with an email, its button stays busy while the relay is asked: disabled, with its turning mark', 0.2, function () {
  if (!m || !m.asking) return false;
  return (m.asking.disabled === true && m.asking.mark === true) ? true : false;
}, test.limit.quick);
test.run('pressed with no email, it says why on a line below the bubble, not in it', 0.2, function () {
  if (!m) return false;
  // a press, and the line below the bubble
  return (!!m.said && m.saidBelow) ? true : false;
}, test.limit.quick);
// ITS JOIN LINK FROM spirit/fuckingGarbage/joinLink/script.js (goal/G49.23, box v21: "joinLink to
// spirit/fuckingGarbage/joinLink/script.js, the join form requiring it by that path"), never off spirit.shell.
test.run('the join form requires spirit/fuckingGarbage/joinLink/script.js and reads no spirit.shell', 0.2, function () {
  const c = fs.readFileSync(path.join(RUN, 'spirit', 'element', 'joinForm', 'script.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (/(?:requireScript|keepAnswer)\(\s*['"]spirit\/fuckingGarbage\/joinLink\/script\.js['"]/.test(c) && !/\bshell\s*\.\s*joinLink|spirit\.shell\b/.test(c)) || false;
}, test.limit.quick);
