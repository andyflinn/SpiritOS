'use strict';

// spirit/run/spirit/element/search/app/changeAppIcon/test/script.js
// The tests of spirit/element/search/app/changeAppIcon/script.js, and of no other module (spec: ./script.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until, sleep } = LOADER.requireScript('spirit/test/headLessChrome.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made, v0, glyph, key, busyAt;
const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
const iconOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).icon : undefined; };
const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("i"); var bs = b.querySelectorAll("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), last: bs.length ? String(bs[bs.length - 1].textContent || "").trim() : null }; }())'); };

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
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript and is spirit.required.spirit.element.search.app.changeAppIcon', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/app/changeAppIcon/script.js"); }).then(function () { return !!(spirit.required.spirit.element.search.app.changeAppIcon && spirit.required.spirit.element.search.app.changeAppIcon.create); }, function () { return false; })');
  return loaded === true ? true : false;
}, test.limit.quick);
test.run('create, given a host and an app\'s key, answers an object with a destroy', 0.2, async function () {
  if (loaded !== true) return false;
  made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "i"; document.body.appendChild(b); window.__i = spirit.required.spirit.element.search.app.changeAppIcon.create(b, { key: "agent" }); return !!window.__i && typeof window.__i.destroy === "function"; }())');
  return made === true ? true : false;
}, test.limit.quick);

// one rowForm: [✏️] "Icon" [the app's icon] [iconSelector:dropdown] [Change], as the detail draws it
test.run('it draws a rowForm showing the app\'s icon, 🤖', 0.2, async function () {
  if (made !== true) return false;
  return (await until(function () { return seen().then(function (v) { return v.forms >= 1 && v.text.indexOf('🤖') !== -1; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the rowForm has ✏️, the word Icon, the icon dropdown and a Change button', 0.2, async function () {
  if (made !== true) return false;
  v0 = await seen();
  return /✏/.test(v0.text) && /Icon/.test(v0.text) && v0.last === 'Change' && /choose an icon/.test(v0.text) ? true : false;
}, test.limit.quick);

// Change with nothing picked changes nothing
test.run('the app\'s icon stays 🤖', 0.2, async function () {
  if (made !== true) return false;
  await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); bs[bs.length - 1].click(); return 1; }())');
  await sleep(1500);
  return (await iconOf('agent')) === '🤖' ? true : false;
}, test.limit.slow);

// the box: "writing through the app family's iconApp": a glyph picked, then Change
test.run('the dropdown opens on the icon set', 0.2, async function () {
  if (made !== true) return false;
  // The dropdown's own field opens it; a row of the set picks its glyph.
  await chrome.evaluate('(function () { var f = Array.prototype.filter.call(document.querySelectorAll("#i *"), function (e) { return /choose an icon/.test(e.textContent || "") && !e.children.length; })[0]; if (f) f.click(); return !!f; }())');
  glyph = await until(function () { return chrome.evaluate('(function () { var r = document.querySelector("#i tr[data-key]"); return r ? r.getAttribute("data-key") : ""; }())').then(function (k) { return k && k !== '🤖' ? k : ''; }); }, 8000);
  return !!glyph || false;
}, test.limit.quick);
test.run('Change writes the picked glyph, and the app\'s row says it', 0.2, async function () {
  if (made !== true) return false;
  key = await chrome.evaluate('(function () { var rows = Array.prototype.filter.call(document.querySelectorAll("#i tr[data-key]"), function (r) { return r.getAttribute("data-key") !== "🤖"; }); if (!rows.length) return ""; rows[0].click(); return rows[0].getAttribute("data-key"); }())');
  try { busyAt = JSON.parse(await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); var b = bs[bs.length - 1]; b.click(); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); }); }())')); } catch (e) { busyAt = null; }
  return !!key && await until(function () { return iconOf('agent').then(function (g) { return g === key; }); }, 10000) ? true : false;
}, test.limit.quick);

// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": read once the press itself is
// done, while the node is still asked.
test.run('pressed with a glyph picked, Change stays busy while the node is asked: disabled, with its turning mark', 0.2, function () {
  if (!busyAt) return false;
  return busyAt.disabled === true && busyAt.mark === true ? true : false;
}, test.limit.quick);

// an icon changed elsewhere shows, with no reload
test.run('it shows the new icon', 0.2, async function () {
  if (made !== true) return false;
  await ask('app.icon', { key: 'agent', icon: '🧩' });
  return (await until(function () { return seen().then(function (v) { return v.text.indexOf('🧩') !== -1; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return false;
  const empty = await chrome.evaluate('(function () { window.__i.destroy(); return document.getElementById("i").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.quick);
