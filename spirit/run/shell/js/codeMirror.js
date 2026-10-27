// spirit/run/shell/js/codeMirror.js
// THE CODEMIRROR SHELL ELEMENT (goal/G41.7): a file's text on CodeMirror 5, in read mode or edit mode.
//
//   Andy, Q1: "make codeMirror a shell element by the same name. and make sure that it supports both read and edit-mode,
//   and that the text viewer uses that new element as well." It replaces shell/js/textView.js, which is gone; the text
//   viewer (shell/js/textViewer.js) and the TextEditor app draw with it.
//
// IT LOADS THE LIBRARY ITSELF, once, from the shell's local copy (shell/node_modules/codemirror/), never by reading
// index.html (goal/G40.7: the face never reads it): the library, its two stylesheets and the mode files of the path's
// syntax, each through spirit.require.
//
// codeMirror.create(host, { mode, text, words, line, path }) -> Promise of { mode, cm, value(), mark(words) }
//   mode    'read' (the default: the text shown, not editable) or 'edit' (editable; value() is what was typed)
//   text    what it shows ('' when none)
//   words   the search words: every match marked (class text-view-match), the first put in view
//   line    a 1-based line put in view instead (goal/G29.11: a file found by its contents opens at its line)
//   path    the file's path, which picks the syntax colours by its extension
(function () {
  var CM = 'shell/node_modules/codemirror/';
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // The syntax by extension, and the mode files each needs, in the order they load (a mode it builds on first).
  var MODES = {
    js: 'javascript', mjs: 'javascript', json: { name: 'javascript', json: true },
    css: 'css', html: 'htmlmixed', htm: 'htmlmixed', xml: 'xml', svg: 'xml', md: 'markdown',
  };
  var FILES = {
    javascript: ['mode/javascript/javascript.js'],
    css: ['mode/css/css.js'],
    xml: ['mode/xml/xml.js'],
    markdown: ['mode/xml/xml.js', 'mode/markdown/markdown.js'],
    htmlmixed: ['mode/xml/xml.js', 'mode/javascript/javascript.js', 'mode/css/css.js', 'mode/htmlmixed/htmlmixed.js'],
  };
  var SHEETS = ['lib/codemirror.css', 'theme/material-darker.css'];

  function modeOf(p) {
    var name = String(p || '');
    var dot = name.lastIndexOf('.');
    return dot === -1 ? null : MODES[name.slice(dot + 1).toLowerCase()] || null;
  }
  function modeName(mode) { return !mode ? '' : typeof mode === 'string' ? mode : mode.name; }
  function sp() { return window.spirit || {}; }

  // EVERY FILE THROUGH spirit.require, THE ONE LOADER (Andy: "use the require interfaces that exists in spirit.js or
  // boot.js, NOTHING HAND-ROLLED"): on a page it runs each as a plain script, a stylesheet as a style, and loads each
  // once. The library puts CodeMirror on the page; a mode file finds it there and defines its mode on it.
  function need(p) { return Promise.resolve(sp().require(CM + p)); }
  function library() {
    return Promise.all([need('lib/codemirror.js')].concat(SHEETS.map(function (p) {
      return need(p).then(null, function () { /* a sheet missing leaves the text plain */ });
    }))).then(function () { return window.CodeMirror; });
  }
  function modeFiles(mode) {
    return (FILES[modeName(mode)] || []).reduce(function (chain, p) {
      return chain.then(function () { return need(p).then(null, function () { /* a mode missing leaves the text uncoloured */ }); });
    }, Promise.resolve());
  }

  function create(host, options) {
    var o = options || {};
    var editing = o.mode === 'edit';
    var mode = modeOf(o.path);
    return library().then(function (CodeMirror) {
      return modeFiles(mode).then(function () { return CodeMirror; });
    }).then(function (CodeMirror) {
      var cm = CodeMirror(host, {
        value: String(o.text == null ? '' : o.text),
        readOnly: !editing,
        lineNumbers: true,
        lineWrapping: true,
        mode: mode,
        theme: 'material-darker',
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
      return { mode: editing ? 'edit' : 'read', cm: cm, value: function () { return cm.getValue(); }, mark: mark };
    });
  }

  E.codeMirror = { create: create };
}());
