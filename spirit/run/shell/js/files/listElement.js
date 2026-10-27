// spirit/run/shell/js/files/listElement.js
// THE FILES LIST, A DROP-IN SHELL ELEMENT (goal/G30.20): the node's files on the standard list-tool
// (shell/js/probabilitySearch.js), each row a fileElement (rowElement.js here), the list a view of data.files (data.js
// here, the faceless layer's mirror of the node's tree). The Files app draws it as a pane, an app picking a file as a
// dropdown; it replaced the legacy file selector, deleted with it.
//   - Names are ranked from the mirror at once; fs.search is asked only by contents, what the page cannot answer.
//   - No words: the tree, in path order, every folder folded at first, 2em of indent per slash; a folder's press opens
//     or shuts it and is never a pick. Words: every match, ranked, with its path.
//   - accept: the app's hidden type filter, extensions ('.md') and mimetype prefixes ('image/'), or a function of the
//     row; a file outside it never shows, folders always do.
//
//   create(host, opts) -> the list (value, row, words(), refresh(), redraw(), sort(), destroy())
//     opts.api          the app's shell api (verb)
//     opts.face         'pane' or 'dropdown'
//     opts.accept, opts.placeholder, opts.all, opts.empty
//     opts.pick(row, key)   a file chosen; row.line is the first matched line of a file found by its contents
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['shell/js/files/data.js', 'shell/js/files/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/fileViewer.js'].forEach(function (p) { window.spirit.require(p); });

  function accepted(accept, row) {
    if (row.kind === 'folder' || accept == null) return true;
    if (typeof accept === 'function') return !!accept(row);
    var name = String(row.path || '').toLowerCase();
    var mime = E.fileViewer ? String(E.fileViewer.mimeOf(name)) : '';
    return (Array.isArray(accept) ? accept : [accept]).some(function (a) {
      a = String(a).toLowerCase();
      return a.charAt(0) === '.' ? name.slice(-a.length) === a : mime.indexOf(a) === 0;
    });
  }

  // BY CONTENTS ONLY: fs.search labels a name match with its path and a contents match with json {path, score, line}.
  // found(next) is handed what the node scored, by path, for the list to rank by (goal/G29.11, taken from the file
  // selector): in contents a file ranks by the node's score alone.
  // Through the spirit object (goal/G32.2): spirit.fs.search answers the reply's body.
  function search(args, found) {
    var a = args || {};
    if (!a.contents || !a.q) { found(Object.create(null)); return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); }
    return spirit.ready.then(function (s) { return s.fs.search({ q: a.q || '', contents: a.contents || '' }); }).then(function (body) {
      body = body || {};
      var D = window.spirit.data;
      var next = Object.create(null);
      var items = (body.items || []).map(function (i) {
        var row = null;
        try { row = JSON.parse(i.label); } catch (e) { row = null; }
        if (row && row.path) next[String(row.path).replace(/\/+$/, '')] = Number(row.score) || 0;
        // A folder comes with a trailing slash; the watcher and the row know it without one.
        var raw = String((row && row.path) || i.key);
        var folder = /\/$/.test(raw);
        var path = raw.replace(/\/+$/, '');
        var k = D.get('files/' + path) || {};
        return { key: path, label: JSON.stringify({ path: path, name: path.slice(path.lastIndexOf('/') + 1), kind: folder ? 'folder' : (k.kind || 'file'),
          size: k.size, modified: k.modified, line: (row && row.line) || 0 }) };
      });
      found(next);
      return { status: 200, body: { ok: true, items: items, more: !!body.more } };
    });
  }

  function create(host, opts) {
    var o = opts || {};
    var opened = Object.create(null);   // the folders open in the tree, by path
    var scores = Object.create(null);   // path -> the node's contents score, from the last contents search
    var list = null;
    host.innerHTML = '<style>.files-tree .file-depth{display:inline-block;padding-left:calc(var(--depth) * 2em)}.files-tree .path-dir{display:none}</style>' +
      // The list search's box takes all of this one (goal/G40.8: space granted top-down).
      '<div class="files-tree fill"></div>';
    var inner = host.lastChild;
    list = E.probabilitySearch.create(inner, {
      api: { verb: function (name, args) { return search(args, function (next) { scores = next; }); } },
      data: 'files',
      server: 'fs',
      verb: 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose a file…',
      all: o.all,
      name: function (row) { return String(row.path || row.key || ''); },
      args: function (text, values) { return { q: text, contents: values.in === 'contents' ? 'yes' : '' }; },
      columns: [
        { field: 'name', from: 'path', label: 'Name', sort: 'path' },
        { field: 'size', label: 'Size', sort: 'number', align: 'right' },
        { field: 'changed', from: 'modified', label: 'Changed', sort: 'date' },
      ],
      element: function (row, key) { return E.fileElement.create(Object.assign({ path: key }, row)); },
      matched: function (row) { return { name: String(row.name || ''), path: String(row.path || '') }; },
      score: function (row, values) { return values.in === 'contents' ? (scores[row.path] || 0) : null; },
      filters: [
        { name: 'in', choices: [{ value: 'names', word: 'names' }, { value: 'contents', word: 'contents' }] },
        // THE TREE and THE APP'S TYPES, not drawn: while the field is empty a row shows only when every folder above it
        // is open.
        { name: 'tree', when: function () { return false; }, test: function (row) {
          if (!accepted(o.accept, row)) return 0;
          if (list && list.words()) return 1;
          var parts = String(row.path || '').split('/');
          for (var i = 1; i < parts.length; i++) { if (!opened[parts.slice(0, i).join('/')]) return 0; }
          return 1;
        } },
      ],
      fold: function (row, key) {
        if (row.kind !== 'folder') return false;
        if (!list.words()) { if (opened[key]) delete opened[key]; else opened[key] = true; }
        return true;
      },
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
      empty: o.empty || 'No file matches.',
    });
    // The tree is in path order until a header is pressed; the indent only while the list is the tree.
    list.sort('name', 'asc');
    function treeLook() { inner.classList.toggle('files-tree', !list.words()); }
    inner.addEventListener('input', treeLook);
    inner.addEventListener('click', treeLook);
    list.refresh();
    return list;
  }

  E.fileList = { create: create };
}());
