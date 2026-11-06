'use strict';

// spirit/run/spirit/app/appSelector/test/changeAppLabel.js
// The tests of spirit/app/appSelector/changeAppLabel.js, and of no other module (spec: ./changeAppLabel.md; goal/G43.15). Andy: "i
// thought you'd make the changeAppLabel and changeAppIcon form elements as well, in spirit/app/ then i can re-use them as is in the
// config right side panel of agent". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

test.startTest('changeAppLabel.js: one app\'s label, as a rowForm (goal/G43.15)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
  const labelOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).label : undefined; };
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/changeAppLabel.js"); }).then(function () { return !!(spirit.elements.changeAppLabel && spirit.elements.changeAppLabel.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.elements.changeAppLabel', 'it did not load: ' + short(loaded));
    if (loaded !== true) return;
    const made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "l"; document.body.appendChild(b); window.__l = spirit.elements.changeAppLabel.create(b, { key: "agent" }); return !!window.__l && typeof window.__l.destroy === "function"; }())');
    ok(made === true, 'create(host, { key }) answers { destroy }', 'it made: ' + short(made));
    const seen = function () { return chrome.evaluate('(function () { var b = document.getElementById("l"); var i = b.querySelector("input"); var btn = b.querySelector("button"); return { forms: b.querySelectorAll(".shell-row-form").length, text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), input: i ? i.value : null, button: btn ? String(btn.textContent || "").trim() : null }; }())'); };

    test.subHeading('one rowForm: [✏️] "Label" [its label in a box] [Change], as the detail draws it');
    ok(await until(function () { return seen().then(function (v) { return v.forms === 1 && v.input === 'Agent'; }); }, 10000), 'one rowForm, its box holding the app\'s label, Agent', 'drawn: ' + short(await seen()));
    const v0 = await seen();
    ok(/✏/.test(v0.text) && /Label/.test(v0.text) && v0.button === 'Change', 'with ✏️, the word Label, and a Change button', 'drawn: ' + short(v0));

    test.subHeading('the box: "writing through the app family\'s labelApp"');
    await chrome.evaluate('(function () { var i = document.querySelector("#l input"); i.value = "Zz Renamed"; i.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#l button").click(); return 1; }())');
    ok(await until(function () { return labelOf('agent').then(function (l) { return l === 'Zz Renamed'; }); }, 10000), 'Change writes the new label, and the app\'s row says it', 'the row: ' + short(await labelOf('agent')));

    test.subHeading('a label changed elsewhere shows, with no reload');
    await chrome.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur(); 1');
    await ask('app.label', { key: 'agent', label: 'Zz From Elsewhere' });
    ok(await until(function () { return seen().then(function (v) { return v.input === 'Zz From Elsewhere'; }); }, 10000), 'its box follows the row', 'drawn: ' + short(await seen()));

    const empty = await chrome.evaluate('(function () { window.__l.destroy(); return document.getElementById("l").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await seen()));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.root) require('fs').rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
