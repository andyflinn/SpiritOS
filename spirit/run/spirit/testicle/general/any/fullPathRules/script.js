'use strict';
// spirit/run/spirit/testicle/general/any/fullPathRules/script.js
// A RULE MODULE OF THE GENERAL TEST: every path written out whole (goal/G49.13), in a requireScript, a branch, a type file,
// a state path, an app's path, the face's own.
// goal/G49.27 (the box, Andy's Go: "the general file's seven parts ... each become such a module; generalRules is split
// further by topic"; "a new standard is a new folder, not a longer file"): its checks came from the one general rules
// module, spirit/testicle/general/any/generalRules/script.js, moved here unchanged in what they check and in their titles.
// Its runner is spirit/testicle/run/none/script.js. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: given no file, the tree is judged from git; given a file, nothing (its rules judge the tree).
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
  const own = Object.keys(FORBIDS).filter(function (dir) { return (require('path').posix.dirname(r) === dir && require('path').posix.basename(r) === 'script.js') || r.indexOf(dir + '/test/') === 0; })[0];
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
  // EACH A WHOLE-TREE CHECK OVER THE PRODUCT CODE (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set
  // a testicle row for the failing script and itself as the suite?"): a red row under each file that breaks the rule; fewer
  // than 100 files is no list, a red under the runner, as the floor in each was.
  test.over('every spirit.requireScript argument in product code is one path written out whole, never joined from pieces', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) {
    const c = codeText(f);
    const re = /requireScript\s*\(([^()]*(?:\([^()]*\))?[^()]*)\)/g;
    let m;
    while ((m = re.exec(c))) { if (/['"`]\s*\+|\+\s*['"`]|\$\{/.test(m[1])) return false; }
    return true;
  }, test.limit.quick);
  test.over('no server serves an address from another file: serveCommon has no PAGE_FILES and no pageFile, and nothing calls one', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) { return !(/\bPAGE_FILES\b|\bpageFile\s*\(/.test(unforbidden(f, codeText(f)))); }, test.limit.quick);
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
  test.over('every spirit.requireScript in product code is handed a full path, \'spirit/<...>.js\', written out as one string or held whole in a name', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    return files.length < 100 ? null : files;
  }, function (f) { return !(unfull(f).length > 0); }, test.limit.quick);
  test.over('spirit.requireScript is the only way a product script requires a module of the tree: its one plain require is the spirit object, the rest are node\'s own', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    return files.length < 100 ? null : files;
  }, function (f) {
    const c = codeText(f);
    const re = /(?<![\w$.])require\s*\(\s*([^)]*)\)/g;
    let m;
    while ((m = re.exec(c))) {
      const a = m[1].trim();
      if (/^(['"])(node:)?[a-z_][\w/]*\1$/.test(a) && !/^(['"])\.|\//.test(a.slice(1))) continue;
      const lit = /^(['"])([^'"]+)\1$/.exec(a);
      if (lit && shPath.resolve(shPath.dirname(shPath.join(SH.run, f)), lit[2]) === shPath.join(SH.run, 'spirit', 'script.js')) continue;
      if (/^path\.join\(\s*[A-Za-z_$][\w$]*\s*,\s*['"]spirit['"]\s*,\s*['"]script\.js['"]\s*\)$/.test(a)) continue;
      return false;
    }
    return true;
  }, test.limit.quick);
  // NO WORD MADE INTO A BRANCH PATH (goal/G49.13; Andy: "WSL, AND NO FUCKING PATH TRANSLATORS FROM SINGLE BRANCH-WORD TO FUCKING BRANCH
  // PATH EITHER!!!!!!!!!!!!!!!"): anywhere in product code, not only in a requireScript, no path is made by joining 'spirit/' or
  // 'spirit/app/' with a name, nor by path.join of 'spirit' (and 'app') with one; a branch is always held by its full path.
  const WORD_TO_PATH = /['"`]spirit\/(?:app\/)?['"`]\s*\+|path\.join\([^)]*['"]spirit['"]\s*,\s*(?:['"]app['"]\s*,\s*)?(?!['"])[A-Za-z_$][\w$.()]*/;
  test.over('no product script makes a branch path from a single word: nothing joins spirit/ or spirit/app/ with a name', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) { return !(codeText(f).split('\n').some(function (l) { return WORD_TO_PATH.test(l); })); }, test.limit.quick);
  // NO DOTTED NAME MADE INTO A PATH (goal/G49.13; Andy: "WHAT A FUCKING CHEAT, AND WHAT ABOUT THOSE DYNAMICALLY CREATED TYPE
  // SCRIPTS????????"): a type named spirit.type.string.label, or a branch named by dots, is never turned into a file path by
  // .split('.') and .join('/'); a file is always held by its full path.
  test.over('no product script turns a dotted name into a path: no .split(\'.\') joined with \'/\'', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) { return !(/\.split\(\s*['"]\.['"]\s*\)(?:\.slice\([^)]*\))?\.join\(\s*['"]\/['"]\s*\)/.test(codeText(f))); }, test.limit.quick);
  test.over('no product script builds a path to a type file or a script.js from pieces: no spirit/type/ joined with a name, no \'script.js\' appended or joined on', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) {
    const c = codeText(f);
    return !(/['"`]spirit\/type\/['"`]?\s*\+/.test(c) || /`[^`]*spirit\/type\/[^`]*\$\{/.test(c) ||
      /path\.join\([^)]*['"]type['"]\s*,/.test(c) ||
      /\+\s*['"]\/?script\.js['"]/.test(c) || /`[^`]*\$\{[^}]*\}\/script\.js`/.test(c) ||
      /path\.join\([^)]*,\s*['"]script\.js['"]\s*\)/.test(c));
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
  test.over('no product script but the spirit object makes a state path from a name: each asks spirit.statePath', 0.6, function () {
    const files = productCode().filter(function (f) { return f !== 'spirit/script.js'; });
    return files.length < 100 ? null : files;
  }, function (f) {
    let c = codeText(f);
    // A file outside spirit/ keeps its whole path under spirit/state/ for its sidecar: where those belong is for later
    // (goal/G49.17, Andy: "all oos for now"). Only that one expression is let through.
    if (f === 'spirit/fs/fileSystem/script.js') c = c.replace(/spirit\.statePath\(p\) : 'spirit\/state\/' \+ p\)/, '');
    return !(/['"`]spirit\/state\/['"`]?\s*\+/.test(c) || /path\.join\([^)]*['"]spirit['"]\s*,\s*['"]state['"]\s*,\s*(?!['"])[A-Za-z_$]/.test(c));
  }, test.limit.quick);
  // AN APP IS KNOWN BY ITS PATH, NEVER BUILT FROM A NAME (goal/G49.19, box v13: "An app's path comes from one source: the fs
  // cache's app rows ... Never \"spirit/app/\" + a name"; Andy: "all translation from name to path or back is NOT PERMITTED in
  // SpiritOS"; "yes, i need the pages fixed in this item, too"): no product script, node side or page, joins 'spirit/app/'
  // with a name, nor path.joins 'app' with one.
  test.over('no product script builds an app\'s path from a name: no \'spirit/app/\' + a name, no path.join of \'app\' with one', 0.6, function () {
    const files = productCode();
    return files.length < 100 ? null : files;
  }, function (f) {
    const c = codeText(f);
    return !(/['"`]spirit\/app\/['"`]?\s*\+/.test(c) || /path\.join\([^)]*['"]app['"]\s*,\s*(?!['"])[A-Za-z_$]/.test(c));
  }, test.limit.quick);
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['PAGE_FILES', 'pageFile'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
