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
  var parts = Promise.all(['spirit/element/workBench.js', 'spirit/element/rowForm.js', 'spirit/element/search/file.js', 'spirit/element/tabContainer.js',
    'spirit/element/search/suite.js', 'spirit/element/search/testicle.js', 'spirit/element/search/testicle/detailElement.js',
    'spirit/app/testicle/api.js'].map(function (p) { return window.spirit.require(p); }));
  // A NODE WITH NO TESTICLE refuses its interface: create says testicle could not be loaded; the refusal is never left
  // unhandled.
  parts.catch(function () {});

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ONE FILE'S DETAIL, in its tab's box: the title row, the full name; below it, once script.get has answered, its error or the
  // file's suite search.
  function fileDetail(box, file) {
    var gone = false;
    var made = null;
    var release = null;
    box.innerHTML = '<div class="testicle-detail fill"><div class="testicle-title">' + esc(file) + '</div>' +
      '<div class="testicle-own-missing" style="color:#c00"></div><div class="testicle-below fill"></div></div>';
    var below = box.querySelector('.testicle-below');
    // THE OWN TEST, IN RED WHEN MISSING (goal/G47.1, the box: "A script tab shows, right under its title line, the name of
    // the script's own test in red when that test is missing on disc: the folder test/ beside the script, the same file
    // name", "When the own test is there, nothing shows in that place", "once the test file is written, the red name goes by
    // itself"). Read from the fs family's mirror of the tree, and only once the tree is whole: before that, missing is unknown.
    var own = file.slice(0, file.lastIndexOf('/') + 1) + 'test/' + file.slice(file.lastIndexOf('/') + 1);
    var ownLine = box.querySelector('.testicle-own-missing');
    function drawOwn() {
      var F = window.spirit.data && window.spirit.data.fs && window.spirit.data.fs.data;
      if (gone || !F) return;
      ownLine.textContent = F.ready() && !F.file(own) ? own : '';
    }
    Promise.resolve(window.spirit.cacheManager('fs')).then(function () {
      if (gone) return;
      drawOwn();
      release = window.spirit.data.fs.data.watch(function (p) { if (!p || p === own) drawOwn(); });
    });
    Promise.resolve(window.spirit.testicle['script.get']({ name: file })).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.suite.create(below, { script: file });
    }, function (e) {
      if (gone) return;
      below.textContent = String((e && e.message) || e || 'script.get failed');
    });
    return {
      destroy: function () {
        gone = true;
        if (typeof release === 'function') release();
        release = null;
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

  // THE MONITOR ROW (goal/G47.1, the box: "testicle's face has a monitor row above the workbench. It shows first the busy
  // status in icon form, 🛌 idle (sleeping), 🚶‍➡️ working, as the server streams it ...; then the last change: a row added,
  // deleted or updated in any of its three tables", "The row has a constant height, and the message is ellipsed, never
  // wrapped"). It draws what testicle's cache manager keeps of the stream (data.js, monitor), and asks the server nothing.
  function lastWords(last) {
    if (!last || !last.key) return '';
    // A test row's key ends in its flip, which says nothing to a reader: left off.
    var what = last.table === 'testicle' ? String(last.key).split('|').slice(0, 3).join(' | ') : String(last.key).split('|').join(' | ');
    return String(last.change || 'updated') + ' ' + last.table + ': ' + what;
  }
  function monitorRow(row) {
    row.innerHTML = '<span class="testicle-busy" style="flex:none;margin-right:.5em"></span><span class="testicle-last" style="flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></span>';
    var icon = row.firstChild;
    var line = row.lastChild;
    var release = null;
    var shown = null;
    function draw(m) {
      var busy = !!(m && m.busy);
      var glyph = busy ? '🚶‍➡️' : '🛌';
      // Through the icon element, as every pictograph is drawn (spirit/element/icon.js; the general rules).
      var I = window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.element.icon;
      if (glyph !== shown && I) { icon.innerHTML = ''; I.create(icon, { glyph: glyph }); shown = glyph; }
      icon.title = busy ? 'working' : 'idle';
      var words = lastWords(m && m.last);
      line.textContent = words;
      line.title = words;
    }
    Promise.all([window.spirit.require('spirit/element/icon.js'), window.spirit.cacheManager('testicle')]).then(function () {
      if (release === false) return;
      var M = window.spirit.data.testicle.data.monitor;
      draw(M.get());
      release = M.watch(draw);
    });
    return { destroy: function () { if (typeof release === 'function') release(); release = false; } };
  }

  // THE CONFIGURATION PANEL (goal/G47.1, box v79, 2): "a new left-strip-icon in the UI: ⚙", "the second icon below the
  // existing one", "this icon will open a panel in the left workbech pane, titled: \"⚙ Configuration\"", "the one switch it
  // maintains in a rowForm is: interactive | auto where the default will be \"interactive\"". The switch is the preference
  // interactive (box v79, 4): asked of the preferences verb once, then followed in testicle's branch, which the stream
  // keeps; Save sends the choice, and what a press did, a refusal, is said below the form.
  function configPanel(box) {
    var gone = false;
    var release = null;
    box.innerHTML = '<div class="testicle-config"><div class="testicle-title">⚙ Configuration</div><div class="testicle-config-form"></div>' +
      '<div class="testicle-config-said"></div></div>';
    var said = box.querySelector('.testicle-config-said');
    var form = window.spirit.element.spirit.element.rowForm.create(box.querySelector('.testicle-config-form'), { icon: '⚙', button: 'Save' });
    var mode = document.createElement('select');
    mode.className = 'testicle-mode';
    mode.innerHTML = '<option value="interactive">interactive</option><option value="auto">auto</option>';
    form.span.appendChild(mode);
    function draw(p) {
      if (gone || !p || typeof p.interactive !== 'boolean') return;
      mode.value = p.interactive ? 'interactive' : 'auto';
    }
    form.button.addEventListener('click', function () {
      if (gone) return;
      form.button.disabled = true;
      said.textContent = '';
      Promise.resolve(window.spirit.testicle.preferences({ interactive: mode.value === 'interactive' })).then(function (p) {
        if (gone) return;
        window.spirit.data.testicle.data.preferences.keep(p);
      }, function (e) {
        if (!gone) said.textContent = String((e && e.message) || e || 'preferences failed');
      }).then(function () { if (!gone) form.button.disabled = false; });
    });
    Promise.resolve(window.spirit.cacheManager('testicle')).then(function () {
      if (gone) return;
      var P = window.spirit.data.testicle.data.preferences;
      draw(P.get());
      release = P.watch(draw);
      return Promise.resolve(window.spirit.testicle.preferences({})).then(function (p) { if (!gone) P.keep(p); });
    }).then(null, function (e) { if (!gone) said.textContent = String((e && e.message) || e || 'preferences failed'); });
    return {
      destroy: function () {
        gone = true;
        if (typeof release === 'function') release();
        release = null;
        box.innerHTML = '';
      },
    };
  }

  function create(container) {
    var gone = false;
    var bench = null;
    var list = null;
    var tabs = null;
    var monitor = null;
    var config = null;
    container.innerHTML = '<div class="testicle-face" style="display:flex;flex-direction:column;height:100%">' +
      '<div class="testicle-monitor" style="flex:none;display:flex;align-items:center;height:1.8em;line-height:1.8em;padding:0 .5em;overflow:hidden"></div>' +
      '<div class="testicle-bench" style="flex:1;min-height:0;position:relative"></div></div>';
    var benchBox = container.querySelector('.testicle-bench');
    monitor = monitorRow(container.querySelector('.testicle-monitor'));
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element.spirit.element;
      bench = E.workBench.create(benchBox, {
        // The left strip: the files, shown at start, then the configuration (box v79, 2); no right strip.
        left: [{ name: 'files', icon: '📁', title: 'Production scripts', mount: function (box) {
          box.className = 'fill';
          // goal/G47.1, the box: "testicle turns flat on.": the scripts, by path, no folders.
          list = E.search.file.create(box, { face: 'pane', accept: production, flat: true, pick: function (row, key) { if (key) open(String(key)); } });
        } }, { name: 'configuration', icon: '⚙', title: '⚙ Configuration', mount: function (box) { config = configPanel(box); } }],
        right: [],
      });
      // The centre: the testicle search first, never closed; then the file details and the test details, one tab each.
      tabs = E.tabContainer.create(bench.center, { tabs: [{ name: 'testicle search', label: 'Testicle search', closable: false,
        mount: function (box) { box.className = 'fill'; return E.search.testicle.create(box, { pick: function (row) { openTest(row); } }); } }] });
    }, function () { if (!gone) container.textContent = 'testicle could not be loaded.'; });
    // A CLICK ON A PRODUCTION FILE: its tab opened and made active, at once; its detail asks script.get from there.
    function open(file) {
      if (gone || !tabs) return;
      tabs.add({ name: file, label: file.slice(file.lastIndexOf('/') + 1), closable: true, mount: function (box) { return fileDetail(box, file); } });
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
