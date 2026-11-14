'use strict';
// spirit/run/spirit/test/spirit-sibling-node.js [<script> ...]
// THE -node GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests, at any level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
// <file>-<child | sibling>-browser.js", "existing general tests fold into the appropriate of the 3 new general test
// name-formats"). Its contract: ./spirit-sibling-node.md.
//
// The checks that load a script on the node: generalRules' "required alone on the node" (goal/G43.32, the box, testing
// point 3; Andy: "a general test for any scriptFile.js is to spirit.require() it.", Q5: "I'm NOT demanding that all scripts
// load in all environments, I'm demanding that they're placed in the spirit object according to these rules IF they are
// required."). On the node a script answers at once and stands at spirit.required.<its path>; a branch's api.js binds its
// branch and is judged by its place alone. Each script in a process of its own, in a copy of the tree, so a server script
// never starts on the live checkout.
//
// "with no script-argument, they will process all applicable scripts. else it will process all scripts listed in the
// arguments that fit"; "node only scripts are tested by -general AND -node general tests ... if a script is NOT browser only
// AND NOT node only, it will be tested by all 3 categories": testicle hands it no browser-only script. No argument: every
// product script, a script that does not load on the node left unjudged. Several: each judged in this one run, its result reported for it.
require('../spirit.js');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const RUN = path.join(__dirname, '..', '..');
const ARGV = process.argv.slice(2);
const GIVEN = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test'; })
  .map(function (a) { return runRel(a); });

// A path as given, absolute or not, scoped to run:// (the verifier hands absolute ones).
function runRel(a) {
  const p = require('path');
  const abs = p.isAbsolute(String(a)) ? String(a) : p.resolve(String(a));
  const r = p.relative(RUN, abs).split(p.sep).join('/');
  if (r && r.indexOf('..') !== 0 && !p.isAbsolute(r) && require('fs').existsSync(abs)) return r;
  return String(a).split(p.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '');
}

const test = require('./testReport.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function placeKeys(rel) { return rel.replace(/\.js$/, '').split('/'); }
function productScripts() {
  return execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && f !== 'spirit/spirit.js' && fs.existsSync(path.join(RUN, f)); });
}
function requireOnNode(run, rel) {
  return new Promise(function (resolve) {
    // A branch's api.js (decided 8) binds the branch, so it is waited on and judged by its place alone; every other script
    // answers at once and stands at its place as that answer.
    const iface = /\/api\.js$/.test(rel);
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "spirit.js"));' +
      '(async function () { let at = null, err = "", promise = false; try { at = s.require(' + JSON.stringify(rel) + '); promise = !!(at && typeof at.then === "function"); if (' + iface + ' && promise) at = await at; } catch (e) { err = String(e && e.message || e); }' +
      'const keys = ' + JSON.stringify(placeKeys(rel)) + '; const place = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, s.required);' +
      'process.stdout.write("\\n@@" + JSON.stringify({ err: err, promise: ' + iface + ' ? false : promise, placed: ' + iface + ' ? place !== undefined : place !== undefined && place === at }) + "\\n"); process.exit(0); }());';
    const kid = spawn(process.execPath, ['-e', probe], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    kid.stdout.on('data', function (d) { out += d; });
    kid.stderr.on('data', function (d) { out += d; });
    let hung = false;
    const t = setTimeout(function () { hung = true; kid.kill('SIGKILL'); }, 20000);
    kid.on('close', function () {
      clearTimeout(t);
      const m = /\n@@(.*)\n/.exec(out);
      let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
      // A PROGRAM (goal/G47.1, box v95, 1: "A process that ends with nothing caught has loaded, whatever its exit code (an app
      // server that exits at once, \"no --state\", has loaded)"): it ended the process before saying where it stands,
      // nothing thrown; loaded, its place not judged. Still running at the limit: a hang.
      resolve(r || (hung ? { err: 'it did not finish loading', promise: false, placed: false } : { err: '', program: true, promise: false, placed: false }));
    });
  });
}

const E = { run: '', root: '' };
// A COPY OF THE TREE WITH A NODE OF ITS OWN (goal/G47.1, cleaning, Andy's testicle's first red: spirit/app/backup/api.js
// "does not load on the node: this VM has no node: spirit/state/environment.json names no port"): an app's api.js binds its
// family through the node, so the copy is a scratch node's tree, the apps of the scripts handed turned on (every app, handed
// none), its environment naming that node's port, as on a VM that runs one.
const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
test.run('the world: a copy of the tree to require the scripts in', 0.2, async function () {
  const apps = (GIVEN.length ? GIVEN : execFileSync('git', ['ls-files', '--', 'spirit/app'], { cwd: RUN, encoding: 'utf8' }).split('\n'))
    .map(function (f) { return (/^spirit\/app\/([^/]+)\//.exec(f) || [])[1]; }).filter(function (a, i, all) { return a && all.indexOf(a) === i; });
  E.node = await scratchNode({ servers: apps });
  if (!E.node || !E.node.up) return 'the scratch node did not come up';
  if (!E.node.root) return 'a shared scratch node has no tree of its own to require in';
  E.root = E.node.root;
  E.run = path.join(E.root, 'spirit', 'run');
  const env = path.join(E.run, 'spirit', 'state', 'environment.json');
  if (!fs.existsSync(env)) { fs.mkdirSync(path.dirname(env), { recursive: true }); fs.writeFileSync(env, JSON.stringify({ PORT: Number(new URL(E.node.base).port) })); }
  return fs.existsSync(path.join(E.run, 'spirit', 'spirit.js')) || 'the copy holds no spirit/spirit.js';
}, test.limit.slow);

if (!GIVEN.length) {
  // every product script, placed in spirit.required where it is required
  test.run('the world: the product scripts, each required alone on the node and on a page', 0.2, function () {
    E.req = productScripts();
    return E.req.length > 100 || 'too few scripts to judge: ' + E.req.length;
  }, test.limit.quick);
  test.run('the world: some of them load on the node', 0.2, async function () {
    if (!E.run || !E.req) return 'no copy of the tree: the world failed';
    E.nodeLoaded = []; E.nodeBad = [];
    for (const f of E.req) {
      const r = await requireOnNode(E.run, f);
      if (r.err || r.program) continue;
      E.nodeLoaded.push(f);
      if (r.promise) E.nodeBad.push(f + ': spirit.require answered a promise, not the module at once');
      else if (!r.placed) E.nodeBad.push(f + ': nothing stands at spirit.required.' + placeKeys(f).join('.'));
    }
    return E.nodeLoaded.length > 0 || 'none loads on the node: nothing judged there';
  }, test.limit.long);
  test.run('on the node: all that load answer at once and stand at spirit.required.<path>', 0.4, function () {
    if (!E.nodeLoaded) return 'nothing required on the node: the world failed';
    return (E.nodeLoaded.length > 0 && !E.nodeBad.length) || E.nodeBad.length + ' of ' + E.nodeLoaded.length + ' do not; the first: ' + short(E.nodeBad.slice(0, 5));
  }, test.limit.quick);
} else GIVEN.forEach(function (rel) {
  // Each script given judged in this one run, its result reported for that script (opts.script), so a failure says which.
  test.run('on the node: it loads, answers at once and stands at spirit.required.<path>', 0.4, async function () {
    if (!E.run) return 'no copy of the tree: the world failed';
    if (!fs.existsSync(path.join(RUN, rel))) return rel + ' is not there';
    const r = await requireOnNode(E.run, rel);
    if (r.err) return rel + ' does not load on the node: ' + short(r.err);
    if (r.program) { test.comment(rel + ' ends its process when loaded, nothing thrown: a program, loaded; its place is not judged'); return true; }
    if (r.promise) return rel + ': spirit.require answered a promise, not the module at once';
    return r.placed || rel + ': nothing stands at spirit.required.' + placeKeys(rel).join('.');
  }, test.limit.slow, { script: rel });
});

test.after(async function () {
  if (E.node && E.node.child) { try { E.node.child.kill(); } catch (e) { /* gone */ } await new Promise(function (r) { setTimeout(r, 300); }); }
  if (E.root) try { require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(E); } catch (e) { /* scratch */ }
});
