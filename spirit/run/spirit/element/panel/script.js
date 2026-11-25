'use strict';
// spirit/run/spirit/element/panel/script.js
// WHAT MOUNTS COVERS ITS MOUNTER (goal/G43.17; Q12, Andy: "yes." to panel, in spirit/element/panel/script.js). Its contract and its
// test: ./test/script.md and ./test/panel.js.
//
//   spirit.required.spirit.element.panel.create(host, under) -> stack
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
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([keepAnswer('spirit/element/rowForm/script.js'), keepAnswer('spirit/element/icon/script.js')]);

  function create(host, under) {
    var layers = Object.create(null);
    var open = null;
    var gone = false;
    function cover(on) { if (under) under.style.display = on ? 'none' : ''; }

    function make(key, spec) {
      // THE ONE IT COVERS, shown again by its ✕ while that one is still in the stack.
      var back = open;
      var box = document.createElement('div');
      box.className = 'app-container fill';
      // THE TITLE BAR OF ALL PANELS IS ONE rowForm (Andy: "rowForm: [app-icon] "<app-label> [x]").
      var bar = ANSWER['spirit/element/rowForm/script.js'].create(box, { icon: spec.icon || '', button: '✕' });
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
        // WHAT IT RUNS ON, SHOWN (Andy: "the selector ... won't accept the selection, the setting remains on" this node):
        // the field names the server current is, from every answer of remote, and a refused switch says why beside it.
        var said = document.createElement('span');
        said.style.cssText = 'margin-left:0.5em;opacity:0.8';
        mid.appendChild(said);
        var opts = null;
        var labels = {};
        function showCurrent() {
          var label = labels[current] || '';
          if (!opts || !label) return;
          opts.placeholder = label;
          var fieldButton = mid.querySelector('button[id$="field"]');
          if (fieldButton) fieldButton.textContent = label + ' ▾';
        }
        // One remote answer or published row taken in: what it runs on, and each row's label.
        function take(r) {
          if (!r || typeof r !== 'object') return;
          if (r.current) current = String(r.current);
          (Array.isArray(r.items) ? r.items : []).forEach(function (i) { labels[String(i.key)] = String(i.label || i.key); });
          showCurrent();
        }
        // WHAT LANDS IN spirit.required.spirit.data.<server>.remote IS WHAT IT SHOWS (Andy: "all, agreed. spirit/data/script.js"): the server's
        // published remote row, filed there by spirit/data/script.js, is followed as it comes.
        var unwatchRemote = S.required.spirit.data && typeof S.required.spirit.data.watchPath === 'function' ? S.required.spirit.data.watchPath('remote/' + server, function (p, r) { take(r); }) : null;
        keepAnswer('spirit/element/search/script.js').then(function () {
          if (dropped) return;
          take(S.required.spirit.data && S.required.spirit.data[server] && S.required.spirit.data[server].remote);
          var fam = function () { return Promise.resolve(S.requireScript('spirit/app/' + server + '/api.js')); };
          opts = {
            face: 'dropdown', placeholder: 'remote…',
            // ITS OWN SOURCE: remote's rows are { key, label } with the label a name, while a list's rows ride as a label
            // holding the row (the search element parses it), so each is handed over as such; current is kept from the same
            // answer, so a pick of the one it runs on changes nothing.
            search: function () {
              return fam().then(function (f) { return f.remote({}); }).then(function (r) {
                take(r);
                var items = ((r && r.items) || []).map(function (i) { return { key: String(i.key), label: JSON.stringify({ key: String(i.key), label: String(i.label || '') }) }; });
                return { status: 200, body: { ok: true, items: items, more: !!(r && r.more) } };
              });
            },
            api: 'spirit/app/' + server + '/api.js', verb: 'remote',
            args: function () { return {}; },
            name: function (row) { return String((row && (row.label || row.key)) || ''); },
            columns: [{ field: 'label', label: 'Remote', sort: 'text' }],
            pick: function (row, k) {
              if (!k) return;
              said.textContent = '';
              fam().then(function (f) { return f.remote({ id: String(k) }); }).then(function (r) {
                var now = String((r && r.current) || (r && r.body && r.body.current) || '');
                var was = current;
                if (now) current = now;
                showCurrent();
                if (now && was && now !== was) window.location.reload();
              }, function (e) { said.textContent = 'not switched: ' + String((e && (e.message || e.code)) || 'refused'); showCurrent(); });
            },
            empty: 'No remote.',
          };
          remoteList = ANSWER['spirit/element/search/script.js'].create(mid, opts);
          mid.appendChild(said);
          // Its first ask now, as every list's (grant/list.js): the rows are there when the field opens. And again each time
          // the field is pressed: the server checks its peers in the background after an empty call (box v12), so a later
          // open shows what that check found.
          remoteList.refresh();
          mid.addEventListener('click', function (e) {
            var t = e && e.target;
            if (t && typeof t.id === 'string' && /field$/.test(t.id) && remoteList) remoteList.refresh();
          });
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
            ANSWER['spirit/element/icon/script.js'].create(hold, { glyph: look.icon });
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
          if (typeof unwatchRemote === 'function') unwatchRemote();
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
