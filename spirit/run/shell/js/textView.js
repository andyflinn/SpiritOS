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
  function escapeRe(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
    // EVERY MATCH MARKED, THE FIRST IN VIEW: each word wherever it stands, case ignored, as the shared list marks it.
    function mark(words) {
      marks.forEach(function (m) { m.clear(); });
      marks = [];
      var ws = String(words || '').split(/\s+/).filter(Boolean).map(escapeRe);
      if (!ws.length) return 0;
      var text = cm.getValue();
      var re = new RegExp(ws.join('|'), 'ig');
      var hit;
      var first = null;
      while ((hit = re.exec(text)) !== null) {
        if (!hit[0]) { re.lastIndex += 1; continue; }
        var from = cm.posFromIndex(hit.index);
        var to = cm.posFromIndex(hit.index + hit[0].length);
        marks.push(cm.markText(from, to, { className: 'text-view-match' }));
        if (!first) first = from;
      }
      if (first) {
        cm.setCursor(first);
        cm.scrollIntoView({ line: first.line, ch: first.ch }, 80);
      }
      return marks.length;
    }
    mark(o.words);
    return { cm: cm, value: function () { return cm.getValue(); }, mark: mark };
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createTextView = createTextView;
}());
