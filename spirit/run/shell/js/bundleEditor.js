// spirit/run/shell/js/bundleEditor.js
// THE BUNDLES, MADE AND KEPT: a simple panel-type shell element (goal/G41.14). Andy, box: the "bundleEditor", "at the
// top of the page: a one-row add form: "new" [fieldInput.js/fieldRules:Label input field] [Add-Button]", "the
// [add-Button] refused an empty or invalid label", and "filling the rest of the available vertical space: the
// bundleSelector in pane-mode", its columns the label edited in place, Edit (the branch editor, a page of its own) and
// Delete (an armingButton). The grants app draws it in its Bundles tab ("the Grant app must use the bundleEditor in its
// "Bundle" tab"). A bundle is a label; its branches are the branch editor's.
//
//   spirit.elements.bundleEditor.create(box, { api }) -> { destroy() }
//     box  the space it fills; api the app's shell api, handed to the rows for their are-you-sure
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  var parts = Promise.all(['shell/js/fieldInput.js', 'shell/js/bundleSelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));
  // The label's rule, the one definition both sides use (js/fieldRules.js).
  function labelOf(text) {
    var R = window.spirit.fieldRules || {};
    var v = typeof R.normalize === 'function' ? R.normalize(text) : String(text == null ? '' : text).trim();
    var bad = !v ? 'a bundle needs a label' : (typeof R.problem === 'function' ? R.problem(v) : '');
    return { value: v, why: bad || '' };
  }

  function create(box, options) {
    var o = options || {};
    var gone = false;
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.elements;
      box.innerHTML = '';
      // AT THE TOP: new [label] [Add].
      var form = document.createElement('div');
      form.className = 'bundle-editor-add';
      form.appendChild(document.createTextNode('new '));
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'label';
      E.fieldInput.attach(input, 'name');
      form.appendChild(input);
      var add = document.createElement('button');
      add.type = 'button';
      add.textContent = 'Add';
      form.appendChild(add);
      box.appendChild(form);
      var said = document.createElement('div');
      said.className = 'job-manifest-note';
      box.appendChild(said);
      // FILLING THE REST: the bundles, a pane whose labels are edited in place.
      var bundles = E.createBundleSelector({ face: 'pane', columns: ['label', 'edit', 'delete'], editable: true, api: o.api });
      bundles.className += ' fill';
      box.appendChild(bundles);

      function say(text) { said.textContent = String(text || ''); }
      add.addEventListener('click', function () {
        var got = labelOf(input.value);
        if (got.why) { say(got.why); return; }
        say('');
        spirit.ready.then(function (s) { return s.auth.bundle({ op: 'add', label: got.value }); }).then(function () {
          input.value = '';
          bundles.refresh();
        }, function (e) { say((e && (e.message || e.refusal)) || 'not added'); });
      });
    });
    return {
      destroy: function () { gone = true; box.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.bundleEditor = { create: create };
}());
