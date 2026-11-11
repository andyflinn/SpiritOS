'use strict';

// spirit/run/spirit/test/coreFiles.js
// The tests of spirit/coreFiles.js, which files are core, and of no other module (spec: ./coreFiles.md). It asks isCore
// and intrinsic of repo paths; it reads no file and needs no node. The one test file of coreFiles.js: the dependency
// part (what a core file loads is core) and the infoGrants part (Info and Grants intrinsic by their own json), once
// coreFiles-dependency.js and coreFiles-infoGrants.js, are sections of it, run after its own checks.

const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));

// What was core before goal/G41.29.
test.run('core: spirit/run/spirit/shell/face.html (the face\'s boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/face.html') === true) ? true : 'spirit/run/spirit/shell/face.html should be core (the face\'s boot), isCore said ' + core.isCore('spirit/run/spirit/shell/face.html'); }, 1000);
test.run('core: spirit/run/spirit/shell/boot.js (the face\'s boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/boot.js') === true) ? true : 'spirit/run/spirit/shell/boot.js should be core (the face\'s boot), isCore said ' + core.isCore('spirit/run/spirit/shell/boot.js'); }, 1000);
test.run('core: spirit/run/spirit/shell/seal.js (the face\'s boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/seal.js') === true) ? true : 'spirit/run/spirit/shell/seal.js should be core (the face\'s boot), isCore said ' + core.isCore('spirit/run/spirit/shell/seal.js'); }, 1000);
test.run('core: spirit/run/spirit/shell/face.css (the face\'s boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/face.css') === true) ? true : 'spirit/run/spirit/shell/face.css should be core (the face\'s boot), isCore said ' + core.isCore('spirit/run/spirit/shell/face.css'); }, 1000);
test.run('core: spirit/run/spirit/shell/favicon.svg (the face\'s boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/favicon.svg') === true) ? true : 'spirit/run/spirit/shell/favicon.svg should be core (the face\'s boot), isCore said ' + core.isCore('spirit/run/spirit/shell/favicon.svg'); }, 1000);
test.run('core: spirit/run/spirit/app/join/element.js (join, whole, an intrinsic app since goal/G43.26 moved it to spirit/app/join/ (the login app went, goal/G43.18))', 0.2, function () { return (core.isCore('spirit/run/spirit/app/join/element.js') === true) ? true : 'spirit/run/spirit/app/join/element.js should be core (join, whole, an intrinsic app since goal/G43.26 moved it to spirit/app/join/ (the login app went, goal/G43.18)), isCore said ' + core.isCore('spirit/run/spirit/app/join/element.js'); }, 1000);
test.run('core: spirit/run/spirit/app/join/join.json (join, whole, an intrinsic app since goal/G43.26 moved it to spirit/app/join/ (the login app went, goal/G43.18))', 0.2, function () { return (core.isCore('spirit/run/spirit/app/join/join.json') === true) ? true : 'spirit/run/spirit/app/join/join.json should be core (join, whole, an intrinsic app since goal/G43.26 moved it to spirit/app/join/ (the login app went, goal/G43.18)), isCore said ' + core.isCore('spirit/run/spirit/app/join/join.json'); }, 1000);
test.run('not core: spirit/run/spirit/app/desk/element/desk/desk.json (a manifest is never core)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/desk/element/desk/desk.json') === false) ? true : 'spirit/run/spirit/app/desk/element/desk/desk.json should not be core (a manifest is never core), isCore said ' + core.isCore('spirit/run/spirit/app/desk/element/desk/desk.json'); }, 1000);
test.run('core: spirit/run/spirit/relay.js (the core folders, the test tools in spirit/test/ among them (goal/G43.32))', 0.2, function () { return (core.isCore('spirit/run/spirit/relay.js') === true) ? true : 'spirit/run/spirit/relay.js should be core (the core folders, the test tools in spirit/test/ among them (goal/G43.32)), isCore said ' + core.isCore('spirit/run/spirit/relay.js'); }, 1000);
test.run('core: spirit/run/spirit/test/relayServer.js (the core folders, the test tools in spirit/test/ among them (goal/G43.32))', 0.2, function () { return (core.isCore('spirit/run/spirit/test/relayServer.js') === true) ? true : 'spirit/run/spirit/test/relayServer.js should be core (the core folders, the test tools in spirit/test/ among them (goal/G43.32)), isCore said ' + core.isCore('spirit/run/spirit/test/relayServer.js'); }, 1000);
test.run('core: spirit/run/spirit/element/search/contact.js (the core folders, the test tools in spirit/test/ among them (goal/G43.32))', 0.2, function () { return (core.isCore('spirit/run/spirit/element/search/contact.js') === true) ? true : 'spirit/run/spirit/element/search/contact.js should be core (the core folders, the test tools in spirit/test/ among them (goal/G43.32)), isCore said ' + core.isCore('spirit/run/spirit/element/search/contact.js'); }, 1000);
test.run('core: spirit/run/spirit/test/testReport.js (the core folders, the test tools in spirit/test/ among them (goal/G43.32))', 0.2, function () { return (core.isCore('spirit/run/spirit/test/testReport.js') === true) ? true : 'spirit/run/spirit/test/testReport.js should be core (the core folders, the test tools in spirit/test/ among them (goal/G43.32)), isCore said ' + core.isCore('spirit/run/spirit/test/testReport.js'); }, 1000);
// goal/G41.30, the review's H5: what the page loads on every boot.
test.run('core: spirit/run/spirit/element/codeMirror/lib/codemirror.js (loaded on every boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/element/codeMirror/lib/codemirror.js') === true) ? true : 'spirit/run/spirit/element/codeMirror/lib/codemirror.js should be core (loaded on every boot), isCore said ' + core.isCore('spirit/run/spirit/element/codeMirror/lib/codemirror.js'); }, 1000);
test.run('core: spirit/run/spirit/element/codeMirror/lib/codemirror.css (loaded on every boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/element/codeMirror/lib/codemirror.css') === true) ? true : 'spirit/run/spirit/element/codeMirror/lib/codemirror.css should be core (loaded on every boot), isCore said ' + core.isCore('spirit/run/spirit/element/codeMirror/lib/codemirror.css'); }, 1000);
test.run('core: spirit/run/spirit/element/progressBar.js (loaded on every boot)', 0.2, function () { return (core.isCore('spirit/run/spirit/element/progressBar.js') === true) ? true : 'spirit/run/spirit/element/progressBar.js should be core (loaded on every boot), isCore said ' + core.isCore('spirit/run/spirit/element/progressBar.js'); }, 1000);
test.run('core: spirit/run/spirit/spirit.js (the frame, in spirit/ since goal/G43.18)', 0.2, function () { return (core.isCore('spirit/run/spirit/spirit.js') === true) ? true : 'spirit/run/spirit/spirit.js should be core (the frame, in spirit/ since goal/G43.18), isCore said ' + core.isCore('spirit/run/spirit/spirit.js'); }, 1000);
test.run('core: spirit/run/spirit/shell/elements.css (the frame, in spirit/ since goal/G43.18)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/elements.css') === true) ? true : 'spirit/run/spirit/shell/elements.css should be core (the frame, in spirit/ since goal/G43.18), isCore said ' + core.isCore('spirit/run/spirit/shell/elements.css'); }, 1000);
test.run('core: spirit/run/spirit/shell/tokens.css (the frame, in spirit/ since goal/G43.18)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/tokens.css') === true) ? true : 'spirit/run/spirit/shell/tokens.css should be core (the frame, in spirit/ since goal/G43.18), isCore said ' + core.isCore('spirit/run/spirit/shell/tokens.css'); }, 1000);
test.run('core: spirit/run/spirit/shell/shell.css (the frame, in spirit/ since goal/G43.18)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/shell.css') === true) ? true : 'spirit/run/spirit/shell/shell.css should be core (the frame, in spirit/ since goal/G43.18), isCore said ' + core.isCore('spirit/run/spirit/shell/shell.css'); }, 1000);
test.run('core: spirit/run/spirit/shell/ghost.svg (the frame, in spirit/ since goal/G43.18)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/ghost.svg') === true) ? true : 'spirit/run/spirit/shell/ghost.svg should be core (the frame, in spirit/ since goal/G43.18), isCore said ' + core.isCore('spirit/run/spirit/shell/ghost.svg'); }, 1000);
test.run('core: spirit/run/spirit/app/grants/element.js (an intrinsic app\'s code)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/grants/element.js') === true) ? true : 'spirit/run/spirit/app/grants/element.js should be core (an intrinsic app\'s code), isCore said ' + core.isCore('spirit/run/spirit/app/grants/element.js'); }, 1000);
test.run('not core: spirit/run/spirit/app/desk/element/desk/desk.js (an app not intrinsic)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/desk/element/desk/desk.js') === false) ? true : 'spirit/run/spirit/app/desk/element/desk/desk.js should not be core (an app not intrinsic), isCore said ' + core.isCore('spirit/run/spirit/app/desk/element/desk/desk.js'); }, 1000);
// goal/G43.30: THE CODED LIST WENT WITH shell/ (Andy: "can we delete run://shell/"): coreFiles answers no list and no intrinsic().
test.run('coreFiles.js holds no coded intrinsic list any more', 0.2, function () { return (!('INTRINSIC' in core) && !('intrinsic' in core)) ? true : 'coreFiles.js still answers ' + Object.keys(core).join(', '); }, 1000);

// goal/G41.29: a core file's companion test files are core.
test.run('core: spirit/run/spirit/shell/test/boot.js (the boot\'s companions)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/test/boot.js') === true) ? true : 'spirit/run/spirit/shell/test/boot.js should be core (the boot\'s companions), isCore said ' + core.isCore('spirit/run/spirit/shell/test/boot.js'); }, 1000);
test.run('core: spirit/run/spirit/shell/test/boot.md (the boot\'s companions)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/test/boot.md') === true) ? true : 'spirit/run/spirit/shell/test/boot.md should be core (the boot\'s companions), isCore said ' + core.isCore('spirit/run/spirit/shell/test/boot.md'); }, 1000);
test.run('core: spirit/run/spirit/shell/test/seal.js (the boot\'s companions)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/test/seal.js') === true) ? true : 'spirit/run/spirit/shell/test/seal.js should be core (the boot\'s companions), isCore said ' + core.isCore('spirit/run/spirit/shell/test/seal.js'); }, 1000);
test.run('core: spirit/run/spirit/shell/test/seal.md (the boot\'s companions)', 0.2, function () { return (core.isCore('spirit/run/spirit/shell/test/seal.md') === true) ? true : 'spirit/run/spirit/shell/test/seal.md should be core (the boot\'s companions), isCore said ' + core.isCore('spirit/run/spirit/shell/test/seal.md'); }, 1000);
test.run('core: spirit/run/spirit/app/grants/test/element.md (an intrinsic app\'s companions)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/grants/test/element.md') === true) ? true : 'spirit/run/spirit/app/grants/test/element.md should be core (an intrinsic app\'s companions), isCore said ' + core.isCore('spirit/run/spirit/app/grants/test/element.md'); }, 1000);
test.run('not core: spirit/run/spirit/app/desk/element/desk/test/desk.js (a test named after no core file)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/desk/element/desk/test/desk.js') === false) ? true : 'spirit/run/spirit/app/desk/element/desk/test/desk.js should not be core (a test named after no core file), isCore said ' + core.isCore('spirit/run/spirit/app/desk/element/desk/test/desk.js'); }, 1000);
test.run('not core: spirit/run/spirit/app/desk/element/desk/test/desk.md (a test named after no core file)', 0.2, function () { return (core.isCore('spirit/run/spirit/app/desk/element/desk/test/desk.md') === false) ? true : 'spirit/run/spirit/app/desk/element/desk/test/desk.md should not be core (a test named after no core file), isCore said ' + core.isCore('spirit/run/spirit/app/desk/element/desk/test/desk.md'); }, 1000);


// goal/G43.14: <name>.json says whether an app of spirit/app/ is intrinsic.
const W = {};
const os = require('os');
const fsx = require('fs');
const at = function (name, f) { return 'spirit/run/spirit/app/' + name + '/' + f; };
const is = function (p) { return core.isCore(p, W.root); };
test.run('the world: a tree of this test\'s own is planted, with apps saying intrinsic true, false and nothing', 0.2, function () {
  W.root = fsx.mkdtempSync(path.join(os.tmpdir(), 'spirit-core-'));
  const plant = function (name, identity) {
    const dir = path.join(W.root, 'spirit', 'run', 'spirit', 'app', name);
    fsx.mkdirSync(path.join(dir, 'test'), { recursive: true });
    fsx.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: identity, shell: { mount: true }, node: { mount: false } }));
    [name + '.js', 'style.css', 'page.html', 'data.json', 'test/' + name + '.js'].forEach(function (f) { fsx.writeFileSync(path.join(dir, f), ''); });
  };
  plant('always', { label: 'Always', intrinsic: true });
  plant('free', { label: 'Free', intrinsic: false });
  // Q2, Andy: "anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not intrinsic."
  plant('plain', { label: 'Plain' });
  fsx.mkdirSync(path.join(W.root, 'spirit', 'run', 'spirit', 'app', 'bare', 'test'), { recursive: true });
  ['bare.js', 'test/bare.js'].forEach(function (f) { fsx.writeFileSync(path.join(W.root, 'spirit', 'run', 'spirit', 'app', 'bare', f), ''); });
  return true;
}, 1000);
test.after(function () { try { if (W.root) fsx.rmSync(W.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
test.run('core: spirit/run/spirit/app/always/always.json, whatever it says', 0.2, function () { return (is('spirit/run/spirit/app/always/always.json') === true) ? true : 'spirit/run/spirit/app/always/always.json is not core'; }, 1000);
test.run('core: spirit/run/spirit/app/free/free.json, whatever it says', 0.2, function () { return (is('spirit/run/spirit/app/free/free.json') === true) ? true : 'spirit/run/spirit/app/free/free.json is not core'; }, 1000);
test.run('core while intrinsic true: spirit/run/spirit/app/always/always.js', 0.2, function () { return (is('spirit/run/spirit/app/always/always.js') === true) ? true : 'spirit/run/spirit/app/always/always.js is not core, with intrinsic true'; }, 1000);
test.run('core while intrinsic true: spirit/run/spirit/app/always/style.css', 0.2, function () { return (is('spirit/run/spirit/app/always/style.css') === true) ? true : 'spirit/run/spirit/app/always/style.css is not core, with intrinsic true'; }, 1000);
test.run('core while intrinsic true: spirit/run/spirit/app/always/page.html', 0.2, function () { return (is('spirit/run/spirit/app/always/page.html') === true) ? true : 'spirit/run/spirit/app/always/page.html is not core, with intrinsic true'; }, 1000);
test.run('not core with intrinsic false: spirit/run/spirit/app/free/free.js', 0.2, function () { return (is('spirit/run/spirit/app/free/free.js') === false) ? true : 'spirit/run/spirit/app/free/free.js is core, with intrinsic false'; }, 1000);
test.run('not core with intrinsic false: spirit/run/spirit/app/free/style.css', 0.2, function () { return (is('spirit/run/spirit/app/free/style.css') === false) ? true : 'spirit/run/spirit/app/free/style.css is core, with intrinsic false'; }, 1000);
test.run('not core with intrinsic false: spirit/run/spirit/app/free/page.html', 0.2, function () { return (is('spirit/run/spirit/app/free/page.html') === false) ? true : 'spirit/run/spirit/app/free/page.html is core, with intrinsic false'; }, 1000);
test.run('not core with intrinsic false: spirit/run/spirit/app/free/data.json', 0.2, function () { return (is('spirit/run/spirit/app/free/data.json') === false) ? true : 'spirit/run/spirit/app/free/data.json is core, with intrinsic false'; }, 1000);
test.run('not core with intrinsic false: spirit/run/spirit/app/free/test/free.js', 0.2, function () { return (is('spirit/run/spirit/app/free/test/free.js') === false) ? true : 'spirit/run/spirit/app/free/test/free.js is core, with intrinsic false'; }, 1000);
test.run('core with no intrinsic in its json (Q2): spirit/run/spirit/app/plain/plain.js', 0.2, function () { return (is('spirit/run/spirit/app/plain/plain.js') === true) ? true : 'spirit/run/spirit/app/plain/plain.js is not core, its json saying nothing of intrinsic'; }, 1000);
test.run('core with no intrinsic in its json (Q2): spirit/run/spirit/app/plain/style.css', 0.2, function () { return (is('spirit/run/spirit/app/plain/style.css') === true) ? true : 'spirit/run/spirit/app/plain/style.css is not core, its json saying nothing of intrinsic'; }, 1000);
test.run('core with no intrinsic in its json (Q2): spirit/run/spirit/app/plain/page.html', 0.2, function () { return (is('spirit/run/spirit/app/plain/page.html') === true) ? true : 'spirit/run/spirit/app/plain/page.html is not core, its json saying nothing of intrinsic'; }, 1000);
test.run('core in a folder with no <name>.json, as appSelector/ and test/ are (Q2): spirit/run/spirit/app/bare/bare.js', 0.2, function () { return (is('spirit/run/spirit/app/bare/bare.js') === true) ? true : 'spirit/run/spirit/app/bare/bare.js is not core, in a folder with no json'; }, 1000);
test.run('core in a folder with no <name>.json, as appSelector/ and test/ are (Q2): spirit/run/spirit/app/bare/test/bare.js', 0.2, function () { return (is('spirit/run/spirit/app/bare/test/bare.js') === true) ? true : 'spirit/run/spirit/app/bare/test/bare.js is not core, in a folder with no json'; }, 1000);
// The json, rewritten on disc, is what counts: no copy kept from before.
test.run('the json is read as it is on disc: turned true, the code is core', 0.2, function () {
  fsx.writeFileSync(path.join(W.root, 'spirit', 'run', 'spirit', 'app', 'free', 'free.json'), JSON.stringify({ identity: { intrinsic: true } }));
  return is(at('free', 'free.js')) === true ? true : at('free', 'free.js') + ' is still not core';
}, 1000);

// goal/G43.14: Contacts moved to spirit/app/contact/ and says intrinsic in its own json.
test.run('in this tree spirit/app/contact/ is core, its json saying intrinsic true', 0.2, function () { return (core.isCore('spirit/run/spirit/app/contact/contact.json') === true && core.isCore('spirit/run/spirit/app/contact/element.js') === true) ? true : 'contact.json ' + core.isCore('spirit/run/spirit/app/contact/contact.json') + ', contact.js ' + core.isCore('spirit/run/spirit/app/contact/element.js'); }, 1000);

// goal/G43.24: Info and Grants moved to spirit/app/ and say it in their own json.
test.run('spirit/app/info/info.json says intrinsic true', 0.2, function () { return (core.appIntrinsic(path.resolve(RUN, '..', '..'), 'info') === true) ? true : 'spirit/app/info/info.json says intrinsic ' + core.appIntrinsic(path.resolve(RUN, '..', '..'), 'info'); }, 1000);
test.run('spirit/app/grants/grants.json says intrinsic true', 0.2, function () { return (core.appIntrinsic(path.resolve(RUN, '..', '..'), 'grants') === true) ? true : 'spirit/app/grants/grants.json says intrinsic ' + core.appIntrinsic(path.resolve(RUN, '..', '..'), 'grants'); }, 1000);

// THE DEPENDENCY PART, once coreFiles-dependency.js.
// Once spirit/run/spirit/test/coreFiles-dependency.js.
// WHAT A CORE FILE LOADS IS CORE (goal/G41.30; Andy: "it looks like we better make sure that those files that core files
// depend on, are core-files, too."). A core file is grant-locked (spirit/coreFiles.js); a file it loads that is not
// could be rewritten by any page, and the core file would run what was written. So every file a core file loads must be
// core too, or this test is red naming both. Read from the code itself, comments left out: a page's script and style
// tags, a script's require of a file beside it, and spirit.require of a literal path. A test folder, a vendored folder
// (fileSystem.js's list) and a require by package name (node's own) are not files of the run, and are not asked.
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const D = {};
const depIsCore = function (rel) { return core.isCore('spirit/run/' + rel, REPO); };
const exists = function (rel) { return fsx.existsSync(path.join(RUN, rel)) && fsx.statSync(path.join(RUN, rel)).isFile(); };
function stripped(text, html) {
  if (html) return text.replace(/<!--[\s\S]*?-->/g, '');
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}
// What one file loads, as run-relative paths.
function loads(rel) {
  const src = fsx.readFileSync(path.join(RUN, rel), 'utf8');
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

// coreFiles-dependency: what a core file loads is core (goal/G41.30).
test.run('it reads more than fifty core files', 0.2, function () {
  D.tracked = require('child_process').execFileSync('git', ['ls-files', 'spirit/run'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  D.coreFiles = D.tracked.map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    .filter(function (f) { return !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && /\.(js|html)$/.test(f) && exists(f) && depIsCore(f); });
  return D.coreFiles.length > 50 ? true : 'only ' + D.coreFiles.length + ' core files were found: the scan judges nothing';
}, 1000);
test.run('it asks more than fifty files loaded by core files', 0.2, function () {
  if (!D.coreFiles) return 'no core files read: the test before it failed';
  D.loose = [];
  let asked = 0;
  D.coreFiles.forEach(function (f) {
    loads(f).forEach(function (dep) {
      if (/(^|\/)test\//.test(dep)) return;
      if (!exists(dep)) return; // a missing file is another test's to judge, not this rule's
      asked += 1;
      if (!depIsCore(dep)) D.loose.push(dep + ', loaded by ' + f);
    });
  });
  return asked > 50 ? true : 'only ' + asked + ' loaded files were found: the scan judges nothing';
}, 1000);
// Each file that is not core, yet loaded by core files, is named in this test's detail.
test.run('every file a core file loads is core', 0.8, function () {
  if (!D.loose) return 'no loaded files asked: the test before it failed';
  const byDep = {};
  D.loose.forEach(function (l) { const d = l.split(', loaded by ')[0]; (byDep[d] = byDep[d] || []).push(l.split(', loaded by ')[1]); });
  const said = Object.keys(byDep).sort().map(function (d) { return d + ' is not core, yet ' + byDep[d].length + ' core file(s) load it: ' + byDep[d].slice(0, 3).join(', '); });
  return !said.length ? true : said.join('; ');
}, 1000);
// SHELL/SHARED IS GONE (goal/G43.30, with all of shell/; Andy: "can we delete run://shell/"): its rule, that it held no
// core file (goal/G41.30), has nothing left to hold.
test.run('run://shell/ holds no tracked file', 0.2, function () {
  if (!D.tracked) return 'no tracked files listed: the world failed';
  const shellLeft = D.tracked.filter(function (f) { return f.indexOf('spirit/run/shell/') === 0; });
  return !shellLeft.length ? true : 'run://shell/ still holds ' + shellLeft.length + ': ' + shellLeft.slice(0, 5).join(', ');
}, 1000);

// THE INFOGRANTS PART, once coreFiles-infoGrants.js.
// Once spirit/run/spirit/test/coreFiles-infoGrants.js.
// INFO AND GRANTS ARE INTRINSIC BY THEIR OWN <name>.json, NOT BY coreFiles.js'S LIST (goal/G43.24, requirement 2; spec:
// ./coreFiles.md). Andy: "i just moved them, didn't fix the manifest.", "no i want those apps to basically be
// wrappers for spirit/element/ things....". coreFiles.js loaded as it is.
// The box, 2: "both are intrinsic by their own <name>.json, as spirit/app apps say it".
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const G = {};
test.run('the world: coreFiles.js answers appIntrinsic', 0.2, function () {
  try { G.core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { G.core = null; }
  return (!!G.core && typeof G.core.appIntrinsic === 'function') ? true : 'coreFiles.js: no appIntrinsic: nothing judged';
}, 1000);
// No coded list names them: since goal/G43.30 there is none at all.
test.run('no coded INTRINSIC list names shell/info or shell/grants: there is none (goal/G43.30)', 0.2, function () {
  if (!G.core) return 'no coreFiles.js: the world failed';
  return !('INTRINSIC' in G.core) ? true : 'coreFiles.js still answers an INTRINSIC list: ' + short(G.core.INTRINSIC);
}, 1000);
test.run('coreFiles.appIntrinsic reads info intrinsic from its own info.json', 0.2, function () {
  if (!G.core || typeof G.core.appIntrinsic !== 'function') return 'no appIntrinsic: the world failed';
  return G.core.appIntrinsic(REPO, 'info') === true ? true : 'appIntrinsic(info): ' + short(G.core.appIntrinsic(REPO, 'info'));
}, 1000);
test.run('coreFiles.appIntrinsic reads grants intrinsic from its own grants.json', 0.2, function () {
  if (!G.core || typeof G.core.appIntrinsic !== 'function') return 'no appIntrinsic: the world failed';
  return G.core.appIntrinsic(REPO, 'grants') === true ? true : 'appIntrinsic(grants): ' + short(G.core.appIntrinsic(REPO, 'grants'));
}, 1000);
