'use strict';
// spirit/run/spirit/element/codeMirror.js
// THE CODEMIRROR SHELL ELEMENT (goal/G41.7): a file's text on CodeMirror 5, in read mode or edit mode.
//
//   Andy, Q1: "make codeMirror a shell element by the same name. and make sure that it supports both read and edit-mode,
//   and that the text viewer uses that new element as well." It replaces spirit/element/textView.js, which is gone. The text
//   viewer (spirit/element/textViewer.js) is gone too (faaf2b1b); the text element (spirit/app/text/element.js) edits with it,
//   and deskDetails, introSpector, jobDetail and the agent tables' rows draw with it.
//
// THE ONLY DOOR TO THE LIBRARY (goal/G43.5; Andy: "only access to codeMirror library is through the element!"): no script uses it
// beside this. THE PAGE HOLDS IT (goal/G49.15, box v16: "the vendored codeMirror will be loaded by face.html with a script tag"):
// face.html's own tags load the library, its add-ons, its modes and its sheets from the local copy (spirit/element/codeMirror/),
// so this element loads none of them and draws with window.CodeMirror.
//
// codeMirror.create(host, { mode, text, words, line, path }) -> Promise of { mode, cm, value(), mark(words) }
//   mode    'read' (the default: the text shown, not editable) or 'edit' (editable; value() is what was typed)
//   text    what it shows ('' when none)
//   words   the search words: every match marked (class text-view-match), the first put in view
//   line    a 1-based line put in view instead (goal/G29.11: a file found by its contents opens at its line)
//   path    the file's path, which picks the syntax colours by its extension
(function () {
  // The syntax by extension, and the mode files each needs, in the order they load (a mode it builds on first).
  var MODES = {
    js: 'javascript', mjs: 'javascript', json: { name: 'javascript', json: true },
    css: 'css', html: 'htmlmixed', htm: 'htmlmixed', xml: 'xml', svg: 'xml', md: 'markdown',
  };
  function modeOf(p) {
    var name = String(p || '');
    var dot = name.lastIndexOf('.');
    return dot === -1 ? null : MODES[name.slice(dot + 1).toLowerCase()] || null;
  }
  function sp() { return window.spirit || {}; }

  function create(host, options) {
    var o = options || {};
    var editing = o.mode === 'edit';
    var mode = modeOf(o.path);
    return Promise.resolve(window.CodeMirror).then(function (CodeMirror) {
      if (typeof CodeMirror !== 'function') throw new Error('CodeMirror is not on this page');
      var cm = CodeMirror(host, {
        value: String(o.text == null ? '' : o.text),
        readOnly: !editing,
        lineNumbers: true,
        lineWrapping: true,
        mode: mode,
        theme: 'material-darker',
        // ITS INPUT AN EDITABLE BOX, NOT A HIDDEN TEXTAREA (the general rules: every input it draws has a maxlength): CodeMirror's
        // own textarea only buffers keystrokes, so a limit on it would cut a paste; contenteditable takes the same input with
        // no textarea at all.
        inputStyle: 'contenteditable',
      });
      var marks = [];
      var firstAt = null;   // where the first match stands, put in view again once the page is drawn
      // EVERY MATCH MARKED, THE FIRST IN VIEW, BY THE LIST'S OWN RULE (window.spirit.matchRanges, probabilitySearch.js): one
      // marking rule for the list and the text (goal/G29.12).
      function mark(words) {
        marks.forEach(function (m) { m.clear(); });
        marks = [];
        var ranges = typeof sp().matchRanges === 'function' ? sp().matchRanges(cm.getValue(), words) : [];
        var first = null;
        ranges.forEach(function (r) {
          var from = cm.posFromIndex(r[0]);
          marks.push(cm.markText(from, cm.posFromIndex(r[1]), { className: 'text-view-match' }));
          if (!first) first = from;
        });
        // The line asked for wins over the first match (goal/G29.11).
        if (Number(o.line) > 0) first = { line: Number(o.line) - 1, ch: 0 };
        firstAt = first;
        if (first) {
          cm.setCursor(first);
          cm.scrollIntoView({ line: first.line, ch: first.ch }, 80);
        }
        return marks.length;
      }
      mark(o.words);
      // DRAWN ONCE THE PAGE SHOWS IT (goal/G29.12; Andy, 2026-10-18: "when the file viewer/launcher is called, it shows
      // almost nothing"): CodeMirror built in a hidden box measures nothing and draws no lines, so it is refreshed once
      // this turn is over, and the first match is put in view again.
      setTimeout(function () {
        cm.refresh();
        if (firstAt) cm.scrollIntoView({ line: firstAt.line, ch: firstAt.ch }, 80);
      }, 0);
      // AND AGAIN EACH TIME IT BECOMES VISIBLE (goal/G48.5; Andy: "there's something that the codeMirror element does when it
      // is activated. and it makes the text display properly aligned inside the codeMirror box. It should do the same thing
      // when it becomes visible."): what activating it does is CodeMirror measuring its box again; a box hidden behind a tab
      // or a closed panel measured nothing, so each time its host comes into view, or grows from nothing, it is refreshed.
      var wrapper = host;
      var shown = false;
      function redraw() { cm.refresh(); }
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(function (entries) {
          var now = entries.some(function (e) { return e.isIntersecting; });
          if (now && !shown) redraw();
          shown = now;
        }).observe(wrapper);
      }
      if (typeof ResizeObserver === 'function') {
        var wasEmpty = true;
        new ResizeObserver(function (entries) {
          var r = entries[entries.length - 1].contentRect;
          var empty = !(r.width > 0 && r.height > 0);
          if (wasEmpty && !empty) redraw();
          wasEmpty = empty;
        }).observe(wrapper);
      }
      return { mode: editing ? 'edit' : 'read', cm: cm, value: function () { return cm.getValue(); }, mark: mark };
    });
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
