'use strict';
// spirit/run/spirit/testicle/general/app/any/singularRules/script.js
// A RULE MODULE OF THE APP GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part "0. job AND event, SINGULAR" (rule0) of the old app -general runner of spirit/test/,
// moved here unchanged in what they check and in their titles; its runner now, which loads this module and calls it, is spirit/testicle/run/none/script.js.
// Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }
// (spirit/testicle/general/any/typeRules/script.js says each). Its rule: Andy, the box: "\"jobs\" ... renamed, \"job\" (singular) and the same will happen for \"events\"".
// Judged on disc, from the files and the code (comments left out): no node is started (goal/G43.32, the box: "rules for
// sub-folders of run://spirit/app/"; spec: ./test/script.md).
const SPIRIT = require('../../../../../script.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Every path handed: a file of an app judges its app, any other path every app, as the file it came from did.
function appliesTo(scriptPath) {
  // Its reach (goal/G49.27, step 3): spirit/app/script.js and everything under spirit/app/, as the reach of the runner it
  // stood in (spirit/app/'s -child- general test, testModule's rule); given nothing, every app.
  const p = String(scriptPath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '');
  return !p || p.indexOf('spirit/app/') === 0;
}

// checks(scriptPath, tools): tools { test, run, spirit }; scriptPath '' judges every sub-folder of spirit/app/.
function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
const RUN = tools.run;
// A MODULE'S OWN FORBIDDEN NAMES ARE NOT ITS FAULT (goal/G49.27; Andy: "All, cw's way"; the same as
// spirit/testicle/general/any/typeRules/script.js): a name rule skips exactly the names a module hands out as forbids, and only
// in that module's own files (its script.js and its test/), each blanked, its length kept, before the file is read. tools.forbids
// maps each module's folder to its forbids; the runner hands it.
const FORBIDS = tools.forbids || {};
function unforbidden(rel, text) {
  const r = String(rel || '').replace(/^spirit\/run\//, '');
  const own = Object.keys(FORBIDS).filter(function (dir) { return r === dir + '/script.js' || r.indexOf(dir + '/test/') === 0; })[0];
  if (!own) return text;
  let t = String(text);
  FORBIDS[own].forEach(function (n) { t = t.split(n).join(String(n).replace(/[^\n]/g, ' ')); });
  return t;
}
function code(rel) { let t = ''; try { t = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function isFile(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }

// The tree: every file git keeps and every file not yet added that git does not ignore, so a new app is judged before it
// is committed. A file tracked but deleted on disc is not there.
const TREE = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(isFile);

// ── 0. job AND event, SINGULAR ──────────────────────────────────────────────────────────────────────────────────────
// Andy, the box: "\"jobs\" and it's face spirit/app/jobs/ will be renamed, \"job\" (singular) and the same will happen for
// \"events\", which will be renamed \"event\"". The decided: the seven verbs renamed, and every file and folder named so.
function verbsOf(file, want) {
  let verbs = null;
  try { verbs = Object.keys(require(path.join(RUN, file)).verbs || {}); } catch (e) { verbs = null; }
  const same = !!verbs && want.every(function (v) { return verbs.indexOf(v) !== -1; }) && verbs.length === want.length;
  return same ? true : false;
}
const OLD_NAME_CALL = /['"`](jobs|events)\.(search|get|create|cancel|delete|subscribe|publish|list|update)\b|\bspirit\.(jobs|events)\b|\bS\.(jobs|events)\b|\bs\.(jobs|events)\b/;
function rule0() {
  // Rule 0: job and event, singular.
  test.run('no file or folder is named jobs or events', 0.4, function () {
    const plural = TREE.filter(function (f) { return /(^|\/)(jobs|events)(\/|[-.])/.test(f); });
    return !plural.length ? true : false;
  }, test.limit.quick);
  test.run('the job branch, spirit/job/, holds api.js and data.js', 0.4, function () {
    return (isFile('spirit/job/script.js') && isFile('spirit/job/client/script.js')) ? true : false;
  }, test.limit.quick);
  // The event branch's verbs are the spirit branch's since goal/G49.23 (box v22 Part 2), spirit/event/ gone: they stand in
  // spirit/script.js (spirit.verbs), each verb's file spirit/<verb>.json.
  test.run('the event branch\'s verbs stand in the spirit branch: spirit/script.js, spirit/subscribe.json and spirit/publish.json', 0.4, function () {
    return (isFile('spirit/script.js') && isFile('spirit/subscribe.json') && isFile('spirit/publish.json')) ? true : false;
  }, test.limit.quick);
  test.run('the job branch\'s face is spirit/app/job/', 0.4, function () { return isFile('spirit/app/job/job.json') ? true : false; }, test.limit.quick);
  test.run('spirit/job/script.js holds the verbs search, get, create, cancel and delete, their words unchanged', 0.4, function () {
    return verbsOf('spirit/job/script.js', ['search', 'get', 'create', 'cancel', 'delete']);
  }, test.limit.quick);
  test.run('spirit/script.js holds the verbs subscribe and publish, their words unchanged, beside the node branch\'s card, debug, setName, setDescription and rotateCipher', 0.4, function () {
    return verbsOf('spirit/script.js', ['card', 'debug', 'setName', 'setDescription', 'rotateCipher', 'publish', 'subscribe']);
  }, test.limit.quick);
  // A call by its old name: 'jobs.<verb>' or 'events.<verb>' in a string, or spirit.jobs / spirit.events, in any product file.
  // (A constant: its quote characters inside a test's body would be read as strings by the title rule's parser.)
  test.run('no product file calls a verb by its old name, jobs.* or events.*, nor spirit.jobs or spirit.events', 0.4, function () {
    const calls = TREE.filter(function (f) { return /\.(js|html)$/.test(f) && !/\/test\//.test(f) && !/\/(chokidar|readdirp)\//.test(f); }).filter(function (f) {
      return OLD_NAME_CALL.test(unforbidden(f, code(f)));
    });
    return !calls.length ? true : false;
  }, test.limit.quick);
}
rule0();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit.jobs', 'spirit.events'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
