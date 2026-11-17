'use strict';

// spirit/run/spirit/test/test/spirit-sibling-general.js
// The tests of the garbage rule, the noFuckingGarbage part of spirit/test/spirit-sibling-general.js (goal/G47.1, box v94, 2:
// the general tests folded into three), and of no other part (spec: ./spirit-sibling-general.md). goal/G47.1, the cycle "missing tests reported", the box:
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


const RULE = path.join(RUN, 'spirit', 'test', 'spirit-sibling-general.js');
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
// A module whose first require is not spirit.js (goal/G47.1; moved here from spirit/test/spirit.js: Andy, "11. is
// spirit-sibling-general"). Planted inside the tree, where the general test judges.
const LATE = 'spirit/zzGarbage/late.js';
PLANT[LATE] = '\'use strict\';\nconst fs = require(\'fs\');\nrequire(\'../spirit.js\');\n';
// WHAT IT CHANGES, IT LISTENS FOR, THROUGH A CHILD ON A BRANCH (goal/G47.1; wsl, of the model table: "the list it mounts ... is
// what shows the result, so it does listen, through its child"; cw: "A child it mounts on a branch counts as its listening"):
// an element that writes and mounts a child it requires, handed a branch by name, the child searching that branch; and one
// that writes and listens to nothing. Planted in a folder of their own, so the five above stay the garbage folder's.
const LISTENS = 'spirit/zzListen/writer.js';
const DEAF = 'spirit/zzListen/deaf.js';
const WRITES = 'it sends writes and watches spirit.data';
PLANT['spirit/zzListen/child.js'] = '\'use strict\';\nwindow.spirit.require(\'spirit/element/search.js\');\nfunction branchOf(n) { return \'zz/\' + n; }\nvar made = function (o) { return { data: branchOf(o.table) }; };\nwindow.spirit.required.spirit.element.installSpiritElement(window.spirit, \'spirit/zzListen/child.js\', { create: made });\n';
PLANT[LISTENS] = '\'use strict\';\nwindow.spirit.require(\'spirit/zzListen/child.js\');\nvar ask = { op: \'set\', table: \'zz\' };\nwindow.spirit.required.spirit.element.installSpiritElement(window.spirit, \'spirit/zzListen/writer.js\', { create: function () { return ask; } });\n';
PLANT[DEAF] = '\'use strict\';\nvar ask = { op: \'set\', id: \'zz\' };\nwindow.spirit.required.spirit.element.installSpiritElement(window.spirit, \'spirit/zzListen/deaf.js\', { create: function () { return ask; } });\n';

// NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "no developer will want to use a system that
// pollutes global name-spaces.", "go on this"): a node script that assigns a name onto global, and one that hands out its
// value through module.exports alone.
const LEAKY = 'spirit/zzGlobal/leaky.js';
const CLEAN = 'spirit/zzGlobal/clean.js';
const GLOBALS = 'loaded in a node, it adds nothing to the global object or to process but spirit';
PLANT[LEAKY] = ["'use strict';", "require('../spirit.js');", 'global.zzLeaked = 1;', 'module.exports = {};', ''].join('\n');
PLANT[CLEAN] = ["'use strict';", "require('../spirit.js');", 'const zzKept = 1;', 'module.exports = { zzKept: zzKept };', ''].join('\n');

let root = null, run = null;
// The rule run in the scratch tree, handed arg or nothing: its check as printed (spirit/test/testReport.js prints each test
// as its title and its mark, under its script's heading), { red, script }, or null when the check printed nothing.
function lineOf(arg, check, env) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'spirit-sibling-general.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
  let script = '';
  let found = null;
  out.split('\n').forEach(function (l) {
    const t = l.replace(/^\*+\s*/, '').trim();
    const m = /^(.*) ([✅❌])$/.exec(t);
    if (!m) { if (t && !/^\*|Test completed/.test(t)) script = t; return; }
    if (!found && m[1] === (check || CHECK)) found = { red: m[2] === '❌', script: script };
  });
  return found;
}

test.after(function () { try { if (root) fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

test.run('a scratch tree is made of the tracked files and the planted scripts, in a git index of its own', 0.2, function () {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-garbage-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  execSync('git init -q && git add -A', { cwd: root, stdio: 'ignore' });
  const listed = execSync('git ls-files -- spirit/run/spirit/zzGarbage', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return listed.length === 5 || false;
}, test.limit.long);

// the box: "in one check, "every production script has its own test", severity 0.2"
test.run('the rule holds the check "every production script has its own test", at severity 0.2', 0.2, function () {
  const src = fs.readFileSync(RULE, 'utf8');
  return /test\.run\(\s*'every production script has its own test'\s*,\s*0\.2\s*,/.test(src) || false;
}, test.limit.quick);

// the box: "Over the whole tree (handed nothing, or spirit.js) it judges every production script", "red while any
// production script has no own test ... its answer naming every script missing one", "Vendored scripts are left out"
// A test's one string is its title (goal/G47.1): the check answers red or green, and names no script in a text.
test.run('over the whole tree, with a script missing its own test, the check is red', 0.2, function () {
  if (!run) return false;
  const l = lineOf('');
  return (!!l && l.red) || false;
}, test.limit.slow);
test.run('handed spirit.js, it judges the whole tree the same', 0.2, function () {
  if (!run) return false;
  const l = lineOf('spirit/spirit.js');
  return (!!l && l.red) || false;
}, test.limit.slow);

// the box: "handed one script, that one, by the same check"
test.run('handed a script with its own test, the check is green', 0.2, function () {
  if (!run) return false;
  const l = lineOf(HAS);
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('handed a script with no own test, the check is red, under that script', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LACKS);
  return (!!l && l.red && l.script.indexOf(LACKS) !== -1) || false;
}, test.limit.slow);

// the module rule (spirit.md, "A module whose first require is not spirit.js goes red"): handed spirit.js, green; handed a
// module that requires fs first, red, naming that require
test.run('the general rules pass spirit.js itself: it sets the global spirit before its first require', 0.2, function () {
  if (!run) return false;
  const l = lineOf('spirit/spirit.js', 'it sets the global spirit before its first require');
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('a module whose first require is not spirit.js goes red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LATE, 'it requires spirit.js first');
  return (!!l && l.red && l.script.indexOf(LATE) !== -1) || false;
}, test.limit.slow);

test.run('an element that writes and mounts a child on a branch, the child searching it, listens: the check is green', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LISTENS, WRITES);
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('an element that writes and listens to nothing, no watch, no search, no child on a branch: the check is red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(DEAF, WRITES);
  return (!!l && l.red) || false;
}, test.limit.slow);
// Loaded in the scratch tree itself, handed to the rule as testicle hands its run (SPIRIT_MOUNT_RUN).
test.run('a node script that assigns a name onto global is red on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(LEAKY, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && l.red && l.script.indexOf(LEAKY) !== -1) || false;
}, test.limit.slow);
test.run('a node script that hands out its value through module.exports alone is green on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(CLEAN, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && !l.red) || false;
}, test.limit.slow);

// THE BRANCH PART USES THE NODE ITS RUN IS HANDED (goal/G47.1; Andy: "are the tests not ordered in the general test so that all
// tests requiring a scratch node can use the same one?", then "fix it, with red and code"): handed a list, the rule ran every
// part once a script, and its branch part booted a node of its own for each. Here it is handed a node, as testicle hands one
// (SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN), at an address in front of a real scratch node that counts what reaches it, and two
// scripts in two branches: their node worlds come up, and the calls they make reach the handed node.
{
  const http = require('http');
  const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const SCRIPTS = ['spirit/app/backup/api.js', 'spirit/app/chat/api.js'];
  const H = { node: null, proxy: null, base: '', reached: 0, out: '', bodies: '' };
  test.after(async function () {
    try { if (H.proxy) H.proxy.close(); } catch (e) { /* closed */ }
    try { if (H.node && H.node.child) H.node.child.kill(); } catch (e) { /* gone */ }
    try { if (H.node && typeof H.node.release === 'function') await H.node.release(); } catch (e) { /* freed as this process ends */ }
  });
  test.run('a scratch node comes up with an address in front of it that counts what reaches it', 0.2, async function () {
    H.node = await LABH.scratchNode();
    if (!H.node.up) return false;
    H.proxy = http.createServer(function (req, res) {
      H.reached += 1;
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const body = Buffer.concat(chunks);
        H.bodies += req.url + ' ' + body.toString('utf8') + '\n';
        fetch(H.node.base + req.url, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body })
          .then(function (r) { return r.arrayBuffer().then(function (b) { res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(Buffer.from(b)); }); })
          .catch(function () { res.writeHead(502); res.end(); });
      });
    });
    await new Promise(function (r) { H.proxy.listen(0, '127.0.0.1', r); });
    H.base = 'http://127.0.0.1:' + H.proxy.address().port;
    return true;
  }, test.limit.slow);
  test.run('the rule is run on two scripts in two branches, handed that node as testicle hands one', 0.2, async function () {
    if (!H.base) return false;
    const env = Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: H.base, SPIRIT_MOUNT_RUN: H.node.run });
    H.out = await new Promise(function (resolve) {
      const kid = require('child_process').spawn(process.execPath, [RULE].concat(SCRIPTS), { cwd: RUN, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      kid.stdout.on('data', function (d) { out += d; });
      kid.stderr.on('data', function (d) { out += d; });
      const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 280000);
      kid.on('exit', function () { clearTimeout(timer); resolve(out); });
    });
    return /Test completed/.test(H.out) || false;
  }, test.limit.long);
  test.run('the scratch node of each script\'s run comes up', 0.4, function () {
    const up = H.out.split('\n').filter(function (l) { return /a scratch node comes up for this suite ✅\s*$/.test(l); }).length;
    return up === SCRIPTS.length || false;
  }, test.limit.quick);
  // Each script's own: a run where the first used the handed node and the second booted its own would still have reached it
  // (cw's review), so each branch must be named in what reached it, backup's calls and chat's.
  test.run('each script uses the node it is handed, so calls naming backup and calls naming chat both reach it', 0.8, function () {
    const named = ['backup', 'chat'].filter(function (b) { return new RegExp('"' + b + '[".]').test(H.bodies); });
    return named.length === 2 || false;
  }, test.limit.quick);
}
