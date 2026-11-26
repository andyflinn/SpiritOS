'use strict';
// spirit/run/spirit/app/testicle/element/search/testicle/list.js
// THE TESTICLE LIST, AN ELEMENT (goal/G47.1, the search cycle): every current test row of testicle's test table, what the
// testicle search (../testicle.js) draws in the first, non-closable tab of testicle's face. Its row is ./row.js; a
// row clicked is handed to pick, and testicle's face opens its detail (./detail.js) in a closable tab.
//
//   spirit.required.spirit.app.testicle.element.search.testicle.list.create(container, { pick }) -> { destroy() }
//
// The box: "The search has a script selector, unselected (all) the default", "The script selector: the file search as a
// dropdown, production scripts only", "The search has a suite selector, unselected (all) the default", "The testicle
// search can search by a suite alone: with the script selector blank (all scripts), the suite selector lists every suite,
// each once", "The search has two filters, red and green; at least one of the two is selected at all times:
// the only combination forbidden is both off", "The list is sortable by all its columns", "The columns, in this order: the
// result first, as an icon, ❌ for a failure, ✅ for a success; severity second; the title third; then the script name (no
// path), then the suite name (no path)".
//
// A VIEW OF testicle's TEST ROWS IN spirit.required.spirit.data (goal/G41.28): the probability search over the testicle branch testicle's
// cache manager keeps (spirit.required.spirit.data['spirit.app.testicle'].data, spirit/app/testicle/data.js), its current rows only, by a filter not
// drawn: the branch keeps a flipped test's replaced row beside its current one. The server publishes every row it writes,
// so a test set anywhere shows by itself. What the branch does not hold yet is asked of testicle.testicle.search, the reds
// first, and kept there; words, a filter or a selector ask it again, sent with what is chosen, so the server narrows before
// it cuts; answer after answer while it says more, up to 100 tests. The page narrows the branch by the same choices.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/app/testicle/element/search/suite.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/file/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/app/testicle/words.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/app/testicle/element/search/testicle/row.js');
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list and its row, the two selectors, testicle's interface and its cache manager.
  var parts = Promise.all(['spirit/element/search/script.js', 'spirit/app/testicle/element/search/testicle/row.js', 'spirit/element/search/file/script.js',
    'spirit/app/testicle/element/search/suite.js', 'spirit/app/testicle/api.js', 'spirit/app/testicle/words.js'].map(function (p) { return S.requireScript(p); }).concat([keepAnswer('spirit/app/testicle/api.js')]));
  // A NODE WITH NO TESTICLE refuses its interface: create says the tests could not be loaded; the refusal is never left unhandled.
  parts.catch(function () {});

  function rowsOf(body) {
    return ((body && body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  }
  // A PRODUCTION SCRIPT: a .js outside any test/ folder, as testicle's left pane lists them (spirit/app/testicle/element.js).
  function production(row) {
    var p = String((row && row.path) || '');
    return /\.js$/.test(p) && !/(^|\/)test\//.test(p);
  }
  // THE MOST A SEARCH ASKS FOR, answer after answer (goal/G47.1, the box: "up to 100 tests").
  var HELD_MAX = 100;
  function changed(el) { el.dispatchEvent(new Event('change', { bubbles: true })); }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var list = null;
    var scriptList = null;
    var suiteList = null;
    container.innerHTML = '<div data-tests="list" class="fill" style="overflow:hidden"></div>';
    // THE TWO SELECTORS, mounted in the search's 🪣 row: each holds what is chosen as its value, '' for all.
    var scriptSel = document.createElement('span');
    scriptSel.className = 'testicle-script-selector';
    scriptSel.value = '';
    var suiteSel = document.createElement('span');
    suiteSel.className = 'testicle-suite-selector';
    suiteSel.value = '';

    // The suite selector follows the script chosen: a dropdown of that script's suites; with all scripts, every suite, each
    // once, and a suite chosen then shows its tests for every script (goal/G47.1, the box: "The testicle search can search by
    // a suite alone", in place of the search cycle's "with all scripts, there is no suite to choose").
    function drawSuites() {
      if (suiteList && typeof suiteList.destroy === 'function') suiteList.destroy();
      suiteList = null;
      suiteSel.innerHTML = '';
      suiteSel.value = '';
      suiteList = ANSWER['spirit/app/testicle/element/search/suite.js'].create(suiteSel, {
        script: scriptSel.value, face: 'dropdown', placeholder: 'all suites', all: 'all suites',
        pick: function (row) { suiteSel.value = row && row.suite ? String(row.suite) : ''; changed(suiteSel); },
      });
    }

    parts.then(function () {
      if (gone) return;
      var data = S.required.spirit.data['spirit.app.testicle'].data;
      // WHAT IS CHOSEN GOES TO THE SERVER (goal/G47.1, the box: "Red, green, the script and the suite go to the server with
      // the words, so the server narrows before it cuts an answer", "the page asks for the following answers while the
      // server says there are more, up to 100 tests"): one answer holds about 12 tests.
      var argsOf = function (text, values) {
        var a = { text: String(text || '') };
        var off = (values && values.result) || {};
        if (off.red && !off.green) a.result = 'green';
        if (off.green && !off.red) a.result = 'red';
        if (scriptSel.value) a.script = String(scriptSel.value);
        if (suiteSel.value) a.suite = String(suiteSel.value);
        return a;
      };
      // One ask, one answer (Andy: no paging): what fits, more saying the search can be narrowed.
      var ask = function (args) {
        return Promise.resolve(ANSWER['spirit/app/testicle/api.js']['testicle.search'](Object.assign({}, args))).then(function (b) {
          data.keep('testicle', rowsOf(b));
          return { items: (b && b.items) || [], more: !!(b && b.more) };
        });
      };
      scriptList = ANSWER['spirit/element/search/file/script.js'].create(scriptSel, {
        face: 'dropdown', accept: production, flat: true, placeholder: 'all scripts', all: 'all scripts',
        pick: function (row, key) { scriptSel.value = row && key ? String(key) : ''; drawSuites(); changed(scriptSel); },
      });
      drawSuites();
      list = ANSWER['spirit/element/search/script.js'].create(container.firstElementChild, {
        data: data.branch('testicle'),
        // ITS OWN DATA SOURCE (goal/G43.24: the search is handed no api): testicle.testicle.search, every script.
        search: function (args) {
          return ask(args || { text: '' }).then(function (b) { return { status: 200, body: { items: b.items, more: b.more } }; });
        },
        api: 'spirit/app/testicle/api.js',
        verb: 'testicle.search',
        args: argsOf,
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
          // RED AND GREEN, red alone on at the start; one always stays on. The default equals testicle.red (goal/G47.1, Andy:
          // "the default setting for testicle search should be EQUAL the the RED verb of testicle. ALL scripts, ALL suites,
          // reds only, most SERVERE FIRST DAMMIT.").
          { name: 'result', multi: true, keepOne: true, off: ['green'],
            choices: [{ value: 'red', icon: ANSWER['spirit/app/testicle/words.js'].result(false), word: 'red' }, { value: 'green', icon: ANSWER['spirit/app/testicle/words.js'].result(true), word: 'green' }],
            test: function (row, off) { var o2 = off || {}; return row && (row.verified ? !o2.green : !o2.red) ? 1 : 0; } },
        ],
        selectors: [
          { name: 'script', element: scriptSel, test: function (row) { return !scriptSel.value || (row && row.script === scriptSel.value) ? 1 : 0; } },
          { name: 'suite', element: suiteSel, test: function (row) { return !suiteSel.value || (row && row.suite === suiteSel.value) ? 1 : 0; } },
        ],
        // ITS ORDER IS testicle.red's, AND IT SHOWS UP TO 100 (goal/G47.1, Andy: "reds only, most SERVERE FIRST DAMMIT.", the
        // box: "up to 100 tests"): with no words and no column sorted, the reds first, then the most severe first; the branch
        // holds more than the answers did (each answer's rows, and every row the stream brings), so what is shown is cut there.
        order: function (a, b) { return (a.verified ? 1 : 0) - (b.verified ? 1 : 0) || Number(b.severity || 0) - Number(a.severity || 0); },
        most: HELD_MAX,
        element: function (row) { return ANSWER['spirit/app/testicle/element/search/testicle/row.js'].create(row); },
        pick: function (row, key) { if (row && typeof o.pick === 'function') o.pick(row, key); },
        empty: 'No test matches.',
      });
      // A SELECTOR CHANGED ASKS AGAIN (the box: "a change of any of them asks again"); a filter press already does.
      var again = function () { if (list && typeof list.refresh === 'function') list.refresh(); };
      scriptSel.addEventListener('change', again);
      suiteSel.addEventListener('change', again);
      // What the branch does not hold yet: the reds, asked at the start, as the filters start.
      ask({ text: '', result: 'red' }).then(null, function () { /* the list says it is empty */ });
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
