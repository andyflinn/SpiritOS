// spirit/run/shell/js/bundleEditor.js
// ONE SHELL ELEMENT: the panel that makes and keeps bundles (goal/G41.13; Andy, box v7: "A shell element (panel and page)
// creates and maintains bundles: lists them, adds one, edits its label, description and paths, and deletes one", and
// "this shell element will use the standard family and verb pickers that already exist"). Its contract and its test:
// ./test/bundleEditor.md and ./test/bundleEditor.js.
//
//   spirit.elements.bundleEditor.create(container, { api }) -> { destroy }
//     the node's bundles in a probabilitySearch (auth.bundle { op: 'search', text }), an Add button, and the editor of
//     the bundle picked or added: its label, description and paths, Save and Delete.
//
// NOTHING IS WRITTEN BEFORE SAVE (the item's lesson from G41.4): Add opens an empty editor and asks the node nothing;
// Save asks auth.bundle add, or set with what changed (the whole path list when the paths changed); Delete asks delete.
// Every call goes through the spirit object, and a refusal is said in the editor's note. After a change the list asks
// again. Paths are picked with the shell's api-branch selector (shell/js/apiBranchSelector.js): a family, or one verb.
// A path shown carries its own remove button. The list is made once: the editor draws around it and keeps it.
(function () {
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function E() { return window.spirit.elements; }
  // One call of auth.bundle; a refusal, answered or thrown, comes back as { refused: why }.
  function bundle(args) {
    return Promise.resolve(window.spirit.ready).then(function (s) { return s.auth.bundle(args); }).then(function (r) {
      if (r && r.refusal) return { refused: String(r.refusal) };
      return r || {};
    }, function (e) {
      var why = e && e.body && e.body.extra && e.body.extra.why;
      return { refused: String(why || (e && (e.code || e.message)) || 'refused') };
    });
  }

  function create(container, opts) {
    var o = opts || {};
    var pre = 'be' + (++made) + '-';
    var gone = false;
    var list = null;
    var listEl = null;
    var picker = null;
    // The bundle being edited: null while none is open; id '' for a new one. was is what it held when it opened.
    var open = null;
    var was = null;
    var note = '';
    function part(end) { return container.querySelector('#' + pre + end); }
    function sameList(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    // What is typed now, kept across a redraw.
    function keepTyped() {
      if (!open) return;
      var l = part('label');
      var d = part('description');
      if (l) open.label = String(l.value || '');
      if (d) open.description = String(d.value || '');
    }

    function editorHtml() {
      if (!open) return '';
      return '<div style="margin-top:1em"><b>' + (open.id ? 'Change' : 'Add') + ' bundle</b></div>' +
        '<div style="margin-top:1em;display:flex;align-items:center;gap:1em"><label for="' + pre + 'label" style="flex:none">Label</label>' +
        '<input type="text" id="' + pre + 'label" style="flex:1 1 0;min-width:0" value="' + esc(open.label) + '"></div>' +
        '<div style="margin-top:1em;display:flex;align-items:center;gap:1em"><label for="' + pre + 'description" style="flex:none">Description</label>' +
        '<input type="text" id="' + pre + 'description" style="flex:1 1 0;min-width:0" value="' + esc(open.description) + '"></div>' +
        '<div style="margin-top:1em">' + open.paths.map(function (p) {
          return '<button type="button" data-path="' + esc(p) + '" title="Take ' + esc(p) + ' off">✕ ' + esc(p) + '</button> ';
        }).join('') + '</div>' +
        '<div style="margin-top:1em;display:flex;align-items:center;gap:1em"><span id="' + pre + 'path"></span>' +
        '<button type="button" id="' + pre + 'addpath">Add path</button></div>' +
        '<div style="margin-top:1em"><button type="button" id="' + pre + 'save">Save</button> ' +
        (open.id ? '<button type="button" id="' + pre + 'delete">Delete</button> ' : '') + '</div>';
    }
    function paint() {
      if (gone) return;
      container.innerHTML = '<div class="fill">' +
        '<div><button type="button" id="' + pre + 'add">Add a bundle</button> <span id="' + pre + 'note">' + esc(note) + '</span></div>' +
        '<div id="' + pre + 'list" class="fill" style="min-height:12em"></div>' + editorHtml() + '</div>';
      // The list made once, put back in its place.
      var place = part('list');
      if (listEl && place && place !== listEl && place.parentNode && typeof place.parentNode.replaceChild === 'function') place.parentNode.replaceChild(listEl, place);
      else if (!listEl) listEl = place;
      part('add').addEventListener('click', add);
      if (!open) return;
      open.paths.forEach(function (p) {
        var b = container.querySelector('[data-path="' + p + '"]');
        if (b) b.addEventListener('click', function () { keepTyped(); open.paths = open.paths.filter(function (x) { return x !== p; }); paint(); });
      });
      picker = E().createApiBranchSelector({});
      part('path').appendChild(picker);
      part('addpath').addEventListener('click', addPath);
      part('save').addEventListener('click', save);
      if (open.id) part('delete').addEventListener('click', remove);
    }
    function add() {
      keepTyped();
      open = { id: '', label: '', description: '', paths: [] };
      was = null;
      note = '';
      paint();
    }
    function edit(row) {
      if (!row) return;
      open = { id: String(row.key || row.id || ''), label: String(row.label || ''), description: String(row.description || ''), paths: (row.paths || []).slice() };
      was = { label: open.label, description: open.description, paths: open.paths.slice() };
      note = '';
      paint();
    }
    function addPath() {
      var p = picker ? String(picker.value || '') : '';
      keepTyped();
      if (!p || open.paths.indexOf(p) !== -1) { paint(); return; }
      open.paths.push(p);
      paint();
    }
    function save() {
      keepTyped();
      var args;
      if (!open.id) args = { op: 'add', label: open.label, description: open.description, paths: open.paths.slice() };
      else {
        args = { op: 'set', id: open.id };
        if (open.label !== was.label) args.label = open.label;
        if (open.description !== was.description) args.description = open.description;
        if (!sameList(open.paths, was.paths)) args.paths = open.paths.slice();
      }
      bundle(args).then(function (r) {
        if (gone) return;
        if (r.refused) { note = 'Not saved: ' + r.refused; paint(); return; }
        if (!open.id && r.id) open.id = String(r.id);
        was = { label: open.label, description: open.description, paths: open.paths.slice() };
        note = 'Saved.';
        paint();
        if (list) list.refresh();
      });
    }
    function remove() {
      var id = open && open.id;
      if (!id) return;
      bundle({ op: 'delete', id: id }).then(function (r) {
        if (gone) return;
        if (r.refused) { note = 'Not deleted: ' + r.refused; paint(); return; }
        open = null;
        was = null;
        note = 'Deleted.';
        paint();
        if (list) list.refresh();
      });
    }

    paint();
    Promise.all(['shell/js/probabilitySearch.js', 'shell/js/apiBranchSelector.js'].map(function (p) {
      return window.spirit.require ? window.spirit.require(p) : null;
    })).then(function () {
      if (gone) return;
      list = E().probabilitySearch.create(listEl, {
        api: o.api, server: 'auth', verb: 'bundle',
        args: function (text) { return { op: 'search', text: text }; },
        columns: [{ field: 'label', label: 'Bundle', sort: 'text' }],
        pick: function (row) { edit(row); },
        empty: 'No bundle yet.',
      });
      list.refresh();
    });
    return {
      destroy: function () { gone = true; if (list) list.destroy(); container.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.bundleEditor = { create: create };
})();
