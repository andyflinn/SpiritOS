'use strict';
// spirit/run/spirit/testicle/general/any/moduleRules/script.js
// A RULE MODULE OF THE GENERAL TEST: the shape of a module (goal/G40.6, G43.32): use strict, spirit.js first, the tree only
// through spirit.requireScript, every require path a child, a sibling or an ancestor's file, every written requireScript
// path a file that exists.
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
  // Every path: a file is judged by oneFile, a path that is no file is red ('the file handed is there').
  return true;
}

const fs = require('fs');
const path = require('path');
// EVERY PRODUCT SCRIPT LOADS THE TREE THROUGH spirit.requireScript (goal/G43.32, the box, testing point 2). Andy: "every script
// (other than spirit/script.js) must start with ... 'use strict'; 'let spirit = require(spirit) or the html pages <script
// href=spirit/script.js> kind of thing; all other scripts should be loaded using spirit.requireScript()", "node modules
// designated to provide node.js functionality: require('http' | 'fs' etc.) are exempt", "i see no reason codemirrors
// vendored scripts cannot be spirit.required....", and "just rename the bloody script" for a name with a dot of its own.
// Judged by reading each product file (the box: "this item deals with PRODUCT files, NOT tests"); vendored code is
// spirit.required by others and not judged as ours.
const BUILTIN = require('module').builtinModules;
// Whether a / at the end of what is read so far opens a regex literal, not a division.
// LOOKING BACK ONLY AS FAR AS IT NEEDS (goal/G49.27, the file runner's 4 minutes: trimming all that was read so far at every /
// made reading a file cost the square of its length): back over the white space, then the one character or word before it.
function regexStarts(before) {
  let i = before.length - 1;
  while (i >= 0 && /\s/.test(before[i])) i--;
  if (i < 0) return true;
  if ('(,=:[!&|?{};+-*%<>~^'.indexOf(before[i]) !== -1) return true;
  // A keyword ends here, and no letter, digit, $ or . stands right before it (so "rerun" or "x.do" is none).
  const m = /(return|typeof|case|in|of|delete|void|throw|new|else|do)$/.exec(before.slice(Math.max(0, i - 9), i + 1));
  if (!m) return false;
  const at = i - m[0].length + 1;
  return at === 0 || !/[\w$.]/.test(before[at - 1]);
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
// moduleRulesAt(RUN, full): moduleRules(full) of the run RUN; the rule modules that ask it (spirit/testicle/general/any/pollutionRules/script.js) hand their run.
function moduleRulesAt(RUN, full) {
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

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
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
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
// moduleRules(full) -> { early, page, spirit, bad } of the run judged.
function moduleRules(full) { return moduleRulesAt(RUN, full); }
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
function productScripts() {
  return require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
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
// The files these rules read: what git tracks under spirit/, code, tests and documents, vendored code and this test's own
// files left out (they name the old homes to find them).
function elementRuleFiles() {
  return gitIn(RUN, ['ls-files']).filter(function (f) {
    return /^spirit\//.test(f) && /\.(js|html|md|css|txt|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f));
  });
}
function every() {
  // The files the element rules read (goal/G49.27: their reading, and its check, are spirit/testicle/general/any/elementHomeRules/script.js's),
  // read here once, when a check first asks for them.
  const E = {};
  let ELEMENT_FILES = null;
  Object.defineProperty(E, 'elementFiles', { get: function () { if (ELEMENT_FILES === null) { try { ELEMENT_FILES = elementRuleFiles(); } catch (e) { ELEMENT_FILES = undefined; } } return ELEMENT_FILES; } });
  // EACH A WHOLE-TREE CHECK OVER ITS FILES (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a
  // testicle row for the failing script and itself as the suite?"): a red row under each file that breaks the rule. A list
  // of 100 files or fewer is no list, a red under the runner, as the floor in each was.
  const floor = function (list) { return list && list.length > 100 ? list : null; };
  test.over('every spirit.requireScript of a written path names a file that exists', 0.4, function () { return floor(E.elementFiles); }, function (f) {
    return !missingRequires(f).length;
  }, test.limit.quick);

  // every product script: use strict, spirit first, the tree only through spirit.requireScript
  test.run('the product scripts are read, tests and vendored code left out', 0.2, function () {
    E.scripts = productScripts();
    return E.scripts.length > 100 || false;
  }, test.limit.quick);
  test.over('all of them hold the shape', 0.4, function () { return floor(E.scripts); }, function (f) {
    return !shapeBreaks(f);
  }, test.limit.quick);

  // every product script: spirit.js required first, every require path a child, a sibling or an ancestor's file
  const ruleOf = {};
  test.run('the product scripts are read for the module rules', 0.2, function () {
    const all = productScripts();
    E.ruled = all.map(function (f) { return { f: f, r: moduleRules(path.join(RUN, f)) }; });
    E.ruled.forEach(function (x) { ruleOf[x.f] = x.r; });
    return all.length > 100 || false;
  }, test.limit.quick);
  const ruledFiles = function () { return floor((E.ruled || []).map(function (x) { return x.f; })); };
  test.over('every one takes spirit.js first, or is page code', 0.4, ruledFiles, function (f) {
    return !ruleOf[f].early;
  }, test.limit.quick);
  test.over('none of their require paths breaks the require rule', 0.4, ruledFiles, function (f) {
    return !ruleOf[f].bad.length;
  }, test.limit.quick);
}

function oneFile() {
  if (/\.(js|html)$/.test(rel)) {
      test.run('every spirit.requireScript of a written path in it names a file that exists', 0.4, function () {
        const missing = missingRequires(rel);
        return !missing.length || false;
      }, test.limit.quick);
  }
  // goal/G43.32: a product script holds the shape (everyScriptShaped).
  if (/^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    // <address>: use strict, spirit first, the tree only through spirit.requireScript
    test.run('it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.requireScript', 0.4, function () {
      return !shapeBreaks(rel);
    }, test.limit.quick);
  }
  // The general rules of a module (moduleRules above), on any file handed, a product script or not.
  // <address>: the spirit object is a global before anything else is loaded
  const mr = moduleRules(full);
  if (mr.page) test.run('it is page code: node never loads it', 0.4, function () { return moduleRules(full).page || false; }, test.limit.quick);
  else if (mr.spirit) test.run('it sets the global spirit before its first require', 0.4, function () { return !moduleRules(full).early; }, test.limit.quick);
  else test.run('it requires spirit.js first', 0.4, function () { return !moduleRules(full).early; }, test.limit.quick);
  // <address>: every require path is a child, a sibling or an ancestor's file
  test.run('none of its require paths breaks the rule', 0.4, function () {
    return !moduleRules(full).bad.length;
  }, test.limit.quick);
}

if (!arg) every();
else if (!full) test.run('the file handed is there', 0.2, function () { return false; }, test.limit.quick);
else oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
// codeOf and moduleRulesAt are handed out too: the other rule modules read code as these rules read it (goal/G49.27).
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks, codeOf: codeOf, moduleRulesAt: moduleRulesAt };
