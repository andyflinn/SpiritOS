// spirit/run/shell/js/rows/fileElement.js
// ONE FILE OR FOLDER, AS A ROW ELEMENT (goal/G30.18). Its subject is a path; its fields icon, name, size and changed;
// it reads data.files of the faceless layer (shell/js/spiritData.js, goal/G30.16), which the fs-watcher's stream keeps,
// so a change to a file repaints that file's cells and nothing else. rowElement.js does the shared work; this file says what a file is.
//
// THE DISPATCH OF FILES: one watch on data.files for every file row on the page, and an index by path. A row registers
// on create and leaves on destroy.
//
// Actions: open (the viewer the page hands in, ctx.open, or the text launcher) and remove (fs.delete). An action asks
// and paints nothing: the fs-watcher's own event repaints, or marks the row gone. expandInfo asks fs.stat and
// fs.annotations, once.
(function () {
  var E = window.spiritElements = window.spiritElements || {};
  var files = null;

  function icons() { return (window.spirit && spirit.core && spirit.core.const && spirit.core.const.ICON) || {}; }
  function esc(s) {
    var f = window.spirit && spirit.core && spirit.core.util && spirit.core.util.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function bytes(n) {
    var f = window.spirit && spirit.core && spirit.core.util && spirit.core.util.formatBytes;
    return typeof n !== 'number' ? '' : (f ? f(n) : n + ' B');
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toISOString().slice(0, 16).replace('T', ' ');
  }

  function known(p) { var D = window.spiritData; return (D && D.get('files/' + p)) || null; }
  var subscribed = false;
  // A write to data.files, by path, to the rows that show that path.
  function dispatch(idx) {
    if (subscribed || !window.spiritData) return;
    subscribed = true;
    window.spiritData.watch('files', function (path, v) {
      var p = String(path).slice('files/'.length);
      if (!p) return;
      idx.forKey(p).forEach(function (el) {
        if (!v) el.apply({ gone: true });
        else el.apply({ kind: v.kind, size: v.size, modified: v.modified, gone: false });
      });
    });
  }

  function index() { files = files || E.rowElement.index(dispatch); return files; }

  function create(row) {
    var r = row || {};
    var p = String(r.path || '');
    var k = known(p) || {};
    return E.rowElement.create({
      kind: 'file',
      key: p,
      index: index(),
      row: { path: p, name: p.slice(p.lastIndexOf('/') + 1), kind: r.kind || k.kind || 'file',
        size: r.size !== undefined ? r.size : k.size, modified: r.modified || k.modified, gone: false },
      fields: [
        // Its depth rides along (one per slash), so a tree view can indent it (goal/G30.16: Files' tree, 2em a level).
        { name: 'icon', from: ['kind', 'gone'], paint: function (v) {
          var I = icons();
          var glyph = v.gone ? (I.NO || '×') : v.kind === 'folder' ? (I.FOLDER || '') : (I.FILE || '');
          return '<span class="file-depth" style="--depth:' + (String(v.path || '').split('/').length - 1) + '">' + glyph + '</span>';
        } },
        // Where it lives, then what it is: the folders dimmed, the name at full strength (goal/G30.16; a list of bare names
        // read as if every file sat at the top).
        { name: 'name', from: ['path'], paint: function (v) {
          var p = String(v.path || '');
          var cut = p.lastIndexOf('/');
          return (cut >= 0 ? '<span class="path-dir">' + esc(p.slice(0, cut + 1)) + '</span>' : '') + '<span class="path-file">' + esc(p.slice(cut + 1)) + '</span>';
        } },
        { name: 'size', paint: function (v) { return v.kind === 'folder' ? '' : esc(bytes(v.size)); } },
        { name: 'changed', from: ['modified'], paint: function (v) { return esc(when(v.modified)); } },
      ],
      actions: [
        { name: 'open', label: 'Open', run: function (el, ctx) {
          if (typeof ctx.open === 'function') return ctx.open(el.row.path, el);
          if (typeof ctx.launchApp === 'function') return ctx.launchApp('text-file-launcher', { path: el.row.path });
          return null;
        } },
        { name: 'remove', label: 'Remove', run: function (el) { return spirit.core.ask('fs.delete', { path: el.row.path }); } },
      ],
      expand: function (el) {
        return Promise.all([
          spirit.core.ask('fs.stat', { path: el.row.path }),
          spirit.core.ask('fs.annotations', { path: el.row.path }),
        ]).then(function (a) { return { stat: a[0] && a[0].body, annotations: a[1] && a[1].body }; });
      },
    });
  }

  E.fileElement = { create: create };
}());
