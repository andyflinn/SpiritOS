'use strict';

// spirit/run/spirit/test/script-sibling-browser.js [<script> ...]
// THE -browser GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests", "existing general tests fold into the appropriate of the 3 new general test name-formats"; its contract:
// ./script-sibling-browser.md): generalRules' page checks, every title kept; its file-reading checks are
// script-sibling-general.js's, its node checks script-sibling-node.js's. "browser only scripts are tested by -general and
// -browser general tests": testicle hands it no node-only script.
//
// THE RUNNER OF ITS RULE MODULES (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system", the
// general rules become modules, one rule set one module): its two parts are each a module now, every title kept:
// spirit/testicle/general/browser/placeRules/script.js, given no file the tree's rules and every page module, each page module
// run again through this file, a run of its own; and spirit/testicle/general/browser/pageRules/script.js, given a file its page.
// This file loads each by its full path, asks appliesTo and runs checks; handed several scripts, it boots the one node and the
// one Chrome the whole run draws on (below).
require('../script.js');
const fs = require('fs');
const path = require('path');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, '..', 'testicle', 'testReport', 'script.js'));

const RUN = path.join(__dirname, '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
// Its arguments: the file it judges, if any.
const ARGS = process.argv.slice(2);
const arg = String(ARGS[0] || '');
// SEVERAL SCRIPTS (box v94, 2: "else it will process all scripts listed in the arguments that fit"): each drawn and judged in
// turn on the run's one node and Chrome, each reporting for itself.
const GIVEN = ARGS.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGS[i - 1] !== '--test'; });
// What every module is handed: the reporter, the run root, its spirit object, and this file, which runs a page module alone.
const TOOLS = { test: test, run: RUN, spirit: SPIRIT, runner: __filename, batch: false };
// THE RULE MODULES, EACH BY ITS FULL PATH (goal/G49.13: every requireScript a full path written out).
function placeRules() { return SPIRIT.requireScript('spirit/testicle/general/browser/placeRules/script.js'); }
function pageRules() { return SPIRIT.requireScript('spirit/testicle/general/browser/pageRules/script.js'); }
// A PART THAT THROWS IS RED, NEVER SILENT (goal/G49.27, as spirit/test/script-sibling-general.js says its parts): a module that
// does not load, or whose checks throw, reaches no running test, so it is said here, one fixed title a module (goal/G49.6: no
// title assembled at run time).
function placeThrew() { test.run('its browser place rules make their tests without throwing', 0.2, function () { return false; }, test.limit.quick); }
function pageThrew() { test.run('its page rules make their tests without throwing', 0.2, function () { return false; }, test.limit.quick); }

// ONE NODE AND ONE CHROME FOR THE WHOLE RUN (goal/G47.1, box v144: "run on one node and one Chrome for the whole run"): booted
// here once, with every app server the scripts of this run need on (the shared servers, and the app of each script whose
// manifest mounts one), and named to each script's run (SPIRIT_MOUNT_BASE, SPIRIT_CHROME_PORT), which then draws its page in a
// fresh page of that Chrome on that node. Measured on Windows before: ~10 s a script, 6.4 s of it a lab node's boot and 0.7 s
// a Chrome, paid again for every script.
async function batch() {
  const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
  const mounted = function (name) {
    try { const m = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', name, name + '.json'), 'utf8')); return !!(m && m.node && m.node.mount === true) && fs.existsSync(path.join(RUN, 'spirit', 'app', name, name + '.js')); } catch (e) { return false; }
  };
  // Servers by their ids, an app's folder in dots (goal/G49.19).
  const servers = ['spirit.app.agent'];
  GIVEN.forEach(function (one) { const own = (/^(?:spirit\/run\/)?spirit\/app\/([^/]+)\//.exec(one.split(path.sep).join('/')) || [])[1]; const id = own ? SPIRIT.dottedPath('spirit/app/' + own) : ''; if (own && mounted(own) && servers.indexOf(id) === -1) servers.push(id); });
  const env = Object.assign({}, process.env);
  let node = null, chrome = null;
  // THE NODE AND THE CHROME STARTED SIDE BY SIDE (goal/G47.1, box v144's 80%): neither needs the other, so a run waits for
  // the slower of the two, not for both one after the other.
  const bootNode = async function () {
    if (process.env.SPIRIT_MOUNT_BASE) return;
    node = await H.scratchNode({ servers: servers });
    if (!(node.up && node.debug)) return;
    // Each of its servers answering its interface before any page is drawn, as a script's own run waited for its own.
    await Promise.all(servers.map(function (name) {
      return H.until(function () {
        return fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: { branch: name } }) })
          .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.interface); }, function () { return false; });
      }, 30000);
    }));
    env.SPIRIT_MOUNT_BASE = node.base;
    env.SPIRIT_MOUNT_RUN = node.run;
  };
  const bootChrome = async function () {
    const found = H.findChrome();
    if (!found || process.env.SPIRIT_CHROME_PORT) return;
    chrome = await H.sharedChrome(found);
    if (!chrome.error) env.SPIRIT_CHROME_PORT = String(chrome.port);
  };
  await Promise.all([bootNode(), bootChrome()]);
  // EACH SCRIPT IN THIS PROCESS (goal/G47.1, box v144): its page drawn on the shared node and Chrome, one after the other, and
  // only then every script's checks said, each reported for its own script; a process, spirit.js and its reports' wait are
  // paid once for the run, not once a script.
  if (env.SPIRIT_MOUNT_BASE) process.env.SPIRIT_MOUNT_BASE = env.SPIRIT_MOUNT_BASE;
  if (env.SPIRIT_MOUNT_RUN) process.env.SPIRIT_MOUNT_RUN = env.SPIRIT_MOUNT_RUN;
  if (env.SPIRIT_CHROME_PORT) process.env.SPIRIT_CHROME_PORT = env.SPIRIT_CHROME_PORT;
  // EACH SCRIPT JUDGED AS SOON AS ITS PAGE IS DRAWN (box v144: "every result reaches testicle the moment the page knows it"):
  // the run held open while the scripts are drawn one after the other, each one's checks said, and run and reported, the
  // moment its page is done.
  test.hold();
  const tools = Object.assign({}, TOOLS, { batch: true });
  let PAGE = null;
  try { PAGE = pageRules(); } catch (e) { pageThrew(); }
  for (const one of PAGE ? GIVEN : []) {
    try { if (PAGE.appliesTo(one)) await PAGE.checks(one, tools); } catch (e) { test.forScript(one, pageThrew); }
  }
  test.after(async function () {
    if (chrome && chrome.close) chrome.close();
    if (node) await node.release();
  });
  test.release();
}

// What it judges: given no file, the tree and every page module; given a file, that file; given several, each on the run's one
// node and Chrome. A page module's page is drawn before its rules are said (pageRules), so a rule its page gives nothing to
// judge is never said green.
if (GIVEN.length > 1) batch();
else if (!arg) { try { const m = placeRules(); if (m.appliesTo('')) m.checks('', TOOLS); } catch (e) { placeThrew(); } }
else { try { const m = pageRules(); if (m.appliesTo(arg)) Promise.resolve(m.checks(arg, TOOLS)).then(null, pageThrew); } catch (e) { pageThrew(); } }
