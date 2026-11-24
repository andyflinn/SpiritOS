'use strict';

// spirit/run/spirit/element/faceForm/test/script.js
// The tests of spirit/element/faceForm/script.js, and of no other module (spec: ./script.md; goal/G41.27): its form, a rowForm.
// Asked of a real browser, the real rowForm composed: ./faceForm-laid.html, on a scratch node with its DEBUG on, mounts
// the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');

const ADDRESS = '/DEBUG/spirit/element/faceForm/test/faceForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let code, rPane, rFixed, of, n;
test.run('it loads the rowForm itself', 0.2, function () {
  code = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8').replace(/\/\/.*$/gm, '');
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  // Since goal/G49.9 (box v5) it keeps requireScript's answer by one helper of its own, keepAnswer(path), which calls
  // spirit.requireScript with it: asking that helper for the path is asking requireScript for it.
  return (/spirit\.requireScript\(\s*['"]spirit\/element\/rowForm\/script\.js['"]/.test(code) ||
    (/function keepAnswer\(p\)[\s\S]*?spirit\.requireScript\(p\)/.test(code) && /keepAnswer\(\s*['"]spirit\/element\/rowForm\/script\.js['"]\s*\)/.test(code))) ? true : false;
}, test.limit.quick);
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m && !!m.made || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(W.node); } catch (e) { /* left */ }
});
test.run('it draws one rowForm, with its icon ❓ and its button Ask', 0.2, function () {
  if (!m) return false;
  // Andy, on G41.27: "faceForm:\n\n[❓] [Relay▾][Face-name-input][Ask-button]".
  // its relays to pick
  rPane = m.pane || {};
  return (rPane.forms === 1 && rPane.icon === '❓' && rPane.button === 'Ask') ? true : false;
}, test.limit.quick);
test.run('its span holds the relay dropdown, then the face name input, and nothing else', 0.2, function () {
  if (!m) return false;
  return ((rPane.span || []).length === 2 && rPane.span[0].tag === 'SELECT' && rPane.span[1].tag === 'INPUT' && rPane.span[1].type === 'text') ? true : false;
}, test.limit.quick);
test.run('the dropdown offers the relays this node is seated on and faceable, to pick, and not Delta, seated and not faceable', 0.2, function () {
  if (!m) return false;
  return (!!(rPane.span || [])[0] && JSON.stringify(rPane.span[0].options) === JSON.stringify(['wss://b.example', 'wss://c.example']) && rPane.span[0].disabled === false) ? true : false;
}, test.limit.quick);
test.run('the words Relay and Face name are gone from the bubble', 0.2, function () {
  if (!m) return false;
  return (rPane.forms === 1 && !/\bRelay\b|Face name/.test(rPane.bubbleWords || '')) ? true : false;
}, test.limit.quick);
test.run('its title, A face name on one relay, stands above the bubble', 0.2, function () {
  if (!m) return false;
  return (rPane.titleAbove) ? true : false;
}, test.limit.quick);
test.run('what this node holds on the relay stands below the bubble, not in it', 0.2, function () {
  if (!m) return false;
  return (rPane.holdsBelow) ? true : false;
}, test.limit.quick);
test.run('its Ask is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return false;
  return (rPane.forms === 1 && rPane.others === 0) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay, it draws one rowForm, with its icon ❓ and its button Ask', 0.2, function () {
  if (!m) return false;
  // fixed to its one relay
  rFixed = m.fixed || {};
  return (rFixed.forms === 1 && rFixed.icon === '❓' && rFixed.button === 'Ask') ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay: its span holds the relay dropdown, then the face name input, and nothing else', 0.2, function () {
  if (!m) return false;
  return ((rFixed.span || []).length === 2 && rFixed.span[0].tag === 'SELECT' && rFixed.span[1].tag === 'INPUT' && rFixed.span[1].type === 'text') ? true : false;
}, test.limit.quick);
test.run('the dropdown holds its one relay, fixed', 0.2, function () {
  if (!m) return false;
  return (!!(rFixed.span || [])[0] && JSON.stringify(rFixed.span[0].options) === JSON.stringify(['wss://c.example']) && rFixed.span[0].disabled === true) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay: the words Relay and Face name are gone from the bubble', 0.2, function () {
  if (!m) return false;
  return (rFixed.forms === 1 && !/\bRelay\b|Face name/.test(rFixed.bubbleWords || '')) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay: its title, A face name on one relay, stands above the bubble', 0.2, function () {
  if (!m) return false;
  return (rFixed.titleAbove) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay: what this node holds on the relay stands below the bubble, not in it', 0.2, function () {
  if (!m) return false;
  return (rFixed.holdsBelow) ? true : false;
}, test.limit.quick);
test.run('fixed to its one relay: its Ask is the rowForm\'s button, the only one', 0.2, function () {
  if (!m) return false;
  return (rFixed.forms === 1 && rFixed.others === 0) ? true : false;
}, test.limit.quick);
test.run('offers says a seated faceable relay can be offered', 0.2, function () {
  if (!m) return false;
  // goal/G47.4, box v33: 😏 faceable "is what opens the face and the face forms" (it was the star, goal/G43.18).
  of = m.offers || {};
  return (of.faceable === true) ? true : false;
}, test.limit.quick);
test.run('offers says a seated relay that is not faceable cannot be offered', 0.2, function () {
  if (!m) return false;
  return (of.notFaceable === false) ? true : false;
}, test.limit.quick);
test.run('with no relay this node is seated on and faceable, it draws nothing: Alpha faceable with no seat, Delta seated and not faceable', 0.2, function () {
  if (!m) return false;
  // no relay with a seat that is faceable
  // Andy: "doesn't show up if the user has zero verified emails anywhere" (a seat taken by email is a verified one, goal/G40.11).
  n = m.none || {};
  return (n.forms === 0 && n.text === '' && n.kids === 0) ? true : false;
}, test.limit.quick);
// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": Ask is the rowForm's press, read
// once the press itself is done, while the relay is still asked.
test.run('pressed with a face name, Ask stays busy while the relay is asked: disabled, with its turning mark', 0.2, function () {
  if (!m || !m.asking) return false;
  return (m.asking.disabled === true && m.asking.mark === true) ? true : false;
}, test.limit.quick);
test.run('pressed with no face name, it says so on a line below the bubble, not in it', 0.2, function () {
  if (!m) return false;
  // a press, and the line below the bubble
  // The box: "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
  return (/a face name is needed/.test(m.said || '') && m.saidBelow) ? true : false;
}, test.limit.quick);
