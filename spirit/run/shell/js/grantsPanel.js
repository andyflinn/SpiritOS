// spirit/run/shell/js/grantsPanel.js
// THE GRANTS PANEL, A SHELL ELEMENT (goal/G41.16): grants of whichever ID table its caller hands it. Andy: "the shell app
// shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js, and shell/js/grantsPanel.js is
// configurable with an ID table", and "the callers (Grants and agent shell apps should boody well know how to configure
// the damn grantsPanel element". So it names no table: the Grants app hands it contacts and the node's grants, the agent
// app its jobs and its grants by job. Its contract and its test: ./test/grantsPanel.md and ./test/grantsPanel.js.
//
//   grantsPanel.create(host, { ids, grants, api }) -> { destroy() }
//     ids     the ID table, as the contact selector takes it (G41.13, Q2): { table, key, label }
//     grants  the grants table those IDs are granted in, as the grant list and row take it: { branch, key, label,
//             search(text), grant(id, path) -> { ok } or { ok: false, code, error }, revoke(id, path), stream(job) }
//     api     the app's shell api
//   Made without its ID table or its grants table, it is refused: it never falls back to one caller's setting.
//
// One panel: the one-row grant form, "grant" [ID selector] [bundle selector] [Grant] (goal/G41.13); below it the filter
// line, [ID filter] [family selector] [deprecated]; then the grant list (./grantSelector/listElement.js), the one box that
// fills (rule/16). Deprecated is a REPORT read from the node's api tree (a server is away or the verb is gone, and the
// grant waits for the owner, intact: suspend/repair, G1.4), following the stream, its filter off by default.
// A BUNDLE IS NOT GRANTED BY REFERENCE (G41.13, box v7): the node's bundles are the one dictionary both kinds of grant are
// made from, so the bundle's branches (auth.branch) are read here, and each becomes one grant through the grants table,
// family.verb or the family alone for (ALL), a path already granted counted done.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT USES, IT LOADS ITSELF (rule/26): through spirit.require, each element bringing its own.
  var parts = Promise.all(['shell/js/contactSelector.js', 'shell/js/bundleSelector.js', 'shell/js/apiFamilySelector.js',
    'shell/js/grantSelector/listElement.js'].map(function (p) { return window.spirit.require ? window.spirit.require(p) : null; }));

  function create(host, config) {
    var c = config || {};
    var ids = c.ids;
    var g = c.grants;
    if (!ids || !ids.table) throw new Error('grantsPanel: an ID table is required ({ table, key, label })');
    if (!g || !g.branch || !g.key || !g.label || typeof g.grant !== 'function' || typeof g.search !== 'function') {
      throw new Error('grantsPanel: a grants table is required ({ branch, key, label, search, grant, revoke, stream })');
    }
    var api = c.api;
    var tree = null;
    var list = null;          // the grant list
    var idSel = null;         // the grant form's ID selector
    var bundleSel = null;     // and its bundle selector
    var filterId = null;      // the list's filters: an ID, and a family with its verb (the family selector)
    var filterFamily = null;
    var said = '';            // what the panel says a press did
    var saidError = false;
    var showDeprecated = false;   // the deprecated filter's button, off by default
    var gone = false;
    function esc(text) { return api.escapeHtml(String(text == null ? '' : text)); }
    function refusal(body) { return (body && (body.error || body.code)) || 'refused'; }

    // The owner's api tree: what serves() judges against. Through the one spirit object, spirit.tree(), which answers on
    // the home node and on a face alike (goal/G41.14: asked as the verb 'api', the face's home path refused it, the tree
    // came back empty, and every grant read deprecated).
    function loadTree() {
      return Promise.resolve(window.spirit.tree()).then(function (t) {
        tree = t && typeof t === 'object' ? t : {};
        return tree;
      }, function () { tree = null; return tree; });
    }
    function serves(p) { return !tree || window.spirit.apiTreeIndex.serves(tree, p); }
    function redraw() { if (list) list.list.redraw(); }

    // THE LIST'S FILTERS NARROW IT (goal/G41.13): the ID chosen, read from the grants table's own key field, the family
    // chosen and its verb; one left unchosen means all. No button: the selectors are the filters.
    var filters = [
      { name: 'id', when: function () { return false; },
        test: function (row) { var id = filterId ? filterId.value : ''; return !id || (row && row[g.key] === id) ? 1 : 0; } },
      { name: 'family', when: function () { return false; },
        test: function (row) {
          var family = filterFamily ? filterFamily.family : '';
          var verb = filterFamily ? filterFamily.verb : '';
          if (!family) return 1;
          var p = String((row && row.path) || '');
          var dot = p.indexOf('.');
          var app = dot === -1 ? p : p.slice(0, dot);
          if (app !== family) return 0;
          return !verb || p === app + '.' + verb ? 1 : 0;
        } },
      // A DEPRECATED FILTER, OFF BY DEFAULT (Andy: "your allowed to keep the deprecated, BUT you must provide a filter for
      // deprecated that is OFF by default, BUT KNOW THAT THE DEPRECATED IS COMPLETELY INACCURATE....."): off, a grant no
      // server here serves today is left out; on, it is listed, marked. Its button stands on the filter line with the
      // others (Andy: "put the fucking deprecated filter on the same fucking line as all other filters"), so the list
      // draws none of its own.
      { name: 'deprecated', word: 'deprecated', toggle: true, when: function () { return false; },
        test: function (row, on) { return on === true || showDeprecated || serves(String((row && row.path) || '')) ? 1 : 0; } },
    ];

    // DEPRECATED FOLLOWS THE STREAM (Andy: "so show deprecated, but CHANGE AS SOON AS STREMED DATA SAYS OTHERWISE."): a
    // node's servers are jobs of kind server on its stream, their status changing as each starts and ends; such a job
    // changed, the tree is read again and the list redraws. One read at a time: a change while one is out asks once more
    // when it lands.
    var treeBusy = false;
    var treeAgain = false;
    function treeChanged() {
      if (treeBusy) { treeAgain = true; return; }
      treeBusy = true;
      loadTree().then(function () {
        treeBusy = false;
        if (!gone) redraw();
        if (treeAgain) { treeAgain = false; treeChanged(); }
      });
    }
    function followServers() {
      var D = window.spirit.data;
      if (!D || typeof D.translate !== 'function') return;
      var seen = Object.create(null);   // job id -> its last status, so a replay of the same says nothing new
      D.translate({
        onJob: function (job) {
          if (gone || !job || job.kind !== 'server' || !job.id) return;
          var status = String(job.status || '');
          if (seen[job.id] === status) return;
          var first = !(job.id in seen);
          seen[job.id] = status;
          // A server the page first hears of as it registers was in the tree already read.
          if (first && list === null) return;
          treeChanged();
        },
      });
    }

    // THE WARNINGS BEFORE A GRANT (goal/G30.4; Andy, 2026-10-20: "the grant screen warns when a grant reaches a verb that
    // carries a warning"). A warning is a file in the family's folder, <verb>.warning.txt, read through that family's FS
    // (FS.loadFile). A grant of a whole family reaches every verb in it, so each one's is read.
    function warnings(p) {
      var dot = p.indexOf('.');
      var family = dot === -1 ? p : p.slice(0, dot);
      var verbs = dot === -1
        ? Object.keys((tree && tree[family]) || {}).filter(function (v) { return v.indexOf('AGENTS') !== 0 && v.indexOf('FS.') !== 0; })
        : [p.slice(dot + 1)];
      return Promise.all(verbs.map(function (verb) {
        return api.verb(family + '.FS.loadFile', { path: verb + '.warning.txt' }).then(function (a) {
          var w = a && a.body && typeof a.body.text === 'string' ? a.body.text.trim() : '';
          return w ? family + '.' + verb + ': ' + w : '';
        }, function () { return ''; });
      })).then(function (all) { return all.filter(Boolean); });
    }

    // A BUNDLE'S PATHS, from its branches (goal/G41.14): auth.branch's search on that bundle, each branch family.verb, or
    // the family alone for the empty verb.
    function bundlePaths(bundle) {
      return api.verb('auth.branch', { op: 'search', text: '', bundle: Number(bundle.id) }).then(function (a) {
        if (a.status !== 200) throw new Error(refusal(a.body));
        if (a.body && a.body.more) say('more branches than fit one answer: only the first are granted');
        return ((a.body && a.body.items) || []).map(function (i) {
          var b = null;
          try { b = JSON.parse(i.label); } catch (e) { b = null; }
          return b && b.family ? (b.verb ? b.family + '.' + b.verb : b.family) : '';
        }).filter(Boolean);
      });
    }

    // GRANT: the chosen bundle's branches to the chosen ID, one grant through the grants table per branch, after the
    // warnings of every path it reaches; a path the ID holds already is counted done; any other refusal is said. Nothing
    // is read again: each new grant arrives on the stream, one row (rule/19).
    function grantBundle() {
      var id = idSel ? idSel.value : '';
      var bundle = bundleSel ? bundleSel.row : null;
      if (!id || !bundle || !bundleSel.value) return Promise.resolve();
      var paths = [];
      return bundlePaths(bundle).then(function (got) {
        paths = got;
        return Promise.all(paths.map(warnings));
      }, function (e) { say('the bundle could not be read: ' + ((e && e.message) || e), true); return null; }).then(function (lists) {
        if (!lists) return null;
        var all = [].concat.apply([], lists);
        if (all.length && !window.confirm('Before you grant ' + (bundle.label || 'this bundle') + ':\n\n' + all.join('\n\n') + '\n\nGrant it anyway?')) {
          say('not granted: ' + (bundle.label || 'the bundle'));
          return null;
        }
        var done = 0;
        var refused = [];
        return paths.reduce(function (chain, p) {
          return chain.then(function () {
            return Promise.resolve(g.grant(id, p)).then(function (a) {
              if (a && (a.ok !== false || a.code === 'already-granted')) { done += 1; return; }
              refused.push(p + ': ' + refusal(a));
            });
          });
        }, Promise.resolve()).then(function () {
          if (refused.length) say('not granted: ' + refused.join('; '), true);
          else say('granted ' + (bundle.label || 'the bundle') + ' (' + done + ' of ' + paths.length + ' paths) to ' + ((idSel.row && (idSel.row.name || idSel.row[ids.label])) || 'that ID'));
        });
      });
    }

    var listHost = document.createElement('div');
    listHost.className = 'fill';
    function say(text, isError) {
      said = String(text || '');
      saidError = !!isError;
      paint();
    }
    // Drawn again when it has something to say; the selectors and the list are made once and put back in their places.
    // Only the list fills (Andy: "and what about the HUGE vertical space in the grants tab, between the search filters and
    // the search input???"): the heading, the form and the filters take their own height.
    function paint() {
      if (gone || !idSel) return;
      host.innerHTML =
        '<div>' +
          '<div data-grants="line" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em;margin-top:1em">' +
            '<span>grant</span><span data-grants="id"></span><span data-grants="bundle"></span>' +
            '<button type="button" data-grants="grant">Grant</button>' +
          '</div>' +
          '<div data-grants="said" class="' + (saidError ? 'job-refusal' : 'job-manifest-note') + '">' + esc(said) + '</div>' +
          '<div data-grants="filters" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em;margin-top:1em">' +
            '<span data-grants="filter-id"></span><span data-grants="filter-family"></span>' +
            // Drawn as the search element draws a toggle: bold and outlined when on.
            '<button type="button" data-grants="deprecated" aria-pressed="' + (showDeprecated ? 'true' : 'false') + '" style="' +
              (showDeprecated ? 'font-weight:bold;outline:1px solid currentColor' : 'opacity:0.6') + '">deprecated</button>' +
          '</div>' +
        '</div>';
      host.querySelector('[data-grants="id"]').appendChild(idSel);
      host.querySelector('[data-grants="bundle"]').appendChild(bundleSel);
      host.querySelector('[data-grants="filter-id"]').appendChild(filterId);
      host.querySelector('[data-grants="filter-family"]').appendChild(filterFamily);
      host.querySelector('[data-grants="deprecated"]').addEventListener('click', function () {
        showDeprecated = !showDeprecated;
        paint();
        redraw();
      });
      host.querySelector('[data-grants="grant"]').addEventListener('click', function () { grantBundle(); });
      host.appendChild(listHost);
    }

    parts.then(function () {
      if (gone) return;
      var P = window.spirit.elements;
      // THE GRANT FORM, ONE ROW (goal/G41.13, Andy: "the grants tab should have one-row grant form: \"grant\"
      // [idSelector] [bundleSelector] [grantButton]"). Both ID selectors search the ID table it was handed.
      var idTable = { table: ids.table, key: ids.key, label: ids.label };
      idSel = P.createContactSelector(Object.assign({ placeholder: 'choose an ID…' }, idTable));
      bundleSel = P.createBundleSelector({ placeholder: 'choose a bundle…' });
      filterId = P.createContactSelector(Object.assign({ placeholder: 'every ID', all: 'every ID' }, idTable));
      filterFamily = P.createApiFamilySelector({ all: 'every family' });
      [filterId, filterFamily].forEach(function (f) { f.addEventListener('change', redraw); });
      paint();
      // The servers followed first, so the jobs the page already holds are taken as the tree about to be read.
      followServers();
      return loadTree().then(function () {
        if (gone) return;
        list = P.grantList.create(listHost, { grants: g, filters: filters, serves: serves, api: api });
      });
    });

    return {
      destroy: function () {
        gone = true;
        if (list) list.destroy();
        list = null;
        host.innerHTML = '';
      },
    };
  }

  E.grantsPanel = { create: create };
}());
