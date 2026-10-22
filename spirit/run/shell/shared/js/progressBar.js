// spirit/run/shell/shared/js/progressBar.js
// THE PROGRESS BAR (goal/G29.14): one shared shell element, drawn from (done, total, text).
//
//   The item's box: "progressBar: one shared shell element drawn from (done, total, text); total 0 shows
//   indeterminate. It knows nothing of processes." The shell app hooks it up with the job it belongs to: Jobs feeds it
//   from each process's {job} events, the job cycle of goal/G29.15.
//
// progressBar(done, total, text) -> html: a progress tag, done of total, and the text beside it. total 0 means the
// total is unknown, and a progress tag with no value is the browser's own indeterminate bar.

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function progressBar(done, total, text) {
    var t = Number(total) || 0;
    var d = Math.max(0, Number(done) || 0);
    var tag = t > 0
      ? '<progress max="' + t + '" value="' + Math.min(d, t) + '" style="width:6em"></progress>'
      : '<progress style="width:6em"></progress>';
    var words = t > 0 ? d + '/' + t + (text ? ' ' + text : '') : String(text || '');
    return '<span class="progress-bar">' + tag + (words ? ' <span class="job-manifest-note">' + esc(words) + '</span>' : '') + '</span>';
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.progressBar = progressBar;
}());
