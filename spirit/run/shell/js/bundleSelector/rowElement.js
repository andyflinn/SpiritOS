// spirit/run/shell/js/bundleSelector/rowElement.js
// ONE BUNDLE, AS A ROW ELEMENT, AND WHAT A BUNDLE IS ON THE STREAM (goal/G41.14). Its subject is a bundle of node.db's
// bundle table, keyed by its hidden number; its fields label, owner, edit and delete. rowElement.js does the shared work; this
// file says what a bundle is (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates, wherever they are used").
// Andy, box: "the bundleSelector in pane-mode, with the following columns: 1. [the label] ... 2. an edit button, leading to the branchEditor.js ... 3. a delete armingButton.js, deletes the "bundle" row
// and all rows in the "branch" table that reference this bundle." The label is shown only since goal/G41.26 (below).
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes
// their data set. and the SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the
// fucking elements", "NO FUCKING DATA SCRIPT", "THAT FUCKING ELEMENTS carry THEIR FUCKING DESCRIPTIONS"): the node
// publishes each changed bundle row on its permanent job 'bundles' ({ table: 'bundle', row }, gone when deleted); this
// file puts it into data.bundles of the spirit object, and every bundle row on the page repaints from there through its
// kind's index. A row asks and draws nothing of its own (rule/19): what it shows is what the stream said.
//
//   bundleElement.create(row, opts) -> a rowElement of kind bundle
//     row            { id, label, owner }, as auth.bundle answers it
//     opts.api       the app's shell api, for the arming button's are-you-sure
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/rowElement.js', 'shell/js/armingButton.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  // A NODE'S BUNDLES ARE THE auth FAMILY'S CACHE (goal/G41.28): what a bundle row on the stream means, and its branch,
  // are the family's own clientCacheManager's (spirit/auth/clientCacheManager.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.authData.bundles.
  var authReady = Promise.resolve(window.spirit.cacheManager('auth')).then(function () { return window.spirit.authData.bundles; });
  // THE KIND'S INDEX: one watch on the bundles for every bundle row on the page, each change to the rows of that key;
  // its release answered to the index, which lets it go with the kind's last row.
  var bundles = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(B) {
      if (gone || !B || off) return;
      off = B.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || ''), owner: String(v.owner || 'node') }); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(window.spirit.authData && window.spirit.authData.bundles);
    if (!off) authReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    bundles = bundles || E.rowElement.index(dispatch);
    return bundles;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function ask(args) { return spirit.ready.then(function (s) { return s.auth.bundle(args); }); }

  function create(row, opts) {
    var o = opts || {};
    var r = row || {};
    var id = Number(r.id);
    var el = E.rowElement.create({
      kind: 'bundle',
      key: String(id),
      index: index(),
      row: { id: id, label: String(r.label || ''), owner: String(r.owner || 'node') },
      fields: [
        { name: 'label', paint: function (v) { return esc(v.label); } },
        // THE OWNER, SHOWN ONLY (goal/G41.25; Andy, box: "the bundleSelector's list will gain a new column \"owner\",
        // displayed right after the bundles label", and "the owner field can never be changed after a bundle is added").
        { name: 'owner', paint: function (v) { return esc(v.owner); } },
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
    var mount = el.mount;
    el.mount = function (hosts) {
      var h = hosts || {};
      // THE LABEL IS SHOWN ONLY (goal/G41.26; Andy, box: "bundleSelector:pane mode the Label should now just be an output,
      // field: A bundles label is determined when it's added, and cannot be modified"): painted from the row, no input.
      mount(h);
      function controls() {
        var edit = h.edit && typeof h.edit.querySelector === 'function' ? h.edit.querySelector('[data-action="edit"]') : null;
        if (edit) edit.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); el.act('edit', {}); });
        var del = h.delete && typeof h.delete.querySelector === 'function' ? h.delete.querySelector('[data-action="delete"]') : null;
        if (del) E.armingButton.attach(del, { label: 'Delete', api: o.api, run: function () { return el.act('delete', {}); } });
      }
      // Its parts are on the page by the time a list draws a row; until then the controls wait for them.
      if (E.armingButton) controls(); else parts.then(controls);
      return el;
    };

    return el;
  }

  E.bundleElement = { create: create };
}());
