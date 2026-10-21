// Files (goal/G30.16): the node's files in the standard list-tool, shell/js/probabilitySearch.js, each row a fileElement
// (shell/js/rows/fileElement.js) that keeps itself current from the fs-watcher. The search is fs.search, by name or by
// contents; the columns sort while the field is empty. A press opens the file in this pane, in the viewer for its kind
// (shell/js/textViewer.js, mediaViewer.js, both on fileViewer.js), at home and on the face alike; ← Files goes back.
// The file selector pane (goal/G29.8) stood here; it stays for the apps not yet ported.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/files' (see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js).

var filesList = null;
var filesShown = null;
var filesOpen = Object.create(null);   // the folders open in the tree, by path; all collapsed at first   // the media viewer open, dropped when another file or the list is shown

function filesSearch(api, args) {
  var a = args || {};
  return Promise.resolve(api.verb('fs.search', { q: a.q || '', contents: a.contents || '' })).then(function (r) {
    var body = (r && r.body) || {};
    var FE = window.spiritElements.fileElement;
    // fs.search labels a name match with its path and a contents match with json {path, line}; the list wants json.
    var items = (body.items || []).map(function (i) {
      var row = null;
      try { row = JSON.parse(i.label); } catch (e) { row = null; }
      // A folder comes with a trailing slash; the watcher and the row know it without one.
      var raw = String((row && row.path) || i.key);
      var folder = /\/$/.test(raw);
      var path = raw.replace(/\/+$/, '');
      var k = FE.known(path) || {};
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
    container.innerHTML = '<div data-files="list"></div><div data-files="file" hidden></div>';
    var listHost = container.querySelector('[data-files="list"]');
    var fileHost = container.querySelector('[data-files="file"]');
    E.fileElement.watch();
    filesList = window.spiritElements.probabilitySearch.create(listHost, {
      api: { verb: function (name, args) { return filesSearch(api, args); } },
      server: 'fs',
      verb: 'search',
      args: function (text, values) { return { q: text, contents: values.in === 'contents' ? 'yes' : '' }; },
      columns: [
        { field: 'icon', label: '', width: '1.5em' },
        { field: 'name', from: 'path', label: 'Name', sort: 'path' },
        { field: 'size', label: 'Size', sort: 'number', align: 'right' },
        { field: 'changed', from: 'modified', label: 'Changed', sort: 'date' },
      ],
      element: function (row) { return E.fileElement.create(row); },
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
    filesList.refresh();
  },

  render: function () {},
});
