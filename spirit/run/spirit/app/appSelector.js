'use strict';
// spirit/run/spirit/app/appSelector.js
// ONE ELEMENT: the app selector (goal/G43.2; Andy, box: "the face part of this api will be an probabilitySearch
// derivative"), following spirit/element/search/bundle.js. Its contract and its test: ./test/appSelector.md and
// ./test/appSelector.js.
//
// A THIN SELECTOR OVER THE APP LIST, spirit/element/search/app.js, WHICH IT LOADS ITSELF (rule/26).
//
//   spirit.element.spirit.app.appSelector.create(container, options) -> root
//     root.value   the chosen app's key, '' while none is
//     root.row     the chosen app, null while none is
//     one bubbling `change` on a pick, which shows that app's detail under the list; refresh() asks again
//     options.face 'pane' is the list itself, 'tiles' the apps as tiles; the default is the dropdown
//     options.toggle true: a pane or tiles flips between the two (goal/G43.9)
//     options.hide   the app keys left out of every face (goal/G43.18: the shell leaves itself out)
//
// ONE appSelector, THREE FACES (goal/G43.9; Andy, box: "One appSelector, with three faces: dropdown, pane and tiles."): "tiles
// shows active only, pane shows all", "and the picks differ: tiles launches, pane shows the detail with its button." Both open on
// top, here alone (Andy: "the detail panel needs to open on top of the whole container"), under one title bar, whose close
// button brings the list back. A launched app is spirit.app.<key>.createApp(pane) where it has one (monitor),
// spirit.elements.<key>.create(pane, { title, open }) otherwise.
//
// THROUGH panel (goal/G43.17, spirit/element/panel.js): a closed app or detail is hidden, not destroyed, so pressing it again
// shows it as it was left (Q3: "yes."). A launched app switched off leaves the view and stays loaded until the shell boots
// again (Q11: "it only must disappear from view. it won't be loaded on the next shell-boot.").
(function () {
  // AN APP'S ELEMENT BY THE APP'S NAME (goal/G43.32): placed at spirit.element.<its file's path>, in the file it is in today
  // (Andy: where an app's main element lives and what it is named is settled "when we fix apps"): spirit/app/<name>/<name>.js,
  // else its element.js, else its browser<Name>.js.
  function appElementOf(name) {
    var n = String(name);
    var app = window.spirit && window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app;
    var b = app && app[n];
    if (!b) return null;
    return [n, 'element', 'browser' + n.charAt(0).toUpperCase() + n.slice(1)].map(function (k) { return b[k]; }).filter(function (e) { return e && typeof e.create === 'function'; })[0] || null;
  }
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
    var stack = null;
    var watches = [];

    // OVER THE WHOLE CONTAINER, ONE LAYER PER APP AND PER DETAIL (panel.js): its bar follows the row's label and icon, and
    // the file an app says it shows (Andy: "title row: [✏️] "Text Editor:" + file-name"; a file's own icon where the app hands
    // one, "the medias own icon or the media viewer's icon if no file is selcted yet").
    function barOf(now, look) {
      return { label: String(now.label || '') + (look && look.file ? ': ' + look.file : ''), icon: (look && look.icon) || now.icon };
    }
    function open(kind, row, fill, look) {
      var S = window.spirit;
      var key = String(row.key);
      if (!stack) return;
      var known = stack.layer(kind + '/' + key);
      if (known) { known.show(); return; }
      Promise.resolve(stack.open(kind + '/' + key, { icon: row.icon, label: row.label, fill: fill })).then(function (layer) {
        if (!layer || gone) return;
        if (look) {
          look.set = function () { layer.set(barOf(S.data.app.data.rows()[key] || row, look)); };
          if (look.file) look.set();
        }
        watches.push(S.data.app.data.watchApp(key, function (now) {
          if (!now) return;
          layer.set(barOf(now, look));
          // Q11: a launched app switched off leaves the view; it stays loaded.
          if (kind === 'app' && now.active !== true && layer.shown()) layer.hide();
        }));
      });
    }
    function launch(row) {
      var S = window.spirit;
      var name = String(row.key);
      var look = {};
      function title(t) { look.file = t && t.file; look.icon = t && t.icon; if (look.set) look.set(); }
      open('app', row, function (pane, closed) {
        return S.require('spirit/app/' + name + '/' + name + '.js').then(function () {
          if (closed()) return null;
          // What the app opens goes in this same stack, over all of it (panel.js: one stack, each ✕ one step back).
          var over = function (k, spec) { return stack ? stack.open('app/' + name + '/' + k, spec) : Promise.resolve(null); };
          return S.app[name] ? S.app[name].createApp(pane) : appElementOf(name).create(pane, { title: title, open: over });
        });
      }, look);
    }
    // AN APP'S DETAIL COMES WHEN ONE OPENS (goal/G43.27; Andy: "make sure that spirit.js does NOT load all that shit!!!!!!!!!"):
    // detailElement.js and what it draws with are required then, once, and not as the list loads.
    function detailReady() { return window.spirit.require('spirit/app/appSelector/detailElement.js'); }
    function panel(row) {
      open('detail', row, function (pane, closed) {
        return detailReady().then(function () { return closed() ? null : window.spirit.element.spirit.app.appSelector.detailElement.create(pane, { row: row, panel: true }); });
      });
    }
    function clearDetail() { if (detail) detail.destroy(); detail = null; }
    function pick(row) {
      root.value = row && row.key ? String(row.key) : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
      clearDetail();
      if (row && face === 'tiles') { launch(row); return; }
      if (row && face === 'pane') { panel(row); return; }
      if (!row) return;
      var asked = root.row;
      detailReady().then(function () {
        if (gone || root.row !== asked) return;
        clearDetail();
        detail = window.spirit.element.spirit.app.appSelector.detailElement.create(detailBox, { row: row });
      });
    }
    function onFace(now) {
      face = now;
      clearDetail();
      if (stack) stack.close();
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.all([window.spirit.require('spirit/element/search/app.js'), window.spirit.require('spirit/element/panel.js')]).then(function () {
      if (gone) return;
      // A list's box is a flex box, so the panel covers it by its display.
      stack = window.spirit.element.spirit.element.panel.create(root, listBox);
      made = window.spirit.element.spirit.element.search.app.create(listBox, { face: face, toggle: o.toggle === true, onFace: onFace, pick: pick,
        // The filter is on the page, on the row's active (the box): app.search stays "just a search string".
        // o.hide, the keys left out of every face (goal/G43.18; Andy: "the shell should exclude itself completely from the
        // app-list"): the shell app hands its own.
        visible: function (row) {
          if (row && Array.isArray(o.hide) && o.hide.indexOf(String(row.key || '')) !== -1) return false;
          return face !== 'tiles' || (!!row && row.active === true);
        } });
    });

    root.refresh = function () { if (made) made.refresh(); };
    // Destroy lets its parts go, their watches with them, and takes itself out of its container, which it leaves empty.
    root.destroy = function () {
      gone = true;
      watches.forEach(function (off) { off(); });
      watches = [];
      if (stack) stack.destroy();
      stack = null;
      clearDetail();
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/appSelector.js', { create: function (container, options) { var root = createAppSelector(options); container.appendChild(root); return root; } }); });
})();
