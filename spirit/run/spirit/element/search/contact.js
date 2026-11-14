'use strict';
// spirit/run/spirit/element/search/contact.js
// ONE SHELL ELEMENT: the contact selector, the peer picker apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spirit.element,
//   which the shell hands to apps at mount as api.ui.element.
//
// A THIN SELECTOR OVER THE ONE CONTACT LIST, spirit/element/search/contact/listElement.js, WHICH IT LOADS ITSELF (rule/26),
// in its dropdown and in its pane (goal/G43.32; Andy: "contact: there should be only 1 list, i didn't even know there where
// two....", "all, any search-unit has ONE list shared by popup and list modes."). Until then it drew a list of its own; what
// that list alone did (any ID table, the caller's hidden filters, a mark column) the contact list does now. Its contract and
// its test: ./test/contact.md and ./test/contact.js.
//
//   spirit.element.spirit.element.search.contact.create(container, options) -> root
//     root.value   the chosen key, '' while none is; root.row the chosen row, null while none is; one bubbling `change` on
//                  a pick; refresh() asks again; mark(key, status) repaints that row's mark from what the list holds, never
//                  asking the node
//     options.face        'pane' is the list itself, a press picking; the default is the dropdown: the chosen name in a closed
//                         field, the list dropping down under it
//     options.details(row, key, el)   a pane's press instead of a pick
//     options.statuses    [{status, glyph}], the first the default (goal/G4.14): the mark column (Chat's ⌛)
//     options.filters     the caller's hidden filters (Chat's offered peers)
//     options.table, options.key, options.label, options.data   an ID table of the shadow roll's shape (goal/G41.13), its
//                         rows the list's own of that table (the grants panel's ID selectors)
//     options.placeholder, options.all, options.empty, options.className   handed to the list or its root
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/contact/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  function createContactSelector(options) {
    var o = options || {};
    var isPane = o.face === 'pane';
    var root = document.createElement('div');
    // A LIST GETS A BOX OF A STATED SIZE (rule/16): the pane face fills the box it is mounted in, its list scrolling inside.
    root.className = 'contact-selector ' + (isPane ? 'contact-selector-face-pane fill' : 'contact-selector-face-dropdown') +
      (o.className ? ' ' + o.className : '');
    // Its box declares its constraint (goal/G47.1, -browser): what it holds stays inside; a dropdown's list is a popover, above it.
    if (root.style) root.style.overflow = 'hidden';
    root.value = '';
    root.row = null;
    var made = null;
    var gone = false;
    var marked = [];
    function pick(row, key) {
      root.value = row ? String(key || row.key || '') : '';
      root.row = row || null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the one contact list, and what that list draws with, before it draws it.
    Promise.all(['spirit/element/search/contact/listElement.js', 'spirit/element/search.js', 'spirit/element/rowElement.js',
      'spirit/element/search/contact/rowElement.js'].map(function (p) { return window.spirit.require(p); }).concat([window.spirit.cacheManager('contact')])).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.contact.listElement.create(root, {
        face: isPane ? 'pane' : 'dropdown',
        placeholder: isPane ? '' : (o.placeholder || 'choose a contact…'),
        all: isPane ? undefined : o.all,
        table: o.table, key: o.key, label: o.label, data: o.data,
        filters: o.filters,
        statuses: o.statuses,
        // A pane's press picks, unless its caller opens something itself.
        details: typeof o.details === 'function' ? o.details : null,
        empty: o.empty,
        pick: pick,
      });
      // Marks said before the list was here, said now.
      marked.forEach(function (m) { made.mark(m[0], m[1]); });
      marked = [];
    });

    root.refresh = function () { if (made) made.refresh(); };
    root.mark = function (key, status) { if (made) made.mark(key, status); else marked.push([key, status]); };
    // Its list destroyed with it (rule/8: what an element subscribes, its destroy lets go), and it takes itself out of its
    // container, which it leaves empty (goal/G41.19, box v23).
    root.destroy = function () {
      gone = true;
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): create(container,
  // options) appends the control to the container and answers it.
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/contact.js', { create: function (container, options) { var root = createContactSelector(options); container.appendChild(root); return root; } }); });
})();
