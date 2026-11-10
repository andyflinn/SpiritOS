'use strict';

// spirit/run/spirit/element/search/test/app.js
// The tests of spirit/element/search/app.js, and of no other module (spec: ./app.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

test.startTest('appSelector/listElement.js: the app list (goal/G43.2)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/app.js is not there'); return; }
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/app.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'it loads through spirit.require', 'it did not load: ' + short(loaded));
    const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
    const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
    const R = JSON.stringify(ROW);
    const made = await chrome.evaluate('(function () { window.asked = []; var real = spirit.app.searchApp; spirit.app.searchApp = function (a) { window.asked.push(a); return real.call(spirit.app, a); }; window.picks = []; window.list = spirit.element.spirit.element.search.app.create(document.getElementById("under-test"), { face: "pane", pick: function (row) { window.picks.push(row); } }); return true; }())');
    ok(made === true, 'spirit.element.spirit.element.search.app.create(host, opts) makes a list', 'it made no list: ' + short(made));
    const identity = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'server', 'server.json'), 'utf8')).identity;
    const drawn = await until(function () { return text().then(function (x) { return x.indexOf(identity.label) !== -1; }); }, 8000);
    ok(drawn, 'it draws what app.search finds', 'it drew ' + short(await text()));
    const asked = await chrome.evaluate('JSON.stringify(window.asked)');
    ok(JSON.parse(asked).length > 0 && JSON.parse(asked).every(function (a) { return Object.keys(a).every(function (k) { return k === 'q'; }); }), 'it asks app.search with a search string and nothing more', 'it asked ' + short(asked));
    const pressed = await chrome.evaluate('(function () { var want = ' + JSON.stringify(identity.label) + '; var all = document.getElementById("under-test").querySelectorAll("*"); var hit = null; for (var i = 0; i < all.length; i++) { if (!all[i].children.length && String(all[i].innerText || "").indexOf(want) !== -1) hit = all[i]; } if (!hit) return false; hit.click(); return true; }())');
    ok(pressed === true, 'its row can be pressed', 'no row to press');
    const picked = await until(function () { return chrome.evaluate('window.picks.length === 1 && String(window.picks[0].label).indexOf(' + JSON.stringify(identity.label) + ') !== -1'); }, 3000);
    ok(picked, 'a press hands the row to pick', 'pick got ' + short(await chrome.evaluate('JSON.stringify(window.picks)')));
    const refreshed = await chrome.evaluate('(function () { var n = window.asked.length; window.list.refresh(); return new Promise(function (r) { setTimeout(function () { r(window.asked.length > n); }, 500); }); }())');
    ok(refreshed === true, 'refresh asks again', 'refresh asked nothing');
    const empty = await chrome.evaluate('(function () { window.list.destroy(); return document.getElementById("under-test").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await text()));

    // goal/G43.18. Andy, box: "The app search gains a server filter, node.mount true and active ... this filter is hidden by
    // default."; Q4: "The programmer who uses app:search makes it visible", by create's servers: true (cw's 64c04fd2).
    test.subHeading('goal/G43.18: the server filter, hidden by default, shown by servers: true');
    const ask = async function (verb, args) { const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) }); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
    // Which apps run on the node, from the tree: each <name>.json's node.mount.
    const APPS = path.join(RUN, 'spirit', 'app');
    const own = fs.readdirSync(APPS).filter(function (n) { return fs.existsSync(path.join(APPS, n, n + '.json')); }).map(function (n) { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return { key: n, label: String((j.identity && j.identity.label) || n), mount: !!(j.node && j.node.mount === true) }; });
    const mounted = own.filter(function (a) { return a.mount; });
    const MOUNT = mounted[0];
    ok(MOUNT && own.length > mounted.length, 'the tree has an app that runs on the node (' + (MOUNT && MOUNT.key) + ') and ' + (own.length - mounted.length) + ' that do not', 'nothing to judge the filter with: ' + short(own));
    if (!MOUNT) return;
    const activeOf = async function (k) { const got = await ask('app.search', { q: '' }); const r = ((got && got.items) || []).filter(function (i) { return i.key === k; })[0]; let v = null; try { v = JSON.parse(r.label); } catch (e) { /* none */ } return v ? v.active : undefined; };
    // The labels a list draws: the leaves whose text is an app's label.
    const drawnIn = function (id) { return chrome.evaluate('(function () { var want = ' + JSON.stringify(own.map(function (a) { return a.label; })) + '; var out = []; var all = document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("*"); for (var i = 0; i < all.length; i++) { var t = String(all[i].innerText || "").trim(); if (!all[i].children.length && want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); } return out.sort(); }())'); };
    const filterButtons = function (id) { return chrome.evaluate('document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("button[data-filter]").length'); };
    const makeList = function (id, servers) { return chrome.evaluate('(function () { var c = document.createElement("div"); c.id = ' + JSON.stringify(id) + '; document.body.appendChild(c); window[' + JSON.stringify(id) + '] = spirit.element.spirit.element.search.app.create(c, ' + (servers ? '{ face: "pane", servers: true }' : '{ face: "pane" }') + '); return true; }())'); };
    await makeList('plain', false);
    await makeList('servers', true);
    await until(function () { return Promise.all([drawnIn('plain'), drawnIn('servers')]).then(function (d) { return d[0].length > 1 && d[1].length > 1; }); }, 8000);
    const plainB = await filterButtons('plain');
    const serversB = await filterButtons('servers');
    ok(plainB === 0, 'without servers: true it shows no filter', 'without servers: true it shows ' + plainB + ' filter buttons');
    ok(serversB === 1, 'with servers: true it shows the one filter', 'with servers: true it shows ' + serversB + ' filter buttons');
    const press = function () { return chrome.evaluate('(function () { var b = document.getElementById("servers").querySelector("button[data-filter]"); if (!b) return false; b.click(); return true; }())'); };

    test.subHeading('goal/G43.18: pressed, only the active apps with node.mount true stay');
    await ask('app.active', { key: MOUNT.key, active: true });
    ok(await until(function () { return activeOf(MOUNT.key).then(function (a) { return a === true; }); }, 10000), MOUNT.label + ' is switched on', MOUNT.label + ' is not active: ' + short(await activeOf(MOUNT.key)));
    await chrome.evaluate('window.servers.refresh(); true');
    // Which of the apps are active, as the node answers; the filter's set is that and node.mount, from the tree.
    const wantOn = async function () { const out = []; for (const a of mounted) { if ((await activeOf(a.key)) === true) out.push(a.label); } return out.sort(); };
    ok((await press()) === true, 'its filter can be pressed', 'no filter to press');
    let want = await wantOn();
    const on1 = await until(function () { return drawnIn('servers').then(function (d) { return JSON.stringify(d) === JSON.stringify(want); }); }, 8000);
    ok(on1 && want.indexOf(MOUNT.label) !== -1, 'pressed, it draws ' + short(want) + ' and no other app', 'pressed, it draws ' + short(await drawnIn('servers')) + ', want ' + short(want));
    const plainNow = await drawnIn('plain');
    ok(plainNow.length > want.length, 'the list without the filter still draws every app: ' + plainNow.length, 'the plain list draws ' + short(plainNow));
    // "and active": switched off, it leaves the filter's list.
    await ask('app.active', { key: MOUNT.key, active: false });
    await until(function () { return activeOf(MOUNT.key).then(function (a) { return a === false; }); }, 10000);
    await chrome.evaluate('window.servers.refresh(); true');
    want = await wantOn();
    const off1 = await until(function () { return drawnIn('servers').then(function (d) { return d.indexOf(MOUNT.label) === -1 && JSON.stringify(d) === JSON.stringify(want); }); }, 8000);
    ok(off1, 'switched off, ' + MOUNT.label + ' leaves it', 'switched off, it draws ' + short(await drawnIn('servers')));
    ok((await press()) === true && await until(function () { return drawnIn('servers').then(function (d) { return d.length === plainNow.length; }); }, 8000), 'pressed again, every app is back', 'pressed again, it draws ' + short(await drawnIn('servers')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
