// spirit/run/shell/js/appHeader/appHeader.js
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
// Loaded by index.html before the shell; the shell hands it to apps as api.ui.elements.appHeader.create(container).

(function () {
  function createAppHeader() {
    var div = document.createElement('div');
    div.style.position = 'sticky';
    div.style.top = '0px';
    div.style.zIndex = '2';
    div.style.background = '#1a1a2e';
    return div;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"):
  // create(container) appends the header area and answers it.
  window.spirit.elements.appHeader = { create: function (container) { var div = createAppHeader(); container.appendChild(div); return div; } };
})();
