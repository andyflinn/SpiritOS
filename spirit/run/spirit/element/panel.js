'use strict';
// spirit/run/spirit/element/panel.js
// WHAT MOUNTS COVERS ITS MOUNTER (goal/G43.17; Q12, Andy: "yes." to panel, in spirit/element/panel.js). Its contract and its
// test: ./test/panel.md and ./test/panel.js.
//
//   spirit.element.spirit.element.panel.create(host, under) -> stack
//     host    the pane the mounter draws in; its layers go into it
//     under   what the mounter shows there, covered while a layer is open
//   stack.open(key, { icon, label, fill(pane, closed), remote }) -> layer
//     Over `under`, in the same pane, under the title bar [icon] <label> [✕]; with remote, a server's name, the bar's centre
//     holds that server's Remote dropdown (goal/G47.5). fill draws into the layer's pane once and answers
//     what to destroy, or a promise of it. A key already open is shown again as it was left, not made anew.
//   layer.show(), layer.hide(), layer.set({ icon, label }), layer.shown()
//   stack.close()     hides every layer and shows `under` again
//   stack.destroy()   lets every layer go, what it drew with it
//
// The box: "By default an element mounts over the one that mounts it, in the same pane", "✕ shows the mounter again", and "A
// closed layer is hidden, not destroyed, so reopening it in the same session shows what was there; a reload starts clean" (Q2,
// Q3). ONE STACK, EACH ✕ ONE STEP BACK (Andy: "the way all-search replaces it's whole self, when an app is clicked, THAT's how
// i want all panels to act, for example, when a file is clicked on on "file", then the file viewer pops up overtop of ALL the
// "file" app...."; Q17, the outer ✕ line goes): a layer opened while another shows covers it, bar and all, and its ✕ shows
// that one again; an element opened in a layer opens what it opens in the same stack (file, its viewers).
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
      // THE ONE IT COVERS, shown again by its ✕ while that one is still in the stack.
      var back = open;
      var box = document.createElement('div');
      box.className = 'app-container fill';
      // THE TITLE BAR OF ALL PANELS IS ONE rowForm (Andy: "rowForm: [app-icon] "<app-label> [x]").
      var bar = E.spirit.element.rowForm.create(box, { icon: spec.icon || '', button: '✕' });
      bar.button.className = 'app-container-close';
      bar.button.title = 'Close';
      bar.span.textContent = String(spec.label || '');
      // THE REMOTE DROPDOWN, IN THE CENTRE OF THE BAR (goal/G47.5, box v12: "all appServer faces now carry a Remote element in
      // the center of their titlebar", "a simple dropdown, that is filled by a \"remote\" request without argument to its
      // appServer", "the Remote element shows only on apps that have a server"): only a layer handed spec.remote, its server's
      // name, draws it; every other bar is as it was. The shared search's dropdown, asking that server's remote itself; a pick
      // sends remote { id }, and the page reloads when that changed the server it runs on (box v12: "for now, reload
      // themselves to adapt to the new configuration").
      var remoteList = null;
      if (spec.remote) {
        var server = String(spec.remote);
        var mid = document.createElement('span');
        mid.style.cssText = 'flex:1;display:flex;justify-content:center;min-width:0';
        bar.root.insertBefore(mid, bar.button);
        var current = '';
        S.require('spirit/element/search.js').then(function () {
          if (dropped) return;
          remoteList = S.element.spirit.element.search.create(mid, {
            server: server, verb: 'remote', face: 'dropdown', placeholder: 'remote…',
            args: function () { return {}; },
            columns: [{ field: 'label', label: 'Remote', sort: 'text' }],
            pick: function (row, k) {
              if (!k) return;
              Promise.resolve(S.require(S.familyPath(server))).then(function (fam) { return fam.remote({ id: String(k) }); }).then(function (r) {
                var now = String((r && r.current) || (r && r.body && r.body.current) || '');
                if (now && current && now !== current) window.location.reload();
                if (now) current = now;
              }, function () { /* the bar stays as it was */ });
            },
            empty: 'No remote.',
          });
          // Which server it runs on now, so a pick of that same one changes nothing.
          Promise.resolve(S.require(S.familyPath(server))).then(function (fam) { return fam.remote({}); }).then(function (r) {
            current = String((r && r.current) || (r && r.body && r.body.current) || '');
          }, function () { /* unknown until a pick says */ });
        }, function () { /* no search on this page */ });
      }
      var pane = document.createElement('div');
      pane.className = 'app-container-pane fill';
      pane.style.marginTop = '1em';
      box.appendChild(pane);
      host.appendChild(box);
      var made = null;
      var dropped = false;
      var layer = {
        key: key,
        box: box,
        shown: function () { return open === layer; },
        show: function () {
          if (dropped) return;
          if (open && open !== layer) open.box.style.display = 'none';
          open = layer;
          box.style.display = '';
          cover(true);
        },
        // HIDDEN, NOT DESTROYED (the box): what it drew stays, out of view, until the stack goes.
        hide: function () {
          box.style.display = 'none';
          if (open !== layer) return;
          open = null;
          if (back && layers[back.key] === back) back.show();
          else cover(false);
        },
        set: function (look) {
          if (!look) return;
          if (look.label !== undefined) bar.span.textContent = String(look.label);
          if (look.icon !== undefined) {
            var hold = document.createElement('span');
            E.spirit.element.icon.create(hold, { glyph: look.icon });
            if (hold.firstChild) bar.root.replaceChild(hold.firstChild, bar.root.firstChild);
          }
        },
        destroy: function () {
          dropped = true;
          if (open === layer) { open = null; cover(false); }
          if (made && typeof made.destroy === 'function') made.destroy();
          made = null;
          if (remoteList && typeof remoteList.destroy === 'function') remoteList.destroy();
          remoteList = null;
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
      close: function () {
        Object.keys(layers).forEach(function (k) { layers[k].box.style.display = 'none'; });
        open = null;
        cover(false);
      },
      destroy: function () {
        gone = true;
        Object.keys(layers).forEach(function (k) { layers[k].destroy(); });
        cover(false);
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/panel.js', { create: create }); });
}());
