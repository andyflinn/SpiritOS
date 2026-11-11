'use strict';
// spirit/run/spirit/app/testicle/element.js
// TESTICLE'S FIRST-CUT FACE (goal/G45.1). testicle is the test app (goal/G45): a robot that keeps the product tree's test
// status. Its server, its watch and its database come later; this round it is a face alone. Its contract and its test:
// ./test/element.md and ./test/element.js.
//
// The box: "a first-cut face of testicle: a workBench with one 📁 icon, its file viewer showing production *.js files
// only", "testicle's face calls no verbs in this round: it shows a file pane in the leftmost workBench pane, and nothing
// else", "The file viewer is the existing file list with a filter for production *.js files: no new list."
//
//   spirit.element.spirit.app.testicle.element.create(container, options) -> { destroy() }
//
// It asks the node nothing itself: the file list draws the fs family's mirror of the tree, which the list loads.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the workBench and the file list.
  var parts = Promise.all(['spirit/element/workBench.js', 'spirit/element/search/file.js'].map(function (p) { return window.spirit.require(p); }));

  // A PRODUCTION SCRIPT: a .js outside any test/ folder. Vendored libraries' scripts never reach the list: the fs
  // family's mirror holds none of them (spirit/fileSystem.js, VENDORED_FOLDERS).
  function production(row) {
    var p = String((row && row.path) || '');
    return /\.js$/.test(p) && !/(^|\/)test\//.test(p);
  }

  function create(container) {
    var gone = false;
    var bench = null;
    var list = null;
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element.spirit.element;
      bench = E.workBench.create(container, {
        // One tool, the files, on the left strip, shown at start; no right strip.
        left: [{ name: 'files', icon: '📁', title: 'Production scripts', mount: function (box) {
          box.className = 'fill';
          list = E.search.file.create(box, { face: 'pane', accept: production });
        } }],
        right: [],
      });
    }, function () { if (!gone) container.textContent = 'testicle could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (list && typeof list.destroy === 'function') list.destroy();
        list = null;
        if (bench && typeof bench.destroy === 'function') bench.destroy();
        bench = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/testicle/element.js', { create: create }); });
}());
