'use strict';

// spirit/run/spirit/element/search/app/test/changeAppLabel.js
// The tests of spirit/element/search/app/changeAppLabel.js, and of no other module (spec: ./changeAppLabel.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made;
const NO_WORLD = 'no scratch node or no Chrome: the world failed';
const NOT_LOADED = 'changeAppLabel.js did not load';
const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
const labelOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).label : undefined; };
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("l"); var i = b.querySelector("input"); var btn = b.querySelector("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), input: i ? i.value : null, button: btn ? String(btn.textContent || "").trim() : null }; }())'); };

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
test.run('it loads through spirit.require and is spirit.element.spirit.element.search.app.changeAppLabel', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/changeAppLabel.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.changeAppLabel && spirit.element.spirit.element.search.app.changeAppLabel.create); }, function (e) { return String(e); })');
  return loaded === true ? true : 'it did not load: ' + short(loaded);
}, test.limit.quick);
test.run('create(host, { key }) answers { destroy }', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "l"; document.body.appendChild(b); window.__l = spirit.element.spirit.element.search.app.changeAppLabel.create(b, { key: "agent" }); return !!window.__l && typeof window.__l.destroy === "function"; }())');
  return made === true ? true : 'it made: ' + short(made);
}, test.limit.quick);

// one rowForm: [✏️] "Label" [its label in a box] [Change], as the detail draws it
test.run('one rowForm, its box holding the app\'s label, Agent', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  return (await until(function () { return seen().then(function (v) { return v.forms === 1 && v.input === 'Agent'; }); }, 10000)) ? true : 'drawn: ' + short(await seen());
}, test.limit.quick);
test.run('with ✏️, the word Label, and a Change button', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  const v0 = await seen();
  return /✏/.test(v0.text) && /Label/.test(v0.text) && v0.button === 'Change' ? true : 'drawn: ' + short(v0);
}, test.limit.quick);

// the box: "writing through the app family's labelApp"
test.run('Change writes the new label, and the app\'s row says it', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  await chrome.evaluate('(function () { var i = document.querySelector("#l input"); i.value = "Zz Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#l button").click(); return 1; }())');
  return (await until(function () { return labelOf('agent').then(function (l) { return l === 'Zz Renamed'; }); }, 10000)) ? true : 'the row: ' + short(await labelOf('agent'));
}, test.limit.quick);

// a label changed elsewhere shows, with no reload
test.run('its box follows the row', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  await chrome.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1');
  await ask('app.label', { key: 'agent', label: 'Zz From Elsewhere' });
  return (await until(function () { return seen().then(function (v) { return v.input === 'Zz From Elsewhere'; }); }, 10000)) ? true : 'drawn: ' + short(await seen());
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  const empty = await chrome.evaluate('(function () { window.__l.destroy(); return document.getElementById("l").children.length === 0; }())');
  return empty === true ? true : 'destroy left ' + short(await seen());
}, test.limit.quick);
