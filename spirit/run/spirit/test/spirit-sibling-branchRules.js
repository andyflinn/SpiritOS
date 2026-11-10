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
// A branch is recognized by its folder (testModule.js branchesOf; Andy: "app-branches are easily identified using the
// patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json", "and system branches by: spirit.<name>.api.js &&
// spirit.<name>.data.js"). Every check is named by its branch folder. What it took in, per branch, from the five tests
// that held branch rules (goal/G43.32, Q6: "absolutely, AND MAKE SURE NO TEST GETS LOST."): spirit-familyFinder.js,
// data-caches.js, apiDoor-familyGate.js, server-appFamily.js, introSpector-branchVerbs.js; what judges no branch went back
// to the test of the module it judges (./data-caches.js, ./spirit-familyFinder.js). A scratch node; never a live one.

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
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

// ── 1. RECOGNIZED, AND ITS INTERFACE ────────────────────────────────────────────────────────────────────────────────
function interfaceRules() {
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
  TARGETS.forEach(function (b) {
    test.subHeading(b.dir + ': its interface');
    test.comment(b.dir + ': a ' + b.kind + ' branch, recognized by ' + (b.kind === 'system' ? 'its api.js and data.js' : 'its ' + b.name + '.js and ' + b.name + '.json'));
    if (!b.api) { test.comment(b.dir + ': it holds no api.js, so it has no interface to judge'); return; }
    // Decided 7 (the box): "Verb rules live in api.js". Each verb a declaration of its arguments, each argument's rule.
    const odd = b.verbs ? Object.keys(b.verbs).filter(function (v) { const d = b.verbs[v]; return !d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(function (k) { return typeof d[k] !== 'string' && !(d[k] && typeof d[k] === 'object'); }); }) : [];
    ok(!!b.mod && !b.mod.threw && !!b.verbs && !odd.length,
      b.api + ': it loads, and declares each verb\'s arguments and their rules (' + Object.keys(b.verbs || {}).length + ' verbs)',
      b.api + ': ' + (b.mod && b.mod.threw ? 'it does not load: ' + b.mod.threw : !b.verbs ? 'it declares no verbs' : 'verbs not declared as arguments and rules: ' + short(odd)));
    // Where it stands is where its family is found (goal/G43.27: spirit/<name>/, spirit/app/<name>/, the fewest path
    // elements), and no other api.js has its name.
    ok(familyPath(b.family) === b.api, b.api + ': it is where the family ' + b.family + ' is found', b.api + ': the family ' + b.family + ' is found at ' + short(familyPath(b.family)) + ', not here');
    const twins = (byName[b.family] || []).filter(function (f) { return f !== b.api; });
    ok(!twins.length, b.api + ': no other ' + b.family + '/api.js in the tree', b.api + ': ' + b.family + ' has another api.js: ' + short(twins));
  });
}
// Required on the node, in a process of the scratch node's run root, so its spirit.js knows that node (its
// environment.json): the test stands without a node of the checkout's own.
function placedRules(sRun, served) {
  const ran = spawnSync(process.execPath, ['-e', PLACED, sRun, JSON.stringify(served.map(function (b) { return b.api; }))], { cwd: sRun, encoding: 'utf8', timeout: 120000 });
  let placed = {};
  try { placed = JSON.parse(String(ran.stdout || '').trim().split('\n').pop()); } catch (e) { placed = { threw: short(ran.stdout || ran.stderr) }; }
  served.forEach(function (b) {
    const g = placed[b.api] || { threw: placed.threw || 'not required' };
    const at = 'spirit.required.' + b.api.replace(/\.js$/, '').split('/').join('.');
    ok(!g.threw && g.placed && !g.unbound.length && g.same,
      b.api + ': required on the node, it stands at ' + at + ', and binds its ' + g.verbs + ' verbs on spirit.' + b.family,
      b.api + ': ' + (g.threw ? 'its require threw: ' + g.threw : (!g.placed ? 'it does not stand at ' + at + '; ' : '') + (g.unbound && g.unbound.length ? 'verbs not bound: ' + short(g.unbound) + '; ' : '') + (!g.same ? 'spirit.' + b.family + ' is not what it bound' : '')));
  });
}

// ── 1a. AN APP BRANCH'S DESCRIPTION ─────────────────────────────────────────────────────────────────────────────────
// AGENT.md, an app: "the app family's live at spirit/run/spirit/app/<name>/, each described by its own <name>/<name>.json
// (goal/G43.2)"; Andy, box: "containing identity:icon and identity:label", and "spirit.app also holds the family's verb,
// search, so no app may take the name of a verb." (goal/G43.6); ./appServer-mount.md: "<name>.json has no kind or
// operated. The node operates the server."
function appRules() {
  let familyVerbs = [];
  try { familyVerbs = Object.keys(require(path.join(RUN, 'spirit', 'app', 'api.js')).verbs || {}); } catch (e) { familyVerbs = []; }
  TARGETS.forEach(function (b) {
    if (b.kind !== 'app') return;
    test.subHeading(b.dir + ': its description');
    const at = b.dir + '/' + b.name + '.json';
    let j = null;
    try { j = JSON.parse(fs.readFileSync(path.join(RUN, at), 'utf8')); } catch (e) { j = { threw: e.message }; }
    const id = j && j.identity && typeof j.identity === 'object' ? j.identity : {};
    ok(!!j && !j.threw && typeof id.icon === 'string' && !!id.icon && typeof id.label === 'string' && !!id.label,
      at + ': it names identity.icon and identity.label (' + id.icon + ' ' + id.label + ')',
      at + ': ' + (j && j.threw ? 'it is no JSON: ' + j.threw : 'identity is ' + short(j && j.identity)));
    ok(!!j && !j.threw && !('kind' in j) && !('operated' in j), at + ': it has no kind or operated: the node operates the server', at + ': it holds ' + short(['kind', 'operated'].filter(function (k) { return j && k in j; })));
    ok(familyVerbs.length > 0 && familyVerbs.indexOf(b.name) === -1, b.dir + ': its name is no verb of the app family (' + familyVerbs.join(', ') + ')', b.dir + ': ' + (familyVerbs.length ? 'it takes the name of the verb app.' + b.name : 'the app family declares no verbs: nothing judged'));
  });
}

// ── 2. ITS CACHE (was data-caches.js, goal/G41.28) ──────────────────────────────────────────────────────────────────
// Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
// node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
// is the appServer serializes the cache to disk."
function cacheRules() {
  const DATA = path.join(RUN, 'spirit', 'data.js');
  const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/data.js' && !/\/test\//.test(f); });
  const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|\/vendor\//.test(f) && !VENDORED_FOLDERS.holds(f) && managers.indexOf(f) === -1; });
  TARGETS.forEach(function (b) {
    if (!b.api && !b.data) return;
    test.subHeading(b.dir + ': its cache');
    // Every branch with an interface has its data.js in its own folder.
    if (b.api) ok(!!b.data, b.family + ': ' + b.dir + '/data.js is there', b.family + ': no ' + b.dir + '/data.js for ' + b.api);
    if (!b.data) return;
    const m = b.data;
    const src = code(path.join(RUN, m));
    // Its branches, the strings it gives its names to (var ITEMS = 'desk'), are named by it alone: no other file hands a
    // path of them to a spirit.data reader or writer (D.get('desk/' + id), data.watch("deskItem/...")).
    const owned = []; const re = /\bvar\s+[A-Z][A-Z_]*\s*=\s*'([a-zA-Z]\w*)'\s*;/g; let x;
    while ((x = re.exec(src))) if (owned.indexOf(x[1]) === -1) owned.push(x[1]);
    test.comment(m + ' names the branches ' + owned.join(', '));
    owned.forEach(function (name) {
      const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + name + '(?:/|[\'"])');
      const others = readers.filter(function (f) { return pathOf.test(code(path.join(RUN, f))); });
      ok(!others.length, name + ': named by ' + m + ' alone; every other file asks it', name + ': its paths are named outside ' + m + ', by ' + short(others));
    });
    // ONE PATTERN (goal/G43.7, the box: "ALL ... files will be converted to "data.js" files", "using the module
    // spirit/data.js", "with the SAME pattern"; from ./data-families.js): the old file is gone, and the guard, the attach
    // and the write on spirit are spirit/data.js's, none of it rolled by the family by hand.
    const OLD_MANAGER = 'clientCache' + 'Manager';
    ok(!has(b.dir + '/' + OLD_MANAGER + '.js'), b.dir + ': the old file is gone', b.dir + ': ' + b.dir + '/' + OLD_MANAGER + '.js still stands');
    ok(!/Symbol\.for|function attach|\.spirit\s*=|spirit\.[A-Za-z]+Data\s*=/.test(src), m + ': rolls none of it by hand', m + ': data.js still rolls its own guard, attach or spirit write');
    // The one difference is the disk: no manager touches a file or the browser's storage.
    const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(src);
    ok(!disk, m + ': it touches no file and no browser storage', m + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may');
    // One contract: required, it stands at spirit.data.<name> through spirit.data.makeFamily, the name it hands
    // makeFamily, never guessed from its folder.
    const named = /makeFamily\(\s*['"]([^'"]+)['"]/.exec(src);
    const name = named ? named[1] : '';
    // EVERY BRANCH IS NAMED AS ITS FOLDER (goal/G43.31; Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
    // motherfucking <name> in spirit/app/<name>....", and "make sure, IN THIS ITEM that family names MATCH folder names").
    ok(name === b.name, m + ': it makes the branch ' + b.name + ', its folder\'s name', m + ': it makes the branch ' + (name || 'none') + ' in the folder ' + b.name);
    let mod = null;
    try { mod = require(path.join(RUN, m)); } catch (e) { mod = { threw: e.message }; }
    ok(!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object')), m + ': it loads' + (mod && mod.cache ? ', and exports its cache rules' : ''), m + ': it exports ' + short(mod && Object.keys(mod)));
    const f = name ? require(DATA)[name] : null;
    ok(!!f && !!f.data && typeof f.data === 'object' && !!f.cache && typeof f.cache === 'object', m + ': in node it stands at spirit.data.' + name + ', its data and its cache, for clients to ask', m + ': spirit.data.' + name + ' is ' + short(f));
    // A BRANCH'S WATCH IS CALLED watch (Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called "watch"", "the
    // branch is already implied in it's containing object.", "wsl, assert this in a test for branches."): every object
    // its reads hold is a branch, its watch the member named watch and no other (watchFile, watchApp, watchRow are the
    // names it replaces), never told which branch: it takes the function, and at most the row it narrows to.
    if (!f || !f.data || typeof f.data !== 'object') { test.fail(m + ': no reads to judge at spirit.data.' + name); return; }
    const others = []; const told = []; const watches = []; const seen = [];
    (function walk(o, at, depth) {
      if (!o || typeof o !== 'object' || depth > 4 || seen.indexOf(o) !== -1) return;
      seen.push(o);
      Object.keys(o).forEach(function (k) {
        let v;
        try { v = o[k]; } catch (e) { return; }
        const here = at ? at + '.' + k : k;
        if (/^watch./.test(k)) others.push(here);
        if (k === 'watch' && typeof v === 'function') { watches.push(here); if (v.length > 2) told.push(here + ' takes ' + v.length); }
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, here, depth + 1);
      });
    }(f.data, '', 0));
    ok(!others.length, m + ': no branch of spirit.data.' + name + ' names its watch other than watch' + (watches.length ? ' (' + watches.join(', ') + ')' : ''),
      m + ': spirit.data.' + name + '.data names a watch other than watch: ' + short(others));
    ok(!told.length, m + ': no watch of spirit.data.' + name + ' is told its branch: each takes the function and at most its row',
      m + ': a watch of spirit.data.' + name + ' takes more than its row and its function, so it is told its branch: ' + short(told));
  });
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

async function nodeRules() {
  const served = TARGETS.filter(function (b) { return b.api && b.verbs; });
  if (!served.length) return;
  const node = await H.scratchNode();
  const raw = function (call, args) {
    const c = new AbortController();
    const timer = setTimeout(function () { c.abort(); }, ASK_MS);
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }), signal: c.signal })
      .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { body = null; } return { status: r.status, body: body, text: t }; }); },
        function (e) { return { status: 0, body: null, text: c.signal.aborted ? 'no answer in ' + (ASK_MS / 1000) + ' s' : String(e && e.message) }; })
      .then(function (r) { clearTimeout(timer); return r; });
  };
  let page = null;
  try {
    if (!node.up) { served.forEach(function (b) { test.fail(b.dir + ': the scratch node did not come up: nothing judged'); }); return; }
    // An app's branch is served once its server runs (the owner's app.active); the node's own are served by the node.
    for (const b of served) {
      if (b.kind !== 'app') continue;
      const on = await raw('app.active', { key: b.name, active: true });
      ok(on.status === 200, b.dir + ': the world: the ' + b.name + ' app is switched on', b.dir + ': app.active ' + b.name + ' answered ' + on.status + ' ' + short(on.text));
    }
    let tree = {};
    await H.until(function () {
      return raw('api', {}).then(function (r) { tree = r.body || {}; return served.every(function (b) { const t = tree[b.family]; return t && typeof t === 'object' && t.ok !== false && Object.keys(t).length > 0; }); });
    }, 60000);

    test.subHeading('required on the node');
    placedRules(path.join(node.root, 'spirit', 'run'), served);
    for (const b of served) {
      test.subHeading(b.dir + ': on a node');
      const branch = tree[b.family] && typeof tree[b.family] === 'object' && tree[b.family].ok !== false ? tree[b.family] : null;
      ok(!!branch, b.dir + ': the node\'s api tree holds the branch ' + b.family, b.dir + ': the node\'s api tree holds no branch ' + b.family + ': ' + short(tree[b.family]));
      if (!branch) continue;
      // The interface the node serves for it is its own api.js (goal/G43.27, requirement 2: server.js familyDir looks for
      // spirit/app/<name>/api.js, appServer.js withAgents takes the app folder itself as the family folder).
      const fam = await raw('api', { family: b.family });
      const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
      const mine = fs.readFileSync(path.join(RUN, b.api), 'utf8').replace(/\r\n/g, '\n');
      ok(fam.status === 200 && iface === mine, b.dir + ': the interface the node serves is ' + b.api, b.dir + ': api {family: ' + b.family + '} answered ' + fam.status + (iface ? ', an interface that is not ' + b.api : ' ' + short(fam.text)));
      // It serves exactly the verbs its own api.js declares (goal/G43.20; Andy: "IN THIS ONE, OR WE'LL NEVER GET FUCKING
      // DONE.", "WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."), no
      // FS set among them. Beyond an api.js only by decision: appServer's DEBUG on every server (desk/G2.5: "DEBUG
      // auto-verb supplied by appServer is approved."), and desk's item.rules.add and item.rules.remove, his alone and left
      // out of its api.js on purpose (goal/G40.12, desk's api.js header).
      const declared = Object.keys(b.verbs);
      const offered = Object.keys(branch);
      const decided = ['DEBUG'].concat(b.family === 'desk' ? ['item.rules.add', 'item.rules.remove'] : []);
      const extra = offered.filter(function (v) { return declared.indexOf(v) === -1 && decided.indexOf(v) === -1; });
      const missing = declared.filter(function (v) { return offered.indexOf(v) === -1; });
      ok(!extra.length && !missing.length, b.dir + ': serves exactly the ' + declared.length + ' verbs of its api.js', b.dir + ': ' + (extra.length ? extra.length + ' served beyond its api.js (' + short(extra.slice(0, 6)) + ')' : '') + (missing.length ? ' ' + missing.length + ' declared and not served ' + short(missing.slice(0, 6)) : ''));
      ok(!offered.some(function (v) { return /^FS\./.test(v); }), b.dir + ': its branch carries no FS set', b.dir + ': it carries ' + short(offered.filter(function (v) { return /^FS\./.test(v); })));
      // EVERY BROKEN CALL IS REFUSED AT THE DOOR (goal/G41.30; Andy, of "only the spirit object checks those rules, on the
      // caller's side. A raw call to /api/spirit, the attacker's way, reaches the handler unchecked": "this needs fixing in
      // this item."; an app's in its own process, decided 9): from its declaration, a raw call over http, no spirit
      // object, breaks each verb's arguments three ways, an argument of the wrong type, a required one left out, one no
      // verb names; each must answer a 4xx with a code, before the handler runs.
      const asks = [];
      declared.forEach(function (v) { asksFor(b.family, v, b.verbs[v]).forEach(function (a) { asks.push(a); }); });
      if (!asks.length) { test.comment(b.dir + ': it declares no verb, so no call to break'); continue; }
      const wrong = [];
      let seen = 0;
      for (let i = 0; i < asks.length; i += BATCH) {
        const batch = asks.slice(i, i + BATCH);
        const got = await Promise.all(batch.map(function (a) { return raw(a.fam + '.' + a.verb, a.args); }));
        got.forEach(function (r, j) {
          const a = batch[j]; seen += 1;
          const code = r.body && r.body.code;
          if (!(r.status >= 400 && r.status < 500 && typeof code === 'string' && code && code !== 'handler-failed')) wrong.push(a.verb + ': ' + a.why + ' answered ' + r.status + ' ' + short(r.text));
        });
      }
      ok(seen === asks.length && !wrong.length, '/api/spirit ' + b.family + ': all ' + asks.length + ' broken calls refused at the door, a 4xx with a code',
        '/api/spirit ' + b.family + ': ' + (seen !== asks.length ? 'only ' + seen + ' of ' + asks.length + ' thrown; ' : '') + wrong.length + ' of ' + asks.length + ' broken calls not refused; first: ' + wrong.slice(0, 3).join(' | '));
    }

    // FOUND BY ITS NAME, ON A PAGE (goal/G43.27; Andy: "less path elements get priority, - the target needs an api.js"):
    // a page asks for the branch by its name alone, spirit.cacheManager, and gets its own data.js, and no data.js that
    // is not there.
    const withData = served.filter(function (b) { return b.data; });
    if (!withData.length) return;
    page = await H.chromePage(H.findChrome());
    let got = null;
    if (page && !page.error) {
      await page.send('Page.navigate', { url: node.base + '/' });
      await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
      got = await page.evaluate('Promise.resolve(window.spirit.ready).then(function () { return Promise.all(' + JSON.stringify(withData.map(function (b) { return b.family; })) + '.map(function (n) { return window.spirit.cacheManager(n).then(function () { var f = (window.spirit.data || {})[n]; return [n, "ok", !!f && typeof f.data === "object" && typeof f.cache === "object"]; }, function (e) { return [n, String((e && e.message) || e), false]; }); })); })');
    }
    const heard = page && page.heard ? page.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).map(function (m) { return { url: m.params.response.url.replace(node.base, '').replace(/^\//, ''), status: m.params.response.status }; }) : [];
    const said = {}; const both = {}; (got || []).forEach(function (r) { said[r[0]] = r[1]; both[r[0]] = r[2]; });
    withData.forEach(function (b) {
      test.subHeading(b.dir + ': found by its name');
      const fetched = heard.some(function (a) { return a.url === b.data && a.status === 200; });
      const missed = heard.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404 && a.url.split('/').slice(-2, -1)[0] === b.family; });
      ok(said[b.family] === 'ok' && fetched, b.dir + ': a page asking for ' + b.family + ' by its name gets ' + b.data, b.dir + ': ' + b.family + ' answered ' + short(said[b.family] || (page && page.error) || 'nothing') + ', ' + b.data + ' fetched ' + fetched);
      ok(!missed.length, b.dir + ': no data.js of ' + b.family + ' was asked that is not there (no 404)', b.dir + ': asked and missed: ' + short(missed));
      // The box (goal/G43.7): "spirit.data.<name>.data" and "spirit.data.<name>.cache", on the page as in node.
      ok(both[b.family] === true, b.dir + ': on the page spirit.data.' + b.family + ' has data and cache', b.dir + ': on the page spirit.data.' + b.family + ' lacks data or cache');
    });
    // The node serves each one as a script that calls spirit.data.makeFamily (was data-caches.js, 6: "the shell can
    // introspect to find and download their clientCacheManagers.").
    for (const b of withData) {
      const got = await fetch(node.base + '/' + b.data).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
      ok(got.status === 200 && got.text.indexOf('.makeFamily(') !== -1, b.family + ': the shell downloads its manager, /' + b.data, b.family + ': /' + b.data + ' answered ' + got.status);
    }
  } finally {
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

test.startTest('spirit-sibling-branchRules.js: every rule of a branch, judged on ' + (asked || 'every branch folder') + ' (goal/G43.32)');

(async function () {
  test.subHeading('the branches');
  if (asked && !TARGETS.length) {
    test.fail(asked + ' is no branch folder: a system branch is spirit/<name>/ with api.js and data.js, an app branch spirit/app/<name>/ with <name>.js and <name>.json');
    return;
  }
  test.comment(TARGETS.length + ' of ' + ALL.length + ' branches: ' + TARGETS.map(function (b) { return b.dir; }).join(', '));
  if (!asked) ok(ALL.length >= 20 && ALL.some(function (b) { return b.dir === 'spirit/app/desk'; }) && ALL.some(function (b) { return b.dir === 'spirit/fs'; }), 'the world: ' + ALL.length + ' branch folders recognized, an app\'s (desk) and a system one (fs) among them', 'only ' + short(ALL.map(function (b) { return b.dir; })) + ': nothing judged');
  interfaceRules();
  appRules();
  cacheRules();
  await nodeRules();
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
