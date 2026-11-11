'use strict';
// spirit/run/spirit/app/testicle/element.js
// TESTICLE'S FIRST-CUT FACE (goal/G45.1). testicle is the test app (goal/G45): a robot that keeps the product tree's test
// status. Its server is ./testicle.js; this face shows its rows. Its contract and its test:
// ./test/element.md and ./test/element.js.
//
// The box: "a first-cut face of testicle: a workBench with one 📁 icon, its file viewer showing production *.js files
// only", "testicle's face calls no verbs in this round: it shows a file pane in the leftmost workBench pane, and nothing
// else", "The file viewer is the existing file list with a filter for production *.js files: no new list."
//
//   spirit.element.spirit.app.testicle.element.create(container, options) -> { destroy() }
//
// The left pane's file list draws the fs family's mirror of the tree, which the list loads.
//
// THE FILE DETAIL (goal/G47.1, the UI cycle). The box: "When a user clicks on a production file in the left pane of the
// production file list", "A new tab is opened and activated in the center pane's tabContainer: the file detail", "The tab
// header shows the production file name without path", "The detail shows as title row the full file name, and below it a
// standard testicle.suite.search", "All tabs are closable", "The tab opens first, with its title line; then file.get runs,
// and below the title line it shows either the error file.get gives (\"not a production script\", \"no such file\") or the
// suite search for that file". A tab is named by the file's full path, so a second click on it makes its tab active and opens
// no second (spirit/element/tabContainer.js add). It asks the node through spirit alone: testicle's branch, bound by its
// api.js.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the workBench and the file list.
  var parts = Promise.all(['spirit/element/workBench.js', 'spirit/element/search/file.js', 'spirit/element/tabContainer.js',
    'spirit/element/search/suite.js', 'spirit/app/testicle/api.js'].map(function (p) { return window.spirit.require(p); }));

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ONE FILE'S DETAIL, in its tab's box: the title row, the full name; below it, once file.get has answered, its error or the
  // file's suite search.
  function fileDetail(box, file) {
    var gone = false;
    var made = null;
    box.innerHTML = '<div class="testicle-detail fill"><div class="testicle-title">' + esc(file) + '</div><div class="testicle-below fill"></div></div>';
    var below = box.querySelector('.testicle-below');
    Promise.resolve(window.spirit.testicle['file.get']({ name: file })).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.suite.create(below, { file: file });
    }, function (e) {
      if (gone) return;
      below.textContent = String((e && e.message) || e || 'file.get failed');
    });
    return {
      destroy: function () {
        gone = true;
        if (made && typeof made.destroy === 'function') made.destroy();
        made = null;
        box.innerHTML = '';
      },
    };
  }

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
    var tabs = null;
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element.spirit.element;
      bench = E.workBench.create(container, {
        // One tool, the files, on the left strip, shown at start; no right strip.
        left: [{ name: 'files', icon: '📁', title: 'Production scripts', mount: function (box) {
          box.className = 'fill';
          // goal/G47.1, the box: "testicle turns flat on.": the scripts, by path, no folders.
          list = E.search.file.create(box, { face: 'pane', accept: production, flat: true, pick: function (row, key) { if (key) open(String(key)); } });
        } }],
        right: [],
      });
      // The centre: the file details, one tab each.
      tabs = E.tabContainer.create(bench.center, { tabs: [] });
    }, function () { if (!gone) container.textContent = 'testicle could not be loaded.'; });
    // A CLICK ON A PRODUCTION FILE: its tab opened and made active, at once; its detail asks file.get from there.
    function open(file) {
      if (gone || !tabs) return;
      tabs.add({ name: file, label: file.slice(file.lastIndexOf('/') + 1), closable: true, mount: function (box) { return fileDetail(box, file); } });
    }
    return {
      destroy: function () {
        gone = true;
        if (list && typeof list.destroy === 'function') list.destroy();
        list = null;
        if (tabs && typeof tabs.destroy === 'function') tabs.destroy();
        tabs = null;
        if (bench && typeof bench.destroy === 'function') bench.destroy();
        bench = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/testicle/element.js', { create: create }); });
}());
