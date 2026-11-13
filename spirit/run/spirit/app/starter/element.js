'use strict';
// spirit/run/spirit/app/starter/element.js
// THE SMALLEST APP, IN THE SHAPE OF spirit/app/ (goal/G43.27). Andy: "cw, you bring deskClient and ... into
// spirit/app/ under their old names, do the backup as well (and fix it) and starter as well". Copy this folder to begin:
// ./starter.json says what it is, and this file is its face.
//
//   spirit.element.spirit.app.starter.element.create(container, { title, open }) -> { destroy() }
//
// It asks the node it runs on for its card (node.card), through the one spirit object, and shows its name and its
// description. That is all it does.
(function () {
  var S = window.spirit = window.spirit || {};

  function row(label, value) {
    var d = document.createElement('div');
    var b = document.createElement('b');
    var s = document.createElement('span');
    b.textContent = label + ': ';
    s.textContent = value;
    d.appendChild(b);
    d.appendChild(s);
    return d;
  }

  function create(container) {
    var gone = false;
    var box = document.createElement('div');
    box.className = 'stack';
    box.textContent = 'asking this node what it is…';
    container.innerHTML = '';
    container.appendChild(box);
    S.outcome(Promise.resolve(S.ready).then(function (s) { return s.node.card({}); })).then(function (r) {
      if (gone) return;
      box.textContent = '';
      var card = r && r.status === 200 ? r.body : null;
      if (!card) { box.appendChild(row('refused', String((r && r.body && r.body.error) || 'no answer'))); return; }
      box.appendChild(row('node', String(card.name || '')));
      box.appendChild(row('description', String(card.description || '')));
    });
    return { destroy: function () { gone = true; container.innerHTML = ''; } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/starter/element.js', { create: create }); });
}());
