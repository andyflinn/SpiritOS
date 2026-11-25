'use strict';

// spirit/run/spirit/element/search/grant/detail/test/script.js
// The tests of spirit/element/search/grant/detail/script.js, and of no other module (spec: ./script.md; goal/G43.32).
// The box: "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js". A real Chrome on a scratch node's face page, the detail mounted by itself on a grant of a table of the
// test's own, so no grant of any node is revoked; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until, sleep } = LOADER.requireScript('spirit/test/headLessChrome.js');

// One test.run per test (goal/G47.2). What the world makes, for the tests after it.
let node, chrome, js, mount, text, press, one;

test.after(function () {
  if (chrome && chrome.kid) chrome.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});
test.run('spirit/element/search/grant/detail/script.js is there', 0.2, function () {
  return fs.existsSync(path.join(__dirname, '..', 'script.js')) ? true : false;
}, test.limit.quick);
test.run('a scratch node comes up, and Chrome opens its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  js = function (s) { return chrome.evaluate(s); };
  // The test's own grants table: it keeps what is revoked, and serves no path under zz/.
  mount = function (id, served) {
    return js('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/element/search/grant/detail/script.js"); }).then(function () { var E = (((((window.spirit.required || {}).spirit || {}).element || {}).search || {}).grant || {}).detail; if (!E || typeof E.create !== "function") return false; var old = document.getElementById("' + id + '"); if (old) old.remove(); var b = document.body.appendChild(document.createElement("div")); b.id = "' + id + '"; window.__revoked = window.__revoked || []; window["__" + "' + id + '"] = E.create(b, { row: { contact: "KEYZZ", name: "Zz Peer", path: "zz/thing" }, grants: { key: "contact", label: "name", revoke: function (k, p) { window.__revoked.push(k + " " + p); return Promise.resolve(true); }, watch: function (fn) { window.__watchers = (window.__watchers || []).concat([fn]); window.__released = window.__released || 0; return function () { window.__released += 1; }; } }, serves: function () { return ' + (served ? 'true' : 'false') + '; } }); return "made"; }, function () { return false; })');
  };
  text = function (id) { return js('String((document.getElementById("' + id + '") || {}).innerText || "")'); };
  return true;
}, test.limit.slow);
test.run('it loads on a page, at its path on spirit.required, and makes its detail', 0.2, async function () {
  if (!js) return false;
  return (await mount('zzOne', true)) === 'made' ? true : false;
}, test.limit.slow);
test.run('it says whose grant it is and its path', 0.2, async function () {
  if (!js) return false;
  await until(function () { return text('zzOne').then(function (t) { return /Zz Peer/.test(t); }); }, 8000);
  one = await text('zzOne');
  return /Zz Peer/.test(one) && /zz\/thing/.test(one) ? true : false;
}, test.limit.slow);
test.run('a path a server serves is not marked deprecated', 0.2, function () {
  if (one === undefined) return false;
  return !/deprecated/.test(one) ? true : false;
}, test.limit.quick);
test.run('a second detail is made, on a path no server serves', 0.2, async function () {
  if (!js) return false;
  return (await mount('zzTwo', false)) === 'made' ? true : false;
}, test.limit.slow);
// No deprecated (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well"):
// a path no server serves today is shown as it is.
test.run('a path no server serves today is not marked deprecated either', 0.2, async function () {
  if (!js) return false;
  await until(function () { return text('zzTwo').then(function (t) { return /Zz Peer/.test(t); }); }, 8000);
  const two = await text('zzTwo');
  return /Zz Peer/.test(two) && !/deprecated/.test(two) ? true : false;
}, test.limit.slow);

// its Revoke, an armingButton: "a armingButton [Revoke], which must revoke/delete that grant"
test.run('it has a Revoke button', 0.2, async function () {
  if (!js) return false;
  press = function () { return js('(function () { var b = Array.prototype.slice.call(document.getElementById("zzOne").querySelectorAll("button")).filter(function (x) { return /Revoke/.test(x.textContent); })[0]; if (!b) return false; b.click(); return true; })()'); };
  return (await press()) ? true : false;
}, test.limit.slow);
test.run('one press only arms it: nothing is revoked', 0.2, async function () {
  if (!js) return false;
  await sleep(300);
  return (await js('window.__revoked.length')) === 0 ? true : false;
}, test.limit.slow);
let busyAt = null;
test.run('the second press revokes that grant, by its ID and its path', 0.2, async function () {
  if (!js) return false;
  // The button as it is in the instant after that press (goal/G47.1, Q25).
  try { busyAt = JSON.parse(await js('(function () { var b = Array.prototype.slice.call(document.getElementById("zzOne").querySelectorAll("button")).filter(function (x) { return /Revoke/.test(x.textContent); })[0]; if (!b) return "null"; b.click(); return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); })()')); } catch (e) { busyAt = null; }
  return (await until(function () { return js('window.__revoked.join("|")').then(function (v) { return v === 'KEYZZ zz/thing'; }); }, 5000)) ? true : false;
}, test.limit.slow);
test.run('the detail says below the bubble that the grant is revoked', 0.2, async function () {
  if (!js) return false;
  return (await until(function () { return text('zzOne').then(function (t) { return /revoked/.test(t); }); }, 5000)) ? true : false;
}, test.limit.slow);

// goal/G47.1, Q25 (Andy: "sure."): busy after its confirming press, until the answer, read in the instant of that press.
test.run('the second press of Revoke leaves it busy until the grant is revoked: disabled, with its turning mark', 0.2, function () {
  if (!busyAt) return false;
  return busyAt.disabled === true && busyAt.mark === true ? true : false;
}, test.limit.quick);

// "who paints, listens": its row, as its table's watch hands it
test.run('a new label of its own grant repaints it, and another grant\'s does not', 0.2, async function () {
  if (!js) return false;
  await js('(function () { (window.__watchers || []).forEach(function (fn) { fn("KEYZZ\\nzz/thing", { contact: "KEYZZ", name: "Zz Renamed", path: "zz/thing" }); fn("OTHER\\nzz/else", { contact: "OTHER", name: "Not Mine", path: "zz/else" }); }); return true; })()');
  const renamed = await text('zzTwo');
  return /Zz Renamed/.test(renamed) && !/Not Mine/.test(renamed) ? true : false;
}, test.limit.slow);
test.run('its grant gone, revoked anywhere, it says so', 0.2, async function () {
  if (!js) return false;
  await js('(function () { (window.__watchers || []).forEach(function (fn) { fn("KEYZZ\\nzz/thing", undefined); }); return true; })()');
  const t = await text('zzTwo');
  return /revoked/.test(t) ? true : false;
}, test.limit.slow);

// destroy(), and unconfigured
test.run('destroy leaves its host empty', 0.2, async function () {
  if (!js) return false;
  const after = await js('(function () { window.__zzOne.destroy(); return document.getElementById("zzOne").children.length; })()');
  return after === 0 ? true : false;
}, test.limit.slow);
test.run('destroy lets its watch go', 0.2, async function () {
  if (!js) return false;
  const released = await js('window.__released');
  return released === 1 ? true : false;
}, test.limit.slow);
test.run('with no row and no table it says it is not configured, and throws nothing', 0.2, async function () {
  if (!js) return false;
  const bare = await js('(function () { var b = document.body.appendChild(document.createElement("div")); try { spirit.required.spirit.element.search.grant.detail.create(b, {}); } catch (e) { return false; } return String(b.innerText); })()');
  return bare !== false && /not configured/.test(bare) ? true : false;
}, test.limit.slow);

// NO DEPRECATED (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well,
// what the hell is it even for?"): nothing marks a grant deprecated, and nothing asks whether a server serves its path.
test.run('detail.js names no deprecated and takes no serves, its comments left out', 0.2, function () {
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, 'spirit/element/search/grant/detail/script.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return false; }
  return (src.length > 0 && !/deprecated/i.test(src) && !/\bserves\b/.test(src)) ? true : false;
}, test.limit.quick);
