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
//     opts.changed() after a delete was answered, so the list that shows it can ask again
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  var ALL = '(ALL)';

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
      row: { id: Number(r.id), bundle: Number(r.bundle), family: String(r.family || ''), verb: String(r.verb || '') },
      fields: [
        { name: 'family', paint: function (v) { return esc(v.family); } },
        { name: 'verb', paint: function (v) { return v.verb ? esc(v.verb) : ALL; } },
        { name: 'delete', paint: function () { return '<button type="button" class="cancel-btn" data-action="delete">Delete</button>'; } },
      ],
      actions: [
        { name: 'delete', label: 'Delete', run: function (it) {
          return spirit.ready.then(function (s) { return s.auth.branch({ op: 'delete', id: it.row.id }); }).then(function (a) {
            if (typeof o.changed === 'function') o.changed();
            return a;
          });
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
