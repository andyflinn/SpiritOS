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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function each(paths, want, why) {
  paths.forEach(function (p) {
    const got = core.isCore(p);
    ok(got === want, (want ? 'core: ' : 'not core: ') + p + ' (' + why + ')', p + ' should ' + (want ? '' : 'not ') + 'be core (' + why + '), isCore said ' + got);
  });
}

test.startTest('coreFiles.js: which files are core');

test.subHeading('what was core before goal/G41.29');
each(['spirit/run/spirit/shell/face.html', 'spirit/run/spirit/shell/boot.js', 'spirit/run/spirit/shell/seal.js', 'spirit/run/spirit/shell/face.css', 'spirit/run/spirit/shell/favicon.svg'], true, 'the face\'s boot');
each(['spirit/run/spirit/app/join/element.js', 'spirit/run/spirit/app/join/join.json'], true, 'join, whole, an intrinsic app since goal/G43.26 moved it to spirit/app/join/ (the login app went, goal/G43.18)');
each(['spirit/run/spirit/app/desk/element/desk/desk.json'], false, 'a manifest is never core');
each(['spirit/run/spirit/relay.js', 'spirit/run/spirit/test/relayServer.js', 'spirit/run/spirit/element/search/contact.js', 'spirit/run/spirit/test/testReport.js'], true, 'the core folders, the test tools in spirit/test/ among them (goal/G43.32)');
// goal/G41.30, the review's H5: what the page loads on every boot.
each(['spirit/run/spirit/element/codeMirror/lib/codemirror.js', 'spirit/run/spirit/element/codeMirror/lib/codemirror.css', 'spirit/run/spirit/element/progressBar.js'], true, 'loaded on every boot');
each(['spirit/run/spirit/spirit.js', 'spirit/run/spirit/shell/elements.css', 'spirit/run/spirit/shell/tokens.css', 'spirit/run/spirit/shell/shell.css', 'spirit/run/spirit/shell/ghost.svg'], true, 'the frame, in spirit/ since goal/G43.18');
each(['spirit/run/spirit/app/grants/element.js'], true, 'an intrinsic app\'s code');
each(['spirit/run/spirit/app/desk/element/desk/desk.js'], false, 'an app not intrinsic');
// goal/G43.30: THE CODED LIST WENT WITH shell/ (Andy: "can we delete run://shell/"): coreFiles answers no list and no intrinsic().
ok(!('INTRINSIC' in core) && !('intrinsic' in core), 'coreFiles.js holds no coded intrinsic list any more', 'coreFiles.js still answers ' + Object.keys(core).join(', '));

test.subHeading('goal/G41.29: a core file\'s companion test files are core');
each(['spirit/run/spirit/shell/test/boot.js', 'spirit/run/spirit/shell/test/boot.md', 'spirit/run/spirit/shell/test/seal.js', 'spirit/run/spirit/shell/test/seal.md'], true, 'the boot\'s companions');
each(['spirit/run/spirit/app/grants/test/element.md'], true, 'an intrinsic app\'s companions');
each(['spirit/run/spirit/app/desk/element/desk/test/desk.js', 'spirit/run/spirit/app/desk/element/desk/test/desk.md'], false, 'a test named after no core file');


// goal/G43.14: INTRINSIC FOR THE NEW APPS, in spirit/app/<name>/<name>.json (Andy: "i think in spirit/app/<name>/<name>.json
// (identity:intrinsic:true|false)"). The json is always core; the rest of the folder only while it says intrinsic true. "no
// dependency on git": the rule reads the json on disc, here a tree of this test's own, handed as the repo root.
test.subHeading('goal/G43.14: <name>.json says whether an app of spirit/app/ is intrinsic');
{
  const os = require('os');
  const fsx = require('fs');
  const root = fsx.mkdtempSync(path.join(os.tmpdir(), 'spirit-core-'));
  const plant = function (name, identity) {
    const dir = path.join(root, 'spirit', 'run', 'spirit', 'app', name);
    fsx.mkdirSync(path.join(dir, 'test'), { recursive: true });
    fsx.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: identity, shell: { mount: true }, node: { mount: false } }));
    [name + '.js', 'style.css', 'page.html', 'data.json', 'test/' + name + '.js'].forEach(function (f) { fsx.writeFileSync(path.join(dir, f), ''); });
  };
  plant('always', { label: 'Always', intrinsic: true });
  plant('free', { label: 'Free', intrinsic: false });
  // Q2, Andy: "anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not intrinsic."
  plant('plain', { label: 'Plain' });
  fsx.mkdirSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'bare', 'test'), { recursive: true });
  ['bare.js', 'test/bare.js'].forEach(function (f) { fsx.writeFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'bare', f), ''); });
  const at = function (name, f) { return 'spirit/run/spirit/app/' + name + '/' + f; };
  const is = function (p) { return core.isCore(p, root); };
  ['always.json', 'free.json'].forEach(function (f) {
    const n = f.replace('.json', '');
    ok(is(at(n, f)) === true, 'core: ' + at(n, f) + ', whatever it says', at(n, f) + ' is not core');
  });
  ['always.js', 'style.css', 'page.html'].forEach(function (f) {
    ok(is(at('always', f)) === true, 'core while intrinsic true: ' + at('always', f), at('always', f) + ' is not core, with intrinsic true');
  });
  ['free.js', 'style.css', 'page.html', 'data.json', 'test/free.js'].forEach(function (f) {
    ok(is(at('free', f)) === false, 'not core with intrinsic false: ' + at('free', f), at('free', f) + ' is core, with intrinsic false');
  });
  ['plain.js', 'style.css', 'page.html'].forEach(function (f) {
    ok(is(at('plain', f)) === true, 'core with no intrinsic in its json (Q2): ' + at('plain', f), at('plain', f) + ' is not core, its json saying nothing of intrinsic');
  });
  ['bare.js', 'test/bare.js'].forEach(function (f) {
    ok(is(at('bare', f)) === true, 'core in a folder with no <name>.json, as appSelector/ and test/ are (Q2): ' + at('bare', f), at('bare', f) + ' is not core, in a folder with no json');
  });
  // The json, rewritten on disc, is what counts: no copy kept from before.
  fsx.writeFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'free', 'free.json'), JSON.stringify({ identity: { intrinsic: true } }));
  ok(is(at('free', 'free.js')) === true, 'the json is read as it is on disc: turned true, the code is core', at('free', 'free.js') + ' is still not core');
  fsx.rmSync(root, { recursive: true, force: true });
}

test.subHeading('goal/G43.14: Contacts moved to spirit/app/contact/ and says intrinsic in its own json');
ok(core.isCore('spirit/run/spirit/app/contact/contact.json') === true && core.isCore('spirit/run/spirit/app/contact/element.js') === true,
  'in this tree spirit/app/contact/ is core, its json saying intrinsic true', 'contact.json ' + core.isCore('spirit/run/spirit/app/contact/contact.json') + ', contact.js ' + core.isCore('spirit/run/spirit/app/contact/element.js'));

test.subHeading('goal/G43.24: Info and Grants moved to spirit/app/ and say it in their own json');
['info', 'grants'].forEach(function (name) {
  ok(core.appIntrinsic(path.resolve(RUN, '..', '..'), name) === true, 'spirit/app/' + name + '/' + name + '.json says intrinsic true',
    'spirit/app/' + name + '/' + name + '.json says intrinsic ' + core.appIntrinsic(path.resolve(RUN, '..', '..'), name));
});

// THE DEPENDENCY PART, once coreFiles-dependency.js.
function dependencyPart() {
  // Once spirit/run/spirit/test/coreFiles-dependency.js.
  // WHAT A CORE FILE LOADS IS CORE (goal/G41.30; Andy: "it looks like we better make sure that those files that core files
  // depend on, are core-files, too."). A core file is grant-locked (spirit/coreFiles.js); a file it loads that is not
  // could be rewritten by any page, and the core file would run what was written. So every file a core file loads must be
  // core too, or this test is red naming both. Read from the code itself, comments left out: a page's script and style
  // tags, a script's require of a file beside it, and spirit.require of a literal path. A test folder, a vendored folder
  // (fileSystem.js's list) and a require by package name (node's own) are not files of the run, and are not asked.

  const fs = require('fs');
  const REPO = path.join(RUN, '..', '..');
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

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

  test.subHeading('coreFiles-dependency: what a core file loads is core (goal/G41.30)');

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

  // SHELL/SHARED IS GONE (goal/G43.30, with all of shell/; Andy: "can we delete run://shell/"): its rule, that it held no
  // core file (goal/G41.30), has nothing left to hold.
  const shellLeft = tracked.filter(function (f) { return f.indexOf('spirit/run/shell/') === 0; });
  ok(!shellLeft.length, 'run://shell/ holds no tracked file', 'run://shell/ still holds ' + shellLeft.length + ': ' + shellLeft.slice(0, 5).join(', '));
}

// THE INFOGRANTS PART, once coreFiles-infoGrants.js.
function infoGrantsPart() {
  // Once spirit/run/spirit/test/coreFiles-infoGrants.js.
  // INFO AND GRANTS ARE INTRINSIC BY THEIR OWN <name>.json, NOT BY coreFiles.js'S LIST (goal/G43.24, requirement 2; spec:
  // ./coreFiles.md). Andy: "i just moved them, didn't fix the manifest.", "no i want those apps to basically be
  // wrappers for spirit/element/ things....". coreFiles.js loaded as it is.

  const REPO = path.resolve(RUN, '..', '..');

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

  test.subHeading('coreFiles-infoGrants: Info and Grants are intrinsic by their own <name>.json, not by coreFiles.js\'s list (goal/G43.24)');

  test.subHeading('the box, 2: "both are intrinsic by their own <name>.json, as spirit/app apps say it"');
  let core = null;
  try { core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { core = null; }
  ok(!!core && typeof core.appIntrinsic === 'function', 'the world: coreFiles.js answers appIntrinsic', 'coreFiles.js: no appIntrinsic: nothing judged');
  if (core && typeof core.appIntrinsic === 'function') {
    // No coded list names them: since goal/G43.30 there is none at all.
    ok(!('INTRINSIC' in core), 'no coded INTRINSIC list names shell/info or shell/grants: there is none (goal/G43.30)', 'coreFiles.js still answers an INTRINSIC list: ' + short(core.INTRINSIC));
    ['info', 'grants'].forEach(function (name) {
      ok(core.appIntrinsic(REPO, name) === true, 'coreFiles.appIntrinsic reads ' + name + ' intrinsic from its own ' + name + '.json', 'appIntrinsic(' + name + '): ' + short(core.appIntrinsic(REPO, name)));
    });
  }
}

[['dependency', dependencyPart], ['infoGrants', infoGrantsPart]].forEach(function (p) {
  try { p[1](); } catch (e) { test.fail('the ' + p[0] + ' part threw ' + (e && e.stack || e)); }
});

test.reportSuccessFailureCount();
