// spirit/run/shell/js/icon.js
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
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};

  function create(container, options) {
    var o = options || {};
    var size = Number(o.size) > 0 ? Number(o.size) : 1;
    var el = document.createElement('span');
    el.className = 'shell-icon';
    if (size !== 1) el.style.fontSize = size + 'em';
    el.textContent = o.glyph == null ? '' : String(o.glyph);
    container.appendChild(el);
    return el;
  }

  E.icon = { create: create };
}());
