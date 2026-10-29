// spirit/run/shell/js/branchSelector.js
// ONE SHELL ELEMENT: the branch selector, a bundle's branches picked or listed (goal/G41.14; Andy, box: "branchSelector.js
// and branchSelector/ folder, featuring a pane mode and a dropdown mode for displaying and selecting branch rows"). Its
// contract and its test: ./test/branchSelector.md and ./test/branchSelector.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, shell/js/branchSelector/listElement.js, WHICH IT LOADS ITSELF (rule/26: "every
// shell element loads its own elements dynamically through the fucking apirit.require functionality"). The list draws
// the family selector as its filter, the bundle's branches (auth.branch search) and each row
// (branchSelector/rowElement.js).
//
//   spirit.elements.createBranchSelector(options) -> root
//     root.value   the chosen branch's id, a number, '' while none is
//     root.row     the chosen branch, { id, bundle, family, verb }, null while none is
//     one bubbling `change` on a pick; refresh() asks again
//     options.bundle     the bundle whose branches it lists
//     options.face       'pane' is the list itself; the default is the dropdown
//     options.columns    the list's fields, of family, verb and delete
//     options.placeholder, options.all, options.api, options.empty   handed to the list
(function () {
  function createBranchSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var root = document.createElement('div');
    root.className = 'branch-selector ' + (isPane ? 'branch-selector-face-pane' : 'branch-selector-face-dropdown') +
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
    Promise.resolve(window.spirit.require ? window.spirit.require('shell/js/branchSelector/listElement.js') : null).then(function () {
      made = window.spirit.elements.branchList.create(root, {
        bundle: options.bundle,
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a branch…'),
        all: isPane ? undefined : options.all,
        columns: options.columns,
        api: options.api,
        empty: options.empty,
        pick: function (row) { pick(row); },
      });
    });

    root.refresh = function () { if (made) made.refresh(); };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.createBranchSelector = createBranchSelector;
})();
