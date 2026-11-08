'use strict';

// spirit/run/spirit/test/coreFiles-dependency.js
// WHAT A CORE FILE LOADS IS CORE (goal/G41.30; Andy: "it looks like we better make sure that those files that core files
// depend on, are core-files, too."). A core file is grant-locked (spirit/coreFiles.js); a file it loads that is not
// could be rewritten by any page, and the core file would run what was written. So every file a core file loads must be
// core too, or this test is red naming both. Read from the code itself, comments left out: a page's script and style
// tags, a script's require of a file beside it, and spirit.require of a literal path. A test folder, a vendored folder
// (fileSystem.js's list) and a require by package name (node's own) are not files of the run, and are not asked.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..','..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const REPO = path.join(RUN, '..', '..');
const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
const tracked = require('child_process').execFileSync('git', ['ls-files', 'spirit/run'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const isCore = function (rel) { return core.isCore('spirit/run/' + rel, REPO); };
const exists = function (rel) { return fs.existsSync(path.join(RUN, rel)) && fs.statSync(path.join(RUN, rel)).isFile(); };
function stripped(text, html) {
  if (html) return text.replace(/<!--[\s\S]*?-->/g, '');
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

// What one file loads, as run-relative paths.
function loads(rel) {
  const src = fs.readFileSync(path.join(RUN, rel), 'utf8');
  const out = [];
  if (/\.html$/.test(rel)) {
    const t = stripped(src, true);
    let m; const re = /<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    while ((m = re.exec(t))) { const u = m[1]; if (/^(https?:)?\/\//.test(u) || /^data:/.test(u)) continue; out.push(u.charAt(0) === '/' ? u.slice(1).split(/[?#]/)[0] : path.posix.normalize(path.posix.join(path.posix.dirname(rel), u.split(/[?#]/)[0]))); }
    return out;
  }
  if (!/\.js$/.test(rel)) return out;
  const t = stripped(src, false);
  let m;
  const req = /\brequire\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g;
  while ((m = req.exec(t))) {
    let p = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[2]));
    if (!/\.(js|json)$/.test(p)) p = exists(p + '.js') ? p + '.js' : exists(p + '/index.js') ? p + '/index.js' : p + '.js';
    out.push(p);
  }
  const sreq = /spirit\.require\(\s*(['"])([^'"]+\.(?:js|css|json))\1/g;
  while ((m = sreq.exec(t))) out.push(m[2].replace(/^\/+/, ''));
  return out;
}

test.startTest('coreFiles-dependency.js: what a core file loads is core (goal/G41.30)');

const coreFiles = tracked.map(function (f) { return f.replace(/^spirit\/run\//, ''); })
  .filter(function (f) { return !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && /\.(js|html)$/.test(f) && exists(f) && isCore(f); });
ok(coreFiles.length > 50, 'it reads ' + coreFiles.length + ' core files', 'only ' + coreFiles.length + ' core files were found: the scan judges nothing');

const loose = [];
let asked = 0;
coreFiles.forEach(function (f) {
  loads(f).forEach(function (dep) {
    if (/(^|\/)test\//.test(dep)) return;
    if (!exists(dep)) return; // a missing file is another test's to judge, not this rule's
    asked += 1;
    if (!isCore(dep)) loose.push(dep + ', loaded by ' + f);
  });
});
test.comment(asked + ' files loaded by core files were asked');
ok(asked > 50, 'it asked ' + asked + ' loaded files', 'only ' + asked + ' loaded files were found: the scan judges nothing');
const byDep = {};
loose.forEach(function (l) { const d = l.split(', loaded by ')[0]; (byDep[d] = byDep[d] || []).push(l.split(', loaded by ')[1]); });
Object.keys(byDep).sort().forEach(function (d) {
  test.fail(d + ' is not core, yet ' + byDep[d].length + ' core file(s) load it: ' + byDep[d].slice(0, 3).join(', '));
});
if (!loose.length) test.check('every file a core file loads is core');

// SHELL/SHARED HOLDS NO CORE FILE (goal/G41.30, Andy, Q2: "no \"core\" files should reside in shell/shared/ since that
// folder was meant to be a place where non-intrinsic apps could share modules."). So a core file never loads from it
// (the rule above), and nothing in it is core.
const shared = tracked.map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(function (f) { return f.indexOf('shell/shared/') === 0 && !/(^|\/)test\//.test(f); });
ok(shared.length > 0, 'shell/shared/ holds ' + shared.length + ' files to ask', 'shell/shared/ holds no file: nothing to judge');
const coreShared = shared.filter(isCore);
ok(!coreShared.length, 'no file in shell/shared/ is core', coreShared.length + ' file(s) in shell/shared/ are core: ' + coreShared.join(', '));

test.reportSuccessFailureCount();
