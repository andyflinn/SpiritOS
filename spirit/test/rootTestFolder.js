'use strict';

// spirit/test/rootTestFolder.js
// goal/G40.6: the root test folder, the first product tests inside spirit/run/. Written first, red on today's tree, by
// wsl-claude, who does not build it. The box (v19), Andy's words among it: "this item will create only create 3 files"
// and then testModule.js and spirit-child-generalRules.js; "test module must find all /test/files.js in the run
// tree."; "tests like generalRule.js ... obviously also must take a filename argument, and then create separate test
// id's for every file called with that general-rule assertion...."; "just getting a first fail or success, that is a
// success here."
//
// NAMED HERE where the box names none (the builder may argue them under the item first):
//   - testModule.js exports testsFor(path, { root }) -> [{ test, file? }]: test a run-root path of a test file; file,
//     on a general test only, the run-root path of the module it judges. root defaults to spirit/run/. With no path,
//     every test the tree holds; with one, that file's blast radius. Run from the command line it prints the same.
//
// WHAT IS ASSERTED
//   1. The five files are in spirit/run/test/, and spirit/run/test/ is core.
//   2. testModule.testsFor() on the real tree names every .js in any test/ folder of spirit/run/, and the general rule
//      once per file it reaches, spirit.js among them.
//   3. testModule's blast radius on a fixture tree: a changed module gets its own test, the tests below it, and the
//      tests of the modules on its line upward with their -child- general tests; never a sibling branch; nothing twice.
//   4. The new tests run and report in today's format (testSupport's "Test completed" line): spirit/run/test/spirit.js,
//      and the general rule given spirit/run/spirit.js, its result naming that file. Pass or fail alike.
//   5. The harness reaches the run tree through testModule, and no test file of the run tree is run twice.
//   6. spirit.md and TEST_SYSTEM.md say what the box says they hold.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G40.6: ';
const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
const TESTDIR = path.join(RUN, 'test');
const FILES = ['spirit.md', 'spirit.js', 'TEST_SYSTEM.md', 'testModule.js', 'spirit-child-generalRules.js'];
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function rel(p) { return path.relative(RUN, p).split(path.sep).join('/'); }
// Every .js in a test/ folder under a root, by walking it (node_modules and node state left out).
function testFilesUnder(root) {
  const out = [];
  (function walk(dir) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of names) {
      if (d.name === 'node_modules' || d.name === 'relay-state' || d.name === 'app-state' || d.name === '.git') continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full);
      else if (d.isFile() && /\.js$/.test(d.name) && path.basename(dir) === 'test') out.push(full);
    }
  }(root));
  return out;
}

test.startTest('goal/G40.6: the root test folder, the first product tests inside spirit/run/');

// ── 1. THE FILES ───────────────────────────────────────────────────────
test.subHeading('1. the five files are in spirit/run/test/, and the folder is core');
const missing = FILES.filter(function (f) { return !fs.existsSync(path.join(TESTDIR, f)); });
if (!missing.length) test.check('spirit/run/test/ holds ' + FILES.join(', '));
else test.fail(OWED + 'missing from spirit/run/test/: ' + missing.join(', '));
let core = null;
try { core = require('../run/spirit/coreFiles.js').isCore('spirit/run/test/spirit.js', REPO); } catch (e) { core = 'threw ' + e.message; }
if (core === true) test.check('spirit/run/test/ is core');
else test.fail(OWED + 'coreFiles.isCore(spirit/run/test/spirit.js) answered ' + short(core));

// ── 2. THE WHOLE TREE ──────────────────────────────────────────────────
test.subHeading('2. testModule with no path names every test in the run tree, the general rule once per file');
let TM = null;
try { TM = require(path.join(TESTDIR, 'testModule.js')); } catch (e) { TM = null; }
if (!TM || typeof TM.testsFor !== 'function') {
  test.fail(OWED + 'spirit/run/test/testModule.js exports no testsFor');
} else {
  let all = [];
  try { all = TM.testsFor() || []; } catch (e) { all = [{ threw: e.message }]; }
  const named = all.map(function (t) { return t && t.test; });
  const onDisc = testFilesUnder(RUN).map(rel).filter(function (p) { return !/-(child|sibling)-/.test(p); });
  const lost = onDisc.filter(function (p) { return named.indexOf('spirit/run/' + p) === -1 && named.indexOf(p) === -1; });
  if (onDisc.length && !lost.length) test.check('every test file of the run tree is named (' + onDisc.length + ')');
  else test.fail(OWED + 'testModule.testsFor() leaves out ' + short(lost.length ? lost : 'everything: ' + short(all)));
  const rule = all.filter(function (t) { return t && /spirit-child-generalRules\.js$/.test(String(t.test)); });
  const onSpirit = rule.filter(function (t) { return /(^|\/)spirit\.js$/.test(String(t.file)) && !/test\//.test(String(t.file)); });
  if (onSpirit.length === 1) test.check('the general rule is named once for spirit.js, with the file it judges');
  else test.fail(OWED + 'the general rule entries for spirit.js: ' + short(rule));
  const keys = all.map(function (t) { return String(t && t.test) + '|' + String((t && t.file) || ''); });
  const twice = keys.filter(function (k, i) { return keys.indexOf(k) !== i; });
  if (!twice.length) test.check('no test is named twice');
  else test.fail(OWED + 'named twice: ' + short(twice));
}

// ── 3. THE BLAST RADIUS ────────────────────────────────────────────────
test.subHeading('3. one changed file: its own test, below it, its line upward; never a sibling branch');
const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-roottest-'));
try {
  // root/ holds a.js (with components in a/) and c.js; a/ holds b.js; each module has its own test.
  const put = function (p, text) { fs.mkdirSync(path.dirname(path.join(fx, p)), { recursive: true }); fs.writeFileSync(path.join(fx, p), text || '// ' + p + '\n'); };
  ['a.js', 'c.js', 'a/b.js', 'a/b/d.js'].forEach(function (p) { put(p); });
  ['test/a.js', 'test/c.js', 'test/a-child-rule.js', 'a/test/b.js', 'a/b/test/d.js'].forEach(function (p) { put(p); });
  let got = null;
  try { got = TM && typeof TM.testsFor === 'function' ? TM.testsFor('a/b.js', { root: fx }) : null; } catch (e) { got = [{ threw: e.message }]; }
  const tests = (got || []).map(function (t) { return String(t && t.test); });
  const has = function (p) { return tests.some(function (t) { return t === p || t.slice(-p.length - 1) === '/' + p; }); };
  if (got && has('a/test/b.js') && has('a/b/test/d.js') && has('test/a.js') && has('test/a-child-rule.js'))
    test.check('a/b.js runs its own test, the test below it (a/b/), a\'s test on its line, and a\'s -child- rule');
  else test.fail(OWED + 'testsFor(a/b.js) on the fixture gave ' + short(got));
  if (got && !has('test/c.js')) test.check('the sibling branch c is not run');
  else test.fail(OWED + 'testsFor(a/b.js) ran the sibling c: ' + short(tests));
  const rule = (got || []).filter(function (t) { return /a-child-rule\.js$/.test(String(t && t.test)); });
  if (rule.length && rule.every(function (t) { return /b\.js$|d\.js$/.test(String(t.file)); })) test.check('the -child- rule is handed the files it judges: ' + short(rule.map(function (t) { return t.file; })));
  else test.fail(OWED + 'the -child- rule entries: ' + short(rule));
  const keys = (got || []).map(function (t) { return String(t && t.test) + '|' + String((t && t.file) || ''); });
  if (got && keys.every(function (k, i) { return keys.indexOf(k) === i; })) test.check('nothing named twice');
  else test.fail(OWED + 'testsFor(a/b.js) names twice: ' + short(keys));
} finally { try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

// ── 4. THEY RUN AND REPORT ─────────────────────────────────────────────
test.subHeading('4. the new tests run and report in today\'s format, a first fail or success alike');
function runs(args) {
  if (!fs.existsSync(path.join(REPO, args[0]))) return { said: '', code: null, missing: true };
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  return { said: String(r.stdout || '') + String(r.stderr || ''), code: r.status };
}
const own = runs(['spirit/run/test/spirit.js']);
if (/Test completed/.test(own.said)) test.check('spirit/run/test/spirit.js runs and reports (' + ((/Test completed\.([^\n]*)/.exec(own.said) || ['', ''])[1].replace(/\*/g, '').trim()) + ')');
else test.fail(OWED + 'spirit/run/test/spirit.js ' + (own.missing ? 'is missing' : 'did not report: ' + short(own.said.slice(-200))));
const ruled = runs(['spirit/run/test/spirit-child-generalRules.js', 'spirit/run/spirit.js']);
if (/Test completed/.test(ruled.said) && /spirit\.js/.test(ruled.said.replace(/spirit-child-generalRules\.js/g, ''))) test.check('the general rule, given spirit/run/spirit.js, runs and reports its result under that file');
else test.fail(OWED + 'the general rule given spirit.js ' + (ruled.missing ? 'is missing' : 'did not report a result naming the file: ' + short(ruled.said.slice(-200))));

// ── 5. THE HARNESS ─────────────────────────────────────────────────────
test.subHeading('5. the harness reaches the run tree through testModule, and runs nothing twice');
const runAll = read(path.join(__dirname, 'runAll.js'));
if (/testModule/.test(runAll)) test.check('runAll.js asks testModule for the run tree\'s tests');
else test.fail(OWED + 'runAll.js does not reach the run tree through testModule');
const listed = spawnSync(process.execPath, [path.join(__dirname, 'runAll.js'), '--list'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
const lines = String(listed.stdout || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /\.js(\s|$)/.test(l); });
// runAll --list prints paths relative to spirit/test/, so a run-tree test reads ../run/... there.
const runTree = lines.filter(function (l) { return /(^|\/)run\//.test(l); });
const dup = runTree.filter(function (l, i) { return runTree.indexOf(l) !== i; });
if (runTree.some(function (l) { return /run\/test\/spirit\.js/.test(l); }) && !dup.length) test.check('runAll --list names the run tree\'s tests once each (' + runTree.length + ')');
else test.fail(OWED + 'runAll --list: run-tree lines ' + short(runTree.slice(0, 6)) + (dup.length ? ', twice: ' + short(dup) : ''));

// ── 6. THE DOCUMENTS ───────────────────────────────────────────────────
test.subHeading('6. spirit.md and TEST_SYSTEM.md say what they are for');
const md = read(path.join(TESTDIR, 'spirit.md'));
if (/spirit\.require/.test(md) && /global/i.test(md)) test.check('spirit.md names the global spirit object and spirit.require');
else test.fail(OWED + 'spirit.md does not name the global spirit object and spirit.require');
const ts = read(path.join(TESTDIR, 'TEST_SYSTEM.md'));
const terms = ['-child-', '-sibling-', 'testModule', 'opt'];
const lack = terms.filter(function (t) { return ts.toLowerCase().indexOf(t.toLowerCase()) === -1; });
if (!lack.length) test.check('TEST_SYSTEM.md names the -child- and -sibling- tests, testModule and opting in');
else test.fail(OWED + 'TEST_SYSTEM.md does not name: ' + lack.join(', '));

test.reportSuccessFailureCount();
process.exit(0);
