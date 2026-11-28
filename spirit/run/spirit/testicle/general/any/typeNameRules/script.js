'use strict';
// spirit/run/spirit/testicle/general/any/typeNameRules/script.js
// A RULE MODULE OF THE GENERAL TEST: a type is named by its file's full path, spirit/type/<...>/script.js, in code, in a
// verb's .json and in a branch's verbs.
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
  // Every path: given no file, the tree is judged from git; given a file, nothing.
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
// THE TREE'S OWN RULES, GIVEN NO FILE (goal/G49.27: they stood at the top level of the old -general runner of spirit/test/).
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
  // EACH A WHOLE-TREE CHECK OVER ITS FILES (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a
  // testicle row for the failing script and itself as the suite?"): a red row under each file that breaks the rule; too few
  // to judge is no list, a red under the runner, as the floor in each was.
  test.over('no product script or .json names a type by a dotted name, spirit.type.<...>', 0.6, function () {
    const files = productCode().concat(productJson());
    return files.length < 100 ? null : files;
  }, function (f) { return !/['"`]spirit\.type\.[A-Za-z]/.test(unforbidden(f, /\.json$/.test(f) ? rawText(f) : codeText(f))); }, test.limit.quick);
  // A verb's .json: its request an object of arguments; null for any other .json.
  const requestOf = function (f) {
    let j = null;
    try { j = JSON.parse(rawText(f)); } catch (e) { return null; }
    return !j || typeof j.request !== 'object' || Array.isArray(j.request) || j.request === null ? null : j.request;
  };
  test.over('every argument of a verb\'s .json names its type file by its full path, spirit/type/<...>/script.js, and that file is there', 0.6, function () {
    const verbs = productJson().filter(function (f) { return requestOf(f) !== null; });
    return verbs.length >= 20 ? verbs : null;
  }, function (f) {
    const request = requestOf(f);
    return Object.keys(request).every(function (a) {
      const rule = String(request[a]).replace(/\?$/, '');
      return /^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule) && shFs.existsSync(shPath.join(SH.run, rule));
    });
  }, test.limit.quick);
  // EVERY ARGUMENT OF A BRANCH IS A TYPE (goal/G49.21, box v25; Andy: "as always, and a permanent rule: a branche's script.js
  // file must use spirit.type.* for ALL argument validation"): each verb of every new-shape branch's script.js (a folder holding
  // script.js and client/script.js) names, for each argument, a type script by its path, spirit/type/... or an app's own
  // <app>/type/... (goal/G49.20), never a word of its own like 'text?'.
  test.over('every argument of every branch\'s verbs is a type script by its path', 0.4, function () {
    // goal/G49.23: the store is spirit/client/script.js, beside the spirit object, spirit/script.js, which is no branch and has no verbs.
    const files = productCode().filter(function (f) { return /\/script\.js$/.test(f) && f !== 'spirit/script.js' && shFs.existsSync(shPath.join(SH.run, f.replace(/script\.js$/, 'client/script.js'))); });
    return files.length < 3 ? null : files;
  }, function (f) {
    let m = null;
    try { m = require(shPath.join(SH.run, f)); } catch (e) { return false; }
    const verbs = m && m.verbs;
    if (!verbs || typeof verbs !== 'object') return false;
    return Object.keys(verbs).every(function (v) {
      return Object.keys(verbs[v] || {}).every(function (a) { return /^spirit\/(.+\/)?type\/.+\/script\.js\??$/.test(String(verbs[v][a])); });
    });
  }, test.limit.quick);
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
