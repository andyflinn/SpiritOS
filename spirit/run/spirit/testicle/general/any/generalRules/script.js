'use strict';
// spirit/run/spirit/testicle/general/any/generalRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part generalRules(ARGS) of
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
  // Every path: a file is judged by oneFile, a path that is no file is red ('the file handed is there').
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
// A MODULE'S OWN FORBIDDEN NAMES ARE NOT ITS FAULT (goal/G49.27; Andy: "All, cw's way"): a rule module names what it forbids,
// in its titles, its patterns and its comments. A name rule skips exactly the names a module hands out as forbids, and only
// in that module's own files (its script.js and its test/): each such name is blanked, its length kept, before the file is
// read; every other name in those files, and every other file, is judged as any product file. tools.forbids maps each
// module's folder (spirit/testicle/general/<rule>) to its forbids; the runner hands it.
const FORBIDS = tools.forbids || {};
function unforbidden(rel, text) {
  const r = String(rel || '').replace(/^spirit\/run\//, '');
  const own = Object.keys(FORBIDS).filter(function (dir) { return r === dir + '/script.js' || r.indexOf(dir + '/test/') === 0; })[0];
  if (!own) return text;
  let t = String(text);
  FORBIDS[own].forEach(function (n) { t = t.split(n).join(String(n).replace(/[^\n]/g, ' ')); });
  return t;
}
// THE TREE'S OWN RULES, GIVEN NO FILE (goal/G49.27: they stood at the top level of the old -general runner of spirit/test/,
// before and after its parts; they are this module's now, the first before its rules of a module and the second after).
// EVERY PATH WRITTEN OUT WHOLE, AND NO SHIM (goal/G49.13; Andy: "that's NOT acceptable. all your saying is that your hacking a fix to
// compensate for lazyness in properly requiring the fucking interface by it's motherfucking full path", "YOU FUCKING FIX THE CALLERS AND
// REMOVE THE MOTHERFUCKING SHIM"). Over the whole tree, from git: no product script joins a requireScript argument from pieces, and no
// server serves an address from another file, so the browser asks every file by its own path.
if (!String(ARGS[0] || '')) {
  const SH = { run: tools.run };
  const shFs = require('fs');
  const shPath = require('path');
  const productCode = function () {
    const vendored = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
    return require('child_process').execFileSync('git', ['ls-files', '--', '.'], { cwd: SH.run, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return /\.js$/.test(f) && !/(^|\/)test\//.test(f) && !(vendored && vendored.holds(f)) && shFs.existsSync(shPath.join(SH.run, f)); });
  };
  const codeText = function (f) {
    let t = '';
    try { t = shFs.readFileSync(shPath.join(SH.run, f), 'utf8'); } catch (e) { return ''; }
    return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  };
  test.run('every spirit.requireScript argument in product code is one path written out whole, never joined from pieces', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    const joined = files.filter(function (f) {
      const c = codeText(f);
      const re = /requireScript\s*\(([^()]*(?:\([^()]*\))?[^()]*)\)/g;
      let m;
      while ((m = re.exec(c))) { if (/['"`]\s*\+|\+\s*['"`]|\$\{/.test(m[1])) return true; }
      return false;
    });
    return !joined.length || false;
  }, test.limit.quick);
  test.run('no server serves an address from another file: serveCommon has no PAGE_FILES and no pageFile, and nothing calls one', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /\bPAGE_FILES\b|\bpageFile\s*\(/.test(unforbidden(f, codeText(f))); }) || false;
  }, test.limit.quick);
  // THE FULL PATH, AND THE ONLY WAY (goal/G49.13; Andy: "WSL, YOU WRITE A FUCKING TEST THAT ENSURES THAT PRODUCT FILES DO SUPPLY THE
  // FULL PATH in spirit.requireScript() and that's the ONLY WAY to require modules."). A full path: a run-root path written out as one
  // string, 'spirit/<...>.js' (or .css, .json). It may reach requireScript through a helper's parameter, at any place in its
  // list, function ask(api, verb, args) { ... requireScript(api) ... }, or a list mapped into it, written in place or held by a
  // name, var SHEETS = [...]; SHEETS.map(function (p) { ... }), only where every value so handed in the file is such a string
  // (cw's ask, goal/G49.13); anything else, a path built, joined, resolved or looked up, is red.
  const FULL = /^(['"])spirit\/[^'"+`$]+\.(js|css|json)\1$/;
  const literalArgsOf = function (c, fn) {
    const out = [];
    const re = new RegExp('(?<![\\w$.])' + fn + '\\s*\\(\\s*([^),]*)', 'g');
    let m;
    while ((m = re.exec(c))) out.push(m[1].trim());
    return out;
  };
  // The arguments of a call whose '(' is at i, split at its top-level commas, each trimmed.
  const argsAt = function (c, i) {
    const out = [];
    let depth = 0, q = '', cur = '';
    for (let j = i + 1; j < c.length; j++) {
      const ch = c[j];
      if (q) { cur += ch; if (ch === '\\') { cur += c[++j] || ''; } else if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) { out.push(cur.trim()); return out; } depth--; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    return out;
  };
  // Every item of a list written out: [ 'spirit/...', ... ], each a full path.
  const fullList = function (l) {
    const items = l.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return items.length > 0 && items.every(function (x) { return FULL.test(x); });
  };
  // ACROSS FILES (cw's ask, goal/G49.13: "a helper whose path parameter is handed a full path at every call"): a helper a script
  // hands out as <key>: <helper> is judged at every .<key>( call in product code; an option <o>.<field> an element is created
  // with, at every <field>: in each product script that requires that element by its path.
  let ALL_CODE = null;
  const allCode = function () {
    if (!ALL_CODE) ALL_CODE = productCode().map(function (g) { return { f: g, c: codeText(g) }; });
    return ALL_CODE;
  };
  const callsEverywhere = function (key, at) {
    const out = [];
    allCode().forEach(function (o) {
      const re = new RegExp('\\.' + key + '\\s*\\(', 'g');
      let k;
      while ((k = re.exec(o.c))) out.push(argsAt(o.c, k.index + k[0].length - 1)[at]);
    });
    return out;
  };
  const optionEverywhere = function (f, field) {
    const out = [];
    allCode().forEach(function (o) {
      if (o.f === f || o.c.indexOf("'" + f + "'") === -1) return;
      const re = new RegExp('(?<![\\w$.])' + field + '\\s*:\\s*', 'g');
      let k;
      while ((k = re.exec(o.c))) { const rest = o.c.slice(k.index + k[0].length); const v = /^(['"])[^'"]*\1/.exec(rest); out.push(v ? v[0] : rest.slice(0, 40)); }
    });
    return out;
  };
  const unfull = function (f) {
    const c = codeText(f);
    const bad = [];
    const re = /requireScript\s*\(\s*([^),]*\)?)/g;
    let m;
    while ((m = re.exec(c))) {
      let a = m[1].trim();
      // String(x) hands x as it is.
      const wrapped = /^String\(\s*([A-Za-z_$][\w$]*)\s*\)$/.exec(a);
      if (wrapped) a = wrapped[1];
      else a = a.replace(/\)$/, '').trim();
      if (FULL.test(a)) continue;
      // A WHOLE PATH HELD IN A NAME (goal/G49.23, Q7; Andy: "yes, aggreed." to "a path that comes whole (wire, user, fs cache), or
      // the loader's parent lookup: may requireScript take it held in a name"; and Q6: slashedPath/dottedPath "are exactly for
      // that"): a name or a field, x or o.path, is handed in as it is. A path glued from pieces stays red where it is glued: the
      // checks beside this one judge every 'spirit/' + a word, every .split('.').join('/') and every + 'script.js' in product code.
      if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(a)) continue;
      if (/^[A-Za-z_$][\w$]*$/.test(a)) {
        // A helper's parameter, at any place in its list: function <name>(..., a, ...) whose every call in the file hands a
        // full path there.
        const decl = new RegExp('function\\s+([A-Za-z_$][\\w$]*)\\s*\\(([^)]*)\\)', 'g');
        let d, helped = false;
        while ((d = decl.exec(c))) {
          const at = d[2].split(',').map(function (s) { return s.trim(); }).indexOf(a);
          if (at === -1) continue;
          const calls = [];
          const call = new RegExp('(?<![\\w$.])' + d[1] + '\\s*\\(', 'g');
          let k;
          while ((k = call.exec(c))) { if (c.slice(Math.max(0, k.index - 9), k.index).indexOf('function') !== -1) continue; calls.push(argsAt(c, k.index + k[0].length - 1)[at]); }
          if (calls.length && calls.every(function (x) { return FULL.test(String(x || '')); })) { helped = true; break; }
          // Handed out as <key>: <helper>, judged at every .<key>( call in product code.
          const out = new RegExp('(?<![\\w$.])([A-Za-z_$][\\w$]*)\\s*:\\s*' + d[1] + '\\b').exec(c);
          if (out) { const away = callsEverywhere(out[1], at); if (away.length && away.every(function (x) { return FULL.test(String(x || '')); })) { helped = true; break; } }
          // Handed an option, <o>.<field>, at each call in the file: every <field>: in the scripts that require this one is a full path.
          if (calls.length && calls.every(function (x) { return /^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*$/.test(String(x || '')); })) {
            const fields = calls.map(function (x) { return String(x).split('.')[1]; }).filter(function (v, i, all) { return all.indexOf(v) === i; });
            const given = [].concat.apply([], fields.map(function (fl) { return optionEverywhere(f, fl); }));
            if (given.length && given.every(function (x) { return FULL.test(String(x || '')); })) { helped = true; break; }
          }
        }
        if (helped) continue;
        // A list mapped into it, written out in place or held by a name: [ 'spirit/...', ... ].map|forEach|reduce(function (a) or
        // (chain, a), or NAME.map|forEach|reduce(...) where NAME = [ 'spirit/...', ... ].
        const into = new RegExp('(\\[[^\\[\\]]*\\]|[A-Za-z_$][\\w$]*)\\s*\\.(?:map|forEach|reduce)\\(\\s*function\\s*\\((?:\\s*[A-Za-z_$][\\w$]*\\s*,)?\\s*' + a + '\\s*[,)]', 'g');
        const lists = [];
        let L;
        while ((L = into.exec(c))) {
          if (L[1].charAt(0) === '[') { lists.push(L[1].slice(1, -1)); continue; }
          const held = new RegExp('(?:const|var|let)\\s+' + L[1] + '\\s*=\\s*\\[([^\\[\\]]*)\\]').exec(c);
          lists.push(held ? held[1] : null);
        }
        if (lists.length && lists.every(function (l) { return l !== null && fullList(l); })) continue;
        // A constant holding one: const (or var) a = 'spirit/...'.
        const k = new RegExp('(?:const|var|let)\\s+' + a + '\\s*=\\s*([^;\\n]+);').exec(c);
        if (k && FULL.test(k[1].trim())) continue;
      }
      bad.push(a);
    }
    return bad;
  };
  test.run('every spirit.requireScript in product code is handed a full path, \'spirit/<...>.js\', written out as one string or held whole in a name', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    if (files.length < 100) return false;
    return !files.some(function (f) { return unfull(f).length > 0; }) || false;
  }, test.limit.quick);
  test.run('spirit.requireScript is the only way a product script requires a module of the tree: its one plain require is the spirit object, the rest are node\'s own', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    if (files.length < 100) return false;
    return !files.some(function (f) {
      const c = codeText(f);
      const re = /(?<![\w$.])require\s*\(\s*([^)]*)\)/g;
      let m;
      while ((m = re.exec(c))) {
        const a = m[1].trim();
        if (/^(['"])(node:)?[a-z_][\w/]*\1$/.test(a) && !/^(['"])\.|\//.test(a.slice(1))) continue;
        const lit = /^(['"])([^'"]+)\1$/.exec(a);
        if (lit && shPath.resolve(shPath.dirname(shPath.join(SH.run, f)), lit[2]) === shPath.join(SH.run, 'spirit', 'script.js')) continue;
        if (/^path\.join\(\s*[A-Za-z_$][\w$]*\s*,\s*['"]spirit['"]\s*,\s*['"]script\.js['"]\s*\)$/.test(a)) continue;
        return true;
      }
      return false;
    }) || false;
  }, test.limit.quick);
  // NO WORD MADE INTO A BRANCH PATH (goal/G49.13; Andy: "WSL, AND NO FUCKING PATH TRANSLATORS FROM SINGLE BRANCH-WORD TO FUCKING BRANCH
  // PATH EITHER!!!!!!!!!!!!!!!"): anywhere in product code, not only in a requireScript, no path is made by joining 'spirit/' or
  // 'spirit/app/' with a name, nor by path.join of 'spirit' (and 'app') with one; a branch is always held by its full path.
  const WORD_TO_PATH = /['"`]spirit\/(?:app\/)?['"`]\s*\+|path\.join\([^)]*['"]spirit['"]\s*,\s*(?:['"]app['"]\s*,\s*)?(?!['"])[A-Za-z_$][\w$.()]*/;
  test.run('no product script makes a branch path from a single word: nothing joins spirit/ or spirit/app/ with a name', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return codeText(f).split('\n').some(function (l) { return WORD_TO_PATH.test(l); }); }) || false;
  }, test.limit.quick);
  // NO DOTTED NAME MADE INTO A PATH (goal/G49.13; Andy: "WHAT A FUCKING CHEAT, AND WHAT ABOUT THOSE DYNAMICALLY CREATED TYPE
  // SCRIPTS????????"): a type named spirit.type.string.label, or a branch named by dots, is never turned into a file path by
  // .split('.') and .join('/'); a file is always held by its full path.
  test.run('no product script turns a dotted name into a path: no .split(\'.\') joined with \'/\'', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /\.split\(\s*['"]\.['"]\s*\)(?:\.slice\([^)]*\))?\.join\(\s*['"]\/['"]\s*\)/.test(codeText(f)); }) || false;
  }, test.limit.quick);
  // NO TYPE PATH MADE (goal/G49.13; Andy: "FIX THE FUCKING DYNAMICALLY CREATED spirit/type/* SHIT!!!!!!!!!!!!! NOW, AND MAKE
  // SOME GENERAL TEST THAT STOPS THIS SHIT!"): a type is named by its file's run path, written out whole, everywhere: in
  // code, in an api.js, in a verb's .json. No dotted spirit.type.<...> name is left to be turned into one, and nothing
  // builds a path to a type file, or any script.js, from pieces.
  const productJson = function () {
    const vendored = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
    return require('child_process').execFileSync('git', ['ls-files', '--', '.'], { cwd: SH.run, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return /\.json$/.test(f) && !/(^|\/)test\//.test(f) && !(vendored && vendored.holds(f)) && shFs.existsSync(shPath.join(SH.run, f)); });
  };
  const rawText = function (f) { try { return shFs.readFileSync(shPath.join(SH.run, f), 'utf8'); } catch (e) { return ''; } };
  test.run('no product script or .json names a type by a dotted name, spirit.type.<...>', 0.6, function () {
    const files = productCode().concat(productJson());
    if (files.length < 100) return false;
    return !files.some(function (f) { return /['"`]spirit\.type\.[A-Za-z]/.test(unforbidden(f, /\.json$/.test(f) ? rawText(f) : codeText(f))); }) || false;
  }, test.limit.quick);
  test.run('every argument of a verb\'s .json names its type file by its full path, spirit/type/<...>/script.js, and that file is there', 0.6, function () {
    let verbs = 0;
    const bad = productJson().filter(function (f) {
      let j = null;
      try { j = JSON.parse(rawText(f)); } catch (e) { return false; }
      if (!j || typeof j.request !== 'object' || Array.isArray(j.request) || j.request === null) return false;
      verbs++;
      return !Object.keys(j.request).every(function (a) {
        const rule = String(j.request[a]).replace(/\?$/, '');
        return /^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule) && shFs.existsSync(shPath.join(SH.run, rule));
      });
    });
    return (verbs >= 20 && !bad.length) || false;
  }, test.limit.quick);
  test.run('no product script builds a path to a type file or a script.js from pieces: no spirit/type/ joined with a name, no \'script.js\' appended or joined on', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) {
      const c = codeText(f);
      return /['"`]spirit\/type\/['"`]?\s*\+/.test(c) || /`[^`]*spirit\/type\/[^`]*\$\{/.test(c) ||
        /path\.join\([^)]*['"]type['"]\s*,/.test(c) ||
        /\+\s*['"]\/?script\.js['"]/.test(c) || /`[^`]*\$\{[^}]*\}\/script\.js`/.test(c) ||
        /path\.join\([^)]*,\s*['"]script\.js['"]\s*\)/.test(c);
    }) || false;
  }, test.limit.quick);
  // NO fieldRules (goal/G49.13; Andy: "AND WHAT THE FLYING FUCK IS fieldRules still doing in the tree????????", and "The UI
  // elements need to know which spirit/type their fields are and require that type"): the type files replaced it.
  test.run('spirit/fieldRules/ is gone, and no product script names it', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return (!shFs.existsSync(shPath.join(SH.run, 'spirit', 'fieldRules')) && !files.some(function (f) { return /fieldRules/.test(unforbidden(f, rawText(f))); })) || false;
  }, test.limit.quick);
  // NO BUILD STAMP IN THE PRODUCT (goal/G49.13; Andy: "THAT KIND OF SHIT IS NOT PART OF THE PRODUCT!!!"): spirit/buildStamp/
  // is gone, and no product script names it.
  test.run('spirit/buildStamp/ is gone, and no product script names it', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return (!shFs.existsSync(shPath.join(SH.run, 'spirit', 'buildStamp')) && !files.some(function (f) { return /buildStamp/.test(unforbidden(f, rawText(f))); })) || false;
  }, test.limit.quick);
  test.run('the face page loads the spirit object by its own path, /spirit/script.js', 0.6, function () {
    let t = '';
    try { t = shFs.readFileSync(shPath.join(SH.run, 'spirit', 'shell', 'face.html'), 'utf8'); } catch (e) { return false; }
    return (/<script src="\/spirit\/script\.js"><\/script>/.test(t) && !/src="\/spirit\.js"/.test(t)) || false;
  }, test.limit.quick);
  test.run('the face boots the shell by its own path, spirit/shell/boot/script.js', 0.6, function () {
    const c = codeText('spirit/script.js');
    return (/var FACE = \['spirit\/shell\/boot\/script\.js'\]/.test(c) && !/['"]shell\/boot\.js['"]/.test(c)) || false;
  }, test.limit.quick);
  // ONE TRANSLATOR OF A PRODUCT PATH TO ITS STATE (goal/G49.17, box v5; Andy: "i'm looking for one central translator of
  // branch-path to state path", "agreed spirit.statePath(productPath) beside normalizeString() and escapeHtml()"): outside the
  // spirit object, which holds statePath, no product script makes a state path of its own: no 'spirit/state/' joined with a
  // name, no path.join of 'spirit' and 'state' with one. A fixed file of the node's own (spirit/state/identity.json) is no
  // translation and stays written out.
  test.run('no product script but the spirit object makes a state path from a name: each asks spirit.statePath', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    if (files.length < 100) return false;
    return !files.some(function (f) {
      let c = codeText(f);
      // A file outside spirit/ keeps its whole path under spirit/state/ for its sidecar: where those belong is for later
      // (goal/G49.17, Andy: "all oos for now"). Only that one expression is let through.
      if (f === 'spirit/fs/fileSystem/script.js') c = c.replace("spirit.statePath(p) : 'spirit/state/' + p)", '');
      return /['"`]spirit\/state\/['"`]?\s*\+/.test(c) || /path\.join\([^)]*['"]spirit['"]\s*,\s*['"]state['"]\s*,\s*(?!['"])[A-Za-z_$]/.test(c);
    }) || false;
  }, test.limit.quick);
  // AN APP IS KNOWN BY ITS PATH, NEVER BUILT FROM A NAME (goal/G49.19, box v13: "An app's path comes from one source: the fs
  // cache's app rows ... Never \"spirit/app/\" + a name"; Andy: "all translation from name to path or back is NOT PERMITTED in
  // SpiritOS"; "yes, i need the pages fixed in this item, too"): no product script, node side or page, joins 'spirit/app/'
  // with a name, nor path.joins 'app' with one.
  test.run('no product script builds an app\'s path from a name: no \'spirit/app/\' + a name, no path.join of \'app\' with one', 0.6, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) {
      const c = codeText(f);
      return /['"`]spirit\/app\/['"`]?\s*\+/.test(c) || /path\.join\([^)]*['"]app['"]\s*,\s*(?!['"])[A-Za-z_$]/.test(c);
    }) || false;
  }, test.limit.quick);
  // THE JOB BRANCH IN THE NEW SHAPE (goal/G49.19, box v13): "spirit/job/script.js --> spirit/job/engine/script.js",
  // "spirit/joinStepsJob/ --> spirit/job/joinStepsJob/", "spirit/job/api.js --> spirit/job/script.js", "spirit/job/data.js -->
  // spirit/job/client/script.js", and "spirit.processJob() leaves spirit/script.js and becomes spirit/job/processJob/script.js".
  const inTree = function (rel) { return shFs.existsSync(shPath.join(SH.run, rel)); };
  // ONE PLAIN TITLE EACH, ITS PATH THE SCRIPT IT IS REPORTED FOR (goal/G49.23: the title rule, "every title is one plain string,
  // nothing built into it"; it read rel + ' is there').
  const isThere = function (rel) { test.run('the moved script is there', 0.2, function () { return inTree(rel) || false; }, test.limit.quick, { script: rel }); };
  const isGone = function (rel) { test.run('the old path is gone', 0.2, function () { return !inTree(rel) || false; }, test.limit.quick, { script: rel }); };
  ['spirit/job/engine/script.js', 'spirit/job/joinStepsJob/script.js', 'spirit/job/client/script.js', 'spirit/job/processJob/script.js'].forEach(function (rel) {
    isThere(rel);
  });
  ['spirit/job/api.js', 'spirit/job/data.js', 'spirit/joinStepsJob'].forEach(function (rel) {
    isGone(rel);
  });
  // THE APP BRANCH IN THE NEW SHAPE (goal/G49.20, box v31): "spirit/app/script.js --> spirit/app/manager/script.js",
  // "spirit/app/api.js --> spirit/app/script.js", "spirit/app/data.js --> spirit/app/client/script.js".
  ['spirit/app/manager/script.js', 'spirit/app/client/script.js'].forEach(function (rel) {
    isThere(rel);
  });
  ['spirit/app/api.js', 'spirit/app/data.js'].forEach(function (rel) {
    isGone(rel);
  });
  // SOME TRUNK MOVES, AND THE AUTH TABLES AS BRANCHES (goal/G49.21, box v24): "spirit/client/packet.js -->
  // spirit/peer/packet/script.js", apiTreeIndex and boxes into spirit/fuckingGarbage/, "delete the directory spirit/client/";
  // "spirit/apiAuth/ --> spirit/grant/auth/"; the grant, bundle and branch tables each a branch, spirit/<table>/script.js and
  // spirit/<table>/client/script.js; "spirit/authTableInterface/ --> spirit/grant/tables/ (only used to pillage for parts, then
  // deleted)"; "the spirit/auth/ is finally deleted"; "the peer and relabel verbs go. die. perish."
  ['spirit/peer/packet/script.js', 'spirit/fuckingGarbage/apiTreeIndex.js', 'spirit/grant/auth/script.js', // boxes.js went with the owner branch (goal/G49.24, box v18)
   
    'spirit/grant/script.js', 'spirit/grant/client/script.js', 'spirit/bundle/script.js', 'spirit/bundle/client/script.js',
    'spirit/branch/script.js', 'spirit/branch/client/script.js'].forEach(function (rel) {
    isThere(rel);
  });
  ['spirit/boxes', 'spirit/apiAuth', 'spirit/authTableInterface', 'spirit/grant/tables', 'spirit/auth'].forEach(function (rel) {
    isGone(rel);
  });
  // spirit/client CAME BACK AS THE STORE (goal/G49.23; Andy: "do move spirit/data/ to spirit/client/ first"): what G49.21 took
  // out of it stays out; it holds the store, spirit/client/script.js.
  ['spirit/client/packet.js', 'spirit/client/apiTreeIndex.js'].forEach(function (rel) {
    isGone(rel);
  });
  test.run('spirit/client/script.js is there', 0.2, function () { return inTree('spirit/client/script.js') || false; }, test.limit.quick);
  test.run('no product script requires spirit/client/packet.js; the spirit object requires spirit/peer/packet/script.js', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return (!files.some(function (f) { return unforbidden(f, codeText(f)).indexOf('spirit/client/packet.js') !== -1; }) && /require(Script|One)\(\s*['"]spirit\/peer\/packet\/script\.js['"]\s*\)/.test(codeText('spirit/script.js'))) || false;
  }, test.limit.quick);
  // CLEANUP A - C, AND THE CONTACT BRANCH IN THE NEW SHAPE (goal/G49.22, box v16): answerRelay to spirit/peer/relay/key/seal/,
  // apiDoor to spirit/peer/door/, relayKeys to spirit/peer/relay/key/, appClient to spirit/app/adapter/, arrivals to
  // spirit/peer/arrivals/, coreFiles to spirit/fs/coreFiles/, the console's loop.js and command.js each to a folder of its own;
  // "spirit/contact/script.js --> spirit/contact/engine/script.js", "spirit/contact/data.js --> spirit/contact/client/script.js",
  // "spirit/contact/api.js --> spirit/contact/script.js"; "all verbs do the fucking same shit they did before".
  ['spirit/peer/relay/key/seal/script.js', 'spirit/peer/door/script.js', 'spirit/peer/relay/key/script.js', 'spirit/app/adapter/script.js',
    'spirit/peer/arrivals/script.js', 'spirit/fs/coreFiles/script.js', 'spirit/console/loop/script.js', 'spirit/console/command/script.js',
    'spirit/contact/engine/script.js', 'spirit/contact/client/script.js'].forEach(function (rel) {
    isThere(rel);
  });
  ['spirit/answerRelay', 'spirit/apiDoor', 'spirit/relayKeys', 'spirit/appClient', 'spirit/arrivals', 'spirit/coreFiles',
    'spirit/console/loop.js', 'spirit/console/command.js', 'spirit/contact/api.js', 'spirit/contact/data.js'].forEach(function (rel) {
    isGone(rel);
  });
  test.run('spirit/contact/script.js is the contact branch\'s interface: the same thirteen verbs as before', 0.2, function () {
    let m = null;
    try { m = require(shPath.join(SH.run, 'spirit', 'contact', 'script.js')); } catch (e) { m = null; }
    const verbs = m && m.verbs;
    const want = ['accept', 'add', 'block', 'claim', 'face', 'faceable', 'forget', 'get', 'join', 'label', 'leave', 'search', 'unblock'];
    return (!!verbs && Object.keys(verbs).sort().join() === want.join()) || false;
  }, test.limit.quick);
  // faceable goes by its new name: none names the old contact.faceable any more (and since goal/G49.25 it is granted as any
  // verb, no owner-only check; Andy: "they go now").
  test.run('no product script names faceable by its old name, contact.faceable, only spirit.contact.faceable', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /['"]contact\.faceable['"]/.test(unforbidden(f, codeText(f))); }) || false;
  }, test.limit.quick);
  // EVERY ARGUMENT OF A BRANCH IS A TYPE (goal/G49.21, box v25; Andy: "as always, and a permanent rule: a branche's script.js
  // file must use spirit.type.* for ALL argument validation"): each verb of every new-shape branch's script.js (a folder holding
  // script.js and client/script.js) names, for each argument, a type script by its path, spirit/type/... or an app's own
  // <app>/type/... (goal/G49.20), never a word of its own like 'text?'.
  test.run('every argument of every branch\'s verbs is a type script by its path', 0.4, function () {
    // goal/G49.23: the store is spirit/client/script.js, beside the spirit object, spirit/script.js, which is no branch and has no verbs.
    const files = productCode().filter(function (f) { return /\/script\.js$/.test(f) && f !== 'spirit/script.js' && shFs.existsSync(shPath.join(SH.run, f.replace(/script\.js$/, 'client/script.js'))); });
    if (files.length < 3) return false;
    return files.every(function (f) {
      let m = null;
      try { m = require(shPath.join(SH.run, f)); } catch (e) { return false; }
      const verbs = m && m.verbs;
      if (!verbs || typeof verbs !== 'object') return false;
      return Object.keys(verbs).every(function (v) {
        return Object.keys(verbs[v] || {}).every(function (a) { return /^spirit\/(.+\/)?type\/.+\/script\.js\??$/.test(String(verbs[v][a])); });
      });
    }) || false;
  }, test.limit.quick);
  test.run('no product script names the relabel verb or the auth peer verb', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { const c = unforbidden(f, codeText(f)); return /\brelabel\b/.test(c) || /['"]peer['"]\s*:\s*\{\s*request/.test(c); }) || false;
  }, test.limit.quick);
  test.run('spirit/app/manager/script.js is the manager: it holds createApp', 0.2, function () {
    return /\bfunction createApp\s*\(/.test(codeText('spirit/app/manager/script.js')) || false;
  }, test.limit.quick);
  test.run('spirit/app/script.js is the interface: it names the verbs search, active, label and icon, and holds no createApp', 0.2, function () {
    const c = codeText('spirit/app/script.js');
    return (['search', 'active', 'label', 'icon'].every(function (v) { return new RegExp('\\b' + v + '\\s*:\\s*\\{').test(c); }) && !/createApp/.test(c)) || false;
  }, test.limit.quick);
  test.run('spirit/job/engine/script.js is the engine: it holds installJobs', 0.2, function () {
    return /\bfunction installJobs\s*\(/.test(codeText('spirit/job/engine/script.js')) || false;
  }, test.limit.quick);
  test.run('spirit/job/script.js is the interface: it names the verbs search, get, create, cancel and delete, and holds no installJobs', 0.2, function () {
    const c = codeText('spirit/job/script.js');
    return (['search', 'get', 'create', 'cancel', 'delete'].every(function (v) { return new RegExp('\\b' + v + '\\s*:\\s*\\{').test(c); }) && !/installJobs/.test(c)) || false;
  }, test.limit.quick);
  // processJob "is required by its path, spirit/job/processJob/script.js, by every caller (testicle, icons, publishData, the
  // app server) ... The spirit object keeps no copy and no member of it"; "after the move the spirit object's publish requires
  // spirit/job/processJob/script.js for it".
  test.run('no product script reaches processJob as a member: none names .processJob', 0.4, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /\.processJob\b/.test(unforbidden(f, codeText(f))); }) || false;
  }, test.limit.quick);
  ['spirit/app/testicle/server/server.js', 'spirit/app/icons/server/server.js', 'spirit/app/publishData/publishData.js', 'spirit/server/app/script.js', 'spirit/script.js'].forEach(function (rel) {
    test.run('it requires spirit/job/processJob/script.js by its path', 0.2, function () {
      // The spirit object loads its own parts by requireOne, the function its requireScript is (spirit/script.js).
      return /require(Script|One)\(\s*['"]spirit\/job\/processJob\/script\.js['"]\s*\)/.test(codeText(rel)) || false;
    }, test.limit.quick, { script: rel });
  });
}

// spirit/run/spirit/test/script-sibling-generalRules.js <file>
// THE GENERAL RULES OF A MODULE, A SHELL APP OR AN ELEMENT (goal/G41.18; the module rules of goal/G40.6 folded in from
// spirit-child-generalRules.js, goal/G47.1), run once per file it judges, the file its argument (spec:
// ./script-sibling-generalRules.md). ITS NAME IS ITS REACH
// (./TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a -sibling-
// test beside spirit.js judges every module in spirit/run/ and below (goal/G47.1: no opting in), shell/ and the agent tables'
// pages alike (goal/G41.27; Andy: "1. The checks judge every module under spirit/run/: the test is
// spirit/run/test/script-sibling-generalRules.js instead of shell-child. No page moves; one test covers shell/ and the
// agent tables alike."). It was shell/test/boot-sibling-generalRules.js, its reach shell/ and hung on shell/boot.js. Andy: "we may require a
// ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing, THAT's were a general
// test belongs"; "shell-child-generalRules.js can also run headless chrome test to assert UI standards..."; "who says it
// shouln't check general \"mountability\" of elements and apps?", "mount each element or app all by itself, to \"unit\"
// tests?"; "add that test: shell-child-generalRules.js". Each file is its own test id; a rule a file breaks fails that
// file's test.
// DISCREPANCY WITH ANDY's RULES: the reach above runs once per file (goal/G41.19, goal/G43.2); since goal/G43.18 moved
// spirit.js to spirit/run/spirit/script.js, testModule.js no longer counts this as a general test (./TEST_SYSTEM.md). It
// is run once with no file, every() below finds no file in its reach, and it goes red with "testModule.js gives it no
// file to judge" after its icon-loading checks.
//
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, ../spirit/DEBUG/test/script.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RUN = tools.run;
// A SCRIPT'S SOURCE WITH LF LINE ENDINGS (goal/G47.1, Andy's red on spirit/app/icons/element.js, 'its code reaches no element
// through spirit.elements', for a comment): a Windows checkout writes CRLF, a line split at LF keeps its CR, and the pattern
// dropping a line's comment (.*$, which stops at a CR) left the comment in, read as code. Read from the run judged.
function readSource(rel) { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\r\n?/g, '\n'); }
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
// Its arguments: the file it judges, if any.
const arg = String(ARGS[0] || '');
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
// element scripts place their factories in spirit.required.<their path>"): a file is mounted when it is an element script;
// a switch (agent.js), a server or a helper is not.
// AN ELEMENT SCRIPT, BY ITS PLACE AND ITS EXPORTS (goal/G49.23: the loader places a script's module.exports, goal/G49.9): a
// script under spirit/element/, or an app's element.js or under its element/, whose module.exports has a create. Its exports
// are what it sets when it runs as the page's loader runs it (spirit/testicle/headLessChrome/script.js runAsPage), in a bare world of its
// own whose spirit answers no require; a script that throws there has none.
const ELEMENT_PLACE = /^spirit\/(?:element\/|app\/.+\/element(?:\/|\.js$))/;
function exportsCreate(f) {
  const vm = require('vm');
  const never = function () { return new Promise(function () {}); };
  const w = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {} };
  w.window = w;
  // goal/G49.23: no spirit.required on the bare world's spirit; what the file sets is its module.exports.
  w.spirit = { requireScript: never, readyPromise: never() };
  vm.createContext(w);
  // The helper by its path, here: the parts run where the file's own const H does not reach (goal/G49.23: it threw 'H is not
  // defined', so no script was ever taken for an element and every element check judged none).
  try { const e = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').runAsPage(f, w); return !!e && typeof e.create === 'function'; } catch (e) { return false; }
}
function isElementScript(rel) { const f = String(rel || ''); return /\.js$/.test(f) && ELEMENT_PLACE.test(f) && !/(^|\/)test\//.test(f) && fs.existsSync(path.join(RUN, f)) && exportsCreate(f); }
function kindOf(file) { return isElementScript(file) ? 'element' : ''; }
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/app/agent/node.json (spirit/job/engine/script.js).
const SERVERS = { servers: ['spirit.app.agent'] };
// A REDRAW PROVED IN THE PAGE'S OWN TEST (Andy, Q24, "yes."): a page whose watch draws only for an item open, which a
// bare mount never has; its own test's check, by its words, stands for it here.
const OWN_PROOF = {
  'spirit/app/desk/element/deskDetails/deskDetails.js': { test: 'spirit/app/desk/element/deskDetails/test/deskDetails.js', check: 'a verifier publish taken into spirit.required.spirit.data redraws the run' },
  // Join draws only the join news on the spirit job, which a marked row in the jobs or the contacts cannot change (Andy,
  // goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you ruled for deskDetails in Q24?"). The
  // Join app is joinList mounted, so its page takes the same proof.
  'spirit/element/joinList/script.js': { test: 'spirit/element/joinList/test/script.js', check: 'a new join on the spirit job, taken into the client of the job branch, redraws the steps' },
  'spirit/app/join/element.js': { test: 'spirit/element/joinList/test/script.js', check: 'a new join on the spirit job, taken into the client of the job branch, redraws the steps' },
};
// THE LONGEST FIELD THE TYPES ALLOW (goal/G49.13: the type files replaced fieldRules): the largest MAX_BYTES a type file under
// spirit/type/ holds; a field that keeps more than this holds no rule at all.
const MOST_BYTES = (function () {
  const out = [];
  (function walk(d) {
    let es = []; try { es = fs.readdirSync(path.join(RUN, d), { withFileTypes: true }); } catch (e) { es = []; }
    es.forEach(function (e) {
      const rel = d + '/' + e.name;
      if (e.isDirectory() && e.name !== 'test') walk(rel);
      else if (e.name === 'script.js') { let T = null; try { T = SPIRIT.requireScript(rel); } catch (x) { T = null; } if (T && typeof T.MAX_BYTES === 'number') out.push(T.MAX_BYTES); }
    });
  })('spirit/type');
  return out.length ? Math.max.apply(null, out) : 0;
})();
// THE PAGE WATCHED FROM BEFORE ITS FIRST SCRIPT (goal/G41.27): put on the page ahead of spirit.js, it keeps what the
// rules below are judged by, each call known by the file whose code made it (a module runs with its path as its
// sourceURL). Spirit's own code is spirit.js, its families (spirit-interface/), spirit/client/ and the page's data set
// (spirit/client/script.js); shell/boot.js, the face's own transport, is the one exception the network rule names
// (Andy: "boot.js MUST be an exception to the rules.").
//   net:   every fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon, with the file that made it;
//   subs:  every spirit.eventStream.subscribe and spirit.client.watchPath (a family view's, spirit.client.viewAt(node, family).watch, among them), live until let go, and whether a module made it;
//   writes: every call to the node a module made that changes something (not the stream or an interface, no read op,
//           no read verb);
//   moved: what the box changed while a write was out, other than a busy mark, a button's disabled state or fine print.
const WATCH = String.raw`(function () {
  var W = window.spiritWatch = { net: [], subs: [], writes: [], moved: [], out: 0, searches: [] };
  var SPIRIT = /(\/spirit\.js|spirit-interface\/|spirit\/client\/|spirit\/client\/script\.js|shell\/boot\.js)$/;
  function frames() { return String(new Error().stack || '').split('\n').slice(1).map(function (l) { return l.trim(); }).filter(function (l) { return l.indexOf('spiritWatch.js') === -1 && /^at /.test(l); }); }
  function file(f) { var m = /\(?([^()\s]+?):\d+:\d+\)?$/.exec(f); return m ? m[1].replace(/^https?:\/\/[^/]+/, '') : ''; }
  function spirits(f) { return SPIRIT.test(file(f)); }
  function caller() { var f = frames()[0] || ''; return { file: file(f), spirit: spirits(f) }; }
  function moduleMade() { return frames().some(function (f) { var x = file(f); return !!x && !SPIRIT.test(x); }); }
  var READ_OPS = ['search', 'get', 'list', 'status', 'card', 'read', 'tree', 'history'];
  var READ_VERB = /\.(search|get|list|status|card|read|tree|history|load|loadFile|ls|stat)$/;
  function isWrite(body) {
    var b = null; try { b = JSON.parse(String(body || '')); } catch (e) { return null; }
    // Spirit's own asks are no write: the stream (spirit.subscribe, event.subscribe before goal/G49.23) and a family's interface (api).
    if (!b || typeof b.call !== 'string' || b.call === 'spirit.subscribe' || b.call === 'api') return null;
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
  // EVERY SEARCH THE PAGE MAKES, as it is made (goal/G41.28): its spirit.client branch, and whether it ranks rows of its own.
  function searches(els) {
    if (!els || typeof els !== 'object' || els.__searched) return;
    try { Object.defineProperty(els, '__searched', { value: true }); } catch (e) { return; }
    // The search element stands at its path, spirit.element.search since goal/G49.23 (no spirit.required), searches handed
    // spirit.element: every step of the path is followed as it is made, and the element wrapped when it is placed or read.
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
  // WHAT IT WATCHES, IT DRAWS FROM: a marked row written into each path of the store (spirit.client, goal/G49.23) the module watches, and whether its
  // box changed for it within a second. A watch path is by server node first (goal/G41.28): '<node>/<family>/<branch>',
  // a branch, or '<node>/<family>/<branch>/<row>', a row; a watch of the home node holds '~' for the node, the page's
  // own node (data.home()) once it knows it.
  W.probe = function () {
    var D = window.spirit && window.spirit.client;
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
  // What each search draws that its branch in the store, spirit.client, does not hold: the keys of its rows on screen, against the branch.
  W.drawnOutside = function () {
    var D = window.spirit && window.spirit.client;
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
    along(els, ['search'], wrap);
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
        // A family's view (goal/G41.28), the store's viewAt(node, family): a manager watches through it, so its watch is kept
        // as one on the store, under the whole path it watches.
        // The store names it viewAt (spirit/client/script.js); a watch through the view is the module's own watch.
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
// The scratch node and headless Chrome, shared with any test that opens a page (spirit/testicle/headLessChrome/script.js).
const { sleep, until, findChrome, scratchNode, chromePage } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');

// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (spirit/testicle/testReport/script.js). This run records one line per file, named by its address.
// EVERY FILE THAT PAINTS AN ICON LOADS THE ICON ELEMENT (goal/G41.23; Q1, Andy: "plus the intrinsic apps, plus the
// icons app. all apps that use icons."; "wsl, Go" on: a second rule reads the code, so that it misses none). A bare mount
// draws no data, so most icons are seen only here. AN ICON STANDS ALONE (Andy: "isn't a glyph inside flowing text just
// like another inline character? ... glyphs are legal in labels and description true, and in that context they don't
// need special handling", then "narrow the rules so."): a shell script (no test, no vendor code) whose code, comments
// left out, holds a pictograph (Unicode Extended_Pictographic) alone in a string or alone between two tags, or that
// paints icons it is handed (named below, read by hand), loads spirit/element/icon/script.js. A glyph among words is text. Each is
// its own check, named by its path. painters() reads only the files git tracks under shell/, so the spirit/ entries of
// FROM_DATA and TEXT_ONLY are never read, and shell/boot.js (now spirit/shell/boot/script.js, goal/G43.18), shell/apps/apps.js
// and shell/icons/icons.js are no longer in the tree.
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'spirit/app/contact/element.js', 'spirit/element/search/icon/list/script.js',
  'spirit/element/search/icon/row/script.js', 'spirit/element/search/icon/script.js', 'spirit/element/workBench/script.js'];
// A pictograph, its variation selectors and joiners with it, alone in quotes or alone between > and <.
const ALONE = /(['"`]|>)\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*(['"`]|<)/u;
// A glyph alone in a string that is drawn only among words, read by hand: a status or a mark put before a name
// (Andy: "glyphs are legal in labels and description true").
const TEXT_ONLY = {
  // its blocked mark is drawn before the person's name
  'spirit/element/search/contact/detail/script.js': true,
  // its filter icons are drawn before their words by the search element's chips
  'spirit/element/search/contact/list/script.js': true,
};
function painters() {
  const tracked = require('child_process').execFileSync('git', ['ls-files', 'shell'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    if (!/\.js$/.test(f) || /\/test\//.test(f) || VENDORED_FOLDERS.holds(f) || f ==='spirit/element/icon/script.js' || !fs.existsSync(path.join(RUN, f))) return false;
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
function namesProcess(f) { try { return PROCESS_NAMED.test(unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8'))); } catch (e) { return false; } }
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
// The tools of run://spirit/test/: tools, not tests (Q2).
const TOOLS = ['testReport.js', 'testModule.js', 'headLessChrome.js'];
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
function ignoredByGit(rel) {
  try { require('child_process').execFileSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: REPO, stdio: 'ignore' }); return true; }
  catch (e) { return false; }
}
// EVERY PRODUCT SCRIPT LOADS THE TREE THROUGH spirit.requireScript (goal/G43.32, the box, testing point 2). Andy: "every script
// (other than spirit/script.js) must start with ... 'use strict'; 'let spirit = require(spirit) or the html pages <script
// href=spirit/script.js> kind of thing; all other scripts should be loaded using spirit.requireScript()", "node modules
// designated to provide node.js functionality: require('http' | 'fs' etc.) are exempt", "i see no reason codemirrors
// vendored scripts cannot be spirit.required....", and "just rename the bloody script" for a name with a dot of its own.
// Judged by reading each product file (the box: "this item deals with PRODUCT files, NOT tests"); vendored code is
// spirit.required by others and not judged as ours.
const BUILTIN = require('module').builtinModules;
// Whether a / at the end of what is read so far opens a regex literal, not a division.
function regexStarts(before) {
  const t = before.replace(/\s+$/, '');
  if (!t) return true;
  if (/[(,=:[!&|?{};+\-*%<>~^]$/.test(t)) return true;
  return /(^|[^\w$.])(return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(t);
}
// The code with its comments blanked, strings and line breaks kept; with bare, the strings' insides blanked too, every
// offset the same, so a require written inside a string is found as none; with noRegex, only the regex literals' insides.
function codeOf(src, bare, noRegex) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    // A REGEX LITERAL IS NO CODE EITHER (goal/G49.27: a rule module's own pattern, /require(?:Script)?\(/, read as a require
    // call, and a quote inside one opened a string that swallowed the code after it): a / where an expression starts
    // (after an operator, an opening bracket, a comma, a keyword or the file's start) opens one; with bare its insides are blanked.
    if (c === '/' && regexStarts(out)) {
      let j = i + 1; let cls = false;
      while (j < src.length && src[j] !== '\n' && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      if (j < src.length && src[j] === '/') { out += (bare || noRegex) ? '/' + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + '/' : src.slice(i, j + 1); i = j + 1; continue; }
    }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += bare ? c + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + (j < src.length ? c : '') : src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
// Whether a product script breaks the shape: true when it does, false when it holds.
function shapeBreaks(rel) {
  const stem = path.posix.basename(rel, '.js');
  // Its name holds a dot of its own: "just rename the bloody script".
  if (stem.indexOf('.') !== -1) return true;
  let src = '';
  try { src = readSource(rel); } catch (e) { return true; }
  const code = codeOf(src);
  if (!/^\s*(['"])use strict\1\s*;/.test(code)) return true;
  if (rel === 'spirit/script.js') return false;
  // Every plain require: the first takes spirit.js; any other names one of node's own modules.
  const bare = codeOf(src, true);
  const re = /(^|[^.\w$])require(?:Script)?\s*\(/g;
  let m;
  let first = true;
  while ((m = re.exec(bare))) {
    const open = m.index + m[0].length;
    const arg = (/^\s*([^)]*)\)/.exec(code.slice(open)) || ['', ''])[1].trim();
    const lit = /^(['"])([^'"]*)\1$/.exec(arg);
    const named = lit ? lit[2] : '';
    // The spirit object by where it resolves, spirit/script.js since goal/G49.12's flag day, never by its file's name.
    const spiritJs = (!!named && path.resolve(path.dirname(path.join(RUN, rel)), named) === path.join(RUN, 'spirit', 'script.js')) || /['"]spirit['"]\s*,\s*['"]script\.js['"]\s*\)\s*\)?$/.test(arg);
    if (spiritJs) { first = false; continue; }
    if (!first && lit && (BUILTIN.indexOf(named) !== -1 || BUILTIN.indexOf(named.replace(/^node:/, '')) !== -1)) continue;
    // Its first load is not spirit.js, or it loads a module plainly, not through spirit.requireScript.
    return true;
  }
  return false;
}
// THE GENERAL RULES OF A MODULE, judged in its code (goal/G40.6; folded in from spirit-child-generalRules.js, goal/G47.1;
// Andy: "for now, fold those two into script-sibling-generalRules.js"). Andy: "it will assert, the require path rule it
// will assert that the spirit-object becomes a global at the top of all modules"; spirit.js itself is judged too: "it
// must establish the global spirit object early in the code, it must follow the require-path restrictions we discussed."
// THE GLOBAL EARLY: a module's first require is spirit.js, so spirit is a plain global before anything else is loaded;
// spirit.js itself sets the global before its first require. Page code (no module.exports, speaks to window) runs on
// the page, where spirit.js is already there, and node never loads it.
// THE REQUIRE RULE (goal/G40's box): "a require path that starts with ../ may only add a file name, never descend into a
// subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling in the
// module's own folder is legal." A package or a node built-in is not a path; a computed path cannot be read.
// moduleRules(full) -> { early: false when it holds, true when it breaks; page: true for page code; bad: [require paths breaking the rule] }
function moduleRules(full) {
  // A REQUIRE WRITTEN INSIDE A STRING IS NONE (goal/G49.27: the rule modules' own tests plant scripts as strings, and their
  // require('fs') read as the test's own first require turned every such test red): the calls are found in the code with
  // its comments and its strings' insides blanked (codeOf, as shapeBreaks reads it), each path read at the same offset.
  const raw = fs.readFileSync(full, 'utf8');
  const code = codeOf(raw);
  const bare = codeOf(raw, true);
  const requires = [];
  // Plain requires only: spirit.requireScript(...) is the door the rule asks for, never a plain require.
  const re = /(^|[^.\w$])require(?:Script)?\(\s*(['"])([^'"]+)\2\s*\)/y;
  const at = /(^|[^.\w$])require(?:Script)?\(\s*(['"])[^'"]*\2\s*\)/g;
  let m;
  while ((m = at.exec(bare))) { re.lastIndex = m.index; const lit = re.exec(code); if (lit) requires.push({ at: m.index, path: lit[3] }); }
  const own = path.basename(full, '.js');
  const isSpirit = path.resolve(full) === path.join(RUN, 'spirit', 'script.js');
  const first = requires[0];
  // A TEST IS NEVER PAGE CODE (goal/G49.23, a gap the own-test agent found): every test file runs in node, so a test that
  // names window still requires spirit.js first; only product code may be page code.
  const isTestFile = /(^|[\\/])test[\\/]/.test(path.relative(RUN, full));
  const page = !isSpirit && !isTestFile && /\bwindow\b/.test(code) && !/\bmodule\.exports\b/.test(code);
  // THE RULE (Andy, 2026-11-13, goal/G47.1 box v73, replacing his api.js exemption of v72: "if a module requires
  // anything, it must require spirit.js first. Other modules are required using spirit.requireScript(), unless they are
  // native node.js modules."). A module that requires nothing holds it.
  let early = false;
  if (page || !requires.length) early = false;
  else if (isSpirit) {
    // It sets the global spirit nowhere, or only after its first require.
    const sets = code.search(/\broot\.spirit\s*=|\bglobalThis\.spirit\s*=|\bglobal\.spirit\s*=/);
    if (sets === -1 || (first && sets > first.at)) early = true;
  } else if (path.resolve(path.dirname(full), first.path) !== path.join(RUN, 'spirit', 'script.js')) {
    // It does not require spirit.js first.
    early = true;
  } else {
    // It requires another module plainly, not through spirit.requireScript(): only node's own modules are required plainly.
    const native = function (p) { return BUILTIN.indexOf(p) !== -1 || BUILTIN.indexOf(p.replace(/^node:/, '')) !== -1; };
    const other = requires.slice(1).filter(function (r) { return !native(r.path) && path.resolve(path.dirname(full), r.path) !== path.join(RUN, 'spirit', 'script.js'); })[0];
    if (other) early = true;
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
// THE ELEMENTS' OLD HOMES (goal/G43.5, the element move; moved here from spirit/test/script.js, goal/G47.1, Andy: "1, 2 and
// 3 Belong in spirit/test/script.js", "the rest belong in motherfucking script-sibling-general/browser/node respectively").
// The move's box: "We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/"", "all UI code in the
// product tree that references the moved element files, must be changed to correct those references. both file-location
// AND the home in spirit.required (singular)": "uncluding tests". And the other way round, found live (Andy: "contact detail
// don't load in contacts"): nothing reaches through spirit.required for an element spirit/element/ does not define. Since
// goal/G43.32 every element stands at its path, since goal/G49.23 spirit.element.<its path>, so that is a path to a script or folder of the tree.
const OLD_ELEMENT_PATH = /\bshell\/js\b|\bshell\/node_modules\b|['"]shell['"]\s*,\s*['"]js['"]/;
// spirit.elements, and ui.elements, the old shell's hand-out of it to an app (api.ui.elements.<name>).
const OLD_ELEMENT_HOME = /\b(?:spirit|ui)\s*\.\s*elements\b/;
// The vendored libraries' old place (goal/G43.25), and the suites that name it on purpose: job.js's, which compares the
// libraries with the commit before their move, and fileSystem's and deskClient's.
const OLD_NODE_MODULES = /spirit\/run\/node_modules/;
// goal/G49.23: those suites stand at their scripts' tests now, spirit/job/engine/test/script.js and spirit/fs/server/test/script.js
// (the job and fileSystem suites, moved with their scripts); deskClient is gone.
const NODE_MODULES_ON_PURPOSE = /^spirit\/run\/spirit\/(job\/engine|fs\/server)\/test\/script\.(js|md)$/;
// Each line of a script's code, its comments left out (a comment may quote Andy), that matches re, as <file>:<line>.
// With bare, each line read alone, its strings and its comment left out: a test's title, message or regular expression may
// name an old home to say it is gone, and a line read alone is not misled by a quote mark inside a regular expression above it.
function codeLinesMatching(rel, re, bare) {
  if (!/\.(js|html)$/.test(rel)) return [];
  let src = '';
  try { src = unforbidden(rel, readSource(rel)); } catch (e) { return []; }
  const hits = [];
  const lines = bare ? src.split('\n').map(function (l) {
    return l.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\\n]|\\.)*`/g, "''").replace(/\/\/.*$/, '').replace(/(^|[=(,:\[!&|?{};]\s*|\breturn\s+)\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/g, '$1RE').replace(/^\s*\*.*$/, '');
  }) : codeOf(src, false).split('\n');
  lines.forEach(function (line, i) { if (re.test(line)) hits.push(i + 1); });
  return hits;
}
// EVERY WRITTEN REQUIRE NAMES A FILE THAT EXISTS (goal/G47.1; Andy: "every spirit.requireScript of a written path names a file
// that exists", in place of search.js's list of old paths, "a require that runs later, on a click, now goes unseen until you
// click"). Read from the code, so a require that only runs on a click is judged too: spirit.requireScript('<path>'), and a list of
// written paths a require is mapped over (['a.js', 'b.js'].map(... spirit.requireScript ...)). Comments left out.
function missingRequires(rel) {
  // Tests too (cw's review: a test that still requires a deleted file is the stale test again). A test asks for a missing
  // file on purpose by its name: one it plants, zz<Name>, or one that is not there, noSuch<Name>.
  if (!/\.(js|html)$/.test(rel)) return [];
  let src = '';
  try { src = readSource(rel); } catch (e) { return []; }
  const code = codeOf(src, false);
  const asked = [];
  // spirit.requireScript, and any short name a file gives its spirit (S.requireScript, sp.requireScript): every <name>.require of a path written
  // as the tree's, spirit/... or run://spirit/...; node's own require of a relative path is not this rule's.
  const one = /\b(?:[A-Za-z_$][\w$]*\s*\.\s*)?require(?:Script)?\s*\(\s*(['"])((?:run:\/\/|\/)?spirit\/[^'"\n]+)\1/g;
  let m = null;
  while ((m = one.exec(code))) asked.push({ p: m[2], at: m.index });
  const list = /\[((?:\s*['"][^'"\n]+\.(?:js|css|json|html)['"]\s*,?)+)\s*\]/g;
  while ((m = list.exec(code))) {
    if (!/\brequire\b/.test(code.slice(m.index + m[0].length, m.index + m[0].length + 200))) continue;
    (m[1].match(/['"][^'"\n]+['"]/g) || []).forEach(function (q) { asked.push({ p: q.slice(1, -1), at: m.index }); });
  }
  // A path written run://<path> is judged as <path> (the design: requires start with run://).
  asked.forEach(function (a) { a.p = a.p.replace(/^run:\/\//, ''); });
  const onPurpose = function (p) { return /(^|\/)(zz|noSuch)[A-Za-z0-9]/.test(p); };
  return asked.filter(function (a) { return /^\/?[\w.-]+(\/[\w.-]+)*\.(js|css|json|html)$/.test(a.p) && !onPurpose(a.p) && !fs.existsSync(path.join(RUN, a.p.replace(/^\//, ''))); });
}
// ONE LIST OF VENDORED FOLDERS (goal/G43.25; moved here from spirit/test/fileSystem.js, goal/G47.1, where it was a list of
// the walkers at one old commit). Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules
// container?": fileSystem.js keeps the one list every walker reads, so no code skips node_modules by its own name.
const OWN_NODE_MODULES_SKIP = /['"]node_modules['"]/;
// A BRANCH FILE IS LOADED BY ITS PATH (goal/G47.1, box v182; Andy: "AND WHY THE FUCK WOULD YOU LOAD data.js differently from
// the way you load api.js?????", "... OR ANY OTHER standard branch fucking file"): every branch file sits at a known path and
// is required by it, as api.js is; nothing asks for one by the branch's name and has it looked up. The name-taking loader is
// spirit.cacheManager, so a call or a definition of it in product code is the sign.
const BY_NAME_LOADER = /\bcacheManager\s*\(/;
// AN api.js LOADS ITS OWN data.js, AND NOTHING ELSE DOES (goal/G47.1, Andy: "RULE: \"every api.js requires it's companion
// data.js, and is the only script to require that data.js\"", then "GO!"). A branch's data.js is a data.js with an api.js
// beside it; spirit/client/script.js, the data module every data.js loads, is no branch's. Read from the code, comments left out.
function branchDataFiles(files) {
  return (files || []).filter(function (f) { return /(^|\/)data\.js$/.test(f) && !/(^|\/)test\//.test(f) && f !== 'spirit/client/script.js' && fs.existsSync(path.join(RUN, f.replace(/data\.js$/, 'api.js'))); });
}
// The branch data.js paths a file's code requires by its written path.
function dataRequiresOf(rel) {
  let src = '';
  try { src = readSource(rel); } catch (e) { return []; }
  const out = [];
  const re = /\brequire(?:Script)?\s*\(\s*['"`](spirit\/[^'"`]+\/data\.js)['"`]/g;
  const code = codeOf(src, false);
  let m;
  while ((m = re.exec(code))) out.push(m[1]);
  return out;
}
// The files these rules read: what git tracks under spirit/, code, tests and documents, vendored code and this test's own
// files left out (they name the old homes to find them).
function elementRuleFiles() {
  return gitIn(RUN, ['ls-files']).filter(function (f) {
    return /^spirit\//.test(f) && /\.(js|html|md|css|txt|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f));
  });
}
// A file as these rules judge it, every offset kept: "Andy's words are never rewritten", so a double-quoted part of a
// comment or of a document is left out, a quote over several lines too; code is judged whole, its strings with it.
function unquoted(rel, src) {
  const blank = function (q) { return q.replace(/[^\n]/g, ' '); };
  if (!/\.(js|html)$/.test(rel)) return /\.(md|txt)$/.test(rel) ? src.replace(/"[^"]*"/g, blank) : src;
  const code = codeOf(src, false);
  let comments = '';
  for (let i = 0; i < src.length; i++) comments += (code[i] === src[i] || src[i] === '\n') ? (src[i] === '\n' ? '\n' : ' ') : src[i];
  // Quotes paired within each block of comment lines, so one stray mark elsewhere shifts no pairing.
  const blocks = [];
  comments.split('\n').forEach(function (line, i, all) {
    if (i > 0 && /\S/.test(line) && /\S/.test(all[i - 1])) blocks[blocks.length - 1] += '\n' + line;
    else blocks.push(line);
  });
  const said = blocks.map(function (block) { return block.replace(/"[^"]*"/g, blank); }).join('\n');
  let out = '';
  for (let i = 0; i < src.length; i++) out += said[i] !== ' ' && said[i] !== '\n' ? said[i] : code[i];
  return out;
}
// Each line of the file that matches re, as <file>:<line>.
function linesMatching(rel, re) {
  let src = '';
  try { src = unforbidden(rel, readSource(rel)); } catch (e) { return []; }
  const hits = [];
  unquoted(rel, src).split('\n').forEach(function (line, i) { if (re.test(line)) hits.push(i + 1); });
  return hits;
}
// Where the code (comments and the insides of strings left out) reaches through spirit.element for what the tree does not hold:
// spirit.element.<keys>, its place on the spirit object since goal/G49.23 (no spirit.required), stands for a script
// spirit/element/<keys>.js or a folder spirit/element/<keys>/ of the run tree, its members after it. No element is named
// here: the tree answers. x.spirit.element (a member of another object) is not judged by this rule.
function strayElementReaches(rel) {
  if (!/\.(js|html)$/.test(rel)) return [];
  let src = '';
  try { src = readSource(rel); } catch (e) { return []; }
  const stray = [];
  codeOf(src, true).split('\n').forEach(function (line, i) {
    const re = /(?<![\w$]\s*\.\s*)(?<![\w$])(?:(?:window|self)\s*\.\s*)?spirit\s*\.\s*element((?:\s*\.\s*[A-Za-z_$][\w$]*)+)/g;
    let m = null;
    while ((m = re.exec(line))) {
      const keys = m[1].split('.').map(function (k) { return k.trim(); }).filter(Boolean);
      // A folder's script.js stands at its folder's own name (goal/G49.9), spirit/element/script.js at spirit.element itself:
      // a single key after it is a member of that script.
      let found = keys.length === 1 && fs.existsSync(path.join(RUN, 'spirit', 'element', 'script.js'));
      for (let n = keys.length; n > 0 && !found; n--) {
        const at = path.join.apply(path, [RUN, 'spirit', 'element'].concat(keys.slice(0, n)));
        found = fs.existsSync(at + '.js') || fs.existsSync(path.join(at, 'script.js')) || (n === keys.length && fs.existsSync(at) && fs.statSync(at).isDirectory());
      }
      if (!found) stray.push(i + 1);
    }
  });
  return stray;
}
// EVERY PRODUCT SCRIPT, PLACED WHERE IT IS REQUIRED (goal/G43.32, the box, testing point 3; Andy: "a general test for
// any scriptFile.js is to spirit.requireScript() it.", Q5: "doesn't spirit.requireScript() only load a script, store it at
// spirit.required.<path>  and run it once.", "element scripts themselves are who installs the element factory at
// spirit.required.<path-of-element-script>", and "I'm NOT demanding that all scripts load in all environments, I'm
// demanding that they're placed in the spirit object according to these rules IF they are required."). Each script is
// spirit.requireScript()d alone on the node and on a page; where it loads, it stands at its path on the spirit object (goal/G49.23), and on
// the node the answer came at once. Where it does not load (a page element on the node, a server on a page) nothing is
// judged. An element script (isElementScript above) has a factory with a create at its path once
// required on a page. The node side runs in the scratch copy beside the scratch node, each script in a
// process of its own; the page side on the scratch node's face page, a fresh page each. Never Andy's tree or node.
function placeKeys(rel) { return rel.replace(/\.js$/, '').split('/'); }
// NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "no developer will want to use a system
// that pollutes global name-spaces.", "go on this"; judged in oneFile below). It took the place of requireOnNode, which
// nothing called. Never loaded, as the classifier never loads them (spirit/testicle/scriptClassify/script.js): the node and the relay
// themselves.
const NODE_NEVER_LOADED = ['spirit/server/script.js', 'spirit/server/relay/script.js'];
// The one door to a temp folder, and its own test (judged in oneFile below); and the lab's own test, which reads the system
// temp folder's top to find that no copy of the tree was made there ("no copy of the tree is made for the lab node in the
// temp folder"): it builds no temp path.
const TEMP_DOOR = ['spirit/tempFolder/script.js', 'spirit/tempFolder/test/script.js', 'spirit/testicle/headLessChrome/test/script.js'];
// The scratch run a script is loaded in: the one testicle hands (SPIRIT_MOUNT_RUN), else a tree of lab's with no node on it,
// taken for this one load and freed right after (handed a list, the rule runs this part once a script, so a tree kept here
// would be one more lab node each script, and the lab's six are gone by the seventh). The script as judged, the working copy,
// is put there first.
const NG_LAB = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
// Told from the exit handler, so a script that ends its process while it loads (a server handed no state) is judged on what
// it added before it ended; written synchronously, as an exit handler must.
const NODE_GLOBALS_PROBE = 'const path = require("path"); const fs = require("fs"); const g0 = Object.getOwnPropertyNames(globalThis), p0 = Object.getOwnPropertyNames(process); let err = "";' +
  'process.on("exit", function () { try { fs.writeSync(1, "\\n@@" + JSON.stringify({ err: err, g: Object.getOwnPropertyNames(globalThis).filter(function (k) { return g0.indexOf(k) === -1; }),' +
  ' p: Object.getOwnPropertyNames(process).filter(function (k) { return p0.indexOf(k) === -1; }) }) + "\\n"); } catch (e) { /* gone */ } });' +
  'try { const s = require(path.join(process.cwd(), "spirit", "script.js")); s.requireScript(process.argv[1]); } catch (e) { err = String(e && e.message || e); }' +
  'process.exit(0);';
// { err, leaks }: leaks the names this script's own code put on globalThis (global) or process; null when it could not be
// loaded at all.
async function nodeGlobalsOf(rel, full) {
  const n = await NG_LAB.scratchNode({ shared: true, start: false });
  try { return nodeGlobalsIn((n && n.run) || '', rel, full); } finally { if (n && !n.shared) { try { NG_LAB.freeTree(n); } catch (e) { /* freed when this process ends */ } } }
}
function nodeGlobalsIn(run, rel, full) {
  const NG = { run: run };
  if (!NG.run) return null;
  const there = path.join(NG.run, rel);
  try {
    const mine = fs.readFileSync(full);
    let had = null; try { had = fs.readFileSync(there); } catch (e) { had = null; }
    if (!had || !had.equals(mine)) { fs.mkdirSync(path.dirname(there), { recursive: true }); fs.writeFileSync(there, mine); }
  } catch (e) { return null; }
  const ran = require('child_process').spawnSync(process.execPath, ['-e', NODE_GLOBALS_PROBE, rel], { cwd: NG.run, encoding: 'utf8', timeout: 20000, windowsHide: true });
  const m = /\n@@(.*)\n/.exec(String(ran.stdout || ''));
  let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
  if (!r) return null;
  let src = '';
  try { src = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { src = ''; }
  const esc = function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  const assigns = function (on, n) {
    const e = esc(n);
    return new RegExp('(^|[^.\\w$])(' + on + ')\\s*(\\.\\s*' + e + '(?![\\w$])|\\[\\s*[\'"]' + e + '[\'"]\\s*\\])\\s*=(?!=)').test(src) ||
      new RegExp('defineProperty\\s*\\(\\s*(' + on + ')\\s*,\\s*[\'"]' + e + '[\'"]').test(src);
  };
  const leaks = (r.g || []).filter(function (n) { return n !== 'spirit' && assigns('global|globalThis', n); }).map(function (n) { return 'globalThis.' + n; })
    .concat((r.p || []).filter(function (n) { return assigns('process', n); }).map(function (n) { return 'process.' + n; }));
  return { err: r.err, leaks: leaks };
}
// THE LOADER PLACES ELEMENTS (goal/G43.32; goal/G49.9: a script sets module.exports and the loader places it): no element
// script puts itself on spirit.element or spirit.elements by hand (goal/G49.23: no spirit.required).
function placedByHand() {
  return productScripts().filter(function (f) {
    if (f === 'spirit/script.js') return false;
    const code = codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true);
    return /\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*=(?!=)|\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*\[[^\]]*\]\s*=(?!=)|Object\.assign\s*\([^)]*\bspirit\.elements?\b/.test(code);
  });
}

// ── GIVEN NO FILE: THE TREE'S RULES, THEN EVERY PAGE MODULE ─────────────────────────────────────────────────────────────
function every() {
  // no module of spirit/run/ mentions spirit/run/process/
  const E = {};
  test.run('the modules are read', 0.2, function () {
    E.tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f); });
    return E.tracked.length > 0 || false;
  }, test.limit.quick);
  test.run('none of them names spirit/run/process or run://process, in code or comment', 0.4, function () {
    const named = processNamers();
    return (!!E.tracked && E.tracked.length > 0 && !named.length) || false;
  }, test.limit.quick);

  // elements are placed by the loader alone
  test.run('no product script puts an element on spirit.element or spirit.elements by hand', 0.4, function () {
    const hand = placedByHand();
    return !hand.length || false;
  }, test.limit.quick);
  // Decided 6: an app's element is placed like every element, "the shell, the app selector, the file opener and the desk
  // find it there"; so nothing reads an element at the old place, spirit.elements.<name>, any more.
  test.run('no product script reads or writes the old spirit.elements: every element is found at its path on the spirit object', 0.4, function () {
    const old = productScripts().filter(function (f) { return /\.elements\b/.test(codeOf(unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8')), true)); });
    return !old.length || false;
  }, test.limit.quick);
  // the element move: no file names an element's old homes, none reaches through spirit.element for what the tree lacks
  test.run('the files are read for the elements\' old homes, tests and documents included', 0.2, function () {
    E.elementFiles = elementRuleFiles();
    return E.elementFiles.length > 100 || false;
  }, test.limit.quick);
  test.run('no code, test or document names shell/js', 0.4, function () {
    const all = E.elementFiles || [];
    const hits = [].concat.apply([], all.map(function (f) { return linesMatching(f, OLD_ELEMENT_PATH); }));
    return (all.length > 100 && !hits.length) || false;
  }, test.limit.quick);
  test.run('no code reaches an element through spirit.elements', 0.4, function () {
    const all = E.elementFiles || [];
    const hits = [].concat.apply([], all.map(function (f) { return codeLinesMatching(f, OLD_ELEMENT_HOME, true); }));
    return (all.length > 100 && !hits.length) || false;
  }, test.limit.quick);
  // no run://node_modules (goal/G43.25; moved here from spirit/job/engine/test/script.js, goal/G47.1). Andy: "can we hide those suckers in
  // spirit/jobs/ for now? without the damn node_modules container?". Over the whole repository, install/ too.
  test.run('no tracked file of the repository names spirit/run/node_modules', 0.4, function () {
    const naming = gitIn(REPO, ['ls-files']).filter(function (f) { return !NODE_MODULES_ON_PURPOSE.test(f) && f.indexOf('spirit/run/brains/') !== 0 && !/\.(png|jpe?g|gif|ico|woff2?|ttf|zip|db)$/i.test(f) && fs.existsSync(path.join(REPO, f)); })
      .filter(function (f) { return OLD_NODE_MODULES.test(unforbidden(f, fs.readFileSync(path.join(REPO, f), 'utf8'))); });
    return !naming.length || false;
  }, test.limit.quick);
  test.run('.gitignore holds no exception for spirit/run/node_modules', 0.4, function () {
    return !/run\/node_modules/.test(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8')) || false;
  }, test.limit.quick);
  test.run('every spirit.requireScript of a written path names a file that exists', 0.4, function () {
    const all = E.elementFiles || [];
    const missing = [].concat.apply([], all.map(missingRequires));
    return (all.length > 100 && !missing.length) || false;
  }, test.limit.quick);
  test.run('no code skips node_modules by its own name: every walker reads fileSystem.js\'s VENDORED_FOLDERS', 0.4, function () {
    const all = E.elementFiles || [];
    const hits = [].concat.apply([], all.map(function (f) { return codeLinesMatching(f, OWN_NODE_MODULES_SKIP); }));
    return (all.length > 100 && !hits.length) || false;
  }, test.limit.quick);
  // The floor two lower since goal/G49.23 (box v22 Part 2): spirit/node/data.js and spirit/event/data.js went with their branches.
  test.run('every api.js beside a data.js requires that data.js', 0.4, function () {
    const data = branchDataFiles(E.elementFiles);
    return (data.length > 8 && data.every(function (d) { return dataRequiresOf(d.replace(/data\.js$/, 'api.js')).indexOf(d) !== -1; })) || false;
  }, test.limit.quick);
  test.run('no product file but its api.js requires a branch data.js', 0.4, function () {
    const data = branchDataFiles(E.elementFiles);
    const product = (E.elementFiles || []).filter(function (f) { return /\.(js|html)$/.test(f) && !/(^|\/)test\//.test(f); });
    const strays = product.filter(function (f) { return dataRequiresOf(f).some(function (d) { return data.indexOf(d) !== -1 && f !== d.replace(/data\.js$/, 'api.js'); }); });
    return (data.length > 8 && product.length > 100 && !strays.length) || false;
  }, test.limit.quick);
  test.run('no product file loads a branch file by the branch name: each is required by its full path', 0.4, function () {
    const product = (E.elementFiles || []).filter(function (f) { return /\.(js|html)$/.test(f) && !/(^|\/)test\//.test(f); });
    const hits = [].concat.apply([], product.map(function (f) { return codeLinesMatching(f, BY_NAME_LOADER); }));
    return (product.length > 100 && !hits.length) || false;
  }, test.limit.quick);
  // no warning on a grant (goal/G43.27, requirement 7; moved here from spirit/element/search/grant/grantsPanel/test/script.js,
  // goal/G47.1). Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our
  // problem.": no <verb>.warning.txt is left in the repository.
  test.run('no <verb>.warning.txt is left', 0.4, function () {
    const warns = gitIn(REPO, ['ls-files']).filter(function (f) { return /\.warning\.txt$/.test(f); });
    return !warns.length || false;
  }, test.limit.quick);
  // the search elements' pattern (goal/G43.18; moved here from spirit/element/search/test/script.js, goal/G47.1). Andy: "all
  // "probabilitySearch" elements follow the EXACT SAME PATTERN.", and the box: "Every search element in spirit/element/
  // becomes spirit/element/search/<name>.js, with its companion folder spirit/element/search/<name>/ holding its list and row
  // elements, the same pattern for all".
  test.run('under spirit/element/search/ every name is a word, and every folder sits beside its <name>.js', 0.4, function () {
    const at = path.join(RUN, 'spirit', 'element', 'search');
    const top = fs.existsSync(at) ? fs.readdirSync(at, { withFileTypes: true }).filter(function (d) { return d.name !== 'test'; }) : [];
    // goal/G49.5: <name>.js became <name>/script.js, so the search element stands in its own folder, its script.js beside its parts.
    const odd = top.filter(function (d) { return d.isDirectory() ? !/^[a-z]+$/.test(d.name) || !(fs.existsSync(path.join(at, d.name + '.js')) || fs.existsSync(path.join(at, d.name, 'script.js'))) : !/^[a-z]+\.(js|md)$/.test(d.name); }).map(function (d) { return d.name; });
    return (top.length > 0 && !odd.length) || false;
  }, test.limit.quick);
  test.run('no code reaches through spirit.element for an element the tree does not hold', 0.4, function () {
    const all = E.elementFiles || [];
    const stray = [].concat.apply([], all.map(strayElementReaches));
    return (all.length > 100 && !stray.length) || false;
  }, test.limit.quick);

  // run://test/ is moved into run://spirit/test/
  test.run('run://test/ holds no tracked file', 0.4, function () {
    const left = gitIn(RUN, ['ls-files', '--', 'test/']);
    return !left.length || false;
  }, test.limit.quick);
  // nothing under spirit/run/ names run://test/
  test.run('the files are read, tests and documents included', 0.2, function () {
    E.files = gitIn(RUN, ['ls-files']).filter(function (f) {
      return /\.(js|md|html|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f));
    });
    return E.files.length > 0 || false;
  }, test.limit.quick);
  test.run('none of them names the old run://test/, in code, comment or document', 0.4, function () {
    const files = E.files || [];
    const naming = files.filter(function (f) { try { return OLD_NAMED.test(unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8'))); } catch (e) { return false; } });
    return (files.length > 0 && !naming.length) || false;
  }, test.limit.quick);
  // run://spirit/test/'s tools are not tests
  test.run('testModule.js lists tests', 0.2, function () {
    const moduleAt = [path.join(RUN, 'spirit', 'testicle', 'testModule', 'script.js'), path.join(RUN, 'test', 'testModule.js')].filter(function (p) { return fs.existsSync(p); })[0];
    E.listed = moduleAt ? require(moduleAt).testsFor('').map(function (t) { return t.test; }) : [];
    return E.listed.length > 0 || false;
  }, test.limit.quick);
  test.run('testModule.js lists none of testReport.js, testModule.js and headLessChrome.js as a test', 0.4, function () {
    const all = E.listed || [];
    const toolsListed = all.filter(function (t) { return TOOLS.indexOf(path.posix.basename(t)) !== -1 && /^(spirit\/)?test\/[^/]+$/.test(t); });
    return (all.length > 0 && !toolsListed.length) || false;
  }, test.limit.quick);
  // git ignores run:// except run://spirit/
  function ignoreLines() { return fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; }); }
  test.run('.gitignore holds /spirit/run/* and !/spirit/run/spirit/', 0.4, function () {
    const lines = ignoreLines();
    return (lines.indexOf('/spirit/run/*') !== -1 && lines.indexOf('!/spirit/run/spirit/') !== -1) || false;
  }, test.limit.quick);
  test.run('no other line names a path under run:// outside run://spirit/, since run://* covers it', 0.4, function () {
    const dead = ignoreLines().filter(function (l) {
      const p = l.replace(/^!/, '').replace(/^\//, '');
      return p.indexOf('spirit/run/') === 0 && p.indexOf('spirit/run/spirit/') !== 0 && l !== '/spirit/run/*';
    });
    return !dead.length || false;
  }, test.limit.quick);
  test.run('a new file in run:// outside spirit/ is ignored', 0.4, function () {
    const outside = 'spirit/run/zz-g4332-not-tracked.txt';
    return ignoredByGit(outside) || false;
  }, test.limit.quick);
  test.run('a new file in run://spirit/ is not ignored', 0.4, function () {
    const inside = 'spirit/run/spirit/zz-g4332-not-tracked.txt';
    return !ignoredByGit(inside) || false;
  }, test.limit.quick);

  // every product script: use strict, spirit first, the tree only through spirit.requireScript
  test.run('the product scripts are read, tests and vendored code left out', 0.2, function () {
    E.scripts = productScripts();
    return E.scripts.length > 100 || false;
  }, test.limit.quick);
  test.run('all of them hold the shape', 0.4, function () {
    const all = E.scripts || [];
    const broken = all.filter(shapeBreaks);
    return (all.length > 100 && !broken.length) || false;
  }, test.limit.quick);

  // every product script: spirit.js required first, every require path a child, a sibling or an ancestor's file
  test.run('the product scripts are read for the module rules', 0.2, function () {
    const all = productScripts();
    E.ruled = all.map(function (f) { return { f: f, r: moduleRules(path.join(RUN, f)) }; });
    return all.length > 100 || false;
  }, test.limit.quick);
  test.run('every one takes spirit.js first, or is page code', 0.4, function () {
    const ruled = E.ruled || [];
    const late = ruled.filter(function (x) { return x.r.early; });
    return (ruled.length > 100 && !late.length) || false;
  }, test.limit.quick);
  test.run('none of their require paths breaks the require rule', 0.4, function () {
    const ruled = E.ruled || [];
    const astray = ruled.filter(function (x) { return x.r.bad.length; });
    return (ruled.length > 100 && !astray.length) || false;
  }, test.limit.quick);

  // every shell file that paints an icon loads the icon element
  // Said only when a file paints icons: painters() reads the files git tracks under shell/.
  let painting = [];
  try { painting = painters(); } catch (e) { painting = []; }
  if (painting.length) {
    test.run('it paints icons, and loads the icon element or hands them to one that does', 0.4, function () {
      return !painting.some(function (f) {
        const src = fs.readFileSync(path.join(RUN, f), 'utf8');
        // A file that hands its glyphs to the one-row form (goal/G41.27) paints them through it: rowForm loads the icon element
        // itself (rule/26).
        return src.indexOf('spirit/element/icon/script.js') === -1 && src.indexOf('spirit/element/rowForm/script.js') === -1;
      });
    }, test.limit.quick);
  }


  test.after(async function () {
    if (E.page) { try { if (E.page.kid) E.page.kid.kill(); } catch (e) { /* gone */ } }
    if (E.node) {
      try { E.node.child.kill(); } catch (e) { /* gone */ }
      await sleep(300);
      try { SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(E.node); } catch (e) { /* scratch */ }
    }
  });
}


// fieldCode, not code: a function of that name further down, taking source, would stand in its place (both hoisted).
// Markup written in a string is a field it makes, so strings stay; a pattern that looks for fields makes none (goal/G49.27:
// generalRules' own patterns read as fields), so regex literals are blanked.
function fieldCode(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return codeOf(t, false, true); }
// THE INPUT FIELDS A SCRIPT MAKES (goal/G48.4, box v22), read from its code: every createElement of an input or a textarea,
// and every <input or <textarea it writes as markup, but for an <input of type checkbox, radio, button, submit or hidden.
const NOT_A_FIELD = /^<input\b[^>]*\btype\s*=\s*\\?["']?(checkbox|radio|button|submit|hidden)\b/i;
function inputsMade(file) {
  const c = fieldCode(file);
  const made = (c.match(/createElement\(\s*['"](input|textarea)['"]\s*\)/g) || []).length;
  const marked = (c.match(/<(input|textarea)\b[^>]*/gi) || []).filter(function (m) { return !NOT_A_FIELD.test(m); }).length;
  return made + marked;
}
// Its fieldInput.attach calls: those naming a type file by its full path, spirit/type/<...>/script.js (goal/G49.13), as their
// rule, and those naming anything else.
// The element handed may be a call of its own (document.getElementById('x')): its second argument is found past the first
// comma outside any bracket.
function typedAttaches(file) {
  const c = fieldCode(file);
  let typed = 0, untyped = 0;
  const rules = [];
  const at = /\.attach\(/g;
  let m;
  while ((m = at.exec(c))) {
    let i = m.index + m[0].length, depth = 0, q = '';
    for (; i < c.length; i++) {
      const ch = c[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'" || ch === '`') q = ch;
      else if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth--; }
      else if (ch === ',' && depth === 0) break;
    }
    if (c[i] !== ',') continue;
    const rule = /^\s*['"]([^'"]*)['"]/.exec(c.slice(i + 1));
    if (!rule) continue;
    rules.push(rule[1]);
    if (/^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule[1])) typed++; else untyped++;
  }
  return { typed: typed, untyped: untyped, rules: rules };
}

function oneFile(P) {
  // goal/G43.31, a branch named as its folder, is judged on each branch folder by ./script-sibling-branchRules.js (goal/G43.32).
  // goal/G43.30: every file judged here, app, element or neither, mentions no spirit/run/process (noProcessAnywhere).
  // <address>: it mentions no spirit/run/process
  test.run('it names neither spirit/run/process nor run://process, in code or comment', 0.4, function () {
    return !namesProcess(rel) || false;
  }, test.limit.quick);
  // the element move (elementRuleFiles above): its old homes, and spirit.element only for what the tree holds
  {
    test.run('it names no shell/js', 0.4, function () {
      const hits = linesMatching(rel, OLD_ELEMENT_PATH);
      return !hits.length || false;
    }, test.limit.quick);
    test.run('its code reaches no element through spirit.elements', 0.4, function () {
      const hits = codeLinesMatching(rel, OLD_ELEMENT_HOME, true);
      return !hits.length || false;
    }, test.limit.quick);
    if (!NODE_MODULES_ON_PURPOSE.test('spirit/run/' + rel)) test.run('it names no spirit/run/node_modules', 0.4, function () {
      const hits = linesMatching(rel, OLD_NODE_MODULES);
      return !hits.length || false;
    }, test.limit.quick);
    if (/\.(js|html)$/.test(rel)) {
      test.run('every spirit.requireScript of a written path in it names a file that exists', 0.4, function () {
        const missing = missingRequires(rel);
        return !missing.length || false;
      }, test.limit.quick);
      test.run('its code skips no node_modules by its own name', 0.4, function () {
        const hits = codeLinesMatching(rel, OWN_NODE_MODULES_SKIP);
        return !hits.length || false;
      }, test.limit.quick);
      if (!/(^|\/)test\//.test(rel)) test.run('it loads no branch file by the branch name, only by its full path', 0.4, function () {
        return !codeLinesMatching(rel, BY_NAME_LOADER).length;
      }, test.limit.quick);
      // Its own data.js, when it is an api.js with one beside it; no branch's data.js otherwise.
      const ownData = /(^|\/)api\.js$/.test(rel) ? rel.replace(/api\.js$/, 'data.js') : '';
      if (ownData && fs.existsSync(path.join(RUN, ownData))) test.run('it is an api.js and requires the data.js beside it', 0.4, function () {
        return dataRequiresOf(rel).indexOf(ownData) !== -1;
      }, test.limit.quick);
      if (!/(^|\/)test\//.test(rel)) test.run('it requires no branch data.js but its own, as an api.js', 0.4, function () {
        return dataRequiresOf(rel).every(function (d) { return d === ownData; });
      }, test.limit.quick);
    }
    if (/\.(js|html)$/.test(rel)) test.run('it reaches through spirit.element only for elements the tree holds', 0.4, function () {
      const stray = strayElementReaches(rel);
      return !stray.length || false;
    }, test.limit.quick);
  }
  // goal/G43.32: a product script holds the shape (everyScriptShaped).
  if (/^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    // <address>: use strict, spirit first, the tree only through spirit.requireScript
    test.run('it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.requireScript', 0.4, function () {
      return !shapeBreaks(rel);
    }, test.limit.quick);
  }
  // EVERY INPUT FIELD VALIDATES BY ITS TYPE (goal/G48.4, box v22: "ever input field in every element must validate the input
  // with the new type checks."): a script that makes input fields, an <input> of any type but checkbox, radio, button,
  // submit or hidden, or a <textarea>, hands as many to fieldInput.attach with a type file's full path,
  // spirit/type/<...>/script.js (goal/G49.13), as it makes, and no attach of it names anything else.
  if (/^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel) && inputsMade(full) > 0) {
    test.run('each input field it makes is handed to fieldInput.attach with the full path of its field\'s type file', 0.4, function () {
      const t = typedAttaches(full);
      return (t.typed >= inputsMade(full) && t.untyped === 0) || false;
    }, test.limit.quick);
    // THE ELEMENT KNOWS ITS FIELDS' TYPES AND REQUIRES THEM (goal/G49.13; Andy: "The UI elements need to know which spirit/type
    // their fields are and require that type or length checks and validation of the input fields, is THAT NOT FUCKING
    // OBVIOUS???"): every type file it hands to fieldInput.attach, it requires itself, by that full path written out.
    test.run('it requires, by its full path, the type file of every field it hands to fieldInput.attach', 0.4, function () {
      const t = typedAttaches(full);
      const c = fieldCode(full);
      if (!t.rules.length) return false;
      return t.rules.every(function (r) {
        const p = String(r).replace(/\?$/, '');
        return /^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(p) && (c.indexOf("requireScript('" + p + "')") !== -1 || c.indexOf('requireScript("' + p + '")') !== -1);
      }) || false;
    }, test.limit.quick);
  }
  // The general rules of a module (moduleRules above), on any file handed, a product script or not.
  // <address>: the spirit object is a global before anything else is loaded
  const mr = moduleRules(full);
  if (mr.page) test.run('it is page code: node never loads it', 0.4, function () { return moduleRules(full).page || false; }, test.limit.quick);
  else if (mr.spirit) test.run('it sets the global spirit before its first require', 0.4, function () { return !moduleRules(full).early; }, test.limit.quick);
  else test.run('it requires spirit.js first', 0.4, function () { return !moduleRules(full).early; }, test.limit.quick);
  // NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "the same rule MUST apply to both the
  // window object for isBrowser and what is it on node? the process object?", "no developer will want to use a system that
  // pollutes global name-spaces.", "go on this"). The page's side is spirit/testicle/general/browser/pageRules/script.js's. In a node every file has
  // its own scope, so only an assignment onto globalThis (global) or process leaks: the script is loaded alone, in a node of
  // its own, in a scratch run (the one testicle hands, else one of lab's), and what the global object and process hold after
  // that they did not before spirit.js is the script's when its own code assigns that name; spirit is the one name allowed.
  if (!mr.page && /^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && NODE_NEVER_LOADED.indexOf(rel) === -1 && !VENDORED_FOLDERS.holds(rel)) {
    test.run('loaded in a node, it adds nothing to the global object or to process but spirit', 0.7, async function () {
      const g = await nodeGlobalsOf(rel, full);
      return !!g && Array.isArray(g.leaks) && !g.leaks.length || false;
    }, test.limit.slow);
  }
  // ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box, no pollution: names and folders: "One helper on the spirit
  // object hands a process its temp folder, made empty when asked; nothing else builds a temp path. Guard: the general test
  // is red on a product script or test that calls the system temp folder directly."). Read in its code, strings and
  // comments left out: a call of tmpdir(). The helper itself, spirit/tempFolder/script.js, and its own test, which checks the
  // helper's paths against the system temp folder, are the two that may.
  if (/^spirit\/.+\.js$/.test(rel) && !VENDORED_FOLDERS.holds(rel) && TEMP_DOOR.indexOf(rel) === -1) {
    test.run('it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js', 0.4, function () {
      let src = '';
      try { src = codeOf(fs.readFileSync(full, 'utf8'), true); } catch (e) { return false; }
      return !/\btmpdir\s*\(/.test(src) || false;
    }, test.limit.quick);
  }
  // A SEARCH'S PARTS ARE NAMED BY THEIR WORD (goal/G47.4, the box: "A search's parts are named by their word: list.js, row.js
  // and detail.js, in place of list.js, row.js and detail.js"; "The guard first: the general test is red
  // on any file named list.js, row.js or detail.js, and on any code that still names them"). Its name
  // read from its path; its code with its strings kept, so a require path or a place on the spirit object counts, and its
  // comments left out.
  // The old names are built from their parts, so this check's own code does not name them; its titles are fixed strings that
  // describe them without naming them (goal/G49.6; Andy: "NO FUCKING DYNAMICALLY ASSEMBLING MOTHERFUCKING TEST-TITLES").
  const OLD_PARTS = ['list', 'row', 'detail'].map(function (w) { return w + 'Element'; });
  if (/^spirit\/.+\.js$/.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    test.run('its file is named by its word, never by an old search part name', 0.4, function () {
      return !/^(?:list|row|detail)Element\.js$/.test(path.basename(rel)) || false;
    }, test.limit.quick);
    test.run('its code names no old search part name', 0.4, function () {
      let src = '';
      try { src = codeOf(fs.readFileSync(full, 'utf8'), false); } catch (e) { return false; }
      return !/\b(?:list|row|detail)Element\b/.test(src) || false;
    }, test.limit.quick);
  }
  // THE SEARCH BRANCH (goal/G47.4, box v9: "spirit/search/ is a branch whose js api is two searches and nothing else: string,
  // at spirit/search/string, and object, at spirit/search/object"; the two probability match files at the root go, and
  // "nothing names the old files after the move"; the bucket becomes the helper spirit/listLimiter/script.js). No file keeps an old name, and no code names an old file: strings kept, so a require
  // path counts; comments left out. The functions keep their names (cw, under the item: "The functions keep their names,
  // only the files move"), so a call of one is no old file. The old names are built from their parts, so this check's own
  // titles do not name them in code.
  const OLD_SEARCH = ['StringMatch', 'StringObjectMatch', 'Bucket'].map(function (w) { return 'probability' + w; });
  const OLD_SEARCH_RE = new RegExp('\\b(?:' + OLD_SEARCH.join('|') + ')\\.js\\b');
  if (/^spirit\/.+\.js$/.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    test.run('its file is not one of the three old probability files', 0.4, function () {
      return OLD_SEARCH.indexOf(path.basename(rel, '.js')) === -1 || false;
    }, test.limit.quick);
    test.run('its code names none of the three old probability files', 0.4, function () {
      let src = '';
      try { src = codeOf(fs.readFileSync(full, 'utf8'), false); } catch (e) { return false; }
      return !OLD_SEARCH_RE.test(src) || false;
    }, test.limit.quick);
  }
  // <address>: every require path is a child, a sibling or an ancestor's file
  test.run('none of its require paths breaks the rule', 0.4, function () {
    return !moduleRules(full).bad.length;
  }, test.limit.quick);
  if (!kindOf(rel)) {
    test.run('it places no element (no create in its exports): a switch, a server or a helper, not mounted', 0.4, function () {
      return !kindOf(rel) || false;
    }, test.limit.quick);
    return;
  }
  const ownCode = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  // ITS ROWS FROM ITS BRANCH (goal/G49.23, box v21; Andy: "no spirit.dataStore"): an element reads a branch's rows from the
  // branch spirit.requireScript hands back, at its client; it reads no spirit.dataStore and asks for no client script.
  // <address>: it reads its rows from the branch it requires
  test.run('it reads no spirit.dataStore and asks for no client script: its rows come from the branch it requires', 0.4, function () {
    return (!/\.dataStore\b/.test(ownCode) && !/requireScript\(\s*['"][^'"]*\/client\/script\.js['"]/.test(ownCode)) || false;
  }, test.limit.quick);
  // THE WHOLE ROW, NEVER A FEW FIELDS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and
  // search the whole row, as cached in spirit.required.spirit.data."): no app or element hands a search a matched(row) of its own; the
  // search element itself matches the whole row.
  if (rel !== 'spirit/element/search/script.js') {
    // <address>: its searches match the whole row
    test.run('it hands no search a matched() of its own', 0.4, function () {
      return !/\bmatched\s*:/.test(ownCode) || false;
    }, test.limit.quick);
  }
  // WHAT IT CHANGES, IT LISTENS FOR, IN ITS CODE (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when
  // it changes shit it listens to fucking update via the spirit object"): judged without a page, since a bare mount
  // seldom has a row to change. A module whose code sends a write (an op that changes a row, or a verb that sets) watches
  // the store (spirit.client, goal/G49.23): a .watch( of its own, or a search made on a branch of the store (its data: option), the branch named as
  // text or by the one that keeps it (data: K.branch, the cache manager's own name for it).
  {
    const own = ownCode;
    // A write in code: an op that changes a row ({ op: 'set' }), a verb named as a string that changes one
    // ('spirit.setName', 'chat.add', 'box.write'), or a spirit family's setting verb called (spirit.relay.api.join(...)).
    const WRITE = /\bop\s*:\s*['"](add|set|delete|remove|grant|revoke|ask|claim|press)['"]|['"][a-z]\w*(?:\.[a-z]\w*)*\.(?:set[A-Z]\w*|set|add|delete|remove|grant|revoke|join|face|write|press|claim)['"]|\bspirit\.\w+\.(?:set[A-Z]\w*|join|face|grant|revoke)\s*\(|\.relay\.(?:join|face)\s*\(|\.(?:saveFile|grant|revoke)\s*\(\s*\w/;
    const writes = WRITE.exec(own);
    // <address>: what its code changes, it watches in the store
    if (!writes) {}
    else {
      // OR THROUGH A CHILD IT MOUNTS ON A BRANCH (goal/G47.1; wsl, of the model table: "the list it mounts (the shared agent
      // table, data: the model branch) is what shows the result, so it does listen, through its child"; cw: "A child it mounts
      // on a branch counts as its listening"): an element it requires whose own code makes a search on a branch of the store,
      // handed the branch's name (table: or branch:, a word). No watch of its own is added to pass.
      const ON_BRANCH = /\bdata\s*:\s*(?:['"][\w.\/-]+['"]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/;
      const child = function () {
        if (!/\b(?:table|branch)\s*:\s*['"][\w.-]+['"]/.test(own)) return false;
        const asked = own.match(/require(?:Script)?\(\s*['"](spirit\/[^'"]+\.js)['"]/g) || [];
        return asked.some(function (r) {
          const p = /['"]([^'"]+)['"]/.exec(r)[1];
          let c = ''; try { c = fs.readFileSync(path.join(RUN, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return false; }
          // The child's branch may be worked out from the name it is handed (data: branchOf(o.table)): any data: option, in a
          // child that loads the search element.
          return /spirit\/element\/search\/script\.js/.test(c) && /\bdata\s*:\s*[\w$'"]/.test(c);
        });
      };
      test.run('it sends writes and watches the store', 0.4, function () {
        return (/\.watch\s*\(/.test(own) || ON_BRANCH.test(own) || child()) || false;
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
    return !handed.length || false;
  }, test.limit.quick);

}

// What it judges: given no file, the tree and every page module; given a file, that file. A page module's page is drawn
// before its rules are said (session above), so a rule its page gives nothing to judge is never said green.

// What it judges: given no file, the tree; given a file, that file's code (its page is spirit/testicle/general/browser/pageRules/script.js's).
if (!arg) every();
else if (!full) test.run('the file handed is there', 0.2, function () { return false; }, test.limit.quick);
else oneFile({});
// NO TRACKED FILE NAMES THE DELETED VERIFIER (goal/G47.1, box v101, the cycle that deletes the desk's verifier: no tracked
// file names it). Over the whole repository, the files outside spirit/run too, by path and by content, in any case. The name
// is built here, so this file names it nowhere itself.
if (!String(ARGS[0] || '')) {
  // NO ROUTE UNDER /api/ (goal/G49.18, box v6: "both node and relay server have at the root of their path-routes the stupid
  // API/ node. of course this must be 'spirit'"; the rename "about thirty product files that name a route, the relay host docs
  // and bash/card-ask.js, all in one push"). Over the whole repository, code, docs, host scripts and tests alike, nothing names
  // the node's old door or an old relay route under api. The words are built here, so this file names them nowhere itself.
  test.run('no tracked file names a route under /api/: not the node\'s door, not one of the relay\'s routes', 0.4, function () {
    const old = '/' + ['api', ''].join('/');
    const top = require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8' }).trim();
    let hits = '';
    try { hits = require('child_process').execFileSync('git', ['grep', '-l', '-I', '-E', old.replace(/\//g, '\\/') + '(spirit|relay/)'], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { hits = String((e && e.stdout) || ''); }
    const files = hits.split('\n').filter(Boolean).filter(function (f) { return !/codeMirror\/|chokidar\/|readdirp\//.test(f); });
    return files.length === 0 || false;
  }, test.limit.slow);
  test.run('no tracked file names the deleted verifier, by path or by content', 0.4, function () {
    const word = ['desk', 'Verify'].join('');
    const top = require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8' }).trim();
    let hits = '';
    try { hits = require('child_process').execFileSync('git', ['grep', '-l', '-i', '-I', word], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { hits = String((e && e.stdout) || ''); }
    const named = require('child_process').execFileSync('git', ['ls-files'], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return f.toLowerCase().indexOf(word.toLowerCase()) !== -1; });
    const all = hits.split('\n').filter(Boolean).concat(named).filter(function (f, i, a) { return a.indexOf(f) === i; });
    return all.length === 0 || false;
  }, test.limit.slow);
  // THE LAB REDRAWN (goal/G47.3, the box: "labMaster lives in repo://lab/ (today repo://spirit/test/labMaster/)",
  // "repo://lab/node/ is .gitignored", "its tools (box.js, inspect.js, runsHome.js, wirePaths.js) move with labMaster to
  // repo://lab/", "fixtures/jobCallbackFixture.js is used by nobody and goes", "visual/*.json have no reader left ... so they
  // go, with the stale lines naming them in README/HARNESS/HUMAN_TOOLS.md", "not every node-starting test goes through
  // scratchNode ... those move onto scratchNode as part of this"). Judged over the whole repository, from git.
  const fs = require('fs');
  const path = require('path');
  const top = function () { return require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8' }).trim(); };
  const trackedAll = function () { return require('child_process').execFileSync('git', ['ls-files'], { cwd: top(), encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean); };
  test.run('labMaster lives in repo://lab/, its parts with it, and nothing is left of spirit/test/labMaster/', 0.4, function () {
    const all = trackedAll();
    const want = ['labMaster.js', 'ensureMaster.js', 'labPaths.js', 'labMastPanel.html', 'BONES.md', 'STATE.md'];
    const inLab = all.filter(function (f) { return /^lab\//.test(f); }).map(function (f) { return f.split('/').pop(); });
    const missing = want.filter(function (n) { return inLab.indexOf(n) === -1; });
    const left = all.filter(function (f) { return /^spirit\/test\/labMaster\//.test(f); });
    return (!missing.length && !left.length) || false;
  }, test.limit.slow);
  test.run('the old test folder\'s tools are in repo://lab/, its unused fixture and its visual json are gone', 0.4, function () {
    const all = trackedAll();
    const tools = ['box.js', 'inspect.js', 'runsHome.js', 'wirePaths.js'];
    const inLab = all.filter(function (f) { return /^lab\//.test(f); }).map(function (f) { return f.split('/').pop(); });
    const bad = tools.filter(function (n) { return inLab.indexOf(n) === -1; })
      .concat(all.filter(function (f) { return /^spirit\/test\/(tools|fixtures|visual)\//.test(f); }));
    return !bad.length;
  }, test.limit.slow);
  test.run('.gitignore keeps repo://lab/node/ out of git, and git holds nothing under it', 0.4, function () {
    let ignored = false;
    try { require('child_process').execFileSync('git', ['check-ignore', '-q', 'lab/node/zzProbe/x.js'], { cwd: top() }); ignored = true; } catch (e) { ignored = false; }
    const held = trackedAll().filter(function (f) { return /^lab\/node\//.test(f); });
    return (ignored && !held.length) || false;
  }, test.limit.slow);
  test.run('README/HARNESS/HUMAN_TOOLS.md names neither visualScenarios.js nor presenceShow.js', 0.4, function () {
    let t = ''; try { t = fs.readFileSync(path.join(top(), 'README', 'HARNESS', 'HUMAN_TOOLS.md'), 'utf8'); } catch (e) { return false; }
    const named = ['visualScenarios.js', 'presenceShow.js'].filter(function (n) { return t.indexOf(n) !== -1; });
    return !named.length || false;
  }, test.limit.quick);
  // Every node a test uses is handed out by scratchNode (headLessChrome.js, the one helper that starts spirit/server/script.js).
  test.run('no test starts spirit/server/script.js itself: every node a test uses comes from scratchNode', 0.4, function () {
    const own = trackedAll().filter(function (f) { return /^spirit\/run\/.*\/test\/[^/]+\.js$/.test(f) && !/\/test\/headLessChrome\.js$/.test(f) && !/\/test\/test\/headLessChrome\.js$/.test(f); });
    const starting = own.filter(function (f) {
      let c = ''; try { c = fs.readFileSync(path.join(top(), f), 'utf8'); } catch (e) { return false; }
      c = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
      return /spawn\s*\([^;]*['"]spirit\/server\/script\.js['"]/.test(c) || /spawn\s*\([^;]*path\.join\([^;]*['"]server\.js['"]/.test(c);
    });
    return !starting.length || false;
  }, test.limit.slow);
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit/run/process', 'run://process', 'run:/process', 'shell/js', 'shell/node_modules', 'spirit/run/node_modules', 'spirit.elements', 'ui.elements', 'spirit\\.elements', 'PAGE_FILES', 'pageFile', 'buildStamp', 'fieldRules', 'spirit/client/packet.js', 'contact.faceable', '.processJob', 'relabel'];
module.exports = { appliesTo: appliesTo, resource: 'node', own: false, forbids: FORBIDS_NAMES, checks: checks };
