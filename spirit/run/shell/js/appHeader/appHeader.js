// spirit/run/shell/js/appHeader/appHeader.js
// ONE SHELL ELEMENT: the app header (goal/G6.1), the header area an app or a dialog fills.
//
//   Andy, FACE.md: "shell app apps/dialog apps can have a header area. this header area behaves like the header area
//   in both desk and deskDetails. we want a shell element that facilitates that."; in goal/G6.1: "the shape only
//   produces the div container for the app to fill in, and provides only the sticking functionality?"
//
// So it is one empty div and its sticking, nothing else: what goes inside stays each app's. It sticks under the shell's
// titlebar (#app-header, sticky at the top of the same scroll), at the titlebar's measured height, measured here and
// again whenever the window or the titlebar changes size, opaque in the shell's background and above the content.
// Loaded by index.html before the shell; the shell hands it to apps as api.ui.elements.createAppHeader.

(function () {
  function titlebarHeight() {
    var bar = document.getElementById('app-header');
    if (!bar) return 0;
    var h = Number(bar.offsetHeight);
    if (!(h > 0) && typeof bar.getBoundingClientRect === 'function') h = Number(bar.getBoundingClientRect().height);
    return h > 0 ? h : 0;
  }

  function createAppHeader() {
    var div = document.createElement('div');
    div.style.position = 'sticky';
    div.style.zIndex = '2';
    div.style.background = '#1a1a2e';
    function measure() {
      var h = titlebarHeight();
      div.style.top = (h > 0 ? h : 52) + 'px';
    }
    measure();
    window.addEventListener('resize', measure);
    var bar = document.getElementById('app-header');
    if (bar && typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(bar);
    return div;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createAppHeader = createAppHeader;
})();
