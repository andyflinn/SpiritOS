// spirit/run/shell/js/branchEditor.js
// ONE BUNDLE'S BRANCHES, EDITED: a page the bundle editor pushes (goal/G41.14). Andy, box: "the branchEditor page is
// always configured with a bundle key", "first row: Title: "Edit <bundle-label-content>"", "second row, add form: "new"
// [apiFamilySelector:dropdown] [apiVerbSelector:dropdown] [Add-button]", "branchSelector:pane, with table columns as
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
  var parts = Promise.all(['shell/js/apiFamilySelector.js', 'shell/js/branchSelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  function mount(box, o) {
    var E = window.spirit.elements;
    box.innerHTML = '';
    // THE ADD FORM: new [family, its verb] [Add].
    var form = document.createElement('div');
    form.className = 'branch-editor-add';
    form.appendChild(document.createTextNode('new '));
    var family = E.apiFamilySelector.create(form, { all: 'choose a family…' });
    var add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add';
    form.appendChild(add);
    box.appendChild(form);
    var said = document.createElement('div');
    said.className = 'job-manifest-note';
    box.appendChild(said);
    // THE BUNDLE'S BRANCHES, filling the rest (shell.css fill).
    var branches = E.branchSelector.create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb', 'delete'], api: o.api });
    branches.className += ' fill';

    function say(text) { said.textContent = String(text || ''); }
    add.addEventListener('click', function () {
      if (!family.family) { say('choose a family first'); return; }
      say('');
      var ask = { op: 'add', bundle: Number(o.bundle), family: family.family, verb: family.verb || '' };
      spirit.ready.then(function (s) { return s.auth.branch(ask); }).then(function () {
        branches.refresh();
      }, function (e) { say((e && (e.message || e.refusal)) || 'not added'); });
    });
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
    parts.then(function () { if (!gone) mount(container, options || {}); });
    return { destroy: function () { gone = true; container.innerHTML = ''; } };
  }
  window.spirit.elements.branchEditor = { create: create, open: open };
}());
