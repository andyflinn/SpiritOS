'use strict';

// spirit/run/spirit/element/search/app/test/script.js
// The tests of spirit/element/search/app/script.js, and of no other module (spec: ./script.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');

const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'script.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, text, identity, own, mounted, MOUNT, drawnIn, press, plainNow, want;
const ask = async function (verb, args) { const r = await fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
const activeOf = async function (k) { const got = await ask('spirit.app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; let v = null; try { v = JSON.parse(r.label); } catch (e) { /* none */ } return v ? v.active : undefined; };
// Which of the apps are active, as the node answers; the filter's set is that and node.mount, from the tree.
const wantOn = async function () { const out = []; for (const a of mounted) { if ((await activeOf(a.key)) === true) out.push(a.label); } return out.sort(); };

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* scratch */ }
});
test.run('a scratch node comes up with Chrome on its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) { chrome = chrome.error ? (chrome.kid ? chrome : null) : chrome; return false; }
  await chrome.send('Page.navigate', { url: node.base + '/' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
  return true;
}, test.limit.slow);
test.run('it loads through spirit.requireScript', 0.2, async function () {
  if (!text) return false;
  loaded = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/app/script.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function () { return false; })');
  return loaded === 'loaded' ? true : false;
}, test.limit.slow);
// The app branch is asked of the loader, as the list asks it (goal/G49.20: its interface is spirit/app/script.js).
test.run('its create makes a list in the host it is given', 0.2, async function () {
  if (!text) return false;
  const made = await chrome.evaluate('spirit.requireScript("spirit/app/script.js").then(function (b) { window.asked = []; var real = b.searchApp; b.searchApp = function (a) { window.asked.push(a); return real.call(b, a); }; window.picks = []; window.list = spirit.element.search.app.create(document.getElementById("under-test"), { face: "pane", pick: function (row) { window.picks.push(row); } }); return true; })');
  return made === true ? true : false;
}, test.limit.slow);
test.run('it draws what app.search finds', 0.2, async function () {
  if (!text) return false;
  // An app every node has: grants (the app called server, read here before, is gone from the tree).
  identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'grants', 'grants.json'), 'utf8')).identity;
  const drawn = await until(function () { return text().then(function (x) { return x.indexOf(identity.label) !== -1; }); }, 8000);
  return drawn ? true : false;
}, test.limit.slow);
test.run('it asks app.search with a search string and nothing more', 0.2, async function () {
  if (!text) return false;
  const asked = await chrome.evaluate('JSON.stringify(window.asked)');
  return JSON.parse(asked).length > 0 && JSON.parse(asked).every(function (a) { return Object.keys(a).every(function (k) { return k === 'q'; }); }) ? true : false;
}, test.limit.slow);
test.run('its row can be pressed', 0.2, async function () {
  if (!identity) return false;
  const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (!all[i].children.length && String(all[i].innerText || "").indexOf(want) !== -1) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
  return pressed === true ? true : false;
}, test.limit.slow);
test.run('a press hands the row to pick', 0.2, async function () {
  if (!identity) return false;
  const picked = await until(function () { return chrome.evaluate('window.picks.length === 1 && String(window.picks[0].label).indexOf(' + JSON.stringify(identity.label) + ') !== -1'); }, 3000);
  return picked ? true : false;
}, test.limit.slow);
test.run('refresh asks again', 0.2, async function () {
  if (!text) return false;
  const refreshed = await chrome.evaluate('(function () { var n = window.asked.length; window.list.refresh(); return new Promise(function (r) { setTimeout(function () { r(window.asked.length > n); }, 500); }); }())');
  return refreshed === true ? true : false;
}, test.limit.slow);
test.run('destroy empties its host', 0.2, async function () {
  if (!text) return false;
  const empty = await chrome.evaluate('(function () { window.list.destroy(); return document.getElementById("under-test").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.slow);

// goal/G43.18. Andy, box: "The app search gains a server filter, node.mount true and active ... this filter is hidden by
// default."; Q4: "The programmer who uses app:search makes it visible", by create's servers: true (cw's 64c04fd2).
// goal/G43.18: the server filter, hidden by default, shown by servers: true
test.run('the tree has an app that runs on the node, and apps that do not', 0.2, function () {
  // Which apps run on the node, from the tree: each <name>.json's node.mount. Each keyed by its id, spirit.app.<name> (goal/G49.19).
  const APPS = path.join(RUN, 'spirit', 'app');
  own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return { key: 'spirit.app.' + n, label: String((j.identity && j.identity.label) || n), mount: !!(j.node && j.node.mount === true) }; });
  mounted = own.filter(function (a) { return a.mount; });
  MOUNT = mounted[0];
  return MOUNT && own.length > mounted.length ? true : false;
}, test.limit.quick);
let plainB, serversB;
test.run('without the servers option it shows no filter', 0.2, async function () {
  if (!text) return false;
  if (!MOUNT) return false;
  // The labels a list draws: the leaves that show whose text is an app's label (a row the list hides stays in the page,
  // goal/G47.1, the search keeps its rows).
  drawnIn = function (id) { return chrome.evaluate('(function () { var want = ' + JSON.stringify(own.map(function (a) { return a.label; })) + '; var out = []; var all = document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("*"); for (var i = 0; i < all.length; i++) { if (!all[i].getClientRects().length) continue; var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return out.sort(); }())'); };
  const filterButtons = function (id) { return chrome.evaluate('document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("button[data-filter]").length'); };
  const makeList = function (id, servers) { return chrome.evaluate('(function () { var c = document.createElement("div"); c.id = ' + JSON.stringify(id) + '; document.body.appendChild(c); window[' + JSON.stringify(id) + '] = spirit.element.search.app.create(c, ' + (servers ? '{ face: "pane", servers: true }' : '{ face: "pane" }') + '); return true; }())'); };
  await makeList('plain', false);
  await makeList('servers', true);
  await until(function () { return Promise.all([drawnIn('plain'), drawnIn('servers')]).then(function (d) { return d[0].length > 1 && d[1].length > 1; }); }, 8000);
  plainB = await filterButtons('plain');
  serversB = await filterButtons('servers');
  press = function () { return chrome.evaluate('(function () { var b = document.getElementById("servers").querySelector("button[data-filter]"); if (!b) return false; b.click(); return true; }())'); };
  return plainB === 0 ? true : false;
}, test.limit.slow);
test.run('with the servers option set to true it shows the one filter', 0.2, function () {
  if (serversB === undefined) return false;
  return serversB === 1 ? true : false;
}, test.limit.quick);

// goal/G43.18: pressed, only the active apps with node.mount true stay
test.run('the app that runs on the node is switched on', 0.2, async function () {
  if (!press) return false;
  await ask('spirit.app.active', { key: MOUNT.key, active: true });
  const on = await until(function () { return activeOf(MOUNT.key).then(function (a) { return a === true; }); }, 10000);
  await chrome.evaluate('window.servers.refresh(); true');
  return on ? true : false;
}, test.limit.slow);
test.run('its filter can be pressed', 0.2, async function () {
  if (!press) return false;
  return (await press()) === true ? true : false;
}, test.limit.slow);
test.run('with the filter pressed, it draws the active apps that run on the node, and no other app', 0.2, async function () {
  if (!press) return false;
  want = await wantOn();
  const on1 = await until(function () { return drawnIn('servers').then(function (d) { return JSON.stringify(d) === JSON.stringify(want); }); }, 8000);
  return on1 && want.indexOf(MOUNT.label) !== -1 ? true : false;
}, test.limit.slow);
test.run('the list without the filter still draws every app', 0.2, async function () {
  if (!press) return false;
  plainNow = await drawnIn('plain');
  return plainNow.length > want.length ? true : false;
}, test.limit.slow);
// "and active": switched off, it leaves the filter's list.
test.run('once switched off, the app leaves the filtered list', 0.2, async function () {
  if (!press) return false;
  await ask('spirit.app.active', { key: MOUNT.key, active: false });
  await until(function () { return activeOf(MOUNT.key).then(function (a) { return a === false; }); }, 10000);
  await chrome.evaluate('window.servers.refresh(); true');
  want = await wantOn();
  const off1 = await until(function () { return drawnIn('servers').then(function (d) { return d.indexOf(MOUNT.label) === -1 && JSON.stringify(d) === JSON.stringify(want); }); }, 8000);
  return off1 ? true : false;
}, test.limit.long);
test.run('with the filter pressed again, every app is back', 0.2, async function () {
  if (!press || !plainNow) return false;
  return (await press()) === true && await until(function () { return drawnIn('servers').then(function (d) { return d.length === plainNow.length; }); }, 8000) ? true : false;
}, test.limit.slow);
