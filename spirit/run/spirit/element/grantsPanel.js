// spirit/run/spirit/element/grantsPanel.js
// THE GRANTS PANEL, A SHELL ELEMENT (goal/G41.16): grants of whichever ID table its caller hands it. Andy: "the shell app
// shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js, and shell/js/grantsPanel.js is
// configurable with an ID table" (shell/js/ is spirit/element/ now), and "the callers (Grants and agent shell apps should boody well know how to configure
// the damn grantsPanel element". So it names no table: the Grants app hands it contacts and the node's grants, the agent
// app its jobs and its grants by job. Its contract and its test: ./test/grantsPanel.md and ./test/grantsPanel.js.
//
//   grantsPanel.create(host, { ids, grants }) -> { destroy() }
//   grantsPanel.nodeGrants   the node's own grants table, the one the Grants app picks (below)
//     ids     the ID table, as the contact selector takes it (G41.13, Q2): { table, key, label }
//     grants  the grants table those IDs are granted in, as the grant list and row take it: { branch, key, label,
//             search(text), grant(id, path) -> { ok } or { ok: false, code, error }, revoke(id, path),
//             watch(fn(id + newline + path, row)) -> its release }
//   The panel asks its verbs through the spirit object itself (goal/G43.24; Andy: "every fucking element gets the interfaces
//   it needs"), and is handed no api: its rows' arming buttons hear a click elsewhere themselves.
//   Made without its ID table or its grants table, it throws nothing and draws only a note saying what is missing: it
//   never falls back to one caller's setting.
//
// One panel: the one-row grant form, a rowForm, ➕ [ID selector] [bundle selector] [Grant] (goal/G41.13, G41.27); then the grant list
// (its search's 🪣 row the ID filter and the family selector, its 🗜 row deprecated) (./search/grant.js), the one box that
// fills (rule/16). Deprecated is a REPORT read from the node's api tree (a server is away or the verb is gone, and the
// grant waits for the owner, intact: suspend/repair, G1.4), following the stream, its filter off by default.
// A BUNDLE IS NOT GRANTED BY REFERENCE (G41.13, box v7): the node's bundles are the one dictionary both kinds of grant are
// made from, so the bundle's branches (auth.branch) are read here, and each becomes one grant through the grants table,
// family.verb or the family alone for (ALL), a path already granted counted done.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT USES, IT LOADS ITSELF (rule/26): through spirit.require, each element bringing its own.
  // And the jobs family's cache manager, the servers' jobs it follows (goal/G41.28), and the auth family's, which nodeGrants
  // (below) reads.
  var parts = Promise.all(['spirit/element/search/contact.js', 'spirit/element/search/bundle.js', 'spirit/element/search/api.js',
    'spirit/element/search/grant.js', 'spirit/element/busyButton.js', 'spirit/element/rowForm.js', 'spirit/client/apiTreeIndex.js'].map(function (p) { return window.spirit.require ? window.spirit.require(p) : null; })
    .concat([window.spirit.cacheManager ? window.spirit.cacheManager('jobs') : null, window.spirit.cacheManager ? window.spirit.cacheManager('auth') : null]));

  // A VERB OF THE NODE, THROUGH THE SPIRIT OBJECT (goal/G43.24): family.verb called on that family as spirit.ready holds it,
  // or as spirit.require binds a server's family, answering { status, body } as a list reads it.
  function ask(name, args) {
    var S = window.spirit;
    var n = String(name || '');
    var dot = n.indexOf('.');
    var fam = n.slice(0, dot);
    return S.outcome(Promise.resolve(S.ready).then(function (s) { return s[fam] || S.require(S.familyPath(fam)); }).then(function (f) {
      // A dotted verb is a path into the family, as spirit.js builds it: a.b is f.a.b.
      var at = n.slice(dot + 1).split('.');
      var owner = f;
      for (var i = 0; i < at.length - 1; i++) owner = owner ? owner[at[i]] : null;
      return owner[at[at.length - 1]](args || {});
    }));
  }

  // THE NODE'S GRANTS, AS A GRANTS TABLE (goal/G43.24, moved here from the Grants app): kept by the auth family's cache
  // manager (spirit.data.auth.data.grants, goal/G41.28), keyed by the peer's key, labelled by whose grant it is; each grant
  // row arrives on the auth tables' job (table grant, gone when revoked, goal/G41.14). WHO ASKS FOR A CHANGE LISTENS FOR IT
  // (goal/G41.27): what grant and revoke send comes back through watch. The panel still knows no table of its own (Andy,
  // G41.16: "the callers ... should boody well know how to configure the damn grantsPanel element"): a caller picks this
  // one by name, grants: grantsPanel.nodeGrants, as the agent app hands its own.
  function answered(a) {
    if (a && a.status === 200) return { ok: true };
    var b = (a && a.body) || {};
    return { ok: false, code: String(b.code || ''), error: String(b.error || b.code || 'refused') };
  }
  var nodeGrants = {
    get branch() { return window.spirit.data.auth.data.grants.branch; },
    // watch(fn): fn(id + newline + path, row) on every grant kept or let go; answers its release.
    watch: function (fn) { return window.spirit.data.auth.data.grants.watch(fn); },
    key: 'key',
    label: 'label',
    // auth.search answers whose grant it is as name, the stream as label: a found row carries it as label too, so the
    // panel reads one field.
    search: function (text) {
      return ask('auth.search', { text: String(text || '') }).then(function (a) {
        var b = (a && a.body) || {};
        var items = (b.items || []).map(function (i) {
          var r = null;
          try { r = JSON.parse(i.label); } catch (e) { r = null; }
          return r && typeof r === 'object' && r.label === undefined && r.name !== undefined ? { key: i.key, label: JSON.stringify(Object.assign({}, r, { label: r.name })) } : i;
        });
        return { items: items, more: !!b.more };
      });
    },
    grant: function (id, path) { return ask('auth.grant', { key: id, path: path }).then(answered); },
    revoke: function (id, path) { return ask('auth.revoke', { key: id, path: path }).then(answered); },
  };

  function create(host, config) {
    var c = config || {};
    var ids = c.ids;
    var g = c.grants;
    // UNCONFIGURED, IT SAYS SO and throws nothing (goal/G41.19, box v23: "no throw even unconfigured"; Andy: "you can
    // mount an element like \"grantsPanel\", with only the container, and an ID-table missing").
    var missing = !ids || !ids.table ? 'an ID table is required ({ table, key, label })'
      : !g || !g.branch || !g.key || !g.label || typeof g.grant !== 'function' || typeof g.search !== 'function' || typeof g.watch !== 'function'
        ? 'a grants table is required ({ branch, key, label, search, grant, revoke, watch })' : '';
    if (missing) {
      var note = document.createElement('div');
      note.className = 'job-manifest-note';
      note.textContent = 'not configured: ' + missing;
      host.appendChild(note);
      return { destroy: function () { host.innerHTML = ''; } };
    }
    var tree = null;
    var list = null;          // the grant list
    var idSel = null;         // the grant form's ID selector
    var bundleSel = null;     // and its bundle selector
    var form = null;          // the grant form, a rowForm holding both
    var filterId = null;      // the list's filters: an ID, and a family with its verb (the family selector)
    var filterFamily = null;
    var said = '';            // what the panel says a press did
    var saidError = false;
    var gone = false;
    function esc(text) { return window.spirit.escapeHtml(String(text == null ? '' : text)); }
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

    // THE LIST'S SELECTORS NARROW IT (goal/G41.13): the ID chosen, read from the grants table's own key field, the family
    // chosen and its verb; one left unchosen means all. They stand in the search's own 🪣 row (Andy, on G41.26: "any
    // searchSelector in our system must go into the probabilitySearch's selectorRow, so that the user-can see, which
    // elements belong to the search.").
    function selectors() {
      return [{ name: 'id', element: filterId,
        test: function (row) { var id = filterId ? filterId.value : ''; return !id || (row && row[g.key] === id) ? 1 : 0; } },
      { name: 'family', element: filterFamily,
        test: function (row) {
          var family = filterFamily ? filterFamily.family : '';
          var verb = filterFamily ? filterFamily.verb : '';
          if (!family) return 1;
          var p = String((row && row.path) || '');
          var dot = p.indexOf('.');
          var app = dot === -1 ? p : p.slice(0, dot);
          if (app !== family) return 0;
          return !verb || p === app + '.' + verb ? 1 : 0;
        } }];
    }
    var filters = [
      // A DEPRECATED FILTER, OFF BY DEFAULT (Andy: "your allowed to keep the deprecated, BUT you must provide a filter for
      // deprecated that is OFF by default, BUT KNOW THAT THE DEPRECATED IS COMPLETELY INACCURATE....."): off, a grant no
      // server here serves today is left out; on, it is listed, marked. Its button stands on the search's own 🗜 row (Andy:
      // "put the fucking deprecated filter on the same fucking line as all other filters").
      { name: 'deprecated', word: 'deprecated', toggle: true,
        test: function (row, on) { return on === true || serves(String((row && row.path) || '')) ? 1 : 0; } },
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
    // The servers' jobs as the jobs family's cache keeps them (spirit.data.jobs.data, goal/G41.28), followed while mounted.
    var unfollow = null;
    function followServers() {
      var J = ((window.spirit.data || {}).jobs || {}).data;
      if (!J || unfollow) return;
      var seen = Object.create(null);   // job id -> its last status, so a write of the same says nothing new
      Object.keys(J.jobs()).forEach(function (id) { var j = J.job(id); if (j && j.kind === 'server') seen[id] = String(j.status || ''); });
      unfollow = J.watch(function (id, job) {
        if (gone || !id || !job || job.kind !== 'server') return;
        var status = String(job.status || '');
        if (seen[id] === status) return;
        seen[id] = status;
        treeChanged();
      });
    }

    // NO WARNING BEFORE A GRANT (goal/G43.27; Andy: "compare that to giving a linux user root authority, he then can fuck
    // up the whole system, not our problem."): the <verb>.warning.txt files and their reading went.

    // A BUNDLE'S PATHS, from its branches (goal/G41.14): auth.branch's search on that bundle, each branch family.verb, or
    // the family alone for the empty verb.
    function bundlePaths(bundle) {
      return ask('auth.branch', { op: 'search', text: '', bundle: Number(bundle.id) }).then(function (a) {
        if (a.status !== 200) throw new Error(refusal(a.body));
        if (a.body && a.body.more) say('more branches than fit one answer: only the first are granted');
        return ((a.body && a.body.items) || []).map(function (i) {
          var b = null;
          try { b = JSON.parse(i.label); } catch (e) { b = null; }
          return b && b.family ? (b.verb ? b.family + '.' + b.verb : b.family) : '';
        }).filter(Boolean);
      });
    }

    // WHAT IT GRANTS, IT FOLLOWS IN spirit.data (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
    // changes shit it listens to fucking update via the spirit object"): the grants table's own watch (g.watch, its
    // cache manager's). A grant asked for counts as made once its row is there; the panel says how many of the bundle's
    // paths arrived.
    var waiting = null;   // { want: { '<id>\n<path>': true }, came: n, of: n, label, who }
    var unwatch = null;
    function watchGrants() {
      if (unwatch) return;
      unwatch = g.watch(function (k, v) {
        if (!waiting || !v) return;
        if (!waiting.want[k]) return;
        delete waiting.want[k];
        waiting.came += 1;
        say('granted ' + waiting.label + ': ' + waiting.came + ' of ' + waiting.of + ' paths arrived for ' + waiting.who);
        if (!Object.keys(waiting.want).length) waiting = null;
      });
    }
    // GRANT: the chosen bundle's branches to the chosen ID, one grant through the grants table per branch; a path the ID
    // holds already is counted done; any other refusal is said. Nothing is read again: each new grant arrives on the
    // stream, one row (rule/19), and is followed above.
    function grantBundle() {
      var id = idSel ? idSel.value : '';
      var bundle = bundleSel ? bundleSel.row : null;
      if (!id || !bundle || !bundleSel.value) return Promise.resolve();
      var paths = [];
      return bundlePaths(bundle).then(function (got) {
        paths = got;
        return true;
      }, function (e) { say('the bundle could not be read: ' + ((e && e.message) || e), true); return null; }).then(function (read) {
        if (!read) return null;
        var done = 0;
        var refused = [];
        var who = (idSel.row && (idSel.row.name || idSel.row[ids.label])) || 'that ID';
        waiting = { want: {}, came: 0, of: paths.length, label: bundle.label || 'the bundle', who: who };
        paths.forEach(function (p) { waiting.want[String(id) + '\n' + String(p)] = true; });
        return paths.reduce(function (chain, p) {
          return chain.then(function () {
            return Promise.resolve(g.grant(id, p)).then(function (a) {
              if (a && (a.ok !== false || a.code === 'already-granted')) { done += 1; if (a.code === 'already-granted' && waiting) delete waiting.want[String(id) + '\n' + String(p)]; return; }
              if (waiting) delete waiting.want[String(id) + '\n' + String(p)];
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
      if (gone || !form) return;
      host.innerHTML =
        '<div>' +
          '<div data-grants="line" style="margin-top:1em"></div>' +
          '<div data-grants="said" class="' + (saidError ? 'job-refusal' : 'job-manifest-note') + '">' + esc(said) + '</div>' +
        '</div>';
      host.querySelector('[data-grants="line"]').appendChild(form.root);
      host.appendChild(listHost);
    }

    parts.then(function () {
      if (gone) return;
      var P = window.spirit.element;
      // THE GRANT FORM, ONE ROW (goal/G41.13, Andy: "the grants tab should have one-row grant form: \"grant\"
      // [idSelector] [bundleSelector] [grantButton]"). Both ID selectors search the ID table it was handed.
      var idTable = { table: ids.table, key: ids.key, label: ids.label };
      // Each made in a slot of its own; paint moves it into the line it stands in, each time it draws the form.
      var slot = function () { return document.createElement('span'); };
      idSel = P.search.contact.create(slot(), Object.assign({ placeholder: 'choose an ID…' }, idTable));
      bundleSel = P.search.bundle.create(slot(), { placeholder: 'choose a bundle…' });
      filterId = P.search.contact.create(slot(), Object.assign({ placeholder: 'every ID', all: 'every ID' }, idTable));
      filterFamily = P.search.api.create(slot(), { all: 'every family' });
      // THE GRANT FORM IS A ROWFORM (goal/G41.27; Andy: "grantsPanel:\n\n➕ [choose an ID… ▾][choose a bundle… ▾][Grant]"):
      // ➕, the ID and the bundle selector in its span, Grant its button; made once, paint putting it back. What a press
      // did is said below it, not in it.
      form = P.rowForm.create(slot(), { icon: '➕', button: 'Grant' });
      form.span.appendChild(idSel);
      form.span.appendChild(bundleSel);
      // GRANT WAITS AS A BUSY BUTTON (goal/G41.23; Andy, goal/G41.18: "for all buttons that wait for potentially long
      // requests"): greyed and turning until every grant of the bundle is answered.
      if (P.busyButton) P.busyButton.attach(form.button, { run: grantBundle });
      else form.button.addEventListener('click', function () { grantBundle(); });
      paint();
      watchGrants();
      // The servers followed first, so the jobs the page already holds are taken as the tree about to be read.
      followServers();
      return loadTree().then(function () {
        if (gone) return;
        list = P.search.grant.create(listHost, { grants: g, filters: filters, selectors: selectors(), serves: serves });
      });
    });

    return {
      destroy: function () {
        gone = true;
        if (typeof unwatch === 'function') unwatch();
        unwatch = null;
        if (typeof unfollow === 'function') unfollow();
        unfollow = null;
        if (list) list.destroy();
        list = null;
        host.innerHTML = '';
      },
    };
  }

  E.grantsPanel = { create: create, nodeGrants: nodeGrants };
}());
