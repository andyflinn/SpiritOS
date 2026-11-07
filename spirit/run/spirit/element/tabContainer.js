// spirit/run/spirit/element/tabContainer.js
// THE TAB CONTAINER (goal/G41.1): one row of tabs at the top, the selected tab's content in the vertical space left
// below it. Other apps with tabs catch up with it later. Its contract and its test: ./test/tabContainer.md and
// ./test/tabContainer.js.
//
//   window.spirit.element.tabContainer.create(container, { tabs, selected }) -> { select, selected, add, close, rename, destroy }
//     tabs       [{ name, label, mount(box), closable, italic }]: a tab's mount is called once, the first time it is selected, with
//                a box of its own inside the content area; the box is kept, and only the selected tab's box shows
//     selected   the tab shown first; the first tab when it names none
//     add(tab)   a tab added and made active; one of that name is made active, with no second tab and no second mount
//     close(name) that tab taken away, its box with it, and what its mount answered destroyed
//     rename(name, { name, label, italic }) a tab's name or header changed, what it holds kept (goal/G41.31: "<row-type>*" saved
//                becomes that row's tab, a label changed anywhere follows)
// CLOSABLE TABS (goal/G41.32; Andy: "the tabContainer will allow to add "closable" tabs, which have a little close button on
// the right side of the tab, like browser tabs."): the close button carries data-tab-close="<name>", its look in shell.css.
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
    var tabs = Array.isArray(o.tabs) ? o.tabs.slice() : [];
    var current = tabs.some(function (t) { return t.name === o.selected; }) ? o.selected : (tabs[0] ? tabs[0].name : '');
    var boxes = {};
    var mounted = {};
    var gone = false;

    function rowHtml() {
      return tabs.map(function (t) {
        // class tab-button: its look in shell.css, a tab's square bottom and the selected one's colour (goal/G41.13).
        var look = (t.name === current ? 'font-weight:bold;' : '') + (t.italic ? 'font-style:italic;' : '');
        return '<button type="button" class="tab-button" data-tab="' + esc(t.name) + '" aria-selected="' + (t.name === current ? 'true' : 'false') + '"' +
          (look ? ' style="' + look + '"' : '') + '>' + esc(t.label) +
          (t.closable ? '<span class="tab-close" role="button" aria-label="close" data-tab-close="' + esc(t.name) + '">✕</span>' : '') + '</button>';
      }).join(' ');
    }
    container.innerHTML = '<div class="fill"><div id="' + pre + 'tabs" style="display:flex;flex-wrap:wrap;gap:6px">' + rowHtml() + '</div>' +
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
        try { mounted[name] = t.mount(box); } catch (e) { /* one tab's fault */ }
      }
      Object.keys(boxes).forEach(function (k) { boxes[k].hidden = k !== name; });
    }
    function add(tab) {
      if (gone || !tab) return;
      if (!tabs.some(function (t) { return t.name === tab.name; })) tabs.push(tab);
      select(tab.name);
    }
    function close(name) {
      if (gone) return;
      var at = -1;
      tabs.forEach(function (t, i) { if (t.name === name) at = i; });
      if (at === -1) return;
      tabs.splice(at, 1);
      var made = mounted[name];
      delete mounted[name];
      try { if (made && typeof made.destroy === 'function') made.destroy(); } catch (e) { /* one tab's fault */ }
      if (boxes[name]) { boxes[name].remove(); delete boxes[name]; }
      // The selected tab closed: its neighbour shows. Another closed: the tab shown stays shown.
      if (current === name) {
        var next = tabs[at] || tabs[at - 1];
        current = next ? next.name : '';
        if (next) { select(next.name); return; }
      }
      markRow();
    }
    function rename(name, to) {
      if (gone || !to) return;
      var t = tabs.filter(function (x) { return x.name === name; })[0];
      if (!t) return;
      if (typeof to.label === 'string') t.label = to.label;
      if (to.italic !== undefined) t.italic = to.italic;
      if (typeof to.name === 'string' && to.name !== name) {
        t.name = to.name;
        if (boxes[name]) { boxes[to.name] = boxes[name]; delete boxes[name]; }
        if (name in mounted) { mounted[to.name] = mounted[name]; delete mounted[name]; }
        if (current === name) current = to.name;
      }
      markRow();
    }
    function onClick(e) {
      var x = e && e.target && e.target.closest ? e.target.closest('[data-tab-close]') : null;
      if (x) { close(x.getAttribute('data-tab-close')); return; }
      var b = e && e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) select(b.getAttribute('data-tab'));
    }
    container.addEventListener('click', onClick);
    if (current) select(current);

    return {
      select: select,
      selected: function () { return current; },
      add: add,
      close: close,
      rename: rename,
      destroy: function () {
        gone = true;
        container.removeEventListener('click', onClick);
        container.innerHTML = '';
      },
    };
  }

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.spirit = root.spirit || {};
  root.spirit.element = root.spirit.element || {};
  root.spirit.element.tabContainer = { create: create };
}());
