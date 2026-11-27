'use strict';
// spirit/run/spirit/element/search/file/list/script.js
// The list the file selector, ../script.js, draws (goal/G43.32: it was search/file.js). Its test: ../test/script.js, through the selector.
// THE FILES LIST, A DROP-IN SHELL ELEMENT (goal/G30.20): the node's files on the standard list-tool
// (spirit/element/search/script.js), each row a file row element (file/row.js), the list a view of the fs family's
// cache (spirit/fs/client/script.js, spirit.required.spirit.data.fs.data: the faceless layer's mirror of the node's tree). The Files app draws it as a pane, an app picking a file as a
// dropdown; it replaced the legacy file selector, deleted with it.
//   - Names are ranked from the mirror at once; fs.search is asked only by contents, what the page cannot answer.
//   - No words: the tree, in path order, every folder folded at first, 2em of indent per slash; a folder's press opens
//     or shuts it and is never a pick. Words: every match, ranked, with its path.
//   - accept: the app's hidden type filter, extensions ('.md') and mimetype prefixes ('image/'), or a function of the
//     row; a file outside it never shows, folders always do.
//   - flat (goal/G47.1, the box: "The file list has one always hidden option, \"flat\", set only in code by the app that
//     draws the list; no button shows or flips it", "With flat on: no folder rows, never the indented tree; with an
//     empty field every file the app accepts is listed, each with its path; typing narrows it", "With flat off, the
//     default, the file list is as it is today"): no folder row ever, and the flat look whether words are typed or not.
//
//   create(host, opts) -> the list (value, row, words(), refresh(), redraw(), sort(), destroy())
//     opts.face         'pane' or 'dropdown'
//     (opts.toggle went, goal/G47.4: its tile part, ../tile/script.js, gives it the list or tiles switch by itself)
//     opts.accept, opts.placeholder, opts.all, opts.empty
//     opts.flat         true: no folders, never the tree (goal/G47.1); set in code only, nothing on screen shows it
//     opts.name(row)    what the dropdown's field says once a file is picked; its path by default
//     opts.pick(row, key)   a file chosen; row.line is the first matched line of a file found by its contents
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/fs/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/fstat/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/file/tile/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/file/row/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/icon/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.requireScript.
  if (window.spirit.requireScript) ['spirit/element/search/file/row/script.js', 'spirit/element/search/file/tile/script.js', 'spirit/element/search/script.js', 'spirit/element/fstat/script.js'].forEach(function (p) { window.spirit.requireScript(p); });
  // The tree it is a view of is the fs family's cache (goal/G41.28), its manager loaded with it.
  keepAnswer('spirit/fs/script.js');
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the file tree is its fs.data.
  function fsReads() { return (window.spirit && ((window.spirit.dataStore || {}).fs || {}).data) || null; }

  function accepted(accept, row) {
    if (row.kind === 'folder' || accept == null) return true;
    if (typeof accept === 'function') return !!accept(row);
    var name = String(row.path || '').toLowerCase();
    var mime = ANSWER['spirit/element/fstat/script.js'] ? String(ANSWER['spirit/element/fstat/script.js'].mimeOf(name)) : '';
    return (Array.isArray(accept) ? accept : [accept]).some(function (a) {
      a = String(a).toLowerCase();
      return a.charAt(0) === '.' ? name.slice(-a.length) === a : mime.indexOf(a) === 0;
    });
  }

  // BY CONTENTS ONLY: fs.search labels a name match with its path and a contents match with json {path, score, line}.
  // found(next) is handed what the node scored, by path, for the list to rank by (goal/G29.11, taken from the file
  // selector): in contents a file ranks by the node's score alone.
  // Through the spirit object (goal/G32.2): spirit.requireScript('spirit/fs/script.js')'s answer.search answers the reply's body.
  function search(args, found) {
    var a = args || {};
    if (!a.contents || !a.q) { found(Object.create(null), Object.create(null)); return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); }
    return spirit.readyPromise.then(function () { return keepAnswer('spirit/fs/script.js'); }).then(function (s) { return s.search({ q: a.q || '', contents: a.contents || '' }); }).then(function (body) {
      body = body || {};
      var F = fsReads();
      var next = Object.create(null);
      var lines = Object.create(null);
      var items = (body.items || []).map(function (i) {
        var row = null;
        try { row = JSON.parse(i.label); } catch (e) { row = null; }
        if (row && row.path) next[String(row.path).replace(/\/+$/, '')] = Number(row.score) || 0;
        if (row && row.path && row.line > 0) lines[String(row.path).replace(/\/+$/, '')] = Number(row.line);
        // A folder comes with a trailing slash; the watcher and the row know it without one.
        var raw = String((row && row.path) || i.key);
        var folder = /\/$/.test(raw);
        var path = raw.replace(/\/+$/, '');
        var k = (F && F.file(path)) || {};
        return { key: path, label: JSON.stringify({ path: path, name: path.slice(path.lastIndexOf('/') + 1), kind: folder ? 'folder' : (k.kind || 'file'),
          size: k.size, modified: k.modified, line: (row && row.line) || 0 }) };
      });
      found(next, lines);
      return { status: 200, body: { ok: true, items: items, more: !!body.more } };
    });
  }

  function create(host, opts) {
    var o = opts || {};
    var opened = Object.create(null);   // the folders open in the tree, by path
    var scores = Object.create(null);   // path -> the node's contents score, from the last contents search
    // path -> the line of the first match, from the same search. BOTH KEPT HERE, BY PATH: a row is the tree's, and the node's
    // next word on that file (spirit.fs's set, spirit/fs/client/script.js) writes it anew without what the search said, so a list that
    // read the score or the line off the row lost both while the tree was still arriving (goal/G43.17).
    var lines = Object.create(null);
    var made = Object.create(null);     // path -> its row element, so a folder's press can say it is open (goal/G43.17: 📂)
    var tiles = Object.create(null);    // path -> its tile, so a folder's press shows 📂 on its tile too
    function tileIcon(row, p) { return row.kind === 'folder' ? (opened[p] ? '📂' : '📁') : (ANSWER['spirit/element/fstat/script.js'] ? ANSWER['spirit/element/fstat/script.js'].iconOf(p) : '❔'); }
    var list = null;
    // FLAT (goal/G47.1): no folder row and never the indented tree, so every row shows its path.
    var flat = o.flat === true;
    // The tree's indent and its hidden path are shell.css's (.files-tree, goal/G47.1, box v109), only where there is a tree.
    host.innerHTML =
      // The list search's box takes all of this one (goal/G40.8: space granted top-down).
      // Its box keeps what it holds inside (script-sibling-browser.js: overflow not visible).
      '<div class="' + (flat ? 'fill' : 'files-tree fill') + '" style="overflow:hidden"></div>';
    var inner = host.lastChild;
    list = ANSWER['spirit/element/search/script.js'].create(inner, {
      // Its own data source (goal/G43.24): the search asks it, and is handed no api.
      search: function (args) { return search(args, function (next, at) { scores = next; lines = at; }); },
      // A view of the node's file tree, the branch the fs family's manager keeps (spirit.required.spirit.data.fs.data.branch).
      data: fsReads().branch,
      api: 'spirit/fs/script.js',
      verb: 'search',
      face: o.face,
      placeholder: o.placeholder || 'choose a file…',
      all: o.all,
      // What the dropdown's field says once a file is picked: its path, or the mounter's words (text names it in its title bar).
      name: typeof o.name === 'function' ? o.name : function (row) { return String(row.path || row.key || ''); },
      args: function (text, values) { return { q: text, contents: values.in === 'contents' }; },
      columns: [
        { field: 'name', from: 'path', label: 'Name', sort: 'path' },
        { field: 'size', label: 'Size', sort: 'number', align: 'right' },
        { field: 'changed', from: 'modified', label: 'Changed', sort: 'date' },
      ],
      // ITS TILE PART (goal/G47.4; goal/G43.17, Q14: its kind's icon, a folder 📁 shut and 📂 open, and its name): ./tile.js. A
      // press on a tile does what a press on its row does, a folder opening or shutting. With it the shared search shows the
      // list or tiles switch by itself (the toggle option went).
      tile: function (row, key) {
        var p = String(key || row.path || '');
        var n = ANSWER['spirit/element/search/file/tile/script.js'].create(Object.assign({ key: p }, row), { icon: tileIcon(row, p), press: function (r, k) { list.press(k); } });
        tiles[p] = { node: n, row: row };
        return n;
      },
      element: function (row, key) { var el = ANSWER['spirit/element/search/file/row/script.js'].create(Object.assign({ path: key }, row, { open: !!opened[key] })); made[key] = el; return el; },
      // A file deleted on disc is held back from every draw: its row took itself out (../row/script.js, leave).
      visible: function (row) { var el = row ? made[row.key || row.path] : null; return !(el && el.row && el.row.gone); },
      score: function (row, values) { return values.in === 'contents' ? (scores[row.key || row.path] || 0) : null; },
      filters: [
        { name: 'in', choices: [{ value: 'names', word: 'names' }, { value: 'contents', word: 'contents' }] },
        // THE TREE and THE APP'S TYPES, not drawn: while the field is empty a row shows only when every folder above it
        // is open.
        // Flat, every accepted file shows, however deep, and no folder.
        { name: 'tree', when: function () { return false; }, test: function (row) {
          if (flat) return row.kind !== 'folder' && accepted(o.accept, row) ? 1 : 0;
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
        if (made[key]) made[key].apply({ open: !!opened[key] });
        var t = tiles[key];
        if (t && ANSWER['spirit/element/icon/script.js']) { var ic = t.node.querySelector('.icon'); if (ic) { ic.innerHTML = ''; ANSWER['spirit/element/icon/script.js'].create(ic, { glyph: tileIcon(t.row, key) }); } }
        return true;
      },
      // A contents match is picked with its line, from what the search said (lines above), whatever the row holds now.
      pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row ? Object.assign({}, row, { line: lines[key] || 0 }) : row, key); },
      empty: o.empty || 'No file matches.',
    });
    // The tree is in path order until a header is pressed; the indent only while the list is the tree.
    list.sort('name', 'asc');
    function treeLook() { inner.classList.toggle('files-tree', !flat && !list.words()); }
    inner.addEventListener('input', treeLook);
    inner.addEventListener('click', treeLook);
    list.refresh();
    // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), the tree's style with it.
    var destroyList = list.destroy;
    list.destroy = function () { destroyList(); host.innerHTML = ''; };
    return list;
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
