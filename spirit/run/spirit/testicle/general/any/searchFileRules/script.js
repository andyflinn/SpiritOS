'use strict';
// spirit/run/spirit/testicle/general/any/searchFileRules/script.js
// A RULE MODULE OF THE GENERAL TEST: the search files' names (goal/G43.18, G47.4): one pattern under spirit/element/search/,
// a search's parts named by their word, the three old probability files named nowhere.
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
function every() {
  // the search elements' pattern (goal/G43.18; moved here from spirit/element/search/test/script.js, goal/G47.1). Andy: "all
  // "probabilitySearch" elements follow the EXACT SAME PATTERN.", and the box: "Every search element in spirit/element/
  // becomes spirit/element/search/<name>.js, with its companion folder spirit/element/search/<name>/ holding its list and row
  // elements, the same pattern for all".
  test.run('under spirit/element/search/ every name is a word, and every folder sits beside its <name>.js', 0.4, function () {
    const at = path.join(RUN, 'spirit', 'element', 'search');
    const top = fs.existsSync(at) ? fs.readdirSync(at, { withFileTypes: true }).filter(function (d) { return d.name !== 'test'; }) : [];
    // goal/G49.5: <name>.js became <name>/script.js, so the search element stands in its own folder, its script.js beside its parts.
    const odd = top.filter(function (d) { return d.isDirectory() ? !/^[a-z]+$/.test(d.name) || !(fs.existsSync(path.join(at, d.name + '.js')) || fs.readdirSync(path.join(at, d.name)).indexOf('script.js') !== -1) : !/^[a-z]+\.(js|md)$/.test(d.name); }).map(function (d) { return d.name; });
    return (top.length > 0 && !odd.length) || false;
  }, test.limit.quick);
}

function oneFile() {
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
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
