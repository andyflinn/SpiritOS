'use strict';

// spirit/run/spirit/element/search/grant/test/detailElement.js
// The tests of spirit/element/search/grant/detailElement.js, and of no other module (spec: ./detailElement.md; goal/G43.32).
// The box: "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js". A real Chrome on a scratch node's face page, the detail mounted by itself on a grant of a table of the
// test's own, so no grant of any node is revoked; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

test.startTest('detailElement.js: one grant, its detail, with its Revoke (goal/G43.32)');

(async function () {
  const SRC = path.join(__dirname, '..', 'detailElement.js');
  ok(fs.existsSync(SRC), 'spirit/element/search/grant/detailElement.js is there', 'spirit/element/search/grant/detailElement.js is not there: nothing below can pass');
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const js = function (s) { return chrome.evaluate(s); };
    // The test's own grants table: it keeps what is revoked, and serves no path under zz/.
    const mount = function (id, served) {
      return js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/grant/detailElement.js"); }).then(function () { var E = (((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).grant || {}).detailElement; if (!E || typeof E.create !== "function") return "no create"; var old = document.getElementById("' + id + '"); if (old) old.remove(); var b = document.body.appendChild(document.createElement("div")); b.id = "' + id + '"; window.__revoked = window.__revoked || []; window["__" + "' + id + '"] = E.create(b, { row: { contact: "KEYZZ", name: "Zz Peer", path: "zz/thing" }, grants: { key: "contact", label: "name", revoke: function (k, p) { window.__revoked.push(k + " " + p); return Promise.resolve(true); }, watch: function (fn) { window.__watchers = (window.__watchers || []).concat([fn]); window.__released = window.__released || 0; return function () { window.__released += 1; }; } }, serves: function () { return ' + (served ? 'true' : 'false') + '; } }); return "made"; }, function (e) { return "ERR " + e; })');
    };
    const text = function (id) { return js('String((document.getElementById("' + id + '") || {}).innerText || "")'); };
    ok((await mount('zzOne', true)) === 'made', 'it loads on a page, at spirit.element.spirit.element.search.grant.detailElement, and makes its detail', 'mounting it failed');
    await until(function () { return text('zzOne').then(function (t) { return /Zz Peer/.test(t); }); }, 8000);
    const one = await text('zzOne');
    ok(/Zz Peer/.test(one) && /zz\/thing/.test(one), 'it says whose grant it is and its path', 'the detail shows: ' + short(one));
    ok(!/deprecated/.test(one), 'a path a server serves is not marked deprecated', 'the detail shows: ' + short(one));
    ok((await mount('zzTwo', false)) === 'made', 'the world: a second detail, on a path no server serves', 'the second did not mount');
    await until(function () { return text('zzTwo').then(function (t) { return /Zz Peer/.test(t); }); }, 8000);
    ok(/deprecated/.test(await text('zzTwo')), 'a path no server serves today is marked deprecated', 'the detail shows: ' + short(await text('zzTwo')));

    test.subHeading('its Revoke, an armingButton: "a armingButton [Revoke], which must revoke/delete that grant"');
    const press = function () { return js('(function () { var b = Array.prototype.slice.call(document.getElementById("zzOne").querySelectorAll("button")).filter(function (x) { return /Revoke/.test(x.textContent); })[0]; if (!b) return false; b.click(); return true; })()'); };
    ok(await press(), 'the world: it has a Revoke button', 'no Revoke button in: ' + short(one));
    await sleep(300);
    ok((await js('window.__revoked.length')) === 0, 'one press only arms it: nothing is revoked', 'one press revoked: ' + short(await js('window.__revoked')));
    await press();
    ok(await until(function () { return js('window.__revoked.join("|")').then(function (v) { return v === 'KEYZZ zz/thing'; }); }, 5000), 'the second press revokes that grant, by its ID and its path', 'revoked: ' + short(await js('window.__revoked')));
    ok(await until(function () { return text('zzOne').then(function (t) { return /revoked/.test(t); }); }, 5000), 'and says so below the bubble', 'the detail shows: ' + short(await text('zzOne')));

    test.subHeading('"who paints, listens": its row, as its table\'s watch hands it');
    await js('(function () { (window.__watchers || []).forEach(function (fn) { fn("KEYZZ\\nzz/thing", { contact: "KEYZZ", name: "Zz Renamed", path: "zz/thing" }); fn("OTHER\\nzz/else", { contact: "OTHER", name: "Not Mine", path: "zz/else" }); }); return true; })()');
    const renamed = await text('zzTwo');
    ok(/Zz Renamed/.test(renamed) && !/Not Mine/.test(renamed), 'a new label of its own grant repaints it, and another grant\'s does not', 'after the watch: ' + short(renamed));
    await js('(function () { (window.__watchers || []).forEach(function (fn) { fn("KEYZZ\\nzz/thing", undefined); }); return true; })()');
    ok(/revoked/.test(await text('zzTwo')), 'its grant gone, revoked anywhere, it says so', 'after the grant went: ' + short(await text('zzTwo')));

    test.subHeading('destroy(), and unconfigured');
    const after = await js('(function () { window.__zzOne.destroy(); return document.getElementById("zzOne").children.length; })()');
    ok(after === 0, 'destroy leaves its host empty', 'after destroy it holds ' + short(after) + ' children');
    ok((await js('window.__released')) === 1, 'and lets its watch go', 'watches let go: ' + short(await js('window.__released')));
    const bare = await js('(function () { var b = document.body.appendChild(document.createElement("div")); try { spirit.element.spirit.element.search.grant.detailElement.create(b, {}); } catch (e) { return "threw " + e; } return String(b.innerText); })()');
    ok(/not configured/.test(bare), 'with no row and no table it says it is not configured, and throws nothing', 'unconfigured: ' + short(bare));
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
