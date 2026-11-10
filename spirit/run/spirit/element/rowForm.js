'use strict';
// spirit/run/spirit/element/rowForm.js
// THE ONE-ROW FORM, A SHELL ELEMENT (goal/G41.27). Andy, box: "new shell element: rowForm", "one row forms show as blocks
// taking up the full width of their container, and wrap, if it's form elements don't have enough space.", "they form a
// bubble with transparent background, and a border with the color of the type-face. The bubble is one shared style, the
// same probabilitySearch's search bubble uses.", "the first element is always an icon shell-element", "the last element
// is always a button", "between the icon and the button is a span, into which the form elements can be dropped.", and
// "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it." Its contract and
// its test: ./test/rowForm.md and ./test/rowForm.js.
//
//   spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }
//     icon the glyph, button the button's words. The mounter drops its form elements into span and wires button itself
//     (a busyButton or a click): the form sends nothing.
//
// Its look is shell.css's: the bubble (.shell-bubble) and the row (.shell-row-form).
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the icon element, asked as this file runs, so whoever requires the
  // form is answered once it is in.
  if (window.spirit && typeof window.spirit.require === 'function') window.spirit.require('spirit/element/icon.js');
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};

  function create(container, options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'shell-bubble shell-row-form';
    E.spirit.element.icon.create(root, { glyph: o.icon == null ? '' : String(o.icon) });
    var span = document.createElement('span');
    span.className = 'shell-row-form-span';
    root.appendChild(span);
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = o.button == null ? '' : String(o.button);
    root.appendChild(button);
    container.appendChild(root);
    return { root: root, span: span, button: button };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/rowForm.js', { create: create }); });
}());
