'use strict';
// spirit/run/spirit/testicle/general/any/labRules/script.js
// A RULE MODULE OF THE GENERAL TEST: the lab redrawn (goal/G47.3): labMaster and its tools in repo://lab/, repo://lab/node/
// ignored, no test starting the node itself.
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
  // Every path: given no file, the repository is judged from git; given a file, nothing.
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
const RUN = tools.run;
if (!String(ARGS[0] || '')) {
  // THE LAB REDRAWN (goal/G47.3, the box: "labMaster lives in repo://lab/ (today repo://spirit/test/labMaster/)",
  // "repo://lab/node/ is .gitignored", "its tools (box.js, inspect.js, runsHome.js, wirePaths.js) move with labMaster to
  // repo://lab/", "fixtures/jobCallbackFixture.js is used by nobody and goes", "visual/*.json have no reader left ... so they
  // go, with the stale lines naming them in README/HARNESS/HUMAN_TOOLS.md", "not every node-starting test goes through
  // scratchNode ... those move onto scratchNode as part of this"). Judged over the whole repository, from git.
  const fs = require('fs');
  const path = require('path');
  const top = function () { return require('child_process').execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RUN, encoding: 'utf8' }).trim(); };
  const trackedAll = function () { return require('child_process').execFileSync('git', ['ls-files'], { cwd: top(), encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean); };
  test.run('labMaster lives in repo://lab/, its parts with it, and nothing is left of spirit/test/labMaster/', 0.4, function () {
    const all = trackedAll();
    const want = ['labMaster.js', 'ensureMaster.js', 'labPaths.js', 'labMastPanel.html', 'BONES.md', 'STATE.md'];
    const inLab = all.filter(function (f) { return /^lab\//.test(f); }).map(function (f) { return f.split('/').pop(); });
    const missing = want.filter(function (n) { return inLab.indexOf(n) === -1; });
    const left = all.filter(function (f) { return /^spirit\/test\/labMaster\//.test(f); });
    return (!missing.length && !left.length) || false;
  }, test.limit.quick);
  test.run('the old test folder\'s tools are in repo://lab/, its unused fixture and its visual json are gone', 0.4, function () {
    const all = trackedAll();
    const tools = ['box.js', 'inspect.js', 'runsHome.js', 'wirePaths.js'];
    const inLab = all.filter(function (f) { return /^lab\//.test(f); }).map(function (f) { return f.split('/').pop(); });
    const bad = tools.filter(function (n) { return inLab.indexOf(n) === -1; })
      .concat(all.filter(function (f) { return /^spirit\/test\/(tools|fixtures|visual)\//.test(f); }));
    return !bad.length;
  }, test.limit.quick);
  test.run('.gitignore keeps repo://lab/node/ out of git, and git holds nothing under it', 0.4, function () {
    let ignored = false;
    try { require('child_process').execFileSync('git', ['check-ignore', '-q', 'lab/node/zzProbe/x.js'], { cwd: top() }); ignored = true; } catch (e) { ignored = false; }
    const held = trackedAll().filter(function (f) { return /^lab\/node\//.test(f); });
    return (ignored && !held.length) || false;
  }, test.limit.quick);
  test.run('README/HARNESS/HUMAN_TOOLS.md names neither visualScenarios.js nor presenceShow.js', 0.4, function () {
    let t = ''; try { t = fs.readFileSync(path.join(top(), 'README', 'HARNESS', 'HUMAN_TOOLS.md'), 'utf8'); } catch (e) { return false; }
    const named = ['visualScenarios.js', 'presenceShow.js'].filter(function (n) { return t.indexOf(n) !== -1; });
    return !named.length || false;
  }, test.limit.quick);
  // Every node a test uses is handed out by scratchNode (headLessChrome.js, the one helper that starts spirit/server/script.js).
  test.run('no test starts spirit/server/script.js itself: every node a test uses comes from scratchNode', 0.4, function () {
    const own = trackedAll().filter(function (f) { return /^spirit\/run\/.*\/test\/[^/]+\.js$/.test(f) && !/\/test\/headLessChrome\.js$/.test(f) && !/\/test\/test\/headLessChrome\.js$/.test(f); });
    const starting = own.filter(function (f) {
      let c = ''; try { c = fs.readFileSync(path.join(top(), f), 'utf8'); } catch (e) { return false; }
      c = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
      return /spawn\s*\([^;]*['"]spirit\/server\/script\.js['"]/.test(c) || /spawn\s*\([^;]*path\.join\([^;]*['"]server\.js['"]/.test(c);
    });
    return !starting.length || false;
  }, test.limit.slow, { why: 'it reads every tracked test file' });
}
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
