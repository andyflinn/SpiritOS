'use strict';

// spirit/run/spirit/app/test/appSelector-nodeRun.js
// AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21; spec: ./appSelector-nodeRun.md). Andy, the box: "spirit app search will list these jobs
// (node:run) only in pane mode, bacause it they have no shell-mount. the app detail will show a run button.", and "the Andy
// user on each box will run those scripts when he feels like it". A real Chrome on a scratch node's face page, the two
// apps of the tree that say node.run, pushOrigin and publishData; neither Andy's node nor an agent's is touched. The scratch
// tree is no git clone, so a pushOrigin started there pushes nothing.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const APPS = path.join(RUN, 'spirit', 'app');

test.startTest('appSelector-nodeRun.js: an app that says node.run is listed in pane mode only, and its detail runs it (goal/G43.21)');

(async function () {
  // The tree's apps, from each <name>.json: which say node.run, and which mount as a shell app.
  const own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
    return { key: n, label: String((j.identity && j.identity.label) || n), icon: String((j.identity && j.identity.icon) || ''), run: !!(j.node && j.node.run === true), shell: !!(j.shell && j.shell.mount === true) };
  });
  const runs = own.filter(function (a) { return a.run; });
  const mounts = own.filter(function (a) { return a.shell && !a.run; });
  ok(runs.length >= 2 && mounts.length >= 1, 'the world: ' + runs.map(function (a) { return a.key; }).join(', ') + ' say node.run; ' + mounts.length + ' apps mount in the shell', 'nothing to judge with: ' + short(own));
  if (!runs.length || !mounts.length) return;
  const PUSH = own.filter(function (a) { return a.key === 'pushOrigin'; })[0];
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.all([spirit.require("spirit/element/search/app.js"), spirit.require("spirit/app/appSelector/detailElement.js")]); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'the world: the app search and the app detail load', 'they did not load: ' + short(loaded));
    // The app labels drawn anywhere under an element: its leaves whose text is an app's label.
    const LABELS = JSON.stringify(own.map(function (a) { return a.label; }));
    const drawnUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return []; var want = ' + LABELS + '; var out = []; var all = root.querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return out.sort(); }())'); };
    const has = function (list, a) { return list.indexOf(a.label) !== -1; };

    test.subHeading('Andy: "spirit app search will list these jobs (node:run) only in pane mode"');
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "pane"; document.body.appendChild(c); window.pane = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
    await until(function () { return drawnUnder('document.getElementById("pane")').then(function (d) { return runs.every(function (a) { return has(d, a); }); }); }, 8000);
    const inPane = await drawnUnder('document.getElementById("pane")');
    runs.forEach(function (a) { ok(has(inPane, a), 'the pane lists ' + a.label, 'the pane does not list ' + a.label + ': ' + short(inPane)); });
    await chrome.evaluate('(function () { window.pane.destroy(); var c = document.getElementById("pane"); if (c) c.remove(); return true; }())');
    // The dropdown, pressed open: its list floats, so the whole page is read, with nothing else of the test on it.
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "drop"; document.body.appendChild(c); window.drop = spirit.element.spirit.element.search.app.create(c, { face: "dropdown" }); return true; }())');
    await sleep(800);
    await chrome.evaluate('(function () { var d = window.drop, f = (d && d.list && d.list.field) || document.querySelector("#drop input, #drop [tabindex], #drop button"); if (f) f.click(); return !!f; }())');
    await until(function () { return drawnUnder('document.body').then(function (d) { return mounts.some(function (a) { return has(d, a); }); }); }, 8000);
    const inDrop = await drawnUnder('document.body');
    ok(mounts.some(function (a) { return has(inDrop, a); }), 'the world: pressed, the dropdown lists the apps that mount (' + inDrop.length + ')', 'the dropdown listed no app at all: nothing judged. ' + short(inDrop));
    runs.forEach(function (a) { ok(!has(inDrop, a), 'the dropdown does not list ' + a.label, 'the dropdown lists ' + a.label + ': ' + short(inDrop)); });
    await chrome.evaluate('(function () { window.drop.destroy(); var c = document.getElementById("drop"); if (c) c.remove(); return true; }())');

    test.subHeading('Andy: "the app detail will show a run button"');
    // A Run button: a button whose own text is Run.
    const runButton = 'Array.prototype.filter.call(document.querySelectorAll("#detail button"), function (b) { return /\\bRun\\b/.test(String(b.textContent || "")); })[0]';
    const detailOf = function (a) { return chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.spirit.app.appSelector.detailElement.create(c, { row: ' + JSON.stringify({ key: a.key, label: a.label, icon: a.icon }) + ', panel: true }); return true; }())'); };
    for (const a of runs) {
      await detailOf(a);
      const shown = await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
      ok(shown, a.label + '\'s detail shows a Run button', a.label + '\'s detail shows no Run: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)')));
    }
    const plain = mounts[0];
    await detailOf(plain);
    await sleep(1500);
    const drew = await chrome.evaluate('String(document.getElementById("detail").innerText || "").indexOf(' + JSON.stringify(plain.label) + ') !== -1');
    const noRun = await chrome.evaluate('!(' + runButton + ')');
    ok(drew && noRun, plain.label + ', which mounts and says no node.run, shows no Run', plain.label + '\'s detail: ' + short(await chrome.evaluate('String(document.getElementById("detail").innerText)')));

    // Andy: "in the app list and details: an app that only has node:run and no node:mount or shell:mount cannot be "activated"
    // show rowForms should knows that.", and "and the node should know it, too."
    test.subHeading('Andy: "an app that only has node:run and no node:mount or shell:mount cannot be "activated""');
    // An Activate or Deactivate row seen under an element: a leaf whose words start so (rowFormAppActive's "Activate <label> ...").
    const activateUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
    const only = runs.filter(function (a) { return !own.filter(function (o) { return o.key === a.key; }).some(function (o) { return o.shell; }); });
    // The row of an app in a pane list: the smallest element holding its label and a button, or its label alone.
    const rowOf = function (label) { return '(function () { var all = document.querySelectorAll("#rows tr, #rows .list-row"); for (var i = 0; i < all.length; i++) { if (String(all[i].innerText || "").indexOf(' + JSON.stringify(label) + ') !== -1) return all[i]; } return null; }())'; };
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "rows"; document.body.appendChild(c); window.rows = spirit.element.spirit.element.search.app.create(c, { face: "pane" }); return true; }())');
    await until(function () { return activateUnder(rowOf(plain.label)).then(function (n) { return n > 0; }); }, 8000);
    ok((await activateUnder(rowOf(plain.label))) > 0, 'the world: ' + plain.label + '\'s row in the app list shows Activate', plain.label + '\'s row shows no Activate: nothing judged');
    for (const a of only) {
      // What it mounts is read from its <name>.json after the row is drawn: given the time that takes.
      await until(function () { return activateUnder(rowOf(a.label)).then(function (n) { return n === 0; }); }, 4000);
      const n = await activateUnder(rowOf(a.label));
      ok(n === 0, a.label + '\'s row in the app list shows no Activate', a.label + '\'s row shows ' + short(n) + ' Activate buttons');
    }
    await chrome.evaluate('(function () { window.rows.destroy(); var c = document.getElementById("rows"); if (c) c.remove(); return true; }())');
    await detailOf(plain);
    ok(await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000), 'the world: ' + plain.label + '\'s detail shows Activate', plain.label + '\'s detail shows no Activate: nothing judged');
    for (const a of only) {
      await detailOf(a);
      await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
      await sleep(800);
      const n = await activateUnder('document.getElementById("detail")');
      ok(n === 0, a.label + '\'s detail shows no Activate', a.label + '\'s detail shows ' + short(n) + ' Activate buttons');
    }
    test.subHeading('a press runs it, active or not');
    if (!PUSH || !PUSH.run) { test.fail('pushOrigin says no node.run: nothing to press'); return; }
    // Every job the node holds, each read whole, its module with it.
    const jobsOf = async function () { const got = await ask('jobs.search', { q: '' }); const out = []; for (const i of ((got && got.items) || [])) out.push(await ask('jobs.get', { key: i.key })); return JSON.stringify(out); };
    const before = await jobsOf();
    ok(before.indexOf('spirit.app.pushOrigin') === -1, 'the world: no job of pushOrigin before the press', 'a job of pushOrigin is there already: nothing judged');
    const activeNow = await ask('app.search', { q: '' });
    const pushRow = ((activeNow && activeNow.items) || []).filter(function (i) { return i.key === 'pushOrigin'; })[0];
    let pushActive;
    try { pushActive = JSON.parse(pushRow.label).active; } catch (e) { pushActive = undefined; }
    ok(pushActive !== true, 'the world: pushOrigin is not active on this node', 'pushOrigin is active here: the press would not show that Run asks for no activation');
    await detailOf(PUSH);
    await until(function () { return chrome.evaluate('!!(' + runButton + ')'); }, 6000);
    const pressed = await chrome.evaluate('(function () { var b = ' + runButton + '; if (!b) return false; b.click(); return true; }())');
    ok(pressed === true, 'its Run can be pressed', 'no Run to press');
    const started = await until(function () { return jobsOf().then(function (j) { return j.indexOf('spirit.app.pushOrigin') !== -1; }); }, 10000);
    ok(started, 'the press starts spirit/app/pushOrigin/pushOrigin.js, a job of spirit.app.pushOrigin, though the app is not active', 'no job of pushOrigin after the press: ' + short(await jobsOf()));

    // Andy: "and the node should know it, too." Asked last, since a node that takes it would leave the app active.
    test.subHeading('Andy: "and the node should know it, too."');
    for (const a of only) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: a.key, active: true } }) });
      const t = await r.text();
      const listed = await ask('app.search', { q: '' });
      const row = ((listed && listed.items) || []).filter(function (i) { return i.key === a.key; })[0];
      let now;
      try { now = JSON.parse(row.label).active; } catch (e) { now = undefined; }
      ok(r.status >= 400 && now !== true, 'the node refuses app.active for ' + a.key + ', and it stays inactive', 'app.active for ' + a.key + ' answered ' + r.status + ' ' + short(t) + ', active now ' + short(now));
    }
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
