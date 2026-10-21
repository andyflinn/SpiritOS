// Files (goal/G30.16): the node's files in the standard list-tool, shell/js/probabilitySearch.js, each row a fileElement
// (shell/js/rows/fileElement.js). The list is a view of data.files, the faceless layer's mirror of the node's tree
// (shell/js/spiritData.js, kept by the fs-watcher's stream), at home and on the face: nothing is asked while the field
// is empty, and names are ranked from the mirror at once; fs.search is asked only by contents, what the page cannot
// answer. The columns sort while the field is empty. A press opens the file in this pane, in the viewer for its kind
// (shell/js/textViewer.js, mediaViewer.js, both on fileViewer.js), at home and on the face alike; ← Files goes back.
// The file selector pane (goal/G29.8) stood here; it stays for the apps not yet ported.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/files' (see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js).

var filesList = null;
var filesShown = null;                 // the media viewer open, dropped when another file or the list is shown
var filesOpen = Object.create(null);   // the folders open in the tree, by path; all collapsed at first

function filesSearch(api, args) {
  var a = args || {};
  // The tree is in the page already: only a search by contents asks the node.
  if (!a.contents || !a.q) return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } });
  return Promise.resolve(api.verb('fs.search', { q: a.q || '', contents: a.contents || '' })).then(function (r) {
    var body = (r && r.body) || {};
    var D = window.spiritData;
    // fs.search labels a name match with its path and a contents match with json {path, line}; the list wants json.
    var items = (body.items || []).map(function (i) {
      var row = null;
      try { row = JSON.parse(i.label); } catch (e) { row = null; }
      // A folder comes with a trailing slash; the watcher and the row know it without one.
      var raw = String((row && row.path) || i.key);
      var folder = /\/$/.test(raw);
      var path = raw.replace(/\/+$/, '');
      var k = D.get('files/' + path) || {};
      return { key: path, label: JSON.stringify({ path: path, name: path.slice(path.lastIndexOf('/') + 1), kind: folder ? 'folder' : (k.kind || 'file'),
        size: k.size, modified: k.modified, line: (row && row.line) || 0 }) };
    });
    return { status: 200, body: { ok: true, items: items, more: !!body.more } };
  });
}

function filesShow(host, listHost, path, words, line) {
  var E = window.spiritElements;
  if (filesShown) { filesShown.destroy(); filesShown = null; }
  listHost.hidden = true;
  host.hidden = false;
  host.innerHTML = '<button type="button" class="cancel-btn" data-files="back">← Files</button><div data-files="viewer"></div>';
  var viewer = host.querySelector('[data-files="viewer"]');
  var kind = E.fileViewer.kindOf(E.fileViewer.mimeOf(path));
  if (kind === 'code') E.textViewer.create(viewer, { path: path, words: words, line: line, launcherId: 'text-file-launcher' });
  else if (kind) filesShown = E.mediaViewer.create(viewer, { path: path, launcherId: 'media-launcher' });
  else E.fileViewer.create(viewer, { path: path });
  host.querySelector('[data-files="back"]').addEventListener('click', function () {
    if (filesShown) { filesShown.destroy(); filesShown = null; }
    host.hidden = true;
    host.innerHTML = '';
    listHost.hidden = false;
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var E = window.spiritElements;
    // THE TREE'S INDENT (Andy: "in tree-mode an indent of 2em per slash ahead of the file-icon."): only while the field is
    // empty, when the list is the tree.
    container.innerHTML = '<style>.files-tree .file-depth{display:inline-block;padding-left:calc(var(--depth) * 2em)}</style>' +
      '<div data-files="list" class="files-tree"></div><div data-files="file" hidden></div>';
    var listHost = container.querySelector('[data-files="list"]');
    var fileHost = container.querySelector('[data-files="file"]');
    filesList = window.spiritElements.probabilitySearch.create(listHost, {
      api: { verb: function (name, args) { return filesSearch(api, args); } },
      data: 'files',
      server: 'fs',
      verb: 'search',
      args: function (text, values) { return { q: text, contents: values.in === 'contents' ? 'yes' : '' }; },
      columns: [
        { field: 'icon', label: '' },
        { field: 'name', from: 'path', label: 'Name', sort: 'path' },
        { field: 'size', label: 'Size', sort: 'number', align: 'right' },
        { field: 'changed', from: 'modified', label: 'Changed', sort: 'date' },
      ],
      element: function (row, key) { return E.fileElement.create(Object.assign({ path: key }, row)); },
      matched: function (row) { return { name: String(row.name || ''), path: String(row.path || '') }; },
      filters: [
        { name: 'in', choices: [{ value: 'names', word: 'names' }, { value: 'contents', word: 'contents' }] },
        // THE TREE (box v12; Andy: "when no search is active, then the presentation is a tree-view, by default all folders
        // collapsed."): while the field is empty a row shows only when every folder above it is open. Not drawn.
        { name: 'tree', when: function () { return false; }, test: function (row) {
          if (filesList && filesList.words()) return 1;
          var parts = String(row.path || '').split('/');
          for (var i = 1; i < parts.length; i++) { if (!filesOpen[parts.slice(0, i).join('/')]) return 0; }
          return 1;
        } },
      ],
      details: function (row, key) {
        // A folder opens or closes in the tree; with words it is only a row.
        if (row.kind === 'folder') { if (filesOpen[key]) delete filesOpen[key]; else filesOpen[key] = true; filesList.redraw(); return; }
        // A file found by its contents opens at that line with the words marked (goal/G29.11).
        filesShow(fileHost, listHost, key, row.line > 0 ? filesList.words() : '', row.line || 0);
      },
      empty: 'No file matches.',
    });
    // The tree is in path order until a header is pressed.
    filesList.sort('name', 'asc');
    listHost.addEventListener('input', function () { listHost.classList.toggle('files-tree', !filesList.words()); });
    listHost.addEventListener('click', function () { listHost.classList.toggle('files-tree', !filesList.words()); });
    filesList.refresh();
  },

  render: function () {},
});
