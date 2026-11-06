// spirit/run/spirit/element/search/file/rowElement.js
// ONE FILE OR FOLDER, AS A ROW ELEMENT (goal/G30.18). Its subject is a path; its fields icon, name, size and changed;
// it reads the node's file tree as the fs family's cache manager keeps it (spirit.data.fs.data, goal/G41.28), which the
// fs-watcher's stream keeps, so a change to a file repaints that file's cells and nothing else. rowElement.js does the
// shared work; this file says what a file is.
//
// THE DISPATCH OF FILES: one watch on the file tree for every file row on the page, and an index by path. A row registers
// on create and leaves on destroy.
//
// Actions: open (the viewer the page hands in, ctx.open, or the text launcher) and remove (fs.delete). An action asks
// and paints nothing: the fs-watcher's own event repaints, or marks the row gone. expandInfo asks fs.stat and
// fs.annotations, once.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  // goal/G41.23: a file's icon is the icon element (spirit/element/icon.js), loaded here too.
  // goal/G43.17: a file's icon is its kind's, which fstat says.
  if (window.spirit.require) ['spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/word.js', 'spirit/element/fstat.js'].forEach(function (p) { window.spirit.require(p); });
  var files = null;

  // THE NODE'S FILE TREE IS THE fs FAMILY'S CACHE (goal/G41.28): its translator and its branch are the family's own
  // data.js's (spirit/fs/data.js), which this element loads itself (rule/26), with the data set
  // it fills; a row reads spirit.data.fs.data.
  function fsReads() { return (window.spirit && ((window.spirit.data || {}).fs || {}).data) || null; }
  // Asked as this file runs, so it is part of this file's tree: whoever requires this element has the manager with it.
  var fsReady = Promise.resolve(window.spirit.cacheManager('fs')).then(function () { return fsReads(); });

  // ICONS AS THEMSELVES (goal/G30.21): the glyph is written, never a key into a table.
  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // AN ICON THAT STANDS ALONE IS THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting
  // all shell elements and apps."): made by icon.create and handed on as its markup, since a cell is painted as text; the
  // glyph as plain text while icon.js has not loaded.
  function iconHtml(glyph) {
    var I = E.icon;
    if (!I || typeof I.create !== 'function' || typeof document === 'undefined') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }
  function iconOf(p) { return E.fstat && typeof E.fstat.iconOf === 'function' ? E.fstat.iconOf(p) : '❔'; }
  function bytes(n) {
    var f = window.spirit && spirit.formatBytes;
    return typeof n !== 'number' ? '' : (f ? f(n) : n + ' B');
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toISOString().slice(0, 16).replace('T', ' ');
  }

  // THE RESERVED WORDS IN COLOUR (goal/G43.4; Andy, the box: "display folders and path elements in a bright green if their
  // names match a reserved word AND the browsers spirit object contains the corresponding javascript Object at that path.",
  // and "in a bright red if folders and the browser spirit object disagree."; "the colors will follow word.json changes
  // live."). Each element of a path under spirit/: its name up to the first dot against the word system, its object on
  // the spirit object at that path. spirit itself is always green; a name that is no reserved word has no colour.
  var WORD_COLOUR = { green: '#22e022', red: '#ff3030' };
  function wordColours(p) {
    var parts = String(p || '').split('/');
    if (parts[0] !== 'spirit' || !window.spirit.word) return Promise.resolve({});
    var out = { spirit: WORD_COLOUR.green };
    return Promise.all(parts.slice(1).map(function (part, i) {
      var stem = part.split('.')[0];
      return window.spirit.word.check(parts.slice(0, i + 1).join('.'), stem).then(function (word) {
        if (!word) return;
        var at = window.spirit;
        parts.slice(1, i + 1).forEach(function (up) { at = at ? at[up.split('.')[0]] : undefined; });
        var held = at ? at[word] : undefined;
        out[part] = held && (typeof held === 'object' || typeof held === 'function') ? WORD_COLOUR.green : WORD_COLOUR.red;
      });
    })).then(function () { return out; });
  }
  function wordSpan(text, name, colours) {
    var c = colours && colours[name];
    return c ? '<span style="color:' + c + '">' + esc(text) + '</span>' : esc(text);
  }
  function dirHtml(dir, colours) {
    return dir.split('/').filter(Boolean).map(function (part) { return wordSpan(part, part, colours) + '/'; }).join('');
  }

  function known(p) { var F = fsReads(); return F ? F.file(p) : null; }
  // A write to data.files, by path, to the rows that show that path; its release answered to the index, which lets it go
  // with the kind's last row (rowElement.index).
  // Made once the fs family's manager is on the page; let go at once if the index lets it go first.
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(F) {
      if (gone || !F || off) return;
      off = F.watch(function (p, v) {
        if (!p) return;
        idx.forKey(p).forEach(function (el) {
          if (!v) el.apply({ gone: true });
          else el.apply({ kind: v.kind, size: v.size, modified: v.modified, core: v.core === true, gone: false });
        });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(fsReads());
    if (!off) fsReady.then(listen);
    return function () { gone = true; if (typeof off === 'function') off(); };
  }

  function index() { files = files || E.rowElement.index(dispatch); return files; }

  function create(row) {
    var r = row || {};
    var p = String(r.path || '');
    var k = known(p) || {};
    var el = E.rowElement.create({
      kind: 'file',
      key: p,
      index: index(),
      row: { path: p, name: p.slice(p.lastIndexOf('/') + 1), kind: r.kind || k.kind || 'file',
        size: r.size !== undefined ? r.size : k.size, modified: r.modified || k.modified, core: (r.core !== undefined ? r.core : k.core) === true, gone: false, open: r.open === true },
      fields: [
        // ONE CELL: the indent, the icon, then where it lives and what it is (goal/G30.16). The depth rides along (one per
        // slash) for a tree view to indent; the folders dimmed, the name at full strength (a list of bare names read as if
        // every file sat at the top). A tree view hides the folders, the indent saying them.
        // A CORE FILE'S NAME IN YELLOW (goal/G30.21), the node's word on the fs-watcher's command.
        { name: 'name', from: ['path', 'kind', 'gone', 'core', 'words', 'open'], paint: function (v) {
          // BY ITS KIND (goal/G43.17; the box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of
          // unknown kind, ❔"). A folder's open or shut is the list's to say, as it draws the tree.
          var glyph = v.gone ? '❌' : v.kind === 'folder' ? (v.open ? '📂' : '📁') : iconOf(v.path);
          var p = String(v.path || '');
          var cut = p.lastIndexOf('/');
          return '<span class="file-depth" style="--depth:' + (p.split('/').length - 1) + '">' + iconHtml(glyph) + '</span> ' +
            (cut >= 0 ? '<span class="path-dir">' + dirHtml(p.slice(0, cut + 1), v.words) + '</span>' : '') + '<span class="path-file"' + (v.core ? ' style="color:var(--spirit-core, #e6c200)" title="core: write-protected"' : '') + '>' + wordSpan(p.slice(cut + 1), p.slice(cut + 1), v.words) + '</span>';
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
    // Its colours, once the word system has answered, and again whenever a word.json changes.
    var live = true;
    var paintWords = function () { wordColours(p).then(function (words) { if (live) el.apply({ words: words }); }); };
    var offWords = null;
    var listen = function () {
      if (!live || !window.spirit.word) return;
      offWords = window.spirit.word.changed(paintWords);
      paintWords();
    };
    if (window.spirit.word) listen();
    else if (window.spirit.require) Promise.resolve(window.spirit.require('spirit/word.js')).then(listen, function () { /* no colours */ });
    var destroy = el.destroy;
    el.destroy = function () { live = false; if (offWords) offWords(); return destroy.apply(el, arguments); };
    return el;
  }

  E.fileElement = { create: create };
}());
