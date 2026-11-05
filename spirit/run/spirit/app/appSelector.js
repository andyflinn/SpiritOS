// spirit/run/spirit/app/appSelector.js
// ONE ELEMENT: the app selector (goal/G43.2; Andy, box: "the face part of this api will be an probabilitySearch
// derivative"), following spirit/element/bundleSelector.js. Its contract and its test: ./test/appSelector.md and
// ./test/appSelector.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, ./appSelector/listElement.js, WHICH IT LOADS ITSELF (rule/26).
//
//   spirit.elements.appSelector.create(container, options) -> root
//     root.value   the chosen app's key, '' while none is
//     root.row     the chosen app, null while none is
//     one bubbling `change` on a pick, which shows that app's detail under the list; refresh() asks again
//     options.face 'pane' is the list itself, 'tiles' the apps as tiles; the default is the dropdown
//     options.toggle true: a pane or tiles flips between the two (goal/G43.9)
//
// ONE appSelector, THREE FACES (goal/G43.9; Andy, box: "One appSelector, with three faces: dropdown, pane and tiles."): "tiles
// shows active only, pane shows all", "and the picks differ: tiles launches, pane shows the detail with its button." Both open on
// top, here alone (Andy: "the detail panel needs to open on top of the whole container"), under one title bar, whose close
// button brings the list back. spirit.elements holds server, spirit.app the rest.
(function () {
  function createAppSelector(options) {
    var o = options || {};
    var face = o.face === 'pane' || o.face === 'tiles' ? o.face : 'dropdown';
    var isPane = face !== 'dropdown';
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
    var closeOpen = null;

    // THE BAR AND ITS PANE, OVER THE WHOLE CONTAINER. fill(pane) answers what to destroy on close, or a promise of it.
    function open(row, fill) {
      var S = window.spirit;
      var shell = document.createElement('div');
      shell.className = 'app-container fill';
      // THE TITLE BAR OF ALL PANELS IS ONE rowForm (Andy: "rowForm: [app-icon] "<app-label> [x]"). It follows the row's label.
      var bar = S.element.rowForm.create(shell, { icon: row.icon, button: '✕' });
      bar.button.className = 'app-container-close';
      bar.button.title = 'Close';
      bar.span.textContent = row.label;
      var offRow = S.data.app.data.watchApp(String(row.key), function (now) { if (now) bar.span.textContent = now.label; });
      var pane = document.createElement('div');
      pane.className = 'app-container-pane fill';
      shell.appendChild(pane);
      // Not hidden: a list's box is a flex box, and its display would win.
      listBox.style.display = 'none';
      root.appendChild(shell);
      var made2 = null;
      var closed = false;
      closeOpen = function () {
        closed = true;
        closeOpen = null;
        offRow();
        if (made2) made2.destroy();
        root.removeChild(shell);
        listBox.style.display = '';
      };
      bar.button.addEventListener('click', function () { closeOpen(); });
      Promise.resolve(fill(pane, function () { return closed; })).then(function (m) {
        if (closed) { if (m) m.destroy(); return; }
        made2 = m;
      });
    }
    function launch(row) {
      var S = window.spirit;
      var name = String(row.key);
      open(row, function (pane, closed) {
        return S.require('spirit/app/' + name + '/' + name + '.js').then(function () {
          if (closed()) return null;
          return S.app[name] ? S.app[name].createApp(pane) : S.elements[name].create(pane);
        });
      });
    }
    function panel(row) {
      open(row, function (pane) { return window.spirit.elements.appDetail.create(pane, { row: row, panel: true }); });
    }
    function clearDetail() { if (detail) detail.destroy(); detail = null; }
    function pick(row) {
      root.value = row && row.key ? String(row.key) : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
      clearDetail();
      if (row && face === 'tiles') { launch(row); return; }
      if (row && face === 'pane') { panel(row); return; }
      detail = row ? window.spirit.elements.appDetail.create(detailBox, { row: row }) : null;
    }
    function onFace(now) {
      face = now;
      clearDetail();
      if (closeOpen) closeOpen();
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.all([window.spirit.require('spirit/app/appSelector/listElement.js'), window.spirit.require('spirit/app/appSelector/detailElement.js'), window.spirit.require('spirit/element/icon.js'), window.spirit.require('spirit/element/rowForm.js')]).then(function () {
      if (gone) return;
      made = window.spirit.elements.appList.create(listBox, { face: face, toggle: o.toggle === true, onFace: onFace, pick: pick,
        // The filter is on the page, on the row's active (the box): app.search stays "just a search string".
        visible: function (row) { return face !== 'tiles' || (!!row && row.active === true); } });
    });

    root.refresh = function () { if (made) made.refresh(); };
    // Destroy lets its parts go, their watches with them, and takes itself out of its container, which it leaves empty.
    root.destroy = function () {
      gone = true;
      if (closeOpen) closeOpen();
      clearDetail();
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.appSelector = { create: function (container, options) { var root = createAppSelector(options); container.appendChild(root); return root; } };
})();
