// spirit/run/shell/js/workBench.js
// THE WORKBENCH (goal/G41.1): an app's top-level visual container. Three panes side by side, left, centre and right,
// with a vertical icon strip along the window's left edge and another along its right edge, after goal/G7's vision:
// "clicking the shown tab's icon collapses its pane; another icon, or any icon while collapsed, shows that content",
// and a movable border between each side pane and the centre. Its contract and its test: ./test/workBench.md and
// ./test/workBench.js.
//
//   window.spirit.elements.workBench.create(container, { left, right, changed }) -> { center, press, shown, width, destroy }
//     left, right    [{ name, icon, title, mount(box) }]: a tool's mount is called once, the first time it shows, with a
//                    box of its own inside its side's pane; the box is kept, so a tool shown again keeps what it drew
//     changed(side, name)  optional: called each time the tool shown on a side changes, name '' when the side collapses
//                    (Andy, on G41.4: "if the current \"icon\" is changed the content of a left-strip icon should
//                    disappear from the middle workBench Pane": the app empties what the old tool put in the centre)
//     center         the centre pane's box, the one the app draws into
//     press(side, name)   what a click on that strip's icon does: shows the tool, or collapses the side when it shows
//     shown(side)    the name of the tool shown on that side, '' while that side is collapsed
//     width(side)    that side pane's width in pixels
//
// SPACE IS GRANTED TOP-DOWN (rule/16): the root takes the shell's fill class and the container is never sized here; the
// app hands it a box of the whole app area. One listener per event type, on the container; a drag's moves are heard on
// the document while the pointer is down, and not after.
//
// NO INHABITANT MOVES A BORDER (Andy, on G41.4: "should not the workBench component ensure that it's inhabitants are
// not able to shift pane boundaries in a proper design?", then "do the proper fix."): the strips, the side panes and
// the borders never grow or shrink (flex: none), so a side pane is the width it was given or dragged to; the centre
// takes what is left and never more (min-width: 0), so a wide child scrolls or wraps inside it.
//
// ITS PANES PAD THEIR INHABITANTS (Andy, on G41.4: "should not the workBench element have some padding-left and
// padding-right of about 0.5em?"): the side panes and the centre each 0.5em left and right, inside the width they are
// given (box-sizing: border-box), so no app pads its own.
//
// THE SHOWN TOOL'S ICON IS MARKED (Andy, on G41.4: "the current left-strip icon should be highlighted, may be with a
// lightly brighter background color"): on each strip the icon of the tool shown carries data-current, a brighter
// background and a dark border, the others none; a collapsed side marks none.
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
      return '<div id="' + pre + 'strip-' + side + '" style="flex:none;display:flex;flex-direction:column;gap:6px;padding:4px">' +
        sides[side].map(function (t) {
          return '<button type="button" data-side="' + side + '" data-tool="' + esc(t.name) + '" title="' + esc(t.title) + '" style="font-size:20px">' + esc(t.icon) + '</button>';
        }).join('') + '</div>';
    }
    var PAD = 'box-sizing:border-box;padding-left:0.5em;padding-right:0.5em';
    // A PANE IS A BOX OF A STATED SIZE (rule/16; Andy, on G41.18: "ALL lists, otherwise my took bars at the top of a
    // container keep scrolling away...."): a side pane is a column as tall as the bench (class fill, its own width kept
    // by flex: none), and each tool's box in it a fill too, so a list inside scrolls in itself under its title and
    // buttons. What overflows a tool that is no list still scrolls the pane.
    function pane(side) { return '<div id="' + pre + 'pane-' + side + '" class="fill" style="flex:none;width:' + widths[side] + 'px;overflow:auto;' + PAD + '"></div>'; }
    function border(side) { return '<div id="' + pre + 'border-' + side + '" data-border="' + side + '" style="flex:none;width:5px;cursor:col-resize;background:var(--line, #ccc)"></div>'; }
    container.innerHTML = '<div class="fill" style="flex-direction:row;min-width:0">' +
      (sides.left.length ? strip('left') + pane('left') + border('left') : '') +
      '<div id="' + pre + 'center" class="fill" style="overflow:auto;min-width:0;' + PAD + '"></div>' +
      (sides.right.length ? border('right') + pane('right') + strip('right') : '') + '</div>';
    function part(name) { return container.querySelector('#' + pre + name); }

    function toolOf(side, name) { return (sides[side] || []).filter(function (t) { return t.name === name; })[0] || null; }
    // Brighter than the others and framed dark (Andy: "the current one should also have a dark border, right now it looks
    // more dead than the others, a bit brighter with a darker border").
    var CURRENT = 'var(--spirit-current, rgba(255,255,255,0.4))';
    var CURRENT_BORDER = '2px solid var(--spirit-current-border, rgba(0,0,0,0.75))';
    // The side's shown tool is now name ('' collapsed): its icon marked, the app told when it changed.
    function now(side, name) {
      var was = shownTool[side];
      shownTool[side] = name;
      var s = part('strip-' + side);
      if (s) Array.prototype.forEach.call(s.children || [], function (b) {
        if (!b || typeof b.getAttribute !== 'function' || b.getAttribute('data-tool') == null) return;
        var on = b.getAttribute('data-tool') === name;
        if (on) b.setAttribute('data-current', 'true'); else b.removeAttribute('data-current');
        b.style.background = on ? CURRENT : '';
        b.style.border = on ? CURRENT_BORDER : '';
      });
      if (was !== name && typeof o.changed === 'function') { try { o.changed(side, name); } catch (e) { /* the app's fault */ } }
    }
    function show(side, name) {
      var t = toolOf(side, name);
      var p = part('pane-' + side);
      if (!t || !p) return;
      now(side, name);
      p.hidden = false;
      p.style.width = widths[side] + 'px';
      if (!boxes[side][name]) {
        var box = document.createElement('div');
        box.className = 'fill';
        boxes[side][name] = box;
        p.appendChild(box);
        try { t.mount(box); } catch (e) { /* one tool's fault */ }
      }
      Object.keys(boxes[side]).forEach(function (k) { boxes[side][k].hidden = k !== name; });
    }
    function press(side, name) {
      if (gone || !toolOf(side, name)) return;
      if (shownTool[side] === name) { now(side, ''); var p = part('pane-' + side); if (p) p.hidden = true; return; }
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
