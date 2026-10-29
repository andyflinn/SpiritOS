// spirit/run/shell/js/grantSelector/rowElement.js
// ONE GRANT, AS A ROW ELEMENT, AND WHAT A GRANT IS ON THE STREAM (goal/G41.14), OF WHICHEVER GRANTS TABLE ITS CALLER
// HANDS IT (goal/G41.16; Andy: "the callers (Grants and agent shell apps should boody well know how to configure the
// damn grantsPanel element"): the node's grants of contacts, or the agent's grants by job. It names no table. A grant is
// an ID and a path, keyed <id>\n<path>; its fields name (whose grant it is), path and revoke, Revoke the rightmost (Andy, on G41.13: "the rows of the grant list show in the rightmost column a armingButton [Revoke], which must
// revoke/delete that grant in the database"). rowElement.js does the shared work; this file says what a grant is.
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (G30.18; Andy: "get rid of thos FUCKING data.js scripts"): each grants table
// handed in says which stream rows are its grants; this file puts them into that table's own branch of spirit.data, so
// two tables on one page never mix, and every grant row repaints from there through its table's index. A row asks and
// draws nothing of its own (rule/19).
//
//   grantElement.create(row, opts) -> a rowElement of kind grant
//     row            a grant row, its id and whose grant it is in the fields its table names
//     opts.grants    the grants table, required: { branch, key, label, revoke(id, path), stream(job) -> { row, gone } }
//     opts.api       the app's shell api, for the arming button's are-you-sure
//     opts.serves(path)  whether a server serves that path today; one that does not reads deprecated (a REPORT: Andy,
//                    "so we defer pruning to be triggered by the owners auth app, who can report deprecated branches")
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  function keyOf(key, path) { return String(key) + '\n' + String(path); }

  // THE DATA SET IT WRITES TO, IT LOADS ITSELF (rule/26): the page's one spirit.data (shell/js/spiritData.js), which
  // may not be on the page yet when an app loads this file. spirit.require loads a file once, so it is the page's one
  // cache.
  var dataSet = window.spirit.data ? Promise.resolve(window.spirit.data)
    : Promise.resolve(window.spirit.require ? window.spirit.require('shell/js/spiritData.js') : null).then(function () { return window.spirit.data; });
  function whenData(fn) {
    dataSet.then(function (D) { if (D && typeof D.translate === 'function') fn(D); }, function () { /* no data set: the lists still search */ });
  }
  // PER GRANTS TABLE, BY ITS BRANCH: its translation and its index, made once, on its first row.
  // <branch>/<id>\n<path> is the grant row, or nothing once it is gone.
  var tables = {};
  function tableOf(g) {
    var b = String(g.branch);
    if (tables[b]) return tables[b];
    whenData(function (D) {
      D.translate({
        onJob: function (job) {
          var got = g.stream(job);
          var r = got && got.row;
          if (!r || !r[g.key] || !r.path) return;
          var p = b + '/' + keyOf(r[g.key], r.path);
          if (got.gone === true) D.del(p);
          else D.set(p, Object.assign({}, r));
        },
      });
    });
    function dispatch(idx) {
      whenData(function (D) {
        D.watch(b, function (p, v) {
          var key = String(p).slice(b.length + 1);
          if (!key || !v) return;
          idx.forKey(key).forEach(function (el) { el.apply({ label: String(v[g.label] || '') }); });
        });
      });
    }
    tables[b] = { index: E.rowElement.index(dispatch) };
    return tables[b];
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row, opts) {
    var o = opts || {};
    var g = o.grants;
    if (!g || !g.branch || !g.key || !g.label || typeof g.revoke !== 'function' || typeof g.stream !== 'function') {
      throw new Error('grantElement: a grants table is required ({ branch, key, label, revoke, stream })');
    }
    var r = row || {};
    var el = E.rowElement.create({
      kind: 'grant',
      key: keyOf(r[g.key], r.path),
      index: tableOf(g).index,
      row: { key: String(r[g.key] || ''), path: String(r.path || ''), label: String(r[g.label] || '') },
      fields: [
        { name: 'name', from: ['label'], paint: function (v) { return '<span style="white-space:nowrap">' + esc(v.label) + '</span>'; } },
        { name: 'path', paint: function (v) {
          var gone = typeof o.serves === 'function' && !o.serves(v.path);
          return '<span style="white-space:nowrap">' + esc(v.path) + '</span>' +
            (gone ? ' <span class="gr-gone" title="no server serves this path today">deprecated</span>' : '');
        } },
        { name: 'revoke', paint: function () { return '<button type="button" class="gr-revoke" data-action="revoke">Revoke</button>'; } },
      ],
      actions: [
        // Its table revokes it, and the stream takes the row out.
        { name: 'revoke', label: 'Revoke', run: function (it) { return g.revoke(it.row.key, it.row.path); } },
      ],
    });
    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      mount(h);
      function controls() {
        var b = h.revoke && typeof h.revoke.querySelector === 'function' ? h.revoke.querySelector('[data-action="revoke"]') : null;
        if (b) E.armingButton.attach(b, { label: 'Revoke', api: o.api, run: function () { return el.act('revoke', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the control waits for them.
      if (E.armingButton) controls(); else parts.then(controls);
      return el;
    };
    return el;
  }

  E.grantElement = { create: create };
}());
