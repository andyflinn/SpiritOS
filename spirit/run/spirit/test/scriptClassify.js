'use strict';
// spirit/run/spirit/test/scriptClassify.js
// THE CLASSIFIER, A "SPECIAL" GENERAL TEST UNDER ITS OWN NAME (goal/G47.1, box v94, 1). Its contract: ./scriptClassify.md.
//
//   node spirit/test/scriptClassify.js [<script> ...]
//
// The box: "the script MUST be classified by loading it", "every script is loaded twice, once as a node script and once in
// a page: a crash on the node for lack of a browser function (window, document): browser-only; a crash in the page for
// lack of a node function (require, fs, http, crypto, process): node-only; no crash in either: it runs on both, neither
// flag; a crash in both: unclassifyable", "the node side counts only a thrown error, and reads its reason ... A process
// that ends with nothing caught has loaded, whatever its exit code", "a load that is not complete in 3 seconds counts as
// crash/hang: not classifyable", "classify hard-codes server.js and relayServer.js as node-only", "it ... runs where all
// tests run, in its own scratch node (booted once per run)", "its severity is 0.8".
//
// Each script given (none given: every product script of the tree) is one test, "classifyable", reported for that script
// (testReport's opts.script). Classified, it tells the node's testicle by testicle.script.classify {script, browserOnly,
// nodeOnly} and passes; not classifyable, it fails, saying both loads' answers. testicle's server runs it by itself.
require('../spirit.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');
const test = require('./testReport.js');
const { until, freePort, findChrome, chromePage, WAIT } = require('./headLessChrome.js');

const RUN = path.join(__dirname, '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'spirit.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
// "a load that is not complete in 3 seconds counts as crash/hang".
const LOAD_MS = 3000;
// "classify hard-codes server.js and relayServer.js as node-only": never loaded.
const NODE_ONLY = ['spirit/server.js', 'spirit/server/relay.js'];
// A FILE IN A TEST FOLDER IS NEVER LOADED (a tool of the test system with a test of its own, testReport.js, testModule.js,
// or a test itself): loading a test runs it. Tests and their tools run on the node: node-only, as server.js is.
function neverLoaded(rel) { return NODE_ONLY.indexOf(rel) !== -1 || /(^|\/)test\//.test(rel); }
// Its own bare page, written into its scratch copy only.
const BARE = 'zz-classify.html';
// What a page lacks, and what the node lacks, as the error a load threw names it.
// A script the node will not serve to a page (answered 404 though it is on disc) is one a page cannot have at all.
const LACKS_NODE = /answered 404|\b(require|process|module|exports|__dirname|__filename|Buffer|global) is not defined\b|Cannot find module|\bfs\b.*not defined/;
const LACKS_BROWSER = /\b(window|document|navigator|location|localStorage|sessionStorage|HTMLElement|customElements|getComputedStyle) is not defined\b/;

function posix(p) { return String(p).split(path.sep).join('/'); }
// Every product script, vendored code left out, as testicle leaves it out (it never watches it).
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem.js').VENDORED_FOLDERS;
function productScripts() {
  return execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
}
const given = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; })
  .map(function (a) { return posix(a).replace(/^\.?\//, ''); });
const SCRIPTS = given.length ? given : productScripts();

// THE NODE SIDE: the script required in a worker thread of its own, inside a try; what it caught is told to the classifier.
// Nothing told and the worker ended: it loaded, whatever its exit code. Still running at the limit: a hang, and the worker
// is stopped. A WORKER PER SCRIPT, NOT A PROCESS (goal/G49.8; andy-ubuntu: "cw, go", on cw's measurement: 311 scripts, 10.0 s
// as processes, 5.0 s as workers, every answer the same): a worker has its own module cache and its own globals, so each
// script still loads alone with its whole chain recorded (goal/G47.6, box point 3), and its exit, a late throw or a hang
// ends only that worker.
function loadOnNode(run, rel) {
  return new Promise(function (resolve) {
    const src = 'const { parentPort } = require("worker_threads"); const path = require("path");' +
      'const run = ' + JSON.stringify(run) + '; const s = require(path.join(run, "spirit", "spirit.js"));' +
      'const tell = function (o) { try { parentPort.postMessage(o); } catch (e) { /* gone */ } };' +
      'process.on("uncaughtException", function (e) { tell({ err: String(e && e.message || e) }); process.exit(0); });' +
      // WHAT ITS LOAD PULLED IN (goal/G47.6, box point 3: "the classifier loads each script alone in its own process and
      // records everything that load pulled in, the whole chain"): the module cache's new entries, run paths of production
      // scripts, the script itself and test folders left out; sent with its class (script.classify's requires).
      'const before = new Set(Object.keys(require.cache));' +
      'const pulled = function () { return Object.keys(require.cache).filter(function (k) { return !before.has(k); }).map(function (k) { return path.relative(run, k).split(path.sep).join("/"); })' +
      '.filter(function (r) { return /\\.js$/.test(r) && r.indexOf("..") !== 0 && !path.isAbsolute(r) && !/(^|\\/)test\\//.test(r) && r !== ' + JSON.stringify(rel) + '; }); };' +
      'try { s.requireScript(' + JSON.stringify(rel) + '); tell({ err: "", requires: pulled() }); } catch (e) { tell({ err: String(e && e.message || e) }); }';
    let w = null;
    try { w = new Worker(src, { eval: true, stdout: true, stderr: true }); } catch (e) { return resolve({ err: String(e && e.message || e) }); }
    // Its output is not read: only what it tells counts.
    w.stdout.resume(); w.stderr.resume();
    let told = null;
    let done = false;
    const finish = function (r) {
      if (done) return;
      done = true;
      clearTimeout(t);
      w.terminate().then(function () { resolve(r); }, function () { resolve(r); });
    };
    // A first answer wins; a throw within 50 ms after it (a timer the script left) replaces a clean one, as the process's did.
    w.on('message', function (m) { if (told && told.err) return; told = m; if (!m.err) setTimeout(function () { finish(told); }, 50); else finish(m); });
    w.on('error', function (e) { finish({ err: String(e && e.message || e) }); });
    w.on('exit', function () { finish(told || { err: '' }); });
    const t = setTimeout(function () { finish(told || { err: true, hung: true }); }, LOAD_MS);
  });
}

// THE PAGE SIDE: a fresh face page of the scratch node, the script required there; a thrown error or one the page reported
// is its answer; not answered in time, a hang.
// ITS OWN SCRATCH NODE, ON A LAB NODE (goal/G47.3) HOLDING THIS TREE AS IT STANDS (its commit and its uncommitted edits, so a
// script not yet committed is classified too), then spirit/server.js started there on a free port, its DEBUG on.
async function ownScratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  // EVERY SCRIPT IT CLASSIFIES, AS IT STANDS ON DISC (goal/G47.1, found on testicle.js's planted scripts): lab's tree holds
  // the tracked files, so a script git does not track (a new one, or one under a .gitignored folder) was missing there:
  // on the node it "loaded", in the page it answered 404, and it came out node-only without ever being loaded.
  SCRIPTS.forEach(function (rel) {
    const from = path.join(RUN, rel);
    if (!fs.existsSync(from)) return;
    const to = path.join(run, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  });
  // EVERY APP'S SERVER ON, testicle's left off (it would classify again inside this one): an app's data.js asks its family's
  // interface on a page, which a node answers only while that server is on; off, the page would fail for the scratch
  // node's sake, not the script's.
  fs.readdirSync(path.join(run, 'spirit', 'app'), { withFileTypes: true }).forEach(function (d) {
    if (!d.isDirectory() || d.name === 'testicle') return;
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(run, 'spirit', 'app', d.name, d.name + '.json'), 'utf8')); } catch (e) { return; }
    if (!(manifest && manifest.node && manifest.node.mount === true)) return;
    const dir = path.join(run, 'spirit', 'state', d.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'node.json'), JSON.stringify({ active: true }));
  });
  // A BARE PAGE OF ITS OWN, in the copy only (in a test folder, so its node, DEBUG on, serves it at /DEBUG/<path>): spirit.js by its script tag and nothing else (no data-spirit, so no shell
  // boots), every error the page meets kept from its first line on.
  fs.writeFileSync(path.join(run, 'spirit', 'test', BARE), '<!doctype html><html><head><meta charset="utf-8"><script>window.pageErrors = [];' +
    ' window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); });</script><script src="/spirit.js"></script></head><body></body></html>\n');
  const port = await freePort();
  const child = LABH.startNodeOn(run, port, { windowsHide: true });
  const base = 'http://127.0.0.1:' + port;
  const post = function (call, args) {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
  };
  const up = await until(function () { return post('api').then(function (r) { return r.status === 200; }); }, 60000);
  if (up) await post('node.debug', { debug: { on: true } }).catch(function () { /* the page loads without it */ });
  return { root: root, base: base, child: child, up: up };
}
let W = null;
async function world() {
  if (W) return W;
  W = { node: null, page: null, error: false };
  W.node = await ownScratch();
  if (!W.node.up) { W.error = true; return W; }
  const chrome = findChrome();
  if (!chrome) { W.error = true; return W; }
  W.page = await chromePage(chrome);
  if (!W.page || W.page.error) { W.error = true; W.page = null; return W; }
  // THE NODE SIDE FOR EVERY SCRIPT AT ONCE, EIGHT WORKERS AT A TIME (each still a worker thread of its own, each cut at
  // LOAD_MS): a tree's first classifying run takes seconds, not minutes, so testing is not held back by it.
  W.nodeR = Object.create(null);
  const run = path.join(W.node.root, 'spirit', 'run');
  const todo = SCRIPTS.filter(function (rel) { return !neverLoaded(rel) && fs.existsSync(path.join(RUN, rel)); });
  let next = 0;
  await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(async function () {
    while (next < todo.length) { const rel = todo[next++]; W.nodeR[rel] = await loadOnNode(run, rel); }
  }));
  return W;
}
// THE PAGE SIDE: a fresh bare page of the scratch node for each script (plain scripts share a page's top-level scope, so
// one page for all would let one script's names break the next), spirit started, then the script required there.
function freshPage(w) {
  const old = w.page;
  w.page = null;
  try { if (old && old.kid) old.kid.kill(); } catch (e) { /* gone */ }
  try { if (old && old.profile) setTimeout(function () { try { fs.rmSync(old.profile, { recursive: true, force: true }); } catch (e) { /* its watcher takes it */ } }, 1000); } catch (e) { /* scratch */ }
}
async function loadOnPage(rel) {
  const w = await world();
  if (w.error) return { err: true, tool: true };
  if (!w.page) {
    w.page = await chromePage(findChrome());
    if (!w.page || w.page.error) { w.page = null; return { err: true, tool: true }; }
  }
  await w.page.send('Page.navigate', { url: w.node.base + '/DEBUG/spirit/test/' + BARE });
  const ready = await until(function () { return w.page.evaluate('!!(window.spirit && typeof window.spirit.requireScript === "function")').then(Boolean); }, WAIT);
  if (!ready) return { err: true, tool: true };
  const ask = w.page.evaluate('Promise.resolve(window.spirit.startPage()).then(function () { window.pageErrors = [];' +
    ' return spirit.requireScript(' + JSON.stringify(rel) + '); }).then(function () { return JSON.stringify({ err: (window.pageErrors || []).join("; ") }); },' +
    ' function (e) { return JSON.stringify({ err: String(e && e.message || e) }); })');
  const late = new Promise(function (r) { setTimeout(function () { r(null); }, LOAD_MS); });
  const got = await Promise.race([ask, late]);
  // A HUNG PAGE IS NOT REUSED (goal/G47.1, found on testicle.js's planted zzcHang): a script that never ends holds the page's
  // one thread for good, so every script after it "never got its spirit" and none of them was classified. Its Chrome ends,
  // and the next script gets a Chrome of its own.
  if (got === null) { freshPage(w); return { err: true, hung: true }; }
  try { return JSON.parse(got); } catch (e) { return { err: true }; }
}

// THE CLASS FROM THE TWO ANSWERS, or why there is none.
// THE NODE REFUSING, NOT THE SCRIPT CRASHING: a page that ran the script and was refused a family's interface because that
// family's server is off on the scratch node (testicle's own, which must stay off there) has loaded it.
const REFUSED_BY_NODE = /^(?:Uncaught \(in promise\) )?(?:Error: )?no interface for the branch \w+$/;
function classOf(node, page) {
  if (page.err && REFUSED_BY_NODE.test(String(page.err).trim())) page = { err: '' };
  if (!node.err && !page.err) return { browserOnly: false, nodeOnly: false };
  if (!node.err && page.err && !page.hung && LACKS_NODE.test(page.err)) return { browserOnly: false, nodeOnly: true };
  if (node.err && !node.hung && LACKS_BROWSER.test(node.err) && !page.err) return { browserOnly: true, nodeOnly: false };
  return null;
}

// The node's testicle, as the reporter finds it: the checkout's own node.
let testicle = null;
function tell(row) {
  testicle = testicle || spirit.requireScript('spirit/app/testicle/api.js');
  return Promise.resolve(testicle).then(function (f) { return f['script.classify'](row); });
}

// COMPILED FIRST, BEFORE ANY SCRATCH NODE (goal/G47.6, box point 3: "The classifier compiles a changed script first, before it
// boots a scratch node; a script that does not compile is a red on the script."): compiled as node compiles a module, in its
// wrapper, and never run. A script that does not compile is red at once, with no node and no Chrome.
function compiles(rel) {
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return true; }
  try { new (require('vm').Script)('(function (exports, require, module, __filename, __dirname) {' + src.replace(/^#!.*/, '') + '\n})', { filename: rel }); return true; }
  catch (e) { return false; }
}
// THE TOOL THAT NEVER REACHED A SCRIPT DOES NOT CHARGE IT (goal/G47.6, box point 1: "The script is spared only when the test
// proves its tool never reached it: the scratch node or Chrome did not come up before anything of the script was loaded.";
// cw: "'not charged' must leave the compiling script waiting to run, not green"): a script that compiles is judged only once
// the scratch node and Chrome are up. When they cannot come up, it gets no test at all, and the run ends with TOOL_DOWN, so
// testicle leaves it unjudged and waiting for classification (../app/testicle/testicle.js, classifyEnded).
const TOOL_DOWN = 3;
function classify(rel, broken) {
  // "its severity is 0.8", written as the number it is (titleRules wants a severity as a number in the call).
  test.run('it loads, so it can be classified', 0.8, async function () {
    // One that does not compile is red at once, before any scratch node.
    if (broken) return false;
    let k = null;
    let node = null;
    try {
      if (neverLoaded(rel)) k = { browserOnly: false, nodeOnly: true };
      else if (fs.existsSync(path.join(RUN, rel))) {
        const w = await world();
        node = w.nodeR[rel] || await loadOnNode(path.join(w.node.root, 'spirit', 'run'), rel);
        const page = await loadOnPage(rel);
        k = classOf(node, page);
      }
    } catch (e) { k = null; }
    if (!k) return false;
    try { await tell(Object.assign({ script: rel }, k, (node && Array.isArray(node.requires)) ? { requires: JSON.stringify(node.requires) } : {})); } catch (e) { return false; }
    return true;
  // Each load inside the scratch node is cut at LOAD_MS.
  }, test.limit.long, { script: rel });
}
const broken = SCRIPTS.filter(function (rel) { return !neverLoaded(rel) && fs.existsSync(path.join(RUN, rel)) && !compiles(rel); });
const toLoad = SCRIPTS.filter(function (rel) { return broken.indexOf(rel) === -1 && !neverLoaded(rel) && fs.existsSync(path.join(RUN, rel)); });
broken.forEach(function (rel) { classify(rel, true); });
SCRIPTS.filter(function (rel) { return neverLoaded(rel) || !fs.existsSync(path.join(RUN, rel)); }).forEach(function (rel) { classify(rel, false); });
if (toLoad.length) {
  // The scratch node and Chrome first, the run held meanwhile; the scripts that compile are judged only once both are up.
  // NEVER LONGER THAN A TEST IS GIVEN (andy-ubuntu stood at "classifying 0 of" for an hour): the scratch node and Chrome were
  // once booted inside the first test, and so cut at its limit; held for here, they are given the same limit, and past it
  // the tool counts as down: nothing of a compiling script is judged, the run ends TOOL_DOWN, and testicle tries again later.
  test.hold();
  let held = true;
  const toolDown = function () { process.on('exit', function () { process.exitCode = TOOL_DOWN; }); };
  const late = setTimeout(function () { if (!held) return; held = false; toolDown(); test.release(); }, test.limit.long);
  world().then(function (w) {
    if (!held) return;
    held = false; clearTimeout(late);
    if (w.error) toolDown();
    else toLoad.forEach(function (rel) { classify(rel, false); });
    test.release();
  }, function () { if (!held) return; held = false; clearTimeout(late); toolDown(); test.release(); });
}

test.after(function () {
  if (!W) return;
  try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (W.node && W.node.child) W.node.child.kill(); } catch (e) { /* gone */ }
  try { if (W.node && W.node.root) setTimeout(function () { try { LABH.freeTree(W.node); } catch (e) { /* busy */ } }, 1000); } catch (e) { /* scratch */ }
});
