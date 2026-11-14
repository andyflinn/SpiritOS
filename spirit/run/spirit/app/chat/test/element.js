'use strict';

// spirit/run/spirit/app/chat/test/element.js
// The tests of spirit/app/chat/element.js, and of no other module (spec: ./element.md; goal/G43.31). The box: "The app's
// element is spirit/app/chat/element.js (Andy: "the app-element must be spirit/app/chat/element.js"):
// spirit.element.spirit.app.chat.element.create(container, { open }). It is today's chatter.js, working as it does, made an element: no
// activateApp and no handed api, the server through spirit itself, node.card through spirit.ready." Written from reading
// chatter.js: the contacts pane on the left (the contact search), one chat in the centre with its input (Enter sends,
// Shift+Enter a new line), the chats asked of the server at mount. Mounted alone in a box of a real Chrome on a scratch
// node's face page, the app switched on; every call the page sends recorded as it leaves.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const PLACE = 'spirit/app/chat/element.js';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// What the tests make, for the tests after them.
const X = { src: '', node: null, page: null, made: '' };
const NO_PAGE = 'no face page in Chrome: the world failed';
const NOT_MOUNTED = 'the element did not mount';
test.after(function () {
  const page = X.page, node = X.node;
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});

// ── its code: no old shell, no handed api ──
test.run('its element file is there', 0.2, function () {
  X.src = code(FILE);
  return X.src !== '' ? true : PLACE + ' is not there';
}, test.limit.quick);
test.run('it mounts through no old shell: no activateApp, no spirit.shell', 0.2, function () {
  return X.src !== '' && !/activateApp|spirit\.shell\b/.test(X.src) ? true : 'element.js still reaches the old shell: ' + short(X.src.match(/activateApp|spirit\.shell\b/g));
}, test.limit.quick);
test.run('and names no chatClerver: its server is the branch chat', 0.2, function () {
  return X.src !== '' && !/\bchatClerver\b/.test(X.src) ? true : 'element.js still names chatClerver';
}, test.limit.quick);

test.run('the world: a scratch node with chat switched on, its face page in Chrome', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  const node = X.node = await H.scratchNode();
  if (!node.up) return 'no scratch node: nothing judged';
  const page = await H.chromePage(chrome);
  if (!page || page.error) { if (page && page.kid) X.page = page; return page ? page.error : 'no Chrome page'; }
  X.page = page;
  await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: 'chat', active: true } }) });
  await H.until(function () {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'chat.chats.search', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; });
  }, 40000);
  await page.send('Page.navigate', { url: node.base + '/face.html' });
  X.ready = await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  return X.ready ? true : 'the face page never had window.spirit.ready';
}, test.limit.slow);

// ── spirit.element.spirit.app.chat.element.create(container, { open }) -> { destroy }, mounted alone ──
test.run('it loads through spirit.require and mounts, answering { destroy }', 0.2, async function () {
  const page = X.page;
  if (!page || !X.ready) return NO_PAGE;
  // Every call the page sends, recorded as it leaves: its fetch and its XMLHttpRequest bodies.
  X.made = await page.evaluate('window.spirit.ready.then(function () {' +
    ' window.sent = []; window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); });' +
    ' var f = window.fetch; window.fetch = function (u, o) { try { window.sent.push(String(o && o.body || "")); } catch (e) {} return f.apply(this, arguments); };' +
    ' var x = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { window.sent.push(String(b || "")); } catch (e) {} return x.apply(this, arguments); };' +
    ' return spirit.require(' + JSON.stringify(PLACE) + '); }).then(function () {' +
    ' var E = spirit.element && spirit.element.spirit.app.chat.element; if (!E || typeof E.create !== "function") return "spirit.element.spirit.app.chat.element.create is " + typeof (E && E.create);' +
    ' var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:760px;display:flex;background:#111;z-index:9"; document.body.appendChild(c);' +
    ' window.made = E.create(c, {}); return window.made && typeof window.made.destroy === "function" ? "made" : "create answered " + typeof window.made; }, function (e) { return String(e && e.message || e); })');
  return X.made === 'made' ? true : 'it did not mount: ' + short(X.made);
}, test.limit.quick);

// ── it draws today's chatter: the contacts pane, and the chat's input ──
test.run('the chat\'s input says Enter sends, Shift+Enter a new line', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await H.until(function () { return page.evaluate('!!Array.prototype.find.call(document.querySelectorAll("#box textarea"), function (t) { return /Enter sends, Shift\\+Enter a new line/.test(t.getAttribute("placeholder") || ""); })'); }, 10000)
    ? true : 'no such input: ' + short(await page.evaluate('String(document.getElementById("box").innerHTML).slice(0, 300)'));
}, test.limit.quick);
test.run('and its contacts pane, the contact search', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await H.until(function () { return page.evaluate('!!(spirit.element && spirit.element.spirit.element.search && spirit.element.spirit.element.search.contact) && document.querySelectorAll("#box *").length > 10'); }, 10000)
    ? true : 'no contacts pane: the contact search is ' + short(await page.evaluate('typeof (spirit.element && spirit.element.spirit.element.search && spirit.element.spirit.element.search.contact)'));
}, test.limit.quick);

// ── it asks its server through spirit, as the branch chat ──
test.run('at mount it asks chat.chats.search', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await H.until(function () { return page.evaluate('window.sent.some(function (b) { return /"chat\\.chats\\.search"/.test(b); })'); }, 10000)
    ? true : 'it sent: ' + short(await page.evaluate('JSON.stringify(window.sent.slice(-8))'));
}, test.limit.quick);
test.run('and never chatClerver.<verb>', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await page.evaluate('!window.sent.some(function (b) { return /chatClerver/.test(b); })')
    ? true : 'it sent chatClerver: ' + short(await page.evaluate('JSON.stringify(window.sent.filter(function (b) { return /chatClerver/.test(b); }))'));
}, test.limit.quick);
test.run('its lines are the branch chat\'s cache, spirit.data.chat', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await H.until(function () { return page.evaluate('!!(spirit.data && spirit.data.chat && spirit.data.chat.data)'); }, 10000) ? true : 'no spirit.data.chat on the page';
}, test.limit.quick);

// ── destroy ──
test.run('destroy empties its container', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  return await page.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())')
    ? true : 'destroy left ' + short(await page.evaluate('String(document.getElementById("box").innerHTML).slice(0, 200)'));
}, test.limit.quick);
test.run('and the page threw nothing', 0.2, async function () {
  const page = X.page;
  if (X.made !== 'made') return NOT_MOUNTED;
  const errs = JSON.parse(await page.evaluate('JSON.stringify(window.pageErrors)'));
  return errs.length === 0 ? true : 'page errors: ' + short(errs);
}, test.limit.quick);
