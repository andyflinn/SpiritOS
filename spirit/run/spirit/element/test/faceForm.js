'use strict';

// spirit/run/spirit/element/test/faceForm.js
// The tests of spirit/element/faceForm.js, and of no other module (spec: ./faceForm.md; goal/G41.27): its form, a rowForm.
// Asked of a real browser, the real rowForm composed: ./faceForm-laid.html, on a scratch node with its DEBUG on, mounts
// the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/spirit/element/test/faceForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let code, rPane, rFixed, of, n;
test.run('it loads the rowForm itself (rule/26)', 0.2, function () {
  code = fs.readFileSync(path.join(__dirname, '..', 'faceForm.js'), 'utf8').replace(/\/\/.*$/gm, '');
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  return (/spirit\.require\(\s*['"]spirit\/element\/rowForm\.js['"]/.test(code)) ? true : 'faceForm.js requires no spirit/element/rowForm.js';
}, 1000);
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, 1000);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, 4000);
test.run('the world: the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m && !!m.made || 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
}, 5000);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('one rowForm, its icon ❓ and its button Ask', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // Andy, on G41.27: "faceForm:\n\n[❓] [Relay▾][Face-name-input][Ask-button]".
  // its relays to pick
  rPane = m.pane || {};
  return (rPane.forms === 1 && rPane.icon === '❓' && rPane.button === 'Ask') ? true : 'forms ' + rPane.forms + ', icon ' + short(rPane.icon) + ', button ' + short(rPane.button);
}, 1000);
test.run('its span holds the relay dropdown, then the face name input, and nothing else', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((rPane.span || []).length === 2 && rPane.span[0].tag === 'SELECT' && rPane.span[1].tag === 'INPUT' && rPane.span[1].type === 'text') ? true : 'span: ' + short(rPane.span);
}, 1000);
test.run('the dropdown offers the relays this node is seated on and starred, to pick, and not Delta, seated with no star', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!(rPane.span || [])[0] && JSON.stringify(rPane.span[0].options) === JSON.stringify(['wss://b.example', 'wss://c.example']) && rPane.span[0].disabled === false) ? true : 'dropdown: ' + short((rPane.span || [])[0]);
}, 1000);
test.run('the words Relay and Face name are gone from the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rPane.forms === 1 && !/\bRelay\b|Face name/.test(rPane.bubbleWords || '')) ? true : 'bubble says: ' + short(rPane.bubbleWords);
}, 1000);
test.run('its title, A face name on one relay, stands above the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rPane.titleAbove) ? true : 'title ' + short(rPane.title) + ', above ' + rPane.titleAbove;
}, 1000);
test.run('what this node holds on the relay stands below the bubble, not in it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rPane.holdsBelow) ? true : 'holds ' + short(rPane.holds) + ', below ' + rPane.holdsBelow;
}, 1000);
test.run('its Ask is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rPane.forms === 1 && rPane.others === 0) ? true : 'other Asks: ' + rPane.others;
}, 1000);
test.run('fixed to its one relay: one rowForm, its icon ❓ and its button Ask', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // fixed to its one relay
  rFixed = m.fixed || {};
  return (rFixed.forms === 1 && rFixed.icon === '❓' && rFixed.button === 'Ask') ? true : 'forms ' + rFixed.forms + ', icon ' + short(rFixed.icon) + ', button ' + short(rFixed.button);
}, 1000);
test.run('fixed to its one relay: its span holds the relay dropdown, then the face name input, and nothing else', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((rFixed.span || []).length === 2 && rFixed.span[0].tag === 'SELECT' && rFixed.span[1].tag === 'INPUT' && rFixed.span[1].type === 'text') ? true : 'span: ' + short(rFixed.span);
}, 1000);
test.run('the dropdown holds its one relay, fixed', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!(rFixed.span || [])[0] && JSON.stringify(rFixed.span[0].options) === JSON.stringify(['wss://c.example']) && rFixed.span[0].disabled === true) ? true : 'dropdown: ' + short((rFixed.span || [])[0]);
}, 1000);
test.run('fixed to its one relay: the words Relay and Face name are gone from the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.forms === 1 && !/\bRelay\b|Face name/.test(rFixed.bubbleWords || '')) ? true : 'bubble says: ' + short(rFixed.bubbleWords);
}, 1000);
test.run('fixed to its one relay: its title, A face name on one relay, stands above the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.titleAbove) ? true : 'title ' + short(rFixed.title) + ', above ' + rFixed.titleAbove;
}, 1000);
test.run('fixed to its one relay: what this node holds on the relay stands below the bubble, not in it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.holdsBelow) ? true : 'holds ' + short(rFixed.holds) + ', below ' + rFixed.holdsBelow;
}, 1000);
test.run('fixed to its one relay: its Ask is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (rFixed.forms === 1 && rFixed.others === 0) ? true : 'other Asks: ' + rFixed.others;
}, 1000);
test.run('offers: a seated relay with the star can be offered', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // goal/G43.18: a face only on a starred relay
  // Box v29: "At home, faceForm offers a face only on a starred relay (today it offers only relays not starred, G41.32: that
  // turns round)."
  of = m.offers || {};
  return (of.starred === true) ? true : 'offers of a starred seated relay: ' + short(of.starred);
}, 1000);
test.run('offers: a seated relay without the star cannot', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (of.unstarred === false) ? true : 'offers of a seated relay with no star: ' + short(of.unstarred);
}, 1000);
test.run('with no relay this node is seated on and starred, it draws nothing: Alpha starred with no seat, Delta seated with no star', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // no relay with a seat and a star
  // Andy: "doesn't show up if the user has zero verified emails anywhere" (a seat taken by email is a verified one, goal/G40.11).
  n = m.none || {};
  return (n.forms === 0 && n.text === '' && n.kids === 0) ? true : 'drew: ' + short(n);
}, 1000);
test.run('pressed with no face name, it says so on a line below the bubble, not in it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a press, and the line below the bubble
  // The box: "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
  return (/a face name is needed/.test(m.said || '') && m.saidBelow) ? true : 'said ' + short(m.said) + ', below ' + m.saidBelow;
}, 1000);
