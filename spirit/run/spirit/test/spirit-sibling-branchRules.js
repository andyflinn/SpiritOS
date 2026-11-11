'use strict';

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

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
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
const asked = ARGS[0] ? String(ARGS[0]).replace(/^\.\//, '').replace(/^spirit\/run\//, '').replace(/\/$/, '') : '';
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
  }, 1000);
} else {
  test.run('the world: branch folders recognized, an app\'s (desk) and a system one (fs) among them', 0.2, function () {
    test.comment(TARGETS.length + ' of ' + ALL.length + ' branches: ' + TARGETS.map(function (b) { return b.dir; }).join(', '));
    return (ALL.length >= 20 && ALL.some(function (b) { return b.dir === 'spirit/app/desk'; }) && ALL.some(function (b) { return b.dir === 'spirit/fs'; })) || 'only ' + short(ALL.map(function (b) { return b.dir; })) + ': nothing judged';
  }, 1000);
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
  }, 1000);
  // Where it stands is where its family is found (goal/G43.27: spirit/<name>/, spirit/app/<name>/, the fewest path
  // elements), and no other api.js has its name.
  test.run('its api.js is where its branch is found', 0.4, function () {
    return overAll(withApi, function (b) { return familyPath(b.family) === b.api ? '' : b.api + ': the family ' + b.family + ' is found at ' + short(familyPath(b.family)) + ', not here'; });
  }, 1000);
  test.run('no other api.js of its branch in the tree', 0.4, function () {
    return overAll(withApi, function (b) {
      const twins = (byName[b.family] || []).filter(function (f) { return f !== b.api; });
      return !twins.length ? '' : b.api + ': ' + b.family + ' has another api.js: ' + short(twins);
    });
  }, 1000);
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
  }, 1000);
  test.run('its manifest has no kind or operated: the node operates the server', 0.4, function () {
    return overAll(apps, function (b) {
      const j = manifestOf(b);
      return (!!j && !j.threw && !('kind' in j) && !('operated' in j)) ? '' : b.dir + '/' + b.name + '.json: it holds ' + short(['kind', 'operated'].filter(function (k) { return j && k in j; }));
    });
  }, 1000);
  test.run('its name is no verb of the app family', 0.4, function () {
    let familyVerbs = [];
    try { familyVerbs = Object.keys(require(path.join(RUN, 'spirit', 'app', 'api.js')).verbs || {}); } catch (e) { familyVerbs = []; }
    return overAll(apps, function (b) {
      return (familyVerbs.length > 0 && familyVerbs.indexOf(b.name) === -1) ? '' : b.dir + ': ' + (familyVerbs.length ? 'it takes the name of the verb app.' + b.name : 'the app family declares no verbs: nothing judged');
    });
  }, 1000);
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
  }, 1000);
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
  }, 1000);
  // <branch>: its cache, the rest
  // ONE PATTERN (goal/G43.7, the box: "ALL ... files will be converted to "data.js" files", "using the module
  // spirit/data.js", "with the SAME pattern"; from ./data-families.js): the old file is gone, and the guard, the attach
  // and the write on spirit are spirit/data.js's, none of it rolled by the family by hand.
  const OLD_MANAGER = 'clientCache' + 'Manager';
  test.run('the old file is gone', 0.4, function () {
    return overAll(withData, function (b) { return !has(b.dir + '/' + OLD_MANAGER + '.js') ? '' : b.dir + ': ' + b.dir + '/' + OLD_MANAGER + '.js still stands'; });
  }, 1000);
  test.run('its data.js rolls none of it by hand', 0.4, function () {
    return overAll(withData, function (b) { return !/Symbol\.for|function attach|\.spirit\s*=|spirit\.[A-Za-z]+Data\s*=/.test(b.src) ? '' : b.data + ': data.js still rolls its own guard, attach or spirit write'; });
  }, 1000);
  // The one difference is the disk: no manager touches a file or the browser's storage.
  test.run('its data.js touches no file and no browser storage', 0.4, function () {
    return overAll(withData, function (b) {
      const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(b.src);
      return !disk ? '' : b.data + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may';
    });
  }, 1000);
  // One contract: required, it stands at spirit.data.<name> through spirit.data.makeFamily, the name it hands
  // makeFamily, never guessed from its folder.
  // EVERY BRANCH IS NAMED AS ITS FOLDER (goal/G43.31; Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
  // motherfucking <name> in spirit/app/<name>....", and "make sure, IN THIS ITEM that family names MATCH folder names").
  test.run('its data.js makes the branch its folder is named', 0.4, function () {
    return overAll(withData, function (b) { return b.made === b.name ? '' : b.data + ': it makes the branch ' + (b.made || 'none') + ' in the folder ' + b.name; });
  }, 1000);
  test.run('its data.js loads, and exports its cache rules if it has any', 0.4, function () {
    return overAll(withData, function (b) {
      let mod = null;
      try { mod = require(path.join(RUN, b.data)); } catch (e) { mod = { threw: e.message }; }
      return (!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object'))) ? '' : b.data + ': it exports ' + short(mod && Object.keys(mod));
    });
  }, 1000);
  function familyOf(b) { try { return b.made ? require(DATA)[b.made] : null; } catch (e) { return null; } }
  test.run('in node it stands at spirit.data under its branch, its data and its cache, for clients to ask', 0.4, function () {
    return overAll(withData, function (b) {
      const f = familyOf(b);
      return (!!f && !!f.data && typeof f.data === 'object' && !!f.cache && typeof f.cache === 'object') ? '' : b.data + ': spirit.data.' + b.made + ' is ' + short(f);
    });
  }, 1000);
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
  }, 1000);
  test.run('no watch of its data is told its branch: each takes the function and at most its row', 0.4, function () {
    return overAll(withData, function (b) {
      const w = watchesOf(b);
      if (!w) return b.data + ': no reads to judge at spirit.data.' + b.made;
      return !w.told.length ? '' : b.data + ': a watch of spirit.data.' + b.made + ' takes more than its row and its function, so it is told its branch: ' + short(w.told);
    });
  }, 1000);
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
  }, 4000);
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
    }, 2000);
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
  }, 185000);
  // <branch>: on a node
  test.run('the node\'s api tree holds its branch', 0.4, async function () {
    if (!up()) return NO_NODE;
    await treeOf();
    return overAll(served, function (b) { return branchIn(b) ? '' : b.dir + ': the node\'s api tree holds no branch ' + b.family + ': ' + short((N.tree || {})[b.family]); });
  }, 1000);
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
  }, 1000);
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
  }, 1000);
  test.run('its branch carries no FS set', 0.4, function () {
    if (!up()) return NO_NODE;
    return overAll(served, function (b) {
      const branch = branchIn(b);
      if (!branch) return noBranch(b);
      const fs_ = Object.keys(branch).filter(function (v) { return /^FS\./.test(v); });
      return !fs_.length ? '' : b.dir + ': it carries ' + short(fs_);
    });
  }, 1000);
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
    }, 7000);
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
    }, 4000);
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
    }, 1000);
    test.run('no data.js of its branch was asked that is not there (no 404)', 0.4, function () {
      if (!N.got) return 'no page asked: the world failed';
      return overAll(found, function (b) {
        const missed = N.heard.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404 && a.url.split('/').slice(-2, -1)[0] === b.family; });
        return !missed.length ? '' : b.dir + ': asked and missed: ' + short(missed);
      });
    }, 1000);
    // The box (goal/G43.7): "spirit.data.<name>.data" and "spirit.data.<name>.cache", on the page as in node.
    test.run('on the page, spirit.data under its branch has data and cache', 0.4, function () {
      if (!N.got) return 'no page asked: the world failed';
      const b_ = both();
      return overAll(found, function (b) { return b_[b.family] === true ? '' : b.dir + ': on the page spirit.data.' + b.family + ' lacks data or cache'; });
    }, 1000);
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
    }, 1000);
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
