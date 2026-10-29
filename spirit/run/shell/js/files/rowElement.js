// spirit/run/shell/js/files/rowElement.js
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
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['shell/js/rowElement.js'].forEach(function (p) { window.spirit.require(p); });
  var files = null;

  // WHAT THE FS-WATCHER'S STREAM MEANS FOR data.files, IN THE TYPE'S OWN ELEMENT (goal/G41.16; G30.18; Andy: "get rid of
  // thos FUCKING data.js scripts"): the page's mirror of the node's tree (shell/js/spiritData.js). A connecting page is
  // handed the tree as create commands, then treeComplete: the branch fills quietly and its watchers hear one word at
  // the end; after that each change is told by path. Every event ends in set or del. The tree comes as updates of one
  // job, so it is heard from the start: spirit.js loads this file with the cache (Q2: "the file tree must be cached.").
  function translate(D) {
    if (!D || typeof D.translate !== 'function') return;
    D.translate({
      onJob: function (job) {
        if (job.type !== 'fs-watcher') return;
        if (job.data.treeComplete) { D.ready('files', true); return; }
        var cmd = job.data.command;
        if (!cmd || !cmd.path) return;
        if (!D.ready('files')) D.quietly('files', true);
        var p = String(cmd.path);
        if (cmd.op === 'deleteFile') D.del('files/' + p);
        else if (cmd.op === 'deleteDirectory') {
          D.del('files/' + p);
          Object.keys(D.branch('files')).forEach(function (k) { if (k.indexOf(p + '/') === 0) D.del('files/' + k); });
        } else {
          var was = D.branch('files')[p] || {};
          // core: the node's word that the file is core (goal/G30.21), painted yellow by its row.
          D.set('files/' + p, { kind: cmd.op === 'createDirectory' ? 'folder' : was.kind || 'file', size: cmd.size, modified: cmd.modified, core: cmd.core === true });
        }
      },
    });
  }
  if (window.spirit.data) translate(window.spirit.data);
  else if (window.spirit.require) Promise.resolve(window.spirit.require('shell/js/spiritData.js')).then(function () { translate(window.spirit.data); }, function () {});

  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function bytes(n) {
    var f = window.spirit && spirit.formatBytes;
    return typeof n !== 'number' ? '' : (f ? f(n) : n + ' B');
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toISOString().slice(0, 16).replace('T', ' ');
  }

  function known(p) { var D = window.spirit.data; return (D && D.get('files/' + p)) || null; }
  var subscribed = false;
  // A write to data.files, by path, to the rows that show that path.
  function dispatch(idx) {
    if (subscribed || !window.spirit.data) return;
    subscribed = true;
    window.spirit.data.watch('files', function (path, v) {
      var p = String(path).slice('files/'.length);
      if (!p) return;
      idx.forKey(p).forEach(function (el) {
        if (!v) el.apply({ gone: true });
        else el.apply({ kind: v.kind, size: v.size, modified: v.modified, core: v.core === true, gone: false });
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
        size: r.size !== undefined ? r.size : k.size, modified: r.modified || k.modified, core: (r.core !== undefined ? r.core : k.core) === true, gone: false },
      fields: [
        // ONE CELL: the indent, the icon, then where it lives and what it is (goal/G30.16). The depth rides along (one per
        // slash) for a tree view to indent; the folders dimmed, the name at full strength (a list of bare names read as if
        // every file sat at the top). A tree view hides the folders, the indent saying them.
        // A CORE FILE'S NAME IN YELLOW (goal/G30.21), the node's word on the fs-watcher's command.
        { name: 'name', from: ['path', 'kind', 'gone', 'core'], paint: function (v) {
          var glyph = v.gone ? '❌' : v.kind === 'folder' ? '📁' : '📄';
          var p = String(v.path || '');
          var cut = p.lastIndexOf('/');
          return '<span class="file-depth" style="--depth:' + (p.split('/').length - 1) + '">' + glyph + '</span> ' +
            (cut >= 0 ? '<span class="path-dir">' + esc(p.slice(0, cut + 1)) + '</span>' : '') + '<span class="path-file"' + (v.core ? ' style="color:var(--spirit-core, #e6c200)" title="core: write-protected"' : '') + '>' + esc(p.slice(cut + 1)) + '</span>';
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
        // Through the spirit object (goal/G32.2): checked calls answering the reply's body.
        { name: 'remove', label: 'Remove', run: function (el) { return spirit.ready.then(function (s) { return s.fs.delete({ path: el.row.path }); }); } },
      ],
      expand: function (el) {
        return spirit.ready.then(function (s) {
          return Promise.all([s.fs.stat({ path: el.row.path }), s.fs.annotations({ path: el.row.path })]);
        }).then(function (a) { return { stat: a[0], annotations: a[1] }; });
      },
    });
  }

  E.fileElement = { create: create };
}());
