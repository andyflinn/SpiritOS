'use strict';

// spirit/run/spirit/app/test/data.js
// THE APP CACHE KEEPS run AND runOnly (goal/G43.23, item 9; spec: ./data.md). The box: "a node:run app shows as a tile
// with Activate: app/data.js drops run and runOnly (G43.21)." A real Chrome on a scratch node's face page: the app list is drawn,
// then the node's 'apps' job replaces the rows (a label written through app.label), and the run apps of the tree, pushOrigin and
// publishData, are looked at again. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const APPS = path.join(RUN, 'spirit', 'app');

// data.js: a node:run app shows no tile and no Activate once the apps job has replaced its row (goal/G43.23, item 9).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
test.after(async function () {
  const chrome = W.chrome || {}, node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  await sleep(300);
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
  try { if (chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
const NO_PAGE = 'no page: the world failed';
const NO_JOB = 'no apps job reached the page: the world failed';
const ask = async function (verb, args) { const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return { status: r.status, body: JSON.parse(await r.text()) }; } catch (e) { return { status: r.status, body: null }; } };
const held = function () { return W.chrome.evaluate('JSON.stringify(spirit.data.app.data.rows())').then(function (t) { try { return JSON.parse(t) || {}; } catch (e) { return {}; } }); };
// Each run-only app of the tree written out, so that each check has a plain title of its own.
const rowsOf = function (K) {
  const a = W.only.filter(function (a) { return a.key === K; })[0] || { key: K, label: K };
  const values = W.seen[a.key] || [];
  const lost = values.filter(function (r) { return !(r && r.run === true && r.runOnly === true); });
  return { a: a, values: values, lost: lost };
};
// The app detail, made now: its Activate row reads the app cache as the job left it (no list on the page to ask again).
const activateUnder = function (expr) { return W.chrome.evaluate('(function () { var root = ' + expr + '; if (!root) return null; return Array.prototype.filter.call(root.querySelectorAll("*"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length; }())'); };
const detailOf = function (key, label) { return W.chrome.evaluate('(function () { var old = document.getElementById("detail"); if (window.det) { window.det.destroy(); } if (old) old.remove(); var c = document.createElement("div"); c.id = "detail"; document.body.appendChild(c); window.det = spirit.element.spirit.element.search.app.detailElement.create(c, { row: ' + JSON.stringify({ key: key, label: label }) + ', panel: true }); return true; }())'); };
const noActivate = async function (key, label) {
  await detailOf(key, label);
  await sleep(1500);
  const n = await activateUnder('document.getElementById("detail")');
  return { fine: n === 0, why: label + '\'s detail shows ' + short(n) + ' Activate after the apps job' };
};

test.run('the world: publishData and pushOrigin are only run; agent mounts and may be activated', 0.2, function () {
  // The tree's apps, from each <name>.json: which are only run (node.run, neither node.mount nor shell.mount), which mount in the shell.
  const own = W.own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); } catch (e) { j = {}; }
    const run = !!(j.node && j.node.run === true);
    const shell = !!(j.shell && j.shell.mount === true);
    return { key: n, label: String((j.identity && j.identity.label) || n), run: run, shell: shell, intrinsic: !!(j.identity && j.identity.intrinsic === true),
      runOnly: run && !(j.node && j.node.mount === true) && !shell };
  });
  W.only = own.filter(function (a) { return a.runOnly; });
  W.plain = own.filter(function (a) { return a.shell && !a.run && !a.intrinsic; })[0];
  W.apps = W.only.length >= 1 && !!W.plain;
  return W.apps || 'nothing to judge with: ' + short(own);
}, test.limit.quick);
test.run('the world: a scratch node and a Chrome page on its face', 0.2, async function () {
  if (!W.apps) return 'no apps to judge with: the world failed';
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.node.up || W.chrome.error) return 'no scratch node or no Chrome: nothing judged. ' + short(W.chrome.error || '');
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  W.up = true;
  return true;
}, test.limit.slow);
test.run('the world: the app search and the app detail load', 0.2, async function () {
  if (!W.up) return NO_PAGE;
  const loaded = await W.chrome.evaluate('window.spirit.ready.then(function () { return Promise.all([spirit.require("spirit/element/search/app.js"), spirit.require("spirit/element/search/app/detailElement.js")]); }).then(function () { return "loaded"; }, function (e) { return String(e && e.message || e); })');
  W.loaded = loaded === 'loaded';
  return W.loaded || 'they did not load: ' + short(loaded);
}, test.limit.quick);
test.run('the world: before the job the tiles draw apps, no run-only one among them', 0.2, async function () {
  if (!W.loaded) return NO_PAGE;
  const chrome = W.chrome, only = W.only, plain = W.plain;
  // The app list in tiles mode, drawn, so the cache holds every row app.search answered, and kept on the page while the job comes.
  await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "tiles"; document.body.appendChild(c); window.tiles = spirit.element.spirit.element.search.app.create(c, { face: "tiles" }); return true; }())');
  await until(function () { return held().then(function (r) { return only.every(function (a) { return !!r[a.key]; }) && !!r[plain.key]; }); }, 8000);
  await until(function () { return chrome.evaluate('document.querySelectorAll("#tiles *").length > 5'); }, 8000);
  await sleep(1000);
  // From here on: every value the cache holds for a run-only app, and every app label a tile ever draws (a MutationObserver).
  const LABELS = JSON.stringify(W.own.map(function (a) { return a.label; }));
  await chrome.evaluate('(function () { window.seen = {}; window.drawn = []; var want = ' + LABELS + ';' +
    ' ' + JSON.stringify(only.map(function (a) { return a.key; })) + '.forEach(function (k) { window.seen[k] = []; spirit.data.app.data.watch(k, function (r) { window.seen[k].push(r === undefined ? null : r); }); });' +
    ' function look() { var all = document.querySelectorAll("#tiles *"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && window.drawn.indexOf(t) === -1) window.drawn.push(t); } }' +
    ' look(); window.before = window.drawn; window.drawn = []; new MutationObserver(look).observe(document.getElementById("tiles"), { childList: true, subtree: true, characterData: true }); return true; }())');
  const before = JSON.parse(await chrome.evaluate('JSON.stringify(window.before)'));
  W.watching = true;
  return before.length > 0 && only.every(function (a) { return before.indexOf(a.label) === -1; }) ? true : 'before the job the tiles draw ' + short(before) + ': nothing judged';
}, test.limit.slow);

// the world: the node's apps job replaces the rows the page holds
test.run('the world: app.label for agent is taken', 0.2, async function () {
  if (!W.watching) return NO_PAGE;
  W.fresh = W.plain.label + ' ' + process.pid;
  const wrote = await ask('app.label', { key: W.plain.key, label: W.fresh });
  return wrote.status === 200 ? true : 'app.label of ' + W.plain.key + ' answered ' + wrote.status + ' ' + short(wrote.body) + ': nothing judged';
}, test.limit.quick);
test.run('the world: the apps job reached the page, agent\'s held row now says its new label', 0.2, async function () {
  if (!W.fresh) return NO_PAGE;
  const plain = W.plain, fresh = W.fresh;
  const replaced = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresh; }); }, 10000);
  if (!replaced) return 'no apps job reached the page: ' + plain.key + ' still holds ' + short((await held())[plain.key]) + ', not ' + fresh + ': nothing judged';
  await sleep(1500);
  W.seen = JSON.parse(await W.chrome.evaluate('JSON.stringify(window.seen)'));
  return true;
}, test.limit.slow);

// the box: "app/data.js drops run and runOnly"
test.run('the world: the apps job wrote publishData\'s row', 0.2, function () {
  if (!W.seen) return NO_JOB;
  return rowsOf('publishData').values.length > 0 || 'no write of publishData\'s row after the job: nothing judged';
}, test.limit.quick);
test.run('every row of publishData the app cache held after the job keeps run and runOnly', 0.2, function () {
  if (!W.seen) return NO_JOB;
  const ro = rowsOf('publishData');
  return ro.values.length > 0 && !ro.lost.length ? true : 'publishData\'s row in the app cache, after the apps job, held without them: ' + short(ro.lost[0]);
}, test.limit.quick);
test.run('the world: the apps job wrote pushOrigin\'s row', 0.2, function () {
  if (!W.seen) return NO_JOB;
  return rowsOf('pushOrigin').values.length > 0 || 'no write of pushOrigin\'s row after the job: nothing judged';
}, test.limit.quick);
test.run('every row of pushOrigin the app cache held after the job keeps run and runOnly', 0.2, function () {
  if (!W.seen) return NO_JOB;
  const ro = rowsOf('pushOrigin');
  return ro.values.length > 0 && !ro.lost.length ? true : 'pushOrigin\'s row in the app cache, after the apps job, held without them: ' + short(ro.lost[0]);
}, test.limit.quick);

// the box: "a node:run app shows as a tile with Activate"
test.run('the world: the tiles drew app labels', 0.2, async function () {
  if (!W.seen) return NO_JOB;
  W.drawn = JSON.parse(await W.chrome.evaluate('JSON.stringify(window.drawn)'));
  return W.drawn.indexOf(W.fresh) !== -1 || W.drawn.length > 0 ? true : 'the tiles drew no app at all: nothing judged';
}, test.limit.quick);
test.run('the tiles never drew a tile for Publish Data', 0.2, function () {
  if (!W.drawn) return NO_JOB;
  return W.drawn.indexOf('Publish Data') === -1 || 'the tiles drew Publish Data once the apps job came: ' + short(W.drawn);
}, test.limit.quick);
test.run('the tiles never drew a tile for Push Origin', 0.2, function () {
  if (!W.drawn) return NO_JOB;
  return W.drawn.indexOf('Push Origin') === -1 || 'the tiles drew Push Origin once the apps job came: ' + short(W.drawn);
}, test.limit.quick);
test.run('the world: with no list on the page a second apps job reached it', 0.2, async function () {
  if (!W.seen) return NO_JOB;
  const plain = W.plain;
  await W.chrome.evaluate('(function () { window.tiles.destroy(); var c = document.getElementById("tiles"); if (c) c.remove(); return true; }())');
  // A second apps job with no list on the page, so nothing asks app.search again: the cache as the job leaves it.
  const fresher = W.fresher = W.fresh + ' again';
  const wrote2 = await ask('app.label', { key: plain.key, label: fresher });
  const replaced2 = await until(function () { return held().then(function (r) { return !!r[plain.key] && r[plain.key].label === fresher; }); }, 10000);
  await sleep(800);
  W.after = await held();
  return wrote2.status === 200 && replaced2 ? true : 'the second apps job did not reach the page: ' + wrote2.status + ': nothing judged';
}, test.limit.slow);
test.run('publishData\'s row in the app cache, as the apps job left it, keeps run and runOnly', 0.2, function () {
  if (!W.after) return NO_JOB;
  const r = W.after['publishData'] || {};
  return r.run === true && r.runOnly === true ? true : 'publishData\'s row, as the apps job left it: ' + short(r);
}, test.limit.quick);
test.run('pushOrigin\'s row in the app cache, as the apps job left it, keeps run and runOnly', 0.2, function () {
  if (!W.after) return NO_JOB;
  const r = W.after['pushOrigin'] || {};
  return r.run === true && r.runOnly === true ? true : 'pushOrigin\'s row, as the apps job left it: ' + short(r);
}, test.limit.quick);
test.run('the world: agent\'s detail shows Activate', 0.2, async function () {
  if (!W.after) return NO_JOB;
  await detailOf(W.plain.key, W.fresher);
  return await until(function () { return activateUnder('document.getElementById("detail")').then(function (n) { return n > 0; }); }, 6000) ? true : W.plain.key + '\'s detail shows no Activate: nothing judged';
}, test.limit.quick);
test.run('Publish Data\'s detail shows no Activate', 0.2, async function () {
  if (!W.after) return NO_JOB;
  const na = await noActivate('publishData', 'Publish Data');
  return na.fine || na.why;
}, test.limit.slow);
test.run('Push Origin\'s detail shows no Activate', 0.2, async function () {
  if (!W.after) return NO_JOB;
  const na = await noActivate('pushOrigin', 'Push Origin');
  return na.fine || na.why;
}, test.limit.slow);
