'use strict';
// spirit/run/spirit/testicle/general/any/movedFileRules/script.js
// A RULE MODULE OF THE GENERAL TEST: the moved scripts are at their new paths and gone from their old ones: the job, app,
// trunk, auth and contact branches, each interface holding its verbs, each engine its code.
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
  // Every path: given no file, the tree is judged; given a file, nothing (each check names the script it is reported for).
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
// THE TREE'S OWN RULES, GIVEN NO FILE (goal/G49.27: they stood at the top level of the old -general runner of spirit/test/).
if (!String(ARGS[0] || '')) {
  const SH = { run: tools.run };
  const shFs = require('fs');
  const shPath = require('path');
  const codeText = function (f) {
    let t = '';
    try { t = shFs.readFileSync(shPath.join(SH.run, f), 'utf8'); } catch (e) { return ''; }
    return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  };
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
    // Its verbs are its <verb>.json files, read, never by loading its code (goal/G49.27, Q4).
    let verbs = null;
    try { verbs = shFs.readdirSync(shPath.join(SH.run, 'spirit', 'contact')).filter(function (n) { if (!/\.json$/.test(n) || n === 'contact.json') return false; try { const j = JSON.parse(shFs.readFileSync(shPath.join(SH.run, 'spirit', 'contact', n), 'utf8')); return !!j && typeof j.description === 'string'; } catch (e) { return false; } }).map(function (n) { return n.slice(0, -5); }).sort(); } catch (e) { verbs = null; }
    const want = ['accept', 'add', 'block', 'claim', 'face', 'faceable', 'forget', 'get', 'join', 'label', 'leave', 'search', 'unblock'];
    return (!!verbs && verbs.join() === want.join()) || false;
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
  ['spirit/app/testicle/server/server.js', 'spirit/app/icons/server/server.js', 'spirit/app/publishData/publishData.js', 'spirit/server/app/script.js', 'spirit/script.js'].forEach(function (rel) {
    test.run('it requires spirit/job/processJob/script.js by its path', 0.2, function () {
      // The spirit object loads its own parts by requireOne, the function its requireScript is (spirit/script.js).
      return /require(Script|One)\(\s*['"]spirit\/job\/processJob\/script\.js['"]\s*\)/.test(codeText(rel)) || false;
    }, test.limit.quick, { script: rel });
  });
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit/client/packet.js'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
