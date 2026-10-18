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
// createFileSelector({ face, files, accept, placeholder, empty }) answers its root element:
//   face       'pane', else the dropdown
//   files()    the tree as spirit.shell.currentFiles answers it ([{name, relativePath, kind, size, modified}]), asked
//              again at every draw, so nothing here is kept stale
//   accept     the app's hidden type filter: an array of extensions ('.js') and mimetype prefixes ('text/', 'image/'),
//              or a function of the entry; files outside it never show, folders always do
// A press on a file makes it the root's value (its path) and row, and fires one bubbling change on the root; a press on
// a folder is never a pick: in the tree it opens or shuts the folder.
//
// AFTER THE FIRST BUILD (the box): "No words: every folder starts folded; a press on a folder unfolds or folds it, in
// the pane and in the dropdown alike, and is never a pick."; "Words typed: every match shows, nothing folded."; "In the
// tree the icon stands right before the name, after the indent."

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
    var opened = Object.create(null);   // folder path -> true while its rows show; every folder starts folded
    var list = null;

    var root = document.createElement(isPane ? 'div' : 'span');
    root.className = 'file-selector ' + (isPane ? 'file-selector-face-pane' : 'file-selector-face-dropdown');
    root.value = '';
    root.row = null;
    var host = document.createElement(isPane ? 'div' : 'span');
    root.appendChild(host);

    function words() { return list && typeof list.words === 'function' ? list.words() : ''; }
    // In the tree a row shows when every folder above it is open.
    function underFolded(p) {
      for (var cut = p.lastIndexOf('/'); cut !== -1; cut = p.lastIndexOf('/', cut - 1)) if (!opened[p.slice(0, cut)]) return true;
      return false;
    }
    var mimeOf = function (name) {
      var sh = spirit.shell;
      return sh && typeof sh.mimeTypeForName === 'function' ? String(sh.mimeTypeForName(name)) : '';
    };
    // THE APP'S TYPE FILTER (the box: "A file dropdown takes a hidden type filter the app configures (extensions or
    // mimetype prefixes); folders always show.").
    function accepted(f) {
      if (f.kind === 'folder' || o.accept == null) return true;
      if (typeof o.accept === 'function') return !!o.accept(f);
      var name = String(f.name || '').toLowerCase();
      var mime = mimeOf(f.name);
      return (Array.isArray(o.accept) ? o.accept : [o.accept]).some(function (a) {
        a = String(a).toLowerCase();
        return a.charAt(0) === '.' ? name.slice(-a.length) === a : mime.indexOf(a) === 0;
      });
    }
    // THE ROWS: the tree in path order. A row holds only its name and path (its key), so the words are matched there and
    // nowhere else; its kind and stat are read from the entry. With no words a folded folder's rows stay out.
    function rows() {
      var all = (files() || []).slice().sort(function (a, b) { return a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0; });
      var tree = !words();
      byPath = Object.create(null);
      return all.filter(function (f) {
        if (!accepted(f)) return false;
        byPath[f.relativePath] = f;
        return !tree || !underFolded(f.relativePath);
      }).map(function (f) { return { key: f.relativePath, name: f.name }; });
    }
    function iconOf(f) {
      if (f.kind === 'folder') return ICON.FOLDER || '';
      var sh = spirit.shell;
      if (sh && typeof sh.iconForFile === 'function') return sh.iconForFile(mimeOf(f.name));
      return ICON.FILE || '';
    }
    function when(iso) { return iso ? escapeHtml(String(iso).slice(0, 16).replace('T', ' ')) : ''; }
    // ONE ROW: in the tree the indent (one per slash), the icon and the name; in the list the icon and the full path,
    // the match marked; then size and modified, right-justified.
    function paint(row, mark) {
      var f = byPath[row.key] || { kind: 'file', name: row.name, relativePath: row.key };
      var m = typeof mark === 'function' ? mark : escapeHtml;
      var name;
      if (words()) name = iconOf(f) + ' ' + m(f.relativePath);
      else {
        var depth = f.relativePath.split('/').length - 1;
        var indent = '';
        for (var i = 0; i < depth; i++) indent += '<span class="file-selector-indent" style="display:inline-block;width:1em"></span>';
        name = indent + iconOf(f) + ' ' + m(f.name) + (f.kind === 'folder' && !opened[f.relativePath] ? ' …' : '');
      }
      // A NAME IS NEVER CUT SHORT (goal/G29.8): no label-cell cap; the popup is as wide as its rows, up to the page.
      return '<td style="white-space:nowrap">' + name + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' + (f.kind === 'file' && typeof f.size === 'number' ? escapeHtml(formatBytes(f.size)) : '') + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' + when(f.modified) + '</td>';
    }

    list = window.spiritElements.shellCreateListSearch(host, {
      mode: isPane ? 'pane' : 'dropdown',
      placeholder: isPane ? '' : (o.placeholder || 'choose a file…'),
      rows: rows,
      // WORDS IN: NAMES | PATHS (goal/G29.8; Andy, 2026-10-18: "the default for your filter should be filename only"):
      // names matches the words against the file name alone, paths against the whole path, folders included.
      filters: [{ name: 'in', choices: [{ value: 'names', word: 'names' }, { value: 'paths', word: 'paths' }] }],
      matched: function (row, values) { return values.in === 'paths' ? { name: row.name, path: row.key } : { name: row.name }; },
      paint: paint,
      name: function (row) { return row.key; },
      // A FOLDER IS NEVER A PICK: in the tree its press opens or shuts it; in the list it does nothing.
      fold: function (row) {
        var f = byPath[row.key];
        if (!f || f.kind !== 'folder') return false;
        if (!words()) { if (opened[row.key]) delete opened[row.key]; else opened[row.key] = true; }
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
