// spirit/run/shell/js/tabContainer.js
// THE TAB CONTAINER (goal/G41.1): one row of tabs at the top, the selected tab's content in the vertical space left
// below it. Other apps with tabs catch up with it later. Its contract and its test: ./test/tabContainer.md and
// ./test/tabContainer.js.
//
//   window.spirit.elements.tabContainer.create(container, { tabs, selected }) -> { select, selected, destroy }
//     tabs       [{ name, label, mount(box) }]: a tab's mount is called once, the first time it is selected, with a box
//                of its own inside the content area; the box is kept, and only the selected tab's box shows
//     selected   the tab shown first; the first tab when it names none
//
// THE CONTENT IS A BUBBLE (goal/G41.13; Andy: "the container pain of the tabs content, must have our standard 0.5em
// padding", "it must occupy all remaining vertical space, that it must be constrained to", "it should present as a bubble
// of of darker green than already is on the page"): the class tab-content, its look in shell.css.
//
// SPACE IS GRANTED TOP-DOWN (rule/16): the root and the content area take the shell's fill class, so the content gets
// the height the row leaves; the container is never sized here. One listener, on the container.
(function () {
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function create(container, opts) {
    var o = opts || {};
    var pre = 'tc' + (++made) + '-';
    var tabs = Array.isArray(o.tabs) ? o.tabs : [];
    var current = tabs.some(function (t) { return t.name === o.selected; }) ? o.selected : (tabs[0] ? tabs[0].name : '');
    var boxes = {};
    var gone = false;

    function rowHtml() {
      return tabs.map(function (t) {
        return '<button type="button" data-tab="' + esc(t.name) + '" aria-selected="' + (t.name === current ? 'true' : 'false') + '"' +
          (t.name === current ? ' style="font-weight:bold"' : '') + '>' + esc(t.label) + '</button>';
      }).join(' ');
    }
    container.innerHTML = '<div class="fill"><div id="' + pre + 'tabs" style="display:flex;gap:6px">' + rowHtml() + '</div>' +
      '<div id="' + pre + 'content" class="tab-content fill"></div></div>';
    function part(name) { return container.querySelector('#' + pre + name); }

    // The row is drawn again for its marks; the content area and the boxes in it stay as they are.
    function markRow() { var row = part('tabs'); if (row) row.innerHTML = rowHtml(); }
    function select(name) {
      if (gone) return;
      var t = tabs.filter(function (x) { return x.name === name; })[0];
      if (!t) return;
      current = name;
      markRow();
      if (!boxes[name]) {
        var box = document.createElement('div');
        // The tab's box takes the height the content area holds, so a list in it fills it (rule/16).
        box.className = 'fill';
        boxes[name] = box;
        var content = part('content');
        if (content) content.appendChild(box);
        try { t.mount(box); } catch (e) { /* one tab's fault */ }
      }
      Object.keys(boxes).forEach(function (k) { boxes[k].hidden = k !== name; });
    }
    function onClick(e) {
      var b = e && e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) select(b.getAttribute('data-tab'));
    }
    container.addEventListener('click', onClick);
    if (current) select(current);

    return {
      select: select,
      selected: function () { return current; },
      destroy: function () {
        gone = true;
        container.removeEventListener('click', onClick);
        container.innerHTML = '';
      },
    };
  }

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.spirit = root.spirit || {};
  root.spirit.elements = root.spirit.elements || {};
  root.spirit.elements.tabContainer = { create: create };
}());
