// spirit/run/shell/falloutHistory/falloutHistory.js
// THE HISTORY OF ONE TESTED THING, AS A DIALOG (goal/G27.14, F6).
//
//   Andy, 2026-10-17: "i only want to see the latest, if you want to show the history of one test, use a dialog.", then
//   "so we'll add a dialog for test-history, that shows us the flips."
//
// Opened with { suite, heading }: the test file and the sub-heading its checks stand under (a check's key is
// "<heading> #<n>", goal/G27.14), or one test's full key. It reads every flip with this node's deskVerify search
// itself (goal/G29.5: "fallout talks to deskVerify only"), and draws one line per flip, newest first: the check's
// number, ❌ fail or ✅ success, and when; the commit and the printed failure stay in deskVerify, off the screen.
// Nothing in the tree opens it (its manifest runs nowhere): the Fallout tab that did went with the desk's plugins.
//
// DISCREPANCY WITH ANDY's RULES: goal/G43.22's box says the apps and plugin system goes, "with that the folloing
// features will disappear: ... - fallout"; this dialog of the fallout feature, and its rows in
// process/js/deskVerify/data.js (seatFlips, flips), are still here.

var fhApi = null;
var fhBody = null;
var fhKey = '';

function fhEsc(s) { return fhApi && fhApi.escapeHtml ? fhApi.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fhWhen(iso) { return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''; }
function fhAsk(verb, args) {
  return Promise.resolve(fhApi.verb('deskVerify.' + verb, args)).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) throw new Error((body.extra && body.extra.why) || body.code || 'refused');
    return body;
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    fhApi = api;
    fhBody = container;
  },
  open: function (params) {
    var suite = String((params && params.suite) || '');
    var heading = String((params && params.heading) || '');
    var key = suite + '\n' + heading;
    fhKey = key;
    // Every block a leading 1em (the desk's UI rules).
    fhBody.innerHTML = '<div class="stat-tile wide" style="margin-top:1em"><div class="label">' + fhEsc(suite) + ': ' + fhEsc(heading) + '</div>' +
      '<div id="fh-note" class="job-manifest-note">Reading its flips.</div><div id="fh-rows" style="margin-top:1em"></div></div>';
    // THE FLIPS KEPT IN SPIRIT.DATA (goal/G41.28; Andy, the box: "If its rows are NOT cached in the proper place, with the
    // shells one and only spirit.data object, then that must be fixed, too."): the answer is seated by the verifier's own
    // cache manager (spirit/run/process/js/deskVerify/data.js), and the lines are drawn from what it keeps.
    var V = null;
    return Promise.resolve(spirit.require('process/js/deskVerify/data.js')).then(function () {
      V = ((spirit.data || {}).deskVerify || {}).data;
      if (!V) throw new Error('the verifier\'s cache manager did not load');
      return fhAsk('search', { over: 'tests', suite: suite, heading: heading, history: 'yes', slim: 'yes' });
    }).then(function (r) {
      if (fhKey !== key) return;
      V.seatFlips(r);
      var rows = V.flips(suite, heading).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      var el = document.getElementById('fh-rows');
      var note = document.getElementById('fh-note');
      if (note) note.textContent = rows.length ? rows.length + ' flip(s)' + (r && r.more ? ', the newest ' + rows.length + ' of ' + (Number(r.total) || rows.length) : '') + ', newest first.' : 'No flips recorded yet.';
      if (el) {
        // NO COMMIT AND NO FAILURE TEXT ON SCREEN (Andy, 2026-10-17: "I know you can read those details, so it doesn't
        // need to be on-screen."), the ❌/✅ kept ("Keep the fucking fail/success icons").
        el.innerHTML = rows.length ? '<table class="jobs-table"><thead><tr><th>Check</th><th>Status</th><th>When</th></tr></thead><tbody>' +
          rows.map(function (x) {
            var n = (String(x.title || '').match(/#(\d+)$/) || ['', ''])[1];
            return '<tr><td>#' + fhEsc(n) + '</td><td>' + (x.outcome === 'red' ? '❌ fail' : '✅ success') + '</td>' +
              '<td>' + fhEsc(fhWhen(x.at)) + '</td></tr>';
          }).join('') + '</tbody></table>' : '';
      }
    }, function (e) {
      if (fhKey !== key) return;
      var note = document.getElementById('fh-note');
      if (note) note.textContent = 'Its flips could not be read: ' + ((e && e.message) || e);
    });
  },
});
