// spirit/run/shell/js/branchSelector/rowElement.js
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
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  var ALL = '(ALL)';

  // WHAT A BRANCH ROW ON THE STREAM MEANS: data.branches/<id> is the row, or nothing once it is gone.
  // THE DATA SET MAY COME AFTER THIS FILE (spirit.js loads it once the page's families are bound, spirit.ready): what
  // needs it waits for it, so a row element loaded first still says what its rows mean.
  function whenData(fn) {
    var now = window.spirit.data;
    if (now && typeof now.translate === 'function') { fn(now); return; }
    Promise.resolve(window.spirit.ready).then(function () {
      var D = window.spirit.data;
      if (D && typeof D.translate === 'function') fn(D);
    }, function () { /* no data set: the lists still search */ });
  }
  whenData(function (D) {
    D.translate({
      onJob: function (job) {
        var d = job && job.type === 'bundles' ? job.data : null;
        if (!d || d.table !== 'branch' || !d.row || d.row.id == null) return;
        var path = 'branches/' + Number(d.row.id);
        if (d.gone === true) D.del(path);
        else D.set(path, { id: Number(d.row.id), bundle: Number(d.row.bundle), family: String(d.row.family || ''), verb: String(d.row.verb || '') });
      },
    });
  });
  // THE KIND'S INDEX: one watch on data.branches for every branch row on the page, each change to the rows of that key.
  var branches = null;
  function dispatch(idx) {
    whenData(function (D) {
      D.watch('branches', function (path, v) {
        var key = String(path).slice('branches/'.length);
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ family: String(v.family || ''), verb: String(v.verb || '') }); });
      });
    });
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

  E.branchElement = { create: create };
}());
