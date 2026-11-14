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
const { until, sleep, findChrome, scratchNode, chromePage } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
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

const W = { node: null, page: null, fail: '', reports: {} };
function cleanup() {
  test.after(async function () {
    try { if (W.page && W.page.sock) W.page.sock.close(); } catch (e) { /* gone */ }
    try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ }
    try { if (W.node && W.node.child && !W.node.shared) W.node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [W.node && !W.node.shared ? W.node.root : '', W.page && W.page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  });
}

// THE PAGES FIRST, THE TESTS AFTER: which scripts install an element only the page can say, and a test is said only for
// one that does (a script with no element, or an app owing nothing, is a comment, never a green).
async function world() {
  if (!TARGETS.length) { W.fail = 'no script under spirit/app/ to judge in ' + short(GIVEN); return; }
  const chrome = findChrome();
  if (!chrome) { W.fail = 'no Chrome on this machine'; return; }
  const apps = Array.from(new Set(TARGETS.map(appOf))).filter(hasServer);
  W.node = await scratchNode({ servers: apps });
  if (!W.node.up || !W.node.debug) { W.fail = 'the scratch node did not come up with its DEBUG on'; return; }
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
  if (silent.length) { W.fail = 'app servers that never answered: ' + silent.join(', '); return; }
  // A PAGE OF ITS OWN FOR EACH SCRIPT: one that hangs leaves the shared page unusable, and every script after it failed
  // "never finished loading" for the one before (seen on wsl's node, 2026-11-14).
  const closePage = function () { try { if (W.page && W.page.sock) W.page.sock.close(); } catch (e) { /* gone */ } try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ } try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ } W.page = null; };
  for (const rel of TARGETS) {
    closePage();
    W.page = await chromePage(chrome);
    if (W.page.error) { W.reports[rel] = { fail: 'no Chrome page for it: ' + W.page.error }; continue; }
    const app = appOf(rel);
    await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html' });
    let report = null;
    await until(function () {
      return W.page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)').then(function (x) {
        try { report = x ? JSON.parse(x) : null; } catch (e) { report = null; }
        return !!report && report.state !== 'loading';
      });
    }, 20000);
    if (!report || report.state === 'loading') { W.reports[rel] = { fail: rel + ': its page never finished loading in 20 s' }; continue; }
    if (report.state === 'failed') {
      W.reports[rel] = /places no element with a create/.test(report.error) ? { none: true } : { fail: 'it did not mount: ' + report.error };
      continue;
    }
    // What it loads as it mounts, given a moment; on a bare page all of it is its own.
    await sleep(1500);
    const keys = JSON.stringify(owed(app).map(function (n) { return ['spirit', 'app', app, n]; }));
    const held = await W.page.evaluate('(function () { var r = (window.spirit && window.spirit.required) || {}; return ' + keys + '.filter(function (k) { return k.reduce(function (o, x) { return o == null ? undefined : o[x]; }, r) !== undefined; }).map(function (k) { return k[3]; }); }())');
    W.reports[rel] = { held: Array.isArray(held) ? held : [], owed: owed(app) };
  }
}

world().then(null, function (e) { W.fail = 'the world crashed: ' + (e && e.stack || e); }).then(function () {
  test.run('the world: scripts under spirit/app/ to judge, a scratch node with their apps\' servers on, and a Chrome page', 0.2, function () {
    return !W.fail || W.fail;
  }, test.limit.quick);
  // One title, reported for each script that installs an element (test.forScript).
  TARGETS.forEach(function (rel) {
    const r = W.reports[rel];
    if (r && r.none) { test.comment(rel + ': it installs no element, not judged'); return; }
    if (r && r.owed && !r.owed.length) { test.comment(rel + ': its app holds no api.js and no data.js, nothing owed'); return; }
    test.forScript(rel, function () {
      test.run('mounted alone with its app\'s server on, it loaded its own app\'s api.js and data.js', 0.8, function () {
        if (W.fail) return 'no page: ' + W.fail;
        if (!r) return 'it was not opened: the world failed';
        if (r.fail) return r.fail;
        const missing = r.owed.filter(function (n) { return r.held.indexOf(n) === -1; });
        return !missing.length || 'it did not load ' + missing.map(function (n) { return 'spirit/app/' + appOf(rel) + '/' + n + '.js'; }).join(' and ') + ' itself: it leans on its mounter';
      }, test.limit.quick);
    });
  });
  cleanup();
});
