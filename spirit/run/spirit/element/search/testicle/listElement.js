'use strict';
// spirit/run/spirit/element/search/testicle/listElement.js
// THE TESTICLE LIST, AN ELEMENT (goal/G47.1, the search cycle): every current test row of testicle's test table, what the
// testicle search (../testicle.js) draws in the first, non-closable tab of testicle's face. Its row is ./rowElement.js; a
// row clicked is handed to pick, and testicle's face opens its detail (./detailElement.js) in a closable tab.
//
//   spirit.element.spirit.element.search.testicle.listElement.create(container, { pick }) -> { destroy() }
//
// The box: "The search has a script selector, unselected (all) the default", "The script selector: the file search as a
// dropdown, production scripts only", "The search has a suite selector, unselected (all) the default", "suite.search keeps
// needing a script, and the suite selector of the testicle search waits until a script is chosen: with all scripts, there
// is no suite to choose", "The search has two filters, red and green; at least one of the two is selected at all times:
// the only combination forbidden is both off", "The list is sortable by all its columns", "The columns, in this order: the
// result first, as an icon, ❌ for a failure, ✅ for a success; severity second; the title third; then the script name (no
// path), then the suite name (no path)".
//
// A VIEW OF testicle's TEST ROWS IN spirit.data (goal/G41.28): the probability search over the testicle branch testicle's
// cache manager keeps (spirit.data.testicle.data, spirit/app/testicle/data.js), its current rows only, by a filter not
// drawn: the branch keeps a flipped test's replaced row beside its current one. The server publishes every row it writes,
// so a test set anywhere shows by itself. What the branch does not hold yet is asked once, of testicle.testicle.search with
// no words, and kept there; words ask it again. The selectors narrow on the page; the search is asked for every script.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list and its row, the two selectors, testicle's interface and its cache manager.
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/search/testicle/rowElement.js', 'spirit/element/search/file.js',
    'spirit/element/search/suite.js', 'spirit/app/testicle/api.js'].map(function (p) { return S.require(p); }).concat([S.cacheManager('testicle')]));

  function rowsOf(body) {
    return ((body && body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  }
  // A PRODUCTION SCRIPT: a .js outside any test/ folder, as testicle's left pane lists them (spirit/app/testicle/element.js).
  function production(row) {
    var p = String((row && row.path) || '');
    return /\.js$/.test(p) && !/(^|\/)test\//.test(p);
  }
  function changed(el) { el.dispatchEvent(new Event('change', { bubbles: true })); }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var list = null;
    var scriptList = null;
    var suiteList = null;
    container.innerHTML = '<div data-tests="list" class="fill"></div>';
    // THE TWO SELECTORS, mounted in the search's 🪣 row: each holds what is chosen as its value, '' for all.
    var scriptSel = document.createElement('span');
    scriptSel.className = 'testicle-script-selector';
    scriptSel.value = '';
    var suiteSel = document.createElement('span');
    suiteSel.className = 'testicle-suite-selector';
    suiteSel.value = '';

    // The suite selector follows the script chosen: a dropdown of that script's suites; with all scripts, the same dropdown
    // with no suite to choose (suite.search answers none for no script).
    function drawSuites() {
      if (suiteList && typeof suiteList.destroy === 'function') suiteList.destroy();
      suiteList = null;
      suiteSel.innerHTML = '';
      suiteSel.value = '';
      suiteList = S.element.spirit.element.search.suite.create(suiteSel, {
        script: scriptSel.value, face: 'dropdown', placeholder: 'all suites', all: 'all suites',
        pick: function (row) { suiteSel.value = row && row.suite ? String(row.suite) : ''; changed(suiteSel); },
      });
    }

    parts.then(function () {
      if (gone) return;
      var data = S.data.testicle.data;
      var ask = function (text) {
        return Promise.resolve(S.testicle['testicle.search']({ text: String(text || '') })).then(function (b) {
          data.keep('testicle', rowsOf(b));
          return b;
        });
      };
      scriptList = S.element.spirit.element.search.file.create(scriptSel, {
        face: 'dropdown', accept: production, flat: true, placeholder: 'all scripts', all: 'all scripts',
        pick: function (row, key) { scriptSel.value = row && key ? String(key) : ''; drawSuites(); changed(scriptSel); },
      });
      drawSuites();
      list = S.element.spirit.element.search.create(container.firstElementChild, {
        data: data.branch('testicle'),
        // ITS OWN DATA SOURCE (goal/G43.24: the search is handed no api): testicle.testicle.search, every script.
        search: function (args) {
          return ask((args && args.text) || '').then(function (b) { return { status: 200, body: { items: (b && b.items) || [], more: !!(b && b.more) } }; });
        },
        server: 'testicle',
        verb: 'testicle.search',
        args: function (text) { return { text: text }; },
        columns: [
          { field: 'verified', label: 'Result', sort: 'number' },
          { field: 'severity', label: 'Severity', sort: 'number' },
          { field: 'test', label: 'Title', sort: 'text' },
          // By the name shown, no path (data.js keeps it on the row).
          { field: 'script', from: 'scriptName', label: 'Script', sort: 'text' },
          { field: 'suite', from: 'suiteName', label: 'Suite', sort: 'text' },
        ],
        filters: [
          // THE CURRENT ROWS ONLY, not drawn: the branch keeps a flipped test's replaced row too.
          { name: 'current', when: function () { return false; }, test: function (row) { return row && row.current === true ? 1 : 0; } },
          // RED AND GREEN, both on at the start; one always stays on.
          { name: 'result', multi: true, keepOne: true,
            choices: [{ value: 'red', icon: '❌', word: 'red' }, { value: 'green', icon: '✅', word: 'green' }],
            test: function (row, off) { var o2 = off || {}; return row && (row.verified ? !o2.green : !o2.red) ? 1 : 0; } },
        ],
        selectors: [
          { name: 'script', element: scriptSel, test: function (row) { return !scriptSel.value || (row && row.script === scriptSel.value) ? 1 : 0; } },
          { name: 'suite', element: suiteSel, test: function (row) { return !suiteSel.value || (row && row.suite === suiteSel.value) ? 1 : 0; } },
        ],
        element: function (row) { return S.element.spirit.element.search.testicle.rowElement.create(row); },
        pick: function (row, key) { if (row && typeof o.pick === 'function') o.pick(row, key); },
        empty: 'No test matches.',
      });
      // What the branch does not hold yet: every current row, asked once.
      ask('').then(null, function () { /* the list says it is empty */ });
    }, function () { container.textContent = 'The tests could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        [list, scriptList, suiteList].forEach(function (x) { if (x && typeof x.destroy === 'function') x.destroy(); });
        list = scriptList = suiteList = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/testicle/listElement.js', { create: create }); });
}());
