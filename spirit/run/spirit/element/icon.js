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
// Each glyph is measured once, on one canvas never in the page, before it is shown, and the answer kept.
(function () {
  var E = ((window.spirit = window.spirit || {}).required = window.spirit.required || {});
  // THE ONE MEASURING SCREEN: a canvas never put in the page, the glyph measured on it at 100 px in the page's font, its
  // width against the 100 px of its square. A canvas measures text without laying out the page; a hidden box in the page
  // made the page lay itself out again for every new glyph, and the icon list, some 800 glyphs, hung its page (the -browser
  // test killed it past its second).
  var REF = 100;
  var fits = Object.create(null);
  var pen = null;
  var font = '';
  // ONE EMOJI STANDS FOR EVERY EMOJI: an emoji font draws each about as wide as the next, and a canvas finding the font for each
  // new one took a millisecond, 800 of them most of a second. A glyph that is one emoji (with its joiners, its variation
  // selector and its skin tone) takes the measure of one, made once; any other glyph is measured itself.
  var PICTO = /\p{Extended_Pictographic}/gu;
  function oneEmoji(glyph) {
    var n = (glyph.match(PICTO) || []).length - (glyph.match(/\u200D/g) || []).length;
    return n === 1 && glyph.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu, '') === '';
  }
  function fitOf(glyph) {
    if (!glyph) return 1;
    if (oneEmoji(glyph)) glyph = '\u{1F600}';
    if (fits[glyph] !== undefined) return fits[glyph];
    var doc = typeof document !== 'undefined' ? document : null;
    if (!pen) {
      var c = doc && typeof doc.createElement === 'function' ? doc.createElement('canvas') : null;
      pen = c && typeof c.getContext === 'function' ? c.getContext('2d') : null;
      if (!pen) return 1;
      var body = doc.body || doc.documentElement;
      var family = body && typeof getComputedStyle === 'function' ? getComputedStyle(body).fontFamily : '';
      font = REF + 'px ' + (family || 'sans-serif');
    }
    pen.font = font;
    var w = pen.measureText(glyph).width;
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

  window.spirit.requireScript('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/icon.js', { create: create }); });
}());
