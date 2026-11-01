// spirit/run/process/js/deskVerify/family/clientCacheManager.js
// WHAT A CLIENT KNOWS OF THE VERIFIER, IN THE VERIFIER'S OWN FOLDER (goal/G41.28), as the desk's own is
// (process/js/desk/family/clientCacheManager.js). Andy: "These rules apply to ALL clients. including deskVerify", and the box:
// "All client side searches will be fixed, too, and search the whole row, as cached in spirit.data". A page loads it from
// the node that served it (spirit.require); it runs the translator into that page's spirit.data.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the Desk's verifier pane and its List's run
// status, the item dialog, the fallout plugin, falloutHistory) asks spirit.verifyData (below), never a branch by name.
//   verify      now -> what the verifier last published of itself (deskVerify.js say: doing, suite, index, of, tests,
//               expected, line, since, stopAsked, idleMs, chores, hasChores, consoleRun, consoleTo, consoleEnded)
//   verifyTests key -> a test's newest result, as the search over tests answers it (the fallout list's rows)
//   verifyFlips suite + newline + title + newline + at -> one flip of a test, as the search over its history answers it
//               (falloutHistory's rows)
// The rows come as jobs of module process/js/deskVerify: the verifier's publishes. Every event ends in set; it asks nothing.
(function (root) {
  var STATE = 'verify';
  var TESTS = 'verifyTests';
  var FLIPS = 'verifyFlips';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.deskVerify.clientCacheManager') : '__deskVerifyClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).verifyData = D[ATTACHED]; return; }
    // The deskVerify family's view of the home node; a publish is filed under the node that sent it (goal/G41.28).
    var HOME = D.at(null, 'deskVerify');
    D.translate({
      onJob: function (job) {
        var o = job && job.module === 'process/js/deskVerify' ? job.app : null;
        if (o && typeof o === 'object' && typeof o.doing === 'string') D.at(job.fromNode || null, 'deskVerify').set(STATE + '/now', o);
      },
    });
    // THE READS, ANSWERED HERE:
    //   state()       what the verifier last published of itself, or null
    //   watch(fn)     fn(state) on every publish kept from now on; answers its release
    //   testsBranch   the tests' whole path, for a list that is a view of it (probabilitySearch's data)
    //   seatFlips(a)  a search answer over one test's history ({items: [{label}]}, each label a flip's row) kept, each flip
    //                 at its own key
    //   flips(suite, heading)  the flips kept of that test (title the heading, or "<heading> #<n>" under it)
    var verifyData = {
      state: function () { return HOME.get(STATE + '/now') || null; },
      watch: function (fn) { return HOME.watch(STATE + '/now', function (p, v) { if (v && typeof fn === 'function') fn(v); }); },
      get testsBranch() { return HOME.path(TESTS); },
      seatFlips: function (answer) {
        ((answer && answer.items) || []).forEach(function (i) {
          var r = null;
          try { r = JSON.parse(i.label); } catch (e) { return; }
          if (r && typeof r === 'object') HOME.set(FLIPS + '/' + [r.suite, r.title, r.at].join('\n'), r);
        });
      },
      flips: function (suite, heading) {
        var all = HOME.branch(FLIPS);
        return Object.keys(all).map(function (k) { return all[k]; }).filter(function (r) {
          var t = String((r && r.title) || '');
          return r && r.suite === suite && (t === heading || t.indexOf(heading + ' #') === 0);
        });
      },
    };
    try { Object.defineProperty(D, ATTACHED, { value: verifyData }); } catch (e) { D[ATTACHED] = verifyData; }
    (root.spirit = root.spirit || {}).verifyData = verifyData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
