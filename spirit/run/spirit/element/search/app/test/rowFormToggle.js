'use strict';

// spirit/run/spirit/element/search/app/test/rowFormToggle.js
// The tests of spirit/element/search/app/rowFormToggle.js, and of no other module (spec: ./rowFormToggle.md; goal/G43.15). Andy: "it
// acts exactly like the two toggle switches in appSelector:detailElement", "it is configurable with a description of what is being
// toggled." A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded;

test.after(function () {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(require('path').join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up with a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('rowFormToggle loads through spirit.require and is spirit.element.spirit.element.search.app.rowFormToggle', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowFormToggle.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.rowFormToggle && spirit.element.spirit.element.search.app.rowFormToggle.create); }, function () { return false; })');
  return loaded === true ? true : false;
}, test.limit.quick);
let made, off, on;
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("t"); var btn = b.querySelector("button"); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), button: btn ? String(btn.textContent || "").trim() : null, forms: b.querySelectorAll(".shell-row-form").length }; }())'); };
test.run('create, handed a host with on, words and press, answers a toggle with root, set and destroy', 0.2, async function () {
  if (loaded !== true) return false;
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "t"; document.body.appendChild(b); window.__pressed = 0; window.__t = spirit.element.spirit.element.search.app.rowFormToggle.create(b, { on: false, words: "Allow zz as shell", press: function () { window.__pressed += 1; } }); return !!window.__t && !!window.__t.root && typeof window.__t.set === "function" && typeof window.__t.destroy === "function"; }())');
  return made === true ? true : false;
}, test.limit.quick);

// the box: "it acts exactly like the two toggle switches": the state as 🟢 or 🔴, the button the other
test.run('the toggle draws one rowForm with the words it was handed', 0.2, async function () {
  if (made !== true) return false;
  off = await seen();
  return off.forms === 1 && off.text.indexOf('Allow zz as shell') !== -1 ? true : false;
}, test.limit.quick);
test.run('when off, the toggle shows 🔴 and its button shows 🟢', 0.2, function () {
  if (!off) return false;
  return off.text.indexOf('🔴') !== -1 && off.button === '🟢' ? true : false;
}, test.limit.quick);

// a press asks; the state changes only when it is handed one
test.run('a press on the button calls press once', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('document.querySelector("#t button").click(); 1');
  const n = await chrome.evaluate('window.__pressed');
  return n === 1 ? true : false;
}, test.limit.quick);
test.run('after the press the toggle still shows off, because the click is no state', 0.2, async function () {
  if (made !== true) return false;
  const still = await seen();
  return still.button === '🟢' && still.text.indexOf('🔴') !== -1 ? true : false;
}, test.limit.quick);
test.run('set with true and new words makes the toggle show 🟢, its button 🔴, and the new words', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('window.__t.set(true, "Don\'t allow zz as shell"); 1');
  on = await seen();
  return on.text.indexOf('🟢') !== -1 && on.button === '🔴' && on.text.indexOf("Don't allow zz as shell") !== -1 ? true : false;
}, test.limit.quick);
test.run('the redrawn toggle is still one rowForm', 0.2, function () {
  if (!on) return false;
  return on.forms === 1 ? true : false;
}, test.limit.quick);
test.run('a press on the redrawn button calls press again', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('document.querySelector("#t button").click(); 1');
  const n = await chrome.evaluate('window.__pressed');
  return n === 2 ? true : false;
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return false;
  const empty = await chrome.evaluate('(function () { window.__t.destroy(); return document.getElementById("t").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.quick);
