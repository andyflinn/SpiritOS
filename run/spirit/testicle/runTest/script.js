'use strict';
// run/spirit/testicle/runTest/script.js
// ONE TEST, RUN AS THE CONTRACT SAYS (goal/G50.1, box v24): "a test's script.js exports one function; it is handed the
// exact spirit path of its subject, for example 'spirit/server/script.js', and answers true (green) or false (red), or a
// promise of either"; "tests are loaded by spirit.requireScript, since they may run in the browser; the caller catches
// throws, rejections and hangs, each counted red". Loaded by spirit.requireScript itself, so it is the same on both sides.
//
//   spirit.testicle.runTest.script(testPath, subjectPath, limitMs) -> promise of { answered, green, ms, reason }
//     answered: the test gave true or false in time (what the classifier asks)
//     green:    it gave true
//     reason:   why it is red when it did not answer: 'not-loaded', 'not-a-function', 'threw', 'rejected', 'hung',
//               'not-a-boolean'
module.exports = function runTest(testPath, subjectPath, limitMs) {
  var limit = Number(limitMs) > 0 ? Number(limitMs) : 5000;
  var started = Date.now();
  function row(answered, green, reason, error) {
    var r = { answered: answered, green: green, ms: Date.now() - started };
    if (reason) r.reason = reason;
    if (error) r.error = String((error && error.message) || error).slice(0, 300);
    return r;
  }
  return spirit.requireScript(testPath).then(function (check) {
    if (typeof check !== 'function') return row(false, false, 'not-a-function');
    return new Promise(function (done) {
      var over = false;
      var timer = setTimeout(function () { over = true; done(row(false, false, 'hung')); }, limit);
      function finish(r) { if (over) return; over = true; clearTimeout(timer); done(r); }
      var answer;
      try { answer = check(subjectPath); } catch (e) { finish(row(false, false, 'threw', e)); return; }
      Promise.resolve(answer).then(function (v) {
        finish(typeof v === 'boolean' ? row(true, v) : row(false, false, 'not-a-boolean'));
      }, function (e) { finish(row(false, false, 'rejected', e)); });
    });
  }, function (e) { return row(false, false, 'not-loaded', e); });
};
