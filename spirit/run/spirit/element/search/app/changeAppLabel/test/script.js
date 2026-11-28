'use strict';

// spirit/run/spirit/element/search/app/changeAppLabel/test/script.js
// The tests of spirit/element/search/app/changeAppLabel/script.js, and of no other module (spec: ./script.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made, busyAt;
// The Agent's key is its id, its folder's path in dots (goal/G49.19).
const AGENT = 'spirit.app.agent';
const ask = async function (verb, args) { const r = await fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
const labelOf = async function (k) { const got = await ask('spirit.app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).label : undefined; };
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("l"); var i = b.querySelector("input"); var btn = b.querySelector("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), input: i ? i.value : null, button: btn ? String(btn.textContent || "").trim() : null }; }())'); };

test.after(function () {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(require('path').join(RUN, 'spirit', 'testicle', 'headLessChrome', 'script.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up, with a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript and is spirit.element.search.app.changeAppLabel', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/app/changeAppLabel/script.js"); }).then(function () { return !!(spirit.element.search.app.changeAppLabel && spirit.element.search.app.changeAppLabel.create); }, function () { return false; })');
  return loaded === true ? true : false;
}, test.limit.quick);
test.run('create, given a host and an app\'s key, answers an object with destroy', 0.2, async function () {
  if (loaded !== true) return false;
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "l"; document.body.appendChild(b); window.__l = spirit.element.search.app.changeAppLabel.create(b, { key: "spirit.app.agent" }); return !!window.__l && typeof window.__l.destroy === "function"; }())');
  return made === true ? true : false;
}, test.limit.quick);

// one rowForm: [✏️] "Label" [its label in a box] [Change], as the detail draws it
test.run('it draws one row form, whose box holds the app\'s label, Agent', 0.2, async function () {
  if (made !== true) return false;
  return (await until(function () { return seen().then(function (v) { return v.forms === 1 && v.input === 'Agent'; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the row form shows ✏️, the word Label, and a Change button', 0.2, async function () {
  if (made !== true) return false;
  const v0 = await seen();
  return /✏/.test(v0.text) && /Label/.test(v0.text) && v0.button === 'Change' ? true : false;
}, test.limit.quick);

// the box: "writing through the app family's labelApp"
test.run('Change writes the new label, and the app\'s row says it', 0.2, async function () {
  if (made !== true) return false;
  try { busyAt = JSON.parse(await chrome.evaluate('(function () { var i = document.querySelector("#l input"); i.value = "Zz Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); var b = document.querySelector("#l button"); b.click(); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); }); }())')); } catch (e) { busyAt = null; }
  return (await until(function () { return labelOf(AGENT).then(function (l) { return l === 'Zz Renamed'; }); }, 10000)) ? true : false;
}, test.limit.quick);

// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": read once the press itself is
// done, while the node is still asked.
test.run('pressed, Change stays busy while the node is asked: disabled, with its turning mark', 0.2, function () {
  if (!busyAt) return false;
  return busyAt.disabled === true && busyAt.mark === true ? true : false;
}, test.limit.quick);

// a label changed elsewhere shows, with no reload
test.run('its box follows the row', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1');
  await ask('spirit.app.label', { key: AGENT, label: 'Zz From Elsewhere' });
  return (await until(function () { return seen().then(function (v) { return v.input === 'Zz From Elsewhere'; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return false;
  const empty = await chrome.evaluate('(function () { window.__l.destroy(); return document.getElementById("l").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.quick);
