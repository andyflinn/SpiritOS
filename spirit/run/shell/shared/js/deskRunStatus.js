// spirit/run/shell/shared/js/deskRunStatus.js
// THE VERIFIER'S RUN IN AN ITEM'S STATUS — goal/G33.6, bringing back goal/G18.5's status box.
//
//   Andy, 2026-10-12 (goal/G18.5): "when a search is run agains the goal or an item, it takes the status box in the
//   list using let's say 16em width, and shows progress there as well." And, 2026-10-23, once it had gone with
//   goal/G33.3: "why do i no longer see the verifier run in the items status column?"
//
// deskVerify knows no item (goal/G33.3), so the page joins the two halves: WHICH item runs is the desk's fact
// (verifyRunning, set when the desk handed it over and the verifier took it), and HOW FAR is deskVerify's own publish
// ({doing: 'run', suite, index, of, tests, expected}), the same objects the Verifier tab receives. One rendering, for
// the List row's status column and the item's dialog alike, as the shared elements are (goal/G27.9, D).
//
// deskRunStatus(facts, run, esc) -> html, or '' when this item shows neither a run nor an ended one. esc escapes text
// for HTML (the app's escapeHtml).
// AN ENDED RUN'S OUTCOME (goal/G33.7, box v10; Andy could not tell whether a Verify succeeded): while no run of the item
// shows, its facts' outcome does, "verified green" or "red: N suites" (verifyRed, the suites the run ended red), until
// the next run starts.

(function () {
  function deskRunStatus(facts, run, esc) {
    if (!facts) return '';
    var e = typeof esc === 'function' ? esc : function (x) { return String(x); };
    if (facts.verifyRunning !== true || !run || run.doing !== 'run') return ended(facts);
    var of = Number(run.of) || 0;
    var index = Number(run.index) || 0;
    var inOne = (of && Number(run.expected) > 0) ? Math.min(1, (Number(run.tests) || 0) / Number(run.expected)) : 0;
    var pct = of ? Math.max(0, Math.min(100, Math.round(((index - 1) + inOne) / of * 100))) : 0;
    var suite = String(run.suite || '').split('/').pop();
    return '<progress max="100" value="' + pct + '" style="width:6em"></progress> ' +
      '<span class="job-manifest-note">verifying' + (suite ? ' ' + e(suite) : '') + (of ? ', suite ' + index + ' of ' + of : '') + '</span>';
  }
  function ended(facts) {
    if (facts.verified === 'green') return '<span style="color:#1a7f37">verified green</span>';
    if (facts.verified !== 'red') return '';
    var n = Number(facts.verifyRed) || 0;
    if (!n) {
      // A row from before the count: its failure lines name the suites.
      var seen = {};
      (Array.isArray(facts.verifyFailures) ? facts.verifyFailures : []).forEach(function (l) { seen[String(l).split(' ')[0]] = true; });
      n = Object.keys(seen).length;
    }
    return '<span style="color:#c00">red: ' + n + ' suite' + (n === 1 ? '' : 's') + '</span>';
  }
  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.deskRunStatus = deskRunStatus;
}());
