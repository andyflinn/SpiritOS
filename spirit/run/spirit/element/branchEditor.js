// spirit/run/spirit/element/branchEditor.js
// ONE BUNDLE'S BRANCHES, EDITED: what a closable tab holds (goal/G41.32; goal/G41.14). Andy, box: "the branchEditor page is
// always configured with a bundle key", "second row, add form: "new" [apiFamilySelector:dropdown] [apiVerbSelector:dropdown]
// [Add-button]" (a rowForm since goal/G41.27, ➕ for "new"), "branchSelector:pane, with table columns as follows: 1. Family
// (duh?) 2. Verb 3. armingButton 'Delete'". The two dropdowns of the add form are the family selector's two halves (Andy:
// "apiFamiliySelector.js will use apiVerbSelector as part of itself").
//
//   spirit.element.branchEditor.create(container, { bundle, label, owner, gone }) -> { destroy() }
//     bundle  the bundle's id; label its label; owner its owner (its Delete is an armingButton, which hears a click elsewhere itself)
//     gone    called when this bundle's deletion is heard (Andy: "a bundle that hears its deletion, closes its branchEditor tab.")
// A BUNDLE NOT THE NODE'S IS SHOWN ONLY (Andy: "A user can only create, change and delete node-owned bundles and branches, and
// sees the others read-only"): its branches, no add form, no Delete. The node refuses them as well.
// An Add left at All Verbs is the empty verb, all of the family. The node checks the family and verb against its api
// tree and refuses a family and verb the bundle holds already; a refusal is said in the page in the node's words.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['spirit/element/search/api.js', 'spirit/element/search/branch.js', 'spirit/element/rowForm.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }).concat([window.spirit.require ? window.spirit.require('spirit/element/armingButton.js') : null, window.spirit.cacheManager('auth')]));

  function mount(box, o) {
    var E = window.spirit.element;
    box.innerHTML = '';
    var A = ((window.spirit.data || {}).auth || {}).data;
    // ITS DELETION HEARD, FROM THIS SCREEN OR ANY OTHER: the mounter closes it.
    var offBundle = A && typeof o.gone === 'function' ? A.bundles.watch(function (key, v) {
      if (String(key) === String(o.bundle) && !v) o.gone();
    }) : null;
    if ((o.owner || 'node') !== 'node') {
      var shown = E.search.branch.create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb'] });
      shown.className += ' fill';
      return { destroy: function () { if (typeof offBundle === 'function') offBundle(); shown.destroy(); } };
    }
    // THE ADD FORM, A ROWFORM (goal/G41.27; Andy: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", and "careful,
    // there's a hidden verb selector there that only displays when a family is selected... !\n[➕] [choose a family… ▾]
    // [All Verbs ▾] [Add]"): ➕, the family selector in its span, its verb half with it, Add its button.
    var form = E.rowForm.create(box, { icon: '➕', button: 'Add' });
    form.root.className += ' branch-editor-add';
    var family = E.search.api.create(form.span, { all: 'choose a family…' });
    var add = form.button;
    var said = document.createElement('div');
    said.className = 'job-manifest-note';
    box.appendChild(said);
    // THE BUNDLE'S BRANCHES, filling the rest (shell.css fill).
    var branches = E.search.branch.create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb', 'delete'] });
    branches.className += ' fill';

    function say(text) { said.textContent = String(text || ''); }
    // WHAT IT ADDS, IT FOLLOWS IN spirit.data (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
    // changes shit it listens to fucking update via the spirit object"): the branches the auth family's cache keeps
    // (spirit.data.auth.data.branches). The branch asked for, once there, is said added.
    var waiting = null;
    var off = A ? A.branches.watch(function (id, v) {
      if (!waiting || !v) return;
      if (Number(v.bundle) === waiting.bundle && String(v.family) === waiting.family && String(v.verb || '') === waiting.verb) { waiting = null; say('added'); }
    }) : null;
    add.addEventListener('click', function () {
      if (!family.family) { say('choose a family first'); return; }
      say('');
      var ask = { op: 'add', bundle: Number(o.bundle), family: family.family, verb: family.verb || '' };
      waiting = { bundle: ask.bundle, family: ask.family, verb: ask.verb };
      spirit.ready.then(function (s) { return s.auth.branch(ask); }).then(function () {
        branches.refresh();
      }, function (e) { waiting = null; say((e && (e.message || e.refusal)) || 'not added'); });
    });
    // AT THE BOTTOM, THE BUNDLE'S DELETE (goal/G41.32; Andy: "i need the branchEditor to have a rowForm at the bottom: [❌]
    // "Delete <bundle-name> bundle and branches " [Delete (armingButton)]."): the bundle and every branch that names it, in one
    // transaction at the node, and what closes this is hearing it. A refusal is said below it, in the node's words.
    var del = E.rowForm.create(box, { icon: '❌', button: 'Delete' });
    del.root.className += ' branch-editor-delete';
    del.span.textContent = 'Delete ' + String(o.label || '') + ' bundle and branches';
    var delSaid = document.createElement('div');
    delSaid.className = 'job-manifest-note';
    box.appendChild(delSaid);
    E.armingButton.attach(del.button, { label: 'Delete', run: function () {
      delSaid.textContent = '';
      return spirit.ready.then(function (s) { return s.auth.bundle({ op: 'delete', id: Number(o.bundle) }); }).then(null, function (e) {
        delSaid.textContent = (e && (e.message || e.refusal)) || 'not deleted';
      });
    } });
    // Everything it made, and its watches, let go with it (rule/8).
    return { destroy: function () { if (typeof off === 'function') off(); if (typeof offBundle === 'function') offBundle(); family.destroy(); branches.destroy(); } };
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // And the shell's element shape (goal/G41.19, box v23): create(container, options) draws the editor into the
  // container, once its parts are in.
  function create(container, options) {
    var gone = false;
    var mounted = null;
    parts.then(function () { if (!gone) mounted = mount(container, options || {}); });
    return { destroy: function () { gone = true; if (mounted) mounted.destroy(); mounted = null; container.innerHTML = ''; } };
  }
  window.spirit.element.branchEditor = { create: create };
}());
