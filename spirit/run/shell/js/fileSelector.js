// spirit/run/shell/js/fileSelector.js
// THE FILE SELECTOR (goal/G29.8): Files on the shared list. A wrapper on shellCreateListSearch over the shell's one file
// tree, built as contactSelector is, with a pane face and a dropdown face; it replaced pathSelector, deleted with it.
//
//   The item's box: "Names and paths are searched in the page and never reach the server."; "Every display has the stat
//   columns: size and modified, right-justified, and the mimetype icon before the name."; "No words: the tree
//   appearance, rows in path order, one square indent per slash, a folder row folding the rows under it."; "Words
//   typed: list mode, the rows ranked best first, each with its full path, the matched parts marked, as every search."
//   The Files app is a container for its pane; an app picking a file uses its dropdown (the text editor does).
//
// createFileSelector({ face, files, placeholder, empty }) answers its root element:
//   face       'pane', else the dropdown
//   files()    the tree as spirit.shell.currentFiles answers it ([{name, relativePath, kind, size, modified}]), asked
//              again at every draw, so nothing here is kept stale
// A press on a file makes it the root's value (its path) and row, and fires one bubbling change on the root; a press on
// a folder in the tree folds or unfolds the rows under it.

(function () {
  var escapeHtml = spirit.core.util.escapeHtml;

  function createFileSelector(options) {
    var o = options || {};
    var isPane = o.face === 'pane';
    var ICON = (spirit.core.const && spirit.core.const.ICON) || {};
    var files = typeof o.files === 'function' ? o.files
      : function () { return (spirit.shell && typeof spirit.shell.currentFiles === 'function' && spirit.shell.currentFiles()) || []; };
    var formatBytes = (spirit.core.util && spirit.core.util.formatBytes) || function (n) { return String(n); };
    var byPath = Object.create(null);   // path -> the tree's entry, for paint and pick
    var folded = Object.create(null);   // folder path -> true while its rows are folded away
    var list = null;

    var root = document.createElement(isPane ? 'div' : 'span');
    root.className = 'file-selector ' + (isPane ? 'file-selector-face-pane' : 'file-selector-face-dropdown');
    root.value = '';
    root.row = null;
    var host = document.createElement(isPane ? 'div' : 'span');
    root.appendChild(host);

    function words() { return list && typeof list.words === 'function' ? list.words() : ''; }
    function underFolded(p) {
      for (var cut = p.lastIndexOf('/'); cut !== -1; cut = p.lastIndexOf('/', cut - 1)) if (folded[p.slice(0, cut)]) return true;
      return false;
    }
    // THE ROWS: the tree in path order. A row holds only its name and path (its key), so the words are matched there and
    // nowhere else; its kind and stat are read from the entry. With no words a folded folder's rows stay out.
    function rows() {
      var all = (files() || []).slice().sort(function (a, b) { return a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0; });
      var tree = !words();
      byPath = Object.create(null);
      return all.filter(function (f) {
        byPath[f.relativePath] = f;
        return !tree || !underFolded(f.relativePath);
      }).map(function (f) { return { key: f.relativePath, name: f.name }; });
    }
    function iconOf(f) {
      if (f.kind === 'folder') return ICON.FOLDER || '';
      var sh = spirit.shell;
      if (sh && typeof sh.mimeTypeForName === 'function' && typeof sh.iconForFile === 'function') return sh.iconForFile(sh.mimeTypeForName(f.name));
      return ICON.FILE || '';
    }
    function when(iso) { return iso ? escapeHtml(String(iso).slice(0, 16).replace('T', ' ')) : ''; }
    // ONE ROW: the icon, then the name in the tree (one indent per slash) or the full path in the list, the match
    // marked; then size and modified, right-justified.
    function paint(row, mark) {
      var f = byPath[row.key] || { kind: 'file', name: row.name, relativePath: row.key };
      var m = typeof mark === 'function' ? mark : escapeHtml;
      var name;
      if (words()) name = m(f.relativePath);
      else {
        var depth = f.relativePath.split('/').length - 1;
        var indent = '';
        for (var i = 0; i < depth; i++) indent += '<span class="file-selector-indent" style="display:inline-block;width:1em"></span>';
        name = indent + m(f.name) + (f.kind === 'folder' && folded[f.relativePath] ? ' …' : '');
      }
      return '<td class="label-cell">' + iconOf(f) + ' ' + name + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' + (f.kind === 'file' && typeof f.size === 'number' ? escapeHtml(formatBytes(f.size)) : '') + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' + when(f.modified) + '</td>';
    }

    list = window.spiritElements.shellCreateListSearch(host, {
      mode: isPane ? 'pane' : 'dropdown',
      placeholder: isPane ? '' : (o.placeholder || 'choose a file…'),
      rows: rows,
      paint: paint,
      name: function (row) { return row.key; },
      // A FOLDER IN THE TREE FOLDS (the box: "a folder row folding the rows under it"); the press is its own, no pick.
      fold: function (row) {
        var f = byPath[row.key];
        if (!f || f.kind !== 'folder' || words()) return false;
        if (folded[row.key]) delete folded[row.key]; else folded[row.key] = true;
        return true;
      },
      pick: function (row) {
        root.value = row.key;
        root.row = byPath[row.key] || row;
        root.dispatchEvent(new Event('change', { bubbles: true }));
      },
      empty: o.empty || 'No file matches.',
    });

    // The tree changed: the list drawn again from it.
    root.refresh = function () { list.redraw(); };
    root.destroy = function () { list.destroy(); };
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createFileSelector = createFileSelector;
}());
