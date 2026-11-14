'use strict';

// spirit/run/spirit/element/search/app/test/rowFormSetShell.js
// The tests of spirit/element/search/app/rowFormSetShell.js, and of no other module (spec: ./rowFormSetShell.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// The node's shell, at home or on its face, one rowForm (goal/G43.18, box v29, "The shell"). A real Chrome on a scratch
// node's face page, the world of ./rowFormAppActive.js; neither Andy's node nor an agent's is touched. Which apps may be a
// shell is read from the tree (each <name>.json's shell.true); what the node keeps, from the scratch node's
// spirit/state/shell.json.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const APPS = path.join(RUN, 'spirit', 'app');
const own = function (n) { try { return JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { return null; } };
const SHELLS = fs.readdirSync(APPS).filter(function (n) { const j = own(n); return !!(j && j.shell && j.shell.true === true); }).sort();
const NOSHELL = fs.readdirSync(APPS).filter(function (n) { const j = own(n); return !!j && !(j.shell && j.shell.true === true); })[0];
const SHELL = SHELLS[0];
const LABEL = SHELL ? String((own(SHELL).identity || {}).label || SHELL) : '';

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded;
const NO_WORLD = 'no scratch node or no Chrome: the world failed';
const NOT_LOADED = 'rowFormSetShell.js did not load';
const make = function (id, key, at) { return chrome.evaluate('(function () { var b = document.createElement("div"); b.id = ' + JSON.stringify(id) + '; b.style.cssText = "position:relative;width:900px;min-height:40px;"; document.body.appendChild(b); window[' + JSON.stringify(id) + '] = spirit.element.spirit.element.search.app.rowFormSetShell.create(b, { key: ' + JSON.stringify(key) + ', at: ' + JSON.stringify(at) + ' }); var m = window[' + JSON.stringify(id) + ']; return !!m && typeof m.destroy === "function"; }())'); };
const view = function (id) { return chrome.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), forms: b.querySelectorAll(".shell-row-form").length, set: b.querySelector(".shell-row-form > button") ? String(b.querySelector(".shell-row-form > button").textContent).trim() : null, html: b.innerHTML.length }; }())'); };
const pressSet = function (id) { return chrome.evaluate('(function () { var s = document.getElementById(' + JSON.stringify(id) + ').querySelector(".shell-row-form > button"); if (!s) return false; s.click(); return true; }())'); };
const openList = function (id) { return chrome.evaluate('(function () { var f = document.getElementById(' + JSON.stringify(id) + ').querySelector("button[id$=\\"field\\"]"); if (!f) return false; f.click(); return true; }())'); };
const listed = function (id) { return chrome.evaluate('(function () { var out = []; Array.prototype.forEach.call(document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("[id$=\\"popup\\"] [data-key]"), function (r) { if (r.getClientRects().length && out.indexOf(r.getAttribute("data-key")) === -1) out.push(r.getAttribute("data-key")); }); return out.sort(); }())'); };
const pick = function (id, key) { return chrome.evaluate('(function () { var r = Array.prototype.filter.call(document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("[id$=\\"popup\\"] tr[data-key]"), function (x) { return x.getAttribute("data-key") === ' + JSON.stringify(key) + '; })[0]; if (!r) return false; r.click(); return true; }())'); };
const kept = function () { try { return JSON.parse(fs.readFileSync(path.join(node.root, 'spirit', 'run', 'spirit', 'state', 'shell.json'), 'utf8')); } catch (e) { return null; } };

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});

test.run('the world: the tree has an app that may be a shell, and one that may not', 0.2, function () {
  return (!!SHELL && !!NOSHELL) || 'shells ' + short(SHELLS) + ', no shell ' + short(NOSHELL);
}, test.limit.quick);
test.run('the world: a scratch node, and a Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) || 'the face page never had spirit.ready';
}, test.limit.slow);
test.run('it loads through spirit.require and is spirit.element.spirit.element.search.app.rowFormSetShell', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return NO_WORLD;
  loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/rowFormSetShell.js"); }).then(function () { window.shellAsks = []; var real = spirit.node.shell; spirit.node.shell = function (a) { window.shellAsks.push(a); return window.refuseShell ? Promise.reject(new Error("refused here")) : real.call(spirit.node, a); }; var E = spirit.element.spirit.element.search.app.rowFormSetShell; return !!(E && typeof E.create === "function"); }, function (e) { return String(e && e.message || e); })');
  return loaded === true || 'it did not load: ' + short(loaded);
}, test.limit.slow);

// "shown only for an app whose <name>.json says shell:true:true"
test.run('create(host, { key, at }) answers { destroy }', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  const made = [await make('no', NOSHELL, 'home'), await make('home', SHELL, 'home'), await make('face', SHELL, 'face')];
  return JSON.stringify(made) === '[true,true,true]' || 'made ' + short(made);
}, test.limit.slow);
test.run('for an app that may not be a shell it draws no row', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  await until(function () { return view('home').then(function (v) { return v.forms === 1; }); }, 10000);
  await sleep(500);
  const v = await view('no');
  return (v.forms === 0 && v.text === '') || 'for ' + NOSHELL + ': ' + short(v);
}, test.limit.slow);
// rowForm: [🏡] "Home shell" app:search:dropdown [armingButton-'Set']
test.run('for a shell at home: one row, 🏡 "Home shell", and Set', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  const v = await view('home');
  return (v.forms === 1 && /🏡/.test(v.text) && /Home shell/.test(v.text) && v.set === 'Set') || 'at home: ' + short(v);
}, test.limit.quick);
// rowForm: [😋] "Face shell" app:search:dropdown [armingButton-'Set']
test.run('for a shell on its face: one row, 😋 "Face shell", and Set', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  await until(function () { return view('face').then(function (v) { return v.forms === 1; }); }, 10000);
  const v = await view('face');
  return (v.forms === 1 && /😋/.test(v.text) && /Face shell/.test(v.text) && v.set === 'Set') || 'on its face: ' + short(v);
}, test.limit.slow);
// "Beside the dropdown, the shell the node names now (node.shell({ at })), by its label"
test.run('beside the dropdown, the shell the node names now, by its label, asked of node.shell({ at })', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  const ok = await until(function () { return view('home').then(function (v) { return v.text.indexOf('Home shell ' + LABEL) !== -1; }); }, 10000);
  const asks = await chrome.evaluate('JSON.stringify(window.shellAsks)');
  return (!!ok && JSON.parse(asks).some(function (a) { return a.at === 'home' && !a.name; })) || 'shown ' + short((await view('home')).text) + ', asked ' + short(asks);
}, test.limit.slow);
// "Both dropdowns list only the apps whose <name>.json says shell:true:true"
test.run('its dropdown lists only the apps that may be a shell', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  await openList('face');
  const ok = await until(function () { return listed('face').then(function (k) { return JSON.stringify(k) === JSON.stringify(SHELLS); }); }, 10000);
  return !!ok || 'the dropdown lists ' + short(await listed('face')) + ', the shells ' + short(SHELLS);
}, test.limit.slow);
test.run('Set with nothing chosen asks nothing and says to choose a shell first', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  const before = JSON.parse(await chrome.evaluate('JSON.stringify(window.shellAsks)')).filter(function (a) { return a.name; }).length;
  await pressSet('home'); await sleep(200); await pressSet('home');
  const ok = await until(function () { return view('home').then(function (v) { return /Choose a shell first\./.test(v.text); }); }, 3000);
  const after = JSON.parse(await chrome.evaluate('JSON.stringify(window.shellAsks)')).filter(function (a) { return a.name; }).length;
  return (!!ok && after === before) || 'said ' + short((await view('home')).text) + ', sets asked ' + (after - before);
}, test.limit.slow);
// "a pick is held until Set"
test.run('a pick is held until Set: choosing asks the node nothing', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  if (!(await pick('face', SHELL))) return 'no row of ' + SHELL + ' to pick';
  await sleep(500);
  const sets = JSON.parse(await chrome.evaluate('JSON.stringify(window.shellAsks)')).filter(function (a) { return a.name; });
  return (!sets.length && !(kept() || {}).face) || 'asked on a pick: ' + short(sets);
}, test.limit.slow);
// "Set, an armingButton, whose second press asks the node, node.shell({ at, name })"
test.run('Set\'s first press asks nothing; its second asks node.shell({ at, name }), and the node keeps it', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  await pressSet('face'); await sleep(300);
  const first = JSON.parse(await chrome.evaluate('JSON.stringify(window.shellAsks)')).filter(function (a) { return a.name; }).length;
  await pressSet('face');
  const ok = await until(function () { return (kept() || {}).face === SHELL; }, 5000);
  const sets = JSON.parse(await chrome.evaluate('JSON.stringify(window.shellAsks)')).filter(function (a) { return a.name; });
  return (first === 0 && !!ok && sets.length === 1 && sets[0].at === 'face' && sets[0].name === SHELL) || 'after the first press ' + first + ' sets; asked ' + short(sets) + ', kept ' + short(kept());
}, test.limit.slow);
// "the row says what the node answered"
test.run('a refused set says so in the row', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  await chrome.evaluate('window.refuseShell = true; true');
  await pressSet('face'); await sleep(200); await pressSet('face');
  const ok = await until(function () { return view('face').then(function (v) { return /Not set: refused here/.test(v.text); }); }, 3000);
  await chrome.evaluate('window.refuseShell = false; true');
  return !!ok || 'said ' + short((await view('face')).text);
}, test.limit.slow);
test.run('destroy leaves its host empty', 0.2, async function () {
  if (loaded !== true) return NOT_LOADED;
  const empty = await chrome.evaluate('(function () { window.home.destroy(); window.face.destroy(); return document.getElementById("home").innerHTML === "" && document.getElementById("face").innerHTML === ""; }())');
  return empty === true || 'destroy left ' + short(await view('home'));
}, test.limit.quick);
