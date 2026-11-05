'use strict';

// spirit/run/spirit/app/appSelector/test/rowFormAppActive.js
// The tests of spirit/app/appSelector/rowFormAppActive.js, and of no other module (spec: ./rowFormAppActive.md; goal/G43.15). Andy:
// "the "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element
// can forget to hide it....". A real Chrome on a scratch node's face page; neither Andy's node nor an agent's is touched.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

test.startTest('rowFormAppActive.js: Activate/Deactivate for one app, hidden when it is intrinsic (goal/G43.15)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
  const activeOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).active : undefined; };
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/rowFormAppActive.js"); }).then(function () { return !!(spirit.elements.rowFormAppActive && spirit.elements.rowFormAppActive.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.elements.rowFormAppActive', 'it did not load: ' + short(loaded));
    if (loaded === true) {
      const make = function (key) { return chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "a-' + key + '"; document.body.appendChild(b); window["a_' + key + '"] = spirit.elements.rowFormAppActive.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["a_' + key + '"] && typeof window["a_' + key + '"].destroy === "function"; }())'); };
      const view = function (key) { return chrome.evaluate('(function () { var b = document.getElementById("a-' + key + '"); var r = b.getBoundingClientRect(); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), height: r.height }; }())'); };

      test.subHeading('the box: "hidden when the app is intrinsic"');
      ok((await make('contact')) === true, 'create(host, { key }) answers { destroy }', 'it made nothing for contact');
      await sleep(2000);
      const c0 = await view('contact');
      ok(c0.text === '' && c0.height === 0, 'for Contacts, intrinsic, it shows nothing and takes no space', 'for Contacts: ' + short(c0));

      test.subHeading('for an app that is not intrinsic: Activate, then Deactivate');
      await make('agent');
      ok(await until(function () { return view('agent').then(function (v) { return /Activate/.test(v.text) && !/Deactivate/.test(v.text) && v.text.indexOf('Agent') !== -1; }); }, 10000), 'for the Agent, off, it says Activate and the app\'s label', 'for the Agent: ' + short(await view('agent')));
      await chrome.evaluate('document.querySelector("#a-agent button").click(); 1');
      ok(await until(function () { return activeOf('agent').then(function (a) { return a === true; }); }, 10000), 'pressed, the Agent is active', 'the Agent\'s row: ' + short(await activeOf('agent')));
      ok(await until(function () { return view('agent').then(function (v) { return /Deactivate/.test(v.text); }); }, 10000), 'and it says Deactivate', 'after the press: ' + short(await view('agent')));
      await chrome.evaluate('document.querySelector("#a-agent button").click(); 1');
      ok(await until(function () { return activeOf('agent').then(function (a) { return a === false; }); }, 10000), 'pressed again, it is not', 'the Agent\'s row: ' + short(await activeOf('agent')));
    }

    test.subHeading('the box: "The appSelector\'s detail and its rows use them": no Activate on an intrinsic app\'s row');
    const listed = await chrome.evaluate('spirit.require("spirit/app/appSelector.js").then(function () { var b = document.createElement("div"); b.id = "pane"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); window.__sel = spirit.elements.appSelector.create(b, { face: "pane" }); return true; })');
    ok(listed === true, 'the world: the appSelector\'s pane is made', 'no pane: ' + short(listed));
    // Each row of the pane, its text and the button it holds.
    const rows = function () { return chrome.evaluate('(function () { var out = {}; Array.prototype.slice.call(document.querySelectorAll("#pane tr, #pane [data-key]")).forEach(function (r) { var t = String(r.innerText || "").replace(/\\s+/g, " ").trim(); ["Contacts", "Agent"].forEach(function (n) { if (t.indexOf(n) !== -1 && !out[n]) out[n] = { text: t, buttons: Array.prototype.map.call(r.querySelectorAll("button"), function (x) { return String(x.textContent || "").trim(); }) }; }); }); return out; }())'); };
    ok(await until(function () { return rows().then(function (r) { return !!r.Contacts && !!r.Agent; }); }, 10000), 'the world: the pane lists Contacts and the Agent', 'the pane: ' + short(await rows()));
    const r = await rows();
    ok(!!r.Agent && r.Agent.buttons.some(function (b) { return /Activate/.test(b); }), 'the Agent\'s row has its Activate', 'the Agent\'s row: ' + short(r.Agent));
    ok(!!r.Contacts && !r.Contacts.buttons.some(function (b) { return /Activate|Deactivate/.test(b); }), 'Contacts\' row has no Activate and no Deactivate', 'Contacts\' row: ' + short(r.Contacts));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.root) require('fs').rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
