'use strict';
// spirit/run/spirit/element/search/file/detail.js
// ONE FILE, ITS DETAIL (goal/G43.32, the box: "every branch's search is search/<branch>.js, the selector, and its folder
// holds list.js, row.js and detail.js"): the file's info, drawn by fstat (spirit/element/fstat.js;
// Andy: "fstat is a file-info viewer"), which it loads itself (rule/26). The Files app opens it for a file neither of its
// openers takes (Andy: "let fstat pop up for unknows file types (❔) only"). Its test: ./test/detail.js.
//
//   spirit.required.spirit.element.search.file.detail.create(host, { path }) -> { destroy() }
//     path   the file's path on the home node; fstat shows its MIME type at once, then its size, changed and created
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var parts = Promise.resolve(keepAnswer('spirit/element/fstat.js'));
  function create(host, opts) {
    var gone = false;
    var path = String((opts && opts.path) || '');
    // IT SCROLLS ITS OWN BODY under the panel's title bar, which stays (Q21, Andy: the panel itself scrolling is "the wrong
    // spot, any content then would have a hard time making its toolbar stick to the top"): fstat's frame, here alone, scrolls;
    // fstat itself, shared with the viewers, is left as it is.
    parts.then(function () {
      if (gone) return;
      ANSWER['spirit/element/fstat.js'].create(host, { path: path });
      var frame = host.firstElementChild;
      if (frame && frame.style) frame.style.overflow = 'auto';
    });
    // Destroy leaves its host empty, as every element.
    return { destroy: function () { gone = true; host.innerHTML = ''; } };
  }
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
