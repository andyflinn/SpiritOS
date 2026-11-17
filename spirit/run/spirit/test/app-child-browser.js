'use strict';

// spirit/run/spirit/test/app-child-browser.js [<script> ...]
// THE -browser GENERAL TEST BESIDE spirit/app.js (goal/G47.1, box v140-142: "a new general test,
// spirit/test/app-child-browser.js: every element under spirit/app/, mounted alone on a scratch node with its app's server
// on, is red unless it loaded its own app's api.js and data.js"; Andy: "i just want the fucking status box to fail a fucking
// test if it does NOT fucking mount its own shit by itself", "agreed."). Its contract: ./app-child-browser.md. The page twin
// of app-child-general.js; what holds for every page script is spirit-sibling-browser.js's.
//
//   node spirit/test/app-child-browser.js spirit/app/testicle/element/statusBox.js ...   those scripts
//   node spirit/test/app-child-browser.js                                                every script under spirit/app/
//
// HOW: one scratch node (the tracked files), the server of every app judged turned on when its folder holds one
// (spirit/app/<name>/<name>.js), and one headless Chrome page. Each script is opened on its bare DEBUG page, spirit.js and
// that file alone (spirit/DEBUG/headLessBrowser.js); whether it installs an element the page says, no code read. Mounted,
// what it loaded stands in spirit.required: on a bare page nothing else loaded it.
require('../spirit.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const { until, findChrome, scratchNode, chromePage } = H;

const ARGV = process.argv.slice(2);
const GIVEN = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test'; })
  .map(function (a) { return String(a).split(path.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, ''); });
// Its reach: a script under spirit/app/<name>/, in no test folder. Handed nothing, every one the tree keeps.
const appOf = function (rel) { return (/^spirit\/app\/([^/]+)\/.+\.js$/.exec(rel) || [])[1] || ''; };
const inReach = function (rel) { return !!appOf(rel) && !/(^|\/)test\//.test(rel) && fs.existsSync(path.join(RUN, rel)); };
const TARGETS = (GIVEN.length ? GIVEN : execFileSync('git', ['ls-files', '--', 'spirit/app'], { cwd: RUN, encoding: 'utf8' }).split('\n')).filter(inReach);
// What an app owes its elements: its api.js and data.js, where its folder holds them.
const owed = function (app) { return ['api', 'data'].filter(function (n) { return fs.existsSync(path.join(RUN, 'spirit', 'app', app, n + '.js')); }); };
// A MOUNTABLE SERVER: its manifest mounts one (spirit/app/<name>/<name>.json node.mount true, as testicle's); an app whose
// <name>.js is a program it runs (publishData, pushOrigin: node.run) mounts none, and serves no interface to wait for.
const hasServer = function (app) { try { const m = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', app, app + '.json'), 'utf8')); return !!(m && m.node && m.node.mount === true) && fs.existsSync(path.join(RUN, 'spirit', 'app', app, app + '.js')); } catch (e) { return false; } };

const W = { node: null, page: null, fail: false, reports: {} };
function cleanup() {
  test.after(async function () {
    try { if (W.page && W.page.sock) W.page.sock.close(); } catch (e) { /* gone */ }
    try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ }
    try { if (W.chrome && W.chrome.close) W.chrome.close(); } catch (e) { /* gone */ }
    if (W.node && W.node.release) await W.node.release();
  });
}

// THE LIMITS (goal/G47.1, box v144: "only a hung page is reloaded: a main page that does not answer within 1 s is hung; a
// script's load waits as long as the page still answers", "no fixed sleeps in the checks: each wait ends the moment the page
// has settled"): each one a limit, ended early by what it waits for.
const HANG_MS = 1000;
const LOAD_LIMIT_MS = 20000;
const SETTLE_LIMIT_MS = 2000;
// Whether the page answers at all within HANG_MS: a script that never ends holds the page's one thread.
function answers(page) {
  return Promise.race([Promise.resolve(page.evaluate('1')).then(function () { return true; }, function () { return true; }),
    new Promise(function (r) { setTimeout(function () { r(false); }, HANG_MS); })]);
}

// THE PAGES FIRST, THE TESTS AFTER: which scripts install an element only the page can say, and a test is said only for
// one that does (a script with no element, or an app owing nothing, is a comment, never a green).
async function world() {
  if (!TARGETS.length) { W.fail = true; return; }
  const chrome = findChrome();
  if (!chrome) { W.fail = true; return; }
  const apps = Array.from(new Set(TARGETS.map(appOf))).filter(hasServer);
  // ITS CHROME STARTED WHILE THE NODE BOOTS: the two wait on nothing of each other.
  const chromeStarted = process.env.SPIRIT_CHROME_PORT ? Promise.resolve(null) : H.sharedChrome(chrome);
  W.node = await scratchNode({ servers: apps });
  W.chrome = await chromeStarted;
  if (!W.node.up || !W.node.debug) { W.fail = true; return; }
  // Every app server judged answers its interface before any page is opened (Andy: "a server MUST be mounted if a
  // mountable server exists in that app folder before a test is conducted").
  const silent = [];
  for (const a of apps) {
    const ok = await until(function () {
      return fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: { family: a } }) })
        .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.interface); }, function () { return false; });
    }, 30000);
    if (!ok) silent.push(a);
  }
  if (silent.length) { W.fail = true; return; }
  // ONE CHROME FOR THE WHOLE RUN (box v144: "run on one node and one Chrome for the whole run"): a fresh page of it per script,
  // so one that hangs is closed alone (spirit/test/headLessChrome.js sharedChrome; chromePage opens a page of it).
  if (W.chrome) {
    if (W.chrome.error) { W.fail = true; return; }
    process.env.SPIRIT_CHROME_PORT = String(W.chrome.port);
  }
  test.run('there are scripts under spirit/app/ to judge, a scratch node with their apps\' servers on, and a Chrome page', 0.2, function () { return true; }, test.limit.quick);
  W.worldSaid = true;
  const closePage = function () { try { if (W.page && W.page.sock) W.page.sock.close(); } catch (e) { /* gone */ } try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ } try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ } W.page = null; };
  for (const rel of TARGETS) {
    closePage();
    W.page = await chromePage(chrome);
    if (W.page.error) { W.reports[rel] = { fail: true }; continue; }
    const app = appOf(rel);
    W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html' });
    let report = null;
    let hung = false;
    await until(async function () {
      if (!(await answers(W.page))) { hung = true; return true; }
      const x = await W.page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)');
      try { report = x ? JSON.parse(x) : null; } catch (e) { report = null; }
      return !!report && report.state !== 'loading';
    }, LOAD_LIMIT_MS);
    if (hung) { W.reports[rel] = { fail: true }; judge(rel); continue; }
    if (!report || report.state === 'loading') { W.reports[rel] = { fail: true }; judge(rel); continue; }
    if (report.state === 'failed') {
      W.reports[rel] = /places no element with a create/.test(report.error) ? { none: true } : { fail: true };
      judge(rel);
      continue;
    }
    // What it loads as it mounts, until all it owes stands there or SETTLE_LIMIT_MS have passed; on a bare page all of it is
    // its own.
    const keys = JSON.stringify(owed(app).map(function (n) { return ['spirit', 'app', app, n]; }));
    let held = [];
    await until(async function () {
      const h = await W.page.evaluate('(function () { var r = (window.spirit && window.spirit.required) || {}; return ' + keys + '.filter(function (k) { return k.reduce(function (o, x) { return o == null ? undefined : o[x]; }, r) !== undefined; }).map(function (k) { return k[3]; }); }())');
      held = Array.isArray(h) ? h : [];
      return held.length === owed(app).length;
    }, SETTLE_LIMIT_MS);
    W.reports[rel] = { held: held, owed: owed(app) };
    judge(rel);
  }
  closePage();
  // EACH APP DOES WHAT ITS OWN MANIFEST SAYS (goal/G47.4; Andy: "THIS IS something that belongs in fucking app-child-browser",
  // "that fucking test is useless, it fucking assumes settings in fucking spirit/app/<name>/<name>.json"): read from every
  // judged app's own <name>.json, never written in a test.
  try { await appsPhase(chrome); } catch (e) { W.appsFail = true; }
  closePage();
}

// THE APPS PHASE. One face page on the same scratch node: every judged app that says no shell.mount true is made active
// first (as a user's press leaves it), so only its manifest can keep its tile away; then the app selector, mounted as boot.js
// mounts a shell, with no options, its tiles read; the app search as a pane, and as a dropdown pressed open, its labels read;
// and the detail of every app that says node.run, read for a Run button and an Activate row. Each app's results are filed
// under its <name>.js, else its element.js, whichever this run judges.
const APP_DIR = path.join(RUN, 'spirit', 'app');
function manifestOf(app) { try { return JSON.parse(fs.readFileSync(path.join(APP_DIR, app, app + '.json'), 'utf8')); } catch (e) { return null; } }
function scriptOf(app) {
  const own = 'spirit/app/' + app + '/' + app + '.js';
  const el = 'spirit/app/' + app + '/element.js';
  return TARGETS.indexOf(own) !== -1 ? own : TARGETS.indexOf(el) !== -1 ? el : '';
}
// The app selector itself (spirit/app/app/) is the one drawing the tiles, not one drawn.
const judgedApps = function () { return Array.from(new Set(TARGETS.map(appOf))).filter(function (a) { return a !== 'app' && !!manifestOf(a) && !!scriptOf(a); }); };
function declared(app) {
  const m = manifestOf(app) || {};
  return { label: String((m.identity && m.identity.label) || app), icon: String((m.identity && m.identity.icon) || ''), shell: !!(m.shell && m.shell.mount === true), run: !!(m.node && m.node.run === true) };
}
async function appsPhase(chrome) {
  const apps = judgedApps();
  W.apps = {};
  if (!apps.length) return;
  W.page = await chromePage(chrome);
  if (W.page.error) { W.appsFail = true; return; }
  const P = W.page;
  P.send('Page.navigate', { url: W.node.base + '/face.html' });
  if (!(await until(function () { return P.evaluate('!!(window.spirit && window.spirit.ready)'); }, LOAD_LIMIT_MS))) { W.appsFail = true; return; }
  const parts = await P.evaluate('window.spirit.ready.then(function () { return Promise.all(["spirit/app/app/element.js", "spirit/element/search/app.js", "spirit/element/search/app/detail.js"].map(function (p) { return spirit.require(p); })); }).then(function () { return "loaded"; }, function () { return "no"; })');
  if (parts !== 'loaded') { W.appsFail = true; return; }
  const want = apps.map(function (a) { return Object.assign({ key: a }, declared(a)); });
  const labels = JSON.stringify(want.map(function (a) { return a.label; }));
  // Every app with no shell.mount true, and not run only, made active: by the verb, else on its disc in the scratch run.
  const off = want.filter(function (a) { return !a.shell && !a.run; }).map(function (a) { return a.key; });
  const activeRows = function () { return P.evaluate('(function () { var r = (spirit.data.app && spirit.data.app.data) ? spirit.data.app.data.rows() : {}; return JSON.stringify(' + JSON.stringify(off) + '.filter(function (k) { return r[k] && r[k].active === true; })); }())').then(function (x) { try { return JSON.parse(x); } catch (e) { return []; } }); };
  await P.evaluate('(function () { var a = spirit.app && spirit.app.activeApp; if (!a) return false; ' + JSON.stringify(off) + '.forEach(function (k) { try { a({ key: k, active: true }); } catch (e) { /* its disc below */ } }); return true; }())');
  await until(function () { return activeRows().then(function (on) { return on.length === off.length; }); }, 10000);
  const onNow = await activeRows();
  off.filter(function (k) { return onNow.indexOf(k) === -1; }).forEach(function (k) { const d = path.join(W.node.run, 'spirit', 'state', k); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'node.json'), JSON.stringify({ active: true })); });
  if (onNow.length !== off.length) await until(function () { return activeRows().then(function (on) { return on.length === off.length; }); }, 10000);
  W.activeOff = await activeRows();
  // What an element under a box draws of the judged apps' labels: its visible leaves.
  const drawnIn = function (expr) { return P.evaluate('(function () { var root = ' + expr + '; if (!root) return "[]"; var want = ' + labels + '; var out = []; root.querySelectorAll("*").forEach(function (e) { if (e.children.length || !e.getClientRects().length) return; var t = String(e.innerText || e.textContent || "").trim(); if (want.indexOf(t) !== -1 && out.indexOf(t) === -1) out.push(t); }); return JSON.stringify(out); }())').then(function (x) { try { return JSON.parse(x); } catch (e) { return null; } }); };
  const box = function (id) { return P.evaluate('(function () { var c = document.createElement("div"); c.id = ' + JSON.stringify(id) + '; c.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:800px;display:flex;flex-direction:column"; document.body.appendChild(c); return true; }())'); };
  const gone = function (id, handle) { return P.evaluate('(function () { try { if (window[' + JSON.stringify(handle) + ']) window[' + JSON.stringify(handle) + '].destroy(); } catch (e) { /* gone */ } var c = document.getElementById(' + JSON.stringify(id) + '); if (c) c.remove(); return true; }())'); };
  const settled = async function (expr) { let last = ''; let same = 0; await until(async function () { const d = JSON.stringify(await drawnIn(expr)); same = d === last ? same + 1 : 0; last = d; return same >= 3; }, SETTLE_LIMIT_MS * 3); return drawnIn(expr); };
  // The selector as boot.js mounts a shell: no options.
  await box('zz-tiles');
  await P.evaluate('(function () { window.zzTiles = spirit.element.spirit.app.app.element.create(document.getElementById("zz-tiles")); var c = document.getElementById("zz-tiles"); if (window.zzTiles && window.zzTiles.parentNode !== c && window.zzTiles.nodeType) c.appendChild(window.zzTiles); return true; }())');
  W.tiles = await settled('document.getElementById("zz-tiles")');
  await gone('zz-tiles', 'zzTiles');
  // The app search as a pane.
  await box('zz-pane');
  await P.evaluate('(function () { window.zzPane = spirit.element.spirit.element.search.app.create(document.getElementById("zz-pane"), { face: "pane" }); return true; }())');
  W.pane = await settled('document.getElementById("zz-pane")');
  await gone('zz-pane', 'zzPane');
  // The app search as a dropdown, pressed open: its list floats, so the page is read.
  await box('zz-drop');
  await P.evaluate('(function () { window.zzDrop = spirit.element.spirit.element.search.app.create(document.getElementById("zz-drop"), { face: "dropdown" }); return true; }())');
  await until(function () { return P.evaluate('(function () { var d = window.zzDrop, f = (d && d.list && d.list.field) || document.querySelector("#zz-drop input, #zz-drop [tabindex], #zz-drop button"); if (f) f.click(); return !!f; }())'); }, SETTLE_LIMIT_MS);
  W.drop = await settled('document.body');
  await gone('zz-drop', 'zzDrop');
  // The detail of every app that says node.run.
  W.detail = {};
  for (const a of want.filter(function (x) { return x.run; })) {
    await box('zz-detail');
    await P.evaluate('(function () { window.zzDetail = spirit.element.spirit.element.search.app.detail.create(document.getElementById("zz-detail"), { row: ' + JSON.stringify({ key: a.key, label: a.label, icon: a.icon }) + ', panel: true }); return true; }())');
    const RUN_BTN = 'Array.prototype.filter.call(document.querySelectorAll("#zz-detail button"), function (b) { return /\\bRun\\b/.test(String(b.textContent || "")); })[0]';
    const hasRun = !!(await until(function () { return P.evaluate('!!(' + RUN_BTN + ')'); }, SETTLE_LIMIT_MS * 3));
    const activates = await P.evaluate('Array.prototype.filter.call(document.querySelectorAll("#zz-detail *"), function (e) { return !e.children.length && /^\\s*(de)?activate\\b/i.test(String(e.textContent || "")) && e.offsetParent !== null; }).length');
    W.detail[a.key] = { run: hasRun, activates: Number(activates) || 0 };
    await gone('zz-detail', 'zzDetail');
  }
  want.forEach(function (a) { W.apps[a.key] = a; judgeApp(a); });
}
// Each app's checks, filed under its script, from what its manifest says.
function judgeApp(a) {
  const shown = function (list) { return Array.isArray(list) && list.indexOf(a.label) !== -1; };
  const ok = function () { return !W.fail && !W.appsFail; };
  // AN APP THAT CLAIMS A FACE SUPPLIES ONE (Andy: "where is the test that verifies that an app who claims to have a face, also
  // actually supplies a fucking face?"): filed under its spirit/app/<name>/element.js itself, when this run judges that file,
  // which then mounted alone on its bare page above; an app claiming a face with no element.js is red under its script.
  const el = 'spirit/app/' + a.key + '/element.js';
  if (a.shell && TARGETS.indexOf(el) !== -1) test.forScript(el, function () {
    test.run('its app\'s manifest says shell.mount true: it mounts alone on a bare page', 0.4, function () {
      const r = W.reports[el];
      return (!W.fail && !!r && !r.fail && !r.none) || false;
    }, test.limit.quick);
  });
  test.forScript(scriptOf(a.key), function () {
    if (!a.shell) {
      test.run('its manifest says no shell.mount true: the app selector, mounted with no options, shows no tile of it, though it is made active', 0.4, function () {
        if (!ok() || !Array.isArray(W.tiles)) return false;
        if (!a.run && (W.activeOff || []).indexOf(a.key) === -1) return false;
        return !shown(W.tiles) || false;
      }, test.limit.quick);
    }
    if (a.shell && !fs.existsSync(path.join(RUN, el))) {
      test.run('its manifest says shell.mount true: its element.js is there', 0.4, function () { return false; }, test.limit.quick);
    }
    if (a.run) {
      test.run('its manifest says node.run: the app search as a pane lists it', 0.4, function () { return (ok() && shown(W.pane)) || false; }, test.limit.quick);
      test.run('its manifest says node.run: the app search as a dropdown does not list it', 0.4, function () { return (ok() && Array.isArray(W.drop) && !shown(W.drop)) || false; }, test.limit.quick);
      test.run('its manifest says node.run: its detail shows a Run button', 0.4, function () { return (ok() && !!W.detail[a.key] && W.detail[a.key].run) || false; }, test.limit.quick);
      test.run('its manifest says node.run: its detail shows no Activate', 0.4, function () { return (ok() && !!W.detail[a.key] && W.detail[a.key].run && W.detail[a.key].activates === 0) || false; }, test.limit.quick);
    }
  });
}

// EACH SCRIPT JUDGED THE MOMENT ITS PAGE IS READ (box v144: "every result reaches testicle the moment the page knows it"): its
// test said at once, for its own script (test.forScript), while the run is held open (test.hold).
function judge(rel) {
  const r = W.reports[rel];
  if (r && r.none) return;
  if (r && r.owed && !r.owed.length) return;
  test.forScript(rel, function () {
    test.run('mounted alone with its app\'s server on, it loaded its own app\'s api.js and data.js', 0.8, function () {
      if (W.fail) return false;
      if (!r) return false;
      if (r.fail) return false;
      const missing = r.owed.filter(function (n) { return r.held.indexOf(n) === -1; });
      return !missing.length || false;
    }, test.limit.quick);
  });
}

test.hold();
world().then(null, function () { W.fail = true; }).then(function () {
  if (!W.worldSaid) test.run('there are scripts under spirit/app/ to judge, a scratch node with their apps\' servers on, and a Chrome page', 0.2, function () {
    return !W.fail || false;
  }, test.limit.quick);
  // A script the world never reached, after it failed, is said too, red for that reason.
  TARGETS.forEach(function (rel) { if (!(rel in W.reports) && W.fail) judge(rel); });
  // The apps' checks are said too when the world or the apps phase never ran them, red for that reason.
  if (!W.apps) { W.appsFail = true; judgedApps().forEach(function (k) { judgeApp(Object.assign({ key: k }, declared(k))); }); }
  cleanup();
  test.release();
});
