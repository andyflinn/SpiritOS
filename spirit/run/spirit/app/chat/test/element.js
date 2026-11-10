'use strict';

// spirit/run/spirit/app/chat/test/element.js
// The tests of spirit/app/chat/element.js, and of no other module (spec: ./element.md; goal/G43.31). The box: "The app's
// element is spirit/app/chat/element.js (Andy: "the app-element must be spirit/app/chat/element.js"):
// spirit.elements.chat.create(container, { open }). It is today's chatter.js, working as it does, made an element: no
// activateApp and no handed api, the server through spirit itself, node.card through spirit.ready." Written from reading
// chatter.js: the contacts pane on the left (the contact search), one chat in the centre with its input (Enter sends,
// Shift+Enter a new line), the chats asked of the server at mount. Mounted alone in a box of a real Chrome on a scratch
// node's face page, the app switched on; every call the page sends recorded as it leaves.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const PLACE = 'spirit/app/chat/element.js';

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

test.startTest('element.js: the chat app\'s element, today\'s chatter made an element (goal/G43.31)');

(async function () {
  test.subHeading('its code: no old shell, no handed api');
  const src = code(FILE);
  ok(src !== '', 'it is at ' + PLACE, PLACE + ' is not there');
  ok(src !== '' && !/activateApp|spirit\.shell\b/.test(src), 'it mounts through no old shell: no activateApp, no spirit.shell', 'element.js still reaches the old shell: ' + short(src.match(/activateApp|spirit\.shell\b/g)));
  ok(src !== '' && !/\bchatClerver\b/.test(src), 'and names no chatClerver: its server is the branch chat', 'element.js still names chatClerver');

  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up) { test.fail('no scratch node: nothing judged'); return; }
    page = await H.chromePage(chrome);
    if (!page || page.error) { test.fail(page ? page.error : 'no Chrome page'); return; }
    await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: 'chat', active: true } }) });
    await H.until(function () {
      return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'chat.chats.search', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; });
    }, 40000);
    await page.send('Page.navigate', { url: node.base + '/face.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);

    test.subHeading('spirit.elements.chat.create(container, { open }) -> { destroy }, mounted alone');
    // Every call the page sends, recorded as it leaves: its fetch and its XMLHttpRequest bodies.
    const made = await page.evaluate('window.spirit.ready.then(function () {' +
      ' window.sent = []; window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); });' +
      ' var f = window.fetch; window.fetch = function (u, o) { try { window.sent.push(String(o && o.body || "")); } catch (e) {} return f.apply(this, arguments); };' +
      ' var x = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { window.sent.push(String(b || "")); } catch (e) {} return x.apply(this, arguments); };' +
      ' return spirit.require(' + JSON.stringify(PLACE) + '); }).then(function () {' +
      ' var E = spirit.elements && spirit.elements.chat; if (!E || typeof E.create !== "function") return "spirit.elements.chat.create is " + typeof (E && E.create);' +
      ' var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:760px;display:flex;background:#111;z-index:9"; document.body.appendChild(c);' +
      ' window.made = E.create(c, {}); return window.made && typeof window.made.destroy === "function" ? "made" : "create answered " + typeof window.made; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts, answering { destroy }', 'it did not mount: ' + short(made));
    if (made !== 'made') return;

    test.subHeading('it draws today\'s chatter: the contacts pane, and the chat\'s input');
    ok(await H.until(function () { return page.evaluate('!!Array.prototype.find.call(document.querySelectorAll("#box textarea"), function (t) { return /Enter sends, Shift\\+Enter a new line/.test(t.getAttribute("placeholder") || ""); })'); }, 10000),
      'the chat\'s input says Enter sends, Shift+Enter a new line', 'no such input: ' + short(await page.evaluate('String(document.getElementById("box").innerHTML).slice(0, 300)')));
    ok(await H.until(function () { return page.evaluate('!!(spirit.element && spirit.element.search && spirit.element.search.contact) && document.querySelectorAll("#box *").length > 10'); }, 10000),
      'and its contacts pane, the contact search', 'no contacts pane: the contact search is ' + short(await page.evaluate('typeof (spirit.element && spirit.element.search && spirit.element.search.contact)')));

    test.subHeading('it asks its server through spirit, as the branch chat');
    ok(await H.until(function () { return page.evaluate('window.sent.some(function (b) { return /"chat\\.chats\\.search"/.test(b); })'); }, 10000),
      'at mount it asks chat.chats.search', 'it sent: ' + short(await page.evaluate('JSON.stringify(window.sent.slice(-8))')));
    ok(await page.evaluate('!window.sent.some(function (b) { return /chatClerver/.test(b); })'), 'and never chatClerver.<verb>', 'it sent chatClerver: ' + short(await page.evaluate('JSON.stringify(window.sent.filter(function (b) { return /chatClerver/.test(b); }))')));
    ok(await H.until(function () { return page.evaluate('!!(spirit.data && spirit.data.chat && spirit.data.chat.data)'); }, 10000), 'its lines are the branch chat\'s cache, spirit.data.chat', 'no spirit.data.chat on the page');

    test.subHeading('destroy');
    ok(await page.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())'), 'destroy empties its container', 'destroy left ' + short(await page.evaluate('String(document.getElementById("box").innerHTML).slice(0, 200)')));
    const errs = JSON.parse(await page.evaluate('JSON.stringify(window.pageErrors)'));
    ok(errs.length === 0, 'and the page threw nothing', 'page errors: ' + short(errs));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
