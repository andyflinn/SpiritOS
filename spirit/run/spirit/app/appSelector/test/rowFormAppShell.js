'use strict';

// spirit/run/spirit/app/appSelector/test/rowFormAppShell.js
// The tests of spirit/app/appSelector/rowFormAppShell.js, and of no other module (spec: ./rowFormAppShell.md; goal/G43.15). Andy:
// "correct, so does, allow mount-as-shell..": a rowFormToggle hidden when the app does not mount on the shell. A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const NOSHELL = 'zznoshell';

test.startTest('rowFormAppShell.js: allow mount-as-shell, hidden when the app does not mount on the shell (goal/G43.15)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); return parsed(await r.text()); };
  const shellOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; return r ? (parsed(r.label) || {}).shell : undefined; };
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    if (!node.root) { test.fail('the scratch node is shared, so no app of the test\'s own can be planted: nothing judged'); return; }
    // An app of the test's own that does not mount on the shell, planted on the scratch node's disc; the app family reads the disc.
    const dir = path.join(node.root, 'spirit', 'run', 'spirit', 'app', NOSHELL);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, NOSHELL + '.json'), JSON.stringify({ identity: { icon: '🚫', label: 'Zz No Shell', intrinsic: false }, mount: { [NOSHELL + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: false } }));
    fs.writeFileSync(path.join(dir, NOSHELL + '.js'), '');
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/rowFormAppShell.js"); }).then(function () { return !!(spirit.elements.rowFormAppShell && spirit.elements.rowFormAppShell.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.elements.rowFormAppShell', 'it did not load: ' + short(loaded));
    if (loaded !== true) return;
    const make = function (key) { return chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "s-' + key + '"; document.body.appendChild(b); window["s_' + key + '"] = spirit.elements.rowFormAppShell.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["s_' + key + '"] && typeof window["s_' + key + '"].destroy === "function"; }())'); };
    const view = function (key) { return chrome.evaluate('(function () { var b = document.getElementById("s-' + key + '"); var r = b.getBoundingClientRect(); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), height: r.height }; }())'); };

    test.subHeading('the box: "hidden when the app does not mount on the shell"');
    ok((await make(NOSHELL)) === true, 'create(host, { key }) answers { destroy }', 'it made nothing');
    await sleep(2000);
    const n0 = await view(NOSHELL);
    ok(n0.text === '' && n0.height === 0, 'for an app with shell.mount false it shows nothing and takes no space', 'for ' + NOSHELL + ': ' + short(n0));

    test.subHeading('for an app that mounts on the shell: Allow, then Don\'t allow');
    await make('agent');
    ok(await until(function () { return view('agent').then(function (v) { return /Allow Agent as shell/.test(v.text) && !/Don't allow/.test(v.text); }); }, 10000), 'for the Agent, not allowed, it says Allow Agent as shell', 'for the Agent: ' + short(await view('agent')));
    await chrome.evaluate('document.querySelector("#s-agent button").click(); 1');
    ok(await until(function () { return shellOf('agent').then(function (v) { return v === true; }); }, 10000), 'pressed, the Agent may mount as shell', 'the Agent\'s row: ' + short(await shellOf('agent')));
    ok(await until(function () { return view('agent').then(function (v) { return /Don't allow Agent as shell/.test(v.text); }); }, 10000), 'and it says Don\'t allow Agent as shell', 'after the press: ' + short(await view('agent')));
    await chrome.evaluate('document.querySelector("#s-agent button").click(); 1');
    ok(await until(function () { return shellOf('agent').then(function (v) { return v === false; }); }, 10000), 'pressed again, it may not', 'the Agent\'s row: ' + short(await shellOf('agent')));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
