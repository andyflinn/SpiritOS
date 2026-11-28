'use strict';
// spirit/run/spirit/testicle/general/any/oldNameRules/script.js
// A RULE MODULE OF THE GENERAL TEST: what is gone is named nowhere: fieldRules, buildStamp, the old packet, faceable's and
// the verbs' old names, processJob as a member, a <verb>.warning.txt, a route under /api/, the deleted verifier.
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
  // Every path: given no file, the tree and the repository are judged from git; given a file, nothing.
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
  const rawText = function (f) { try { return shFs.readFileSync(shPath.join(SH.run, f), 'utf8'); } catch (e) { return ''; } };
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
  test.run('no product script requires spirit/client/packet.js; the spirit object requires spirit/peer/packet/script.js', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return (!files.some(function (f) { return unforbidden(f, codeText(f)).indexOf('spirit/client/packet.js') !== -1; }) && /require(Script|One)\(\s*['"]spirit\/peer\/packet\/script\.js['"]\s*\)/.test(codeText('spirit/script.js'))) || false;
  }, test.limit.quick);
  // faceable goes by its new name: none names the old contact.faceable any more (and since goal/G49.25 it is granted as any
  // verb, no owner-only check; Andy: "they go now").
  test.run('no product script names faceable by its old name, contact.faceable, only spirit.contact.faceable', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /['"]contact\.faceable['"]/.test(unforbidden(f, codeText(f))); }) || false;
  }, test.limit.quick);
  test.run('no product script names the relabel verb or the auth peer verb', 0.2, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { const c = unforbidden(f, codeText(f)); return /\brelabel\b/.test(c) || /['"]peer['"]\s*:\s*\{\s*request/.test(c); }) || false;
  }, test.limit.quick);
  // processJob "is required by its path, spirit/job/processJob/script.js, by every caller ... The spirit object keeps no copy
  // and no member of it" (goal/G49.19); its callers' requires are spirit/testicle/general/any/movedFileRules/script.js's.
  test.run('no product script reaches processJob as a member: none names .processJob', 0.4, function () {
    const files = productCode();
    if (files.length < 100) return false;
    return !files.some(function (f) { return /\.processJob\b/.test(unforbidden(f, codeText(f))); }) || false;
  }, test.limit.quick);
  const fs = require('fs');
  const path = require('path');
  const RUN = tools.run;
  const REPO = path.join(RUN, '..', '..');
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
  // no warning on a grant (goal/G43.27, requirement 7; moved here from spirit/element/search/grant/grantsPanel/test/script.js,
  // goal/G47.1). Andy: "compare that to giving a linux user root authority, he then can fuck up the whole system, not our
  // problem.": no <verb>.warning.txt is left in the repository.
  test.run('no <verb>.warning.txt is left', 0.4, function () {
    const warns = gitIn(REPO, ['ls-files']).filter(function (f) { return /\.warning\.txt$/.test(f); });
    return !warns.length || false;
  }, test.limit.quick);
  // NO TRACKED FILE NAMES THE DELETED VERIFIER (goal/G47.1, box v101, the cycle that deletes the desk's verifier: no tracked
  // file names it). Over the whole repository, the files outside spirit/run too, by path and by content, in any case. The name
  // is built here, so this file names it nowhere itself.
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
  }, test.limit.slow, { why: 'it greps every tracked file of the repository' });
  test.run('no tracked file names the deleted verifier, by path or by content', 0.4, function () {
    const word = ['desk', 'Verify'].join('');
    const top = require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8' }).trim();
    let hits = '';
    try { hits = require('child_process').execFileSync('git', ['grep', '-l', '-i', '-I', word], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { hits = String((e && e.stdout) || ''); }
    const named = require('child_process').execFileSync('git', ['ls-files'], { cwd: top, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return f.toLowerCase().indexOf(word.toLowerCase()) !== -1; });
    const all = hits.split('\n').filter(Boolean).concat(named).filter(function (f, i, a) { return a.indexOf(f) === i; });
    return all.length === 0 || false;
  }, test.limit.slow, { why: 'it greps every tracked file of the repository' });
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['buildStamp', 'fieldRules', 'spirit/client/packet.js', 'contact.faceable', '.processJob', 'relabel'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
