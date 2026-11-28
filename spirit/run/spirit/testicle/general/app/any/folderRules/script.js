'use strict';
// spirit/run/spirit/testicle/general/app/any/folderRules/script.js
// A RULE MODULE OF THE APP GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part "1 TO 6, FOR EACH SUB-FOLDER" (appRules), with the checks of the sub-folders it is said on of the old app -general runner of spirit/test/,
// moved here unchanged in what they check and in their titles; its runner now, which loads this module and calls it, is spirit/testicle/run/none/script.js.
// Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }
// (spirit/testicle/general/any/typeRules/script.js says each). 
// Judged on disc, from the files and the code (comments left out): no node is started (goal/G43.32, the box: "rules for
// sub-folders of run://spirit/app/"; spec: ./test/script.md).
const SPIRIT = require('../../../../../script.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Every path handed: a file of an app judges its app, any other path every app, as the file it came from did.
function appliesTo(scriptPath) {
  // Its reach (goal/G49.27, step 3): spirit/app/script.js and everything under spirit/app/, as the reach of the runner it
  // stood in (spirit/app/'s -child- general test, testModule's rule); given nothing, every app.
  const p = String(scriptPath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '');
  return !p || p.indexOf('spirit/app/') === 0;
}

// checks(scriptPath, tools): tools { test, run, spirit }; scriptPath '' judges every sub-folder of spirit/app/.
function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
const RUN = tools.run;
function code(rel) { let t = ''; try { t = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function isFile(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
function isDir(rel) { try { return fs.statSync(path.join(RUN, rel)).isDirectory(); } catch (e) { return false; } }

// The tree: every file git keeps and every file not yet added that git does not ignore, so a new app is judged before it
// is committed. A file tracked but deleted on disc is not there.
const TREE = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(isFile);
// THE ONE SUB-FOLDER WITH NO MANIFEST (the box: "spirit/app/test/ is the app branch's own test folder (its api.js and
// data.js), the one sub-folder with no manifest.").
const BRANCH_TESTS = 'test';
// WHAT IS AN APP, THE SYSTEM'S OWN RULE SAYS (goal/G49.23; Andy: "the system has clear rules for old and new format branches
// and apps"): the sub-folders spirit/fs/filter/app/script.js takes for apps, old format or new. The app branch's own scripts
// (spirit/app/manager/, spirit/app/client/, spirit/app/adapter/) are no app.
const APP_FILTER = SPIRIT.requireScript('spirit/fs/filter/app/script.js');
function treeHas(rel) { return TREE.some(function (f) { return f === rel || f.indexOf(rel + '/') === 0; }); }
function treeRead(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return null; } }
const APPS = Array.from(new Set(TREE.map(function (f) { const m = /^spirit\/app\/([^/]+)\//.exec(f); return m ? m[1] : ''; }).filter(Boolean))).sort()
  .filter(function (n) { return n === BRANCH_TESTS || APP_FILTER.app('spirit/app/' + n, treeHas, treeRead) === true; });

// Asked about one file: the app it is in. spirit/app/manager/script.js and the branch's own files (spirit/app/<file>, spirit/app/test/)
// are judged with every app, since they are no app's.
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const askedApp = (/^spirit\/app\/([^/]+)\//.exec(asked) || [])[1] || '';
const TARGETS = askedApp && askedApp !== BRANCH_TESTS ? APPS.filter(function (n) { return n === askedApp; }) : APPS;

// An element script: its module.exports is a factory with a create, which the loader places by the script's path (goal/G43.32,
// G49.9, G49.23; Andy: "helpers with no create are no fucking elements. they live in require.").
function isElement(rel) { const c = code(rel); return /\bmodule\.exports\s*=/.test(c) && /\bcreate\b/.test(c); }
function manifestOf(n) {
  const rel = 'spirit/app/' + n + '/' + n + '.json';
  if (!isFile(rel)) return { rel: rel, missing: true };
  try { return { rel: rel, j: JSON.parse(fs.readFileSync(path.join(RUN, rel), 'utf8')) }; } catch (e) { return { rel: rel, threw: true }; }
}
function isBool(v) { return v === true || v === false; }
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// ── 1 TO 6, FOR EACH SUB-FOLDER ──────────────────────────────────────────────────────────────────────────────────────
// One test per rule, judging every sub-folder judged here (one, when asked about a file): its title is the rule's, its
// detail names each folder that breaks it. A rule that applies to none of them (a face rule, when the one app asked
// about has no face) is not run.
// What each sub-folder's manifest says, read once.
function factsOf(n) {
  const dir = 'spirit/app/' + n;
  const m = manifestOf(n);
  const j = m.j || {};
  const id = isObj(j.identity) ? j.identity : {};
  return {
    n: n, dir: dir, m: m, j: j, id: id,
    files: TREE.filter(function (f) { return f.indexOf(dir + '/') === 0 && f.indexOf(dir + '/test/') !== 0; }),
    face: isObj(j.shell) && j.shell.mount === true,
    server: isObj(j.node) && j.node.mount === true,
    run: isObj(j.node) && j.node.run === true,
    main: dir + '/element.js',
    api: dir + '/api.js',
  };
}
// The folders a rule judges, each answering true or false: true when none breaks it.
function each(list, judge) {
  if (!list.length) return false;
  const broken = list.map(judge).filter(function (v) { return v !== true; });
  return !broken.length ? true : false;
}
function apiVerbs(f) {
  try { const mod = require(path.join(RUN, f.api)); return isObj(mod && mod.verbs) ? Object.keys(mod.verbs) : null; } catch (e) { return null; }
}
function appRules(all) {
  // Rules 1 and 2: "sub folders of this folder are meant for plugin-applications." "a manifest called
  // run://spirit/app/[name]/[name].json must exists ..., and it must be valid." Valid (the box, decided): it says
  // identity.intrinsic, true or false.
  test.run('the app\'s manifest is there', 0.4, function () {
    return each(all, function (f) { return !f.m.missing ? true : false; });
  }, test.limit.quick);
  const have = all.filter(function (f) { return !f.m.missing; });
  if (!have.length) return;
  test.run('the app\'s manifest is valid', 0.4, function () {
    return each(have, function (f) {
      const j = f.j, id = f.id, m = f.m;
      let bad = 0;
      if (m.threw) bad += 1;
      if (typeof id.icon !== 'string' || !id.icon) bad += 1;
      if (typeof id.label !== 'string' || !id.label) bad += 1;
      if (!isBool(id.intrinsic)) bad += 1;
      if (!isObj(j.mount)) bad += 1;
      // shell.true went with goal/G49.4 (box v15: "the app manifests shell:true goes"); mount and tile stay.
      if (!isObj(j.shell) || !isBool(j.shell.mount) || !isBool(j.shell.tile)) bad += 1;
      if (!isObj(j.node) || !isBool(j.node.mount) || (j.node.run !== undefined && !isBool(j.node.run))) bad += 1;
      return !bad ? true : false;
    });
  }, test.limit.quick);
  // Rule 3: "these manifests describe an app: does it have a face? a server? Is it a persistent server process that lives
  // while the node lives, or only while handling a request?" shell.mount, node.mount, node.run.
  test.run('the app\'s manifest says what it is: a face, a server living with the node, or a run', 0.4, function () {
    return each(have, function (f) { return (f.face || f.server || f.run) ? true : false; });
  }, test.limit.quick);
  // Rule 4: "if the application has a face, its main screen element must be spirit/app/[name]/element.js."
  const faced = have.filter(function (f) { return f.face; });
  const faceless = have.filter(function (f) { return !f.face; });
  if (faced.length) {
    test.run('the app has a face, and its main element is element.js, placed by its path', 0.4, function () {
      return each(faced, function (f) {
        return (isFile(f.main) && isElement(f.main)) ? true : false;
      });
    }, test.limit.quick);
  }
  if (faceless.length) {
    test.run('the app has no face and no element.js', 0.4, function () {
      return each(faceless, function (f) { return !isFile(f.main) ? true : false; });
    }, test.limit.quick);
  }
  // Rule 5: "if the app is intrinsic, its additional elements belong in spirit/element/ if the app is not intrinsic, the
  // additional elements belong in spirit/app/[name]/element/."
  const extra = function (f) { return f.files.filter(function (x) { return /\.js$/.test(x) && x !== f.main && isElement(x); }); };
  const intrinsic = have.filter(function (f) { return f.id.intrinsic === true; });
  const free = have.filter(function (f) { return f.id.intrinsic !== true; });
  if (intrinsic.length) {
    test.run('the intrinsic app has no element of its own but element.js, the rest standing in spirit/element/', 0.4, function () {
      return each(intrinsic, function (f) { const e = extra(f); return !e.length ? true : false; });
    }, test.limit.quick);
  }
  if (free.length) {
    test.run('the app that is not intrinsic keeps its other elements in its own element/ folder', 0.4, function () {
      return each(free, function (f) {
        const astray = extra(f).filter(function (x) { return x.indexOf(f.dir + '/element/') !== 0; });
        return !astray.length ? true : false;
      });
    }, test.limit.quick);
  }
  // Rule 6: "an app that serves verbs must also contain, in the spirit/app/[name]/ folder a valid api.js, a data.js and a json
  // description file for each verb it serves."
  const noApi = have.filter(function (f) { return !isFile(f.api); });
  const withApi = have.filter(function (f) { return isFile(f.api); });
  if (noApi.length) {
    test.run('the app serves no verbs, with no api.js and no server', 0.4, function () {
      return each(noApi, function (f) { return !f.server ? true : false; });
    }, test.limit.quick);
  }
  if (withApi.length) {
    test.run('the app\'s api.js is valid', 0.4, function () {
      return each(withApi, function (f) { const v = apiVerbs(f); return (!!v && v.length > 0) ? true : false; });
    }, test.limit.quick);
    test.run('the app\'s data.js is there', 0.4, function () {
      return each(withApi, function (f) { return isFile(f.dir + '/data.js') ? true : false; });
    }, test.limit.quick);
    // Each verb's <verb>.json: judged on every branch, both ways and with its arguments, by spirit/testicle/general/any/generalRules/script.js
    // (goal/G47.4, "api.js and <verb>.json files match precisely"), which replaced this one-way check of the apps.
  }
  // Rule 7 (goal/G48.5, the box: "an app's server-only files stand in spirit/app/<name>/server/; its server portion MUST be
  // spirit/app/<name>/server/server.js, in place of node<Name>.js. spirit/app/<name>/<name>.js stays what the node starts and
  // loads ./server/server.js on the node"; Andy, of where its test stands: "app-child-general!!!!!!!!!!!!!!!!"). An app with a
  // server, node.mount true.
  const served = have.filter(function (f) { return f.server; });
  if (served.length) {
    test.run('the app with a server has it at spirit/app/<name>/server/server.js, its <name>.js loading it there', 0.4, function () {
      return each(served, function (f) { return (isFile(f.dir + '/server/server.js') && /server\/server\.js/.test(code(f.dir + '/' + f.n + '.js'))) ? true : false; });
    }, test.limit.quick);
  }
  // Rule 8 (goal/G48.8; Andy: "wsl, let the verb list be checked by a general test like app-child-general"): what the console
  // offers at spirit.app.<name> is the app's api.js verbs, and beside them the auto-verbs every app server serves, remote and
  // DEBUG (spirit/server/app/script.js), when the app has a server, and only then. Asked of the console's own verbsAt.
  if (withApi.length) {
    test.run('the console offers at spirit.app.<name> its api.js verbs, and remote and DEBUG when it has a server', 0.4, async function () {
      let console0 = null;
      try { console0 = SPIRIT.requireScript('spirit/console/command/script.js'); } catch (e) { console0 = null; }
      if (!console0 || typeof console0.verbsAt !== 'function') return false;
      const sorted = function (l) { return JSON.stringify(l.slice().sort()); };
      for (const f of withApi) {
        const own = apiVerbs(f);
        let offered = null;
        try { offered = await console0.verbsAt('app.' + f.n); } catch (e) { offered = null; }
        if (!own || !offered || typeof offered !== 'object') return false;
        const want = f.server ? own.concat(['remote', 'DEBUG']) : own;
        if (sorted(Object.keys(offered)) !== sorted(want)) return false;
      }
      return true;
    }, test.limit.slow);
  }
}

// The sub-folders.
// No count of the tree's apps is written here (goal/G47.4; Andy: "you make bloody well sure that such stupid hard-coded
// tests move"): the app folders are judged each from its own manifest, however many there are.
test.run('spirit/app/test/ is the app branch\'s own test folder, the one sub-folder with no manifest', 0.4, function () {
  return (isDir('spirit/app/' + BRANCH_TESTS) && !isFile('spirit/app/' + BRANCH_TESTS + '/' + BRANCH_TESTS + '.json')) ? true : false;
}, test.limit.quick);
if (askedApp && askedApp !== BRANCH_TESTS) {
  test.run('the file asked about is in a sub-folder of spirit/app/ the tree holds', 0.2, function () {
    return TARGETS.length ? true : false;
  }, test.limit.quick);
}
appRules(TARGETS.filter(function (n) { return n !== BRANCH_TESTS; }).map(factsOf));
}

// The names its checks look for: none (goal/G49.27, Andy: "All, cw's way").
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
