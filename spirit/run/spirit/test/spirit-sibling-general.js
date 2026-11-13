'use strict';
// spirit/run/spirit/test/spirit-sibling-general.js [<script or folder> ...]
// THE -general GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests, at any level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
// <file>-<child | sibling>-browser.js", "existing general tests fold into the appropriate of the 3 new general test
// name-formats"). Its contract: ./spirit-sibling-general.md.
//
// The checks that judge a script from its file alone, every title kept, each part the general test it was, in a function
// of its own: branchRules, titleRules, noFuckingGarbage, searchRules, testReachRules. "with no script-argument, they will process all applicable scripts. else it
// will process all scripts listed in the arguments that fit": no argument, each part judges all it applies to; each
// argument, each part judges that one, its results reported for it (testReport's test.forScript).
require('../spirit.js');
const test = require('./testReport.js');
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--verify-port' && all[i - 1] !== '--test'; });

// ── branchRules (was spirit/test/spirit-sibling-branchRules.js) ─────────────────────────────────────────────────────────────────────
function branchRules(ARGS) {

// spirit/run/spirit/test/spirit-sibling-branchRules.js
// EVERY RULE OF A BRANCH, JUDGED ON EACH BRANCH FOLDER (goal/G43.32; spec: ./spirit-sibling-branchRules.md). A general test,
// beside spirit.js, outside every branch. Andy: "make sure nobody can add an app implementing a family, without adhering to
// the rules, this means that a test outside of each branch must assert this.", "such a general test must therefore
// "recognize" a branch folder, and assert all rulers relating to branches.", "would that not actually be a general test
// spirit-sibling-branchRules?", and to Q7: "branch test only needs to associate a failure with either spirit/<name>/ or
// spirit/app/<name>/".
//
//   node spirit/test/spirit-sibling-branchRules.js spirit/app/desk     one branch, its folder the argument
//   node spirit/test/spirit-sibling-branchRules.js                     every branch
//
// Each rule is one test (goal/G47.2: one title per test, unique in its suite): its answer names every branch folder that
// breaks it. A rule is said only when a branch it applies to is judged, so none passes on nothing.
//
// A branch is recognized by its folder (testModule.js branchesOf; Andy: "app-branches are easily identified using the
// patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json", "and system branches by: spirit.<name>.api.js &&
// spirit.<name>.data.js"). Every check is named by its branch folder. What it took in, per branch, from the five tests
// that held branch rules (goal/G43.32, Q6: "absolutely, AND MAKE SURE NO TEST GETS LOST."): spirit-familyFinder.js,
// data-caches.js, apiDoor-familyGate.js, server-appFamily.js, introSpector-branchVerbs.js; what judges no branch went back
// to the test of the module it judges (./data.js, which data-caches.js went into, ./spirit.js, its familyFinder part). A scratch node; never a live one.

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const { branchesOf } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

const ASK_MS = 8000;
const BATCH = 10;
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function has(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }

// NOBODY ADDS A BRANCH PAST THE RULES: the tree is every file git keeps and every file not yet added that git does not
// ignore, so a new app's branch is judged before it is committed.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);
const ALL = branchesOf(RUN);
// WHAT FITS (box v94, 2: "all scripts listed in the arguments that fit"): a branch folder, or a file in one, which is judged
// as its branch; anything in no branch is not this part's, and it judges nothing.
const handed = ARGS[0] ? String(ARGS[0]).replace(/^\.\//, '').replace(/^spirit\/run\//, '').replace(/\/$/, '') : '';
const home = handed ? ALL.filter(function (b) { return handed === b.dir || handed.indexOf(b.dir + '/') === 0; })
  .sort(function (a, b) { return b.dir.length - a.dir.length; })[0] : null;
if (handed && !home) return;
const asked = home ? home.dir : '';
const TARGETS = asked ? ALL.filter(function (b) { return b.dir === asked; }) : ALL;

// What each branch is made of.
TARGETS.forEach(function (b) {
  b.api = has(b.dir + '/api.js') ? b.dir + '/api.js' : '';
  b.data = has(b.dir + '/data.js') ? b.dir + '/data.js' : '';
  try { b.mod = b.api ? require(path.join(RUN, b.api)) : null; } catch (e) { b.mod = { threw: e.message }; }
  b.verbs = b.mod && b.mod.verbs && typeof b.mod.verbs === 'object' && !Array.isArray(b.mod.verbs) ? b.mod.verbs : null;
  // Its name, as a client asks it: the folder's name (spirit/app/api.js is the branch app).
  b.family = b.name;
});

// On the node, in a process of its own: each api.js required as every script is (spirit.require), and what that placed
// and bound. Decided 8 (the box): "A branch's api.js is placed at spirit.required.spirit.<branch-path>.api and also binds
// the branch." node -e: the arguments start at argv[1].
const PLACED = `
const s = require(process.argv[1] + '/spirit/spirit.js');
const out = {};
(async function () {
  for (const f of JSON.parse(process.argv[2])) {
    try {
      const fam = await s.require(f);
      let at = s.required; f.replace(/\\.js$/, '').split('/').forEach(function (k) { at = at && at[k]; });
      const decl = (at && at.verbs) || {};
      const names = (at && at.functions) || {};
      const name = f.split('/').slice(-2, -1)[0];
      out[f] = { placed: !!at && typeof at === 'object', verbs: Object.keys(decl).length,
        unbound: Object.keys(decl).filter(function (v) { return !(fam && typeof fam[names[v] || v] === 'function'); }),
        same: s[name] === fam };
    } catch (e) { out[f] = { threw: String((e && e.message) || e).slice(0, 200) }; }
  }
  console.log(JSON.stringify(out));
  process.exit(0);
}());
`;

// A rule judged on every branch it applies to: what each breaks, '' when it keeps it. The answer names each that breaks it.
function overAll(list, judge) {
  const bad = [];
  list.forEach(function (b) { const why = judge(b); if (why) bad.push(why); });
  return !bad.length || bad.join('; ');
}
const withApi = TARGETS.filter(function (b) { return !!b.api; });
const apps = TARGETS.filter(function (b) { return b.kind === 'app'; });
const withData = TARGETS.filter(function (b) { return !!b.data; });

// the branches
if (asked) {
  test.run('the world: the folder handed is a branch folder', 0.2, function () {
    return TARGETS.length > 0 || asked + ' is no branch folder: a system branch is spirit/<name>/ with api.js and data.js, an app branch spirit/app/<name>/ with <name>.js and <name>.json';
  }, test.limit.quick);
} else {
  test.run('the world: branch folders recognized, an app\'s (desk) and a system one (fs) among them', 0.2, function () {
    test.comment(TARGETS.length + ' of ' + ALL.length + ' branches: ' + TARGETS.map(function (b) { return b.dir; }).join(', '));
    return (ALL.length >= 20 && ALL.some(function (b) { return b.dir === 'spirit/app/desk'; }) && ALL.some(function (b) { return b.dir === 'spirit/fs'; })) || 'only ' + short(ALL.map(function (b) { return b.dir; })) + ': nothing judged';
  }, test.limit.quick);
}
TARGETS.forEach(function (b) {
  test.comment(b.dir + ': a ' + b.kind + ' branch, recognized by ' + (b.kind === 'system' ? 'its api.js and data.js' : 'its manifest, ' + b.name + '.json') + (b.api ? '' : '; it holds no api.js, so it has no interface to judge'));
});

// ── 1. RECOGNIZED, AND ITS INTERFACE ────────────────────────────────────────────────────────────────────────────────
// Every api.js under a run folder by its name, where a family can live (spirit/<name>/, spirit/app/<name>/, and
// process/js/<name>/ with its family/ folder): a second of a branch's name is a duplicate (goal/G43.27: "duplicate
// <name>/api.js raise a red.").
const byName = {};
tracked.forEach(function (f) {
  const m = /^spirit\/(?:app\/)?([^/]+)\/api\.js$/.exec(f) || /^process\/js\/([^/]+)\/(?:family\/)?api\.js$/.exec(f);
  if (!m) return;
  const n = f === 'spirit/app/api.js' ? 'app' : m[1];
  (byName[n] = byName[n] || []).push(f);
});
if (withApi.length) {
  // <branch>: its interface
  // Decided 7 (the box): "Verb rules live in api.js". Each verb a declaration of its arguments, each argument's rule.
  test.run('its api.js loads, and declares each verb\'s arguments and their rules', 0.4, function () {
    return overAll(withApi, function (b) {
      const odd = b.verbs ? Object.keys(b.verbs).filter(function (v) { const d = b.verbs[v]; return !d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(function (k) { return typeof d[k] !== 'string' && !(d[k] && typeof d[k] === 'object'); }); }) : [];
      return (!!b.mod && !b.mod.threw && !!b.verbs && !odd.length) ? '' :
        b.api + ': ' + (b.mod && b.mod.threw ? 'it does not load: ' + b.mod.threw : !b.verbs ? 'it declares no verbs' : 'verbs not declared as arguments and rules: ' + short(odd));
    });
  }, test.limit.quick);
  // Where it stands is where its family is found (goal/G43.27: spirit/<name>/, spirit/app/<name>/, the fewest path
  // elements), and no other api.js has its name.
  test.run('its api.js is where its branch is found', 0.4, function () {
    return overAll(withApi, function (b) { return familyPath(b.family) === b.api ? '' : b.api + ': the family ' + b.family + ' is found at ' + short(familyPath(b.family)) + ', not here'; });
  }, test.limit.quick);
  test.run('no other api.js of its branch in the tree', 0.4, function () {
    return overAll(withApi, function (b) {
      const twins = (byName[b.family] || []).filter(function (f) { return f !== b.api; });
      return !twins.length ? '' : b.api + ': ' + b.family + ' has another api.js: ' + short(twins);
    });
  }, test.limit.quick);
}

// ── 1a. AN APP BRANCH'S DESCRIPTION ─────────────────────────────────────────────────────────────────────────────────
// AGENT.md, an app: "the app family's live at spirit/run/spirit/app/<name>/, each described by its own <name>/<name>.json
// (goal/G43.2)"; Andy, box: "containing identity:icon and identity:label", and "spirit.app also holds the family's verb,
// search, so no app may take the name of a verb." (goal/G43.6); ./appServer.md: "<name>.json has no kind or
// operated. The node operates the server."
function manifestOf(b) {
  try { return JSON.parse(fs.readFileSync(path.join(RUN, b.dir + '/' + b.name + '.json'), 'utf8')); } catch (e) { return { threw: e.message }; }
}
if (apps.length) {
  // <branch>: its description
  test.run('its manifest names identity.icon and identity.label', 0.4, function () {
    return overAll(apps, function (b) {
      const j = manifestOf(b);
      const id = j && j.identity && typeof j.identity === 'object' ? j.identity : {};
      return (!!j && !j.threw && typeof id.icon === 'string' && !!id.icon && typeof id.label === 'string' && !!id.label) ? '' :
        b.dir + '/' + b.name + '.json: ' + (j && j.threw ? 'it is no JSON: ' + j.threw : 'identity is ' + short(j && j.identity));
    });
  }, test.limit.quick);
  test.run('its manifest has no kind or operated: the node operates the server', 0.4, function () {
    return overAll(apps, function (b) {
      const j = manifestOf(b);
      return (!!j && !j.threw && !('kind' in j) && !('operated' in j)) ? '' : b.dir + '/' + b.name + '.json: it holds ' + short(['kind', 'operated'].filter(function (k) { return j && k in j; }));
    });
  }, test.limit.quick);
  test.run('its name is no verb of the app family', 0.4, function () {
    let familyVerbs = [];
    try { familyVerbs = Object.keys(require(path.join(RUN, 'spirit', 'app', 'api.js')).verbs || {}); } catch (e) { familyVerbs = []; }
    return overAll(apps, function (b) {
      return (familyVerbs.length > 0 && familyVerbs.indexOf(b.name) === -1) ? '' : b.dir + ': ' + (familyVerbs.length ? 'it takes the name of the verb app.' + b.name : 'the app family declares no verbs: nothing judged');
    });
  }, test.limit.quick);
}

// ── 2. ITS CACHE (was data-caches.js, goal/G41.28) ──────────────────────────────────────────────────────────────────
// Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
// node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
// is the appServer serializes the cache to disk."
const DATA = path.join(RUN, 'spirit', 'data.js');
// Every branch with an interface has its data.js in its own folder.
if (withApi.length) {
  // <branch>: its cache
  test.run('its data.js is there', 0.4, function () {
    return overAll(withApi, function (b) { return b.data ? '' : b.family + ': no ' + b.dir + '/data.js for ' + b.api; });
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
    test.comment(b.data + ' names the branches ' + b.owned.join(', '));
  });
  const owning = withData.filter(function (b) { return b.owned.length > 0; });
  // Its branches, the strings it gives its names to (var ITEMS = 'desk'), are named by it alone: no other file hands a
  // path of them to a spirit.data reader or writer (D.get('desk/' + id), a watch on such a path).
  // <branch>: its branch <name>
  if (owning.length) test.run('the branch is named by its data.js alone; every other file asks it', 0.4, function () {
    const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/data.js' && !/\/test\//.test(f); });
    const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|\/vendor\//.test(f) && !VENDORED_FOLDERS.holds(f) && managers.indexOf(f) === -1; });
    const readerCode = readers.map(function (f) { return { f: f, c: code(path.join(RUN, f)) }; });
    return overAll(owning, function (b) {
      return b.owned.map(function (name) {
        const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + name + '(?:/|[\'"])');
        const others = readerCode.filter(function (r) { return pathOf.test(r.c); }).map(function (r) { return r.f; });
        return others.length ? b.dir + ': ' + name + ': its paths are named outside ' + b.data + ', by ' + short(others) : '';
      }).filter(Boolean).join('; ');
    });
  }, test.limit.quick);
  // <branch>: its cache, the rest
  // ONE PATTERN (goal/G43.7, the box: "ALL ... files will be converted to "data.js" files", "using the module
  // spirit/data.js", "with the SAME pattern"; from ./data-families.js): the old file is gone, and the guard, the attach
  // and the write on spirit are spirit/data.js's, none of it rolled by the family by hand.
  const OLD_MANAGER = 'clientCache' + 'Manager';
  test.run('the old file is gone', 0.4, function () {
    return overAll(withData, function (b) { return !has(b.dir + '/' + OLD_MANAGER + '.js') ? '' : b.dir + ': ' + b.dir + '/' + OLD_MANAGER + '.js still stands'; });
  }, test.limit.quick);
  test.run('its data.js rolls none of it by hand', 0.4, function () {
    return overAll(withData, function (b) { return !/Symbol\.for|function attach|\.spirit\s*=|spirit\.[A-Za-z]+Data\s*=/.test(b.src) ? '' : b.data + ': data.js still rolls its own guard, attach or spirit write'; });
  }, test.limit.quick);
  // The one difference is the disk: no manager touches a file or the browser's storage.
  test.run('its data.js touches no file and no browser storage', 0.4, function () {
    return overAll(withData, function (b) {
      const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(b.src);
      return !disk ? '' : b.data + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may';
    });
  }, test.limit.quick);
  // One contract: required, it stands at spirit.data.<name> through spirit.data.makeFamily, the name it hands
  // makeFamily, never guessed from its folder.
  // EVERY BRANCH IS NAMED AS ITS FOLDER (goal/G43.31; Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
  // motherfucking <name> in spirit/app/<name>....", and "make sure, IN THIS ITEM that family names MATCH folder names").
  test.run('its data.js makes the branch its folder is named', 0.4, function () {
    return overAll(withData, function (b) { return b.made === b.name ? '' : b.data + ': it makes the branch ' + (b.made || 'none') + ' in the folder ' + b.name; });
  }, test.limit.quick);
  test.run('its data.js loads, and exports its cache rules if it has any', 0.4, function () {
    return overAll(withData, function (b) {
      let mod = null;
      try { mod = require(path.join(RUN, b.data)); } catch (e) { mod = { threw: e.message }; }
      return (!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object'))) ? '' : b.data + ': it exports ' + short(mod && Object.keys(mod));
    });
  }, test.limit.quick);
  function familyOf(b) { try { return b.made ? require(DATA)[b.made] : null; } catch (e) { return null; } }
  test.run('in node it stands at spirit.data under its branch, its data and its cache, for clients to ask', 0.4, function () {
    return overAll(withData, function (b) {
      const f = familyOf(b);
      return (!!f && !!f.data && typeof f.data === 'object' && !!f.cache && typeof f.cache === 'object') ? '' : b.data + ': spirit.data.' + b.made + ' is ' + short(f);
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
        if (k === 'watch' && typeof v === 'function') { if (v.length > 2) told.push(here + ' takes ' + v.length); }
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, here, depth + 1);
      });
    }(f.data, '', 0));
    return { others: others, told: told };
  }
  test.run('no branch of its data names its watch other than watch', 0.4, function () {
    return overAll(withData, function (b) {
      const w = watchesOf(b);
      if (!w) return b.data + ': no reads to judge at spirit.data.' + b.made;
      return !w.others.length ? '' : b.data + ': spirit.data.' + b.made + '.data names a watch other than watch: ' + short(w.others);
    });
  }, test.limit.quick);
  test.run('no watch of its data is told its branch: each takes the function and at most its row', 0.4, function () {
    return overAll(withData, function (b) {
      const w = watchesOf(b);
      if (!w) return b.data + ': no reads to judge at spirit.data.' + b.made;
      return !w.told.length ? '' : b.data + ': a watch of spirit.data.' + b.made + ' takes more than its row and its function, so it is told its branch: ' + short(w.told);
    });
  }, test.limit.quick);
}

// ── 3. ON A NODE: SERVED, GATED, FOUND ──────────────────────────────────────────────────────────────────────────────
// A value no rule of this kind takes, on the wire (spirit.js, THE RULES).
function wrongFor(rule) {
  const r = String(rule).replace(/\?$/, '');
  if (r === 'number') return 'not a number';
  if (r === 'bool') return 'not a bool';
  if (r === 'object') return 12345;
  if (r === 'list') return 12345;
  return true; // every string rule: text, flag, name, description, paragraph, key, path, url, id
}
// A valid-looking value, so that only the argument under test is wrong.
function goodFor(rule) {
  const r = String(rule).replace(/\?$/, '');
  if (r === 'number') return 1;
  if (r === 'bool') return true;
  if (r === 'object') return {};
  if (r === 'list') return [];
  if (r === 'flag') return 'yes';
  if (r === 'url') return 'http://192.0.2.1:9/';
  if (r === 'path') return 'zz-no-such-file';
  return 'x';
}
function asksFor(fam, verb, decl) {
  const out = [];
  if (!decl || typeof decl !== 'object' || Array.isArray(decl)) return out;
  const keys = Object.keys(decl);
  const base = {};
  keys.forEach(function (k) { if (!/\?$/.test(String(decl[k]))) base[k] = goodFor(decl[k]); });
  keys.forEach(function (k) {
    if (typeof decl[k] !== 'string') return;
    const wrong = Object.assign({}, base); wrong[k] = wrongFor(decl[k]);
    out.push({ fam: fam, verb: verb, why: k + ' of the wrong type', args: wrong });
    if (!/\?$/.test(decl[k])) { const miss = Object.assign({}, base); delete miss[k]; out.push({ fam: fam, verb: verb, why: k + ' left out', args: miss }); }
  });
  out.push({ fam: fam, verb: verb, why: 'an argument it does not name', args: Object.assign({}, base, { zzNoSuchArgument: 1 }) });
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
const N = { node: null, tree: null, page: null, got: null, heard: [] };
function raw(call, args) {
  const c = new AbortController();
  const timer = setTimeout(function () { c.abort(); }, ASK_MS);
  return fetch(N.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }), signal: c.signal })
    .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { body = null; } return { status: r.status, body: body, text: t }; }); },
      function (e) { return { status: 0, body: null, text: c.signal.aborted ? 'no answer in ' + (ASK_MS / 1000) + ' s' : String(e && e.message) }; })
    .then(function (r) { clearTimeout(timer); return r; });
}
const NO_NODE = 'the scratch node did not come up: nothing judged';
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
  test.run('the world: a scratch node comes up', 0.2, async function () {
    N.node = await H.scratchNode();
    return N.node.up || NO_NODE;
  }, test.limit.slow);
  // An app's branch is served once its server runs (the owner's app.active); the node's own are served by the node.
  if (switched.length) {
    test.run('the world: its app is switched on', 0.2, async function () {
      if (!up()) return NO_NODE;
      const bad = [];
      for (const b of switched) {
        const on = await raw('app.active', { key: b.name, active: true });
        if (on.status !== 200) bad.push(b.dir + ': app.active ' + b.name + ' answered ' + on.status + ' ' + short(on.text));
      }
      return !bad.length || bad.join('; ');
    }, test.limit.quick);
  }
  // required on the node
  // Required on the node, in a process of the scratch node's run root, so its spirit.js knows that node (its
  // environment.json): the test stands without a node of the checkout's own.
  test.run('its api.js, required on the node, stands at its path in spirit.required, and binds its verbs on spirit under its branch', 0.4, async function () {
    if (!up()) return NO_NODE;
    await treeOf();
    const sRun = path.join(N.node.root, 'spirit', 'run');
    const ran = spawnSync(process.execPath, ['-e', PLACED, sRun, JSON.stringify(served.map(function (b) { return b.api; }))], { cwd: sRun, encoding: 'utf8', timeout: 120000 });
    let placed = {};
    try { placed = JSON.parse(String(ran.stdout || '').trim().split('\n').pop()); } catch (e) { placed = { threw: short(ran.stdout || ran.stderr) }; }
    return overAll(served, function (b) {
      const g = placed[b.api] || { threw: placed.threw || 'not required' };
      const at = 'spirit.required.' + b.api.replace(/\.js$/, '').split('/').join('.');
      return (!g.threw && g.placed && !g.unbound.length && g.same) ? '' :
        b.api + ': ' + (g.threw ? 'its require threw: ' + g.threw : (!g.placed ? 'it does not stand at ' + at + '; ' : '') + (g.unbound && g.unbound.length ? 'verbs not bound: ' + short(g.unbound) + '; ' : '') + (!g.same ? 'spirit.' + b.family + ' is not what it bound' : ''));
    });
  }, test.limit.long);
  // <branch>: on a node
  test.run('the node\'s api tree holds its branch', 0.4, async function () {
    if (!up()) return NO_NODE;
    await treeOf();
    return overAll(served, function (b) { return branchIn(b) ? '' : b.dir + ': the node\'s api tree holds no branch ' + b.family + ': ' + short((N.tree || {})[b.family]); });
  }, test.limit.quick);
  const noBranch = function (b) { return b.dir + ': the node\'s api tree holds no branch ' + b.family + ': nothing judged'; };
  // The interface the node serves for it is its own api.js (goal/G43.27, requirement 2: server.js familyDir looks for
  // spirit/app/<name>/api.js, appServer.js withAgents takes the app folder itself as the family folder).
  test.run('the interface the node serves is its api.js', 0.4, async function () {
    if (!up()) return NO_NODE;
    const bad = [];
    for (const b of served) {
      if (!branchIn(b)) { bad.push(noBranch(b)); continue; }
      const fam = await raw('api', { family: b.family });
      const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
      const mine = fs.readFileSync(path.join(RUN, b.api), 'utf8').replace(/\r\n/g, '\n');
      if (!(fam.status === 200 && iface === mine)) bad.push(b.dir + ': api {family: ' + b.family + '} answered ' + fam.status + (iface ? ', an interface that is not ' + b.api : ' ' + short(fam.text)));
    }
    return !bad.length || bad.join('; ');
  }, test.limit.quick);
  // It serves exactly the verbs its own api.js declares (goal/G43.20; Andy: "IN THIS ONE, OR WE'LL NEVER GET FUCKING
  // DONE.", "WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."), no
  // FS set among them. Beyond an api.js only by decision: appServer's DEBUG on every server (desk/G2.5: "DEBUG
  // auto-verb supplied by appServer is approved."), and desk's item.rules.add and item.rules.remove, his alone and left
  // out of its api.js on purpose (goal/G40.12, desk's api.js header).
  test.run('it serves exactly the verbs of its api.js', 0.4, function () {
    if (!up()) return NO_NODE;
    return overAll(served, function (b) {
      const branch = branchIn(b);
      if (!branch) return noBranch(b);
      const declared = Object.keys(b.verbs);
      const offered = Object.keys(branch);
      const decided = ['DEBUG'].concat(b.family === 'desk' ? ['item.rules.add', 'item.rules.remove'] : []);
      const extra = offered.filter(function (v) { return declared.indexOf(v) === -1 && decided.indexOf(v) === -1; });
      const missing = declared.filter(function (v) { return offered.indexOf(v) === -1; });
      return (!extra.length && !missing.length) ? '' : b.dir + ': ' + (extra.length ? extra.length + ' served beyond its api.js (' + short(extra.slice(0, 6)) + ')' : '') + (missing.length ? ' ' + missing.length + ' declared and not served ' + short(missing.slice(0, 6)) : '');
    });
  }, test.limit.quick);
  test.run('its branch carries no FS set', 0.4, function () {
    if (!up()) return NO_NODE;
    return overAll(served, function (b) {
      const branch = branchIn(b);
      if (!branch) return noBranch(b);
      const fs_ = Object.keys(branch).filter(function (v) { return /^FS\./.test(v); });
      return !fs_.length ? '' : b.dir + ': it carries ' + short(fs_);
    });
  }, test.limit.quick);
  // EVERY BROKEN CALL IS REFUSED AT THE DOOR (goal/G41.30; Andy, of "only the spirit object checks those rules, on the
  // caller's side. A raw call to /api/spirit, the attacker's way, reaches the handler unchecked": "this needs fixing in
  // this item."; an app's in its own process, decided 9): from its declaration, a raw call over http, no spirit
  // object, breaks each verb's arguments three ways, an argument of the wrong type, a required one left out, one no
  // verb names; each must answer a 4xx with a code, before the handler runs.
  const broken = function (b) { const asks = []; Object.keys(b.verbs).forEach(function (v) { asksFor(b.family, v, b.verbs[v]).forEach(function (a) { asks.push(a); }); }); return asks; };
  const thrownAt = served.filter(function (b) { return broken(b).length > 0; });
  served.filter(function (b) { return thrownAt.indexOf(b) === -1; }).forEach(function (b) { test.comment(b.dir + ': it declares no verb, so no call to break'); });
  if (thrownAt.length) {
    test.run('/api/spirit: all its broken calls are refused at the door, a 4xx with a code', 0.4, async function () {
      if (!up()) return NO_NODE;
      const bad = [];
      for (const b of thrownAt) {
        if (!branchIn(b)) { bad.push(noBranch(b)); continue; }
        const asks = broken(b);
        const wrong = [];
        let seen = 0;
        for (let i = 0; i < asks.length; i += BATCH) {
          const batch = asks.slice(i, i + BATCH);
          const got = await Promise.all(batch.map(function (a) { return raw(a.fam + '.' + a.verb, a.args); }));
          got.forEach(function (r, j) {
            const a = batch[j]; seen += 1;
            const c = r.body && r.body.code;
            if (!(r.status >= 400 && r.status < 500 && typeof c === 'string' && c && c !== 'handler-failed')) wrong.push(a.verb + ': ' + a.why + ' answered ' + r.status + ' ' + short(r.text));
          });
        }
        if (!(seen === asks.length && !wrong.length)) bad.push('/api/spirit ' + b.family + ': ' + (seen !== asks.length ? 'only ' + seen + ' of ' + asks.length + ' thrown; ' : '') + wrong.length + ' of ' + asks.length + ' broken calls not refused; first: ' + wrong.slice(0, 3).join(' | '));
      }
      return !bad.length || bad.join('; ');
    }, test.limit.slow);
  }

  // FOUND BY ITS NAME, ON A PAGE (goal/G43.27; Andy: "less path elements get priority, - the target needs an api.js"):
  // a page asks for the branch by its name alone, spirit.cacheManager, and gets its own data.js, and no data.js that
  // is not there.
  const found = served.filter(function (b) { return b.data; });
  if (found.length) {
    test.run('the world: a page on the scratch node asks for each branch by its name', 0.2, async function () {
      if (!up()) return NO_NODE;
      // The node's other checks are done; the page asks last.
      const page = N.page = await H.chromePage(H.findChrome());
      if (!page || page.error) return 'no Chrome page: ' + short(page && page.error);
      await page.send('Page.navigate', { url: N.node.base + '/' });
      await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
      N.got = await page.evaluate('Promise.resolve(window.spirit.ready).then(function () { return Promise.all(' + JSON.stringify(found.map(function (b) { return b.family; })) + '.map(function (n) { return window.spirit.cacheManager(n).then(function () { var f = (window.spirit.data || {})[n]; return [n, "ok", !!f && typeof f.data === "object" && typeof f.cache === "object"]; }, function (e) { return [n, String((e && e.message) || e), false]; }); })); })');
      N.heard = page.heard ? page.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).map(function (m) { return { url: m.params.response.url.replace(N.node.base, '').replace(/^\//, ''), status: m.params.response.status }; }) : [];
      return true;
    }, test.limit.slow);
    const said = function () { const o = {}; (N.got || []).forEach(function (r) { o[r[0]] = r[1]; }); return o; };
    const both = function () { const o = {}; (N.got || []).forEach(function (r) { o[r[0]] = r[2]; }); return o; };
    // <branch>: found by its name
    test.run('a page asking for its branch by its name gets its data.js', 0.4, function () {
      if (!N.got) return 'no page asked: the world failed';
      const s_ = said();
      return overAll(found, function (b) {
        const fetched = N.heard.some(function (a) { return a.url === b.data && a.status === 200; });
        return (s_[b.family] === 'ok' && fetched) ? '' : b.dir + ': ' + b.family + ' answered ' + short(s_[b.family] || (N.page && N.page.error) || 'nothing') + ', ' + b.data + ' fetched ' + fetched;
      });
    }, test.limit.quick);
    test.run('no data.js of its branch was asked that is not there (no 404)', 0.4, function () {
      if (!N.got) return 'no page asked: the world failed';
      return overAll(found, function (b) {
        const missed = N.heard.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404 && a.url.split('/').slice(-2, -1)[0] === b.family; });
        return !missed.length ? '' : b.dir + ': asked and missed: ' + short(missed);
      });
    }, test.limit.quick);
    // The box (goal/G43.7): "spirit.data.<name>.data" and "spirit.data.<name>.cache", on the page as in node.
    test.run('on the page, spirit.data under its branch has data and cache', 0.4, function () {
      if (!N.got) return 'no page asked: the world failed';
      const b_ = both();
      return overAll(found, function (b) { return b_[b.family] === true ? '' : b.dir + ': on the page spirit.data.' + b.family + ' lacks data or cache'; });
    }, test.limit.quick);
    // The node serves each one as a script that calls spirit.data.makeFamily (was data-caches.js, 6: "the shell can
    // introspect to find and download their clientCacheManagers.").
    test.run('the shell downloads its data.js', 0.4, async function () {
      if (!up()) return NO_NODE;
      const bad = [];
      for (const b of found) {
        const got = await fetch(N.node.base + '/' + b.data).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
        if (!(got.status === 200 && got.text.indexOf('.makeFamily(') !== -1)) bad.push(b.family + ': /' + b.data + ' answered ' + got.status);
      }
      return !bad.length || bad.join('; ');
    }, test.limit.quick);
  }
}

test.after(async function () {
  if (N.page && N.page.kid) try { N.page.kid.kill(); } catch (e) { /* gone */ }
  if (N.node) {
    try { if (N.node.child) N.node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (N.node.root) fs.rmSync(N.node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
});
}

// ── titleRules (was spirit/test/spirit-sibling-titleRules.js) ──────────────────────────────────────────────────────────────────────
function titleRules(ARGS) {

// spirit/run/spirit/test/spirit-sibling-titleRules.js [file or folder]
// EVERY TEST ONE test.run, ITS TITLE A PLAIN AND STEADY STRING, UNIQUE IN ITS SUITE, WITH ITS SEVERITY AND TIME LIMIT (goal/G45.3,
// goal/G47.2; spec: ./spirit-sibling-titleRules.md). The
// box: "every test's title is a plain string; it is steady, with no count, value, path or number built into it; and it is
// unique within its suite.", "Run on a folder, it judges that folder's suites alone, so each title item's red is this test
// on its own folder." A test's title is what failed when it is red, and the key it is kept by (goal/G45.1: "A test's key is
// its description, nothing else"), so a title that changes from run to run makes a new test each run.
//
//   node spirit/test/spirit-sibling-titleRules.js spirit/app/desk          every suite under that folder
//   node spirit/test/spirit-sibling-titleRules.js spirit/app/desk/desk.js  that production file's own suite
//   node spirit/test/spirit-sibling-titleRules.js spirit/test/data.js      that suite (a file in a test/ folder)
//   node spirit/test/spirit-sibling-titleRules.js                          every suite of the tree
//
// A suite is a .js file in a folder named test, not one of spirit/test/'s tools. A TEST is one call to the reporter,
// test.run(title, severity, body, limit) (goal/G47.2; Andy: "Every test inside every suite has its unique (within the
// suite) title. Every test supplies its severity", "One call per test, the reporter's"): its TITLE, the words it is kept by,
// is one plain string literal, quoted or a template with no ${}, so nothing in it can change between runs; its severity a
// number literal from 0.0 to 1.0; its time limit one of the reporter's named limits,
// test.limit.quick, .slow or .long, never a number of its own. A suite says its checks through
// test.run alone: a helper ok of its own, test.check, test.fail and test.reportSuccessFailureCount are the old ways
// (goal/G47.2: "No suite keeps a helper of its own that hands the reporter a title on a pass and other words on a fail").
// The code is read, comments out; the suite is never run. What a check found belongs in what its body answers, never its
// title. This test's own titles name no file and no count: those are its details.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }
// The tools of spirit/test/ are no suites (spirit/test/testModule.js TOOLS).
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];

// ── READING A SUITE'S CODE ──────────────────────────────────────────────────────────────────────────────────────────────
// The code with its comments blanked out, strings and regular expressions kept, every offset where it was.
function blankComments(src) {
  let out = '', i = 0, str = '', regex = false, cls = false, last = '';
  while (i < src.length) {
    const ch = src[i], nx = src[i + 1];
    if (str) {
      out += ch;
      if (ch === '\\') { out += nx || ''; i += 2; continue; }
      if (ch === str) str = '';
      i += 1; continue;
    }
    // A regular expression's body is blanked to x's of its length, so no comma or bracket in it splits a call's arguments.
    if (regex) {
      if (ch === '\\') { out += 'xx'; i += 2; continue; }
      if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) { regex = false; out += ch; i += 1; continue; }
      out += ch === '\n' ? '\n' : 'x';
      i += 1; continue;
    }
    if (ch === '/' && nx === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i += 1; } continue; }
    if (ch === '/' && nx === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; out += ch; i += 1; last = ch; continue; }
    // A slash opens a regular expression where a value is expected: after an operator, a bracket, a comma or a keyword.
    if (ch === '/' && (/[(,=:[!&|?{};+\-*%<>~^]$/.test(last) || last === '' || /\b(return|typeof|case|in|of)$/.test(out.replace(/\s+$/, "").slice(-8)))) { regex = true; cls = false; out += ch; i += 1; last = ch; continue; }
    out += ch;
    if (!/\s/.test(ch)) last = ch;
    i += 1;
  }
  return out;
}
// The arguments of the call whose ( is at open, each as written, split at its top-level commas.
function argsAt(code, open) {
  const args = [];
  let depth = 0, i = open, start = open + 1, str = '', tpl = [];
  for (; i < code.length; i++) {
    const ch = code[i];
    if (str) {
      if (ch === '\\') { i += 1; continue; }
      if (str === '`' && ch === '$' && code[i + 1] === '{') { tpl.push(depth); depth += 1; str = ''; i += 1; continue; }
      if (ch === str) str = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (ch === '}' && tpl.length && depth === tpl[tpl.length - 1]) { tpl.pop(); str = '`'; continue; }
      if (depth === 0) { args.push(code.slice(start, i).trim()); return args; }
      continue;
    }
    if (ch === ',' && depth === 1) { args.push(code.slice(start, i).trim()); start = i + 1; }
  }
  return args;
}
// One plain string literal: its value; anything else (joined, computed, a name, a template with ${}): null.
function plainValue(arg) {
  const a = String(arg || '').trim();
  if (/^'(?:[^'\\\n]|\\.)*'$/.test(a) || /^"(?:[^"\\\n]|\\.)*"$/.test(a)) { try { return JSON.parse('"' + a.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"').replace(/\\\\"/g, '\\"') + '"'); } catch (e) { return a.slice(1, -1); } }
  if (/^`[^`]*`$/.test(a) && a.indexOf('${') === -1) return a.slice(1, -1);
  return null;
}
// The code with every string's inside blanked, its length kept: a call is looked for there, so words inside a string
// (a planted suite, a page script sent to Chrome) are never taken for checks.
function blankStrings(code) {
  let out = '', str = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (str) {
      if (ch === '\\') { out += '  '; i += 1; continue; }
      if (ch === str) { str = ''; out += ch; continue; }
      out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') str = ch;
    out += ch;
  }
  return out;
}
// A plain number literal: its value; anything else: null.
// One of the reporter's named time limits (testReport.js test.limit; Andy, 2026-11-11: "i hope you have those as
// relatively central constants"): its name; a number of its own, or anything else: null.
function namedLimit(arg) { const m = /^test\.limit\.(quick|slow|long)$/.exec(String(arg || '').trim()); return m ? m[1] : null; }
function plainNumber(arg) { const a = String(arg || '').trim(); return /^\d+(\.\d+)?$|^\.\d+$/.test(a) ? Number(a) : null; }
// Every test in a suite's code, one test.run(title, severity, body, limitMs) each (goal/G47.2): { line, text (the title as
// written), value (when plain), severity, limit (when number literals) }.
function testsOf(src) {
  const code = blankComments(src);
  const bare = blankStrings(code);
  const out = [];
  const re = /\btest\.run\s*\(/g;
  let m;
  while ((m = re.exec(bare))) {
    const at = m.index + m[0].length - 1;
    const args = argsAt(code, at);
    if (args[0] === undefined) continue;
    out.push({ line: code.slice(0, at).split('\n').length, text: args[0].slice(0, 120), value: plainValue(args[0]), severity: plainNumber(args[1]), limit: namedLimit(args[3]) });
  }
  return out;
}
// The old ways of saying a check, each a reason a suite is not yet on test.run (goal/G47.2: "No suite keeps a helper of its
// own that hands the reporter a title on a pass and other words on a fail"): a helper ok of its own, test.check, test.fail,
// and test.reportSuccessFailureCount, the end the reporter now says itself.
function oldCallsOf(src) {
  const bare = blankStrings(blankComments(src));
  const out = [];
  const re = /\bfunction\s+ok\s*\(|\btest\.(check|fail|reportSuccessFailureCount)\s*\(/g;
  let m;
  while ((m = re.exec(bare))) out.push({ line: bare.slice(0, m.index).split('\n').length, text: m[0].replace(/\s*\($/, '') });
  return out;
}
// What a suite breaks: no test at all, an old call, a title not plain, a title said twice, a severity not a number from 0.0
// to 1.0, a time limit not a number of milliseconds.
function judge(src) {
  const titles = testsOf(src);
  const built = titles.filter(function (t) { return t.value === null; });
  const seen = Object.create(null);
  const twice = [];
  titles.forEach(function (t) { if (t.value === null) return; if (seen[t.value]) twice.push(t); else seen[t.value] = true; });
  const severity = titles.filter(function (t) { return t.severity === null || t.severity < 0 || t.severity > 1; });
  const limit = titles.filter(function (t) { return t.limit === null; });
  return { titles: titles, built: built, twice: twice, old: oldCallsOf(src), severity: severity, limit: limit };
}

// ── WHICH SUITES ────────────────────────────────────────────────────────────────────────────────────────────────────────
function tree() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    .filter(function (f) { try { return fs.statSync(path.join(RUN, f)).isFile(); } catch (e) { return false; } });
}
function isSuite(f) { return /\.js$/.test(f) && f.split('/').slice(0, -1).indexOf('test') !== -1 && TOOLS.indexOf(f) === -1 && !VENDORED_FOLDERS.holds(path.join(RUN, f)); }
function suitesFor(asked, files) {
  const all = files.filter(isSuite);
  if (!asked) return all;
  if (isSuite(asked)) return all.filter(function (f) { return f === asked; });
  if (/\.js$/.test(asked)) { const own = asked.replace(/([^/]+)$/, 'test/$1'); return all.filter(function (f) { return f === own; }); }
  const dir = asked.replace(/\/$/, '') + '/';
  return all.filter(function (f) { return f.indexOf(dir) === 0; });
}

// ── ITS OWN READING, ON SUITES PLANTED IN MEMORY ────────────────────────────────────────────────────────────────────────
const PLANTED = [
  "test.run('the count is one', 0.2, function () { return a === 1 || 'the count is ' + a; }, test.limit.quick);",
  "test.run(\"the field is shown\", 0.4, function () { return b; }, test.limit.quick);",
  "test.run(`the row is drawn`, 0.8, async function () { return c; }, test.limit.quick);",
  "test.run('the world: ' + n + ' scripts', 0.2, function () { return true; }, test.limit.quick);",
  "test.run(`found ${n} rows`, 0.2, function () { return true; }, test.limit.quick);",
  "test.run(words, 0.2, function () { return true; }, test.limit.quick);",
  "test.run('a call with commas inside its body', 0.2, function () { return g(x, [1, 2]); }, test.limit.quick);",
  "test.run('a regular expression with a comma', 0.2, function () { return /a,b/.test(s); }, test.limit.quick);",
  "test.run('a severity that is no number', high, function () { return true; }, test.limit.quick);",
  "test.run('a severity past one', 2, function () { return true; }, test.limit.quick);",
  "test.run('no time limit', 0.2, function () { return true; });",
  "test.run('a limit of its own number', 0.2, function () { return true; }, 1000);",
  "// test.run('a comment is no test', 0.2, function () { return true; }, test.limit.quick);",
  "test.run('the count is one', 0.2, function () { return true; }, test.limit.quick);",
  "function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }",
  "test.reportSuccessFailureCount();",
].join('\n');
const P = judge(PLANTED);
const values = P.titles.map(function (t) { return t.value; });
test.run('it finds every test of a planted suite, and none in a comment', 0.2, function () {
  return P.titles.length === 13 || 'found ' + short(P.titles.map(function (t) { return t.text; }));
}, test.limit.quick);
test.run('a quoted string and a plain template are plain titles', 0.2, function () {
  return (values[0] === 'the count is one' && values[1] === 'the field is shown' && values[2] === 'the row is drawn') || short(values.slice(0, 3));
}, test.limit.quick);
test.run('a joined string, a template with ${} and a bare name are built titles', 0.2, function () {
  return (P.built.length === 3 && P.built.every(function (t) { return /scripts|\$\{n\}|^words$/.test(t.text); })) || short(P.built.map(function (t) { return t.text; }));
}, test.limit.quick);
test.run('commas inside a body or a regular expression do not split its arguments', 0.2, function () {
  return (values.indexOf('a call with commas inside its body') !== -1 && values.indexOf('a regular expression with a comma') !== -1) || short(values);
}, test.limit.quick);
test.run('a title said twice in one suite is found', 0.2, function () {
  return (P.twice.length === 1 && P.twice[0].value === 'the count is one') || short(P.twice);
}, test.limit.quick);
test.run('a severity that is no number from 0.0 to 1.0 is found', 0.2, function () {
  return (P.severity.length === 2 && P.severity.every(function (t) { return /a severity that is no number|a severity past one/.test(t.text); })) || short(P.severity.map(function (t) { return t.text; }));
}, test.limit.quick);
test.run('a test with no time limit, or a number of its own, is found', 0.2, function () {
  return (P.limit.length === 2 && /no time limit/.test(P.limit[0].text) && /its own number/.test(P.limit[1].text)) || short(P.limit.map(function (t) { return t.text; }));
}, test.limit.quick);
test.run('a helper ok of its own, test.check, test.fail and reportSuccessFailureCount are found as old calls', 0.2, function () {
  return JSON.stringify(P.old.map(function (o) { return o.text; })) === JSON.stringify(['function ok', 'test.check', 'test.fail', 'test.reportSuccessFailureCount']) || short(P.old);
}, test.limit.quick);

// ── THE SUITES ASKED ────────────────────────────────────────────────────────────────────────────────────────────────────
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const SUITES = suitesFor(asked, tree());
const results = SUITES.map(function (f) { let src = ''; try { src = fs.readFileSync(path.join(RUN, f), 'utf8'); } catch (e) { src = ''; } return { file: f, r: judge(src) }; });
const first = function (list, part, show) { return short(list.slice(0, 4).map(function (x) { return x.file + ':' + show(x.r[part][0]); })); };
const count = function (list, part) { return list.reduce(function (n, x) { return n + x.r[part].length; }, 0); };

test.run('the world: there are suites to judge', 0.2, function () {
  return SUITES.length > 0 || 'no suite to judge in ' + (asked || 'the tree');
}, test.limit.quick);
test.run('every suite says its tests through test.run', 0.2, function () {
  const none = results.filter(function (x) { return !x.r.titles.length; });
  return !none.length || none.length + ' of ' + SUITES.length + ' suites hold no test.run; the first: ' + short(none.slice(0, 6).map(function (x) { return x.file; }));
}, test.limit.slow);
test.run('no suite keeps an old way of saying a check', 0.2, function () {
  const old = results.filter(function (x) { return x.r.old.length; });
  return !old.length || count(old, 'old') + ' in ' + old.length + ' suites; the first: ' + first(old, 'old', function (o) { return o.line + ' ' + o.text; });
}, test.limit.slow);
test.run('every title is one plain string, nothing built into it', 0.2, function () {
  const built = results.filter(function (x) { return x.r.built.length; });
  return !built.length || count(built, 'built') + ' in ' + built.length + ' suites; the first: ' + first(built, 'built', function (t) { return t.line + ' ' + t.text; });
}, test.limit.slow);
test.run('no suite says one title twice', 0.2, function () {
  const twice = results.filter(function (x) { return x.r.twice.length; });
  return !twice.length || count(twice, 'twice') + ' in ' + twice.length + ' suites; the first: ' + first(twice, 'twice', function (t) { return t.line + ' ' + t.value; });
}, test.limit.slow);
test.run('every test gives its severity, a number from 0.0 to 1.0', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.severity.length; });
  return !bad.length || count(bad, 'severity') + ' in ' + bad.length + ' suites; the first: ' + first(bad, 'severity', function (t) { return t.line + ' ' + t.text; });
}, test.limit.slow);
test.run('every test gives its time limit, one of the reporter\'s named limits', 0.2, function () {
  const bad = results.filter(function (x) { return x.r.limit.length; });
  return !bad.length || count(bad, 'limit') + ' in ' + bad.length + ' suites; the first: ' + first(bad, 'limit', function (t) { return t.line + ' ' + t.text; });
}, test.limit.slow);
}

// ── noFuckingGarbage (was spirit/test/spirit-sibling-noFuckingGarbage.js) ────────────────────────────────────────────────────────────────
function noFuckingGarbage(ARGS) {

// spirit/run/spirit/test/spirit-sibling-noFuckingGarbage.js [file]
// NO GARBAGE IN A TEST FOLDER (goal/G43.27, spec: ./spirit-sibling-noFuckingGarbage.md). Andy: "fucking wsl now is
// starting to motherfucking put tests into the run:/ folder that are NOT bound by the fucking product test system: A NEW
// FUCKING WAY TO INTRODUCE GARBAGE AND STALE SHIT!!!!!!!!!!!!!!!!!", "wsl: add a general test:
// spirit-sibling-noFuckingGarbage tests.... thing...", and "wsl: every test in run:/ MUST MATCH a production file.". Its name is its reach (./TEST_SYSTEM.md): a -sibling- test named
// after spirit.js judges every tracked file in a test/ folder of spirit/run/ and below.
//
// Every file in a test/ folder is bound by the product test system (./TEST_SYSTEM.md, "Where they live"), or it is red:
//   1. a test/ folder belongs to a module: its parent folder holds a .js module;
//   2. spirit/test/ holds, beside the tests of spirit/'s modules, the test system's tools (testModule.js's TOOLS) and
//      TEST_SYSTEM.md (goal/G43.32, Q2; Andy: "We need special rules for run://spirit/test/  it will be where
//      run://spirit/app/test/ finds it's main tools."): tools, not tests named after no module;
//   3. a test/ inside a test/ folder holds the tests of the files beside it, <name>.js and its .md;
//   4. every other test MATCHES A PRODUCTION FILE: test/<name>.js, or a general test <name>-child-* or <name>-sibling-*, of a
//      <name>.js beside the folder; a plain test named after no module is garbage (Andy, above). ONE TEST FILE PER SCRIPT
//      (goal/G45.1, ./TEST_SYSTEM.md; Andy: "there is ONE FUCKING test file in the test folder per script file, and every
//      fucking test that applies to that file must be inserted in the that one file"): a test/<name>-<what>.js is red;
//   5. a test's .js has its .md beside it, and an .md its .js;
//   6. any other file (a laid page, a fixture) is named after a module beside the folder: <module>-<what>.<ext>.
//
// What it judges, by the file it is handed (testModule.js hands each module in its reach, ./TEST_SYSTEM.md):
//   spirit/spirit.js, the module it is named after, or none: every tracked file in a test/ folder under spirit/run, so
//     garbage named after no module is told once, under spirit.js;
//   another module: the files of the test/ folder beside it that are named after it (its test, its spec, its fixtures);
//   a file in a test folder: that one.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const arg = String(ARGS[0] || '');
const RULE = 'Andy: "every test in run:/ MUST MATCH a production file."';
// The tools of spirit/test/ are testModule.js's one list, and TEST_SYSTEM.md is their document.
// The special general tests (testModule.js's SPECIAL, goal/G47.1, box v94, 1) are kept too, each with its .md.
const TM = require(path.join(__dirname, 'testModule.js'));
const SPIRIT_TEST_KEEPS = TM.TOOLS.concat(['spirit/test/TEST_SYSTEM.md'], TM.SPECIAL || [], (TM.SPECIAL || []).map(function (f) { return f.replace(/\.js$/, '.md'); }));

function inTestFolder(rel) { return /(^|\/)test\/[^/]+$/.test(rel) && !VENDORED_FOLDERS.holds(rel); }
function exists(rel) { return fs.existsSync(path.join(RUN, rel)); }
// The .js modules a folder holds ('' is the run root).
function modulesIn(dir) {
  try { return fs.readdirSync(path.join(RUN, dir)).filter(function (n) { return /\.js$/.test(n) && fs.statSync(path.join(RUN, dir, n)).isFile(); }).map(function (n) { return n.slice(0, -3); }); } catch (e) { return []; }
}

// Why a file of a test folder is garbage, or '' when the test system binds it.
function garbage(rel) {
  const at = rel.lastIndexOf('test/');
  const dir = rel.slice(0, at).replace(/\/$/, '');          // the folder the test/ folder sits in
  const file = rel.slice(at + 'test/'.length);
  const m = file.match(/^(.+)\.(js|md)$/);
  const stem = m ? m[1] : '';
  const twin = m ? rel.slice(0, -m[2].length) + (m[2] === 'js' ? 'md' : 'js') : '';
  const general = stem.match(/^(.+?)-(child|sibling)-.+$/);
  // test/<name>-<what>.js: a second test file of <name>.js, which one test file per script forbids (goal/G45.1).
  const named = !general && stem.indexOf('-') > 0 ? stem.slice(0, stem.indexOf('-')) : '';
  const second = function () { return 'a second test file of ' + named + '.js: one test file per script, its tests go into test/' + named + '.js'; };
  // 2. spirit/test/'s tools and their document.
  if (SPIRIT_TEST_KEEPS.indexOf(rel) !== -1) return '';
  // 3. A test folder inside a test folder: the tests of the files beside it, nothing else.
  if (/(^|\/)test$/.test(dir)) {
    if (!m) return 'not a test: no .js or .md';
    if (!exists(dir + '/' + stem + '.js') && named && exists(dir + '/' + named + '.js')) return second();
    if (!exists(dir + '/' + stem + '.js')) return 'no ' + dir + '/' + stem + '.js beside this test folder: a test here tests a file of ' + dir + '/, and no other';
    return exists(twin) ? '' : (m[2] === 'js' ? 'no ' + path.basename(twin) + ' beside it: the test has no spec' : 'no ' + path.basename(twin) + ' beside it: a spec with no test');
  }
  // 1. A test folder belongs to a module.
  const modules = modulesIn(dir);
  if (!modules.length) return 'no module in ' + dir + '/: a test folder belongs to the module beside it';
  // 4. A test matches a production file; 5. a test and its spec, together.
  if (m) {
    if (!general && modules.indexOf(stem) === -1 && named && modules.indexOf(named) !== -1) return second();
    const of = general ? general[1] : stem;
    if (modules.indexOf(of) === -1) return 'no ' + (dir ? dir + '/' : '') + of + '.js: ' + (general ? 'a general test of a module that is not beside the folder' : 'a test that matches no production file');
    return exists(twin) ? '' : (m[2] === 'js' ? 'no ' + path.basename(twin) + ' beside it: the test has no spec' : 'no ' + path.basename(twin) + ' beside it: a spec with no test');
  }
  // 6. A laid page or a fixture, named after a module beside the folder.
  const owner = modules.filter(function (n) { return file.indexOf(n + '-') === 0; })[0];
  return owner ? '' : 'named after no module beside the folder: a fixture is <module>-<what>.<ext>';
}

const tracked = function () {
  return execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return inTestFolder(f) && exists(f); });
};
const handed = arg ? path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/') : '';
const WHOLE = !handed || handed === 'spirit/spirit.js';
const MODULE = !WHOLE && /\.js$/.test(handed) && !inTestFolder(handed) && exists(handed);
let judged = null;
function read() {
  let files = [];
  if (WHOLE) files = tracked();
  else if (MODULE) {
    const own = handed.replace(/([^/]+)\.js$/, 'test/$1');
    files = tracked().filter(function (f) { return f === own + '.js' || f === own + '.md' || f.indexOf(own + '-') === 0; });
  } else files = [handed];
  judged = files.filter(inTestFolder);
  test.comment(judged.length + ' files in test folders read');
  return judged;
}
// every file in a test folder
// The world, as the file handed says what is judged: the whole tree, one module's test files, or one file.
if (WHOLE) {
  test.run('the scan read every test folder, more than a hundred files', 0.2, function () {
    return read().length > 100 || 'the scan read only ' + judged.length + ' files: it judged too little to say';
  }, test.limit.quick);
} else if (MODULE) {
  test.run('the module handed has test files of its own, and they are read', 0.2, function () {
    return read().length > 0 || handed + ' has no test of its own: nothing judged';
  }, test.limit.quick);
} else {
  test.run('the file handed is in a test folder', 0.2, function () {
    return read().length === 1 || arg + ' is neither a module nor a tracked file in a test folder: nothing judged';
  }, test.limit.quick);
}
// MISSING TESTS (goal/G47.1, the box: "spirit-sibling-noFuckingGarbage also reports missing tests, in one check, \"every
// production script has its own test\", severity 0.2: red while any production script has no own test, test/<name>.js
// beside it, its answer naming every script missing one. Over the whole tree (handed nothing, or spirit.js) it judges every
// production script; handed one script, that one", "Vendored scripts are left out of the check"; Andy: "damn right, every
// missing script-companion-suite is a red at 0.2"). One check, not one per script: titles are fixed words (goal/G47.2).
// A production script: a tracked .js in no test/ folder at any depth, vendored code left out. Handed a file in a test
// folder, there is no script to judge, and the check is not made.
const isProduction = function (rel) { return /\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel) && exists(rel); };
const ownTestOf = function (rel) { return rel.replace(/([^/]+)\.js$/, 'test/$1.js'); };
if (WHOLE || MODULE) {
  test.run('every production script has its own test', 0.2, function () {
    const scripts = WHOLE ? execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean).filter(isProduction) : [handed];
    if (!scripts.length) return 'no production script found: nothing judged';
    const missing = scripts.filter(function (rel) { return !exists(ownTestOf(rel)); });
    test.comment(scripts.length + ' production scripts judged, ' + missing.length + ' without their own test');
    return !missing.length || missing.length + ' of ' + scripts.length + ' have no own test: ' + missing.join(', ');
  }, test.limit.quick);
}

// THE THREE KINDS OF GENERAL TEST (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general tests, at any
// level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js, <file>-<child | sibling>-browser.js",
// "existing general tests fold into the appropriate of the 3 new general test name-formats"). A general test is a script in
// a test folder named <file>-child-... or <file>-sibling-...; each one read is one of the three, its .md beside it the same.
const KINDS = /^[^/]+-(child|sibling)-(general|node|browser)\.(js|md)$/;
test.run('every general test is <file>-<child | sibling>-<general | node | browser>.js, and no other', 0.4, function () {
  if (!judged || !judged.length) return 'no file in a test folder read: nothing judged';
  const general = judged.filter(function (rel) { return /-(child|sibling)-/.test(path.posix.basename(rel)); });
  const other = general.filter(function (rel) { return !KINDS.test(path.posix.basename(rel)); });
  return !other.length || other.length + ' general tests of another name: ' + other.join(', ');
}, test.limit.quick);

// Each file that is garbage named in the answer, by its path and why.
test.run('every file in a test folder matches a production file: none is garbage', 0.4, function () {
  if (!judged || !judged.length) return 'no file in a test folder read: nothing judged';
  const bad = judged.map(function (rel) { const why = garbage(rel); return why ? rel + ': garbage, ' + why + ' (' + RULE + ')' : ''; }).filter(Boolean);
  return !bad.length || bad.join('; ');
}, test.limit.quick);
}

// ── searchRules (was spirit/test/spirit-sibling-searchRules.js) ─────────────────────────────────────────────────────────────────────
function searchRules(ARGS) {

// spirit/run/spirit/test/spirit-sibling-searchRules.js <file>
// THE SEARCH RULE OF A MODULE (goal/G41.28), run once per file it judges, the file its argument, as
// ./spirit-sibling-generalRules.js is for a module (spec: ./spirit-sibling-searchRules.md). Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every module in spirit/run/ and below, a server and a
// page alike (goal/G47.1: no opting in).
//
// THE WHOLE ROW, NEVER A FEW FIELDS. Andy, box v15: "a probability search of a dataBase table must ALWAYS search the
// whole bloody ROW, as it is served through a single-row \"get\", using a probabilityStringObjectMatch.", and "the
// ServerSide of probability Search is NOT searching the whole row of the object." A module that hands
// probabilityStringObjectMatch an object it writes out on the spot, { id, title, box }, picks the fields it searches; one
// that hands it the row searches the row. Judged in its code, comments left out: no call of probabilityStringObjectMatch
// whose object is an object literal. Each call that breaks it is named by its line.
//
// Given no file, it judges every module testModule.js gives it, each its own check, named by its path.
// It stands in spirit/test/ beside spirit/spirit.js since goal/G43.32, so testModule.js hands it every module in spirit/
// and below (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const arg = String(ARGS[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}

// The code without its comments, kept line for line so a call is named by its line.
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (c) { return c.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}
// Every call of probabilityStringObjectMatch whose second argument is an object literal: the fields picked by hand.
function picked(file) {
  const src = code(file);
  const out = [];
  const re = /\bprobabilityStringObjectMatch\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    // Past the first argument: the comma at depth 0 after the opening parenthesis.
    let depth = 0; let i = re.lastIndex; let comma = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) { comma = i; break; }
    }
    if (comma === -1) continue;
    const rest = src.slice(comma + 1).replace(/^\s+/, '');
    if (rest[0] === '{') out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}
// What breaks the rule in one module, or '' when every search it makes takes the row whole.
function judge(rel, file) {
  const lines = picked(file);
  return !lines.length ? '' : rel + ': it hands probabilityStringObjectMatch fields it picks, at line' + (lines.length > 1 ? 's ' : ' ') + lines.join(', ') + ', in place of the row as its get serves it';
}

// The modules it judges: the one handed, or every module testModule.js gives it.
let reach = null;
test.run('the world: there is a module to judge', 0.2, function () {
  if (arg && !full) return 'no module to judge: ' + JSON.stringify(arg);
  if (full) { reach = [path.relative(RUN, full).split(path.sep).join('/')]; return true; }
  reach = require(path.join(RUN, 'spirit', 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'spirit/test/spirit-sibling-general.js' && t.file; }).map(function (t) { return t.file; });
  test.comment('every module in its reach: ' + reach.length);
  return reach.length > 0 || 'testModule.js gives it no file to judge';
}, test.limit.quick);
// <file>: its searches match the whole row. Given no file, each module that breaks it is named in the answer.
test.run('it hands every search the row whole', 0.4, function () {
  if (!reach || !reach.length) return 'no module to judge: the world failed';
  const bad = reach.map(function (f) { return judge(f, path.join(RUN, f)); }).filter(Boolean);
  return !bad.length || bad.join('; ');
}, test.limit.quick);
}

// ── testReachRules (was spirit/test/spirit-sibling-testReachRules.js) ──────────────────────────────────────────────────────────────────
function testReachRules(ARGS) {

// spirit/run/spirit/test/spirit-sibling-testReachRules.js [file]
// NO PRODUCTION MODULE LOADS A TEST FILE (goal/G41.30, spec: ./spirit-sibling-testReachRules.md). The box: "1) no
// production module loads or requires any test file, with the exception of DEBUG.js." Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every production module in spirit/run/ and below.
//
// Judged in the code, comments left out: no require(), import(), spirit.require(), readFileSync() or createReadStream()
// of a path into a test/ folder. A path is read from the call's own text, its string pieces joined as path.join joins
// them, so path.join(__dirname, 'test', 'x.js') is caught as 'test/x.js' is. Running a suite as its own process (spawn,
// execFile, fork) loads nothing into the module, and is not asked: the desk and its verifier run suites by their path.
// DEBUG.js (spirit/DEBUG.js and spirit/DEBUG/) is the one exception. Each call that breaks it is its own check, named
// by its file and line.
//
// Given a file, it judges that one; given none, every tracked production .js file under spirit/run. It stands in
// spirit/test/ beside spirit/spirit.js since goal/G43.32 (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const arg = String(ARGS[0] || '');
// WHAT FITS (box v94, 2): a production file; a file in a test folder is no module this rule judges.
if (/(^|\/)test\//.test(arg.replace(/\\/g, '/'))) return;

// A production file: tracked, .js, not inside a test folder (spirit/test/'s tools included), no vendor code.
function production(rel) {
  return /\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel);
}
// THE ONE EXCEPTION (the box: "with the exception of DEBUG.js"): its test routes serve a test folder's pages.
function excepted(rel) { return rel === 'spirit/DEBUG.js' || rel.indexOf('spirit/DEBUG/') === 0; }

// The code with its comments blanked, line breaks kept, so a line number stays a line number. Strings are kept whole.
function code(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
// The text of a call's parentheses, from the ( after its name, balanced, at most 400 characters.
function argsAt(text, open) {
  let depth = 0;
  for (let i = open; i < text.length && i < open + 400; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return text.slice(open + 1, open + 400);
}
// The path a call's arguments name: its string pieces joined with '/', as path.join joins them.
function pathIn(args) {
  const pieces = [];
  const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;
  let m;
  while ((m = re.exec(args))) pieces.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return pieces.join('/').replace(/\/+/g, '/');
}
const LOADS = /\b(require|import|readFileSync|createReadStream|readFile)\s*\(/g;
// The calls of one file that load a path into a test folder: [{ line, call, path }].
function reaches(rel) {
  const text = code(fs.readFileSync(path.join(RUN, rel), 'utf8'));
  const out = [];
  let m;
  LOADS.lastIndex = 0;
  while ((m = LOADS.exec(text))) {
    const named = pathIn(argsAt(text, m.index + m[0].length - 1));
    if (/(^|\/)test(\/|$)/.test(named)) out.push({ line: text.slice(0, m.index).split('\n').length, call: m[1], path: named });
  }
  return out;
}

let judged = null;
function read() {
  let files = [];
  if (arg) {
    const rel = path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/');
    files = [rel];
  } else {
    files = execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return production(f) && fs.existsSync(path.join(RUN, f)); });
  }
  judged = files.filter(function (f) { return !excepted(f); });
  test.comment(judged.length + ' production files read; the exception: DEBUG.js (spirit/DEBUG.js, spirit/DEBUG/)');
  return judged;
}
// every production module, its code read
if (!arg) {
  test.run('the scan read every production module, more than a hundred files', 0.2, function () {
    return read().length > 100 || 'the scan read only ' + judged.length + ' files: it judged too little to say';
  }, test.limit.quick);
}
// Each call that breaks it named in the answer, by its file and line.
test.run('no production module loads or requires a test file', 0.4, function () {
  if (!judged) read();
  const bad = [];
  judged.forEach(function (rel) {
    reaches(rel).forEach(function (r) {
      bad.push(rel + ':' + r.line + ' ' + r.call + '() loads ' + r.path + ', a test file (the box: "no production module loads or requires any test file, with the exception of DEBUG.js.")');
    });
  });
  return !bad.length || bad.join('; ');
}, test.limit.quick);
}

// ── generalRules (was spirit/test/spirit-sibling-generalRules.js; its node part is spirit-sibling-node.js, its page part spirit-sibling-browser.js) ──
function generalRules(ARGS) {

// spirit/run/spirit/test/spirit-sibling-generalRules.js <file>
// THE GENERAL RULES OF A MODULE, A SHELL APP OR AN ELEMENT (goal/G41.18; the module rules of goal/G40.6 folded in from
// spirit-child-generalRules.js, goal/G47.1), run once per file it judges, the file its argument (spec:
// ./spirit-sibling-generalRules.md). ITS NAME IS ITS REACH
// (./TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a -sibling-
// test beside spirit.js judges every module in spirit/run/ and below (goal/G47.1: no opting in), shell/ and the agent tables'
// pages alike (goal/G41.27; Andy: "1. The checks judge every module under spirit/run/: the test is
// spirit/run/test/spirit-sibling-generalRules.js instead of shell-child. No page moves; one test covers shell/ and the
// agent tables alike."). It was shell/test/boot-sibling-generalRules.js, its reach shell/ and hung on shell/boot.js. Andy: "we may require a
// ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing, THAT's were a general
// test belongs"; "shell-child-generalRules.js can also run headless chrome test to assert UI standards..."; "who says it
// shouln't check general \"mountability\" of elements and apps?", "mount each element or app all by itself, to \"unit\"
// tests?"; "add that test: shell-child-generalRules.js". Each file is its own test id; a rule a file breaks fails that
// file's test.
// DISCREPANCY WITH ANDY's RULES: the reach above runs once per file (goal/G41.19, goal/G43.2); since goal/G43.18 moved
// spirit.js to spirit/run/spirit/spirit.js, testModule.js no longer counts this as a general test (./TEST_SYSTEM.md). It
// is run once with no file, every() below finds no file in its reach, and it goes red with "testModule.js gives it no
// file to judge" after its icon-loading checks.
//
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, ../spirit/test/DEBUG.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
// Its arguments: the file it judges, if any; the verifier's --verify-port <n> is the reporter's, and passed on.
const VERIFY = ARGS.indexOf('--verify-port') !== -1 ? ARGS.slice(ARGS.indexOf('--verify-port'), ARGS.indexOf('--verify-port') + 2) : [];
const arg = String(ARGS.filter(function (a) { return VERIFY.indexOf(a) === -1; })[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
// EVERY TEST NAME STARTS WITH THE PATH (goal/G41.19; Andy: "please start the test descriptions always with the exact URL
// to the server, without \"/DEBUG\" service", and, box v13, "EVERY MOTHERFUCKING TEST NAME in the product three STARTS
// WITH THE MUTHERCUCKING PATH"): each section is named by the address this file's page is opened at, /DEBUG left off.
const ADDRESS = '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html';
const NAMED = ADDRESS.slice('/DEBUG'.length);
// WHAT IS MOUNTED IS KNOWN BY ITS PATH (goal/G41.19, box v17; Andy: "the test knows bloody fucking well if a scripts is
// an app (from the path pattern), why the fuck would would it need manifests for standard patterns?",
// "the test knows fucking well, which are elements scripts in ./shell/js/"): an app is shell/<app>/<app>.js, an element any script
// under spirit/element/. Anything else in its reach is neither, and is not mounted.
// THE AGENT TABLES' PAGES (goal/G41.27; Andy, Q5: "it covers them, too"): the tables' shared element, its row editor
// (goal/G41.28) and each table's list and editor live in spirit/app/agent/table/ since goal/G43.12, which no pattern below
// matches; there they are neither, and are not mounted. spirit/app/agent/agent.js is an element by the new-folder rule.
// WHAT IS A PAGE MODULE (goal/G43.32; Andy: "helpers with no create are no fucking elements. they live in require.
// element scripts place their factories in spirit.element.<their path>"): a file is mounted when its own code places its
// factory by installSpiritElement; a switch (agent.js), a server or a helper is not. Read from the file, not guessed from
// its path.
function kindOf(file) {
  const f = String(file || '');
  if (!/^spirit\/.+\.js$/.test(f) || /(^|\/)test\//.test(f)) return '';
  if (f === 'spirit/element/installSpiritElement.js') return '';
  try { return /\binstallSpiritElement\s*\(/.test(codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true)) ? 'element' : ''; } catch (e) { return ''; }
}
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/agent/node.json (spirit/job.js).
const SERVERS = { servers: ['agent'] };
// A REDRAW PROVED IN THE PAGE'S OWN TEST (Andy, Q24, "yes."): a page whose watch draws only for an item open, which a
// bare mount never has; its own test's check, by its words, stands for it here.
const OWN_PROOF = {
  'spirit/app/desk/element/deskDetails/deskDetails.js': { test: 'spirit/app/desk/element/deskDetails/test/deskDetails.js', check: 'a verifier publish taken into spirit.data redraws the run' },
  // Join draws only the join news on the spirit job, which a marked row in the jobs or the contacts cannot change (Andy,
  // goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you ruled for deskDetails in Q24?"). The
  // Join app is joinList mounted, so its page takes the same proof.
  'spirit/element/joinList.js': { test: 'spirit/element/test/joinList.js', check: 'a new join on the spirit job, taken into spirit.data, redraws the steps' },
  'spirit/app/join/element.js': { test: 'spirit/element/test/joinList.js', check: 'a new join on the spirit job, taken into spirit.data, redraws the steps' },
};
// THE LONGEST FIELD THE RULES ALLOW (spirit/fieldRules.js): a field that keeps more than this holds no rule at all.
const FIELD_RULES = require(path.join(RUN, 'spirit', 'fieldRules.js'));
const MOST_BYTES = Math.max.apply(null, Object.keys(FIELD_RULES).filter(function (k) { return /MAX_BYTES$/.test(k) && typeof FIELD_RULES[k] === 'number'; }).map(function (k) { return FIELD_RULES[k]; }));
// THE PAGE WATCHED FROM BEFORE ITS FIRST SCRIPT (goal/G41.27): put on the page ahead of spirit.js, it keeps what the
// rules below are judged by, each call known by the file whose code made it (a module runs with its path as its
// sourceURL). Spirit's own code is spirit.js, its families (spirit-interface/), spirit/client/ and the page's data set
// (spirit/data.js); shell/boot.js, the face's own transport, is the one exception the network rule names
// (Andy: "boot.js MUST be an exception to the rules.").
//   net:   every fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon, with the file that made it;
//   subs:  every spirit.event.subscribe and spirit.data.watchPath (a family view's, spirit.data.viewAt(node, family).watch, among them), live until let go, and whether a module made it;
//   writes: every call to the node a module made that changes something (not the stream or an interface, no read op,
//           no read verb);
//   moved: what the box changed while a write was out, other than a busy mark, a button's disabled state or fine print.
const WATCH = String.raw`(function () {
  var W = window.spiritWatch = { net: [], subs: [], writes: [], moved: [], out: 0, searches: [] };
  var SPIRIT = /(\/spirit\.js|spirit-interface\/|spirit\/client\/|spirit\/data\.js|shell\/boot\.js)$/;
  function frames() { return String(new Error().stack || '').split('\n').slice(1).map(function (l) { return l.trim(); }).filter(function (l) { return l.indexOf('spiritWatch.js') === -1 && /^at /.test(l); }); }
  function file(f) { var m = /\(?([^()\s]+?):\d+:\d+\)?$/.exec(f); return m ? m[1].replace(/^https?:\/\/[^/]+/, '') : ''; }
  function spirits(f) { return SPIRIT.test(file(f)); }
  function caller() { var f = frames()[0] || ''; return { file: file(f), spirit: spirits(f) }; }
  function moduleMade() { return frames().some(function (f) { var x = file(f); return !!x && !SPIRIT.test(x); }); }
  var READ_OPS = ['search', 'get', 'list', 'status', 'card', 'read', 'tree', 'history'];
  var READ_VERB = /\.(search|get|list|status|card|read|tree|history|load|loadFile|ls|stat)$/;
  function isWrite(body) {
    var b = null; try { b = JSON.parse(String(body || '')); } catch (e) { return null; }
    // Spirit's own asks are no write: the stream (event.subscribe) and a family's interface (api).
    if (!b || typeof b.call !== 'string' || b.call === 'event.subscribe' || b.call === 'api') return null;
    var op = b.args && b.args.op;
    if (op ? READ_OPS.indexOf(String(op)) !== -1 : READ_VERB.test(b.call)) return null;
    return b.call + (op ? ' ' + op : '');
  }
  // A PRESS WATCHED: from the press until the node has answered every write it sent; judged only when it sent one.
  var watching = null; var buf = []; var w0 = 0;
  function allowed(r) {
    var t = r.target && r.target.nodeType === 1 ? r.target : r.target && r.target.parentElement;
    if (!t) return true;
    if (r.type === 'attributes' && t.tagName === 'BUTTON' && /^(disabled|aria-busy|class)$/.test(r.attributeName)) return true;
    var nodes = [t].concat(Array.prototype.slice.call(r.addedNodes || []), Array.prototype.slice.call(r.removedNodes || []));
    if (nodes.every(function (n) { return n.nodeType === 1 ? (n.classList.contains('shell-busy') || !!n.closest('.shell-busy')) : !!(t.closest && t.closest('.shell-busy')); })) return true;
    return !!(t.closest && t.closest('.job-manifest-note, .job-start-error, .job-refusal, .fine-print'));
  }
  function chain(el) { var box = window.spiritMount && window.spiritMount.box; var parts = []; for (var n = el; n && n !== box && n.tagName; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '')); } return parts.join(' > '); }
  function stop() { if (!watching) return; buf = buf.concat(watching.takeRecords()); watching.disconnect(); watching = null; }
  function opened() { W.out += 1; }
  function closed() { W.out = Math.max(0, W.out - 1); if (!W.out && W.writes.length > w0) stop(); }
  W.press = function (i) {
    var box = window.spiritMount && window.spiritMount.box;
    var b = box && Array.prototype.slice.call(box.querySelectorAll('button')).filter(function (x) { return x.isConnected && !x.disabled && x.getClientRects().length; })[i];
    if (!b) return false;
    stop(); buf = []; w0 = W.writes.length;
    watching = new MutationObserver(function (list) { buf = buf.concat(list); });
    watching.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
    try { b.click(); } catch (e) { /* its own fault, judged above */ }
    return true;
  };
  W.settle = function () {
    stop();
    if (W.writes.length > w0) buf.forEach(function (r) { if (!allowed(r)) W.moved.push(r.type + ' ' + chain(r.target.nodeType === 1 ? r.target : r.target.parentElement)); });
    buf = [];
    return W.out;
  };
  var realFetch = window.fetch;
  window.fetch = function (url, o) {
    W.net.push(Object.assign({ kind: 'fetch', url: String(url) }, caller()));
    // A write is the module's: made with its code on the way, spirit carrying it.
    var w = moduleMade() ? isWrite(o && o.body) : null;
    if (!w) return realFetch.apply(this, arguments);
    W.writes.push(w); opened();
    return realFetch.apply(this, arguments).then(function (r) { setTimeout(closed, 0); return r; }, function (e) { setTimeout(closed, 0); throw e; });
  };
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) { W.net.push(Object.assign({ kind: 'XMLHttpRequest', url: String(url) }, caller())); return xo.apply(this, arguments); };
  ['WebSocket', 'EventSource'].forEach(function (k) { var C = window[k]; if (!C) return; window[k] = function (url) { W.net.push(Object.assign({ kind: k, url: String(url) }, caller())); return new (Function.prototype.bind.apply(C, [null].concat(Array.prototype.slice.call(arguments))))(); }; window[k].prototype = C.prototype; });
  if (navigator.sendBeacon) { var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (url) { W.net.push(Object.assign({ kind: 'sendBeacon', url: String(url) }, caller())); return sb.apply(null, arguments); }; }
  function kept(kind, fn) {
    return function () {
      var s = { kind: kind, mine: moduleMade(), live: true, path: kind === 'data.watch' ? String(arguments[0] || '') : '' }; W.subs.push(s);
      var off = fn.apply(this, arguments);
      return function () { s.live = false; return typeof off === 'function' ? off.apply(this, arguments) : undefined; };
    };
  }
  // EVERY SEARCH THE PAGE MAKES, as it is made (goal/G41.28): its spirit.data branch, and whether it ranks rows of its own.
  function searches(els) {
    if (!els || typeof els !== 'object' || els.__searched) return;
    try { Object.defineProperty(els, '__searched', { value: true }); } catch (e) { return; }
    // The search element stands at its path since goal/G43.32, spirit.element.spirit.element.search: every step of the path
    // is followed as it is made, and the element wrapped when it is placed or read.
    function along(o, keys, done) {
      if (!o || typeof o !== 'object') return;
      var k = keys[0];
      var last = keys.length === 1;
      var at = o[k];
      function took(v) { if (last) done(v); else along(v, keys.slice(1), done); }
      try { Object.defineProperty(o, k, { configurable: true, enumerable: true, get: function () { if (last) done(at); return at; }, set: function (v) { at = v; took(v); } }); } catch (e) { /* kept as it is */ }
      if (at) took(at);
    }
    function wrap(v) { if (v && typeof v.create === 'function' && !v.create.__kept) { var c = v.create; v.create = function (host, o) { var x = o || {}; W.searches.push({ data: typeof x.data === 'string' ? x.data : '', rows: typeof x.rows === 'function', verb: String(x.verb || ''), face: String(x.face || 'pane') }); (window.spiritSearchHosts = window.spiritSearchHosts || []).push(host); return c.apply(this, arguments); }; v.create.__kept = true; } }
  // WHAT IT WATCHES, IT DRAWS FROM: a marked row written into each spirit.data path the module watches, and whether its
  // box changed for it within a second. A watch path is by server node first (goal/G41.28): '<node>/<family>/<branch>',
  // a branch, or '<node>/<family>/<branch>/<row>', a row; a watch of the home node holds '~' for the node, the page's
  // own node (data.home()) once it knows it.
  W.probe = function () {
    var D = window.spirit && window.spirit.data;
    var box = window.spiritMount && window.spiritMount.box;
    var paths = []; W.subs.forEach(function (x) { if (x.mine && x.live && x.kind === 'data.watch' && x.path && paths.indexOf(x.path) === -1) paths.push(x.path); });
    if (!D || !box || typeof D.setPath !== 'function') return Promise.resolve([]);
    // A box that shows nothing (a selector hidden until its family is chosen) has nothing to redraw: not judged.
    var shown = Array.prototype.some.call(box.querySelectorAll('*'), function (el) { return el.getClientRects().length > 0; });
    if (!shown) return Promise.resolve(paths.slice(0, 6).map(function (p) { return { path: p, hidden: true }; }));
    return paths.slice(0, 6).reduce(function (chain, p, i) {
      return chain.then(function (out) {
        var real = p.charAt(0) === '~' && typeof D.homeNode === 'function' ? D.homeNode() + p.slice(1) : p;
        var parts = real.split('/');
        // A row's path names its row; a branch's gets a marked row of its own; a family's whole watch, a branch of its own.
        var whole = parts.length >= 4 && parts[3] !== '';
        var at = whole ? real : parts.length >= 3 && parts[2] !== '' ? parts.slice(0, 3).join('/') + '/zz-probe-' + i : parts.slice(0, 2).join('/') + '/zz-probe/zz-probe-' + i;
        var before = whole && typeof D.getPath === 'function' ? D.getPath(at) : undefined;
        var mark = 'zzprobe' + i;
        var changed = 0;
        var mo = new MutationObserver(function (l) { changed += l.length; });
        mo.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
        // A row that is there keeps its shape, each of its text fields marked, so a reader that checks its fields still
        // takes it; a new row is the marked fields alone.
        var probe = { key: whole ? undefined : 'zz-probe-' + i, label: mark, name: mark, title: mark, text: mark, id: whole ? undefined : 'zz-probe-' + i };
        if (whole && before && typeof before === 'object') {
          probe = Object.assign({}, before);
          Object.keys(probe).forEach(function (k) { if (typeof probe[k] === 'string') probe[k] = mark; });
        }
        try { D.setPath(at, probe); } catch (e) { /* the branch refused it */ }
        return new Promise(function (r) { setTimeout(r, 1000); }).then(function () {
          mo.disconnect();
          try { if (whole && before !== undefined) D.setPath(at, before); else D.delPath(at); } catch (e) { /* left */ }
          out.push({ path: p, redrew: changed > 0 });
          return out;
        });
      });
    }, Promise.resolve([]));
  };
  // What each search draws that its spirit.data branch does not hold: the keys of its rows on screen, against the branch.
  W.drawnOutside = function () {
    var D = window.spirit && window.spirit.data;
    return W.searches.map(function (x, i) {
      var host = (window.spiritSearchHosts || [])[i];
      if (!host || !host.isConnected || !x.data || !D || typeof D.rowsOf !== 'function') return { verb: x.verb, data: x.data, drawn: 0, outside: [] };
      var held = {}; (D.rowsOf(x.data) || []).forEach(function (r) { held[String(r.key)] = true; });
      // A search mounted inside another's host (branch's family filter in its 🪣 row) draws its own rows: they are judged
      // against its own branch, not this one's.
      var inner = (window.spiritSearchHosts || []).filter(function (h, j) { return j !== i && h && h !== host && host.contains(h); });
      var keys = Array.prototype.filter.call(host.querySelectorAll('[data-key]'), function (el) { return !inner.some(function (h) { return h.contains(el); }); }).map(function (el) { return String(el.getAttribute('data-key')); });
      return { verb: x.verb, data: x.data, drawn: keys.length, outside: keys.filter(function (k) { return !held[k]; }).slice(0, 5) };
    });
  };
    along(els, ['spirit', 'element', 'search'], wrap);
  }
  function hook(o) {
    if (!o || typeof o !== 'object' || o.__watched) return;
    Object.defineProperty(o, '__watched', { value: true });
    var els = o.element;
    Object.defineProperty(o, 'element', { configurable: true, enumerable: true, get: function () { return els; }, set: function (v) { els = v; searches(v); } });
    searches(els);
    [['event', 'subscribe'], ['data', 'watch']].forEach(function (k) {
      var cur = o[k[0]];
      function wrap(v) {
        if (v && typeof v[k[1]] === 'function' && !v[k[1]].__kept) { var f = kept(k[0] + '.' + k[1], v[k[1]]); f.__kept = true; v[k[1]] = f; }
        // A family's view (goal/G41.28), spirit.data.viewAt(node, family): a manager watches through it, so its watch is kept
        // as one on spirit.data, under the whole path it watches.
        // spirit.data names it viewAt (spirit/data.js); a watch through the view is the module's own watch.
        var VIEW = v && typeof v.viewAt === 'function' ? 'viewAt' : 'at';
        if (k[0] === 'data' && v && typeof v[VIEW] === 'function' && !v[VIEW].__kept) {
          var at = v[VIEW];
          v[VIEW] = function () {
            var view = at.apply(this, arguments);
            var node = arguments[0];
            if (view && typeof view.watch === 'function') {
              // The path as the view watches it: the node's id, or '~' for the home node, then the family, then p.
              var own = view.watch;
              var vw = kept('data.watch', function (whole, fn) { return own(whole.rel, fn); });
              view.watch = function (p, fn) {
                var whole = new String((node ? v.nodeId(node) : '~') + '/' + view.family + '/' + String(p || ''));
                whole.rel = p;
                return vw(whole, fn);
              };
            }
            return view;
          };
          v[VIEW].__kept = true;
        }
      }
      Object.defineProperty(o, k[0], { configurable: true, enumerable: true, get: function () { return cur; }, set: function (v) { cur = v; wrap(v); } });
      wrap(cur);
    });
  }
  var real = window.spirit;
  Object.defineProperty(window, 'spirit', { configurable: true, get: function () { return real; }, set: function (v) { real = v; hook(v); } });
  hook(real);
}());
//# sourceURL=spiritWatch.js`;

// NOTHING JUDGED IS NO PASS (goal/G41.28; Andy: "You fucking fudge tests to get away with total fucking sloppyness!"):
// a rule that found nothing to judge on this page says so, and counts as neither green nor red. It is judged where it
// can be: in the code, or on a page that gives it something. So a rule is said (its test.run) only when its page gave it
// something to judge (goal/G47.2: every test one test.run); the rest are said as comments.
function unjudged(what) { test.comment('not judged on this page: ' + what); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The scratch node and headless Chrome, shared with any test that opens a page (spirit/test/headLessChrome.js).
const { sleep, until, findChrome, scratchNode, chromePage } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (spirit/test/testReport.js). This run records one line per file, named by its address.
// EVERY FILE THAT PAINTS AN ICON LOADS THE ICON ELEMENT (goal/G41.23; Q1, Andy: "plus the intrinsic apps, plus the
// icons app. all apps that use icons."; "wsl, Go" on: a second rule reads the code, so that it misses none). A bare mount
// draws no data, so most icons are seen only here. AN ICON STANDS ALONE (Andy: "isn't a glyph inside flowing text just
// like another inline character? ... glyphs are legal in labels and description true, and in that context they don't
// need special handling", then "narrow the rules so."): a shell script (no test, no vendor code) whose code, comments
// left out, holds a pictograph (Unicode Extended_Pictographic) alone in a string or alone between two tags, or that
// paints icons it is handed (named below, read by hand), loads spirit/element/icon.js. A glyph among words is text. Each is
// its own check, named by its path. painters() reads only the files git tracks under shell/, so the spirit/ entries of
// FROM_DATA and TEXT_ONLY are never read, and shell/boot.js (now spirit/shell/boot.js, goal/G43.18), shell/apps/apps.js
// and shell/icons/icons.js are no longer in the tree.
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'spirit/app/contact/element.js', 'spirit/element/search/icon/listElement.js',
  'spirit/element/search/icon/rowElement.js', 'spirit/element/search/icon.js', 'spirit/element/workBench.js'];
// A pictograph, its variation selectors and joiners with it, alone in quotes or alone between > and <.
const ALONE = /(['"`]|>)\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*(['"`]|<)/u;
// A glyph alone in a string that is drawn only among words, read by hand: a status or a mark put before a name
// (Andy: "glyphs are legal in labels and description true").
const TEXT_ONLY = {
  'spirit/element/search/contact/detailElement.js': 'its blocked mark is drawn before the person\'s name',
  'spirit/element/search/contact/listElement.js': 'its filter icons are drawn before their words by the search element\'s chips',
};
function painters() {
  const tracked = require('child_process').execFileSync('git', ['ls-files', 'shell'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    if (!/\.js$/.test(f) || /\/test\//.test(f) || VENDORED_FOLDERS.holds(f) || f ==='spirit/element/icon.js' || !fs.existsSync(path.join(RUN, f))) return false;
    if (FROM_DATA.indexOf(f) !== -1) return true;
    if (TEXT_ONLY[f]) return false;
    const code = fs.readFileSync(path.join(RUN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    return ALONE.test(code);
  });
}
// RUN://PROCESS IS NAMED NOWHERE (goal/G43.20, goal/G43.30). Andy, G43.20: "that whole run://process folder NEEDS killing
// with ALL references to it in code, test and documentation."; G43.30: "WSL, your tests make sure that none of the affected
// modules even mention "spirit/run/process/"". Even mention: the module's whole text is read, its comments too.
const PROCESS_NAMED = /spirit\/run\/process\b|run:\/\/?process\b/;
function namesProcess(f) { try { return PROCESS_NAMED.test(fs.readFileSync(path.join(RUN, f), 'utf8')); } catch (e) { return false; } }
function processNamers() {
  const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)) && namesProcess(f);
  });
}
// RUN://TEST/ MOVES INTO RUN://SPIRIT/TEST/ (goal/G43.32, the box). Andy: "we'll move the contents of run://test/   into
// run://spirit/test/ first.", on Q2: "We need special rules for run://spirit/test/  it will be where run://spirit/app/test/
// finds it's main tools.", and his concluding point: "this move will free the run:// folder namespace and SpiritOS will
// only take up 1 name ("spirit") in it. .gitignore will be updated to ignore the run:/ folder except for run://spirit/".
// The old folder's name is built, never written, so this file and its .md are the only ones that may name it, and the
// scan leaves those two out.
const OLD_TEST = 'spirit/run/' + 'test/';
const OLD_NAMED = new RegExp(OLD_TEST.replace(/\//g, '\\/') + '|run:\\/\\/?' + 'test\\/');
// The files of run://test/ on 2026-11-10, by their place inside it; test/testReport-verifier.js and .md were folded into
// test/testReport.js and .md since (goal/G45.1: one test file per script); spirit-child-generalRules.js was folded into this
// file since (goal/G47.1).
const MOVED = ['TEST_SYSTEM.md', 'headLessChrome.js', 'testModule.js', 'testReport.js',
  'spirit-sibling-generalRules.js', 'spirit-sibling-generalRules.md', 'spirit-sibling-noFuckingGarbage.js', 'spirit-sibling-noFuckingGarbage.md',
  'spirit-sibling-searchRules.js', 'spirit-sibling-searchRules.md', 'spirit-sibling-testReachRules.js', 'spirit-sibling-testReachRules.md',
  'test/testModule.js', 'test/testModule.md', 'test/testReport.js', 'test/testReport.md'];
// The tools of run://spirit/test/: tools, not tests (Q2).
const TOOLS = ['testReport.js', 'testModule.js', 'headLessChrome.js'];
const SELF = ['spirit-sibling-general.js', 'spirit-sibling-general.md', 'spirit-sibling-node.js', 'spirit-sibling-node.md', 'spirit-sibling-browser.js', 'spirit-sibling-browser.md'];
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
function ignoredByGit(rel) {
  try { require('child_process').execFileSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: REPO, stdio: 'ignore' }); return true; }
  catch (e) { return false; }
}
// EVERY PRODUCT SCRIPT LOADS THE TREE THROUGH spirit.require (goal/G43.32, the box, testing point 2). Andy: "every script
// (other than spirit/spirit.js) must start with ... 'use strict'; 'let spirit = require(spirit) or the html pages <script
// href=spirit/spirit.js> kind of thing; all other scripts should be loaded using spirit.require()", "node modules
// designated to provide node.js functionality: require('http' | 'fs' etc.) are exempt", "i see no reason codemirrors
// vendored scripts cannot be spirit.required....", and "just rename the bloody script" for a name with a dot of its own.
// Judged by reading each product file (the box: "this item deals with PRODUCT files, NOT tests"); vendored code is
// spirit.required by others and not judged as ours.
const BUILTIN = require('module').builtinModules;
// The code with its comments blanked, strings and line breaks kept; with bare, the strings' insides blanked too, every
// offset the same, so a require written inside a string is found as none.
function codeOf(src, bare) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += bare ? c + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + (j < src.length ? c : '') : src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
// Why a product script breaks the shape, one reason a break; [] when it holds.
function shapeBreaks(rel) {
  const why = [];
  const stem = path.posix.basename(rel, '.js');
  if (stem.indexOf('.') !== -1) why.push('its name holds a dot of its own (' + path.posix.basename(rel) + '): "just rename the bloody script"');
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ['it cannot be read']; }
  const code = codeOf(src);
  if (!/^\s*(['"])use strict\1\s*;/.test(code)) why.push('it does not start with \'use strict\';');
  if (rel === 'spirit/spirit.js') return why;
  // Every plain require: the first takes spirit.js; any other names one of node's own modules.
  const bare = codeOf(src, true);
  const re = /(^|[^.\w$])require\s*\(/g;
  let m;
  let first = true;
  while ((m = re.exec(bare))) {
    const open = m.index + m[0].length;
    const arg = (/^\s*([^)]*)\)/.exec(code.slice(open)) || ['', ''])[1].trim();
    const lit = /^(['"])([^'"]*)\1$/.exec(arg);
    const named = lit ? lit[2] : '';
    const spiritJs = /(^|\/)spirit\.js$/.test(named) || /['"]spirit\.js['"]\s*\)?$/.test(arg);
    const line = code.slice(0, m.index).split('\n').length;
    if (spiritJs) { first = false; continue; }
    if (!first && lit && (BUILTIN.indexOf(named) !== -1 || BUILTIN.indexOf(named.replace(/^node:/, '')) !== -1)) continue;
    why.push(first ? 'its first load is not spirit.js: require(' + arg.slice(0, 80) + ') at line ' + line : 'it loads require(' + arg.slice(0, 80) + ') at line ' + line + ', not through spirit.require');
    first = false;
  }
  return why;
}
// THE GENERAL RULES OF A MODULE, judged in its code (goal/G40.6; folded in from spirit-child-generalRules.js, goal/G47.1;
// Andy: "for now, fold those two into spirit-sibling-generalRules.js"). Andy: "it will assert, the require path rule it
// will assert that the spirit-object becomes a global at the top of all modules"; spirit.js itself is judged too: "it
// must establish the global spirit object early in the code, it must follow the require-path restrictions we discussed."
// THE GLOBAL EARLY: a module's first require is spirit.js, so spirit is a plain global before anything else is loaded;
// spirit.js itself sets the global before its first require. Page code (no module.exports, speaks to window) runs on
// the page, where spirit.js is already there, and node never loads it.
// THE REQUIRE RULE (goal/G40's box): "a require path that starts with ../ may only add a file name, never descend into a
// subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling in the
// module's own folder is legal." A package or a node built-in is not a path; a computed path cannot be read.
// moduleRules(full) -> { early: '' when it holds, else why; page: true for page code; bad: [require paths breaking the rule] }
function moduleRules(full) {
  const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const requires = [];
  // Plain requires only: spirit.require(...) is the door the rule asks for, never a plain require.
  const re = /(^|[^.\w$])require\(\s*(['"])([^'"]+)\2\s*\)/g;
  let m;
  while ((m = re.exec(code))) requires.push({ at: m.index, path: m[3] });
  const own = path.basename(full, '.js');
  const isSpirit = path.resolve(full) === path.join(RUN, 'spirit', 'spirit.js');
  const first = requires[0];
  const page = !isSpirit && /\bwindow\b/.test(code) && !/\bmodule\.exports\b/.test(code);
  // THE RULE (Andy, 2026-11-13, goal/G47.1 box v73, replacing his api.js exemption of v72: "if a module requires
  // anything, it must require spirit.js first. Other modules are required using spirit.require(), unless they are
  // native node.js modules."). A module that requires nothing holds it.
  let early = '';
  if (page || !requires.length) early = '';
  else if (isSpirit) {
    const sets = code.search(/\broot\.spirit\s*=|\bglobalThis\.spirit\s*=|\bglobal\.spirit\s*=/);
    if (sets === -1 || (first && sets > first.at)) early = 'it sets the global spirit ' + (sets === -1 ? 'nowhere' : 'only after its first require, ' + JSON.stringify(first.path));
  } else if (!(/(^|\/)spirit\.js$/.test(first.path) && path.resolve(path.dirname(full), first.path) === path.join(RUN, 'spirit', 'spirit.js'))) {
    early = 'it does not require spirit.js first: its first require is ' + JSON.stringify(first.path);
  } else {
    const native = function (p) { return BUILTIN.indexOf(p) !== -1 || BUILTIN.indexOf(p.replace(/^node:/, '')) !== -1; };
    const other = requires.slice(1).filter(function (r) { return !native(r.path) && !/(^|\/)spirit\.js$/.test(r.path); })[0];
    if (other) early = 'it requires ' + JSON.stringify(other.path) + ', not through spirit.require(): only node\'s own modules are required plainly';
  }
  const bad = requires.filter(function (r) {
    const p = r.path;
    if (!/^[./]/.test(p)) return false;
    if (/^\.\.\//.test(p)) return /\//.test(p.replace(/^(\.\.\/)+/, ''));
    if (/^\.\//.test(p)) { const rest = p.slice(2); return rest.indexOf('/') !== -1 && rest.indexOf(own + '/') !== 0; }
    return true;
  }).map(function (r) { return r.path; });
  return { early: early, page: page, spirit: isSpirit, bad: bad };
}
function productScripts() {
  return require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
}
// EVERY PRODUCT SCRIPT, PLACED WHERE IT IS REQUIRED (goal/G43.32, the box, testing point 3; Andy: "a general test for
// any scriptFile.js is to spirit.require() it.", Q5: "doesn't spirit.require() only load a script, store it at
// spirit.required.<path>  and run it once.", "element scripts themselves are who installs the element factory at
// spirit.element.<path-of-element-script>", and "I'm NOT demanding that all scripts load in all environments, I'm
// demanding that they're placed in the spirit object according to these rules IF they are required."). Each script is
// spirit.require()d alone on the node and on a page; where it loads, it stands at spirit.required.<its path>, and on
// the node the answer came at once. Where it does not load (a page element on the node, a server on a page) nothing is
// judged. An element script, one that calls installSpiritElement, has a factory with a create at spirit.element.<its
// path> once required on a page. The node side runs in the scratch copy beside the scratch node, each script in a
// process of its own; the page side on the scratch node's face page, a fresh page each. Never Andy's tree or node.
function placeKeys(rel) { return rel.replace(/\.js$/, '').split('/'); }
// The helper itself defines installSpiritElement and places nothing: it is required, no element.
function isElementScript(rel) { return rel !== 'spirit/element/installSpiritElement.js' && /\binstallSpiritElement\s*\(/.test(codeOf(fs.readFileSync(path.join(RUN, rel), 'utf8'), true)); }
function requireOnNode(run, rel) {
  return new Promise(function (resolve) {
    // A branch's api.js (decided 8) binds the branch, so it is waited on and judged by its place alone; every other script
    // answers at once and stands at its place as that answer.
    const iface = /\/api\.js$/.test(rel);
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "spirit.js"));' +
      '(async function () { let at = null, err = "", promise = false; try { at = s.require(' + JSON.stringify(rel) + '); promise = !!(at && typeof at.then === "function"); if (' + iface + ' && promise) at = await at; } catch (e) { err = String(e && e.message || e); }' +
      'const keys = ' + JSON.stringify(placeKeys(rel)) + '; const place = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, s.required);' +
      'process.stdout.write("\\n@@" + JSON.stringify({ err: err, promise: ' + iface + ' ? false : promise, placed: ' + iface + ' ? place !== undefined : place !== undefined && place === at }) + "\\n"); process.exit(0); }());';
    const kid = spawn(process.execPath, ['-e', probe], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    kid.stdout.on('data', function (d) { out += d; });
    kid.stderr.on('data', function (d) { out += d; });
    const t = setTimeout(function () { kid.kill('SIGKILL'); }, 20000);
    kid.on('close', function () {
      clearTimeout(t);
      const m = /\n@@(.*)\n/.exec(out);
      let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
      resolve(r || { err: 'it did not finish loading', promise: false, placed: false });
    });
  });
}
// THE ONE HELPER (goal/G43.32; Andy: "this can be done with ONE single helper function
// spirit/element/installSpiritElement(spirit,elementPath)"): no element script puts itself on spirit.element or
// spirit.elements by hand.
function placedByHand() {
  return productScripts().filter(function (f) {
    if (f === 'spirit/element/installSpiritElement.js' || f === 'spirit/spirit.js') return false;
    const code = codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true);
    return /\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*=(?!=)|\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*\[[^\]]*\]\s*=(?!=)|Object\.assign\s*\([^)]*\bspirit\.elements?\b/.test(code);
  });
}
// What each rule broke, named in its answer: '' when none did.
function listed(bad) { return !bad.length || bad.join('; '); }

// ── GIVEN NO FILE: THE TREE'S RULES, THEN EVERY PAGE MODULE ─────────────────────────────────────────────────────────────
function every() {
  // no module of spirit/run/ mentions spirit/run/process/
  const E = {};
  test.run('the world: the modules are read', 0.2, function () {
    E.tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f); });
    return E.tracked.length > 0 || 'git ls-files gave no module to read';
  }, test.limit.quick);
  test.run('none of them names spirit/run/process or run://process, in code or comment', 0.4, function () {
    const named = processNamers();
    return (!!E.tracked && E.tracked.length > 0 && !named.length) || named.length + ' still name it: ' + short(named);
  }, test.limit.quick);

  // elements are placed by installSpiritElement alone
  test.run('spirit/element/installSpiritElement.js is there', 0.4, function () {
    return fs.existsSync(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js')) || 'there is no spirit/element/installSpiritElement.js';
  }, test.limit.quick);
  test.run('no product script puts an element on spirit.element or spirit.elements by hand', 0.4, function () {
    const hand = placedByHand();
    return !hand.length || hand.length + ' still do: ' + short(hand.slice(0, 8));
  }, test.limit.quick);
  // Decided 6: an app's element is placed like every element, "the shell, the app selector, the file opener and the desk
  // find it there"; so nothing reads an element at the old place, spirit.elements.<name>, any more.
  test.run('no product script reads or writes the old spirit.elements: every element is found at spirit.element.<its path>', 0.4, function () {
    const old = productScripts().filter(function (f) { return /\.elements\b/.test(codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true)); });
    return !old.length || old.length + ' still name spirit.elements: ' + short(old.slice(0, 8));
  }, test.limit.quick);

  // run://test/ is moved into run://spirit/test/
  test.run('run://test/ holds no tracked file', 0.4, function () {
    const left = gitIn(RUN, ['ls-files', '--', 'test/']);
    return !left.length || left.length + ' still tracked there: ' + short(left);
  }, test.limit.quick);
  test.run('run://spirit/test/ holds all the moved files, test/test/ included', 0.4, function () {
    const missing = MOVED.filter(function (f) { return !fs.existsSync(path.join(RUN, 'spirit', 'test', f)); });
    return !missing.length || missing.length + ' are not there: ' + short(missing);
  }, test.limit.quick);
  // nothing under spirit/run/ names run://test/
  test.run('the world: the files are read, tests and documents included', 0.2, function () {
    E.files = gitIn(RUN, ['ls-files']).filter(function (f) {
      return /\.(js|md|html|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && SELF.indexOf(path.basename(f)) === -1 && fs.existsSync(path.join(RUN, f));
    });
    return E.files.length > 0 || 'git ls-files gave no file to read';
  }, test.limit.quick);
  test.run('none of them names the old run://test/, in code, comment or document', 0.4, function () {
    const files = E.files || [];
    const naming = files.filter(function (f) { try { return OLD_NAMED.test(fs.readFileSync(path.join(RUN, f), 'utf8')); } catch (e) { return false; } });
    return (files.length > 0 && !naming.length) || naming.length + ' still name it: ' + short(naming);
  }, test.limit.quick);
  // run://spirit/test/'s tools are not tests
  test.run('the world: testModule.js lists tests', 0.2, function () {
    const moduleAt = [path.join(RUN, 'spirit', 'test', 'testModule.js'), path.join(RUN, 'test', 'testModule.js')].filter(function (p) { return fs.existsSync(p); })[0];
    E.listed = moduleAt ? require(moduleAt).testsFor('').map(function (t) { return t.test; }) : [];
    return E.listed.length > 0 || 'no testModule.js to ask';
  }, test.limit.quick);
  test.run('testModule.js lists none of testReport.js, testModule.js and headLessChrome.js as a test', 0.4, function () {
    const all = E.listed || [];
    const toolsListed = all.filter(function (t) { return TOOLS.indexOf(path.posix.basename(t)) !== -1 && /^(spirit\/)?test\/[^/]+$/.test(t); });
    return (all.length > 0 && !toolsListed.length) || 'it lists them as tests: ' + short(toolsListed);
  }, test.limit.quick);
  // git ignores run:// except run://spirit/
  function ignoreLines() { return fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; }); }
  test.run('.gitignore holds /spirit/run/* and !/spirit/run/spirit/', 0.4, function () {
    const lines = ignoreLines();
    return (lines.indexOf('/spirit/run/*') !== -1 && lines.indexOf('!/spirit/run/spirit/') !== -1) || 'it lacks ' + short(['/spirit/run/*', '!/spirit/run/spirit/'].filter(function (l) { return lines.indexOf(l) === -1; }));
  }, test.limit.quick);
  test.run('no other line names a path under run:// outside run://spirit/, since run://* covers it', 0.4, function () {
    const dead = ignoreLines().filter(function (l) {
      const p = l.replace(/^!/, '').replace(/^\//, '');
      return p.indexOf('spirit/run/') === 0 && p.indexOf('spirit/run/spirit/') !== 0 && l !== '/spirit/run/*';
    });
    return !dead.length || dead.length + ' left: ' + short(dead);
  }, test.limit.quick);
  test.run('a new file in run:// outside spirit/ is ignored', 0.4, function () {
    const outside = 'spirit/run/zz-g4332-not-tracked.txt';
    return ignoredByGit(outside) || 'git does not ignore ' + outside;
  }, test.limit.quick);
  test.run('a new file in run://spirit/ is not ignored', 0.4, function () {
    const inside = 'spirit/run/spirit/zz-g4332-not-tracked.txt';
    return !ignoredByGit(inside) || 'git ignores ' + inside;
  }, test.limit.quick);

  // every product script: use strict, spirit first, the tree only through spirit.require
  test.run('the world: the product scripts are read (tests and vendored code left out)', 0.2, function () {
    E.scripts = productScripts();
    return E.scripts.length > 100 || 'only ' + E.scripts.length + ' product scripts found: too few to judge';
  }, test.limit.quick);
  test.run('all of them hold the shape', 0.4, function () {
    const all = E.scripts || [];
    const broken = all.map(function (f) { return { f: f, why: shapeBreaks(f) }; }).filter(function (x) { return x.why.length; });
    return (all.length > 100 && !broken.length) || broken.length + ' of ' + all.length + ' do not; the first: ' + short(broken.slice(0, 5).map(function (x) { return x.f + ': ' + x.why[0]; }));
  }, test.limit.quick);

  // every product script: spirit.js required first, every require path a child, a sibling or an ancestor's file
  test.run('the world: the product scripts are read for the module rules', 0.2, function () {
    const all = productScripts();
    E.ruled = all.map(function (f) { return { f: f, r: moduleRules(path.join(RUN, f)) }; });
    return all.length > 100 || 'only ' + all.length + ' product scripts found: too few to judge';
  }, test.limit.quick);
  test.run('every one takes spirit.js first, or is page code', 0.4, function () {
    const ruled = E.ruled || [];
    const late = ruled.filter(function (x) { return x.r.early; });
    return (ruled.length > 100 && !late.length) || late.length + ' of ' + ruled.length + ' do not; the first: ' + short(late.slice(0, 5).map(function (x) { return x.f + ': ' + x.r.early; }));
  }, test.limit.quick);
  test.run('none of their require paths breaks the require rule', 0.4, function () {
    const ruled = E.ruled || [];
    const astray = ruled.filter(function (x) { return x.r.bad.length; });
    return (ruled.length > 100 && !astray.length) || astray.length + ' of ' + ruled.length + ' do; the first: ' + short(astray.slice(0, 5).map(function (x) { return x.f + ' requires ' + x.r.bad[0]; }));
  }, test.limit.quick);

  // every shell file that paints an icon loads the icon element
  // Said only when a file paints icons: painters() reads the files git tracks under shell/.
  let painting = [];
  try { painting = painters(); } catch (e) { painting = []; }
  test.comment(painting.length + ' shell files paint icons: ' + painting.join(', '));
  test.comment('glyphs among words only, read by hand: ' + Object.keys(TEXT_ONLY).map(function (f) { return f + ' (' + TEXT_ONLY[f] + ')'; }).join('; '));
  if (painting.length) {
    // Each file that breaks it named in the answer, by its path.
    test.run('it paints icons, and loads the icon element or hands them to one that does', 0.4, function () {
      return listed(painting.filter(function (f) {
        const src = fs.readFileSync(path.join(RUN, f), 'utf8');
        // A file that hands its glyphs to the one-row form (goal/G41.27) paints them through it: rowForm loads the icon element
        // itself (rule/26).
        return src.indexOf('spirit/element/icon.js') === -1 && src.indexOf('spirit/element/rowForm.js') === -1;
      }).map(function (f) { return f + ': it paints icons and never loads spirit/element/icon.js'; }));
    }, test.limit.quick);
  }


  test.after(async function () {
    if (E.page) { try { if (E.page.kid) E.page.kid.kill(); } catch (e) { /* gone */ } }
    if (E.node) {
      try { E.node.child.kill(); } catch (e) { /* gone */ }
      await sleep(300);
      try { fs.rmSync(E.node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  });
}


function oneFile(P) {
  // goal/G43.31, a branch named as its folder, is judged on each branch folder by ./spirit-sibling-branchRules.js (goal/G43.32).
  // goal/G43.30: every file judged here, app, element or neither, mentions no spirit/run/process (noProcessAnywhere).
  // <address>: it mentions no spirit/run/process
  test.run('it names neither spirit/run/process nor run://process, in code or comment', 0.4, function () {
    return !namesProcess(rel) || 'it mentions spirit/run/process: ' + short((fs.readFileSync(full, 'utf8').match(PROCESS_NAMED) || [])[0]);
  }, test.limit.quick);
  // goal/G43.32: a product script holds the shape (everyScriptShaped), each reason named in its answer.
  if (/^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    // <address>: use strict, spirit first, the tree only through spirit.require
    test.run('it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.require', 0.4, function () {
      return listed(shapeBreaks(rel));
    }, test.limit.quick);
  }
  // The general rules of a module (moduleRules above), on any file handed, a product script or not.
  // <address>: the spirit object is a global before anything else is loaded
  const mr = moduleRules(full);
  if (mr.page) test.run('it is page code: node never loads it', 0.4, function () { return moduleRules(full).page || 'it is no longer page code'; }, test.limit.quick);
  else if (mr.spirit) test.run('it sets the global spirit before its first require', 0.4, function () { return !moduleRules(full).early || moduleRules(full).early; }, test.limit.quick);
  else test.run('it requires spirit.js first', 0.4, function () { return !moduleRules(full).early || moduleRules(full).early; }, test.limit.quick);
  // <address>: every require path is a child, a sibling or an ancestor's file
  test.run('none of its require paths breaks the rule', 0.4, function () {
    return listed(moduleRules(full).bad.map(function (p) { return 'require error: it requires ' + JSON.stringify(p); }));
  }, test.limit.quick);
  if (!kindOf(rel)) {
    test.run('it places no element (it calls no installSpiritElement): a switch, a server or a helper, not mounted', 0.4, function () {
      return !kindOf(rel) || 'it places an element after all';
    }, test.limit.quick);
    return;
  }
  const ownCode = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  // THE WHOLE ROW, NEVER A FEW FIELDS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and
  // search the whole row, as cached in spirit.data."): no app or element hands a search a matched(row) of its own; the
  // search element itself matches the whole row.
  if (rel !== 'spirit/element/search.js') {
    // <address>: its searches match the whole row
    test.run('it hands no search a matched() of its own', 0.4, function () {
      return !/\bmatched\s*:/.test(ownCode) || 'it hands a search matched(), a few fields in place of the whole row';
    }, test.limit.quick);
  }
  // WHAT IT CHANGES, IT LISTENS FOR, IN ITS CODE (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when
  // it changes shit it listens to fucking update via the spirit object"): judged without a page, since a bare mount
  // seldom has a row to change. A module whose code sends a write (an op that changes a row, or a verb that sets) watches
  // spirit.data: a .watch( of its own, or a search made on a spirit.data branch (its data: option), the branch named as
  // text or by the one that keeps it (data: K.branch, the cache manager's own name for it).
  {
    const own = ownCode;
    // A write in code: an op that changes a row ({ op: 'set' }), a verb named as a string that changes one
    // ('node.setName', 'chat.add', 'box.write'), or a spirit family's setting verb called (spirit.relay.join(...)).
    const WRITE = /\bop\s*:\s*['"](add|set|delete|remove|grant|revoke|ask|claim|press)['"]|['"][a-z]\w*(?:\.[a-z]\w*)*\.(?:set[A-Z]\w*|set|add|delete|remove|grant|revoke|join|face|write|press|claim)['"]|\bspirit\.\w+\.(?:set[A-Z]\w*|join|face|grant|revoke)\s*\(|\.relay\.(?:join|face)\s*\(|\.(?:saveFile|grant|revoke)\s*\(\s*\w/;
    const writes = WRITE.exec(own);
    // <address>: what its code changes, it watches in spirit.data
    if (!writes) unjudged('its code sends no write');
    else {
      test.run('it sends writes and watches spirit.data', 0.4, function () {
        return (/\.watch\s*\(/.test(own) || /\bdata\s*:\s*(?:['"][\w.\/-]+['"]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/.test(own)) || 'it sends writes (' + writes[0].replace(/\s+/g, ' ') + ') and its code watches nothing in spirit.data';
      }, test.limit.quick);
    }
  }
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves, (fast if an other element already required it), that way anybody can mount any element without knowing
  // what it actually needs...."): its code takes no interface from what it is handed, no api.verb or api.escapeHtml and
  // no api off its options; it reaches its verbs through spirit itself.
  // <address>: what it needs, it requires itself
  test.run('it takes no api from what it is handed', 0.4, function () {
    const own = ownCode;
    const handed = own.match(/\b(?:opts|options|o|op)\s*\.\s*api\b|(?<![.\w$])api\s*\.\s*(?:verb|escapeHtml)\b/g) || [];
    return !handed.length || 'it uses an api handed to it: ' + short(handed.filter(function (h, i) { return handed.indexOf(h) === i; }));
  }, test.limit.quick);

}

// What it judges: given no file, the tree and every page module; given a file, that file. A page module's page is drawn
// before its rules are said (session above), so a rule its page gives nothing to judge is never said green.

// What it judges: given no file, the tree; given a file, that file's code (its page is spirit-sibling-browser.js's).
if (!arg) every();
else if (!full) test.run('the world: the file handed is there', 0.2, function () { return 'no file to judge: ' + JSON.stringify(arg); }, test.limit.quick);
else oneFile({ fail: '', stage: 'none' });
}

const PARTS = [generalRules, branchRules, titleRules, noFuckingGarbage, searchRules, testReachRules];
if (!GIVEN.length) PARTS.forEach(function (part) { part([]); });
else GIVEN.forEach(function (one) { test.forScript(one, function () { PARTS.forEach(function (part) { part([one]); }); }); });
