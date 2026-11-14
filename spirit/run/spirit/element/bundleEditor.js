'use strict';
// spirit/run/spirit/element/bundleEditor.js
// THE BUNDLES, MADE AND KEPT: a simple panel-type shell element (goal/G41.14). Andy, box: the "bundleEditor", "at the
// top of the page: a one-row add form: "new" [fieldInput.js/fieldRules:Label input field] [Add-Button]" (a rowForm since
// goal/G41.27, ➕ in place of "new"), "the
// [add-Button] refused an empty or invalid label", and "filling the rest of the available vertical space: the
// bundleSelector in pane-mode", its columns the label (shown only since goal/G41.26) and the owner. A row pressed opens
// its branch editor as a closable tab (goal/G41.32). The grants app draws it in its Bundles tab ("the Grant app must use
// the bundleEditor in its "Bundle" tab"). A bundle is a label; its branches are the branch editor's.
//
//   spirit.element.spirit.element.bundleEditor.create(box, { tabs, tabLabel }) -> { destroy() }
//     box  the space it fills; tabs the tabContainer the pane opens tabs in;
//     tabLabel(row) what names those tabs, its mounter's (the agent app's browserAgent.js), handed on to ./search/bundle.js
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/auth/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require; and the auth family's cache manager, whose
  // bundles it adds to (goal/G41.28).
  var parts = Promise.all(['spirit/element/fieldInput.js', 'spirit/element/search/bundle.js', 'spirit/element/rowForm.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }).concat([window.spirit.cacheManager('auth')]));
  // The label's rule, the one definition both sides use (spirit/fieldRules.js).
  function labelOf(text) {
    var R = window.spirit.fieldRules || {};
    var v = typeof R.normalize === 'function' ? R.normalize(text) : String(text == null ? '' : text).trim();
    var bad = !v ? 'a bundle needs a label' : (typeof R.problem === 'function' ? R.problem(v) : '');
    return { value: v, why: bad || '' };
  }

  function create(box, options) {
    var o = options || {};
    var gone = false;
    var stop = null;
    var bundles = null;
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element;
      box.innerHTML = '';
      // AT THE TOP, A ROWFORM (goal/G41.27; Andy: "bundleEditor:\n[➕] [label] [Add]"): ➕, the label input in its span,
      // Add its button. What Add did is said below it.
      var form = E.spirit.element.rowForm.create(box, { icon: '➕', button: 'Add' });
      form.root.className += ' bundle-editor-add';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'label';
      window.spirit.required.spirit.element.fieldInput.attach(input, 'name');
      form.span.appendChild(input);
      var add = form.button;
      var said = document.createElement('div');
      said.className = 'job-manifest-note';
      box.appendChild(said);
      // FILLING THE REST: the bundles, a pane whose labels are shown only.
      bundles = E.spirit.element.search.bundle.create(box, { face: 'pane', columns: ['label', 'owner'], tabs: o.tabs, tabLabel: o.tabLabel });
      bundles.className += ' fill';

      function say(text) { said.textContent = String(text || ''); }
      // WHAT IT ADDS, IT LISTENS FOR (goal/G41.27, G41.28): the bundle arrives in the auth family's cache
      // (spirit.data.auth.data.bundles), which the pane is a view of, so it shows there by itself; once it is there, Add's
      // label is cleared and the add is said.
      var waitingFor = '';
      stop = window.spirit.data.auth.data.bundles.watch(function (key, v) {
        if (!waitingFor || !v || String(v.label || '') !== waitingFor) return;
        waitingFor = '';
        input.value = '';
        say('added');
      });
      add.addEventListener('click', function () {
        var got = labelOf(input.value);
        if (got.why) { say(got.why); return; }
        say('');
        waitingFor = got.value;
        spirit.ready.then(function (s) { return s.auth.bundle({ op: 'add', label: got.value }); }).then(null, function (e) {
          waitingFor = '';
          say((e && (e.message || e.refusal)) || 'not added');
        });
      });
    });
    return {
      destroy: function () { gone = true; if (stop) stop(); stop = null; if (bundles) bundles.destroy(); bundles = null; box.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/bundleEditor.js', { create: create }); });
}());
