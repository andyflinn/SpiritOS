'use strict';

// spirit/run/spirit/test/test/spirit-sibling-noFuckingGarbage.js
// The tests of spirit/test/spirit-sibling-noFuckingGarbage.js, the garbage rule, and of no other module (spec:
// ./spirit-sibling-noFuckingGarbage.md). goal/G47.1, the cycle "missing tests reported", the box:
// "spirit-sibling-noFuckingGarbage also reports missing tests, in one check, "every production script has its own test",
// severity 0.2: red while any production script has no own test, test/<name>.js beside it, its answer naming every script
// missing one. Over the whole tree (handed nothing, or spirit.js) it judges every production script; handed one script, that
// one, by the same check. One check, not one per script", "Vendored scripts are left out of the check" (Andy: "damn right,
// every missing script-companion-suite is a red at 0.2", and "it is ok to exclude the vendored scripts.").
//
// HOW IT IS TRIED: a scratch copy of the tracked files of spirit/run, in a git index of its own (the rule asks git which
// files are tracked), with planted scripts: has.js with its own test, lacks.js with none, and a script in a vendored folder
// with none. The rule runs there as its own process; with no environment.json, its reporter reports to no node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

const RULE = path.join(RUN, 'spirit', 'test', 'spirit-sibling-noFuckingGarbage.js');
const CHECK = 'every production script has its own test';
const HAS = 'spirit/zzGarbage/has.js';
const LACKS = 'spirit/zzGarbage/lacks.js';
const VENDORED = 'spirit/element/codeMirror/zzVendored.js';
const PLANT = {};
PLANT[HAS] = '\'use strict\';\n// has, with its own test\n';
PLANT['spirit/zzGarbage/test/has.js'] = '\'use strict\';\n// the test of has\n';
PLANT['spirit/zzGarbage/test/has.md'] = '# the test of has\n';
PLANT[LACKS] = '\'use strict\';\n// lacks, no test of its own\n';
PLANT[VENDORED] = '\'use strict\';\n// a vendored script, no test of its own\n';

let root = null, run = null;
// The rule run in the scratch tree, handed arg or nothing: the line its check printed, or ''.
function lineOf(arg) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'spirit-sibling-noFuckingGarbage.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String((e && e.stdout) || ''); }
  return out.split('\n').filter(function (l) { return /(SUCCESS|FAILURE) #/.test(l) && l.indexOf(': ' + CHECK) !== -1; })[0] || '';
}
const NOWORLD = 'no scratch tree: the world failed';

test.after(function () { try { if (root) fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

test.run('the world: a scratch tree of the tracked files, the planted scripts with them, in a git index of its own', 0.2, function () {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-garbage-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  execSync('git init -q && git add -A', { cwd: root, stdio: 'ignore' });
  const listed = execSync('git ls-files -- spirit/run/spirit/zzGarbage', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return listed.length === 4 || 'the scratch index lists ' + short(listed);
}, test.limit.long);

// the box: "in one check, "every production script has its own test", severity 0.2"
test.run('the rule holds the check "every production script has its own test", at severity 0.2', 0.2, function () {
  const src = fs.readFileSync(RULE, 'utf8');
  return /test\.run\(\s*'every production script has its own test'\s*,\s*0\.2\s*,/.test(src) || 'no test.run(\'' + CHECK + '\', 0.2, ...) in ' + path.relative(RUN, RULE);
}, test.limit.quick);

// the box: "Over the whole tree (handed nothing, or spirit.js) it judges every production script", "red while any
// production script has no own test ... its answer naming every script missing one", "Vendored scripts are left out"
let whole = '';
test.run('over the whole tree, with a script missing its own test, the check is red', 0.2, function () {
  if (!run) return NOWORLD;
  whole = lineOf('');
  return /FAILURE #/.test(whole) || 'the check printed ' + short(whole || 'nothing');
}, test.limit.slow);
test.run('its answer names the script missing its own test', 0.2, function () {
  return whole.indexOf(LACKS) !== -1 || 'the line: ' + short(whole || 'nothing');
}, test.limit.quick);
test.run('its answer names no script that has its own test', 0.2, function () {
  return (!!whole && whole.indexOf(HAS) === -1) || 'the line: ' + short(whole || 'nothing');
}, test.limit.quick);
test.run('its answer names no vendored script', 0.2, function () {
  return (!!whole && whole.indexOf('zzVendored.js') === -1 && whole.indexOf('spirit/element/codeMirror/') === -1 && whole.indexOf('spirit/job/chokidar/') === -1 && whole.indexOf('spirit/job/readdirp/') === -1) || 'the line names a vendored script: ' + short(whole || 'nothing');
}, test.limit.quick);
test.run('handed spirit.js, it judges the whole tree the same', 0.2, function () {
  if (!run) return NOWORLD;
  const l = lineOf('spirit/spirit.js');
  return (/FAILURE #/.test(l) && l.indexOf(LACKS) !== -1) || 'the check printed ' + short(l || 'nothing');
}, test.limit.slow);

// the box: "handed one script, that one, by the same check"
test.run('handed a script with its own test, the check is green', 0.2, function () {
  if (!run) return NOWORLD;
  const l = lineOf(HAS);
  return /SUCCESS #/.test(l) || 'the check printed ' + short(l || 'nothing');
}, test.limit.slow);
test.run('handed a script with no own test, the check is red, naming that script', 0.2, function () {
  if (!run) return NOWORLD;
  const l = lineOf(LACKS);
  return (/FAILURE #/.test(l) && l.indexOf(LACKS) !== -1) || 'the check printed ' + short(l || 'nothing');
}, test.limit.slow);
