'use strict';

// spirit/run/spirit/element/search/app/test/rowFormAppActive.js
// The tests of spirit/element/search/app/rowFormAppActive.js, and of no other module (spec: ./rowFormAppActive.md; goal/G43.15). Andy:
// "the "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element
// can forget to hide it....". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded;

test.after(function () {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(require('path').join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up, and Chrome opens its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads through spirit.require and is placed on spirit.element at its path', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowFormAppActive.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.rowFormAppActive && spirit.element.spirit.element.search.app.rowFormAppActive.create); }, function () { return false; })');
  return loaded === true ? true : false;
}, test.limit.quick);
const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
const activeOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).active : undefined; };
const make = function (key) { return chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "a-' + key + '"; document.body.appendChild(b); window["a_' + key + '"] = spirit.element.spirit.element.search.app.rowFormAppActive.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["a_' + key + '"] && typeof window["a_' + key + '"].destroy === "function"; }())'); };
const view = function (key) { return chrome.evaluate('(function () { var b = document.getElementById("a-' + key + '"); var r = b.getBoundingClientRect(); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), height: r.height }; }())'); };
// Each row of the pane, its text and the button it holds.
const rows = function () { return chrome.evaluate('(function () { var out = {}; Array.prototype.slice.call(document.querySelectorAll("#pane tr, #pane [data-key]")).forEach(function (r) { var t = String(r.innerText || "").replace(/\\s+/g, " ").trim(); ["Contacts", "Agent"].forEach(function (n) { if (t.indexOf(n) !== -1 && !out[n]) out[n] = { text: t, forms: r.querySelectorAll(".shell-row-form").length, installers: r.querySelectorAll("button.app-installer").length, buttons: Array.prototype.map.call(r.querySelectorAll("button"), function (x) { return String(x.textContent || "").trim(); }) }; }); }); return out; }())'); };
let madeContact, listed, r;

// the box: "hidden when the app is intrinsic"
test.run('create, handed a host and a key, answers an object with destroy', 0.2, async function () {
  if (loaded !== true) return false;
  madeContact = await make('contact');
  return madeContact === true || false;
}, test.limit.quick);
test.run('for Contacts, intrinsic, it shows nothing and takes no space', 0.2, async function () {
  if (loaded !== true) return false;
  await sleep(2000);
  const c0 = await view('contact');
  return c0.text === '' && c0.height === 0 ? true : false;
}, test.limit.slow);

// for an app that is not intrinsic: Activate, then Deactivate
test.run('for the Agent, off, it says Activate and the app\'s label', 0.2, async function () {
  if (loaded !== true) return false;
  await make('agent');
  return (await until(function () { return view('agent').then(function (v) { return /Activate/.test(v.text) && !/Deactivate/.test(v.text) && v.text.indexOf('Agent') !== -1; }); }, 10000)) ? true : false;
}, test.limit.quick);
let busyAt = null;
test.run('pressed, the Agent is active', 0.2, async function () {
  if (loaded !== true) return false;
  try { busyAt = JSON.parse(await chrome.evaluate('(function () { var b = document.querySelector("#a-agent button"); b.click(); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); }); }())')); } catch (e) { busyAt = null; }
  return (await until(function () { return activeOf('agent').then(function (a) { return a === true; }); }, 10000)) ? true : false;
}, test.limit.quick);
// goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer comes": read once the press itself is
// done, while the node is still asked.
test.run('pressed, its button stays busy while the node is asked: disabled, with its turning mark', 0.2, function () {
  if (!busyAt) return false;
  return busyAt.disabled === true && busyAt.mark === true ? true : false;
}, test.limit.quick);
test.run('once the Agent is active it says Deactivate', 0.2, async function () {
  if (loaded !== true) return false;
  return (await until(function () { return view('agent').then(function (v) { return /Deactivate/.test(v.text); }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('pressed again, the Agent is no longer active', 0.2, async function () {
  if (loaded !== true) return false;
  await chrome.evaluate('document.querySelector("#a-agent button").click(); 1');
  return (await until(function () { return activeOf('agent').then(function (a) { return a === false; }); }, 10000)) ? true : false;
}, test.limit.quick);

// the box: "The appSelector's detail and its rows use them": no Activate on an intrinsic app's row
test.run('the appSelector\'s pane is made', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  listed = await chrome.evaluate('spirit.require("spirit/app/app/element.js").then(function () { var b = document.createElement("div"); b.id = "pane"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); window.__sel = spirit.element.spirit.app.app.element.create(b, { face: "pane" }); return true; })');
  return listed === true ? true : false;
}, test.limit.quick);
test.run('the pane lists Contacts and the Agent', 0.2, async function () {
  if (listed !== true) return false;
  const there = await until(function () { return rows().then(function (r) { return !!r.Contacts && !!r.Agent; }); }, 10000);
  r = await rows();
  return there ? true : false;
}, test.limit.quick);
test.run('the Agent\'s row has its Activate or Deactivate, with a button', 0.2, function () {
  if (!r) return false;
  return !!r.Agent && /Activate|Deactivate/.test(r.Agent.text) && r.Agent.buttons.length > 0 ? true : false;
}, test.limit.quick);
test.run('Contacts\' row says neither Activate nor Deactivate', 0.2, function () {
  if (!r) return false;
  return !!r.Contacts && !/Activate|Deactivate/.test(r.Contacts.text) ? true : false;
}, test.limit.quick);
// The box: "The appSelector's detail and its rows use them." A row's switch is rowFormAppActive, a rowForm, not the old installer's button.
test.run('the Agent\'s row switches through rowFormAppActive, a rowForm, not the old installer', 0.2, function () {
  if (!r) return false;
  return !!r.Agent && r.Agent.forms > 0 && r.Agent.installers === 0 ? true : false;
}, test.limit.quick);
