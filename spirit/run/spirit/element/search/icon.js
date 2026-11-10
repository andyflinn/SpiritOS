'use strict';
// spirit/run/spirit/element/search/icon.js
// THE ICON SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, spirit/element/search/icon/listElement.js, WHICH IT LOADS ITSELF
// (rule/26). Andy, goal/G43.32: "any search-unit has ONE list shared by popup and list modes." It was a dropdown of its own,
// drawing rows of its own from the list's glyph set; now the field and its popup are that list's dropdown, the same rows the
// Icons app's pane shows. The box: "every branch's search is search/<branch>.js, the selector, and its folder holds
// listElement.js, rowElement.js and detailElement.js". Its test: ./test/icon.js.
//
//   spirit.element.spirit.element.search.icon.create(container, options) -> root
//     root.value     the glyph chosen, the value it was made with until one is (goal/G41.1: a glyph, never a key)
//     root.row       the icon chosen, { glyph, keywords }, null until one is
//     one bubbling `change` on a pick; refresh(), redraw(), destroy() as the list's
//     options.value    the glyph it shows at first, in the closed field
//     options.exclude  glyphs already spoken for, kept off the list (glyphs, not keys: what collides is the picture)
//     options.face     'pane' or the default 'dropdown'; options.placeholder, options.all, options.empty as the list's
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its list, as this file runs, so a caller's require waits for it.
  window.spirit.require('spirit/element/search/icon/listElement.js');
  function create(container, options) {
    var o = options || {};
    var exclude = Array.isArray(o.exclude) ? o.exclude.map(String) : [];
    var root = document.createElement('div');
    root.className = 'icon-selector';
    root.value = String(o.value || '');
    root.row = null;
    container.appendChild(root);
    var list = window.spirit.element.spirit.element.search.icon.listElement.create(root, {
      face: o.face === 'pane' ? 'pane' : 'dropdown',
      // The glyph it holds shows in the closed field until a pick names another.
      placeholder: root.value || o.placeholder,
      all: o.all,
      empty: o.empty,
      visible: exclude.length ? function (row) { return !row || exclude.indexOf(String(row.glyph || row.key || '')) === -1; } : undefined,
      pick: function (row, glyph) {
        root.value = String(glyph || '');
        root.row = row || null;
        root.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    root.refresh = function () { list.refresh(); };
    root.redraw = function () { list.redraw(); };
    // Destroy lets its list go, the list's watches with it, and takes itself out of its container.
    root.destroy = function () { list.destroy(); if (root.parentNode) root.parentNode.removeChild(root); };
    return root;
  }
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/icon.js', { create: create }); });
}());
