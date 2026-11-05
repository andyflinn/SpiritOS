// spirit/run/spirit/app/appSelector/rowFormToggle.js
// ONE ON/OFF SWITCH, A rowForm (goal/G43.15). Andy, box: "it acts exactly like the two toggle switches in
// appSelector:detailElement", "it is configurable with a description of what is being toggled." Its contract and its test:
// ./test/rowFormToggle.md and ./test/rowFormToggle.js.
//
//   spirit.elements.rowFormToggle.create(host, { on, words, press }) -> { root, set(on, words), destroy() }
//
// It draws the state it is handed, 🟢 with a 🔴 button when on, 🔴 with a 🟢 button when off, and the words beside. A press only
// calls press: the state changes when its owner says so, by set (rule/19: draw only what the server says).
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  window.spirit.require('spirit/element/rowForm.js');

  function create(host, options) {
    var o = options || {};
    var on = o.on === true;
    var words = String(o.words == null ? '' : o.words);
    var root = document.createElement('div');
    host.appendChild(root);
    // One form redrawn whole, as a form's icon is fixed when it is made.
    function draw() {
      root.innerHTML = '';
      var f = window.spirit.element.rowForm.create(root, { icon: on ? '🟢' : '🔴', button: on ? '🔴' : '🟢' });
      f.span.textContent = words;
      f.button.addEventListener('click', function () { if (typeof o.press === 'function') o.press(); });
    }
    draw();
    return {
      root: root,
      set: function (now, said) {
        on = now === true;
        if (said !== undefined) words = String(said == null ? '' : said);
        draw();
      },
      destroy: function () { host.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.rowFormToggle = { create: create };
}());
