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
//
// THE TESTICLE SEARCH (goal/G47.1, the search cycle). The box: "The UI gets its first non-closable tab in the workbench centre
// pane: the testicle search, spirit/element/search/testicle.js", "The testicle detail is a history of flips, and opens in a
// closable tab when a test row is clicked", "the tab is the tabContainer's, closable false, first in the centre, before any
// script's tab; the script tabs stay closable". A test's tab is named by its full key without the flip, so a second click on
// the same test makes its tab active and opens no second.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the workBench and the file list.
  var parts = Promise.all(['spirit/element/workBench.js', 'spirit/element/search/app/rowFormToggle.js', 'spirit/element/search/file.js', 'spirit/element/tabContainer.js',
    'spirit/element/search/suite.js', 'spirit/element/search/testicle.js', 'spirit/element/search/testicle/detailElement.js',
    'spirit/app/testicle/api.js',
    // ITS OWN PARTS, EACH AN ELEMENT (goal/G47.1, box v134-135: "element.js keeps only the face: it mounts those elements and the
    // searches, nothing drawn of its own").
    'spirit/app/testicle/element/scriptDetail.js', 'spirit/app/testicle/element/statusBox.js', 'spirit/app/testicle/element/settingsPanel.js'].map(function (p) { return window.spirit.require(p); }));
  // A NODE WITH NO TESTICLE refuses its interface: create says testicle could not be loaded; the refusal is never left
  // unhandled.
  parts.catch(function () {});

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
    var monitor = null;
    var config = null;
    container.innerHTML = '<div class="testicle-face" style="display:flex;flex-direction:column;height:100%;overflow:hidden">' +
      '<div class="testicle-monitor" style="flex:none;overflow:hidden"></div>' +
      '<div class="testicle-bench" style="flex:1;min-height:0;position:relative"></div></div>';
    var benchBox = container.querySelector('.testicle-bench');
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element.spirit.element;
      var T = window.spirit.element.spirit.app.testicle.element;
      monitor = T.statusBox.create(container.querySelector('.testicle-monitor'));
      bench = E.workBench.create(benchBox, {
        // The left strip: the files, shown at start, then the configuration (box v79, 2); no right strip.
        left: [{ name: 'files', icon: '📁', title: 'Production scripts', mount: function (box) {
          box.className = 'fill';
          // goal/G47.1, the box: "testicle turns flat on.": the scripts, by path, no folders.
          list = E.search.file.create(box, { face: 'pane', accept: production, flat: true, pick: function (row, key) { if (key) open(String(key)); } });
        } }, { name: 'configuration', icon: '⚙', title: '⚙ Configuration', mount: function (box) { config = T.settingsPanel.create(box); } }],
        right: [],
      });
      // The centre: the testicle search first, never closed; then the file details and the test details, one tab each.
      tabs = E.tabContainer.create(bench.center, { tabs: [{ name: 'testicle search', label: 'Testicle search', closable: false,
        mount: function (box) { box.className = 'fill'; return E.search.testicle.create(box, { pick: function (row) { openTest(row); } }); } }] });
    }, function () { if (!gone) container.textContent = 'testicle could not be loaded.'; });
    // A CLICK ON A PRODUCTION FILE: its tab opened and made active, at once; its detail asks script.get from there.
    function open(file) {
      if (gone || !tabs) return;
      tabs.add({ name: file, label: file.slice(file.lastIndexOf('/') + 1), closable: true, mount: function (box) { return window.spirit.element.spirit.app.testicle.element.scriptDetail.create(box, { script: file }); } });
    }
    // A CLICK ON A TEST ROW: its history in a closable tab, opened and made active.
    function openTest(row) {
      if (gone || !tabs || !row) return;
      var name = row.script + '|' + row.suite + '|' + row.test;
      tabs.add({ name: name, label: String(row.test || ''), closable: true, mount: function (box) {
        box.className = 'fill';
        return window.spirit.element.spirit.element.search.testicle.detailElement.create(box, { script: row.script, suite: row.suite, test: row.test });
      } });
    }
    return {
      destroy: function () {
        gone = true;
        if (monitor) monitor.destroy();
        monitor = null;
        if (config) config.destroy();
        config = null;
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
