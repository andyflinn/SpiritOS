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
const { spawn, execFileSync } = require('child_process');
const test = require('./testReport.js');
const { until, freePort, findChrome, chromePage, WAIT } = require('./headLessChrome.js');

const RUN = path.join(__dirname, '..', '..');
// "a load that is not complete in 3 seconds counts as crash/hang".
const LOAD_MS = 3000;
const SEVERITY = 0.8;
// "classify hard-codes server.js and relayServer.js as node-only": never loaded.
const NODE_ONLY = ['spirit/server.js', 'spirit/relayServer.js'];
// What a page lacks, and what the node lacks, as the error a load threw names it.
const LACKS_NODE = /\b(require|process|module|exports|__dirname|__filename|Buffer|global) is not defined\b|Cannot find module|\bfs\b.*not defined/;
const LACKS_BROWSER = /\b(window|document|navigator|location|localStorage|sessionStorage|HTMLElement|customElements|getComputedStyle) is not defined\b/;

function posix(p) { return String(p).split(path.sep).join('/'); }
function productScripts() {
  return execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && fs.existsSync(path.join(RUN, f)); });
}
const given = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test' && all[i - 1] !== '--verify-port'; })
  .map(function (a) { return posix(a).replace(/^\.?\//, ''); });
const SCRIPTS = given.length ? given : productScripts();

// THE NODE SIDE: the script required in a process of its own, inside a try; what it caught is told before it ends. Nothing
// told and the process ended: it loaded, whatever its exit code. Still running at the limit: a hang.
function loadOnNode(run, rel) {
  return new Promise(function (resolve) {
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "spirit.js"));' +
      'const tell = function (o) { try { process.stdout.write("\\n@@" + JSON.stringify(o) + "\\n"); } catch (e) { /* gone */ } };' +
      'process.on("uncaughtException", function (e) { tell({ err: String(e && e.message || e) }); process.exit(0); });' +
      'try { s.require(' + JSON.stringify(rel) + '); tell({ err: "" }); } catch (e) { tell({ err: String(e && e.message || e) }); }' +
      'setTimeout(function () { process.exit(0); }, 50);';
    const kid = spawn(process.execPath, ['-e', probe], { cwd: run, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let out = '';
    let hung = false;
    kid.stdout.on('data', function (d) { out += d; });
    const t = setTimeout(function () { hung = true; try { kid.kill('SIGKILL'); } catch (e) { /* gone */ } }, LOAD_MS);
    kid.on('close', function () {
      clearTimeout(t);
      const m = /\n@@(.*)\n/.exec(out);
      let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
      if (r) return resolve(r);
      resolve(hung ? { err: 'it did not finish loading in ' + LOAD_MS + ' ms', hung: true } : { err: '' });
    });
  });
}

// THE PAGE SIDE: a fresh face page of the scratch node, the script required there; a thrown error or one the page reported
// is its answer; not answered in time, a hang.
// ITS OWN SCRATCH NODE, ON A COPY OF THIS TREE AS IT STANDS (not git's list: a script not yet committed is classified too,
// and a tree with no git, a test's scratch tree, has one all the same): every file under spirit/run but the node's state,
// .git and node_modules, then spirit/server.js started there on a free port, its DEBUG on.
const SKIP_DIRS = ['state', 'app-state', '.git'];
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach(function (d) {
    if (d.isDirectory()) { if (SKIP_DIRS.indexOf(d.name) === -1) copyTree(path.join(from, d.name), path.join(to, d.name)); }
    else if (d.isFile()) fs.copyFileSync(path.join(from, d.name), path.join(to, d.name));
  });
}
async function ownScratch() {
  const root = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-classify-'));
  const run = path.join(root, 'spirit', 'run');
  copyTree(RUN, run);
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore', windowsHide: true });
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
  W = { node: null, page: null, error: '' };
  W.node = await ownScratch();
  if (!W.node.up) { W.error = 'its scratch node did not come up'; return W; }
  const chrome = findChrome();
  if (!chrome) { W.error = 'no Chrome on this machine'; return W; }
  W.page = await chromePage(chrome);
  if (!W.page || W.page.error) { W.error = 'no Chrome page: ' + String(W.page && W.page.error); W.page = null; }
  return W;
}
async function loadOnPage(rel) {
  const w = await world();
  if (w.error) return { err: w.error, tool: true };
  await w.page.send('Page.navigate', { url: w.node.base + '/face.html' });
  const ready = await until(function () { return w.page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, WAIT);
  if (!ready) return { err: 'the scratch node\'s page never got its spirit', tool: true };
  const ask = w.page.evaluate('window.spirit.ready.then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); });' +
    ' return spirit.require(' + JSON.stringify(rel) + '); }).then(function () { return JSON.stringify({ err: (window.pageErrors || []).join("; ") }); },' +
    ' function (e) { return JSON.stringify({ err: String(e && e.message || e) }); })');
  const late = new Promise(function (r) { setTimeout(function () { r(null); }, LOAD_MS); });
  const got = await Promise.race([ask, late]);
  if (got === null) return { err: 'it did not finish loading in ' + LOAD_MS + ' ms', hung: true };
  try { return JSON.parse(got); } catch (e) { return { err: 'the page answered ' + String(got).slice(0, 200) }; }
}

// THE CLASS FROM THE TWO ANSWERS, or why there is none.
function classOf(node, page) {
  if (!node.err && !page.err) return { browserOnly: false, nodeOnly: false };
  if (!node.err && page.err && !page.hung && LACKS_NODE.test(page.err)) return { browserOnly: false, nodeOnly: true };
  if (node.err && !node.hung && LACKS_BROWSER.test(node.err) && !page.err) return { browserOnly: true, nodeOnly: false };
  return null;
}

// The node's testicle, as the reporter finds it: the checkout's own node.
let testicle = null;
function tell(row) {
  testicle = testicle || spirit.require(spirit.familyPath('testicle'));
  return Promise.resolve(testicle).then(function (f) { return f['script.classify'](row); });
}

SCRIPTS.forEach(function (rel) {
  test.run('classifyable', SEVERITY, async function () {
    let k = null;
    let why = '';
    if (NODE_ONLY.indexOf(rel) !== -1) k = { browserOnly: false, nodeOnly: true };
    else if (!fs.existsSync(path.join(RUN, rel))) why = 'it is not there';
    else {
      const w = await world();
      const run = w.node && w.node.root ? path.join(w.node.root, 'spirit', 'run') : RUN;
      const node = await loadOnNode(run, rel);
      const page = await loadOnPage(rel);
      k = classOf(node, page);
      if (!k) why = 'on the node: ' + (node.err || 'loaded') + '; in a page: ' + (page.err || 'loaded');
    }
    if (!k) return 'not classifyable: ' + why;
    try { await tell(Object.assign({ script: rel }, k)); } catch (e) { return 'classified ' + JSON.stringify(k) + ', but testicle.script.classify refused it: ' + String(e && e.message || e); }
    return true;
  // The first one boots the scratch node and Chrome; each load inside it is cut at LOAD_MS.
  }, test.limit.long, { script: rel });
});

test.after(function () {
  if (!W) return;
  try { if (W.page && W.page.kid) W.page.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (W.node && W.node.child) W.node.child.kill(); } catch (e) { /* gone */ }
  try { if (W.node && W.node.root) setTimeout(function () { try { fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* busy */ } }, 1000); } catch (e) { /* scratch */ }
});
