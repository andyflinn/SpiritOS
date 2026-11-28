'use strict';

// spirit/run/spirit/testicle/general/browser/placeRules/test/script.js
// THE BROWSER PLACE RULES MODULE ON SCRIPTS OF ITS OWN (goal/G49.27, step 2b; spec: ./script.md). The box: "Each module has its
// own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two
// product scripts are planted, in a git run of their own (the module's tools.run, what it requires) and in the scratch node's
// tree (its before), which serves them to a page: one that stands at its place once required, and one that takes itself off
// its place as soon as it is placed. ../script.js judges each, one at a time, its tests kept here and not reported; the bodies
// its rule's title stands on run in their order, and that title's verdict is read. The run of every page module again (its
// last title) is not run here: it runs the runner on every page script of the tree.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/browser/placeRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/browser/placeRules/test/script';
const PLANTS = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plantIn(root, rel, text) { const at = path.join(root, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }

const KEEPS = 'spirit/zzPlace/keeps/script.js';
const BREAKS = 'spirit/zzPlace/breaks/script.js';
const FILES = {};
FILES[KEEPS] = "'use strict';\nmodule.exports = { kept: true };\n";
// Placed by the loader as it runs, then taken off its place before anyone asks for it there.
FILES[BREAKS] = "'use strict';\nmodule.exports = { kept: false };\nPromise.resolve().then(function () { if (window.spirit && window.spirit.zzPlace) delete window.spirit.zzPlace.breaks; });\n";
// A git run of its own for one script: what the module lists as the run's product scripts.
function runOf(rel) {
  const run = path.join(PLANTS, rel.split('/')[1] + '-' + rel.split('/')[2], 'spirit', 'run');
  plantIn(run, rel, FILES[rel]);
  const git = function (args) { require('child_process').execFileSync('git', args, { cwd: run, stdio: 'ignore' }); };
  git(['init', '-q']); git(['add', '--', rel]);
  return run;
}

// The bodies its rule stands on, in the order said, for one script; the verdict of the rule's title, true, false, or null.
const RULE_TITLE = 'every product script that loads on a page stands on the spirit object under its own path';
const LOADS = 'some of the product scripts load on a page';
const NEEDS = ['a scratch node comes up with its DEBUG on', 'there are product scripts to require, each alone, on the node and on a page', LOADS, RULE_TITLE];
async function verdict(rel) {
  const kept = [];
  const afters = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function (fn) { afters.push(fn); }, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks('', { test: T, run: runOf(rel), spirit: SPIRIT, runner: '', before: function (run) { plantIn(run, rel, FILES[rel]); } });
  const out = {};
  try {
    for (const k of kept.filter(function (x) { return NEEDS.indexOf(x.title) !== -1; })) {
      try { out[k.title] = (await k.body()) === true; } catch (e) { out[k.title] = null; }
    }
  } finally { for (const fn of afters) { try { await fn(); } catch (e) { /* scratch */ } } }
  return out;
}
const V = {};
test.run('it hands out appliesTo, its resource browser, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'browser' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('it applies to the tree, given no file, and to no one script handed', 0.4, function () {
  return (RULE.appliesTo('') === true && RULE.appliesTo('spirit/element/busyButton/script.js') === false) || false;
}, test.limit.quick);
test.run('a planted script that stands at its place loads on a page and keeps the rule', 0.4, async function () {
  V.keeps = await verdict(KEEPS);
  return (V.keeps[LOADS] === true && V.keeps[RULE_TITLE] === true) || false;
}, test.limit.long);
test.run('a planted script that takes itself off its place loads on a page and is red', 0.4, async function () {
  V.breaks = await verdict(BREAKS);
  return (V.breaks[LOADS] === true && V.breaks[RULE_TITLE] === false) || false;
}, test.limit.long);
