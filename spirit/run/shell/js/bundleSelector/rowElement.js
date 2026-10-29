// spirit/run/shell/js/bundleSelector/rowElement.js
// ONE BUNDLE, AS A ROW ELEMENT, AND WHAT A BUNDLE IS ON THE STREAM (goal/G41.14). Its subject is a bundle of node.db's
// bundle table, keyed by its hidden number; its fields label, edit and delete. rowElement.js does the shared work; this
// file says what a bundle is (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates, wherever they are used").
// Andy, box: "the bundleSelector in pane-mode, with the following columns: 1. [fieldInput:fieldRule:Label], displays
// and updates the bundle's label. Empty or invalid is refused. when pressing the Enter key, or leaving the field, the
// bundle-label is updated is the label is valid (as in "add"), and if invalid, reverts to the value contained in the
// db-table. 2. an edit button, leading to the branchEditor.js ... 3. a delete armingButton.js, deletes the "bundle" row
// and all rows in the "branch" table that reference this bundle."
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes
// their data set. and the SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the
// fucking elements", "NO FUCKING DATA SCRIPT", "THAT FUCKING ELEMENTS carry THEIR FUCKING DESCRIPTIONS"): the node
// publishes each changed bundle row on its permanent job 'bundles' ({ table: 'bundle', row }, gone when deleted); this
// file puts it into data.bundles of the spirit object, and every bundle row on the page repaints from there through its
// kind's index. A row asks and draws nothing of its own (rule/19): what it shows is what the stream said.
//
//   bundleElement.create(row, opts) -> a rowElement of kind bundle
//     row            { id, label }, as auth.bundle answers it
//     opts.editable  the label cell is an input that renames the bundle in place (the editor's pane); else drawn as text
//     opts.api       the app's shell api, for the arming button's are-you-sure
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/fieldInput.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  // WHAT A BUNDLE ROW ON THE STREAM MEANS: data.bundles/<id> is the row, or nothing once it is gone.
  var D = window.spirit.data;
  if (D && typeof D.translate === 'function') {
    D.translate({
      onJob: function (job) {
        var d = job && job.type === 'bundles' ? job.data : null;
        if (!d || d.table !== 'bundle' || !d.row || d.row.id == null) return;
        var path = 'bundles/' + Number(d.row.id);
        if (d.gone === true) D.del(path);
        else D.set(path, { id: Number(d.row.id), label: String(d.row.label || '') });
      },
    });
  }
  // THE KIND'S INDEX: one watch on data.bundles for every bundle row on the page, each change to the rows of that key.
  var bundles = null;
  function dispatch(idx) {
    if (!D || typeof D.watch !== 'function') return;
    D.watch('bundles', function (path, v) {
      var key = String(path).slice('bundles/'.length);
      if (!key || !v) return;
      idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || '') }); });
    });
  }
  function index() {
    bundles = bundles || E.rowElement.index(dispatch);
    return bundles;
  }

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
    var input = null;
    var el = E.rowElement.create({
      kind: 'bundle',
      key: String(id),
      index: index(),
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
        // The bundle and every branch that names it; the node deletes both in one transaction, and the stream says so.
        { name: 'delete', label: 'Delete', run: function (it) { return ask({ op: 'delete', id: it.row.id }); } },
      ],
    });
    // A label the stream brought shows in the input too, when the row edits it in place.
    var apply = el.apply;
    el.apply = function (changes) {
      apply(changes);
      if (input && changes && 'label' in changes) input.value = el.row.label;
    };

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
    // field, and put back to the table's label when the rule or the node refuses it. An answered rename shows when the
    // stream brings it (el.apply above), never before.
    function labelInput(host) {
      host.innerHTML = '';
      input = document.createElement('input');
      input.type = 'text';
      input.value = el.row.label;
      E.fieldInput.attach(input, 'name');
      host.appendChild(input);
      function commit() {
        var got = labelWhy(input.value);
        if (got.why || got.value === el.row.label) { input.value = el.row.label; return Promise.resolve(null); }
        return ask({ op: 'set', id: el.row.id, label: got.value }).then(null, function () { input.value = el.row.label; return null; });
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
