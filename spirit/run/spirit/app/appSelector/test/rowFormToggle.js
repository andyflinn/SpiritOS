'use strict';

// spirit/run/spirit/app/appSelector/test/rowFormToggle.js
// The tests of spirit/app/appSelector/rowFormToggle.js, and of no other module (spec: ./rowFormToggle.md; goal/G43.15). Andy: "it
// acts exactly like the two toggle switches in appSelector:detailElement", "it is configurable with a description of what is being
// toggled." A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('rowFormToggle.js: a rowForm that toggles (goal/G43.15)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/rowFormToggle.js"); }).then(function () { return !!(spirit.element.spirit.app.appSelector.rowFormToggle && spirit.element.spirit.app.appSelector.rowFormToggle.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.element.spirit.app.appSelector.rowFormToggle', 'it did not load: ' + short(loaded));
    if (loaded !== true) return;
    const made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "t"; document.body.appendChild(b); window.__pressed = 0; window.__t = spirit.element.spirit.app.appSelector.rowFormToggle.create(b, { on: false, words: "Allow zz as shell", press: function () { window.__pressed += 1; } }); return !!window.__t && !!window.__t.root && typeof window.__t.set === "function" && typeof window.__t.destroy === "function"; }())');
    ok(made === true, 'create(host, { on, words, press }) answers { root, set, destroy }', 'it made: ' + short(made));
    if (made !== true) return;
    const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("t"); var btn = b.querySelector("button"); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), button: btn ? String(btn.textContent || "").trim() : null, forms: b.querySelectorAll(".shell-row-form").length }; }())'); };

    test.subHeading('the box: "it acts exactly like the two toggle switches": the state as 🟢 or 🔴, the button the other');
    const off = await seen();
    ok(off.forms === 1 && off.text.indexOf('Allow zz as shell') !== -1, 'one rowForm, with the words it was handed', 'drawn: ' + short(off));
    ok(off.text.indexOf('🔴') !== -1 && off.button === '🟢', 'off: it shows 🔴, its button 🟢', 'off: ' + short(off));

    test.subHeading('a press asks; the state changes only when it is handed one');
    await chrome.evaluate('document.querySelector("#t button").click(); 1');
    ok((await chrome.evaluate('window.__pressed')) === 1, 'a press calls press, once', 'pressed ' + short(await chrome.evaluate('window.__pressed')) + ' times');
    const still = await seen();
    ok(still.button === '🟢' && still.text.indexOf('🔴') !== -1, 'and it still shows off: the click is no state', 'after the press: ' + short(still));
    await chrome.evaluate('window.__t.set(true, "Don\'t allow zz as shell"); 1');
    const on = await seen();
    ok(on.text.indexOf('🟢') !== -1 && on.button === '🔴' && on.text.indexOf("Don't allow zz as shell") !== -1, 'set(true, words): it shows 🟢, its button 🔴, and the new words', 'on: ' + short(on));
    ok(on.forms === 1, 'still one rowForm', 'forms: ' + short(on.forms));
    await chrome.evaluate('document.querySelector("#t button").click(); 1');
    ok((await chrome.evaluate('window.__pressed')) === 2, 'a press on the redrawn button calls press again', 'pressed ' + short(await chrome.evaluate('window.__pressed')) + ' times');

    const empty = await chrome.evaluate('(function () { window.__t.destroy(); return document.getElementById("t").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await seen()));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.root) require('fs').rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
