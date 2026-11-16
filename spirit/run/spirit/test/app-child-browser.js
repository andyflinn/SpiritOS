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
  test.run('the world: scripts under spirit/app/ to judge, a scratch node with their apps\' servers on, and a Chrome page', 0.2, function () { return true; }, test.limit.quick);
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
  if (!W.worldSaid) test.run('the world: scripts under spirit/app/ to judge, a scratch node with their apps\' servers on, and a Chrome page', 0.2, function () {
    return !W.fail || false;
  }, test.limit.quick);
  // A script the world never reached, after it failed, is said too, red for that reason.
  TARGETS.forEach(function (rel) { if (!(rel in W.reports) && W.fail) judge(rel); });
  cleanup();
  test.release();
});
