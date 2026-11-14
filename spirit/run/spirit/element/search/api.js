'use strict';
// spirit/run/spirit/element/search/api.js
// ONE SHELL ELEMENT: the family selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.element,
//   which the shell hands to apps at mount as api.ui.element.
//
// On the globals every shell script has (spirit, document, window.spirit.apiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.
//
// It keeps its verb half (goal/G41.14; Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself,
// because the verb selector NEEDs the family selector to have any meaning at all."). Built from its two halves
// (goal/G41.5): the family dropdown, ./api/listElement.js, and the verb dropdown, search/api/verb.js, which it
// loads itself. It only puts them side by side and joins their choices into one path.
//
// THE API SEARCH, ITS SELECTOR (goal/G43.32; Andy: "uniformity, in the search elements and their folders, contain list,
// row an detail elements."): its folder holds the family list (./api/listElement.js, the app-server selector, which stood
// in this file), its row (./api/rowElement.js) and its detail (./api/detailElement.js), and the verb half (./api/verb.js).
// Its contract and its test: ./test/api.md and ./test/api.js.

(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its two halves, the family list and
  // the verb half, its filter.
  var parts = Promise.all(['spirit/element/search/api/listElement.js', 'spirit/element/search/api/verb.js'].map(function (p) {
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
    // Its box declares its constraint (goal/G47.1, -browser): what it holds stays inside; a dropdown's list is a popover, above it.
    if (root.style) root.style.overflow = 'hidden';
    // SIDE BY SIDE (goal/G29.7; Andy, 2026-10-18: "get those two selector, server and verb NEXT to each other, not
    // stacked"): the pair is one inline row in the line it stands in.
    root.style.display = 'inline-flex';
    root.style.alignItems = 'center';
    // Their gap, 1em, is shell.css's .api-family-selector (goal/G47.1, box v109).
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
      var E = window.spirit.element;
      families = E.spirit.element.search.api.listElement.create(root, { placeholder: options.familyPlaceholder, all: options.all, tree: options.tree });
      verbs = E.spirit.element.search.api.verb.create(root, { own: typeof options.tree !== 'function' });
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
    // Both halves destroyed with it (goal/G41.28, rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () { if (root.parentNode) root.parentNode.removeChild(root); made.then(function () { if (families) families.destroy(); if (verbs) verbs.destroy(); }); };
    return root;
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/api.js', { create: function (container, options) { var root = createApiFamilySelector(options); container.appendChild(root); return root; } }); });
})();
