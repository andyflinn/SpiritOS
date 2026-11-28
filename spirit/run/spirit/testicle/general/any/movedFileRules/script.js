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
  // Every path: given no file, the tree is judged; given a file, nothing (each check names its path in its title).
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
  // EVERY CHECK WRITTEN OUT, ONE PLAIN TITLE EACH, ALL UNDER THIS MODULE'S ONE SCRIPT (goal/G49.27, cw's review in Desk, agreed:
  // "each module reports under its own one script"; "written out, one plain title each: Andy wants a red pinned to its check,
  // and one check over all paths throws exactly that away. A title written out whole with its path in it is one plain string,
  // which the title rule allows; only building it from a path is refused"). Each path was once a script of its own, and the
  // reporter waited out a round trip at every change of script: minutes for this module alone.
  test.run('spirit/job/engine/script.js is there', 0.2, function () { return inTree('spirit/job/engine/script.js') || false; }, test.limit.quick);
  test.run('spirit/job/joinStepsJob/script.js is there', 0.2, function () { return inTree('spirit/job/joinStepsJob/script.js') || false; }, test.limit.quick);
  test.run('spirit/job/client/script.js is there', 0.2, function () { return inTree('spirit/job/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/job/processJob/script.js is there', 0.2, function () { return inTree('spirit/job/processJob/script.js') || false; }, test.limit.quick);
  test.run('spirit/job/api.js is gone', 0.2, function () { return !inTree('spirit/job/api.js') || false; }, test.limit.quick);
  test.run('spirit/job/data.js is gone', 0.2, function () { return !inTree('spirit/job/data.js') || false; }, test.limit.quick);
  test.run('spirit/joinStepsJob is gone', 0.2, function () { return !inTree('spirit/joinStepsJob') || false; }, test.limit.quick);
  // THE APP BRANCH IN THE NEW SHAPE (goal/G49.20, box v31): "spirit/app/script.js --> spirit/app/manager/script.js",
  // "spirit/app/api.js --> spirit/app/script.js", "spirit/app/data.js --> spirit/app/client/script.js".
  test.run('spirit/app/manager/script.js is there', 0.2, function () { return inTree('spirit/app/manager/script.js') || false; }, test.limit.quick);
  test.run('spirit/app/client/script.js is there', 0.2, function () { return inTree('spirit/app/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/app/api.js is gone', 0.2, function () { return !inTree('spirit/app/api.js') || false; }, test.limit.quick);
  test.run('spirit/app/data.js is gone', 0.2, function () { return !inTree('spirit/app/data.js') || false; }, test.limit.quick);
  // SOME TRUNK MOVES, AND THE AUTH TABLES AS BRANCHES (goal/G49.21, box v24): "spirit/client/packet.js -->
  // spirit/peer/packet/script.js", apiTreeIndex and boxes into spirit/fuckingGarbage/, "delete the directory spirit/client/";
  // "spirit/apiAuth/ --> spirit/grant/auth/"; the grant, bundle and branch tables each a branch, spirit/<table>/script.js and
  // spirit/<table>/client/script.js; "spirit/authTableInterface/ --> spirit/grant/tables/ (only used to pillage for parts, then
  // deleted)"; "the spirit/auth/ is finally deleted"; "the peer and relabel verbs go. die. perish."
  test.run('spirit/peer/packet/script.js is there', 0.2, function () { return inTree('spirit/peer/packet/script.js') || false; }, test.limit.quick);
  test.run('spirit/fuckingGarbage/apiTreeIndex.js is there', 0.2, function () { return inTree('spirit/fuckingGarbage/apiTreeIndex.js') || false; }, test.limit.quick);
  // boxes.js went with the owner branch (goal/G49.24, box v18)
  test.run('spirit/grant/auth/script.js is there', 0.2, function () { return inTree('spirit/grant/auth/script.js') || false; }, test.limit.quick);
  test.run('spirit/grant/script.js is there', 0.2, function () { return inTree('spirit/grant/script.js') || false; }, test.limit.quick);
  test.run('spirit/grant/client/script.js is there', 0.2, function () { return inTree('spirit/grant/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/bundle/script.js is there', 0.2, function () { return inTree('spirit/bundle/script.js') || false; }, test.limit.quick);
  test.run('spirit/bundle/client/script.js is there', 0.2, function () { return inTree('spirit/bundle/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/branch/script.js is there', 0.2, function () { return inTree('spirit/branch/script.js') || false; }, test.limit.quick);
  test.run('spirit/branch/client/script.js is there', 0.2, function () { return inTree('spirit/branch/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/boxes is gone', 0.2, function () { return !inTree('spirit/boxes') || false; }, test.limit.quick);
  test.run('spirit/apiAuth is gone', 0.2, function () { return !inTree('spirit/apiAuth') || false; }, test.limit.quick);
  test.run('spirit/authTableInterface is gone', 0.2, function () { return !inTree('spirit/authTableInterface') || false; }, test.limit.quick);
  test.run('spirit/grant/tables is gone', 0.2, function () { return !inTree('spirit/grant/tables') || false; }, test.limit.quick);
  test.run('spirit/auth is gone', 0.2, function () { return !inTree('spirit/auth') || false; }, test.limit.quick);
  // spirit/client CAME BACK AS THE STORE (goal/G49.23; Andy: "do move spirit/data/ to spirit/client/ first"): what G49.21 took
  // out of it stays out; it holds the store, spirit/client/script.js.
  test.run('spirit/client/packet.js is gone', 0.2, function () { return !inTree('spirit/client/packet.js') || false; }, test.limit.quick);
  test.run('spirit/client/apiTreeIndex.js is gone', 0.2, function () { return !inTree('spirit/client/apiTreeIndex.js') || false; }, test.limit.quick);
  test.run('spirit/client/script.js is there', 0.2, function () { return inTree('spirit/client/script.js') || false; }, test.limit.quick);
  // CLEANUP A - C, AND THE CONTACT BRANCH IN THE NEW SHAPE (goal/G49.22, box v16): answerRelay to spirit/peer/relay/key/seal/,
  // apiDoor to spirit/peer/door/, relayKeys to spirit/peer/relay/key/, appClient to spirit/app/adapter/, arrivals to
  // spirit/peer/arrivals/, coreFiles to spirit/fs/coreFiles/, the console's loop.js and command.js each to a folder of its own;
  // "spirit/contact/script.js --> spirit/contact/engine/script.js", "spirit/contact/data.js --> spirit/contact/client/script.js",
  // "spirit/contact/api.js --> spirit/contact/script.js"; "all verbs do the fucking same shit they did before".
  test.run('spirit/peer/relay/key/seal/script.js is there', 0.2, function () { return inTree('spirit/peer/relay/key/seal/script.js') || false; }, test.limit.quick);
  test.run('spirit/peer/door/script.js is there', 0.2, function () { return inTree('spirit/peer/door/script.js') || false; }, test.limit.quick);
  test.run('spirit/peer/relay/key/script.js is there', 0.2, function () { return inTree('spirit/peer/relay/key/script.js') || false; }, test.limit.quick);
  test.run('spirit/app/adapter/script.js is there', 0.2, function () { return inTree('spirit/app/adapter/script.js') || false; }, test.limit.quick);
  test.run('spirit/peer/arrivals/script.js is there', 0.2, function () { return inTree('spirit/peer/arrivals/script.js') || false; }, test.limit.quick);
  test.run('spirit/fs/coreFiles/script.js is there', 0.2, function () { return inTree('spirit/fs/coreFiles/script.js') || false; }, test.limit.quick);
  test.run('spirit/console/loop/script.js is there', 0.2, function () { return inTree('spirit/console/loop/script.js') || false; }, test.limit.quick);
  test.run('spirit/console/command/script.js is there', 0.2, function () { return inTree('spirit/console/command/script.js') || false; }, test.limit.quick);
  test.run('spirit/contact/engine/script.js is there', 0.2, function () { return inTree('spirit/contact/engine/script.js') || false; }, test.limit.quick);
  test.run('spirit/contact/client/script.js is there', 0.2, function () { return inTree('spirit/contact/client/script.js') || false; }, test.limit.quick);
  test.run('spirit/answerRelay is gone', 0.2, function () { return !inTree('spirit/answerRelay') || false; }, test.limit.quick);
  test.run('spirit/apiDoor is gone', 0.2, function () { return !inTree('spirit/apiDoor') || false; }, test.limit.quick);
  test.run('spirit/relayKeys is gone', 0.2, function () { return !inTree('spirit/relayKeys') || false; }, test.limit.quick);
  test.run('spirit/appClient is gone', 0.2, function () { return !inTree('spirit/appClient') || false; }, test.limit.quick);
  test.run('spirit/arrivals is gone', 0.2, function () { return !inTree('spirit/arrivals') || false; }, test.limit.quick);
  test.run('spirit/coreFiles is gone', 0.2, function () { return !inTree('spirit/coreFiles') || false; }, test.limit.quick);
  test.run('spirit/console/loop.js is gone', 0.2, function () { return !inTree('spirit/console/loop.js') || false; }, test.limit.quick);
  test.run('spirit/console/command.js is gone', 0.2, function () { return !inTree('spirit/console/command.js') || false; }, test.limit.quick);
  test.run('spirit/contact/api.js is gone', 0.2, function () { return !inTree('spirit/contact/api.js') || false; }, test.limit.quick);
  test.run('spirit/contact/data.js is gone', 0.2, function () { return !inTree('spirit/contact/data.js') || false; }, test.limit.quick);
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
  // The spirit object loads its own parts by requireOne, the function its requireScript is (spirit/script.js).
  const requiresProcessJob = function (rel) { return /(?:requireScript|requireOne)\(\s*['"]spirit\/job\/processJob\/script\.js['"]\s*\)/.test(codeText(rel)) || false; };
  test.run('spirit/app/testicle/server/server.js requires spirit/job/processJob/script.js by its path', 0.2, function () { return requiresProcessJob('spirit/app/testicle/server/server.js'); }, test.limit.quick);
  test.run('spirit/app/icons/server/server.js requires spirit/job/processJob/script.js by its path', 0.2, function () { return requiresProcessJob('spirit/app/icons/server/server.js'); }, test.limit.quick);
  test.run('spirit/app/publishData/publishData.js requires spirit/job/processJob/script.js by its path', 0.2, function () { return requiresProcessJob('spirit/app/publishData/publishData.js'); }, test.limit.quick);
  test.run('spirit/server/app/script.js requires spirit/job/processJob/script.js by its path', 0.2, function () { return requiresProcessJob('spirit/server/app/script.js'); }, test.limit.quick);
  test.run('spirit/script.js requires spirit/job/processJob/script.js by its path', 0.2, function () { return requiresProcessJob('spirit/script.js'); }, test.limit.quick);
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit/client/packet.js'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
