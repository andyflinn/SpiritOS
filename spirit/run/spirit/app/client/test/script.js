'use strict';

// spirit/run/spirit/app/client/test/script.js
// THE APP CACHE KEEPS run AND runOnly (goal/G43.23, item 9; spec: ./script.md). The box: "a node:run app shows as a tile
// with Activate: app/data.js drops run and runOnly (G43.21)." A real Chrome on a scratch node's face page: the app list is drawn,
// then the node's 'apps' job replaces the rows (a label written through app.label), and the run apps of the tree, pushOrigin and
// publishData, are looked at again. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until, sleep } = SPIRIT.requireScript('spirit/test/headLessChrome.js');

const APPS = path.join(RUN, 'spirit', 'app');
// An app's key is its id, its folder's path in dots (goal/G49.19): spirit.app.publishData for spirit/app/publishData.
const idOf = function (n) { return 'spirit.app.' + n; };

// data.js: a node:run app shows no tile and no Activate once the apps job has replaced its row (goal/G43.23, item 9).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
test.after(async function () {
  const chrome = W.chrome || {}, node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  await sleep(300);
  try { if (node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
  try { if (chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
const ask = async function (verb, args) { const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return { status: r.status, body: JSON.parse(await r.text()) }; } catch (e) { return { status: r.status, body: null }; } };
// The app family's reads at its client's path, spirit.app.client (goal/G49.23: the store hands out no family by name).
const held = function () { return W.chrome.evaluate('JSON.stringify(spirit.app.client.rows())').then(function (t) { try { return JSON.parse(t) || {}; } catch (e) { return {}; } }); };
// Each run-only app of the tree written out, so that each check has a plain title of its own.
const rowsOf = function (K) {
  const a = W.only.filter(function (a) { return a.key === K; })[0] || { key: K, label: K };
  const values = W.seen[a.key] || [];
  const lost = values.filter(function (r) { return !(r && r.run === true && r.runOnly === true); });
  return { a: a, values: values, lost: lost };
};
// The app detail, made now: its Activate row reads the app cache as the job left it (no list on the page to ask again).
const activateUnder = function (expr) { return W.chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
const detailOf = function (key, label) { return W.chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.search.app.detail.create(c, { row: ' + JSON.stringify({ key: key, label: label }) + ', panel: true }); return true; }())'); };
const noActivate = async function (key, label) {
  await detailOf(key, label);
  await sleep(1500);
  const n = await activateUnder('document.getElementById("detail")');
  return n === 0;
};

test.run('publishData and pushOrigin are only run, and agent mounts and may be activated', 0.2, function () {
  // The tree's apps, from each <name>.json: which are only run (node.run, neither node.mount nor shell.mount), which mount in the shell.
  const own = W.own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
    const run = !!(j.node && j.node.run === true);
    const shell = !!(j.shell && j.shell.mount === true);
    return { key: idOf(n), label: String((j.identity && j.identity.label) || n), run: run, shell: shell, intrinsic: !!(j.identity && j.identity.intrinsic === true),
      runOnly: run && !(j.node && j.node.mount === true) && !shell };
  });
  W.only = own.filter(function (a) { return a.runOnly; });
  W.plain = own.filter(function (a) { return a.shell && !a.run && !a.intrinsic; })[0];
  W.apps = W.only.length >= 1 && !!W.plain;
  return W.apps || false;
}, test.limit.quick);
test.run('a scratch node comes up with a Chrome page on its face', 0.2, async function () {
  if (!W.apps) return false;
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  W.up = true;
  return true;
}, test.limit.slow);
test.run('the app search and the app detail load', 0.2, async function () {
  if (!W.up) return false;
  const loaded = await W.chrome.evaluate('window.spirit.readyPromise.then(function () { return Promise.all([spirit.requireScript("spirit/element/search/app/script.js"), spirit.requireScript("spirit/element/search/app/detail/script.js")]); }).then(function () { return "loaded"; }, function () { return false; })');
  W.loaded = loaded === 'loaded';
  return W.loaded || false;
}, test.limit.quick);
// MOVED HERE FROM spirit/client/test/script.js (goal/G47.1, Andy: "WHERE DOES THIS STUFF BELONG?????????????"): spirit.app is the app
// branch's object, not data.js's, so its rules stand in the app branch's own test.
// Andy: "the helpes must not be words there either, this goes for all spirit.app contained objects."
// spirit.app: no helper is a word, on it or on an app it holds. The auto-verbs every bound branch has, remote, listener,
// subscribe and unsubscribe (spirit.js, goal/G47.5), are its verbs, not helpers, and are left out.
// WHAT IS AN APP, THE SYSTEM SAYS (goal/G49.23; Andy: "the test should only assert how the system must work, and the
// system has clear rules for old and new format branches and apps", "another fucking hardcoded list (in the tests) that
// will fucking break as soon as somebody makes and app at spirit/shitstrom/client/"): the apps are what the app branch's
// search answers (its searchApp, on a page), wherever in the tree they stand; each is judged at its own path on the spirit object. Nothing is named.
// goal/G43.32, the box: "Monitor too: its createApp becomes its element.js, and appSelector's createApp path goes."
test.run('spirit.app holds keys, and no app in it has a createApp, monitor\'s being its element.js', 0.2, async function () {
  if (!W.up) return false;
  try { W.onApp = JSON.parse(await W.chrome.evaluate('(function () { var S = window.spirit; var APPS = []; return Promise.all(["spirit/app/monitor/element.js"].map(function (p) { return Promise.resolve(S.requireScript(p)).then(null, function () { return null; }); })).then(function () {' +
    ' return Promise.resolve(S.requireScript("spirit/app/script.js")).then(function (b) { return b.searchApp({ q: "" }); }).then(function (r) { var rows = (r && (r.items || r.rows)) || (Array.isArray(r) ? r : []); APPS = rows.map(function (x) { return String((x && (x.key || (x.row && x.row.key))) || ""); }).filter(Boolean); }); }).then(function () {' +
    ' var out = { keys: Object.keys(S.app || {}), words: [] };' +
    ' var AUTO = ["remote", "listener", "subscribe", "unsubscribe"];' +
    ' out.keys.forEach(function (k) { var v = S.app[k]; if (typeof v === "function" && !/[A-Z]/.test(k) && AUTO.indexOf(k) === -1) out.words.push(k);' +
    ' });' +
    ' out.judged = APPS.length;' +
    ' APPS.forEach(function (key) { var v = key.split(".").slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, S); if (v && typeof v === "object") Object.keys(v).forEach(function (h) { if (typeof v[h] === "function" && !/[A-Z]/.test(h) && AUTO.indexOf(h) === -1) out.words.push(key + "." + h); }); });' +
    ' out.apps = out.keys.filter(function (k) { return S.app[k] && typeof S.app[k].createApp === "function"; });' +
    ' return JSON.stringify(out); }); })()')); } catch (e) { W.onApp = null; }
  const onApp = W.onApp || {};
  return Array.isArray(onApp.apps) && !onApp.apps.length && Array.isArray(onApp.keys) && onApp.keys.length > 0 ? true : false;
}, test.limit.quick);
test.run('no helper on spirit.app or on an app it holds is a word', 0.2, function () {
  const onApp = W.onApp || {};
  return Array.isArray(onApp.words) && !onApp.words.length && onApp.judged > 0 ? true : false;
}, test.limit.quick);

test.run('before the job the tiles draw apps, no run-only one among them', 0.2, async function () {
  if (!W.loaded) return false;
  const chrome = W.chrome, only = W.only, plain = W.plain;
  // The app list in tiles mode, drawn, so the cache holds every row app.search answered, and kept on the page while the job comes.
  await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "tiles"; document.body.appendChild(c); window.tiles = spirit.element.search.app.create(c, { face: "tiles" }); return true; }())');
  await until(function () { return held().then(function (r) { return only.every(function (a) { return !!r[a.key]; }) && !!r[plain.key]; }); }, 8000);
  await until(function () { return chrome.evaluate('document.querySelectorAll("#tiles *").length > 5'); }, 8000);
  await sleep(1000);
  // From here on: every value the cache holds for a run-only app, and every app label a tile ever draws (a MutationObserver).
  const LABELS = JSON.stringify(W.own.map(function (a) { return a.label; }));
  await chrome.evaluate('(function () { window.seen = {}; window.drawn = []; var want = window.want = ' + LABELS + ';' +
    ' ' + JSON.stringify(only.map(function (a) { return a.key; })) + '.forEach(function (k) { window.seen[k] = []; spirit.app.client.watch(k, function (r) { window.seen[k].push(r === undefined ? null : r); }); });' +
    ' function look() { var all = document.querySelectorAll("#tiles *"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && window.drawn.indexOf(t) === -1) window.drawn.push(t); } }' +
    ' look(); window.before = window.drawn; window.drawn = []; new MutationObserver(look).observe(document.getElementById("tiles"), { childList: true, subtree: true, characterData: true }); return true; }())');
  const before = JSON.parse(await chrome.evaluate('JSON.stringify(window.before)'));
  W.watching = true;
  return before.length > 0 && only.every(function (a) { return before.indexOf(a.label) === -1; }) ? true : false;
}, test.limit.slow);

// the world: the node's apps job replaces the rows the page holds
test.run('a new app.label for agent is taken', 0.2, async function () {
  if (!W.watching) return false;
  W.fresh = W.plain.label + ' ' + process.pid;
  // The observer looks for the new label too, so a tile that paints it is seen.
  await W.chrome.evaluate('window.want.push(' + JSON.stringify(W.fresh) + '), true');
  const wrote = await ask('spirit.app.label', { key: W.plain.key, label: W.fresh });
  return wrote.status === 200 ? true : false;
}, test.limit.quick);
test.run('the apps job reached the page, and agent\'s held row now says its new label', 0.2, async function () {
  if (!W.fresh) return false;
  const plain = W.plain, fresh = W.fresh;
  const replaced = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresh; }); }, 10000);
  if (!replaced) return false;
  await sleep(1500);
  W.seen = JSON.parse(await W.chrome.evaluate('JSON.stringify(window.seen)'));
  return true;
}, test.limit.slow);

// the box: "app/data.js drops run and runOnly"
test.run('the apps job wrote publishData\'s row', 0.2, function () {
  if (!W.seen) return false;
  return rowsOf(idOf('publishData')).values.length > 0 || false;
}, test.limit.quick);
test.run('every row of publishData the app cache held after the job keeps run and runOnly', 0.2, function () {
  if (!W.seen) return false;
  const ro = rowsOf(idOf('publishData'));
  return ro.values.length > 0 && !ro.lost.length ? true : false;
}, test.limit.quick);
test.run('the apps job wrote pushOrigin\'s row', 0.2, function () {
  if (!W.seen) return false;
  return rowsOf(idOf('pushOrigin')).values.length > 0 || false;
}, test.limit.quick);
test.run('every row of pushOrigin the app cache held after the job keeps run and runOnly', 0.2, function () {
  if (!W.seen) return false;
  const ro = rowsOf(idOf('pushOrigin'));
  return ro.values.length > 0 && !ro.lost.length ? true : false;
}, test.limit.quick);

// the box: "a node:run app shows as a tile with Activate"
// WHO PAINTS, LISTENS (Andy, G41.32): the tile shows what the stream said, with no search and no redraw.
test.run('once the apps job has reached the page, agent\'s tile shows its new label', 0.2, async function () {
  if (!W.seen) return false;
  W.drawn = JSON.parse(await W.chrome.evaluate('JSON.stringify(window.drawn)'));
  return W.drawn.indexOf(W.fresh) !== -1;
}, test.limit.quick);
test.run('the tiles never drew a tile for Publish Data', 0.2, function () {
  if (!W.drawn) return false;
  return W.drawn.indexOf('Publish Data') === -1 || false;
}, test.limit.quick);
test.run('the tiles never drew a tile for Push Origin', 0.2, function () {
  if (!W.drawn) return false;
  return W.drawn.indexOf('Push Origin') === -1 || false;
}, test.limit.quick);
test.run('with no list on the page, a second apps job reached it', 0.2, async function () {
  if (!W.seen) return false;
  const plain = W.plain;
  await W.chrome.evaluate('(function () { window.tiles.destroy(); var c = document.getElementById("tiles"); if (c) c.remove(); return true; }())');
  // A second apps job with no list on the page, so nothing asks app.search again: the cache as the job leaves it.
  const fresher = W.fresher = W.fresh + ' again';
  const wrote2 = await ask('spirit.app.label', { key: plain.key, label: fresher });
  const replaced2 = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresher; }); }, 10000);
  await sleep(800);
  W.after = await held();
  return wrote2.status === 200 && replaced2 ? true : false;
}, test.limit.slow);
test.run('publishData\'s row in the app cache, as the apps job left it, keeps run and runOnly', 0.2, function () {
  if (!W.after) return false;
  const r = W.after[idOf('publishData')] || {};
  return r.run === true && r.runOnly === true ? true : false;
}, test.limit.quick);
test.run('pushOrigin\'s row in the app cache, as the apps job left it, keeps run and runOnly', 0.2, function () {
  if (!W.after) return false;
  const r = W.after[idOf('pushOrigin')] || {};
  return r.run === true && r.runOnly === true ? true : false;
}, test.limit.quick);
test.run('agent\'s detail shows Activate', 0.2, async function () {
  if (!W.after) return false;
  await detailOf(W.plain.key, W.fresher);
  return await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000) ? true : false;
}, test.limit.quick);
test.run('Publish Data\'s detail shows no Activate', 0.2, async function () {
  if (!W.after) return false;
  return await noActivate(idOf('publishData'), 'Publish Data');
}, test.limit.slow);
test.run('Push Origin\'s detail shows no Activate', 0.2, async function () {
  if (!W.after) return false;
  return await noActivate(idOf('pushOrigin'), 'Push Origin');
}, test.limit.slow);
