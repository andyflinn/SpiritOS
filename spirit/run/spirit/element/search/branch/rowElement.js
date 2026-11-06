// spirit/run/spirit/element/search/branch/rowElement.js
// ONE BRANCH, AS A ROW ELEMENT (goal/G41.14). Its subject is a row of node.db's branch table, keyed by its hidden
// number, the bundle it belongs to with it; its fields family, verb and delete (Andy, box: "branchSelector:pane, with
// table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'"). An empty verb is all of the family,
// drawn "(ALL)" as the filter draws it ("A branch row with an empty verb shows as "(ALL)", as the filter does").
// rowElement.js does the shared work; this file says what a branch is.
//
//   branchElement.create(row, opts) -> a rowElement of kind branch
//     row            { id, bundle, family, verb }, as auth.branch answers it
//     opts.api       the app's shell api, for the arming button's are-you-sure
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (goal/G41.14; Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything
// that changes their data set", "NO FUCKING DATA SCRIPT"): the node publishes each changed branch row on its permanent
// job 'bundles' ({ table: 'branch', row }, gone when deleted, a bundle's branches each gone with it); this file puts it
// into data.branches of the spirit object, and every branch row on the page repaints from there through its kind's
// index. A row asks and draws nothing of its own (rule/19).
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['spirit/element/rowElement.js', 'spirit/element/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  var ALL = '(ALL)';

  // A NODE'S BRANCHES ARE THE auth FAMILY'S CACHE (goal/G41.28): what a branch row on the stream means, and its branch,
  // are the family's own data.js's (spirit/auth/data.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.data.auth.data.branches.
  var authReady = Promise.resolve(window.spirit.cacheManager('auth')).then(function () { return window.spirit.data.auth.data.branches; });
  // THE KIND'S INDEX: one watch on the branches for every branch row on the page, each change to the rows of that key;
  // its release answered to the index, which lets it go with the kind's last row.
  var branches = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(B) {
      if (gone || !B || off) return;
      off = B.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ family: String(v.family || ''), verb: String(v.verb || '') }); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(((window.spirit.data || {}).auth || {}).data && window.spirit.data.auth.data.branches);
    if (!off) authReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    branches = branches || E.rowElement.index(dispatch);
    return branches;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row, opts) {
    var o = opts || {};
    var r = row || {};
    var el = E.rowElement.create({
      kind: 'branch',
      key: String(Number(r.id)),
      index: index(),
      row: { id: Number(r.id), bundle: Number(r.bundle), family: String(r.family || ''), verb: String(r.verb || '') },
      fields: [
        { name: 'family', paint: function (v) { return esc(v.family); } },
        { name: 'verb', paint: function (v) { return v.verb ? esc(v.verb) : ALL; } },
        { name: 'delete', paint: function () { return '<button type="button" class="cancel-btn" data-action="delete">Delete</button>'; } },
      ],
      actions: [
        { name: 'delete', label: 'Delete', run: function (it) {
          return spirit.ready.then(function (s) { return s.auth.branch({ op: 'delete', id: it.row.id }); });
        } },
      ],
    });
    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      mount(h);
      function controls() {
        var del = h.delete && typeof h.delete.querySelector === 'function' ? h.delete.querySelector('[data-action="delete"]') : null;
        if (del) E.armingButton.attach(del, { label: 'Delete', api: o.api, run: function () { return el.act('delete', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the control waits for them.
      if (E.armingButton) controls(); else parts.then(controls);
      return el;
    };
    return el;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'branch', 'rowElement'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, E), { create: create });
}());
