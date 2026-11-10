'use strict';

// spirit/run/spirit/element/search/app/test/changeAppIcon.js
// The tests of spirit/element/search/app/changeAppIcon.js, and of no other module (spec: ./changeAppIcon.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

test.startTest('changeAppIcon.js: one app\'s icon, as a rowForm (goal/G43.15)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
  const iconOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).icon : undefined; };
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/changeAppIcon.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.changeAppIcon && spirit.element.spirit.element.search.app.changeAppIcon.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.element.spirit.element.search.app.changeAppIcon', 'it did not load: ' + short(loaded));
    if (loaded !== true) return;
    const made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "i"; document.body.appendChild(b); window.__i = spirit.element.spirit.element.search.app.changeAppIcon.create(b, { key: "agent" }); return !!window.__i && typeof window.__i.destroy === "function"; }())');
    ok(made === true, 'create(host, { key }) answers { destroy }', 'it made: ' + short(made));
    const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("i"); var bs = b.querySelectorAll("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), last: bs.length ? String(bs[bs.length - 1].textContent || "").trim() : null }; }())'); };

    test.subHeading('one rowForm: [✏️] "Icon" [the app\'s icon] [iconSelector:dropdown] [Change], as the detail draws it');
    ok(await until(function () { return seen().then(function (v) { return v.forms >= 1 && v.text.indexOf('🤖') !== -1; }); }, 10000), 'a rowForm showing the app\'s icon, 🤖', 'drawn: ' + short(await seen()));
    const v0 = await seen();
    ok(/✏/.test(v0.text) && /Icon/.test(v0.text) && v0.last === 'Change' && /choose an icon/.test(v0.text), 'with ✏️, the word Icon, the icon dropdown and a Change button', 'drawn: ' + short(v0));

    test.subHeading('Change with nothing picked changes nothing');
    await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); bs[bs.length - 1].click(); return 1; }())');
    await sleep(1500);
    ok((await iconOf('agent')) === '🤖', 'the app\'s icon stays 🤖', 'the row: ' + short(await iconOf('agent')));

    test.subHeading('the box: "writing through the app family\'s iconApp": a glyph picked, then Change');
    // The dropdown's own field opens it; a row of the set picks its glyph.
    await chrome.evaluate('(function () { var f = Array.prototype.filter.call(document.querySelectorAll("#i *"), function (e) { return /choose an icon/.test(e.textContent || "") && !e.children.length; })[0]; if (f) f.click(); return !!f; }())');
    const glyph = await until(function () { return chrome.evaluate('(function () { var r = document.querySelector("#i tr[data-key]"); return r ? r.getAttribute("data-key") : ""; }())').then(function (k) { return k && k !== '🤖' ? k : ''; }); }, 8000);
    ok(!!glyph, 'the world: the dropdown opens on the icon set', 'no row of the icon set to pick');
    const key = await chrome.evaluate('(function () { var rows = Array.prototype.filter.call(document.querySelectorAll("#i tr[data-key]"), function (r) { return r.getAttribute("data-key") !== "🤖"; }); if (!rows.length) return ""; rows[0].click(); return rows[0].getAttribute("data-key"); }())');
    await chrome.evaluate('(function () { var bs = document.querySelectorAll("#i button"); bs[bs.length - 1].click(); return 1; }())');
    ok(!!key && await until(function () { return iconOf('agent').then(function (g) { return g === key; }); }, 10000), 'Change writes the picked glyph, and the app\'s row says it', 'picked ' + short(key) + ', the row: ' + short(await iconOf('agent')));

    test.subHeading('an icon changed elsewhere shows, with no reload');
    await ask('app.icon', { key: 'agent', icon: '🧩' });
    ok(await until(function () { return seen().then(function (v) { return v.text.indexOf('🧩') !== -1; }); }, 10000), 'it shows the new icon', 'drawn: ' + short(await seen()));

    const empty = await chrome.evaluate('(function () { window.__i.destroy(); return document.getElementById("i").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await seen()));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.root) require('fs').rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
