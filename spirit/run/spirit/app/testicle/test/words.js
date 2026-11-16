'use strict';

// spirit/run/spirit/app/testicle/test/words.js
// The test of spirit/app/testicle/words.js, and of no other module (spec: ./words.md): TESTICLE'S WORDS, SHARED (goal/G47.1,
// Andy: "why is the formatting of the status messages etc not shared code?????", "can you make sure this is shared code and
// not diverging separate shit before you bring it to me?"; cw: "one small module, spirit/app/testicle/words.js, that says a
// result (✅/❌), a run (\"<suite> for <script>\") and a count, required by the server, the status box and the row alike; each
// place calls it, none builds its own."). Read as text: every other script of testicle, outside its test folders, is
// searched for a result icon or a status phrase built by itself.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const REL = 'spirit/app/testicle/words.js';

// A script's code with its comments left out, so a comment quoting the box is not a phrase built.
function codeOf(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(function (l) { return l.replace(/(^|[^:'"])\/\/.*$/, '$1'); }).join('\n'); }
const OTHERS = execFileSync('git', ['ls-files', '--', 'spirit/app/testicle'], { cwd: RUN, encoding: 'utf8' }).split('\n')
  .filter(function (f) { return /\.js$/.test(f) && !/(^|\/)test\//.test(f) && !/\/temp\//.test(f) && f !== REL; });
// What a script builds itself: a result icon, or one of the status phrases.
const BUILT = [
  // a result icon
  { re: /['"`](✅|❌)['"`]/ },
  // the phrase "<x> of <n> reported"
  { re: /['"`] reported: ['"`]/ },
  // the phrase "running <suite> for <script>"
  { re: /['"`]running ['"`]\s*\+/ },
  // the phrase "classifying <n> of <m>"
  { re: /['"`]classifying ['"`]\s*\+/ },
  // the words success and failure
  { re: /['"`](success|failure)['"`]\s*\)?\s*[;:,)]/ },
];

test.run('spirit/app/testicle/words.js is there', 0.4, function () {
  return fs.existsSync(path.join(RUN, REL)) || false;
}, test.limit.quick);
test.run('testicle\'s other scripts are read as text', 0.2, function () {
  return OTHERS.length > 3 || false;
}, test.limit.quick);
test.run('no other script of testicle builds a result icon or a status phrase itself', 0.8, function () {
  const bad = [];
  OTHERS.forEach(function (f) {
    const code = codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'));
    BUILT.forEach(function (b) { if (b.re.test(code)) bad.push(f); });
  });
  return bad.length === 0 || false;
}, test.limit.quick);
test.run('the server, the status box and the result row each require words.js', 0.8, function () {
  const need = ['spirit/app/testicle/testicle.js', 'spirit/app/testicle/element/statusBox.js', 'spirit/app/testicle/element/search/testicle/rowElement.js'];
  const not = need.filter(function (f) { try { return fs.readFileSync(path.join(RUN, f), 'utf8').indexOf('spirit/app/testicle/words.js') === -1; } catch (e) { return true; } });
  return not.length === 0 || false;
}, test.limit.quick);
