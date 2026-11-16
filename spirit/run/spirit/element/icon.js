'use strict';
// spirit/run/spirit/element/icon.js
// THE ICON ELEMENT (goal/G41.23, carried from goal/G41.21's box v9). Andy: "we will create a new shell element "icon", it
// centers the glyph, in a square box, the size of which follows font-size, it's size option should vary from that
// base-line, be a multiplier of it.", "no other option than size, like like text characters, it follows, its container
// in most attributes.", "the glyph IS the glyph, no key-abstraction.", and "this element will replace icons painting all
// shell elements and apps.". Its name is his too: "the new element is called "icon" singlular".
//
//   icon.create(container, { glyph, size }) -> the icon, appended to the container
//     glyph is shown as it is given; size multiplies the font size it inherits, 1 when not given.
//
// A span of class shell-icon (shell.css): a square of 1em in its own font size, size em of its container's, the glyph
// centred, never shrinking; its colour and everything else it takes from its container, as a text character does.
//
// SCALED TO FIT, MEASURED UNSEEN (goal/G47.1, Q22; Andy: "how about proportionally scale-to-fit?", "can the drawing not happen
// in a hidden (maybe global) screen for measurement?", then "cw, yes, build the icon that way."): a glyph wider than its
// square is drawn smaller, evenly, so the square holds it whole and keeps what it holds inside (shell.css: overflow hidden).
// Each glyph is measured once, in one hidden box for the whole page, before it is shown, and the answer kept.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // THE ONE MEASURING BOX: off screen, unseen, the glyph in it at 100 px, its width against the 100 px of its square.
  var REF = 100;
  var fits = Object.create(null);
  var meter = null;
  function fitOf(glyph) {
    if (!glyph) return 1;
    if (fits[glyph] !== undefined) return fits[glyph];
    var doc = typeof document !== 'undefined' ? document : null;
    var root = doc && (doc.body || doc.documentElement);
    if (!root || typeof root.appendChild !== 'function') return 1;
    if (!meter || !meter.isConnected) {
      meter = doc.createElement('span');
      if (!meter.style) return 1;
      meter.setAttribute('aria-hidden', 'true');
      meter.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;white-space:nowrap;line-height:1;font-size:' + REF + 'px';
      root.appendChild(meter);
    }
    meter.textContent = glyph;
    var w = typeof meter.getBoundingClientRect === 'function' ? meter.getBoundingClientRect().width : 0;
    var f = w > REF ? REF / w : 1;
    fits[glyph] = f;
    return f;
  }

  function create(container, options) {
    var o = options || {};
    var size = Number(o.size) > 0 ? Number(o.size) : 1;
    var el = document.createElement('span');
    el.className = 'shell-icon';
    if (size !== 1) el.style.fontSize = size + 'em';
    var glyph = o.glyph == null ? '' : String(o.glyph);
    var fit = fitOf(glyph);
    if (fit < 1) {
      // Drawn smaller inside its square, which keeps its own size.
      var inner = document.createElement('span');
      inner.style.fontSize = (Math.floor(fit * 1000) / 1000) + 'em';
      inner.textContent = glyph;
      el.appendChild(inner);
    } else el.textContent = glyph;
    container.appendChild(el);
    return el;
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/icon.js', { create: create }); });
}());
