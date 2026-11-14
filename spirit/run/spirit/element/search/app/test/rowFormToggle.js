'use strict';

// spirit/run/spirit/element/search/app/test/rowFormToggle.js
// The tests of spirit/element/search/app/rowFormToggle.js, and of no other module (spec: ./rowFormToggle.md; goal/G43.15). Andy: "it
// acts exactly like the two toggle switches in appSelector:detailElement", "it is configurable with a description of what is being
// toggled." A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded;
const NO_WORLD = 'no scratch node or no Chrome: the world failed';

test.after(function () {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(require('path').join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('the world: a scratch node, and a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : 'the face page never had spirit.ready';
}, test.limit.slow);
test.run('it loads through spirit.require and is spirit.element.spirit.element.search.app.rowFormToggle', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowFormToggle.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.rowFormToggle && spirit.element.spirit.element.search.app.rowFormToggle.create); }, function (e) { return String(e); })');
  return loaded === true ? true : 'it did not load: ' + short(loaded);
}, test.limit.quick);
const NOT_MADE = 'no toggle was made';
let made, off, on;
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("t"); var btn = b.querySelector("button"); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), button: btn ? String(btn.textContent || "").trim() : null, forms: b.querySelectorAll(".shell-row-form").length }; }())'); };
test.run('create(host, { on, words, press }) answers { root, set, destroy }', 0.2, async function () {
  if (loaded !== true) return 'rowFormToggle.js did not load';
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "t"; document.body.appendChild(b); window.__pressed = 0; window.__t = spirit.element.spirit.element.search.app.rowFormToggle.create(b, { on: false, words: "Allow zz as shell", press: function () { window.__pressed += 1; } }); return !!window.__t && !!window.__t.root && typeof window.__t.set === "function" && typeof window.__t.destroy === "function"; }())');
  return made === true ? true : 'it made: ' + short(made);
}, test.limit.quick);

// the box: "it acts exactly like the two toggle switches": the state as 🟢 or 🔴, the button the other
test.run('one rowForm, with the words it was handed', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  off = await seen();
  return off.forms === 1 && off.text.indexOf('Allow zz as shell') !== -1 ? true : 'drawn: ' + short(off);
}, test.limit.quick);
test.run('off: it shows 🔴, its button 🟢', 0.2, function () {
  if (!off) return NOT_MADE;
  return off.text.indexOf('🔴') !== -1 && off.button === '🟢' ? true : 'off: ' + short(off);
}, test.limit.quick);

// a press asks; the state changes only when it is handed one
test.run('a press calls press, once', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  await chrome.evaluate('document.querySelector("#t button").click(); 1');
  const n = await chrome.evaluate('window.__pressed');
  return n === 1 ? true : 'pressed ' + short(n) + ' times';
}, test.limit.quick);
test.run('and it still shows off: the click is no state', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  const still = await seen();
  return still.button === '🟢' && still.text.indexOf('🔴') !== -1 ? true : 'after the press: ' + short(still);
}, test.limit.quick);
test.run('set(true, words): it shows 🟢, its button 🔴, and the new words', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  await chrome.evaluate('window.__t.set(true, "Don\'t allow zz as shell"); 1');
  on = await seen();
  return on.text.indexOf('🟢') !== -1 && on.button === '🔴' && on.text.indexOf("Don't allow zz as shell") !== -1 ? true : 'on: ' + short(on);
}, test.limit.quick);
test.run('still one rowForm', 0.2, function () {
  if (!on) return NOT_MADE;
  return on.forms === 1 ? true : 'forms: ' + short(on.forms);
}, test.limit.quick);
test.run('a press on the redrawn button calls press again', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  await chrome.evaluate('document.querySelector("#t button").click(); 1');
  const n = await chrome.evaluate('window.__pressed');
  return n === 2 ? true : 'pressed ' + short(n) + ' times';
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return NOT_MADE;
  const empty = await chrome.evaluate('(function () { window.__t.destroy(); return document.getElementById("t").children.length === 0; }())');
  return empty === true ? true : 'destroy left ' + short(await seen());
}, test.limit.quick);
