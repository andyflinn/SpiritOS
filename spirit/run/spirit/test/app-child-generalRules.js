'use strict';

// spirit/run/spirit/test/app-child-generalRules.js [file]
// THE RULES FOR THE SUB-FOLDERS OF spirit/app/ (goal/G43.32; spec: ./app-child-generalRules.md). Andy, the box: "rules for
// sub-folders of run://spirit/app/", 0 to 6, and of its name: "if app-child-generalRules.js works that is my decision." A
// -child- general test beside spirit/app.js (./TEST_SYSTEM.md): it judges spirit/app.js and spirit/app/ and below.
//
//   node spirit/test/app-child-generalRules.js spirit/app/desk/desk.js     the app the file is in
//   node spirit/test/app-child-generalRules.js                             every sub-folder of spirit/app/
//
// Judged on disc, from the files and the code (comments left out): no node is started. Each rule is one test over
// every sub-folder judged, its detail naming each app's folder that breaks it (goal/G47.2: one title, unique in the
// suite). What an element script places, a page judges in spirit-sibling-generalRules.js; what an api.js serves,
// spirit-sibling-branchRules.js.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
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
const APPS = Array.from(new Set(TREE.map(function (f) { const m = /^spirit\/app\/([^/]+)\//.exec(f); return m ? m[1] : ''; }).filter(Boolean))).sort();

// Asked about one file: the app it is in. spirit/app.js and the branch's own files (spirit/app/<file>, spirit/app/test/)
// are judged with every app, since they are no app's.
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const askedApp = (/^spirit\/app\/([^/]+)\//.exec(asked) || [])[1] || '';
const TARGETS = askedApp && askedApp !== BRANCH_TESTS ? APPS.filter(function (n) { return n === askedApp; }) : APPS;

// An element script: it places a factory with a create through installSpiritElement (goal/G43.32; Andy: "helpers with no
// create are no fucking elements. they live in require.").
function isElement(rel) { const c = code(rel); return /\binstallSpiritElement\s*\(/.test(c) && /\bcreate\b/.test(c); }
function manifestOf(n) {
  const rel = 'spirit/app/' + n + '/' + n + '.json';
  if (!isFile(rel)) return { rel: rel, missing: true };
  try { return { rel: rel, j: JSON.parse(fs.readFileSync(path.join(RUN, rel), 'utf8')) }; } catch (e) { return { rel: rel, threw: e.message }; }
}
function isBool(v) { return v === true || v === false; }
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// ── 0. job AND event, SINGULAR ──────────────────────────────────────────────────────────────────────────────────────
// Andy, the box: "\"jobs\" and it's face spirit/app/jobs/ will be renamed, \"job\" (singular) and the same will happen for
// \"events\", which will be renamed \"event\"". The decided: the seven verbs renamed, and every file and folder named so.
function verbsOf(file, want) {
  let verbs = null;
  try { verbs = Object.keys(require(path.join(RUN, file)).verbs || {}); } catch (e) { verbs = null; }
  const same = !!verbs && want.every(function (v) { return verbs.indexOf(v) !== -1; }) && verbs.length === want.length;
  return same ? true : file + ': ' + (verbs ? 'declares ' + short(verbs) + ', not ' + want.join(', ') : 'is not there or does not load');
}
const OLD_NAME_CALL = /['"`](jobs|events)\.(search|get|create|cancel|delete|subscribe|publish|list|update)\b|\bspirit\.(jobs|events)\b|\bS\.(jobs|events)\b|\bs\.(jobs|events)\b/;
function rule0() {
  // Rule 0: job and event, singular.
  test.run('no file or folder is named jobs or events', 0.4, function () {
    const plural = TREE.filter(function (f) { return /(^|\/)(jobs|events)(\/|[-.])/.test(f); });
    return !plural.length ? true : plural.length + ' still are: ' + short(plural.slice(0, 8));
  }, 1000);
  test.run('the branch job: spirit/job/ holds api.js and data.js', 0.4, function () {
    return (isFile('spirit/job/api.js') && isFile('spirit/job/data.js')) ? true : 'no branch spirit/job/ with api.js and data.js';
  }, 1000);
  test.run('the branch event: spirit/event/ holds api.js and data.js', 0.4, function () {
    return (isFile('spirit/event/api.js') && isFile('spirit/event/data.js')) ? true : 'no branch spirit/event/ with api.js and data.js';
  }, 1000);
  test.run('its face: spirit/app/job/', 0.4, function () { return isFile('spirit/app/job/job.json') ? true : 'no app spirit/app/job/'; }, 1000);
  test.run('spirit/job/api.js: the verbs search, get, create, cancel and delete, their words unchanged', 0.4, function () {
    return verbsOf('spirit/job/api.js', ['search', 'get', 'create', 'cancel', 'delete']);
  }, 1000);
  test.run('spirit/event/api.js: the verbs subscribe and publish, their words unchanged', 0.4, function () {
    return verbsOf('spirit/event/api.js', ['subscribe', 'publish']);
  }, 1000);
  // A call by its old name: 'jobs.<verb>' or 'events.<verb>' in a string, or spirit.jobs / spirit.events, in any product file.
  // (A constant: its quote characters inside a test's body would be read as strings by the title rule's parser.)
  test.run('no product file calls a verb by its old name, jobs.* or events.*, nor spirit.jobs or spirit.events', 0.4, function () {
    const calls = TREE.filter(function (f) { return /\.(js|html)$/.test(f) && !/\/test\//.test(f) && !/\/(chokidar|readdirp)\//.test(f); }).filter(function (f) {
      return OLD_NAME_CALL.test(code(f));
    });
    return !calls.length ? true : calls.length + ' do: ' + short(calls.slice(0, 8));
  }, 1000);
}

// ── THE APP APP (the box, decided) ──────────────────────────────────────────────────────────────────────────────────
function appApp() {
  test.run('spirit/app/app/app.json says shell true:true, a shell a node may load', 0.4, function () {
    const m = manifestOf('app');
    return (!!m.j && isObj(m.j.shell) && m.j.shell.true === true) ? true : 'spirit/app/app/app.json ' + (m.j ? 'does not say shell true:true' : 'is not there');
  }, 1000);
  test.run('spirit/app/app/element.js is its element, the app selector', 0.4, function () {
    return (isFile('spirit/app/app/element.js') && isElement('spirit/app/app/element.js')) ? true : 'spirit/app/app/element.js is not there, or places no create';
  }, 1000);
  test.run('the shell app, spirit/app/appSelector.js and spirit/app/appSelector/ are gone', 0.4, function () {
    const gone = ['spirit/app/shell', 'spirit/app/appSelector', 'spirit/app/appSelector.js'].filter(function (p) { return isDir(p) || isFile(p) || TREE.some(function (f) { return f.indexOf(p + '/') === 0; }); });
    return !gone.length ? true : short(gone) + ' still stand';
  }, 1000);
  test.run('the app branch is intrinsic: its parts stand in spirit/element/search/app/ (changeAppIcon, changeAppLabel, detailElement, rowFormAppActive, rowFormSetShell, rowFormToggle, serverDEBUG)', 0.4, function () {
    const parts = ['changeAppIcon', 'changeAppLabel', 'detailElement', 'rowFormAppActive', 'rowFormSetShell', 'rowFormToggle', 'serverDEBUG'];
    const missing = parts.filter(function (p) { return !isFile('spirit/element/search/app/' + p + '.js'); });
    return !missing.length ? true : 'not in spirit/element/search/app/: ' + short(missing);
  }, 1000);
  test.run('the node\'s default shell is app (spirit/nodeShell.js)', 0.4, function () {
    return /DEFAULT\s*=\s*'app'/.test(code('spirit/nodeShell.js')) ? true : 'spirit/nodeShell.js names another default shell';
  }, 1000);
}

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
// The folders a rule judges, each answering true or what it breaks: true when none breaks it, else every break, joined.
function each(list, judge) {
  if (!list.length) return 'no sub-folder of spirit/app/ to judge';
  const broken = list.map(judge).filter(function (v) { return v !== true; });
  return !broken.length ? true : broken.join('; ');
}
function apiVerbs(f) {
  try { const mod = require(path.join(RUN, f.api)); return isObj(mod && mod.verbs) ? Object.keys(mod.verbs) : null; } catch (e) { return null; }
}
function appRules(all) {
  // Rules 1 and 2: "sub folders of this folder are meant for plugin-applications." "a manifest called
  // run://spirit/app/[name]/[name].json must exists ..., and it must be valid." Valid (the box, decided): it says
  // identity.intrinsic, true or false.
  test.run('rule 2: its manifest is there', 0.4, function () {
    return each(all, function (f) { return !f.m.missing ? true : f.dir + ': rule 2, no manifest ' + f.m.rel + ': a sub-folder of spirit/app/ is an app'; });
  }, 1000);
  const have = all.filter(function (f) { return !f.m.missing; });
  if (!have.length) return;
  test.run('rule 2: its manifest is valid', 0.4, function () {
    return each(have, function (f) {
      const j = f.j, id = f.id, m = f.m;
      const bad = [];
      if (m.threw) bad.push('it does not parse: ' + m.threw);
      if (typeof id.icon !== 'string' || !id.icon) bad.push('identity.icon');
      if (typeof id.label !== 'string' || !id.label) bad.push('identity.label');
      if (!isBool(id.intrinsic)) bad.push('identity.intrinsic, true or false');
      if (!isObj(j.mount)) bad.push('mount');
      if (!isObj(j.shell) || !isBool(j.shell.true) || !isBool(j.shell.mount) || !isBool(j.shell.tile)) bad.push('shell { true, mount, tile }, each true or false');
      if (!isObj(j.node) || !isBool(j.node.mount) || (j.node.run !== undefined && !isBool(j.node.run))) bad.push('node { mount, run? }, each true or false');
      return !bad.length ? true : f.dir + ': rule 2, its manifest lacks ' + bad.join('; ');
    });
  }, 1000);
  // Rule 3: "these manifests describe an app: does it have a face? a server? Is it a persistent server process that lives
  // while the node lives, or only while handling a request?" shell.mount, node.mount, node.run.
  test.run('rule 3: it says what it is, a face, a server living with the node or a run', 0.4, function () {
    return each(have, function (f) { return (f.face || f.server || f.run) ? true : f.dir + ': rule 3, it says no face, no server and no run'; });
  }, 1000);
  // Rule 4: "if the application has a face, its main screen element must be spirit/app/[name]/element.js."
  const faced = have.filter(function (f) { return f.face; });
  const faceless = have.filter(function (f) { return !f.face; });
  if (faced.length) {
    test.run('rule 4: it has a face, and its main element is element.js, placed by its path', 0.4, function () {
      return each(faced, function (f) {
        return (isFile(f.main) && isElement(f.main) && code(f.main).indexOf("'" + f.main + "'") !== -1) ? true : f.dir + ': rule 4, it has a face, but ' + (isFile(f.main) ? f.main + ' places no create at its path' : 'no ' + f.main);
      });
    }, 1000);
  }
  if (faceless.length) {
    test.run('rule 4: no face, and no element.js', 0.4, function () {
      return each(faceless, function (f) { return !isFile(f.main) ? true : f.dir + ': rule 4, ' + f.main + ' stands, but its manifest says no face'; });
    }, 1000);
  }
  // Rule 5: "if the app is intrinsic, its additional elements belong in spirit/element/ if the app is not intrinsic, the
  // additional elements belong in spirit/app/[name]/element/."
  const extra = function (f) { return f.files.filter(function (x) { return /\.js$/.test(x) && x !== f.main && isElement(x); }); };
  const intrinsic = have.filter(function (f) { return f.id.intrinsic === true; });
  const free = have.filter(function (f) { return f.id.intrinsic !== true; });
  if (intrinsic.length) {
    test.run('rule 5: intrinsic, and no element of its own but element.js (the rest in spirit/element/)', 0.4, function () {
      return each(intrinsic, function (f) { const e = extra(f); return !e.length ? true : f.dir + ': rule 5, intrinsic, but its folder holds ' + e.length + ' more elements: ' + short(e); });
    }, 1000);
  }
  if (free.length) {
    test.run('rule 5: not intrinsic, and its other elements stand in its own element/ folder', 0.4, function () {
      return each(free, function (f) {
        const astray = extra(f).filter(function (x) { return x.indexOf(f.dir + '/element/') !== 0; });
        return !astray.length ? true : f.dir + ': rule 5, not intrinsic, but ' + astray.length + ' elements stand outside ' + f.dir + '/element/: ' + short(astray);
      });
    }, 1000);
  }
  // Rule 6: "an app that serves verbs must also contain, in the spirit/app/[name]/ folder a valid api.js, a data.js and a json
  // description file for each verb it serves."
  const noApi = have.filter(function (f) { return !isFile(f.api); });
  const withApi = have.filter(function (f) { return isFile(f.api); });
  if (noApi.length) {
    test.run('rule 6: it serves no verbs: no api.js, and no server', 0.4, function () {
      return each(noApi, function (f) { return !f.server ? true : f.dir + ': rule 6, it has a server but no ' + f.api; });
    }, 1000);
  }
  if (withApi.length) {
    test.run('rule 6: its api.js is valid', 0.4, function () {
      return each(withApi, function (f) { const v = apiVerbs(f); return (!!v && v.length > 0) ? true : f.dir + ': rule 6, ' + f.api + ' does not load, or declares no verbs'; });
    }, 1000);
    test.run('rule 6: its data.js is there', 0.4, function () {
      return each(withApi, function (f) { return isFile(f.dir + '/data.js') ? true : f.dir + ': rule 6, it serves verbs but has no data.js'; });
    }, 1000);
    test.run('rule 6: each verb it serves has its json description', 0.4, function () {
      return each(withApi, function (f) {
        const verbs = apiVerbs(f);
        const undescribed = (verbs || []).filter(function (v) {
          try { return !isObj(JSON.parse(fs.readFileSync(path.join(RUN, f.dir, v + '.json'), 'utf8'))); } catch (e) { return true; }
        });
        return (!!verbs && !undescribed.length) ? true : f.dir + ': rule 6, no valid <verb>.json for ' + short(undescribed);
      });
    }, 1000);
  }
}

// The sub-folders.
test.run('the world: twenty or more sub-folders of spirit/app/', 0.2, function () {
  return APPS.length >= 20 ? true : 'only ' + short(APPS) + ': nothing to judge';
}, 1000);
test.run('spirit/app/test/ is the app branch\'s own test folder, the one sub-folder with no manifest', 0.4, function () {
  return (isDir('spirit/app/' + BRANCH_TESTS) && !isFile('spirit/app/' + BRANCH_TESTS + '/' + BRANCH_TESTS + '.json')) ? true : 'spirit/app/test/ is not the app branch\'s test folder';
}, 1000);
if (askedApp && askedApp !== BRANCH_TESTS) {
  test.run('the world: the file asked about is in a sub-folder of spirit/app/ the tree holds', 0.2, function () {
    return TARGETS.length ? true : asked + ' is in no sub-folder of spirit/app/ the tree holds';
  }, 1000);
}
rule0();
appApp();
appRules(TARGETS.filter(function (n) { return n !== BRANCH_TESTS; }).map(factsOf));
