// spirit/run/shell/shared/js/deskElement.js
// THE ELEMENT THAT CARRIES ITS OWN STREAM — goal/G27.9, slice D.
//
//   Desk rule 8 (Andy): "Shell and application elements, should bring their subscriptions with them, so that they're
//   automatically subscribed to the events that update them."
//   The item's box, D: "a new folder spirit/run/shell/shared/js (Andy, 2026-10-15: spirit/run/shell/js is a core
//   folder and stays the shell's own), one file per element, each named with the desk prefix ... each adding itself to
//   window.spiritElements as the shell elements do. The element is made with the keys it shows and a paint function
//   and subscribes to the stream itself."
//
// createDeskElement({ subscribe, wants, paint }) -> { destroy }
//   subscribe(handler)  the stream the element listens to, an app's onPublished bound to its server; answers its
//                       unsubscribe. Called once, when the element is made.
//   wants(obj)          whether a published object concerns what this element shows.
//   paint(obj)          repaints this element, and only it, from that object.
// destroy() unsubscribes it; nothing is painted after.
//
// The element keeps no copy of the state: what it shows lives with the app; the element decides only when to paint.

(function () {
  function createDeskElement(options) {
    var o = options || {};
    var live = true;
    var off = null;
    function heard(obj, from) {
      if (!live) return;
      var want = false;
      try { want = typeof o.wants === 'function' ? !!o.wants(obj, from) : true; } catch (e) { want = false; }
      if (want && typeof o.paint === 'function') o.paint(obj, from);
    }
    if (typeof o.subscribe === 'function') off = o.subscribe(heard);
    return {
      destroy: function () {
        if (!live) return;
        live = false;
        if (typeof off === 'function') off();
        off = null;
      },
    };
  }
  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createDeskElement = createDeskElement;
}());
