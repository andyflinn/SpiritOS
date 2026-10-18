// spirit/run/shell/js/textView.js
// THE TEXT VIEW (goal/G29.12): one shell element for a file's text, on CodeMirror 5, the search words marked.
//
//   The item's box: "A file display and the text editor, both on CodeMirror 5: a file opens with given words, every
//   match marked, the first in view; the text editor edits and saves on the same CodeMirror, its plain text area gone."
//   CodeMirror 5 is the shell's local copy, spirit/run/shell/node_modules/codemirror/, loaded by index.html before this.
//
// createTextView(container, { text, words, readOnly, path }) puts one CodeMirror in the container and answers
// { value(), mark(words), cm }:
//   text       what it shows
//   words      the search words: every match marked (case ignored), the first scrolled into view
//   readOnly   a display, not an editor
//   path       the file's path, which picks the syntax colours by its extension
// The marks are drawn as the shared list marks a match (class text-view-match, index.html).

(function () {
  // The syntax by extension: the modes index.html loads.
  var MODES = {
    js: 'javascript', mjs: 'javascript', json: { name: 'javascript', json: true },
    css: 'css', html: 'htmlmixed', htm: 'htmlmixed', xml: 'xml', svg: 'xml', md: 'markdown',
  };
  function modeOf(p) {
    var name = String(p || '');
    var dot = name.lastIndexOf('.');
    return dot === -1 ? null : MODES[name.slice(dot + 1).toLowerCase()] || null;
  }

  function createTextView(container, options) {
    var o = options || {};
    var cm = window.CodeMirror(container, {
      value: String(o.text == null ? '' : o.text),
      readOnly: o.readOnly === true,
      lineNumbers: true,
      lineWrapping: true,
      mode: modeOf(o.path),
      theme: 'material-darker',
    });
    var marks = [];
    var firstAt = null;   // where the first match stands, put in view again once the page is drawn
    // EVERY MATCH MARKED, THE FIRST IN VIEW, BY THE LIST'S OWN RULE (window.spiritMatchRanges, listSearch.js): one
    // marking rule for the list and the text view (goal/G29.12).
    function mark(words) {
      marks.forEach(function (m) { m.clear(); });
      marks = [];
      var ranges = typeof window.spiritMatchRanges === 'function' ? window.spiritMatchRanges(cm.getValue(), words) : [];
      var first = null;
      ranges.forEach(function (r) {
        var from = cm.posFromIndex(r[0]);
        marks.push(cm.markText(from, cm.posFromIndex(r[1]), { className: 'text-view-match' }));
        if (!first) first = from;
      });
      firstAt = first;
      if (first) {
        cm.setCursor(first);
        cm.scrollIntoView({ line: first.line, ch: first.ch }, 80);
      }
      return marks.length;
    }
    mark(o.words);
    // DRAWN ONCE THE PAGE SHOWS IT (goal/G29.12; Andy, 2026-10-18: "when the file viewer/launcher is called, it shows
    // almost nothing"): a launcher stays mounted and the shell hands it the next file while its pane is still hidden,
    // and CodeMirror built in a hidden box measures nothing and draws no lines. So it is refreshed once this turn is
    // over, the pane shown, and the first match is put in view again.
    setTimeout(function () {
      cm.refresh();
      if (firstAt) cm.scrollIntoView({ line: firstAt.line, ch: firstAt.ch }, 80);
    }, 0);
    return { cm: cm, value: function () { return cm.getValue(); }, mark: mark };
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createTextView = createTextView;
}());
