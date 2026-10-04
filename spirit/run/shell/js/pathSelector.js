'use strict';

// spirit/run/shell/js/pathSelector.js
// THE PATH SELECTOR (goal/G4.23), a shell element on the shell's one file tree (goal/G4.25).
//
//   Andy, 2026-10-04: "the red-bordered agent bubbles become tab-headers again, with their own pane for
//   scope-configuration. file/folder selector in it a shell element."; "so this just needs to bridge the gap, the shell
//   maintains one complete tree, and all apps/file-pickers feed from that?"
//
// createPathSelector({files, foldersOnly}) answers its root: a search box and one row per match, each with data-path,
// a folder's path ending in '/', relative to spirit/run as the tree is. options.files() answers the tree as it stands
// ([{relativePath, kind}], the shell's currentFiles), asked again on every keystroke, so nothing here is kept stale.
// Typing narrows the rows, case ignored; a click on a row sets root.value to its path and fires one bubbling
// 'change'. EVERY LIST IS A SEARCH: at most ROWS_MAX rows, never the whole tree, and a cut answer says so.

(function () {
  var ROWS_MAX = 50;

  function createPathSelector(options) {
    var o = options || {};
    var files = typeof o.files === 'function' ? o.files : function () { return []; };
    var root = document.createElement('div');
    root.className = 'path-selector';
    root.value = '';
    var input = document.createElement('input');
    input.setAttribute('placeholder', o.foldersOnly ? 'search folders' : 'search files and folders');
    var list = document.createElement('div');
    var note = document.createElement('div');
    note.className = 'job-manifest-note';
    root.appendChild(input);
    root.appendChild(list);
    root.appendChild(note);

    function paths() {
      var text = String(input.value || '').toLowerCase();
      return (files() || []).filter(function (f) { return f && (!o.foldersOnly || f.kind === 'folder'); })
        .map(function (f) { return f.relativePath + (f.kind === 'folder' ? '/' : ''); })
        .filter(function (p) { return !text || p.toLowerCase().indexOf(text) !== -1; })
        .sort();
    }
    function draw() {
      var found = paths();
      var rows = found.slice(0, ROWS_MAX).map(function (p) {
        var row = document.createElement('div');
        row.setAttribute('data-path', p);
        row.textContent = p;
        row.style.cursor = 'pointer';
        return row;
      });
      list.replaceChildren.apply(list, rows);
      note.textContent = found.length > ROWS_MAX ? 'more than ' + ROWS_MAX + ' match: type to narrow' : (found.length ? '' : 'nothing matches');
    }

    input.addEventListener('input', draw);
    root.addEventListener('click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('[data-path]') : null;
      if (!row) return;
      root.value = row.getAttribute('data-path');
      root.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // The tree moves as files come and go: an owner may redraw it after a change.
    root.refresh = draw;
    draw();
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createPathSelector = createPathSelector;
}());
