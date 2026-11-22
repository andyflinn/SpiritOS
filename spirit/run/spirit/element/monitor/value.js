'use strict';
// spirit/run/spirit/element/monitor/value.js
// A VALUE TILE (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/value.js: a value tile, mounted with an icon, a
// label, a value and a mode; its value can be set again later. The mode defaults to tile; row comes later."). The tile the spirit monitor drew six times, taken out, so each
// figure is an element of its own (./job/*.js) and later families' tiles take the same shape. Its contract and its test:
// ./test/value.md and ./test/value.js.
//
//   spirit.required.spirit.element.monitor.value.create(container, { icon, label, value, mode }) -> { set(value), destroy() }
//     mode         how it is shown: tile, the default. Row comes later (the box); until it does, a mode it does not know is
//                  drawn as a tile
//     set(value)   writes the value again, as text, every time, a value the same as before too: a tile that fills itself from
//                  a stream redraws on every change written into what it watches (spirit-sibling-browser.js)
//
// Its look is the shared tile's: .stat-tile, its icon the icon element, then .value and .label.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the icon element, asked as this file runs.
  var parts = Promise.resolve(S.require('spirit/element/icon.js'));

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var tile = document.createElement('div');
    tile.className = 'stat-tile';
    tile.style.overflow = 'hidden';
    tile.setAttribute('data-tile', String(o.label == null ? '' : o.label));
    tile.setAttribute('data-mode', 'tile');
    var value = document.createElement('div');
    value.className = 'value';
    value.textContent = o.value == null ? '–' : String(o.value);
    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = o.label == null ? '' : String(o.label);
    tile.appendChild(value);
    tile.appendChild(label);
    container.appendChild(tile);
    parts.then(function () {
      if (gone) return;
      var holder = document.createElement('span');
      S.required.spirit.element.icon.create(holder, { glyph: o.icon == null ? '' : String(o.icon), size: 1.5 });
      while (holder.firstChild) tile.insertBefore(holder.firstChild, value);
    });
    return {
      set: function (v) { if (!gone) value.textContent = v == null ? '–' : String(v); },
      destroy: function () {
        gone = true;
        if (tile.parentNode) tile.parentNode.removeChild(tile);
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/element/monitor/value.js', { create: create }); });
}());
