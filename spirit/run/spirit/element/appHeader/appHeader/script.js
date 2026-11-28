'use strict';
// spirit/run/spirit/element/appHeader/appHeader/script.js
// ONE SHELL ELEMENT: the app header (goal/G6.1), the header area an app or a dialog fills.
//
//   Andy, FACE.md: "shell app apps/dialog apps can have a header area. this header area behaves like the header area
//   in both desk and deskDetails. we want a shell element that facilitates that."; in goal/G6.1: "the shape only
//   produces the div container for the app to fill in, and provides only the sticking functionality?"
//
// So it is one empty div and its sticking, nothing else: what goes inside stays each app's. It sticks at the top of the
// app's own pane, opaque in the shell's background and above the content. SINCE goal/G41.22 the pane is what scrolls
// (shell.css: "EVERYTHING IS CONSTRAINED, TOP DOWN"), and it starts under the shell's titlebar, so the header sticks at
// 0; it measured the titlebar while the whole window scrolled, and that height left a gap of its own size above it.
// Loaded through spirit.requireScript by what draws with it.create(container).

(function () {
  function createAppHeader() {
    var div = document.createElement('div');
    // Its box keeps what it holds inside (spirit/testicle/general/browser/pageRules/script.js: the box it puts into its container declares a constraint, overflow not visible).
    div.style.overflow = 'hidden';
    div.style.position = 'sticky';
    div.style.top = '0px';
    div.style.zIndex = '2';
    div.style.background = '#1a1a2e';
    return div;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"):
  // create(container) appends the header area and answers it.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: function (container) { var div = createAppHeader(); container.appendChild(div); return div; } };
})();
