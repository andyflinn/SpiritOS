'use strict';
// spirit/run/spirit/element/search/suite/listElement.js
// THE SUITE LIST, AN ELEMENT (goal/G47.1, the UI cycle): the suites of one production file, what testicle's file detail
// draws through the suite selector (../suite.js). Its row is ./rowElement.js; no row opens a detail.
//
//   spirit.element.spirit.element.search.suite.listElement.create(container, { script, face, placeholder, all, pick }) -> { destroy() }
//     script   the production script whose suite rows it lists, scoped to run://; '' for every suite, each once (goal/G47.1,
//              the box: "with the script selector blank (all scripts), the suite selector lists every suite, each once")
//     face, placeholder, all, pick   handed to the search as they are: the testicle search's suite selector draws it as a
//              dropdown (goal/G47.1, the search cycle, the box: "The search has a suite selector, unselected (all) the
//              default"); a pane, the default, otherwise
//
// The box: "a standard testicle.suite.search", "The file row owns its suite rows: the suite table's key is file and suite.
// So suite.search takes the production file and answers that file's suite rows only, each suite once, with its filename
// and its status; the words narrow among them", "The UI must listen to changes on all tables it interacts with, and the
// server, of course, publishes changes".
//
// A VIEW OF testicle's SUITE ROWS IN spirit.data (goal/G41.28): the probability search over the suite branch testicle's
// cache manager keeps (spirit.data.testicle.data, spirit/app/testicle/data.js), only the given file's rows, by a filter
// not drawn. The server publishes every row it writes, so a suite written for the file shows by itself. What the branch
// does not hold yet is asked once, of testicle.suite.search with no words, and kept there; words ask it again.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list and its row, testicle's interface and its cache manager.
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/search/suite/rowElement.js', 'spirit/app/testicle/api.js']
    .map(function (p) { return S.require(p); }).concat([S.cacheManager('testicle')]));

  function rowsOf(body) {
    return ((body && body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  }

  function create(container, options) {
    var o = options || {};
    var script = String(o.script || '');
    var gone = false;
    var list = null;
    container.innerHTML = '<div data-suites="list" class="fill"></div>';

    parts.then(function () {
      if (gone) return;
      var data = S.data.testicle.data;
      var ask = function (text) {
        return Promise.resolve(S.testicle['suite.search']({ script: script, text: String(text || '') })).then(function (b) {
          data.keep('suite', rowsOf(b));
          return b;
        });
      };
      list = S.element.spirit.element.search.create(container.firstElementChild, {
        data: data.branch('suite'),
        // ITS OWN DATA SOURCE (goal/G43.24: the search is handed no api): testicle.suite.search for this file.
        search: function (args) {
          return ask((args && args.text) || '').then(function (b) { return { status: 200, body: { items: (b && b.items) || [], more: !!(b && b.more) } }; });
        },
        server: 'testicle',
        verb: 'suite.search',
        args: function (text) { return { script: script, text: text }; },
        columns: [
          // goal/G47.1, the run cycle: the 🏃‍♂️ column first, no sort.
          { field: 'run', label: '🏃‍♂️' },
          { field: 'suite', label: 'Suite', sort: 'text' },
          { field: 'status', label: 'Status', sort: 'text' },
        ],
        // THE FILE'S ROWS ONLY, not drawn: the branch holds every file's suites. A suite gone from disc, its row streamed
        // deleted, leaves the list by itself (goal/G47.1, the box: "Every element of testicle's face updates itself in
        // response to the server stream").
        filters: [{ name: 'script', when: function () { return false; }, test: function (row) { return row && row.script === script && !row.deleted ? 1 : 0; } }],
        element: function (row) { return S.element.spirit.element.search.suite.rowElement.create(row); },
        face: o.face,
        placeholder: o.placeholder,
        all: o.all,
        name: function (row) { return String((row && row.suite) || ''); },
        pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
        // No script, every suite (goal/G47.1, the box: "The testicle search can search by a suite alone").
        empty: script ? 'No suite concerns this file.' : 'No suite yet.',
      });
      list.sort('suite', 'asc');
      // What the branch does not hold yet: the file's rows, asked once.
      ask('').then(null, function () { /* the list says it is empty */ });
    }, function () { container.textContent = 'The suites could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        if (list && typeof list.destroy === 'function') list.destroy();
        list = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/suite/listElement.js', { create: create }); });
}());
