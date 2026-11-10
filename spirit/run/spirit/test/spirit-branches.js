'use strict';

// spirit/run/spirit/test/spirit-branches.js
// EVERY BRANCH, EVERY RULE OF A BRANCH, ONE TEST OUTSIDE EVERY BRANCH (goal/G43.32; spec: ./spirit-branches.md). Andy: "make
// sure nobody can add an app implementing a family, without adhering to the rules, this means that a test outside of each
// branch must assert this.", "such a general test must therefore "recognize" a branch folder, and assert all rulers
// relating to branches.", and to Q6, "Shall wsl gather the 8 branch rules (in chat) into one new spirit/test/branches.js
// that finds every api.js folder itself, removing their copies from the 6 tests?": "absolutely, AND MAKE SURE NO TEST GETS
// LOST." Named after spirit.js, which finds the branches (familyPath, cacheManager): a test named after no module is
// garbage (spirit-sibling-noFuckingGarbage). The tests it took in, each a section below, whole: spirit-familyFinder.js,
// data-caches.js, apiDoor-familyGate.js, server-appFamily.js, introSpector-branchVerbs.js.
//
//   0. a branch folder is recognized: a folder whose api.js is a module (module.exports); each loads, declares its verbs,
//      stands where its family is found, and, required on the node, at spirit.required.<its path>, its verbs bound;
//   A. a family found by its name: the fewest path elements, an api.js there, no name twice (was spirit-familyFinder.js);
//   B. every family's cache, one code in the browser and in node (was data-caches.js), every recognized branch judged;
//   C. the node's own families have a gate at the door (was apiDoor-familyGate.js);
//   D. the node finds an app's family at the app's top (was server-appFamily.js);
//   E. every api branch serves exactly the verbs its own api.js declares (was introSpector-branchVerbs.js).
// Scratch nodes only; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync, execFileSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }

// NOBODY ADDS A FAMILY PAST THE RULES (goal/G43.32; Andy: "make sure nobody can add an app implementing a family, without
// adhering to the rules, this means that a test outside of each branch must assert this."): the tree is every file git
// keeps and every file not yet added that git does not ignore, so a new app's family is judged before it is committed.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

// ── 0. A BRANCH FOLDER, RECOGNIZED ──────────────────────────────────────────────────────────────────────────────────
// Andy: "such a general test must therefore "recognize" a branch folder". A branch folder is a folder holding an api.js
// that is a module (module.exports): its interface. An api.js that is a page script (spirit/element/search/api.js, the
// app-server selector, an element) is no branch. A test folder's api.js is a test, not a branch.
const BRANCHES = tracked.filter(function (f) {
  return /(^|\/)api\.js$/.test(f) && !/(^|\/)test\//.test(f) && !/node_modules\//.test(f) && !VENDORED_FOLDERS.holds(f) && /\bmodule\.exports\b/.test(code(path.join(RUN, f)));
}).sort();
// A branch's name is its folder's: spirit/<name>/api.js, spirit/app/<name>/api.js, and spirit/app/api.js is app.
function nameOf(api) { const parts = api.split('/'); return parts[parts.length - 2]; }

// On the node, in a process of its own: each branch's api.js required as every script is (spirit.require), and what that
// placed and bound. Decided 8 (the box): "A branch's api.js is placed at spirit.required.spirit.<branch-path>.api and also
// binds the branch."
const PLACED = `
// node -e: the arguments start at argv[1].
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

function recognized() {
  test.subHeading('0. a branch folder is recognized by its api.js, and each one keeps every rule of a branch');
  test.comment(BRANCHES.length + ' branches: ' + BRANCHES.join(', '));
  ok(BRANCHES.length >= 10 && BRANCHES.indexOf('spirit/app/desk/api.js') !== -1 && BRANCHES.indexOf('spirit/fs/api.js') !== -1,
    'the world: ' + BRANCHES.length + ' branch folders recognized, an app\'s (desk) and a system one (fs) among them', 'only ' + short(BRANCHES) + ': nothing judged');
  ok(tracked.indexOf('spirit/element/search/api.js') !== -1 && BRANCHES.indexOf('spirit/element/search/api.js') === -1,
    'the world: spirit/element/search/api.js, a page script, is no branch', 'spirit/element/search/api.js is not as read: ' + (BRANCHES.indexOf('spirit/element/search/api.js') !== -1 ? 'taken for a branch' : 'not in the tree'));
  BRANCHES.forEach(function (api) {
    const name = nameOf(api);
    // Decided 7 (the box): "Verb rules live in api.js". Each verb a declaration of its arguments, each argument's rule.
    let mod = null;
    try { mod = require(path.join(RUN, api)); } catch (e) { mod = { threw: e.message }; }
    const verbs = mod && mod.verbs;
    const odd = verbs && typeof verbs === 'object' ? Object.keys(verbs).filter(function (v) { const d = verbs[v]; return !d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(function (k) { return typeof d[k] !== 'string' && !(d[k] && typeof d[k] === 'object'); }); }) : [];
    ok(!!mod && !mod.threw && !!verbs && typeof verbs === 'object' && !Array.isArray(verbs) && !odd.length,
      api + ': it loads, and declares each verb\'s arguments and their rules (' + Object.keys(verbs || {}).length + ' verbs)',
      api + ': ' + (mod && mod.threw ? 'it does not load: ' + mod.threw : !verbs ? 'it declares no verbs' : 'verbs not declared as arguments and rules: ' + short(odd)));
    // Where it stands is where its family is found (goal/G43.27: spirit/<name>/, spirit/app/<name>/, the fewest path
    // elements): a branch folder anywhere else is one no finder reaches.
    ok(familyPath(name) === api, api + ': it is where the family ' + name + ' is found', api + ': the family ' + name + ' is found at ' + short(familyPath(name)) + ', not here');
  });
  const ran = spawnSync(process.execPath, ['-e', PLACED, RUN, JSON.stringify(BRANCHES)], { cwd: RUN, encoding: 'utf8', timeout: 120000 });
  let got = {}; try { got = JSON.parse(String(ran.stdout || '').trim().split('\n').pop()); } catch (e) { got = {}; }
  ok(Object.keys(got).length === BRANCHES.length, 'the world: every branch required on the node, in a process of its own', 'the process answered ' + short(ran.stdout || ran.stderr));
  BRANCHES.forEach(function (api) {
    const g = got[api] || { threw: 'not required' };
    const at = 'spirit.required.' + api.replace(/\.js$/, '').split('/').join('.');
    ok(!g.threw && g.placed && !g.unbound.length && g.same,
      api + ': required on the node, it stands at ' + at + ', and binds its ' + g.verbs + ' verbs on spirit.' + nameOf(api),
      api + ': ' + (g.threw ? 'its require threw: ' + g.threw : (!g.placed ? 'it does not stand at ' + at + '; ' : '') + (g.unbound && g.unbound.length ? 'verbs not bound: ' + short(g.unbound) + '; ' : '') + (!g.same ? 'spirit.' + nameOf(api) + ' is not what it bound' : '')));
  });
}

// ── A. A FAMILY FOUND BY ITS NAME (was spirit-familyFinder.js, goal/G43.27) ─────────────────────────────────────────
// Andy: "make sure there's a test for the module searching for api's that makes sure those rules are followed - less path
// elements get priority, - the target needs an api.js - and duplicate <name>/api.js raise a red.", and "spirit/app/contact/
// does NOT have an api.js". The tree read as it is; the finding judged on a real page (headless Chrome) of a scratch node,
// folders planted into its copy that break each rule.
async function finder() {
  // Every family interface under a run folder, by its name: <name>/api.js where a family lives (spirit/<name>/,
  // spirit/app/<name>/, process/js/<name>/ and its family/ folder).
  function interfaces(run, files) {
    const by = {};
    files.forEach(function (f) {
      const m = /^spirit\/(?:app\/)?([^/]+)\/api\.js$/.exec(f) || /^process\/js\/([^/]+)\/(?:family\/)?api\.js$/.exec(f);
      if (!m || m[1] === 'app' && f === 'spirit/app/api.js') { if (f === 'spirit/app/api.js') (by.app = by.app || []).push(f); return; }
      (by[m[1]] = by[m[1]] || []).push(f);
    });
    return by;
  }
  function walk(dir, base, out) {
    (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []).forEach(function (e) {
      if (e.name === 'node_modules' || e.name === 'state' || e.name === '.git' || e.name === 'test') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
    });
    return out;
  }
  test.subHeading('A. a family found by its name: the world');
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); }).map(function (f) { return f.slice('spirit/run/'.length); });
  const by = interfaces(RUN, files);
  ok(Object.keys(by).length >= 10 && by.contact && by.relay, 'the world: ' + Object.keys(by).length + ' family names with an api.js in the tree, contact and relay among them', 'only ' + short(Object.keys(by)) + ': nothing judged');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact', 'api.js')), 'the world: spirit/app/contact/ is an app folder with no api.js (Andy: "spirit/app/contact/ does NOT have an api.js")', 'spirit/app/contact/ is not as Andy said');

  test.subHeading('A3. no <name>/api.js twice in the tree');
  const twice = Object.keys(by).filter(function (n) { return by[n].length > 1; });
  ok(!twice.length, 'no family name has two api.js', twice.length + ' do: ' + short(twice.map(function (n) { return by[n]; })));

  // A scratch node, then folders planted into its copy that break each rule.
  const node = await H.scratchNode();
  ok(!!node.up && !!node.root, 'the world: a scratch node is up, on its own copy of the tree', 'the scratch node did not come up: nothing judged');
  const sRun = node.root ? path.join(node.root, 'spirit', 'run') : '';
  function plant(rel, text) { const f = path.join(sRun, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
  const MARK = function (where) { return '(window.__planted = window.__planted || []).push(' + JSON.stringify(where) + ');\n'; };
  if (sRun) {
    // Rule 2: a folder of the name without api.js is never the target (spirit/app/contact/ has a data.js, no api.js).
    plant('spirit/app/contact/data.js', MARK('spirit/app/contact'));
    // Rule 1: the same name with an api.js one level deeper loses to spirit/relay/ (and is a duplicate, rule 3).
    plant('spirit/app/relay/api.js', 'module.exports = { verbs: {} };\n');
    plant('spirit/app/relay/data.js', MARK('spirit/app/relay'));
  }

  test.subHeading('A3. a duplicate is seen');
  const planted = interfaces(sRun, walk(sRun, sRun, []));
  ok(!!planted.relay && planted.relay.length === 2, 'the check sees the planted second relay/api.js (spirit/relay/ and spirit/app/relay/)', 'the check saw ' + short(planted.relay));

  test.subHeading('A1, A2. a page finds each family where the rules say');
  const page = node.up ? await H.chromePage(H.findChrome()) : null;
  let got = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    got = await page.evaluate("Promise.resolve(window.spirit.ready).then(function () { return Promise.all(['contact', 'relay', 'agent'].map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); }).then(function (r) { return { said: r, planted: window.__planted || [] }; })");
  }
  ok(!!got, 'the world: the page asked contact, relay and agent', 'the page asked nothing: ' + short(page && page.error));
  const asked = page ? page.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).map(function (m) { return { url: m.params.response.url.replace(node.base, '').replace(/^\//, ''), status: m.params.response.status }; }) : [];
  const fetched = function (p) { return asked.some(function (a) { return a.url === p && a.status === 200; }); };
  const said = {}; ((got && got.said) || []).forEach(function (r) { said[r[0]] = r[1]; });
  const ran = (got && got.planted) || [];
  ok(said.contact === 'ok' && fetched('spirit/contact/data.js') && ran.indexOf('spirit/app/contact') === -1, '2. contact is spirit/contact/: spirit/app/contact/ has no api.js, and its data.js never runs', 'contact: ' + short(said.contact) + ', spirit/contact/data.js fetched ' + fetched('spirit/contact/data.js') + ', the planted spirit/app/contact/data.js ran ' + (ran.indexOf('spirit/app/contact') !== -1));
  ok(said.relay === 'ok' && fetched('spirit/relay/data.js') && ran.indexOf('spirit/app/relay') === -1, '1. relay is spirit/relay/, the fewer path elements, over spirit/app/relay/', 'relay: ' + short(said.relay) + ', spirit/relay/data.js fetched ' + fetched('spirit/relay/data.js') + ', spirit/app/relay/data.js ran ' + (ran.indexOf('spirit/app/relay') !== -1));
  // An app's own family (the agent app: spirit/app/agent/api.js, and no spirit/agent/), found where its api.js is.
  ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'api.js')) && !fs.existsSync(path.join(RUN, 'spirit', 'agent')), 'the world: the agent\'s api.js is in spirit/app/agent/ alone', 'the agent app is not as read: nothing judged');
  ok(said.agent === 'ok' && fetched('spirit/app/agent/data.js'), 'an app\'s family is found where its api.js is: spirit/app/agent/', 'agent: ' + short(said.agent) + ', spirit/app/agent/data.js fetched ' + fetched('spirit/app/agent/data.js'));
  const missed = asked.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404; });
  ok(!missed.length, 'no data.js was asked that is not there (no 404)', missed.length + ' asked and missed: ' + short(missed));
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();
  await H.sleep(300);
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  // goal/G43.20, its box: "a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js, a job is named by its
  // route, and nothing falls back to process/js/<name>". In a process: the path spirit.familyPath gives is the family's own
  // api.js, a system family's in spirit/<name>/, an app's in spirit/app/<name>/, and none names process/js.
  test.subHeading('A. goal/G43.20: in a process, a family\'s path is its own api.js, and nothing falls back to process/js');
  const paths = JSON.parse(spawnSync(process.execPath, ['-e',
    "require('./spirit/spirit.js'); console.log(JSON.stringify({ fs: spirit.familyPath('fs'), desk: spirit.familyPath('desk'), agent: spirit.familyPath('agent'), none: spirit.familyPath('zzNoSuchFamily') }));"],
    { cwd: RUN, encoding: 'utf8' }).stdout || '{}');
  ok(paths.fs === 'spirit/fs/api.js', 'a system family\'s path is spirit/<name>/api.js: fs is spirit/fs/api.js', 'fs: ' + short(paths.fs));
  ok(paths.desk === 'spirit/app/desk/api.js' && paths.agent === 'spirit/app/agent/api.js', 'an app\'s path is spirit/app/<name>/api.js: desk and agent', 'desk: ' + short(paths.desk) + ', agent: ' + short(paths.agent));
  ok(Object.keys(paths).length === 4 && !/process\/js/.test(JSON.stringify(paths)), 'no path names process/js, a name of no family\'s included', 'paths: ' + short(paths));
}

// ── B. EVERY FAMILY'S CACHE, ONE CODE IN THE BROWSER AND IN NODE (was data-caches.js, goal/G41.28) ──────────────────
// Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a node.js
// Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference is the
// appServer serializes the cache to disk."
//   1. every recognized branch has a data.js beside its api.js;
//   2. one code: the browser and appServer load the same data set file and the same family file, and nothing else in the
//      tree keeps a family's cache: its branches are named by its data.js alone;
//   3. the same rows make the same cache in node and in a page;
//   4. the one difference is the disk: no data.js touches a file or the browser's storage, and appServer writes the cache;
//   5. every family's data.js is the same: required, it stands at spirit.data.<name> through spirit.data.makeFamily;
//   6. the shell finds and downloads them by introspection (Andy, on G41.28: "We're not done until every family of the
//      API tree as a clientCacheManager, and clients can use that to organize their spirit.data, and the shell can
//      introspect to find and download their clientCacheManagers.");
//   7. nothing keeps node rows but spirit.data, and no file names another way;
//   8. a branch's watch is called watch, and is never told its branch.
async function caches() {
  // An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
  function managerOf(name) {
    if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
    return 'spirit/' + name + '/data.js';
  }

  // 1. EVERY FAMILY: every branch folder recognized in 0 (Andy: "such a general test must therefore "recognize" a branch
  // folder, and assert all rulers relating to branches.").
  test.subHeading('B1. every family in the api tree has a data.js in its own folder');
  test.comment(BRANCHES.length + ' families: ' + BRANCHES.map(function (f) { return f.split('/').slice(-3, -1).join('/'); }).join(', '));
  ok(BRANCHES.length > 0, 'the api tree has ' + BRANCHES.length + ' families', 'no family found in the tree');
  BRANCHES.forEach(function (api) {
    const manager = api.replace(/api\.js$/, 'data.js');
    ok(tracked.indexOf(manager) !== -1, nameOf(api) + ': ' + manager + ' is there', nameOf(api) + ': no ' + manager + ' for ' + api);
  });

  // 2. ONE CODE
  test.subHeading('B2. the browser and node load the same files, and nothing else keeps a family\'s cache');
  const spiritJs = code(path.join(RUN, 'spirit', 'spirit.js'));
  const appServer = code(path.join(RUN, 'spirit', 'appServer.js'));
  // Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
  // repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
  // goal/G43.32: appServer loads it by spirit.require and its run-root path, as every script loads the tree.
  ok(/['"]spirit\/data\.js['"]/.test(spiritJs) && /\.require\(\s*['"]spirit\/data\.js['"]\s*\)/.test(appServer),
    'the data set is one file: spirit.js brings spirit/data.js to a page, and appServer requires the same file', 'spirit.js or appServer.js loads a data set from somewhere else than spirit/data.js');
  ok(tracked.indexOf('spirit/data.js') !== -1, 'the data set is spirit/data.js', 'spirit/data.js is not tracked');
  ok(/path\.dirname\(\s*spirit\.familyPath\([^;]{0,60}?\)\s*\)\s*,\s*['"]data\.js['"]/.test(appServer),
    'appServer takes a family\'s cache from the family\'s own data.js', 'appServer finds a family\'s cache somewhere else than the family\'s folder');
  const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/data.js' && !/\/test\//.test(f); });
  // What each manager names: its branches, the strings it gives its names to (var ITEMS = 'desk').
  const owned = {};
  managers.forEach(function (m) {
    const re = /\bvar\s+[A-Z][A-Z_]*\s*=\s*'([a-zA-Z]\w*)'\s*;/g; let x; const src = code(path.join(RUN, m));
    while ((x = re.exec(src))) owned[x[1]] = m;
  });
  test.comment('branches named by their managers: ' + Object.keys(owned).map(function (b) { return b + ' (' + owned[b] + ')'; }).join(', '));
  const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|\/vendor\//.test(f) && !VENDORED_FOLDERS.holds(f) && managers.indexOf(f) === -1; });
  Object.keys(owned).forEach(function (b) {
    // A path into the branch handed to a spirit.data reader or writer: D.get('desk/' + id), data.watch("deskItem/...").
    const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + b + '(?:/|[\'"])');
    const others = readers.filter(function (f) { return pathOf.test(code(path.join(RUN, f))); });
    ok(!others.length, b + ': named by ' + owned[b] + ' alone; every other file asks it', b + ': its paths are named outside ' + owned[b] + ', by ' + short(others));
  });

  // 3. THE SAME ROWS, THE SAME CACHE
  test.subHeading('B3. the same rows make the same spirit.data in node and in a page');
  const DATA = path.join(RUN, 'spirit', 'data.js');
  const DESK = path.join(RUN, managerOf('desk'));
  const ROWS = [
    { verb: 'goal.whole', change: 3, item: { id: 'goal/G9', goal: '', title: 'A goal', status: 'open' } },
    { verb: 'goal.whole', change: 3, item: { id: 'goal/G9.1', goal: 'goal/G9', title: 'An item', status: 'open', tags: ['a'] } },
    { verb: 'item.set', change: 4, item: JSON.stringify({ id: 'goal/G9.2', goal: 'goal/G9', title: 'Another', status: 'build' }) },
    { rule: 'rule/1', row: { key: 'rule/1', label: 'A rule', status: 'active' }, change: 5 },
  ];
  // The node that served the rows: a public key holding a + and a /, as real keys do. Andy, the box: "The RAM-CACHE-is
  // organized BY SERVER-NODE-ID at it's lowest level. IE: spirit.data.<server-public-key-in-base64url>.<api-family>....".
  // Both sides are told it the one way the data set offers, homeNode(key): a page learns it from node.card, a process from
  // the sender whose rows it takes.
  const SERVER = Buffer.from('KEY-CACHES\xfb\xef\xbf\xfe', 'latin1').toString('base64');
  const SERVER_ID = Buffer.from(SERVER, 'base64').toString('base64url');
  // In node, as appServer runs them: the data set required, then the family's data.js, on the process's global.
  // goal/G43.32: the data set and the family's data.js are spirit.require()d, as appServer and the family's file load them,
  // so both hold the one instance at spirit.required.spirit.data.
  function inNode() {
    let out = null;
    try {
      const S = require(path.join(RUN, 'spirit', 'spirit.js'));
      const D = S.require('spirit/data.js');
      S.require(path.relative(RUN, DESK).split(path.sep).join('/'));
      D.homeNode(SERVER);
      ROWS.forEach(function (r) { D.desk.data.published(JSON.parse(JSON.stringify(r))); });
      out = JSON.parse(JSON.stringify(D.desk.cache));
    } catch (e) { out = { threw: e.message }; }
    return out;
  }
  // In a page's window, as a page runs them: both files run as scripts, with no module and no require.
  function inPage() {
    const win = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math, Date: Date, Error: Error, Promise: Promise };
    win.window = win; win.spirit = {};
    vm.createContext(win);
    try {
      vm.runInContext(fs.readFileSync(DATA, 'utf8'), win, { filename: 'spirit/data.js' });
      vm.runInContext(fs.readFileSync(DESK, 'utf8'), win, { filename: 'data.js' });
      if (!win.spirit.data.desk) return { threw: 'the page has no spirit.data.desk once both files ran' };
      win.spirit.data.homeNode(SERVER);
      ROWS.forEach(function (r) { win.spirit.data.desk.data.published(JSON.parse(JSON.stringify(r))); });
      return JSON.parse(JSON.stringify(win.spirit.data.desk.cache));
    } catch (e) { return { threw: e.message }; }
  }
  const inN = inNode();
  const inP = inPage();
  ok(!inN.threw && Object.keys(inN).length > 0, 'in node, as appServer runs it, the rows land in spirit.data.desk.cache: ' + Object.keys(inN).join(', '), 'in node: ' + short(inN));
  ok(!inP.threw && Object.keys(inP).length > 0, 'in a page, as a page runs it, the rows land in spirit.data.desk.cache: ' + Object.keys(inP).join(', '), 'in a page: ' + short(inP));
  ok(!inN.threw && JSON.stringify(Object.keys(inN)) === JSON.stringify([SERVER_ID]) && inN[SERVER_ID] && typeof inN[SERVER_ID] === 'object',
    'its top level is the serving node alone, its key in base64url (Q5)', 'in node the top level is ' + short(Object.keys(inN)) + ', not ' + SERVER_ID);
  ok(!inN.threw && !inP.threw && JSON.stringify(inN) === JSON.stringify(inP), 'the same rows make the same spirit.data.desk.cache in node and in a page', 'node ' + short(inN) + ' against the page ' + short(inP));

  // 4. THE ONE DIFFERENCE IS THE DISK
  test.subHeading('B4. the one difference: appServer writes the cache to disk, no manager does');
  managers.forEach(function (m) {
    const src = code(path.join(RUN, m));
    const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(src);
    ok(!disk, m + ': it touches no file and no browser storage', m + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may');
  });
  ok(/cacheFile\(/.test(appServer) && /writeFileSync\([^)]*\.tmp/.test(appServer), 'appServer writes each sender\'s cache to its own file on disk', 'appServer writes no cache to disk');
  const writers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/appServer.js' && /cache[^'"]*\.json/.test(code(path.join(RUN, f))) && /writeFile/.test(code(path.join(RUN, f))); });
  ok(!writers.length, 'no other module writes a cache file of its own', 'a cache file written by ' + short(writers));

  // 5. ONE CONTRACT
  test.subHeading('B5. every family\'s data.js is the same: required, it stands at spirit.data.<name>');
  managers.forEach(function (m) {
    // The family a manager makes is the name it hands makeFamily (spirit/app/chat/data.js makes chat, spirit/app/data.js
    // makes app): never guessed from its folder.
    const named = /makeFamily\(\s*['"]([^'"]+)['"]/.exec(code(path.join(RUN, m)));
    const name = named ? named[1] : '';
    let mod = null;
    try { mod = require(path.join(RUN, m)); } catch (e) { mod = { threw: e.message }; }
    // Cache rules are what appServer needs to keep it on disk, and a family has them when its clients keep a cache file.
    ok(!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object')), m + ': it loads' + (mod && mod.cache ? ', and exports its cache rules' : ''), m + ': it exports ' + short(mod && Object.keys(mod)));
    const f = require(DATA)[name];
    ok(!!f && !!f.data && typeof f.data === 'object' && !!f.cache, m + ': it stands at spirit.data.' + name + ', for clients to ask', m + ': spirit.data.' + name + ' is ' + short(f));
  });

  // 8. A BRANCH'S WATCH IS CALLED watch
  // Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called "watch"", "the branch is already implied in it's
  // containing object.", "wsl, assert this in a test for branches." Every object a family's reads hold, the reads
  // themselves and each object inside them, is a branch: its watch is the member named watch and no other (watchFile,
  // watchApp, watchRow are the names it replaces), and as the branch is the object it sits on, a watch is never told
  // which branch: it takes the function, and at most the row it narrows to (watch(fn), watch(id, fn)).
  test.subHeading('B8. a branch\'s watch is called watch, and is never told its branch');
  managers.forEach(function (m) {
    const named = /makeFamily\(\s*['"]([^'"]+)['"]/.exec(code(path.join(RUN, m)));
    const name = named ? named[1] : '';
    const f = name ? require(DATA)[name] : null;
    if (!f || !f.data || typeof f.data !== 'object') { test.fail(m + ': no reads to judge at spirit.data.' + name); return; }
    const others = [];
    const told = [];
    const watches = [];
    const seen = [];
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

  // 7. NO OTHER WAY
  test.subHeading('B7. nothing keeps node rows but spirit.data, and no file names another way');
  // Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
  // item. no exceptions." A client that takes the node's stream itself keeps rows outside spirit.data: only spirit/data.js
  // takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
  // The node's own side (spirit/, kernel, events) serves the stream and is no client. The client list below names shell/
  // and shell/boot.js; goal/G43.18 moved boot.js and seal.js to spirit/shell/, which the list does not reach, so boot.js
  // stays out by its new place and spirit/shell/seal.js is not read; the apps left in shell/ still are, and every app of
  // spirit/app/, where the apps and the servers moved to (goal/G43.12, G43.17, G43.20).
  const clients = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|spirit\/app)\//.test(f) && f !== 'shell/boot.js'; });
  const takers = clients.filter(function (f) { return /\bevents\.subscribe\(|\bev\.subscribe\(/.test(code(path.join(RUN, f))); });
  ok(!takers.length, 'no client takes the node\'s stream itself: spirit/data.js takes it for all', 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers));
  // "any notion that there is an alternative approach must disappear from all documentation and all comments in the
  // entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
  // branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. Andy's vault is no documentation of the
  // repo's code; this file and its spec name them to find them.
  const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
  const every = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
    return f && /\.(js|md|html|json)$/.test(f) && !/^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/test/spirit-branches.js' && f !== 'spirit/run/spirit/test/spirit-branches.md';
  });
  const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
  ok(!naming.length, 'no file in the repo names a replaced way: running uncached, the two-level desk branches',
    naming.length + ' files still name one: ' + short(naming));

  // 6. FOUND AND DOWNLOADED BY INTROSPECTION
  test.subHeading('B6. the shell finds every family\'s manager by the folder shape, and downloads it (goal/G43.27)');
  ok(/['"]data\.js['"]/.test(spiritJs), 'spirit.js knows where a family\'s data.js lives, so a page finds it by the family\'s name', 'spirit.js names no data.js: a page cannot find a family\'s data.js by itself');
  const node = await H.scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up'); return; }
    const tree = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }, function () { return null; });
    const names = tree && typeof tree === 'object' ? Object.keys(tree).filter(function (k) { return tree[k] && typeof tree[k] === 'object' && tree[k].ok !== false; }) : [];
    test.comment('the node\'s api tree names ' + names.length + ' families: ' + names.join(', '));
    ok(names.length > 0, 'the node\'s api tree names its families', 'the node answered no tree: ' + short(tree));
    // As the shell finds it (spirit.cacheManager, goal/G43.27): an app's manager is spirit/app/<name>/data.js, a node
    // family's spirit/<name>/data.js; no family's FS is asked.
    for (const name of names) {
      const at = managerOf(name);
      const got = await fetch(node.base + '/' + at).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
      ok(got.status === 200 && got.text.indexOf('.makeFamily(') !== -1, name + ': the shell downloads its manager, /' + at,
        name + ': /' + at + ' answered ' + got.status);
    }
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

// ── C. THE NODE'S OWN FAMILIES HAVE A GATE AT THE DOOR (was apiDoor-familyGate.js, goal/G41.30) ─────────────────────
// Andy, of "only the spirit object checks those rules, on the caller's side. A raw call to /api/spirit, the attacker's
// way, reaches the handler unchecked": "this needs fixing in this item."; spirit.js says it already: "The node stays the
// gate and checks everything again.". Each family's spirit/<family>/api.js declares every verb's arguments and each one's
// rule. From that declaration, a raw call over http, no spirit object, breaks the verb's arguments three ways: an argument
// of the wrong type, a required one left out, one no verb names. Each must be refused at the door, a 4xx with a code,
// before the handler runs. A scratch node; a handler that does run does its harm there.
async function door() {
  const ASK_MS = 8000;
  const BATCH = 10;
  // The node's own families: every recognized branch spirit/<family>/api.js that declares verbs.
  function families() {
    return BRANCHES.filter(function (f) { return /^spirit\/[^/]+\/api\.js$/.test(f); }).map(function (f) {
      let verbs = null;
      try { verbs = require(path.join(RUN, f)).verbs; } catch (e) { verbs = null; }
      return { name: nameOf(f), verbs: verbs };
    }).filter(function (f) { return f.verbs && typeof f.verbs === 'object'; });
  }
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
  async function ask(base, a) {
    const c = new AbortController();
    const timer = setTimeout(function () { c.abort(); }, ASK_MS);
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: a.fam + '.' + a.verb, args: a.args }), signal: c.signal });
      const text = await r.text();
      let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, code: body && body.code, text: text };
    } catch (e) { return { status: 0, text: c.signal.aborted ? 'no answer in ' + (ASK_MS / 1000) + ' s' : String(e && e.message) }; } finally { clearTimeout(timer); }
  }

  test.subHeading('C. the node\'s own families have a gate at the door (goal/G41.30)');
  const fams = families();
  const asks = [];
  fams.forEach(function (f) { Object.keys(f.verbs).forEach(function (v) { asksFor(f.name, v, f.verbs[v]).forEach(function (a) { asks.push(a); }); }); });
  test.comment(fams.length + ' families, ' + asks.length + ' raw calls');
  ok(fams.length > 5 && asks.length > 100, 'it reads ' + fams.length + ' families\' declarations, ' + asks.length + ' raw calls to throw', 'only ' + fams.length + ' families and ' + asks.length + ' calls: it judges nothing');
  const node = await H.scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const wrong = {};
    let seen = 0;
    for (let i = 0; i < asks.length; i += BATCH) {
      const batch = asks.slice(i, i + BATCH);
      const got = await Promise.all(batch.map(function (a) { return ask(node.base, a); }));
      got.forEach(function (r, j) {
        const a = batch[j]; seen += 1;
        if (!(r.status >= 400 && r.status < 500 && typeof r.code === 'string' && r.code && r.code !== 'handler-failed')) (wrong[a.fam] = wrong[a.fam] || []).push(a.verb + ': ' + a.why + ' answered ' + r.status + ' ' + short(r.text));
      });
    }
    ok(seen === asks.length, 'all ' + seen + ' calls were answered or timed', 'only ' + seen + ' of ' + asks.length + ' were thrown');
    fams.forEach(function (f) {
      const mine = asks.filter(function (a) { return a.fam === f.name; }).length;
      if (!mine) return;
      const bad = wrong[f.name] || [];
      ok(!bad.length, '/api/spirit ' + f.name + ': all ' + mine + ' broken calls refused at the door, a 4xx with a code', '/api/spirit ' + f.name + ': ' + bad.length + ' of ' + mine + ' broken calls not refused; first: ' + bad.slice(0, 3).join(' | '));
    });
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

// ── D. THE NODE FINDS AN APP'S FAMILY AT THE APP'S TOP (was server-appFamily.js, goal/G43.27, requirement 2) ────────
// server.js's familyDir looks for spirit/app/<name>/api.js, and appServer.js withAgents takes the app folder itself as the
// family folder. Andy: "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system
// api-branches, EXCEPT, api.js sits in a folder ./api.js", "i think the shape needs alignment.". A scratch node with the
// agent app switched on.
async function appFamily() {
  // Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
  function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }
  test.subHeading('D2. the node finds an app\'s family at the app\'s top');
  // A scratch node, the agent app switched on (the owner's app.active), so the node starts its server and serves its family.
  const node = await H.scratchNode();
  ok(!!node.up, 'the world: a scratch node is up', 'the scratch node did not come up: nothing judged');
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  try {
    const on = node.up ? await ask('app.active', { key: 'agent', active: true }) : { status: 0 };
    ok(on.status === 200, 'the world: the agent app is switched on', 'app.active agent answered ' + short(on));
    let fam = { status: 0 };
    await H.until(function () { return ask('api', { family: 'agent' }).then(function (a) { fam = a; return a.status === 200; }); }, 30000);
    const iface = fam.body && typeof fam.body.interface === 'string' ? fam.body.interface.replace(/\r\n/g, '\n') : '';
    ok(fam.status === 200 && iface.length > 0, 'the world: the node serves the agent\'s interface', 'api {family: agent} answered ' + short(fam));
    ok(iface && iface === read('spirit/app/agent/api.js'), 'the interface the node serves is spirit/app/agent/api.js', 'the interface served is not spirit/app/agent/api.js (' + (read('spirit/app/agent/api.js') ? 'it differs' : 'there is no such file') + ')');
    // Its folder is the app folder, and no FS set rides on its branch (goal/G43.20): its files are spirit.fs's, by that path.
    const tree = await ask('api', {});
    ok(tree.status === 200 && tree.body && tree.body.agent && !Object.keys(tree.body.agent).some(function (v) { return /^FS\./.test(v); }), 'the agent branch carries no FS set', 'api: ' + short(tree.body && tree.body.agent));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

// ── E. EVERY API BRANCH SERVES EXACTLY ITS OWN VERBS (was introSpector-branchVerbs.js, goal/G43.20) ─────────────────
// introSpector.js gave every api branch the FS group (G41.28). Andy, on taking it away now that an api id is the path of
// its folder: "IN THIS ONE, OR WE'LL NEVER GET FUCKING DONE.", "WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER
// PLACE, DILIGENTLY WITHOUT FUCKING CHEATING.", and of its two annotation verbs, "ANNOTATIONS WILL BE NODE ONLY." A real
// node on a scratch copy of the tracked files, desk switched on; its api tree read as a page reads it.
async function branchVerbs() {
  test.subHeading('E. every api branch serves exactly the verbs its own api.js declares (goal/G43.20)');
  const node = await H.scratchNode();
  if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  const run = path.join(node.root, 'spirit', 'run');
  try {
    await ask('app.active', { key: 'desk', active: true });
    // Desk's branch is in the tree once its server answers it: until then the tree holds desk's error.
    let tree = {};
    await H.until(function () { return ask('api', {}).then(function (r) { tree = r.body || {}; return !!(tree.desk && tree.desk['items.search']); }); }, 40000);
    const branches = Object.keys(tree).filter(function (b) { return tree[b] && typeof tree[b] === 'object'; }).sort();
    ok(branches.length >= 10 && branches.indexOf('desk') !== -1, 'the world: the api tree holds ' + branches.length + ' branches, desk among them', 'branches: ' + short(branches));

    test.subHeading('E. each branch serves the verbs its own api.js declares, and only those');
    branches.forEach(function (b) {
      const file = [path.join(run, 'spirit', b, 'api.js'), path.join(run, 'spirit', 'app', b, 'api.js')].filter(function (f) { return fs.existsSync(f); })[0];
      if (!file) { test.fail(b + ': no spirit/' + b + '/api.js nor spirit/app/' + b + '/api.js to compare with'); return; }
      let declared = [];
      try { declared = Object.keys((require(file) || {}).verbs || {}); } catch (e) { test.fail(b + ': its api.js does not load: ' + e.message); return; }
      const served = Object.keys(tree[b]);
      // Served beyond an api.js only by decision: appServer's DEBUG on every server (desk/G2.5: "DEBUG auto-verb supplied
      // by appServer is approved."), and desk's item.rules.add and item.rules.remove, his alone and left out of its api.js on
      // purpose (goal/G40.12, desk's api.js header).
      const decided = ['DEBUG'].concat(b === 'desk' ? ['item.rules.add', 'item.rules.remove'] : []);
      const extra = served.filter(function (v) { return declared.indexOf(v) === -1 && decided.indexOf(v) === -1; });
      const missing = declared.filter(function (v) { return served.indexOf(v) === -1; });
      ok(!extra.length && !missing.length, b + ': serves exactly the ' + declared.length + ' verbs of its api.js', b + ': ' + (extra.length ? extra.length + ' served beyond its api.js (' + short(extra.slice(0, 6)) + ')' : '') + (missing.length ? ' ' + missing.length + ' declared and not served ' + short(missing.slice(0, 6)) : ''));
    });
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

test.startTest('spirit-branches.js: every branch folder recognized, and every rule of a branch held by each (goal/G43.32)');

(async function () {
  recognized();
  await finder();
  await caches();
  await door();
  await appFamily();
  await branchVerbs();
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
