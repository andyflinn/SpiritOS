'use strict';
// spirit/run/spirit/element/script.js
// THE ONE SHELL OF SpiritOS (goal/G49.4; Andy: "spirit/element/script.js becomes the hard-coded only shell there is in SpiritOS"):
// moved here from spirit/app/app/element.js, the app app gone with every shell choice.
// THE APP SELECTOR (goal/G43.2; Andy, box: "the face part of this api will be an probabilitySearch derivative"), following
// spirit/element/search/bundle/script.js.
//
// A THIN SELECTOR OVER THE APP LIST, spirit/element/search/app/script.js, WHICH IT LOADS ITSELF (rule/26).
//
//   spirit.required.spirit.element.create(container, options) -> root
//     root.value   the chosen app's key, '' while none is
//     root.row     the chosen app, null while none is
//     one bubbling `change` on a pick, which shows that app's detail under the list; refresh() asks again
//     options.face 'pane' is the list itself, 'tiles' the apps as tiles, 'dropdown' the dropdown
//     (options.toggle went, goal/G47.4: the app search has a tile part, so its list or tiles switch is there by itself)
//     options.hide   app keys left out of every face, beside app itself, which is never listed (goal/G43.18; Andy: "the shell
//                    should exclude itself completely from the app-list")
//   No options is the app mounted as an app or a shell (boot.js, a launch): the tiles, with the list or tiles switch, as the shell app drew it.
//
// ONE SELECTOR, THREE FACES (goal/G43.9; Andy, box: "One appSelector, with three faces: dropdown, pane and tiles."): "tiles
// shows active only, pane shows all", "and the picks differ: tiles launches, pane shows the detail with its button." Both open on
// top, here alone (Andy: "the detail panel needs to open on top of the whole container"), under one title bar, whose close
// button brings the list back. A launched app is its main element, spirit/app/<key>/element.js (goal/G43.32, rule 4: "if the
// application has a face, its main screen element must be spirit/app/[name]/element.js"), made with (pane, { title, open }).
//
// THROUGH panel (goal/G43.17, spirit/element/panel/script.js): a closed app or detail is hidden, not destroyed, so pressing it again
// shows it as it was left (Q3: "yes."). A launched app switched off leaves the view and stays loaded until the shell boots
// again (Q11: "it only must disappear from view. it won't be loaded on the next shell-boot.").
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the app
  // family's cache, whose rows a layer's bar follows, is its app.data; asked as this file runs.
  function apps() { return window.spirit.dataStore.app.data; }
  function createAppSelector(options) {
    var o = options || { face: 'tiles' };
    var hide = ['app'].concat(Array.isArray(o.hide) ? o.hide : []);
    var face = o.face === 'pane' || o.face === 'tiles' ? o.face : 'dropdown';
    var isPane = face !== 'dropdown';
    var root = document.createElement('div');
    // A LIST GETS A BOX OF A STATED SIZE (rule/16): the pane face fills the box it is mounted in, its list scrolling inside.
    root.className = 'app-selector ' + (isPane ? 'app-selector-face-pane fill' : 'app-selector-face-dropdown');
    // ITS BOX KEEPS WHAT IT HOLDS INSIDE IT (goal/G47.1, -browser: the box declares overflow not visible); the list scrolls itself.
    if (isPane) root.style.overflow = 'hidden';
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
      // AN APP WITH A SERVER GETS ITS REMOTE DROPDOWN IN THE BAR (goal/G47.5, box v12: "the Remote element shows only on apps
      // that have a server"): the layer is handed the server's name, the app's own; an app with none, and a detail, none.
      var spec = { icon: row.icon, label: row.label, fill: fill };
      // No remote where the app's manifest refuses client mode (goal/G49.8: node.remote false, its row's nodeRemote).
      if (kind === 'app' && row.nodeMount === true && row.nodeRemote !== false) spec.remote = key;
      Promise.resolve(stack.open(kind + '/' + key, spec)).then(function (layer) {
        if (!layer || gone) return;
        if (look) {
          look.set = function () { layer.set(barOf(apps().rows()[key] || row, look)); };
          if (look.file) look.set();
        }
        watches.push(apps().watch(key, function (now) {
          if (!now) return;
          layer.set(barOf(now, look));
          // Q11: a launched app switched off leaves the view; it stays loaded.
          if (kind === 'app' && now.active !== true && layer.shown()) layer.hide();
        }));
      });
    }
    function launch(row) {
      var S = window.spirit;
      // The row's key is the app's id, its folder's path in dots (goal/G49.19); its folder by spirit.slashedPath.
      var name = String(row.key);
      var dir = S.slashedPath(name);
      var look = {};
      function title(t) { look.file = t && t.file; look.icon = t && t.icon; if (look.set) look.set(); }
      open('app', row, function (pane, closed) {
        return S.requireScript(dir + '/element.js').then(function (got) {
          if (closed()) return null;
          // What the app opens goes in this same stack, over all of it (panel.js: one stack, each ✕ one step back).
          var over = function (k, spec) { return stack ? stack.open('app/' + name + '/' + k, spec) : Promise.resolve(null); };
          var made = got && typeof got.create === 'function' ? got : null;
          if (!made) throw new Error(dir + '/element.js places no element with a create');
          return made.create(pane, { title: title, open: over });
        });
      }, look);
    }
    // AN APP'S DETAIL COMES WHEN ONE OPENS (goal/G43.27; Andy: "make sure that spirit.js does NOT load all that shit!!!!!!!!!"):
    // detail.js and what it draws with are required then, once, and not as the list loads.
    function detailReady() { return keepAnswer('spirit/element/search/app/detail/script.js'); }
    function panel(row) {
      open('detail', row, function (pane, closed) {
        return detailReady().then(function () { return closed() ? null : ANSWER['spirit/element/search/app/detail/script.js'].create(pane, { row: row, panel: true }); });
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
        detail = ANSWER['spirit/element/search/app/detail/script.js'].create(detailBox, { row: row });
      });
    }
    function onFace(now) {
      face = now;
      clearDetail();
      if (stack) stack.close();
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.all([keepAnswer('spirit/element/search/app/script.js'), keepAnswer('spirit/element/panel/script.js')]).then(function () {
      if (gone) return;
      // A list's box is a flex box, so the panel covers it by its display.
      stack = ANSWER['spirit/element/panel/script.js'].create(root, listBox);
      made = ANSWER['spirit/element/search/app/script.js'].create(listBox, { face: face, onFace: onFace, pick: pick,
        // The filter is on the page, on the row's active (the box): app.search stays "just a search string".
        // The keys left out of every face, app itself always (goal/G43.18; Andy: "the shell should exclude itself completely
        // from the app-list").
        visible: function (row) {
          if (row && hide.indexOf(String(row.key || '')) !== -1) return false;
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: function (container, options) { var root = createAppSelector(options); container.appendChild(root); return root; } };
})();
