// spirit/run/shell/js/branchEditor.js
// ONE BUNDLE'S BRANCHES, EDITED: a page the bundle editor pushes (goal/G41.14). Andy, box: "the branchEditor page is
// always configured with a bundle key", "first row: Title: "Edit <bundle-label-content>"", "second row, add form: "new"
// [apiFamilySelector:dropdown] [apiVerbSelector:dropdown] [Add-button]" (a rowForm since goal/G41.27, ➕ for "new"), "branchSelector:pane, with table columns as
// follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'", and of the way back: "the shell provides a back-button
// from there" (the navigation's, shell/navigationWrapper.js). The two dropdowns of the add form are the family
// selector's two halves (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself").
//
//   spirit.elements.branchEditor.open({ bundle, label, api }) -> the page's nav
//     bundle  the bundle's id; label its label, for the title; api the app's shell api, for the rows' are-you-sure
// An Add left at All Verbs is the empty verb, all of the family. The node checks the family and verb against its api
// tree and refuses a family and verb the bundle holds already; a refusal is said in the page in the node's words.
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/apiFamilySelector.js', 'shell/js/branchSelector.js', 'shell/js/rowForm.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  function mount(box, o) {
    var E = window.spirit.elements;
    box.innerHTML = '';
    // THE ADD FORM, A ROWFORM (goal/G41.27; Andy: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", and "careful,
    // there's a hidden verb selector there that only displays when a family is selected... !\n[➕] [choose a family… ▾]
    // [All Verbs ▾] [Add]"): ➕, the family selector in its span, its verb half with it, Add its button.
    var form = E.rowForm.create(box, { icon: '➕', button: 'Add' });
    form.root.className += ' branch-editor-add';
    var family = E.apiFamilySelector.create(form.span, { all: 'choose a family…' });
    var add = form.button;
    var said = document.createElement('div');
    said.className = 'job-manifest-note';
    box.appendChild(said);
    // THE BUNDLE'S BRANCHES, filling the rest (shell.css fill).
    var branches = E.branchSelector.create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb', 'delete'], api: o.api });
    branches.className += ' fill';

    function say(text) { said.textContent = String(text || ''); }
    // WHAT IT ADDS, IT FOLLOWS IN spirit.data (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
    // changes shit it listens to fucking update via the spirit object"): the branches branch the branch rows keep. The
    // branch asked for, once there, is said added.
    var waiting = null;
    var D = window.spirit.data;
    var off = D ? D.watch('branches', function (p, v) {
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
    // Everything it made, and its watch, let go with it (rule/8).
    return { destroy: function () { if (typeof off === 'function') off(); family.destroy(); branches.destroy(); } };
  }

  function open(options) {
    var o = options || {};
    var label = String(o.label || '');
    return parts.then(function () {
      return window.spirit.elements.navigation.push({
        title: 'Edit ' + label,
        mount: function (box) { mount(box, o); },
      });
    });
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // And the shell's element shape (goal/G41.19, box v23): create(container, options) draws the editor into the
  // container, once its parts are in.
  function create(container, options) {
    var gone = false;
    var mounted = null;
    parts.then(function () { if (!gone) mounted = mount(container, options || {}); });
    return { destroy: function () { gone = true; if (mounted) mounted.destroy(); mounted = null; container.innerHTML = ''; } };
  }
  window.spirit.elements.branchEditor = { create: create, open: open };
}());
