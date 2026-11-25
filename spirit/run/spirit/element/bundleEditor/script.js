'use strict';
// spirit/run/spirit/element/bundleEditor/script.js
// THE BUNDLES, MADE AND KEPT: a simple panel-type shell element (goal/G41.14). Andy, box: the "bundleEditor", "at the
// top of the page: a one-row add form": "new", a label input field, an Add button (a rowForm since
// goal/G41.27, ➕ in place of "new"), "the
// [add-Button] refused an empty or invalid label", and "filling the rest of the available vertical space: the
// bundleSelector in pane-mode", its columns the label (shown only since goal/G41.26) and the owner. A row pressed opens
// its branch editor as a closable tab (goal/G41.32). The grants app draws it in its Bundles tab ("the Grant app must use
// the bundleEditor in its "Bundle" tab"). A bundle is a label; its branches are the branch editor's.
//
//   spirit.required.spirit.element.bundleEditor.create(box, { tabs, tabLabel }) -> { destroy() }
//     box  the space it fills; tabs the tabContainer the pane opens tabs in;
//     tabLabel(row) what names those tabs, its mounter's (the agent app's browserAgent.js), handed on to ../search/bundle/script.js
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/auth/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/type/string/label/script.js');
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/fieldInput/script.js');
  // ITS FIELDS' TYPES, REQUIRED HERE BY THEIR FULL PATHS (goal/G49.13; Andy: "The UI elements need to know which spirit/type
  // their fields are and require that type"): the types fieldInput holds its fields to.
  if (window.spirit && typeof window.spirit.requireScript === 'function') { window.spirit.requireScript('spirit/type/string/label/script.js'); }
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/bundle/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript; and the auth family's cache manager, whose
  // bundles it adds to (goal/G41.28).
  var parts = Promise.all(['spirit/element/fieldInput/script.js', 'spirit/element/search/bundle/script.js', 'spirit/element/rowForm/script.js'].map(function (p) {
    return window.spirit.requireScript ? window.spirit.requireScript(p) : null;
  }).concat([window.spirit.requireScript('spirit/auth/api.js')]));
  // The label's type, required here by its full path (goal/G49.13), and the text tidied as it is stored.
  function labelOf(text) {
    var T = ANSWER['spirit/type/string/label/script.js'];
    var v = window.spirit.normalizeString(String(text == null ? '' : text));
    var bad = '';
    if (!v) bad = 'a bundle needs a label';
    else if (T) { try { T.isValid(v); } catch (e) { bad = (e && e.message) || 'not a label'; } }
    return { value: v, why: bad };
  }

  function create(box, options) {
    var o = options || {};
    var gone = false;
    var stop = null;
    var bundles = null;
    parts.then(function () {
      if (gone) return;
      box.innerHTML = '';
      // ITS OWN BOX, WHICH KEEPS WHAT IT HOLDS INSIDE (the general rules: the box an element puts into its container declares a
      // constraint, overflow not visible): the form, the line and the bundles go into it, not loose into the container.
      var own = document.createElement('div');
      own.className = 'fill';
      own.style.overflow = 'hidden';
      box.appendChild(own);
      // AT THE TOP, A ROWFORM (goal/G41.27; Andy: "bundleEditor:\n[➕] [label] [Add]"): ➕, the label input in its span,
      // Add its button. What Add did is said below it.
      // ITS ADD IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
      // comes"): handed as press, so Add is busy until the node answers.
      var form = ANSWER['spirit/element/rowForm/script.js'].create(own, { icon: '➕', button: 'Add', press: function () { return addBundle(); } });
      form.root.className += ' bundle-editor-add';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'label';
      ANSWER['spirit/element/fieldInput/script.js'].attach(input, 'spirit/type/string/label/script.js');
      form.span.appendChild(input);
      var said = document.createElement('div');
      said.className = 'job-manifest-note';
      own.appendChild(said);
      // FILLING THE REST: the bundles, a pane whose labels are shown only.
      bundles = ANSWER['spirit/element/search/bundle/script.js'].create(own, { face: 'pane', columns: ['label', 'owner'], tabs: o.tabs, tabLabel: o.tabLabel });
      bundles.className += ' fill';

      function say(text) { said.textContent = String(text || ''); }
      // WHAT IT ADDS, IT LISTENS FOR (goal/G41.27, G41.28): the bundle arrives in the auth family's cache
      // (spirit.required.spirit.data.auth.data.bundles), which the pane is a view of, so it shows there by itself; once it is there, Add's
      // label is cleared and the add is said.
      var waitingFor = '';
      stop = window.spirit.required.spirit.data.auth.data.bundles.watch(function (key, v) {
        if (!waitingFor || !v || String(v.label || '') !== waitingFor) return;
        waitingFor = '';
        input.value = '';
        say('added');
      });
      function addBundle() {
        var got = labelOf(input.value);
        if (got.why) { say(got.why); return null; }
        say('');
        waitingFor = got.value;
        return spirit.readyPromise.then(function () { return spirit.requireScript('spirit/auth/api.js'); }).then(function (s) { return s.bundle({ op: 'add', label: got.value }); }).then(null, function (e) {
          waitingFor = '';
          say((e && (e.message || e.refusal)) || 'not added');
        });
      }
    });
    return {
      destroy: function () { gone = true; if (stop) stop(); stop = null; if (bundles) bundles.destroy(); bundles = null; box.innerHTML = ''; },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
