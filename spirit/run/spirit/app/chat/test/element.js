'use strict';

// spirit/run/spirit/app/chat/test/element.js
// The tests of spirit/app/chat/element.js, and of no other module (spec: ./element.md; goal/G43.31). The box: "The app's
// element is spirit/app/chat/element.js (Andy: "the app-element must be spirit/app/chat/element.js"):
// spirit.app.chat.element.create(container, { open }). It is today's chatter.js, working as it does, made an element: no
// activateApp and no handed api, the server through spirit itself, node.card through spirit.readyPromise." Written from reading
// chatter.js: the contacts pane on the left (the contact search), one chat in the centre with its input (Enter sends,
// Shift+Enter a new line), the chats asked of the server at mount. Mounted alone in a box of a real Chrome on a scratch
// node's face page, the app switched on; every call the page sends recorded as it leaves.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const H = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const FILE = path.join(__dirname, '..', 'element.js');
const PLACE = 'spirit/app/chat/element.js';

function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// What the tests make, for the tests after them.
const X = { src: '', node: null, page: null, made: '' };
test.after(function () {
  const page = X.page, node = X.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});

// ── its code: no old shell, no handed api ──
test.run('its element file is there', 0.2, function () {
  X.src = code(FILE);
  return X.src !== '' ? true : false;
}, test.limit.quick);
test.run('it mounts through no old shell, naming neither activateApp nor spirit.shell', 0.2, function () {
  return X.src !== '' && !/activateApp|spirit\.shell\b/.test(X.src) ? true : false;
}, test.limit.quick);
test.run('it names no chatClerver, since its server is the branch chat', 0.2, function () {
  return X.src !== '' && !/\bchatClerver\b/.test(X.src) ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up with chat switched on and its face page open in Chrome', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return false;
  const node = X.node = await H.scratchNode();
  if (!node.up) return false;
  const page = await H.chromePage(chrome);
  if (!page || page.error) { if (page && page.kid) X.page = page; return false; }
  X.page = page;
  await fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.app.active', args: { key: 'spirit.app.chat', active: true } }) });
  await H.until(function () {
    return fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.app.chat.chats.search', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; });
  }, 40000);
  await page.send('Page.navigate', { url: node.base + '/' });
  X.ready = await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  return X.ready ? true : false;
}, test.limit.slow);

// ── spirit.app.chat.element.create(container, { open }) -> { destroy }, mounted alone ──
test.run('it loads through spirit.requireScript and mounts, answering an object with a destroy', 0.2, async function () {
  const page = X.page;
  if (!page || !X.ready) return false;
  // Every call the page sends, recorded as it leaves: its fetch and its XMLHttpRequest bodies.
  X.made = await page.evaluate('window.spirit.readyPromise.then(function () {' +
    ' window.sent = []; window.pageErrors = []; window.addEventListener("error", function () { window.pageErrors.push(true); });' +
    ' var f = window.fetch; window.fetch = function (u, o) { try { window.sent.push(String(o && o.body || "")); } catch (e) {} return f.apply(this, arguments); };' +
    ' var x = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { window.sent.push(String(b || "")); } catch (e) {} return x.apply(this, arguments); };' +
    ' return spirit.requireScript(' + JSON.stringify(PLACE) + '); }).then(function (E) {' +
    // The element as spirit.requireScript handed it back (goal/G49.23: no spirit.required).
    ' if (!E || typeof E.create !== "function") return false;' +
    ' var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:760px;display:flex;background:#111;z-index:9"; document.body.appendChild(c);' +
    ' window.made = E.create(c, {}); return window.made && typeof window.made.destroy === "function" ? "made" : false; }, function () { return false; })');
  return X.made === 'made' ? true : false;
}, test.limit.quick);

// ── it draws today's chatter: the contacts pane, and the chat's input ──
test.run('the chat\'s input says Enter sends, Shift+Enter a new line', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await H.until(function () { return page.evaluate('!!Array.prototype.find.call(document.querySelectorAll("#box textarea"), function (t) { return /Enter sends, Shift\\+Enter a new line/.test(t.getAttribute("placeholder") || ""); })'); }, 10000)
    ? true : false;
}, test.limit.quick);
test.run('it draws its contacts pane, the contact search', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await H.until(function () { return page.evaluate('!!(spirit.element && spirit.element.search && spirit.element.search.contact) && document.querySelectorAll("#box *").length > 10'); }, 10000)
    ? true : false;
}, test.limit.quick);

// ── it asks its server through spirit, as the branch spirit.app.chat (goal/G49.19: an app is called by its id) ──
test.run('at mount it asks spirit.app.chat.chats.search', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await H.until(function () { return page.evaluate('window.sent.some(function (b) { return /"spirit\\.app\\.chat\\.chats\\.search"/.test(b); })'); }, 10000)
    ? true : false;
}, test.limit.quick);
test.run('it never asks a verb of chatClerver', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await page.evaluate('!window.sent.some(function (b) { return /chatClerver/.test(b); })')
    ? true : false;
}, test.limit.quick);
test.run('its lines are the branch spirit.app.chat\'s cache, the store\'s spirit.client[\'spirit.app.chat\']', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await H.until(function () { return page.evaluate('!!(spirit.client && spirit.client[\"spirit.app.chat\"] && spirit.client[\"spirit.app.chat\"].data)'); }, 10000) ? true : false;
}, test.limit.quick);

// ── destroy ──
test.run('destroy empties its container', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  return await page.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())')
    ? true : false;
}, test.limit.quick);
test.run('the page threw nothing', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return false;
  const errs = JSON.parse(await page.evaluate('JSON.stringify(window.pageErrors)'));
  return errs.length === 0 ? true : false;
}, test.limit.quick);
