'use strict';
// spirit/run/spirit/element/search/app/rowFormToggle/script.js
// ONE ON/OFF SWITCH, A rowForm (goal/G43.15). Andy, box: "it acts exactly like the two toggle switches in
// appSelector:detail", "it is configurable with a description of what is being toggled." Its contract and its test:
// ./test/script.md and ./test/rowFormToggle.js.
//
//   spirit.required.spirit.element.search.app.rowFormToggle.create(host, { on, words, press }) -> { root, set(on, words), destroy() }
//
// It draws the state it is handed, 🟢 with a 🔴 button when on, 🔴 with a 🟢 button when off, and the words beside. A press only
// calls press, and the button is busy until what press answers settles: the state changes when its owner says so, by set
// (rule/19: draw only what the server says).
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/icon/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  keepAnswer('spirit/element/rowForm/script.js');

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
      var f = ANSWER['spirit/element/rowForm/script.js'].create(root, { icon: on ? '🟢' : '🔴', button: '', press: function () { return typeof o.press === 'function' ? o.press() : undefined; } });
      // THE BUTTON'S GLYPH IS AN ICON TOO (goal/G43.32; Andy: "fix the fucking elements/pages."): painted through the icon
      // element, which rowForm.js has loaded, as every pictograph the shell draws.
      ANSWER['spirit/element/icon/script.js'].create(f.button, { glyph: on ? '🔴' : '🟢' });
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
