'use strict';

// spirit/run/spirit/element/search/app/test/changeAppIcon.js
// The tests of spirit/element/search/app/changeAppIcon.js, and of no other module (spec: ./changeAppIcon.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made, v0, glyph, key;
const NO_WORLD = 'no scratch node or no Chrome: the world failed';
const NOT_LOADED = 'changeAppIcon.js did not load';
const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
const iconOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).icon : undefined; };
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("i"); var bs = b.querySelectorAll("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), last: bs.length ? String(bs[bs.length - 1].textContent || "").trim() : null }; }())'); };

test.after(function () {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require('fs').rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

test.run('the world: a scratch node, and a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : 'the face page never had spirit.ready';
}, 6000);
test.run('it loads through spirit.require and is spirit.element.spirit.element.search.app.changeAppIcon', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/changeAppIcon.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.changeAppIcon && spirit.element.spirit.element.search.app.changeAppIcon.create); }, function (e) { return String(e); })');
  return loaded === true ? true : 'it did not load: ' + short(loaded);
}, 1000);
test.run('create(host, { key }) answers { destroy }', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "i"; document.body.appendChild(b); window.__i = spirit.element.spirit.element.search.app.changeAppIcon.create(b, { key: "agent" }); return !!window.__i && typeof window.__i.destroy === "function"; }())');
  return made === true ? true : 'it made: ' + short(made);
}, 1000);

// one rowForm: [✏️] "Icon" [the app's icon] [iconSelector:dropdown] [Change], as the detail draws it
test.run('a rowForm showing the app\'s icon, 🤖', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  return (await until(function () { return seen().then(function (v) { return v.forms >= 1 && v.text.indexOf('🤖') !== -1; }); }, 10000)) ? true : 'drawn: ' + short(await seen());
}, 1000);
test.run('with ✏️, the word Icon, the icon dropdown and a Change button', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  v0 = await seen();
  return /✏/.test(v0.text) && /Icon/.test(v0.text) && v0.last === 'Change' && /choose an icon/.test(v0.text) ? true : 'drawn: ' + short(v0);
}, 1000);

// Change with nothing picked changes nothing
test.run('the app\'s icon stays 🤖', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); bs[bs.length - 1].click(); return 1; }())');
  await sleep(1500);
  return (await iconOf('agent')) === '🤖' ? true : 'the row: ' + short(await iconOf('agent'));
}, 5000);

// the box: "writing through the app family's iconApp": a glyph picked, then Change
test.run('the world: the dropdown opens on the icon set', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  // The dropdown's own field opens it; a row of the set picks its glyph.
  await chrome.evaluate('(function () { var f = Array.prototype.filter.call(document.querySelectorAll("#i *"), function (e) { return /choose an icon/.test(e.textContent || "") && !e.children.length; })[0]; if (f) f.click(); return !!f; }())');
  glyph = await until(function () { return chrome.evaluate('(function () { var r = document.querySelector("#i tr[data-key]"); return r ? r.getAttribute("data-key") : ""; }())').then(function (k) { return k && k !== '🤖' ? k : ''; }); }, 8000);
  return !!glyph || 'no row of the icon set to pick';
}, 1000);
test.run('Change writes the picked glyph, and the app\'s row says it', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  key = await chrome.evaluate('(function () { var rows = Array.prototype.filter.call(document.querySelectorAll("#i tr[data-key]"), function (r) { return r.getAttribute("data-key") !== "🤖"; }); if (!rows.length) return ""; rows[0].click(); return rows[0].getAttribute("data-key"); }())');
  await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); bs[bs.length - 1].click(); return 1; }())');
  return !!key && await until(function () { return iconOf('agent').then(function (g) { return g === key; }); }, 10000) ? true : 'picked ' + short(key) + ', the row: ' + short(await iconOf('agent'));
}, 1000);

// an icon changed elsewhere shows, with no reload
test.run('it shows the new icon', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  await ask('app.icon', { key: 'agent', icon: '🧩' });
  return (await until(function () { return seen().then(function (v) { return v.text.indexOf('🧩') !== -1; }); }, 10000)) ? true : 'drawn: ' + short(await seen());
}, 1000);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return NOT_LOADED;
  const empty = await chrome.evaluate('(function () { window.__i.destroy(); return document.getElementById("i").children.length === 0; }())');
  return empty === true ? true : 'destroy left ' + short(await seen());
}, 1000);
