'use strict';

// spirit/run/spirit/element/test/joinForm.js
// The tests of spirit/element/joinForm.js, and of no other module (spec: ./joinForm.md; goal/G41.27): its form, a rowForm,
// in its modes. Asked of a real browser, the real rowForm composed: ./joinForm-laid.html, on a scratch node with its
// DEBUG on, mounts the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/spirit/element/test/joinForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let code, rJoin, rChange, rFixed, f;
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, 1000);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, 5000);
test.run('the world: the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m && !!m.made || 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
}, 6000);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // Andy, on G41.27: "joinForm? it has several modes:\n\nsuggestions?", then "wsl, agreed." to wsl's: Join (no seat)
  // [➕] [relay ▾] [email] [Join]; Change (seated) [✏️] [relay ▾] [email] [Change]; fixed (relay details) the same,
  // the dropdown fixed to its one relay; the icon following the mode, as the words do; the words Relay and Your email
  // gone; the title above the bubble, the sent line below.
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  code = fs.readFileSync(path.join(__dirname, '..', 'joinForm.js'), 'utf8').replace(/\/\/.*$/gm, '');
  return (/spirit\.require\(\s*['"]spirit\/element\/rowForm\.js['"]/.test(code)) ? true : 'joinForm.js requires no spirit/element/rowForm.js';
}, 1000);
test.run('with no seat: one rowForm, its icon ➕ and its button Join', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // Join, no seat
  rJoin = m.join || {};
  return (rJoin.forms === 1 && rJoin.icon === '➕' && rJoin.button === 'Join') ? true : 'forms ' + rJoin.forms + ', icon ' + short(rJoin.icon) + ', button ' + short(rJoin.button);
}, 1000);
test.run('its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((rJoin.span || []).length === 2 && rJoin.span[0].tag === 'SELECT' && rJoin.span[1].tag === 'INPUT' && rJoin.span[1].type === 'email') ? true : 'span: ' + short(rJoin.span);
}, 1000);
test.run('the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rJoin.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rJoin.bubbleWords || '')) ? true : 'bubble says: ' + short(rJoin.bubbleWords);
}, 1000);
test.run('with no seat: its title, Join a relay, stands above the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rJoin.title === 'Join a relay' && rJoin.titleAbove) ? true : 'title ' + short(rJoin.title) + ', above ' + rJoin.titleAbove;
}, 1000);
test.run('with no seat: its Join is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rJoin.adds === 0) ? true : 'other buttons: ' + rJoin.adds;
}, 1000);
test.run('with a seat: one rowForm, its icon ✏️ and its button Change', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // Change, a seat (another relay picked)
  rChange = m.change || {};
  return (rChange.forms === 1 && rChange.icon === '✏️' && rChange.button === 'Change') ? true : 'forms ' + rChange.forms + ', icon ' + short(rChange.icon) + ', button ' + short(rChange.button);
}, 1000);
test.run('with a seat: its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((rChange.span || []).length === 2 && rChange.span[0].tag === 'SELECT' && rChange.span[1].tag === 'INPUT' && rChange.span[1].type === 'email') ? true : 'span: ' + short(rChange.span);
}, 1000);
test.run('with a seat: the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rChange.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rChange.bubbleWords || '')) ? true : 'bubble says: ' + short(rChange.bubbleWords);
}, 1000);
test.run('with a seat: its title, Change email address, stands above the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rChange.title === 'Change email address' && rChange.titleAbove) ? true : 'title ' + short(rChange.title) + ', above ' + rChange.titleAbove;
}, 1000);
test.run('with a seat: its Change is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rChange.adds === 0) ? true : 'other buttons: ' + rChange.adds;
}, 1000);
test.run('fixed to its one relay: one rowForm, its icon ✏️ and its button Change', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // fixed to its one relay
  rFixed = m.fixed || {};
  return (rFixed.forms === 1 && rFixed.icon === '✏️' && rFixed.button === 'Change') ? true : 'forms ' + rFixed.forms + ', icon ' + short(rFixed.icon) + ', button ' + short(rFixed.button);
}, 1000);
test.run('fixed to its one relay: its span holds the relay dropdown, then the email input, and nothing else', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((rFixed.span || []).length === 2 && rFixed.span[0].tag === 'SELECT' && rFixed.span[1].tag === 'INPUT' && rFixed.span[1].type === 'email') ? true : 'span: ' + short(rFixed.span);
}, 1000);
test.run('fixed to its one relay: the words Relay and Your email are gone from the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.forms === 1 && !/\bRelay\b|Your email|Email address/.test(rFixed.bubbleWords || '')) ? true : 'bubble says: ' + short(rFixed.bubbleWords);
}, 1000);
test.run('fixed to its one relay: its title, Change email address, stands above the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.title === 'Change email address' && rFixed.titleAbove) ? true : 'title ' + short(rFixed.title) + ', above ' + rFixed.titleAbove;
}, 1000);
test.run('fixed to its one relay: its Change is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.adds === 0) ? true : 'other buttons: ' + rFixed.adds;
}, 1000);
test.run('fixed: the dropdown holds its one relay and is fixed', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  f = (m.fixed && m.fixed.span) || [];
  return (f[0] && f[0].disabled && JSON.stringify(f[0].options) === '["wss://b.example"]') ? true : 'dropdown: ' + short(f[0]);
}, 1000);
test.run('pressed with no email, it says why on a line below the bubble, not in it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a press, and the line below the bubble
  return (!!m.said && m.saidBelow) ? true : 'said ' + short(m.said) + ', below ' + m.saidBelow;
}, 1000);
