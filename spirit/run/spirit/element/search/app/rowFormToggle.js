'use strict';
// spirit/run/spirit/element/search/app/rowFormToggle.js
// ONE ON/OFF SWITCH, A rowForm (goal/G43.15). Andy, box: "it acts exactly like the two toggle switches in
// appSelector:detail", "it is configurable with a description of what is being toggled." Its contract and its test:
// ./test/rowFormToggle.md and ./test/rowFormToggle.js.
//
//   spirit.required.spirit.element.search.app.rowFormToggle.create(host, { on, words, press }) -> { root, set(on, words), destroy() }
//
// It draws the state it is handed, 🟢 with a 🔴 button when on, 🔴 with a 🟢 button when off, and the words beside. A press only
// calls press, and the button is busy until what press answers settles: the state changes when its owner says so, by set
// (rule/19: draw only what the server says).
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  window.spirit.require('spirit/element/rowForm.js');

  function create(host, options) {
    var o = options || {};
    var on = o.on === true;
    var words = String(o.words == null ? '' : o.words);
    var root = document.createElement('div');
    // Its box keeps what it holds inside (spirit-sibling-browser.js: the box it puts into its container declares a constraint, overflow not visible).
    if (root.style) root.style.overflow = 'hidden';
    host.appendChild(root);
    // One form redrawn whole, as a form's icon is fixed when it is made.
    function draw() {
      root.innerHTML = '';
      // ITS PRESS IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
      // comes"): what the owner's press answers, the rowForm's button waits on, busy.
      var f = window.spirit.required.spirit.element.rowForm.create(root, { icon: on ? '🟢' : '🔴', button: '', press: function () { return typeof o.press === 'function' ? o.press() : undefined; } });
      // THE BUTTON'S GLYPH IS AN ICON TOO (goal/G43.32; Andy: "fix the fucking elements/pages."): painted through the icon
      // element, which rowForm.js has loaded, as every pictograph the shell draws.
      window.spirit.required.spirit.element.icon.create(f.button, { glyph: on ? '🔴' : '🟢' });
      f.span.textContent = words;
    }
    draw();
    return {
      root: root,
      set: function (now, said) {
        var nextOn = now === true;
        var nextWords = said !== undefined ? String(said == null ? '' : said) : words;
        // NOTHING CHANGED, NOTHING DRAWN (the -browser test's write watch: its mounter paints again on every row change and
        // every read of the app's manifest, and a form redrawn whole with the same state counted as drawing while a write was out).
        if (nextOn === on && nextWords === words) return;
        on = nextOn;
        words = nextWords;
        draw();
      },
      destroy: function () { host.innerHTML = ''; },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/app/rowFormToggle.js', { create: create }); });
}());
