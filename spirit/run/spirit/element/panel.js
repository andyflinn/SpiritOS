// spirit/run/spirit/element/panel.js
// WHAT MOUNTS COVERS ITS MOUNTER (goal/G43.17; Q12, Andy: "yes." to panel, in spirit/element/panel.js). Its contract and its
// test: ./test/panel.md and ./test/panel.js.
//
//   spirit.elements.panel.create(host, under) -> stack
//     host    the pane the mounter draws in; its layers go into it
//     under   what the mounter shows there, covered while a layer is open
//   stack.open(key, { icon, label, fill(pane, closed) }) -> layer
//     Over `under`, in the same pane, under the title bar [icon] <label> [✕]. fill draws into the layer's pane once and answers
//     what to destroy, or a promise of it. A key already open is shown again as it was left, not made anew.
//   layer.show(), layer.hide(), layer.set({ icon, label }), layer.shown()
//   stack.close()     hides the open layer and shows `under` again
//   stack.destroy()   lets every layer go, what it drew with it
//
// The box: "By default an element mounts over the one that mounts it, in the same pane", "✕ shows the mounter again", "Each pane
// keeps its own stack, a tree; one click on the outer ✕ closes it all", and "A closed layer is hidden, not destroyed, so
// reopening it in the same session shows what was there; a reload starts clean" (Q2, Q3).
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/rowForm.js'), S.require('spirit/element/icon.js')]);

  function create(host, under) {
    var layers = Object.create(null);
    var open = null;
    var gone = false;
    function cover(on) { if (under) under.style.display = on ? 'none' : ''; }

    function make(key, spec) {
      var E = S.element;
      var box = document.createElement('div');
      box.className = 'app-container fill';
      // THE TITLE BAR OF ALL PANELS IS ONE rowForm (Andy: "rowForm: [app-icon] "<app-label> [x]").
      var bar = E.rowForm.create(box, { icon: spec.icon || '', button: '✕' });
      bar.button.className = 'app-container-close';
      bar.button.title = 'Close';
      bar.span.textContent = String(spec.label || '');
      var pane = document.createElement('div');
      pane.className = 'app-container-pane fill';
      pane.style.marginTop = '1em';
      box.appendChild(pane);
      host.appendChild(box);
      var made = null;
      var dropped = false;
      var layer = {
        key: key,
        shown: function () { return open === layer; },
        show: function () {
          if (dropped) return;
          if (open && open !== layer) open.hide();
          open = layer;
          box.style.display = '';
          cover(true);
        },
        // HIDDEN, NOT DESTROYED (the box): what it drew stays, out of view, until the stack goes.
        hide: function () {
          box.style.display = 'none';
          if (open === layer) { open = null; cover(false); }
        },
        set: function (look) {
          if (!look) return;
          if (look.label !== undefined) bar.span.textContent = String(look.label);
          if (look.icon !== undefined) {
            var hold = document.createElement('span');
            E.icon.create(hold, { glyph: look.icon });
            if (hold.firstChild) bar.root.replaceChild(hold.firstChild, bar.root.firstChild);
          }
        },
        destroy: function () {
          dropped = true;
          if (open === layer) { open = null; cover(false); }
          if (made && typeof made.destroy === 'function') made.destroy();
          made = null;
          if (box.parentNode) box.parentNode.removeChild(box);
          delete layers[key];
        },
      };
      bar.button.addEventListener('click', function () { layer.hide(); });
      layers[key] = layer;
      layer.show();
      Promise.resolve(typeof spec.fill === 'function' ? spec.fill(pane, function () { return dropped; }) : null).then(function (m) {
        if (dropped) { if (m && typeof m.destroy === 'function') m.destroy(); return; }
        made = m;
      });
      return layer;
    }

    return {
      open: function (key, spec) {
        var k = String(key);
        if (gone) return null;
        if (layers[k]) { layers[k].show(); return Promise.resolve(layers[k]); }
        return parts.then(function () { if (gone) return null; return layers[k] ? (layers[k].show(), layers[k]) : make(k, spec || {}); });
      },
      layer: function (key) { return layers[String(key)] || null; },
      close: function () { if (open) open.hide(); },
      destroy: function () {
        gone = true;
        Object.keys(layers).forEach(function (k) { layers[k].destroy(); });
        cover(false);
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.panel = { create: create };
}());
