'use strict';
// spirit/run/spirit/app/starter/element.js
// THE SMALLEST APP, IN THE SHAPE OF spirit/app/ (goal/G43.27). Andy: "cw, you bring deskClient and ... into
// spirit/app/ under their old names, do the backup as well (and fix it) and starter as well". Copy this folder to begin:
// ./starter.json says what it is, and this file is its face.
//
//   spirit.required.spirit.app.starter.element.create(container, { title, open }) -> { destroy() }
//
// It asks the node it runs on for its card (node.card), through the one spirit object, and shows its name and its
// description. That is all it does.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/node/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
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
    // ITS BOX KEEPS WHAT IT HOLDS INSIDE IT, AT THE SIZE IT IS GIVEN (goal/G47.1, -browser: overflow not visible, and it
    // never grows its box): a fill box (rule/16), a long card scrolling inside it.
    box.className = 'fill stack';
    box.style.overflow = 'auto';
    box.textContent = 'asking this node what it is…';
    container.innerHTML = '';
    container.appendChild(box);
    S.callOutcome(Promise.resolve(S.readyPromise).then(function () { return S.requireScript('spirit/node/api.js'); }).then(function (s) { return s.card({}); })).then(function (r) {
      if (gone) return;
      box.textContent = '';
      var card = r && r.status === 200 ? r.body : null;
      if (!card) { box.appendChild(row('refused', String((r && r.body && r.body.error) || 'no answer'))); return; }
      box.appendChild(row('node', String(card.name || '')));
      box.appendChild(row('description', String(card.description || '')));
    });
    return { destroy: function () { gone = true; container.innerHTML = ''; } };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
