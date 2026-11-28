'use strict';
// spirit/run/spirit/testicle/general/any/vendoredRules/script.js
// A RULE MODULE OF THE GENERAL TEST: the vendored libraries have one place and one list (goal/G43.25): no
// spirit/run/node_modules named, no walker skipping node_modules by its own name.
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
  // Every path: given no file, the tree and the repository; given a file, that file.
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
// ONE LIST OF VENDORED FOLDERS (goal/G43.25; moved here from spirit/test/fileSystem.js, goal/G47.1, where it was a list of
// the walkers at one old commit). Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules
// container?": fileSystem.js keeps the one list every walker reads, so no code skips node_modules by its own name.
const OWN_NODE_MODULES_SKIP = /['"]node_modules['"]/;
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
function every() {
  // The files the element rules read (goal/G49.27: their reading, and its check, are spirit/testicle/general/any/elementHomeRules/script.js's),
  // read here once, when a check first asks for them.
  const E = {};
  let ELEMENT_FILES = null;
  Object.defineProperty(E, 'elementFiles', { get: function () { if (ELEMENT_FILES === null) { try { ELEMENT_FILES = elementRuleFiles(); } catch (e) { ELEMENT_FILES = undefined; } } return ELEMENT_FILES; } });
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
  test.run('no code skips node_modules by its own name: every walker reads fileSystem.js\'s VENDORED_FOLDERS', 0.4, function () {
    const all = E.elementFiles || [];
    const hits = [].concat.apply([], all.map(function (f) { return codeLinesMatching(f, OWN_NODE_MODULES_SKIP); }));
    return (all.length > 100 && !hits.length) || false;
  }, test.limit.quick);
}

function oneFile() {
    if (!NODE_MODULES_ON_PURPOSE.test('spirit/run/' + rel)) test.run('it names no spirit/run/node_modules', 0.4, function () {
      const hits = linesMatching(rel, OLD_NODE_MODULES);
      return !hits.length || false;
    }, test.limit.quick);
  if (/\.(js|html)$/.test(rel)) {
      test.run('its code skips no node_modules by its own name', 0.4, function () {
        const hits = codeLinesMatching(rel, OWN_NODE_MODULES_SKIP);
        return !hits.length || false;
      }, test.limit.quick);
  }
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit/run/node_modules'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
