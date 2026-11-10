'use strict';
// spirit/run/spirit/element/search/grant/rowElement.js
// ONE GRANT, AS A ROW ELEMENT (goal/G41.14), OF WHICHEVER GRANTS TABLE ITS CALLER
// HANDS IT (goal/G41.16; Andy: "the callers (Grants and agent shell apps should boody well know how to configure the
// damn grantsPanel element"): the node's grants of contacts, or the agent's grants by job. It names no table. A grant is
// an ID and a path, keyed <id>\n<path>; its fields name (whose grant it is), path and revoke, Revoke the rightmost (Andy, on G41.13: "the rows of the grant list show in the rightmost column a armingButton [Revoke], which must
// revoke/delete that grant in the database"). rowElement.js does the shared work; this file says what a grant is.
//
// NO STREAM OF ITS OWN (goal/G41.28; Andy: "get rid of thos FUCKING data.js scripts"): each grants table handed in has
// its own branch of spirit.data, kept by its family's cache manager, and its own watch, so two tables on one page never
// mix, and every grant row repaints from that watch through its table's index. A row asks and draws nothing of its own
// (rule/19).
//
//   spirit.element.spirit.element.search.grant.rowElement.create(row, opts) -> a rowElement of kind grant
//     row            a grant row, its id and whose grant it is in the fields its table names
//     opts.grants    the grants table, required: { branch, key, label, revoke(id, path), watch(fn(id + newline + path,
//                    row)) }; branch is a whole spirit.data path (node/family/branch), its rows its family's cache
//                    manager's
//     opts.serves(path)  whether a server serves that path today; one that does not reads deprecated (a REPORT: Andy,
//                    "so we defer pruning to be triggered by the owners auth app, who can report deprecated branches")
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['spirit/element/rowElement.js', 'spirit/element/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  function keyOf(key, path) { return String(key) + '\n' + String(path); }

  // PER GRANTS TABLE, BY ITS BRANCH: its index, made on its first row (the shared row element is on the page by then).
  // The table's rows are its family's cache manager's (the node's grants: the auth family's, goal/G41.28); each row
  // repaints from the table's own watch, id + newline + path -> the grant row, or nothing once it is gone.
  var tables = {};
  function tableOf(g) {
    var b = String(g.branch);
    if (tables[b]) return tables[b];
    tables[b] = { index: null, dispatch: dispatch };
    function dispatch(idx) {
      g.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ label: String(v[g.label] || '') }); });
      });
    }
    return tables[b];
  }
  function indexOf(g) {
    var t = tableOf(g);
    t.index = t.index || E.spirit.element.rowElement.index(t.dispatch);
    return t.index;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row, opts) {
    var o = opts || {};
    var g = o.grants;
    // UNCONFIGURED, IT THROWS NOTHING (goal/G41.19, box v23: "no throw even unconfigured"): with no grants table there is
    // no field to read the row by, nothing to follow and nothing to revoke, so the row is empty and has no Revoke.
    var configured = !!(g && g.branch && g.key && g.label && typeof g.revoke === 'function' && typeof g.watch === 'function');
    var r = configured ? (row || {}) : {};
    var key = configured ? r[g.key] : '';
    var label = configured ? r[g.label] : '';
    var revoke = configured ? [{ name: 'revoke', paint: function () { return '<button type="button" class="gr-revoke" data-action="revoke">Revoke</button>'; } }] : [];
    var el = E.spirit.element.rowElement.create({
      kind: 'grant',
      key: keyOf(key, r.path),
      index: configured ? indexOf(g) : null,
      row: { key: String(key || ''), path: String(r.path || ''), label: String(label || '') },
      fields: [
        { name: 'name', from: ['label'], paint: function (v) { return '<span style="white-space:nowrap">' + esc(v.label) + '</span>'; } },
        { name: 'path', paint: function (v) {
          var gone = typeof o.serves === 'function' && !o.serves(v.path);
          return '<span style="white-space:nowrap">' + esc(v.path) + '</span>' +
            (gone ? ' <span class="gr-gone" title="no server serves this path today">deprecated</span>' : '');
        } },
      ].concat(revoke),
      actions: configured ? [
        // Its table revokes it, and its cache manager takes the row out.
        { name: 'revoke', label: 'Revoke', run: function (it) { return g.revoke(it.row.key, it.row.path); } },
      ] : [],
    });
    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      mount(h);
      function controls() {
        var b = h.revoke && typeof h.revoke.querySelector === 'function' ? h.revoke.querySelector('[data-action="revoke"]') : null;
        if (b) E.spirit.element.armingButton.attach(b, { label: 'Revoke', run: function () { return el.act('revoke', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the control waits for them.
      if (E.spirit.element.armingButton) controls(); else parts.then(controls);
      return el;
    };
    return el;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/grant/rowElement.js', { create: create }); });
}());
