'use strict';

// spirit/run/test/testModule.js
// WHICH PRODUCT TESTS TO RUN (goal/G40.6). Andy: "one file in spirit/run/test/testModule(path-name.js) can auto execute
// the bast-radius tests for that one file, and then should be easy for desk or deskClient of deskVerify to automate the
// testing of files named in an item...", and "test module must find all /test/files.js in the run tree."
//
// testsFor(path, { root }) -> [{ test, file? }], every path relative to root (spirit/run/ by default), '/'-separated.
//   - With no path: every test file in any test/ folder of the tree, and each general test once per file it judges.
//   - With a module's path: that file's blast radius. Its own test (./test/<name>.js), every test under ./<name>/ (its
//     components), and the own tests of the modules on its line upward; never a sibling branch. Andy: "re-test all test
//     in ./file/ child-scopes and ../ and ../../ and ../../../ but NOT ../othername/...".
//   - A general test, ./test/<x>-child-<t>.js or ./test/<x>-sibling-<t>.js beside ./<x>.js, is one entry per file it
//     judges, that file in `file`: -child- judges ./<x>.js and ./<x>/ and below, -sibling- ./ and below. It judges only
//     a module with its own test (opting in: "folder without a test/ subfolder won't fail the general assertions in the
//     parent-folders"), and on a blast radius only the changed file and the files below it.
// It names tests and runs none: the harness and deskVerify run each entry as its own suite, a general one with its file
// as the argument. Run from the command line it prints one entry a line, "<test>" or "<test> <file>".

const fs = require('fs');
const path = require('path');

const RUN = path.join(__dirname, '..');
// Never walked: installed packages, node state, git.
const SKIP = ['node_modules', 'relay-state', 'app-state', '.git'];

function posix(p) { return String(p).split(path.sep).join('/'); }

// Every .js under root: the test files (in a folder named test) and the modules (anywhere else).
function walk(root) {
  const tests = [];
  const modules = [];
  (function into(dir) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of names) {
      if (SKIP.indexOf(d.name) !== -1) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) { into(full); continue; }
      if (!d.isFile() || !/\.js$/.test(d.name)) continue;
      const rel = posix(path.relative(root, full));
      if (path.basename(dir) === 'test') tests.push(rel); else modules.push(rel);
    }
  }(root));
  return { tests: tests.sort(), modules: modules.sort() };
}

function dirOf(p) { const i = p.lastIndexOf('/'); return i === -1 ? '' : p.slice(0, i); }
function join(dir, name) { return dir ? dir + '/' + name : name; }
// A module's own test: ./test/<name>.js beside it.
function ownTest(m) { return join(join(dirOf(m), 'test'), path.posix.basename(m)); }
function under(p, dir) { return dir === '' || p.indexOf(dir + '/') === 0; }

// A general test's reach, or null when it is a plain test: the folder holding its test folder, the module it is named
// after, and the files it judges.
function generalOf(t, has) {
  const m = /^(.*?)-(child|sibling)-[^/]+\.js$/.exec(path.posix.basename(t));
  if (!m) return null;
  const folder = dirOf(dirOf(t));
  const module = join(folder, m[1] + '.js');
  if (!has(module)) return null;
  const judges = m[2] === 'child'
    ? function (f) { return f === module || under(f, join(folder, m[1])); }
    : function (f) { return under(f, folder); };
  return { judges: judges };
}

function testsFor(file, opts) {
  const root = (opts && opts.root) || RUN;
  const tree = walk(root);
  const isModule = Object.create(null);
  tree.modules.forEach(function (m) { isModule[m] = true; });
  const isTest = Object.create(null);
  tree.tests.forEach(function (t) { isTest[t] = true; });
  const has = function (m) { return !!isModule[m]; };
  // Opted in: a module with its own test.
  const opted = tree.modules.filter(function (m) { return isTest[ownTest(m)]; });

  let target = '';
  if (file) {
    target = posix(path.isAbsolute(file) ? path.relative(root, file) : file).replace(/^\.\//, '');
    if (!opts || !opts.root) target = target.replace(/^spirit\/run\//, '');
  }

  const out = [];
  const seen = Object.create(null);
  const add = function (test, judged) {
    const key = test + '|' + (judged || '');
    if (seen[key]) return;
    seen[key] = true;
    out.push(judged ? { test: test, file: judged } : { test: test });
  };

  // The files general tests may judge, and the plain tests to run.
  let judged;
  if (!target) {
    judged = opted;
    tree.tests.forEach(function (t) { if (!generalOf(t, has)) add(t); });
  } else {
    const below = join(dirOf(target), path.posix.basename(target, '.js'));
    judged = opted.filter(function (m) { return m === target || under(m, below); });
    if (isTest[ownTest(target)]) add(ownTest(target));
    tree.tests.forEach(function (t) { if (under(t, below) && !generalOf(t, has)) add(t); });
    // The line upward: each folder above the file is a module's components; that module's own test runs.
    let dir = dirOf(target);
    while (dir) {
      const parent = join(dirOf(dir), path.posix.basename(dir) + '.js');
      if (isTest[ownTest(parent)]) add(ownTest(parent));
      dir = dirOf(dir);
    }
  }
  tree.tests.forEach(function (t) {
    const g = generalOf(t, has);
    if (!g) return;
    judged.filter(g.judges).forEach(function (m) { add(t, m); });
  });
  return out;
}

module.exports = { testsFor: testsFor };

if (require.main === module) {
  testsFor(process.argv[2] || '').forEach(function (t) { console.log(t.file ? t.test + ' ' + t.file : t.test); });
}
