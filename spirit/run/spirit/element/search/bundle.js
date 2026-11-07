// spirit/run/spirit/element/search/bundle.js
// ONE SHELL ELEMENT: the bundle selector, the bundle picker apps build their screens with (goal/G41.14; Andy, box:
// "bundleSelector.js and bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and selecting
// bundle rows", "these shell elements must follow the design pattern of the contactSelector"). Its contract and its
// test: ./test/bundle.md and ./test/bundle.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, spirit/element/search/bundle/listElement.js, WHICH IT LOADS ITSELF (rule/26: "every
// shell element loads its own elements dynamically through the fucking apirit.require functionality"). The list draws
// the node's bundles (auth.bundle search) and each row (bundle/rowElement.js).
//
//   spirit.element.search.bundle.create(container, options) -> root
//     root.value   the chosen bundle's id, a number, '' while none is
//     root.row     the chosen bundle, { id, label }, null while none is
//     one bubbling `change` on a pick; refresh() asks again
//     options.face       'pane' is the list itself; the default is the dropdown
//     options.columns    the list's fields, of label and owner
//     options.tabs       in a pane, the tabContainer a row pressed opens its branchEditor in (goal/G41.32; Andy: "when some
//                        clicks on a (selects) a bundle row, a new closable tab opens in the tabContainer configured in the
//                        bundleSelector:pane"; "if a bundle already has an branchEditor-tab in the configured tabContainer,
//                        that tab will become the active tab"). None configured, a press opens nothing
//     options.tabLabel   tabLabel(row), from whoever mounts it, names that tab (goal/G41.31): words, or { label, italic };
//                        the bundle's label when it is not given
//     options.family     an app server's name: only the bundles it owns are listed (goal/G41.25)
//     options.placeholder, options.all, options.empty   handed to the list
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
      if (isPane && options.tabs && row) openTab(row);
    }
    function openTab(row) {
      var tabs = options.tabs;
      var name = 'bundle-' + Number(row.id);
      window.spirit.require('spirit/element/branchEditor.js').then(function () {
        var said = typeof options.tabLabel === 'function' ? options.tabLabel(row) : String(row.label || '');
        var header = said && typeof said === 'object' ? said : { label: String(said || '') };
        tabs.add({ name: name, label: String(header.label || ''), italic: header.italic === true, closable: true, mount: function (box) {
          return window.spirit.element.branchEditor.create(box, { bundle: Number(row.id), label: String(row.label || ''), owner: String(row.owner || 'node'), gone: function () { tabs.close(name); } });
        } });
      });
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    var gone = false;
    Promise.resolve(window.spirit.require ? window.spirit.require('spirit/element/search/bundle/listElement.js') : null).then(function () {
      if (gone) return;
      made = window.spirit.element.search.bundle.listElement.create(root, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (options.placeholder || 'choose a bundle…'),
        all: isPane ? undefined : options.all,
        columns: options.columns,
        family: options.family,
        empty: options.empty,
        pick: function (row) { pick(row); },
      });
    });

    root.refresh = function () { if (made) made.refresh(); };
    // Destroy lets its list go, the list's watches with it, and takes itself out of its container, which it leaves
    // empty (goal/G41.19, box v23: "destroy empties it").
    root.destroy = function () {
      gone = true;
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'bundle'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, (window.spirit.element = window.spirit.element || {})), { create: function (container, options) { var root = createBundleSelector(options); container.appendChild(root); return root; } });
})();
