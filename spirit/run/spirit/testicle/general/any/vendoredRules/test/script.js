'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/vendoredRules/test/script.js
// THE VENDORED RULES MODULE ON A TREE OF ITS OWN (goal/G49.27; spec: ./script.md). The box: "Each module has its own test ... planting a
// tiny script breaking a rule and one keeping it, so a module that passes everything is red." ../script.js judges what
// is planted, its tests kept here and not reported, and the verdict of the rule's title is read. Its checks came from the
// one general rules module, spirit/testicle/general/any/generalRules/script.js, with the checks of its own test that judge them.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/vendoredRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/vendoredRules/test/script';
const ROOT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

// A planted repository each side, <root>/<side>/, its run <root>/<side>/spirit/run: plant(side, rel, text) writes rel under
// that run, plantRepo(side, rel, text) under the repository.
function runOf(side) { return path.join(ROOT, side, 'spirit', 'run'); }
function write(at, text) { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }
function plant(side, rel, text) { return write(path.join(runOf(side), rel), text); }
function plantRepo(side, rel, text) { return write(path.join(ROOT, side, rel), text); }
// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
async function verdict(side, scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, over: function (t, severity, files, judge) { kept.push({ title: t, body: async function () { const l = typeof files === 'function' ? await files() : files; if (!Array.isArray(l)) return false; for (const f of l) { let v = false; try { v = await judge(f); } catch (e) { v = false; } if (v !== true) return false; } return true; } }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: runOf(side), spirit: SPIRIT, node: { node: null }, forbids: {} });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

const KEEPS = plant('one', 'spirit/zzKeeps/script.js', '\'use strict\';\nmodule.exports = {};\n');
const BREAKS = plant('one', 'spirit/zzBreaks/script.js', "'use strict';\n// it stood in spirit/run/node_modules\nmodule.exports = {};\n");

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
const RULE_TITLE = 'it names no spirit/run/node_modules';
test.run('a planted script that names no old library place keeps the rule', 0.4, async function () {
  return (await verdict('one', KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted script whose comment names the old library place is red', 0.4, async function () {
  return (await verdict('one', BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);
