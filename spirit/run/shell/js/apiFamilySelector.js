// spirit/run/shell/js/apiFamilySelector.js
// ONE SHELL ELEMENT: the family selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.elements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// On the globals every shell script has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.
//
// It was apiBranchSelector.js (goal/G41.14; Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is
// the proper name for it"), and keeps its verb half: "apiFamiliySelector.js will use apiVerbSelector as part of itself,
// because the verb selector NEEDs the family selector to have any meaning at all." Built from its two halves, which it
// loads itself (goal/G41.5): the family dropdown, the app-server selector, and the verb dropdown, apiVerbSelector. It
// only puts them side by side and joins their choices into one path.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its two halves.
  var parts = Promise.all(['shell/js/appServerSelector.js', 'shell/js/apiVerbSelector.js'].map(function (p) {
    return window.spirit.require ? window.spirit.require(p) : null;
  }));

  // ── THE FAMILY SELECTOR (apiAuth/G1.9) ─────────────────────────────
  //
  //   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the
  //   verb-dropdown selection chances automatically depending on the
  //   selection in the appServer-dropdown", and "the verb dropdown will have
  //   an option ( ** all verbs **)".
  //
  // Both halves are probabilitySearch dropdowns (the old shell's list search is forbidden on the face, goal/G40.8), never
  // native selects; the verb half shows only once a family is chosen (Andy: "[chose a verb, displayed only when a server
  // is chosen ]"). root.family is the chosen family ('' for none), root.verb the chosen verb ('' when none or All Verbs
  // is chosen), and root.value the PATH a grant takes: 'family' when no single verb is chosen, 'family.verb' when one
  // is, '' with no family. options.all names the family half's first row (unchosen: every family). It fires a bubbling
  // change.
  function createApiFamilySelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'api-family-selector' + (options.className ? ' ' + options.className : '');
    // SIDE BY SIDE (goal/G29.7; Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not
    // stacked"): the pair is one inline row in the line it stands in.
    root.style.display = 'inline-flex';
    root.style.alignItems = 'center';
    root.style.gap = '1em';
    root.family = '';
    root.verb = '';
    root.value = '';
    var families = null;
    var verbs = null;

    function settle() {
      root.value = !root.family ? '' : root.verb ? root.family + '.' + root.verb : root.family;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function quiet(event) { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); }
    var made = parts.then(function () {
      var E = window.spirit.elements;
      families = E.createAppServerSelector({ placeholder: options.familyPlaceholder, all: options.all, tree: options.tree });
      verbs = E.createApiVerbSelector({});
      root.appendChild(families);
      root.appendChild(verbs);
      families.addEventListener('change', function (event) {
        quiet(event);
        if (families.value === root.family) return;
        root.family = families.value || '';
        root.verb = '';
        verbs.show(families.tree, root.family);
        settle();
      });
      verbs.addEventListener('change', function (event) {
        quiet(event);
        root.verb = verbs.value || '';
        settle();
      });
      families.addEventListener('tree', function () { root.tree = families.tree; root.dispatchEvent(new Event('tree', { bubbles: false })); });
      root.families = families;
      root.verbs = verbs;
    });
    // A NEW PARTY'S TREE (goal/G30.5): the choice clears, the verb half hides, and root.tree is the tree once loaded.
    root.load = function (fn) {
      return made.then(function () {
        root.family = '';
        root.verb = '';
        verbs.show(null, '');
        settle();
        return families.load(fn);
      });
    };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createApiFamilySelector = createApiFamilySelector;
})();
