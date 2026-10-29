// spirit/run/shell/js/bundleSelector/rowElement.js
// ONE BUNDLE, AS A ROW ELEMENT (goal/G41.14). Its subject is a bundle of node.db's bundle table, keyed by its hidden
// number; its fields label, edit and delete. rowElement.js does the shared work; this file says what a bundle is.
// Andy, box: "the bundleSelector in pane-mode, with the following columns: 1. [fieldInput:fieldRule:Label], displays
// and updates the bundle's label. Empty or invalid is refused. when pressing the Enter key, or leaving the field, the
// bundle-label is updated is the label is valid (as in "add"), and if invalid, reverts to the value contained in the
// db-table. 2. an edit button, leading to the branchEditor.js ... 3. a delete armingButton.js, deletes the "bundle" row
// and all rows in the "branch" table that reference this bundle."
//
//   bundleElement.create(row, opts) -> a rowElement of kind bundle
//     row            { id, label }, as auth.bundle answers it
//     opts.editable  the label cell is an input that renames the bundle in place (the editor's pane); else drawn as text
//     opts.api       the app's shell api, for the arming button's are-you-sure
//     opts.changed() after a rename or a delete was answered, so the list that shows it can ask again
// NOTHING STREAMS A BUNDLE BACK (the two selectors never share a page, Andy: "nothing on this page says that any of
// those two tables/Selectors will be on the same page"), so an answered rename is the row's label from then on.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/fieldInput.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // The label's rule, the one definition both sides use (js/fieldRules.js): '' when it passes, else why not.
  function labelWhy(text) {
    var R = window.spirit.fieldRules || {};
    var v = typeof R.normalize === 'function' ? R.normalize(text) : String(text == null ? '' : text).trim();
    if (!v) return { value: v, why: 'a bundle needs a label' };
    var bad = typeof R.problem === 'function' ? R.problem(v) : '';
    return { value: v, why: bad || '' };
  }
  function ask(args) { return spirit.ready.then(function (s) { return s.auth.bundle(args); }); }

  function create(row, opts) {
    var o = opts || {};
    var r = row || {};
    var id = Number(r.id);
    function changed() { if (typeof o.changed === 'function') o.changed(); }
    var el = E.rowElement.create({
      kind: 'bundle',
      key: String(id),
      row: { id: id, label: String(r.label || '') },
      fields: [
        { name: 'label', paint: function (v) { return esc(v.label); } },
        { name: 'edit', paint: function () { return '<button type="button" data-action="edit">Edit</button>'; } },
        { name: 'delete', paint: function () { return '<button type="button" class="cancel-btn" data-action="delete">Delete</button>'; } },
      ],
      actions: [
        // Its branches, on a page of their own the bundle editor pushes (the shell's navigation gives it its back).
        { name: 'edit', label: 'Edit', run: function (it) {
          return window.spirit.require('shell/js/branchEditor.js').then(function () {
            return E.branchEditor.open({ bundle: it.row.id, label: it.row.label, api: o.api });
          });
        } },
        // The bundle and every branch that names it; the node deletes both in one transaction.
        { name: 'delete', label: 'Delete', run: function (it) {
          return ask({ op: 'delete', id: it.row.id }).then(function (a) { changed(); return a; });
        } },
      ],
    });

    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      // Editable, the label cell is the input's, never repainted from the row.
      mount(o.editable ? Object.assign({}, h, { label: null }) : h);
      function controls() {
        if (o.editable && h.label) labelInput(h.label);
        var edit = h.edit && typeof h.edit.querySelector === 'function' ? h.edit.querySelector('[data-action="edit"]') : null;
        if (edit) edit.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); el.act('edit', {}); });
        var del = h.delete && typeof h.delete.querySelector === 'function' ? h.delete.querySelector('[data-action="delete"]') : null;
        if (del) E.armingButton.attach(del, { label: 'Delete', api: o.api, run: function () { return el.act('delete', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the controls wait for them.
      if (E.fieldInput && E.armingButton) controls(); else parts.then(controls);
      return el;
    };

    // THE LABEL, EDITED IN PLACE: held to the label's rule as it is typed (fieldInput), asked on Enter or on leaving the
    // field, and put back to the table's label when the rule or the node refuses it.
    function labelInput(host) {
      host.innerHTML = '';
      var input = document.createElement('input');
      input.type = 'text';
      input.value = el.row.label;
      E.fieldInput.attach(input, 'name');
      host.appendChild(input);
      function commit() {
        var got = labelWhy(input.value);
        if (got.why) { input.value = el.row.label; return Promise.resolve(null); }
        if (got.value === el.row.label) { input.value = el.row.label; return Promise.resolve(null); }
        return ask({ op: 'set', id: el.row.id, label: got.value }).then(function (a) {
          el.row.label = got.value;
          input.value = got.value;
          changed();
          return a;
        }, function () { input.value = el.row.label; return null; });
      }
      input.addEventListener('keydown', function (e) {
        if (!e || e.key !== 'Enter') return;
        if (typeof e.preventDefault === 'function') e.preventDefault();
        commit();
      });
      input.addEventListener('blur', function () { commit(); });
      return input;
    }
    return el;
  }

  E.bundleElement = { create: create };
}());
