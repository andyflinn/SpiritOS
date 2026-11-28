'use strict';
// spirit/run/spirit/testicle/general/any/branchRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part branchRules(ARGS) of
// the old -general runner of spirit/test/, moved here unchanged in what they check and in their titles; its runner now,
// which loads this module and calls it, is spirit/testicle/run/node/script.js (goal/G49.27, step 3). Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // A branch folder is a folder under spirit/; which one, if any, holds the path handed is found by checks (its home),
  // which judges nothing for a path in no branch.
  return !scriptPath || /^spirit\//.test(String(scriptPath));
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;

// spirit/run/spirit/test/script-sibling-branchRules.js
// EVERY RULE OF A BRANCH, JUDGED ON EACH BRANCH FOLDER (goal/G43.32; spec: ./script-sibling-branchRules.md). A general test,
// beside spirit.js, outside every branch. Andy: "make sure nobody can add an app implementing a family, without adhering to
// the rules, this means that a test outside of each branch must assert this.", "such a general test must therefore
// "recognize" a branch folder, and assert all rulers relating to branches.", "would that not actually be a general test
// script-sibling-branchRules?", and to Q7: "branch test only needs to associate a failure with either spirit/<name>/ or
// spirit/app/<name>/".
//
//   node spirit/test/script-sibling-branchRules.js spirit/app/desk     one branch, its folder the argument
//   node spirit/test/script-sibling-branchRules.js                     every branch
//
// Each rule is one test (goal/G47.2: one title per test, unique in its suite): its answer names every branch folder that
// breaks it. A rule is said only when a branch it applies to is judged, so none passes on nothing.
//
// A branch is recognized by its folder (testModule.js branchesOf; Andy: "app-branches are easily identified using the
// patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json", "and system branches by: spirit.<name>.api.js &&
// spirit.<name>.data.js"). Every check is named by its branch folder. What it took in, per branch, from the five tests
// that held branch rules (goal/G43.32, Q6: "absolutely, AND MAKE SURE NO TEST GETS LOST."): spirit-familyFinder.js,
// data-caches.js, apiDoor-familyGate.js, server-appFamily.js, introSpector-branchVerbs.js; what judges no branch went back
// to the test of the module it judges (../client/test/script.js, which data-caches.js went into, ./script.js, its familyFinder part). A scratch node; never a live one.

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const RUN = tools.run;
const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const { branchesOf } = SPIRIT.requireScript('spirit/testicle/testModule/script.js');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;

const ASK_MS = 8000;
const BATCH = 10;
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function has(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
// A file's code, comments left out. This part's own: de889b3e took it away, and part 2 threw on it, so no test on a node ran.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
// NOBODY ADDS A BRANCH PAST THE RULES: the tree is every file git keeps and every file not yet added that git does not
// ignore, so a new app's branch is judged before it is committed.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);
// NEW-SHAPE BRANCHES TOO (goal/G49.15, box v16; goal/G49.23): a folder holding script.js and client/script.js, by the system's
// own rule, spirit/fs/filter/branch/script.js; branchesOf knows the old shape (api.js and data.js) and the apps alone.
const BRANCH_FILTER = SPIRIT.requireScript('spirit/fs/filter/branch/script.js');
const ALL = (function () {
  const old = branchesOf(RUN);
  const known = old.map(function (b) { return b.dir; });
  const inTree = function (rel) { return tracked.indexOf(rel) !== -1 && has(rel); };
  const dirs = tracked.filter(function (f) { return /^spirit\/.+\/script\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f); })
    .map(function (f) { return path.posix.dirname(f); });
  const fresh = dirs.filter(function (d, i) { return dirs.indexOf(d) === i && known.indexOf(d) === -1 && BRANCH_FILTER.branch(d, inTree) === true; })
    .map(function (d) { return { dir: d, name: path.posix.basename(d), kind: 'branch' }; });
  return old.concat(fresh).sort(function (x, y) { return x.dir < y.dir ? -1 : 1; });
}());
// WHAT FITS (box v94, 2: "all scripts listed in the arguments that fit"): a branch folder, or a file in one, which is judged
// as its branch; anything in no branch is not this part's, and it judges nothing.
const handed = ARGS[0] ? String(ARGS[0]).replace(/^\.\//, '').replace(/^spirit\/run\//, '').replace(/\/$/, '') : '';
// ONLY A FILE OF THE BRANCH FOLDER ITSELF (goal/G47.4; Andy: "if (folder is a branch folder) { run those tests here}", "the
// idea here is that better-organized general tests will run faster."): a file whose own folder is a branch folder, or the
// folder handed; a branch's elements and tests, in folders below it, are not judged as their branch again.
const home = handed ? ALL.filter(function (b) { return handed === b.dir || path.posix.dirname(handed) === b.dir; })[0] : null;
if (handed && !home) return;
const asked = home ? home.dir : '';
const TARGETS = asked ? ALL.filter(function (b) { return b.dir === asked; }) : ALL;

// What each branch is made of.
TARGETS.forEach(function (b) {
  b.api = has(b.dir + '/api.js') ? b.dir + '/api.js' : '';
  b.data = has(b.dir + '/data.js') ? b.dir + '/data.js' : '';
  try { b.mod = b.api ? require(path.join(RUN, b.api)) : null; } catch (e) { b.mod = { threw: true }; }
  b.verbs = b.mod && b.mod.verbs && typeof b.mod.verbs === 'object' && !Array.isArray(b.mod.verbs) ? b.mod.verbs : null;
  // Its name, as a client asks it: the folder's name (spirit/app/script.js is the branch app); an app's is its id, its folder's
  // path in dots, spirit.app.desk (goal/G49.19; Andy: "no 'desk' on the wire when it MUST be spirit.app.desk").
  b.family = b.kind === 'app' ? SPIRIT.dottedPath(b.dir) : b.name;
});

// On the node, in a process of its own: each api.js required as every script is (spirit.requireScript), and what that placed
// and bound. Decided 8 (the box): "A branch's api.js is placed at spirit.required.spirit.<branch-path>.api and also binds
// the branch." Its place since goal/G49.23 is on the spirit object itself, spirit.<branch-path>.api (no spirit.required); a
// branch at the top, spirit/fs/api.js, has its folder's place spirit.fs, which is its path, no second branch of that name.
// node -e: the arguments start at argv[1].
const PLACED = `
const s = require(process.argv[1] + '/spirit/script.js');
const out = {};
(async function () {
  for (const f of JSON.parse(process.argv[2])) {
    try {
      const fam = await s.requireScript(f);
      let at = s; f.replace(/\\.js$/, '').split('/').slice(1).forEach(function (k) { at = at && at[k]; });
      const decl = (at && at.verbs) || {};
      const names = (at && at.functions) || {};
      const name = f.split('/').slice(-2, -1)[0];
      const atTop = f.split('/').length === 3;
      out[f] = { placed: !!at && typeof at === 'object', verbs: Object.keys(decl).length,
        unbound: Object.keys(decl).filter(function (v) { return !(fam && typeof fam[names[v] || v] === 'function'); }),
        // One place (goal/G49.6): the require answers the api.js object at its path, and spirit holds no branch of that name.
        same: at === fam && (atTop ? s[name] && s[name].api === fam : !Object.prototype.hasOwnProperty.call(s, name)) };
    } catch (e) { out[f] = { threw: true }; }
  }
  console.log(JSON.stringify(out));
  process.exit(0);
}());
`;

// A rule judged on every branch it applies to: each judge answers true when its branch keeps it, false when it breaks it.
function overAll(list, judge) {
  let ok = true;
  list.forEach(function (b) { if (!judge(b)) ok = false; });
  return ok;
}
const withApi = TARGETS.filter(function (b) { return !!b.api; });
const apps = TARGETS.filter(function (b) { return b.kind === 'app'; });
const withData = TARGETS.filter(function (b) { return !!b.data; });

// the branches
if (asked) {
  test.run('the folder handed is a branch folder', 0.2, function () {
    return TARGETS.length > 0;
  }, test.limit.quick);
} else {
  test.run('the branch folders are recognized, an app\'s (desk) and a system one (fs) among them', 0.2, function () {
    return (ALL.length >= 20 && ALL.some(function (b) { return b.dir === 'spirit/app/desk'; }) && ALL.some(function (b) { return b.dir === 'spirit/fs'; })) || false;
  }, test.limit.quick);
}
TARGETS.forEach(function (b) {
});

// ── 1. RECOGNIZED, AND ITS INTERFACE ────────────────────────────────────────────────────────────────────────────────
// A BRANCH IS ITS FOLDER'S PATH, NEVER A NAME TRANSLATED TO ONE (goal/G49.13; Andy: "WSL, general test: NO FUCKING translated old
// branch names! PATHS!!!!"): no index of api.js files by a name, and no guess of where a name's api.js may stand.
if (withApi.length) {
  // <branch>: its interface
  // Decided 7 (the box): "Verb rules live in api.js". Each verb a declaration of its arguments, each argument's rule.
  test.run('its api.js loads, and declares each verb\'s arguments and their rules', 0.4, function () {
    return overAll(withApi, function (b) {
      const odd = b.verbs ? Object.keys(b.verbs).filter(function (v) { const d = b.verbs[v]; return !d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(function (k) { return typeof d[k] !== 'string' && !(d[k] && typeof d[k] === 'object'); }); }) : [];
      return !!b.mod && !b.mod.threw && !!b.verbs && !odd.length;
    });
  }, test.limit.quick);
  // ITS VERBS AND THEIR .json FILES MATCH ONE TO ONE (goal/G47.4; Andy: "api.js and <verb>.json files match precisely", "loads
  // the api.js file and then makes sure that api.js and verb.json files match one-to-one, including defined arguments", "I
  // noticed some garbage test that hardcoded verbs that belong into it's <verb>.json collection.... BE SMARTER THAN THAT!",
  // "MAKE IT HAPPEN!!!"; taken in the sitting as cw's way: each <verb>.json's request lists every argument with its rule
  // exactly as api.js writes it). Every verb has its <verb>.json beside api.js, every .json there is a verb's, except the
  // branch's own <name>.json, which describes the branch; a verb with no arguments may leave its request out.
  test.run('each verb of its api.js has its <verb>.json, each .json a verb, with the same arguments and rules', 0.4, function () {
    return overAll(withApi, function (b) {
      if (!b.verbs) return false;
      const verbs = Object.keys(b.verbs);
      let files = [];
      try { files = fs.readdirSync(path.join(RUN, b.dir)).filter(function (f) { return /\.json$/.test(f) && f !== b.name + '.json'; }).map(function (f) { return f.slice(0, -5); }); } catch (e) { return false; }
      if (files.some(function (f) { return verbs.indexOf(f) === -1; })) return false;
      return verbs.every(function (v) {
        let j = null;
        try { j = JSON.parse(fs.readFileSync(path.join(RUN, b.dir, v + '.json'), 'utf8')); } catch (e) { return false; }
        if (!j || typeof j !== 'object' || Array.isArray(j)) return false;
        const sorted = function (o) { const out = {}; Object.keys(o || {}).sort().forEach(function (k) { out[k] = o[k] && typeof o[k] === 'object' ? sorted(o[k]) : o[k]; }); return out; };
        return JSON.stringify(sorted(j.request || {})) === JSON.stringify(sorted(b.verbs[v] || {}));
      });
    });
  }, test.limit.quick);
  // EVERY ARGUMENT NAMES ITS TYPE (goal/G48.4, the box): "a verb's arguments would name types: \"type.string.label\", the full
  // path of a fucking type under spirit"; "a type identifier is ALWAYS spirit.type.*"; "\"text\" dies. unlimited strings are
  // forbidden in SpiritOS."; "\"flags\" must be booleans". An argument's rule is spirit.type.<...>, a trailing ? making it
  // optional, and its type file spirit/type/<...>/script.js is there (goal/G49.13: a type is its folder's script.js).
  // BY ITS FILE'S PATH, NEVER A NAME MADE INTO ONE (goal/G49.13; Andy: "FIX THE FUCKING DYNAMICALLY CREATED spirit/type/* SHIT"):
  // the rule is the type file's run path written out, 'spirit/type/string/label/script.js', a trailing ? making it optional.
  test.run('each argument of its api.js names its type file by its full path, spirit/type/<...>/script.js, and that file is there', 0.4, function () {
    return overAll(withApi, function (b) {
      if (!b.verbs) return false;
      return Object.keys(b.verbs).every(function (v) {
        const args = b.verbs[v] || {};
        return Object.keys(args).every(function (a) {
          const rule = String(args[a]).replace(/\?$/, '');
          if (!/^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule)) return false;
          return fs.existsSync(path.join(RUN, rule));
        });
      });
    });
  }, test.limit.quick);
}

// ── 1a. AN APP BRANCH'S DESCRIPTION ─────────────────────────────────────────────────────────────────────────────────
// AGENT.md, an app: "the app family's live at spirit/run/spirit/app/<name>/, each described by its own <name>/<name>.json
// (goal/G43.2)"; Andy, box: "containing identity:icon and identity:label", and "spirit.app also holds the family's verb,
// search, so no app may take the name of a verb." (goal/G43.6); ./appServer.md: "<name>.json has no kind or
// operated. The node operates the server."
function manifestOf(b) {
  try { return JSON.parse(fs.readFileSync(path.join(RUN, b.dir + '/' + b.name + '.json'), 'utf8')); } catch (e) { return { threw: true }; }
}
if (apps.length) {
  // <branch>: its description
  test.run('its manifest names identity.icon and identity.label', 0.4, function () {
    return overAll(apps, function (b) {
      const j = manifestOf(b);
      const id = j && j.identity && typeof j.identity === 'object' ? j.identity : {};
      return !!j && !j.threw && typeof id.icon === 'string' && !!id.icon && typeof id.label === 'string' && !!id.label;
    });
  }, test.limit.quick);
  test.run('its manifest has no kind or operated: the node operates the server', 0.4, function () {
    return overAll(apps, function (b) {
      const j = manifestOf(b);
      return !!j && !j.threw && !('kind' in j) && !('operated' in j);
    });
  }, test.limit.quick);
  test.run('its name is no verb of the app branch', 0.4, function () {
    let familyVerbs = [];
    // Read from its <verb>.json files, never by loading spirit/app/script.js (goal/G49.27, Q4).
    try { familyVerbs = fs.readdirSync(path.join(RUN, 'spirit', 'app')).filter(function (f) { if (!/\.json$/.test(f) || f === 'app.json') return false; try { const j = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', f), 'utf8')); return !!j && typeof j.description === 'string'; } catch (e) { return false; } }).map(function (f) { return f.slice(0, -5); }); } catch (e) { familyVerbs = []; }
    return overAll(apps, function (b) {
      return familyVerbs.length > 0 && familyVerbs.indexOf(b.name) === -1;
    });
  }, test.limit.quick);
}

// ── 2. ITS CACHE (was data-caches.js, goal/G41.28) ──────────────────────────────────────────────────────────────────
// Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
// node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
// is the appServer serializes the cache to disk."
const DATA = path.join(RUN, 'spirit', 'client', 'script.js');
// Every branch with an interface has its data.js in its own folder.
if (withApi.length) {
  // <branch>: its cache
  test.run('its data.js is there', 0.4, function () {
    return overAll(withApi, function (b) { return !!b.data; });
  }, test.limit.quick);
}
if (withData.length) {
  // Each data.js read once, comments left out, and the name it hands makeFamily.
  withData.forEach(function (b) {
    b.src = code(path.join(RUN, b.data));
    const named = /makeFamily\(\s*['"]([^'"]+)['"]/.exec(b.src);
    b.made = named ? named[1] : '';
    // Its branches, the strings it gives its names to (var ITEMS = 'desk').
    b.owned = []; const re = /\bvar\s+[A-Z][A-Z_]*\s*=\s*'([a-zA-Z]\w*)'\s*;/g; let x;
    while ((x = re.exec(b.src))) if (b.owned.indexOf(x[1]) === -1) b.owned.push(x[1]);
  });
  const owning = withData.filter(function (b) { return b.owned.length > 0; });
  // Its branches, the strings it gives its names to (var ITEMS = 'desk'), are named by it alone: no other file hands a
  // path of them to a reader or writer (D.get('desk/' + id), a watch on such a path).
  // <branch>: its branch <name>
  if (owning.length) test.run('the branch is named by its data.js alone; every other file asks it', 0.4, function () {
    const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/client/script.js' && !/\/test\//.test(f); });
    const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|\/vendor\//.test(f) && !VENDORED_FOLDERS.holds(f) && managers.indexOf(f) === -1; });
    const readerCode = readers.map(function (f) { return { f: f, c: code(path.join(RUN, f)) }; });
    return overAll(owning, function (b) {
      return b.owned.every(function (name) {
        const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + name + '(?:/|[\'"])');
        return !readerCode.some(function (r) { return pathOf.test(r.c); });
      });
    });
  }, test.limit.quick);
  // <branch>: its cache, the rest
  // ONE PATTERN (goal/G43.7, the box: "ALL ... files will be converted to "data.js" files", "using the module
  // spirit/client/script.js", "with the SAME pattern"; from ./data-families.js): the guard, the attach
  // and the write on spirit are spirit/client/script.js's, none of it rolled by the family by hand.
  test.run('its data.js rolls none of it by hand', 0.4, function () {
    return overAll(withData, function (b) { return !/Symbol\.for|function attach|\.spirit\s*=|spirit\.[A-Za-z]+Data\s*=/.test(b.src); });
  }, test.limit.quick);
  // The one difference is the disk: no manager touches a file or the browser's storage.
  test.run('its data.js touches no file and no browser storage', 0.4, function () {
    return overAll(withData, function (b) {
      const disk = /require(?:Script)?\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(b.src);
      return !disk;
    });
  }, test.limit.quick);
  // One contract: required, it stands at spirit.client.<name> through spirit.client.makeFamily (the store at its place since
  // goal/G49.23), the name it hands
  // makeFamily, never guessed from its folder.
  // EVERY BRANCH IS NAMED AS ITS FOLDER (goal/G43.31; Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
  // motherfucking <name> in spirit/app/<name>....", and "make sure, IN THIS ITEM that family names MATCH folder names").
  test.run('its data.js makes the branch its folder is named', 0.4, function () {
    // The name the wire knows it by, an app's its id (goal/G49.19: makeFamily('spirit.app.desk')); a trunk branch's its path too
    // since goal/G49.23 (b313ce7eb: makeFamily('spirit.config')), so the family is named by the folder's path in dots.
    return overAll(withData, function (b) { return b.made === SPIRIT.dottedPath(b.dir); });
  }, test.limit.quick);
  // Andy (goal/G47.1): "every api.js requires it's companion data.js, and is the only script to require that data.js".
  const apiAndData = withData.filter(function (b) { return !!b.api; });
  // The data.js paths its api.js requires by their written path, comments left out (this part's own reader: the one the
  // tree-wide check uses lives in another part's function and is not in reach here).
  const requiresData = function (rel) { const out = []; const re = /\brequire(?:Script)?\s*\(\s*['"`](spirit\/[^'"`]+\/data\.js)['"`]/g; const c = code(path.join(RUN, rel)); let m; while ((m = re.exec(c))) out.push(m[1]); return out; };
  if (apiAndData.length) test.run('its api.js requires the data.js beside it', 0.4, function () {
    return overAll(apiAndData, function (b) { return requiresData(b.api).indexOf(b.data) !== -1; });
  }, test.limit.quick);
  test.run('its data.js loads, and exports its cache rules if it has any', 0.4, function () {
    return overAll(withData, function (b) {
      let mod = null;
      try { mod = require(path.join(RUN, b.data)); } catch (e) { mod = { threw: true }; }
      return (!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object'))) ? true : false;
    });
  }, test.limit.quick);
  // goal/G49.23: the store hands no family out by name. Its data is what the data.js exports, placed at its path on the spirit
  // object (spirit.config.data), the reads handed out onto it; its cache is the store's, under the family it made, which the
  // handle it hands out names in each branch's whole path (<node>/<family>/<branch>).
  function familyOf(b) {
    try {
      if (!b.made) return null;
      const reads = SPIRIT.requireScript(b.data);
      let at = SPIRIT; b.data.replace(/\.js$/, '').split('/').slice(1).forEach(function (k) { at = at && at[k]; });
      const h = reads && typeof reads.handle === 'function' ? reads.handle('x') : null;
      const filed = !!h && String(h.path).split('/')[1] === b.made;
      return { data: at === reads ? reads : null, cache: filed ? h : null };
    } catch (e) { return null; }
  }
  test.run('in node its data stands at its path, and its cache in the store under its branch, for clients to ask', 0.4, function () {
    return overAll(withData, function (b) {
      const f = familyOf(b);
      return (!!f && !!f.data && typeof f.data === 'object' && !!f.cache && typeof f.cache === 'object') ? true : false;
    });
  }, test.limit.quick);
  // A BRANCH'S WATCH IS CALLED watch (Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called "watch"", "the
  // branch is already implied in it's containing object.", "wsl, assert this in a test for branches."): every object
  // its reads hold is a branch, its watch the member named watch and no other (watchFile, watchApp, watchRow are the
  // names it replaces), never told which branch: it takes the function, and at most the row it narrows to.
  function watchesOf(b) {
    const f = familyOf(b);
    if (!f || !f.data || typeof f.data !== 'object') return null;
    const others = []; const told = []; const seen = [];
    (function walk(o, at, depth) {
      if (!o || typeof o !== 'object' || depth > 4 || seen.indexOf(o) !== -1) return;
      seen.push(o);
      Object.keys(o).forEach(function (k) {
        let v;
        try { v = o[k]; } catch (e) { return; }
        const here = at ? at + '.' + k : k;
        if (/^watch./.test(k)) others.push(here);
        if (k === 'watch' && typeof v === 'function') { if (v.length > 2) told.push(here); }
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, here, depth + 1);
      });
    }(f.data, '', 0));
    return { others: others, told: told };
  }
  test.run('no branch of its data names its watch other than watch', 0.4, function () {
    return overAll(withData, function (b) {
      const w = watchesOf(b);
      if (!w) return false;
      return !w.others.length;
    });
  }, test.limit.quick);
  test.run('no watch of its data is told its branch: each takes the function and at most its row', 0.4, function () {
    return overAll(withData, function (b) {
      const w = watchesOf(b);
      if (!w) return false;
      return !w.told.length;
    });
  }, test.limit.quick);
}

// ── 3. ON A NODE: SERVED, GATED, FOUND ──────────────────────────────────────────────────────────────────────────────
// THE VALUES, FROM THE TYPE FILES (Andy's type system): each argument names its type file by its full path,
// spirit/type/<...>/script.js (goal/G49.13), and that file is asked. The wrong value is the first of TRIES its isValid throws for; the good one its defaultValue,
// or else the first of TRIES it answers true for. The old rule names (text, id, number, ...) are gone from here: their
// good value "x" failed a real id, so every call was refused for it and the door was never judged.
const TRIES = [true, 12345, 1.5, 'not a number', 'x', 'yes', 'http://192.0.2.1:9/', 'zz-no-such-file', 'a@b.example', {}, [], '', null];
function typeOf(rule) {
  const r = String(rule).replace(/\?$/, '');
  if (!/^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(r)) return null;
  try { return SPIRIT.requireScript(r); } catch (e) { return null; }
}
function takes(T, v) { try { return T.isValid(v) === true; } catch (e) { return false; } }
// undefined: the type takes every try, or none.
function wrongFor(T) { return TRIES.find(function (v) { return !takes(T, v); }); }
function goodFor(T) {
  let d; try { d = T.defaultValue(); } catch (e) { d = undefined; }
  if (d !== undefined && takes(T, d)) return d;
  return TRIES.find(function (v) { return takes(T, v); });
}
function asksFor(fam, verb, decl) {
  const out = [];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return out;
  const keys = Object.keys(decl);
  // An argument with no type file, or with no good or wrong value from it, cannot be judged: the verb is red, never a
  // vacuous green (a call refused for that argument would pass for one refused for the argument under test).
  const T = {};
  keys.forEach(function (k) { T[k] = typeOf(decl[k]); });
  if (keys.some(function (k) { return !T[k] || goodFor(T[k]) === undefined || wrongFor(T[k]) === undefined; })) return [{ fam: fam, verb: verb, unjudged: true }];
  const base = {};
  keys.forEach(function (k) { if (!/\?$/.test(String(decl[k]))) base[k] = goodFor(T[k]); });
  keys.forEach(function (k) {
    const wrong = Object.assign({}, base); wrong[k] = wrongFor(T[k]);
    out.push({ fam: fam, verb: verb, args: wrong });
    if (!/\?$/.test(decl[k])) { const miss = Object.assign({}, base); delete miss[k]; out.push({ fam: fam, verb: verb, args: miss }); }
  });
  out.push({ fam: fam, verb: verb, args: Object.assign({}, base, { zzNoSuchArgument: 1 }) });
  return out;
}

const served = TARGETS.filter(function (b) { return b.api && b.verbs; });
const switched = served.filter(function (b) {
  if (b.kind !== 'app') return false;
  // An intrinsic app is always active and the node refuses to switch it (app-intrinsic, 409): its server runs by itself,
  // and the wait below for its branch judges that it does (goal/G47.1: testicle, the first intrinsic app with a server).
  const manifest = manifestOf(b);
  return !(manifest && manifest.identity && manifest.identity.intrinsic === true);
});
const N = { node: null, tree: null };
function raw(call, args) {
  const c = new AbortController();
  const timer = setTimeout(function () { c.abort(); }, ASK_MS);
  return fetch(N.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }), signal: c.signal })
    .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { body = null; } return { status: r.status, body: body, text: t }; }); },
      function () { return { status: 0, body: null, text: '' }; })
    .then(function (r) { clearTimeout(timer); return r; });
}
function up() { return !!N.node && N.node.up; }
// The branch the node's api tree holds for b, waited for once.
async function treeOf() {
  if (N.tree) return N.tree;
  let tree = {};
  await H.until(function () {
    return raw('api', {}).then(function (r) { tree = r.body || {}; return served.every(function (b) { const t = tree[b.family]; return t && typeof t === 'object' && t.ok !== false && Object.keys(t).length > 0; }); });
  }, 60000);
  N.tree = tree;
  return tree;
}
function branchIn(b) { const t = N.tree || {}; return t[b.family] && typeof t[b.family] === 'object' && t[b.family].ok !== false ? t[b.family] : null; }
if (served.length) {
  // THE NODE TESTICLE HANDS THE RUN (goal/G47.1; Andy: "are the tests not ordered in the general test so that all tests
  // requiring a scratch node can use the same one?"): handed a list, every part runs once a script, so a node of its own
  // would boot once a branch; the node testicle hands its run (shared: true, as -browser.js takes it) serves them all. Run
  // by hand, with none handed, it gets one of its own.
  test.run('a scratch node comes up for this suite', 0.2, async function () {
    if (!N.node) N.node = tools.node.node || (tools.node.node = await H.scratchNode({ shared: true }));
    return N.node.up || false;
  }, test.limit.slow);
  // An app's branch is served once its server runs (the owner's app.active); the node's own are served by the node.
  if (switched.length) {
    test.run('its app is switched on', 0.2, async function () {
      if (!up()) return false;
      let ok = true;
      for (const b of switched) {
        // The app branch's verbs by its id since goal/G49.20: spirit.app.active.
        const on = await raw('spirit.app.active', { key: b.family, active: true });
        if (on.status !== 200) ok = false;
      }
      return ok;
    }, test.limit.quick);
  }
  // required on the node
  // Required on the node, in a process of the scratch node's run root, so its spirit.js knows that node (its
  // environment.json): the test stands without a node of the checkout's own.
  test.run('its api.js, required on the node, stands at its path on the spirit object with its verbs, and spirit holds no other branch of it', 0.4, async function () {
    if (!up()) return false;
    await treeOf();
    const sRun = path.join(N.node.root, 'spirit', 'run');
    const ran = spawnSync(process.execPath, ['-e', PLACED, sRun, JSON.stringify(served.map(function (b) { return b.api; }))], { cwd: sRun, encoding: 'utf8', timeout: 120000 });
    let placed = {};
    try { placed = JSON.parse(String(ran.stdout || '').trim().split('\n').pop()); } catch (e) { placed = { threw: true }; }
    return overAll(served, function (b) {
      const g = placed[b.api] || { threw: true };
      return (!g.threw && g.placed && !g.unbound.length && g.same) ? true : false;
    });
  }, test.limit.long);
  // <branch>: on a node
  test.run('the node\'s api tree holds its branch', 0.4, async function () {
    if (!up()) return false;
    await treeOf();
    return overAll(served, function (b) { return !!branchIn(b); });
  }, test.limit.quick);
  // The interface the node serves for it is its own api.js (goal/G43.27, requirement 2: server.js branchDir looks for
  // spirit/app/<name>/api.js, appServer.js withAgents takes the app folder itself as the family folder).
  test.run('the interface the node serves is its api.js', 0.4, async function () {
    if (!up()) return false;
    let ok = true;
    for (const b of served) {
      if (!branchIn(b)) { ok = false; continue; }
      const fam = await raw('api', { branch: b.family });
      const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
      const mine = fs.readFileSync(path.join(RUN, b.api), 'utf8').replace(/\r\n/g, '\n');
      if (!(fam.status === 200 && iface === mine)) ok = false;
    }
    return ok;
  }, test.limit.quick);
  // It serves exactly the verbs its own api.js declares (goal/G43.20; Andy: "IN THIS ONE, OR WE'LL NEVER GET FUCKING
  // DONE.", "WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."), no
  // FS set among them. Beyond an api.js only by decision: appServer's DEBUG on every server (desk/G2.5: "DEBUG
  // auto-verb supplied by appServer is approved."), and appServer's remote on every server (goal/G47.5, box v12: "it created an
  // auto-verb called \"remote\"") and its listener (Andy: "the listener must be an auto-verb of
  // spirit/server/app/script.js!"). Desk's item.rules verbs went with the rules (goal/G47.4, box v36).
  test.run('it serves exactly the verbs of its api.js', 0.4, function () {
    if (!up()) return false;
    return overAll(served, function (b) {
      const branch = branchIn(b);
      if (!branch) return false;
      const declared = Object.keys(b.verbs);
      const offered = Object.keys(branch);
      const decided = ['DEBUG', 'remote', 'listener', 'subscribe', 'unsubscribe'];
      const extra = offered.filter(function (v) { return declared.indexOf(v) === -1 && decided.indexOf(v) === -1; });
      const missing = declared.filter(function (v) { return offered.indexOf(v) === -1; });
      return (!extra.length && !missing.length) ? true : false;
    });
  }, test.limit.quick);
  test.run('its branch carries no FS set', 0.4, function () {
    if (!up()) return false;
    return overAll(served, function (b) {
      const branch = branchIn(b);
      if (!branch) return false;
      const fs_ = Object.keys(branch).filter(function (v) { return /^FS\./.test(v); });
      return !fs_.length;
    });
  }, test.limit.quick);
  // EVERY BROKEN CALL IS REFUSED AT THE DOOR (goal/G41.30; Andy, of "only the spirit object checks those rules, on the
  // caller's side. A raw call to /spirit, the attacker's way, reaches the handler unchecked": "this needs fixing in
  // this item."; an app's in its own process, decided 9): from its declaration, a raw call over http, no spirit
  // object, breaks each verb's arguments three ways, an argument of the wrong type, a required one left out, one no
  // verb names; each must answer a 4xx with a code, before the handler runs.
  const broken = function (b) { const asks = []; Object.keys(b.verbs).forEach(function (v) { asksFor(b.family, v, b.verbs[v]).forEach(function (a) { asks.push(a); }); }); return asks; };
  const thrownAt = served.filter(function (b) { return broken(b).length > 0; });
  if (thrownAt.length) {
    test.run('every broken call to its branch on /spirit is refused at the door with a 4xx and a code', 0.4, async function () {
      if (!up()) return false;
      let ok = true;
      for (const b of thrownAt) {
        if (!branchIn(b)) { ok = false; continue; }
        const asks = broken(b);
        let wrong = 0;
        let seen = 0;
        for (let i = 0; i < asks.length; i += BATCH) {
          const batch = asks.slice(i, i + BATCH);
          // NO ANSWER IS NO VERDICT (Andy: "too many flips are always suspicious."): a call the node left unanswered within
          // ASK_MS, on a node busy with a long run, said nothing about the door, and flipped the check red and back. It is
          // asked again, up to three times; any answer, right or wrong, is judged as it comes, and one never answered stays
          // wrong.
          const asked = function (a) {
            if (a.unjudged) return Promise.resolve({ status: 0 });
            const once = function (left) { return raw(a.fam + '.' + a.verb, a.args).then(function (r) { return r.status === 0 && left > 0 ? once(left - 1) : r; }); };
            return once(2);
          };
          const got = await Promise.all(batch.map(asked));
          got.forEach(function (r) {
            seen += 1;
            const c = r.body && r.body.code;
            if (!(r.status >= 400 && r.status < 500 && typeof c === 'string' && c && c !== 'handler-failed')) wrong += 1;
          });
        }
        if (!(seen === asks.length && !wrong)) ok = false;
      }
      return ok;
    }, test.limit.slow);
  }

  // EACH data.js FETCHED BY ITS PATH (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript, data.js exactly
  // as api.js"; a -general test opens no browser).
  const found = served.filter(function (b) { return b.data; });
  if (found.length) {
    // The node serves each one, at its path, as a script that calls the store's makeFamily (spirit.client).
    test.run('the shell downloads its data.js', 0.4, async function () {
      if (!up()) return false;
      let ok = true;
      for (const b of found) {
        const got = await fetch(N.node.base + '/' + b.data).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
        if (!(got.status === 200 && got.text.indexOf('.makeFamily(') !== -1)) ok = false;
      }
      return ok;
    }, test.limit.quick);
  }
}

test.after(async function () {
  // The run's one node is let go once, by the first script's after.
  if (!N.node || N.node.letGo) return;
  N.node.letGo = true;
  // A handed node is the run's: let go, never stopped and its tree never freed.
  if (N.node && N.node.shared) { try { await N.node.release(); } catch (e) { /* the run's */ } }
  else if (N.node) {
    try { if (N.node.child) N.node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (N.node.root) SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(N.node); } catch (e) { /* scratch */ }
  }
});
}

// No name its checks look for is skipped in its files (goal/G49.27, Andy: "All, cw's way"): it forbids none by name.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'node', own: false, forbids: FORBIDS_NAMES, checks: checks };
