// spirit/run/shell/js/bundleSelector.js
// ONE SHELL ELEMENT: the bundle selector, the bundle picker apps build their screens with (goal/G41.14; Andy, box:
// "bundleSelector.js and bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and selecting
// bundle rows", "these shell elements must follow the design pattern of the contactSelector"). Its contract and its
// test: ./test/bundleSelector.md and ./test/bundleSelector.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, shell/js/bundleSelector/listElement.js, WHICH IT LOADS ITSELF (rule/26: "every
// shell element loads its own elements dynamically through the fucking apirit.require functionality"). The list draws
// the node's bundles (auth.bundle search) and each row (bundleSelector/rowElement.js).
//
//   spirit.elements.bundleSelector.create(container, options) -> root
//     root.value   the chosen bundle's id, a number, '' while none is
//     root.row     the chosen bundle, { id, label }, null while none is
//     one bubbling `change` on a pick; refresh() asks again
//     options.face       'pane' is the list itself; the default is the dropdown
//     options.columns    the list's fields, of label, edit and delete; options.editable: rows rename in place
//     options.placeholder, options.all, options.api, options.empty   handed to the list
(function () {
  function createBundleSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var root = document.createElement('div');
    root.className = 'bundle-selector ' + (isPane ? 'bundle-selector-face-pane' : 'bundle-selector-face-dropdown') +
      (options.className ? ' ' + options.className : '');
    root.value = '';
    root.row = null;
    var made = null;

    function pick(row) {
      root.value = row && row.id !== undefined ? Number(row.id) : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(window.spirit.require ? window.spirit.require('shell/js/bundleSelector/listElement.js') : null).then(function () {
      made = window.spirit.elements.bundleList.create(root, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a bundle…'),
        all: isPane ? undefined : options.all,
        columns: options.columns,
        editable: options.editable === true,
        api: options.api,
        empty: options.empty,
        pick: function (row) { pick(row); },
      });
    });

    root.refresh = function () { if (made) made.refresh(); };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  window.spirit.elements.bundleSelector = { create: function (container, options) { var root = createBundleSelector(options); container.appendChild(root); return root; } };
})();
