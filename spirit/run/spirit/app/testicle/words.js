'use strict';
// spirit/run/spirit/app/testicle/words.js
// TESTICLE'S WORDS, SAID IN ONE PLACE (goal/G47.1, Andy: "why is the formatting of the status messages etc not shared code?????",
// and "can you make sure this is shared code and not diverging separate shit before you bring it to me?"): every status line
// testicle shows, and the icon of every result, made here; its server (testicle.js), its status box and its test row require
// this, and none of them words a status of its own.
//
//   result(ok)                              '✅' for a result that held, '❌' for one that did not
//   run(suite, scripts)                     "<suite's file name> for <script>", or "for <n> scripts"
//   classifying(done, of)                   "classifying <done> of <of>"
//   running(suite, scripts, tested, last)   "running <run>", then ", <tested> tested: [<script> ]<test> <result>" once a result
//                                           of it came in (last: { script, test, ok }), its script named when it runs several
//   reported(done, of, script, ok)          "<done> of <of> reported: <script> <result>" (box v134-135, the result an icon:
//                                           Andy, "why are the results in status messages not icons?")
//   change(table, key, change)              "<change> <table>: <key's parts>", a test row's flip left off
//
// On a page it stands at spirit.required.spirit.app.testicle.words; on the node it is this module.
(function (root) {
  function base(p) { const s = String(p || ''); return s.slice(s.lastIndexOf('/') + 1); }
  const W = {
    result: function (ok) { return ok ? '✅' : '❌'; },
    run: function (suite, scripts) {
      const list = Array.isArray(scripts) ? scripts : [scripts];
      return base(suite) + ' for ' + (list.length === 1 ? String(list[0]) : list.length + ' scripts');
    },
    classifying: function (done, of) { return 'classifying ' + done + ' of ' + of; },
    running: function (suite, scripts, tested, last) {
      const list = Array.isArray(scripts) ? scripts : [scripts];
      const told = last ? ', ' + tested + ' tested: ' + (list.length > 1 ? last.script + ' ' : '') + last.test + ' ' + W.result(last.ok) : '';
      return 'running ' + W.run(suite, list) + told;
    },
    reported: function (done, of, script, ok) { return done + ' of ' + of + ' reported: ' + script + ' ' + W.result(ok); },
    change: function (table, key, change) {
      const what = table === 'testicle' ? String(key).split('|').slice(0, 3).join(' | ') : String(key).split('|').join(' | ');
      return String(change || 'updated') + ' ' + table + ': ' + what;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = W;
  const S = root && root.spirit;
  if (S && S.required) ['spirit', 'app', 'testicle', 'words'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = W; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
