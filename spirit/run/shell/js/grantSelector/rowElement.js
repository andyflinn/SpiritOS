// spirit/run/shell/js/grantSelector/rowElement.js
// ONE GRANT, AS A ROW ELEMENT, AND WHAT A GRANT IS ON THE STREAM (goal/G41.14). Its subject is a row of node.db's grants
// table: an ID and a path, keyed <key>\n<path>; its fields name (whose grant it is), path and revoke, Revoke the
// rightmost (Andy, on G41.13: "the rows of the grant list show in the rightmost column a armingButton [Revoke], which
// must revoke/delete that grant in the database"). It lived inside the grants app; it is an element of its own with its
// test folder (Andy: "INCLUDING COMPLETE TEST FOLDER FOR THE COMPONENTS INVOLVED!!!!"). rowElement.js does the shared
// work; this file says what a grant is.
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (Andy: "SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????",
// "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"): the node publishes each grant row as it changes on
// the auth tables' job ('bundles', table 'grant', { key, path, label }, gone when revoked); this file puts it into
// data.grants of the spirit object, and every grant row on the page repaints from there through its kind's index. A row
// asks and draws nothing of its own (rule/19).
//
//   grantElement.create(row, opts) -> a rowElement of kind grant
//     row            { key, path, label }, as the stream tells it, or { name, key, path } as auth.search answers it
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

  // WHAT A GRANT ROW ON THE STREAM MEANS: data.grants/<key>\n<path> is the row, or nothing once it is revoked.
  var D = window.spirit.data;
  if (D && typeof D.translate === 'function') {
    D.translate({
      onJob: function (job) {
        var d = job && job.type === 'bundles' ? job.data : null;
        if (!d || d.table !== 'grant' || !d.row || !d.row.key || !d.row.path) return;
        var path = 'grants/' + keyOf(d.row.key, d.row.path);
        if (d.gone === true) D.del(path);
        else D.set(path, { key: String(d.row.key), path: String(d.row.path), label: String(d.row.label || '') });
      },
    });
  }
  // THE KIND'S INDEX: one watch on data.grants for every grant row on the page, each change to the rows of that key.
  var grants = null;
  function dispatch(idx) {
    if (!D || typeof D.watch !== 'function') return;
    D.watch('grants', function (p, v) {
      var key = String(p).slice('grants/'.length);
      if (!key || !v) return;
      idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || v.name || '') }); });
    });
  }
  function index() {
    grants = grants || E.rowElement.index(dispatch);
    return grants;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row, opts) {
    var o = opts || {};
    var r = row || {};
    var el = E.rowElement.create({
      kind: 'grant',
      key: keyOf(r.key, r.path),
      index: index(),
      row: { key: String(r.key || ''), path: String(r.path || ''), label: String(r.label || r.name || '') },
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
        // The node revokes it, and the stream takes the row out.
        { name: 'revoke', label: 'Revoke', run: function (it) {
          return spirit.ready.then(function (s) { return s.auth.revoke({ key: it.row.key, path: it.row.path }); });
        } },
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
