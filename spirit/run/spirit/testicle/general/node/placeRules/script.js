'use strict';
// spirit/run/spirit/testicle/general/node/placeRules/script.js
// A RULE MODULE OF THE -node GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test
// system", the general rules become modules, one rule set one module). Its checks are the whole of the old -node runner of spirit/test/,
// which had no parts, moved here unchanged in what they check and in their titles; its runner now is spirit/testicle/run/node/script.js that loads this
// module and calls it. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }
// (spirit/testicle/general/any/typeRules/script.js says each).
//
// The checks that load a script on the node: generalRules' "required alone on the node" (goal/G43.32, the box, testing
// point 3; Andy: "a general test for any scriptFile.js is to spirit.require() it.", Q5: "I'm NOT demanding that all scripts
// load in all environments, I'm demanding that they're placed in the spirit object according to these rules IF they are
// required."). On the node a script answers at once and stands at its path on the spirit object, spirit.<its path minus spirit>
// (goal/G49.23: no spirit.required); a branch's api.js binds its branch and is judged by its place alone. Each script in a
// process of its own, in a copy of the tree, so a server script never starts on the live checkout.
//
// ONE COPY OF THE TREE FOR THE WHOLE RUN (as the file it came from): the runner calls checks once a script handed, or once
// with '' for every product script; the copy is made once, by the first call, for every script of the run, and its node
// holds the apps of every script handed (each call adds its script before the copy is made, at the run's first turn). What
// the run shares is kept on the tools it hands (tools.nodeCopy).
const SPIRIT = require('../../../../script.js');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

// Every script testicle hands it: one not there, or not loading, is red in its checks, as before.
function appliesTo(scriptPath) {
  return true;
}

// A path's place on the spirit object itself (goal/G49.23, no spirit.required): its first key spirit the object, a folder's
// script.js at its folder's own name (goal/G49.9), spirit/fs/script.js at spirit.fs.
function placeKeys(rel) { const k = rel.replace(/\.js$/, '').split('/'); if (k.length > 1 && k[k.length - 1] === 'script') k.pop(); return k.slice(1); }
function productScripts(RUN) {
  return execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && f !== 'spirit/script.js' && fs.existsSync(path.join(RUN, f)); });
}
const BRANCH_FILTER = SPIRIT.requireScript('spirit/fs/filter/branch/script.js');
function isBranchScript(RUN, rel) { return /\/script\.js$/.test(rel) && BRANCH_FILTER.branch(path.posix.dirname(rel), function (p) { return fs.existsSync(path.join(RUN, p)); }) === true; }
function requireOnNode(RUN, run, rel) {
  return new Promise(function (resolve) {
    // A branch's api.js (decided 8) binds the branch, so it is waited on and judged by its place alone; every other script
    // answers at once and stands at its place as that answer.
    // A new-shape branch's script.js is its interface too (goal/G49.23; the system's own rule, spirit/fs/filter/branch/script.js):
    // bound as an api.js is, so judged the same way.
    const iface = /\/api\.js$/.test(rel) || isBranchScript(RUN, rel);
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "script.js"));' +
      '(async function () { let at = null, err = false, promise = false; try { at = s.requireScript(' + JSON.stringify(rel) + '); promise = !!(at && typeof at.then === "function"); if (' + iface + ' && promise) at = await at; } catch (e) { err = !!String(e && e.message || e); }' +
      'const keys = ' + JSON.stringify(placeKeys(rel)) + '; const place = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, s);' +
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
      resolve(r || (hung ? { err: true, promise: false, placed: false } : { err: false, program: true, promise: false, placed: false }));
    });
  });
}

// checks(scriptPath, tools): tools { test, run, spirit, nodeCopy?, before? }; tools.before(run), when handed, plants what a
// test needs in the copy before its node starts (spirit/testicle/headLessChrome/script.js scratchNode's o.before).
function checks(scriptPath, tools) {
  const test = tools.test;
  const RUN = tools.run;
  const rel = String(scriptPath || '');
  const E = tools.nodeCopy || (tools.nodeCopy = { run: '', root: '', given: [], said: false });
  if (rel) E.given.push(rel);
  if (!E.said) {
    E.said = true;
    // A COPY OF THE TREE WITH A NODE OF ITS OWN (goal/G47.1, cleaning, Andy's testicle's first red: spirit/app/backup/api.js
    // "does not load on the node: this VM has no node: spirit/state/environment.json names no port"): an app's api.js binds its
    // family through the node, so the copy is a scratch node's tree, the apps of the scripts handed turned on (every app, handed
    // none), its environment naming that node's port, as on a VM that runs one.
    const { scratchNode } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
    test.run('a copy of the tree with a node of its own is made to require the scripts in', 0.2, async function () {
      const apps = (E.given.length ? E.given : execFileSync('git', ['ls-files', '--', 'spirit/app'], { cwd: RUN, encoding: 'utf8' }).split('\n'))
        .map(function (f) { return (/^spirit\/app\/([^/]+)\//.exec(f) || [])[1]; }).filter(function (a, i, all) { return a && all.indexOf(a) === i; });
      E.node = await scratchNode({ servers: apps.map(function (n) { return SPIRIT.dottedPath('spirit/app/' + n); }), before: tools.before });
      if (!E.node || !E.node.up) return false;
      if (!E.node.root) return false;
      E.root = E.node.root;
      E.run = path.join(E.root, 'spirit', 'run');
      const env = path.join(E.run, 'spirit', 'state', 'environment.json');
      if (!fs.existsSync(env)) { fs.mkdirSync(path.dirname(env), { recursive: true }); fs.writeFileSync(env, JSON.stringify({ PORT: Number(new URL(E.node.base).port) })); }
      return fs.existsSync(path.join(E.run, 'spirit', 'script.js')) || false;
    }, test.limit.slow, { why: 'it starts a scratch node on a copy of the tree' });
    test.after(async function () {
      if (E.node && E.node.child) { try { E.node.child.kill(); } catch (e) { /* gone */ } await new Promise(function (r) { setTimeout(r, 300); }); }
      if (E.root) try { SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(E); } catch (e) { /* scratch */ }
    });
  }

  if (!rel) {
    // every product script, placed on the spirit object where it is required
    test.run('more than a hundred product scripts are found, each to be required alone on the node and on a page', 0.2, function () {
      E.req = productScripts(RUN);
      return E.req.length > 100 || false;
    }, test.limit.quick);
    test.run('some of the product scripts load on the node', 0.2, async function () {
      if (!E.run || !E.req) return false;
      E.nodeLoaded = []; E.nodeBad = [];
      for (const f of E.req) {
        const r = await requireOnNode(RUN, E.run, f);
        if (r.err || r.program) continue;
        E.nodeLoaded.push(f);
        if (r.promise) E.nodeBad.push(f);
        else if (!r.placed) E.nodeBad.push(f);
      }
      return E.nodeLoaded.length > 0 || false;
    }, test.limit.long, { why: 'it spawns node to require each product script' });
    test.run('on the node, every script that loads answers at once and stands at spirit.<path minus spirit>', 0.4, function () {
      if (!E.nodeLoaded) return false;
      return (E.nodeLoaded.length > 0 && !E.nodeBad.length) || false;
    }, test.limit.quick);
    return;
  }
  // Each script given judged in this one run, its result reported for that script (opts.script), so a failure says which.
  test.run('on the node, the script loads, answers at once and stands at spirit.<path minus spirit>', 0.4, async function () {
    if (!E.run) return false;
    if (!fs.existsSync(path.join(RUN, rel))) return false;
    const r = await requireOnNode(RUN, E.run, rel);
    if (r.err) return false;
    if (r.program) return true;
    if (r.promise) return false;
    return r.placed || false;
  }, test.limit.slow, { script: rel, why: 'it spawns node to require the script' });
}

// The names its checks look for: none (goal/G49.27, Andy: "All, cw's way").
const FORBIDS_NAMES = [];
// Its own node: it turns the apps of its scripts on and writes the copy's environment (own true).
module.exports = { appliesTo: appliesTo, resource: 'node', own: true, forbids: FORBIDS_NAMES, checks: checks };
