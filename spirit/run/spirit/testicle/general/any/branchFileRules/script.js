'use strict';
// spirit/run/spirit/testicle/general/any/branchFileRules/script.js
// A RULE MODULE OF THE GENERAL TEST: a branch file is loaded by its full path (goal/G47.1): never by the branch's name, an
// api.js loading its own data.js and nothing else loading it.
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
  // Every path: given no file, the tree; given a file, that file.
  return true;
}

// The code reader, as the module rules read code (goal/G49.27: one codeOf, handed out by spirit/testicle/general/any/moduleRules/script.js).
const codeOf = SPIRIT.requireScript('spirit/testicle/general/any/moduleRules/script.js').codeOf;

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
const fs = require('fs');
const path = require('path');
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
function every() {
  // The files the element rules read (goal/G49.27: their reading, and its check, are spirit/testicle/general/any/elementHomeRules/script.js's),
  // read here once, when a check first asks for them.
  const E = {};
  let ELEMENT_FILES = null;
  Object.defineProperty(E, 'elementFiles', { get: function () { if (ELEMENT_FILES === null) { try { ELEMENT_FILES = elementRuleFiles(); } catch (e) { ELEMENT_FILES = undefined; } } return ELEMENT_FILES; } });
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
}

function oneFile() {
  if (/\.(js|html)$/.test(rel)) {
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
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
