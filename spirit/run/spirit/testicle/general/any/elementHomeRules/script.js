'use strict';
// spirit/run/spirit/testicle/general/any/elementHomeRules/script.js
// A RULE MODULE OF THE GENERAL TEST: an element stands at its path: placed by the loader alone, no old home named
// (goal/G43.5), spirit.element reached only for what the tree holds.
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
// THE LOADER PLACES ELEMENTS (goal/G43.32; goal/G49.9: a script sets module.exports and the loader places it): no element
// script puts itself on spirit.element or spirit.elements by hand (goal/G49.23: no spirit.required).
function placedByHand() {
  return productScripts().filter(function (f) {
    if (f === 'spirit/script.js') return false;
    const code = codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true);
    return /\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*=(?!=)|\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*\[[^\]]*\]\s*=(?!=)|Object\.assign\s*\([^)]*\bspirit\.elements?\b/.test(code);
  });
}
function every() {
  const E = {};
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
  }, test.limit.slow, { why: 'it reads every tracked file of the tree' });
  test.run('no code reaches an element through spirit.elements', 0.4, function () {
    const all = E.elementFiles || [];
    const hits = [].concat.apply([], all.map(function (f) { return codeLinesMatching(f, OLD_ELEMENT_HOME, true); }));
    return (all.length > 100 && !hits.length) || false;
  }, test.limit.slow, { why: 'it reads every tracked file of the tree' });
  test.run('no code reaches through spirit.element for an element the tree does not hold', 0.4, function () {
    const all = E.elementFiles || [];
    const stray = [].concat.apply([], all.map(strayElementReaches));
    return (all.length > 100 && !stray.length) || false;
  }, test.limit.slow, { why: 'it reads every tracked file of the tree' });
}

function oneFile() {
  // the element move (elementRuleFiles above): its old homes, and spirit.element only for what the tree holds
    test.run('it names no shell/js', 0.4, function () {
      const hits = linesMatching(rel, OLD_ELEMENT_PATH);
      return !hits.length || false;
    }, test.limit.quick);
    test.run('its code reaches no element through spirit.elements', 0.4, function () {
      const hits = codeLinesMatching(rel, OLD_ELEMENT_HOME, true);
      return !hits.length || false;
    }, test.limit.quick);
    if (/\.(js|html)$/.test(rel)) test.run('it reaches through spirit.element only for elements the tree holds', 0.4, function () {
      const stray = strayElementReaches(rel);
      return !stray.length || false;
    }, test.limit.quick);
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['shell/js', 'shell/node_modules', 'spirit.elements', 'ui.elements', 'spirit\\.elements'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
