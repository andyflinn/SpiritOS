'use strict';
// spirit/run/spirit/app/testicle/test/testicle-sibling-browser.js [<script> ...]
// TESTICLE'S OWN -browser GENERAL TEST (goal/G47.1, box v143: "its general tests there: spirit/app/testicle/test/
// testicle-sibling-general.js, testicle-sibling-node.js and testicle-sibling-browser.js, each with a dumb test or two; in debug
// mode these are the only general tests testicle sees"). A -sibling- general test beside spirit/app/testicle/testicle.js: it
// judges spirit/app/testicle/ and below (spirit/test/testModule.js). Its spec: ./testicle-sibling-browser.md. A check of what a page would load, one test a script.
// No argument, every script it judges; each argument, that one, its result reported for it.
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SCOPE = 'spirit/app/testicle/';
// A path as given, absolute or not, scoped to run://.
function runRel(a) { const abs = path.isAbsolute(String(a)) ? String(a) : path.resolve(String(a)); const r = path.relative(RUN, abs).split(path.sep).join('/'); return (r && r.indexOf('..') !== 0 && fs.existsSync(abs)) ? r : String(a).split(path.sep).join('/').replace(/^spirit\/run\//, ''); }
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; }).map(runRel);
// Every product script under spirit/app/testicle/ (no test/ folder, no temp/), when none is given.
function mine() {
  const out = [];
  (function walk(rel) { fs.readdirSync(path.join(RUN, rel), { withFileTypes: true }).forEach(function (d) { const r = rel + d.name; if (d.isDirectory()) { if (d.name !== 'test' && d.name !== 'temp') walk(r + '/'); } else if (/\.js$/.test(d.name)) out.push(r); }); }(SCOPE));
  return out;
}
function one(rel) { test.run(rel + ': ' + "it holds no NUL byte, so a page can load it as text", 0.2, function () { try { return fs.readFileSync(path.join(RUN, rel)).indexOf(0) === -1 || 'it holds a NUL byte'; } catch (e) { return String(e && e.message || e); } }, test.limit.quick); }
if (!GIVEN.length) mine().forEach(one);
else GIVEN.forEach(function (rel) { test.forScript(rel, function () { one(rel); }); });
