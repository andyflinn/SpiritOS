'use strict';
// spirit/run/spirit/app/testicle/words.js
// TESTICLE'S WORDS, SAID IN ONE PLACE (goal/G47.1, Andy: "why is the formatting of the status messages etc not shared code?????",
// and "can you make sure this is shared code and not diverging separate shit before you bring it to me?"): every status line
// testicle shows, and the icon of every result, made here; its status box and its test row require this, and
// none of them words a status of its own. The server words nothing since the doing text went (goal/G47.4, the box:
// "the doing text goes: nothing reads it").
//
//   result(ok)                              '✅' for a result that held, '❌' for one that did not
//   counted(n, file)                        ["<n>:", " <file>"], a row of the status bar, its number and its words apart
//                                           (goal/G47.4, the box, ### status bar: row 1 "<suites owed>: <suite file name>", row 2
//                                           "<tests reported>: <script file name>"; Andy: "the two numbers, starting the two rows
//                                           must be fixed width, 6em, right aligned, and invisible when zero")
//   classified(n, total, script)            ["<n>", " of <total>: <script>"], row 2 while the classifier runs (the box: "precede
//                                           it with a constant 'of <total-number-of-scripts-being classified>' before <script-file-name>")
//
// On a page it stands at spirit.required.spirit.app.testicle.words; on the node it is this module.
(function (root) {
  const W = {
    result: function (ok) { return ok ? '✅' : '❌'; },
    counted: function (n, file) { return [n + ':', ' ' + String(file || '')]; },
    classified: function (n, total, script) { return [String(n), ' of ' + total + ': ' + String(script || '')]; },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = W;
  const S = root && root.spirit;
  if (S && S.required) ['spirit', 'app', 'testicle', 'words'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = W; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
