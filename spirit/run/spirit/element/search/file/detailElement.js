'use strict';
// spirit/run/spirit/element/search/file/detailElement.js
// ONE FILE, ITS DETAIL (goal/G43.32, the box: "every branch's search is search/<branch>.js, the selector, and its folder
// holds listElement.js, rowElement.js and detailElement.js"): the file's info, drawn by fstat (spirit/element/fstat.js;
// Andy: "fstat is a file-info viewer"), which it loads itself (rule/26). The Files app opens it for a file neither of its
// openers takes (Andy: "let fstat pop up for unknows file types (❔) only"). Its test: ./test/detailElement.js.
//
//   spirit.element.spirit.element.search.file.detailElement.create(host, { path }) -> { destroy() }
//     path   the file's path on the home node; fstat shows its MIME type at once, then its size, changed and created
(function () {
  var parts = Promise.resolve(window.spirit.require('spirit/element/fstat.js'));
  function create(host, opts) {
    var gone = false;
    var path = String((opts && opts.path) || '');
    parts.then(function () { if (!gone) window.spirit.element.spirit.element.fstat.create(host, { path: path }); });
    // Destroy leaves its host empty, as every element.
    return { destroy: function () { gone = true; host.innerHTML = ''; } };
  }
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/file/detailElement.js', { create: create }); });
}());
