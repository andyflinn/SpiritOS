'use strict';
// spirit/run/spirit/testicle/general/any/inputFieldRules/script.js
// A RULE MODULE OF THE GENERAL TEST: every input field validates by its type (goal/G48.4, G49.13): handed to
// fieldInput.attach with its type file's full path, which its script requires itself.
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
  // Every path: given a file, that file; given no file, nothing (each script is judged when it is handed).
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

function oneFile() {
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
}

if (arg && full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
