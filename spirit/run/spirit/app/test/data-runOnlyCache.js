'use strict';

// spirit/run/spirit/app/test/data-runOnlyCache.js
// THE APP CACHE KEEPS run AND runOnly (goal/G43.23, item 9; spec: ./data-runOnlyCache.md). The box: "a node:run app shows as a tile
// with Activate: app/data.js drops run and runOnly (G43.21)." A real Chrome on a scratch node's face page: the app list is drawn,
// then the node's 'apps' job replaces the rows (a label written through app.label), and the run apps of the tree, pushOrigin and
// publishData, are looked at again. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const APPS = path.join(RUN, 'spirit', 'app');

test.startTest('data-runOnlyCache.js: a node:run app shows no tile and no Activate once the apps job has replaced its row (goal/G43.23, item 9)');

(async function () {
  // The tree's apps, from each <name>.json: which are only run (node.run, neither node.mount nor shell.mount), which mount in the shell.
  const own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
    const run = !!(j.node && j.node.run === true);
    const shell = !!(j.shell && j.shell.mount === true);
    return { key: n, label: String((j.identity && j.identity.label) || n), run: run, shell: shell, intrinsic: !!(j.identity && j.identity.intrinsic === true),
      runOnly: run && !(j.node && j.node.mount === true) && !shell };
  });
  const only = own.filter(function (a) { return a.runOnly; });
  const plain = own.filter(function (a) { return a.shell && !a.run && !a.intrinsic; })[0];
  ok(only.length >= 1 && !!plain, 'the world: ' + only.map(function (a) { return a.key; }).join(', ') + ' are only run; ' + (plain && plain.key) + ' mounts and may be activated', 'nothing to judge with: ' + short(own));
  if (!only.length || !plain) return;
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return { status: r.status, body: JSON.parse(await r.text()) }; } catch (e) { return { status: r.status, body: null }; } };
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.all([spirit.require("spirit/element/search/app.js"), spirit.require("spirit/app/appSelector/detailElement.js")]); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'the world: the app search and the app detail load', 'they did not load: ' + short(loaded));
    const held = function () { return chrome.evaluate('JSON.stringify(spirit.data.app.data.rows())').then(function (t) { try { return JSON.parse(t) || {}; } catch (e) { return {}; } }); };
    // The app list in tiles mode, drawn, so the cache holds every row app.search answered, and kept on the page while the job comes.
    await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "tiles"; document.body.appendChild(c); window.tiles = spirit.element.spirit.element.search.app.create(c, { face: "tiles" }); return true; }())');
    await until(function () { return held().then(function (r) { return only.every(function (a) { return !!r[a.key]; }) && !!r[plain.key]; }); }, 8000);
    await until(function () { return chrome.evaluate('document.querySelectorAll("#tiles *").length > 5'); }, 8000);
    await sleep(1000);
    // From here on: every value the cache holds for a run-only app, and every app label a tile ever draws (a MutationObserver).
    const LABELS = JSON.stringify(own.map(function (a) { return a.label; }));
    await chrome.evaluate('(function () { window.seen = {}; window.drawn = []; var want = ' + LABELS + ';' +
      ' ' + JSON.stringify(only.map(function (a) { return a.key; })) + '.forEach(function (k) { window.seen[k] = []; spirit.data.app.data.watchApp(k, function (r) { window.seen[k].push(r === undefined ? null : r); }); });' +
      ' function look() { var all = document.querySelectorAll("#tiles *"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && window.drawn.indexOf(t) === -1) window.drawn.push(t); } }' +
      ' look(); window.before = window.drawn; window.drawn = []; new MutationObserver(look).observe(document.getElementById("tiles"), { childList: true, subtree: true, characterData: true }); return true; }())');
    const before = JSON.parse(await chrome.evaluate('JSON.stringify(window.before)'));
    ok(before.length > 0 && only.every(function (a) { return before.indexOf(a.label) === -1; }), 'the world: before the job the tiles draw ' + before.length + ' apps, no run-only one among them',
      'before the job the tiles draw ' + short(before) + ': nothing judged');

    test.subHeading('the world: the node\'s apps job replaces the rows the page holds');
    const fresh = plain.label + ' ' + process.pid;
    const wrote = await ask('app.label', { key: plain.key, label: fresh });
    ok(wrote.status === 200, 'the world: app.label for ' + plain.key + ' is taken', 'app.label answered ' + wrote.status + ' ' + short(wrote.body) + ': nothing judged');
    const replaced = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresh; }); }, 10000);
    ok(replaced, 'the world: the apps job reached the page, ' + plain.key + '\'s held row now says ' + fresh, 'no apps job reached the page: ' + plain.key + ' still holds ' + short((await held())[plain.key]) + ': nothing judged');
    if (!replaced) return;
    await sleep(1500);
    const seen = JSON.parse(await chrome.evaluate('JSON.stringify(window.seen)'));

    test.subHeading('the box: "app/data.js drops run and runOnly"');
    only.forEach(function (a) {
      const values = seen[a.key] || [];
      ok(values.length > 0, 'the world: the apps job wrote ' + a.key + '\'s row (' + values.length + ' writes)', 'no write of ' + a.key + '\'s row after the job: nothing judged');
      const lost = values.filter(function (r) { return !(r && r.run === true && r.runOnly === true); });
      ok(values.length > 0 && !lost.length, 'every row of ' + a.key + ' the app cache held after the job keeps run and runOnly', a.key + '\'s row in the app cache, after the apps job, held without them: ' + short(lost[0]));
    });

    test.subHeading('the box: "a node:run app shows as a tile with Activate"');
    const drawn = JSON.parse(await chrome.evaluate('JSON.stringify(window.drawn)'));
    ok(drawn.indexOf(fresh) !== -1 || drawn.length > 0, 'the world: the tiles drew ' + drawn.length + ' app labels', 'the tiles drew no app at all: nothing judged');
    only.forEach(function (a) { ok(drawn.indexOf(a.label) === -1, 'the tiles never drew a tile for ' + a.label, 'the tiles drew ' + a.label + ' once the apps job came: ' + short(drawn)); });
    await chrome.evaluate('(function () { window.tiles.destroy(); var c = document.getElementById("tiles"); if (c) c.remove(); return true; }())');
    // A second apps job with no list on the page, so nothing asks app.search again: the cache as the job leaves it.
    const fresher = fresh + ' again';
    const wrote2 = await ask('app.label', { key: plain.key, label: fresher });
    const replaced2 = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresher; }); }, 10000);
    ok(wrote2.status === 200 && replaced2, 'the world: with no list on the page a second apps job reached it', 'the second apps job did not reach the page: ' + wrote2.status + ': nothing judged');
    await sleep(800);
    const after = await held();
    only.forEach(function (a) {
      const r = after[a.key] || {};
      ok(r.run === true && r.runOnly === true, a.key + '\'s row in the app cache, as the apps job left it, keeps run and runOnly', a.key + '\'s row, as the apps job left it: ' + short(r));
    });
    // The app detail, made now: its Activate row reads the app cache as the job left it (no list on the page to ask again).
    const activateUnder = function (expr) { return chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
    const detailOf = function (key, label) { return chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.spirit.app.appSelector.detailElement.create(c, { row: ' + JSON.stringify({ key: key, label: label }) + ', panel: true }); return true; }())'); };
    await detailOf(plain.key, fresher);
    ok(await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000), 'the world: ' + plain.key + '\'s detail shows Activate', plain.key + '\'s detail shows no Activate: nothing judged');
    for (const a of only) {
      await detailOf(a.key, a.label);
      await sleep(1500);
      const n = await activateUnder('document.getElementById("detail")');
      ok(n === 0, a.label + '\'s detail shows no Activate', a.label + '\'s detail shows ' + short(n) + ' Activate after the apps job');
    }
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
