// spirit/run/shell/js/workBench.js
// THE WORKBENCH (goal/G41.1): an app's top-level visual container. Three panes side by side, left, centre and right,
// with a vertical icon strip along the window's left edge and another along its right edge, after goal/G7's vision:
// "clicking the shown tab's icon collapses its pane; another icon, or any icon while collapsed, shows that content",
// and a movable border between each side pane and the centre. Its contract and its test: ./test/workBench.md and
// ./test/workBench.js.
//
//   window.spirit.elements.workBench.create(container, { left, right }) -> { center, press, shown, width, destroy }
//     left, right    [{ name, icon, title, mount(box) }]: a tool's mount is called once, the first time it shows, with a
//                    box of its own inside its side's pane; the box is kept, so a tool shown again keeps what it drew
//     center         the centre pane's box, the one the app draws into
//     press(side, name)   what a click on that strip's icon does: shows the tool, or collapses the side when it shows
//     shown(side)    the name of the tool shown on that side, '' while that side is collapsed
//     width(side)    that side pane's width in pixels
//
// SPACE IS GRANTED TOP-DOWN (rule/16): the root takes the shell's fill class and the container is never sized here; the
// app hands it a box of the whole app area. One listener per event type, on the container; a drag's moves are heard on
// the document while the pointer is down, and not after.
(function () {
  var MIN_WIDTH = 120;
  var START_WIDTH = 240;
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function create(container, opts) {
    var o = opts || {};
    var pre = 'wb' + (++made) + '-';
    var sides = { left: Array.isArray(o.left) ? o.left : [], right: Array.isArray(o.right) ? o.right : [] };
    var shownTool = { left: '', right: '' };
    var boxes = { left: {}, right: {} };
    var widths = { left: START_WIDTH, right: START_WIDTH };
    var gone = false;
    var drag = null;

    function strip(side) {
      return '<div id="' + pre + 'strip-' + side + '" style="display:flex;flex-direction:column;gap:6px;padding:4px">' +
        sides[side].map(function (t) {
          return '<button type="button" data-side="' + side + '" data-tool="' + esc(t.name) + '" title="' + esc(t.title) + '" style="font-size:20px">' + esc(t.icon) + '</button>';
        }).join('') + '</div>';
    }
    function pane(side) { return '<div id="' + pre + 'pane-' + side + '" style="width:' + widths[side] + 'px;overflow:auto"></div>'; }
    function border(side) { return '<div id="' + pre + 'border-' + side + '" data-border="' + side + '" style="width:5px;cursor:col-resize;background:var(--line, #ccc)"></div>'; }
    container.innerHTML = '<div class="fill" style="flex-direction:row">' +
      (sides.left.length ? strip('left') + pane('left') + border('left') : '') +
      '<div id="' + pre + 'center" class="fill" style="overflow:auto"></div>' +
      (sides.right.length ? border('right') + pane('right') + strip('right') : '') + '</div>';
    function part(name) { return container.querySelector('#' + pre + name); }

    function toolOf(side, name) { return (sides[side] || []).filter(function (t) { return t.name === name; })[0] || null; }
    function show(side, name) {
      var t = toolOf(side, name);
      var p = part('pane-' + side);
      if (!t || !p) return;
      shownTool[side] = name;
      p.hidden = false;
      p.style.width = widths[side] + 'px';
      if (!boxes[side][name]) {
        var box = document.createElement('div');
        boxes[side][name] = box;
        p.appendChild(box);
        try { t.mount(box); } catch (e) { /* one tool's fault */ }
      }
      Object.keys(boxes[side]).forEach(function (k) { boxes[side][k].hidden = k !== name; });
    }
    function press(side, name) {
      if (gone || !toolOf(side, name)) return;
      if (shownTool[side] === name) { shownTool[side] = ''; var p = part('pane-' + side); if (p) p.hidden = true; return; }
      show(side, name);
    }

    function onClick(e) {
      var b = e && e.target && e.target.closest ? e.target.closest('[data-tool]') : null;
      if (b) press(b.getAttribute('data-side'), b.getAttribute('data-tool'));
    }
    // A DRAG OF A BORDER: to the right widens the left pane, to the left the right one; never below MIN_WIDTH.
    function onMove(e) {
      if (!drag || gone) return;
      var moved = Number(e.clientX) - drag.x;
      widths[drag.side] = Math.max(MIN_WIDTH, drag.width + (drag.side === 'left' ? moved : -moved));
      var p = part('pane-' + drag.side);
      if (p) p.style.width = widths[drag.side] + 'px';
      if (e.preventDefault) e.preventDefault();
    }
    function onUp() {
      drag = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    function onDown(e) {
      var b = e && e.target && e.target.closest ? e.target.closest('[data-border]') : null;
      if (!b || gone) return;
      var side = b.getAttribute('data-border');
      drag = { side: side, x: Number(e.clientX), width: widths[side] };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      if (e.preventDefault) e.preventDefault();
    }
    container.addEventListener('click', onClick);
    container.addEventListener('pointerdown', onDown);

    // At start each side shows its first tool.
    ['left', 'right'].forEach(function (side) { if (sides[side][0]) show(side, sides[side][0].name); });

    return {
      center: part('center'),
      press: press,
      shown: function (side) { return shownTool[side] || ''; },
      width: function (side) { return widths[side]; },
      destroy: function () {
        gone = true;
        onUp();
        container.removeEventListener('click', onClick);
        container.removeEventListener('pointerdown', onDown);
        container.innerHTML = '';
      },
    };
  }

  var root = typeof window !== 'undefined' ? window : globalThis;
  root.spirit = root.spirit || {};
  root.spirit.elements = root.spirit.elements || {};
  root.spirit.elements.workBench = { create: create };
}());
