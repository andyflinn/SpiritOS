// spirit/run/spirit/app/appSelector.js
// ONE ELEMENT: the app selector (goal/G43.2; Andy, box: "the face part of this api will be an probabilitySearch
// derivative"), following shell/js/bundleSelector.js. Its contract and its test: ./test/appSelector.md and
// ./test/appSelector.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, ./appSelector/listElement.js, WHICH IT LOADS ITSELF (rule/26).
//
//   spirit.elements.appSelector.create(container, options) -> root
//     root.value   the chosen app's key, '' while none is
//     root.row     the chosen app, null while none is
//     one bubbling `change` on a pick, which shows that app's detail under the list; refresh() asks again
//     options.face 'pane' is the list itself; the default is the dropdown
(function () {
  function createAppSelector(options) {
    var o = options || {};
    var isPane = o.face === 'pane';
    var root = document.createElement('div');
    // A LIST GETS A BOX OF A STATED SIZE (rule/16): the pane face fills the box it is mounted in, its list scrolling inside.
    root.className = 'app-selector ' + (isPane ? 'app-selector-face-pane fill' : 'app-selector-face-dropdown');
    root.value = '';
    root.row = null;
    var listBox = document.createElement('div');
    if (isPane) listBox.className = 'fill';
    var detailBox = document.createElement('div');
    detailBox.style.flex = 'none';
    root.appendChild(listBox);
    root.appendChild(detailBox);
    var made = null;
    var detail = null;
    var gone = false;

    function pick(row) {
      root.value = row && row.key ? String(row.key) : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
      if (detail) detail.destroy();
      detail = row ? window.spirit.elements.appDetail.create(detailBox, { row: row }) : null;
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.all([window.spirit.require('spirit/app/appSelector/listElement.js'), window.spirit.require('spirit/app/appSelector/detailElement.js')]).then(function () {
      if (gone) return;
      made = window.spirit.elements.appList.create(listBox, { face: isPane ? 'pane' : 'dropdown', pick: pick });
    });

    root.refresh = function () { if (made) made.refresh(); };
    // Destroy lets its parts go, their watches with them, and takes itself out of its container, which it leaves empty.
    root.destroy = function () {
      gone = true;
      if (detail) detail.destroy();
      detail = null;
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.appSelector = { create: function (container, options) { var root = createAppSelector(options); container.appendChild(root); return root; } };
})();
